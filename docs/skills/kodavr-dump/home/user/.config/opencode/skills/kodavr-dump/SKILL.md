---
name: kodavr-dump
description: Use this FIRST whenever the human mentions Kodavr (kodavr.xyz, in any language or spelling) and wants to put something there — share experience, publish a tool / skill / plugin / package / config, save a write-up — whether or not they say the word "dump". Also when they say "write this up as a dump", "publish this as a dump", "open a dump PR/MR", "share gears". It covers publishing the agent's OWN artifacts (skills, plugins, scripts), not only prose experience. Load this skill before drafting, editing files, or touching git — it owns the whole path (scope, collect, draft manifest.json + raw.md + summary.md + REDACTIONS.md when needed, run the repo's own validator, plain-language proposal, explicit approval, one-dump PR). Use ONLY to submit or share experience as a Kodavr dump. Do NOT use for ordinary software work — commits, pushes, code pull/merge requests, branches, tags, releases, or publishing packages (npm/PyPI/crates); that is normal engineering, not experience-sharing. Not for editing the Kodavr platform's own code. If intent is ambiguous between sharing experience and a routine git/package action, ask one plain question first.
---

# Kodavr dump — from "we did something interesting" to a merged-ready PR

Kodavr (https://kodavr.xyz) is a registry of **raw experience dumps**. A dump is a
field report: the author does not polish it, the reader's agent adapts it. The
publication contract lives in the repo (`CONTRIBUTING.md`, `docs/SPEC.md`,
`scripts/validate.mjs`). This skill turns a conversation into a valid dump PR.

**One dump = one PR = one directory `content/dumps/<slug>/`.** Never bundle
unrelated edits.

The rules are enforced by the repo's own validator, not by wording — `node
scripts/validate.mjs` is the source of truth. This skill's job is to produce
something that passes it and then submit it cleanly.

## If this was the wrong trigger

This skill is for sharing experience as a Kodavr dump — nothing else. If it was
loaded for a routine software task (a commit, push, branch, tag, release, a code
pull/merge request, or publishing a package to npm/PyPI/crates), stop: those are
normal engineering, not a dump. Do the task normally; do not create a dump and
do not touch the Kodavr repo.

## Talk human first

Assume the human does **not** know Kodavr's theory and may not know what a
pull request is. They are not here to learn your vocabulary — the skill is here
so they don't have to. Concretely:

- If they seem new, give the one-breath explanation ("what a dump is, what
  happens after yes") from `reference/human-guide.md` before asking anything.
- Use plain words. Do not say "manifest", "slug", "stakes", "content_flags" to
  the human — say "the info card", "the short name", "how sensitive it is",
  "machine warnings". The translation table is in `reference/human-guide.md`.
- Ask plain questions with concrete options, and pick sensible defaults
  yourself; let the human accept with a simple "yes".
- Never make the human do git, branches, or files. You handle that.
- Offer to explain anything, any time. Never paste the spec at them.

## Core loop

1. **Scope & consent** — pin down WHAT experience is being shared and WHERE it goes.
2. **Collect** — gather facts from the best available source.
3. **Draft** — write the dump files.
4. **Validate** — run the repo's real validator until green.
5. **Propose** — show the human a compact proposal; WAIT for explicit approval.
6. **Submit** — branch, commit only the dump, push, open the PR.
7. **Report** — hand back the PR (or compare) URL and the residual risks.

Never push, commit, or open anything before step 5's approval. Consent is
explicit and per-submission (AGENTS rule "act only with explicit consent").

## Step 1 — Scope & consent

The human's message is the seed, but it is usually underspecified. Establish:

- **Subject** — what exactly is worth sharing. If the human said "we did
  something interesting", ask (or infer from context and state your inference):
  which thing, which project, which sessions, which artifacts.
- **Audience/angle** — what a stranger's agent should be able to reuse.
- **Language** — write `raw.md`/`summary.md` in the language the human used,
  unless they say otherwise.
- **Target** — the Kodavr repo and base branch (defaults in `config.json`;
  detect a local clone first, see `reference/submission.md`).

If the intent is clear enough, state your interpretation and proceed to draft —
do not interrogate. Ask only when a wrong guess would waste the batch or leak
something. Ask in plain language ("Is any of this sensitive — money, health,
legal, security?"), never by field name; if the human seems new to Kodavr, open
with the one-breath explanation from `reference/human-guide.md`.

## Step 2 — Collect (be adaptive about sources)

Portability matters: not every session has the same tools. Use what exists, in
this order, and tell the human which source you used:

1. **The human's own description** (highest signal) — they told you what is
   interesting; treat that as the spine.
2. **The current session** — you already hold it; summarise the decisions,
   failures, and the final shape.
3. **The project on disk** — `git log`/`git diff`, README/docs, key files,
   tests, configs. Great when the dump is about a repo, not a chat.
4. **Past sessions** — if a history/session-search tool is available (e.g. the
   `history-search` tool), search it for the relevant threads. If it is not
   available, say so and fall back to the above; never invent session content.
5. **The human** — ask for anything missing (a link, a file, a number).

Collect **artifacts** explicitly: which files/snippets/URLs a reader needs. Keep
secrets and personal data OUT while collecting — see `reference/rules.md`.

## Step 3 — Draft

Create the dump directory and files. Use `templates/` as skeletons and
`reference/manifest.md` for the exact field rules.

Minimum for an agent-written dump:

- `manifest.json` — required, schema §4.1 (see `reference/manifest.md`).
- `raw.md` — the body. Machine-first and raw: problem → what was done → how to
  reproduce → what failed → artifacts. One H1. Real commands, real names.
- `summary.md` — REQUIRED when `generated_by` is `agent` or `hybrid`: a short
  brief for a human stranger (what happened, what applies, what to watch out
  for). The raw body stays raw; this is the human door.
- `REDACTIONS.md` — REQUIRED if `sources` includes `chat-log` (any dump derived
  from a conversation) or if personal data is present. List every removed or
  replaced item.

**Do not proliferate files — inline them.** When the reusable artifact is a set
of non-binary files (markdown, code, JSON, config), put their contents in `raw.md`
as fenced code sections, one labeled section per file, target path in the
heading — not as loose files in the dump directory. Loose extensionless files
(for example a `VERSION`) are read as binaries and rejected (`KDV-CI-06 … binary
allowed only as assets/*`), and a checksum file of hex digests trips the secret
entropy scan (`KDV-CI-04 … long high-entropy string`). Fenced code is legal,
readable, and reviewable; ship resources only when they are genuine assets.

### Writing the summary — it is the door, not a label

Two summaries ship, and both must answer a stranger's first question: *why would
I want to read this?* Lead with the change the reader gets; never just list
fields or features.

- **`manifest.summary`** (the feed line, 1–3 sentences): sentence one is the
  hook — the before/after, the pain removed, the surprising result. Then say what
  it is and what the reader can do with it. Plain, concrete, honest. If a
  stranger would not click it, rewrite it.
- **`summary.md`** (the human door): **What it is** (one short paragraph in plain
  words), **Why you would want it** (the benefit for the reader, not the feature
  list), **What to watch out for** (limits, prerequisites, risks, honesty labels).
  Keep it short; the raw body stays raw.

A bad summary describes the artifact ("an opencode skill that runs a seven-step
loop"). A good one sells the outcome ("publishing used to need the schema and
git; now it is one conversation and one yes"). Adapt the tone to the human, but
never oversell — `stakes` and `content_flags` still have to say the truth.

Manifest field guidance:

- `slug`: `<YYYY-MM-DD>-<short-kebab>` (ASCII, lowercase). Must equal the dir name.
- `date`: the date the experience is about; never in the future.
- `type`: `note` | `case` | `pack`. `pack` additionally needs
  `SETUP_AGENT.md`, `START_HERE.md`, `files/`, `checks/`.
- `stakes`: be honest (`low`/`medium`/`high`). `high` requires non-empty
  `content_flags` and gets the §7.9 disclaimer auto-inserted.
- `content_flags`: from the closed vocabulary; may be `[]`.
- `generated_by`: `agent` or `hybrid` (honest). `human_review`: `none` |
  `minimal` | `attested` — set `attested` only if the human actually reviewed
  the dump body, not merely the proposal.
- `trust_level`: `self-tested` if it demonstrably worked, else `raw`.
- `sources`: if you used the chat, include `chat-log` (triggers REDACTIONS.md).
- `artifacts`: repo-relative `file` paths MUST resolve (inside the dump dir or
  at repo root); `release` for heavy files (never commit > 1 MB or binaries);
  `url` for the rest.
- Do **not** fill `author` — it is injected at build time from the merged PR.

## Step 4 — Validate locally

In a working copy of the Kodavr repo (see `reference/submission.md`), place the
dump under `content/dumps/<slug>/`, then run:

```
node scripts/validate.mjs
```

Fix every `ERROR` (they are BLOCK). Re-run until `0 error(s)`. `WARN`s (duplicate
H1, broken in-page anchors) should be fixed when cheap. If `node` is unavailable,
say so and get explicit consent before submitting unvalidated — CI will gate.

Also run the secret/personal-data checks mentally and via the validator; a
blocked PR is a failed batch.

## Step 5 — Show it, explain it, get a plain "yes"

Before anything leaves the machine, show the human a short proposal **in their
language and plain words**, then stop and wait for an explicit yes. Lead with
meaning; keep technical details out unless they ask.

```
DUMP PROPOSAL

What we'll publish
  <2–4 sentences, no jargon: the experience, and why a stranger would want it.>

New to Kodavr? (include only if they seem new)
  A dump is a raw field report — you don't polish it, the reader's AI agent
  adapts it. It goes to kodavr.xyz by opening a pull request (a proposal to add
  something to the site). Merge = published; first PRs get a human review.

What happens after you say yes
  I assemble one small set of files, run Kodavr's own checks, and open the pull
  request. Nothing becomes public until it is merged.

The choices I made — tell me to change any of them
  • Language: <...> (I matched yours)
  • Title: <...>
  • Format: a short note / a full case / a reusable package — I suggest <...>
  • Field and machine topics: <domain> / <tags>
  • How sensitive: <low/medium/high> — <plain reason>. High = money, health,
    law or security; then we add a warning that readers' agents must honor.
  • Honesty labels: written by <me / you / both>; you reviewed it: <...>
  • Included: the write-up, a short human-friendly brief[, and a list of what
    we removed for privacy]

Privacy and safety
  <found no secrets or personal data / removed X and listed it>

Checks
  Kodavr's validator: <N errors, M warnings>   [or: couldn't run it locally —
  the site's checks will gate it after the pull request]
```

Then ask one plain question: **"Publish this? (yes / change something / cancel)"**

Rules:

- If the human looks new or unsure, offer the one-breath explanation (or explain
  any line in plain words) from `reference/human-guide.md`; never paste the schema.
- Technical detail (short name, branch, info-card fields) is available on
  request — do not push it.
- If the human changes anything substantive, show the updated proposal again
  before proceeding.
- Proceed only on an explicit yes to *this* content; "looks fine" is not a yes
  if the content changed since they saw it.

## Step 6 — Submit

Follow `reference/submission.md` exactly. In short:

1. Refresh the working copy and create a fresh branch `dump/<slug>` off the base.
2. Ensure ONLY `content/dumps/<slug>/` is added (`git add content/dumps/<slug>`).
3. Commit: `dump: <title> (<slug>)` — one line, one dump.
4. Push the branch.
5. Open the PR, via the fallback chain: `gh` if available → GitHub REST API if a
   token is in the environment → otherwise hand over the plain compare URL
   (`.../compare/<base>...dump/<slug>?expand=1`). Do NOT build or URL-encode a
   `title`/`body` — long pre-filled links get mangled in editors and terminals,
   and the repo does the rest: GitHub loads the PR template, and the
   `dump-manifest` workflow posts the manifest fields as a comment. The human
   just presses "Create pull request". Recipe: `reference/submission.md`.

Never commit other people's untracked files. Never touch files outside the dump
dir. Never echo or persist tokens.

## Step 7 — Report

Tell the human, in plain words: what was submitted, the link to the pull
request (or the "create PR" link), what happens next (checks run, owner
reviews, merge = live), and anything they should know ("I couldn't run the
local checks", "the brief lists what we removed for privacy"). Mention the
files only if useful. Leave the working copy clean.

## Hard rules (never)

- No secrets (tokens, keys, passwords, credentials), ever.
- No real personal/financial data — synthetic examples only; when unavoidable,
  `REDACTIONS.md` or `personal_data_justification` in the manifest.
- No black-zone content (the §2.5 categories in `config/black-zone.json`) —
  the heuristic blocks it and owner review decides; a miss is not permission.
- No underestimating `stakes`/`content_flags`.
- No papering over an agent-written dump by dropping `summary.md`.
- No push/PR without explicit human approval of the shown content.

## Version

This skill is versioned by the `VERSION` file beside this `SKILL.md`; its
history and the bump rules are in `CHANGELOG.md`.

- When a submission is done, name the version (e.g. `kodavr-dump v0.1.0`) so the
  human can tell which copy ran.
- On ANY change to this skill, bump `VERSION` and add a `CHANGELOG.md` entry.
  Never edit without bumping. PATCH = wording/fix; MINOR = new capability;
  MAJOR = a change that can surprise an existing user.

## References

- `reference/human-guide.md` — what a dump is, what happens after "yes", and a
  plain-words glossary. Quote from it when talking to the human.
- `reference/manifest.md` — every manifest field, enums, constraints, examples.
- `reference/rules.md` — CI checks, redactions, black/grey zones, heavy files.
- `reference/submission.md` — repo discovery, clone/validate/branch/push/PR chain.
- `templates/` — skeletons for `manifest.json`, `raw.md`, `summary.md`,
  `REDACTIONS.md`.
- `config.json` — defaults for repo URL, base branch, workdir.
