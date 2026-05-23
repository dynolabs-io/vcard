# dynolabs-io/vcard

Polyglot monorepo — the Expo / React Native mobile app at the root, the Go backend microservices under `api/`. Offline-first contact cards with QR + Apple Wallet + Google Wallet, signed-in via Apple or LinkedIn, with LinkedIn-vanity firmographic enrichment routed through the iogrid residential proxy mesh.

## Stack at a glance

- **Mobile**: Expo SDK 54, React Native 0.81, TypeScript, expo-router, react-native-mmkv, react-native-qrcode-svg, expo-camera. Bundle ID `io.dynolabs.vcard`.
- **Backend**: 5 Go microservices in `api/services/` aggregated via `api/go.work` — `vcard-api`, `pass-signer`, `photo-cdn`, `linkedin-oauth`, `web-profile`. Distroless static binaries published as `ghcr.io/dynolabs-io/vcard/api/<svc>:<short-sha>`.
- **Deploy**: Flux from `openova-io/openova-private` at `clusters/contabo-mkt/apps/dynolabs/`. iOS via GitHub Actions → TestFlight → Founders group.

## Documentation

### 📐 Canon (read in this order)
- [GLOSSARY](docs/GLOSSARY.md) — canonical terms + banned terms
- [STATUS](docs/STATUS.md) — what's built today vs design
- [ARCHITECTURE](docs/ARCHITECTURE.md) — how it works, end-to-end
- [PRINCIPLES](docs/PRINCIPLES.md) — engineering rules + anti-pattern catalog (with commit refs)
- [DOD](docs/DOD.md) — definition of done (TestFlight walk + screenshot)

### 🔧 Build + operate
- [RUNBOOKS](docs/RUNBOOKS.md) — dev, GitHub Actions builds, manual Flux SHA bump, mint iogrid key, install iogridd
- [SECURITY](docs/SECURITY.md) — identity, secrets, threat surface

### 🏛️ Decision records ([adr/](docs/adr/))
- [0001](docs/adr/0001-subtree-merge-api.md) — Subtree-merge `dynolabs-io/api` into `dynolabs-io/vcard/api/`
- [0002](docs/adr/0002-drop-apollo-iogrid-only.md) — Drop Apollo, route LinkedIn enrichment exclusively via iogrid
- [0003](docs/adr/0003-linkedin-vanity-via-url-prompt.md) — Capture LinkedIn vanity via user-pasted URL, not OIDC claim
- [ADR index](docs/adr/README.md)

### 🟢 Live state ([ledger/](docs/ledger/))
- [TRUST](docs/ledger/TRUST.md) — per-surface verification ledger
- [TRACKER](docs/ledger/TRACKER.md) — open work + DoD progress

### 📚 Operator notes ([lessons-learned/](docs/lessons-learned/))
- [LinkedIn OIDC does NOT return vanity](docs/lessons-learned/2026-05-21-linkedin-oidc-no-vanity.md)
- [Apollo free tier is useless](docs/lessons-learned/2026-05-21-apollo-useless.md)
- [iogrid wire-format — 4 corrections](docs/lessons-learned/2026-05-21-iogrid-wire-format.md)
- [Lessons index](docs/lessons-learned/README.md)

### 🗓️ Sessions ([sessions/](docs/sessions/))
- [2026-05-21 — iogrid LinkedIn-vanity integration end-to-end](docs/sessions/2026-05-21-iogrid-integration.md)

## Tracking

Umbrella issue: [#1](https://github.com/dynolabs-io/vcard/issues/1). Open work board: see the **Live state** section above.
