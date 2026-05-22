# Status

> 📐 PERMANENT-refreshable. Snapshot of what's built today vs design. Update on every CODE-COMPLETE PR. Last refresh: **2026-05-21**.

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

## Open blockers — operator actions

These three external credentials are NOT in the cluster yet and gate the corresponding surfaces:

| # | Credential | Where to mint | Mount as | Unblocks |
|---|---|---|---|---|
| 1 | **Apple Pass Type ID** `.p12` | developer.apple.com → Identifiers → Pass Type IDs | K8s secret in ns `dynolabs` | Real `.pkpass` issuance (today returns stub or 503) |
| 2 | **LinkedIn OAuth app** client id + secret | developer.linkedin.com → Create app. Redirect URI: `https://api.dynolabs.io/oauth/linkedin/callback` | K8s secret consumed by `linkedin-oauth` Deployment env | LinkedIn sign-in works in prod (in stub mode today: `clientID=="" → 503`) |
| 3 | **Google Wallet API issuer** + service-account JSON | console.cloud.google.com/google/wallet | K8s secret in ns `dynolabs` | `/pass/google` JWT issuance |

Operator actions also tracked in `lessons-learned/`, but this table is the live truth.

## Open blockers — iogrid substrate

| # | Blocker | Where it lives | Symptom |
|---|---|---|---|
| 1 | **`iogridd` daemon offline** on a Mac with `social-intel` opt-in | Founder's Mac. Install via `curl -fsSL https://raw.githubusercontent.com/iogrid/iogrid/main/installer/macos/install-iogridd.sh \| bash` | `POST /v1/enrich/linkedin` → empty Result; proxy-gateway logs `dispatch_failed: no eligible provider`. Auth path is verified working. |
| 2 | `proxy-gateway` `ValidateApiKey` Connect RPC not wired | iogrid (separate ticket on `iogrid/iogrid`) | Production uses `DEV_API_KEYS` env static fallback — vcard-prod key set on the running Deployment 2026-05-21 |
| 3 | `dynolabs-bump-sha.yml` workflow missing on `openova-private:main` | `openova-private` | CI in vcard tries `gh workflow run dynolabs-bump-sha.yml --repo openova-io/openova-private` and 404s; image SHA bumps are silently manual |

## Open issues — board

| Issue | Title | Label |
|---|---|---|
| [#1](https://github.com/dynolabs-io/vcard/issues/1) | v1: Dynolabs vCard — end-to-end build & deploy | `status/in-progress`, `area/mobile` |
| [#2](https://github.com/dynolabs-io/vcard/issues/2) | chore(repo): consider folding dynolabs-io/api into this repo as ./api/ | — (delivered 2026-05-21, awaiting close) |
| [#4](https://github.com/dynolabs-io/vcard/issues/4) | TBD-V01: scaffold canonical docs/ tree | — |

## Recent commits (last 14d)

```
c28c023 docs(claude): builds run on GitHub Actions, not locally
9eaf9a2 feat(enrich): drop Apollo, route LinkedIn enrichment via iogrid only
81b8da7 feat(mobile): pass LinkedIn vanity through to vcard-api at sign-in
85d932b fix(api): remove stray build binary + gitignore service binaries
a92b3de feat(enrich): self-only LinkedIn-via-iogrid fallback in /v1/enrich/email
9716250 docs(claude): reflect api/ subtree-merge in CLAUDE.md files
e5a6fd5 chore(api): relocate CI to vcard/.github/workflows/api-build.yml
29b944d Add 'api/' from commit 'e80cfcfc9fdcbd248e03309bbcc3337941cb832f'
e80cfcf feat(enrich): LinkedIn vanity enrichment via iogrid SOCKS5+TLS proxy
55ac71f chore: remove one-shot cinova secret bootstrap (job complete)
```

ADRs for the three major decisions in the last 7 days: [`adr/0001-subtree-merge-api.md`](adr/0001-subtree-merge-api.md), [`adr/0002-drop-apollo-iogrid-only.md`](adr/0002-drop-apollo-iogrid-only.md), [`adr/0003-linkedin-vanity-via-url-prompt.md`](adr/0003-linkedin-vanity-via-url-prompt.md).
