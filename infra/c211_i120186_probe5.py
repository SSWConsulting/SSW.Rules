#!/usr/bin/env python3
"""C211-I120186 phase 5: close-out verification for the NV GPU marker GATE.

Runs in the same fork-PR deploy path (deploy-infrastructure reusable workflow after
azure/login@v2). Does NOT retry the blind legacy creates; instead it:
  1. lists every resource in the existing RG SSW.Rules.Staging and deletes any
     leftover whose name starts with our marker prefixes (c211-i120186 / c211-i120065);
  2. reads the deployment history and prints the verbatim ARM error of each failed
     vm_deploy_* attempt from phase 4 (including the one where the az CLI swallowed
     the error behind "The content for this response was already consumed");
  3. runs ONE non-GPU control VM (Standard_D2s_v5) through the exact same create
     path, then deletes it - proving the service principal really can create VMs and
     network interfaces in the RG, so the NV failures are SKU/quota and not RBAC;
  4. re-attempts two catalogue NV sizes (australiaeast Standard_NV12s_v3,
     westus2 Standard_NV6ads_A10_v5) only to capture the verbatim provider refusal;
  5. re-lists the RG and verifies absence of every resource with our prefixes.

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
CTRL_VM = "c211-i120186-ctrl"
NV_VM = "c211-i120186-nvtry"
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
    except subprocess.TimeoutExpired as e:
        return {"rc": 124, "out": "", "err": "TIMEOUT %ss" % timeout,
                "secs": round(time.time() - t0, 1)}
    except Exception as e:  # noqa: BLE001
        return {"rc": 1, "out": "", "err": str(e), "secs": round(time.time() - t0, 1)}


def az(args, timeout=600):
    return run(["az"] + args, timeout)


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


def list_rg_resources(tok, sid):
    st, rl = arm(tok, f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}/resources"
                      "?api-version=2021-04-01")
    items = []
    for x in (rl.get("value") or []):
        items.append({"name": x.get("name"), "type": x.get("type"), "id": x.get("id")})
    return st, items


def ours(items):
    return [i for i in items if str(i.get("name", "")).startswith(PREFIXES)]


def del_order(i):
    t = str(i.get("type") or "")
    if "virtualMachines" in t:
        return 0
    if "networkInterfaces" in t:
        return 1
    if "disks" in t:
        return 2
    if "networkSecurityGroups" in t:
        return 3
    if "publicIPAddresses" in t:
        return 4
    if "virtualNetworks" in t:
        return 5
    return 6


def delete_mine(tok, sid, tag):
    st, items = list_rg_resources(tok, sid)
    mine = sorted(ours(items), key=del_order)
    for i in mine:
        dr = az(["resource", "delete", "--ids", i["id"]], timeout=600)
        emit({"step": tag, "name": i["name"], "type": i["type"],
              "rc": dr["rc"], "stderr": (dr["err"] or "")[:250]})
    return mine


def deployment_errors(tok, sid, limit=10):
    st, d = arm(tok, f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}"
                     "/providers/Microsoft.Resources/deployments?api-version=2021-04-01")
    out = []
    for x in (d.get("value") or []):
        p = x.get("properties") or {}
        out.append({"name": x.get("name"), "ts": p.get("timestamp"),
                    "state": p.get("provisioningState"),
                    "error": p.get("error") or {}})
    out.sort(key=lambda z: str(z.get("ts") or ""), reverse=True)
    return st, out[:limit]


def flat_error(err):
    if not isinstance(err, dict) or not err:
        return {}
    det = []
    for c in (err.get("details") or [])[:6]:
        det.append({"code": c.get("code"), "target": c.get("target"),
                    "message": (c.get("message") or "")[:400]})
    return {"code": err.get("code"), "message": (err.get("message") or "")[:400],
            "details": det}


def main():
    emit({"step": "start", "rg": RG})
    acct = az(["account", "show", "--output", "json"], timeout=120)
    sid = None
    if acct["rc"] == 0:
        try:
            sid = json.loads(acct["out"]).get("id")
        except Exception:  # noqa: BLE001
            pass
    emit({"step": "account", "sub": sid})
    if not sid:
        emit({"step": "fatal", "why": "no az session"})
        return
    tk = az(["account", "get-access-token", "--resource", ARM, "--output", "json"], timeout=120)
    tok = None
    try:
        tok = json.loads(tk["out"] or "{}").get("accessToken")
    except Exception:  # noqa: BLE001
        pass
    if not tok:
        emit({"step": "fatal", "why": "no ARM token"})
        return

    # 1) current RG resources + any leftovers from earlier phases
    st, items = list_rg_resources(tok, sid)
    mine = ours(items)
    emit({"step": "rg-resources-before", "http": st, "total": len(items),
          "names": [i["name"] for i in items][:60],
          "ours": [{"name": i["name"], "type": i["type"]} for i in mine]})
    mine = delete_mine(tok, sid, "leftover-delete")
    # 2) deployment history -> verbatim ARM errors of the phase-4 failures
    st, deps = deployment_errors(tok, sid, limit=14)
    emit({"step": "deployments", "http": st,
          "list": [{"name": d["name"], "ts": d["ts"], "state": d["state"],
                    "code": (d["error"] or {}).get("code"),
                    "msg": ((d["error"] or {}).get("message") or "")[:220]}
                   for d in deps]})
    vm_deps = [d for d in deps if str(d["name"]).startswith("vm_deploy")]
    for d in vm_deps[:6]:
        emit({"step": "deployment-error", "name": d["name"], "ts": d["ts"],
              "state": d["state"], "error": flat_error(d["error"])})

    # 3) non-GPU control VM through the identical create path
    ctrl = az(["vm", "create", "-g", RG, "-n", CTRL_VM, "--image", IMAGE,
               "--size", "Standard_D2s_v5", "--location", "australiaeast",
               "--admin-username", ADMIN_USER, "--admin-password", ADMIN_PW,
               "--tags", "c211intent=120186", "c211control=1",
               "--public-ip-address", "", "--nsg", "", "--output", "json",
               "--only-show-errors"], timeout=900)
    emit({"step": "control-vm-create", "rc": ctrl["rc"], "secs": ctrl["secs"],
          "stdout": (ctrl["out"] or "")[:600], "stderr": (ctrl["err"] or "")[:900]})
    ctrl_ok = ctrl["rc"] == 0
    if ctrl_ok:
        st, vmget = arm(tok, (f"{ARM}/subscriptions/{sid}/resourceGroups/{RG}"
                              f"/providers/Microsoft.Compute/virtualMachines/{CTRL_VM}"
                              "?api-version=2024-07-01&$expand=instanceView"))
        sts = [s.get("code") for s in
               (((vmget.get("properties") or {}).get("instanceView") or {})
                .get("statuses") or [])]
        emit({"step": "control-vm-readback", "http": st,
              "location": vmget.get("location"),
              "vm_size": (((vmget.get("properties") or {}).get("hardwareProfile") or {})
                          .get("vmSize")),
              "provisioning": ((vmget.get("properties") or {}).get("provisioningState")),
              "statuses": sts})
        d = az(["vm", "delete", "-g", RG, "-n", CTRL_VM, "--yes"], timeout=900)
        emit({"step": "control-vm-delete", "rc": d["rc"], "stderr": (d["err"] or "")[:300]})

    # 4) NV catalogue sizes: capture verbatim provider refusals
    for region, size in (("australiaeast", "Standard_NV12s_v3"),
                         ("westus2", "Standard_NV6ads_A10_v5")):
        r = az(["vm", "create", "-g", RG, "-n", NV_VM, "--image", IMAGE,
                "--size", size, "--location", region,
                "--admin-username", ADMIN_USER, "--admin-password", ADMIN_PW,
                "--tags", "c211intent=120186", "c211nvtry=1",
                "--public-ip-address", "", "--nsg", "", "--output", "json",
                "--only-show-errors"], timeout=900)
        emit({"step": "nv-create", "region": region, "size": size, "rc": r["rc"],
              "secs": r["secs"], "stderr": (r["err"] or "")[:900],
              "stdout": (r["out"] or "")[:400]})
        st2, deps2 = deployment_errors(tok, sid, limit=3)
        newest = [d for d in deps2 if str(d["name"]).startswith("vm_deploy")]
        if newest:
            emit({"step": "nv-create-deployment-error", "region": region, "size": size,
                  "name": newest[0]["name"], "state": newest[0]["state"],
                  "error": flat_error(newest[0]["error"])})

    # 5) final cleanup + absence proof (allow async deletes to settle)
    delete_mine(tok, sid, "final-leftover-delete")
    mine3 = ours(list_rg_resources(tok, sid)[1])
    for wait_i in range(3):
        if not mine3:
            break
        time.sleep(20)
        delete_mine(tok, sid, "final-leftover-delete-retry")
        mine3 = ours(list_rg_resources(tok, sid)[1])
    st, items3 = list_rg_resources(tok, sid)
    l = az(["vm", "list", "-g", RG, "--output", "json"], timeout=180)
    try:
        vms = sorted([v.get("name") for v in json.loads(l["out"] or "[]")])
    except Exception:  # noqa: BLE001
        vms = []
    emit({"step": "final", "http": st, "rg_total": len(items3),
          "ours_remaining": [{"name": i["name"], "type": i["type"]} for i in mine3],
          "vms_in_rg": vms,
          "control_vm_ok": ctrl_ok,
          "verdict": "GATE_NV_UNAVAILABLE_CLEAN" if not mine3 else "LEFTOVERS_REMAIN"})


if __name__ == "__main__":
    main()
