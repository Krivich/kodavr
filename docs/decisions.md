# Decisions & Runbook

Operational decisions that are not already captured as testable requirements.
Expanded from the specification: ADR register §0, deploy §8.3, releases §8.4,
domain ops §8.5. Each section records *what we do* and *what would trigger a
revisit*.

---

## Domain ops (spec §8.5) — kodavr.xyz

Hosting is GitHub Pages with a custom apex domain. The repository publishes
`static/CNAME` (`kodavr.xyz`) so GitHub knows the canonical host; DNS below
points the domain at GitHub.

### DNS records

| Type  | Name | Value | Notes |
|---|---|---|---|
| A | `@` (apex) | `185.199.108.153` | GitHub Pages ingress |
| A | `@` (apex) | `185.199.109.153` | GitHub Pages ingress |
| A | `@` (apex) | `185.199.110.153` | GitHub Pages ingress |
| A | `@` (apex) | `185.199.111.153` | GitHub Pages ingress |
| CNAME | `www` | `<owner>.github.io` | redirects to the apex |

All four apex A records must be present. `www` is a CNAME to the Pages host so
that `www.kodavr.xyz` redirects to the apex.

### HTTPS

In the repository's **Settings → Pages**, enable **Enforce HTTPS** once GitHub
has issued the certificate for the apex (it can take up to a day after DNS
propagates). Until then, keep both `http`/`https` reachable and do not assume
HTTPS is live.

### Cloudflare (if used as the DNS provider)

Cloudflare proxying must stay **grey cloud** (DNS only) on the apex and `www`
records. An orange-cloud (proxied) record terminates TLS at Cloudflare, so
GitHub can never complete the ACME challenge and will not issue the custom-domain
certificate. Grey cloud only.

### Renewal and account hygiene

- **Renewal reminder:** schedule a reminder (or registrar auto-renew) at least
  **30 days before** expiry; monitor the renewal price once a year by indexing
  registrar prices.
- **WHOIS privacy:** keep WHOIS privacy enabled.
- **2FA:** the registrar account email must be protected with two-factor
  authentication (2FA).
- **60-day transfer lock:** the first **60 days** after registration (or after a
  transfer) a transfer is impossible — do not plan a move inside that window.

### Trigger to revisit

If DNS moves away from GitHub Pages, or the registrar/price situation changes
(§13 roadmap triggers).

---

## Releases convention (spec §8.4) — heavy artifacts

Anything heavier than 1 MB or binary (zip packages, retina screenshots) is **not**
committed to the repository; it lives in a GitHub Release.

- **Tag:** `dump-<slug>-v<N>`, where `<slug>` is the dump slug and `N` starts at
  `1`, incrementing on each package version.
- **Attached asset:** `pack.zip` (for `type=pack`) and/or large assets.
- **Manifest reference:** in the dump's `manifest.json`, list it as an artifact
  of `kind="release"` with the download URL:

  ```json
  {
    "kind": "release",
    "path_or_url": "https://github.com/<owner>/kodavr/releases/download/dump-<slug>-v<N>/pack.zip"
  }
  ```

CI validates that `artifacts[].kind` is one of `file | release | url`; creating
the tag and uploading `pack.zip` is a manual step (no workflow does it yet).

### Trigger to revisit

If packaging/release creation is automated, or the artifact size cap in §8.1
changes.

---

## Monetisation options (spec §13) — documented, not implemented

§13 lists possible monetisation tiers as **options only**. None of them is
implemented (KDV-SCOPE-04: no paid tiers, no payments, no analytics); recording
them here satisfies "monetisation tiers documented only in `docs/decisions.md`"
without building them.

- **Hosted private instances** — run the registry for a closed organisation.
- **Verification** — a paid review of a `stakes=high` dump (the §13 audit
  service; never before a paying request).
- **Premium pack marketplace** — trade packaged `type=pack` dumps.
- **Integrations** — vendor/agent-toolchain adapters on top of the contract.

### Trigger to revisit

Paying demand actually appears. Until then §11 holds: no monetisation, no paid
tiers, no analytics.

---

## Moderation and social layer (spec §9) — runbook

Discussions, withdrawal, branch protection and auto-merge are owner-side GitHub
settings and one build-time contract. The settings cannot be verified locally;
this runbook is the operational source for them.

### Discussions = GitHub Issues (KDV-MOD-01, §9, §A3)

Comments do not live on the platform (§11). Every dump page links to the
repository's **GitHub Issues** (`https://github.com/krivich/kodavr/issues`) via
the "Issues / discuss" link; the same repository is advertised in
`/.well-known/kodavr.json`. One constant in the controller feeds both, so the
page and the discovery document cannot drift apart.

### Withdrawal (KDV-MOD-02 + KDV-CONTRACT-08, §5.6, §9)

URLs are immutable for life. Removing a dump is never a 404:

1. Set `"status": "withdrawn"` in the dump's `manifest.json`, plus a
   `withdrawal_reason` string (the stub must state the reason).
2. `status` is carried into the dump's `index.json` entry, and the manifest is
   still published at `/dumps/<slug>/manifest.json`.
3. The dump still renders at `/dumps/<slug>/` (`index.html`, HTTP 200 — never
   404); the body is replaced with the withdrawn stub. Nothing is deleted: the
   URL, the manifest card and git history are preserved.

Derived dumps keep referencing the parent through `derived_from`.

### Branch protection (KDV-MOD-04, §9)

`main` is protected:

- **Direct pushes are forbidden** — changes arrive only through pull requests.
- **Required status checks** must pass before a merge (the `validate` workflow).
- An author's **first PR is reviewed manually** by the owner; automatic trust
  starts only after that.
