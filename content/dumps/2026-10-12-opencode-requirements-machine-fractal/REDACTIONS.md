# Redactions — 2026-10-12-opencode-requirements-machine-fractal

Sources: chat-log / the working session, plus the author's `source-code` and `tests`.

Every removed or replaced item, listed with enough context to know what kind of thing it was,
without leaking it.

| # | removed / replaced | reason | replacement |
|---|---|---|---|
| 1 | Local OS username and absolute filesystem paths from the session | personal data | `~`, `<project>`, generic relative paths |
| 2 | A third-party speech-service API token that appeared in the same session (an unrelated side-quest) | secret | excluded entirely — never referenced in the dump |
| 3 | The private repository's URL/location and internal run-stamp names of the pilot project | private project detail; the mechanism is what matters | described as "a private, long-running agent-driven codebase"; commit hash omitted |
| 4 | The project's domain and stack identifiers — the framework/engine and the subsystem's domain (its concrete module name, ID prefix, group vocabulary and requirement IDs) | the author asked not to disclose project specifics; a reusable recipe must not carry the origin project's names | generalized to placeholders: `<project>`, `<module>`, `<MOD>`, `<ROOT>`, generic group names, `<module>/tests/` |

Not removed: public tool and vendor names (`opencode`, `node`, `git`) — catalog identifiers, not
personal data. Also not removed: the base dump this one derives from (a published Kodavr dump).
