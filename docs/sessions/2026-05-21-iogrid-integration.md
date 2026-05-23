# 2026-05-21 — iogrid LinkedIn-vanity integration end-to-end

> 🗓️ TRANSIENT session artifact. Auto-archive after 30 days unless referenced.

## What shipped

| Repo | Commit | Summary |
|---|---|---|
| pre-merge `dynolabs-io/api` | `e80cfcf` | LinkedIn vanity-page enrichment via iogrid SOCKS5+TLS proxy — initial chain |
| `dynolabs-io/vcard` | `29b944d` | Subtree-merge `api/` into vcard |
| `dynolabs-io/vcard` | `e5a6fd5` | Relocate CI to `vcard/.github/workflows/api-build.yml` |
| `dynolabs-io/vcard` | `a92b3de` | Self-only LinkedIn-via-iogrid fallback in `/v1/enrich/email` (later superseded) |
| `dynolabs-io/vcard` | `85d932b` | Remove stray Go binary + gitignore service binaries |
| `dynolabs-io/vcard` | `81b8da7` | Pass LinkedIn vanity through to vcard-api at sign-in |
| `dynolabs-io/vcard` | `9eaf9a2` | **Drop Apollo, route enrichment via iogrid only** (URL-prompt flow) |
| `dynolabs-io/vcard` | `c28c023` | CLAUDE.md: builds run on GitHub Actions |
| `openova-private` | `0811450e` | Wire `iogrid-proxy-creds` env on vcard-api |
| `openova-private` | `554c5ecf` | Bump image to `e80cfcf` (initial) |
| `openova-private` | `207b0199` | Cut over to `ghcr.io/dynolabs-io/vcard/api/*` (post-merge) |
| `openova-private` | `87da551f` | Bump 5 services to `85d932b` |
| `openova-private` | `b2be7bdb` | Bump to `9eaf9a2` + drop `APOLLO_API_KEY` env |

## Substrate touch

- iogrid `billing.api_key` row minted via `kubectl exec iogrid-pg-1 ... psql -U postgres -d billing`. ID `efd20c9d-232f-43ab-96c0-b424e96f5478`, label `vcard-prod-linkedin-enrich`, last-four `0506`, tier PAYG, allowed_categories `social-intel`, geo_target `US`.
- iogrid `proxy-gateway` `DEV_API_KEYS` env updated via `kubectl set env` (until ValidateApiKey RPC lands) to include the new key paired with workspace `11111111-2222-3333-4444-555555555555`.
- vCard ns `iogrid-proxy-creds` Secret created in `dynolabs` ns with `IOGRID_API_KEY` / `IOGRID_WORKSPACE` / `IOGRID_PROXY_URL`.
- All five vcard-api Deployments rolled clean to `9eaf9a2` post-Flux reconcile.
- `users.linkedin_vanity` column landed via the idempotent migration in `cards/migrations.go`.

## End-to-end smoke

| Hop | Result |
|---|---|
| TLS handshake against `proxy.iogrid.org:443` | ✓ |
| RFC 1928 SOCKS5 greet | ✓ |
| RFC 1929 USERPASS authentication | ✓ (after `DEV_API_KEYS` env update; before that → `invalid api key`) |
| SOCKS5 CONNECT dispatch | ⛔ `dispatch_failed: no eligible provider` (no `iogridd` online yet) |
| `POST /v1/enrich/linkedin` in-cluster | ✓ 401 unauthenticated as designed |
| `POST /v1/enrich/email` post-removal | ✓ 404 as designed |
| iOS TestFlight build `9eaf9a2` | ✓ uploaded + assigned to Founders group (run `26226863900`, 29m48s) |
| TestFlight install + walk | 🔴 pending (TRUST.md row "Import from LinkedIn") |

## Issues touched

- [#2](https://github.com/dynolabs-io/vcard/issues/2) — closed-track for subtree-merge delivery
- [#4](https://github.com/dynolabs-io/vcard/issues/4) — opened for docs restructure (this PR)

## Pending follow-ups not addressed in this session

- Founder action: provision Apple Pass Type ID `.p12`, LinkedIn OAuth app credentials, Google Wallet issuer.
- iogrid-side: resolve [iogrid/iogrid#414](https://github.com/iogrid/iogrid/issues/414) + [#350](https://github.com/iogrid/iogrid/issues/350) (Traefik vs IngressRouteTCP TLS-passthrough on `proxy.iogrid.org:443`).
- iogrid-side: daemon BidiStream to `workloads-svc.Dispatch` — provider rows heartbeat fine but no dispatch stream is open per 2026-05-22 in-cluster Go smoke evidence.
- iogrid-side: wire `ValidateApiKey` Connect RPC so `proxy-gateway` stops using `DEV_API_KEYS`.
- openova-private: file the missing `dynolabs-bump-sha.yml` workflow so image SHA bumps stop being silently manual.

See [`STATUS.md`](../STATUS.md) for the live truth of each blocker.
