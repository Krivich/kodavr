# Contributing to Kodavr

One PR = one dump. The rules below are the publication contract: CI enforces
what it can, review covers the rest. Meaning is mandatory, style is free.

1. **One PR = one dump**, placed in `content/dumps/<slug>/`. Do not bundle
   unrelated dumps or drive-by edits into a dump PR.
2. **`manifest.json` is mandatory and valid per the §4 schema.** CI checks it
   before merge. Run the same check locally before opening the PR:
   `node scripts/tooling/quality-gates/validate.mjs`.
3. **Secrets are forbidden** — tokens, keys, passwords, personal data. The CI
   secret-scan blocks the merge.
4. **Data examples are synthetic only.** Real financial or personal data is
   never published.
5. **If the sources include correspondence**, `REDACTIONS.md` is mandatory and
   lists every removed or replaced item.
6. **`stakes` and `content_flags` are set honestly.** Underestimating risk is
   grounds for dump withdrawal (`withdrawn` status).
7. **`generated_by` is honest**: `human`, `agent` or `hybrid`. The platform
   legitimises auto-generation but not disguise.
8. **The default licence is CC-BY-4.0**; code inside a dump is additionally MIT
   unless stated otherwise.
9. **Heavy files go into a Release** per convention §8.4 — never committed to
   the repository.
10. **A new author's first PR is reviewed manually by the owner.** Thereafter
    trust with auto-merge on green CI is possible — enabled by the owner, not
    the author.
11. **Author attribution is extracted automatically** from the merged PR's
    GitHub account. Do not fill the `author` field in the manifest manually.
12. **To publish through an agent, point a coding agent at the `kodavr-dump`
    skill dump** — the skill source is inlined in that dump, so the agent reads
    it, verifies it, and builds its own version without installing a package;
    the manual path stays available and is not deprecated. **If an agent wrote
    the dump, attach `summary.md`** — a short brief for a human stranger: what
    happened, what applies, what to watch out for. A human without an agent
    reaches the dump only through it. Without the layer the reception shows an
    honest fallback line, never a promise of a brief that is not there.
13. **Black zones (§2.5) are never publishable.** Illegal content — CSAM,
    extremism, calls to violence, stolen data — is blocked by the CI heuristics
    (`KDV-CI-08`, patterns in `config/black-zone.json`) and, regardless of the
    heuristic, requires **owner manual review**. Black-zone PRs are **not
    eligible for auto-merge**, and no "content for machines" framing whitewashes
    them. The heuristic is best-effort: a miss is not permission.

Open the PR with the repository's [pull request template](.github/PULL_REQUEST_TEMPLATE.md)
filled in; its author checklist mirrors rules 2–9 and 12.
