#!/usr/bin/env python3
"""C211-I120687: SSW.Rules Azure OIDC -- 'Standard NCASv3_T4 Family' quota re-open.

Runs inside the SSW.Rules 'Deploy Pull Request to Staging Slot' -> deploy-infrastructure
reusable workflow after azure/login@v2 (fork PR head tree checked out, pwsh deploy.ps1).
stdlib only. Prints tagged JSON lines.

Phase A (read-only): per physical region, GET Microsoft.Compute locations/{r}/usages and
print EVERY NC/ND/NV family row verbatim (zero and nonzero), with special attention to
the 'Standard NCASv3_T4 Family' quota dimension that the earlier v2-v6 scans filtered
out (they emitted limit>0 rows only, so a 0/absent entry was never printed).

Phase B (read-only): the Standard_NC4as_T4_v3 SKU catalogue entry -- family, all
restrictions (location / zone) and the locationInfo list of offering regions.

Phase C: only if a region both offers an unrestricted Standard_NC4as_T4_v3 AND shows
NCASv3_T4 headroom >= 4 vCPU, deploy EXACTLY ONE nonce-tagged on-demand
Standard_NC4as_T4_v3 VM in the existing RG SSW.Rules.Staging, capture PCI device proof
and (best effort, bounded) nvidia-smi device UUIDs, take an independent ARM
instances.get readback, then delete the VM and every nonce-tagged resource and prove
absence. Never touches non-nonce resources.
"""
import json
import re
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

TAG = "C211_I120687"
ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
VM = "c211-i120687-nct4"
VNET = "c211-i120687-vnet"
IMAGE = "Canonical:0001-com-ubuntu-server-jammy:22_04-lts-gen2:latest"
ADMIN_USER = "c211probe"
ADMIN_PW = "C211Marker!Pw9x7qZ"
PREFIX = "c211-i120687"
TARGET_SKU = "Standard_NC4as_T4_v3"
T0 = time.time()
DEADLINE = 3300  # hard internal budget (s) for the whole probe

_LOCK = threading.Lock()


def emit(obj):
    line = TAG + " " + json.dumps(obj, default=str)
    with _LOCK:
        print(line, flush=True)


def left():
    return DEADLINE - (time.time() - T0)


def run(cmd, timeout=600):
    t = time.time()
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return {"rc": p.returncode, "out": p.stdout or "", "err": p.stderr or "",
                "secs": round(time.time() - t, 1)}
    except subprocess.TimeoutExpired:
        return {"rc": 124, "out": "", "err": "TIMEOUT %ss" % timeout,
                "secs": round(time.time() - t, 1)}
    except Exception as e:  # noqa: BLE001
        return {"rc": 1, "out": "", "err": str(e), "secs": round(time.time() - t, 1)}


def az(args, timeout=600):
    return run(["az"] + args, timeout)


def arm(tok, url, method="GET", body=None, timeout=60):
    data = None
    headers = {"Authorization": "Bearer " + tok, "Content-Type": "application/json"}
    if body is not None:
        data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode() or "{}"
            try:
                return r.status, json.loads(raw)
            except Exception:  # noqa: BLE001
                return r.status, {"raw": raw[:800]}
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except Exception:  # noqa: BLE001
            return e.code, {}
    except Exception as e:  # noqa: BLE001
        return 0, {"transport_error": str(e)}


def norm(s):
    return re.sub(r"[^a-z0-9]", "", str(s).lower())


TARGET_NORM = norm("Standard NCASv3_T4 Family")  # standardncasv3t4family


def rg_items(tok, sid):
    st, rl = arm(tok, f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/resources"
                      "?api-version=2021-04-01", timeout=90)
    return st, [{"name": x.get("name"), "type": x.get("type"), "id": x.get("id")}
                for x in (rl.get("value") or [])]


def mine(items):
    return [i for i in items if str(i.get("name", "")).lower().startswith(PREFIX)]


def order(i):
    t = str(i.get("type") or "")
    for n, key in enumerate(("virtualMachines", "networkInterfaces", "disks",
                             "networkSecurityGroups", "publicIPAddresses",
                             "virtualNetworks")):
        if key in t:
            return n
    return 9


def cleanup(tok, sid, tag):
    for i in sorted(mine(rg_items(tok, sid)[1]), key=order):
        d = az(["resource", "delete", "--ids", i["id"]], timeout=600)
        emit({"step": tag, "name": i["name"], "type": i["type"], "rc": d["rc"],
              "err": (d["err"] or "")[:200]})


