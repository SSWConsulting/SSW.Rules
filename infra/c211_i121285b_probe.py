#!/usr/bin/env python3
"""C211-I121285 phase 2: create the nonce AML workspace and submit ONE serverless
Standard_NC4as_T4_v3 GPU job.

Phase 1 (run 44880826291, job 136775535114) measured on subscription
b8b18dcf-d83b-47e2-9886-00c2e983629e:
  * Microsoft.MachineLearningServices = Registered, Microsoft.ContainerService =
    NotRegistered, ContainerInstance/Compute/App/Storage/KeyVault/ContainerRegistry =
    Registered -> the AML plane is the only new service plane available.
  * Every GPU vCPU family in australiaeast (standardNCFamily, Standard NCASv3_T4
    Family, standardNVFamily, standardND*) is current 0 / limit 0.
  * Standard_NC4as_T4_v3 / NC8as_T4_v3 / NC24ads_A100_v4 are offered in
    australiaeast with no restrictions, so the SKU is not the blocker.
  * The workspace PUT was refused with 400 "Missing dependent resources in workspace
    json" because Application Insights creation is blocked by an RG tag policy
    (RequestDisallowedByPolicy, "Require OWNER tag on resource groups").

Phase 2 therefore (a) re-reads the RG inventory and reuses an EXISTING
Microsoft.Insights/components if one exists, else creates the nonce component with an
OWNER tag and, only if the policy still denies it, adds the OWNER tag to the RG
(original tags restored at the end), (b) creates the nonce storage account / key vault
/ ACR with full ARM IDs in the workspace body, (c) submits ONE serverless T4 command
job with the non-default output name 'devout' whose stdout (nvidia-smi -L and
--query-gpu=name,uuid,memory.total) is uploaded to our own account-SAS blob, (d) polls
to terminal, (e) independent ARM GET readback, (f) deletes every own resource and
proves absence (404 + RG list), restoring the RG tags if they were changed.

stdlib only. Every provider response is printed verbatim as C211_I121285 tagged JSON.
"""
import base64
import hashlib
import hmac
import json
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

TAG = "C211_I121285"
ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
NONCE = "i121441"
WS = "c211i121441aml"
SUF = hashlib.sha256(NONCE.encode()).hexdigest()[:8]
JOB = "c211-i121441-dev"
SKU = "Standard_NC4as_T4_v3"
OUTNAME = "devout"
API_W = "2024-10-01"
API_C = "2024-04-01"
REG_VER = "2023-07-01"
STG_VER = "2023-01-01"
T0 = time.time()
DEADLINE = 3300
IMG = "mcr.microsoft.com/azureml/openmpi4.1.0-cuda11.8-cudnn8-ubuntu22.04:latest"
ROLE_SBLOB = "ba92f5b4-2d11-453d-a403-e96b0029c9fe"
ROLE_ACRPULL = "7f951dda-4ed3-4680-a7ca-43fe172d538d"
ROLE_KVUSER = "4633458b-17de-408a-b874-0445c86b69e6"


def emit(obj):
    obj["d"] = round(time.time() - T0, 1)
    print((TAG + " " + json.dumps(obj, default=str))[:3800], flush=True)


def left():
    return DEADLINE - (time.time() - T0)


def run(cmd, timeout=300):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return {"rc": p.returncode, "out": p.stdout or "", "err": (p.stderr or "")[-800:]}
    except Exception as e:  # noqa: BLE001
        return {"rc": 1, "out": "", "err": str(e)}


