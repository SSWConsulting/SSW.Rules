#!/usr/bin/env python3
"""C211-I121383 v3: SSW.Rules plain-VM GPU-plane probe - direct ARM REST create path.

Why v3: v2 (run 44882358526) proved the REST path works up to the vnet (PUT 201) but raced
the subnet: the NIC PUT returned 429 RetryableError "ReferencedResourceNotProvisioned ...
subnet ... is in Updating state".  v3 waits for the vnet/subnet provisioningState and retries
the NIC PUT.

Why v2: v1 (c211_i121383_probe.py, run 44881563231) measured the full 65-region usage matrix and
the SKU catalogue, but every `az vm create` attempt died inside the CLI with
"ERROR: The content for this response was already consumed" (an azure-cli error-handling bug on
the refused-VM path), so no PROVIDER-verbatim refusal was captured.  v2 keeps the identical
matrix reads and replaces the create step with direct ARM REST PUTs:

  * PUT vnet c211-i121383-vnet (subnet c211-i121383-subnet, 10.250.0.0/16) in a candidate region
  * PUT NIC  c211-i121383-nic0 on that subnet (no public IP)
  * PUT VM   c211-i121383-marker for each target SKU in order T4 -> A10v5 -> NC6s_v3 -> A100,
    stopping at the first success, capturing every provider error body verbatim
  * if all four refusals are ambiguity-class, one Standard_D2s_v5 control VM proves RBAC
  * on a created VM: instance-view readback, Microsoft.HpcCompute/NvidiaGpuDriverLinux extension
    (bounded poll), RunCommand nvidia-smi -L + --query-gpu=name,uuid,memory.total
  * teardown via az CLI (VM -> NIC -> vnet) with GET-404 / list-absence readback

stdlib + az CLI (token only) - create calls are raw ARM.
"""
import json
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
VNET = PFX + "-vnet"
SUBNET = PFX + "-subnet"
NIC = PFX + "-nic0"
CTRL = PFX + "-ctrl"
ADMIN_USER = "c211probe"
ADMIN_PW = "C211Marker!Pw9x7qZ"
IMAGE = {"publisher": "Canonical", "offer": "0001-com-ubuntu-server-jammy",
         "sku": "22_04-lts-gen2", "version": "latest"}
TARGETS = [
    {"key": "t4", "sku": "Standard_NC4as_T4_v3", "vcpu": 4, "pat": "ncasv3_t4"},
    {"key": "a10v5", "sku": "Standard_NV12ads_A10_v5", "vcpu": 12, "pat": "nvadsa10v5"},
    {"key": "nc6sv3", "sku": "Standard_NC6s_v3", "vcpu": 6, "pat": "ncsv3"},
    {"key": "a100", "sku": "Standard_NC24ads_A100_v4", "vcpu": 24, "pat": "ncadsa100v4"},
]
CATALOG_REGIONS = ["eastus", "westus2", "westeurope", "australiaeast", "eastus2",
                   "centralus", "southcentralus", "northeurope", "southeastasia", "japaneast"]
DEADLINE = 2700
T0 = time.time()
API_VM = "2024-07-01"
API_NET = "2024-01-01"


def emit(obj):
    print(TAG + " " + json.dumps(obj, default=str), flush=True)


def left():
    return DEADLINE - (time.time() - T0)


def az(args, timeout=180):
    t0 = time.time()
    try:
        p = subprocess.run(["az"] + args, capture_output=True, text=True, timeout=timeout)
        return {"rc": p.returncode, "out": p.stdout or "", "err": p.stderr or "",
                "secs": round(time.time() - t0, 1)}
    except Exception as e:  # noqa: BLE001
        return {"rc": 1, "out": "", "err": str(e), "secs": round(time.time() - t0, 1)}


