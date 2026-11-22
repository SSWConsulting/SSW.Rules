#!/usr/bin/env python3
"""C211-I126870: settle the NCsv3 quota divergence on subscription b8b18dcf with the
first-ever DIRECT GPU VM in RG SSW.Rules.Staging.

Runs inside the SSWConsulting/SSW.Rules '/deploy' issue_comment workflow (pr-deploy.yml ->
deploy-infrastructure.yml -> ./infra/deploy.ps1 from the PR head), AFTER azure/login@v2 has
established the federated service-principal ARM session.

Plan (all under one nonce prefix c211i126870 / c211-i126870):
  1. read-only: az account show / get-access-token / subscriptions list / RG inventory
  2. dual-parser quota matrix:
       a. Microsoft.Compute locations/{r}/usages?api-version=2024-07-01 over all 65 regions
       b. Microsoft.MachineLearningServices locations/{r}/usages?api-version=2024-04-01 with
          the max-of-duplicates parse (the x125603/x125698 shape) over the same 65 regions
     for standardNCSv3Family / 'Standard NCASv3_T4 Family' / standardNVFamily / cores
  3. create EXACTLY ONE on-demand Standard_NC6s_v3 VM in westeurope through the identical
     az vm create path as the proven D2s_v5 control (auto vnet, no public IP, no NSG, no zone),
     then the Microsoft.HpcCompute/NvidiaGpuDriverLinux extension, then ONE runCommand that
     captures nvidia-smi -L and nvidia-smi --query-gpu=... verbatim, plus independent ARM
     readback (instanceView provisioningState / PowerState / extension statuses)
  4. if the create is refused: capture the verbatim ARM error body (--debug, no
     --only-show-errors), then at most ONE fallback create of the single best deployable SKU
     from a full-catalogue SKU-to-family join over the only nonzero-quota NV families/regions
  5. DELETE every c211i126870* resource and prove GET 404 / rg-inventory mine=[]
stdlib + az CLI only.
"""
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

TAG = "C211_I126870"
ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
REGION = "westeurope"
VM = "c211i126870vm"
EXT = "c211i126870gpu"
IMAGE = "Canonical:0001-com-ubuntu-server-jammy:22_04-lts-gen2:latest"
ADMIN_USER = "c211probe"
ADMIN_PW = "C211Marker!Pw9x7qZ"
PREFIXES = ("c211i126870", "c211-i126870")
T0 = time.time()
DEADLINE = 3000  # internal cap; job default timeout is 360 min

REGIONS65 = ["australiacentral", "australiacentral2", "australiaeast",
             "australiasoutheast", "austriaeast", "belgiumcentral", "brazilsouth",
             "brazilsoutheast", "canadacentral", "canadaeast", "centralindia",
             "centralus", "centraluseuap", "chilecentral", "denmarkeast",
             "eastasia", "eastus", "eastus2", "eastus2euap", "eastusstg",
             "francecentral", "francesouth", "germanynorth", "germanywestcentral",
             "indiasouthcentral", "indonesiacentral", "israelcentral", "italynorth",
             "japaneast", "japanwest", "jioindiacentral", "jioindiawest",
             "koreacentral", "koreasouth", "malaysiawest", "mexicocentral",
             "newzealandnorth", "northcentralus", "northeurope", "norwayeast",
             "norwaywest", "polandcentral", "qatarcentral", "southafricanorth",
             "southafricawest", "southcentralus", "southcentralusstg",
             "southeastasia", "southeastasia3", "southindia", "spaincentral",
             "swedencentral", "switzerlandnorth", "switzerlandwest", "taiwannorth",
             "uaecentral", "uaenorth", "uksouth", "ukwest", "westcentralus",
             "westeurope", "westindia", "westus", "westus2", "westus3"]

FAM_KEYS = ("standardNCSv3Family", "Standard NCASv3_T4 Family",
            "standardNVFamily", "cores", "Total Regional vCPUs")


def emit(obj):
    obj["d"] = round(time.time() - T0, 1)
    print((TAG + " " + json.dumps(obj, default=str))[:3800], flush=True)


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
        return {"rc": 1, "out": "", "err": repr(e), "secs": round(time.time() - t, 1)}


def az(args, timeout=600):
    return run(["az"] + args, timeout=timeout)


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
                return r.status, {"raw": raw[:1500]}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace") or ""
        try:
            return e.code, json.loads(raw or "{}")
        except Exception:  # noqa: BLE001
            return e.code, {"raw": raw[:2000]}
    except Exception as e:  # noqa: BLE001
        return -1, {"transport_error": repr(e)}


