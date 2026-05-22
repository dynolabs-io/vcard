# Security

> 📐 PERMANENT canon. Threat model, identity model, and secrets policy for dynolabs-io/vcard. Generic OpenOva platform security (zero-trust, SPIFFE/SPIRE, vault → ESO → ephemeral) lives in user-global; this doc is repo-specific.

## Identity

| Provider | What we trust | How we verify |
|---|---|---|
| **Apple Sign-In** (primary on iOS) | The `identityToken` JWS shipped by the SIWA system framework | `api/services/vcard-api/auth/apple.go` — server fetches Apple's JWKS, verifies the JWS, checks `aud == APPLE_BUNDLE_ID` and the `sub` claim. Email may be a relay address (per Apple); accepted. |
| **LinkedIn OAuth** (secondary) | The `sub` claim returned by LinkedIn's `/v2/userinfo` AFTER server-side code-exchange | `api/services/linkedin-oauth/main.go` — code is exchanged server-side; the mobile app never sees the LinkedIn access token. Mobile POSTs `{sub, name, email, picture, vanity}` to `vcard-api /v1/auth/linkedin` and the server trusts the `sub` (LinkedIn OAuth itself is the gate — there's no identity-token to cryptographically verify the way Apple does). |

After either path succeeds, `vcard-api` issues its own HS256 JWT (`SessionClaims` in `api/services/vcard-api/auth/apple.go:51`) signed with `VCARD_HMAC_SECRET` (32-byte hex secret, K8s secret `vcard-hmac`). All `/v1/*` endpoints that require auth (`/users/me`, `/cards*`, `/scans*`, `/leads*`, `/cards/claim`, `/enrich/linkedin`) use the same `Authorization: Bearer …` header.

When `VCARD_HMAC_SECRET` is unset the pod boots with an ephemeral 32-byte random secret + a `slog.Warn` that sessions will invalidate on restart. Production must set it.

## Secrets — what's in the cluster

All under ns `dynolabs` on the contabo-mkt cluster. Source-of-truth for refs is each `Deployment` manifest in `openova-private/clusters/contabo-mkt/apps/dynolabs/`.

| Secret | Consumed by | Purpose | Provisioned? |
|---|---|---|---|
| `vcard-hmac` | `vcard-api` env `VCARD_HMAC_SECRET` | HS256 session-token signing | Yes |
| `vcard-postgres-app` (CNPG-issued) | `vcard-api` env `DATABASE_URL` | PG connection string | Yes (CNPG-managed) |
| `iogrid-proxy-creds` | `vcard-api` env `IOGRID_API_KEY` / `IOGRID_WORKSPACE` / `IOGRID_PROXY_URL` | iogrid customer auth for LinkedIn-vanity enrichment | Yes (minted 2026-05-21) |
| `minio-root-credentials` | `photo-cdn` env `S3_*` | MinIO root creds for the `vcard-photos` bucket | Yes (MinIO StatefulSet) |
| `ghcr-pull` | every `Deployment` `imagePullSecrets` | Pull `ghcr.io/dynolabs-io/vcard/api/*` images | Yes |
| **`pass-signer-cert`** (or equivalent) | `pass-signer` | Apple Pass Type ID `.p12` + key + WWDR cert | **NO — operator action** (see [`STATUS.md`](STATUS.md)) |
| **`linkedin-oauth-app`** (or equivalent) | `linkedin-oauth` env `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | Production OAuth app credentials | **NO — operator action** |
| **`google-wallet-issuer`** | `pass-signer` | Google Wallet issuer ID + service-account JSON | **NO — operator action** |

Until the three pending secrets land, their owning surfaces operate in **stub mode**: `linkedin-oauth` returns `503 {"error":"stub-mode: LinkedIn OAuth app not yet configured"}` from `/oauth/linkedin/authorize`; `pass-signer` returns a stub `.pkpass` or 503.

## Secret operational rules

- **Never commit secret material.** `.gitignore` blocks `*.p12` / `*.p8` / `.env*` (verify before any `git add -A`).
- **Never log secret values.** Logs use redacted forms: `email_domain` (not full email), `redactVanity()` (first-3 + `***`), `hasVanity` (boolean, not the value). The `linkedin-oauth` `rawKeys` log line is the only place that surfaces field-presence — never the field values themselves.
- **Rotation: iogrid API key**. To rotate, mint a new one and `UPDATE api_key SET revoked_at=now() WHERE id='<old-id>'` in the iogrid `billing` DB. See [`RUNBOOKS.md`](RUNBOOKS.md) "Mint a fresh iogrid API key".
- **Rotation: session HMAC**. Rotating `VCARD_HMAC_SECRET` invalidates every active session. Coordinate with a release window.

## Photo CDN — uploads and serving

`photo-cdn` (`api/services/photo-cdn/main.go`) auto-creates the `vcard-photos` bucket on first request if missing. Uploads go through the service (`PutObject`); reads stream from the service too (`GetObject`). There's no client-side presigned upload URL today — every byte transits via vcard-api. This is intentional for Phase 0 (one round-trip simpler; bucket is invisible to the public). If/when we expose presigned uploads in the future, file an ADR.

## Threat surface — quick map

| Surface | Threat | Mitigation |
|---|---|---|
| `POST /v1/auth/linkedin` | Forged `{sub, name, email, picture}` | LinkedIn OAuth itself is the gate (mobile must run the OAuth dance); server-side code-exchange in `linkedin-oauth` happens BEFORE the mobile sees the result. A direct POST without first running OAuth still creates a new user but with no real `sub` — mitigated by requiring a non-empty `sub` and binding to `users.linkedin_sub` UNIQUE. Phase 1 will tighten via cross-service shared-cache lookup against the `linkedin-oauth` state store. |
| `POST /v1/enrich/linkedin` | Vanity-scrape abuse | Auth required (`Bearer` session token); rate-limit not yet wired (Phase 1). |
| Anyone with a profile slug | Lead leakage via `GET /c/<slug>` | Lead-form submissions land in `leads` table scoped to the card owner; `scan_events` (page views) is anonymous low-cardinality (city/country/ua_family only). |
| Photo upload | Malicious payloads in image bytes | Size cap at upload + `Content-Type` sniff; bucket policy is private (only `photo-cdn` serves). |
| Wallet pass signing | Unauthorized pass issuance | `pass-signer` requires the same `Bearer` session token; Wallet web-service push-update endpoints use a separate `WALLET_WEBSERVICE_TOKEN`. |

## Audit + GDPR posture

- `users` table holds `name` + `email` + `linkedin_sub` / `apple_sub` + `linkedin_vanity`. Deletion is a soft path (Phase 1 ADR pending).
- `leads` is the only place we hold a contact form's `from_name` / `from_email` / `from_phone` for someone NOT signed into Dynolabs — visible only to the target card's owner; retention policy not yet codified.
- We do NOT log raw OIDC userinfo bodies; only key-presence + raw-key-list (see `linkedin-oauth/main.go:285` `linkedin userinfo decoded`).