def arm(tok, url, method="GET", body=None, timeout=180):
    data = json.dumps(body).encode() if body is not None else None
    hdrs = {"Authorization": "Bearer " + tok}
    if data is not None:
        hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode() or "{}"
            try:
                return r.status, json.loads(raw), round(time.time() - t0, 1)
            except Exception:  # noqa: BLE001
                return r.status, {"raw": raw[:1500]}, round(time.time() - t0, 1)
    except urllib.error.HTTPError as e:
        raw = e.read().decode() or ""
        try:
            return e.code, json.loads(raw), round(time.time() - t0, 1)
        except Exception:  # noqa: BLE001
            return e.code, {"raw": raw[:1800]}, round(time.time() - t0, 1)
    except Exception as e:  # noqa: BLE001
        return 0, {"transport_error": str(e)}, round(time.time() - t0, 1)


def err_of(st, body):
    if isinstance(body, dict):
        e = body.get("error")
        if isinstance(e, dict):
            det = e.get("details") or []
            return {"http": st, "code": e.get("code"),
                    "message": (e.get("message") or "")[:1400],
                    "details": json.dumps(det)[:900] if det else None}
        if "raw" in body:
            return {"http": st, "raw": body["raw"][:1200]}
        return {"http": st, "body": json.dumps(body)[:1200]}
    return {"http": st}


def usage_rows(body):
    out = []
    for u in (body.get("value") or []):
        nm = str((u.get("name") or {}).get("value", ""))
        if re.match(r"(?i)^standard(nc|nd|nv)", nm):
            out.append({"family": nm, "current": u.get("currentValue"),
                        "limit": u.get("limit"), "unit": u.get("unit")})
    return out


def norm(x):
    return re.sub(r"[^a-z0-9]", "", str(x).lower())


def headroom(rows, tgt):
    for r in rows:
        if norm(tgt["pat"]) in norm(r["family"]):
            lim, cur = r.get("limit"), r.get("current")
            if isinstance(lim, (int, float)):
                return {"family": r["family"], "limit": lim,
                        "current": cur if isinstance(cur, (int, float)) else 0,
                        "headroom": lim - (cur if isinstance(cur, (int, float)) else 0)}
    return None


def runcmd_text(r):
    try:
        d = json.loads(r["out"] or "{}")
        return "\n".join(str(v.get("message", "")) for v in (d.get("value") or []))
    except Exception:  # noqa: BLE001
        return (r["out"] or "") + "\n" + (r["err"] or "")


def run_cmd(vmname, script, timeout=600, tries=3):
    last = None
    for _ in range(tries):
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


def vm_body(region, sku, nic_id, zone, computer):
    body = {
        "location": region,
        "tags": {"c211intent": "121383", "c211marker": PFX, "c211sku": sku},
        "properties": {
            "hardwareProfile": {"vmSize": sku},
            "storageProfile": {
                "imageReference": dict(IMAGE),
                "osDisk": {"createOption": "FromImage", "deleteOption": "Delete",
                           "managedDisk": {"storageAccountType": "Standard_LRS"}}},
            "osProfile": {"computerName": computer, "adminUsername": ADMIN_USER,
                          "adminPassword": ADMIN_PW,
                          "linuxConfiguration": {"disablePasswordAuthentication": False}},
            "networkProfile": {"networkInterfaces": [
                {"id": nic_id, "properties": {"deleteOption": "Delete"}}]},
        },
    }
    if zone:
        body["zones"] = [str(zone)]
    return body


def rm_vm(name):
    return az(["vm", "delete", "-g", RG, "-n", name, "--yes"], timeout=600)


def rm_nic(name):
    return az(["network", "nic", "delete", "-g", RG, "-n", name], timeout=600)


def rm_vnet(name):
    return az(["network", "vnet", "delete", "-g", RG, "-n", name], timeout=600)


def show_vm(name):
    return az(["vm", "show", "-g", RG, "-n", name, "--output", "json"], timeout=120)


def show_nic(name):
    return az(["network", "nic", "show", "-g", RG, "-n", name, "--output", "json"], timeout=120)


def show_vnet(name):
    return az(["network", "vnet", "show", "-g", RG, "-n", name, "--output", "json"], timeout=120)


def rg_inventory(tok, sub_id):
    st, lst, _ = arm(tok, (f"{ARM}/subscriptions/{sub_id}/resourceGroups/{RG}/resources"
                           "?api-version=2021-04-01"))
    ours = [{"name": x.get("name"), "type": x.get("type")}
            for x in (lst.get("value") or [])
            if str(x.get("name", "")).lower().startswith(PFX)]
    return st, ours