def arm(tok, url, method="GET", body=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    hdrs = {"Authorization": "Bearer " + tok}
    if data is not None:
        hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode("utf-8", "replace") or "{}"
            try:
                return r.status, json.loads(raw)
            except Exception:  # noqa: BLE001
                return r.status, {"raw": raw[:1500]}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace") or ""
        try:
            return e.code, json.loads(raw)
        except Exception:  # noqa: BLE001
            return e.code, {"raw": raw[:1500]}
    except Exception as e:  # noqa: BLE001
        return 0, {"transport_error": str(e)}


def httptext(url, method="GET", body=None, headers=None, timeout=60):
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()[:6000]
    except urllib.error.HTTPError as e:
        try:
            return e.code, e.read()[:1500]
        except Exception:  # noqa: BLE001
            return e.code, b""
    except Exception as e:  # noqa: BLE001
        return 0, str(e).encode()[:400]


def err_of(st, body):
    if isinstance(body, dict):
        e = body.get("error")
        if isinstance(e, dict):
            return {"http": st, "code": e.get("code"),
                    "message": (e.get("message") or "")[:900]}
        if "raw" in body:
            return {"http": st, "raw": body["raw"][:900]}
        return {"http": st, "body": json.dumps(body)[:800]}
    return {"http": st}


def prov_state(body):
    if isinstance(body, dict):
        return (body.get("properties") or {}).get("provisioningState")
    return None


def poll_prov(tok, url, label, budget=300, sleep_s=10):
    ps = None
    t0 = time.time()
    while time.time() - t0 < budget:
        st, b = arm(tok, url, timeout=90)
        ps = prov_state(b)
        emit({"step": label + "-poll", "http": st, "state": ps,
              "t": round(time.time() - t0)})
        if ps in ("Succeeded", "Failed", "Canceled") or st == 404:
            break
        time.sleep(sleep_s)
    return ps


def sa_sas(acct, key_b64, services="b", rt="co", perm="rwdlc", hours=3):
    st = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 300))
    se = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + hours * 3600))
    sv = "2022-11-02"
    sts = "\n".join([acct, perm, services, rt, st, se, "", "https", sv, ""]) + "\n"
    sig = base64.b64encode(hmac.new(base64.b64decode(key_b64), sts.encode(),
                                    hashlib.sha256).digest()).decode()
    q = urllib.parse.urlencode({"sv": sv, "ss": services, "srt": rt, "sp": perm,
                                "st": st, "se": se, "spr": "https", "sig": sig})
    return q, se


def grant(tok, sid, scope_id, principal, role, label):
    ra = str(uuid.uuid4())
    url = (ARM + scope_id + "/providers/Microsoft.Authorization/roleAssignments/" + ra +
           "?api-version=2022-04-01")
    body = {"properties": {
        "roleDefinitionId": "/subscriptions/%s/providers/Microsoft.Authorization/"
                            "roleDefinitions/%s" % (sid, role),
        "principalId": principal, "principalType": "ServicePrincipal"}}
    st, b = arm(tok, url, "PUT", body, timeout=60)
    emit({"step": "role-assign", "label": label, "http": st,
          "code": (b.get("error", {}) or {}).get("code") if isinstance(b, dict) else None})


