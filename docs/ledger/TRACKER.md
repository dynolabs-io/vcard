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
| [#4](https://github.com/dynolabs-io/vcard/issues/4) | TBD-V01: scaffold canonical docs/ tree (user-global §11 shape) | PR [#5](https://github.com/dynolabs-io/vcard/pull/5) open + CI green; awaiting founder review |
| [#6](https://github.com/dynolabs-io/vcard/issues/6) | TBD-V02: walk iOS Maestro CI with PNG screenshots | iOS CI run `26326818765` in flight on `2891338` — will land 3 PNGs |
| [#7](https://github.com/dynolabs-io/vcard/issues/7) | TBD-V03: walk Wallet-barcode → /v/&lt;slug&gt; → vCard chain | ✅ Walked 2026-05-23 (comment 4524565522). Awaiting founder close |
| [#8](https://github.com/dynolabs-io/vcard/issues/8) | TBD-V04: walk Account-tab sign-in CTAs via Maestro | In `2891338`; iOS CI run `26326818765` will walk it |
| [#9](https://github.com/dynolabs-io/vcard/issues/9) | TBD-V05: scan_events emission not wired | Discovered during walk #1 + #3; backend handler missing |

## Outstanding operator actions (blocking DoD per [STATUS.md](STATUS.md))

| Owner | Action | Blocks |
|---|---|---|
| Founder | Request Google Wallet API issuer at console.cloud.google.com/google/wallet → mount issuer + service-account JSON | Google Wallet pass walk row |
| iogrid platform | Resolve workloads-svc Traefik route — `/iogrid.workloads.v1.*` returns HTTP 404 even with proper Connect-RPC content-type. workloads-svc Deployment stuck mid-rollout (`replicas=2/1`, ImagePullBackOff). Filed [iogrid/iogrid#456](https://github.com/iogrid/iogrid/issues/456) with 8-mechanism diagnosis. PR [iogrid/iogrid#458](https://github.com/iogrid/iogrid/pull/458) opened with the workloads-svc `imagePullSecrets` fix — **mergeable, CI green, awaiting iogrid maintainer review** | Import-from-LinkedIn walk row + iogrid smoke-proxy walk row |

Apple Pass Type ID + LinkedIn OAuth app are **already provisioned** in the cluster — the previous incarnation of this table predated the actual provisioning. See updated [STATUS.md operator-actions table](../STATUS.md).

## DoD progress

| Surface | Code | Deploy | Walked | Done |
|---|---|---|---|---|
| Apple Sign-In | ✓ | ✓ | ✗ | ✗ |
| LinkedIn Sign-In | ✓ | ✓ | 🟢 server-side wiring walked 2026-05-23; founder full-flow 2026-05-21 | ✓ |
| Import from LinkedIn (with iogrid) | ✓ (`9eaf9a2`) | ✓ (`b2be7bdb`) | ⛔ blocked on iogrid platform — workloads-svc Traefik route HTTP 404, iogrid PR [#458](https://github.com/iogrid/iogrid/pull/458) opened mergeable/green | ✗ |
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
| 2026-05-23 | Walk #14 (TBD-V09/#17): **Mobile Inbox UI consumes /v1/inbox/reach** — closes the demo loop. Inbox tab now renders 3 intent levels separately (Profile views / Contact saves / Wallet adopts) under the existing REACH summary. iOS CI fires automatically — TestFlight will carry the build. | PR [#18](https://github.com/dynolabs-io/vcard/pull/18) merged (`b0a4fde`); iOS run [26331837222](https://github.com/dynolabs-io/vcard/actions/runs/26331837222) in flight |
| 2026-05-23 | Walk #13 (TBD-V08/#15): **Inbox-reach endpoint live** — `GET /v1/inbox/reach?slug=…` returns totals + byDay + uaFamily aggregations. Verified on slug `w945dwk9` (owned by user 491c04eb-…): 12 walks across 3 UAs returned `{totals:{profile:3,vcf:6,pkpass:3}, uaFamily:{Android:4,Mac:4,iPhone:4}}`. Auth + owner-scope + agg all working via both public ingress and in-cluster paths. | PR [#16](https://github.com/dynolabs-io/vcard/pull/16) merged (`58f7357`); openova-private `2222eda7` bumps vcard-api |
| 2026-05-23 | Walk #12 (TBD-V07/#13): **pkpass emission wired** on pass-signer `/pass/apple`. Verified end-to-end: slug `vqsdrvp7` → row in `scan_events` (kind=pkpass, ua_family=iPhone). Inbox can now count Wallet adopts. | PR [#14](https://github.com/dynolabs-io/vcard/pull/14) merged (`adb8a8b`); openova-private `f2ff0d92` bumps pass-signer |
| 2026-05-23 | Walk #11 (TBD-V05/#9): **scan_events emission wired** on `/c/<slug>` + `/c/<slug>/save.vcf` + `/v/<slug>`. Verified end-to-end: slug `fd6zqekt` → 3 rows in `scan_events` (kind=profile/vcf/vcf, ua_family=iPhone). | PR [#12](https://github.com/dynolabs-io/vcard/pull/12) merged (`9396714`); openova-private `f808f8fc` bumps all 3 services |
| 2026-05-23 | Walk #10 (TBD-V06/#10): **PATCH /v1/cards/{id} partial-merge fix** — pre-fix, partial PATCH silently zeroed name/title/company. Verified end-to-end on `a248af9`: PATCH `{"photoUrl":"X"}` preserves name/title/company while updating photoUrl. | PR [#11](https://github.com/dynolabs-io/vcard/pull/11) merged (`a248af9`); openova-private `ddfc23db` bumps vcard-api; ghcr-pull Secret in ns `dynolabs` refreshed (was 403 against ghcr.io/token); slug `jxbkk74x` walk evidence |
| 2026-05-23 | **PR #5 merged to `main`** — canonical docs/ tree (4/4 binary success criteria PASS) lands on main | commit `8af6976` |
| 2026-05-23 | Walk #9 (TBD-V04/#8): **Account-tab CTAs** walked via Maestro CI — "Sign in with Apple" + "Continue with LinkedIn" render on iOS 26.2 Simulator | `walk-maestro-10-account-signin-2026-05-23.png`; run [`26327123137`](https://github.com/dynolabs-io/vcard/actions/runs/26327123137); 3-flow suite green in 45.0s |
| 2026-05-23 | Walks #4+#5 (TBD-V02/#6): **iOS Maestro CI PNGs** — `01-launch-empty-state` + `02-create-card-saved` PNGs land in artifact bundle | `walk-maestro-01-launch-2026-05-23.png`, `walk-maestro-02-create-card-2026-05-23.png`; CI plumbing fix in `c354ae6` |
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
