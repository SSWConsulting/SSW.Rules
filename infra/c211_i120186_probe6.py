#!/usr/bin/env python3
"""C211-I120186 phase 6: raw-ARM-error + last-NV-path diagnostic.

1. Re-attempts the two catalogue NVIDIA NV sizes with `az vm create --debug` so the
   raw ARM HTTP error body (which plain az swallows behind "The content for this
   response was already consumed") is captured verbatim.
2. Attempts ONE regional Standard_NV4as_v4 in westus2 - the only NV family
   (standardNVSv4Family) with nonzero quota in that region - to settle whether ANY
   NV-series SKU is deployable; if it deploys, captures the PCI device id from
   /sys/bus/pci (vendor 0x1002/0x10de) and then tears the VM down.
3. Deletes any leftover whose name starts with our marker prefixes and proves absence.

Runs in the same fork-PR deploy path after azure/login@v2. stdlib + az CLI only.
"""
import json
import subprocess
import time
import urllib.error
import urllib.request

TAG = "C211_I120186"
ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
TRY_VM = "c211-i120186-nvtry"
IMAGE = "Canonical:0001-com-ubuntu-server-jammy:22_04-lts-gen2:latest"
ADMIN_PW = "C211Marker!Pw9x7qZ"
ADMIN_USER = "c211probe"
PREFIXES = ("c211-i120186", "c211-i120065")


def emit(obj):
    print(TAG + " " + json.dumps(obj, default=str), flush=True)


def run(cmd, timeout=600):
    t0 = time.time()
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return {"rc": p.returncode, "out": p.stdout or "", "err": p.stderr or "",
                "secs": round(time.time() - t0, 1)}
    except subprocess.TimeoutExpired:
        return {"rc": 124, "out": "", "err": "TIMEOUT %ss" % timeout,
                "secs": round(time.time() - t0, 1)}
    except Exception as e:  # noqa: BLE001
        return {"rc": 1, "out": "", "err": str(e), "secs": round(time.time() - t0, 1)}


def az(args, timeout=600):
    return run(["az"] + args, timeout)


def arm(tok, url, timeout=90):
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + tok,
                                               "Content-Type": "application/json"})
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


def rg_items(tok, sid):
    st, rl = arm(tok, f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/resources"
                      "?api-version=2021-04-01")
    return st, [{"name": x.get("name"), "type": x.get("type"), "id": x.get("id")}
                for x in (rl.get("value") or [])]


def mine(items):
    return [i for i in items if str(i.get("name", "")).startswith(PREFIXES)]


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
              "stderr": (d["err"] or "")[:200]})


def debug_create(size, region, zone=None, timeout=600):
    args = ["vm", "create", "-g", RG, "-n", TRY_VM, "--image", IMAGE, "--size", size,
            "--location", region, "--admin-username", ADMIN_USER,
            "--admin-password", ADMIN_PW,
            "--tags", "c211intent=120186", "c211try=" + size.lower(),
            "--public-ip-address", "", "--nsg", "", "--output", "json",
            "--only-show-errors", "--debug"]
    if zone:
        args += ["--zone", str(zone)]
    r = az(args, timeout=timeout)
    txt = (r["err"] or "") + "\n" + (r["out"] or "")
    keep = [ln.strip() for ln in txt.splitlines()
            if ("InvalidParameter" in ln or "not available" in ln
                or "QuotaExceeded" in ln or "OperationNotAllowed" in ln
                or "SkuNotAvailable" in ln or "Response content" in ln
                or '"code"' in ln or '"message"' in ln
                or "HttpResponseError" in ln or "Request body" in ln)]
    return r, keep[-24:], txt[-2200:]


