#!/usr/bin/env python3
"""C211-I120836 v3: Azure managed-container GPU plane probe (ACI + Container Apps).

Successor to i120756 v2. v2 evidence: the ACI PUT with cpu=2.0/mem=4.0 was rejected
HTTP 400 BadRequest "exceeds the maximum limit per container group for Standard Core
Resources ... '2' CPU '4' GB memory ... '1' 'V100' GPU", while v1's identical region/sku
with cpu=1.0/mem=1.5 passed resource validation and only failed on the Docker Hub image
pull (409 RegistryErrorResponse). v3 therefore retries ACI with the v1-proven 1.0/1.5
resource request and an MCR-hosted CUDA image, and only if ACI is refused runs the
Container Apps GPU workload-profile branch (eastus, Consumption-GPU-NC8as-T4 first).

Also pre-cleans every c211-i120756*/c211-i120836* leftover in RG SSW.Rules.Staging
(including the v2 managedEnvironment that was still 'Waiting' when its DELETE returned 202)
and proves absence (404 + list NO_RESULTS) for everything it creates.

stdlib only. Every provider response printed verbatim as a tagged JSON line.
"""
import json
import re
import subprocess
import time
import urllib.error
import urllib.request

ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
PREFIX = "c211-i120836"
OLDPREFIX = "c211-i120756"
TAG = "C211_I120836"
DEADLINE = 3300
T0 = time.time()

IMAGE = "mcr.microsoft.com/azureml/openmpi4.1.0-cuda11.8-cudnn8-ubuntu22.04:latest"
CMDLINE = ("echo C211-START; hostname; for p in /usr/local/nvidia/bin/nvidia-smi "
           "/usr/bin/nvidia-smi /bin/nvidia-smi; do if [ -x \"$p\" ]; then echo FOUND=$p; "
           "\"$p\" -L; echo ---SMI-Q---; \"$p\" --query-gpu=name,uuid,memory.total "
           "--format=csv,noheader; fi; done; command -v nvidia-smi >/dev/null 2>&1 && "
           "nvidia-smi -L; echo ---DEVS---; ls -l /dev/nvidia* 2>/dev/null; "
           "echo C211-END; sleep 45")
ACI_REGIONS = [("westeurope", "V100"), ("eastus", "V100"), ("southcentralus", "V100")]
ACA_REGION = "eastus"
ACA_PROFILE_PREF = ["Consumption-GPU-NC8as-T4", "Consumption-GPU-NC24-A100"]
ACI_VER = "2026-07-01"
APP_VER = "2026-07-01"


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
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": "Bearer " + tok, "Content-Type": "application/json"})
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
                    "message": (e.get("message") or "")[:900]}
        if "raw" in body:
            return {"http": st, "raw": body["raw"][:900]}
        return {"http": st, "body": json.dumps(body)[:900]}
    return {"http": st}


