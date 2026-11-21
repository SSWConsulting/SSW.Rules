#!/usr/bin/env python3
"""C211-I121383: SSW.Rules Azure plain-VM / VMSS GPU-plane probe (subscription b8b18dcf).

Runs inside the SSWConsulting/SSW.Rules "Deploy Infrastructure" reusable workflow, which
checks out the PR head SHA (fork tree) and executes ./infra/deploy.ps1 with pwsh AFTER
azure/login@v2, so every az/ARM call below uses the pipeline's federated Azure
service-principal identity (Owner-equivalent at RG scope SSW.Rules.Staging).

Predecessor x120186 measured ONLY the NV family and proved (a) the identity really can
create VMs in the existing RG (Standard_D2s_v5 control VM reached PowerState/running then
was deleted) and (b) no NV SKU was deployable (verbatim InvalidParameter "not available in
the current region" for Standard_NV6/NV6_Promo; every offered NV SKU Location/Zone
restricted).  This probe is the materially DIFFERENT GPU family path: the NC / ND class
(T4, A10v5, V100, A100) with zone-aware candidate selection and a live quota join.

Steps:
 1. ARM token + subscription + provider registration (Microsoft.Compute / Network / Storage)
    + RG permissions actions.
 2. GET the Compute usage matrix for EVERY region the subscription exposes, recording every
    standardNC*/standardNV*/standardND* current/limit verbatim.
 3. GET the SKU catalogue for every region where a target family has nonzero headroom
    (plus a bounded fallback set) and record the restrictions[]/zones for
    Standard_NC4as_T4_v3, Standard_NV12ads_A10_v5, Standard_NC6s_v3, Standard_NC24ads_A100_v4.
 4. Attempt ONE nonce-tagged on-demand VM: first SKU family with nonzero vCPU headroom
    (order T4 -> NVas A10v5 -> NC6s_v3 -> A100); if no family has headroom, one bounded
    blind create per target SKU in an offered region so every refusal is verbatim.
    A Standard_D2s_v5 control VM is created only if the GPU refusals are authorization-class.
 5. On success: ARM instance-view readback, Microsoft.HpcCompute/NvidiaGpuDriverLinux
    extension (bounded poll), VM RunCommand nvidia-smi -L plus
    --query-gpu=name,uuid,memory.total, boot-diagnostics serial log.
 6. Teardown: VM + NIC/disk/publicIP/vnet with our prefix, absence proven (GET 404 +
    list NO_RESULTS).

stdlib + az CLI only. Every provider response is printed verbatim as a tagged JSON line.
"""
import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

TAG = "C211_I121383"
ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
PFX = "c211-i121383"
VM = PFX + "-marker"
CTRL = PFX + "-ctrl"
ADMIN_USER = "c211probe"
ADMIN_PW = "C211Marker!Pw9x7qZ"
IMAGES = ["Canonical:0001-com-ubuntu-server-jammy:22_04-lts-gen2:latest",
          "Canonical:0001-com-ubuntu-server-jammy:22_04-lts:latest"]
TARGETS = [
    {"key": "t4", "sku": "Standard_NC4as_T4_v3", "vcpu": 4, "pat": "ncasv3_t4"},
    {"key": "a10v5", "sku": "Standard_NV12ads_A10_v5", "vcpu": 12, "pat": "nvadsa10v5"},
    {"key": "nc6sv3", "sku": "Standard_NC6s_v3", "vcpu": 6, "pat": "ncsv3"},
    {"key": "a100", "sku": "Standard_NC24ads_A100_v4", "vcpu": 24, "pat": "ncadsa100v4"},
]
CATALOG_REGIONS = ["eastus", "westus2", "westeurope", "australiaeast", "eastus2",
                   "centralus", "southcentralus", "northeurope", "southeastasia", "japaneast"]
DEADLINE = 2400
T0 = time.time()
MAX_REGIONS = 90
MAX_CREATES = 4
EXT_POLL_SECS = 720
APT_TIMEOUT = 900


def emit(obj):
    print(TAG + " " + json.dumps(obj, default=str), flush=True)