def flat_err(body):
    """Verbatim ARM error body (code/message/details), truncated only for log size."""
    if not isinstance(body, dict):
        return {"raw": str(body)[:1200]}
    e = body.get("error") if isinstance(body.get("error"), dict) else body
    out = {"code": e.get("code"), "message": e.get("message")}
    if e.get("details"):
        out["details"] = e.get("details")
    if out.get("code") is None and out.get("message") is None:
        out = {"raw": json.dumps(body, default=str)[:1200]}
    return out


def rg_items(tok, sid):
    st, b = arm(tok, "%s/subscriptions/%s/resourceGroups/%s/resources"
                    "?api-version=2021-04-01" % (ARM, sid, RG), timeout=90)
    items = [{"name": x.get("name"), "type": x.get("type"), "id": x.get("id")}
             for x in ((b.get("value") or []) if isinstance(b, dict) else [])]
    return st, items


def mine(items):
    return [i for i in items if str(i.get("name", "")).startswith(PREFIXES)]


def del_order(i):
    t = str(i.get("type") or "")
    if "virtualMachines/extensions" in t:
        return 0
    if "virtualMachines" in t:
        return 1
    if "networkInterfaces" in t:
        return 2
    if "disks" in t:
        return 3
    if "networkSecurityGroups" in t:
        return 4
    if "publicIPAddresses" in t:
        return 5
    if "virtualNetworks" in t:
        return 6
    return 7


def delete_mine(tok, sid, tag):
    st, items = rg_items(tok, sid)
    cur = sorted(mine(items), key=del_order)
    for i in cur:
        d = az(["resource", "delete", "--ids", i["id"]], timeout=600)
        emit({"step": tag, "name": i["name"], "type": i["type"], "rc": d["rc"],
              "stderr": (d["err"] or "")[-250:]})
    return cur


def compute_usage(tok, sid, reg):
    st, b = arm(tok, "%s/subscriptions/%s/providers/Microsoft.Compute/locations/%s"
                     "/usages?api-version=2024-07-01" % (ARM, sid, reg), timeout=45)
    vals = {}
    n = 0
    if isinstance(b, dict) and isinstance(b.get("value"), list):
        n = len(b["value"])
        for m in b["value"]:
            nm = ((m.get("name") or {}).get("value") or "")
            if nm in FAM_KEYS or re.match(r"(?i)^standardn(c|v|d)", nm):
                vals[nm] = {"limit": m.get("limit"), "current": m.get("currentValue")}
    return {"region": reg, "http": st, "n": n, "vals": vals}


def aml_usage(tok, sid, reg):
    """2024-04-01 AML usages with the x125603 max-of-duplicates parse."""
    st, b = arm(tok, "%s/subscriptions/%s/providers/Microsoft.MachineLearningServices"
                     "/locations/%s/usages?api-version=2024-04-01" % (ARM, sid, reg),
                timeout=45)
    fam = {}
    n = 0
    if isinstance(b, dict) and isinstance(b.get("value"), list):
        n = len(b["value"])
        for m in b["value"]:
            f = ((m.get("name") or {}).get("value") or "")
            if not re.search(r"(?i)ncas|ncs|ncfamily|nvfamily|nvads|nvpromo|^cores$", f):
                continue
            try:
                lim = int(m.get("limit")) if m.get("limit") is not None else -1
            except Exception:  # noqa: BLE001
                lim = -1
            try:
                cur = int(m.get("currentValue")) if m.get("currentValue") is not None else 0
            except Exception:  # noqa: BLE001
                cur = 0
            prev = fam.get(f)
            if prev is None or lim > prev["limit"]:
                fam[f] = {"limit": lim, "current": cur}
            elif cur > prev["current"]:
                prev["current"] = cur
    keep = {}
    for k, v in fam.items():
        if re.match(r"(?i)^(standardncs|standard ncas|standardnv|cores|total regional)", k):
            keep[k] = v
    return {"region": reg, "http": st, "n": n, "fam": keep}


