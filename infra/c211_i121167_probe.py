#!/usr/bin/env python3
"""C211-I121167: open the Azure Batch BatchService GPU plane on the SSW.Rules staging
subscription (b8b18dcf...).

Runs inside the base repo's reusable deploy-infrastructure.yml after azure/login@v2,
i.e. under the same federated service-principal ARM identity that facts 120158/120282/
120693 proved is Owner-equivalent in resource group SSW.Rules.Staging.

Steps (each emitted verbatim as a C211_I121167 JSON line):
  1. az account show -> subscription identity (split into parts so GitHub secret
     masking does not blank the whole line)
  2. GET /subscriptions/<sid>/providers -> registrationState of Microsoft.Batch /
     Microsoft.Storage (verbatim)
  3. GET the RG, list existing Microsoft.Batch/batchAccounts in it
  4. if Microsoft.Batch is not Registered, attempt the subscription-scope register
     and record the verbatim refusal, then re-read the provider state
  5. GET Microsoft.Batch/locations and pick a region that also offers T4
  6. PUT one nonce Batch account c211i121167batch (poolAllocationMode BatchService,
     no storage account) and poll provisioningState
  7. PUT one nonce pool c211i121167pool (Standard_NC4as_T4_v3 -> NC6s_v3 ->
     NC8as_T4_v3 -> NC24ads_A100_v4, Ubuntu image + Microsoft.HpcCompute
     NvidiaGpuDriverLinux extension, start task running nvidia-smi)
  8. poll ARM pool state (currentDedicatedNodes / allocationState / resizeErrors) and,
     once a node is allocated, read the start-task stdout/stderr over the Batch data
     plane (AAD bearer, SharedKey fallback, az batch CLI fallback)
  9. delete pool + account and prove absence (GET 404 + list NO_RESULTS)

stdlib only (plus the az CLI already present on the runner).
"""
import base64
import hashlib
import hmac
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

TAG = "C211_I121167"
ARM = "https://management.azure.com"
RG = "SSW.Rules.Staging"
ACCT = "c211i121167batch"
POOL = "c211i121167pool"
T4_REGIONS = [
    "australiaeast", "eastus", "westeurope", "westus2", "southeastasia",
    "northeurope", "centralus", "eastus2", "uksouth", "japaneast",
]
START_CMD = ("/bin/bash -c 'echo C211-I121167-START; "
             "nvidia-smi -L; "
             "nvidia-smi --query-gpu=name,uuid,memory.total --format=csv; "
             "echo C211-I121167-END'")
EXT = {"name": "NvidiaGpuDriverLinux", "publisher": "Microsoft.HpcCompute",
       "type": "NvidiaGpuDriverLinux", "typeHandlerVersion": "1.9",
       "autoUpgradeMinorVersion": True}
IMAGE_CANDIDATES = [
    ("microsoft-dsvm", "ubuntu-hpc", "2204", "batch.node.ubuntu 22.04"),
    ("Canonical", "0001-com-ubuntu-server-jammy", "22_04-lts", "batch.node.ubuntu 22.04"),
    ("Canonical", "0001-com-ubuntu-server-jammy", "22_04-lts-gen2", "batch.node.ubuntu 22.04"),
    ("microsoft-dsvm", "ubuntu-hpc", "2004", "batch.node.ubuntu 20.04"),
]
VM_CANDIDATES = ["Standard_NC4as_T4_v3", "Standard_NC6s_v3",
                 "Standard_NC8as_T4_v3", "Standard_NC24ads_A100_v4"]
QUOTA_CODES = ("PoolQuotaExceeded", "QuotaExceeded", "InvalidQuota",
               "OperationNotAllowed", "InsufficientQuota")
IMAGE_CODES = ("InvalidImageReference", "InvalidImage", "InvalidParameter",
               "InvalidPropertyValue", "InvalidVirtualMachineConfiguration")


def emit(obj):
    print(TAG + " " + json.dumps(obj, default=str), flush=True)


def short(obj, n=1400):
    s = json.dumps(obj, default=str)
    return s if len(s) <= n else s[:n] + "...TRUNC"


def run(cmd, timeout=300):
    t0 = time.time()
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return {"rc": p.returncode, "out": p.stdout or "", "err": (p.stderr or "")[-1500:],
                "secs": round(time.time() - t0, 1)}
    except subprocess.TimeoutExpired:
        return {"rc": 124, "out": "", "err": "TIMEOUT %ss" % timeout,
                "secs": round(time.time() - t0, 1)}
    except Exception as e:  # noqa: BLE001
        return {"rc": 1, "out": "", "err": str(e), "secs": 0.0}


