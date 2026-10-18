# The fractal requirements machine — brief for a human stranger

**What it is.** An extension of the requirements-machine dump that turns one project-wide requirements
registry into a composition: any module folder becomes a self-contained requirements machine — its own
registry, its own tests, its own copy of the coverage script — with the module name as the ID prefix.
The root stays aware through a small manifest and a cross-machine checker; a module can be lifted out of
the project together with its git history. Every added file is inlined in the raw body, and the base
machine is installed first.

**Why you would want it.** If your project is growing side modules — experimental backends, candidate
integrations, a sub-project that may be extracted later — a flat registry forces a bad choice: mint
requirement IDs for experiments that die (dead IDs in your one-truth file), or keep obligations outside
the machine (drift comes back). With this setup a dying candidate costs one deleted folder and one
manifest row; a surviving module carries its contracts, tests and history out of the repo with it. ID
collisions between root and module are impossible by construction, not by convention.

**What to watch out for.** It layers on the base requirements machine — apply that dump first (or install
both together, base first). Experience so far: one pilot split (a module migration with a full ID rename,
suite green) followed by about a week of ordinary work, during which the module's registry grew from 9 to
23 rows (including a speculative 7-row research track) and the root's ID space stayed clean; the coverage
chain ran on every commit and stayed quiet. Read the honest limits before adopting: the "seams stay in the
root" rule is about ownership, not a frozen count — the root accrued more host-side rows too; and while the
fractal's *depth* (root + child) is proven, its *breadth* is not — there is still exactly one child, and no
module has actually been extracted into a second repository yet, which is why the dump stays `experimental`.
The rename path uses the base machine's own "IDs never change — except one human-sanctioned synchronous
commit" rule, so budget one careful commit with a rewrite script. Honesty labels: `generated_by: hybrid`
(the human co-designed the rule, the agent implemented), `human_review: minimal`, `trust_level:
self-tested`. The original project's specifics (its domain, framework and module names) were generalized
to placeholders, and personal data and a third-party API token from the same session were removed — see
`REDACTIONS.md`.

*(This is the human door into the raw dump. The body stays machine-first.)*
