# 2026-05-21 — iogrid proxy wire format — 4 corrections from the iogrid session output

## What we tried

The founder's iogrid session output (a previous Claude session in `~/repos/iogrid`) dictated a wiring recipe to integrate vcard-api with the iogrid residential proxy:

```sql
INSERT INTO workspaces (id, slug, display_name, owner_user_id, plan, created_at)
VALUES (gen_random_uuid(), 'vcard', 'Dynolabs vCard', '<your-user-id>', 'phase0', now());

WITH plaintext AS (SELECT 'ig_live_vcard_' || encode(gen_random_bytes(16), 'hex') AS key)
INSERT INTO api_key (id, workspace_id, key_hash, name, ...)
SELECT gen_random_uuid(), '<WS_ID>', crypt(key, gen_salt('bf', 10)), 'vcard-prod', ...
```

Go client:
```go
proxyURL, _ := url.Parse("socks5h://vcard:ig_live_vcard_xxxx@proxy.iogrid.org:443")
dialer, _ := proxy.FromURL(proxyURL, proxy.Direct)
```

## What we observed

Reading the actual iogrid source (`~/repos/iogrid`) before executing showed four divergences from the session's recipe. Had we executed it as-given, the proxy would never have authenticated us.

| # | Session said | Reality | Source |
|---|---|---|---|
| 1 | Key prefix `ig_live_vcard_*` | `iog_` | `iogrid/coordinator/services/billing-svc/internal/server/api_keys.go:45` `const keyPrefix = "iog_"` |
| 2 | bcrypt hash (`crypt(key, gen_salt('bf', 10))`) | **SHA-256 hex** | `api_keys.go:65` `hashKey()` = `hex.EncodeToString(sha256.Sum256(...))`. ValidateApiKey does `LookupApiKeyByHash(ctx, hashKey(plaintext))` |
| 3 | `INSERT INTO workspaces (id, slug, display_name, owner_user_id, plan)` | Real cols: `id, owner_user_id, name, plan, billing_customer_id_stripe, created_at, updated_at, deleted_at` — **no `slug`, no `display_name`**. Phase 0 stubs workspace creation in `gateway-bff` in-process. | `iogrid/coordinator/services/identity-svc/internal/db/migrations/0003_workspaces.sql` |
| 4 | `socks5h://...:443` via `golang.org/x/net/proxy` (raw TCP) | Traefik fronts `:443` with TLS passthrough — client MUST `tls.Dial` FIRST, then speak SOCKS5 inside the `*tls.Conn`. Raw TCP hangs at context deadline. | `iogrid/examples/phase0-vcard-customer/client.go:184` `dialThroughTLSSOCKS5` + iogrid issue #265 |

## Takeaway

**Recipes from a previous session — even your own previous session — are pre-merge claims, not facts.** Always re-read the source-of-truth code before executing, especially for cross-repo integrations. The session's recipe was internally consistent but disagreed with the merged code on every layer (key shape, hashing, schema, transport).

The corrected mint + client wiring is in [`PRINCIPLES.md`](../PRINCIPLES.md) §iogrid (canonical wire format) and [`RUNBOOKS.md`](../RUNBOOKS.md) "Mint a fresh iogrid API key" (corrected SQL). The first-mint key id is `efd20c9d-232f-43ab-96c0-b424e96f5478` (vcard-prod, 2026-05-21).

**Generalized lesson**: when a sub-agent or prior session output dictates code-level details (SQL columns, env keys, wire prefixes, hashing), and the integration is cross-repo, run the cross-reference grep first — don't paste the recipe into a runbook untouched. Cost of the grep: 30 seconds. Cost of executing a wrong recipe against the iogrid billing DB: re-mint round + log noise + potentially exposed un-revoked plaintext.
