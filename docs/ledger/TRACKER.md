# TRACKER — open work + DoD progress

> 🟢 LIVE STATE. Cron-refresh expected. The two authoritative numbers the founder reads at a glance:
>
> - **Open issues**: see board below
> - **TestFlight builds awaiting walk**: rows in [`TRUST.md`](TRUST.md) marked 🔴 UNVERIFIED

Last refresh: **2026-05-23**.

## Open issues — board

| # | Title | Status |
|---|---|---|
| [#1](https://github.com/dynolabs-io/vcard/issues/1) | v1: Dynolabs vCard — end-to-end build & deploy | `status/in-progress`, `area/mobile` |
| [#2](https://github.com/dynolabs-io/vcard/issues/2) | chore(repo): consider folding `dynolabs-io/api` into this repo as `./api/` | Delivered 2026-05-21 (commits `29b944d` + `e5a6fd5`) — awaiting founder close |
| [#4](https://github.com/dynolabs-io/vcard/issues/4) | TBD-V01: scaffold canonical docs/ tree (user-global §11 shape) | In-progress (this PR) |

## Outstanding operator actions (blocking DoD per [STATUS.md](STATUS.md))

| Owner | Action | Blocks |
|---|---|---|
| Founder | Mint Apple Pass Type ID `.p12` at developer.apple.com → mount as K8s Secret | Apple Wallet pass walk row in [`TRUST.md`](TRUST.md) |
| Founder | Create LinkedIn OAuth app at developer.linkedin.com → mount as K8s Secret | LinkedIn Sign-In leaving stub mode in production |
| Founder | Request Google Wallet API issuer at console.cloud.google.com/google/wallet → mount issuer + service-account JSON | Google Wallet pass walk row |
| Founder | Install `iogridd` on Mac (one-liner — see [RUNBOOKS.md](../RUNBOOKS.md)) | Import-from-LinkedIn walk row |

## DoD progress

| Surface | Code | Deploy | Walked | Done |
|---|---|---|---|---|
| Apple Sign-In | ✓ | ✓ | ✗ | ✗ |
| LinkedIn Sign-In | ✓ | ✓ | 🟡 partial | ✗ |
| Import from LinkedIn (with iogrid) | ✓ (`9eaf9a2`) | ✓ (`b2be7bdb`) | ✗ (blocked on `iogridd`) | ✗ |
| Card create + slug + photo | ✓ | ✓ | ✗ | ✗ |
| QR scan + import | ✓ | ✓ | ✗ | ✗ |
| Apple Wallet pass | ✓ | ✓ | ✗ (blocked on `.p12`) | ✗ |
| Google Wallet pass | ✓ | ✓ | ✗ (blocked on issuer) | ✗ |
| Web profile + leads | ✓ | ✓ | ✗ | ✗ |
| Reveal-mode → Inbox | ✓ | ✓ | ✗ | ✗ |

Per [`DOD.md`](../DOD.md), `Code ✓ + Deploy ✓` is necessary but not sufficient — every `✗ Walked` blocks `✗ Done`.

## Recently delivered

| Date | Delivery | Receipt |
|---|---|---|
| 2026-05-22 | `make smoke-proxy` operator probe + `api/Makefile` + `api/deploy/iogrid-proxy-creds.example.yaml` skeleton | vcard `a38edd6` (PR #3) |
| 2026-05-21 | Apollo path deleted; iogrid-only enrichment | vcard `9eaf9a2`, openova-private `b2be7bdb` |
| 2026-05-21 | iogrid SOCKS5+TLS LinkedIn-vanity fetch wired | vcard `e80cfcf` (pre-merge); now under `api/services/vcard-api/enrich/linkedin.go` |
| 2026-05-21 | Subtree merge `dynolabs-io/api` → `vcard/api/` | vcard `29b944d`, `e5a6fd5`; openova-private `207b0199`; `dynolabs-io/api` archived |
| 2026-05-21 | iOS CI auto-signing (fastlane cert + sigh, ASC API) + Maestro E2E gate + TestFlight + Founders-group assign | `.github/workflows/ios.yml`, run 26226863900 |