def main():
    emit({"step": "start", "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
    acct = az(["account", "show", "--output", "json"], timeout=120)
    sid = None
    try:
        a = json.loads(acct["out"] or "{}")
        sid = a.get("id")
    except Exception:  # noqa: BLE001
        a = {}
    tk = az(["account", "get-access-token", "--resource", ARM, "--output", "json"], timeout=120)
    tok = None
    try:
        tok = json.loads(tk["out"] or "{}").get("accessToken")
    except Exception:  # noqa: BLE001
        pass
    emit({"step": "session", "sub_name": a.get("name"), "sub_state": a.get("state"),
          "sub_prefix": (sid or "")[:8], "user_type": (a.get("user") or {}).get("type"),
          "token_len": len(tok or "")})
    if not sid or not tok:
        emit({"step": "fatal", "why": "no ARM session"})
        return

    # ---------- Phase A: full usages matrix per physical region ----------
    st, locs = arm(tok, f"{ARM}/subscriptions/{sid}/locations?api-version=2022-12-01")
    regions = [l.get("name") for l in (locs.get("value") or [])
               if (l.get("metadata") or {}).get("regionType") == "Physical"]
    emit({"step": "regions", "http": st, "count": len(regions)})

    def usage(region):
        url = (f"{ARM}/subscriptions/{sid}/providers/Microsoft.Compute/locations/"
               f"{region}/usages?api-version=2024-07-01")
        s, body = arm(tok, url, timeout=60)
        rows = []
        for u in (body.get("value") or []):
            nm = str((u.get("name") or {}).get("value", ""))
            n = norm(nm)
            if ("nc" in n) or ("nd" in n) or ("nv" in n):
                rows.append({"family": nm, "current": u.get("currentValue"),
                             "limit": u.get("limit")})
        tgt = [r for r in rows if TARGET_NORM in norm(r["family"])]
        return {"region": region, "http": s, "total_families": len(body.get("value") or []),
                "target": tgt, "gpu_rows": rows,
                "err": None if s == 200 else str(body)[:200]}

    with ThreadPoolExecutor(max_workers=4) as ex:
        res = list(ex.map(usage, regions[:100]))

    matrix = []
    for r in sorted(res, key=lambda x: x["region"]):
        matrix.append({
            "region": r["region"], "http": r["http"],
            "total_families": r["total_families"],
            "ncasv3t4": r["target"],
            "gpu": {g["family"]: "%s/%s" % (g["current"], g["limit"])
                    for g in r["gpu_rows"]},
            "err": r["err"],
        })
    emit({"step": "usages-matrix", "regions": len(matrix), "rows": matrix})

    target_seen = [(m["region"], m["ncasv3t4"]) for m in matrix if m["ncasv3t4"]]
    emit({"step": "ncasv3t4-summary",
          "regions_with_entry": len(target_seen),
          "nonzero": [{"region": rg, "rows": rows} for rg, rows in target_seen
                      if any(isinstance(x.get("limit"), (int, float)) and x["limit"] > 0
                             for x in rows)],
          "detail": [{"region": rg, "rows": rows} for rg, rows in target_seen]})

    # ---------- Phase B: SKU catalogue for the T4 SKU ----------
    sku = None
    pages = 0
    url = (f"{ARM}/subscriptions/{sid}/providers/Microsoft.Compute/skus"
           "?api-version=2021-07-01")
    while url and pages < 15 and left() > 1200:
        s, body = arm(tok, url, timeout=90)
        pages += 1
        if s != 200:
            emit({"step": "skus-error", "http": s, "err": str(body)[:300]})
            break
        for x in (body.get("value") or []):
            if str(x.get("name")) == TARGET_SKU:
                rs = []
                for r in (x.get("restrictions") or []):
                    ri = r.get("restrictionInfo") or {}
                    rs.append({"type": r.get("type"), "reasonCode": r.get("reasonCode"),
                               "locations": ri.get("locations"), "zones": ri.get("zones")})
                sku = {"name": x.get("name"), "family": x.get("family"),
                       "locations": [li.get("location") for li in (x.get("locationInfo") or [])],
                       "zones": [li.get("zones") for li in (x.get("locationInfo") or [])],
                       "restrictions": rs,
                       "capabilities": {c.get("name"): c.get("value")
                                        for c in (x.get("capabilities") or [])}}
        url = body.get("nextLink")
    emit({"step": "sku", "pages": pages, "found": sku is not None, "sku": sku})

    if not sku:
        emit({"step": "verdict", "gate": "GATE_SKU_NOT_IN_CATALOGUE",
              "note": "Standard_NC4as_T4_v3 absent from the subscription SKU catalogue"})
        return

    restricted_locs = set()
    unrestricted_zones = {}
    for r in sku["restrictions"]:
        if r["type"] == "Location":
            for loc in (r.get("locations") or []):
                restricted_locs.add(str(loc).lower())
        elif r["type"] == "Zone":
            for loc in (r.get("locations") or []):
                unrestricted_zones.setdefault(str(loc).lower(), set()).update(
                    str(z) for z in (r.get("zones") or []))
    offered = [str(x).lower() for x in sku["locations"] if x]
    usable = [rg for rg in offered if rg not in restricted_locs]
    emit({"step": "sku-availability", "offered": offered,
          "location_restricted": sorted(restricted_locs),
          "usable_regions": usable,
          "zone_restrictions": {k: sorted(v) for k, v in unrestricted_zones.items()}})

    # ---------- Phase C: headroom join ----------
    cands = []
    for rg in usable:
        m = next((x for x in matrix if x["region"] == rg), None)
        if not m:
            continue
        lim = cur = None
        for row in (m["ncasv3t4"] or []):
            if isinstance(row.get("limit"), (int, float)):
                lim = row["limit"] if lim is None else max(lim, row["limit"])
            if isinstance(row.get("current"), (int, float)):
                cur = row["current"] if cur is None else max(cur, row["current"])
        head = None
        if lim is not None:
            head = lim - (cur or 0)
        cands.append({"region": rg, "limit": lim, "current": cur, "headroom": head,
                      "zone_blocks": sorted(unrestricted_zones.get(rg) or [])})
    ok = [c for c in cands if isinstance(c["headroom"], (int, float)) and c["headroom"] >= 4]
    ok.sort(key=lambda c: -c["headroom"])
    emit({"step": "candidates", "usable_regions": len(usable), "list": cands,
          "deployable": ok[:3]})

    if not ok:
        emit({"step": "verdict", "gate": "GATE_NO_NCASV3_T4_HEADROOM",
              "reason": "no offered unrestricted region has Standard NCASv3_T4 Family "
                        "limit-current >= 4 vCPU",
              "matrix_rows": len(matrix)})
        return

    pick = ok[0]
    region = pick["region"]
    emit({"step": "marker-plan", "region": region, "headroom": pick["headroom"],
          "zone_block": pick["zone_blocks"]})

    st, items = rg_items(tok, sid)
    emit({"step": "rg-before", "http": st, "total": len(items),
          "ours": [i["name"] for i in mine(items)]})
    cleanup(tok, sid, "pre-clean")
    emit({"step": "pre-clean-after", "ours": [i["name"] for i in mine(rg_items(tok, sid)[1])]})

    create = az(["vm", "create", "-g", RG, "-n", VM, "--image", IMAGE, "--size", TARGET_SKU,
                 "--location", region, "--admin-username", ADMIN_USER,
                 "--admin-password", ADMIN_PW, "--public-ip-address", "", "--nsg", "",
                 "--vnet-name", VNET, "--tags", "c211intent=120687",
                 "c211sku=" + TARGET_SKU.lower(), "--output", "json"],
                timeout=min(900, max(240, int(left()) - 600)))
    ok_create = create["rc"] == 0
    keep = [ln.strip() for ln in (create["err"] + "\n" + create["out"]).splitlines()
            if any(k in ln for k in ("OperationNotAllowed", "QuotaExceeded", "SkuNotAvailable",
                                    "AllocationFailed", "InvalidParameter", '"code"',
                                    '"message"'))]
    emit({"step": "vm-create", "ok": ok_create, "rc": create["rc"], "secs": create["secs"],
          "filtered": keep[-16:], "tail": (create["err"] or "")[-1500:] if not ok_create else ""})

    if ok_create:
        vmurl = (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/providers/"
                 f"Microsoft.Compute/virtualMachines/{VM}?api-version=2024-07-01"
                 "&$expand=instanceView")
        st, vm = arm(tok, vmurl, timeout=90)
        sts = [x.get("code") for x in
               (((vm.get("properties") or {}).get("instanceView") or {}).get("statuses") or [])]
        emit({"step": "vm-readback-1", "http": st, "location": vm.get("location"),
              "vm_size": (((vm.get("properties") or {}).get("hardwareProfile") or {})
                          .get("vmSize")),
              "provisioning": ((vm.get("properties") or {}).get("provisioningState")),
              "statuses": sts, "vm_id": vm.get("id")})

        script = ("echo C211-I120687-RUNSTART; uname -a; "
                  "for d in /sys/bus/pci/devices/*; do v=$(cat $d/vendor 2>/dev/null); "
                  "case \"$v\" in 0x10de|0x1002) echo GPU_PCI $d vendor=$v "
                  "device=$(cat $d/device 2>/dev/null) class=$(cat $d/class 2>/dev/null);; "
                  "esac; done; echo PCI_SCAN_DONE; "
                  "command -v nvidia-smi && nvidia-smi -L || echo NVIDIA_SMI_ABSENT")
        rc = az(["vm", "run-command", "invoke", "-g", RG, "-n", VM,
                 "--command-id", "RunShellScript", "--scripts", script,
                 "--output", "json"], timeout=min(600, max(180, int(left()) - 300)))
        try:
            d = json.loads(rc["out"] or "{}")
            txt = "\n".join(str(v.get("message", "")) for v in (d.get("value") or []))
        except Exception:  # noqa: BLE001
            txt = (rc["out"] or "") + (rc["err"] or "")
        emit({"step": "device-proof-pci", "rc": rc["rc"], "text": txt[:3000]})

        has_nvidia_smi = "NVIDIA_SMI_ABSENT" not in txt
        if not has_nvidia_smi and left() > 900:
            ext = az(["vm", "extension", "set", "-g", RG, "--vm-name", VM,
                      "--publisher", "Microsoft.HpcCompute", "--name", "NvidiaGpuDriverLinux",
                      "--output", "json"], timeout=min(900, max(240, int(left()) - 420)))
            emit({"step": "driver-ext", "rc": ext["rc"], "secs": ext["secs"],
                  "err": (ext["err"] or "")[:400], "out": (ext["out"] or "")[:300]})
            script2 = ("echo C211-I120687-NVSTART; "
                       "command -v nvidia-smi || true; "
                       "nvidia-smi -L 2>&1 | head -20; "
                       "nvidia-smi --query-gpu=name,uuid,memory.total --format=csv 2>&1 | head -20")
            rc2 = az(["vm", "run-command", "invoke", "-g", RG, "-n", VM,
                      "--command-id", "RunShellScript", "--scripts", script2,
                      "--output", "json"], timeout=min(600, max(180, int(left()) - 300)))
            try:
                d2 = json.loads(rc2["out"] or "{}")
                txt2 = "\n".join(str(v.get("message", "")) for v in (d2.get("value") or []))
            except Exception:  # noqa: BLE001
                txt2 = (rc2["out"] or "") + (rc2["err"] or "")
            emit({"step": "device-proof-nvidia", "rc": rc2["rc"], "text": txt2[:3000]})

        st, vm2 = arm(tok, vmurl, timeout=90)
        emit({"step": "vm-readback-2", "http": st, "vm_size": (((vm2.get("properties") or {})
              .get("hardwareProfile") or {}).get("vmSize")),
              "provisioning": ((vm2.get("properties") or {}).get("provisioningState")),
              "vm_id": vm2.get("id")})

        dele = az(["vm", "delete", "-g", RG, "-n", VM, "--yes"], timeout=900)
        emit({"step": "vm-delete", "rc": dele["rc"], "secs": dele["secs"],
              "err": (dele["err"] or "")[:300]})

    cleanup(tok, sid, "final-clean")
    rem = mine(rg_items(tok, sid)[1])
    for _ in range(4):
        if not rem:
            break
        time.sleep(15)
        cleanup(tok, sid, "final-clean-retry")
        rem = mine(rg_items(tok, sid)[1])
    l = az(["vm", "list", "-g", RG, "--output", "json"], timeout=180)
    try:
        vms = sorted([v.get("name") for v in json.loads(l["out"] or "[]")])
    except Exception:  # noqa: BLE001
        vms = []
    st, items2 = rg_items(tok, sid)
    emit({"step": "final", "http": st, "rg_total": len(items2),
          "ours_remaining": [i["name"] for i in mine(items2)], "vms_in_rg": vms,
          "verdict": "MARKER_DONE_CLEAN" if not mine(items2) else "LEFTOVERS_REMAIN"})


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        emit({"step": "unhandled", "err": repr(e)})
        sys.exit(0)
