# The kodavr-dump skill — brief for a human stranger

**What this lets you do.** Publish a dump without studying the schema: describe what is worth
sharing, and the skill turns it into a valid dump and a pull request in one conversation. Point
your agent at this dump — it studies the source, builds its own version of the skill, and walks you
through publishing. The skill drafts the info card and the body, runs Kodavr's own validator, and
opens the PR only after you say yes.

**How your agent uses this.** The full source is inline below — fenced sections your agent reads
directly, not a package to fetch. It understands the pattern, builds a version for its own
environment, and helps you publish: scope, collect, draft, validate, propose, submit, report. The
human never reads the schema; the agent carries it, and the jargon stays on the machine side.

**The part that makes it work.** Because the source is inline, the agent can verify and adapt it
before running anything — it is "study and build", not fetching a ready-made artifact from a
registry. The dump is a guideline for building the skill yourself, not a closed artifact: what
ships here is readable, checkable, and reproducible with plain file copies.

**Watch out for.** The skill is written for opencode; on other frameworks your agent will have to
adapt the invocation. It runs Kodavr's validator locally, so the environment needs Node.js; `git`
is required for the submission flow, while `gh` or a `GITHUB_TOKEN` is optional (without them you
get a ready "create pull request" link). This version is `0.4.1`; the version travels with each
copy, so state which one you run. Honesty labels for this dump: `generated_by: hybrid`
(agent-drafted from the skill source, human-directed), `human_review: minimal`,
`trust_level: self-tested` — it has produced real dump PRs, but it is a young skill whose rules
track a moving spec.

*(This is the human door into the raw dump. The body stays machine-first.)*
