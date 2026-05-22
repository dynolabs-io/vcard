# Glossary

> 📐 PERMANENT canon. Terms used canonically in this repo + the small list of phrases that are banned. When a term in code or docs disagrees with this file, this file wins — update the code/doc, not the glossary.

## Canonical terms

| Term | Meaning |
|---|---|
| **vCard 3.0** | The standardized contact-card serialization (RFC 2426) that `lib/vcard.ts` emits. Cards in this app round-trip as vCard 3.0 strings; the `.vcf` download from a public profile page is canonical. |
| **slug** | The URL-safe identifier for a card. Public profile lives at `dynolabs.io/c/<slug>`; the photo lives at `cdn.dynolabs.io/p/<slug>`; the wallet pass `serialNumber` derives from it. `photo-cdn`'s `validSlug` regex defines the legal character set (see `PRINCIPLES.md` for the past hyphen-rejection gotcha). |
| **vanity** | The LinkedIn URL slug — the part after `/in/` in `linkedin.com/in/<vanity>`. We capture it via a user-pasted URL after OAuth (NOT via OIDC) and pass it to `POST /v1/enrich/linkedin`. See `lib/linkedin.ts` `extractLinkedInVanity`. |
| **iogrid** | The founder's separate product (`iogrid/iogrid` repo) — a residential-bandwidth proxy mesh. vCard is iogrid's first internal customer. Outbound LinkedIn fetches tunnel through `proxy.iogrid.org:443` (SOCKS5 inside TLS). |
| **iogridd** | The provider-side daemon installed on home machines (e.g. the founder's Mac) that provides the actual residential IP. One-shot installer at `iogrid/installer/macos/install-iogridd.sh`. |
| **Sovereign** | A deployed OpenOva instance (kind B in user-global §0). The contabo-mkt cluster (45.151.123.50) is the Sovereign that hosts `dynolabs`-namespaced workloads. |
| **CNPG** | CloudNativePG operator. `vcard-postgres` is a CNPG `Cluster` resource; the application-facing creds come from the `vcard-postgres-app` Secret it issues. |
| **pkpass** | Apple Wallet pass file (Content-Type `application/vnd.apple.pkpass`). Built by `pass-signer` (`api/services/pass-signer/main.go buildPass`). |
| **Hero strip** | The 1125×432 image at the top of an Apple Wallet pass. Per [`PRINCIPLES.md`](PRINCIPLES.md), it ALWAYS packs photo + brand logo + brand color — never gated on a style picker. |
| **Reveal** | A scan-time opt-in by the scanner to disclose their Dynolabs identity to the card owner so they appear in the owner's Inbox > Connections. Field: `scans.reveal BOOLEAN`. |
| **Inbox** | The card-owner-facing aggregation of `scans` (with reveal=true) + `leads` (web profile contact form) + `scan_events` (anonymous page-view analytics). Surfaces in the mobile `me` tab. |
| **DOD** | Definition of Done — operator walks fresh surface + screenshot attached to issue + founder closes the issue. Specialised in [`DOD.md`](DOD.md). |
| **TRUST.md** / **TRACKER.md** | The two cron-refreshable live-state ledgers in `docs/ledger/`. TRUST tracks verification state per walk surface; TRACKER tracks open work + DoD progress. |

## Build / deploy terms

| Term | Meaning |
|---|---|
| **TestFlight** | Apple's external-tester distribution channel. Founder installs vCard builds from here. The iOS CI workflow uploads to TestFlight and assigns to the `Founders` beta group. |
| **Founders group** | The internal-tester group in App Store Connect. New uploads are auto-assigned by `ios.yml` (or manually re-assigned via `asc-assign-build.yml`). |
| **GHCR** | GitHub Container Registry — `ghcr.io/dynolabs-io/vcard/api/<svc>:<sha>`. The pre-merge path was `ghcr.io/dynolabs-io/api/<svc>:<sha>` until the 2026-05-21 subtree merge. |
| **Flux** | The GitOps reconciler that watches `openova-io/openova-private` and applies the manifests under `clusters/contabo-mkt/apps/dynolabs/` to the contabo cluster. |
| **fastlane cert / sigh** | Apple-portal automation used inside `ios.yml`: `cert` mints / reuses a Distribution certificate; `sigh` regenerates the App Store provisioning profile pinned to that exact cert ID. |

## Banned terms — DO NOT use in code, commits, docs, or chat

| Banned | Use instead | Why banned |
|---|---|---|
| `Apollo` (as the enrichment provider name in production code) | iogrid LinkedIn-vanity enrichment | Apollo's free tier returns empty payloads; the path was removed in commit `9eaf9a2` (2026-05-21). Don't reintroduce without a fresh ADR. |
| `ig_live_*` (as an iogrid API key prefix) | `iog_` | The real prefix is `iog_` per `iogrid/coordinator/services/billing-svc/internal/server/api_keys.go:45`. `ig_live_*` is stale docs drift. See [`PRINCIPLES.md`](PRINCIPLES.md) §iogrid. |
| "MVP for now, refactor later" (in any 📐 PERMANENT doc) | Ship the target-state shape or write an ADR | Per user-global §3 anti-theater discipline. |
| "Closes #N" on a PR that ships a scaffold or stub | "Refs #N" | Auto-close on merge before the operator-walk + screenshot is the leading cause of false-positive completion. See user-global §3 rule 1. Exception: pure docs-only or CI-gate-only PRs. |
| `socks5://` (raw TCP) for the iogrid proxy in any new Go HTTP client | `tls.Dial` first, then SOCKS5 inside `*tls.Conn` | Traefik fronts `proxy.iogrid.org:443` with `IngressRouteTCP HostSNI` — raw TCP hangs until context deadline. See [`PRINCIPLES.md`](PRINCIPLES.md) §iogrid. |
| Photo-OR-Logo wallet style picker | Pack photo + logo + brand color together | See [`PRINCIPLES.md`](PRINCIPLES.md) §wallet-strip. |
| Wrapping the Stack in `<GestureHandlerRootView>` for swipe | `Animated.View` + `PanResponder` | iOS 26 + new-arch-off silently dismisses Stack modals. See [`PRINCIPLES.md`](PRINCIPLES.md) §ios26-swipe. |