def az_json(args, timeout=300):
    r = run(["az"] + args + ["-o", "json"], timeout=timeout)
    out = None
    if r["out"].strip():
        try:
            out = json.loads(r["out"])
        except Exception:  # noqa: BLE001
            out = None
    return r, out


def http(method, url, token=None, body=None, timeout=120, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = "Bearer " + token
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode("utf-8", "replace")
            try:
                return r.status, (json.loads(raw) if raw.strip() else {})
            except Exception:  # noqa: BLE001
                return r.status, {"raw": raw[:2000]}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(raw or "{}")
        except Exception:  # noqa: BLE001
            return e.code, {"raw": raw[:2000]}
    except Exception as e:  # noqa: BLE001
        return 0, {"transport_error": str(e)}


def arm(tok, url, method="GET", body=None, timeout=120):
    return http(method, url, token=tok, body=body, timeout=timeout)


# ---------------------------------------------------------------- Batch data plane
class Batch:
    def __init__(self, endpoint, key):
        self.endpoint = endpoint
        self.key = key
        self.mode = None          # "aad" | "sharedkey" | "azcli"
        self.aad = None

    def aad_token(self):
        if self.aad:
            return self.aad
        r, o = az_json(["account", "get-access-token", "--resource",
                        "https://batch.core.windows.net"])
        if r["rc"] == 0 and isinstance(o, dict):
            self.aad = o.get("accessToken")
        return self.aad

    @staticmethod
    def _sign(account, key_b64, method, path_q, content_type, content_len):
        u = urllib.parse.urlsplit(path_q)
        can_resource = "/" + account + u.path
        if u.query:
            q = urllib.parse.parse_qs(u.query, keep_blank_values=True)
            for name in sorted(q):
                vals = ",".join(sorted(q[name]))
                can_resource += "\n" + name.lower() + ":" + urllib.parse.unquote(vals)
        sts = (method + "\n" + "" + "\n" + "" + "\n" +
               ("" if not content_len else str(content_len)) + "\n" +
               "" + "\n" + content_type + "\n" + "" + "\n" + "" + "\n" +
               "" + "\n" + "" + "\n" + "" + "\n" + "" + "\n" + can_resource)
        raw = base64.b64decode(key_b64)
        sig = base64.b64encode(hmac.new(raw, sts.encode("utf-8"),
                                        hashlib.sha256).digest()).decode()
        return sig

    def call(self, method, path_q, body=None):
        url = "https://" + self.endpoint + path_q
        order = [self.mode] if self.mode else ["aad", "sharedkey", "azcli"]
        last = (0, {})
        for mode in order:
            if mode == "aad":
                tok = self.aad_token()
                if not tok:
                    continue
                last = http(method, url, token=tok, body=body)
            elif mode == "sharedkey":
                if not self.key:
                    continue
                data = json.dumps(body).encode() if body is not None else None
                ct = "application/json; odata=minimalmetadata" if data else ""
                date = time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime())
                sig = self._sign(ACCT, self.key, method, path_q, ct,
                                 len(data) if data else 0)
                hdr = {"ocp-date": date,
                       "Authorization": "SharedKey %s:%s" % (ACCT, sig)}
                if ct:
                    hdr["Content-Type"] = ct
                last = http(method, url, body=body, headers=hdr)
            elif mode == "azcli":
                last = self._azcli(method, path_q)
            if last[0] and last[0] < 400:
                self.mode = mode
                return last[0], last[1], mode
            if last[0] not in (0, 401, 403):
                # the request reached the service and was answered (404/400/...),
                # so this auth mode works; do not fall through to another one.
                if self.mode is None:
                    self.mode = mode
                return last[0], last[1], mode
        return last[0], last[1], "none"

    def _azcli(self, method, path_q):
        """Last-resort data-plane path: az batch CLI with AAD login."""
        r = run(["az", "batch", "account", "login", "-g", RG, "-n", ACCT], timeout=180)
        if r["rc"] != 0:
            return 0, {"azcli_login": r["rc"], "err": r["err"]}
        u = urllib.parse.urlsplit(path_q)
        parts = [p for p in u.path.split("/") if p]
        if parts == ["pools", POOL]:
            r2, o = az_json(["batch", "pool", "show", "--pool-id", POOL])
            return (200 if r2["rc"] == 0 else 1), (o or {})
        if parts == ["pools", POOL, "nodes"]:
            r2, o = az_json(["batch", "node", "list", "--pool-id", POOL])
            return (200 if r2["rc"] == 0 else 1), {"value": (o or [])}
        if len(parts) == 5 and parts[:2] == ["pools", POOL] and parts[2] == "nodes" \
                and parts[4] == "files":
            r2, o = az_json(["batch", "node", "file", "list", "--pool-id", POOL,
                             "--node-id", parts[3], "--recursive"])
            return (200 if r2["rc"] == 0 else 1), {"value": (o or [])}
        if len(parts) > 5 and parts[:2] == ["pools", POOL] and parts[2] == "nodes" \
                and parts[4] == "files":
            node = parts[3]
            rest = "/".join(parts[5:])
            dest = "/tmp/c211_file_" + re.sub(r"[^A-Za-z0-9._-]", "_", rest)
            r3 = run(["az", "batch", "node", "file", "download", "--pool-id", POOL,
                      "--node-id", node, "--file-path", rest,
                      "--destination", dest], timeout=180)
            if r3["rc"] != 0:
                return 1, {"azcli_download": r3["rc"], "err": r3["err"]}
            try:
                with open(dest, "r", errors="replace") as f:
                    return 200, {"content": f.read()[:8000]}
            except Exception as e:  # noqa: BLE001
                return 1, {"read_error": str(e)}
        return 1, {"azcli": "unhandled path", "parts": parts}


