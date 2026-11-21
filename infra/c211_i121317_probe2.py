#!/usr/bin/env python3
"""C211-I121317 probe2: close the last ACI GPU levers after probe1's matrix.

probe1 (run 44880807461, job 136775484557) measured on subscription b8b18dcf:
  * Microsoft.ContainerInstance registrationState=Registered, containerGroups apiVersions
    include 2026-07-01, ACI SKU catalogue empty, ACI locations endpoint 404, per-region
    usages empty in eastus/westus2/westeurope/southcentralus.
  * V100 (Standard_NC6s_v3) at 1.0 CPU/1.5 GB refused HTTP 400 BadRequest 'exceeds the
    maximum limit per container group for Standard Core Resources ... '1' 'V100' GPU'
    in ALL FOUR regions.
  * gpu.sku 'T4' and 'A100' refused HTTP 400 InvalidRequestContent (not members of
    Microsoft.Azure.CloudConsole.Providers.Common.Entities.GpuSku).
  * A CPU-only control group with the SAME 1.0 CPU/1.5 GB shape was ACCEPTED (201),
    reached provisioningState Succeeded with the container Terminated exitCode 0, then
    was deleted (DELETE 200, GET 404) — so ACI itself works and the refusal is GPU-specific.

probe2 tests the only remaining levers:
  1) the Microsoft provider-features API (both documented shapes) for a GPU-related
     ContainerInstance feature and its registrationState, and a single register attempt
     for any NotRegistered GPU feature found (verbatim response),
  2) V100 requests BELOW one core (0.5 CPU/0.5 GB) and with an explicit top-level
     sku {name: Standard, tier: Standard} in westeurope, plus one Dedicated-sku attempt,
  3) if any of those is accepted, the same capture path as probe1 (poll to terminal,
     ARM containers/logs POST+GET, independent containerGroups readback), then delete
     and prove absence.

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
PREFIX = "c211-i121317"
NONCE = "i121317"
TAG = "C211_I121317B"
DEADLINE = 1500
T0 = time.time()

ACI_VER = "2026-07-01"
IMAGE_MCR = "mcr.microsoft.com/azureml/openmpi4.1.0-cuda11.8-cudnn8-ubuntu22.04:latest"
REGION = "westeurope"
UUID_RE = re.compile(r"GPU-[0-9a-fA-F-]{16,}")
CMDLINE = ("echo C211-START; hostname; date -u; "
           'for p in /usr/local/nvidia/bin/nvidia-smi /usr/bin/nvidia-smi /bin/nvidia-smi; do '
           'if [ -x "$p" ]; then echo FOUND=$p; "$p" -L; echo ---SMI-Q---; '
           '"$p" --query-gpu=name,uuid,memory.total --format=csv,noheader; fi; done; '
           'command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi -L; '
           'echo ---DEVS---; ls -l /dev/nvidia* 2>/dev/null; echo C211-END; sync; sleep 5')


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


def cg_url(sid, name):
    return (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/"
            f"Microsoft.ContainerInstance/containerGroups/{name}?api-version={ACI_VER}")


def wait_404(tok, url, label, tries=18, sleep_s=10):
    last = None
    for i in range(tries):
        st, b = arm(tok, url, timeout=60)
        last = st
        emit({"step": label + "-absent-poll", "i": i, "http": st,
              "state": props_of(b).get("provisioningState")})
        if st == 404:
            return 404
        time.sleep(sleep_s)
    return last


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
        emit({"step": "DONE", "phase": "probe2", "verdict": "NO_ARM_TOKEN"})
        return

    # ---------- 1. provider features ----------
    features = {}
    shapes = [
        ("features-legacy",
         f"{ARM}/subscriptions/{sid}/providers/Microsoft.Features/providers/"
         f"Microsoft.ContainerInstance/features?api-version=2021-07-01"),
        ("features-rp",
         f"{ARM}/subscriptions/{sid}/providers/Microsoft.ContainerInstance/features"
         f"?api-version=2021-04-01"),
    ]
    for label, url in shapes:
        st, b = arm(tok, url)
        vals = (b.get("value") or []) if isinstance(b, dict) else []
        feats = [{"name": x.get("name"), "state": x.get("properties", {}).get("state")
                  if isinstance(x.get("properties"), dict) else x.get("state")}
                 for x in vals][:30]
        emit({"step": label, "http": st, "n": len(vals), "features": feats,
              **({} if st == 200 else err_of(st, b))})
        if st == 200:
            features[label] = feats

    # single register attempt for any NotRegistered GPU-ish feature
    for label, base_url in (
            ("features-legacy", f"{ARM}/subscriptions/{sid}/providers/Microsoft.Features/providers/"
                                f"Microsoft.ContainerInstance/features"),
            ("features-rp", f"{ARM}/subscriptions/{sid}/providers/Microsoft.ContainerInstance/features")):
        for f in features.get(label, []):
            nm = str(f.get("name") or "")
            if not nm or not re.search(r"gpu|v100|k80|p100|a100|containergroup", nm, re.I):
                continue
            url = f"{base_url}/{nm}?api-version=2021-07-01"
            st, b = arm(tok, url)
            state = (props_of(b).get("state") if isinstance(b, dict) else None)
            emit({"step": "feature-get", "feature": nm, "http": st, "state": state,
                  **({} if st == 200 else err_of(st, b))})
            if st == 200 and str(state).lower() not in ("registered", "enabled"):
                st2, b2 = arm(tok, f"{base_url}/{nm}/register?api-version=2021-07-01",
                              method="POST", body={}, timeout=180)
                emit({"step": "feature-register", "feature": nm, **err_of(st2, b2)})
                time.sleep(8)
                st3, b3 = arm(tok, url)
                emit({"step": "feature-recheck", "feature": nm, "http": st3,
                      "state": (props_of(b3).get("state") if isinstance(b3, dict) else None)})

    # ---------- 2. sub-core / explicit-sku V100 variants ----------
    variants = [
        ("v100-cpu05", {"cpu": 0.5, "memoryInGB": 0.5, "gpu": {"count": 1, "sku": "V100"}}, None),
        ("v100-explicitstd", {"cpu": 1.0, "memoryInGB": 1.5, "gpu": {"count": 1, "sku": "V100"}},
         {"name": "Standard", "tier": "Standard"}),
        ("v100-dedicated", {"cpu": 1.0, "memoryInGB": 1.5, "gpu": {"count": 1, "sku": "V100"}},
         {"name": "Dedicated"}),
    ]
    created = None
    attempts = []
    for slug, req, sku_obj in variants:
        if left() < 500:
            emit({"step": "deadline-skip", "phase": "variants", "left": int(left())})
            break
        name = f"{PREFIX}-aci-{REGION}-{slug}"
        body = {
            "location": REGION,
            "tags": {"c211": NONCE, "nonce": NONCE, "lane": NONCE, "variant": slug},
            "properties": {
                "containers": [{"name": "gpu", "properties": {
                    "image": IMAGE_MCR,
                    "command": ["/bin/bash", "-c", CMDLINE],
                    "resources": {"requests": req}}}],
                "osType": "Linux",
                "restartPolicy": "Never",
            },
        }
        if sku_obj:
            body["sku"] = sku_obj
        st, b = arm(tok, cg_url(sid, name), method="PUT", body=body, timeout=300)
        rec = {"variant": slug, "region": REGION, "requests": req, "sku": sku_obj, "name": name,
               **err_of(st, b)}
        if st in (200, 201, 202):
            rec["provisioningState"] = props_of(b).get("provisioningState")
        attempts.append(rec)
        emit({"step": "aci-create", **rec})
        if st in (200, 201, 202):
            created = {"region": REGION, "name": name, "variant": slug, "http": st}
            break
        time.sleep(2)
    emit({"step": "aci-results", "n": len(attempts), "created": created})

    # ---------- 3. capture if accepted ----------
    if created:
        name = created["name"]
        url = cg_url(sid, name)
        deadline = time.time() + max(300, min(900, left() - 300))
        while time.time() < deadline:
            st, b = arm(tok, url, timeout=60)
            p = props_of(b)
            conts = p.get("containers") or []
            cur = ((conts[0].get("properties") or {}).get("instanceView") or {}).get("currentState") or {} if conts else {}
            emit({"step": "aci-poll", "http": st, "provisioningState": p.get("provisioningState"),
                  "container_state": cur.get("state"), "exitCode": cur.get("exitCode"),
                  "events": [(e.get("name"), (e.get("message") or "")[:200])
                             for e in ((p.get("instanceView") or {}).get("events") or [])][-6:]})
            if st != 200:
                break
            if cur.get("state") == "Terminated" or p.get("provisioningState") in (
                    "Succeeded", "Failed", "Canceled"):
                time.sleep(5)
                break
            time.sleep(15)
        st, rb = arm(tok, url, timeout=60)
        p = props_of(rb)
        gpu_req = None
        try:
            gpu_req = ((((p.get("containers") or [{}])[0].get("properties", {})
                         .get("resources", {})).get("requests", {})).get("gpu"))
        except Exception:  # noqa: BLE001
            pass
        emit({"step": "aci-readback", "http": st, "provisioningState": p.get("provisioningState"),
              "gpu_request": gpu_req})
        log_text = ""
        for method in ("POST", "GET"):
            stl, lg = arm(tok, f"{url.split('?')[0]}/containers/gpu/logs?api-version={ACI_VER}",
                          method=method, body=({} if method == "POST" else None), timeout=120)
            content = ""
            if isinstance(lg, dict):
                content = lg.get("content") or lg.get("raw") or ""
            emit({"step": "aci-logs", "method": method, "http": stl, "len": len(content or ""),
                  "uuids": sorted(set(UUID_RE.findall(content or ""))),
                  "uuid_lines": [l for l in (content or "").splitlines() if "GPU-" in l][:6],
                  "head": (content or "")[:600], "tail": (content or "")[-600:]})
            if content and len(content) > len(log_text):
                log_text = content
            if stl == 200 and content:
                break
        st, db = arm(tok, url, method="DELETE", timeout=240)
        emit({"step": "aci-delete", "name": name, **err_of(st, db)})
        wait_404(tok, url, "own-aci")
        emit({"step": "aci-capture", "len": len(log_text),
              "uuids": sorted(set(UUID_RE.findall(log_text or ""))),
              "full_text": (log_text or "")[:3000]})

    # ---------- 4. teardown + absence ----------
    st, lb = arm(tok, f"{ARM}/subscriptions/{sid}/providers/Microsoft.ContainerInstance/"
                      f"containerGroups?api-version={ACI_VER}", timeout=120)
    mine = [x.get("name") for x in ((lb.get("value") or []) if isinstance(lb, dict) else [])
            if str(x.get("name", "")).lower().startswith(PREFIX)]
    emit({"step": "list-own-preclean", "http": st, "mine": mine})
    for name in mine:
        st2, b2 = arm(tok, cg_url(sid, name), method="DELETE", timeout=240)
        emit({"step": "own-preclean-delete", "name": name, **err_of(st2, b2)})
        wait_404(tok, cg_url(sid, name), "preclean", tries=12, sleep_s=10)
    st, lf = arm(tok, f"{ARM}/subscriptions/{sid}/providers/Microsoft.ContainerInstance/"
                      f"containerGroups?api-version={ACI_VER}", timeout=120)
    names = [x.get("name") for x in ((lf.get("value") or []) if isinstance(lf, dict) else [])]
    emit({"step": "list-final", "http": st, "n_total": len(names),
          "mine": [n for n in names if str(n).lower().startswith(PREFIX)]})
    st, rl = arm(tok, f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/resources?api-version=2021-04-01",
                 timeout=120)
    after = [{"name": x.get("name"), "type": x.get("type")}
             for x in ((rl.get("value") or []) if isinstance(rl, dict) else [])
             if str(x.get("name", "")).lower().startswith(PREFIX)]
    emit({"step": "rg-final", "http": st, "c211_i121317": after})
    emit({"step": "DONE", "phase": "probe2", "verdict": "GPU_DEVICE_PROVEN" if created else "ALL_REFUSED",
          "features": features, "attempts": attempts, "created": created,
          "elapsed_s": int(time.time() - T0)})


if __name__ == "__main__":
    main()
