# dynolabs-io/vcard

Mobile vCard app — offline-first contact cards with QR + Apple/Google Wallet. Built by Dynolabs.

## Stack

- **Expo SDK 54** + React Native 0.81
- **TypeScript**, expo-router (file-based, typed routes)
- **react-native-mmkv** for offline storage
- **react-native-qrcode-svg** for QR rendering
- **expo-camera** for QR scanning
- iOS bundle: `io.dynolabs.vcard` · Android package: `io.dynolabs.vcard`
- Apple Developer Team: `77GHJHUGD4`
- Apple ID for ASC: `hatyil@gmail.com`

## Backend

Talks to **`api.dynolabs.io`** (5 Go microservices, see [`dynolabs-io/api`](https://github.com/dynolabs-io/api)).

| Endpoint | Purpose |
|---|---|
| `GET  /healthz`                          | vcard-api liveness |
| `POST /pass/apple`                       | request signed `.pkpass` |
| `POST /pass/google`                      | request Google Wallet JWT |
| `GET  /oauth/linkedin/authorize`         | begin LinkedIn connect |
| `GET  https://cdn.dynolabs.io/p/<slug>`  | profile photo |
| `GET  https://dynolabs.io/c/<slug>`      | public web profile |

## Local development

```bash
npm install
npx expo start                 # opens dev tools
# or run a specific platform:
npm run ios       # macOS only
npm run android
npm run web
```

Edit screens under `app/`. Routes are file-based via expo-router.

## Building

EAS Build:

```bash
npm i -g eas-cli
eas login
eas build --platform ios       # → TestFlight
eas build --platform android   # → Play internal track
```

## Layout

```
app/
  _layout.tsx              root stack
  (tabs)/
    _layout.tsx            tab bar (Cards / Scan / Me)
    index.tsx              card list
    scan.tsx               camera QR scanner
    me.tsx                 settings + connected accounts
  card/
    [id].tsx               card detail + QR
    new.tsx                new-card form
lib/
  config.ts                centralized URLs (DO NOT hardcode in components)
  storage.ts               MMKV-backed local cards
  vcard.ts                 vCard 3.0 serializer
  api.ts                   typed client for api.dynolabs.io
  types.ts                 Card / Social / template types
```

## Tracking

Umbrella issue: [#1](https://github.com/dynolabs-io/vcard/issues/1).

## Operator actions still required (block Phase 6/7)

- Apple Pass Type ID certificate (`.p12`) — create at developer.apple.com → Identifiers → Pass Type IDs. Mount as K8s secret.
- LinkedIn OAuth app — create at developer.linkedin.com. Set redirect URI to `https://api.dynolabs.io/oauth/linkedin/callback`. Stash client id + secret as K8s secret.
- Google Wallet API issuer — request access at https://console.cloud.google.com/google/wallet. Set issuer ID + service account JSON.