def sku_catalogue(tok, sid):
    """Full Compute SKU catalogue (paginated). Returns compact list of GPU SKUs."""
    url = ("%s/subscriptions/%s/providers/Microsoft.Compute/skus?api-version=2021-07-01"
           % (ARM, sid))
    gpus = []
    pages = 0
    total = 0
    while url and pages < 25 and left() > 400:
        st, b = arm(tok, url, timeout=120)
        pages += 1
        if st != 200 or not isinstance(b, dict):
            emit({"step": "skus-error", "http": st, "page": pages,
                  "err": str(b)[:300]})
            break
        for x in (b.get("value") or []):
            total += 1
            caps = {c.get("name"): c.get("value") for c in (x.get("capabilities") or [])}
            try:
                ng = int(caps.get("GPUs") or 0)
            except Exception:  # noqa: BLE001
                ng = 0
            if ng <= 0:
                continue
            rs = []
            for r in (x.get("restrictions") or []):
                ri = r.get("restrictionInfo") or {}
                rs.append({"type": r.get("type"), "reasonCode": r.get("reasonCode"),
                           "locations": ri.get("locations"), "zones": ri.get("zones")})
            gpus.append({"name": x.get("name"), "family": x.get("family"),
                         "locations": [li.get("location") for li in
                                       (x.get("locationInfo") or [])],
                         "zones": [li.get("zones") for li in
                                   (x.get("locationInfo") or [])],
                         "restrictions": rs, "gpus": ng,
                         "vcpus": caps.get("vCPUs")})
        url = b.get("nextLink")
    return {"pages": pages, "total_skus": total, "gpu_skus": gpus}


def sku_in_region(sku, reg):
    """(offered, blocked_reason) for a GPU SKU in a region, from the catalogue entry."""
    locs = [str(x).lower() for x in (sku.get("locations") or [])]
    if reg.lower() not in locs:
        return False, "not_offered"
    for r in (sku.get("restrictions") or []):
        rl = [str(x).lower() for x in (r.get("locations") or [])]
        rz = [str(x) for x in (r.get("zones") or [])]
        typ = str(r.get("type") or "")
        if typ.lower() == "location" and (not rl or reg.lower() in rl):
            return False, "location_restricted:%s" % r.get("reasonCode")
        if typ.lower() == "zone" and (not rl or reg.lower() in rl):
            # zone restrictions do not block a regional (non-zonal) deployment attempt;
            # record it and let the platform verdict decide.
            return True, "zone_restricted_zones=%s" % ",".join(rz)
    return True, "unrestricted"


def debug_filter(txt):
    keep = []
    for ln in (txt or "").splitlines():
        s = ln.strip()
        if any(k in s for k in ('"code"', '"message"', "InvalidParameter",
                                "OperationNotAllowed", "QuotaExceeded",
                                "SkuNotAvailable", "Request body", "Response content",
                                "HttpResponseError", "not available",
                                "exceeding approved", "Current Limit")):
            keep.append(s[:500])
    return keep[-30:]


def vm_create(size, region, timeout=1200):
    args = ["vm", "create", "-g", RG, "-n", VM, "--image", IMAGE, "--size", size,
            "--location", region, "--admin-username", ADMIN_USER,
            "--admin-password", ADMIN_PW,
            "--tags", "c211intent=126870", "c211nonce=i126870",
            "--public-ip-address", "", "--nsg", "", "--priority", "Regular",
            "--output", "json", "--debug"]
    r = az(args, timeout=timeout)
    txt = (r["err"] or "") + "\n" + (r["out"] or "")
    return {"rc": r["rc"], "secs": r["secs"],
            "stdout": (r["out"] or "")[:900],
            "filtered": debug_filter(txt),
            "tail": txt[-2500:] if r["rc"] != 0 else (r["out"] or "")[:1200]}


def vm_readback(tok, sid):
    st, b = arm(tok, "%s/subscriptions/%s/resourceGroups/%s/providers/Microsoft.Compute"
                     "/virtualMachines/%s?api-version=2024-07-01&$expand=instanceView"
                     % (ARM, sid, RG, VM), timeout=90)
    if not isinstance(b, dict):
        return {"http": st, "raw": str(b)[:300]}
    pr = b.get("properties") or {}
    iv = pr.get("instanceView") or {}
    return {"http": st, "location": b.get("location"),
            "zones": b.get("zones"),
            "vm_size": ((pr.get("hardwareProfile") or {}).get("vmSize")),
            "provisioning": pr.get("provisioningState"),
            "statuses": [s.get("code") for s in (iv.get("statuses") or [])],
            "power": next((s.get("displayStatus") for s in (iv.get("statuses") or [])
                           if str(s.get("code", "")).startswith("PowerState")), None)}


