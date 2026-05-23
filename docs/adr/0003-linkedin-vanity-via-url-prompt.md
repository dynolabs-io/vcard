# ADR 0003 — Capture LinkedIn vanity via user-pasted URL, not OIDC claim

**Status**: Accepted
**Date**: 2026-05-21

## Context

The iogrid enrichment path (see [ADR 0002](0002-drop-apollo-iogrid-only.md)) requires a LinkedIn URL slug (the part after `/in/`). The natural place to capture it was the existing LinkedIn-sign-in OIDC flow — pull a `vanityName` field out of `/v2/userinfo` and persist it alongside `name` / `email` / `picture`.

The implementation we shipped first (commit `a92b3de`) had two paths:

1. Read `vanityName` directly from the userinfo response if present.
2. Else parse `/in/<slug>` from a `profile` URL claim.

Empirical test (founder sign-in 2026-05-21 12:38) showed LinkedIn's response under our `openid profile email` scope had **neither**:

```json
{
  "linkedin userinfo decoded": {
    "hasSub": true, "hasName": true, "hasEmail": true, "hasPicture": true,
    "hasVanity": false, "vanitySource": "none",
    "rawKeys": ["sub","email_verified","name","locale","given_name","family_name","email","picture"]
  }
}
```

Background: the `vanityName` and `profile` URL claims live in LinkedIn's `r_basicprofile` scope, which is part of `r_liteprofile` and only granted to certain partner apps. For an `openid profile email`-only OAuth app (the default for new Sign-In with LinkedIn integrations), these fields are gated.

We could request an upgraded LinkedIn partner status to get `r_basicprofile`, but that's a multi-week vetting process. Phase 0 needs to ship.

## Decision

Stop trying to derive vanity from OIDC. Instead:

1. After OAuth succeeds and the user is in the card editor, prompt them once: *"Paste your LinkedIn URL — we'll pull your title and company from your public profile."* (`Alert.prompt` on iOS; Android lacks the API so the user pastes into the socials field manually.)
2. Extract the slug client-side via `extractLinkedInVanity()` in `lib/linkedin.ts` — accepts `https://www.linkedin.com/in/<slug>`, `/in/<slug>`, or bare `<slug>`.
3. Pass the slug to `api.enrichLinkedin(vanity)` → `POST /v1/enrich/linkedin` → iogrid.

Server-side: keep `linkedInProfile.Vanity` capture in `linkedin-oauth` (in case LinkedIn updates the scope policy or a future app grant adds `r_basicprofile`). Keep `users.linkedin_vanity` column for future use, but stop relying on it for the enrichment fallback.

## Consequences

**Positive**:
- One explicit user action ("paste URL") replaces a fragile invisible auto-extract. Works for every LinkedIn account, not just the ones with a vanity slug LinkedIn chose to expose.
- The user retains agency — they can choose whether to enrich at all (the dialog has a `Skip` button).
- Empirical reality lives in code, not in optimistic assumptions about scope grants.

**Negative**:
- Mobile UX gains one prompt — friction the auto-extract would have avoided. Mitigated by phrasing the prompt as opt-in ("Fill in title and company?") and surfacing the value (the user sees what they gain).
- Android users currently get the prompt skipped (no `Alert.prompt`). They must paste into the socials field manually. Phase 1 should ship a proper input modal that works on both platforms.
- If we later get `r_basicprofile`, we can auto-populate AND fall back to the prompt; the prompt UI shouldn't disappear (user might want to paste a different URL than the one bound to their LinkedIn-OIDC identity).

## Receipts

- vcard commit `a92b3de` — original chain (OIDC-derived vanity → server fallback). Empirically not triggered because OIDC didn't ship vanity.
- vcard commit `9eaf9a2` — replaced with the URL-prompt flow.
- linkedin-oauth pod logs 2026-05-21 12:38:57 — proof LinkedIn doesn't ship `vanityName` or `profile` URL under `openid profile email` scope: `rawKeys = [sub, email_verified, name, locale, given_name, family_name, email, picture]`.
- Related: [`lessons-learned/2026-05-21-linkedin-oidc-no-vanity.md`](../lessons-learned/2026-05-21-linkedin-oidc-no-vanity.md)
