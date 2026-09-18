# kodavr-dump — install bundle (what goes where)

This is a snapshot of the **global** opencode skill `kodavr-dump`: the one that
turns "we did something interesting" into a Kodavr dump and opens the PR. It is
a *snapshot*, not a live config — the files are parked at their real install
paths, relative to a clear root, so the layout itself is the instruction.

## Convention

The bundle mirrors the target tree relative to your home directory. This is the
same idea as GNU Stow's "installation image" (a package tree laid out the way it
should appear under the target) and Ansible's `roles/<role>/files` + a
`copy src=... dest=...` task: the path is the mapping. `home/user` is a
placeholder for `$HOME` — `user` is not copied literally.

## Map — what goes where

| From the bundle | To |
|---|---|
| `home/user/.config/opencode/skills/kodavr-dump/` | `%USERPROFILE%\.config\opencode\skills\kodavr-dump\` (Windows) or `~/.config/opencode/skills/kodavr-dump/` (Linux/macOS) |
| `home/user/.config/opencode/command/dump.md` | `%USERPROFILE%\.config\opencode\command\dump.md` (Windows) or `~/.config/opencode/command/dump.md` (Linux/macOS) |

The command is optional but recommended: it gives a deterministic entry point
(`/dump`) that forces the skill to load, instead of relying on the model to
notice a natural-language request. Copy the whole skill directory as-is; no
other repository files are touched.

## Install

Windows PowerShell:

```powershell
$src = "<unpacked>\home\user\.config\opencode"
$dst = "$env:USERPROFILE\.config\opencode"
New-Item -ItemType Directory -Force -Path "$dst\skills","$dst\command" | Out-Null
Copy-Item -LiteralPath "$src\skills\kodavr-dump" -Destination "$dst\skills" -Recurse -Force
Copy-Item -LiteralPath "$src\command\dump.md" -Destination "$dst\command\dump.md" -Force
```

Linux / macOS:

```bash
mkdir -p ~/.config/opencode/skills ~/.config/opencode/command
cp -r home/user/.config/opencode/skills/kodavr-dump ~/.config/opencode/skills/
cp home/user/.config/opencode/command/dump.md ~/.config/opencode/command/
```

## Requirements

- opencode — global skills are scanned at `~/.config/opencode/skills/<name>/SKILL.md`.
- `git` — for the submission flow.
- Optional: `gh` and/or a `GITHUB_TOKEN` to open the pull request automatically.
- Optional: Node.js — to run Kodavr's own `scripts/validate.mjs` before submitting.

## Verify integrity

`SHA256SUMS` lists every payload file (paths relative to this bundle root).

Windows PowerShell:

```powershell
$snap = "<unpacked>"
Get-Content "$snap\SHA256SUMS" | ForEach-Object {
  $h,$p = $_ -split '  ',2
  $got = (Get-FileHash -LiteralPath (Join-Path $snap ($p -replace '/','\')) -Algorithm SHA256).Hash.ToLower()
  if ($got -ne $h) { "MISMATCH: $p" }
}
```

Linux / macOS: `sha256sum -c SHA256SUMS`.

## Restart

Restart opencode. The skill `kodavr-dump` is then available in any project and
any session. This directory in the repository is only the source snapshot — the
skill does not run from here.