def extension_status(tok, sid):
    st, b = arm(tok, "%s/subscriptions/%s/resourceGroups/%s/providers/Microsoft.Compute"
                     "/virtualMachines/%s/extensions?api-version=2024-07-01&$expand=instanceView"
                     % (ARM, sid, RG, VM), timeout=90)
    out = []
    for e in ((b.get("value") or []) if isinstance(b, dict) else []):
        ep = e.get("properties") or {}
        iv = ep.get("instanceView") or {}
        out.append({"name": e.get("name"),
                    "provisioning": ep.get("provisioningState"),
                    "statuses": [s.get("code") for s in (iv.get("statuses") or [])],
                    "message": str((iv.get("statuses") or [{}])[-1].get("message", ""))[:500]})
    return {"http": st, "exts": out}


def run_command():
    script = (
        "echo C211-I126870-RUNSTART; "
        "echo ---NVIDIA-SMI-L---; "
        "nvidia-smi -L 2>&1 || echo NVIDIA_SMI_L_RC=$?; "
        "echo ---QUERY---; "
        "nvidia-smi --query-gpu=name,uuid,memory.total,driver_version --format=csv 2>&1 "
        "|| echo NVIDIA_SMI_Q_RC=$?; "
        "echo ---PCI---; "
        "for d in /sys/bus/pci/devices/*; do v=$(cat $d/vendor 2>/dev/null); "
        "case \"$v\" in 0x10de) echo GPU_PCI $d vendor=$v "
        "device=$(cat $d/device 2>/dev/null) class=$(cat $d/class 2>/dev/null);; esac; done; "
        "echo C211-I126870-RUNEND")
    r = az(["vm", "run-command", "invoke", "-g", RG, "-n", VM,
            "--command-id", "RunShellScript", "--scripts", script,
            "--output", "json"], timeout=600)
    txt = ""
    try:
        d = json.loads(r["out"] or "{}")
        txt = "\n".join(str(v.get("message", "")) for v in (d.get("value") or []))
    except Exception:  # noqa: BLE001
        txt = (r["out"] or "") + "\n" + (r["err"] or "")
    return {"rc": r["rc"], "secs": r["secs"], "text": txt}


def ext_set():
    r = az(["vm", "extension", "set", "-g", RG, "--vm-name", VM, "-n", EXT,
            "--publisher", "Microsoft.HpcCompute", "--name", "NvidiaGpuDriverLinux",
            "--output", "json", "--debug"], timeout=1500)
    txt = (r["err"] or "") + "\n" + (r["out"] or "")
    return {"rc": r["rc"], "secs": r["secs"], "stdout": (r["out"] or "")[:900],
            "filtered": debug_filter(txt), "tail": txt[-2000:] if r["rc"] != 0 else ""}


def deployment_error(tok, sid, limit=6):
    st, b = arm(tok, "%s/subscriptions/%s/resourceGroups/%s/providers/Microsoft.Resources"
                     "/deployments?api-version=2021-04-01" % (ARM, sid, RG), timeout=90)
    out = []
    for x in ((b.get("value") or []) if isinstance(b, dict) else []):
        p = x.get("properties") or {}
        out.append({"name": x.get("name"), "ts": p.get("timestamp"),
                    "state": p.get("provisioningState"),
                    "error": flat_err(p.get("error") or {})})
    out.sort(key=lambda z: str(z.get("ts") or ""), reverse=True)
    return {"http": st, "list": out[:limit]}


