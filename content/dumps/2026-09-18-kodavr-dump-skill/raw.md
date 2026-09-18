# Publish to Kodavr without learning the contract: the kodavr-dump skill

Publishing a dump on [Kodavr](https://kodavr.xyz) means satisfying a real contract: a schema-checked manifest, a secret scan, a one-dump-per-PR discipline, and an explicit human approval before anything leaves the machine. This dump ships the **source of the skill that automates that whole path** — `kodavr-dump` v0.4.0 for [opencode](https://opencode.ai) — inlined below so a reader's agent can install it in one pass. The human has a conversation and says yes; the skill drafts, validates, redacts and opens the pull request.

## Problem / context

The Kodavr registry is machine-first and raw by design: the author does not polish, the reader's agent adapts. That cheapness is on the author's side, but the *contract* is not free. To land one dump you must know the manifest fields and their enums, keep `stakes` and `content_flags` honest, avoid leaking secrets or personal data, ship `REDACTIONS.md` when the source was a conversation, and open exactly one pull request touched to exactly one directory. A human writer learns all of that or their PR is blocked; a naive agent without the contract improvises and ships something the validator rejects.

The friction is not the writing. It is the contract, and it is exactly the kind of deterministic work a skill can own. The idea of `kodavr-dump`: the human never reads the schema. They describe what is worth sharing, answer a couple of plain questions, and approve a proposal in their own language. The skill translates the jargon, assembles the files, runs Kodavr's own validator, and refuses to push without an explicit yes.

## What it is

A global opencode skill, versioned `0.4.0`, that owns the whole publication path:

- `SKILL.md` — the seven-step loop and the hard rules.
- `reference/` — `manifest.md` (every field, enum and constraint), `rules.md` (the CI gate, redactions, black/grey zones, heavy files), `submission.md` (repo discovery, validate, branch, push, PR fallback chain), `human-guide.md` (the plain-language explainer and jargon translation table).
- `templates/` — skeletons for `manifest.json`, `raw.md`, `summary.md`, `REDACTIONS.md`.
- `config.json` — repo URL, base branch and workdir defaults.
- `VERSION` / `CHANGELOG.md` — the version that travels with the installed copy.
- An optional `/dump` command (`command/dump.md`) — a deterministic entry point that forces the skill to load.

The skill is plain files with no dependencies; nothing is installed by a package manager.

## Why you would want it

Before: publishing meant reading `docs/SPEC.md`, `CONTRIBUTING.md` and the validator, then hand-writing a manifest and hoping the secret scan stays quiet. After: "we did something interesting, write it up as a dump" — and one unambiguous question at the end, *"Publish this? (yes / change something / cancel)"*.

The payoff for the reader's agent is the same: the skill encodes the contract as executable steps (run the repo's validator until `0 error(s)`), not as advice. It is mechanism, not plea. And the human surface is deliberately jargon-free — the schema terms never reach the person who is actually deciding.

## How it works — the seven-step loop

1. **Scope & consent** — pin down what is being shared and where it goes.
2. **Collect** — gather facts from the best available source (the human, the session, the repo, past sessions), keeping secrets out.
3. **Draft** — write `manifest.json`, `raw.md` and `summary.md` (`REDACTIONS.md` when the source was a conversation), inlining reusable non-binary sources as fenced sections instead of proliferating files.
4. **Validate** — run `node scripts/validate.mjs` until `0 error(s)`.
5. **Propose** — show a compact, plain-language proposal and **wait** for explicit approval.
6. **Submit** — fresh branch `dump/<slug>`, stage only `content/dumps/<slug>/`, one commit, push, open the PR (`gh` → GitHub API → plain compare URL).
7. **Report** — hand back the PR link and the residual risks.

Consent is explicit and per-submission; the skill never commits, pushes or opens anything before step 5's approval.

## Install — put the sources below where opencode looks

