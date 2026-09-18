# Submission reference — repo, validate, push, PR

Goal: land exactly one dump directory in the Kodavr repo and open a PR, without
touching anything else and without leaking anything.

## Where the Kodavr repo is

Resolution order:

1. **Current project is already a Kodavr clone** — if the working directory has
   `content/dumps/` and `scripts/validate.mjs`, use it as the working copy.
2. **`KODAVR_REPO_DIR`** (env) — if set and it looks like a Kodavr clone, use it.
3. **A dedicated clone** — otherwise clone/update one:
   - Defaults come from `config.json` in this skill; env overrides:
     `KODAVR_REPO_URL`, `KODAVR_BASE_BRANCH`, `KODAVR_WORKDIR`.
   - Default workdir: `~/.kodavr-dump/kodavr` (`$HOME`; on Windows
     `%USERPROFILE%\.kodavr-dump\kodavr`).
   - If absent: `git clone <repo_url> <workdir>`.
   - Else: `git -C <workdir> fetch origin`.

Derive `<owner>/<repo>` from `git -C <workdir> remote get-url origin`.

## Prepare a clean branch

```
git -C <workdir> fetch origin <base>
git -C <workdir> checkout -B dump/<slug> origin/<base>
```

`dump/<slug>` is always created fresh off the base — never reuse a dirty branch.

## Place and validate

Copy the prepared dump into `<workdir>/content/dumps/<slug>/`, then run the
repo's own gate from the workdir:

```
node scripts/validate.mjs
```

- Must print `0 error(s), ...`. Every `ERROR` is a BLOCK — fix and re-run.
- Fix `WARN`s (duplicate H1, broken in-page anchors) when cheap.
- If `node` is unavailable: say so and require explicit consent before
  submitting unvalidated (CI still gates after the PR).

## Commit only the dump

```
git -C <workdir> add content/dumps/<slug>
git -C <workdir> status --short      # MUST list only content/dumps/<slug>/...
git -C <workdir> commit -m "dump: <title> (<slug>)"
```

Never `git add -A`: the tree may hold the human's untracked files. One commit,
one dump, one-line story.

## Push + open the PR — fallback chain

Try in order; stop at the first that works. Always get the human's approval
first (SKILL Step 5).

### A. `gh` CLI (preferred when installed and authed)

```
gh auth status
git -C <workdir> push -u origin dump/<slug>
gh pr create --repo <owner>/<repo> --base <base> --head dump/<slug> \
  --title "<title> [<slug>]" --body-file <pr-body-file>
```

### B. GitHub REST API (when `GH_TOKEN` or `GITHUB_TOKEN` is in the environment)

Push without persisting the token, then create the PR via API:

```
git -C <workdir> -c http.extraheader="AUTHORIZATION: bearer $GH_TOKEN" \
  push https://github.com/<owner>/<repo>.git dump/<slug>
curl -sS -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/<owner>/<repo>/pulls \
  -d @<pr-json-file>
```

`<pr-json-file>`: `{"title":"...","head":"dump/<slug>","base":"<base>","body":"..."}`.

PowerShell equivalent:

```
git -C <workdir> -c http.extraheader="AUTHORIZATION: bearer $env:GH_TOKEN" push https://github.com/<owner>/<repo>.git dump/<slug>
Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/<owner>/<repo>/pulls" -Headers @{ Authorization = "Bearer $env:GH_TOKEN"; Accept = "application/vnd.github+json" } -Body (Get-Content <pr-json-file> -Raw) -ContentType "application/json"
```

Never echo the token; never store it in git config or a file.

### C. Push + compare URL (no gh, no token)

```
git -C <workdir> push -u origin dump/<slug>
```

Then hand over the PR-creation URL:

```
https://github.com/<owner>/<repo>/compare/<base>...dump/<slug>?expand=1
```

If the push is rejected for lack of write access and `fork_on_no_push` is true,
fork first and push there:

- `gh repo fork <owner>/<repo> --clone=false --remote=false`, add `fork` remote, push to it; or
- `POST https://api.github.com/repos/<owner>/<repo>/forks`, then push to
  `https://github.com/<your-login>/<repo>.git`.
- Compare URL for a fork: `.../compare/<base>...<your-login>:dump/<slug>?expand=1`.

Tell the human the URL and paste the filled PR body for them.

## PR body

Fill every field of `.github/PULL_REQUEST_TEMPLATE.md` (fetch it from the repo)
and tick only the boxes that are actually true. Write it to a temp file and use
`--body-file` / `-Body` so shell quoting cannot corrupt it.

```
## Dump
- slug: <slug>
- type (note|case|pack): <type>
- domain: <domain>
- stakes (low|medium|high): <stakes>
- content_flags: <flags or ->
- generated_by (human|agent|hybrid): <...>
- human_review (none|minimal|attested): <...>

## Author checklist
- [x] Secrets cleaned (ran secret-scan locally)
- [x] Examples are synthetic, no real data
- [ ] REDACTIONS.md attached (if sources include correspondence)
- [x] manifest.json is valid per schema (locally: node scripts/validate.mjs)
- [x] Licence specified
- [ ] Heavy files moved to Release convention
- [x] summary.md brief attached (if an agent wrote it)
```

## Safety checks before pushing

- Explicit human approval of the shown content.
- Only `content/dumps/<slug>/` is staged (`git status --short` verified).
- No secrets / real personal data in the diff.
- Token comes from the environment only; nothing persisted.
- If validation could not run locally, say so clearly.
- Leave the working copy clean; never delete the human's untracked files.
