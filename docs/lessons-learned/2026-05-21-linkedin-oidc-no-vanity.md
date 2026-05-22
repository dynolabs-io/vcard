# 2026-05-21 — LinkedIn OIDC `openid profile email` does NOT return vanity

## What we tried

Commit `a92b3de` shipped two paths for capturing the LinkedIn URL slug from the OIDC sign-in flow, in priority order:

1. Read a `vanityName` claim directly from `https://api.linkedin.com/v2/userinfo`.
2. Else parse `/in/<slug>` from a `profile` URL claim.

`linkedin-oauth/main.go deriveVanity()` covered both shapes. Tests covered URL parsing edge cases.

## What we observed

Founder's first sign-in on the new build (2026-05-21 12:38:57 UTC, `kubectl -n dynolabs logs deploy/linkedin-oauth`):

```json
{
  "msg": "linkedin userinfo decoded",
  "hasSub": true, "hasName": true, "hasEmail": true, "hasPicture": true,
  "hasVanity": false, "vanitySource": "none",
  "rawKeys": ["sub","email_verified","name","locale","given_name","family_name","email","picture"]
}
```

LinkedIn's `/v2/userinfo` under our `openid profile email` scope returned **neither** field. The chain therefore could never trigger — every "Import from LinkedIn" stayed at name + email + photo with no title/company.

## Takeaway

`vanityName` and `profile` URL claims are gated behind LinkedIn's `r_basicprofile` scope, which is part of `r_liteprofile` and only granted to partner apps after vetting. For a standard "Sign In with LinkedIn" OIDC app, you cannot rely on either claim being present.

**Don't try to derive vanity from OIDC.** Prompt the user. See [ADR 0003](../adr/0003-linkedin-vanity-via-url-prompt.md) for the user-pasted-URL design that shipped in `9eaf9a2`.

If we ever apply for and receive an upgraded LinkedIn partner status that grants `r_basicprofile`, the auto-extract path can come back — but the user-prompt UI should stay, because a user may want to paste a different LinkedIn URL than the one bound to their sign-in.