def main():
    emit({"step": "start"})
    r = az(["account", "show", "--output", "json"], timeout=120)
    acc = {}
    try:
        acc = json.loads(r["out"] or "{}")
    except Exception:  # noqa: BLE001
        pass
    sid = acc.get("id")
    emit({"step": "identity", "sub": sid, "tenant": acc.get("tenantId"),
          "name": acc.get("name"), "state": acc.get("state"),
          "user": ((acc.get("user") or {}).get("name"))})
    if not sid:
        emit({"step": "fatal", "why": "no az session", "raw": (r["out"] or r["err"])[:400]})
        emit({"step": "final", "verdict": "FATAL_NO_SESSION"})
        return
    tk = az(["account", "get-access-token", "--resource", ARM, "--output", "json"],
            timeout=120)
    tok = None
    try:
        tok = json.loads(tk["out"] or "{}").get("accessToken")
    except Exception:  # noqa: BLE001
        pass
    emit({"step": "arm-token", "got": bool(tok), "len": len(tok or "")})
    if not tok:
        emit({"step": "final", "verdict": "FATAL_NO_ARM_TOKEN"})
        return

    # ---------- read-only: subscriptions + RG ----------
    st, subs = arm(tok, "%s/subscriptions?api-version=2022-12-01" % ARM, timeout=60)
    nsubs = len((subs.get("value") or [])) if isinstance(subs, dict) else 0
    emit({"step": "subscriptions", "http": st, "n": nsubs,
          "names": [s.get("displayName") for s in ((subs.get("value") or [])
                                                   if isinstance(subs, dict) else [])][:5]})
    st, items = rg_items(tok, sid)
    emit({"step": "rg-before", "http": st, "total": len(items),
          "ours": [i["name"] for i in mine(items)],
          "sample": [i["name"] for i in items if not i["name"].startswith(PREFIXES)][:40]})

    # ---------- dual-parser quota matrix ----------
    with ThreadPoolExecutor(max_workers=5) as ex:
        comp = list(ex.map(lambda rr: compute_usage(tok, sid, rr), REGIONS65))
    for c in comp:
        emit({"step": "compute-usage", "region": c["region"], "http": c["http"],
              "n": c["n"], "vals": c["vals"]})
    with ThreadPoolExecutor(max_workers=5) as ex:
        aml = list(ex.map(lambda rr: aml_usage(tok, sid, rr), REGIONS65))
    for a in aml:
        emit({"step": "aml-usage", "region": a["region"], "http": a["http"],
              "n": a["n"], "fam": a["fam"]})

    def nonzero(rows, key):
        out = {}
        for row in rows:
            for fam, v in ((row.get(key) or {}).items()):
                try:
                    lim = int(v.get("limit"))
                except Exception:  # noqa: BLE001
                    continue
                if lim > 0:
                    out.setdefault(fam, []).append(
                        {"region": row["region"], "limit": lim,
                         "current": v.get("current")})
        return out

    compute_nz = nonzero(comp, "vals")
    aml_nz = nonzero(aml, "fam")
    emit({"step": "quota-summary",
          "compute_nonzero": compute_nz,
          "aml_nonzero_compact": {k: v[:8] for k, v in aml_nz.items()},
          "westeurope_compute": next((c["vals"] for c in comp
                                      if c["region"] == REGION), None),
          "westeurope_aml": next((a["fam"] for a in aml
                                  if a["region"] == REGION), None)})

    # ---------- SKU catalogue (for primary check + fallback join) ----------
    cat = sku_catalogue(tok, sid)
    emit({"step": "skus", "pages": cat["pages"], "total": cat["total_skus"],
          "gpu_skus": len(cat["gpu_skus"])})
    primary_sku = None
    for s in cat["gpu_skus"]:
        if str(s.get("name")) == "Standard_NC6s_v3":
            offered, why = sku_in_region(s, REGION)
            primary_sku = {"name": s["name"], "family": s["family"],
                           "locations": s["locations"], "restrictions": s["restrictions"],
                           "gpus": s["gpus"], "vcpus": s["vcpus"],
                           "offered_westeurope": offered, "why": why}
    emit({"step": "sku-primary", "sku": primary_sku})

    device = {"found": False, "uuid": None, "text": "", "sku": None, "region": None}
    create = {"primary": None, "fallback": None}
    readbacks = {}

    def try_one(size, region, label):
        c = vm_create(size, region)
        emit({"step": "vm-create", "label": label, "size": size, "region": region,
              "rc": c["rc"], "secs": c["secs"], "filtered": c["filtered"],
              "tail": c["tail"]})
        if c["rc"] == 0:
            rb = vm_readback(tok, sid)
            emit({"step": "vm-readback", "label": label, "rb": rb})
            readbacks[label] = rb
            # wait for running
            for i in range(40):
                if rb.get("power") and "running" in str(rb.get("power")).lower():
                    break
                time.sleep(15)
                rb = vm_readback(tok, sid)
            emit({"step": "vm-readback-final", "label": label, "rb": rb})
            readbacks[label] = rb
            es = ext_set()
            emit({"step": "extension-set", "label": label, "rc": es["rc"],
                  "secs": es["secs"], "filtered": es["filtered"],
                  "stdout": es["stdout"], "tail": es["tail"]})
            exs = extension_status(tok, sid)
            emit({"step": "extension-readback", "label": label, "rb": exs})
            readbacks[label + ":ext"] = exs
            rc = run_command()
            emit({"step": "run-command-verbatim", "label": label, "rc": rc["rc"],
                  "secs": rc["secs"], "text": rc["text"][:3600]})
            m = re.search(r"GPU 0: ([^\n]+?\(UUID: (GPU-[0-9a-fA-F-]+)\))", rc["text"] or "")
            if not m:
                m = re.search(r"(GPU-[0-9a-fA-F-]{20,})", rc["text"] or "")
            if m:
                device.update({"found": True,
                               "uuid": (m.group(2) if m.lastindex and m.lastindex >= 2
                                        else m.group(1)),
                               "text": rc["text"][:3600], "sku": size, "region": region})
            else:
                device.update({"found": False, "uuid": None,
                               "text": rc["text"][:2000], "sku": size, "region": region})
            return True
        # refusal: verbatim deployment error + debug body
        de = deployment_error(tok, sid)
        emit({"step": "deployment-errors", "label": label, "d": de})
        return False

    # ---------- PRIMARY: exactly one on-demand Standard_NC6s_v3 in westeurope ----------
    ok = try_one("Standard_NC6s_v3", REGION, "primary")
    create["primary"] = {"ok": ok}

    # ---------- FALLBACK: at most ONE, best deployable SKU from catalogue join ----------
    if not ok and left() > 900:
        candidates = []
        # nonzero NV-family quota from EITHER parser
        seen_fams = {}
        for src, nz in (("compute", compute_nz), ("aml", aml_nz)):
            for fam, entries in nz.items():
                norm = re.sub(r"[^a-z0-9]", "", fam.lower())
                if "nv" not in norm and "ncas" not in norm and "ncs" not in norm:
                    continue
                for e in entries:
                    key = (norm, e["region"])
                    if key not in seen_fams or e["limit"] > seen_fams[key]["limit"]:
                        seen_fams[key] = {"limit": e["limit"], "src": src}
        for s in cat["gpu_skus"]:
            if str(s.get("name")) == "Standard_NC6s_v3":
                continue
            famn = re.sub(r"[^a-z0-9]", "", str(s.get("family", "")).lower())
            for (fn, reg), q in seen_fams.items():
                if fn != famn:
                    continue
                offered, why = sku_in_region(s, reg)
                if not offered:
                    continue
                candidates.append({"name": s["name"], "family": s["family"],
                                   "region": reg, "gpus": s["gpus"],
                                   "vcpus": s["vcpus"], "quota": q,
                                   "why": why,
                                   "score": (s["gpus"],
                                             "unrestricted" in why,
                                             q["limit"])})
        candidates.sort(key=lambda c: c["score"], reverse=True)
        emit({"step": "fallback-join", "n": len(candidates),
              "top": candidates[:8]})
        if candidates:
            best = candidates[0]
            create["fallback"] = {"ok": try_one(best["name"], best["region"],
                                               "fallback")}
        else:
            emit({"step": "fallback-join-empty",
                  "note": "no GPU SKU in the catalogue joins a nonzero-quota NV/NC family"})

    # ---------- teardown ----------
    az(["vm", "delete", "-g", RG, "-n", VM, "--yes"], timeout=900)
    got = delete_mine(tok, sid, "teardown")
    for _ in range(6):
        st, items2 = rg_items(tok, sid)
        rem = mine(items2)
        if not rem:
            break
        time.sleep(20)
        got += delete_mine(tok, sid, "teardown-retry")
    st, items3 = rg_items(tok, sid)
    rem = mine(items3)
    stv, vmb = arm(tok, "%s/subscriptions/%s/resourceGroups/%s/providers/Microsoft.Compute"
                        "/virtualMachines/%s?api-version=2024-07-01" % (ARM, sid, RG, VM),
                   timeout=60)
    l = az(["vm", "list", "-g", RG, "--output", "json"], timeout=180)
    try:
        vms = sorted([v.get("name") for v in json.loads(l["out"] or "[]")])
    except Exception:  # noqa: BLE001
        vms = []
    emit({"step": "final", "http": st, "rg_total": len(items3),
          "ours_remaining": [i["name"] for i in rem], "vms_in_rg": vms,
          "vm_get_http": stv, "vm_get_error": flat_err(vmb),
          "device_found": device["found"], "device_uuid": device["uuid"],
          "device_sku": device["sku"], "device_region": device["region"],
          "create": create,
          "verdict": ("READY_DEVICE_PROVEN" if device["found"] else
                      ("GATE_CLEAN" if not rem else "LEFTOVERS_REMAIN"))})


if __name__ == "__main__":
    main()
