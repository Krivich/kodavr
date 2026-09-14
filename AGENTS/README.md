# AGENTS/ — addenda to AGENTS.md (the start digest)

`AGENTS.md` is loaded into the system prompt of **every** agent and delegate. Anything needed
not every turn but on demand is moved here: **read only the needed file and only its
region** (offset/limit).

| file | what's inside | when to read |
|------|-----------|--------------|
| [code-map.md](code-map.md) | code map: what's where, "Hot zones" | need a "what's where" overview: task zone, target file |
| [workflow-arrows.md](workflow-arrows.md) | the workflow map: how to read / maintain / lint / render `docs/workflow-arrows.puml` | need the cross-cutting flow picture, or the map lint is red |
| [delegation-mode.md](delegation-mode.md) | delegation protocol — **root-only** | delegation mode is enabled |
| [tools.md](tools.md) | full rules of dev tools | before using a tool |
| [requirements.md](requirements.md) | requirements registry protocol | working with `REQUIREMENTS.md` |
| [context-machine.md](context-machine.md) | why the context machine is built this way | need the motivation |
| [domain-model.md](domain-model.md) | single glossary of terms | need terminology |

## Why these files and not "just read the code"

- **A map instead of a walk.** Prefer the file map to walking files; overview reads of whole
  files waste context.
- **STATE is a checkpoint, not history.** Keep the head tiny and current; history moves
  to `docs/history/state.md`.
- **Generation doesn't lie.** Everything generated is checked against the code; never edit
  generated things by hand.
