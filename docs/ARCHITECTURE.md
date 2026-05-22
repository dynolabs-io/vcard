# Architecture

> 📐 PERMANENT canon. How dynolabs-io/vcard is shaped end-to-end: mobile app, backend microservices, deploy path, data stores. Generic OpenOva platform principles live in user-global; this doc is repo-specific.

## Shape at 10,000 ft

```
TestFlight (iOS) ──► Expo Router app  ──HTTPS──►  api.dynolabs.io
                     (offline-first)              │
                                                  ├── vcard-api      (cards CRUD + slug + enrichment proxy)
                                                  ├── pass-signer    (Apple .pkpass + Google Wallet JWT)
                                                  ├── photo-cdn      (S3/MinIO backed avatar storage)
                                                  ├── linkedin-oauth (server-side OIDC + /v2/userinfo)
                                                  └── web-profile    (SSR public profile pages)
                                                  │
                                              CNPG Postgres (vcard-postgres) + MinIO
                                                  │
                                              Flux reconciles from openova-private
                                              (clusters/contabo-mkt/apps/dynolabs/)
```

Polyglot monorepo: the Expo/RN mobile app at the repo root, the Go backend microservices under `api/`. Subtree-merged 2026-05-21 from the now-archived `dynolabs-io/api` repo (commit `29b944d`; rationale in [`adr/0001-subtree-merge-api.md`](adr/0001-subtree-merge-api.md)).

## Mobile (Expo / React Native)

| Concern | Path |
|---|---|
| Expo Router screens | `app/` |
| Tab bar (Cards / Scan / Me) | `app/(tabs)/_layout.tsx` |
| Card list | `app/(tabs)/index.tsx` |
| QR scanner (`expo-camera`) | `app/(tabs)/scan.tsx` |
| Settings + connected accounts | `app/(tabs)/me.tsx` |
| Card detail + QR | `app/card/[id].tsx` |
| New-card form | `app/card/new.tsx` |
| Centralised URLs (DO NOT hardcode) | `lib/config.ts` |
| MMKV-backed offline storage | `lib/storage.ts` |
| vCard 3.0 serializer | `lib/vcard.ts` |
| Typed API client | `lib/api.ts` |
| Card / Social / template types | `lib/types.ts` |
| Shared UI components | `components/` |
| Maestro E2E flows | `.maestro/` |
| EAS build config | `eas.json`, `app.json` |

Stack: Expo SDK 54 + React Native 0.81 + TypeScript + expo-router (file-based, typed routes) + `react-native-mmkv` (offline) + `react-native-qrcode-svg` (QR render) + `expo-camera` (QR scan). Bundle ID `io.dynolabs.vcard` on iOS + Android. Apple Developer Team `77GHJHUGD4`, ASC Apple ID `hatyil@gmail.com`.

## Backend (Go microservices)

All under `api/services/`, aggregated via `api/go.work`, built as distroless static binaries.

| Service | Role | Notable endpoints |
|---|---|---|
| `vcard-api` | Cards CRUD + slug resolution + auth + LinkedIn-via-iogrid enrichment | `POST /v1/auth/apple`, `POST /v1/auth/linkedin`, `GET /v1/users/me`, `POST /v1/cards`, `POST /v1/enrich/linkedin`, `POST /v1/cards/claim`, `GET /healthz`, `GET /readyz` |
| `pass-signer` | Apple `.pkpass` + Google Wallet JWT signing | `POST /pass/apple`, `POST /pass/google` (`Content-Type: application/vnd.apple.pkpass`) |
| `photo-cdn` | S3/MinIO backed avatar storage + serving | upload + `GET https://cdn.dynolabs.io/p/<slug>` |
| `linkedin-oauth` | Server-side OAuth code-exchange + /v2/userinfo fetch | `GET /oauth/linkedin/authorize`, `GET /oauth/linkedin/callback`, `GET /oauth/linkedin/result` |
| `web-profile` | SSR public profile pages | `GET https://dynolabs.io/c/<slug>` |
| (shared) | Shared Go code | `api/shared/` |

Data plane: **CNPG Postgres** `vcard-postgres-rw` (DATABASE_URL via `vcard-postgres-app` secret); migrations are idempotent `IF NOT EXISTS` statements in `api/services/vcard-api/cards/migrations.go`. **MinIO** for avatar object storage (bucket `vcard-photos` per `api/services/photo-cdn/main.go:38`).

## Deploy

CI publishes images to `ghcr.io/dynolabs-io/vcard/api/<svc>:<short-sha>` + `:latest` via `.github/workflows/api-build.yml` (paths-filtered to `api/**`). Flux reconciles from `openova-io/openova-private` at `clusters/contabo-mkt/apps/dynolabs/<svc>.yaml`. Image SHA bumps in those manifests are **manual today** — see [`RUNBOOKS.md`](RUNBOOKS.md) `### Bump backend image SHA` and the auto-bump workflow gap in [`STATUS.md`](STATUS.md).

iOS builds: GitHub Actions workflow `.github/workflows/ios.yml` → auto-signing via App Store Connect API key (fastlane cert + sigh) → Maestro E2E gate on iOS Simulator → archive → TestFlight upload → optionally `asc-assign-build.yml` (`workflow_dispatch`) assigns to the Founders group.

## External integrations

| Integration | Purpose | Wire format / notes |
|---|---|---|
| Apple Sign In | Mobile auth (primary) | iOS-native SIWA → server-side JWS verification against Apple's JWKS, then HS256 session token |
| LinkedIn OAuth (OIDC) | Mobile auth (secondary) | Server-side code-exchange via `linkedin-oauth`; `openid profile email` scope returns `sub/email/name/picture/given_name/family_name` only — see [`adr/0003-linkedin-vanity-via-url-prompt.md`](adr/0003-linkedin-vanity-via-url-prompt.md) |
| iogrid residential proxy | LinkedIn vanity enrichment for `POST /v1/enrich/linkedin` | SOCKS5 inside TLS to `proxy.iogrid.org:443` — `tls.Dial` first (Traefik `HostSNI`), THEN RFC 1928/1929. See `api/services/vcard-api/enrich/linkedin.go` + [`PRINCIPLES.md`](PRINCIPLES.md) §iogrid |
| Apple Wallet (pass-signer) | `.pkpass` strip pack | Composes **all** assets (photo + brand logo + brand color) on full 1125×432 canvas — no Photo-OR-Logo picker. See [`PRINCIPLES.md`](PRINCIPLES.md) §wallet-strip |
| Google Wallet (pass-signer) | JWT-signed pass link | Issuer + service-account JSON not yet provisioned (see [`STATUS.md`](STATUS.md) operator-actions) |
