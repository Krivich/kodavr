# The agent-control loop — brief for a human stranger

**What it is.** A complete, reproduction-ready OpenCode setup for running long
coding-agent sessions without losing the thread: a compaction "sentinel" plugin that
always writes a mechanical checkpoint, a tiered delegation plugin that lets the root
push heavy steps to fresh-context subagents, an advisor for choosing models with human
approval, and lazy layers that keep the always-on prompt small. Every config file,
plugin and test is inlined.

**Why you would want it.** Long sessions fail in two expensive ways. First, when the
context window fills, the automatic summary can come back as garbage — so the machine
writes its own checkpoint (verbatim user posts, todo, touched files) that does not
depend on the summarizer at all. Second, digging through files bloats the root session
until it forgets the plan — so heavy steps go to subagents with a fresh context, and
everything not needed every turn (area rules, skills, commands) loads on demand. The
result: sessions survive compaction, models are chosen per task with approval instead of
being hardcoded, and the startup prompt stays small.

**What to watch out for.** This is a field setup, not a product: it leans on OpenCode's
`experimental.*` plugin hooks, so a future release can move the ground under it. It is
self-tested on one account and a couple of projects, not community-tested. The files
come with empty domain data and `<...>` placeholders — you fill in your provider and
models. It is one of two companion dumps; the requirements registry, its coverage check
and the idea process live in *The requirements machine*. Honesty labels:
`generated_by: agent`, `human_review: minimal`, `trust_level: self-tested`. Personal
data (local username, absolute paths, internal project names) was removed — see
`REDACTIONS.md`.

*(This is the human door into the raw dump. The body stays machine-first.)*
