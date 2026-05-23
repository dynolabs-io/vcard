# Status

> 📐 PERMANENT-refreshable. Snapshot of what's built today vs design. Update on every CODE-COMPLETE PR. Last refresh: **2026-05-23**.

## Built and running

| Surface | Where it runs | State |
|---|---|---|
| Mobile app — cards CRUD + QR render + QR scan + offline storage | TestFlight, build at `c28c023` | Shipped |
| Apple Sign-In | `vcard-api /v1/auth/apple` | Shipped — JWS verified against Apple's JWKS, HS256 session issued |
| LinkedIn OAuth sign-in | `linkedin-oauth` + `vcard-api /v1/auth/linkedin` | Shipped — server-side code-exchange, `sub` trusted |
| LinkedIn vanity enrichment | `vcard-api /v1/enrich/linkedin` via iogrid SOCKS5+TLS | Shipped at `9eaf9a2` — proxy auth working end-to-end; **dispatch blocked** (see below) |
| Apple `.pkpass` signing | `pass-signer /pass/apple` | Code shipped; cert unprovisioned (see operator actions) |
| Google Wallet JWT | `pass-signer /pass/google` | Code shipped; issuer unprovisioned (see operator actions) |
| Photo CDN | `photo-cdn` over MinIO bucket `vcard-photos` | Shipped |
| Public web profile | `web-profile` (SSR) at `dynolabs.io/c/<slug>` | Shipped |
| Inbox (scans + reveal + blocks) | `vcard-api /v1/scans*`, `/v1/leads*` | Shipped |
| Wallet web-service for push-updates | `vcard-api /v1/wallet/*` | Shipped (relies on pass-signer .p12) |
| End-to-end iOS CI | `.github/workflows/ios.yml` — ASC API auto-signing + Maestro gate + TestFlight + Founders-group assign | Shipped at run `26226863900` (2026-05-21) |
| Operator smoke probe — `make smoke-proxy` proves iogrid proxy is in the egress path | `api/services/vcard-api/cmd/smoke-proxy/main.go` + `api/Makefile` | Shipped at `a38edd6` (PR #3, 2026-05-22). See [`RUNBOOKS.md`](RUNBOOKS.md) "Verify the iogrid proxy is actually in the egress path" |
| iogrid Secret skeleton (shape contract, empty values) | `api/deploy/iogrid-proxy-creds.example.yaml` | Shipped at `a38edd6` (PR #3) |

## Open blockers — operator actions

Live state per 2026-05-23 in-cluster smoke (autonomous walk session):

| # | Credential | State | Evidence |
|---|---|---|---|
| ~~1~~ | ~~Apple Pass Type ID `.p12`~~ | ✅ **Already provisioned** | `pass-signer` Deployment mounts Secret `dynolabs-apple-pass` as volume `apple-pass-creds`. Pod log: `pass-signer loaded subject="Pass Type ID: pass.io.dynolabs.vcard" wwdr="Apple Worldwide Developer Relations Certification Authority"`, `stub=false`. Live `/pass/apple?slug=uk4kcdpm` returns HTTP 200 + 98 KB signed `.pkpass` with all 10 components + valid PKCS7 `signature` file. |
| ~~2~~ | ~~LinkedIn OAuth app client id + secret~~ | ✅ **Already provisioned** | `linkedin-oauth` Deployment pod log: `linkedin-oauth listening ... stub=false callback="https://api.dynolabs.io/oauth/linkedin/callback"`. Credentials injected via secretKeyRef at runtime (not shown in jsonpath but the `stub=false` proves the loader resolved them). |
| 3 | **Google Wallet API issuer** + service-account JSON | ❌ **Still pending** | `POST pass-signer:/pass/google` returns HTTP 503 with body `{"error":"stub-mode: Google Wallet issuer not yet provisioned"}`. Where to mint: console.cloud.google.com/google/wallet. Mount as K8s Secret in ns `dynolabs`. |

The Apple Pass + LinkedIn rows were stale in this file before 2026-05-23 (the doc predated the actual provisioning). Operator-action follow-up: only Google Wallet remains.

## Open blockers — iogrid substrate

| # | Blocker | Where it lives | Symptom |
|---|---|---|---|
| 1 | **Traefik intercepts TLS on `proxy.iogrid.org:443`** before SOCKS5 can negotiate | iogrid gateway-side ([iogrid/iogrid#414](https://github.com/iogrid/iogrid/issues/414), [#350](https://github.com/iogrid/iogrid/issues/350) — Traefik vs IngressRouteTCP TLS-passthrough still flapping per PR #3 status note 2026-05-22) | `make smoke-proxy` will fail until this lands. Enrichment stays in graceful-skip path (200 with empty fields) — zero production impact today |
| 2 | **`iogridd` daemon registered but no live dispatch stream** to `workloads-svc` | iogrid Phase 0 daemon scope (separate from #1 — even after gateway is fixed, the daemon needs to hold an open BidiStream to `https://api.iogrid.org/iogrid.workloads.v1.Dispatch`) | Provider row in iogrid `providers` DB shows `status=active`, `last_seen_at` recent, BUT `workloads-svc` logs `dispatcher: no eligible provider` because no daemon BidiStream is open against this replica. Evidence captured 2026-05-22 in the in-cluster Go smoke. |
| 3 | `proxy-gateway` `ValidateApiKey` Connect RPC not wired | iogrid (separate ticket on `iogrid/iogrid`) | Production uses `DEV_API_KEYS` env static fallback — vcard-prod key set on the running Deployment 2026-05-21 |
| 4 | `dynolabs-bump-sha.yml` workflow missing on `openova-private:main` | `openova-private` | CI in vcard tries `gh workflow run dynolabs-bump-sha.yml --repo openova-io/openova-private` and 404s; image SHA bumps are silently manual |
| 5 | `iogrid-proxy-creds` Secret unpopulated on contabo-mkt (`dynolabs` ns) | Operator action — mint workspace + API key in iogrid `billing-svc`, then `kubectl create secret generic ...` per `api/deploy/iogrid-proxy-creds.example.yaml`. The Deployment already wires the three env keys with `optional: true` so the pod boots before this lands | `enrich.LinkedInClient.Enabled() == false` → enrich endpoint 200s with empty fields. Same UX symptom as blockers 1+2, different root cause |

## Open issues — board

| Issue | Title | Label |
|---|---|---|
| [#1](https://github.com/dynolabs-io/vcard/issues/1) | v1: Dynolabs vCard — end-to-end build & deploy | `status/in-progress`, `area/mobile` |
| [#2](https://github.com/dynolabs-io/vcard/issues/2) | chore(repo): consider folding dynolabs-io/api into this repo as ./api/ | — (delivered 2026-05-21, awaiting close) |
| [#4](https://github.com/dynolabs-io/vcard/issues/4) | TBD-V01: scaffold canonical docs/ tree | — |

## Recent commits (last 14d)

```
a38edd6 feat(api,infra): route outbound HTTP via iogrid SOCKS5 proxy (first-customer integration) (#3)
c28c023 docs(claude): builds run on GitHub Actions, not locally
9eaf9a2 feat(enrich): drop Apollo, route LinkedIn enrichment via iogrid only
81b8da7 feat(mobile): pass LinkedIn vanity through to vcard-api at sign-in
85d932b fix(api): remove stray build binary + gitignore service binaries
a92b3de feat(enrich): self-only LinkedIn-via-iogrid fallback in /v1/enrich/email
9716250 docs(claude): reflect api/ subtree-merge in CLAUDE.md files
e5a6fd5 chore(api): relocate CI to vcard/.github/workflows/api-build.yml
29b944d Add 'api/' from commit 'e80cfcfc9fdcbd248e03309bbcc3337941cb832f'
e80cfcf feat(enrich): LinkedIn vanity enrichment via iogrid SOCKS5+TLS proxy
```

ADRs for the three major decisions in the last 7 days: [`adr/0001-subtree-merge-api.md`](adr/0001-subtree-merge-api.md), [`adr/0002-drop-apollo-iogrid-only.md`](adr/0002-drop-apollo-iogrid-only.md), [`adr/0003-linkedin-vanity-via-url-prompt.md`](adr/0003-linkedin-vanity-via-url-prompt.md).