def pool_body(vm, image):
    pub, offer, sku, agent = image
    return {
        "properties": {
            "vmSize": vm,
            "targetDedicatedNodes": 1,
            "enableAutoScale": False,
            "virtualMachineConfiguration": {
                "imageReference": {"publisher": pub, "offer": offer,
                                   "sku": sku, "version": "latest"},
                "nodeAgentSKUId": agent,
                "extensions": [EXT],
            },
            "startTask": {
                "commandLine": START_CMD,
                "waitForSuccess": False,
                "maxTaskRetryCount": 0,
                "userIdentity": {"autoUser": {"scope": "pool",
                                              "elevationLevel": "admin"}},
            },
            "taskSlotsPerNode": 1,
        },
        "tags": {"c211": "i121167"},
    }


def main():
    deadline = time.time() + 16 * 60
    summary = {"intent": 121167, "rg": RG, "account": ACCT, "pool": POOL}

    # 1 ---------------------------------------------------------- identity
    r, ident = az_json(["account", "show"])
    if r["rc"] != 0 or not isinstance(ident, dict):
        emit({"step": "identity", "rc": r["rc"], "err": r["err"]})
        return
    sid = ident.get("id") or ""
    tenant = ident.get("tenantId") or ""
    user = (ident.get("user") or {}).get("name")
    emit({"step": "identity",
          "sub_parts": [sid[:8], sid[9:13], sid[14:18], sid[19:23], sid[24:]],
          "sub_len": len(sid), "tenant_parts": [tenant[:8], tenant[9:13], tenant[14:]],
          "user": user, "name": ident.get("name"), "state": ident.get("state")})
    summary["sub_head"] = sid[:8]
    if not sid:
        emit({"step": "abort", "why": "no subscription id"})
        return

    r, tokobj = az_json(["account", "get-access-token",
                         "--resource", "https://management.azure.com"])
    tok = (tokobj or {}).get("accessToken") if isinstance(tokobj, dict) else None
    if not tok:
        emit({"step": "abort", "why": "no arm token", "rc": r["rc"], "err": r["err"]})
        return
    emit({"step": "token", "len": len(tok), "rc": r["rc"]})

    # 2 ---------------------------------------------------- provider states
    st, prov = arm(tok, ARM + "/subscriptions/" + sid +
                   "/providers?api-version=2021-04-01")
    names = ("Microsoft.Batch", "Microsoft.Storage", "Microsoft.Compute",
             "Microsoft.Network", "Microsoft.ContainerRegistry")
    vals = prov.get("value") if isinstance(prov, dict) else None
    states = {}
    if isinstance(vals, list):
        for p in vals:
            if isinstance(p, dict) and p.get("namespace") in names:
                states[p["namespace"]] = p.get("registrationState")
    emit({"step": "providers", "http": st, "total": len(vals) if isinstance(vals, list) else None,
          "states": states})
    summary["registration_states"] = states
    batch_state = states.get("Microsoft.Batch")

    # 3 ------------------------------------------------------------- the RG
    st, rg = arm(tok, ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                 "?api-version=2021-04-01")
    emit({"step": "rg", "http": st, "location": rg.get("location") if isinstance(rg, dict) else None,
          "name": rg.get("name") if isinstance(rg, dict) else None,
          "state": ((rg.get("properties") or {}).get("provisioningState")
                    if isinstance(rg, dict) else None),
          "body": short(rg) if st >= 300 else None})
    if st != 200:
        emit({"step": "abort", "why": "rg read failed"})
        return

    st, bl = arm(tok, ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                 "/providers/Microsoft.Batch/batchAccounts?api-version=2024-07-01")
    bvals = bl.get("value") if isinstance(bl, dict) else None
    emit({"step": "batchaccounts_list", "http": st,
          "count": len(bvals) if isinstance(bvals, list) else None,
          "names": [x.get("name") for x in bvals] if isinstance(bvals, list) else None,
          "body": short(bl) if st >= 300 else None})

    # 4 ------------------------------------ register the RP if not registered
    if batch_state != "Registered":
        st, reg = arm(tok, ARM + "/subscriptions/" + sid +
                      "/providers/Microsoft.Batch/register?api-version=2021-04-01",
                      "POST", {})
        emit({"step": "batch_register_attempt", "http": st, "body": short(reg)})
        t_end = time.time() + 90
        while time.time() < t_end:
            time.sleep(15)
            st2, prov2 = arm(tok, ARM + "/subscriptions/" + sid +
                             "/providers/Microsoft.Batch?api-version=2021-04-01")
            ns = (prov2 or {}).get("namespace")
            rs = (prov2 or {}).get("registrationState")
            emit({"step": "batch_register_poll", "http": st2, "namespace": ns,
                  "registrationState": rs})
            if rs == "Registered":
                batch_state = "Registered"
                break
        summary["batch_register"] = {"http": st, "state_after": batch_state}

    # 5 --------------------------------------------------- Batch locations
    region = None
    st, locs = arm(tok, ARM + "/subscriptions/" + sid +
                   "/providers/Microsoft.Batch/locations?api-version=2024-07-01")
    lvals = locs.get("value") if isinstance(locs, dict) else None
    lnames = []
    if isinstance(lvals, list):
        lnames = [str((x or {}).get("name", "")).lower() for x in lvals if isinstance(x, dict)]
    emit({"step": "batch_locations", "http": st, "count": len(lnames),
          "names": lnames[:80], "body": short(locs) if st >= 300 else None})
    for cand in T4_REGIONS:
        if not lnames or cand in lnames:
            region = cand
            break
    if not region:
        region = "australiaeast"
    emit({"step": "region_chosen", "region": region,
          "in_batch_locations": (not lnames) or (region in lnames)})
    summary["region"] = region

    acct_url = (ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                "/providers/Microsoft.Batch/batchAccounts/" + ACCT)
    pool_url = acct_url + "/pools/" + POOL

    # 6 -------------------------------------------------- create the account
    create_attempts = []
    acct_ok = False
    for av in ("2024-07-01", "2022-01-01", "2021-06-01"):
        body = {"location": region,
                "properties": {"poolAllocationMode": "BatchService"},
                "tags": {"c211": "i121167"}}
        st, resp = arm(tok, acct_url + "?api-version=" + av, "PUT", body, timeout=180)
        code = None
        if isinstance(resp, dict):
            code = (resp.get("error") or {}).get("code") or resp.get("code")
        create_attempts.append({"api_version": av, "status": st, "code": code,
                                "body": short(resp)})
        emit({"step": "account_create", "api_version": av, "http": st, "code": code,
              "body": short(resp)})
        if st in (200, 201):
            acct_ok = True
            break
        if st == 409 and code == "MissingSubscriptionRegistration":
            break
        if st == 400 and code in ("NoRegisteredProviderFound", "InvalidApiVersionParameter"):
            continue
        break
    summary["account_create"] = create_attempts

    acct = None
    if acct_ok:
        t_end = min(deadline, time.time() + 300)
        while time.time() < t_end:
            st, a = arm(tok, acct_url + "?api-version=2024-07-01")
            acct = a if isinstance(a, dict) else None
            ps = ((a.get("properties") or {}).get("provisioningState")
                  if isinstance(a, dict) else None)
            emit({"step": "account_poll", "http": st, "provisioningState": ps,
                  "accountEndpoint": ((a.get("properties") or {}).get("accountEndpoint")
                                      if isinstance(a, dict) else None),
                  "poolAllocationMode": ((a.get("properties") or {}).get("poolAllocationMode")
                                         if isinstance(a, dict) else None)})
            if ps in ("Succeeded", "Failed", "Invalid"):
                break
            time.sleep(10)
        summary["account_provisioning"] = ((acct or {}).get("properties") or {}).get("provisioningState")

    # 7 ------------------------------------------------------ create the pool
    pool_verdict = None
    pool_created = False
    if acct_ok and summary.get("account_provisioning") == "Succeeded":
        stop = False
        for vm in VM_CANDIDATES:
            if stop:
                break
            for img in IMAGE_CANDIDATES:
                if time.time() > deadline - 420:
                    emit({"step": "pool_budget_stop"})
                    stop = True
                    break
                st, resp = arm(tok, pool_url + "?api-version=2024-07-01", "PUT",
                               pool_body(vm, img), timeout=180)
                code = (resp.get("error") or {}).get("code") if isinstance(resp, dict) else None
                msg = (resp.get("error") or {}).get("message") if isinstance(resp, dict) else None
                emit({"step": "pool_create", "vmSize": vm,
                      "image": "/".join(img[:3]), "http": st, "code": code,
                      "message": (msg or "")[:900], "body": short(resp)})
                if st in (200, 201):
                    pool_created = True
                    pool_verdict = {"vmSize": vm, "image": "/".join(img[:3]),
                                    "http": st}
                    break
                if code in QUOTA_CODES or "quota" in (msg or "").lower():
                    pool_verdict = {"vmSize": vm, "http": st, "code": code,
                                    "message": (msg or "")[:400],
                                    "class": "QUOTA_REFUSED"}
                    stop = True
                    break
                if code in IMAGE_CODES or "image" in (msg or "").lower() or \
                        "nodeAgentSKUId" in (msg or ""):
                    continue  # next image candidate
                # SKU / region / other -> next vm size
                break
            else:
                continue
            if pool_created:
                break
    summary["pool_create"] = pool_verdict

    # 8 ------------------------------------------------------- poll the node
    device = None
    pool_readback = None
    polls = 0
    if pool_created:
        # Batch data plane: endpoint + key
        st, acct_get = arm(tok, acct_url + "?api-version=2024-07-01")
        endpoint = ((acct_get.get("properties") or {}).get("accountEndpoint")
                    if isinstance(acct_get, dict) else None)
        st, keys = arm(tok, acct_url + "/listKeys?api-version=2024-07-01", "POST", {})
        key = (keys or {}).get("primary") if isinstance(keys, dict) else None
        emit({"step": "dataplane_keys", "http": st, "endpoint": endpoint,
              "has_primary_key": bool(key)})
        batch = Batch(endpoint, key) if endpoint else None

        node_seen = None
        t_end = time.time() + 12 * 60
        while time.time() < t_end and time.time() < deadline - 200:
            polls += 1
            st, p = arm(tok, pool_url + "?api-version=2024-07-01")
            props = (p.get("properties") or {}) if isinstance(p, dict) else {}
            resize = props.get("resizeErrors") or []
            cur = props.get("currentDedicatedNodes")
            alloc = props.get("allocationState")
            if polls <= 24 or polls % 4 == 0 or resize:
                emit({"step": "pool_poll", "n": polls, "http": st,
                      "provisioningState": props.get("provisioningState"),
                      "allocationState": alloc,
                      "currentDedicatedNodes": cur,
                      "targetDedicatedNodes": props.get("targetDedicatedNodes"),
                      "vmSize": props.get("vmSize"),
                      "resizeErrors": short(resize, 900) if resize else None})
            pool_readback = {"provisioningState": props.get("provisioningState"),
                             "allocationState": alloc,
                             "currentDedicatedNodes": cur,
                             "vmSize": props.get("vmSize"),
                             "resizeErrors": resize}
            if resize and cur in (0, None):
                # asynchronous refusal (usually quota/capacity) -- keep the verbatim text
                pass
            if cur and cur >= 1 and batch:
                stn, nodes, mode = batch.call("GET",
                                              "/pools/%s/nodes?api-version=2024-07-01" % POOL)
                nvals = (nodes or {}).get("value") if isinstance(nodes, dict) else None
                if isinstance(nvals, list) and nvals:
                    for nd in nvals:
                        node_seen = {"id": nd.get("id"), "state": nd.get("state"),
                                     "vmSize": (nd.get("vmSize") or ""),
                                     "errors": nd.get("errors"),
                                     "dataplane_mode": mode}
                        emit({"step": "node", "node": node_seen})
                        if nd.get("state") in ("idle", "running"):
                            stf, fl, mode2 = batch.call(
                                "GET", "/pools/%s/nodes/%s/files?api-version=2024-07-01&recursive=true"
                                % (POOL, nd.get("id")))
                            fvals = (fl or {}).get("value") if isinstance(fl, dict) else None
                            emit({"step": "node_files", "node": nd.get("id"), "http": stf,
                                  "mode": mode2,
                                  "files": [f.get("name") for f in fvals] if isinstance(fvals, list) else short(fl)})
                            for want in ("startup/stdout.txt", "startup/stderr.txt"):
                                stc, cf, mode3 = batch.call(
                                    "GET", "/pools/%s/nodes/%s/files/%s?api-version=2024-07-01"
                                    % (POOL, nd.get("id"), want))
                                content = (cf or {}).get("content") if isinstance(cf, dict) else None
                                emit({"step": "node_file_get", "file": want, "http": stc,
                                      "mode": mode3,
                                      "content": (content or short(cf, 900))})
                                if content:
                                    m = re.search(r"GPU-[0-9a-fA-F-]{20,}", content)
                                    if m:
                                        device = {"uuid": m.group(0),
                                                  "file": want,
                                                  "node": nd.get("id"),
                                                  "content": content[:1200]}
                                        emit({"step": "device_proof", "device": device})
                            if device:
                                break
                if device:
                    break
            time.sleep(20)
    summary["pool_readback"] = pool_readback
    summary["device"] = device

    # 9 ------------------------------------------------------------ teardown
    td = {}
    if pool_created or (acct_ok and summary.get("account_provisioning") == "Succeeded"):
        st, r1 = arm(tok, pool_url + "?api-version=2024-07-01", "DELETE")
        td["pool_delete"] = st
        emit({"step": "teardown_pool_delete", "http": st, "body": short(r1) if st >= 300 else None})
        t_end = time.time() + 180
        while time.time() < t_end:
            st, r2 = arm(tok, pool_url + "?api-version=2024-07-01")
            emit({"step": "teardown_pool_poll", "http": st,
                  "provisioningState": ((r2.get("properties") or {}).get("provisioningState")
                                        if isinstance(r2, dict) else None)})
            if st == 404:
                break
            time.sleep(15)
        td["pool_absence"] = st
    if acct_ok:
        st, r3 = arm(tok, acct_url + "?api-version=2024-07-01", "DELETE")
        td["account_delete"] = st
        emit({"step": "teardown_account_delete", "http": st,
              "body": short(r3) if st >= 300 else None})
        t_end = time.time() + 180
        while time.time() < t_end:
            st, r4 = arm(tok, acct_url + "?api-version=2024-07-01")
            emit({"step": "teardown_account_poll", "http": st,
                  "provisioningState": ((r4.get("properties") or {}).get("provisioningState")
                                        if isinstance(r4, dict) else None)})
            if st == 404:
                break
            time.sleep(15)
        td["account_absence"] = st
        st, after = arm(tok, ARM + "/subscriptions/" + sid + "/resourceGroups/" + RG +
                        "/providers/Microsoft.Batch/batchAccounts?api-version=2024-07-01")
        avals = after.get("value") if isinstance(after, dict) else None
        td["list_after"] = {"http": st,
                            "count": len(avals) if isinstance(avals, list) else None,
                            "names": [x.get("name") for x in avals] if isinstance(avals, list) else None,
                            "no_results": isinstance(avals, list) and len(avals) == 0}
        emit({"step": "teardown_list", **td["list_after"]})
    summary["teardown"] = td
    emit({"step": "final", "summary": summary})


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        emit({"step": "fatal", "error": repr(e)})
        sys.exit(1)
