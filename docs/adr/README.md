# ADRs — Architecture Decision Records

> 🏛️ HISTORICAL. Append-only. Each file is immutable once committed (status may change from Accepted to Superseded; never edit the body). One file per decision; numbering monotonic.

## Index

| # | Title | Status | Date |
|---|---|---|---|
| [0001](0001-subtree-merge-api.md) | Subtree-merge `dynolabs-io/api` into `dynolabs-io/vcard/api/` | Accepted | 2026-05-21 |
| [0002](0002-drop-apollo-iogrid-only.md) | Drop Apollo, route LinkedIn enrichment exclusively via iogrid | Accepted | 2026-05-21 |
| [0003](0003-linkedin-vanity-via-url-prompt.md) | Capture LinkedIn vanity via user-pasted URL, not OIDC claim | Accepted | 2026-05-21 |

## How to add an ADR

1. Pick the next free number (max + 1).
2. Filename: `NNNN-<short-kebab-slug>.md`.
3. Header includes Status (`Proposed` / `Accepted` / `Superseded by NNNN`) + Date (ISO).
4. Body sections: **Context**, **Decision**, **Consequences**, **Receipts** (commit SHAs / PRs / issues).
5. Update this index.
6. ADRs are written once and don't get edited beyond the Status header line.
