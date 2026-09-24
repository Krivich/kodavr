# Free hunt — brief for a human stranger

**What it is.** An adaptation-ready way to let a coding agent hunt for bugs in the
running product *before* it is allowed to say "done". It has three parts: a console
bridge (`human-emulator.mjs` + an external `lab-watchdog.mjs`) that speaks the project's
own HTTP API exactly as the frontend does, so the agent can drive the live service from
its own shell; a bounded exploration protocol (seeds, clean slate, json↔markdown parity,
minimization and neighbour checks) whose only required output is a journal of anomalies;
and a fix perimeter — registry IDs, a generated code map, exit-code gates, mechanical
checkpoints and per-tier delegation approval — in which the agent may repair what it
found. The bridge and watchdog sources are inlined in full.

**Why you would want it.** A green suite proves the bricks; it says nothing about the
mortar between them. In practice the human was the first one to exercise a fresh feature
end-to-end and reliably hit an obvious break within ten minutes — an evening lost to
something a look-ahead could have caught. The bridge turns "the human clicking around"
into a few shell commands the agent can run itself, and the walk protocol turns a vague
"look around" into a bounded hunt that ends with named blind spots instead of a green
checkmark. The catches behind the protocol are described by mechanism in "The catch" and
"Origin incident" — the raw logs themselves were redacted — so it is a lesson paid for,
not a checklist invented.

**What to watch out for.** This is a field practice, not a product, and it is self-tested
on one project, not community-tested. There is **no sandbox in the strict sense**, though
the run targets a local dev instance rather than production, so the blast radius is a
disposable data dir and its config. Side effects still persist there (external servers
connect, templates persist, timers fire) and are cleaned by hand, never silently; the hard
rail is the human-approval gate on every write, not a throwaway environment. The bridge
assumes your frontend is a thin client over HTTP and that the end state lives in a stream
file the same script can read; a UI with server-only state will need more than the commands
shown. The fix
perimeter leans on the companion dumps *The agent-control loop* and *The requirements
machine* — the checkpoint sentinel, the registry and its coverage gate come from there.
Honesty labels: `generated_by: agent`, `human_review: minimal`, `trust_level:
self-tested`. Personal data (local username, absolute paths, internal project and vendor
names) was removed — see `REDACTIONS.md`.

*(This is the human door into the raw dump. The body stays machine-first.)*
