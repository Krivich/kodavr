# kodavr-dump — bundle manifest (internal)

- **Date:** 2026-09-18
- **Purpose:** a portable snapshot of the global opencode skill `kodavr-dump`.
  The skill collects material about something you built, drafts a Kodavr dump
  (`manifest.json` + `raw.md` + `summary.md`, plus `REDACTIONS.md` when the
  sources include a conversation), shows a human-friendly proposal, and — only
  after explicit approval — opens a dump PR per Kodavr's rules.
- **Anonymized:** the home directory is the `user` placeholder.
- **Not a live config:** the payload is parked at its install paths; the layout
  is the instruction. See `INSTALL.md`.

## Layout

```
docs/skills/kodavr-dump/
  README.md                               ← orientation (every distribution has one)
  INSTALL.md                              ← recipient-facing "what goes where"
  install.json                            ← the same map + author/source/version pointer
  MANIFEST.md                             ← this file (maintainer-facing)
  SHA256SUMS                              ← hashes of every payload file
  home/user/.config/opencode/
    skills/kodavr-dump/
      SKILL.md
      VERSION                             ← the skill version (single source)
      CHANGELOG.md                        ← history + the bump rule
      config.json
      reference/  human-guide.md · manifest.md · rules.md · submission.md
      templates/  manifest.json · raw.md · summary.md · REDACTIONS.md
    command/dump.md                       ← deterministic /dump entry point
```

`home/user` → `%USERPROFILE%` (Windows) / `~` (Linux, macOS).

## Why this shape

A home-relative mirror (GNU Stow's "installation image" pattern) plus an
explicit source→destination map in `INSTALL.md` (the Ansible `roles/*/files` +
`copy` task pattern). The tree is the deployment manifest; nothing has to be
guessed.

## Included / excluded

- **Included:** the complete skill source. It has no dependencies, so nothing is
  installed by a package manager.
- **Excluded:** nothing — no `node_modules`, no logs.
- `SHA256SUMS` covers every payload file, excluding the bundle metadata:
  `README.md`, `INSTALL.md`, `install.json`, `MANIFEST.md`.

## Versioning & provenance

Why: copies of this skill fan out into projects, and fixes made in a client
project used to leave no trace of who runs which revision or whom to tell on a
breaking change. The cure is a version that travels with the installed copy:

- **`VERSION`** (in the payload, beside `SKILL.md`) is the single source: now
  `0.4.0`.
- **Bump it on every change.** PATCH = wording/fix; MINOR = new capability,
  backward compatible; MAJOR = can surprise an existing user. Record the bump in
  `CHANGELOG.md` (newest on top). Never edit the skill without bumping.
- **`install.json`** carries `maintainer` and `source`, and points at
  `VERSION` — it does not restate the number (one truth per entity).
- The skill reports its version when a submission is done, so a client project
  can state which revision it is on.

To find consumers later: ask each project which `VERSION` it has (or search its
`~/.config/opencode/skills/kodavr-dump/VERSION`); on a MAJOR bump, offer the new
bundle to those that are behind.

## Relationship to the published dump

The skill is published on Kodavr as a **`case`** dump,
`content/dumps/2026-09-18-kodavr-dump-skill/`, whose body inlines this payload as
fenced code sections. A `pack` with a `files/` tree was rejected by the platform's
own checks — an extensionless file reads as a binary (`KDV-CI-06`) and a checksums
file trips the secret scan (`KDV-CI-04`) — so non-binary sources belong inline.
This bundle stays the repo-side source snapshot; the dump is the published record.

## Rebuild

Re-copy `~/.config/opencode/skills/kodavr-dump` (no `node_modules`, no logs) to
`home/user/.config/opencode/skills/kodavr-dump` and regenerate `SHA256SUMS`.
