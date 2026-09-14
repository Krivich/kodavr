# context-machine — how the context machine works

> Read this if you need to understand **why** the context is built this way: compaction,
> delegation, the `STATE.md` diet, the cost of startup. The canon of the logic is the plugins
> `~/.config/opencode/plugins/` (and `templates/delegation-mode.md`); this file is their
> compact model and motivation, not a copy.

## 1. Budget and start layers

- A model's real limit may be large, but `opencode.jsonc` holds an **effective cap**
  (e.g. 250k): quality/latency/price degrade around 200–250k.
  `compaction { auto, reserved, preserve_recent_tokens }` carries the last ~30k tokens of the
  conversation through compaction **verbatim** (the tail of the task).
- The start of an agent/delegate = base system prompt + compact summary + **`AGENTS.md`** (digest).
  That is expensive — so `AGENTS.md` is a digest, not a dump.
- Read on demand: `AGENTS/*`, `REQUIREMENTS.md`, `STATE.md`, `docs/*`.
  Hence the rule: **what loads at start does not grow**.

## 2. Compaction (context-sentinel) — a mechanism, not hope in a model

The principle: **do not depend on the summarizer model and do not stay silent**.

1. **Warning.** Toasts at 70% (yellow) / 85% (red) of the effective limit: it is time to
   write a checkpoint and run `/compact`. Child (subagent) sessions do not wake the root.
2. **Mechanical checkpoint.** `<project>/.opencode/CHECKPOINT-<stamp>.md` — verbatim last
   human posts + todo + files from tool calls. Written **always**, even if the model produces
   nothing. The path is pushed into the context and into the toast after compaction.
3. **Prompt replacement.** A structured checkpoint prompt that **forbids tool calls**;
   the verbatim block is duplicated right into the prompt so the digest cannot drop the human's words.
4. **Digest validation.** A digest is accepted only if it is prose (no tool-call syntax,
   not shorter than the minimum); otherwise the mechanical file stays authoritative and a `warn`
   goes to the log. `autocontinue` — only when a checkpoint file exists.
5. **Why this way.** A live failure: the summarizer model returned a **tool call instead of a
   digest**, so compaction went "silent". Hence the mechanical fallback, validation and explicit
   logs (the **fail-visible** principle).

## 3. STATE.md — a "now" checkpoint, not the product's history

- The head (above the `<!-- ARCHIVE:BELOW -->` marker) = what we are doing **right now**; finished
  work moves to `docs/history/state.md` (`npm run state:diet`). The compaction digest goes below the marker.
- Checkpoint files `.opencode/CHECKPOINT-*.md` are ephemeral; the head of `STATE.md` holds a pointer to the fresh one.

## 4. Delegation (delegate plugin + `AGENTS/delegation-mode.md`)

- **Why.** A heavy step bloats the root → compaction → amnesia → re-recon. The fix: the step is
  executed by a **subagent with a fresh context**, the root gets only a short report and keeps
  the vision.
- One subagent at a time. The brief is self-sufficient — the child **does not see** the history.
- **Models are not baked in** to agent files/tiers: they are chosen per call through `delegate_*` +
  `set_tier_model` (with human approval). Live lesson: a hardcoded model breaks silently when the
  model becomes `Forbidden`.
- **Cost.** A child always has a fresh context (cache miss) → every delegation costs tokens;
  so tiers default to `ask`.

## 5. Code maps (`AGENTS/code-map.md`)

By habit the agent goes `grep`→`read` over all files in a row. The map answers "what's where"
without a walk. Prefer one targeted `read` of the needed region from the map.

## 6. Principles of the machine

- **Fail-visible** — an error is a visible alert or log, never silence.
- **Mechanism, not plea** — contracts are held by gates and grammar, not persuasion.
- **Move-verbatim** — move protocols verbatim + a pointer, don't rewrite them by meaning.
- **One truth per entity.**
- **Self-cleaning** — the start prompt does not grow; STATE diets; checkpoints are ephemeral.