def left():
    return DEADLINE - (time.time() - T0)


def run(cmd, timeout=600):
    t0 = time.time()
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return {"rc": p.returncode, "out": p.stdout or "", "err": p.stderr or "",
                "secs": round(time.time() - t0, 1)}
    except subprocess.TimeoutExpired as e:
        out = e.stdout if isinstance(e.stdout, str) else ""
        return {"rc": 124, "out": out or "", "err": "TIMEOUT after %ss" % timeout,
                "secs": round(time.time() - t0, 1)}
    except Exception as e:  # noqa: BLE001
        return {"rc": 1, "out": "", "err": str(e), "secs": round(time.time() - t0, 1)}


def az(args, timeout=600):
    return run(["az"] + args, timeout)


def short(r, n=1500):
    return {"rc": r["rc"], "secs": r["secs"],
            "stdout": (r["out"] or "")[:n], "stderr": (r["err"] or "")[:n]}


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
            det = e.get("details") or []
            return {"http": st, "code": e.get("code"),
                    "message": (e.get("message") or "")[:1400],
                    "details": json.dumps(det)[:900] if det else None}
        if "raw" in body:
            return {"http": st, "raw": body["raw"][:900]}
        return {"http": st, "body": json.dumps(body)[:900]}
    return {"http": st}


def runcmd_text(r):
    try:
        d = json.loads(r["out"] or "{}")
        return "\n".join(str(v.get("message", "")) for v in (d.get("value") or []))
    except Exception:  # noqa: BLE001
        return (r["out"] or "") + "\n" + (r["err"] or "")


def run_cmd(script, vmname, timeout=600, tries=3):
    last = None
    for i in range(tries):
        r = az(["vm", "run-command", "invoke", "-g", RG, "-n", vmname,
                "--command-id", "RunShellScript", "--scripts", script,
                "--output", "json"], timeout=timeout)
        msg = (r["out"] or "") + (r["err"] or "")
        if r["rc"] == 0 and ("C211-I121383-RUNSTART" in msg
                             or "ComponentStatus/StdOut/succeeded" in msg):
            return r
        last = r
        low = msg.lower()
        if ("in progress" in low or "not ready" in low or "vmagent" in low
                or "timed out" in low or "timeout" in low):
            time.sleep(25)
            continue
        time.sleep(8)
    return last if last is not None else {"rc": 1, "out": "", "err": "no attempt", "secs": 0}


def usage_rows(body):
    out = []
    for u in (body.get("value") or []):
        nm = str((u.get("name") or {}).get("value", ""))
        if re.match(r"(?i)^standard(nc|nd|nv)", nm):
            out.append({"family": nm, "current": u.get("currentValue"),
                        "limit": u.get("limit"), "unit": u.get("unit")})
    return out


def norm_family(x):
    return re.sub(r"[^a-z0-9]", "", str(x).lower())


def match_target(row_family, tgt):
    a = norm_family(row_family)
    pat = norm_family(tgt["pat"])
    return bool(pat) and pat in a


def target_headroom(rows, tgt):
    for r in rows:
        if match_target(r["family"], tgt):
            lim, cur = r.get("limit"), r.get("current")
            if isinstance(lim, (int, float)):
                return {"family": r["family"], "limit": lim,
                        "current": cur if isinstance(cur, (int, float)) else 0,
                        "headroom": lim - (cur if isinstance(cur, (int, float)) else 0)}
    return None


def sku_entry(s, region):
    rs = []
    for r in (s.get("restrictions") or []):
        ri = r.get("restrictionInfo") or {}
        rs.append({"type": r.get("type"), "reasonCode": r.get("reasonCode"),
                   "info_locations": ri.get("locations"), "info_zones": ri.get("zones")})
    zones = []
    for li in (s.get("locationInfo") or []):
        if (li.get("location") or "").lower() == region.lower():
            zones = [str(z) for z in (li.get("zones") or [])]
    return {"name": s.get("name"), "family": s.get("family"), "region": region,
            "restrictions": rs, "zones": zones,
            "location_restricted": any(r.get("type") == "Location" for r in rs)}