def delete_and_prove(tok, url, label, tries=20):
    d = arm(tok, url, method="DELETE", timeout=240)
    emit({"step": label + "-delete", "http": d[0], **({} if d[0] < 400 else err_of(d[0], d[1]))})
    st = None
    for _ in range(tries):
        time.sleep(15)
        st, b = arm(tok, url, timeout=60)
        ps = ((b.get("properties") or {}) if isinstance(b, dict) else {}).get("provisioningState")
        emit({"step": label + "-absence-poll", "http": st, "state": ps})
        if st == 404:
            break
        if st == 200 and ps in ("Deleting", "Canceled", "Failed"):
            continue
    return st


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

    for ns in ("Microsoft.ContainerInstance", "Microsoft.App"):
        st, b = arm(tok, f"{ARM}/subscriptions/{sid}/providers/{ns}?api-version=2021-04-01")
        emit({"step": "provider", "ns": ns, "http": st,
              "registrationState": (b.get("registrationState") if isinstance(b, dict) else None)})

    # ---- pre-clean every own / predecessor leftover in the RG ----
    st, rl = arm(tok, f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/resources?api-version=2021-04-01", timeout=120)
    mine = [x for x in ((rl.get("value") or []) if isinstance(rl, dict) else [])
            if str(x.get("name", "")).lower().startswith(PREFIX)
            or str(x.get("name", "")).lower().startswith(OLDPREFIX)]
    emit({"step": "rg-inventory", "http": st,
          "mine": [{"name": x.get("name"), "type": x.get("type")} for x in mine]})
    for x in mine:
        if x.get("id"):
            d = arm(tok, f"{ARM}{x['id']}?api-version=2021-04-01", method="DELETE", timeout=240)
            emit({"step": "preclean-delete", "name": x.get("name"), "type": x.get("type"),
                  **err_of(d[0], d[1])})
    if mine:
        time.sleep(20)
        st, rl = arm(tok, f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/resources?api-version=2021-04-01", timeout=120)
        still = [x.get("name") for x in ((rl.get("value") or []) if isinstance(rl, dict) else [])
                 if str(x.get("name", "")).lower().startswith(PREFIX)
                 or str(x.get("name", "")).lower().startswith(OLDPREFIX)]
        emit({"step": "preclean-after", "http": st, "still": still,
              "container_instances": [x.get("name") for x in ((rl.get("value") or []) if isinstance(rl, dict) else [])
                                      if 'containerGroups' in str(x.get('type', ''))]})
        # hard-delete any still-present container group by explicit id
        for x in ((rl.get("value") or []) if isinstance(rl, dict) else []):
            nm = str(x.get("name", "")).lower()
            if (nm.startswith(PREFIX) or nm.startswith(OLDPREFIX)) and 'containerGroups' in str(x.get('type', '')):
                d = arm(tok, f"{ARM}{x['id']}?api-version={ACI_VER}", method="DELETE", timeout=240)
                emit({"step": "preclean-delete2", "name": x.get("name"), "http": d[0]})
        for x in ((rl.get("value") or []) if isinstance(rl, dict) else []):
            nm = str(x.get("name", "")).lower()
            if (nm.startswith(PREFIX) or nm.startswith(OLDPREFIX)) and 'managedEnvironments' in str(x.get('type', '')):
                d = arm(tok, f"{ARM}{x['id']}?api-version={APP_VER}", method="DELETE", timeout=240)
                emit({"step": "preclean-env-delete2", "name": x.get("name"), "http": d[0]})

    # ---------- ACI ----------
    created = None
    aci_results = []
    for region, sku in ACI_REGIONS:
        if left() < 900:
            break
        name = f"{PREFIX}-aci-{re.sub(r'[^a-z0-9]', '', region)[:14]}"
        body = {
            "location": region,
            "tags": {"c211": "i120836", "c211_lane": "i120756", "nonce": "i120836"},
            "properties": {
                "containers": [{"name": "gpu", "properties": {
                    "image": IMAGE, "command": ["/bin/bash", "-c", CMDLINE],
                    "resources": {"requests": {"cpu": 1.0, "memoryInGB": 1.5,
                                               "gpu": {"count": 1, "sku": sku}}}}}],
                "osType": "Linux",
                "restartPolicy": "Never"
            }
        }
        url = (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/"
               f"Microsoft.ContainerInstance/containerGroups/{name}?api-version={ACI_VER}")
        st, b = arm(tok, url, method="PUT", body=body, timeout=300)
        rec = {"region": region, "sku": sku, "cpu": 1.0, "mem": 1.5, "name": name, **err_of(st, b)}
        if st in (200, 201, 202) and isinstance(b, dict):
            rec["provisioningState"] = (b.get("properties") or {}).get("provisioningState")
        aci_results.append(rec)
        emit({"step": "aci-create", **rec})
        if st in (200, 201, 202):
            created = {"region": region, "sku": sku, "name": name}
            break
    emit({"step": "aci-results", "n": len(aci_results), "created": created})

    if created:
        name = created["name"]
        url = (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/"
               f"Microsoft.ContainerInstance/containerGroups/{name}?api-version={ACI_VER}")
        state = None
        dl = time.time() + min(1200, max(300, left() - 600))
        while time.time() < dl:
            st, b = arm(tok, url, timeout=60)
            props = (b.get("properties") or {}) if isinstance(b, dict) else {}
            state = props.get("provisioningState")
            inst = props.get("instanceView") or {}
            emit({"step": "aci-poll", "http": st, "state": state,
                  "containers": [{"name": c.get("name"),
                                  "state": ((c.get("properties") or {}).get("instanceView") or {}).get("currentState")}
                                 for c in (props.get("containers") or [])],
                  "events": [ev.get("name") for ev in (inst.get("events") or [])][-8:]})
            if st != 200 or state in ("Succeeded", "Failed", "Canceled", "Terminated"):
                break
            time.sleep(20)
        st, rb = arm(tok, url, timeout=60)
        props = (rb.get("properties") or {}) if isinstance(rb, dict) else {}
        emit({"step": "aci-readback", "http": st, "provisioningState": props.get("provisioningState"),
              "gpu_request": (((((props.get("containers") or [{}])[0].get("properties", {})
                                  .get("resources", {})).get("requests", {})).get("gpu"))),
              "instance_view": json.dumps(props.get("instanceView") or {})[:1200]})
        st, lg = arm(tok, (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/Microsoft.ContainerInstance/"
                           f"containerGroups/{name}/containers/gpu/logs?api-version={ACI_VER}"),
                     method="POST", timeout=120)
        content = (lg.get("content") or "") if isinstance(lg, dict) else ""
        emit({"step": "aci-logs", "http": st, "len": len(content),
              "has_uuid": bool(re.search(r"GPU-[0-9a-fA-F-]{16,}", content)),
              "uuid_lines": [l for l in content.splitlines() if "GPU-" in l][:6],
              "found": [l for l in content.splitlines() if l.startswith("FOUND=")][:3],
              "head": content[:800], "tail": content[-2000:]})
        _ = _ = None
        delete_and_prove(tok, url, "aci", tries=12)
        st, lst = arm(tok, f"{ARM}/subscriptions/{sid}/providers/Microsoft.ContainerInstance/containerGroups?api-version={ACI_VER}")
        names = [x.get("name") for x in ((lst.get("value") or []) if isinstance(lst, dict) else [])]
        emit({"step": "aci-cleanup", "list_http": st, "list_n": len(names),
              "mine": [n for n in names if str(n).lower().startswith(PREFIX) or str(n).lower().startswith(OLDPREFIX)]})
        emit({"step": "DONE", "phase": "aci", "elapsed_s": int(time.time() - T0)})
        return

    # ---------- Container Apps (only if ACI refused) ----------
    wp_url = (f"{ARM}/subscriptions/{sid}/providers/Microsoft.App/locations/{ACA_REGION}/"
              f"availableManagedEnvironmentsWorkloadProfileTypes?api-version={APP_VER}")
    st, wp = arm(tok, wp_url, timeout=60)
    vals = (wp.get("value") or []) if isinstance(wp, dict) else []
    gpu = [v for v in vals if isinstance(v, dict) and "GPU" in json.dumps(v).upper()]
    emit({"step": "capp-profiles", "http": st, "n": len(vals),
          "gpu": [{"name": v.get("name"), "props": v.get("properties")} for v in gpu]})
    choice = None
    for pref in ACA_PROFILE_PREF:
        for v in gpu:
            if v.get("name") == pref:
                choice = v
                break
        if choice:
            break
    if not choice and gpu:
        choice = gpu[0]
    if not choice:
        emit({"step": "DONE", "phase": "capp", "verdict": "NO_GPU_PROFILE"})
        return
    gname = choice.get("name")
    envname = f"{PREFIX}-cae"
    envurl = (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/Microsoft.App/"
              f"managedEnvironments/{envname}?api-version={APP_VER}")
    envbody = {"location": ACA_REGION, "tags": {"c211": "i120836"},
               "properties": {"workloadProfiles": [
                   {"name": "Consumption", "workloadProfileType": "Consumption"},
                   {"name": gname, "workloadProfileType": gname}]}}
    st, b = arm(tok, envurl, method="PUT", body=envbody, timeout=300)
    emit({"step": "capp-env-create", "profile": gname, "region": ACA_REGION, **err_of(st, b)})
    if st not in (200, 201):
        emit({"step": "DONE", "phase": "capp", "verdict": "ENV_REFUSED"})
        return
    ps = None
    dl = time.time() + min(1500, max(300, left() - 480))
    while time.time() < dl:
        stp, bp = arm(tok, envurl, timeout=60)
        props = (bp.get("properties") or {}) if isinstance(bp, dict) else {}
        ps = props.get("provisioningState")
        emit({"step": "capp-env-poll", "http": stp, "state": ps,
              "errors": json.dumps(props.get("errors") or props.get("provisioningErrors") or [])[:400],
              "defaultDomain": props.get("defaultDomain")})
        if ps in ("Succeeded", "Failed", "Canceled"):
            break
        time.sleep(30)
    if ps != "Succeeded":
        delete_and_prove(tok, envurl, "capp-env", tries=16)
        st, lst = arm(tok, f"{ARM}/subscriptions/{sid}/providers/Microsoft.App/managedEnvironments?api-version={APP_VER}")
        emit({"step": "capp-absence", "http": st,
              "mine": [e.get("name") for e in ((lst.get("value") or []) if isinstance(lst, dict) else [])
                       if str(e.get("name", "")).lower().startswith(PREFIX)]})
        emit({"step": "DONE", "phase": "capp", "verdict": "ENV_NOT_PROVISIONED", "last_state": ps})
        return
    env_id = (bp.get("id") if isinstance(bp, dict) else None) or envurl.split("?")[0]
    jobname = f"{PREFIX}-job"
    joburl = (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/Microsoft.App/jobs/"
              f"{jobname}?api-version={APP_VER}")
    jobbody = {"location": ACA_REGION, "tags": {"c211": "i120836"},
               "properties": {"environmentId": env_id, "workloadProfileName": gname,
                              "configuration": {"triggerType": "Manual", "replicaRetryLimit": 0,
                                                "replicaTimeout": 1200,
                                                "manualTriggerConfig": {"replicaCompletionCount": 1,
                                                                        "parallelism": 1}},
                              "template": {"containers": [{
                                  "name": "gpu", "image": IMAGE,
                                  "command": ["/bin/bash", "-c", CMDLINE],
                                  "resources": {"cpu": 4, "memory": "16Gi"}}]}}}
    st, b = arm(tok, joburl, method="PUT", body=jobbody, timeout=180)
    emit({"step": "capp-job-create", **err_of(st, b)})
    if st in (200, 201):
        base = joburl.split("?")[0]
        st, b = arm(tok, f"{base}/start?api-version={APP_VER}", method="POST", timeout=120)
        emit({"step": "capp-job-start", **err_of(st, b)})
        dl = time.time() + min(1500, max(300, left() - 240))
        exname = None
        while time.time() < dl:
            st, ex = arm(tok, f"{base}/executions?api-version={APP_VER}", timeout=60)
            vv = (ex.get("value") or []) if isinstance(ex, dict) else []
            emit({"step": "capp-exec-poll", "http": st, "n": len(vv),
                  "states": [(v.get("name"), v.get("status")) for v in vv][:5]})
            if vv:
                exname = vv[0].get("name")
                if str(vv[0].get("status")).lower() in ("succeeded", "failed", "stopped"):
                    break
            time.sleep(25)
        if exname:
            for m, u in [
                ("GET", f"{base}/executions/{exname}/containers/gpu/logstream?api-version={APP_VER}"),
                ("POST", f"{base}/executions/{exname}/containers/gpu/logs?api-version={APP_VER}"),
                ("GET", f"{base}/executions/{exname}?api-version={APP_VER}"),
            ]:
                st, lg = arm(tok, u, method=m, timeout=90)
                s = json.dumps(lg) if isinstance(lg, dict) else ""
                content = ""
                if isinstance(lg, dict):
                    content = lg.get("content") or lg.get("raw") or json.dumps(lg)
                emit({"step": "capp-logs", "m": m, "url_tail": u.split("/jobs/")[-1][:90], "http": st,
                      "len": len(str(content)), "has_uuid": bool(re.search(r"GPU-[0-9a-fA-F-]{16,}", s)),
                      "uuid_lines": [l for l in str(content).splitlines() if "GPU-" in l][:5],
                      "tail": str(content)[-1200:] if st in (200, 201) else "",
                      **({} if st in (200, 201) else err_of(st, lg))})
    delete_and_prove(tok, envurl, "capp-env", tries=16)
    st, lst = arm(tok, f"{ARM}/subscriptions/{sid}/providers/Microsoft.App/managedEnvironments?api-version={APP_VER}")
    emit({"step": "capp-absence", "http": st,
          "mine": [e.get("name") for e in ((lst.get("value") or []) if isinstance(lst, dict) else [])
                   if str(e.get("name", "")).lower().startswith(PREFIX)]})
    st, jl = arm(tok, f"{ARM}/subscriptions/{sid}/providers/Microsoft.App/jobs?api-version={APP_VER}")
    emit({"step": "capp-jobs-absence", "http": st,
          "mine": [j.get("name") for j in ((jl.get("value") or []) if isinstance(jl, dict) else [])
                   if str(j.get("name", "")).lower().startswith(PREFIX)]})
    emit({"step": "DONE", "phase": "capp", "elapsed_s": int(time.time() - T0)})


if __name__ == "__main__":
    main()
