#!/usr/bin/env python3
"""C211-I120065 phase 2: deploy EXACTLY ONE on-demand NV-series GPU marker, capture
device proof, delete it, verify absence. Runs inside the SSW.Rules deploy-infrastructure
job after azure/login@v2 (fork tree checkout). stdlib-only. Bounded timeouts.
"""
import json
import subprocess
import sys
import time

TAG = "C211_I120065_P2"
RG = "c211-i120065-rg"
VM = "c211-i120065-marker"
CANDIDATES = [
    ("australiaeast", "Standard_NV6"),
    ("westus2", "Standard_NV6"),
    ("australiaeast", "Standard_NV12"),
    ("westus2", "Standard_NV12"),
]
CLOUD_INIT = """#cloud-config
runcmd:
  - [ sh, -c, "echo C211-I120065-MARKER-BOOT-OK > /dev/ttyS0" ]
"""


def emit(obj):
    print(TAG + " " + json.dumps(obj, default=str), flush=True)


def az(args, timeout=300):
    t0 = time.time()
    try:
        p = subprocess.run(["az"] + args, capture_output=True, text=True, timeout=timeout)
        return {"rc": p.returncode, "stdout": p.stdout, "stderr": p.stderr,
                "secs": round(time.time() - t0, 1)}
    except subprocess.TimeoutExpired as e:
        return {"rc": 124, "stdout": str(e.stdout or ""), "stderr": "TIMEOUT after %ss" % timeout,
                "secs": round(time.time() - t0, 1)}
    except Exception as e:  # noqa: BLE001
        return {"rc": 1, "stdout": "", "stderr": str(e), "secs": round(time.time() - t0, 1)}


def short(r, n=900):
    return {"rc": r["rc"], "secs": r["secs"],
            "stdout": (r["stdout"] or "")[:n], "stderr": (r["stderr"] or "")[:n]}


def cleanup(vm_created):
    out = {}
    if vm_created:
        d = az(["vm", "delete", "-g", RG, "-n", VM, "--yes"], timeout=600)
        out["vm_delete"] = short(d, 500)
    s = az(["vm", "show", "-g", RG, "-n", VM, "--output", "json"], timeout=120)
    out["vm_show_after"] = short(s, 400)
    l = az(["vm", "list", "-g", RG, "--output", "json"], timeout=120)
    try:
        remaining = [v.get("name") for v in json.loads(l["stdout"] or "[]")]
    except Exception:  # noqa: BLE001
        remaining = "parse_error"
    out["vm_list_after"] = {"rc": l["rc"], "remaining_vms": remaining,
                            "stderr": (l["stderr"] or "")[:300]}
    return out


def main():
    emit({"step": "start"})
    rc = az(["account", "show", "--output", "json"], timeout=120)
    try:
        acct = json.loads(rc["stdout"])
    except Exception:  # noqa: BLE001
        acct = {}
    emit({"step": "account", "sub": acct.get("id"), "tenant": acct.get("tenantId"),
          "state": acct.get("state"), "user_type": (acct.get("user") or {}).get("type")})
    if rc["rc"] != 0 or acct.get("state") != "Enabled":
        emit({"step": "fatal", "why": "no enabled az session", "detail": short(rc)})
        return

    # Resource group: create a dedicated one; fall back to an existing RG if denied.
    g = az(["group", "create", "-n", RG, "-l", CANDIDATES[0][0], "--output", "json"],
           timeout=180)
    emit({"step": "rg-create", "result": short(g, 700)})
    group_created = g["rc"] == 0
    if not group_created:
        fb = "SSW.Rules.Staging"
        s = az(["group", "show", "-n", fb, "--output", "json"], timeout=120)
        emit({"step": "rg-fallback", "rg": fb, "show_rc": s["rc"]})
        if s["rc"] != 0:
            emit({"step": "fatal", "why": "no usable resource group"})
            return

    ci_path = "/tmp/c211-i120065-cloud-init.yaml"
    try:
        with open(ci_path, "w") as f:
            f.write(CLOUD_INIT)
    except Exception as e:  # noqa: BLE001
        emit({"step": "fatal", "why": "cannot write cloud-init", "err": str(e)})
        return

    vm_created = False
    created = None
    for region, size in CANDIDATES:
        args = ["vm", "create", "-g", RG, "-n", VM, "--image", "Canonical:0001-com-ubuntu-server-jammy:22.04:latest",
                "--size", size, "--location", region, "--admin-username", "c211probe",
                "--generate-ssh-keys", "--custom-data", ci_path, "--output", "json",
                "--only-show-errors"]
        if group_created:
            # keep the dedicated RG in the same region as the VM on first attempt only
            pass
        r = az(args, timeout=900)
        ok = r["rc"] == 0
        emit({"step": "vm-create", "region": region, "size": size, "ok": ok,
              "result": short(r, 1200)})
        if ok:
            vm_created = True
            try:
                created = json.loads(r["stdout"])
            except Exception:  # noqa: BLE001
                created = {}
            emit({"step": "vm-created", "id": created.get("id"),
                  "location": created.get("location"),
                  "publicIp": (created.get("publicIpAddress") or "")[:60]})
            break
    if not vm_created:
        out = cleanup(False)
        emit({"step": "cleanup", **out})
        emit({"step": "done", "verdict": "GATE_VM_CREATE_FAILED"})
        return

    # Instance view / power state
    iv = az(["vm", "get-instance-view", "-g", RG, "-n", VM, "--output", "json"], timeout=180)
    try:
        ivd = json.loads(iv["stdout"])
        statuses = [s.get("code") for s in ((ivd.get("instanceView") or {}).get("statuses") or [])]
    except Exception:  # noqa: BLE001
        statuses = []
    emit({"step": "instance-view", "rc": iv["rc"], "statuses": statuses})

    # NVIDIA GPU driver extension (installs a driver matching the GPU)
    ext = az(["vm", "extension", "set", "-g", RG, "--vm-name", VM,
              "--name", "NvidiaGpuDriverLinux", "--publisher", "Microsoft.HpcCompute",
              "--output", "json"], timeout=900)
    emit({"step": "gpu-driver-extension", "result": short(ext, 1200)})

    # Device proof via run-command (provider-side execution)
    smi = az(["vm", "run-command", "invoke", "-g", RG, "-n", VM,
              "--command-id", "RunShellScript",
              "--scripts", "nvidia-smi -L; nvidia-smi --query-gpu=uuid,name,memory.total,driver_version --format=csv,noheader; lspci -nn | grep -i nvidia",
              "--output", "json"], timeout=600)
    emit({"step": "nvidia-smi", "result": short(smi, 2000)})

    # Serial console boot log (marker + kernel/GPU lines)
    boot = az(["vm", "boot-diagnostics", "get-boot-log", "-g", RG, "-n", VM], timeout=180)
    blog = (boot.get("stdout") or "")
    emit({"step": "serial-log", "rc": boot["rc"], "len": len(blog),
          "tail": blog[-3000:]})

    # Teardown
    out = cleanup(True)
    emit({"step": "cleanup", **out})
    if group_created:
        gd = az(["group", "delete", "-n", RG, "--yes"], timeout=900)
        ge = az(["group", "exists", "-n", RG], timeout=120)
        emit({"step": "rg-delete", "delete": short(gd, 500),
              "exists_after": (ge.get("stdout") or "").strip(), "exists_rc": ge["rc"]})
    emit({"step": "done", "verdict": "MARKER_CYCLE_COMPLETE"})


if __name__ == "__main__":
    main()
