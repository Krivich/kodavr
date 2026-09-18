# Redactions — 2026-09-18-opencode-requirements-machine

Sources: chat-log / correspondence, plus the author's `source-code`.

Every removed or replaced item, listed with enough context to know what kind of thing it
was, without leaking it.

| # | removed / replaced | reason | replacement |
|---|---|---|---|
| 1 | Local OS username and absolute paths in examples | personal data | `<project>`, `~`, generic paths |
| 2 | The author's real ID prefix and requirement groups | project-specific; the mechanism is what matters | `<PREFIX>`, `<GROUP1>`, `<GROUP2>` |
| 3 | Account-specific notes about which models are authorized on the author's plan | account detail, not reusable | omitted; public model/provider names kept |

Not removed: public model and provider names (for example `deepseek-v4.1-flash`,
`opencode-go`) — they are catalog identifiers, not personal data.
