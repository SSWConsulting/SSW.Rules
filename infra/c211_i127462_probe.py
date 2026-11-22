#!/usr/bin/env python3
"""C211-I127462: prove the never-exercised b8b18dcf AmlCompute V100 class.

Mirrors the device-proven x121794 recipe (AmlCompute cluster + inline-command job +
account-SAS blob sink + independent ARM readback + full teardown) but with the
NEW variable from fact 127431: the live 82,616-SKU Microsoft.Compute catalogue is
read in-identity and joined per-region with the AML 2024-04-01 usages meters
(standardNCSv3Family / TotalDedicatedCores), so the cluster region is chosen where
Standard_NC6s_v3 is actually offered without a Location/Zone restriction and the
AML family quota fits one 6-core node -- instead of the saved westeurope entry
that is zone-NAF.

Primary SKU: Standard_NC6s_v3 (V100, Dedicated, min0/max1).
At most ONE bounded Standard_NV6 (M60) fallback after a verbatim V100 refusal.

Everything is nonce-scoped c211i127462* / c211-i127462* and torn down to 404.
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
from concurrent.futures import ThreadPoolExecutor

TAG = "C211_I127462"
ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
NONCE = "i127462"
WS = "c211i127462aml"
SUF = hashlib.sha256(NONCE.encode()).hexdigest()[:8]
CLUSTER = "c211-i127462-v100"
NCLUSTER = "c211-i127462-nv6"
JOB_C = "c211-i127462-dev"
SKU = "Standard_NC6s_v3"
NVSKU = "Standard_NV6"
OUTNAME = "devout"
API_W = "2024-10-01"
API_C = "2024-04-01"
REG_VER = "2023-07-01"
STG_VER = "2023-01-01"
T0 = time.time()
DEADLINE = 3600
IMG = "mcr.microsoft.com/azureml/openmpi4.1.0-cuda11.8-cudnn8-ubuntu22.04:latest"
ROLE_SBLOB = "ba92f5b4-2d11-453d-a403-e96b0029c9fe"
PREFER = ["westeurope", "westus"]
# fixed baseline probe set joined with the catalogue locations
FIXED = ["westeurope", "westus", "canadacentral", "eastus", "westus2",
         "australiaeast", "northeurope", "eastus2", "centralus", "southcentralus",
         "uksouth", "southeastasia", "japaneast", "swedencentral",
         "germanywestcentral", "italynorth", "brazilsouth", "canadaeast",
         "centralindia", "eastasia", "francecentral", "israelcentral",
         "koreacentral", "northcentralus", "polandcentral", "qatarcentral",
         "southafricanorth", "southindia", "spaincentral", "switzerlandnorth",
         "taiwannorth", "uaenorth", "ukwest", "westcentralus", "westus3"]


def emit(obj):
    obj["d"] = round(time.time() - T0, 1)
    print((TAG + " " + json.dumps(obj, default=str))[:3800], flush=True)


def left():
    return DEADLINE - (time.time() - T0)


def run(cmd, timeout=600):
    t = time.time()
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return {"rc": p.returncode, "out": p.stdout or "", "err": (p.stderr or "")[-600:],
                "secs": round(time.time() - t, 1)}
    except Exception as e:  # noqa: BLE001
        return {"rc": 1, "out": "", "err": str(e), "secs": round(time.time() - t, 1)}


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
                    "message": (e.get("message") or "")[:1200]}
        if "raw" in body:
            return {"http": st, "raw": body["raw"][:1200]}
        return {"http": st, "body": json.dumps(body)[:1000]}
    return {"http": st}


def prov_state(body):
    if isinstance(body, dict):
        return (body.get("properties") or {}).get("provisioningState")
    return None


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
    import uuid as _uuid
    ra = str(_uuid.uuid4())
    url = (ARM + scope_id + "/providers/Microsoft.Authorization/roleAssignments/" + ra +
           "?api-version=2022-04-01")
    body = {"properties": {
        "roleDefinitionId": "/subscriptions/%s/providers/Microsoft.Authorization/"
                            "roleDefinitions/%s" % (sid, role),
        "principalId": principal, "principalType": "ServicePrincipal"}}
    st, b = arm(tok, url, "PUT", body, timeout=60)
    emit({"step": "role-assign", "label": label, "http": st,
          "code": (b.get("error", {}) or {}).get("code") if isinstance(b, dict) else None})


def sku_catalogue(tok, sid, names):
    """Paginated Compute SKU catalogue -> every entry whose name is in `names`."""
    url = ("%s/subscriptions/%s/providers/Microsoft.Compute/skus?api-version=2021-07-01"
           % (ARM, sid))
    entries = []
    pages = 0
    total = 0
    while url and pages < 25 and left() > 600:
        st, b = arm(tok, url, timeout=150)
        pages += 1
        if st != 200 or not isinstance(b, dict):
            emit({"step": "skus-error", "http": st, "page": pages,
                  "err": str(b)[:300]})
            break
        for x in (b.get("value") or []):
            total += 1
            nm = str(x.get("name"))
            if nm not in names:
                continue
            caps = {c.get("name"): c.get("value") for c in (x.get("capabilities") or [])}
            rs = []
            for r in (x.get("restrictions") or []):
                ri = r.get("restrictionInfo") or {}
                rs.append({"type": r.get("type"), "reasonCode": r.get("reasonCode"),
                           "locations": ri.get("locations"), "zones": ri.get("zones")})
            entries.append({"name": nm, "family": x.get("family"),
                            "locations": [li.get("location") for li in
                                          (x.get("locationInfo") or [])],
                            "restrictions": rs,
                            "gpus": caps.get("GPUs"), "vcpus": caps.get("vCPUs"),
                            "memgb": caps.get("MemoryGB")})
        url = b.get("nextLink")
    return {"pages": pages, "total_skus": total, "entries": entries}


def region_verdict(entries, reg):
    """Union-of-entries verdict for one region: (offered, block_reason, zone_naf)."""
    r = reg.lower()
    offered = False
    loc_restricted = None
    zone_naf = False
    zone_notes = []
    for e in entries:
        locs = [str(x).lower() for x in (e.get("locations") or [])]
        if r not in locs:
            continue
        offered = True
        for rr in (e.get("restrictions") or []):
            rl = [str(x).lower() for x in (rr.get("locations") or [])]
            rz = [str(x) for x in (rr.get("zones") or [])]
            typ = str(rr.get("type") or "").lower()
            if typ == "location" and (not rl or r in rl):
                loc_restricted = "location_restricted:%s" % rr.get("reasonCode")
            if typ == "zone" and (not rl or r in rl):
                zone_notes.append("zones=%s reason=%s" % (",".join(rz),
                                                          rr.get("reasonCode")))
                if str(rr.get("reasonCode") or "") == "NotAvailableForSubscription":
                    zone_naf = True
    if not offered:
        return False, "not_offered", False
    if loc_restricted:
        return False, loc_restricted, zone_naf
    if zone_naf:
        return True, "zone_NAF:" + ";".join(zone_notes), True
    if zone_notes:
        return True, "zone_note:" + ";".join(zone_notes), False
    return True, "unrestricted", False


def aml_usage(tok, sid, reg):
    """2024-04-01 AML usages, max-of-duplicates parse (x125603 recipe)."""
    st, b = arm(tok, "%s/subscriptions/%s/providers/Microsoft.MachineLearningServices"
                     "/locations/%s/usages?api-version=%s" % (ARM, sid, reg, API_C),
                timeout=60)
    fam = {}
    n = 0
    if isinstance(b, dict) and isinstance(b.get("value"), list):
        n = len(b["value"])
        for m in b["value"]:
            f = ((m.get("name") or {}).get("value") or "")
            if not re.search(r"(?i)ncs|ncas|nvfamily|nvads|nvpromo|totaldedicated|"
                             r"dedicated|^cores$", f):
                continue
            try:
                lim = int(m.get("limit")) if m.get("limit") is not None else -1
            except Exception:  # noqa: BLE001
                lim = -1
            try:
                cur = int(m.get("currentValue")) if m.get("currentValue") is not None else 0
            except Exception:  # noqa: BLE001
                cur = 0
            prev = fam.get(f)
            if prev is None or lim > prev["limit"]:
                fam[f] = {"limit": lim, "current": cur}
            elif cur > prev["current"]:
                prev["current"] = cur
    keep = {}
    for k, v in fam.items():
        if re.match(r"(?i)^(standardncs|standard ncas|standardnv|totaldedicated|"
                    r"total dedicated|^cores$)", k):
            keep[k] = v
    return {"region": reg, "http": st, "n": n, "fam": keep}


def fam_of(fam, *keys):
    for k in keys:
        for fk, fv in (fam or {}).items():
            if fk.lower() == k.lower():
                return fv
    return None


def main():
    r = run(["az", "account", "show", "-o", "json"], timeout=180)
    try:
        acc = json.loads(r["out"])
    except Exception:  # noqa: BLE001
        emit({"step": "fatal", "why": "no az session", "raw": r["out"][:300],
              "err": r["err"][:200]})
        return
    sid = acc.get("id")
    tenant = acc.get("tenantId")
    emit({"step": "identity", "sub": (sid or "")[:8] + "***",
          "sub_len": len(sid or ""), "name": acc.get("name"),
          "state": acc.get("state"), "tenant": (tenant or "")[:8] + "***"})
    r = run(["az", "account", "get-access-token", "--resource", ARM, "--output", "json"],
            timeout=180)
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
    own = {}
    device = {"found": False, "uuid": None, "text": "", "sku": None, "region": None}
    final = {}

    # ---------- A. live SKU catalogue ----------
    cat = sku_catalogue(tok, sid, (SKU, NVSKU))
    emit({"step": "skus", "pages": cat["pages"], "total": cat["total_skus"],
          "matches": [{"name": e["name"], "locations": e["locations"],
                       "restrictions": e["restrictions"], "gpus": e["gpus"],
                       "vcpus": e["vcpus"]} for e in cat["entries"]]})
    v_entries = [e for e in cat["entries"] if e["name"] == SKU]
    nv_entries = [e for e in cat["entries"] if e["name"] == NVSKU]
    cand = set()
    for e in v_entries:
        for loc in (e.get("locations") or []):
            cand.add(str(loc).lower())
    cand |= set(FIXED)
    cand = sorted(cand)
    emit({"step": "catalogue-summary", "sku": SKU, "entries": len(v_entries),
          "candidate_regions": len(cand), "nv6_entries": len(nv_entries)})

    # ---------- B. AML usages per candidate region (bounded parallel) ----------
    aml = {}
    def one(reg):
        try:
            return aml_usage(tok, sid, reg)
        except Exception as e:  # noqa: BLE001
            return {"region": reg, "http": 0, "n": 0, "fam": {}, "err": str(e)}
    with ThreadPoolExecutor(max_workers=6) as ex:
        for res in ex.map(one, cand):
            aml[res["region"]] = res
    for reg in cand:
        a = aml[reg]
        emit({"step": "aml-usage", "region": reg, "http": a["http"], "n": a["n"],
              "standardNCSv3Family": fam_of(a["fam"], "standardNCSv3Family"),
              "standardNVFamily": fam_of(a["fam"], "standardNVFamily"),
              "TotalDedicatedCores": fam_of(a["fam"], "TotalDedicatedCores",
                                            "Total Dedicated Cores")})

    # ---------- C. deterministic region pick ----------
    def q(reg, key):
        a = aml.get(reg) or {}
        v = fam_of(a.get("fam") or {}, key)
        if not v:
            return None
        return v

    matrix = []
    for reg in cand:
        offered, why, naf = region_verdict(v_entries, reg)
        vfam = q(reg, "standardNCSv3Family")
        tdc = q(reg, "TotalDedicatedCores")
        matrix.append({"region": reg, "offered": offered, "why": why, "zone_naf": naf,
                       "v100_limit": (vfam or {}).get("limit"),
                       "v100_current": (vfam or {}).get("current"),
                       "total_dedicated_limit": (tdc or {}).get("limit")})
    vyes = [m for m in matrix if m["offered"]]

    def score(m):
        lim = m["v100_limit"] if m["v100_limit"] is not None else -2
        tdc = m["total_dedicated_limit"] if m["total_dedicated_limit"] is not None else -2
        lim_ok = (lim >= 6 or lim == -1)
        tdc_ok = (tdc >= 6 or tdc in (-1, -2))
        quota_ok = lim_ok and tdc_ok
        if not m["offered"] or "location_restricted" in str(m["why"]):
            return (0, 0, 0, 0, 0)
        clean = not m["zone_naf"]
        pref = 1 if m["region"] in PREFER else 0
        return (1 if quota_ok else 0, 1 if clean else 0, 1 if lim_ok else 0,
                pref, -(lim if isinstance(lim, int) and lim >= 0 else 0))

    ranked = sorted(vyes, key=lambda m: (score(m)), reverse=True)
    emit({"step": "region-matrix", "n": len(matrix),
          "offer_regions": [m["region"] for m in vyes],
          "v100_quota_regions": [m["region"] for m in matrix
                                 if (m["v100_limit"] or 0) >= 6],
          "matrix": matrix})
    if not ranked:
        emit({"step": "region-pick", "chosen": None,
              "why": "no region offers %s anywhere in the live catalogue" % SKU})
        pick = None
    else:
        best = ranked[0]
        pick = best
        emit({"step": "region-pick", "chosen": best["region"],
              "why": best["why"], "v100_limit": best["v100_limit"],
              "zone_naf": best["zone_naf"],
              "top5": [{k: r[k] for k in ("region", "why", "zone_naf", "v100_limit",
                                          "v100_current")} for r in ranked[:5]]})
    loc = pick["region"] if pick else "westeurope"

    # ---------- D. Compute cross-check for the chosen region ----------
    st, us = arm(tok, ARM + "/subscriptions/" + sid + "/providers/Microsoft.Compute/"
                      "locations/" + loc + "/usages?api-version=2024-07-01")
    rows = []
    if isinstance(us, dict):
        for u0 in us.get("value") or []:
            nm = ((u0.get("name") or {}).get("value") or "")
            if re.search(r"(?i)standard\s*(nc|nv|nd)", nm):
                rows.append({"family": nm, "current": u0.get("currentValue"),
                             "limit": u0.get("limit")})
    emit({"step": "compute_usage", "http": st, "location": loc, "rows": rows})

    # ---------- E. dependencies (nonce) ----------
    sas = None
    sa = ("c211i127462" + SUF).lower()[:24]
    own["sa"] = sa
    saurl = base + "/Microsoft.Storage/storageAccounts/" + sa + "?api-version=" + STG_VER
    st, b = arm(tok, saurl, "PUT",
                {"location": loc, "sku": {"name": "Standard_LRS"}, "kind": "StorageV2",
                 "tags": {"c211": NONCE},
                 "properties": {"allowBlobPublicAccess": False,
                                "minimumTlsVersion": "TLS1_2",
                                "supportsHttpsTrafficOnly": True,
                                "networkAcls": {"bypass": "AzureServices",
                                                "defaultAction": "Allow"}}}, timeout=240)
    emit({"step": "sa-create", "name": sa, **err_of(st, b)})
    if st in (200, 201, 202):
        for _ in range(24):
            stp, bp = arm(tok, saurl, timeout=60)
            if prov_state(bp) in ("Succeeded", "Failed"):
                break
            time.sleep(8)
        st, kb = arm(tok, base + "/Microsoft.Storage/storageAccounts/" + sa +
                     "/listKeys?api-version=" + STG_VER, "POST", {}, timeout=90)
        key = None
        try:
            key = (kb.get("keys") or [{}])[0].get("value")
        except Exception:  # noqa: BLE001
            pass
        emit({"step": "sa-keys", "http": st, "got": bool(key)})
        if key:
            qq, se = sa_sas(sa, key)
            bbase = "https://" + sa + ".blob.core.windows.net"
            stc, bc = httptext(bbase + "/c211?restype=container&" + qq, method="PUT")
            emit({"step": "sa-container", "http": stc,
                  "body": bc[:120].decode("utf-8", "replace")})
            if stc in (201, 409):
                sas = bbase + "/c211/" + NONCE + "-out.txt?" + qq
                emit({"step": "sa-sas", "ok": True, "expires": se})

    kv = "c211i127462kv" + SUF[:4]
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
        for _ in range(18):
            stp, bp = arm(tok, kvurl, timeout=60)
            if prov_state(bp) in ("Succeeded", "Failed"):
                break
            time.sleep(8)

    appi_id = None
    st, rl = arm(tok, ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                 "/resources?api-version=2021-04-01")
    for x in ((rl.get("value") or []) if isinstance(rl, dict) else []):
        if (x.get("type") or "").lower() == "microsoft.insights/components" and not appi_id:
            appi_id = x.get("id")
    emit({"step": "appi-reuse", "id_ok": bool(appi_id), "http": st})

    # ---------- F. workspace ----------
    wurl = base + "/Microsoft.MachineLearningServices/workspaces/" + WS + \
        "?api-version=" + API_W
    props = {"friendlyName": "c211-i127462 nonce workspace", "hbiWorkspace": False,
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
    emit({"step": "ws-create", **err_of(st, b), "async_op": bool(async_url)})
    ws_state = None
    if st in (200, 201, 202):
        own["ws"] = WS
        t0 = time.time()
        while time.time() - t0 < 600 and left() > 1800:
            rst, rb = arm(tok, wurl, timeout=90)
            ws_state = prov_state(rb)
            emit({"step": "ws-poll", "http": rst, "state": ws_state,
                  "t": round(time.time() - t0)})
            if ws_state in ("Succeeded", "Failed", "Canceled"):
                break
            time.sleep(12)
    emit({"step": "ws-final", "state": ws_state})
    env_id = None
    if ws_state == "Succeeded":
        wsu = rbase + "/Microsoft.MachineLearningServices/workspaces/" + WS
        st, wb = arm(tok, wurl, timeout=90)
        msi = (((wb.get("identity") or {}).get("principalId"))
               if isinstance(wb, dict) else None)
        emit({"step": "ws-readback", "http": st, "state": prov_state(wb),
              "msi": (msi or "")[:8] + "***",
              "location": wb.get("location") if isinstance(wb, dict) else None})
        if msi and sas:
            grant(tok, sid, rbase + "/Microsoft.Storage/storageAccounts/" + sa,
                  msi, ROLE_SBLOB, "ws-msi-blob")
        eu = base + "/Microsoft.MachineLearningServices/workspaces/" + WS + \
            "/environments/c211-i127462-cuda/versions/1?api-version=" + API_W
        st, eb = arm(tok, eu, "PUT", {"properties": {"image": IMG, "osType": "Linux",
                                                    "description": "c211 i127462 cuda"}},
                     timeout=120)
        env_id = ((eb.get("id") if isinstance(eb, dict) else None) or
                  (wsu + "/environments/c211-i127462-cuda/versions/1")) \
            if st in (200, 201) else None
        emit({"step": "env-version", "http": st, "id_ok": bool(env_id),
              **({} if st in (200, 201) else err_of(st, eb))})

    cmd = ("echo C211_I127462_DEV_START; "
           "OUT=\"${{outputs.%s}}\"; mkdir -p \"$OUT\" 2>/dev/null || OUT=.; "
           "(nvidia-smi -L 2>&1 || echo NO_NVIDIA_SMI) | tee \"$OUT/device.txt\"; "
           "(nvidia-smi --query-gpu=name,uuid,memory.total,driver_version "
           "--format=csv 2>&1 || true) | tee -a \"$OUT/device.txt\"; "
           "(cat /proc/driver/nvidia/version 2>&1 || true) | tee -a \"$OUT/device.txt\"; "
           "(lspci 2>/dev/null | grep -i -E 'nvidia|3d controller' || true) "
           "| tee -a \"$OUT/device.txt\"; echo C211_I127462_DEV_END" % OUTNAME)
    if sas:
        cmd += ("; if command -v curl >/dev/null 2>&1; then "
                "curl -sS -X PUT '%s' -H 'x-ms-blob-type: BlockBlob' "
                "-H 'x-ms-version: 2022-11-02' -H 'Content-Type: text/plain' "
                "--data-binary @\"$OUT/device.txt\"; echo C211_UPLOAD_CURL_RC=$?; "
                "fi; echo C211_UPLOAD_DONE" % sas)
    outputs = {OUTNAME: {"jobOutputType": "uri_folder", "mode": "ReadWriteMount"}}

    def poll_job(name, budget, tag):
        jurl = (base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                "/jobs/" + name + "?api-version=" + API_W)
        t0 = time.time()
        fin = {}
        txt = None
        while time.time() - t0 < budget:
            time.sleep(12)
            stj, jjb = arm(tok, jurl, timeout=90)
            jp = (jjb.get("properties") or {}) if isinstance(jjb, dict) else {}
            pr = jp.get("properties") if isinstance(jp.get("properties"), dict) else {}
            fin = {"http": stj, "status": jp.get("status"),
                   "nested": pr.get("status"), "error": jp.get("error"),
                   "nested_error": pr.get("error"), "computeId": jp.get("computeId")}
            emit({"step": tag + "-job-poll", "t": round(time.time() - t0), **fin})
            if txt is None and sas:
                sb, bb = httptext(sas, timeout=30)
                if sb == 200:
                    txt = bb.decode("utf-8", "replace")
                    emit({"step": tag + "-blob-read", "http": sb, "len": len(txt),
                          "has_uuid": bool(re.search(r"GPU-[0-9a-fA-F-]{16,}", txt)),
                          "text": txt[:1200]})
            if txt and re.search(r"GPU-[0-9a-fA-F-]{16,}", txt):
                break
            if fin["status"] in ("Completed", "Failed", "Canceled") or \
                    fin["nested"] in ("Completed", "Failed", "Canceled"):
                break
        if txt is None and sas:
            sb, bb = httptext(sas, timeout=30)
            if sb == 200:
                txt = bb.decode("utf-8", "replace")
                emit({"step": tag + "-blob-read-final", "http": sb, "len": len(txt),
                      "text": txt[:1200]})
        stj, rb2 = arm(tok, jurl, timeout=90)
        jb2 = (rb2.get("properties") or {}) if isinstance(rb2, dict) else {}
        pr2 = jb2.get("properties") if isinstance(jb2.get("properties"), dict) else {}
        emit({"step": tag + "-readback", "http": stj, "status": jb2.get("status"),
              "nested": pr2.get("status"), "error": jb2.get("error"),
              "nested_error": pr2.get("error"), "computeId": jb2.get("computeId")})
        return fin, (txt or "")

    def cluster_attempt(cluster_name, sku, priority, tag):
        """PUT one AmlCompute cluster and poll to terminal; return (state, detail)."""
        curl = (base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                "/computes/" + cluster_name + "?api-version=" + API_C)
        cb = {"location": loc, "tags": {"c211": NONCE},
              "properties": {"computeType": "AmlCompute", "computeLocation": loc,
                             "description": "c211 i127462 bounded %s %s probe"
                                            % (priority, sku),
                             "properties": {"vmSize": sku, "vmPriority": priority,
                                            "scaleSettings": {
                                                "minNodeCount": 0,
                                                "maxNodeCount": 1,
                                                "nodeIdleTimeBeforeScaleDown": "PT2M"},
                                            "osType": "Linux",
                                            "remoteLoginPortPublicAccess": "Disabled"}}}
        st, b, hd = armh(tok, curl, "PUT", cb, timeout=240)
        aop = hd.get("azure-asyncoperation") or hd.get("location")
        emit({"step": "cluster-create-" + tag, "sku": sku, "priority": priority,
              "region": loc, "http": st, **err_of(st, b), "async_op": bool(aop)})
        state = None
        detail = {}
        if st in (200, 201, 202):
            t0 = time.time()
            budget = min(720, max(180, left() - 1500))
            while time.time() - t0 < budget:
                time.sleep(10)
                stp, bp = arm(tok, curl, timeout=90)
                pp = (bp.get("properties") or {}) if isinstance(bp, dict) else {}
                inner = pp.get("properties") if isinstance(pp.get("properties"), dict) else {}
                state = pp.get("provisioningState")
                detail = {"http": stp, "state": state,
                          "t": round(time.time() - t0),
                          "nodes": pp.get("currentNodeCount"),
                          "nodeStateCounts": inner.get("nodeStateCounts"),
                          "inner_state": inner.get("provisioningState"),
                          "errors": (json.dumps(pp.get("errors"))[:900]
                                     if pp.get("errors") else None),
                          "inner_errors": (json.dumps(inner.get("errors"))[:900]
                                           if inner.get("errors") else None),
                          "inner_keys": sorted(inner.keys())[:25]}
                emit({"step": "cluster-poll-" + tag, **detail})
                if state in ("Succeeded", "Failed", "Canceled"):
                    break
            if aop and state not in ("Succeeded",):
                ast, ab = arm(tok, aop, timeout=90)
                emit({"step": "cluster-asyncop-" + tag, "http": ast,
                      "status": (ab.get("status") if isinstance(ab, dict) else None),
                      "error": (json.dumps(ab.get("error"))[:900]
                                if isinstance(ab, dict) and ab.get("error") else None),
                      "properties_error": (json.dumps((ab.get("properties") or {})
                                                      .get("error"))[:900]
                                           if isinstance(ab, dict) and
                                           (ab.get("properties") or {}).get("error")
                                           else None)})
        return state, detail

    def delete_cluster(cluster_name, tag):
        u = (base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
             "/computes/" + cluster_name + "?api-version=" + API_C)
        st, b = arm(tok, u, "DELETE", timeout=180)
        emit({"step": "cluster-delete-" + tag, **err_of(st, b)})
        t0 = time.time()
        last = st
        while time.time() - t0 < 300:
            time.sleep(8)
            stp, _ = arm(tok, u, timeout=60)
            last = stp
            if stp == 404:
                break
        emit({"step": "cluster-absence-" + tag, "final_http": last})

    # ---------- G. V100 cluster + job ----------
    v_state = None
    v_detail = {}
    if ws_state == "Succeeded" and loc:
        v_state, v_detail = cluster_attempt(CLUSTER, SKU, "Dedicated", "v100")
        if v_state == "Succeeded":
            own["cluster"] = CLUSTER
            jurl = (base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                    "/jobs/" + JOB_C + "?api-version=" + API_W)
            jp = {"jobType": "Command", "displayName": JOB_C,
                  "experimentName": "c211-i127462",
                  "description": "c211 i127462 amlcompute V100 device probe",
                  "command": cmd,
                  "computeId": (rbase + "/Microsoft.MachineLearningServices/workspaces/" +
                                WS + "/computes/" + CLUSTER),
                  "resources": {"instanceCount": 1},
                  "outputs": outputs}
            if env_id:
                jp["environmentId"] = env_id
            st, jb = arm(tok, jurl, "PUT", {"properties": jp}, timeout=180)
            emit({"step": "job-create-cluster", **err_of(st, jb)})
            if st in (200, 201):
                own["job"] = JOB_C
                fin, txt = poll_job(JOB_C, min(1500, max(300, left() - 900)), "cluster")
                uu = re.findall(r"GPU-[0-9a-fA-F-]{16,}", txt or "")
                if uu:
                    device = {"found": True, "uuid": uu[0], "text": txt,
                              "sku": SKU, "region": loc}
                stc, lc = arm(tok, base + "/Microsoft.MachineLearningServices/workspaces/"
                              + WS + "/computes?api-version=" + API_C, timeout=90)
                emit({"step": "computes-list", "http": stc,
                      "names": [x.get("name") for x in ((lc.get("value") or [])
                                                        if isinstance(lc, dict) else [])],
                      "states": [{x.get("name"): prov_state(x)}
                                 for x in ((lc.get("value") or [])
                                           if isinstance(lc, dict) else [])]})
        else:
            # verbatim V100 refusal -> delete the failed cluster before the one fallback
            delete_cluster(CLUSTER, "v100-failed")

    # ---------- H. at most ONE bounded NV6/M60 fallback after a verbatim refusal ----------
    nv_state = None
    if (not device["found"]) and v_state == "Failed" and ws_state == "Succeeded" \
            and left() > 1500:
        # choose the NV family region with the best verdict+quota
        nvc = set()
        for e in nv_entries:
            for l in (e.get("locations") or []):
                nvc.add(str(l).lower())
        nvc |= set(FIXED)
        nv_rank = []
        for reg in sorted(nvc):
            offered, why, naf = region_verdict(nv_entries, reg)
            if not offered or "location_restricted" in str(why):
                continue
            a = aml.get(reg) or aml_usage(tok, sid, reg)
            f = fam_of(a.get("fam") or {}, "standardNVFamily")
            lim = (f or {}).get("limit")
            nv_ok = (isinstance(lim, int) and (lim >= 6 or lim == -1))
            nv_rank.append({"region": reg, "why": why, "zone_naf": naf,
                            "nv_limit": lim,
                            "score": (1 if str(reg).lower() == str(loc).lower() else 0,
                                      1 if nv_ok else 0, 1 if not naf else 0,
                                      1 if reg in PREFER else 0)})
        nv_rank.sort(key=lambda x: x["score"], reverse=True)
        emit({"step": "nv-fallback-plan", "top5": nv_rank[:5]})
        if nv_rank:
            nloc = nv_rank[0]["region"]
            emit({"step": "nv-fallback-region", "chosen": nloc,
                  "why": nv_rank[0]["why"], "nv_limit": nv_rank[0]["nv_limit"]})
            # dependencies are region-bound; the fallback reuses the SAME workspace only
            # when it is already in that region, else record the verbatim constraint.
            if nloc.lower() != str(loc).lower():
                emit({"step": "nv-fallback-skipped",
                      "why": "workspace_region_bound", "workspace_region": loc,
                      "nv_region": nloc})
            else:
                nv_state, _ = cluster_attempt(NCLUSTER, NVSKU, "Dedicated", "nv6")
                if nv_state == "Succeeded":
                    own["cluster"] = NCLUSTER
                    jurl = (base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                            "/jobs/" + JOB_C + "?api-version=" + API_W)
                    jp = {"jobType": "Command", "displayName": JOB_C,
                          "experimentName": "c211-i127462",
                          "description": "c211 i127462 amlcompute M60 fallback probe",
                          "command": cmd,
                          "computeId": (rbase +
                                        "/Microsoft.MachineLearningServices/workspaces/" +
                                        WS + "/computes/" + NCLUSTER),
                          "resources": {"instanceCount": 1},
                          "outputs": outputs}
                    if env_id:
                        jp["environmentId"] = env_id
                    st, jb = arm(tok, jurl, "PUT", {"properties": jp}, timeout=180)
                    emit({"step": "job-create-nv", **err_of(st, jb)})
                    if st in (200, 201):
                        own["job"] = JOB_C
                        fin, txt = poll_job(JOB_C, min(1200, max(300, left() - 800)), "nv")
                        uu = re.findall(r"GPU-[0-9a-fA-F-]{16,}", txt or "")
                        if uu:
                            device = {"found": True, "uuid": uu[0], "text": txt,
                                      "sku": NVSKU, "region": loc}
                else:
                    delete_cluster(NCLUSTER, "nv6-failed")

    # ---------- I. teardown ----------
    def del_and_wait(url, label, budget=300):
        st, b = arm(tok, url, "DELETE", timeout=180)
        emit({"step": label + "-delete", **err_of(st, b)})
        t0 = time.time()
        last = st
        while time.time() - t0 < budget:
            time.sleep(8)
            stp, _ = arm(tok, url, timeout=60)
            last = stp
            if stp == 404:
                break
        emit({"step": label + "-absence", "final_http": last})

    if own.get("job"):
        del_and_wait(base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                     "/jobs/" + JOB_C + "?api-version=" + API_W, "job", 180)
    for cname, ctag in ((CLUSTER, "v100"), (NCLUSTER, "nv6")):
        stp, _ = arm(tok, base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                     "/computes/" + cname + "?api-version=" + API_C, timeout=60)
        if stp != 404:
            del_and_wait(base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                         "/computes/" + cname + "?api-version=" + API_C, "cluster-" + ctag,
                         300)
    if own.get("ws"):
        del_and_wait(base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                     "?api-version=" + API_W, "ws", 600)
    if own.get("kv"):
        del_and_wait(base + "/Microsoft.KeyVault/vaults/" + own["kv"] +
                     "?api-version=" + REG_VER, "kv", 240)
    if own.get("sa"):
        del_and_wait(base + "/Microsoft.Storage/storageAccounts/" + own["sa"] +
                     "?api-version=" + STG_VER, "sa", 300)
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
            if re.search(r"(?i)^c211i127462|^c211-i127462", str(x.get("name", "")))]
    emit({"step": "rg-inventory-final", "http": st, "ours_remaining": mine})
    uu = re.findall(r"GPU-[0-9a-fA-F-]{16,}", device.get("text") or "")
    # blob-final read (independent of the job poll)
    blob_final = None
    if sas:
        sb, bb = httptext(sas, timeout=30)
        blob_final = {"http": sb, "len": len(bb)}
        if sb == 200:
            t2 = bb.decode("utf-8", "replace")
            uu = sorted(set(uu) | set(re.findall(r"GPU-[0-9a-fA-F-]{16,}", t2)))
    emit({"step": "DONE", "mode": "amlcompute-v100",
          "device_found": bool(uu), "uuids": uu[:4],
          "sku": device.get("sku"), "region": loc,
          "v100_cluster_state": v_state, "nv_cluster_state": nv_state,
          "ws_state": ws_state, "blob_final": blob_final,
          "v100_detail": v_detail})
    emit({"step": "PROBE-EXIT", "code": 0})


if __name__ == "__main__":
    main()
