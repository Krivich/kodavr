# Redactions — 2026-09-21-opencode-architecture-map

This dump is derived from a working session (sources: `chat-log`, `source-code`). Everything below
was removed or replaced before publishing. Nothing here names what was removed beyond its *kind*.

## Removed / replaced

- **Absolute filesystem paths of the author's machine.** The session scanned real paths such as an
  absolute Windows home directory rooted at a user profile. All paths in this dump are either
  repo-relative (`scripts/...`, `docs/...`) or the placeholders `<project>` (the repository root) and
  `~` (the user's home). No user name, no drive root, no editor-specific path is published.
- **The live repository identity.** The session ran inside the author's own working copy of the
  Kodavr site. The dump keeps the *public* name (Kodavr) because the companion dump is published
  there, but drops the local checkout path, the remote URL with any embedded credential, and any
  branch/heap state of that specific machine.
- **Scratch and temporary artifacts.** Throwaway probes, temp-file paths (`%TEMP%\...`), a PlantUML
  jar stored in a temp folder, and one-off preview PNGs were dropped; the reproducible commands and
  the version numbers remain.
- **Conversation metadata.** Message timing, tool-call logs, model identifiers and the author's
  chat turns are not reproduced; the dump is the resulting design, not the transcript.

## Checked and kept

- No secrets (tokens, keys, passwords, credentialed URLs) were present in the source; the git
  remote used for the session was credential-free HTTPS.
- No personal, financial or medical data of any third party appears. The only human-facing names are
  public project names.
- The one 64-character hex digest that the design uses as an anchor is **replaced by a placeholder**
  in the inlined source (§6.4) and is recomputed by the reader for their own set. The literal was not
  published, both because it is meaningless to a stranger and because a long hex run trips the
  secret-entropy scan.

## A note on tone

The dump keeps the author's working vocabulary (drawers, bricks, helicopter view) and the design
debates that produced the checks, including rejected alternatives. Those are opinions about one
project's trade-offs, marked `experimental`, not universal rules.
