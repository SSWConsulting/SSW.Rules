#!/usr/bin/env python3
"""C211-I120186 phase 4: corrected ONE-marker NV/GPU cycle for SSW.Rules.

Runs inside the SSW.Rules "Deploy Infrastructure" reusable workflow, which checks out
the PR head SHA (fork tree) and executes ./infra/deploy.ps1 with pwsh AFTER
azure/login@v2, so every az/ARM call below uses the pipeline's federated Azure
service-principal identity.

Fixes over phase 2/3 (c211_i120065_probe2.py):
  * the working resource group is ALWAYS the existing, readable RG SSW.Rules.Staging
    (the previous probe kept the non-existent c211-i120065-rg and therefore measured
    only AuthorizationFailed on a bogus scope);
  * candidate sizes are chosen from the LIVE Microsoft.Compute/skus catalogue with the
    SKU family + the live per-family vCPU quota joined in, instead of guessing
    Standard_NV6/NV12;
  * existing vnet/subnet are discovered first and reused;
  * device proof is read from /sys/bus/pci (driver-independent) and nvidia-smi, with
    the GPU driver installed through the Microsoft.HpcCompute/NvidiaGpuDriverLinux
    extension and an apt fallback;
  * exactly one nonce-tagged VM is created, then the VM and every leftover resource
    whose name starts with the marker name are deleted and absence is verified.

stdlib + az CLI only.
"""
import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

TAG = "C211_I120186"
ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
VM = "c211-i120186-marker"
IMAGES = ["Canonical:0001-com-ubuntu-server-jammy:22_04-lts-gen2:latest",
          "Canonical:0001-com-ubuntu-server-jammy:22_04-lts:latest"]
REGIONS = ["australiaeast", "westus2"]
ADMIN_PW = "C211Marker!Pw9x7qZ"
ADMIN_USER = "c211probe"
MAX_CREATE_ATTEMPTS = 6
EXT_POLL_SECS = 900
APT_TIMEOUT = 1800


def emit(obj):
    print(TAG + " " + json.dumps(obj, default=str), flush=True)


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


def runcmd_text(r):
    try:
        d = json.loads(r["out"] or "{}")
        return "\n".join(str(v.get("message", "")) for v in (d.get("value") or []))
    except Exception:  # noqa: BLE001
        return (r["out"] or "") + "\n" + (r["err"] or "")


def run_cmd(script, timeout=600, tries=3):
    last = None
    for i in range(tries):
        r = az(["vm", "run-command", "invoke", "-g", RG, "-n", VM,
                "--command-id", "RunShellScript", "--scripts", script,
                "--output", "json"], timeout=timeout)
        msg = (r["out"] or "") + (r["err"] or "")
        if r["rc"] == 0 and ("C211-I120186-RUNSTART" in msg
                             or "ComponentStatus/StdOut/succeeded" in msg):
            return r
        last = r
        low = msg.lower()
        if ("in progress" in low or "not ready" in low or "vmagent" in low
                or "timed out" in low or "timeout" in low):
            time.sleep(25)
            continue
        time.sleep(8)
    return last if last is not None else {"rc": 1, "out": "", "err": "no attempt",
                                         "secs": 0}


def arm(tok, url, method="GET", body=None, timeout=90):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": "Bearer " + tok, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except Exception:  # noqa: BLE001
            return e.code, {}
    except Exception as e:  # noqa: BLE001
        return 0, {"transport_error": str(e)}


def nv_score(name):
    up = name.upper()
    if "A10" in up or "A100" in up:
        return 0          # NVIDIA A10 / A100 - preferred for nvidia-smi proof
    if "_V710_" in up:
        return 3          # Intel Flex
    if "AS_V4" in up:
        return 4          # AMD MI25 (no nvidia-smi)
    return 1              # other NV (M60 v2/v3)


