# dynolabs-io/vcard `api/` — Repo-specific Notes

> Backend microservices for the Dynolabs vCard mobile app, living under `api/` of `dynolabs-io/vcard`. The parent repo's `CLAUDE.md` is one level up; generic OpenOva platform working principles live in `~/.claude/CLAUDE.md` (user-global).
>
> **History:** until 2026-05-21 these services were their own repo at `dynolabs-io/api` — subtree-merged into `dynolabs-io/vcard:main` (commit `29b944d`) and archived. References to "the api repo" in older docs / commits / memory point here.

## What this is

Go microservices backend serving the Dynolabs vCard mobile app (`io.dynolabs.vcard`), the public web profile pages (`dynolabs.io/c/<slug>`), the photo CDN, the LinkedIn OAuth handshake, and Apple Wallet / Google Wallet pass signing. Each service is an independent Go module aggregated via a single workspace (`go.work`), built as a distroless static binary, deployed via Flux from `openova-private/clusters/contabo-mkt/apps/dynolabs/`.

## What lives in this repo

| Concern | Path |
|---|---|
| Cards CRUD + slug resolution | `services/vcard-api/` |
| Apple `.pkpass` + Google Wallet JWT signing | `services/pass-signer/` |
| S3-backed avatar storage + serving | `services/photo-cdn/` |
| LinkedIn OAuth callback + profile fetch | `services/linkedin-oauth/` |
| SSR public profile page | `services/web-profile/` |
| Shared code | `shared/` |
| Go workspace pin | `go.work` |
| CI matrix build | `../.github/workflows/api-build.yml` (paths-filtered to `api/**`) |

## Tech stack

- Go 1.25 (`go.work`)
- HTTP `:8080` per service, `/healthz` + `/readyz` on every service
- PostgreSQL source-of-truth + NATS for replication (CAP-AP, eventual consistency)
- Stub-mode flags allow deployment before external creds (Apple Pass cert, LinkedIn OAuth, Google Wallet issuer) are provisioned
- Container registry: `ghcr.io/dynolabs-io/vcard/api/<service>:<sha>` (was `.../api/<svc>` pre-merge)
- Deploy: Flux on contabo-mkt under `openova-private/clusters/contabo-mkt/apps/dynolabs/`

## Development workflow

```bash
# Run a service locally
cd services/vcard-api
go run .
curl localhost:8080/healthz

# Build all services
go build ./...

# Workspace tests
go test ./...
```

## CI/CD

Push to `dynolabs-io/vcard:main` touching `api/**` → `.github/workflows/api-build.yml` runs a matrix build of all 5 services → SHA-tagged images land at `ghcr.io/dynolabs-io/vcard/api/<svc>:<short-sha>` + `:latest` → manual bump of the SHA in `openova-private/clusters/contabo-mkt/apps/dynolabs/<svc>.yaml` → Flux reconciles. (The pre-merge auto-bump workflow `dynolabs-bump-sha.yml` never landed on openova-private — see `dynolabs-io/vcard#2` for follow-ups.)

## Tracking

Umbrella issue: `dynolabs-io/vcard#1`.

## Known issues

- (empty for now — populate as discovered)

## Sub-agent cap for this project

Default (per user-global) unless project owner overrides here.
