# Principles

> 📐 PERMANENT canon. Engineering rules and anti-pattern catalog specific to this repo. Generic OpenOva platform principles (D1–D12 diversion table, anti-theater discipline, sub-agent dispatch rules) live in user-global `~/.claude/CLAUDE.md` — this doc is dynolabs-io/vcard specifics with PR/commit receipts.

## Aesthetic standard — Apple Contacts, not Material/Tailwind

UI must read like Apple Contacts:

- **Icons**: `SymbolView` from `expo-symbols` only. No emoji icons in chrome.
- **Destructive actions**: only inside Edit forms — never on list rows.
- **Color**: surface neutrals; the only brand color is in the wallet strip + accent dots.
- **Layout**: spacious, single-column lists, large tap targets.

## Mobile gotchas with PR receipts

### iOS 26 + new-arch-off + Stack modals — never wrap root in `GestureHandlerRootView`

> Source: previously `~/.claude/projects/-home-openova-repos-openova-private/memory/feedback_rn_swipe_no_gesture_handler_with_modals.md` (merged here on 2026-05-21).

In Expo SDK 54 + RN 0.81 with new arch **disabled**, wrapping the root in `<GestureHandlerRootView>` silently breaks `presentation: 'modal'`. Modals open then auto-dismiss with no error.

**Why**: Build 101 added `GestureHandlerRootView` around the Stack in `app/_layout.tsx` for `Swipeable` rows on the cards list. Maestro caught `02-create-card` regressing — modal title never appeared, view hierarchy reverted to `/cards`. The modal was being presented in a UIWindow outside `GestureHandlerRootView`'s portal and auto-dismissed. New arch is disabled here per real-device telemetry that expo-image-picker / expo-file-system / expo-sharing crash under new arch on iOS 26.3.

**How to apply**:
- Horizontal swipe-to-reveal: use the `SwipeRow` component pattern in `app/(tabs)/index.tsx` — `Animated.View` + `PanResponder` with `transform: [{ translateX }]`. Pure RN, no extra deps, ~80 lines.
- Claim only horizontal gestures: `onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy)` — preserves vertical FlatList scroll.
- Single `openId` state in the parent for mutual-exclusion (opening one row auto-closes others).
- Snap thresholds: drag ≥ 60px to open, ≥ 60px back to close. Spring with `bounciness: 0` so it feels native.
- If new arch ever flips on, re-evaluate `react-native-gesture-handler` Swipeable.

## Wallet pass / composite renderers — always pack ALL assets

> Source: previously `~/.claude/projects/-home-openova-repos-openova-private/memory/feedback_dynolabs_wallet_always_pack_both.md` (merged here on 2026-05-21).

When a card has a face photo AND a brand logo, the Apple Wallet pass strip MUST show BOTH on the brand color. No Photo-OR-Logo picker.

**Why**: 2026-05-15 founder feedback while testing Build 98: *"stop using the stupid photo striping option it is ridiculous, you must use both the company logo and the photo at the same time and use the empty space very effectively!"* — A Photo/Logo wallet-style picker shipped (`photoStrip | logoStrip`) leaving ~85% of the canvas empty.

**How to apply**:
- For ANY composite renderer (Wallet strip, web profile hero, "share as image", invoice header): enumerate ALL available assets and compose a SINGLE layout that places each in a defined region. Never gate on a user-chosen "style" enum.
- Adapt to what's present, never force a choice:
  - photo + logo → split (photo circle left, logo right, brand color background)
  - photo only → photo cover-cropped full canvas
  - logo only → logo centered on brand color
  - neither → solid brand color with text overlay
- Empty space is the enemy. If a region is blank because an asset is missing, REFLOW so the present asset uses more space.
- Canonical implementation: `api/services/pass-signer/main.go renderHeroStrip` — 1125×432 canvas always packs photo + logo + brand color.

**Related gotcha (same incident)**: `photo-cdn` `validSlug` rejected hyphens — every `<slug>-brand` upload silently 400'd, mobile catch-block kept the local `file://` URI in `brand_logo_url`. Symptom looked like "logo never appears on Wallet pass" but was an API-contract bug masked by a swallowed exception. **Rule**: when a feature SHOULD work and doesn't, grep catch-blocks before redesigning the feature.

## Enrichment — iogrid is the only provider; Apollo banned

Commit `9eaf9a2` (2026-05-21) deleted the Apollo path entirely. Free tier returned empty payloads; paid tier is expensive. **Don't reintroduce Apollo without a new ADR.**

Replacement: `POST /v1/enrich/linkedin {"vanity":"<slug>"}` tunnels a GET through iogrid's residential SOCKS5+TLS proxy to `https://www.linkedin.com/in/<slug>` and parses `og:title` + `og:image` from the public profile SSR markup. See `api/services/vcard-api/enrich/linkedin.go` + [`adr/0002-drop-apollo-iogrid-only.md`](adr/0002-drop-apollo-iogrid-only.md).

## LinkedIn vanity capture — URL prompt, NOT OIDC claim

Commits `a92b3de` + `9eaf9a2`. LinkedIn's `openid profile email` scope **empirically does not return** the vanity slug — `vanityName` and `profile` URL claims are gated behind `r_basicprofile` (restricted). Verified 2026-05-21 12:38 in `linkedin-oauth` pod logs: `rawKeys = [sub, email_verified, name, locale, given_name, family_name, email, picture]`.

