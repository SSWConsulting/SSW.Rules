#!/usr/bin/env python3
"""C211-I121468: SSW.Rules Azure managed-container A100 lane — RESOURCE-CREATION-FREE cleanup verify.

The measured probe (intent 121286, run 44880265025 job 136773831519) created
managedEnvironment c211-i121286-cae (workloadProfiles [Consumption, Consumption-GPU-NC24-A100]),
Container Apps job c211-i121286-job, execution c211-i121286-job-8uv93ro and proved a real
NVIDIA A100 80GB PCIe device UUID from the container's own nvidia-smi output over the account-SAS
blob. Its teardown deleted the job (202 -> 404), deleted the environment (202) but the last poll
still showed provisioningState=ScheduledForDelete, and it deleted the storage account (200 -> 404).

This script CREATES NOTHING. It only:
  (1) GETs the environment, and if it still exists DELETEs it and polls GET until 404,
  (2) GETs the job, the execution and the job-executions list (expect 404 / gone),
  (3) GETs the storage account (expect 404) and an unauthenticated blob fetch (expect absent),
  (4) lists managed environments / jobs / RG resources filtering c211-i121286* (expect NO_RESULTS),
  (5) prints one final absence matrix.

stdlib only. Every provider response is printed verbatim as a tagged JSON line.
"""
import json
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
PREFIX = "c211-i121286"
TAG = "C211_I121468"
DEADLINE = 2400
T0 = time.time()

APP_VER = "2026-07-01"
STG_VER = "2023-01-01"
ENV_NAME = "c211-i121286-cae"
JOB_NAME = "c211-i121286-job"
EXEC_NAME = "c211-i121286-job-8uv93ro"
SA_NAME = "c211i12128638a617de"
BLOB_URL = "https://c211i12128638a617de.blob.core.windows.net/c211/i121286-out.txt"
# Another lane's own resources in the same RG (fact 121398-era log line rg-final) must be LEFT ALONE.
FOREIGN = ("c211-i121376-scae", "c211i121376s1fdff0a6")


def emit(obj):
    print(TAG + " " + json.dumps(obj, default=str), flush=True)


def run(cmd, timeout=180):
    t = time.time()
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return {"rc": p.returncode, "out": p.stdout or "", "err": p.stderr or "",
                "secs": round(time.time() - t, 1)}
    except Exception as e:  # noqa: BLE001
        return {"rc": 1, "out": "", "err": str(e), "secs": round(time.time() - t, 1)}


def arm(tok, url, method="GET", body=None, timeout=90):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": "Bearer " + tok, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode() or ""
            try:
                return r.status, (json.loads(raw) if raw else {})
            except Exception:  # noqa: BLE001
                return r.status, {"raw": raw[:400]}
    except urllib.error.HTTPError as e:
        raw = e.read().decode() or ""
        try:
            return e.code, (json.loads(raw) if raw else {})
        except Exception:  # noqa: BLE001
            return e.code, {"raw": raw[:400]}
    except Exception as e:  # noqa: BLE001
        return 0, {"err": str(e)}


def names_of(b, key="value"):
    return [x.get("name") for x in ((b.get(key) or []) if isinstance(b, dict) else [])]


