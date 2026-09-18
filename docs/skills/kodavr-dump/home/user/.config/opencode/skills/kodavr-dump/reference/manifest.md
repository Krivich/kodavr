# Manifest reference — `content/dumps/<slug>/manifest.json`

Authoritative source: `docs/SPEC.md` §4.1 and `scripts/validate.mjs` in the
Kodavr repo. This file mirrors the rules so the skill works without the repo
present; the repo validator is still the gate.

## Required fields

| field | type | rules |
|---|---|---|
| `slug` | string | `^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*$`; MUST equal the directory name; globally unique |
| `type` | enum | `note` \| `case` \| `pack` |
| `title` | string | non-empty |
| `date` | string | `YYYY-MM-DD`, a real calendar date, not in the future |
| `domain` | enum | `engineering` \| `finance` \| `art` \| `law` \| `science` \| `education` \| `other` |
| `tags` | string[] | lowercase; `^[a-z0-9-]+$` |
| `stakes` | enum | `low` \| `medium` \| `high` |
| `content_flags` | string[] | may be `[]`; entries from the vocabulary below |
| `trust_level` | enum | `raw` \| `self-tested` \| `community-tested` \| `adapted` \| `library` |
| `generated_by` | enum | `human` \| `agent` \| `hybrid` |
| `human_review` | enum | `none` \| `minimal` \| `attested` |
| `summary` | string | 1–3 sentences; the **hook** a stranger sees in the feed — lead with why it matters, not a feature list (the validator counts sentence terminators) |

## Optional fields

| field | type | rules |
|---|---|---|
| `verification` | enum | `executable` \| `checkable` \| `subjective` |
| `status` | enum | `published` (default) \| `withdrawn`; `withdrawn` requires non-empty `withdrawal_reason` |
| `license` | string | default `CC-BY-4.0`; code in a dump is additionally MIT unless stated otherwise |
| `sources` | string[] | `chat-log` \| `source-code` \| `tests` \| `traces`; `chat-log` ⇒ `REDACTIONS.md` required |
| `layers` | object[] | if present: non-empty; each `{name,file,fact_checked,author_voice}`; MUST include `{name:"raw",file:"raw.md",...}` |
| `artifacts` | object[] | each `{kind, path_or_url, note?}`, kind ∈ `file` \| `release` \| `url`; `file` paths must resolve (dump dir or repo root) |
| `derived_from` | string \| null | a valid parent slug or `null` |
| `consumption_contract` | object | if present, `see` must be `/.well-known/kodavr.json` |
| `personal_data_justification` | string | allows personal data without `REDACTIONS.md` |
| `author` | object \| null | DO NOT set by hand — injected from the merged PR (`github`, `pr_url`, `merged_at`) |

## `content_flags` vocabulary (closed)

`unverified_claims`, `professional_advice`, `financial_advice`,
`medical_claims`, `rough_language`, `opinion`, `experimental`,
`contains_code`, `requires_expert_review`.

## Conditional rules

- `type: pack` ⇒ directory must contain `SETUP_AGENT.md`, `START_HERE.md`,
  `files/`, `checks/`.
- `stakes: high` ⇒ `content_flags` must be non-empty; the §7.9 disclaimer is
  inserted into the rendered body automatically.
- `sources` contains `chat-log` ⇒ `REDACTIONS.md` required in the dump dir.
- An agent-written dump (`generated_by: agent|hybrid`) ⇒ attach `summary.md`
  (CONTRIBUTING rule 12). Treat it as mandatory in practice.
- Personal data detected (emails, phones, document numbers) ⇒ `REDACTIONS.md`
  or `personal_data_justification`, otherwise BLOCK.

## Size / binary rules

- Each file ≤ 1 MB; whole dump ≤ 20 MB.
- Binaries only as `assets/*.png`, `assets/*.svg`, `assets/*.puml`.
- Anything heavier goes to a GitHub Release; manifest uses
  `artifacts[].kind = "release"` with URL
  `https://github.com/<owner>/kodavr/releases/download/dump-<slug>-v<N>/<file>`.

## Minimal valid example (agent-written case)

```json
{
  "slug": "2026-09-18-example-agent-workflow",
  "title": "A short, concrete title",
  "type": "case",
  "domain": "engineering",
  "date": "2026-09-18",
  "stakes": "low",
  "trust_level": "self-tested",
  "content_flags": ["contains_code"],
  "tags": ["open-code", "workflow", "automation"],
  "generated_by": "agent",
  "human_review": "attested",
  "verification": "checkable",
  "license": "CC-BY-4.0",
  "summary": "One to three sentences. What problem it solves, what the reader's agent can reuse.",
  "sources": ["chat-log", "source-code"],
  "layers": [
    { "name": "raw", "file": "raw.md", "fact_checked": false, "author_voice": true },
    { "name": "summary", "file": "summary.md", "fact_checked": false, "author_voice": true }
  ],
  "artifacts": [
    { "kind": "file", "path_or_url": "raw.md", "note": "the dump body" }
  ],
  "derived_from": null
}
```

(`sources: ["chat-log"]` in the example means `REDACTIONS.md` must ship too.)

## Markdown body notes

- Exactly one H1 in each markdown layer (duplicate H1 is a WARN).
- Internal links `](path)` must resolve relative to the dump dir or repo root;
  external `http(s)://`/`#` links are exempt. In-page `](#anchor)` targets must
  match a real heading (WARN otherwise).
- Fenced code blocks are fine; the secret/black-zone scan still reads them.
