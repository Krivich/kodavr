# tools — dev tools of kodavr

> Full rules and protocols of the tools an agent uses to run a server, catch bugs and
> debrief incidents. In `AGENTS.md` there is only a list with the essence and a link here.
> Read on demand before using a tool.

## Server process — hard rules

- Never start the server in the foreground from a tool: the child process inherits the
  console handles and the tool call hangs forever. Start/stop — scripts that re-plumb handles.
- Every tool call is separate and short (timeout ≤30 s); do not chain
  "commit + restart + check" in one call.
- Server code requires a restart; data/templates read from disk are live.

## Semi-real runs

<A user-UI emulator over a live API: every step through an external watchdog,
all fetches with deadlines; a found bug is released as a deterministic test with an ID.>

## Debriefing live incidents

<Extract a passage from the log into a readable batch of files; protocol: which fragment
to search for, how to name folders.>