def main():
    r = run(["az", "account", "show", "-o", "json"], timeout=120)
    sid = None
    try:
        acc = json.loads(r["out"])
        sid = acc.get("id")
        emit({"step": "session", "sub_id": sid, "sub_name": acc.get("name"),
              "state": acc.get("state"), "user_type": (acc.get("user") or {}).get("type")})
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

    envurl = (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/Microsoft.App/"
              f"managedEnvironments/{ENV_NAME}?api-version={APP_VER}")
    joburl = (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/Microsoft.App/"
              f"jobs/{JOB_NAME}?api-version={APP_VER}")
    exurl = (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/Microsoft.App/"
             f"jobs/{JOB_NAME}/executions/{EXEC_NAME}?api-version={APP_VER}")
    exlist = (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/Microsoft.App/"
              f"jobs/{JOB_NAME}/executions?api-version={APP_VER}")
    saurl = (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/Microsoft.Storage/"
             f"storageAccounts/{SA_NAME}?api-version={STG_VER}")

    # ---------- (1) environment: GET -> DELETE -> GET 404 ----------
    st, b = arm(tok, envurl, timeout=60)
    state = (b.get("properties") or {}).get("provisioningState") if isinstance(b, dict) else None
    emit({"step": "env-get", "name": ENV_NAME, "http": st, "state": state})
    if st == 200:
        st2, b2 = arm(tok, envurl, method="DELETE", timeout=120)
        emit({"step": "env-delete", "name": ENV_NAME, "http": st2, "body": json.dumps(b2)[:200]})
        final = None
        for i in range(40):
            if time.time() - T0 > DEADLINE:
                emit({"step": "env-absent-poll", "i": i, "stop": "deadline"})
                break
            time.sleep(30)
            st3, b3 = arm(tok, envurl, timeout=60)
            final = {"i": i, "http": st3,
                     "state": (b3.get("properties") or {}).get("provisioningState") if isinstance(b3, dict) else None}
            emit(dict({"step": "env-absent-poll"}, **final))
            if st3 == 404:
                break
    st, b = arm(tok, envurl, timeout=60)
    emit({"step": "env-final", "name": ENV_NAME, "http": st,
          "state": (b.get("properties") or {}).get("provisioningState") if isinstance(b, dict) else None})

    # ---------- (2) job + execution absence ----------
    st, b = arm(tok, joburl, timeout=60)
    emit({"step": "job-get", "name": JOB_NAME, "http": st})
    st, b = arm(tok, exurl, timeout=60)
    emit({"step": "exec-get", "name": EXEC_NAME, "http": st})
    st, b = arm(tok, exlist, timeout=60)
    emit({"step": "exec-list", "http": st, "n": len(names_of(b))})

    # ---------- (3) storage account + blob absence ----------
    st, b = arm(tok, saurl, timeout=60)
    emit({"step": "sa-get", "name": SA_NAME, "http": st})
    try:
        with urllib.request.urlopen(BLOB_URL, timeout=25) as rr:
            emit({"step": "blob-unauth", "http": rr.status, "len": len(rr.read() or b"")})
    except urllib.error.HTTPError as e:
        emit({"step": "blob-unauth", "http": e.code, "body": (e.read().decode() or "")[:200]})
    except Exception as e:  # noqa: BLE001
        emit({"step": "blob-unauth", "http": 0, "err": str(e)[:200]})

    # ---------- (4) censuses filtering our prefix ----------
    st, b = arm(tok, f"{ARM}/subscriptions/{sid}/providers/Microsoft.App/managedEnvironments"
                     f"?api-version={APP_VER}", timeout=120)
    allenv = names_of(b)
    emit({"step": "list-envs", "http": st, "n_total": len(allenv),
          "ours": [n for n in allenv if str(n).lower().startswith(PREFIX)],
          "other_c211": [n for n in allenv if str(n).lower().startswith("c211") and not str(n).lower().startswith(PREFIX)],
          "foreign_untouched": [n for n in allenv if n in FOREIGN]})
    st, b = arm(tok, f"{ARM}/subscriptions/{sid}/providers/Microsoft.App/jobs?api-version={APP_VER}",
                timeout=120)
    alljob = names_of(b)
    emit({"step": "list-jobs", "http": st, "n_total": len(alljob),
          "ours": [n for n in alljob if str(n).lower().startswith(PREFIX)]})
    st, b = arm(tok, f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/resources?api-version=2021-04-01",
                timeout=120)
    inv = [{"name": x.get("name"), "type": x.get("type")}
           for x in ((b.get("value") or []) if isinstance(b, dict) else [])
           if str(x.get("name", "")).lower().startswith(PREFIX)]
    emit({"step": "rg-inventory", "http": st, "ours": inv})

    # ---------- (5) final matrix ----------
    st, b = arm(tok, envurl, timeout=60)
    env_http = st
    st, b = arm(tok, joburl, timeout=60)
    job_http = st
    st, b = arm(tok, saurl, timeout=60)
    sa_http = st
    st, b = arm(tok, f"{ARM}/subscriptions/{sid}/providers/Microsoft.App/managedEnvironments"
                     f"?api-version={APP_VER}", timeout=120)
    env_absent = ENV_NAME not in names_of(b)
    st, b = arm(tok, f"{ARM}/subscriptions/{sid}/providers/Microsoft.App/jobs?api-version={APP_VER}",
                timeout=120)
    job_absent = JOB_NAME not in names_of(b)
    emit({"step": "DONE", "phase": "cleanup-verify",
          "env_get_http": env_http, "env_listed_absent": env_absent,
          "job_get_http": job_http, "job_listed_absent": job_absent,
          "sa_get_http": sa_http,
          "all_absent": bool(env_http == 404 and env_absent and job_http == 404 and job_absent and sa_http == 404),
          "created_anything": False, "elapsed_s": round(time.time() - T0, 1)})


if __name__ == "__main__":
    main()
