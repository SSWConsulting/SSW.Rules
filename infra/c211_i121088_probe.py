#!/usr/bin/env python3
"""C211-I121088: SSW.Rules Azure managed-container GPU close-out probe.

Successor to i120836 v3. Measured facts from v3 (run 44871778267 / job 136747705982):
  * ACI GPU container groups are refused for this subscription in westeurope/eastus/
    southcentralus with HTTP 400 BadRequest "exceeds the maximum limit per container
    group for Standard Core Resources ... '1' CPU '1.5' GB memory ... '1' 'V100' GPU"
    even at the minimum resource request, so the ACI branch is closed.
  * The Container Apps branch DID provision managedEnvironment c211-i120836-cae in
    eastus (workloadProfiles Consumption + Consumption-GPU-NC8as-T4, provisioningState
    Succeeded) and ran job c211-i120836-job on Consumption-GPU-NC8as-T4 to status
    Succeeded (execution c211-i120836-job-d06ejro, 05:55:21-05:57:39Z,
    reason CompletionsReached, message "Reached expected number of succeeded pods").
  * The env had appLogsConfiguration.destination = null, so the completed replica's
    stdout was not persisted: both job log endpoints returned 404 and no nvidia-smi
    output/UUID was captured.
  * Teardown failed: env DELETE returned 409 ManagedEnvironmentHasContainerAppsJobs
    and both c211-i120836-job and c211-i120836-cae survived.

This probe therefore (a) captures the container's stdout through a channel we control
(an account SAS over a nonce storage account: the container uploads its nvidia-smi
output with curl/python, the probe reads it back and prints it verbatim), (b) polls
the live job logstream during execution as a second channel, and (c) really tears
everything down (job -> env -> storage account -> any older c211 leftover), proving
absence with 404 readbacks and empty list results.

stdlib only. Every provider response is printed verbatim as a tagged JSON line.
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

ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
PREFIX = "c211-i121088"
OLDPREFIXES = ("c211-i120836", "c211-i120756")
TAG = "C211_I121088"
NONCE = "i121088"
DEADLINE = 2700
T0 = time.time()

ACI_VER = "2026-07-01"
APP_VER = "2026-07-01"
STG_VER = "2023-01-01"
IMAGE = "mcr.microsoft.com/azureml/openmpi4.1.0-cuda11.8-cudnn8-ubuntu22.04:latest"
PROFILE = "Consumption-GPU-NC8as-T4"
ENV_REUSE = "c211-i120836-cae"
ENV_NEW = "c211-i121088-cae"
JOB_NAME = "c211-i121088-job"


def emit(obj):
    print(TAG + " " + json.dumps(obj, default=str), flush=True)


def left():
    return DEADLINE - (time.time() - T0)


def run(cmd, timeout=300):
    t = time.time()
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return {"rc": p.returncode, "out": p.stdout or "", "err": p.stderr or "",
                "secs": round(time.time() - t, 1)}
    except Exception as e:  # noqa: BLE001
        return {"rc": 1, "out": "", "err": str(e), "secs": round(time.time() - t, 1)}


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


def httptext(url, method="GET", body=None, headers=None, timeout=60):
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()[:4000]
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
                    "message": (e.get("message") or "")[:900]}
        if "raw" in body:
            return {"http": st, "raw": body["raw"][:900]}
        return {"http": st, "body": json.dumps(body)[:900]}
    return {"http": st}


def wait_gone(tok, url, label, tries=20, sleep_s=10):
    """Poll until HTTP 404, print each state."""
    for i in range(tries):
        st, b = arm(tok, url, timeout=60)
        ps = ((b.get("properties") or {}) if isinstance(b, dict) else {}).get("provisioningState")
        emit({"step": label + "-absent-poll", "i": i, "http": st, "state": ps,
              **({} if st in (200, 404) else err_of(st, b))})
        if st == 404:
            return 404
        time.sleep(sleep_s)
    return st


def sa_sas(acct, key_b64, services="b", rt="co", perm="rwdlc", hours=3):
    st = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 300))
    se = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + hours * 3600))
    sv = "2022-11-02"
    sts = "\n".join([acct, perm, services, rt, st, se, "", "https", sv, ""]) + "\n"
    sig = base64.b64encode(hmac.new(base64.b64decode(key_b64), sts.encode(),
                                    hashlib.sha256).digest()).decode()
    q = urllib.parse.urlencode({"sv": sv, "ss": services, "srt": rt, "sp": perm,
                                "st": st, "se": se, "spr": "https", "sig": sig})
    return q, se


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

    # ---------- providers + inventory ----------
    for ns in ("Microsoft.ContainerInstance", "Microsoft.App", "Microsoft.Storage"):
        st, b = arm(tok, f"{ARM}/subscriptions/{sid}/providers/{ns}?api-version=2021-04-01")
        emit({"step": "provider", "ns": ns, "http": st,
              "registrationState": (b.get("registrationState") if isinstance(b, dict) else None)})
    st, rl = arm(tok, f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/resources?api-version=2021-04-01", timeout=120)
    mine = [{"name": x.get("name"), "type": x.get("type")}
            for x in ((rl.get("value") or []) if isinstance(rl, dict) else [])
            if str(x.get("name", "")).lower().startswith(PREFIX)
            or any(str(x.get("name", "")).lower().startswith(p) for p in OLDPREFIXES)]
    emit({"step": "rg-inventory", "http": st, "mine": mine})

    # ---------- locate or create the managed environment ----------
    envurl = (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/Microsoft.App/"
              f"managedEnvironments/{ENV_REUSE}?api-version={APP_VER}")
    st, env = arm(tok, envurl, timeout=60)
    envps = ((env.get("properties") or {}) if isinstance(env, dict) else {}).get("provisioningState")
    emit({"step": "env-get", "name": ENV_REUSE, "http": st, "state": envps})
    envname = ENV_REUSE
    if st != 200 or envps != "Succeeded":
        envname = ENV_NEW
        envurl = (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/Microsoft.App/"
                  f"managedEnvironments/{envname}?api-version={APP_VER}")
        envbody = {"location": "eastus", "tags": {"c211": NONCE},
                   "properties": {"workloadProfiles": [
                       {"name": "Consumption", "workloadProfileType": "Consumption"},
                       {"name": PROFILE, "workloadProfileType": PROFILE}]}}
        st, b = arm(tok, envurl, method="PUT", body=envbody, timeout=300)
        emit({"step": "capp-env-create", "name": envname, "profile": PROFILE,
              "region": "eastus", **err_of(st, b)})
        if st not in (200, 201):
            emit({"step": "DONE", "phase": "capp", "verdict": "ENV_REFUSED"})
            return
        dl = time.time() + min(1500, max(240, left() - 600))
        while time.time() < dl:
            stp, bp = arm(tok, envurl, timeout=60)
            props = (bp.get("properties") or {}) if isinstance(bp, dict) else {}
            envps = props.get("provisioningState")
            emit({"step": "capp-env-poll", "http": stp, "state": envps})
            if envps in ("Succeeded", "Failed", "Canceled"):
                break
            time.sleep(30)
        if envps != "Succeeded":
            emit({"step": "DONE", "phase": "capp", "verdict": "ENV_NOT_PROVISIONED",
                  "last_state": envps})
            return
    st, env = arm(tok, envurl, timeout=60)
    env_id = env.get("id") if isinstance(env, dict) else None
    emit({"step": "env-ready", "name": envname, "id_ok": bool(env_id),
          "state": ((env.get("properties") or {}) if isinstance(env, dict) else {}).get("provisioningState")})
    if not env_id:
        return

    # ---------- storage account + SAS channel ----------
    sa = ("c211i121088" + hashlib.sha256(NONCE.encode()).hexdigest()[:8]).lower()[:24]
    saurl = (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/"
             f"Microsoft.Storage/storageAccounts/{sa}?api-version={STG_VER}")
    sabody = {"location": "eastus", "sku": {"name": "Standard_LRS"}, "kind": "StorageV2",
              "tags": {"c211": NONCE},
              "properties": {"allowBlobPublicAccess": False, "minimumTlsVersion": "TLS1_2",
                             "supportsHttpsTrafficOnly": True,
                             "networkAcls": {"bypass": "AzureServices", "defaultAction": "Allow"}}}
    st, b = arm(tok, saurl, method="PUT", body=sabody, timeout=240)
    emit({"step": "sa-create", "name": sa, **err_of(st, b)})
    sas = None
    if st in (200, 201, 202):
        for i in range(20):
            stp, bp = arm(tok, saurl, timeout=60)
            ps = ((bp.get("properties") or {}) if isinstance(bp, dict) else {}).get("provisioningState")
            emit({"step": "sa-poll", "i": i, "http": stp, "state": ps})
            if ps == "Succeeded":
                break
            time.sleep(10)
        st, kb = arm(tok, f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/"
                          f"Microsoft.Storage/storageAccounts/{sa}/listKeys?api-version={STG_VER}",
                     method="POST", body={}, timeout=90)
        key = None
        try:
            key = (kb.get("keys") or [{}])[0].get("value")
        except Exception:  # noqa: BLE001
            pass
        emit({"step": "sa-keys", "http": st, "got": bool(key)})
        if key:
            try:
                q, se = sa_sas(sa, key)
                base = f"https://{sa}.blob.core.windows.net"
                stc, bc = httptext(f"{base}/c211?restype=container&{q}", method="PUT")
                emit({"step": "sa-container", "http": stc, "body": bc[:200].decode("utf-8", "replace")})
                if stc in (201, 409):
                    sas = f"{base}/c211/{NONCE}-out.txt?{q}"
                    emit({"step": "sa-sas", "ok": True, "blob": f"{base}/c211/{NONCE}-out.txt",
                          "expires": se})
            except Exception as e:  # noqa: BLE001
                emit({"step": "sa-sas", "ok": False, "err": str(e)})

    # ---------- container command (stdout + blob upload) ----------
    inner = ('echo C211-START; hostname; date -u; '
             'for p in /usr/local/nvidia/bin/nvidia-smi /usr/bin/nvidia-smi /bin/nvidia-smi; do '
             'if [ -x "$p" ]; then echo FOUND=$p; "$p" -L; echo ---SMI-Q---; '
             '"$p" --query-gpu=name,uuid,memory.total --format=csv,noheader; fi; done; '
             'command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi -L; '
             'echo ---DEVS---; ls -l /dev/nvidia* 2>/dev/null; echo C211-END')
    cmd = f"OUT=/tmp/c211.txt; {{ {inner}; }} > $OUT 2>&1; cat $OUT; "
    if sas:
        up = ("if command -v curl >/dev/null 2>&1; then "
              f"curl -sS -X PUT '{sas}' -H 'x-ms-blob-type: BlockBlob' "
              "-H 'x-ms-version: 2022-11-02' -H 'Content-Type: text/plain' "
              "--data-binary @$OUT; echo C211_UPLOAD_CURL_RC=$?; else "
              "python3 -c \"import urllib.request;d=open('/tmp/c211.txt','rb').read();"
              f"r=urllib.request.Request('{sas}',data=d,method='PUT',"
              "headers={'x-ms-blob-type':'BlockBlob','x-ms-version':'2022-11-02',"
              "'Content-Type':'text/plain'});print('C211_UPLOAD_PY',urllib.request.urlopen(r,timeout=30).status)\"; fi")
        cmd += up + "; "
    cmd += "echo C211_UPLOAD_DONE; sleep 30"

    # ---------- create + start the one nonce job ----------
    joburl = (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/Microsoft.App/jobs/"
              f"{JOB_NAME}?api-version={APP_VER}")
    jobbody = {"location": "eastus", "tags": {"c211": NONCE, "nonce": NONCE},
               "properties": {"environmentId": env_id, "workloadProfileName": PROFILE,
                              "configuration": {"triggerType": "Manual", "replicaRetryLimit": 0,
                                                "replicaTimeout": 900,
                                                "manualTriggerConfig": {"replicaCompletionCount": 1,
                                                                        "parallelism": 1}},
                              "template": {"containers": [{
                                  "name": "gpu", "image": IMAGE,
                                  "command": ["/bin/bash", "-c", cmd],
                                  "resources": {"cpu": 4, "memory": "16Gi"}}]}}}
    st, b = arm(tok, joburl, method="PUT", body=jobbody, timeout=180)
    emit({"step": "capp-job-create", **err_of(st, b)})
    if st not in (200, 201):
        emit({"step": "DONE", "phase": "capp", "verdict": "JOB_REFUSED"})
    else:
        baseurl = joburl.split("?")[0]
        st, b = arm(tok, f"{baseurl}/start?api-version={APP_VER}", method="POST", body={}, timeout=120)
        emit({"step": "capp-job-start", **err_of(st, b)})
        execname = (b.get("name") if isinstance(b, dict) else None)
        emit({"step": "exec-name", "name": execname})
        text = ""
        if execname:
            exurl = f"{baseurl}/executions/{execname}?api-version={APP_VER}"
            dl = time.time() + min(600, max(240, left() - 900))
            while time.time() < dl:
                stp, bp = arm(tok, exurl, timeout=60)
                props = (bp.get("properties") or {}) if isinstance(bp, dict) else {}
                status = props.get("status")
                # channel 1: live logstream
                live = {}
                for ver in (APP_VER, "2024-03-01"):
                    sl, bl = httptext(f"{baseurl}/executions/{execname}/containers/gpu/"
                                      f"logstream?api-version={ver}", timeout=30)
                    live[ver] = {"http": sl, "len": len(bl or b"")}
                    if sl == 200 and bl:
                        txt = bl.decode("utf-8", "replace")
                        emit({"step": "capp-logstream", "ver": ver, "len": len(txt),
                              "has_uuid": bool(re.search(r"GPU-[0-9a-fA-F-]{16,}", txt)),
                              "text": txt[:2500]})
                # channel 2: blob
                blobd = None
                if sas:
                    sb, bb = httptext(sas, timeout=30)
                    if sb == 200 and bb:
                        blobd = bb.decode("utf-8", "replace")
                        emit({"step": "capp-blob", "http": sb, "len": len(blobd),
                              "has_uuid": bool(re.search(r"GPU-[0-9a-fA-F-]{16,}", blobd)),
                              "text": blobd[:2500]})
                        text = blobd
                emit({"step": "capp-exec-poll", "http": stp, "status": status,
                      "reason": props.get("reason"), "live": live,
                      "blob_got": blobd is not None})
                if blobd and "C211-END" in blobd:
                    break
                if status in ("Succeeded", "Failed", "Canceled") and blobd is None:
                    time.sleep(10)
                elif status in ("Succeeded", "Failed", "Canceled"):
                    break
                time.sleep(15)
            emit({"step": "capp-capture", "len": len(text),
                  "has_uuid": bool(re.search(r"GPU-[0-9a-fA-F-]{16,}", text or "")),
                  "uuid_lines": [ln for ln in (text or "").splitlines() if "GPU-" in ln][:6],
                  "full_text": (text or "")[:3000]})

    # ---------- teardown: job -> env -> storage -> old leftovers ----------
    st, b = arm(tok, joburl, method="DELETE", timeout=240)
    emit({"step": "job-delete", **err_of(st, b)})
    wait_gone(tok, joburl, "job", tries=24, sleep_s=10)
    st, b = arm(tok, envurl, method="DELETE", timeout=300)
    emit({"step": "env-delete", **err_of(st, b)})
    wait_gone(tok, envurl, "env", tries=30, sleep_s=15)
    if sas is not None:
        st, b = arm(tok, saurl, method="DELETE", timeout=240)
        emit({"step": "sa-delete", **err_of(st, b)})
        wait_gone(tok, saurl, "sa", tries=20, sleep_s=10)

    # old leftovers from v2/v3 (env delete needs its jobs gone first)
    for oldjob in ("c211-i120836-job", "c211-i120756-job"):
        u = (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/Microsoft.App/jobs/"
             f"{oldjob}?api-version={APP_VER}")
        std, bd = arm(tok, u, method="DELETE", timeout=240)
        emit({"step": "old-job-delete", "name": oldjob, **err_of(std, bd)})
    for oldenv in ("c211-i120836-cae", "c211-i120756-cae"):
        u = (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/Microsoft.App/"
             f"managedEnvironments/{oldenv}?api-version={APP_VER}")
        std, bd = arm(tok, u, method="DELETE", timeout=300)
        emit({"step": "old-env-delete", "name": oldenv, **err_of(std, bd)})
        wait_gone(tok, u, "old-env-" + oldenv, tries=20, sleep_s=10)

    # ---------- absence proof ----------
    st, rl = arm(tok, f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/resources?api-version=2021-04-01", timeout=120)
    mine = [{"name": x.get("name"), "type": x.get("type")}
            for x in ((rl.get("value") or []) if isinstance(rl, dict) else [])
            if str(x.get("name", "")).lower().startswith("c211")]
    emit({"step": "rg-final", "http": st, "c211_left": mine})
    for label, path in (("jobs", f"/subscriptions/{sid}/providers/Microsoft.App/jobs"),
                        ("envs", f"/subscriptions/{sid}/providers/Microsoft.App/managedEnvironments"),
                        ("aci", f"/subscriptions/{sid}/providers/Microsoft.ContainerInstance/containerGroups")):
        st, lst = arm(tok, f"{ARM}{path}?api-version={APP_VER if label != 'aci' else ACI_VER}", timeout=120)
        names = [x.get("name") for x in ((lst.get("value") or []) if isinstance(lst, dict) else [])
                 if str(x.get("name", "")).lower().startswith("c211")]
        emit({"step": "list-" + label, "http": st,
              "n_total": len(((lst.get("value") or []) if isinstance(lst, dict) else [])),
              "c211": names})
    emit({"step": "DONE", "phase": "capp", "elapsed_s": int(time.time() - T0)})


if __name__ == "__main__":
    main()
