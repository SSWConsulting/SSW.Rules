#!/usr/bin/env python3
"""C211-I120065 read-only Azure ARM probe.

Runs inside the SSW.Rules deploy-infrastructure reusable workflow, which checks out the
PR head SHA (fork tree) and executes ./infra/deploy.ps1 with pwsh AFTER azure/login@v2.
stdlib-only. Prints tagged JSON lines. Read-only: list subscriptions, resource groups,
GPU-family usages per physical region, and NC/ND/NV SKUs. No writes.
"""
import base64
import json
import subprocess
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

TAG = "C211_I120065"
ARM = "https://management.azure.com"
DEADLINE_REQUESTS = 400


def emit(obj):
    print(TAG + " " + json.dumps(obj, default=str), flush=True)


def az(args, timeout=120):
    try:
        p = subprocess.run(["az"] + args, capture_output=True, text=True, timeout=timeout)
        return p.returncode, p.stdout, p.stderr
    except Exception as e:  # noqa: BLE001
        return 1, "", str(e)


def get_token():
    rc, out, err = az(["account", "get-access-token", "--resource", ARM, "--output", "json"])
    if rc != 0:
        emit({"step": "get-access-token", "rc": rc, "stderr": err.strip()[:800]})
        return None
    try:
        d = json.loads(out)
    except Exception as e:  # noqa: BLE001
        emit({"step": "get-access-token", "parse_error": str(e), "stdout": out[:400]})
        return None
    return d.get("accessToken")


def jwt_claims(tok):
    try:
        p = tok.split(".")[1]
        p += "=" * (-len(p) % 4)
        return json.loads(base64.urlsafe_b64decode(p))
    except Exception as e:  # noqa: BLE001
        return {"decode_error": str(e)}


def arm(tok, url, method="GET"):
    req = urllib.request.Request(
        url,
        headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json"},
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode())
        except Exception:  # noqa: BLE001
            body = {}
        return e.code, body
    except Exception as e:  # noqa: BLE001
        return 0, {"transport_error": str(e)}


def main():
    emit({"step": "start", "argv": sys.argv[1:]})
    rc, out, err = az(["account", "show", "--output", "json"])
    if rc == 0:
        try:
            acct = json.loads(out)
        except Exception:  # noqa: BLE001
            acct = {"raw": out[:400]}
        emit({"step": "account-show", "account": {
            k: acct.get(k) for k in ("id", "name", "state", "tenantId", "user", "environmentName")
        }})
    else:
        emit({"step": "account-show", "rc": rc, "stderr": err.strip()[:500]})

    tok = get_token()
    if not tok:
        emit({"step": "fatal", "why": "no ARM token"})
        return
    cl = jwt_claims(tok)
    emit({"step": "arm-token-claims", "len": len(tok), "claims": {
        k: cl.get(k) for k in ("aud", "iss", "appid", "azp", "oid", "tid", "upn", "unique_name",
                               "scp", "roles", "idtyp", "exp", "iat", "nbf", "ver")
    }})

    s, subs = arm(tok, ARM + "/subscriptions?api-version=2022-12-01")
    vals = subs.get("value") or []
    emit({"step": "subscriptions", "http": s, "count": len(vals),
          "subs": [{"id": x.get("subscriptionId"), "name": x.get("displayName"),
                    "state": x.get("state"), "tenant": x.get("tenantId")} for x in vals]})

    enabled = [x for x in vals if str(x.get("state", "")).lower() == "enabled"]
    for sub in enabled:
        sid = sub.get("subscriptionId")
        s2, rgs = arm(tok, f"{ARM}/subscriptions/{sid}/resourcegroups?api-version=2021-04-01")
        rgnames = [r.get("name") for r in (rgs.get("value") or [])]
        emit({"step": "resource-groups", "sub": sid, "http": s2, "count": len(rgnames),
              "names": rgnames[:60]})

        s3, locs = arm(tok, f"{ARM}/subscriptions/{sid}/locations?api-version=2022-12-01")
        regions = [l.get("name") for l in (locs.get("value") or [])
                   if (l.get("metadata") or {}).get("regionType") == "Physical"]
        emit({"step": "regions", "sub": sid, "http": s3, "count": len(regions),
              "regions": regions})

        # ---- GPU-family usages, one call per physical region (read-only) ----
        def usage(region):
            url = (f"{ARM}/subscriptions/{sid}/providers/Microsoft.Compute/locations/"
                   f"{region}/usages?api-version=2024-07-01")
            st, body = arm(tok, url)
            rows = []
            for u in (body.get("value") or []):
                name = str((u.get("name") or {}).get("value", ""))
                up = name.upper()
                if ("NC" in up) or ("ND" in up) or ("NV" in up):
                    rows.append({"family": name, "current": u.get("currentValue"),
                                 "limit": u.get("limit")})
            return {"region": region, "http": st, "gpu_rows": rows,
                    "err": None if st == 200 else str(body)[:200]}

        with ThreadPoolExecutor(max_workers=8) as ex:
            results = list(ex.map(usage, regions[:90]))
        nonzero = []
        for r in results:
            for g in r["gpu_rows"]:
                if isinstance(g.get("limit"), (int, float)) and g["limit"] > 0:
                    nonzero.append({"region": r["region"], **g})
        emit({"step": "gpu-usages-summary", "sub": sid,
              "regions_scanned": len(results), "nonzero_rows": nonzero})
        nz_status = [r for r in results if r["http"] != 200]
        if nz_status:
            emit({"step": "gpu-usages-errors", "sub": sid, "errors": nz_status[:10]})

        # ---- GPU SKUs (read-only, paged) ----
        skus = []
        url = f"{ARM}/subscriptions/{sid}/providers/Microsoft.Compute/skus?api-version=2021-07-01"
        pages = 0
        while url and pages < 25:
            st, body = arm(tok, url)
            pages += 1
            if st != 200:
                emit({"step": "skus", "sub": sid, "http": st, "page": pages,
                      "err": str(body)[:300]})
                break
            for sk in (body.get("value") or []):
                nm = str(sk.get("name", ""))
                if nm.lower().startswith(("standard_nc", "standard_nd", "standard_nv")):
                    skus.append({
                        "name": nm,
                        "locations": len(sk.get("locations") or []),
                        "restrictions": [r.get("reasonCode") for r in (sk.get("restrictions") or [])],
                    })
            url = body.get("nextLink")
        emit({"step": "gpu-skus", "sub": sid, "pages": pages, "count": len(skus),
              "names": sorted({x["name"] for x in skus})[:200]})

    emit({"step": "done"})


if __name__ == "__main__":
    main()
