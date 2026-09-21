# The architecture map — brief for a human stranger

**What it is.** A reproduction-ready way to give an agent-driven repository a picture of its own
architecture that the agent will actually look at and can trust. It is two halves that only work
together: a **PlantUML flow map** with one fixed convention (a drawer per code directory, a brick per
module, one label grammar, every arrow coloured by the business process it belongs to, the numbered
flow of cross-cutting steps), and a **linter** that checks the map against the code tree — so the map
is either true or the build goes red. On top of that, a **design-time hook** in the requirements
registry makes every new requirement name the business process it touches, which forces the map to be
consulted *before* code is written. Every source file — the linter, the SVG hover injector, the
coverage script, the convention doc and the example map — is inlined.

**Why you would want it.** Agents do not "forget" code they can read; they forget the *shape* of a
system across sessions. Working on one file, the cheapest line to the goal often cuts across a shared
step, and that shortcut is locally green and globally a second source of truth that drifts. A diagram
sitting in the prompt does not fix this: it rots, and a rotting map teaches the agent to ignore maps.
This setup answers the three questions that make a map useful to a machine: is it cheap to read
(one grammar, helicopter altitude — not every plumbing edge), is it true (linted against the real
code, including a check that a drawn module-to-module edge is a real import), and is it *used* (a new
requirement cannot be written without naming the process it extends, so the map is opened first).
The failure that convinced me it works: the import check caught a drawn edge the map claimed and the
code did not have — the map was lying, and the linter said so.

**What to watch out for.** This is the companion to *The requirements machine*
(https://kodavr.xyz/dumps/2026-09-18-opencode-requirements-machine/): the registry, the `flow:`-style
design-time hook and the `AGENTS.md` digest come from there — apply it first, because the hook lives
inside its coverage check. It is `self-tested` on one repository, not `community-tested`, and the
process palette, drawer list and test runner are placeholders you set for your project. The
honest limit: the map provably matches the code (the linter is executable and pinned by tests), but
"the agent therefore designs better" is the *intended* effect — designed for, not yet measured — which
is why this is flagged `experimental`. Honesty labels: `generated_by: agent`, `human_review: minimal`,
`trust_level: self-tested`. Personal data was removed — see `REDACTIONS.md`.

*(This is the human door into the raw dump. The body stays machine-first.)*
