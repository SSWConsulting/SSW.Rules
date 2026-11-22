#!/usr/bin/env python3
"""C211-I126457 READ-ONLY Azure AML state probe (no job submit, no compute change).

Prints C211_I126457 <json> lines and PUTs the full result to
  c211/x126457-arm.txt  (account SAS generated locally from the storage key)
so the lane can read it back without further workflow runs.
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

TAG = "C211_I126457"
ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
WS = "c211i122276aml"
SA = "c211i122276af4cdf28"
CONTAINER = "c211"
CLUSTER = "c211-i122276-t4"
JOB = "c211-i126178-dev"
PREV_JOB = "c211-i125967-dev"
API_W = "2024-10-01"
API_C = "2024-04-01"
STG_VER = "2023-01-01"
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
    acc = {}
    try:
        acc = json.loads(r["out"])
    except Exception:  # noqa: BLE001
        emit({"step": "fatal", "why": "no az session", "raw": r["out"][:400]})
    sid = acc.get("id")
    emit({"step": "identity", "sub": sid, "tenant": acc.get("tenantId"), "name": acc.get("name")})
    OUT["identity"] = {"sub": sid, "tenant": acc.get("tenantId"), "name": acc.get("name")}
    r = run(["az", "account", "get-access-token", "--resource", ARM, "--output", "json"], timeout=120)
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
    ws = base + "/Microsoft.MachineLearningServices/workspaces/" + WS

    # 0) storage key -> SAS (so the result can be read back)
    q = None
    st, kb = arm(tok, base + "/Microsoft.Storage/storageAccounts/" + SA +
                 "/listKeys?api-version=" + STG_VER, "POST", {}, timeout=90)
    for k in (kb.get("keys") or []) if isinstance(kb, dict) else []:
        if k.get("keyName") == "key1":
            q, se = sa_sas(SA, k["value"], 3)
            emit({"step": "sa-sas", "http": st, "expires": se})
    OUT["sas_ok"] = bool(q)

    # 1) the job
    st, jb = arm(tok, ws + "/jobs/" + JOB + "?api-version=" + API_W, timeout=90)
    props = (jb.get("properties") or {}) if isinstance(jb, dict) else {}
    jstatus = props.get("status")
    jprov = props.get("provisioningState")
    jinfo = {
        "http": st, "status": jstatus, "provisioningState": jprov,
        "computeId": props.get("computeId"),
        "displayName": props.get("displayName"),
        "experimentName": props.get("experimentName"),
        "creationContext": props.get("creationContext", {}).get("createdBy", {}).get("userObjectId") if isinstance(props.get("creationContext"), dict) else None,
        "creationTime": props.get("creationTime"),
        "startTime": props.get("startTime"),
        "endTime": props.get("endTime"),
        "error": props.get("error"),
        "notification": props.get("notification"),
        "resources": props.get("resources"),
        "exitCode": props.get("exitCode"),
        "content": {k: props.get(k) for k in ("command", "environmentVariables") if props.get(k)},
        "tags": (jb.get("tags") if isinstance(jb, dict) else None),
    }
    emit({"step": "job-get", **{k: jinfo[k] for k in ("http", "status", "provisioningState", "error", "endTime")}})
    OUT["job"] = jinfo
    # raw status detail: queue reason / node allocation
    if isinstance(props, dict):
        OUT["job_props_keys"] = sorted(list(props.keys()))
        for k in ("statusDetails", "queueReason", "amlComputeAllocation", "computeRuntime"):
            if props.get(k):
                OUT["job_" + k] = props.get(k)
    if st != 200:
        OUT["job_error_raw"] = jb

    # 2) previous job (context)
    st, pb = arm(tok, ws + "/jobs/" + PREV_JOB + "?api-version=" + API_W, timeout=90)
    pprops = (pb.get("properties") or {}) if isinstance(pb, dict) else {}
    OUT["prev_job"] = {"http": st, "status": pprops.get("status"),
                       "provisioningState": pprops.get("provisioningState"),
                       "error": pprops.get("error"), "endTime": pprops.get("endTime")}
    emit({"step": "prev-job", "http": st, "status": pprops.get("status")})

    # 3) compute cluster + node state counts
    st, cb = arm(tok, ws + "/computes/" + CLUSTER + "?api-version=" + API_C, timeout=90)
    cp = ((cb.get("properties") or {}).get("properties") or {}) if isinstance(cb, dict) else {}
    OUT["cluster"] = {"http": st, "provState": (cb.get("properties") or {}).get("provisioningState") if isinstance(cb, dict) else None,
                      "vmSize": cp.get("vmSize"), "scaleSettings": cp.get("scaleSettings"),
                      "currentNodeCount": cp.get("currentNodeCount"), "targetNodeCount": cp.get("targetNodeCount"),
                      "nodeStateCounts": cp.get("nodeStateCounts"), "errors": cp.get("errors")}
    emit({"step": "cluster", "http": st, "current": cp.get("currentNodeCount"),
          "target": cp.get("targetNodeCount"), "nodeStateCounts": cp.get("nodeStateCounts")})
    st, nb = arm(tok, ws + "/computes/" + CLUSTER + "/nodes?api-version=" + API_C, timeout=90)
    nodes = []
    for n in (nb.get("value") or []) if isinstance(nb, dict) else []:
        np_ = n.get("properties") or {}
        nodes.append({"name": n.get("name"), "state": np_.get("state"), "ip": np_.get("privateIpAddress"),
                      "port": np_.get("port"), "vmSize": np_.get("vmSize"),
                      "isSpot": np_.get("isSpot"), "errors": np_.get("errors")})
    OUT["nodes"] = {"http": st, "count": len(nodes), "items": nodes}
    emit({"step": "nodes", "http": st, "count": len(nodes),
          "states": [x.get("state") for x in nodes]})

    # 4) NCASv3_T4 quota in the cluster region (westeurope)
    loc = (cb.get("location") if isinstance(cb, dict) else None) or "westeurope"
    st, ub = arm(tok, ARM + "/subscriptions/" + sid + "/providers/Microsoft.Compute/locations/" +
                 loc + "/usages?api-version=2024-07-01", timeout=120)
    qu = []
    for u in (ub.get("value") or []) if isinstance(ub, dict) else []:
        nm = (u.get("name") or {}).get("value") or ""
        if "NCASv3_T4" in nm or "NCASv3" in nm or "Total Regional" in nm:
            qu.append({"name": nm, "current": u.get("currentValue"), "limit": u.get("limit"),
                       "local": (u.get("name") or {}).get("localizedValue")})
    OUT["quota"] = {"http": st, "loc": loc, "items": qu}
    emit({"step": "quota", "http": st, "items": qu})

    # 5) other jobs in the workspace that could hold T4 nodes
    st, lj = arm(tok, ws + "/jobs?api-version=" + API_W + "&$top=40", timeout=120)
    rows = []
    for j in (lj.get("value") or []) if isinstance(lj, dict) else []:
        pp = j.get("properties") or {}
        rows.append({"name": j.get("name"), "status": pp.get("status"),
                     "computeId": (pp.get("computeId") or "").split("/")[-1],
                     "endTime": pp.get("endTime")})
    OUT["jobs_recent"] = {"http": st, "items": rows}
    emit({"step": "jobs-list", "http": st, "n": len(rows),
          "nonterminal": [x["name"] for x in rows if x["status"] not in ("Completed", "Failed", "Canceled")]})

    # 6) write the full result blob
    if q:
        url = "https://" + SA + ".blob.core.windows.net/" + CONTAINER + "/x126457-arm.txt?" + q
        body = json.dumps(OUT, indent=1, default=str).encode()
        try:
            req = urllib.request.Request(url, data=body, method="PUT",
                                         headers={"x-ms-blob-type": "BlockBlob",
                                                  "x-ms-version": "2022-11-02",
                                                  "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as rr:
                emit({"step": "blob-put", "http": rr.status, "bytes": len(body)})
        except urllib.error.HTTPError as e:
            emit({"step": "blob-put", "http": e.code, "err": e.read()[:200].decode("utf-8", "replace")})
        except Exception as e:  # noqa: BLE001
            emit({"step": "blob-put", "err": "%s: %s" % (type(e).__name__, str(e)[:160])})
    emit({"step": "PROBE-EXIT", "code": 0})


main()
