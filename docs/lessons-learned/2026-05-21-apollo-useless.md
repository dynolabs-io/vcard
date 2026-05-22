# 2026-05-21 — Apollo free tier returns empty payloads — useless in practice

## What we tried

`vcard-api`'s previous enrichment endpoint `POST /v1/enrich/email` (pre-`9eaf9a2`) called Apollo.io's People-Match API at `https://api.apollo.io/v1/people/match` with the user's email and mapped the response into title + company + companyDomain + linkedinUrl + photoUrl. The mobile "Import from LinkedIn" button called it after the OIDC handshake completed.

Apollo was treated as the **primary** provider. The iogrid LinkedIn-vanity fetch was intended as the fallback — chained when Apollo returned empty AND the user had a stored vanity AND the request was for the user's own email.

## What we observed

- Apollo's free tier (50 lookups/month) **returns 200 with an empty `person` object** for the addresses we tested — no title, no company, no fields.
- Tested founder's `hatyil@gmail.com` (consumer domain) and a couple of work-domain emails. All empty.
- A paid plan is north of $100/mo and out of scope for Phase 0.
- Because Apollo was the primary, the iogrid chain never got invoked even after we wired it. The user saw "imported name + email + photo, but nothing else" indefinitely.
- Founder direction 2026-05-21: *"you told me apollo was already useless!!! you were supposed to remove it"*.

## Takeaway

Free-tier "enrichment" providers that gate by `400`-returning a paid feature are worse than nothing — they create a hidden 200-with-empty-payload path that silently masks the real provider behind them.

**Decision**: delete Apollo entirely. iogrid LinkedIn-vanity becomes the sole enrichment provider. See [ADR 0002](../adr/0002-drop-apollo-iogrid-only.md) and the corresponding [`GLOSSARY.md`](../GLOSSARY.md) banned-terms entry — don't reintroduce Apollo without a fresh ADR.

**Generalized lesson**: when integrating a third-party enrichment / data API, smoke-test the **free tier specifically** before designing a fallback chain around it. If the free tier returns empty 200s, treat the provider as "paid only" — and decide whether you'll actually pay before writing the code.
