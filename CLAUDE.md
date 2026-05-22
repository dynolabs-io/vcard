# dynolabs-io/vcard — Agent orientation

> This is a product repo (kind C per user-global `~/.claude/CLAUDE.md` §0). Generic OpenOva platform working principles, anti-theater discipline, sub-agent dispatch rules, and the diversion catalog live in user-global — do not duplicate them here.

## Read first (canon)

Start with [`README.md`](README.md), then `docs/` in this order: [GLOSSARY](docs/GLOSSARY.md) → [STATUS](docs/STATUS.md) → [ARCHITECTURE](docs/ARCHITECTURE.md) → [PRINCIPLES](docs/PRINCIPLES.md) → [DOD](docs/DOD.md). Operator how-tos live in [RUNBOOKS](docs/RUNBOOKS.md); secrets / identity / threat surface in [SECURITY](docs/SECURITY.md); historical decisions in [`docs/adr/`](docs/adr/); live state in [`docs/ledger/`](docs/ledger/).

When something in this CLAUDE.md disagrees with one of the canon docs, the canon doc wins — fix this file.

## File layout (in one screen)

| Path | Role |
|---|---|
| `app/` | Expo Router screens (`(tabs)/index`, `(tabs)/scan`, `(tabs)/me`, `card/[id]`, `card/new`, `_layout.tsx`) |
| `lib/` | `config.ts` (URLs — **never hardcode in components**), `storage.ts` (MMKV), `vcard.ts` (vCard 3.0), `api.ts` (typed client), `linkedin.ts`, `auth.ts`, `types.ts` |
| `components/` | Shared UI — `CardForm.tsx`, `SwipeRow` pattern, etc. |
| `.maestro/` | Maestro E2E flows used by the iOS CI Simulator gate |
| `api/services/<svc>/` | Five Go microservices — `vcard-api`, `pass-signer`, `photo-cdn`, `linkedin-oauth`, `web-profile` |
| `api/shared/` | Cross-service Go code (health handler etc.) |
| `api/go.work` | Go workspace pin |
| `.github/workflows/` | `ios.yml` (TestFlight), `api-build.yml` (5-service GHCR matrix), `asc-assign-build.yml` (manual Founders-group reassign), `ci.yml` (mobile typecheck/lint) |
| `docs/` | Canonical docs tree (see [README](README.md) for the index) |

For end-to-end architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). For the inheritance from the now-archived `dynolabs-io/api` repo: [ADR 0001](docs/adr/0001-subtree-merge-api.md).

## Dev commands

```bash
# Mobile
npm install
npx expo start
npm run typecheck && npm run lint

# Backend (Go workspace)
cd api && go build ./... && go test ./...
```

**Builds run in GitHub Actions only — never `eas build` locally.** Full release path in [`docs/RUNBOOKS.md`](docs/RUNBOOKS.md).

## Known issues / repo-specific gotchas

Three anti-patterns are now codified in [`docs/PRINCIPLES.md`](docs/PRINCIPLES.md). Highlights so you don't trip over them again:

- **iOS 26 + new-arch-off + Stack modals**: never wrap the root in `<GestureHandlerRootView>` — modals silently dismiss. Use `Animated.View` + `PanResponder` for swipe. See [PRINCIPLES §ios26-swipe](docs/PRINCIPLES.md).
- **Apple Wallet strip**: ALWAYS pack photo + brand logo + brand color on the full 1125×432 canvas. No Photo-OR-Logo style picker. See [PRINCIPLES §wallet-strip](docs/PRINCIPLES.md).
- **Apollo is banned**. iogrid LinkedIn-vanity is the sole enrichment provider. See [ADR 0002](docs/adr/0002-drop-apollo-iogrid-only.md) and [GLOSSARY banned-terms](docs/GLOSSARY.md).
- **iogrid wire format**: outer TLS first, then RFC 1928 SOCKS5 inside the `*tls.Conn`. Don't use `golang.org/x/net/proxy`. See [PRINCIPLES §iogrid](docs/PRINCIPLES.md).

Live operator-action blockers: [`docs/STATUS.md`](docs/STATUS.md).

## Tracking

Umbrella issue: [#1](https://github.com/dynolabs-io/vcard/issues/1). Open work + DoD progress: [`docs/ledger/TRACKER.md`](docs/ledger/TRACKER.md).

## Sub-agent cap for this project

Default (per user-global) unless changed here. The 3-keeper-3rd-slot-reserved rule still applies — don't burn the third slot on cleanup/docs while a 🔴 UNVERIFIED row in [`docs/ledger/TRUST.md`](docs/ledger/TRUST.md) is unwalked.
