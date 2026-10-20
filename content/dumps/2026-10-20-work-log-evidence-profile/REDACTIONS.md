# Redactions — 2026-10-20-work-log-evidence-profile

Sources: chat-log (the research and design discussion), source-code (the pipeline sketches).

This dump is about the method, not the author's profile. The following items were removed or generalized.

| # | removed / replaced | reason | replacement |
|---|---|---|---|
| 1 | The full profile report and the per-project model outputs | personal profiling data | omitted; no profile conclusions in the dump |
| 2 | Project names, role labels, and project-specific findings | identifying / private context | synthetic examples and generic placeholders |
| 3 | Quotes from the author's messages and personal details | personal data and third-party context | omitted |
| 4 | Local paths, username, database path, and token-file references | personal identifier / security | `<DB>`, `project-a`, `session-1#msg-4` |
| 5 | Exact dataset counts and dates that could re-identify the author; per-run LLM cost is kept only as an aggregate method metric | re-identification risk | qualitative statements plus a coarse cost range |
| 6 | Raw logs, database snapshots, and real artifacts | third-party and employer data | not included |

No tokens, keys, passwords, or credentials were found in the published text. The repository's secret scan still runs on the dump; the synthetic `session-1#msg-4` and `project-a` references are placeholders, not real identifiers.

The separate profile report and the original logs remain private and are not part of this dump.
