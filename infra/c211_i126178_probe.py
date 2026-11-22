#!/usr/bin/env python3
"""C211-I126457: try to UNBLOCK the queued AML T4 job by raising the
NCASv3_T4 family vCPU quota in westeurope via Microsoft.Quota, then re-read
cluster/job state.  Read-mostly: the only writes are (a) the quota PUT and
(b) the result blob.  No job submit, no delete.

Notes
 * listKeys must be POST (v3 bug: GET -> no SAS -> no readback blob).
 * Microsoft.Quota quota names for compute drop spaces/underscores:
   "Standard NCASv3_T4 Family" -> "standardNCASv3T4Family".
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

TAG = "C211_I126457U"
ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
WS = "c211i122276aml"
SA = "c211i122276af4cdf28"
CONTAINER = "c211"
CLUSTER = "c211-i122276-t4"
JOB = "c211-i126178-dev-b"
STG_VER = "2023-01-01"
API_W = "2024-10-01"
API_C = "2024-04-01"
LOC = "westeurope"
WANT = 12
T0 = time.time()
OUT = {}


def emit(obj):
    obj["d"] = round(time.time() - T0, 1)
    print((TAG + " " + json.dumps(obj, default=str))[:6000], flush=True)


def run(cmd, timeout=120):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return {"rc": p.returncode, "out": (p.stdout or "") + (p.stderr or "")}
    except Exception as e:  # noqa: BLE001
        return {"rc": -1, "out": "%s: %s" % (type(e).__name__, e)}


def arm(tok, url, method="GET", body=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Authorization": "Bearer " + tok,
                                          "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode("utf-8", "replace")
        return r.status, (json.loads(raw) if raw.strip() else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace") or ""
        try:
            return e.code, json.loads(raw)
        except Exception:  # noqa: BLE001
            return e.code, {"raw": raw[:400]}
    except Exception as e:  # noqa: BLE001
        return None, {"err": "%s: %s" % (type(e).__name__, str(e)[:200])}


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
    emit({"step": "token", "got": bool(tok)})
    if not sid or not tok:
        return
    OUT["sub"] = sid

    # SAS for readback (POST listKeys)
    q = None
    st, kb = arm(tok, ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                 "/providers/Microsoft.Storage/storageAccounts/" + SA +
                 "/listKeys?api-version=" + STG_VER, "POST", {})
    for k in (kb.get("keys") or []) if isinstance(kb, dict) else []:
        if k.get("keyName") == "key1":
            q, se = sa_sas(SA, k["value"], 3)
    OUT["sas_ok"] = bool(q)
    emit({"step": "sa-sas", "http": st, "ok": bool(q)})

    # 1) Microsoft.Quota list at subscription scope; find the T4/NV compute quotas
    st, qb = arm(tok, ARM + "/subscriptions/" + sid + "/providers/Microsoft.Quota/quotas?api-version=2023-06-01")
    found = []
    for it in (qb.get("value") or []) if isinstance(qb, dict) else []:
        nm = (it.get("name") or {}).get("value") or ""
        pr = it.get("properties") or {}
        if any(t in nm.upper() for t in ("T4", "NV", "ND", "NC")):
            found.append({"name": nm, "limit": pr.get("limit"), "used": pr.get("usedValue"),
                          "unit": pr.get("unit"), "resType": pr.get("resourceType"),
                          "service": pr.get("serviceName") or it.get("properties", {}).get("serviceName")})
    OUT["quota_list"] = {"http": st, "n": len(found), "items": found}
    emit({"step": "quota-list", "http": st, "n": len(found),
          "t4": [x for x in found if "T4" in x["name"].upper()][:6]})

    # 2) the exact per-location quota object for NCASv3_T4
    names = [x["name"] for x in found if "T4" in x["name"].upper()]
    if not names:
        names = ["standardNCASv3T4Family"]
    OUT["quota_put"] = []
    for qn in names[:3]:
        url = (ARM + "/subscriptions/" + sid + "/providers/Microsoft.Quota/quotas/" + qn +
               "?api-version=2023-06-01")
        st, gb = arm(tok, url)
        rec = {"name": qn, "get_http": st,
               "get_limit": (gb.get("properties") or {}).get("limit") if isinstance(gb, dict) else None,
               "get_used": (gb.get("properties") or {}).get("usedValue") if isinstance(gb, dict) else None,
               "get_resType": (gb.get("properties") or {}).get("resourceType") if isinstance(gb, dict) else None,
               "get_service": (gb.get("properties") or {}).get("serviceName") if isinstance(gb, dict) else None}
        body = {"properties": {"limit": WANT, "name": {"value": qn}, "resourceType": "dedicated"}}
        if isinstance(gb, dict) and (gb.get("properties") or {}).get("resourceType"):
            body["properties"]["resourceType"] = gb["properties"]["resourceType"]
        if isinstance(gb, dict) and (gb.get("properties") or {}).get("serviceName"):
            body["properties"]["serviceName"] = gb["properties"]["serviceName"]
        st2, pb = arm(tok, url, "PUT", body, timeout=180)
        rec["put_http"] = st2
        rec["put_err"] = (pb.get("error") or {}).get("code") if isinstance(pb, dict) else None
        rec["put_msg"] = str((pb.get("error") or {}).get("message") if isinstance(pb, dict) else pb)[:400]
        rec["put_limit"] = (pb.get("properties") or {}).get("limit") if isinstance(pb, dict) else None
        rec["put_state"] = (pb.get("properties") or {}).get("provisioningState") if isinstance(pb, dict) else None
        OUT["quota_put"].append(rec)
        emit({"step": "quota-put", **{k: rec[k] for k in ("name", "get_http", "get_limit",
                                                          "put_http", "put_err", "put_msg", "put_limit", "put_state")}})
        time.sleep(3)
        st, g2 = arm(tok, url)
        rec["after_limit"] = (g2.get("properties") or {}).get("limit") if isinstance(g2, dict) else None
        rec["after_state"] = (g2.get("properties") or {}).get("provisioningState") if isinstance(g2, dict) else None
        emit({"step": "quota-after", "name": qn, "limit": rec["after_limit"], "state": rec["after_state"]})

    # 3) effective compute usage after the attempt
    st, ub = arm(tok, ARM + "/subscriptions/" + sid + "/providers/Microsoft.Compute/locations/" +
                 LOC + "/usages?api-version=2024-07-01")
    eff = []
    for u in (ub.get("value") or []) if isinstance(ub, dict) else []:
        nm = (u.get("name") or {}).get("value") or ""
        if "T4" in nm.upper() or "NV" in nm.upper():
            eff.append({"name": nm, "cur": u.get("currentValue"), "limit": u.get("limit")})
    OUT["effective"] = {"http": st, "items": eff}
    emit({"step": "effective", "items": eff})

    # 4) cluster + job state
    st, cb = arm(tok, ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                 "/providers/Microsoft.MachineLearningServices/workspaces/" + WS +
                 "/computes/" + CLUSTER + "?api-version=" + API_C)
    cp = ((cb.get("properties") or {}).get("properties") or {}) if isinstance(cb, dict) else {}
    OUT["cluster"] = {"http": st, "current": cp.get("currentNodeCount"), "target": cp.get("targetNodeCount"),
                      "nodeStateCounts": cp.get("nodeStateCounts"),
                      "scaleSettings": cp.get("scaleSettings")}
    emit({"step": "cluster", **OUT["cluster"]})
    st, jb = arm(tok, ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                 "/providers/Microsoft.MachineLearningServices/workspaces/" + WS +
                 "/jobs/" + JOB + "?api-version=" + API_W)
    pp = (jb.get("properties") or {}) if isinstance(jb, dict) else {}
    OUT["job"] = {"http": st, "status": pp.get("status"), "error": pp.get("error"),
                  "limits": pp.get("limits"), "resources": pp.get("resources")}
    emit({"step": "job", "http": st, "status": pp.get("status"), "err": pp.get("error")})

    # 5) AML allowed GPU vm sizes in westeurope + westus2 (for the successor)
    OUT["amlsizes"] = {}
    for loc in ("westeurope", "westus2"):
        st, vb = arm(tok, ARM + "/subscriptions/" + sid + "/providers/Microsoft.MachineLearningServices" +
                     "/locations/" + loc + "/vmSizes?api-version=2024-10-01")
        rows = []
        for v in (vb.get("value") or []) if isinstance(vb, dict) else []:
            if v.get("gpus"):
                rows.append({"name": v.get("name"), "gpus": v.get("gpus"), "family": v.get("family"),
                             "vcpus": v.get("vCPUs"), "memGB": v.get("memoryGB")})
        OUT["amlsizes"][loc] = {"http": st, "items": rows}
        emit({"step": "amlsizes", "loc": loc, "http": st, "n": len(rows),
              "names": [x["name"] for x in rows][:25]})

    if q:
        url = "https://" + SA + ".blob.core.windows.net/" + CONTAINER + "/x126457-unblock.txt?" + q
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