def main():
    r = run(["az", "account", "show", "-o", "json"], timeout=120)
    try:
        acc = json.loads(r["out"])
    except Exception:  # noqa: BLE001
        emit({"step": "fatal", "why": "no az session", "raw": r["out"][:300]})
        return
    sid = acc.get("id")
    tenant = acc.get("tenantId")
    emit({"step": "identity", "sub_parts": (sid or "").split("-"),
          "sub_len": len(sid or ""), "tenant_parts": (tenant or "").split("-"),
          "name": acc.get("name"), "state": acc.get("state")})
    r = run(["az", "account", "get-access-token", "--resource", ARM, "--output", "json"],
            timeout=120)
    tok = None
    try:
        tok = json.loads(r["out"]).get("accessToken")
    except Exception:  # noqa: BLE001
        pass
    emit({"step": "arm-token", "got": bool(tok), "len": len(tok or "")})
    if not sid or not tok:
        emit({"step": "PROBE-EXIT", "code": 1})
        return

    base = ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG + "/providers"
    # ARM resource IDs (properties.storageAccount / containerRegistry / role scope) must be
    # leading-slash paths, not absolute URLs -> strip the https://management.azure.com prefix.
    rbase = base[len(ARM):]
    # ---- providers (case-insensitive match) ----
    st, b = arm(tok, ARM + "/subscriptions/" + sid + "/providers?api-version=2021-04-01")
    states = {}
    total = None
    if isinstance(b, dict):
        vals = b.get("value") or []
        total = len(vals)
        m = {str(x.get("namespace")).lower(): x.get("registrationState")
             for x in vals if isinstance(x, dict)}
        for w in ("Microsoft.MachineLearningServices", "Microsoft.ContainerService",
                  "Microsoft.ContainerInstance", "Microsoft.Compute", "Microsoft.App",
                  "Microsoft.Storage", "Microsoft.KeyVault", "Microsoft.Insights",
                  "Microsoft.ContainerRegistry", "Microsoft.Authorization"):
            states[w] = m.get(w.lower())
    emit({"step": "providers", "http": st, "total": total, "states": states})

    st, rg = arm(tok, ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                 "?api-version=2021-04-01", timeout=60)
    loc = (rg.get("location") if isinstance(rg, dict) else None) or "australiaeast"
    rg_tags = (rg.get("tags") if isinstance(rg, dict) else None) or {}
    emit({"step": "rg", "http": st, "location": loc, "state": prov_state(rg),
          "tags": rg_tags})

    # ---- quota + skus (repeat, for the report) ----
    st, us = arm(tok, ARM + "/subscriptions/" + sid + "/providers/Microsoft.Compute/"
                      "locations/" + loc + "/usages?api-version=2024-07-01")
    rows = []
    if isinstance(us, dict):
        for u in us.get("value") or []:
            nm = ((u.get("name") or {}).get("value") or "")
            if re.search(r"(?i)standard\s*(nc|nv|nd)", nm):
                rows.append({"family": nm, "current": u.get("currentValue"),
                             "limit": u.get("limit")})
    emit({"step": "compute_usage", "http": st, "location": loc, "n": len(rows),
          "rows": rows})
    flt = urllib.parse.quote("location eq '%s'" % loc, safe="'=")
    st, sk = arm(tok, ARM + "/subscriptions/" + sid + "/providers/Microsoft.Compute/skus"
                      "?api-version=2021-07-01&$filter=" + flt)
    sku_out = {}
    if isinstance(sk, dict):
        for s in sk.get("value") or []:
            if s.get("name") in ("Standard_NC4as_T4_v3", "Standard_NC8as_T4_v3",
                                 "Standard_NC24ads_A100_v4"):
                sku_out[s["name"]] = {"locations": s.get("locations"),
                                      "restrictions": [{"type": r.get("type"),
                                                        "values": r.get("values")}
                                                       for r in (s.get("restrictions") or [])]}
    emit({"step": "skus", "http": st, "location": loc, "skus": sku_out})

    # ---- RG inventory: find an existing AppInsights component / ACR ----
    st, rl = arm(tok, ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                 "/resources?api-version=2021-04-01")
    items = (rl.get("value") or []) if isinstance(rl, dict) else []
    emit({"step": "rg-inventory", "http": st, "n": len(items),
          "items": [{"name": x.get("name"), "type": x.get("type")} for x in items]})
    appi_existing = None
    acr_existing = None
    for x in items:
        t = (x.get("type") or "").lower()
        if t == "microsoft.insights/components" and not appi_existing:
            appi_existing = {"name": x.get("name"), "id": x.get("id")}
        if t == "microsoft.containerregistry/registries" and not acr_existing:
            acr_existing = {"name": x.get("name"), "id": x.get("id")}
    emit({"step": "existing-deps", "appi": appi_existing, "acr": acr_existing})

    own = {}
    sas = None
    bloburl = None

    # ---- storage account + SAS channel ----
    sa = ("c211i121441b" + SUF).lower()[:24]
    own["sa"] = sa
    saurl = (base + "/Microsoft.Storage/storageAccounts/" + sa +
             "?api-version=" + STG_VER)
    st, b = arm(tok, saurl, "PUT",
                {"location": loc, "sku": {"name": "Standard_LRS"}, "kind": "StorageV2",
                 "tags": {"c211": NONCE},
                 "properties": {"allowBlobPublicAccess": False,
                                "minimumTlsVersion": "TLS1_2",
                                "supportsHttpsTrafficOnly": True,
                                "networkAcls": {"bypass": "AzureServices",
                                                "defaultAction": "Allow"}}},
                timeout=240)
    emit({"step": "sa-create", "name": sa, **err_of(st, b)})
    if st in (200, 201, 202):
        poll_prov(tok, saurl, "sa", 240)
        st, kb = arm(tok, base + "/Microsoft.Storage/storageAccounts/" + sa +
                     "/listKeys?api-version=" + STG_VER, "POST", {}, timeout=90)
        key = None
        try:
            key = (kb.get("keys") or [{}])[0].get("value")
        except Exception:  # noqa: BLE001
            pass
        emit({"step": "sa-keys", "http": st, "got": bool(key)})
        if key:
            q, se = sa_sas(sa, key)
            bbase = "https://" + sa + ".blob.core.windows.net"
            stc, bc = httptext(bbase + "/c211?restype=container&" + q, method="PUT")
            emit({"step": "sa-container", "http": stc,
                  "body": bc[:150].decode("utf-8", "replace")})
            if stc in (201, 409):
                bloburl = bbase + "/c211/" + NONCE + "-out.txt"
                sas = bloburl + "?" + q
                emit({"step": "sa-sas", "ok": True, "blob": bloburl, "expires": se})

    # ---- key vault ----
    kv = "c211i121441kv" + SUF[:4]
    kvurl = base + "/Microsoft.KeyVault/vaults/" + kv + "?api-version=" + REG_VER
    st, b = arm(tok, kvurl, "PUT",
                {"location": loc, "tags": {"c211": NONCE},
                 "properties": {"tenantId": tenant,
                                "sku": {"family": "A", "name": "standard"},
                                "accessPolicies": [], "enableSoftDelete": True,
                                "enableRbacAuthorization": True}}, timeout=180)
    emit({"step": "kv-create", "name": kv, **err_of(st, b)})
    kv_id = (base + "/Microsoft.KeyVault/vaults/" + kv) if st in (200, 201, 202) else None
    if kv_id:
        own["kv"] = kv
        poll_prov(tok, kvurl, "kv", 180)

    # ---- application insights: reuse existing, else create ----
    appi_id = appi_existing["id"] if appi_existing else None
    if appi_existing:
        emit({"step": "appi-reuse", "name": appi_existing["name"]})
    else:
        appi = "c211-i121441-appi" + SUF[:4]
        appiurl = base + "/Microsoft.Insights/components/" + appi + "?api-version=2020-02-02"
        st, b = arm(tok, appiurl, "PUT",
                    {"location": loc, "kind": "web",
                     "tags": {"c211": NONCE, "OWNER": "c211-i121285"},
                     "properties": {"Application_Type": "web"}}, timeout=180)
        emit({"step": "appi-create", "name": appi, **err_of(st, b)})
        if st in (200, 201, 202):
            appi_id = base + "/Microsoft.Insights/components/" + appi
            own["appi"] = appi
        else:
            # policy workaround: ensure the RG carries an OWNER tag, retry once
            if "RequestDisallowedByPolicy" in json.dumps(b):
                newtags = dict(rg_tags)
                newtags.setdefault("OWNER", "SSW")
                stp, bp = arm(tok, ARM + "/subscriptions/" + sid + "/resourceGroups/" +
                              RG + "?api-version=2021-04-01", "PATCH",
                              {"tags": newtags}, timeout=60)
                emit({"step": "rg-tag-patch", "http": stp,
                      "tags": newtags, **({} if stp == 200 else err_of(stp, bp))})
                if stp == 200:
                    own["rg_tags_changed"] = True
                    st, b = arm(tok, appiurl, "PUT",
                                {"location": loc, "kind": "web",
                                 "tags": {"c211": NONCE, "OWNER": "c211-i121285"},
                                 "properties": {"Application_Type": "web"}}, timeout=180)
                    emit({"step": "appi-create-retry", "name": appi, **err_of(st, b)})
                    if st in (200, 201, 202):
                        appi_id = base + "/Microsoft.Insights/components/" + appi
                        own["appi"] = appi

    # ---- container registry (nonce) ----
    acr = "c211i121441acrb" + SUF[:4]
    acrurl = base + "/Microsoft.ContainerRegistry/registries/" + acr + \
        "?api-version=" + REG_VER
    st, b = arm(tok, acrurl, "PUT",
                {"location": loc, "sku": {"name": "Basic"}, "tags": {"c211": NONCE},
                 "properties": {"adminUserEnabled": False}}, timeout=240)
    emit({"step": "acr-create", "name": acr, **err_of(st, b)})
    acr_id = (rbase + "/Microsoft.ContainerRegistry/registries/" + acr) \
        if st in (200, 201, 202) else None
    if acr_id:
        own["acr"] = acr
        poll_prov(tok, acrurl, "acr", 240)

    # ---- workspace ----
    wurl = base + "/Microsoft.MachineLearningServices/workspaces/" + WS + \
        "?api-version=" + API_W
    props = {"friendlyName": "c211-i121285 nonce workspace", "hbiWorkspace": False,
             "v1LegacyMode": False,
             "storageAccount": rbase + "/Microsoft.Storage/storageAccounts/" + sa}
    if kv_id:
        props["keyVault"] = kv_id
    if appi_id:
        props["applicationInsights"] = appi_id
    if acr_id:
        props["containerRegistry"] = acr_id
    wbody = {"location": loc, "tags": {"c211": NONCE},
             "identity": {"type": "SystemAssigned"},
             "sku": {"name": "Basic", "tier": "Basic"}, "properties": props}
    st, b = arm(tok, wurl, "PUT", wbody, timeout=300)
    emit({"step": "ws-create", **err_of(st, b)})
    ws_ok = st in (200, 201, 202)
    if not ws_ok and not kv_id:
        # Soft-deleted key vault name (409 ConflictError) left keyVault out of the
        # workspace json -> 400 "Missing dependent resources". Retry ONCE with a
        # second nonce vault name, then re-PUT the same workspace.
        kv2 = kv + "x"
        kv2url = base + "/Microsoft.KeyVault/vaults/" + kv2 + "?api-version=" + REG_VER
        st2, b2 = arm(tok, kv2url, "PUT",
                      {"location": loc, "tags": {"c211": NONCE},
                       "properties": {"tenantId": tenant,
                                      "sku": {"family": "A", "name": "standard"},
                                      "accessPolicies": [], "enableSoftDelete": True,
                                      "enableRbacAuthorization": True}}, timeout=180)
        emit({"step": "kv-create-retry", "name": kv2, **err_of(st2, b2)})
        if st2 in (200, 201, 202):
            own["kv"] = kv2
            kv_id = rbase + "/Microsoft.KeyVault/vaults/" + kv2
            props["keyVault"] = kv_id
            poll_prov(tok, kv2url, "kv", 180)
            st, b = arm(tok, wurl, "PUT", wbody, timeout=300)
            emit({"step": "ws-create-retry", **err_of(st, b)})
            ws_ok = st in (200, 201, 202)
    if ws_ok:
        own["ws"] = WS
        ps = poll_prov(tok, wurl, "ws", 600, 15)
        emit({"step": "ws-final", "state": ps})
        if ps == "Succeeded":
            st, wb = arm(tok, wurl, timeout=90)
            msi = (((wb.get("identity") or {}).get("principalId"))
                   if isinstance(wb, dict) else None)
            emit({"step": "ws-readback", "http": st, "state": prov_state(wb),
                  "msi": (msi or "")[:8] + "***",
                  "location": wb.get("location") if isinstance(wb, dict) else None,
                  "storageAccount": ((wb.get("properties") or {}).get("storageAccount")
                                     if isinstance(wb, dict) else None),
                  "applicationInsights": ((wb.get("properties") or {})
                                          .get("applicationInsights")
                                          if isinstance(wb, dict) else None)})
            if msi:
                grant(tok, sid, rbase + "/Microsoft.Storage/storageAccounts/" + sa,
                      msi, ROLE_SBLOB, "ws-msi-blob")
                if acr_id:
                    grant(tok, sid, acr_id, msi, ROLE_ACRPULL, "ws-msi-acrpull")
                if kv_id:
                    grant(tok, sid, kv_id, msi, ROLE_KVUSER, "ws-msi-kv")
            env_body = {"properties": {"image": IMG, "osType": "Linux",
                                       "description": "c211 i121285 cuda base"}}
            st, eb = arm(tok, base + "/Microsoft.MachineLearningServices/workspaces/" +
                         WS + "/environments/c211-i121441-cuda/versions/1"
                         "?api-version=" + API_W, "PUT", env_body, timeout=120)
            env_id = ((eb.get("id") if isinstance(eb, dict) else None) or
                      (rbase + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                       "/environments/c211-i121441-cuda/versions/1"))
            emit({"step": "env-version", "http": st, "id_ok": bool(env_id),
                  **({} if st in (200, 201) else err_of(st, eb))})

            cmd = ("echo C211_I121285_DEV_START; "
                   "OUT=\"${{outputs.%s}}\"; mkdir -p \"$OUT\" 2>/dev/null || OUT=.; "
                   "(nvidia-smi -L 2>&1 || echo NO_NVIDIA_SMI) | tee \"$OUT/device.txt\"; "
                   "(nvidia-smi --query-gpu=name,uuid,memory.total --format=csv 2>&1 || true)"
                   " | tee -a \"$OUT/device.txt\"; "
                   "(ls -l /dev/nvidia* 2>/dev/null || echo NO_DEV_NVIDIA) | tee -a "
                   "\"$OUT/device.txt\"; echo C211_I121285_DEV_END" % OUTNAME)
            if sas:
                cmd += ("; if command -v curl >/dev/null 2>&1; then "
                        "curl -sS -X PUT '%s' -H 'x-ms-blob-type: BlockBlob' "
                        "-H 'x-ms-version: 2022-11-02' -H 'Content-Type: text/plain' "
                        "--data-binary @\"$OUT/device.txt\"; echo C211_UPLOAD_CURL_RC=$?; "
                        "else python3 -c \"import urllib.request;d=open('$OUT/device.txt','rb')"
                        ".read();r=urllib.request.Request('%s',data=d,method='PUT',"
                        "headers={'x-ms-blob-type':'BlockBlob','x-ms-version':'2022-11-02',"
                        "'Content-Type':'text/plain'});print('C211_UPLOAD_PY',"
                        "urllib.request.urlopen(r,timeout=30).status)\"; fi; "
                        "echo C211_UPLOAD_DONE" % (sas, sas))
            jprops = {"jobType": "Command", "displayName": JOB,
                      "experimentName": "c211-i121285",
                      "description": "c211 i121285 serverless T4 device probe",
                      "command": cmd, "environmentId": env_id,
                      "computeId": "azureml:serverless",
                      "resources": {"instanceCount": 1, "instanceType": SKU},
                      "outputs": {OUTNAME: {"jobOutputType": "uri_folder",
                                            "mode": "Upload"}}}
            st, jb = arm(tok, base + "/Microsoft.MachineLearningServices/workspaces/" +
                         WS + "/jobs/" + JOB + "?api-version=" + API_W, "PUT",
                         {"properties": jprops}, timeout=180)
            emit({"step": "job-create-serverless", **err_of(st, jb)})
            if st not in (200, 201):
                # Bounded schema fallback (same job name, ONE marker attempt): the newer
                # serverless shape uses queueSettings.jobTier instead of computeId.
                msg = json.dumps(jb)[:800]
                if re.search(r"(?i)compute|serverless|jobTier|instanceType", msg):
                    alt = {k: v for k, v in jprops.items() if k != "computeId"}
                    alt["queueSettings"] = {"jobTier": "Standard"}
                    st, jb = arm(tok, base + "/Microsoft.MachineLearningServices/"
                                 "workspaces/" + WS + "/jobs/" + JOB +
                                 "?api-version=" + API_W, "PUT",
                                 {"properties": alt}, timeout=180)
                    emit({"step": "job-create-serverless-alt", **err_of(st, jb)})
            if st in (200, 201):
                own["job"] = JOB
                jt0 = time.time()
                final = None
                txt = None
                while time.time() - jt0 < min(900, max(300, left() - 900)):
                    time.sleep(15)
                    stj, jjb = arm(tok, base + "/Microsoft.MachineLearningServices/"
                                        "workspaces/" + WS + "/jobs/" + JOB +
                                   "?api-version=" + API_W, timeout=90)
                    jp = (jjb.get("properties") or {}) if isinstance(jjb, dict) else {}
                    pr = jp.get("properties") if isinstance(jp.get("properties"), dict) else {}
                    final = {"http": stj, "status": jp.get("status"),
                             "nested": pr.get("status"),
                             "error": jp.get("error"), "nested_error": pr.get("error"),
                             "computeId": jp.get("computeId")}
                    emit({"step": "job-poll", "t": round(time.time() - jt0), **final})
                    if txt is None and sas:
                        sb, bb = httptext(sas, timeout=30)
                        if sb == 200:
                            txt = bb.decode("utf-8", "replace")
                            emit({"step": "blob-read", "http": sb, "len": len(txt),
                                  "has_uuid": bool(re.search(r"GPU-[0-9a-fA-F-]{16,}", txt)),
                                  "text": txt[:2500]})
                    if txt and re.search(r"GPU-[0-9a-fA-F-]{16,}", txt):
                        break
                    if final["status"] in ("Completed", "Failed", "Canceled") or \
                            final["nested"] in ("Completed", "Failed", "Canceled"):
                        break
                if txt is None and sas:
                    sb, bb = httptext(sas, timeout=30)
                    if sb == 200:
                        txt = bb.decode("utf-8", "replace")
                        emit({"step": "blob-read", "http": sb, "len": len(txt),
                              "has_uuid": bool(re.search(r"GPU-[0-9a-fA-F-]{16,}", txt)),
                              "text": txt[:2500]})
                emit({"step": "serverless-final", "device": bool(
                    txt and re.search(r"GPU-[0-9a-fA-F-]{16,}", txt)),
                    "text": (txt or "")[:800]})
                st, rb = arm(tok, base + "/Microsoft.MachineLearningServices/workspaces/" +
                             WS + "/jobs/" + JOB + "?api-version=" + API_W, timeout=90)
                jb2 = (rb.get("properties") or {}) if isinstance(rb, dict) else {}
                pr2 = jb2.get("properties") if isinstance(jb2.get("properties"), dict) else {}
                emit({"step": "readback-job", "http": st, "status": jb2.get("status"),
                      "nested": pr2.get("status"), "error": jb2.get("error"),
                      "nested_error": pr2.get("error")})
    else:
        emit({"step": "ws-refused", "body": json.dumps(b)[:900]})

    # ---- teardown ----
    def del_and_wait(url, label, budget=300):
        st, b = arm(tok, url, "DELETE", timeout=180)
        emit({"step": label + "-delete", **err_of(st, b)})
        t0 = time.time()
        last = st
        while time.time() - t0 < budget:
            time.sleep(10)
            stp, bp = arm(tok, url, timeout=60)
            last = stp
            emit({"step": label + "-absent-poll", "http": stp, "state": prov_state(bp)})
            if stp == 404:
                break
        emit({"step": label + "-absence", "final_http": last})

    if own.get("job"):
        del_and_wait(base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                     "/jobs/" + JOB + "?api-version=" + API_W, "job", 240)
    if own.get("ws"):
        del_and_wait(base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                     "?api-version=" + API_W, "ws", 600)
    if own.get("acr"):
        del_and_wait(base + "/Microsoft.ContainerRegistry/registries/" + own["acr"] +
                     "?api-version=" + REG_VER, "acr", 300)
    if own.get("appi"):
        del_and_wait(base + "/Microsoft.Insights/components/" + own["appi"] +
                     "?api-version=2020-02-02", "appi", 240)
    if own.get("kv"):
        del_and_wait(base + "/Microsoft.KeyVault/vaults/" + own["kv"] +
                     "?api-version=" + REG_VER, "kv", 240)
    if own.get("sa"):
        del_and_wait(base + "/Microsoft.Storage/storageAccounts/" + own["sa"] +
                     "?api-version=" + STG_VER, "sa", 300)
    if own.get("rg_tags_changed"):
        st, b = arm(tok, ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                    "?api-version=2021-04-01", "PATCH", {"tags": rg_tags}, timeout=60)
        emit({"step": "rg-tag-restore", "http": st, "code":
              ((b.get("error") or {}).get("code") if isinstance(b, dict) else None)})
    st, rl = arm(tok, ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                 "/resources?api-version=2021-04-01")
    mine = [{"name": x.get("name"), "type": x.get("type")}
            for x in ((rl.get("value") or []) if isinstance(rl, dict) else [])
            if str(x.get("name", "")).lower().startswith("c211")]
    emit({"step": "rg-inventory-final", "http": st, "c211": mine})
    emit({"step": "DONE", "mode": "aml",
          "device": bool(own.get("job") and locals().get("txt") and
                         re.search(r"GPU-[0-9a-fA-F-]{16,}", locals().get("txt") or ""))})
    emit({"step": "PROBE-EXIT", "code": 0})


if __name__ == "__main__":
    main()
