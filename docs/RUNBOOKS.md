# Runbooks

> 📐 PERMANENT canon. Operator how-tos. Per-incident playbooks (when we have them) live in `runbooks/`; this file is the steady-state operator surface.

## Mobile dev — local

```bash
npm install
npx expo start            # opens dev tools
# or run a specific platform:
npm run ios               # macOS only
npm run android
npm run web

# Sanity gates (the same ones CI runs at the start):
npm run typecheck
npm run lint
```

Edit screens under `app/`. Routes are file-based via `expo-router`. Don't hardcode URLs in components — always pull from `lib/config.ts`.

## Backend dev — local

```bash
cd api
go build ./...            # workspace build, all 5 services
go test ./...             # unit tests
# Single service:
cd services/vcard-api
go run .                  # listens on :8080
curl localhost:8080/healthz
```

The Go workspace pin is `api/go.work` (lists the 5 service modules + `shared`). `go.work.sum` is committed for reproducibility.

## Mobile build / release

**Builds run in GitHub Actions only — never run `eas build` locally.** The iOS workflow fires automatically on push to `main` when any of these paths change:

```
app/** lib/** components/** hooks/** constants/** assets/**
app.json package*.json .maestro/** .github/workflows/ios.yml
```

| Workflow | What it does |
|---|---|
| `.github/workflows/ios.yml` | macOS runner → `npx expo prebuild` → CocoaPods → ASC API key materialized → fastlane `cert` (pre-revokes oldest if at 2-cert limit) + `sigh renew` for `Dynolabs vCard App Store` profile → simulator E2E gate (Maestro) → archive → export → TestFlight upload → ASC `Founders` group assign |
| `.github/workflows/asc-assign-build.yml` | `workflow_dispatch` only — re-assigns a specific build to `Founders` if the post-upload assign step failed |

If the iOS build fails with `"Signing certificate is invalid ... revoked or expired"`: the pre-revoke step in `ios.yml` should free a slot on the next run. If two distribution certs remain valid but the keychain only has the one fastlane just generated, the workflow pins `sigh` to the freshly-generated cert ID — re-running is usually enough.

## Backend build / release

CI fires on push to `main` when `api/**` changes:

| Workflow | What it does |
|---|---|
| `.github/workflows/api-build.yml` | Matrix builds all 5 services in parallel → `docker buildx` with `gha` cache → push `ghcr.io/dynolabs-io/vcard/api/<svc>:<short-sha>` + `:latest` |

### Bump backend image SHA in production (manual today)