Each source section heading is the file's target path relative to your opencode config directory — `~/.config/opencode` on Linux/macOS, `%USERPROFILE%\.config\opencode` on Windows. Recreate that tree from the fenced sections in **Source** below:

| Section heading | Target |
|---|---|
| `skills/kodavr-dump/*` | `~/.config/opencode/skills/kodavr-dump/*` |
| `command/dump.md` | `~/.config/opencode/command/dump.md` (optional, recommended) |

If you already have this repository cloned, the tracked snapshot under `docs/skills/kodavr-dump/home/user/.config/opencode/` is the same tree (`home/user` is a placeholder for `$HOME`); copy it directly.

Windows PowerShell:

```powershell
$src = "docs\skills\kodavr-dump\home\user\.config\opencode"
$dst = "$env:USERPROFILE\.config\opencode"
New-Item -ItemType Directory -Force -Path "$dst\skills","$dst\command" | Out-Null
Copy-Item -LiteralPath "$src\skills\kodavr-dump" -Destination "$dst\skills" -Recurse -Force
Copy-Item -LiteralPath "$src\command\dump.md" -Destination "$dst\command\dump.md" -Force
```

Linux / macOS:

```bash
mkdir -p ~/.config/opencode/skills ~/.config/opencode/command
cp -r docs/skills/kodavr-dump/home/user/.config/opencode/skills/kodavr-dump ~/.config/opencode/skills/
cp docs/skills/kodavr-dump/home/user/.config/opencode/command/dump.md ~/.config/opencode/command/
```

Restart opencode afterwards. Requirements: `git` for the submission flow; optionally `gh` and/or a `GITHUB_TOKEN` to open the PR automatically, and Node.js to run the validator locally. The version travels with the copy (`VERSION` ships `0.4.0` here), so you can always tell which revision an installed copy runs.

## Source — kodavr-dump v0.4.0 (full payload)

### skills/kodavr-dump/SKILL.md

````
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
````

### skills/kodavr-dump/VERSION

````
0.4.0
````

### skills/kodavr-dump/CHANGELOG.md

````
# Changelog — kodavr-dump

Versioning: the `VERSION` file beside `SKILL.md` (MAJOR.MINOR.PATCH).

- **PATCH** — wording or fixes, no behavior change.
- **MINOR** — a new capability, backward compatible.
- **MAJOR** — a change that can surprise an existing user (breaking).

**On every change: bump `VERSION` and add an entry below. Keep the newest entry
on top.** The version travels with the installed copy, so any project can state
which revision it runs and be told when to update.

Maintainer: Krivich.

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
````

### skills/kodavr-dump/config.json

````
{
  "repo_url": "https://github.com/Krivich/kodavr.git",
  "base_branch": "main",
  "workdir": "~/.kodavr-dump/kodavr",
  "fork_on_no_push": true
}
````

### skills/kodavr-dump/reference/human-guide.md

````
# Human guide — talking to someone who does not know Kodavr

Use these words, not the schema's. Translate on the fly into the human's
language. You may quote this file (reworded to their language) when they seem
new or unsure. Never paste the specification at them.

## The one-breath explanation

> Kodavr is a public registry of "dumps" — raw field reports of experience that
> people share without polishing. A reader doesn't read a dump directly; their
> AI agent adapts it to them. We add yours to kodavr.xyz by opening a **pull
> request** — a proposal to add something to the site. When it's merged, it's
> live. You don't have to write or format anything; I do that part.

## What the human actually has to do

Almost nothing. You (the agent) draft everything. The human:

1. Says what experience to share (or asks you to find it).
2. Answers a couple of plain questions (sensitive? money/health/law? language?).
3. Reads your proposal and says **yes / change something / cancel**.

They never need to know git, branches, slugs, manifests or CI — you handle it.

## What happens after "yes"

