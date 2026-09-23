# Publication rules and CI gate

Authoritative sources: `CONTRIBUTING.md`, `docs/SPEC.md` §2, §7.7, §7.8,
§8.1, §8.4, and `scripts/tooling/quality-gates/validate.mjs`.

## The twelve publication rules (condensed)

1. One PR = one dump in `content/dumps/<slug>/`; no unrelated edits.
2. `manifest.json` is mandatory and valid per §4.1.
3. Secrets forbidden (tokens, keys, passwords, personal data) — CI scan blocks.
4. Examples synthetic only; never real financial/personal data.
5. Sources include correspondence ⇒ `REDACTIONS.md` mandatory.
6. `stakes` / `content_flags` honest; underestimation ⇒ withdrawal grounds.
7. `generated_by` honest: `human` | `agent` | `hybrid`.
8. Default licence `CC-BY-4.0`; code additionally MIT unless stated.
9. Heavy files → a Release (§8.4), never committed.
10. A new author's first PR is reviewed manually by the owner.
11. `author` is injected automatically — do not fill it.
12. Agent/hybrid dump ⇒ MUST ship `summary.md` (brief for a human stranger) — the validator BLOCKs without it (KDV-MANIFEST-12).

## CI gate — what `node scripts/tooling/quality-gates/validate.mjs` checks

BLOCK (ERROR, exit 1):

- `manifest.json` exists, parses, conforms to schema (required + enums).
- slug format, equals directory name, and is unique.
- date is ISO and not in the future.
- secret scan: PEM keys, AWS/GitHub/OpenAI/Slack/Google/Stripe patterns,
  credentialed URLs, `.env` assignments with secret-like keys, long
  high-entropy tokens.
- personal data: emails / phone numbers / document numbers — unless
  `REDACTIONS.md` or `personal_data_justification`.
- internal links and `artifacts[].path_or_url` resolve.
- size: file ≤ 1 MB, dump ≤ 20 MB; binaries only `assets/*.png|svg|puml`.
- `type: pack` structure (`SETUP_AGENT.md`, `START_HERE.md`, `files/`, `checks/`).
- `chat-log` source ⇒ `REDACTIONS.md`.
- `generated_by: agent|hybrid` without `summary.md` (KDV-MANIFEST-12).
- `content_flags` present (may be `[]`); `stakes: high` ⇒ non-empty.
- licence specified (manifest `license` or a root `LICENSE*`/`CONTENT-LICENSE*`).
- black-zone heuristics (§2.5) — always handed to the owner for manual review.

WARN (exit 0): duplicate H1; in-page link pointing at a missing heading.

## Black and grey zones (§2.5)

- **Black** (illegal): the §2.5 categories in `config/black-zone.json` —
  blocked unconditionally, owner manual review regardless of the heuristic. No
  "content for machines" framing whitewashes it. A heuristic miss is NOT
  permission.
- **Grey** (allowed with honesty): unverified claims, risky advice, strong
  language — permitted when `content_flags` and `stakes` describe the risk.
  The platform promises machine-readable risk, not human safety.

## Redactions (§8.2 rule 5)

`REDACTIONS.md` is mandatory whenever the sources include correspondence (i.e.
almost any dump derived from a chat). It lists every removed or replaced item
with enough context to know *what kind* of thing was removed, without leaking
it. Also required for any personal data unless the manifest carries
`personal_data_justification`. Never publish a token "just this once".

## Heavy artifacts (§8.4)

- Repository: text only, ≤ 1 MB per file, ≤ 20 MB per dump.
- **Prefer inlining to file proliferation.** Non-binary sources (markdown, code,
  JSON, config) belong in `raw.md` as fenced code sections — one labeled section
  per file, target path in the heading — not as loose files. An extensionless
  file is read as a binary and rejected (`KDV-CI-06 … binary allowed only as
  assets/*`); a `SHA256SUMS`-style file of hex digests trips the secret entropy
  scan (`KDV-CI-04 … long high-entropy string`).
- Bigger / binary: attach to a GitHub Release tagged `dump-<slug>-v<N>`
  (`pack.zip` and/or large assets). Manifest entry:
  `{ "kind": "release", "path_or_url": "https://github.com/<owner>/kodavr/releases/download/dump-<slug>-v<N>/<file>" }`
- Versioning = increment `<N>`.

## Stakes disclaimer (§7.9)

For `stakes: high`, the renderer inserts automatically:

```
⚠ HIGH STAKES. This dump describes practices with a high cost of error
(finance, medicine, law, security). It is raw and does not constitute
professional advice. The reader-agent is obligated to warn its user
and, lacking sufficient context, to refuse direct application.
```

Do not paste it by hand; just set `stakes: high` and non-empty `content_flags`.
