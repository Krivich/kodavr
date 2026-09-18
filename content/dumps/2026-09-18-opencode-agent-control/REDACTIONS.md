# Redactions — 2026-09-18-opencode-agent-control

Sources: chat-log / correspondence, plus the author's `source-code`.

Every removed or replaced item, listed with enough context to know what kind of thing it
was, without leaking it.

| # | removed / replaced | reason | replacement |
|---|---|---|---|
| 1 | Local OS username and absolute home paths (`C:\Users\<name>\...`) | personal data | `<project>`, `~`, generic paths |
| 2 | Internal project names in the delegation-mode consumers table | not needed by a stranger; avoids leaking private repos | `<projA>`, `<projB>` |
| 3 | A reference to a private troubleshooting notes file (`OPENCODE_BUGREPORT.md`) | file not shipped; would dangle | reference dropped |
| 4 | Account-specific notes about which models are authorized on the author's plan | account detail, not reusable | omitted; public model/provider names kept |

Not removed: public model and provider names (for example `deepseek-v4.1-flash`,
`opencode-go`) — they are catalog identifiers, not personal data.