1. You create one small folder with a few files.
2. You run Kodavr's own checker and fix anything red.
3. You push a branch and open a pull request ("please add this").
4. GitHub runs automated checks; a bad proposal cannot merge.
5. The site owner reviews (always for a first-time author, then possibly
   auto-merge on green).
6. Merge = published. The author's GitHub account is credited automatically.

No account to create, no database, no server.

## Glossary — say the left column, not the right

| Human words | Kodavr / git term |
|---|---|
| the write-up | `raw.md` |
| a short friendly brief for people | `summary.md` |
| the info card / labels | `manifest.json` |
| the short name of the package | `slug` |
| a short note / a full case / a reusable package | `type: note \| case \| pack` |
| how sensitive / risky it is | `stakes` |
| machine warnings (contains code, opinion, medical, …) | `content_flags` |
| how trustworthy / how tested | `trust_level` |
| who wrote it (me, you, or both) | `generated_by` |
| whether you reviewed it | `human_review` |
| the list of things removed for privacy | `REDACTIONS.md` |
| pull request (GitHub) / merge request (GitLab) | PR / MR |
| the main line of the project | `main` / base branch |

## Plain answers to the awkward questions

- **Will my name be on it?** Your GitHub handle is credited automatically; no
  real name, email or phone goes into the dump.
- **What if I regret it later?** It can be withdrawn — the dump gets a
  `withdrawn` status and its body is replaced with a short note saying why. The
  URL stays stable.
- **Does it have to be polished?** No. Raw is the point; the reader's agent does
  the adapting.
- **I want to share something from my work.** Fine — but use made-up examples,
  describe the real risk honestly, and never publish secrets or personal data.
- **What about money / health / legal / security?** That counts as high
  sensitivity: it's allowed, but we add a machine warning and an explicit
  disclaimer that readers' agents must honor.
- **Why do you also want a short brief?** People who don't have an AI agent
  reach a dump only through that brief — it's the one page written for a human.
- **Why tell you how "sensitive" it is?** So other people's agents can warn
  their users or refuse to apply it. Honesty here protects everyone; hiding risk
  is grounds for withdrawal.
- **Do I need a GitHub account?** To open the pull request under your name, yes
  (a free one). If you'd rather not, the owner can help or you can use mine if
  you authorize it.
````

### skills/kodavr-dump/reference/manifest.md

````
# Manifest reference — `content/dumps/<slug>/manifest.json`

Authoritative source: `docs/SPEC.md` §4.1 and `scripts/validate.mjs` in the
Kodavr repo. This file mirrors the rules so the skill works without the repo
present; the repo validator is still the gate.

## Required fields

| field | type | rules |
|---|---|---|
| `slug` | string | `^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*$`; MUST equal the directory name; globally unique |
| `type` | enum | `note` \| `case` \| `pack` |
| `title` | string | non-empty |
| `date` | string | `YYYY-MM-DD`, a real calendar date, not in the future |
| `domain` | enum | `engineering` \| `finance` \| `art` \| `law` \| `science` \| `education` \| `other` |
| `tags` | string[] | lowercase; `^[a-z0-9-]+$` |
| `stakes` | enum | `low` \| `medium` \| `high` |
| `content_flags` | string[] | may be `[]`; entries from the vocabulary below |
| `trust_level` | enum | `raw` \| `self-tested` \| `community-tested` \| `adapted` \| `library` |
| `generated_by` | enum | `human` \| `agent` \| `hybrid` |
| `human_review` | enum | `none` \| `minimal` \| `attested` |
| `summary` | string | 1–3 sentences; the **hook** a stranger sees in the feed — lead with why it matters, not a feature list (the validator counts sentence terminators) |

## Optional fields