def sweep(tok, sub_id, vmname=VM, stop_nic=False):
    """az-CLI teardown of our own resources: VM, then NIC, then vnet; absence readback."""
    for nm in (vmname, CTRL):
        s = show_vm(nm)
        if s["rc"] == 0:
            d = rm_vm(nm)
            emit({"step": "sweep-vm", "name": nm, "delete_rc": d["rc"],
                  "err": (d["err"] or "")[:200]})
    if not stop_nic:
        s = show_nic(NIC)
        if s["rc"] == 0:
            d = rm_nic(NIC)
            emit({"step": "sweep-nic", "delete_rc": d["rc"], "err": (d["err"] or "")[:200]})
    for i in range(15):
        s = show_vnet(VNET)
        if s["rc"] != 0:
            emit({"step": "vnet-absent", "i": i, "rc": s["rc"]})
            break
        d = rm_vnet(VNET)
        emit({"step": "sweep-vnet", "i": i, "delete_rc": d["rc"],
              "err": (d["err"] or "")[:300]})
        time.sleep(10)
    st, ours = rg_inventory(tok, sub_id)
    emit({"step": "leftovers-after", "http": st, "count": len(ours), "list": ours[:20]})


def wait_prov(tok, url, label, tries=24, sleep_s=8):
    """Poll a resource GET until properties.provisioningState == Succeeded."""
    last = None
    for i in range(tries):
        st, b, _ = arm(tok, url, timeout=60)
        ps = ((b.get("properties") or {}).get("provisioningState")
              if isinstance(b, dict) else None)
        last = (st, ps)
        emit({"step": label + "-prov", "i": i, "http": st, "state": ps})
        if ps == "Succeeded":
            return True
        if ps in ("Failed", "Canceled") or st == 404:
            return False
        time.sleep(sleep_s)
    return last is not None and last[1] == "Succeeded"


def put_retry(tok, url, body, label, tries=8, sleep_s=8, timeout=300):
    """PUT with retry on 429/transient; returns (status, body, secs)."""
    st, b, secs = 0, {}, 0.0
    for i in range(tries):
        st, b, secs = arm(tok, url, method="PUT", body=body, timeout=timeout)
        code = ((b.get("error") or {}).get("code") if isinstance(b, dict) else None)
        if st in (200, 201):
            return st, b, secs
        transient = (st == 429 or code in ("RetryableError", "ReferencedResourceNotProvisioned",
                                           "AnotherOperationInProgress"))
        emit({"step": label + "-attempt", "i": i, "http": st, "code": code,
              "transient": transient, "secs": secs})
        if not transient:
            return st, b, secs
        time.sleep(sleep_s)
    return st, b, secs


