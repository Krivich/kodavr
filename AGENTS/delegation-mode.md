# DELEGATION MODE — delegation protocol (root-only)

> Master copy: `~/.config/opencode/templates/delegation-mode.md`. Moved out of AGENTS.md
> so it is not loaded at the start by subagents (they must ignore it). The root reads this
> file when delegation mode is enabled.

## DELEGATION MODE — delegation workflow for heavy tasks

> **Scope: the primary (root) session only.** Subagents (`worker`, `worker-lite`,
> `explore`) MUST ignore this section entirely and just execute their brief. The user
> does not switch them.

**Enable.** The user writes one of: "delegation mode", "work in delegation mode",
"delegate to a subagent", "work through a subagent". (Russian equivalents are also
accepted — «работаем в режиме делегирования», «режим делегирования», «делегируй
субагенту», «работаем через субагента».) Once enabled — **do not ask again**, confirm
in one line ("Delegation mode on") and follow the protocol below until the task is done.

**Disable.** The user writes: "turn delegation off", "work directly", "no delegation"
(«выключаем делегирование», «работай напрямую», «без делегирования») — then work as usual.

In this mode the primary model is the **orchestrator**: it explores, keeps the vision,
writes precise briefs and verifies results. It **does not write code or do routine
work itself** — all execution goes to a subagent. Goal: preserve the root context
(the valuable vision) and survive compaction.

### Roles

| who | tier when delegating | does |
|-----|--------|------|
| root (me) | — (session primary model) | recon, synthesis, briefs, verification, decisions. Writes no code. |
| `explore` | `simple` (read-only, cheap) | recon: find/read/collect facts, read-only |
| `worker` | `standard` (inherits the root model) | main implementation of one coherent step |
| `worker-lite` | `standard` (use `simple` for routine) | mechanical/simple edits |

Models are baked into NEITHER the agent files NOR the tiers — the root picks the
concrete model with the user's approval through `delegate` (see "Model selection").
Changing or removing a model never breaks the agents.

### Cycle (strictly sequential, one subagent at a time)

1. **Recon.** Minimal reading in root. Delegate broad search to `explore`. Synthesis,
   decisions and the "vision" stay in root.
2. **Brief.** Write a self-sufficient brief using the template below and launch **one**
   subagent via the matching tool: `delegate_standard_task` (inherits the root model,
   default), `delegate_simple_task` (cheaper), or `delegate_advanced_task` (smarter).
   Pass `agent` (`worker` / `worker-lite` / `explore`). If the simple/advanced tool has
   no approved model for this session yet, the call returns `MODEL SELECTION REQUIRED`
   with a table — choose a model with approval (see "Model selection") and repeat the
   call with the same brief.
3. **Execution.** The subagent works in its own context, self-checks and returns a
   short report. Its log and noise do **not** enter the root context.
4. **Verification.** Root verifies the critical bits: tests, commands, key diffs. Not
   done — extend the brief and rerun the subagent for the same logical step.
5. **Record.** Important facts/paths/decisions go to `STATE.md` or `JOURNAL.md`. Keep
   the path in context, not the contents.
6. Repeat until the task is done. End with a short summary for the user.

### Model selection (delegate tools + advisor)

The native `task` cannot change a subagent's model, so we delegate through the
primary-only delegate tools (plugin `~/.config/opencode/plugins/delegate.ts`):
`delegate_simple_task`, `delegate_standard_task`, `delegate_advanced_task`. One tool
per tier, because opencode's permission is keyed by tool name — so the user can set a
different policy per tier (e.g. auto-approve simple, approve standard/advanced by hand).

**Tiers are only a hint about the price/intelligence appetite — no models baked in:**

- `standard` (default) — the child inherits the root model (no model choice).
- `simple` — "cheaper": read-only / routine.
- `advanced` — "do not be afraid to pay for intelligence": hard logic.

Note: a child always starts with a FRESH context (prompt-cache miss), so **every**
delegation costs tokens — all three tools ask for approval by default. The user may set
any of them to `"allow"` (accept forever) in `opencode.jsonc`.

**Session pin (24h) with human approval.** For simple/advanced the advisor pulls the
daily benchmark feed and renders a **plain table** (model, score, $/session,
sessions/mo) **plus the baseline = your current root model**, so the root can judge
simple/advanced RELATIVE to it. No formulas, no thresholds, no "best model":

1. Calling `delegate_simple_task` / `delegate_advanced_task` with no approved model
   **does not start a subagent**; it returns `MODEL SELECTION REQUIRED` with the table.
2. Root looks at the request and the conversation (and its own knowledge of the
   models), weighs price vs intelligence against the baseline, and proposes **one**
   concrete model to the user; the user may name **any other** model.
3. Root calls `set_tier_model({ tier: "simple" | "advanced", model, note })` —
   opencode shows a **native permission prompt**, and the model is pinned only after
   the human approves.
4. Root repeats the same delegate tool with the same brief — the subagent runs.

The pin lives 24h **within the session**. While it is fresh, the delegate tool uses it
automatically. To change it — call `set_tier_model` again (approval again).

- `delegate_standard_task` — inherit the root model (default; still asks by default).
- `delegate_simple_task` / `delegate_advanced_task` — the model pinned to this
  session's tier, or `MODEL SELECTION REQUIRED`.
- `model: "<provider>/<model-id>"` — explicit model on any delegate tool (wins over
  the tier; manual override).
- `recommend_model({ tier })` — show the table any time without starting a child.
- `list_models` — the live catalog with cost/context, if you need to name your own.

The advisor **never applies a model itself** and never ranks: it only shows data. If
the feed is unavailable (offline, no cache) the table degrades to a `list_models`
hint, but the child still does not start without an approved/explicit model.

If a pinned model is unavailable (Forbidden/disabled), the delegate tool marks it dead
and falls back to `standard` (inheritance). An explicit `model` returns the error text
on failure — check `list_models` and retry.

### Brief template (root writes it BEFORE launch; the subagent sees no history)

```
1. TASK — one coherent step + Definition of Done
2. CONTEXT — file paths, facts, decisions (what it needs and what it does not know)
3. CONTRACT — which files may/may not be touched, style, what NOT to do
4. SELF-CHECK — how it will verify it is done
5. REPORT — <=60 lines: DONE / FILES(path:lines) / DECISIONS / NOT DONE & RISKS;
   do NOT paste whole files
```

### Context discipline (the whole point of the mode)

- Root does not read files in bulk — targeted reads or via `explore`.
- **Balance root-context protection against the child's startup cost.** The mode exists
  to keep the root context alive (delay compaction) across a heavy task; the price is a
  fresh context (prompt-cache miss) for every child. Weigh per step: a trivial edit
  barely protects the root context and still pays a full child startup, so the root does
  it; a self-contained step heavy enough to bloat or risk the root context goes to a
  child. Both extremes — delegate everything, delegate nothing — lose.
- The subagent's report is short; full output and logs stay in its session.
- Large results go to a file; only the path enters context.
- One subagent at a time, no parallel runs.
- On a context-sentinel warning (70%/85%) — update the checkpoint
  (`STATE.md`/`CHECKPOINT*.md`) first, then `/compact`.

### Subagent failure

If a subagent lacks data it returns a **BLOCKER**, not guesses. Root resolves the
blocker, fixes the brief and relaunches. If a step does not fit `steps: 40`, split the
step — do not raise the limit.

### Subagent routing

- Logic, architecture, hard edits → `worker`
- Mechanical routine, simple edits → `worker-lite`
- Read-only search/recon → `explore`
- Unsure → `worker`
