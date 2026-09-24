# Feedback: the skill as a means, not an end — rebuilding /contribute/ and the skill dump (PR-plan #2)

**Status:** public record — the requirement source for the contribute-lane/skill-dump batch (sanitized English version of an owner-private document; the private original stays out of git).

## Where the project is now

PR-plan #1 is in place: snippets sell the pattern, the brief is presented as a demo, the gate explains the choice. The `/contribute/` page still describes **only the manual path** ("Bring a dump" → fork → PR → CI) and does not mention the skill. The entry point for authors is still on the old model.

## Key shift

**Old model:** install the skill (a separate step) → publish a dump.
**New model:** ask your agent to study the dump about the skill and help you publish — in one step. The skill is infrastructure on the path, not the goal.

**The clarification that changes the visual:** publishing is a job for a **coding agent** (create files, run the validator, open a PR), not for a web chat. Therefore `/contribute/` **must not** reuse the standard `agent-lane` with its four chat buttons — they lead into chats that cannot publish. This needs its own lane variant: **a prompt + one copy button + a hint about coding agents**.

**The word "install" is forbidden** in all new copy about skills. Semantic replacements: "study it and build your own version", "read the source and adapt it", "a guideline for building it yourself". A dump is not a binary package but a readable source that the agent reads, verifies, and reproduces.
(ru: Замены по смыслу: «изучи и собери свою версию», «прочитай исходник и адаптируй», «гайдлайн по самостоятельной сборке».)

---

## Changes

### 01 · New "contribute lane" on `/contribute/`

**Where:** in the `02 · flow` tile, as the first element — before the manual path.

**Visual** (in design-system terms; the agent will ground it in markup):
- This is **not** the standard `.agent-lane` with a row of four links. It is a separate variant: one primary copy button with the prompt under it. Visually it should read as "one primary path", not "a choice of services".
- **Lead** — the same role as `.agent-lane-lead` (bold, proportional, `.95rem`).
- **Copy button** — the only control. Since it is alone and it is the main action, style it visually as the primary action (in the spirit of the stamped `.cta` button, or like `.copy-prompt` but more prominent than the fallback chip in the row). ≥44px.
- **Prompt** below the button — roles `.article-prompt` / `.home-prompt` (monospace, muted, left rule, smaller than prose, like a quick reference).
- **Hint** under the prompt — role `.agent-lane-hint` (muted, small, prose).
- **Secondary control** (optional, if there is room): a plain text link to the skill dump page — "look at the skill source first". Secondary in prominence.
  (ru: «сначала посмотреть исходник скилла»)

**Copy:**
- Lead: `Point your coding agent at the skill — it will read the source, build its own version, and walk you through publishing:`
  (ru: `Направьте кодинг-агента на скилл — он прочитает исходник, соберёт свою версию и проведёт вас через публикацию:`)
- Prompt:
  ```
  Study https://kodavr.xyz/dumps/2026-09-18-kodavr-dump-skill/manifest.json and follow its schema. Read the skill source, build your own version for your agent, and help me publish my next dump to Kodavr.
  ```
- Hint: `(paste this prompt into a coding agent — OpenCode, Claude Code, Cursor, Codex — not a web chat: publishing means creating files, running the validator, and opening a PR, which a chat cannot do)`
  (ru: `(вставьте промпт в кодинг-агента — OpenCode, Claude Code, Cursor, Codex — а не в веб-чат: публикация это создать файлы, прогнать валидатор и открыть PR, чего чат не умеет)`)
- Button: `Copy prompt` / state `Copied ✓`.
  (ru: `Скопировать промпт` / состояние `Скопировано ✓`.)

**Specification:** describe the contribute lane as a **new lane variant** (not as a third surface under §7.12). §7.12 stays for reading surfaces (home, dumps, machine panel). The contribute prompt is the third in order, after §7.4 (universal) and §7.11 (dump).

---

### 02 · Visual link between the button and the prompt

**Visual:** on hover/focus of the copy button, the prompt highlights — the left rule (on `.article-prompt`/`.home-prompt` it is `border-left`) becomes accent (`--accent`). This way the eye connects "this button copies this". The same solution can be applied to standard lanes, but on the contribute page it matters most, because there is only one button.

---

### 03 · Manual path — secondary

**Visual:** the same step list (role `.steps` or `.checklist`, as now), but under a new heading.

**Copy (heading):** `Manual path (if you prefer)`
(ru: `Ручной путь (если предпочитаете)`)
The three steps (study the schema → write the dump → open a PR) stay unchanged. It is not deprecated; it just stops being the only one.

---

### 04 · Skill dump: rewrite the copy

**Where:** `content/dumps/2026-09-18-kodavr-dump-skill/`.

**`manifest.summary`** — remove "install", focus on the goal:
> You want to share what you built, not learn a schema first. This dump contains the full source of the kodavr-dump skill — ask your agent to study it, and it will help you publish your next dump in one conversation. The skill drafts the dump, runs Kodavr's validator, and opens the PR only after you say yes.

