# ADR 0001 — Subtree-merge `dynolabs-io/api` into `dynolabs-io/vcard/api/`

**Status**: Accepted
**Date**: 2026-05-21

## Context

`dynolabs-io/api` was a separate GitHub repo holding 5 Go microservices (`vcard-api`, `pass-signer`, `photo-cdn`, `linkedin-oauth`, `web-profile`). All five services exclusively backed the `dynolabs-io/vcard` mobile app — no other Dynolabs product consumed them. The split caused four kinds of friction:

1. **Lockstep changes needed two PRs in two repos** (mobile + backend), with cross-repo coordination that frequently desynced.
2. **Sub-agents lost visibility** when they could only see one half of the stack.
3. **Two CI surfaces, two release pipelines**, with the openova-private SHA bump straddling both.
4. **Founder confusion** ("why is the api a different repo, is it just a feature?") — the org-of-orgs structure didn't reflect product boundaries.

## Decision

Subtree-merge `dynolabs-io/api:main` into `dynolabs-io/vcard:main` under `api/`. Archive `dynolabs-io/api` on GitHub. Relocate the CI workflow into the vcard repo with `paths:` filter on `api/**` and a new GHCR path `ghcr.io/dynolabs-io/vcard/api/<svc>:<sha>`.

```bash
git subtree add --prefix=api git@github.com:dynolabs-io/api.git main
```

The five service directories under `api/services/`, the shared module under `api/shared/`, and the Go workspace pin at `api/go.work` move verbatim. Module paths (`github.com/dynolabs-io/api/...`) stay unchanged — the import paths remain valid because the Go workspace structure under `api/` is preserved.

## Consequences

**Positive**:
- One PR per fullstack change.
- One CI surface; matrix builds all 5 services in parallel from a single commit.
- Founder cognitive load goes from two repos to one.
- The vcard `docs/` tree (this one) covers both halves.

**Negative**:
- Git history for the merge commit is a single big `Add 'api/' from commit ...` — `git log` from before the merge requires `--follow` or the archived `dynolabs-io/api` history.
- The post-merge GHCR path differs from the pre-merge one. Any external manifest referencing `ghcr.io/dynolabs-io/api/<svc>` breaks. Mitigated by the lockstep openova-private bump (commit `207b0199`) that updated all 5 service manifests in one go.
- The pre-merge auto-bump CI workflow (`bump-flux` job in the old `build.yml`) referenced `dynolabs-bump-sha.yml` in `openova-private` — that workflow never existed, so bumps were always silently manual. The merge surfaced this gap rather than fixing it. Tracked in [`STATUS.md`](../STATUS.md) iogrid blocker #3.

## Receipts

- vcard commit `29b944d` — `Add 'api/' from commit 'e80cfcfc9fdcbd248e03309bbcc3337941cb832f'`
- vcard commit `e5a6fd5` — `chore(api): relocate CI to vcard/.github/workflows/api-build.yml`
- openova-private commit `207b0199` — `deploy(dynolabs): cut over to ghcr.io/dynolabs-io/vcard/api/* (subtree merge)`
- GitHub: `dynolabs-io/api` repo set to `isArchived: true` on 2026-05-21
- Issue: [dynolabs-io/vcard#2](https://github.com/dynolabs-io/vcard/issues/2) — the migration ticket