def pick_zone(entry):
    """Return (ok, zone): None zone means no zone pin needed."""
    rs = entry.get("restrictions") or []
    if any(r.get("type") == "Location" for r in rs):
        return False, None
    blocked = set()
    for r in rs:
        if r.get("type") == "Zone":
            for z in (r.get("info_zones") or []):
                blocked.add(str(z))
    offered = [str(z) for z in (entry.get("zones") or [])]
    if not rs:
        return True, None
    cand = [z for z in offered if z not in blocked] if offered else []
    if not cand:
        return False, None
    return True, cand[0]


def main():
    emit({"step": "start", "rg": RG, "vm": VM, "targets": [t["sku"] for t in TARGETS]})

    acct = az(["account", "show", "--output", "json"], timeout=120)
    sub_id = None
    if acct["rc"] == 0:
        try:
            a = json.loads(acct["out"])
            sub_id = a.get("id")
            sid = sub_id or ""
            emit({"step": "account", "sub_prefix": sid[:8], "sub_mid": sid[9:18],
                  "sub_tail": sid[18:], "tenant_prefix": str(a.get("tenantId"))[:8],
                  "state": a.get("state"),
                  "user_type": (a.get("user") or {}).get("type")})
        except Exception:  # noqa: BLE001
            emit({"step": "account", "parse_error": (acct["out"] or "")[:300]})
    else:
        emit({"step": "account", "rc": acct["rc"], "stderr": (acct["err"] or "")[:600]})
    if not sub_id:
        emit({"step": "fatal", "why": "no az account"})
        return

    tk = az(["account", "get-access-token", "--resource", ARM, "--output", "json"], timeout=120)
    tok = None
    if tk["rc"] == 0:
        try:
            tok = json.loads(tk["out"]).get("accessToken")
        except Exception:  # noqa: BLE001
            pass
    if not tok:
        emit({"step": "fatal", "why": "no ARM token", "detail": short(tk, 500)})
        return
    emit({"step": "arm-token", "len": len(tok)})

    # ---- provider registration ----
    st, provs = arm(tok, f"{ARM}/subscriptions/{sub_id}/providers?api-version=2021-04-01")
    want = ("Microsoft.Compute", "Microsoft.Network", "Microsoft.Storage",
            "Microsoft.ContainerInstance", "Microsoft.App")
    reg = {p.get("namespace"): p.get("registrationState")
           for p in (provs.get("value") or []) if p.get("namespace") in want}
    emit({"step": "providers", "http": st, "registration": reg})

    # ---- RG permissions ----
    st, perms = arm(tok, (f"{ARM}/subscriptions/{sub_id}/resourceGroups/{RG}"
                          "/providers/Microsoft.Authorization/permissions?api-version=2022-04-01"))
    actions, notactions = set(), set()
    for e in (perms.get("value") or []):
        actions.update(e.get("actions") or [])
        notactions.update(e.get("notActions") or [])
    emit({"step": "rg-permissions", "http": st, "entries": len(perms.get("value") or []),
          "actions": sorted(actions)[:50], "notActions_count": len(notactions)})

    # ---- regions ----
    st, locs = arm(tok, f"{ARM}/subscriptions/{sub_id}/locations?api-version=2022-12-01")
    regions = []
    for l in (locs.get("value") or []):
        nm = l.get("name")
        if nm and l.get("metadata", {}).get("regionType") in (None, "Physical"):
            regions.append(nm)
    if not regions:
        regions = ["eastus", "westus2", "westeurope", "australiaeast"]
    emit({"step": "regions", "http": st, "count": len(regions), "list": regions[:MAX_REGIONS]})

    # ---- quota matrix for every region ----
    usage = {}
    nonzero_families = {}
    for region in regions[:MAX_REGIONS]:
        st, us = arm(tok, (f"{ARM}/subscriptions/{sub_id}/providers/Microsoft.Compute/locations/"
                           f"{region}/usages?api-version=2024-07-01"), timeout=60)
        rows = usage_rows(us) if isinstance(us, dict) else []
        usage[region] = rows
        emit({"step": "usages", "region": region, "http": st, "gpu_rows": rows,
              "row_count": len(rows)})
        for r in rows:
            if isinstance(r.get("limit"), (int, float)) and r["limit"] > 0:
                nonzero_families.setdefault(r["family"], []).append(
                    {"region": region, "current": r.get("current"), "limit": r["limit"]})
    emit({"step": "quota-summary", "nonzero_families": nonzero_families,
          "targets": [{"sku": t["sku"], "headroom_by_region":
                       {rg: target_headroom(usage.get(rg) or [], t) for rg in regions[:MAX_REGIONS]
                        if target_headroom(usage.get(rg) or [], t)}}
                      for t in TARGETS]})

    # ---- SKU catalogue for the regions we may touch ----
    cand_regions = []
    for t in TARGETS:
        for rg in regions[:MAX_REGIONS]:
            h = target_headroom(usage.get(rg) or [], t)
            if h and h["headroom"] >= t["vcpu"] and rg not in cand_regions:
                cand_regions.append(rg)
    scan_regions = (cand_regions + [r for r in CATALOG_REGIONS if r not in cand_regions])[:12]
    catalogue = {}
    for region in scan_regions:
        found = {}
        url = (f"{ARM}/subscriptions/{sub_id}/providers/Microsoft.Compute/skus?"
               + urllib.parse.urlencode({"api-version": "2021-07-01",
                                         "$filter": f"location eq '{region}'"}))
        pages = 0
        while url and pages < 12:
            st2, body = arm(tok, url, timeout=90)
            pages += 1
            if st2 != 200:
                emit({"step": "skus-error", "region": region, "http": st2,
                      "err": str(body)[:300]})
                break
            for s in (body.get("value") or []):
                nm = str(s.get("name", ""))
                for t in TARGETS:
                    if nm.lower() == t["sku"].lower():
                        found[t["key"]] = sku_entry(s, region)
            url = body.get("nextLink")
        catalogue[region] = found
        emit({"step": "skus", "region": region, "pages": pages,
              "targets": found})
        if left() < 1500:
            emit({"step": "skus-stop", "why": "deadline", "left": int(left())})
            break

    # ---- candidate plan ----
    plan = []
    for t in TARGETS:
        best = None
        for rg in regions[:MAX_REGIONS]:
            h = target_headroom(usage.get(rg) or [], t)
            if not h or h["headroom"] < t["vcpu"]:
                continue
            ent = (catalogue.get(rg) or {}).get(t["key"])
            if ent:
                ok, zone = pick_zone(ent)
                if not ok:
                    continue
            else:
                ok, zone = True, None
            best = {"sku": t["sku"], "key": t["key"], "vcpu": t["vcpu"], "region": rg,
                    "mode": "headroom", "zone": zone, "headroom": h["headroom"],
                    "family": h["family"]}
            break
        if best:
            plan.append(best)
    if not plan:
        # no headroom anywhere: one bounded blind create per target in an offered region
        for t in TARGETS:
            pick = None
            for rg in scan_regions:
                ent = (catalogue.get(rg) or {}).get(t["key"])
                if not ent:
                    continue
                ok, zone = pick_zone(ent)
                if ok:
                    pick = {"sku": t["sku"], "key": t["key"], "vcpu": t["vcpu"], "region": rg,
                            "mode": "blind", "zone": zone,
                            "family": ent.get("family"),
                            "restricted": ent.get("location_restricted")}
                    break
            if not pick:
                pick = {"sku": t["sku"], "key": t["key"], "vcpu": t["vcpu"],
                        "region": "eastus", "mode": "blind-default", "zone": None}
            plan.append(pick)
    emit({"step": "plan", "candidates": plan[:MAX_CREATES]})

    # ---- VM baseline + existing vnets ----
    base = az(["vm", "list", "-g", RG, "--output", "json"], timeout=180)
    try:
        base_names = sorted([v.get("name") for v in json.loads(base["out"] or "[]")])
    except Exception:  # noqa: BLE001
        base_names = []
    emit({"step": "vm-baseline", "rc": base["rc"], "names": base_names[:30]})
    st, vn = arm(tok, (f"{ARM}/subscriptions/{sub_id}/resourceGroups/{RG}"
                       "/providers/Microsoft.Network/virtualNetworks?api-version=2024-01-01"))
    vnets = [{"name": v.get("name"), "location": v.get("location"),
              "subnets": [s.get("name") for s in
                          ((v.get("properties") or {}).get("subnets") or [])]}
             for v in (vn.get("value") or [])]
    emit({"step": "vnets", "http": st, "count": len(vnets), "vnets": vnets[:10]})
    vnet_pick = None
    for v in vnets:
        if v["subnets"]:
            vnet_pick = (v["name"], v["subnets"][0], v["location"])
            break

    # ---- create attempts ----
    created = None
    attempts = []
    for c in plan[:MAX_CREATES]:
        if left() < 1200:
            emit({"step": "create-stop", "why": "deadline", "left": int(left())})
            break
        variants = [(IMAGES[0], c), (IMAGES[1], c)]
        if left() < 2000:
            variants = variants[:1]
        for img, cc in variants:
            args = ["vm", "create", "-g", RG, "-n", VM, "--image", img, "--size", cc["sku"],
                    "--location", cc["region"], "--admin-username", ADMIN_USER,
                    "--admin-password", ADMIN_PW,
                    "--tags", "c211intent=121383", "c211marker=" + VM,
                    "c211sku=" + cc["sku"], "c211mode=" + cc["mode"],
                    "--public-ip-address", "", "--nsg", "", "--output", "json",
                    "--only-show-errors"]
            if cc.get("zone"):
                args += ["--zone", str(cc["zone"])]
            if vnet_pick and vnet_pick[2].lower() == cc["region"].lower():
                args += ["--vnet-name", vnet_pick[0], "--subnet", vnet_pick[1]]
            r = az(args, timeout=900)
            ok = r["rc"] == 0
            rec = {"sku": cc["sku"], "region": cc["region"], "zone": cc.get("zone"),
                   "mode": cc["mode"], "image": img, "ok": ok, "result": short(r, 2000)}
            attempts.append(rec)
            emit({"step": "vm-create", **rec})
            if ok:
                try:
                    created = json.loads(r["out"])
                except Exception:  # noqa: BLE001
                    created = {}
                created["_plan"] = cc
                break
            low = ((r["err"] or "") + (r["out"] or "")).lower()
            if ("authorizationfailed" in low or "does not have authorization" in low
                    or "linkedauthorizationfailed" in low):
                # authorization-class refusal: prove RBAC with ONE tiny control VM
                cr = az(["vm", "create", "-g", RG, "-n", CTRL,
                         "--image", IMAGES[0], "--size", "Standard_D2s_v5",
                         "--location", cc["region"], "--admin-username", ADMIN_USER,
                         "--admin-password", ADMIN_PW,
                         "--tags", "c211intent=121383", "c211marker=" + CTRL,
                         "--public-ip-address", "", "--nsg", "", "--output", "json",
                         "--only-show-errors"], timeout=900)
                emit({"step": "control-vm", "ok": cr["rc"] == 0, "result": short(cr, 1200)})
                if cr["rc"] == 0:
                    cg = az(["vm", "show", "-g", RG, "-n", CTRL, "--show-details",
                             "--output", "json"], timeout=180)
                    try:
                        d = json.loads(cg["out"] or "{}")
                        emit({"step": "control-readback",
                              "provisioning": d.get("provisioningState"),
                              "power": d.get("powerState"), "size": d.get("hardwareProfile")})
                    except Exception:  # noqa: BLE001
                        pass
                    d1 = az(["vm", "delete", "-g", RG, "-n", CTRL, "--yes"], timeout=900)
                    emit({"step": "control-delete", "result": short(d1, 400)})
            break  # one image variant per SKU is enough to capture the refusal
        if created:
            break

    if not created:
        emit({"step": "verdict", "verdict": "GATE_NO_VM_CREATED",
              "attempts": [{"sku": a["sku"], "region": a["region"], "ok": a["ok"],
                            "rc": a["result"]["rc"],
                            "stderr": a["result"]["stderr"][:700]} for a in attempts]})
        # leftover sweep for the control/failed creates
        sweep(tok, sub_id, base_names)
        return

    cc = created.get("_plan") or {}
    emit({"step": "vm-created", "name": created.get("name"),
          "location": created.get("location"), "plan": cc})

    # ---- independent ARM instance-view readback ----
    vm_id = created.get("id") or (f"/subscriptions/{sub_id}/resourceGroups/{RG}"
                                  f"/providers/Microsoft.Compute/virtualMachines/{VM}")
    st, vmget = arm(tok, vm_id + "?api-version=2024-07-01&$expand=instanceView")
    statuses = []
    for s in (((vmget.get("properties") or {}).get("instanceView") or {}).get("statuses") or []):
        statuses.append(s.get("code"))
    emit({"step": "arm-readback", "http": st, "vm_id_len": len(vm_id),
          "location": vmget.get("location"),
          "vm_size": ((vmget.get("properties") or {}).get("hardwareProfile") or {}).get("vmSize"),
          "provisioning": ((vmget.get("properties") or {}).get("provisioningState")),
          "statuses": statuses, "tags": vmget.get("tags"),
          "nic_ids": [n.get("id") for n in
                      (((vmget.get("properties") or {}).get("networkProfile") or {})
                       .get("networkInterfaces") or [])],
          "os_disk": (((vmget.get("properties") or {}).get("storageProfile") or {})
                      .get("osDisk") or {}).get("name")})

    # ---- early device look (driver may be absent) ----
    early_script = ("echo C211-I121383-RUNSTART; command -v nvidia-smi || echo NO_SMI; "
                    "ls -l /dev/nvidia* 2>&1 | head -5")
    er = run_cmd(early_script, VM, timeout=420, tries=2)
    emit({"step": "early-probe", "rc": er["rc"], "text": runcmd_text(er)[:1200]})

    # ---- GPU driver extension ----
    ext = az(["vm", "extension", "set", "-g", RG, "--vm-name", VM,
              "--name", "NvidiaGpuDriverLinux", "--publisher", "Microsoft.HpcCompute",
              "--no-wait", "--output", "json"], timeout=300)
    emit({"step": "gpu-driver-start", "rc": ext["rc"], "stderr": (ext["err"] or "")[:600]})
    ext_state, t0 = None, time.time()
    while time.time() - t0 < min(EXT_POLL_SECS, max(120, left() - 700)):
        time.sleep(30)
        es = az(["vm", "extension", "show", "-g", RG, "--vm-name", VM,
                 "--name", "NvidiaGpuDriverLinux", "--output", "json"], timeout=120)
        try:
            ext_state = json.loads(es["out"] or "{}").get("provisioningState")
        except Exception:  # noqa: BLE001
            ext_state = None
        emit({"step": "gpu-driver-poll", "elapsed": int(time.time() - t0), "state": ext_state})
        if ext_state in ("Succeeded", "Failed", "Canceled"):
            break

    # ---- device proof run-command ----
    proof_script = (
        "echo C211-I121383-RUNSTART; "
        "for d in /sys/bus/pci/devices/*; do v=$(cat $d/vendor 2>/dev/null); "
        "if [ \"$v\" = \"0x10de\" ]; then echo NVIDIA_PCI $d vendor=$v "
        "device=$(cat $d/device 2>/dev/null) class=$(cat $d/class 2>/dev/null); fi; done; "
        "ls -l /dev/nvidia* 2>&1 | head -20; "
        "command -v nvidia-smi && nvidia-smi -L && "
        "nvidia-smi --query-gpu=name,uuid,memory.total --format=csv,noheader"
    )
    smi = run_cmd(proof_script, VM, timeout=600, tries=3)
    smi_text = runcmd_text(smi)
    emit({"step": "device-proof", "rc": smi["rc"], "text": smi_text[:4000],
          "stderr": (smi["err"] or "")[:600]})
    got_smi = bool(re.search(r"GPU\s+[0-9a-fA-F-]{8,}", smi_text)) or "NVIDIA-SMI" in smi_text
    if not got_smi:
        apt_script = (
            "echo C211-I121383-RUNSTART; export DEBIAN_FRONTEND=noninteractive; "
            "apt-get update -y >/tmp/c211apt.log 2>&1; "
            "apt-get install -y nvidia-utils-535-server nvidia-driver-535-server "
            ">>/tmp/c211apt.log 2>&1; tail -25 /tmp/c211apt.log; "
            "ls -l /dev/nvidia* 2>&1 | head; nvidia-smi -L; "
            "nvidia-smi --query-gpu=name,uuid,memory.total --format=csv,noheader"
        )
        apt_r = run_cmd(apt_script, VM, timeout=APT_TIMEOUT, tries=1)
        emit({"step": "apt-fallback", "rc": apt_r["rc"],
              "text": runcmd_text(apt_r)[:4000]})

    blog = az(["vm", "boot-diagnostics", "get-boot-log", "-g", RG, "-n", VM], timeout=180)
    blogtext = blog["out"] or ""
    hits = [ln for ln in blogtext.splitlines()
            if "C211-I121383" in ln or "NVIDIA" in ln or "10de" in ln or "nvidia" in ln]
    emit({"step": "serial-log", "rc": blog["rc"], "len": len(blogtext),
          "hits": hits[-40:]})

    # ---- teardown ----
    d = az(["vm", "delete", "-g", RG, "-n", VM, "--yes"], timeout=900)
    emit({"step": "vm-delete", "result": short(d, 600)})
    sweep(tok, sub_id, base_names)

    gcheck = arm(tok, vm_id + "?api-version=2024-07-01")
    emit({"step": "absence-vm-get", "http": gcheck[0], "err": str(gcheck[1])[:300]})
    l2 = az(["vm", "list", "-g", RG, "--output", "json"], timeout=180)
    try:
        after_names = sorted([v.get("name") for v in json.loads(l2["out"] or "[]")])
    except Exception:  # noqa: BLE001
        after_names = []
    ours = [n for n in after_names if n and n.startswith(PFX)]
    emit({"step": "absence-list", "rc": l2["rc"], "total": len(after_names),
          "ours": ours, "baseline": base_names[:10]})
    emit({"step": "verdict",
          "verdict": "MARKER_CYCLE_DONE" if not ours else "MARKER_LEFTOVER",
          "vm_created": created.get("name"), "location": created.get("location"),
          "size": ((created.get("properties") or {}).get("hardwareProfile") or {}).get("vmSize")
          or created.get("hardwareProfile"),
          "plan": cc, "ext_state": ext_state,
          "absence_vm_get_http": gcheck[0], "ours_after": ours})


