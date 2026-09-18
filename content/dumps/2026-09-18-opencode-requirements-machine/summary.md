# The requirements machine — brief for a human stranger

**What it is.** A reproduction-ready way to keep an agent-driven repository honest about
what it owes: a single `REQUIREMENTS.md` registry with stable IDs and a test per
requirement, an `npm run req` coverage check that reconciles tests with the registry, a
maintenance protocol (`AGENTS/requirements.md`), and an idea process that turns raw
brainstorms into grounded requirements. Every file is inlined. The requirements-management
machine was inspired by the Telegram channel *LLM Under the Hood*
(https://t.me/llm_under_hood).

**Why you would want it.** Across long sessions, obligations quietly drift — a rule gets
forgotten, an idea is mistaken for a design decision, the same requirement appears in
two places and they disagree. This machine gives each obligation exactly one home with a
stable ID and a green test, fails loudly on a typo'd ID or a ✅ row with no test, and
forces every brainstorm branch to get an explicit verdict (minted, rejected with a
reason, or deferred). The registry grows with the project; what is read at startup stays
a pointer.

**What to watch out for.** This is the requirements half of a two-dump setup. It works in
tandem with *The agent-control loop* (https://kodavr.xyz/dumps/2026-09-18-opencode-agent-control/):
the agent-control machinery and the root `AGENTS.md` digest come from there — apply it first. It is self-tested on one account, not
community-tested, and the ID prefix, registry groups and test runner are placeholders
you set for your project; `npm run req` must be wired to your test directory. Honesty
labels: `generated_by: agent`, `human_review: minimal`, `trust_level: self-tested`.
Personal data was removed — see `REDACTIONS.md`.

*(This is the human door into the raw dump. The body stays machine-first.)*
