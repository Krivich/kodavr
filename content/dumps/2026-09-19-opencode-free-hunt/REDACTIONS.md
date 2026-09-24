# Redactions — 2026-09-19-opencode-free-hunt

Sources: chat-log / correspondence, plus the author's `source-code` and test-run logs
(`source-code`, `traces`).

Every removed or replaced item, listed with enough context to know what kind of thing it
was, without leaking it.

| # | removed / replaced | reason | replacement |
|---|---|---|---|
| 1 | Local OS username and absolute home paths (`C:\Users\<name>\...`, repo roots) | personal data | `<project>`, `~`, generic paths |
| 2 | The internal project name and its platform package name | not needed by a stranger; avoids leaking a private repo | `<project>`, `packages/<platform>` |
| 3 | The internal live data-directory name | project-specific carrier | `<data-dir>` |
| 4 | The author's requirement-ID prefix and concrete requirement numbers (the catches are described by mechanism, not by ID) | project-specific | "a requirement ID", "the registry" |
| 5 | A third-party MCP vendor / store and its concrete tool names that appeared in the original walk examples | third-party business detail, not reusable | omitted; the examples are described generically |
| 6 | Internal source and test file names and line numbers from the original incident logs | private layout | described by role (gate, renderer, duplicate guard) |
| 7 | A reference to a separate internal prompt-forensics write-up | it is not published; the reference would dangle | noted as "planned", with the loop and its worked example inlined instead |
| 8 | The internal lab-directory name (the watchdog's log directory under the OS temp dir) | project-specific carrier | `<lab-dir>` |

Not removed: placeholders in the inlined tool sources (`<project>`, `<data-dir>`,
`<lab-dir>`, the tag-string examples) — they are the reader's substitution points, not
hidden data.
