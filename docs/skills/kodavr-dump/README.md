# kodavr-dump

A portable snapshot of the global opencode skill **`kodavr-dump`**: you describe
something you built, and the skill drafts a Kodavr dump and opens the dump PR
(only after you approve the proposal).

The skill itself is the tree under
`home/user/.config/opencode/skills/kodavr-dump/` — parked at its real target
paths, so the layout is the instruction.

| File | Role |
|---|---|
| `INSTALL.md` | what goes where, and how to assemble it (human) |
| `install.json` | the same mapping as a machine-readable contract (author, source, version pointer) |
| `MANIFEST.md` | maintainer notes: what this is, what is included, how to rebuild |
| `SHA256SUMS` | integrity hashes of every payload file |
| *(payload)* `VERSION` | the skill's version — it travels with each copy |
| *(payload)* `CHANGELOG.md` | version history and the bump rule |
| *(payload)* `command/dump.md` | optional `/dump` command — a deterministic trigger that forces the skill to load |
