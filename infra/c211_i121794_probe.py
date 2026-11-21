#!/usr/bin/env python3
"""C211-I121794: Azure ML serverless Standard_NC4as_T4_v3 plane on subscription
b8b18dcf, re-opened with the ONE materially new mechanism left untested by i121582:
the workspace PUT's 202 response headers (Azure-AsyncOperation / Location) are
captured and polled to a terminal provider state, and the resource GET is given a
>=600 s 404 grace instead of the old 90 s heuristic.

Everything else is the validated v2 pipeline (storage account + account SAS stdout
channel, key vault / existing AppInsights dependency reuse, nonce ACR, ARM-role
grants for the workspace MSI, ONE serverless command job printing nvidia-smi -L and
--query-gpu=name,uuid,memory.total, job+blob polling, independent ARM readback,
delete-everything teardown with 404/NO_RESULTS proof).

stdlib only. Every provider response is printed verbatim as C211_I121794 tagged
JSON (single line, <=3800 chars).
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

TAG = "C211_I121794"
ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
NONCE = "i121794a"
WS = "c211i121794aml"
SUF = hashlib.sha256(NONCE.encode()).hexdigest()[:8]
JOB = "c211-i121794-dev"
SKU = "Standard_NC4as_T4_v3"
OUTNAME = "devout"
API_W = "2024-10-01"
API_W_ALT = ("2023-04-01", "2022-05-01")
API_C = "2024-04-01"
REG_VER = "2023-07-01"
STG_VER = "2023-01-01"
T0 = time.time()
DEADLINE = 3300
WS_ASYNC_BUDGET = 900      # poll Azure-AsyncOperation to terminal
WS_GRACE_404 = 780         # >=600 s 404 grace on the resource GET (v3 fix)
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


def armh(tok, url, method="GET", body=None, timeout=120):
    """ARM call that ALSO returns the response headers (v3: async-op capture)."""
    data = json.dumps(body).encode() if body is not None else None
    hdrs = {"Authorization": "Bearer " + tok}
    if data is not None:
        hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode("utf-8", "replace") or "{}"
            h = {k.lower(): v for k, v in r.headers.items()}
            h.pop("authorization", None)
            try:
                return r.status, json.loads(raw), h
            except Exception:  # noqa: BLE001
                return r.status, {"raw": raw[:1500]}, h
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace") or ""
        h = {k.lower(): v for k, v in e.headers.items()} if e.headers else {}
        try:
            return e.code, json.loads(raw), h
        except Exception:  # noqa: BLE001
            return e.code, {"raw": raw[:1500]}, h
    except Exception as e:  # noqa: BLE001
        return 0, {"transport_error": str(e)}, {}


def arm(tok, url, method="GET", body=None, timeout=120):
    st, b, _ = armh(tok, url, method, body, timeout)
    return st, b


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


def poll_prov(tok, url, label, budget=300, sleep_s=10, grace404=0):
    ps = None
    t0 = time.time()
    first404 = None
    while time.time() - t0 < budget:
        st, b = arm(tok, url, timeout=90)
        ps = prov_state(b)
        emit({"step": label + "-poll", "http": st, "state": ps,
              "t": round(time.time() - t0)})
        if ps in ("Succeeded", "Failed", "Canceled"):
            break
        if st == 404:
            if first404 is None:
                first404 = time.time()
            if time.time() - first404 > grace404:
                break
        else:
            first404 = None
        time.sleep(sleep_s)
    return ps


def sa_sas(acct, key_b64, services="b", rt="co", perm="rwdlc", hours=4):
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
    rbase = base[len(ARM):]

    # ---- providers / RG / quota / SKUs (evidence for the report) ----
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
                                      "restrictions": [{"type": r0.get("type"),
                                                        "values": r0.get("values")}
                                                       for r0 in (s.get("restrictions") or [])]}
    emit({"step": "skus", "http": st, "location": loc, "skus": sku_out})

    # ---- RG inventory: reuse existing AppInsights if present ----
    st, rl = arm(tok, ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                 "/resources?api-version=2021-04-01")
    items = (rl.get("value") or []) if isinstance(rl, dict) else []
    emit({"step": "rg-inventory", "http": st, "n": len(items),
          "items": [{"name": x.get("name"), "type": x.get("type")} for x in items]})
    appi_existing = None
    for x in items:
        t = (x.get("type") or "").lower()
        if t == "microsoft.insights/components" and not appi_existing:
            appi_existing = {"name": x.get("name"), "id": x.get("id")}
    emit({"step": "existing-deps", "appi": appi_existing})

    own = {}
    sas = None
    bloburl = None

    # ---- storage account + SAS stdout channel ----
    sa = ("c211i121794b" + SUF).lower()[:24]
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
    kv = "c211i121794kv" + SUF[:4]
    kvurl = base + "/Microsoft.KeyVault/vaults/" + kv + "?api-version=" + REG_VER
    st, b = arm(tok, kvurl, "PUT",
                {"location": loc, "tags": {"c211": NONCE},
                 "properties": {"tenantId": tenant,
                                "sku": {"family": "A", "name": "standard"},
                                "accessPolicies": [], "enableSoftDelete": True,
                                "enableRbacAuthorization": True}}, timeout=180)
    emit({"step": "kv-create", "name": kv, **err_of(st, b)})
    kv_id = (rbase + "/Microsoft.KeyVault/vaults/" + kv) if st in (200, 201, 202) else None
    if kv_id:
        own["kv"] = kv
        poll_prov(tok, kvurl, "kv", 180)

    # ---- application insights: reuse existing, else create ----
    appi_id = appi_existing["id"] if appi_existing else None
    if appi_existing:
        emit({"step": "appi-reuse", "name": appi_existing["name"]})
    else:
        appi = "c211-i121794-appi" + SUF[:4]
        appiurl = base + "/Microsoft.Insights/components/" + appi + "?api-version=2020-02-02"
        st, b = arm(tok, appiurl, "PUT",
                    {"location": loc, "kind": "web",
                     "tags": {"c211": NONCE, "OWNER": "c211-i121794"},
                     "properties": {"Application_Type": "web"}}, timeout=180)
        emit({"step": "appi-create", "name": appi, **err_of(st, b)})
        if st in (200, 201, 202):
            appi_id = rbase + "/Microsoft.Insights/components/" + appi
            own["appi"] = appi

    # ---- container registry (nonce, optional dependency) ----
    acr = "c211i121794acrb" + SUF[:4]
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

    # ---- workspace PUT with async-operation header capture (v3) ----
    wurl = base + "/Microsoft.MachineLearningServices/workspaces/" + WS + \
        "?api-version=" + API_W
    props = {"friendlyName": "c211-i121794 nonce workspace", "hbiWorkspace": False,
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
    st, b, hdrs = armh(tok, wurl, "PUT", wbody, timeout=300)
    async_url = hdrs.get("azure-asyncoperation") or hdrs.get("location")
    emit({"step": "ws-create", **err_of(st, b),
          "async_op": async_url,
          "location_hdr": hdrs.get("location"),
          "retry_after": hdrs.get("retry-after"),
          "x_ms_request_id": hdrs.get("x-ms-request-id"),
          "hdr_names": sorted([k for k in hdrs if k.startswith(("azure", "location",
                                                               "retry", "x-ms"))])})
    ws_ok = st in (200, 201, 202)
    kv2url = None
    if not ws_ok and not kv_id:
        for cand in (kv + "x", kv + "y", kv + "z"):
            candurl = base + "/Microsoft.KeyVault/vaults/" + cand + \
                "?api-version=" + REG_VER
            st2, b2 = arm(tok, candurl, "PUT",
                          {"location": loc, "tags": {"c211": NONCE},
                           "properties": {"tenantId": tenant,
                                          "sku": {"family": "A", "name": "standard"},
                                          "accessPolicies": [], "enableSoftDelete": True,
                                          "enableRbacAuthorization": True}}, timeout=180)
            emit({"step": "kv-create-retry", "name": cand, **err_of(st2, b2)})
            if st2 in (200, 201, 202):
                own["kv"] = cand
                kv_id = rbase + "/Microsoft.KeyVault/vaults/" + cand
                kv2url = candurl
                break
        if kv_id:
            props["keyVault"] = kv_id
            poll_prov(tok, kv2url, "kv", 180)
            st, b, hdrs = armh(tok, wurl, "PUT", wbody, timeout=300)
            async_url = hdrs.get("azure-asyncoperation") or hdrs.get("location")
            emit({"step": "ws-create-retry", **err_of(st, b), "async_op": async_url})
            ws_ok = st in (200, 201, 202)

    ws_state = None
    if ws_ok:
        own["ws"] = WS
        # ----- v3: NEW POLLING MECHANISM -----
        t0 = time.time()
        first404 = None
        async_state = None
        async_http = None
        async_body = None
        listed = None
        while time.time() - t0 < WS_ASYNC_BUDGET:
            el = round(time.time() - t0)
            # (a) Azure-AsyncOperation / Location header poll
            if async_url:
                ast, ab = arm(tok, async_url, timeout=90)
                async_http = ast
                async_body = ab
                ap = ab if isinstance(ab, dict) else {}
                async_state = (ap.get("status") or
                               (ap.get("properties") or {}).get("status") or
                               ap.get("provisioningState"))
                emit({"step": "ws-async-poll", "http": ast, "status": async_state,
                      "t": el,
                      "error": (json.dumps(ap.get("error"))[:600]
                                if ap.get("error") else None)})
            # (b) resource GET (primary + alternate API versions)
            rst, rb = arm(tok, wurl, timeout=90)
            ws_state = prov_state(rb)
            alt_states = {}
            if rst == 404:
                if first404 is None:
                    first404 = time.time()
                for av in API_W_ALT:
                    au = base + "/Microsoft.MachineLearningServices/workspaces/" + WS + \
                        "?api-version=" + av
                    ost, ob = arm(tok, au, timeout=60)
                    alt_states[av] = {"http": ost, "state": prov_state(ob)}
                # (c) collection list (a workspace that exists must be listed)
                lst, lb = arm(tok, base + "/Microsoft.MachineLearningServices/workspaces"
                              "?api-version=" + API_W, timeout=90)
                names = [x.get("name") for x in ((lb.get("value") or [])
                                                 if isinstance(lb, dict) else [])]
                listed = {"http": lst, "names": names[:20],
                          "mine": WS in (names or [])}
            else:
                first404 = None
            emit({"step": "ws-poll", "http": rst, "state": ws_state, "t": el,
                  "alt": alt_states, "list": listed,
                  "async_state": async_state})
            if ws_state in ("Succeeded", "Failed", "Canceled"):
                break
            if listed and listed.get("mine"):
                break
            if async_state in ("Failed", "Canceled"):
                break
            if rst == 404 and first404 is not None and \
                    time.time() - first404 > WS_GRACE_404:
                emit({"step": "ws-grace-exhausted",
                      "grace_s": WS_GRACE_404, "t": el})
                break
            time.sleep(20 if rst == 404 else 15)
        emit({"step": "ws-final", "state": ws_state, "async_state": async_state,
              "async_http": async_http,
              "async_error": (json.dumps((async_body or {}).get("error"))[:900]
                              if isinstance(async_body, dict) and
                              (async_body or {}).get("error") else None)})
        if isinstance(async_body, dict) and async_body.get("error"):
            emit({"step": "ws-async-error-detail", "body":
                  json.dumps(async_body)[:3000]})
        if ws_state == "Succeeded":
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
                                          if isinstance(wb, dict) else None),
                  "containerRegistry": ((wb.get("properties") or {})
                                        .get("containerRegistry")
                                        if isinstance(wb, dict) else None)})
            if msi:
                grant(tok, sid, rbase + "/Microsoft.Storage/storageAccounts/" + sa,
                      msi, ROLE_SBLOB, "ws-msi-blob")
                if acr_id:
                    grant(tok, sid, acr_id, msi, ROLE_ACRPULL, "ws-msi-acrpull")
                if kv_id:
                    grant(tok, sid, kv_id, msi, ROLE_KVUSER, "ws-msi-kv")
                time.sleep(20)  # let role assignments propagate to the blob data plane
            # ---- environment version (with inline fallback) ----
            envid_url = (base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                         "/environments/c211-i121794-cuda/versions/1?api-version=" + API_W)
            env_body = {"properties": {"image": IMG, "osType": "Linux",
                                       "description": "c211 i121794 cuda base"}}
            st, eb = arm(tok, envid_url, "PUT", env_body, timeout=120)
            env_id = ((eb.get("id") if isinstance(eb, dict) else None) or
                      (rbase + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                       "/environments/c211-i121794-cuda/versions/1")) \
                if st in (200, 201) else None
            emit({"step": "env-version", "http": st, "id_ok": bool(env_id),
                  **({} if st in (200, 201) else err_of(st, eb))})

            cmd = ("echo C211_I121794_DEV_START; "
                   "OUT=\"${{outputs.%s}}\"; mkdir -p \"$OUT\" 2>/dev/null || OUT=.; "
                   "(nvidia-smi -L 2>&1 || echo NO_NVIDIA_SMI) | tee \"$OUT/device.txt\"; "
                   "(nvidia-smi --query-gpu=name,uuid,memory.total --format=csv 2>&1 || true)"
                   " | tee -a \"$OUT/device.txt\"; "
                   "(ls -l /dev/nvidia* 2>/dev/null || echo NO_DEV_NVIDIA) | tee -a "
                   "\"$OUT/device.txt\"; echo C211_I121794_DEV_END" % OUTNAME)
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
                      "experimentName": "c211-i121794",
                      "description": "c211 i121794 serverless T4 device probe",
                      "command": cmd,
                      "computeId": "azureml:serverless",
                      "resources": {"instanceCount": 1, "instanceType": SKU},
                      "outputs": {OUTNAME: {"jobOutputType": "uri_folder",
                                            "mode": "Upload"}}}
            if env_id:
                jprops["environmentId"] = env_id
            else:
                jprops["environment"] = {"image": IMG, "osType": "Linux"}
            jurl = (base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                    "/jobs/" + JOB + "?api-version=" + API_W)
            st, jb = arm(tok, jurl, "PUT", {"properties": jprops}, timeout=180)
            emit({"step": "job-create-serverless", **err_of(st, jb)})
            if st not in (200, 201):
                msg = json.dumps(jb)[:800]
                if re.search(r"(?i)compute|serverless|jobTier|instanceType|environment",
                             msg):
                    alt = {k: v for k, v in jprops.items()
                           if k not in ("computeId", "environmentId")}
                    alt["queueSettings"] = {"jobTier": "Standard"}
                    if "environmentId" not in alt:
                        alt.setdefault("environment", {"image": IMG, "osType": "Linux"})
                    st, jb = arm(tok, jurl, "PUT",
                                 {"properties": alt}, timeout=180)
                    emit({"step": "job-create-serverless-alt", **err_of(st, jb)})
            if st in (200, 201):
                own["job"] = JOB
                jt0 = time.time()
                final = None
                txt = None
                while time.time() - jt0 < min(1500, max(300, left() - 600)):
                    time.sleep(15)
                    stj, jjb = arm(tok, jurl, timeout=90)
                    jp = (jjb.get("properties") or {}) if isinstance(jjb, dict) else {}
                    pr = jp.get("properties") if isinstance(jp.get("properties"),
                                                            dict) else {}
                    final = {"http": stj, "status": jp.get("status"),
                             "nested": pr.get("status"),
                             "error": jp.get("error"), "nested_error": pr.get("error"),
                             "computeId": jp.get("computeId"),
                             "queueSettings": jp.get("queueSettings")}
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
                st, rb2 = arm(tok, jurl, timeout=90)
                jb2 = (rb2.get("properties") or {}) if isinstance(rb2, dict) else {}
                pr2 = jb2.get("properties") if isinstance(jb2.get("properties"),
                                                          dict) else {}
                emit({"step": "readback-job", "http": st, "status": jb2.get("status"),
                      "nested": pr2.get("status"), "error": jb2.get("error"),
                      "nested_error": pr2.get("error"),
                      "properties_keys": sorted(list(jb2.keys()))[:40]})
        else:
            emit({"step": "ws-not-created", "state": ws_state,
                  "async_state": async_state})

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
    # explicit absence confirmation for the workspace (also via the list API)
    st, lb = arm(tok, base + "/Microsoft.MachineLearningServices/workspaces"
                 "?api-version=" + API_W, timeout=90)
    names = [x.get("name") for x in ((lb.get("value") or [])
                                     if isinstance(lb, dict) else [])]
    emit({"step": "ws-absence-list", "http": st, "names": names[:20],
          "mine_present": WS in (names or [])})
    st, rl = arm(tok, ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                 "/resources?api-version=2021-04-01")
    mine = [{"name": x.get("name"), "type": x.get("type")}
            for x in ((rl.get("value") or []) if isinstance(rl, dict) else [])
            if str(x.get("name", "")).lower().startswith("c211")]
    emit({"step": "rg-inventory-final", "http": st, "c211": mine})
    emit({"step": "DONE", "mode": "aml-v3",
          "device": bool(own.get("job") and locals().get("txt") and
                         re.search(r"GPU-[0-9a-fA-F-]{16,}", locals().get("txt") or ""))})
    emit({"step": "PROBE-EXIT", "code": 0})


if __name__ == "__main__":
    main()