def main():
    emit({"step": "start-v2", "rg": RG, "vm": VM, "targets": [t["sku"] for t in TARGETS]})

    acct = az(["account", "show", "--output", "json"], timeout=120)
    sub_id = None
    try:
        a = json.loads(acct["out"])
        sub_id = a.get("id")
        sid = sub_id or ""
        emit({"step": "account", "sub_prefix": sid[:8], "sub_mid": sid[9:18],
              "sub_tail": sid[18:], "tenant_prefix": str(a.get("tenantId"))[:8],
              "state": a.get("state"), "user_type": (a.get("user") or {}).get("type")})
    except Exception:  # noqa: BLE001
        emit({"step": "account", "rc": acct["rc"], "stderr": (acct["err"] or "")[:500]})
    if not sub_id:
        emit({"step": "fatal", "why": "no az account"})
        return

    tk = az(["account", "get-access-token", "--resource", ARM, "--output", "json"], timeout=120)
    tok = None
    try:
        tok = json.loads(tk["out"]).get("accessToken")
    except Exception:  # noqa: BLE001
        pass
    if not tok:
        emit({"step": "fatal", "why": "no ARM token"})
        return
    emit({"step": "arm-token", "len": len(tok)})

    st, provs, _ = arm(tok, f"{ARM}/subscriptions/{sub_id}/providers?api-version=2021-04-01")
    want = ("Microsoft.Compute", "Microsoft.Network", "Microsoft.Storage")
    emit({"step": "providers", "http": st,
          "registration": {p.get("namespace"): p.get("registrationState")
                           for p in (provs.get("value") or [])
                           if p.get("namespace") in want}})

    st, perms, _ = arm(tok, (f"{ARM}/subscriptions/{sub_id}/resourceGroups/{RG}"
                             "/providers/Microsoft.Authorization/permissions?api-version=2022-04-01"))
    actions, notactions = set(), set()
    for e in (perms.get("value") or []):
        actions.update(e.get("actions") or [])
        notactions.update(e.get("notActions") or [])
    emit({"step": "rg-permissions", "http": st, "entries": len(perms.get("value") or []),
          "actions": sorted(actions)[:50], "notActions_count": len(notactions)})

    st, locs, _ = arm(tok, f"{ARM}/subscriptions/{sub_id}/locations?api-version=2022-12-01")
    regions = [l.get("name") for l in (locs.get("value") or [])
               if l.get("name") and l.get("metadata", {}).get("regionType") in (None, "Physical")]
    emit({"step": "regions", "http": st, "count": len(regions), "list": regions})

    usage = {}
    nonzero = {}
    for region in regions:
        st, us, secs = arm(tok, (f"{ARM}/subscriptions/{sub_id}/providers/Microsoft.Compute/"
                                 f"locations/{region}/usages?api-version=2024-07-01"), timeout=60)
        rows = usage_rows(us) if isinstance(us, dict) else []
        usage[region] = rows
        emit({"step": "usages", "region": region, "http": st, "secs": secs, "gpu_rows": rows})
        for r in rows:
            if isinstance(r.get("limit"), (int, float)) and r["limit"] > 0:
                nonzero.setdefault(r["family"], []).append(
                    {"region": region, "current": r.get("current"), "limit": r["limit"]})
    emit({"step": "quota-summary", "nonzero_families": nonzero,
          "targets": [{"sku": t["sku"],
                       "rows": {rg: headroom(usage.get(rg) or [], t) for rg in regions
                                if headroom(usage.get(rg) or [], t)}}
                      for t in TARGETS]})

    cand_regions = []
    for t in TARGETS:
        for rg in regions:
            h = headroom(usage.get(rg) or [], t)
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
            st2, body, _ = arm(tok, url)
            pages += 1
            if st2 != 200:
                emit({"step": "skus-error", "region": region, "http": st2,
                      "err": str(body)[:300]})
                break
            for s in (body.get("value") or []):
                nm = str(s.get("name", ""))
                for t in TARGETS:
                    if nm.lower() == t["sku"].lower():
                        rs = []
                        for r in (s.get("restrictions") or []):
                            ri = r.get("restrictionInfo") or {}
                            rs.append({"type": r.get("type"), "reasonCode": r.get("reasonCode"),
                                       "info_locations": ri.get("locations"),
                                       "info_zones": ri.get("zones")})
                        zones = []
                        for li in (s.get("locationInfo") or []):
                            if (li.get("location") or "").lower() == region.lower():
                                zones = [str(z) for z in (li.get("zones") or [])]
                        found[t["key"]] = {"name": nm, "family": s.get("family"),
                                           "region": region, "restrictions": rs, "zones": zones}
            url = body.get("nextLink")
        catalogue[region] = found
        emit({"step": "skus", "region": region, "pages": pages, "targets": found})
        if left() < 1800:
            emit({"step": "skus-stop", "why": "deadline"})
            break

    def pick_zone(ent):
        rs = ent.get("restrictions") or []
        if any(r.get("type") == "Location" for r in rs):
            return False, None
        blocked = set()
        for r in rs:
            if r.get("type") == "Zone":
                for z in (r.get("info_zones") or []):
                    blocked.add(str(z))
        offered = [str(z) for z in (ent.get("zones") or [])]
        if not rs:
            return True, None
        cand = [z for z in offered if z not in blocked] if offered else []
        return (bool(cand), cand[0] if cand else None)

    plan = []
    for t in TARGETS:
        chosen = None
        for rg in regions:
            h = headroom(usage.get(rg) or [], t)
            if not h or h["headroom"] < t["vcpu"]:
                continue
            ent = (catalogue.get(rg) or {}).get(t["key"])
            ok, zone = (pick_zone(ent) if ent else (True, None))
            if not ok:
                continue
            chosen = {"sku": t["sku"], "key": t["key"], "region": rg, "zone": zone,
                      "mode": "headroom", "headroom": h["headroom"], "family": h["family"]}
            break
        if not chosen:
            for rg in scan_regions:
                ent = (catalogue.get(rg) or {}).get(t["key"])
                if not ent:
                    continue
                ok, zone = pick_zone(ent)
                if ok:
                    chosen = {"sku": t["sku"], "key": t["key"], "region": rg, "zone": zone,
                              "mode": "blind", "family": ent.get("family")}
                    break
        if not chosen:
            chosen = {"sku": t["sku"], "key": t["key"], "region": "eastus", "zone": None,
                      "mode": "blind-default"}
        plan.append(chosen)
    emit({"step": "plan", "candidates": plan})

    region0 = plan[0]["region"]
    net_base = (f"{ARM}/subscriptions/{sub_id}/resourceGroups/{RG}/providers/"
                f"Microsoft.Network")
    st, vb, secs = arm(tok, f"{net_base}/virtualNetworks/{VNET}?api-version={API_NET}")
    emit({"step": "vnet-pre", "http": st, "secs": secs})
    vnet_body = {"location": region0,
                 "tags": {"c211intent": "121383", "c211marker": PFX},
                 "properties": {"addressSpace": {"addressPrefixes": ["10.250.0.0/16"]},
                                "subnets": [{"name": SUBNET,
                                             "properties": {"addressPrefix": "10.250.1.0/24"}}]}}
    st, vb, secs = arm(tok, f"{net_base}/virtualNetworks/{VNET}?api-version={API_NET}",
                       method="PUT", body=vnet_body)
    emit({"step": "vnet-put", "http": st, "secs": secs,
          "err": err_of(st, vb) if st >= 300 else None})
    subnet_id = (f"/subscriptions/{sub_id}/resourceGroups/{RG}/providers/Microsoft.Network/"
                 f"virtualNetworks/{VNET}/subnets/{SUBNET}")
    nic_body = {"location": region0,
                "tags": {"c211intent": "121383", "c211marker": PFX},
                "properties": {"ipConfigurations": [{
                    "name": "ipconfig1",
                    "properties": {"privateIPAllocationMethod": "Dynamic",
                                   "subnet": {"id": subnet_id}}}]}}
    vnet_ok = wait_prov(tok, f"{net_base}/virtualNetworks/{VNET}?api-version={API_NET}", "vnet")
    emit({"step": "vnet-ready", "ok": vnet_ok})
    st, nb, secs = put_retry(tok, f"{net_base}/networkInterfaces/{NIC}?api-version={API_NET}",
                             nic_body, "nic")
    emit({"step": "nic-put", "http": st, "secs": secs,
          "err": err_of(st, nb) if st >= 300 else None,
          "provisioning": ((nb.get("properties") or {}).get("provisioningState")
                           if isinstance(nb, dict) else None)})
    nic_id = (f"/subscriptions/{sub_id}/resourceGroups/{RG}/providers/"
              f"Microsoft.Network/networkInterfaces/{NIC}")
    if st in (200, 201):
        nic_ok = wait_prov(tok, f"{net_base}/networkInterfaces/{NIC}?api-version={API_NET}", "nic")
        emit({"step": "nic-ready", "ok": nic_ok})
    if st >= 300:
        emit({"step": "network-blocked", "err": err_of(st, nb)})
        sweep(tok, sub_id)
        emit({"step": "verdict", "verdict": "GATE_NETWORK_PREREQ_REFUSED"})
        return

    created = None
    attempts = []
    for c in plan:
        if left() < 900:
            emit({"step": "create-stop", "why": "deadline"})
            break
        url = (f"{ARM}/subscriptions/{sub_id}/resourceGroups/{RG}/providers/"
               f"Microsoft.Compute/virtualMachines/{VM}?api-version={API_VM}")
        body = vm_body(c["region"], c["sku"], nic_id, c.get("zone"), "c211i121383m")
        st, vb2, secs = put_retry(tok, url, body, "vm", tries=6, sleep_s=10, timeout=300)
        rec = {"sku": c["sku"], "region": c["region"], "zone": c.get("zone"),
               "mode": c["mode"], "http": st, "secs": secs,
               "err": err_of(st, vb2) if st >= 300 else None,
               "provisioning": ((vb2.get("properties") or {}).get("provisioningState")
                                if isinstance(vb2, dict) else None)}
        attempts.append(rec)
        emit({"step": "vm-put", **rec})
        if st in (200, 201):
            created = {"body": vb2, "plan": c}
            break
    if not created:
        ctrl_needed = any((a.get("err") or {}).get("code") in
                          ("AuthorizationFailed", "InvalidParameter", "InvalidTemplate",
                           "NicReservedForAnotherVm", None)
                          for a in attempts) or not attempts
        if ctrl_needed and left() > 700:
            url = (f"{ARM}/subscriptions/{sub_id}/resourceGroups/{RG}/providers/"
                   f"Microsoft.Compute/virtualMachines/{CTRL}?api-version={API_VM}")
            body = vm_body(plan[0]["region"], "Standard_D2s_v5", nic_id, None, "c211i121383c")
            st, cb, secs = put_retry(tok, url, body, "ctrl", tries=4, sleep_s=10, timeout=300)
            emit({"step": "control-vm-put", "http": st, "secs": secs,
                  "err": err_of(st, cb) if st >= 300 else None,
                  "provisioning": ((cb.get("properties") or {}).get("provisioningState")
                                   if isinstance(cb, dict) else None)})
            if st in (200, 201):
                for i in range(20):
                    time.sleep(10)
                    st2, g, _ = arm(tok, url + "&$expand=instanceView")
                    ps = ((g.get("properties") or {}).get("provisioningState")
                          if isinstance(g, dict) else None)
                    sts = [s.get("code") for s in
                           ((((g.get("properties") or {}).get("instanceView") or {})
                             .get("statuses")) or [])] if isinstance(g, dict) else []
                    emit({"step": "control-poll", "i": i, "http": st2, "state": ps,
                          "statuses": sts})
                    if ps in ("Succeeded", "Failed") or ps is None:
                        break
                d = rm_vm(CTRL)
                emit({"step": "control-delete", "rc": d["rc"]})
        emit({"step": "verdict", "verdict": "GATE_NO_VM_CREATED",
              "attempts": attempts, "control_used": ctrl_needed})
        sweep(tok, sub_id)
        return

    c = created["plan"]
    emit({"step": "vm-created", "plan": c,
          "provisioning": ((created["body"].get("properties") or {}).get("provisioningState"))})
    vm_url = (f"{ARM}/subscriptions/{sub_id}/resourceGroups/{RG}/providers/"
              f"Microsoft.Compute/virtualMachines/{VM}?api-version={API_VM}")

    for i in range(30):
        st, g, _ = arm(tok, vm_url + "&$expand=instanceView")
        ps = ((g.get("properties") or {}).get("provisioningState") if isinstance(g, dict) else None)
        sts = [s.get("code") for s in
               ((((g.get("properties") or {}).get("instanceView") or {}) or {}).get("statuses")
                or [])] if isinstance(g, dict) else []
        emit({"step": "vm-poll", "i": i, "http": st, "state": ps, "statuses": sts})
        if ps in ("Succeeded", "Failed") or st == 404:
            break
        time.sleep(15)

    st, vmget, _ = arm(tok, vm_url + "&$expand=instanceView")
    emit({"step": "arm-readback", "http": st,
          "location": vmget.get("location"),
          "vm_size": ((vmget.get("properties") or {}).get("hardwareProfile") or {}).get("vmSize"),
          "provisioning": ((vmget.get("properties") or {}).get("provisioningState")),
          "statuses": [s.get("code") for s in
                       ((((vmget.get("properties") or {}).get("instanceView") or {})
                         .get("statuses")) or [])],
          "tags": vmget.get("tags"),
          "nic_ids": [n.get("id") for n in
                      (((vmget.get("properties") or {}).get("networkProfile") or {})
                       .get("networkInterfaces") or [])],
          "os_disk": (((vmget.get("properties") or {}).get("storageProfile") or {})
                      .get("osDisk") or {}).get("name")})

    ext_url = (vm_url.split("?")[0] + "/extensions/NvidiaGpuDriverLinux?api-version=" + API_VM)
    ext_body = {"location": c["region"],
                "properties": {"publisher": "Microsoft.HpcCompute",
                               "type": "NvidiaGpuDriverLinux",
                               "autoUpgradeMinorVersion": True}}
    st, eb, _ = arm(tok, ext_url, method="PUT", body=ext_body, timeout=120)
    emit({"step": "gpu-driver-put", "http": st,
          "err": err_of(st, eb) if st >= 300 else None})
    ext_state, t0 = None, time.time()
    while time.time() - t0 < min(720, max(120, left() - 600)):
        time.sleep(30)
        st, es, _ = arm(tok, ext_url)
        ext_state = ((es.get("properties") or {}).get("provisioningState")
                     if isinstance(es, dict) else None)
        emit({"step": "gpu-driver-poll", "elapsed": int(time.time() - t0), "http": st,
              "state": ext_state})
        if ext_state in ("Succeeded", "Failed", "Canceled"):
            break

    proof = ("echo C211-I121383-RUNSTART; "
             "for d in /sys/bus/pci/devices/*; do v=$(cat $d/vendor 2>/dev/null); "
             "if [ \"$v\" = \"0x10de\" ]; then echo NVIDIA_PCI $d vendor=$v "
             "device=$(cat $d/device 2>/dev/null); fi; done; "
             "ls -l /dev/nvidia* 2>&1 | head -20; "
             "command -v nvidia-smi && nvidia-smi -L && "
             "nvidia-smi --query-gpu=name,uuid,memory.total --format=csv,noheader")
    smi = run_cmd(VM, proof, timeout=600, tries=3)
    text = runcmd_text(smi)
    emit({"step": "device-proof", "rc": smi["rc"], "text": text[:4000],
          "stderr": (smi["err"] or "")[:500]})
    if not (re.search(r"GPU\s+[0-9a-fA-F-]{8,}", text) or "NVIDIA-SMI" in text):
        apt = ("echo C211-I121383-RUNSTART; export DEBIAN_FRONTEND=noninteractive; "
               "apt-get update -y >/tmp/c211apt.log 2>&1; "
               "apt-get install -y nvidia-utils-535-server nvidia-driver-535-server "
               ">>/tmp/c211apt.log 2>&1; tail -25 /tmp/c211apt.log; "
               "ls -l /dev/nvidia* 2>&1 | head; nvidia-smi -L; "
               "nvidia-smi --query-gpu=name,uuid,memory.total --format=csv,noheader")
        ar = run_cmd(VM, apt, timeout=900, tries=1)
        emit({"step": "apt-fallback", "rc": ar["rc"], "text": runcmd_text(ar)[:4000]})

    d = rm_vm(VM)
    emit({"step": "vm-delete", "rc": d["rc"], "err": (d["err"] or "")[:300]})
    for i in range(20):
        s = show_vm(VM)
        emit({"step": "vm-absent-poll", "i": i, "rc": s["rc"],
              "notfound": ("ResourceNotFound" in (s["err"] or "")
                           or "was not found" in (s["err"] or ""))})
        if s["rc"] != 0:
            break
        time.sleep(10)
    sweep(tok, sub_id)
    s = show_vm(VM)
    emit({"step": "absence-vm-get", "rc": s["rc"]})
    st, ours = rg_inventory(tok, sub_id)
    emit({"step": "absence-list", "http": st, "ours": ours})
    emit({"step": "verdict",
          "verdict": "MARKER_CYCLE_DONE" if not ours else "MARKER_LEFTOVER",
          "plan": c, "region": c["region"], "size": c["sku"],
          "ext_state": ext_state, "ours_after": ours})


if __name__ == "__main__":
    main()