| field | type | rules |
|---|---|---|
| `verification` | enum | `executable` \| `checkable` \| `subjective` |
| `status` | enum | `published` (default) \| `withdrawn`; `withdrawn` requires non-empty `withdrawal_reason` |
| `license` | string | default `CC-BY-4.0`; code in a dump is additionally MIT unless stated otherwise |
| `sources` | string[] | `chat-log` \| `source-code` \| `tests` \| `traces`; `chat-log` ⇒ `REDACTIONS.md` required |
| `layers` | object[] | if present: non-empty; each `{name,file,fact_checked,author_voice}`; MUST include `{name:"raw",file:"raw.md",...}` |
| `artifacts` | object[] | each `{kind, path_or_url, note?}`, kind ∈ `file` \| `release` \| `url`; `file` paths must resolve (dump dir or repo root) |
| `derived_from` | string \| null | a valid parent slug or `null` |
| `consumption_contract` | object | if present, `see` must be `/.well-known/kodavr.json` |
| `personal_data_justification` | string | allows personal data without `REDACTIONS.md` |
| `author` | object \| null | DO NOT set by hand — injected from the merged PR (`github`, `pr_url`, `merged_at`) |

## `content_flags` vocabulary (closed)

`unverified_claims`, `professional_advice`, `financial_advice`,
`medical_claims`, `rough_language`, `opinion`, `experimental`,
`contains_code`, `requires_expert_review`.

## Conditional rules

- `type: pack` ⇒ directory must contain `SETUP_AGENT.md`, `START_HERE.md`,
  `files/`, `checks/`.
- `stakes: high` ⇒ `content_flags` must be non-empty; the §7.9 disclaimer is
  inserted into the rendered body automatically.
- `sources` contains `chat-log` ⇒ `REDACTIONS.md` required in the dump dir.
- An agent-written dump (`generated_by: agent|hybrid`) ⇒ attach `summary.md`
  (CONTRIBUTING rule 12). Treat it as mandatory in practice.
- Personal data detected (emails, phones, document numbers) ⇒ `REDACTIONS.md`
  or `personal_data_justification`, otherwise BLOCK.

## Size / binary rules

- Each file ≤ 1 MB; whole dump ≤ 20 MB.
- Binaries only as `assets/*.png`, `assets/*.svg`, `assets/*.puml`.
- Anything heavier goes to a GitHub Release; manifest uses
  `artifacts[].kind = "release"` with URL
  `https://github.com/<owner>/kodavr/releases/download/dump-<slug>-v<N>/<file>`.

## Minimal valid example (agent-written case)

```json
{
  "slug": "2026-09-18-example-agent-workflow",
  "title": "A short, concrete title",
  "type": "case",
  "domain": "engineering",
  "date": "2026-09-18",
  "stakes": "low",
  "trust_level": "self-tested",
  "content_flags": ["contains_code"],
  "tags": ["open-code", "workflow", "automation"],
  "generated_by": "agent",
  "human_review": "attested",
  "verification": "checkable",
  "license": "CC-BY-4.0",
  "summary": "One to three sentences. What problem it solves, what the reader's agent can reuse.",
  "sources": ["chat-log", "source-code"],
  "layers": [
    { "name": "raw", "file": "raw.md", "fact_checked": false, "author_voice": true },
    { "name": "summary", "file": "summary.md", "fact_checked": false, "author_voice": true }
  ],
  "artifacts": [
    { "kind": "file", "path_or_url": "raw.md", "note": "the dump body" }
  ],
  "derived_from": null
}
```

(`sources: ["chat-log"]` in the example means `REDACTIONS.md` must ship too.)

## Markdown body notes

- Exactly one H1 in each markdown layer (duplicate H1 is a WARN).
- Internal links `](path)` must resolve relative to the dump dir or repo root;
  external `http(s)://`/`#` links are exempt. In-page `](#anchor)` targets must
  match a real heading (WARN otherwise).
- Fenced code blocks are fine; the secret/black-zone scan still reads them.
````

### skills/kodavr-dump/reference/rules.md

````
# Publication rules and CI gate