**`summary.md` (the brief)** — new structure (the brief's visual already exists; only the copy changes):
- **What this lets you do** — publish a dump without studying the schema; the agent studies this dump, builds its own version of the skill, and walks you through publishing in a single conversation.
- **How your agent uses this** — reads the source inline (not a package), understands the pattern, builds a version for its own environment, helps you publish.
- **The part that makes it work** — the source is inline, so the agent can verify and adapt it; it is "study and build", not "install from a registry"; the dump is a guideline for building it yourself, not a closed artifact.
  (ru: это «изучи и собери», а не «установи из реестра»)
- **Watch out for** — the skill is written for OpenCode; for other frameworks the agent will have to adapt the invocation; the skill runs the validator locally, so it needs an environment with Node.js.

**`raw.md`** — replace all `install` / `installation` / `installed` by meaning ("study and build your own version", "building", "preparation for the agent"), except where real package managers are meant.
(ru: по смыслу («изучи и собери свою версию», «сборка», «подготовка для агента»), кроме случаев, где речь о реальных пакетных менеджерах.)

---

### 05 · Skill dump tags

**Was:** `["kodavr", "opencode", "skill", "publishing", "automation", "workflow"]`
**Now** (goal before means; `contribute` and `agent-assisted` added):
```json
["kodavr", "publishing", "contribute", "agent-assisted", "automation", "opencode", "skill", "workflow"]
```
A person/agent searching "how to publish a dump" finds it by the goal, not by the means.

---

### 06 · `og:description` of the skill dump

Generated from the new `summary` (if the generator from PR-plan #1 is already implemented, it happens automatically). Otherwise update it manually. New text:
> You want to share what you built, not learn a schema first. Ask your agent to study this dump, and it will help you publish your next dump in one conversation.

---

### 07 · SPEC.md: formalization

- **§7.7, rule 12** (agent publishing): if the author wants to publish through an agent, they point a coding agent at the `kodavr-dump` dump; the skill source is inline in that dump, so the agent reads, verifies, and builds its own version without installing a package. The manual path stays available and is not deprecated.
- **§7.12:** note that `/contribute/` uses a **contribute variant of the lane** (prompt + copy, no chat links), because publishing is a coding agent's job.
- **New item about the contribute prompt** (call it §7.16): the prompt points at the skill dump's manifest and the publishing task, follows the §7.11 pattern ("`Study <manifest-url> and follow its schema.` + task").
  (ru: следует паттерну §7.11 («`Study <manifest-url> and follow its schema.` + задача»))

---

### 08 · Cross-cut: remove "install" about skills

Sweep `content/`, `README.md`, `CONTRIBUTING.md`, `docs/SPEC.md`. Change only where **skills/dumps** are meant (not real package managers like `npm install` in engine build instructions). Principle: "install a package" → "study and build your own version"; "installable package" → "a design the agent reads and reproduces".
(ru: Принцип: «установить пакет» → «изучить и собрать свою версию»; «устанавливаемый пакет» → «дизайн, который агент читает и воспроизводит».)

---

## Summary table

| # | What | Where | Complexity |
|---|---|---|---|
| 01 | Contribute lane (copy button + prompt + hint) | `02 · flow` tile on `/contribute/` | Medium |
| 02 | Highlight the prompt on hover/focus of the copy button | `/contribute/` | Easy |
| 03 | Manual path secondary, new heading | `02 · flow` tile | Easy |
| 04 | Rewrite summary / brief / raw of the skill dump, remove "install" | `content/dumps/2026-09-18-kodavr-dump-skill/` | Medium |
| 05 | Skill dump tags | skill manifest | Easy |
| 06 | `og:description` of the skill dump | controller / manifest | Easy |
| 07 | Rule 12 §7.7 + contribute lane in §7.12 + contribute prompt | `docs/SPEC.md` | Easy |
| 08 | Cross-cut "install" about skills | all text files | Medium |

**Total:** 8 changes. None of them breaks the machine directives (indexes, manifests, gate, BIOS, reading prompts). Everything is in the human loop and the copy.

---

## What NOT to change

- **The standard `agent-lane` with four chat buttons** — stays on **reading** surfaces (home `01 · HUMANS`, dumps `02 · INTERESTING?`, machine panel). Chats fit there: reading is a chat's job.
- **The manifest schema (§4.1)** and **`type=pack` (§4.3)** — the skill dump stays `type=case`; it does not become a pack.
- **Gate, brief, snippets, prompts §7.4/§7.11** — shipped in PR-plan #1; do not touch.
- **Machine endpoints** (`index.json`, `.well-known`, manifests) — only the skill dump's content.

---

**Main meaning for the implementing agent:** on `/contribute/` there is now **one** primary path — "copy the prompt, hand it to a coding agent". No four chat buttons. Visually it reads as one primary action, not a choice of service. The skill is mentioned as the source the agent learns from, while the goal is publishing experience.
