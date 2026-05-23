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
| [#2](https://github.com/dynolabs-io/vcard/issues/2) | chore(repo): fold `dynolabs-io/api` into this repo as `./api/` | ✅ Delivered 2026-05-21 (`29b944d` + `e5a6fd5`); awaiting founder close |
| [#4](https://github.com/dynolabs-io/vcard/issues/4) | TBD-V01: scaffold canonical docs/ tree (user-global §11 shape) | ✅ PR [#5](https://github.com/dynolabs-io/vcard/pull/5) merged (`8af6976`); awaiting founder close |
| [#6](https://github.com/dynolabs-io/vcard/issues/6) | TBD-V02: walk iOS Maestro CI with PNG screenshots | ✅ 4 Maestro flows green (`01-launch`, `02-create-card`, `10-account-signin-ctas`, `11-inbox-signed-out`); PNGs land every push; awaiting founder close |
| [#7](https://github.com/dynolabs-io/vcard/issues/7) | TBD-V03: walk Wallet-barcode → /v/&lt;slug&gt; → vCard chain | ✅ Walked 2026-05-23 (comment 4524565522); awaiting founder close |
| [#8](https://github.com/dynolabs-io/vcard/issues/8) | TBD-V04: walk Account-tab sign-in CTAs via Maestro | ✅ Walked 2026-05-23 (Maestro flow `10-account-signin-ctas` green); awaiting founder close |
| [#9](https://github.com/dynolabs-io/vcard/issues/9) | TBD-V05: scan_events emission not wired | ✅ Wired via PR [#12](https://github.com/dynolabs-io/vcard/pull/12), walk #11 evidence; awaiting founder close |
| [#10](https://github.com/dynolabs-io/vcard/issues/10) | TBD-V06: PATCH silently zeroes fields not in request body | ✅ Fixed via PR [#11](https://github.com/dynolabs-io/vcard/pull/11), walk #10 evidence; awaiting founder close |
| [#13](https://github.com/dynolabs-io/vcard/issues/13) | TBD-V07: emit kind='pkpass' scan_events from pass-signer | ✅ Wired via PR [#14](https://github.com/dynolabs-io/vcard/pull/14), walk #12 evidence; awaiting founder close |
| [#15](https://github.com/dynolabs-io/vcard/issues/15) | TBD-V08: Inbox-reach SQL endpoint + mobile UI | ✅ Endpoint shipped via PR [#16](https://github.com/dynolabs-io/vcard/pull/16), walk #13 evidence; awaiting founder close |
| [#17](https://github.com/dynolabs-io/vcard/issues/17) | TBD-V09: mobile Inbox UI consumes /v1/inbox/reach | ✅ TestFlight builds CFBundleVersion `29` + `183` live in Founders group (iOS runs `26332124528` + `26333146597` both green); awaiting founder install + walk |
| [#21](https://github.com/dynolabs-io/vcard/issues/21) | TBD-V12: PATCH null-clear for explicit field zeroing | ✅ Fixed via PR [#22](https://github.com/dynolabs-io/vcard/pull/22), walk #15 evidence; awaiting founder close |
| [#23](https://github.com/dynolabs-io/vcard/issues/23) | TBD-V13: anonymous /v1/cards?device_id leaks claimed cards (privacy) | ✅ Fixed via PR [#24](https://github.com/dynolabs-io/vcard/pull/24) merged (`30bcec5`); walks #19 + #21 (post-rollout) verified live; awaiting founder close |

**Closed 2026-05-23** (tracker hygiene per user instruction "close outdated/rubbish/redundant"):

| # | Title | Reason |
|---|---|---|
| [#19](https://github.com/dynolabs-io/vcard/issues/19) | TBD-V10: durable ghcr-pull rotation | Root cause unverified — pulled current state during walk #21's Flux roll, PAT matches bastion's, image pulls work. Re-open only with concrete `ImagePullBackOff` evidence |
| [#20](https://github.com/dynolabs-io/vcard/issues/20) | TBD-V11: scan_events geoip resolution | Superseded by #26 (later also closed) — kept the analysis in the issue comment |
| [#26](https://github.com/dynolabs-io/vcard/issues/26) | TBD-V14: web-profile + pass-signer extract client IP | Filed mid-session as cap-discipline drift; geoip dimension on scan_events isn't blocking V09 mobile walk. Re-open when location dimension is actually prioritized |

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
| Reveal-mode → Inbox | ✓ | ✓ | 🟢 walked 2026-05-23 (server-side end-to-end: scan + connections + block + unblock) | ✓ |

Per [`DOD.md`](../DOD.md), `Code ✓ + Deploy ✓` is necessary but not sufficient — every `✗ Walked` blocks `✗ Done`.

## Recently delivered

| Date | Delivery | Receipt |
|---|---|---|
| 2026-05-23 | **iOS CI run [26333146597](https://github.com/dynolabs-io/vcard/actions/runs/26333146597) SUCCESS** — Maestro flow `11-inbox-signed-out.yaml` validated (PNG 127 KB generated, all 4 asserts pass: "Your cards", "Inbox", "Sign in to see your inbox", "Sign in" CTA). TestFlight CFBundleVersion `183` uploaded + assigned to Founders. New CI gate is now permanent. | iOS run 26333146597 conclusion: `success` |
| 2026-05-23 | PR [#25](https://github.com/dynolabs-io/vcard/pull/25) merged (`bcd414b9`): **Maestro flow `11-inbox-signed-out.yaml`** — extends iOS CI coverage to V09 Inbox tab signed-out state (4 visible-asserts + screenshot). | TBD-V10 diagnostic comment posted on issue #19; CI gate added |
| 2026-05-23 | **TestFlight build #29 live** — iOS run [26332124528](https://github.com/dynolabs-io/vcard/actions/runs/26332124528) success in 38m27s, archived with fresh Apple Distribution cert (fastlane cert pre-revoke worked on retry), uploaded + assigned to Founders beta group. V09 mobile Inbox UI now installable. | [issue #17 comment](https://github.com/dynolabs-io/vcard/issues/17) |
| 2026-05-23 | Walk #21 (TBD-V13/#23 post-fix verification): **anonymous list-after-claim returns count=0** on the rolled-out vcard-api 30bcec5 pod. Diana creates anon card → claims → anonymous list with same device_id returns `[]` (was 1 leaked card pre-fix). Signed-in union list returns the single claimed card (no double-count). | openova-private bump `544b1651`; vcard-api pod `c8bff6758-xttvs` |
| 2026-05-23 | Walk #20: **`/v1/leads` auth boundary**. Anonymous → 401, Emrah → 200 (count=0 because her current cards have no leads; existing lead on uk4kcdpm is on an unclaimed card), Bob (no cards) → 200 + `[]`. Confirms only signed-in card owners can read leads — unclaimed-card leads sit pending until claim. | TRUST coverage implicit in `/v1/leads` row |
| 2026-05-23 | Walk #19 + Fix (TBD-V13/#23): **Anonymous `/v1/cards?device_id` leaked claimed cards.** Surfaced via /v1/cards/claim end-to-end walk: anon card created → Carla claims it → anonymous list with same device_id STILL returned the claimed card (privacy leak — device_id could be logged by intermediate proxies). PR [#24](https://github.com/dynolabs-io/vcard/pull/24) merged `30bcec5`: removed `ListByDevice`, added `ListByDeviceUnclaimed` (filters `user_id IS NULL` in SQL), both anonymous-list path AND signed-in union path now use it. | api-build run [26332741780](https://github.com/dynolabs-io/vcard/actions/runs/26332741780) green; openova-private `544b1651` rolled vcard-api pod `c8bff6758-xttvs` |
| 2026-05-23 | Walk #18: **`/v1/inbox/reach` owner-scope privacy + edge cases**. 6/6 cases pass: owner→200 with real totals `{profile:12,vcf:21,pkpass:10}`; non-owner→403 `"card not owned by caller"`; anonymous→401 `"auth required"`; nonexistent slug→404; missing slug param→400; `days=999`→200 (clamped). The owner-scope boundary is the privacy critical-path — leak would let any signed-in user enumerate any public slug's reach. | TRUST row implicit in `/v1/inbox/reach` coverage; evidence in [issue #15 comment](https://github.com/dynolabs-io/vcard/issues/15) |
| 2026-05-23 | Walk #17: **Reveal-mode → Inbox > Connections** end-to-end server-side. Synthetic scanner user "Bob" + HS256 JWT minted from `vcard-hmac`. Bob POST `/v1/scans` with `reveal=true` → Emrah GET `/v1/scans/connections` returns Bob's name+email+placeName+eventName. Block hides Bob; unblock restores. Cleaned up after walk. | TRUST.md row flipped 🔴 → 🟢 |
| 2026-05-23 | Walk #16 (TBD-V09/#17): **V09 Maestro PNGs land on `main`** — iOS run `26331837222` Maestro JUnit `00-all SUCCESS` in 68.0s (3 flows: 01-launch, 02-create-card, 10-account-signin-ctas) proves V09 mobile Inbox UI doesn't regress existing surfaces. Archive step failed on recurring Apple Distribution cert revoke (serial `158DD6F73B…`); re-fired workflow run `26332124528` for fresh cert via fastlane. | commit `30fd870`; 3 PNGs at repo root: `walk-maestro-v09-{launch,create,account}-2026-05-23.png` |
| 2026-05-23 | Walk #15 (TBD-V12/#21): **PATCH null-clear** — `{"title": null}` now correctly clears the field (previously returned 400 "not a string"). Verified on card `f119b45c-…`: PATCH null → title=NULL, name+company preserved. | PR [#22](https://github.com/dynolabs-io/vcard/pull/22) merged (`2036126`); openova-private `6ed2d7be` bumps vcard-api |
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