Authoritative sources: `CONTRIBUTING.md`, `docs/SPEC.md` §2, §7.7, §7.8,
§8.1, §8.4, and `scripts/validate.mjs`.

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
12. Agent-written dump ⇒ attach `summary.md` (brief for a human stranger).

## CI gate — what `node scripts/validate.mjs` checks

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
````

### skills/kodavr-dump/reference/submission.md

````
# Submission reference — repo, validate, push, PR

Goal: land exactly one dump directory in the Kodavr repo and open a PR, without
touching anything else and without leaking anything.

## Where the Kodavr repo is

Resolution order:

1. **Current project is already a Kodavr clone** — if the working directory has
   `content/dumps/` and `scripts/validate.mjs`, use it as the working copy.
2. **`KODAVR_REPO_DIR`** (env) — if set and it looks like a Kodavr clone, use it.
3. **A dedicated clone** — otherwise clone/update one:
   - Defaults come from `config.json` in this skill; env overrides:
     `KODAVR_REPO_URL`, `KODAVR_BASE_BRANCH`, `KODAVR_WORKDIR`.
   - Default workdir: `~/.kodavr-dump/kodavr` (`$HOME`; on Windows
     `%USERPROFILE%\.kodavr-dump\kodavr`).
   - If absent: `git clone <repo_url> <workdir>`.
   - Else: `git -C <workdir> fetch origin`.

Derive `<owner>/<repo>` from `git -C <workdir> remote get-url origin`.

## Prepare a clean branch

```
git -C <workdir> fetch origin <base>
git -C <workdir> checkout -B dump/<slug> origin/<base>
```

`dump/<slug>` is always created fresh off the base — never reuse a dirty branch.

## Place and validate

Copy the prepared dump into `<workdir>/content/dumps/<slug>/`, then run the
repo's own gate from the workdir:

```
node scripts/validate.mjs
```

- Must print `0 error(s), ...`. Every `ERROR` is a BLOCK — fix and re-run.
- Fix `WARN`s (duplicate H1, broken in-page anchors) when cheap.
- If `node` is unavailable: say so and require explicit consent before
  submitting unvalidated (CI still gates after the PR).

## Commit only the dump

```
git -C <workdir> add content/dumps/<slug>
git -C <workdir> status --short      # MUST list only content/dumps/<slug>/...
git -C <workdir> commit -m "dump: <title> (<slug>)"
```

Never `git add -A`: the tree may hold the human's untracked files. One commit,
one dump, one-line story.

## Push + open the PR — fallback chain

Try in order; stop at the first that works. Always get the human's approval
first (SKILL Step 5).

### A. `gh` CLI (preferred when installed and authed)

```
gh auth status
git -C <workdir> push -u origin dump/<slug>
gh pr create --repo <owner>/<repo> --base <base> --head dump/<slug> \
  --title "<title> [<slug>]" --body-file <pr-body-file>
```

### B. GitHub REST API (when `GH_TOKEN` or `GITHUB_TOKEN` is in the environment)

Push without persisting the token, then create the PR via API:

```
git -C <workdir> -c http.extraheader="AUTHORIZATION: bearer $GH_TOKEN" \
  push https://github.com/<owner>/<repo>.git dump/<slug>
curl -sS -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/<owner>/<repo>/pulls \
  -d @<pr-json-file>
```

`<pr-json-file>`: `{"title":"...","head":"dump/<slug>","base":"<base>","body":"..."}`.

PowerShell equivalent:

```
git -C <workdir> -c http.extraheader="AUTHORIZATION: bearer $env:GH_TOKEN" push https://github.com/<owner>/<repo>.git dump/<slug>
Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/<owner>/<repo>/pulls" -Headers @{ Authorization = "Bearer $env:GH_TOKEN"; Accept = "application/vnd.github+json" } -Body (Get-Content <pr-json-file> -Raw) -ContentType "application/json"
```

Never echo the token; never store it in git config or a file.

### C. Push + compare URL (no gh, no token)