The auto-bump workflow is not wired yet (see [`STATUS.md`](STATUS.md) blocker #3). To roll a backend change to `contabo-mkt`:

```bash
cd ~/repos/openova-private
# Bump all 5 in lockstep to a fresh SHA — they ship from one repo + commit.
SHA=<short-sha-of-the-vcard-main-commit>
sed -i -E "s|image: ghcr.io/dynolabs-io/vcard/api/([a-z-]+):[a-z0-9]+|image: ghcr.io/dynolabs-io/vcard/api/\1:${SHA}|" \
  clusters/contabo-mkt/apps/dynolabs/{vcard-api,pass-signer,photo-cdn,linkedin-oauth,web-profile}.yaml

git add clusters/contabo-mkt/apps/dynolabs/*.yaml
git commit -m "deploy(dynolabs): bump to ${SHA}"
git push origin main

# Force Flux reconcile (optional; saves 1-2 min):
kubectl --kubeconfig ~/.kube/config -n flux-system annotate --overwrite \
  gitrepository flux-system reconcile.fluxcd.io/requestedAt="$(date +%s)"
kubectl --kubeconfig ~/.kube/config -n flux-system annotate --overwrite \
  kustomization apps reconcile.fluxcd.io/requestedAt="$(date +%s)"

# Watch the rollout:
kubectl --kubeconfig ~/.kube/config -n dynolabs rollout status deploy/vcard-api --timeout=120s
```

Default kubeconfig points to the contabo mothership (`45.151.123.50:6443`).

## Mint a fresh iogrid API key for vcard-prod

If the existing key (last-four `0506`, id `efd20c9d-…`) is revoked or rotated, mint a new one from the bastion:

```bash
kubectl exec -i -n iogrid iogrid-pg-1 -c postgres -- psql -U postgres -d billing -e <<'SQL'
WITH gen AS (
  SELECT 'iog_' || encode(gen_random_bytes(32), 'hex') AS plaintext
),
inserted AS (
  INSERT INTO api_key (
    id, workspace_id, label, key_hash, last_four, tier,
    allowed_categories, geo_target, kyc_verified
  )
  SELECT
    gen_random_uuid(),
    '11111111-2222-3333-4444-555555555555'::uuid,
    'vcard-prod-linkedin-enrich',
    encode(digest(plaintext, 'sha256'), 'hex'),
    right(plaintext, 4),
    'PAYG',
    'social-intel',
    'US',
    false
  FROM gen
  RETURNING id, workspace_id, label, last_four, tier, created_at
)
SELECT gen.plaintext AS plaintext_key, inserted.*
FROM gen, inserted;
SQL
```

Plaintext is one-time — capture it into the founder's password manager AND replace it in the `iogrid-proxy-creds` Secret in ns `dynolabs`:

```bash
kubectl -n dynolabs create secret generic iogrid-proxy-creds \
  --from-literal=IOGRID_API_KEY='iog_…' \
  --from-literal=IOGRID_WORKSPACE='vcard-prod' \
  --from-literal=IOGRID_PROXY_URL='proxy.iogrid.org:443' \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n dynolabs rollout restart deploy/vcard-api
```

Also update the proxy-gateway's `DEV_API_KEYS` env on the running iogrid Deployment (until the ValidateApiKey RPC lands — see [`STATUS.md`](STATUS.md) blocker #2):

```bash
kubectl -n iogrid set env deploy/proxy-gateway \
  DEV_API_KEYS='iog_…=11111111-2222-3333-4444-555555555555'
```

The full wire-format gotchas (key prefix, hash, workspaces-table shape, outer-TLS-before-SOCKS5) are in [`PRINCIPLES.md`](PRINCIPLES.md) §iogrid.

The canonical Secret skeleton lives in-tree at `api/deploy/iogrid-proxy-creds.example.yaml` (PR #3) — empty values, instructional comments. Treat as the shape contract; never commit a real `iog_` key.

## Verify the iogrid proxy is actually in the egress path (`make smoke-proxy`)

> Source: previously `README.md` "Proxy mode (iogrid residential SOCKS5+TLS) → Smoke test" + `api/services/vcard-api/cmd/smoke-proxy/main.go` (PR #3, merged 2026-05-22 as `a38edd6`). Folded here on 2026-05-23.

The LinkedIn enrichment client always returns 200 with empty fields on transport failure (graceful-skip is the contract per [`PRINCIPLES.md`](PRINCIPLES.md)) — that hides a misconfigured proxy in production. The `make smoke-proxy` probe fails LOUDLY so operators catch `IOGRID_API_KEY` rotations, gateway outages, and Traefik mis-wiring before a real LinkedIn lookup silently degrades.

### What it does

`api/services/vcard-api/cmd/smoke-proxy/main.go` reuses the exact `enrich.LinkedInFromEnv()` client (same `Transport.DialContext` that vcard-api itself uses), GETs `https://api.ipify.org?format=json`, and asserts the returned IP is NOT the local egress IP. Non-zero exit on any failure; logs `smoke-proxy PASS` + the proxied IP + latency on success.

### How to run

```bash
cd api
IOGRID_WORKSPACE=vcard \
IOGRID_API_KEY=iog_… \
IOGRID_PROXY_URL=proxy.iogrid.org:443 \
  make smoke-proxy
```

Exit codes:

- `0` → proxy is in the path; egress IP ≠ local IP.
- `1` → transport failure (proxy unreachable, TLS handshake failed, SOCKS5 auth rejected, CONNECT rejected, etc.) OR `proxy egress IP == local egress IP` (proxy bypass — fail loudly).
- `2` → env not set (the Makefile target's preflight refuses to invoke without `IOGRID_API_KEY` + `IOGRID_WORKSPACE`).

### Other Makefile targets

`api/Makefile` (PR #3) ships these convenience targets for local loops. CI still owns shipped artifacts (`.github/workflows/api-build.yml`); this is only for the local edit-test-smoke loop:

```
make build         # go build ./... across the workspace
make test          # go test ./... across the workspace
make test-enrich   # go test -v ./services/vcard-api/enrich/... (offline)
make vet           # go vet ./...
make tidy          # go mod tidy per service module
make smoke-proxy   # the probe above
make help          # auto-generated from ## comments
```

## Install `iogridd` on the founder's Mac

Required for `POST /v1/enrich/linkedin` to actually fetch LinkedIn pages (see [`STATUS.md`](STATUS.md) iogrid blocker #1):

```bash
# One-shot installer from the published Phase 0 release.
curl -fsSL https://raw.githubusercontent.com/iogrid/iogrid/main/installer/macos/install-iogridd.sh | bash

# After install:
launchctl list | grep iogridd
# Should show a running PID and exit code 0.
```

The installer handles daemon download, launchd registration, and `social-intel` category opt-in. After install, `workloads-svc` in the iogrid mothership should see one online provider and `proxy-gateway` dispatches will succeed.

## Smoke-test an enrichment end-to-end

From the bastion:

```bash
# 1. Get an auth token (any signed-in user works):
TOKEN=<paste from device or mint via /v1/auth/apple in dev>

# 2. Fire the enrichment:
kubectl -n dynolabs run -it --rm sm --image=curlimages/curl --restart=Never --command -- \
  curl -s -w '\nHTTP %{http_code}\n' \
    -X POST -H "Content-Type: application/json" -H "Authorization: Bearer ${TOKEN}" \
    -d '{"vanity":"satyanadella"}' \
    http://vcard-api.dynolabs.svc:80/v1/enrich/linkedin

# Expected:
# - With iogridd running:   {"title":"...","company":"Microsoft","companyDomain":"microsoft.com",...} HTTP 200
# - Without iogridd:        {"title":"","company":"",...}  HTTP 200 (graceful skip — see proxy-gateway logs)
```

## Watch proxy-gateway logs for dispatch outcomes

```bash
kubectl -n iogrid logs deploy/proxy-gateway --tail=20 --since=5m | jq -c 'select(.msg=="proxy_audit")'
# Look for event_kind ∈ {accepted, rejected} and reason for the failures.
```