- **Unmerged = not published**: a PR that is not merged changes nothing, and the
  published site is unaffected.

### Auto-merge (KDV-MOD-03, §9)

The owner may grant **auto-merge** to a trusted author after **≥ 3 green PRs**.
Auto-merge applies **only when `validate` is fully green** — any failing status
check keeps the PR open for a human. Auto-merge is enabled by the owner, never
by the author (§7.7 rule 10).

### Black zones (KDV-CI-08, §2.5) — manual gate

Illegal content (CSAM, extremism, calls to violence, stolen data) is blocked
unconditionally. Two layers:

1. **Heuristic:** `config/black-zone.json` lists the categories and conservative,
   category-anchored patterns; `scripts/validate.mjs` scans every dump's text
   files and emits a `KDV-CI-08` BLOCK naming the file and category. The config
   is declarative (a file, not code) and detection is **best-effort**: a miss is
   not permission. A missing or malformed config fails visible — never a silent
   skip.
2. **Owner manual review:** every black-zone hit is handed to the owner. Such a
   PR is **not eligible for auto-merge** and cannot be cleared by any
   "content for machines" framing — §2.5 is unconditional.

### Trigger to revisit

If GitHub's branch-protection/auto-merge model changes, or moderation moves off
GitHub Issues.

---

## PR security audit — shadow mode (KDV-REVIEW-12/19/22)

The `audit` workflow (`.github/workflows/audit.yml`) runs the deterministic PR
audit (`scripts/audit-pr.mjs`) on every same-repo `pull_request`. It fetches the
diff and the author signals through the GitHub REST API — **no checkout** — and
publishes two advisory surfaces:

- a **sticky comment** marked `<!-- pr-audit -->`, updated in place on every push;
- a **status check** with the context `pr-audit`.

**Phase 0 is advisory by design.** `runAudit` forces the rendered action class to
`MANUAL` even when the policy recommends `MERGE`: a human decides and nothing is
merged automatically. The workflow holds one secret — the audit-only LLM key
(below) — and no merge token. The status is
`success` only when the envelope passes *and* the policy recommends `MERGE`; any
other outcome is `failure`. No numeric score is printed to the comment or the
status description (KDV-SCAN-15 stays open for the privacy phase).

The content gate reuses `scripts/validate.mjs`: the sibling step runs it with
`continue-on-error`, and its outcome is handed to the audit as
`AUDIT_CONTENT_GATE_OK` (`1` only on success), so a red content gate can never be
turned green from the PR text. Without a checkout the manifest body is not read
here — `facts` stays empty and the content gate is the only content signal.

**Fork PRs are skipped** — the job-level `if:` requires
`head.repo.full_name == github.repository`, and the CLI exits early on a fork
(KDV-CI-14, KDV-AUDIT-07). A fork's token is read-only and cannot comment.

Thresholds are the module defaults (`DEFAULT_MIN_ACCOUNT_AGE_DAYS`,
`DEFAULT_MAX_PRS_PER_DAY` in `scripts/lib/audit-envelope.mjs`); the §13.2
configuration is not wired yet.

### Enabling the status as a required check (not done)

Once Phase 0 has accumulated evidence, add `pr-audit` to the `main`
branch-protection required status checks (Settings → Branches). That — not the
comment — is what would gate a merge; it is deliberately **not** enabled now.
The "Branch protection (KDV-MOD-04)" section above lists `validate` as the
current required check.

### Trigger to revisit

When Phase 1 opens the first auto-class (KDV-REVIEW-13): the status becomes a
required check, the action class may leave `MANUAL`, and numeric scores must be
privatized (KDV-REVIEW-14, KDV-SCAN-15).

## Audit LLM key and the two-run judge ensemble (KDV-SCAN-07/08)

The `audit` workflow enables the LLM layers by handing `scripts/audit-pr.mjs`
three environment variables. The endpoint and model are **non-secret literals
pinned in `.github/workflows/audit.yml`** (currently the neuraldeep provider,
`https://api.neuraldeep.ru/v1/chat/completions`, model `gpt-oss-120b`); only the
API key is a secret.

**Creating the secret.** Repository → **Settings → Secrets and variables →
Actions → New repository secret**, name `AUDIT_LLM_API_KEY`, value = the
neuraldeep API key. The workflow references it as
`${{ secrets.AUDIT_LLM_API_KEY }}` **only** in `.github/workflows/audit.yml`; no
other workflow reads it (pinned by `tests/unit/ci.test.js`). Never commit the
key.

**Without the secret** `providerFromEnv` returns null, so `buildLlmChannels`
yields no LLM channels: the deterministic audit (envelope + structural detectors
+ policy) still runs and posts its advisory comment and status. A secret that is
present but whose provider call fails degrades to a single visible `llm-error`
flag channel (THINK), never a silent merge.

**The ensemble always runs twice** (pr-audit §4.5.6). The primary judge runs
under the default framing; the second run uses a different **prompt framing** —
the same model under `JUDGE_SYSTEM_SKEPTICAL` (adversarial posture), not a second
model. The two readings are reduced into one `llm-judge-ensemble` channel;
agreement keeps the strictest verdict, divergence yields THINK. A prod model that
does not satisfy the strict JSON shape cannot be relied on as a second judge,
which is why the framing, not a second model, is the default second run.

**Optional second model.** Setting `AUDIT_LLM_MODEL_2` in the workflow env
overrides the second run: it then calls that model under the default framing
instead of the same model under the skeptical framing. It is not set in
`audit.yml` today.
