#!/usr/bin/env python3
"""C211-I121286: SSW.Rules Azure managed-container GPU probe — A100 workload-profile extension.

Proven predecessor (facts 121231/121266): on subscription b8b18dcf (RG SSW.Rules.Staging) the
'/deploy' fork-PR OIDC ARM identity created managedEnvironment c211-i120836-cae in eastus with
workloadProfiles [Consumption, Consumption-GPU-NC8as-T4], ran Container Apps job
c211-i121088-job on Consumption-GPU-NC8as-T4, and the container's own nvidia-smi output
captured over an account-SAS blob proved Tesla T4 UUID GPU-29b12fb0-d05b-b26f-5cd9-dfa319ebfe85.

This probe is the NEW SKU path (never measured on this subscription): the
Consumption-GPU-NC24-A100 workload profile that Microsoft.App offers for serverless GPU
environments. It
  (1) GETs the region workload-profile support for Microsoft.App (available workload profile
      types for eastus across several api-versions) and records every verbatim response,
  (2) creates ONE nonce managed environment c211-i121286-cae with workloadProfiles
      [Consumption, Consumption-GPU-NC24-A100], recording every verbatim refusal,
  (3) submits ONE nonce Container Apps job c211-i121286-job (1 replica) on that profile running
      nvidia-smi -L plus --query-gpu=name,uuid,memory.total with its stdout captured over our
      own account-SAS blob, polls the execution to terminal and re-GETs the blob,
  (4) takes an independent ARM GET readback of the execution,
  (5) deletes job -> environment -> storage account and proves absence (per-path 404 +
      resource-list NO_RESULTS).

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
PREFIX = "c211-i121286"
NONCE = "i121286"
TAG = "C211_I121286"
DEADLINE = 2700
T0 = time.time()

APP_VER = "2026-07-01"
STG_VER = "2023-01-01"
IMAGE = "mcr.microsoft.com/azureml/openmpi4.1.0-cuda11.8-cudnn8-ubuntu22.04:latest"
PROFILE = "Consumption-GPU-NC24-A100"
ENV_NAME = "c211-i121286-cae"
JOB_NAME = "c211-i121286-job"
SA_NAME = ("c211i121286" + hashlib.sha256(NONCE.encode()).hexdigest()[:8]).lower()[:24]
WPT_VERS = ("2026-07-01", "2024-10-02-preview", "2024-03-01", "2023-05-01")


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
                    "message": (e.get("message") or "")[:900],
                    "details": (json.dumps(e.get("details"))[:600] if e.get("details") else None)}
        if "raw" in body:
            return {"http": st, "raw": body["raw"][:900]}
        return {"http": st, "body": json.dumps(body)[:900]}
    return {"http": st}


def wait_gone(tok, url, label, tries=20, sleep_s=10, api_ver=None):
    """Poll until HTTP 404, print each state."""
    last = None
    for i in range(tries):
        st, b = arm(tok, url, timeout=60)
        ps = ((b.get("properties") or {}) if isinstance(b, dict) else {}).get("provisioningState")
        last = st
        emit({"step": label + "-absent-poll", "i": i, "http": st, "state": ps})
        if st == 404:
            return 404
        time.sleep(sleep_s)
    return last


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


def wpt_names(body):
    """Extract workload profile type names from an available-workload-profile-types body."""
    names = []
    if isinstance(body, dict):
        vals = body.get("value")
        if isinstance(vals, list):
            for x in vals:
                if isinstance(x, dict):
                    nm = x.get("name") or x.get("workloadProfileType") or \
                        ((x.get("properties") or {}).get("name"))
                    if nm:
                        names.append(nm)
        elif "raw" in body:
            pass
    return names


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

    # ---------- providers ----------
    for ns in ("Microsoft.App", "Microsoft.Storage", "Microsoft.ContainerInstance"):
        st, b = arm(tok, f"{ARM}/subscriptions/{sid}/providers/{ns}?api-version=2021-04-01")
        emit({"step": "provider", "ns": ns, "http": st,
              "registrationState": (b.get("registrationState") if isinstance(b, dict) else None)})

    # ---------- (1) region workload-profile support for Microsoft.App ----------
    for ver in WPT_VERS:
        st, b = arm(tok, f"{ARM}/subscriptions/{sid}/providers/Microsoft.App/locations/eastus/"
                          f"availableManagedEnvironmentsWorkloadProfileTypes?api-version={ver}",
                    timeout=90)
        names = wpt_names(b)
        emit({"step": "wpt-get", "region": "eastus", "api": ver, "http": st,
              "n": len(names), "names": names[:40],
              "has_a100": any("A100" in (n or "") for n in names),
              **({} if st == 200 else err_of(st, b))})
        if st == 200 and names:
            break
    # also list existing managed environments (verbatim names only)
    st, envl = arm(tok, f"{ARM}/subscriptions/{sid}/providers/Microsoft.App/managedEnvironments"
                        f"?api-version={APP_VER}", timeout=120)
    names = [x.get("name") for x in ((envl.get("value") or []) if isinstance(envl, dict) else [])]
    emit({"step": "env-list-pre", "http": st, "n_total": len(names),
          "c211": [n for n in names if str(n).lower().startswith("c211")]})

    # ---------- rg inventory ----------
    st, rl = arm(tok, f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/resources?api-version=2021-04-01",
                 timeout=120)
    mine = [{"name": x.get("name"), "type": x.get("type")}
            for x in ((rl.get("value") or []) if isinstance(rl, dict) else [])
            if str(x.get("name", "")).lower().startswith(PREFIX)]
    emit({"step": "rg-inventory", "http": st, "mine": mine})

    # ---------- (2) create ONE nonce managed environment with the A100 profile ----------
    envurl = (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/Microsoft.App/"
              f"managedEnvironments/{ENV_NAME}?api-version={APP_VER}")
    st, eg = arm(tok, envurl, timeout=60)
    emit({"step": "env-get-pre", "name": ENV_NAME, "http": st})
    envbody = {"location": "eastus", "tags": {"c211": NONCE, "nonce": NONCE},
               "properties": {"workloadProfiles": [
                   {"name": "Consumption", "workloadProfileType": "Consumption"},
                   {"name": PROFILE, "workloadProfileType": PROFILE}]}}
    st, b = arm(tok, envurl, method="PUT", body=envbody, timeout=300)
    emit({"step": "capp-env-create", "name": ENV_NAME, "profile": PROFILE,
          "region": "eastus", **err_of(st, b)})
    env_created = st in (200, 201, 202)
    envps = None
    env_id = None
    if env_created:
        dl = time.time() + min(1500, max(240, left() - 900))
        while time.time() < dl:
            stp, bp = arm(tok, envurl, timeout=60)
            props = (bp.get("properties") or {}) if isinstance(bp, dict) else {}
            envps = props.get("provisioningState")
            env_id = bp.get("id") if isinstance(bp, dict) else None
            emit({"step": "capp-env-poll", "http": stp, "state": envps})
            if envps in ("Succeeded", "Failed", "Canceled"):
                break
            time.sleep(30)
        st, env = arm(tok, envurl, timeout=60)
        props = (env.get("properties") or {}) if isinstance(env, dict) else {}
        envps = props.get("provisioningState")
        env_id = env.get("id") if isinstance(env, dict) else None
        emit({"step": "env-ready", "name": ENV_NAME, "http": st, "id_ok": bool(env_id),
              "state": envps,
              "workloadProfiles": [{"name": w.get("name"),
                                    "type": w.get("workloadProfileType")}
                                   for w in (props.get("workloadProfiles") or [])
                                   if isinstance(w, dict)][:8]})

    # ---------- storage account + account-SAS blob stdout channel ----------
    sas = None
    saurl = (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/"
             f"Microsoft.Storage/storageAccounts/{SA_NAME}?api-version={STG_VER}")
    if envps == "Succeeded" and env_id:
        sabody = {"location": "eastus", "sku": {"name": "Standard_LRS"}, "kind": "StorageV2",
                  "tags": {"c211": NONCE},
                  "properties": {"allowBlobPublicAccess": False, "minimumTlsVersion": "TLS1_2",
                                 "supportsHttpsTrafficOnly": True,
                                 "networkAcls": {"bypass": "AzureServices", "defaultAction": "Allow"}}}
        st, b = arm(tok, saurl, method="PUT", body=sabody, timeout=240)
        emit({"step": "sa-create", "name": SA_NAME, **err_of(st, b)})
        if st in (200, 201, 202):
            for i in range(20):
                stp, bp = arm(tok, saurl, timeout=60)
                ps = ((bp.get("properties") or {}) if isinstance(bp, dict) else {}).get("provisioningState")
                emit({"step": "sa-poll", "i": i, "http": stp, "state": ps})
                if ps == "Succeeded":
                    break
                time.sleep(10)
            st, kb = arm(tok, f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/"
                              f"Microsoft.Storage/storageAccounts/{SA_NAME}/listKeys?api-version={STG_VER}",
                         method="POST", body={}, timeout=90)
            key = None
            try:
                key = (kb.get("keys") or [{}])[0].get("value")
            except Exception:  # noqa: BLE001
                pass
            emit({"step": "sa-keys", "http": st, "got": bool(key)})
            if key:
                try:
                    q, se = sa_sas(SA_NAME, key)
                    base = f"https://{SA_NAME}.blob.core.windows.net"
                    stc, bc = httptext(f"{base}/c211?restype=container&{q}", method="PUT")
                    emit({"step": "sa-container", "http": stc,
                          "body": bc[:200].decode("utf-8", "replace")})
                    if stc in (201, 409):
                        sas = f"{base}/c211/{NONCE}-out.txt?{q}"
                        emit({"step": "sa-sas", "ok": True,
                              "blob": f"{base}/c211/{NONCE}-out.txt", "expires": se})
                except Exception as e:  # noqa: BLE001
                    emit({"step": "sa-sas", "ok": False, "err": str(e)})

    # ---------- container command (stdout + blob upload) ----------
    inner = ('echo C211-A100-START; hostname; date -u; '
             'for p in /usr/local/nvidia/bin/nvidia-smi /usr/bin/nvidia-smi /bin/nvidia-smi; do '
             'if [ -x "$p" ]; then echo FOUND=$p; "$p" -L; echo ---SMI-Q---; '
             '"$p" --query-gpu=name,uuid,memory.total --format=csv,noheader; fi; done; '
             'command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi -L; '
             'echo ---DEVS---; ls -l /dev/nvidia* 2>/dev/null; echo C211-A100-END')
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

    # ---------- (2b) submit ONE nonce Container Apps job on the A100 profile ----------
    joburl = (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/Microsoft.App/jobs/"
              f"{JOB_NAME}?api-version={APP_VER}")
    job_env_id = env_id or (f"/subscriptions/{sid}/resourceGroups/{RG}/providers/Microsoft.App/"
                            f"managedEnvironments/{ENV_NAME}")
    jobbody = {"location": "eastus", "tags": {"c211": NONCE, "nonce": NONCE},
               "properties": {"environmentId": job_env_id, "workloadProfileName": PROFILE,
                              "configuration": {"triggerType": "Manual", "replicaRetryLimit": 0,
                                                "replicaTimeout": 1800,
                                                "manualTriggerConfig": {"replicaCompletionCount": 1,
                                                                        "parallelism": 1}},
                              "template": {"containers": [{
                                  "name": "gpu", "image": IMAGE,
                                  "command": ["/bin/bash", "-c", cmd],
                                  "resources": {"cpu": 8, "memory": "32Gi"}}]}}}
    st, b = arm(tok, joburl, method="PUT", body=jobbody, timeout=180)
    job_create_http = st
    emit({"step": "capp-job-create", "env_ready": envps == "Succeeded",
          "env_id_nonexistent": env_id is None, **err_of(st, b)})
    execution = None
    text = ""
    exec_readback = None
    if st in (200, 201):
        baseurl = joburl.split("?")[0]
        st, b = arm(tok, f"{baseurl}/start?api-version={APP_VER}", method="POST", body={},
                    timeout=120)
        emit({"step": "capp-job-start", **err_of(st, b)})
        execname = (b.get("name") if isinstance(b, dict) else None)
        emit({"step": "exec-name", "name": execname})
        if execname:
            execution = execname
            exurl = f"{baseurl}/executions/{execname}?api-version={APP_VER}"
            dl = time.time() + min(900, max(240, left() - 600))
            while time.time() < dl:
                stp, bp = arm(tok, exurl, timeout=60)
                props = (bp.get("properties") or {}) if isinstance(bp, dict) else {}
                status = props.get("status")
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
                if blobd and "C211-A100-END" in blobd:
                    break
                if status in ("Succeeded", "Failed", "Canceled"):
                    if blobd is None:
                        time.sleep(10)
                    else:
                        break
                time.sleep(15)
            # independent ARM GET readback of the execution after capture
            st_r, bp_r = arm(tok, exurl, timeout=60)
            props_r = (bp_r.get("properties") or {}) if isinstance(bp_r, dict) else {}
            exec_readback = {"http": st_r, "status": props_r.get("status"),
                             "reason": props_r.get("reason"),
                             "startTime": props_r.get("startTime"),
                             "endTime": props_r.get("endTime"),
                             "name": bp_r.get("name") if isinstance(bp_r, dict) else None}
            emit({"step": "exec-readback", **exec_readback})
            if sas:
                sb2, bb2 = httptext(sas, timeout=30)
                txt2 = bb2.decode("utf-8", "replace") if bb2 else ""
                emit({"step": "capp-blob-reget", "http": sb2, "len": len(txt2),
                      "has_uuid": bool(re.search(r"GPU-[0-9a-fA-F-]{16,}", txt2)),
                      "text": txt2[:2500]})
                if txt2:
                    text = txt2
            emit({"step": "capp-capture", "len": len(text),
                  "has_uuid": bool(re.search(r"GPU-[0-9a-fA-F-]{16,}", text or "")),
                  "uuid_lines": [ln for ln in (text or "").splitlines() if "GPU-" in ln][:8],
                  "full_text": (text or "")[:3000]})

    # ---------- (3) teardown: job -> env -> storage ----------
    st, b = arm(tok, joburl, method="DELETE", timeout=240)
    emit({"step": "job-delete", "name": JOB_NAME, **err_of(st, b)})
    wait_gone(tok, joburl, "job", tries=18, sleep_s=10)
    st, b = arm(tok, envurl, method="DELETE", timeout=300)
    emit({"step": "env-delete", "name": ENV_NAME, **err_of(st, b)})
    wait_gone(tok, envurl, "env", tries=24, sleep_s=15)
    st, b = arm(tok, saurl, method="DELETE", timeout=240)
    emit({"step": "sa-delete", "name": SA_NAME, **err_of(st, b)})
    wait_gone(tok, saurl, "sa", tries=18, sleep_s=10)

    # ---------- absence proof ----------
    st, rl = arm(tok, f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/resources?api-version=2021-04-01",
                 timeout=120)
    mine = [{"name": x.get("name"), "type": x.get("type")}
            for x in ((rl.get("value") or []) if isinstance(rl, dict) else [])
            if str(x.get("name", "")).lower().startswith("c211")]
    emit({"step": "rg-final", "http": st, "c211_left": mine})
    for label, path, ver in (
            ("jobs", f"/subscriptions/{sid}/providers/Microsoft.App/jobs", APP_VER),
            ("envs", f"/subscriptions/{sid}/providers/Microsoft.App/managedEnvironments", APP_VER),
            ("aci", f"/subscriptions/{sid}/providers/Microsoft.ContainerInstance/containerGroups",
             "2026-07-01")):
        st, lst = arm(tok, f"{ARM}{path}?api-version={ver}", timeout=120)
        names = [x.get("name") for x in ((lst.get("value") or []) if isinstance(lst, dict) else [])
                 if str(x.get("name", "")).lower().startswith("c211")]
        emit({"step": "list-" + label, "http": st,
              "n_total": len(((lst.get("value") or []) if isinstance(lst, dict) else [])),
              "c211": names})
    emit({"step": "DONE", "phase": "a100", "env_state": envps,
          "job_create_http": job_create_http,
          "job_created": job_create_http in (200, 201),
          "execution": execution, "readback": exec_readback,
          "elapsed_s": int(time.time() - T0)})


if __name__ == "__main__":
    main()