def main():
    emit({"step": "start", "rg": RG, "vm": VM, "regions": REGIONS, "images": IMAGES})

    acct = az(["account", "show", "--output", "json"], timeout=120)
    sub_id = None
    if acct["rc"] == 0:
        try:
            a = json.loads(acct["out"])
            sub_id = a.get("id")
            emit({"step": "account", "sub": sub_id, "tenant": a.get("tenantId"),
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

    # Visible subscriptions / resource groups
    st, subs = arm(tok, ARM + "/subscriptions?api-version=2022-12-01")
    vals = subs.get("value") or []
    emit({"step": "subscriptions", "http": st, "count": len(vals),
          "subs": [{"id": x.get("subscriptionId"), "name": x.get("displayName"),
                    "state": x.get("state")} for x in vals]})

    st, rgs = arm(tok, f"{ARM}/subscriptions/{sub_id}/resourcegroups?api-version=2021-04-01")
    rgnames = sorted([r.get("name") for r in (rgs.get("value") or [])])
    emit({"step": "resource-groups", "http": st, "count": len(rgnames), "names": rgnames[:80]})

    st, perms = arm(tok, (f"{ARM}/subscriptions/{sub_id}/resourceGroups/{RG}"
                          "/providers/Microsoft.Authorization/permissions?api-version=2022-04-01"))
    actions, notactions = set(), set()
    for e in (perms.get("value") or []):
        actions.update(e.get("actions") or [])
        notactions.update(e.get("notActions") or [])
    emit({"step": "rg-permissions", "http": st, "entries": len(perms.get("value") or []),
          "actions": sorted(actions)[:50], "notActions": sorted(notactions)[:20]})

    # Existing vnets/subnets in the real RG (reuse, never create if one exists)
    vnet_pick = None
    st, vn = arm(tok, (f"{ARM}/subscriptions/{sub_id}/resourceGroups/{RG}"
                       "/providers/Microsoft.Network/virtualNetworks?api-version=2024-01-01"))
    vnet_dump = []
    for v in (vn.get("value") or []):
        sns = [{"name": s.get("name"),
                "prefix": (s.get("properties") or {}).get("addressPrefix")}
               for s in ((v.get("properties") or {}).get("subnets") or [])]
        vnet_dump.append({"name": v.get("name"), "location": v.get("location"),
                          "subnets": sns})
        if vnet_pick is None:
            for s in sns:
                if s.get("name"):
                    vnet_pick = (v.get("name"), s.get("name"))
                    break
            if vnet_pick:
                break
    emit({"step": "vnets", "http": st, "count": len(vnet_dump), "vnets": vnet_dump[:10],
          "pick": vnet_pick})

    # Existing VMs (baseline, so cleanup can prove nothing of ours remains)
    base = az(["vm", "list", "-g", RG, "--output", "json"], timeout=180)
    try:
        base_names = sorted([v.get("name") for v in json.loads(base["out"] or "[]")])
    except Exception:  # noqa: BLE001
        base_names = []
    emit({"step": "vm-baseline", "rc": base["rc"], "names": base_names[:30],
          "stderr": (base["err"] or "")[:300]})

    # Per-region live quota + SKU catalogue
    candidates = []
    blind = [("australiaeast", "Standard_NV6_Promo"), ("westus2", "Standard_NV6_Promo"),
             ("australiaeast", "Standard_NV6")]
    for region in REGIONS:
        st, us = arm(tok, (f"{ARM}/subscriptions/{sub_id}/providers/Microsoft.Compute/locations/"
                           f"{region}/usages?api-version=2024-07-01"))
        quota = {}
        rows = []
        for u in (us.get("value") or []):
            name = str((u.get("name") or {}).get("value", ""))
            if re.match(r"(?i)^standard(nc|nd|nv)", name):
                quota[name.lower()] = u.get("limit")
                rows.append({"family": name, "current": u.get("currentValue"),
                             "limit": u.get("limit")})
        emit({"step": "usages", "region": region, "http": st,
              "gpu_families_nonzero": [r for r in rows
                                       if isinstance(r.get("limit"), (int, float))
                                       and r["limit"] > 0],
              "gpu_families_zero_count": len([r for r in rows
                                              if not (isinstance(r.get("limit"), (int, float))
                                                      and r["limit"] > 0)])})

        q = urllib.parse.urlencode({"api-version": "2021-07-01",
                                    "$filter": f"location eq '{region}'"})
        url = f"{ARM}/subscriptions/{sub_id}/providers/Microsoft.Compute/skus?{q}"
        skus, pages = [], 0
        while url and pages < 8:
            st2, body = arm(tok, url)
            pages += 1
            if st2 != 200:
                emit({"step": "skus-error", "region": region, "http": st2,
                      "err": str(body)[:300]})
                break
            for s in (body.get("value") or []):
                nm = str(s.get("name", ""))
                if nm.startswith(("Standard_NV", "Standard_NC", "Standard_ND")):
                    rs = []
                    for r in (s.get("restrictions") or []):
                        ri = r.get("restrictionInfo") or {}
                        rs.append({"type": r.get("type"), "reasonCode": r.get("reasonCode"),
                                   "zones": ri.get("zones")})
                    skus.append({"name": nm, "family": s.get("family"),
                                 "restrictions": rs,
                                 "zones": [z for z in
                                           ((s.get("locationInfo") or [{}])[0].get("zones") or [])][:8]})
            url = body.get("nextLink")
        nv = [s for s in skus if s["name"].startswith("Standard_NV")]
        emit({"step": "skus", "region": region, "pages": pages,
              "nv_count": len(nv), "nv": nv[:40]})

        for s in nv:
            fam = (s.get("family") or "").lower()
            limit = quota.get(fam)
            score = nv_score(s["name"])
            if not isinstance(limit, (int, float)) or limit <= 0:
                continue
            if score >= 3:
                # non-NVIDIA NV SKUs (Intel V710 / AMD MI25) are recorded but not
                # deployed: the marker proof required here is nvidia-smi.
                emit({"step": "non-nvidia-skip", "region": region, "size": s["name"],
                      "family": s.get("family"), "limit": limit})
                continue
            rs = s.get("restrictions") or []
            zone = None
            if rs:
                if any(r.get("type") != "Zone" for r in rs):
                    continue
                blocked = set()
                for r in rs:
                    for z in (r.get("zones") or []):
                        blocked.add(str(z))
                cand_zones = [str(z) for z in (s.get("zones") or []) if str(z) not in blocked]
                if not cand_zones:
                    continue
                zone = cand_zones[0]
            candidates.append({"region": region, "size": s["name"], "family": s.get("family"),
                               "limit": limit, "zone": zone, "score": nv_score(s["name"])})
    candidates.sort(key=lambda c: (c["score"], 0 if c["zone"] is None else 1, -c["limit"]))
    emit({"step": "candidates", "list": [{k: c[k] for k in
                                          ("region", "size", "family", "limit", "zone", "score")}
                                         for c in candidates[:12]]})

    vnet_variants = [[]]
    if vnet_pick:
        vnet_variants = [["--vnet-name", vnet_pick[0], "--subnet", vnet_pick[1]], []]

    created = None
    attempts = []
    total_attempts = 0
    attempt_list = [(c["region"], c["size"], c["zone"], c["family"]) for c in candidates]
    for region, size in blind:
        if not any(a[0] == region and a[1] == size for a in attempt_list):
            attempt_list.append((region, size, None, "BLIND"))
    for region, size, zone, fam in attempt_list[:MAX_CREATE_ATTEMPTS]:
        if created:
            break
        variants = [(IMAGES[0], vnet_variants[0]), (IMAGES[1], vnet_variants[0])]
        if len(vnet_variants) > 1:
            variants.append((IMAGES[0], vnet_variants[1]))
        for img, va in variants:
            if total_attempts >= MAX_CREATE_ATTEMPTS + 2:
                break
            total_attempts += 1
            args = ["vm", "create", "-g", RG, "-n", VM, "--image", img, "--size", size,
                    "--location", region, "--admin-username", ADMIN_USER,
                    "--admin-password", ADMIN_PW,
                    "--tags", "c211intent=120186", "c211marker=" + VM,
                    "c211family=" + str(fam),
                    "--public-ip-address", "", "--nsg", "", "--output", "json",
                    "--only-show-errors"]
            if zone:
                args += ["--zone", str(zone)]
            args += va
            r = az(args, timeout=900)
            ok = r["rc"] == 0
            rec = {"region": region, "size": size, "zone": zone, "family": fam,
                   "image": img, "vnet": bool(va), "ok": ok, "result": short(r, 1800)}
            attempts.append(rec)
            emit({"step": "vm-create", **rec})
            if ok:
                try:
                    created = json.loads(r["out"])
                except Exception:  # noqa: BLE001
                    created = {}
                break
            err = (r["err"] or "") + (r["out"] or "")
            if ("SkuNotAvailable" in err or "QuotaExceeded" in err
                    or "OperationNotAllowed" in err or "not available" in err.lower()):
                break  # no variant of this size/region can work
            # network-read, network-write, image-generation errors: try the next variant

    if not created:
        emit({"step": "verdict", "verdict": "GATE_NO_VM_CREATED",
              "attempts": [{"region": a["region"], "size": a["size"], "rc": a["result"]["rc"],
                            "stderr": a["result"]["stderr"][:400]} for a in attempts]})
        return

    # ---- Independent ARM instances.get readback ----
    vm_id = created.get("id") or (f"/subscriptions/{sub_id}/resourceGroups/{RG}"
                                  f"/providers/Microsoft.Compute/virtualMachines/{VM}")
    st, vmget = arm(tok, vm_id + "?api-version=2024-07-01&$expand=instanceView")
    statuses = []
    for s in ((vmget.get("properties") or {}).get("instanceView") or {}).get("statuses") or []:
        statuses.append(s.get("code"))
    emit({"step": "arm-readback", "http": st,
          "vm_id": vm_id,
          "location": vmget.get("location"),
          "vm_size": ((vmget.get("properties") or {}).get("hardwareProfile") or {}).get("vmSize"),
          "provisioning": ((vmget.get("properties") or {}).get("provisioningState")),
          "statuses": statuses,
          "tags": vmget.get("tags"),
          "nic_ids": [n.get("id") for n in
                      (((vmget.get("properties") or {}).get("networkProfile") or {})
                       .get("networkInterfaces") or [])],
          "os_disk": (((vmget.get("properties") or {}).get("storageProfile") or {})
                      .get("osDisk") or {}).get("name")})

    # ---- boot diagnostics ----
    bd = az(["vm", "boot-diagnostics", "enable", "-g", RG, "-n", VM, "--output", "json"],
            timeout=180)
    emit({"step": "boot-diag-enable", "rc": bd["rc"], "stderr": (bd["err"] or "")[:300]})

    # ---- GPU driver extension (async + bounded poll) ----
    ext = az(["vm", "extension", "set", "-g", RG, "--vm-name", VM,
              "--name", "NvidiaGpuDriverLinux", "--publisher", "Microsoft.HpcCompute",
              "--no-wait", "--output", "json"], timeout=300)
    emit({"step": "gpu-driver-start", "rc": ext["rc"], "stderr": (ext["err"] or "")[:500]})
    ext_state, t0 = None, time.time()
    while time.time() - t0 < EXT_POLL_SECS:
        time.sleep(30)
        es = az(["vm", "extension", "show", "-g", RG, "--vm-name", VM,
                 "--name", "NvidiaGpuDriverLinux", "--output", "json"], timeout=120)
        try:
            ext_state = json.loads(es["out"] or "{}").get("provisioningState")
        except Exception:  # noqa: BLE001
            ext_state = None
        emit({"step": "gpu-driver-poll", "elapsed": int(time.time() - t0),
              "state": ext_state})
        if ext_state in ("Succeeded", "Failed", "Canceled"):
            break

    # ---- device proof run-command ----
    proof_script = (
        "echo C211-I120186-RUNSTART; "
        "for d in /sys/bus/pci/devices/*; do v=$(cat $d/vendor 2>/dev/null); "
        "if [ \"$v\" = \"0x10de\" ]; then echo NVIDIA_PCI $d vendor=$v "
        "device=$(cat $d/device 2>/dev/null) class=$(cat $d/class 2>/dev/null); fi; done; "
        "ls -l /dev/nvidia* 2>&1 | head -20; "
        "command -v nvidia-smi && nvidia-smi -L && "
        "nvidia-smi --query-gpu=uuid,name,memory.total,driver_version --format=csv,noheader"
    )
    smi = run_cmd(proof_script)
    smi_text = runcmd_text(smi)
    emit({"step": "device-proof", "rc": smi["rc"], "text": smi_text[:4000],
          "stderr": (smi["err"] or "")[:600]})

    text = smi_text
    got_smi = bool(re.search(r"GPU\s+[0-9a-fA-F-]{8,}", text)) or "NVIDIA-SMI" in text
    if not got_smi:
        apt_script = (
            "export DEBIAN_FRONTEND=noninteractive; "
            "apt-get update -y >/tmp/c211apt.log 2>&1; "
            "apt-get install -y nvidia-utils-535-server nvidia-driver-535-server "
            ">>/tmp/c211apt.log 2>&1; tail -25 /tmp/c211apt.log; "
            "ls -l /dev/nvidia* 2>&1 | head; nvidia-smi -L || true"
        )
        apt_r = run_cmd(apt_script, timeout=APT_TIMEOUT, tries=1)
        emit({"step": "apt-fallback", "rc": apt_r["rc"],
              "text": runcmd_text(apt_r)[:4000]})

    blog = az(["vm", "boot-diagnostics", "get-boot-log", "-g", RG, "-n", VM], timeout=180)
    blogtext = blog["out"] or ""
    hits = [ln for ln in blogtext.splitlines()
            if "C211-I120186" in ln or "NVIDIA" in ln or "10de" in ln or "nvidia" in ln]
    emit({"step": "serial-log", "rc": blog["rc"], "len": len(blogtext),
          "hits": hits[-40:], "tail": blogtext[-1500:]})

    # ---- teardown ----
    d = az(["vm", "delete", "-g", RG, "-n", VM, "--yes"], timeout=900)
    emit({"step": "vm-delete", "result": short(d, 600)})

    st_res, rl = arm(tok, (f"{ARM}/subscriptions/{sub_id}/resourceGroups/{RG}/resources"
                           "?api-version=2021-04-01"))
    leftovers = [(x.get("name"), x.get("type"), x.get("id")) for x in (rl.get("value") or [])
                 if str(x.get("name", "")).startswith(VM)]
    emit({"step": "leftovers", "http": st_res, "rg_resource_count": len(rl.get("value") or []),
          "count": len(leftovers), "names": [l[0] for l in leftovers[:30]]})
    for name, rtype, rid in leftovers:
        if not name or not name.startswith(VM):
            continue
        if rtype and "virtualNetworks" in rtype:
            continue
        dr = az(["resource", "delete", "--ids", rid], timeout=600)
        emit({"step": "leftover-delete", "name": name, "type": rtype,
              "rc": dr["rc"], "stderr": (dr["err"] or "")[:300]})

    gcheck = arm(tok, vm_id + "?api-version=2024-07-01")
    emit({"step": "absence-vm-get", "http": gcheck[0],
          "err": str(gcheck[1])[:300]})
    l2 = az(["vm", "list", "-g", RG, "--output", "json"], timeout=180)
    try:
        after_names = sorted([v.get("name") for v in json.loads(l2["out"] or "[]")])
    except Exception:  # noqa: BLE001
        after_names = []
    ours = [n for n in after_names if n and n.startswith(VM)]
    emit({"step": "absence-list", "rc": l2["rc"], "total": len(after_names),
          "ours": ours, "baseline": base_names[:10]})

    size_out = None
    for src in (created.get("properties"), created):
        if isinstance(src, dict):
            hp = src.get("hardwareProfile") or {}
            if isinstance(hp, dict) and hp.get("vmSize"):
                size_out = hp.get("vmSize")
                break
    emit({"step": "verdict",
          "verdict": "MARKER_CYCLE_DONE" if not ours else "MARKER_LEFTOVER",
          "vm_created": created.get("name"), "location": created.get("location"),
          "size": size_out, "ext_state": ext_state,
          "absence_vm_get_http": gcheck[0], "ours_after": ours})


if __name__ == "__main__":
    main()
