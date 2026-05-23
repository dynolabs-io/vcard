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
| Founder | Request Google Wallet API issuer at console.cloud.google.com/google/wallet → mount issuer + service-account JSON | Google Wallet pass walk row |
| iogrid platform | Resolve workloads-svc Traefik route — `/iogrid.workloads.v1.*` returns HTTP 404 even with proper Connect-RPC content-type. workloads-svc Deployment stuck mid-rollout (`replicas=2/1`, ImagePullBackOff). Filed [iogrid/iogrid#456](https://github.com/iogrid/iogrid/issues/456) with 8-mechanism diagnosis | Import-from-LinkedIn walk row + iogrid smoke-proxy walk row |

Apple Pass Type ID + LinkedIn OAuth app are **already provisioned** in the cluster — the previous incarnation of this table predated the actual provisioning. See updated [STATUS.md operator-actions table](../STATUS.md).

## DoD progress

| Surface | Code | Deploy | Walked | Done |
|---|---|---|---|---|
| Apple Sign-In | ✓ | ✓ | ✗ | ✗ |
| LinkedIn Sign-In | ✓ | ✓ | 🟢 server-side wiring walked 2026-05-23; founder full-flow 2026-05-21 | ✓ |
| Import from LinkedIn (with iogrid) | ✓ (`9eaf9a2`) | ✓ (`b2be7bdb`) | ✗ (blocked on `iogridd`) | ✗ |
| Card create + slug + photo | ✓ | ✓ | 🟢 walked 2026-05-23 (create + slug + photo upload + render + vCard PHOTO field) | ✓ |
| QR scan + import | ✓ | ✓ | ✗ | ✗ |
| Apple Wallet pass | ✓ | ✓ | 🟢 walked 2026-05-23 (server-side mint + Maestro Wallet-add gate) | ✓ |
| Google Wallet pass | ✓ | ✓ (stub mode) | ⛔ stub — operator action #3 (issuer) | ✗ |
| Web profile + leads | ✓ | ✓ | 🟢 walked 2026-05-23 (public profile + .vcf + lead-form POST) | ✓ |
| Reveal-mode → Inbox | ✓ | ✓ | ✗ | ✗ |

Per [`DOD.md`](../DOD.md), `Code ✓ + Deploy ✓` is necessary but not sufficient — every `✗ Walked` blocks `✗ Done`.

## Recently delivered

| Date | Delivery | Receipt |
|---|---|---|
| 2026-05-23 | Walk #8 (TBD-V03/#7): **Wallet-barcode → `/v/<slug>` → rich vCard with embedded photo** end-to-end (owner-named filename, base64 inline JPEG, structured `N:` field, typed URLs) | `walk-wallet-qr-target-2026-05-23.vcf` |
| 2026-05-23 | Walk #7: **Import-from-LinkedIn** ⛔ VERIFIED-FAIL with 8-mechanism diagnosis; iogrid issue [#456](https://github.com/iogrid/iogrid/issues/456) filed with concrete fix order + iogrid PR [#458](https://github.com/iogrid/iogrid/pull/458) opened with the workloads-svc imagePullSecrets fix | workloads-svc Traefik route HTTP 404 + stuck rollout proven |
| 2026-05-23 | Walk #6: **LinkedIn OAuth wiring** end-to-end to LinkedIn's gate — valid client_id, LinkedIn app_id `230775252` accepts the auth request, sign-in page renders | screenshot `walk-linkedin-oauth-app-id-230775252-2026-05-23.png` |
| 2026-05-23 | Walk #5: **pass-signer Apple Wallet** — real 98 KB signed `.pkpass`, PKCS7 sig + all 10 files; strip composite packs photo + brand logo + brand color per §wallet-strip principle | `walk-applewallet-pass-uk4kcdpm-2026-05-23.pkpass`, `walk-applewallet-strip-2026-05-23.png` |
| 2026-05-23 | Walk #4: **iOS Maestro CI** — 2 flows (`01-launch`, `02-create-card`) green every push on iOS 26.2 Simulator; takeScreenshot added so future runs leave PNGs | run `26226863900` JUnit `status=SUCCESS`; new screenshot directives shipped in `78435f1` |
| 2026-05-23 | Walk #3: **photo-cdn upload + serve + card photo render + vCard PHOTO field** end-to-end | avatar 15393 B + logo 13713 B uploaded to `cdn.dynolabs.io/p/uk4kcdpm{,-brand}`; card PATCHed; SSR renders avatar; `.vcf` ships `PHOTO;VALUE=uri:…`; screenshot `walk-public-profile-photo-2026-05-23.png` |
| 2026-05-23 | Walk #2: **lead form on public web profile** — POST + redirect + DB row + 4 fields persisted. Screenshot landed on issue #1 | Lead `id=29e82180-…`, target_slug `uk4kcdpm`; screenshots `walk-leadform-filled-2026-05-23.png` + `walk-leadform-sent-2026-05-23.png` |
| 2026-05-23 | Walk #1: **public web profile + vCard 3.0 download** end-to-end, screenshot landed on issue #1 | [issue #1 comment](https://github.com/dynolabs-io/vcard/issues/1#issuecomment-4524432416); slug `uk4kcdpm`; screenshot `walk-public-profile-emrah-2026-05-23.png` |
| 2026-05-22 | `make smoke-proxy` operator probe + `api/Makefile` + `api/deploy/iogrid-proxy-creds.example.yaml` skeleton | vcard `a38edd6` (PR #3) |
| 2026-05-21 | Apollo path deleted; iogrid-only enrichment | vcard `9eaf9a2`, openova-private `b2be7bdb` |
| 2026-05-21 | iogrid SOCKS5+TLS LinkedIn-vanity fetch wired | vcard `e80cfcf` (pre-merge); now under `api/services/vcard-api/enrich/linkedin.go` |
| 2026-05-21 | Subtree merge `dynolabs-io/api` → `vcard/api/` | vcard `29b944d`, `e5a6fd5`; openova-private `207b0199`; `dynolabs-io/api` archived |
| 2026-05-21 | iOS CI auto-signing (fastlane cert + sigh, ASC API) + Maestro E2E gate + TestFlight + Founders-group assign | `.github/workflows/ios.yml`, run 26226863900 |
