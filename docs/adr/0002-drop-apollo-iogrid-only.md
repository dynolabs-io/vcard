# ADR 0002 — Drop Apollo, route LinkedIn enrichment exclusively via iogrid

**Status**: Accepted
**Date**: 2026-05-21

## Context

`vcard-api` previously had a two-stage enrichment path for the "Import from LinkedIn" mobile flow:

1. **Apollo.io email-match** at `POST /v1/enrich/email` — tried to fill title + company from the LinkedIn-OIDC-supplied email address.
2. **iogrid LinkedIn-vanity fetch** at `POST /v1/enrich/linkedin` — fetched the public LinkedIn profile page through a residential proxy and parsed `og:title` + `og:image`.

The expectation was Apollo would handle the common case and iogrid would be a fallback for richer / harder-to-match profiles.

The empirical reality after Phase 0 testing:
- **Apollo's free tier returns empty payloads** for the addresses we tested. A paid plan is expensive and out of scope for Phase 0.
- **Apollo never delivered a populated title/company response** in the founder's testing.
- The chain logic kept Apollo as the primary, so iogrid was never invoked — the user kept seeing empty enrichment results.
- Founder direction 2026-05-21: *"you told me apollo was already useless!!! you were supposed to remove it"*.

## Decision

Delete the Apollo path entirely. Single enrichment provider: iogrid LinkedIn-vanity, exposed at `POST /v1/enrich/linkedin {"vanity":"<slug>"}`. The `/v1/enrich/email` endpoint is removed (returns 404). The `APOLLO_API_KEY` env var, the `dynolabs-apollo` Secret reference, the `Client` type, the `apolloEndpoint` package-level var, and `mergeEnrich` / `shouldChainLinkedIn` / `vanityForSelf` chain logic are all deleted from `api/services/vcard-api/enrich/enrich.go`.

Apollo is added to [`GLOSSARY.md`](../GLOSSARY.md) banned-terms.

## Consequences

**Positive**:
- One enrichment provider — clearer mental model, simpler code path (~500 lines deleted vs ~50 added).
- No more silent-empty-due-to-free-tier failures masking the real provider behind a useless one.
- Lower attack surface (one upstream auth path, one set of secrets).

**Negative**:
- Enrichment now hard-depends on iogrid being healthy. Today (Phase 0) the iogrid mesh has zero online providers with `social-intel` opt-in — see [`STATUS.md`](../STATUS.md) iogrid blocker #1. Until `iogridd` runs on the founder's Mac, the endpoint returns 200 with empty fields (graceful skip is preserved). The user-visible symptom is identical to the Apollo era ("title/company stays empty"), but the failure mode is honest — proxy-gateway logs `dispatch_failed: no eligible provider` rather than Apollo silently 200ing with `{}`.
- We pay a per-byte iogrid bill for every enrichment once a provider is online. Phase 1: meter + rate-limit.
- Email-keyed enrichment is no longer possible. Required input is now a LinkedIn URL — see [ADR 0003](0003-linkedin-vanity-via-url-prompt.md) for how the mobile app obtains it.

## Receipts

- vcard commit `9eaf9a2` — `feat(enrich): drop Apollo, route LinkedIn enrichment via iogrid only` (516 lines removed)
- openova-private commit `b2be7bdb` — `deploy(dynolabs): bump to 9eaf9a2 (drop Apollo, iogrid-only enrichment)` (also removed `APOLLO_API_KEY` env)
- Smoke (2026-05-21): in-cluster `POST /v1/enrich/email` → 404 ✓ ; `POST /v1/enrich/linkedin` → 401 unauthenticated ✓
- Related: [ADR 0003](0003-linkedin-vanity-via-url-prompt.md) (vanity capture mechanism, since OIDC won't give us one)