def main():
    emit({"step": "start"})
    acct = az(["account", "show", "--output", "json"], timeout=120)
    sid = None
    try:
        sid = json.loads(acct["out"] or "{}").get("id")
    except Exception:  # noqa: BLE001
        pass
    tk = az(["account", "get-access-token", "--resource", ARM, "--output", "json"], timeout=120)
    tok = None
    try:
        tok = json.loads(tk["out"] or "{}").get("accessToken")
    except Exception:  # noqa: BLE001
        pass
    emit({"step": "session", "sub": sid, "token_len": len(tok or "")})
    if not sid or not tok:
        emit({"step": "fatal", "why": "no session"})
        return

    st, items = rg_items(tok, sid)
    emit({"step": "rg-before", "http": st, "total": len(items),
          "ours": [i["name"] for i in mine(items)]})

    # 1) NVIDIA catalogue sizes with raw ARM error capture
    for region, size in (("australiaeast", "Standard_NV12s_v3"),
                         ("westus2", "Standard_NV6ads_A10_v5")):
        r, keep, tail = debug_create(size, region)
        emit({"step": "nvidia-debug", "region": region, "size": size, "rc": r["rc"],
              "secs": r["secs"], "filtered": keep, "tail": tail})
        cleanup(tok, sid, "post-attempt-cleanup")

    # 2) the only NV family with nonzero westus2 quota: NVv4 (AMD), regional attempt
    r, keep, tail = debug_create("Standard_NV4as_v4", "westus2", timeout=900)
    ok = r["rc"] == 0
    emit({"step": "nvv4-create", "region": "westus2", "size": "Standard_NV4as_v4",
          "ok": ok, "secs": r["secs"], "filtered": keep,
          "stdout": (r["out"] or "")[:600], "tail": tail if not ok else ""})
    if ok:
        st, vm = arm(tok, (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}"
                           f"/providers/Microsoft.Compute/virtualMachines/{TRY_VM}"
                           "?api-version=2024-07-01&$expand=instanceView"))
        sts = [s.get("code") for s in
               (((vm.get("properties") or {}).get("instanceView") or {}).get("statuses") or [])]
        emit({"step": "nvv4-readback", "http": st, "location": vm.get("location"),
              "vm_size": (((vm.get("properties") or {}).get("hardwareProfile") or {})
                          .get("vmSize")),
              "provisioning": ((vm.get("properties") or {}).get("provisioningState")),
              "statuses": sts})
        script = ("echo C211-I120186-RUNSTART; "
                  "for d in /sys/bus/pci/devices/*; do v=$(cat $d/vendor 2>/dev/null); "
                  "case \"$v\" in 0x10de|0x1002) echo GPU_PCI $d vendor=$v "
                  "device=$(cat $d/device 2>/dev/null) class=$(cat $d/class 2>/dev/null);; esac; "
                  "done; command -v nvidia-smi && nvidia-smi -L || true")
        rc = az(["vm", "run-command", "invoke", "-g", RG, "-n", TRY_VM,
                 "--command-id", "RunShellScript", "--scripts", script,
                 "--output", "json"], timeout=600)
        try:
            d = json.loads(rc["out"] or "{}")
            txt = "\n".join(str(v.get("message", "")) for v in (d.get("value") or []))
        except Exception:  # noqa: BLE001
            txt = (rc["out"] or "") + (rc["err"] or "")
        emit({"step": "nvv4-device-proof", "text": txt[:3000]})
        d = az(["vm", "delete", "-g", RG, "-n", TRY_VM, "--yes"], timeout=900)
        emit({"step": "nvv4-delete", "rc": d["rc"], "stderr": (d["err"] or "")[:300]})

    # 3) final cleanup + absence
    cleanup(tok, sid, "final-cleanup")
    rem = mine(rg_items(tok, sid)[1])
    for _ in range(3):
        if not rem:
            break
        time.sleep(20)
        cleanup(tok, sid, "final-cleanup-retry")
        rem = mine(rg_items(tok, sid)[1])
    l = az(["vm", "list", "-g", RG, "--output", "json"], timeout=180)
    try:
        vms = sorted([v.get("name") for v in json.loads(l["out"] or "[]")])
    except Exception:  # noqa: BLE001
        vms = []
    st, items2 = rg_items(tok, sid)
    emit({"step": "final", "http": st, "rg_total": len(items2),
          "ours_remaining": [i["name"] for i in mine(items2)], "vms_in_rg": vms,
          "verdict": "DIAG_DONE_CLEAN" if not mine(items2) else "LEFTOVERS_REMAIN"})


if __name__ == "__main__":
    main()
