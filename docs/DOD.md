# Definition of Done

> 📐 PERMANENT canon. Specialization of the cross-repo DoD in `~/.claude/CLAUDE.md` §2 for this product repo.

## The metric

**DoD = operator walks the surface on a FRESH provisioned environment + screenshot attached to the issue.** Not "PR merged". Not "tests green". Not "CI passed". The user (founder) explicitly closes the issue after verification.

For vcard this resolves to two flavors, depending on what the change touches.

## Flavor A — mobile change (anything under `app/ lib/ components/ hooks/ constants/ assets/ app.json package*.json .maestro/`)

A mobile change is DONE when **all** of the following hold:

1. `iOS TestFlight` workflow green on the merged SHA — Maestro E2E gate passes ON THE iOS SIMULATOR before archive runs.
2. Build assigned to the **Founders** beta group in App Store Connect (either via the workflow's `asc-assign-build` step or `workflow_dispatch` of `.github/workflows/asc-assign-build.yml`).
3. Founder installs the new build on a physical device from TestFlight.
4. Founder walks the affected surface and attaches a screenshot (or short screen-recording) to the relevant issue comment.
5. Founder closes the issue (never the agent).

Auto-close on merge is the enemy. PR bodies default to `Refs #N`. Exception: pure docs-only or CI-gate-only PRs MAY use `Closes #N` per `~/.claude/CLAUDE.md` §3 rule 1.

## Flavor B — backend change (anything under `api/`)

A backend change is DONE when **all** of the following hold:

1. `api-build-and-push` workflow green on the merged SHA — matrix builds all 5 services, pushes `ghcr.io/dynolabs-io/vcard/api/<svc>:<short-sha>` + `:latest`.
2. The `<svc>.yaml` in `openova-private/clusters/contabo-mkt/apps/dynolabs/` is bumped to that SHA in a SEPARATE PR (mixed concerns banned per [`PRINCIPLES.md`](PRINCIPLES.md) "Don't mix concerns").
3. Flux reconciles cleanly: `kubectl -n flux-system get kustomization apps` is `Ready=True` AND the deploy(s) rolled (`kubectl -n dynolabs rollout status deploy/<svc>`).
4. Endpoint smoke from inside the cluster returns the expected HTTP code (e.g. `POST /v1/enrich/linkedin` → 401 without auth, 200 with auth).
5. The next mobile build that consumes this change reaches DoD per Flavor A.

## What does NOT count as Done

| Anti-pattern | Why it fails the bar |
|---|---|
| "PR merged" alone | Doesn't prove the operator-visible surface works. |
| `kubectl --dry-run=server` against a running cluster | The cluster already has the CRDs — that's not "fresh". Reprovision-validated only. |
| "Pre-existing failure" admin-merge | Banned per `~/.claude/CLAUDE.md` §3 rule 4. Fix the check before riding on top. |
| Agent self-walks | Verification agents are READ-ONLY per `~/.claude/CLAUDE.md` §3 rule 6 — they produce evidence, never close. |
| TestFlight upload without Founders-group assignment | Founder can't install it; therefore can't walk it. |
| Tests green / typecheck clean | Necessary, not sufficient. Behaviour ≠ strings. |

## Verification artifacts (what to attach)

To the issue, in this order:

1. **Screenshot** of the working surface (or short video, ≤ 30s).
2. **Commit SHA(s)** that made it work — both `dynolabs-io/vcard` and `openova-private` if applicable.
3. **Endpoint smoke** output (`kubectl run --rm curl-test ... | tail -2`) when the change has a server surface.
4. (Optional) **Log line** that proves the new code-path ran (e.g. `linkedin userinfo decoded ... hasVanity=true`).

See [`ledger/TRUST.md`](ledger/TRUST.md) for the current state of each walk surface (UNVERIFIED / VERIFIED-PASS / VERIFIED-FAIL / VERIFIED-PARTIAL).
