#!/usr/bin/env python3
"""C211-I126457 READ-ONLY GPU quota + AML vmSize sweep (no create, no change).

1) Microsoft.Compute/locations/{loc}/usages across candidate regions -> every
   GPU-ish quota entry (limit and current), so we know which GPU families this
   subscription can actually provision.
2) Microsoft.MachineLearningServices/locations/{loc}/vmSizes for the workspace
   region -> which AML-allowed VM sizes carry a GPU.
Writes the result to c211/x126457-quota.txt for direct readback.
"""
import base64
import hashlib
import hmac
import json
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

TAG = "C211_I126457Q"
ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
WS = "c211i122276aml"
SA = "c211i122276af4cdf28"
CONTAINER = "c211"
STG_VER = "2023-01-01"
T0 = time.time()
OUT = {}

REGIONS = ["westeurope", "northeurope", "uksouth", "francecentral", "germanywestcentral",
           "swedencentral", "polandcentral", "italynorth", "spaincentral", "norwayeast",
           "westus", "westus2", "westus3", "eastus", "eastus2", "centralus", "northcentralus",
           "southcentralus", "westcentralus", "canadacentral", "eastasia", "southeastasia",
           "japaneast", "koreacentral", "centralindia", "australiaeast", "brazilsouth", "uaenorth"]
GPUT = ("NCASv3_T4", "NCADS", "NCADSA100", "NVADS", "NVv4", "NV", "ND", "NC", "A10", "A100",
        "V100", "H100", "T4", "GPU", "Promo")


def emit(obj):
    obj["d"] = round(time.time() - T0, 1)
    print((TAG + " " + json.dumps(obj, default=str))[:6000], flush=True)


def run(cmd, timeout=120):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return {"rc": p.returncode, "out": (p.stdout or "") + (p.stderr or "")}
    except Exception as e:  # noqa: BLE001
        return {"rc": -1, "out": "%s: %s" % (type(e).__name__, e)}


def arm(tok, url, timeout=90):
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + tok,
                                              "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode("utf-8", "replace")
        return r.status, (json.loads(raw) if raw.strip() else {})
    except urllib.error.HTTPError as e:
        return e.code, {"raw": (e.read().decode("utf-8", "replace") or "")[:200]}
    except Exception as e:  # noqa: BLE001
        return None, {"err": "%s: %s" % (type(e).__name__, str(e)[:160])}


def sa_sas(acct, key_b64, hours=3):
    stt = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 300))
    se = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + hours * 3600))
    sv = "2022-11-02"
    sts = "\n".join([acct, "rwdlc", "b", "co", stt, se, "", "https", sv, ""]) + "\n"
    sig = base64.b64encode(hmac.new(base64.b64decode(key_b64), sts.encode(),
                                    hashlib.sha256).digest()).decode()
    return urllib.parse.urlencode({"sv": sv, "ss": "b", "srt": "co", "sp": "rwdlc",
                                   "st": stt, "se": se, "spr": "https", "sig": sig}), se


def main():
    r = run(["az", "account", "show", "-o", "json"], timeout=120)
    try:
        sid = json.loads(r["out"]).get("id")
    except Exception:  # noqa: BLE001
        emit({"step": "fatal", "raw": r["out"][:300]})
        return
    r = run(["az", "account", "get-access-token", "--resource", ARM, "--output", "json"], timeout=120)
    try:
        tok = json.loads(r["out"]).get("accessToken")
    except Exception:  # noqa: BLE001
        tok = None
    emit({"step": "token", "sub": sid, "got": bool(tok)})
    if not sid or not tok:
        return
    OUT["sub"] = sid

    # SAS for readback
    q = None
    st, kb = arm(tok, ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                 "/providers/Microsoft.Storage/storageAccounts/" + SA +
                 "/listKeys?api-version=" + STG_VER)
    for k in (kb.get("keys") or []) if isinstance(kb, dict) else []:
        if k.get("keyName") == "key1":
            q, se = sa_sas(SA, k["value"], 3)
    OUT["sas_ok"] = bool(q)

    OUT["quota"] = {}
    OUT["gpu_nonzero"] = {}
    for loc in REGIONS:
        st, ub = arm(tok, ARM + "/subscriptions/" + sid + "/providers/Microsoft.Compute/locations/" +
                     loc + "/usages?api-version=2024-07-01")
        items = []
        for u in (ub.get("value") or []) if isinstance(ub, dict) else []:
            nm = (u.get("name") or {}).get("value") or ""
            if any(t in nm for t in GPUT):
                it = {"name": nm, "cur": u.get("currentValue"), "limit": u.get("limit")}
                items.append(it)
                try:
                    if int(u.get("limit") or 0) > 0:
                        OUT["gpu_nonzero"].setdefault(loc, []).append(it)
                except Exception:  # noqa: BLE001
                    pass
        OUT["quota"][loc] = {"http": st, "n": len(items), "items": items}
        emit({"step": "quota", "loc": loc, "http": st, "gpu_entries": len(items),
              "nonzero": len(OUT["gpu_nonzero"].get(loc, []))})
    emit({"step": "quota-summary", "nonzero": {k: v for k, v in OUT["gpu_nonzero"].items()}})

    # AML allowed VM sizes (workspace region + any region with nonzero GPU quota)
    OUT["amlsizes"] = {}
    for loc in ["westeurope"] + [l for l in OUT["gpu_nonzero"] if l != "westeurope"][:4]:
        st, vb = arm(tok, ARM + "/subscriptions/" + sid + "/providers/Microsoft.MachineLearningServices" +
                     "/locations/" + loc + "/vmSizes?api-version=2024-10-01")
        rows = []
        for v in (vb.get("value") or []) if isinstance(vb, dict) else []:
            g = v.get("gpus") or 0
            if g:
                rows.append({"name": v.get("name"), "gpus": g, "family": v.get("family"),
                             "vcpus": v.get("vCPUs"), "memGB": v.get("memoryGB"),
                             "premiumIO": v.get("premiumIO")})
        OUT["amlsizes"][loc] = {"http": st, "n_gpu": len(rows), "items": rows[:40]}
        emit({"step": "amlsizes", "loc": loc, "http": st, "gpu_sizes": len(rows)})

    if q:
        url = "https://" + SA + ".blob.core.windows.net/" + CONTAINER + "/x126457-quota.txt?" + q
        body = json.dumps(OUT, indent=1, default=str).encode()
        try:
            req = urllib.request.Request(url, data=body, method="PUT",
                                         headers={"x-ms-blob-type": "BlockBlob",
                                                  "x-ms-version": "2022-11-02",
                                                  "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as rr:
                emit({"step": "blob-put", "http": rr.status, "bytes": len(body)})
        except Exception as e:  # noqa: BLE001
            emit({"step": "blob-put", "err": "%s: %s" % (type(e).__name__, str(e)[:160])})
    emit({"step": "PROBE-EXIT", "code": 0})


main()
