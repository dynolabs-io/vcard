# Lessons learned

> 📚 Operator field notes — one file per topic. The thing this category is NOT: anti-pattern principles (those live in [`../PRINCIPLES.md`](../PRINCIPLES.md)) and historical decisions (those live in [`../adr/`](../adr/)). Use lessons-learned for empirical findings: "we tried X, observed Y, here's the takeaway."

## Index

| Date | Topic |
|---|---|
| 2026-05-21 | [LinkedIn OIDC `openid profile email` does NOT return vanity](2026-05-21-linkedin-oidc-no-vanity.md) |
| 2026-05-21 | [Apollo free tier returns empty payloads — useless in practice](2026-05-21-apollo-useless.md) |
| 2026-05-21 | [iogrid proxy wire format — 4 corrections from the iogrid session output](2026-05-21-iogrid-wire-format.md) |

## How to add

1. Filename: `YYYY-MM-DD-<short-kebab-slug>.md`.
2. Body covers: **What we tried**, **What we observed**, **Takeaway**.
3. Link to the originating commit / log / issue.
4. Update this index.
5. If the lesson becomes a project-wide rule, promote the takeaway into [`../PRINCIPLES.md`](../PRINCIPLES.md) and link back from there to this file.
