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

Umbrella issue: [#1](https://github.com/dynolabs-io/vcard/issues/1). Open work board: see the **Live state** section above.
