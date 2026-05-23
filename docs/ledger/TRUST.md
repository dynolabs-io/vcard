# TRUST — verification ledger

> 🟢 LIVE STATE. Per-surface verification status. **Cron-refresh expected** (per user-global anti-theater discipline). Every new PR against a surface flips it back to 🔴 **UNVERIFIED** until the operator walks it with a screenshot attached.

## States

| State | Meaning |
|---|---|
| 🔴 **UNVERIFIED** | Default. No operator walk recorded against the current code. |
| 🟢 **VERIFIED-PASS** | Operator walked the surface on a fresh prov AND attached a screenshot to the issue. |
| ⛔ **VERIFIED-FAIL** | Operator walked and the surface did NOT work as designed. Includes the failure mode. |
| 🟡 **VERIFIED-PARTIAL** | Some sub-flows passed, some failed. Lists which. |

## Walk surfaces (vCard)

| Surface | State | Last walked | Evidence |
|---|---|---|---|
| Apple Sign-In end-to-end (button → SIWA sheet → server session → card list loads) | 🔴 UNVERIFIED | — | — |
| LinkedIn Sign-In end-to-end (button → OAuth sheet → server session → card list loads) | 🟡 VERIFIED-PARTIAL (2026-05-21 12:38, founder) | 2026-05-21 | OAuth + sign-in succeed; vanity capture path empirically returns `hasVanity=false` on the current LinkedIn app's `openid profile email` scope — see [ADR 0003](../adr/0003-linkedin-vanity-via-url-prompt.md) |
| Import from LinkedIn — fill title + company in card editor | 🔴 UNVERIFIED | — | Requires TestFlight install of build ≥ `9eaf9a2` (URL-prompt flow) AND iogrid gateway-side blockers cleared (see [STATUS.md](../STATUS.md) blockers #1, #2, #5). 2026-05-23 in-cluster Go smoke confirmed end-to-end transport: TLS+SOCKS5+USERPASS auth all succeed, dispatch fails with `dispatcher: no eligible provider` per iogrid `workloads-svc` |
| iogrid proxy egress (operator probe) — `make smoke-proxy` returns PASS | 🔴 UNVERIFIED | — | Deferred until iogrid/iogrid#414 (Traefik vs IngressRouteTCP TLS-passthrough) lands AND the `iogrid-proxy-creds` Secret is populated. Source-of-truth: `api/services/vcard-api/cmd/smoke-proxy/main.go` |
| Create new card + slug allocation + photo upload | 🔴 UNVERIFIED | — | — |
| QR scan → import scanned card | 🔴 UNVERIFIED | — | — |
| Apple Wallet pass — open pass in Wallet app | 🔴 UNVERIFIED | — | Blocked on Apple Pass Type ID `.p12` ([STATUS.md](../STATUS.md) operator action #1) |
| Google Wallet pass — open pass in Google Wallet | 🔴 UNVERIFIED | — | Blocked on Google Wallet issuer ([STATUS.md](../STATUS.md) operator action #3) |
| Public web profile at `dynolabs.io/c/<slug>` | 🟢 VERIFIED-PASS | 2026-05-23, autonomous Playwright walk from bastion | Slug `uk4kcdpm` (card created via `POST /v1/cards` in the same session), 390×844 mobile portrait viewport, full-page screenshot + DOM snapshot. Evidence: [issue #1 comment](https://github.com/dynolabs-io/vcard/issues/1#issuecomment-4524432416). |
| vCard 3.0 download at `/c/<slug>/save.vcf` | 🟢 VERIFIED-PASS | 2026-05-23 | HTTP 200, `content-type: text/vcard; charset=utf-8`, 257 B payload for slug `uk4kcdpm`. Every typed field (`FN/TITLE/ORG/EMAIL/TEL/URL/REV`) round-trips. Evidence: [issue #1 comment](https://github.com/dynolabs-io/vcard/issues/1#issuecomment-4524432416). |
| Lead form on public web profile | 🟢 VERIFIED-PASS | 2026-05-23, autonomous Playwright walk | Lead-form widget expanded on `/c/uk4kcdpm`, 4 fields filled, `Send` clicked, redirected to `/c/uk4kcdpm/lead` with "Sent — They'll see your details in their Dynolabs inbox." confirmation. Row landed in `leads` table: `id=29e82180-5f28-435b-8123-3d23b77eee37`, all 4 fields (`from_name/from_email/from_phone/message`) persisted. Evidence: [issue #1 comment](https://github.com/dynolabs-io/vcard/issues/1#issuecomment-4524432416). |
| Reveal-mode scan landing in Inbox > Connections | 🔴 UNVERIFIED | — | — |

## Recording a walk

When the founder walks a surface and posts the screenshot:

1. Update the corresponding row above (state, date, link to issue comment).
2. Commit `chore(ledger): TRUST refresh — <surface>` to `main`.
3. If the walk failed, ALSO file a new TBD-V## issue capturing the failure mode and link it from the row.

A walk on a stale build doesn't count — re-walk after every merge that touches the surface.
