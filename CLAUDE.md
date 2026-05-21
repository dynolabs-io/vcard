# dynolabs-io/vcard — Repo-specific Notes

> This is a product repo (Dynolabs vCard mobile app). Generic OpenOva platform working principles live in `~/.claude/CLAUDE.md` (user-global).

## What this is

Polyglot monorepo — the Expo/RN mobile app at the root + the Go backend microservices under `api/`. Mobile app: offline-first contact cards with QR rendering, QR scanning, and Apple Wallet / Google Wallet integration, built with Expo SDK 54 + React Native 0.81 + expo-router. Backend reachable at `api.dynolabs.io`; images at `ghcr.io/dynolabs-io/vcard/api/<svc>:<sha>`, deployed via Flux from `openova-private/clusters/contabo-mkt/apps/dynolabs/`. Aesthetic standard: Apple Contacts (SymbolView from expo-symbols only, no emoji icons, destructive actions only inside Edit forms — never on list rows).

> **History:** `api/` was its own repo (`dynolabs-io/api`, archived 2026-05-21) until subtree-merged here. See vcard commit `29b944d` for the merge + `dynolabs-io/vcard#2` for the rationale.

## What lives in this repo

| Concern | Path |
|---|---|
| **Mobile app (Expo/RN/TS)** | |
| Expo Router screens | `app/` (`(tabs)/index.tsx` = cards, `(tabs)/scan.tsx` = QR scan, `(tabs)/me.tsx` = settings, `card/[id].tsx` = card detail, `card/new.tsx` = new card) |
| Centralised URLs (DO NOT hardcode) | `lib/config.ts` |
| MMKV-backed offline storage | `lib/storage.ts` |
| vCard 3.0 serializer | `lib/vcard.ts` |
| Typed API client | `lib/api.ts` |
| Shared types | `lib/types.ts` |
| Shared UI components | `components/` |
| Maestro E2E flows | `.maestro/` |
| EAS build config | `eas.json`, `app.json` |
| **Backend (Go microservices)** | |
| Cards CRUD + slug + LinkedIn-via-iogrid enrichment | `api/services/vcard-api/` |
| Apple `.pkpass` + Google Wallet JWT signing | `api/services/pass-signer/` |
| S3-backed avatar storage + serving | `api/services/photo-cdn/` |
| LinkedIn OAuth callback + profile fetch | `api/services/linkedin-oauth/` |
| SSR public profile pages | `api/services/web-profile/` |
| Shared Go code | `api/shared/` |
| Go workspace pin | `api/go.work` |
| Per-service CI matrix build | `.github/workflows/api-build.yml` (paths-filtered to `api/**`) |

## Tech stack

- Expo SDK 54 + React Native 0.81
- TypeScript, expo-router (file-based, typed routes)
- `react-native-mmkv` (offline storage)
- `react-native-qrcode-svg` (QR rendering)
- `expo-camera` (QR scanning)
- iOS bundle ID: `io.dynolabs.vcard` · Android package: `io.dynolabs.vcard`
- Apple Developer Team: `77GHJHUGD4` · ASC Apple ID: `hatyil@gmail.com`

## Development workflow

```bash
npm install
npx expo start          # dev tools
npm run ios             # macOS only
npm run android
npm run web
npm run typecheck
npm run lint
```

## Build / release

```bash
# Mobile app (TestFlight / Play internal)
npm i -g eas-cli
eas login
eas build --platform ios
eas build --platform android

# Backend (CI auto-builds on push to main when api/** changes)
cd api && go build ./...        # local sanity
cd api && go test ./...         # workspace tests
# CI publishes ghcr.io/dynolabs-io/vcard/api/<svc>:<short-sha>
# Bump image SHA in openova-private/clusters/contabo-mkt/apps/dynolabs/<svc>.yaml
# (auto-bump workflow not yet filed — manual until then)
```

## Tracking

Umbrella issue: [`dynolabs-io/vcard#1`](https://github.com/dynolabs-io/vcard/issues/1).

## Known issues

- Operator actions still required (block Phase 6/7): Apple Pass Type ID `.p12`, LinkedIn OAuth app credentials, Google Wallet issuer + service-account JSON.
- iOS 26 + new-arch-off + GestureHandlerRootView + Stack modals silently dismisses modals — use pure RN `Animated.View` + `PanResponder` for swipe (per `~/.claude/projects/-home-openova-repos-openova-private/memory/feedback_rn_swipe_no_gesture_handler_with_modals.md`).
- Wallet strip MUST always pack BOTH photo + logo + brand color on full 1125×432 canvas — never gate on style picker (per `~/.claude/projects/-home-openova-repos-openova-private/memory/feedback_dynolabs_wallet_always_pack_both.md`).

## Sub-agent cap for this project

Default (per user-global) unless project owner overrides here.
