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

## Proxy mode (iogrid residential SOCKS5+TLS)

`vcard-api` is **iogrid's first paying customer**. LinkedIn vanity-page
enrichment (`POST /v1/enrich/linkedin`) routes its outbound GET through
iogrid's residential-IP mesh so LinkedIn doesn't datacenter-IP rate-limit
us within minutes.

### Wire shape

LinkedIn enrichment dials `proxy.iogrid.org:443`, **TLS-wraps** the
connection (Traefik fronts the iogrid gateway with TLS termination on
:443 — speaking raw SOCKS5 to :443 hangs), then negotiates RFC 1928
SOCKS5 + RFC 1929 USERPASS on top of the `*tls.Conn`. Username = iogrid
**workspace handle**, password = iogrid **API key** (prefix `iog_`).
The destination TLS handshake (vcard-api → linkedin.com) is end-to-end
on the resulting byte stream — the proxy never sees plaintext.

Implementation: [`api/services/vcard-api/enrich/linkedin.go`](api/services/vcard-api/enrich/linkedin.go).

### Configuration (env vars)

| Var | Required | Example |
|---|---|---|
| `IOGRID_WORKSPACE` | yes | `vcard` |
| `IOGRID_API_KEY` | yes | `iog_…` |
| `IOGRID_PROXY_URL` | yes (host:port, NOT a URL scheme) | `proxy.iogrid.org:443` |

**Graceful-skip contract**: when ANY of the three is unset, the
`LinkedInClient` becomes a no-op and the enrich endpoint still returns
200 with empty fields. Same applies to transport failures / non-200 from
LinkedIn. Mobile callers treat enrichment as best-effort.

### Kubernetes wiring

The Deployment under
`openova-private/clusters/contabo-mkt/apps/dynolabs/vcard-api.yaml`
already wires the three env vars from a Secret named `iogrid-proxy-creds`
in the `dynolabs` namespace, with `optional: true` so the pod boots
before the Secret lands.

Skeleton (empty values — populate out-of-band):
[`api/deploy/iogrid-proxy-creds.example.yaml`](api/deploy/iogrid-proxy-creds.example.yaml).

Operator flow:
1. Mint a workspace + API key in iogrid `billing-svc` (founder action).
2. `kubectl -n dynolabs create secret generic iogrid-proxy-creds \
   --from-literal=IOGRID_WORKSPACE=vcard \
   --from-literal=IOGRID_API_KEY=iog_… \
   --from-literal=IOGRID_PROXY_URL=proxy.iogrid.org:443`
   (or land via sealed-secret / external-secrets — never commit the key).
3. `kubectl -n dynolabs rollout restart deploy/vcard-api`.

### Smoke test

From inside `api/`:

```bash
IOGRID_WORKSPACE=vcard \
IOGRID_API_KEY=iog_… \
IOGRID_PROXY_URL=proxy.iogrid.org:443 \
  make smoke-proxy
```

The probe GETs `https://api.ipify.org` through the iogrid client and
fails LOUDLY if the returned IP equals the local egress IP (i.e. proxy
not in path). Source:
[`api/services/vcard-api/cmd/smoke-proxy/main.go`](api/services/vcard-api/cmd/smoke-proxy/main.go).

### Known status (2026-05-22)

The proxy chain is end-to-end **wired in code** but the gateway side is
still flapping — see
[`iogrid/iogrid#414`](https://github.com/iogrid/iogrid/issues/414) and
[`#350`](https://github.com/iogrid/iogrid/issues/350) (Traefik
intercepts TLS on `proxy.iogrid.org:443` before SOCKS5 can negotiate).
Until those land + the Secret is populated, enrichment stays in the
graceful-skip path — zero production impact.

## Tracking

Umbrella issue: [#1](https://github.com/dynolabs-io/vcard/issues/1).

## Operator actions still required (block Phase 6/7)

- Apple Pass Type ID certificate (`.p12`) — create at developer.apple.com → Identifiers → Pass Type IDs. Mount as K8s secret.
- LinkedIn OAuth app — create at developer.linkedin.com. Set redirect URI to `https://api.dynolabs.io/oauth/linkedin/callback`. Stash client id + secret as K8s secret.
- Google Wallet API issuer — request access at https://console.cloud.google.com/google/wallet. Set issuer ID + service account JSON.
