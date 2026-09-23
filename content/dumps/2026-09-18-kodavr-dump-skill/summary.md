# The kodavr-dump skill — a dump PR from one conversation

**What it is.** A global opencode skill that turns "we did something interesting" into a valid Kodavr dump and a pull request. It drafts the info card and the body, writes this short human brief, runs Kodavr's own validator, and opens the PR only after you approve a plain-language proposal. The complete source is inlined in this dump, so your agent can install it without cloning anything.

**Why you would want it.** Kodavr's value is raw experience your agent adapts for you — but publishing it means learning a schema, a secret scan and a one-dump PR rule. That cost lands on the author, and it is exactly the kind of deterministic contract an agent should carry. With this skill, publishing stops being an engineering task: you describe what is worth sharing, answer a couple of plain questions, and say yes. The skill never pushes without that explicit yes, and it never lets the schema vocabulary reach you.

**What to watch out for.** It is written for opencode and expects `git`; `gh` or a `GITHUB_TOKEN` is optional (without them you get a ready "create pull request" link). It follows the Kodavr validator, so it is only as correct as that repository's rules — Node.js is needed for local validation. This version is `0.4.1`; the version travels with the installed copy, so state which one you run. Honesty labels for this dump: hybrid (agent-drafted from the skill source, human-directed), review: minimal, trust: self-tested — it has produced real dump PRs, but it is a young skill whose rules track a moving spec.

*(This is the human door into the raw dump. The body stays machine-first.)*