**Therefore**: do not try to derive vanity from OIDC. Prompt the user once for their LinkedIn URL after OAuth, extract the slug client-side via `extractLinkedInVanity` in `lib/linkedin.ts`. See [`adr/0003-linkedin-vanity-via-url-prompt.md`](adr/0003-linkedin-vanity-via-url-prompt.md).

## iogrid proxy wire format

> Source: previously `~/.claude/projects/-home-openova-repos-vcard/memory/project_iogrid_proxy_phase0_wiring.md` (merged here on 2026-05-21).

Four corrections to remember before editing any iogrid integration:

1. **Key prefix is `iog_`** (NOT `ig_live_*`). Source: `iogrid/coordinator/services/billing-svc/internal/server/api_keys.go:45` `const keyPrefix = "iog_"`. The `ig_live_xxxx` references in `iogrid/examples/phase0-vcard-customer/README.md:48` + `client.go:9` are stale documentation drift.

2. **Key hash is SHA-256 hex, NOT bcrypt.** Source: `api_keys.go:65` `hashKey() = hex.EncodeToString(sha256.Sum256(...))`. ValidateApiKey does `LookupApiKeyByHash(ctx, hashKey(plaintext))` — a bcrypt-hashed key would never authenticate.

3. **`workspaces` table has no `slug` or `display_name`.** Real cols (`iogrid/coordinator/services/identity-svc/internal/db/migrations/0003_workspaces.sql`): `id, owner_user_id, name, plan ('FREE'), billing_customer_id_stripe, created_at, updated_at, deleted_at`. Phase 0 stub: `gateway-bff` holds handle→UUID in-process — no real `workspaces` row is created at signup. The doc's `11111111-2222-3333-4444-555555555555` is a placeholder UUID; vcard-prod uses this same value.

4. **Go client wire format: outer TLS REQUIRED before SOCKS5.** `golang.org/x/net/proxy` won't work — it dials raw TCP. Traefik fronts `proxy.iogrid.org:443` with `IngressRouteTCP HostSNI(proxy.iogrid.org)`. Client must `tls.Dial` first, then speak RFC 1928 SOCKS5 + RFC 1929 USERPASS on the `*tls.Conn`. Canonical pattern: `iogrid/examples/phase0-vcard-customer/client.go:184` `dialThroughTLSSOCKS5`. Pre-fix history: iogrid issue #265.

**Other iogrid facts for this integration**:
- pg cluster `iogrid-pg-1` in ns `iogrid` on default kubeconfig (`45.151.123.50:6443` = iogrid mothership). DBs: identity, providers, workloads, antiabuse, **billing**, telemetry.
- `api_key` table lives in `billing`. `workspaces` lives in `identity`.
- vcard-prod canonical `workspace_id`: `11111111-2222-3333-4444-555555555555`.
- vcard-prod `api_key.id` (first mint, 2026-05-21): `efd20c9d-232f-43ab-96c0-b424e96f5478` — last-four `0506`, label `vcard-prod-linkedin-enrich`, tier PAYG, allowed_categories `social-intel`, geo_target `US`. Plaintext is one-time; stored only in founder's password manager. Revoke via `UPDATE api_key SET revoked_at=now() WHERE id='efd20c9d-...'` in the iogrid billing DB.

## Build / release discipline

**All builds run in GitHub Actions** — never `eas build` locally. See [`RUNBOOKS.md`](RUNBOOKS.md). The corollary: a tag on `:latest` proves nothing; reproducibility is the SHA-pinned manifest in `openova-private`.

Don't commit Go build binaries — `.gitignore` excludes `/api/services/*/<svcname>` for each of the 5 services (commit `85d932b` after one accidental 9.5 MB import).

## Graceful-skip needs a loud smoke probe

> Source: `api/services/vcard-api/cmd/smoke-proxy/main.go` doc-comment (PR #3, merged 2026-05-22 as `a38edd6`). Promoted to a principle on 2026-05-23.

Best-effort endpoints return 200-with-empty-fields on transport failure — that's the right UX contract (mobile callers don't have to branch on errors). The trap: it ALSO hides a misconfigured proxy / rotated key / gateway outage in production. The user-visible symptom of "API key rotated and we forgot" is identical to "everything is working but LinkedIn rate-limited us".

**Rule**: every graceful-skip surface needs a paired operator probe that fails LOUDLY on the same transport path. For the iogrid LinkedIn-vanity client, that's `make smoke-proxy` (see [`RUNBOOKS.md`](RUNBOOKS.md) "Verify the iogrid proxy is actually in the egress path"). For any future graceful-skip surface you ship, ship the smoke probe in the same PR.

## Don't mix concerns in `openova-private` PRs

The Flux source-of-truth repo (`openova-io/openova-private`) gets one kind of change at a time per PR:

- image SHA bumps, OR
- env-var changes, OR
- chart upgrades.

Mixing them is how rollouts go sideways. Today's auto-bump gap (CI in vcard tries to invoke a non-existent `dynolabs-bump-sha.yml` workflow) is tracked in [`STATUS.md`](STATUS.md).
