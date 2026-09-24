# Changelog — kodavr-dump

Versioning: the `VERSION` file beside `SKILL.md` (MAJOR.MINOR.PATCH).

- **PATCH** — wording or fixes, no behavior change.
- **MINOR** — a new capability, backward compatible.
- **MAJOR** — a change that can surprise an existing user (breaking).

**On every change: bump `VERSION` and add an entry below. Keep the newest entry
on top.** The version travels with the installed copy, so any project can state
which revision it runs and be told when to update.

Maintainer: Krivich.

## 0.4.1 — 2026-09-24

- Summary rule (`SKILL.md` Step 3, `reference/manifest.md`,
  `templates/manifest.json`): `manifest.summary` is the feed line AND the social
  snippet — essence in plain words (before/after, the problem or change) plus
  what the reader’s agent can take (code, format, schema, protocol). The
  platform appends the agent-prompt tail for og/meta
  (`summary + " And a prompt to make your agent explain it to you."`), so never
  stuff that tail in yourself — plus a falsifiability rule (no unevidenced
  universal claims).
- Enforced: agent/hybrid dumps MUST ship `summary.md` — the Kodavr validator
  BLOCKs without it (`KDV-MANIFEST-12`); said plainly in the `SKILL.md` hard
  rules, `reference/rules.md` and `reference/manifest.md`.
- Fix the stale validator path everywhere — the gate now lives in the tooling
  tree: `node scripts/tooling/quality-gates/validate.mjs`.
- PATCH: wording/rule alignment plus a path fix; no change to the dump workflow.

## 0.4.0 — 2026-09-18

- Submission (`SKILL.md` Step 6, `reference/submission.md`): stop duplicating the
  manifest in the PR. Hand over the plain compare URL — no URL-encoded
  `title`/`body`, which get mangled in editors and terminals. GitHub loads the PR
  template by itself, and the repo's `dump-manifest` workflow posts the manifest
  fields as a comment, so the human just presses "Create pull request".
- MINOR: submission capability change, backward compatible (the field values now
  live in one place — the manifest — instead of being retyped into the PR).

## 0.3.0 — 2026-09-18

- Add a **summary-writing contract** (`SKILL.md` Step 3, `templates/summary.md`,
  `reference/manifest.md`): both the manifest `summary` and the `summary.md`
  brief must open with why a stranger should care — the outcome and the pain
  removed, not a feature list. Without it the skill produced feature-dumps
  ("a skill that runs a loop") instead of hooks ("publishing used to need the
  schema and git; now it is one conversation and one yes").
- Reword the black-zone rule in `SKILL.md` and `reference/rules.md` to
  point at the §2.5 category list in `config/black-zone.json` instead of naming
  its tokens. Naming them made the skill un-publishable on its own platform: the
  dump validator's black-zone heuristic reads fenced code and flagged the rule
  text (`KDV-CI-08`). Semantics unchanged — the rule still forbids the same
  content and still defers to owner review.
- Add drafting guidance (`SKILL.md` Step 3, `reference/rules.md`): keep the dump
  to the files the schema needs and inline non-binary sources as fenced code
  sections in `raw.md` instead of shipping loose files — extensionless files read
  as binaries (`KDV-CI-06`) and checksum files trip the secret scan (`KDV-CI-04`).
- Drop a redundant `# bash` marker inside a code fence in
  `reference/submission.md` (the validator's markdown lint read it as a stray
  top-level heading).
- MINOR: the summary-writing contract is a new drafting capability (backward
  compatible); the rest are fixes.

## 0.2.1 — 2026-09-18

- Add an explicit negative trigger gate so the broadened "publish / share"
  match never hijacks ordinary software work: commits, pushes, code
  pull/merge requests, branches, tags, releases, and publishing packages
  (npm/PyPI/crates). Ambiguous intent → ask one plain question first.
- Add a "wrong trigger" bail-out in the body: if the skill was loaded for a
  routine git/package task, stop and do the task normally instead of creating
  a dump.
- PATCH: wording/discoverability fix, no change to the dump workflow.

## 0.2.0 — 2026-09-18

- Anchor the trigger on the word Kodavr itself (kodavr.xyz, any language or
  spelling): a request to put/publish/share something there fires even when the
  human never says "dump". Also covers publishing the agent's OWN artifacts
  (a skill, plugin, script, package), not only prose experience, and says to
  load the skill before any manual drafting or git work.
- Add the `/dump` command as a deterministic entry point that forces loading this
  skill (a natural-language request should match on its own; the command is the
  guaranteed path).
- MINOR: a change in discoverability/behavior, backward compatible.

## 0.1.0 — 2026-09-18

- First version. Flow: scope → collect → draft → local validate → human-first
  proposal → explicit approval → one-dump PR.
- Reference files: `reference/manifest.md` (field rules), `reference/rules.md`
  (CI gate, redactions, zones), `reference/submission.md` (repo/validate/push/PR
  fallback chain), `reference/human-guide.md` (plain-language explainer).
- Human-first: jargon is translated, the proposal is plain, technical detail on
  request only.