```
git -C <workdir> push -u origin dump/<slug>
```

Then hand over the plain PR-creation link — do **not** build or URL-encode a
`title`/`body`:

```
https://github.com/<owner>/<repo>/compare/<base>...dump/<slug>?expand=1
```

GitHub loads `.github/PULL_REQUEST_TEMPLATE.md` into the body by itself, and the
`dump-manifest` workflow posts the manifest fields as a comment, so there is
nothing to fill by hand — the human just presses "Create pull request". (Long
pre-filled URLs are fragile: editors and terminals mangle the query string.)

If the push is rejected for lack of write access and `fork_on_no_push` is true,
fork first and push there:

- `gh repo fork <owner>/<repo> --clone=false --remote=false`, add `fork` remote, push to it; or
- `POST https://api.github.com/repos/<owner>/<repo>/forks`, then push to
  `https://github.com/<your-login>/<repo>.git`.
- Compare URL for a fork: `.../compare/<base>...<your-login>:dump/<slug>?expand=1`.

Tell the human the link; the template and the bot fill the rest.

## PR body

The template no longer duplicates the manifest: it is an instruction plus the
author checklist, and the repo's `dump-manifest` workflow posts the manifest
fields (type, domain, stakes, flags, trust, labels) as a comment straight from
`content/dumps/<slug>/manifest.json`. So the body you submit is the template
with the boxes ticked that are actually true:

- `gh` / REST: write it to a temp file and use `--body-file` / `-Body`.
- Compare link: nothing to fill — GitHub loads the template and the bot adds the
  fields; the human just presses "Create pull request".

Tick only the boxes that are true (leave `REDACTIONS.md` / Release / summary
unticked when they do not apply); the manifest stays the single source of the
field values.

## Safety checks before pushing

- Explicit human approval of the shown content.
- Only `content/dumps/<slug>/` is staged (`git status --short` verified).
- No secrets / real personal data in the diff.
- Token comes from the environment only; nothing persisted.
- If validation could not run locally, say so clearly.
- Leave the working copy clean; never delete the human's untracked files.
````

### skills/kodavr-dump/templates/manifest.json

````
{
  "slug": "YYYY-MM-DD-short-kebab-name",
  "title": "Concrete title of the experience",
  "type": "case",
  "domain": "engineering",
  "date": "YYYY-MM-DD",
  "stakes": "low",
  "trust_level": "self-tested",
  "content_flags": [],
  "tags": ["tag-one", "tag-two"],
  "generated_by": "agent",
  "human_review": "attested",
  "verification": "checkable",
  "license": "CC-BY-4.0",
  "summary": "One to three sentences: the problem, the reusable core, who benefits.",
  "sources": ["chat-log"],
  "layers": [
    { "name": "raw", "file": "raw.md", "fact_checked": false, "author_voice": true },
    { "name": "summary", "file": "summary.md", "fact_checked": false, "author_voice": true }
  ],
  "artifacts": [
    { "kind": "file", "path_or_url": "raw.md", "note": "the dump body" }
  ],
  "derived_from": null
}
````

### skills/kodavr-dump/templates/raw.md

````
# <Title — same as the manifest title>

One short paragraph: what this dump is and why it exists. Raw, no polishing.

## Problem / context

What we were trying to do, the constraints, the starting state.

## What we did

The decisions and the shape of the solution. Concrete names, commands, files.

## How to reproduce

Steps a stranger's agent can follow. Real commands, real paths, real versions.

## What worked / what didn't

Failures, dead ends, surprises. This is often the most valuable part.

## Artifacts

Links or repo-relative paths to the files a reader needs.
````

### skills/kodavr-dump/templates/summary.md

````
# <Title> — brief for a human stranger