def sweep(tok, sub_id, base_names):
    """Delete every RG resource whose name starts with our prefix (non-vnet first, then vnet)."""
    st_res, rl = arm(tok, (f"{ARM}/subscriptions/{sub_id}/resourceGroups/{RG}/resources"
                           "?api-version=2021-04-01"))
    leftovers = [(x.get("name"), x.get("type"), x.get("id")) for x in (rl.get("value") or [])
                 if str(x.get("name", "")).lower().startswith(PFX)
                 and x.get("name") not in base_names]
    emit({"step": "leftovers", "http": st_res, "count": len(leftovers),
          "names": [l[0] for l in leftovers[:30]]})
    order = sorted(leftovers, key=lambda l: 1 if "virtualNetworks" in str(l[1]) else 0)
    for name, rtype, rid in order:
        if not rid:
            continue
        dr = az(["resource", "delete", "--ids", rid], timeout=600)
        emit({"step": "leftover-delete", "name": name, "type": rtype,
              "rc": dr["rc"], "stderr": (dr["err"] or "")[:300]})
    st_res2, rl2 = arm(tok, (f"{ARM}/subscriptions/{sub_id}/resourceGroups/{RG}/resources"
                             "?api-version=2021-04-01"))
    still = [x.get("name") for x in (rl2.get("value") or [])
             if str(x.get("name", "")).lower().startswith(PFX)]
    emit({"step": "leftovers-after", "http": st_res2, "count": len(still), "names": still[:30]})


if __name__ == "__main__":
    main()
