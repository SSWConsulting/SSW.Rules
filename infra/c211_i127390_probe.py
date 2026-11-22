#!/usr/bin/env python3
"""C211-I127390: fire the ONE permitted SPOT-priority retry of the direct
Standard_NC6s_v3 (V100) VM class on subscription b8b18dcf / RG SSW.Rules.Staging.

Mandate precondition (fact 127153): the on-demand Standard_NC6s_v3 create was refused
verbatim by ARM QuotaExceeded (standardNCSv3Family Current Limit 0 / Additional Required 6
@ westeurope) and the on-demand Standard_NC64as_T4_v3 fallback was likewise refused
(Standard NCASv3_T4 Family limit 0), which authorizes exactly ONE spot-priority create per
class. This probe keeps the dual-parser quota matrix and adds the Azure Spot/low-priority
vCPU meter, which no prior lane has ever read:

  1. read-only: az account show / get-access-token / subscriptions / RG inventory
  2. dual-parser quota matrix over all 65 regions:
       a. Microsoft.Compute locations/{r}/usages?api-version=2024-07-01
          (family meters + every lowPriority/spot meter verbatim)
       b. Microsoft.MachineLearningServices locations/{r}/usages?api-version=2024-04-01
          max-of-duplicates parse
  3. the create region is computed from the full Compute SKU catalogue: Standard_NC6s_v3
     offered AND not zone-restricted with reasonCode NotAvailableForSubscription; when no
     region qualifies, westeurope is the recorded fallback (the saved catalogue shows
     Standard_NC6s_v3 only in westeurope with Zones 1-3 NotAvailableForSubscription)
  4. create EXACTLY ONE spot VM (--priority Spot --eviction-policy Deallocate --max-price -1)
     of Standard_NC6s_v3 in that region, then Microsoft.HpcCompute/NvidiaGpuDriverLinux and
     ONE runCommand capturing nvidia-smi -L / --query-gpu verbatim; independent ARM readback
     includes the VM's priority/evictionPolicy fields
  5. if refused: at most ONE fallback spot create of the minimal Standard_NC4as_T4_v3
     (never the 64-GPU SKU, never on-demand); verbatim ARM error only
  6. DELETE every c211i127390* resource, prove GET 404 / rg-inventory mine=[]
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

TAG = "C211_I127390"
ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
REGION = "westeurope"
VM = "c211i127390vm"
EXT = "c211i127390gpu"
IMAGE = "Canonical:0001-com-ubuntu-server-jammy:22_04-lts-gen2:latest"
ADMIN_USER = "c211probe"
ADMIN_PW = "C211Marker!Pw9x7qZ"
PREFIXES = ("c211i127390", "c211-i127390")
PRIORITY = "Spot"
EVICTION = "Deallocate"
MAX_PRICE = "-1"
SPOT_RE = re.compile(r"(?i)priorit|spot")
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
            "standardNVFamily", "cores", "Total Regional vCPUs",
            "lowPriorityCores", "Total Regional Low-priority vCPUs")


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
    spot = {}
    n = 0
    if isinstance(b, dict) and isinstance(b.get("value"), list):
        n = len(b["value"])
        for m in b["value"]:
            nm = ((m.get("name") or {}).get("value") or "")
            loc = m.get("localizedValue") or ""
            rec = {"limit": m.get("limit"), "current": m.get("currentValue")}
            if nm in FAM_KEYS or re.match(r"(?i)^standardn(c|v|d)", nm):
                vals[nm] = rec
            if nm and (SPOT_RE.search(nm) or SPOT_RE.search(loc)):
                spot[nm or loc] = {"limit": m.get("limit"),
                                   "current": m.get("currentValue"),
                                   "localized": loc}
    return {"region": reg, "http": st, "n": n, "vals": vals, "spot": spot}


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
            if not re.search(r"(?i)ncas|ncs|ncfamily|nvfamily|nvads|nvpromo|^cores$|priorit|spot", f):
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
        if re.match(r"(?i)^(standardncs|standard ncas|standardnv|cores|total regional|lowpriority|spot)", k):
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


def pick_region(cat, sku_name, prefer="westeurope"):
    """Deterministic create-region pick from the Compute SKU catalogue.

    Rule: the region must offer the SKU AND must not carry a Zone restriction with
    reasonCode NotAvailableForSubscription; when no region qualifies, the recorded
    region (westeurope) is the fallback and the platform verdict decides.
    """
    entry = None
    for s in cat["gpu_skus"]:
        if str(s.get("name")) == sku_name:
            entry = s
            break
    if entry is None:
        return {"sku": sku_name, "chosen": prefer, "why": "sku_absent_from_catalogue",
                "candidates": []}
    cands = []
    for loc in (entry.get("locations") or []):
        offered, why = sku_in_region(entry, loc)
        if not offered:
            continue
        naf = False
        for r in (entry.get("restrictions") or []):
            rl = [str(x).lower() for x in (r.get("locations") or [])]
            if (str(r.get("type") or "").lower() == "zone"
                    and str(r.get("reasonCode") or "") == "NotAvailableForSubscription"
                    and (not rl or loc.lower() in rl)):
                naf = True
        cands.append({"region": loc, "why": why, "zone_naf": naf})
    clean = [c["region"] for c in cands if not c["zone_naf"]]
    if clean:
        chosen = prefer if prefer in clean else clean[0]
        return {"sku": sku_name, "chosen": chosen,
                "why": "offered_and_not_zone_NAF", "candidates": cands}
    if prefer in [c["region"] for c in cands]:
        chosen = prefer
    elif cands:
        chosen = cands[0]["region"]
    else:
        chosen = prefer
    return {"sku": sku_name, "chosen": chosen,
            "why": ("fallback_recorded_region_zone_NAF" if cands
                    else "fallback_no_offer"), "candidates": cands}

def create_verdict_text(txt):
    """Compact verbatim ARM create verdict (survives emit()'s 3800-char truncation)."""
    txt = txt or ""
    out = {}
    for pat, key in ((r"Code: (\w+)", "code"),
                     (r"exceeding approved ([A-Za-z0-9 _]+?) Cores quota", "family"),
                     (r"Location: (\w+)", "location"),
                     (r"Current Limit: (\d+)", "current_limit"),
                     (r"Current Usage: (\d+)", "current_usage"),
                     (r"Additional Required: (\d+)", "additional_required"),
                     (r"Tracking id is '([0-9a-f-]+)'", "tracking_id")):
        m = re.search(pat, txt)
        if m:
            out[key] = m.group(1)
    i = txt.find("(QuotaExceeded)")
    if i < 0:
        i = txt.find("Code:")
    if i >= 0:
        out["message_window"] = re.sub(r"\s+", " ", txt[max(0, i - 80):i + 520]).strip()
    return out


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
            "--tags", "c211intent=127390", "c211nonce=i127390",
            "--public-ip-address", "", "--nsg", "",
            "--priority", PRIORITY, "--eviction-policy", EVICTION,
            "--max-price", MAX_PRICE,
            "--output", "json", "--debug"]
    r = az(args, timeout=timeout)
    txt = (r["err"] or "") + "\n" + (r["out"] or "")
    return {"rc": r["rc"], "secs": r["secs"],
            "req": {"size": size, "region": region, "priority": PRIORITY,
                    "eviction_policy": EVICTION, "max_price": MAX_PRICE},
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
            "priority": pr.get("priority"),
            "eviction_policy": pr.get("evictionPolicy"),
            "billing": pr.get("billingProfile"),
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
        "echo C211-I127390-RUNSTART; "
        "echo ---NVIDIA-SMI-L---; "
        "nvidia-smi -L 2>&1 || echo NVIDIA_SMI_L_RC=$?; "
        "echo ---QUERY---; "
        "nvidia-smi --query-gpu=name,uuid,memory.total,driver_version --format=csv 2>&1 "
        "|| echo NVIDIA_SMI_Q_RC=$?; "
        "echo ---PCI---; "
        "for d in /sys/bus/pci/devices/*; do v=$(cat $d/vendor 2>/dev/null); "
        "case \"$v\" in 0x10de) echo GPU_PCI $d vendor=$v "
        "device=$(cat $d/device 2>/dev/null) class=$(cat $d/class 2>/dev/null);; esac; done; "
        "echo C211-I127390-RUNEND")
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
              "n": c["n"], "vals": c["vals"], "spot": c["spot"]})
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
    spot_regions = {c["region"]: c["spot"] for c in comp if c["spot"]}
    spot_nonzero = {r: {k: v for k, v in mm.items() if v.get("limit")}
                    for r, mm in spot_regions.items()
                    if any(v.get("limit") for v in mm.values())}
    emit({"step": "spot-summary", "regions_with_spot_meter": len(spot_regions),
          "spot_nonzero": spot_nonzero,
          "spot_all_compact": {r: mm for r, mm in list(spot_regions.items())[:20]}})

    # ---------- SKU catalogue (for primary check + fallback join) ----------
    cat = sku_catalogue(tok, sid)
    emit({"step": "skus", "pages": cat["pages"], "total": cat["total_skus"],
          "gpu_skus": len(cat["gpu_skus"])})
    pick_primary = pick_region(cat, "Standard_NC6s_v3", REGION)
    pick_fallback = pick_region(cat, "Standard_NC4as_T4_v3", REGION)
    emit({"step": "region-pick", "primary": pick_primary,
          "fallback": pick_fallback})
    PRIMARY_REGION = pick_primary["chosen"]
    FB_REGION = pick_fallback["chosen"]
    primary_sku = None
    for s in cat["gpu_skus"]:
        if str(s.get("name")) == "Standard_NC6s_v3":
            offered, why = sku_in_region(s, PRIMARY_REGION)
            primary_sku = {"name": s["name"], "family": s["family"],
                           "locations": s["locations"], "restrictions": s["restrictions"],
                           "gpus": s["gpus"], "vcpus": s["vcpus"],
                           "offered_create_region": offered, "why": why,
                           "create_region": PRIMARY_REGION}
    emit({"step": "sku-primary", "sku": primary_sku})
    emit({"step": "spot-meter-chosen",
          "primary_region": PRIMARY_REGION,
          "primary_spot": next((c["spot"] for c in comp
                                if c["region"] == PRIMARY_REGION), None),
          "fallback_region": FB_REGION,
          "fallback_spot": next((c["spot"] for c in comp
                                 if c["region"] == FB_REGION), None),
          "primary_family": next((c["vals"] for c in comp
                                  if c["region"] == PRIMARY_REGION), None),
          "fallback_family": next((c["vals"] for c in comp
                                   if c["region"] == FB_REGION), None)})

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

    # ---------- PRIMARY: exactly one SPOT Standard_NC6s_v3 in the picked region ----------
    emit({"step": "primary-plan", "sku": "Standard_NC6s_v3", "region": PRIMARY_REGION,
          "priority": PRIORITY, "eviction_policy": EVICTION, "max_price": MAX_PRICE})
    ok = try_one("Standard_NC6s_v3", PRIMARY_REGION, "primary")
    create["primary"] = {"ok": ok, "region": PRIMARY_REGION}

    # ---------- FALLBACK: at most ONE SPOT Standard_NC4as_T4_v3 create ----------
    # The verbatim on-demand refusal of the T4 family (limit 0) is the spot authorization.
    # Never the 64-GPU Standard_NC64as_T4_v3 and never on-demand.
    if not ok and left() > 900:
        emit({"step": "fallback-plan", "sku": "Standard_NC4as_T4_v3",
              "region": FB_REGION, "priority": PRIORITY,
              "eviction_policy": EVICTION, "max_price": MAX_PRICE,
              "pick": pick_fallback})
        create["fallback"] = {"ok": try_one("Standard_NC4as_T4_v3", FB_REGION, "fallback"),
                              "region": FB_REGION}
    elif not ok:
        emit({"step": "fallback-skipped", "why": "internal deadline too close",
              "left_s": round(left(), 1)})

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
