# Redactions — 2026-09-18-kodavr-dump-skill

Sources: chat-log (the drafting session), source-code (the Kodavr repository).

Nothing secret or personal was found in the published skill. The changes below
are the only removals/replacements made for this dump.

| # | removed / replaced | reason | replacement |
|---|---|---|---|
| 1 | A local Windows user path from the drafting session (`C:\Users\<name>\IdeaProjects\kodavr`) | personal identifier | repo-relative paths and `%USERPROFILE%` |
| 2 | The absolute path of the local skill copy (`~/.config/opencode/skills/kodavr-dump`) | personal environment | the `home/user` placeholder and `~/.config/opencode` |

No tokens, keys, credentials or third-party personal data appear in the dump.
The `user@example.com` in `templates/REDACTIONS.md` is the skill's own synthetic
placeholder, not a real address.
