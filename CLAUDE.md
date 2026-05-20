# dynolabs-io/vcard — Repo-specific Notes

> This is a product repo (Dynolabs vCard mobile app). Generic OpenOva platform working principles live in `~/.claude/CLAUDE.md` (user-global).

## What this is

Mobile vCard app — offline-first contact cards with QR rendering, QR scanning, and Apple Wallet / Google Wallet integration. Built with Expo SDK 54 + React Native 0.81 + expo-router (file-based, typed routes). Backend lives at `api.dynolabs.io` (see the sibling `dynolabs-io/api` repo). Aesthetic standard: Apple Contacts (SymbolView from expo-symbols only, no emoji icons, destructive actions only inside Edit forms — never on list rows).

## What lives in this repo

| Concern | Path |
|---|---|
| Expo Router screens | `app/` (`(tabs)/index.tsx` = cards, `(tabs)/scan.tsx` = QR scan, `(tabs)/me.tsx` = settings, `card/[id].tsx` = card detail, `card/new.tsx` = new card) |
| Centralised URLs (DO NOT hardcode) | `lib/config.ts` |
| MMKV-backed offline storage | `lib/storage.ts` |
| vCard 3.0 serializer | `lib/vcard.ts` |
| Typed API client | `lib/api.ts` |
| Shared types | `lib/types.ts` |
| Shared UI components | `components/` |
| Maestro E2E flows | `.maestro/` |
| EAS build config | `eas.json`, `app.json` |

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
npm i -g eas-cli
eas login
eas build --platform ios       # → TestFlight
eas build --platform android   # → Play internal track
```

## Tracking

Umbrella issue: [`dynolabs-io/vcard#1`](https://github.com/dynolabs-io/vcard/issues/1).

## Known issues

- Operator actions still required (block Phase 6/7): Apple Pass Type ID `.p12`, LinkedIn OAuth app credentials, Google Wallet issuer + service-account JSON.
- iOS 26 + new-arch-off + GestureHandlerRootView + Stack modals silently dismisses modals — use pure RN `Animated.View` + `PanResponder` for swipe (per `~/.claude/projects/-home-openova-repos-openova-private/memory/feedback_rn_swipe_no_gesture_handler_with_modals.md`).
- Wallet strip MUST always pack BOTH photo + logo + brand color on full 1125×432 canvas — never gate on style picker (per `~/.claude/projects/-home-openova-repos-openova-private/memory/feedback_dynolabs_wallet_always_pack_both.md`).

## Sub-agent cap for this project

Default (per user-global) unless project owner overrides here.