<!-- Lead with WHY a stranger should care. A bad brief describes the artifact
     ("a skill that runs a loop"); a good one sells the outcome ("publishing
     used to need the schema and git; now it is one conversation and one yes"). -->

**What it is.** One short paragraph in plain words: what this is and what it lets
the reader do.

**Why you would want it.** The change for the reader — the pain it removes, the
before/after. This is the hook; if a stranger would not care, rewrite it.

**What to watch out for.** Limits, prerequisites, risks, and the honesty labels
(`generated_by`, `human_review`, `trust_level`).

*(This is the human door into the raw dump. The body stays machine-first.)*
````

### skills/kodavr-dump/templates/REDACTIONS.md

````
# Redactions — <slug>

Sources: chat-log / correspondence.

Every removed or replaced item, listed with enough context to know what kind of
thing it was, without leaking it.

| # | removed / replaced | reason | replacement |
|---|---|---|---|
| 1 | e.g. an API token in a code sample | secret | `<TOKEN>` |
| 2 | e.g. a colleague's email | personal data | `user@example.com` |
````

### command/dump.md

````
---
description: Publish something as a Kodavr dump — forces loading the kodavr-dump skill
---

Call the `skill` tool with the name `kodavr-dump` and follow it end to end. Do
NOT draft, edit files, or touch git before the skill is loaded — it owns the
whole path and will ask for approval before anything leaves the machine.

What to publish (may be empty — then ask the human what they want to share):

$ARGUMENTS
````

## What worked, what didn't

What worked: encoding the contract as steps the skill executes, not prose it hopes the model obeys — the validator is the gate, and the skill's own text stays a digest with pointers to `reference/`. Keeping the human surface jargon-free (a translation table in `human-guide.md`) means the person approving the dump never has to learn the schema. Versioning the skill (`VERSION` + `CHANGELOG.md`, bump on every edit) makes installed copies traceable.

What did not work, and cost the most time:

- **A `pack` dump with a `files/` tree was rejected by Kodavr's own validator.** The skill's `VERSION` file is extensionless, so it read as a binary (`KDV-CI-06 … binary allowed only as assets/*`), and a `SHA256SUMS` file of hex digests tripped the secret entropy scan (`KDV-CI-04 … long high-entropy string`). The fix was to publish as a `case` whose body inlines the payload as fenced code sections — which is exactly what this dump does.
- **Naming the black-zone categories in the skill made the skill un-publishable on its own platform.** The validator's black-zone heuristic reads fenced code, and the rule text tripped it (`KDV-CI-08`). The fix: the rule points at `config/black-zone.json` instead of naming its tokens; semantics unchanged.
- **The first `summary` drafts described the artifact, not the outcome.** "An opencode skill that runs a seven-step loop" is not a hook; "publishing used to need the schema and git, now it is one conversation and one yes" is. The skill now carries a summary-writing contract so its own outputs lead with the change for the reader.

## Artifacts

The inlined payload above is the installable copy. The same tree is tracked in this repository (with `SHA256SUMS` and a machine-readable install map) at:

- [docs/skills/kodavr-dump/INSTALL.md](/docs/skills/kodavr-dump/INSTALL.md) — human install instructions and the bundle layout.
- [docs/skills/kodavr-dump/install.json](/docs/skills/kodavr-dump/install.json) — the same source-to-destination map as a machine-readable contract.
- [docs/skills/kodavr-dump/home/user/.config/opencode/skills/kodavr-dump/SKILL.md](/docs/skills/kodavr-dump/home/user/.config/opencode/skills/kodavr-dump/SKILL.md) — the skill root as tracked in the repo.
- [docs/skills/kodavr-dump/home/user/.config/opencode/skills/kodavr-dump/VERSION](/docs/skills/kodavr-dump/home/user/.config/opencode/skills/kodavr-dump/VERSION) — the version the snapshot carries.
- [docs/skills/kodavr-dump/home/user/.config/opencode/command/dump.md](/docs/skills/kodavr-dump/home/user/.config/opencode/command/dump.md) — the optional `/dump` command.
