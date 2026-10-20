# While HR fights AI-inflated resumes, we build a genuine resume from work traces

This is a field report about a method, not about a specific person. It describes how to turn raw work logs into a profile where every claim can be traced to evidence, and why the same recipe transfers to other tools. Real results, project names, quotes, and personal data are not part of this dump; the examples below are synthetic.

## Problem

A resume is a self-report. A certification is a test on a sample. Work logs are traces of real decisions, actions, and consequences, but they are scattered, noisy, and sensitive.

The naive path is to hand a model the entire history and ask it to "tell me about this person." The result is usually a smooth text that is hard to verify: the model averages projects, confuses communication style with decisions, and readily flatters. The more data you feed it, the more convincing the output looks — and the less evidence it contains.

What is needed is a method that:

- separates evidence from interpretation;
- preserves conflicts between projects instead of erasing them;
- does not turn log analysis into surveillance;
- leaves a trace that lets someone challenge the conclusion.

## What we did

We used one dense source — logs from the OpenCode agent environment — and ran them through a fixed pipeline. OpenCode is not required here: the density of the trace matters more than the brand of the tool.

1. **Set the boundaries.** One project, a fixed time window, root sessions only. This keeps the user's decisions separate from agent execution and from other projects.
2. **Filtered the noise.** Kept user messages below a length threshold, removed batch/automation sessions and global/temp contexts, and removed duplicates. The threshold and exclusion rules must be written down, or the result is not reproducible.
3. **Built a baseline.** Computed aggregates by project, tool, time, and cost, then wrote a first narrative. The baseline is a hypothesis, not the truth.
4. **Ran per-project critique.** One call per project: the baseline plus a sample of messages. The model is not asked to "understand the person"; it is asked to find what is supported, what is contradicted, and what is missing.
5. **Merged the results.** A separate call received the baseline and all project-level corrections. Its job was to assemble the final profile, preserve disagreements, and state the limits explicitly.
6. **Kept the trace.** Corrections, model responses, usage, and the final report are stored separately. This makes it possible to return to the same slice and check the conclusion instead of retelling it.

The pipeline deliberately avoids one "magic" call. The split into baseline → critique → merge matters more than the choice of model: it prevents one averaged answer from replacing a set of local observations.

## Why OpenCode, and why it is not required

OpenCode is convenient because intent, action, and outcome live in one place:

- a user message can be linked to a tool call, a diff, a test, an error, and the next correction;
- project, session, parent/child, and timestamps provide context: what came before and what happened after;
- tokens, cost, and iteration count show the price of attention;
- a read-only database and stable IDs make it possible to return to the same slice.

This does not make logs "objective." It makes them dense and connected: there is less to guess and more to show.

If the reader has a different stack, they need at least one source of **intent** and one source of **consequence**.

| Source | What it gives | What it lacks |
|---|---|---|
| Slack / Teams / Mattermost | Framing, veto, and bridging in threads | Consequences: decisions, artifacts, metrics |
| Jira / Linear / GitHub | Decisions, priorities, outcomes | Reasoning: why this option was chosen |
| Zoom / Meet transcripts | Extended framing and abstraction shift | Actions, veto, consequences |
| Email / Jabber | Explicit decisions and agreements | Structure, context, links to artifacts |
| IDE / agent logs (OpenCode, Claude Code) | A dense trace of action | Privacy and boundaries; often a single tool |

If you only have chat, you get a communication profile, not a work profile. If you have chat + tickets + repository, you can talk about decisions. A composition of two or three sources with shared IDs is usually more useful than one "perfect" source.

## Contract: what we actually fixed

The table below is not a universal standard. It is our contract: decisions and invariants that can be repeated.

| What we did | Why | What to replace it with in another stack |
|---|---|---|
| Read the database read-only, chose a window and root sessions | Do not mutate the source; separate user decisions from agent execution | Chat/transcript export; filter by owner and session type |
| Used the project as the unit, not an individual message | Do not mix contexts or build a profile from random messages | Channel, repository, ticket project, meeting |
| Filtered user text by length, kept substantive sessions, removed batch/global/temp | Remove automation and noise; keep decisions | Your own threshold and exclusions; the important part is to write them down |
| Built a baseline: aggregates + narrative | Get a hypothesis to test, not the truth | Your own metrics summary and first profile |
| One LLM call per project: baseline + message sample | Local critique does not drown in a global average | Any model; the important part is "critique with evidence" |
| A separate merge call over all corrections | Resolve conflicts instead of losing them | Your own aggregator; preserve disagreements |
| Kept report, corrections, calls, usage | Leave a trace and make audit possible | JSONL/CSV + report; record the model and date |

Invariants: do not hide cost or volume, do not make a claim without evidence, do not mix projects, do not present the baseline as final, and preserve limitations and conflicting versions.

### Minimal claim schema

One unit of output is not a "personality trait"; it is a claim with a link to evidence.

```json
{
  "claim": "In this project, the person first reduces scope, then fixes acceptance criteria.",
  "scope": { "project": "project-a", "period": "2026-01-01..2026-02-01" },
  "evidence": [
    { "kind": "message", "ref": "session-1#msg-4", "quote": "let's ship the smaller version first" },
    { "kind": "artifact", "ref": "release-notes#v0.1", "quote": "scope reduced to the first milestone" }
  ],
  "interpretation": { "lever": "framing" },
  "confidence": 0.7,
  "counterevidence": ["in another project, scope expanded instead"],
  "limitations": ["one project, small sample"]
}
```

`lever` is an interpretive lens, not a diagnosis. If it is not useful, keep only `claim`, `evidence`, `confidence`, and `counterevidence`.

## Prompts

There are three model roles, plus a human pass. Do not mix the model roles: one model can perform all three calls, but the context should be different.

### 1. Baseline audit

```text
You are a profile auditor. Below is a baseline built from logs. It is a hypothesis, not the truth.

Your task:
1) find claims supported by evidence;
2) find claims contradicted by evidence;
3) find important themes missing from the baseline;
4) state limitations and conflicts explicitly.

Rules:
- do not flatter and do not "fill in" the person;
- support every conclusion with a link to a message, action, or artifact;
- if there is no evidence, write "insufficient data";
- do not turn communication style into a personality trait.

Baseline:
{baseline}

Evidence:
{sample}
```

### 2. Per-project critique

```text
You are analyzing one project, not the whole person.

Input:
- the profile baseline;
- a sample of the user's messages for {project};
- where available, links to artifacts and outcomes.

Return:
1. what is supported (with evidence);
2. what is contradicted (with evidence);
3. what is missing for a conclusion;
4. how this project differs from the baseline;
5. what limits this slice has.

Do not mix this project with others. Do not draw conclusions about the person outside this context.
```

### 3. Merge

```text
Below are the baseline and N independent project audits.

Assemble a final profile, but:
- preserve disagreements between projects;
- do not average conflicting observations;
- separate evidence from interpretation;
- keep an evidence link for every strong claim;
- list the limits and what cannot be claimed from this data.

Response format:
1. summary;
2. supported strengths;
3. supported limitations;
4. conflicts and uncertainties;
5. what to check next.
```

### 4. Self-review (human, not a model call)

The model's output is a draft of a mirror, not a verdict. The person marks each claim:

- **recognized** — "yes, this is what I do";
- **not recognized** — "the evidence is there, but the interpretation is wrong";
- **want to develop** — "this is a gap I want to close";
- **private** — "true, but not for sharing".

This pass is what turns a profile into agency. Without it, the model defines the person; with it, the person edits the mirror.

## Ideas for better prompts (do it yourself)

The prompts above are a floor, not a ceiling. These are moves worth testing on the same slice. Change one variable at a time, and keep an idea only if it survives a second project.

### Turn up strictness: red-team the draft

Run a second call whose only job is to attack the first draft:

- Which claims are flattery?
- Which claims would survive if the person's title were removed?
- Which claims are inferred from one message and stated as a pattern?
- What would a skeptical hiring manager challenge first?
- What evidence is missing for the strongest claim?

Merge only what survives both the advocate and the skeptic. Keep the disagreements visible; they are often the most honest part of the profile.

### Reconstruct time and overlap

Timestamps are an underused dimension. Ask:

- Which projects were active at the same time?
- What was the order of decisions, not just the final state?
- Where did waiting, rework, or context switching dominate?
- Which long-running threads show persistence, and which are just slow replies?
- What did the person return to after an interruption?
- What was touched, what was owned, and what was merely blocked?

Caveat: timestamps show activity, not importance. A fast reply can be shallow; a slow one can be deep work.

### Compare self-description with evidence

Extract the phrases where the person minimizes their work: "just", "only", "helped with", "wired up", "minor". Compare them with the actual change, duration, and outcome. Ask the model to flag underclaiming separately from overclaiming. Show the gap; do not rewrite the person's voice.

### Put evidence discipline in the prompt

- One claim, one evidence pointer.
- Quote the smallest span that supports the claim.
- Label confidence: strong, weak, unknown.
- If the only evidence is the person's own summary, mark it as self-report, not observation.
- Ask for disconfirming evidence for every strength.

### Mine invisible and glue work

Ask what the person did that does not produce a clean artifact:

- Who did they unblock, translate for, or mentor?
- What did they maintain without shipping a feature?
- What did they decide when no one asked?
- What did they delete or simplify?
- What did they inherit and fix?

This work is often missing from resumes because it has no obvious deliverable.

### Run counterfactual tests

- Remove the person's title and see what the evidence still supports.
- Remove the biggest project and see what remains.
- Shrink the window to three months and see what is stable.
- Ask: "what would change this conclusion?" If nothing would, the claim is unfalsifiable.

### Use several critics, not one voice

Run three roles on the same slice: a skeptical operator, a teacher, and a maintainer. Merge only the claims they independently support. Keep the disagreements as questions for the person.

### Ask for questions, not verdicts

A model that asks "what did you mean by this?" is often more useful than one that concludes. Add a final instruction: "List the five questions you would ask the person before making this claim." Put them in the human self-review.

### Keep a prompt log and a holdout

Freeze one slice and one model; change one instruction; compare evidence coverage, unsupported claims, and useful surprises. Keep a log of model, version, temperature, token budget, and prompt hash. Re-test on a project you did not use while writing the prompt.

### Redact before you publish

Run a redaction pass before any output: names, paths, tokens, customer data, private URLs. Ask the model to list what it would remove, then verify by hand. Privacy is a prompt constraint, not a post-processing step.

## How to reproduce

### 1. Open the source read-only

For SQLite, use a URI with `mode=ro`; do not write to the live database.

```python
import sqlite3

DB = "file:path/to/opencode.db?mode=ro"
con = sqlite3.connect(DB, uri=True)
```

### 2. Find projects and root sessions

The schema depends on the tool version. In our version the tables were `session`, `message`, `part`, and `project`. Check your own schema before querying.

```sql
SELECT id, project_id, parent_id, title, time_created
FROM session
WHERE parent_id IS NULL
ORDER BY time_created;
```

### 3. Extract messages and filter noise

```python
import hashlib

def keep(text: str, max_chars: int = 1000) -> bool:
    if not text or len(text) >= max_chars:
        return False
    return True

def dedupe(rows):
    seen = set()
    for row in rows:
        h = hashlib.sha1(row["text"].encode("utf-8")).hexdigest()
        if h in seen:
            continue
        seen.add(h)
        yield row
```

Rules to write down before the run:

- minimum and maximum message length;
- minimum number of messages per session;
- exclusion of batch/automation and global/temp;
- deduplication by hash;
- time window and project boundaries.

### 4. Build the baseline

The baseline is aggregates plus a short narrative. Do not call it a final profile. It should contain:

- which projects and periods are in the slice;
- how many messages, sessions, and actions;
- which themes repeat;
- which data you cannot see;
- which conclusions are preliminary.

### 5. Run the critique calls

For each project:

1. take the baseline and a sample of messages;
2. call the model with the "Per-project critique" prompt;
3. store the response in `corrections/<project>.md`;
4. record the model, date, tokens, and cost in `calls.jsonl`.

Set a budget and limits before the run. If the model returns generic text without evidence links, the call is a failure.

### 6. Merge and review

The merge receives all corrections. A human then checks:

- whether any claim lacks evidence;
- whether conflicts were lost;
- whether third-party personal data got into the text;
- whether the baseline was presented as final;
- whether the text reads like a flattering resume.

### 7. What one run costs

One real run on a single project, with a 20k-character sample and `deepseek-v4.1-flash` at $0.15/$0.60 per 1M input/output tokens, cost about **$0.01**:

- critique: 6,116 in / 6,377 out (4,287 reasoning) = ~$0.0047;
- merge: 2,631 in / 8,722 out (5,516 reasoning) = ~$0.0056;
- one empty 6k-token attempt: 6,116 in / 6,000 out, all reasoning = ~$0.0045.

Treat these as order-of-magnitude, not a cross-model price list. The model and provider set the price: a Claude model on the same endpoint rejected the OpenAI protocol and would need a different adapter and different rates. Cost scales with sample size, number of projects, and output budget. Extraction is cheap; sending a large sample to a reasoning model is not. Check `finish_reason` and reasoning tokens before paying for a merge.

## Reference script

The snippets above show the shape; this is a runnable reference. It uses only the Python standard library. It reads a read-only SQLite log database or an existing JSONL export, filters records, builds a deterministic baseline, calls an OpenAI-compatible endpoint once per project, merges the corrections, and verifies the outputs. No API key is stored in the file; the script reads it from an environment variable.

Smoke-tested with synthetic JSONL and SQLite fixtures and a mock OpenAI-compatible endpoint, then run end-to-end on a real OpenCode database and a live OpenAI-compatible provider (one project, `deepseek-v4.1-flash`, about $0.01). Treat it as a script plus a recipe, not a turnkey tool: your AI agent should adapt the extractor and prompts to your stack while keeping the filter, evidence, and verification invariants.

The SQL assumes an OpenCode-like schema (`part`, `message`, `session`, `project`). For another tool, either adapt `extract_records()` or export JSONL and pass it with `--input`. For Slack or Mattermost, map messages and threads to the same record shape; for Claude Code or another agent log, map its session/event export. The rest of the pipeline is source-agnostic.

Run order:

```powershell
python scripts/profile_from_logs.py extract --db path/to/logs.db --out out
python scripts/profile_from_logs.py filter --out out
python scripts/profile_from_logs.py baseline --out out
$env:LLM_API_KEY = "..."
python scripts/profile_from_logs.py critique --out out --base-url https://api.openai.com/v1 --model gpt-4o-mini
python scripts/profile_from_logs.py merge --out out --base-url https://api.openai.com/v1 --model gpt-4o-mini
python scripts/profile_from_logs.py verify --out out
```

### scripts/profile_from_logs.py

```python
#!/usr/bin/env python3
"""
Reference pipeline: work logs -> evidence-backed profile.

Stages:
  extract   read a read-only SQLite log DB (or an existing JSONL export)
  filter    keep substantive user messages, dedupe, write project slices
  baseline  deterministic aggregates + a short hypothesis
  critique  one OpenAI-compatible LLM call per project
  merge     one LLM call over all corrections
  verify    secret/personal-data scan and output sanity checks

No secrets are stored in this file. Set the API key via an environment variable.
"""

import argparse
import hashlib
import json
import os
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

DEFAULT_BASE_URL = "https://api.openai.com/v1"
DEFAULT_MODEL = "gpt-4o-mini"
DEFAULT_MAX_CHARS = 1000
DEFAULT_DAYS = 120
DEFAULT_OUTPUT_LIMIT = 4000

SENSITIVE_PATTERNS = [
    r"sk-[A-Za-z0-9_-]{10,}",
    r"st_[A-Za-z0-9_-]{10,}",
    r"ghp_[A-Za-z0-9]{20,}",
    r"github_pat_[A-Za-z0-9_]+",
    r"xox[baprs]-[A-Za-z0-9-]+",
    r"AKIA[0-9A-Z]{16}",
    r"Bearer\s+[A-Za-z0-9._-]+",
    r"OPENCODE_[A-Z_]+\s*=\s*\S+",
    r"x-opencode-[a-z-]+\s*[:=]\s*\S+",
    r"api[_-]?key\s*[:=]\s*\S+",
    r"password\s*[:=]\s*\S+",
]

PERSONAL_PATTERNS = [
    r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
]

PHONE_CANDIDATE = re.compile(r"\+?\d[\d ()-]{8,}\d")


def find_phone(text):
    for match in PHONE_CANDIDATE.finditer(text):
        digits = re.sub(r"\D", "", match.group(0))
        if 10 <= len(digits) <= 15:
            return match.group(0)
    return None

CRITIQUE_PROMPT = """You are analyzing one project, not the whole person.

Input:
- the profile baseline;
- a sample of the user's messages for {project};
- where available, links to artifacts and outcomes.

Return:
1. what is supported (with evidence);
2. what is contradicted (with evidence);
3. what is missing for a conclusion;
4. how this project differs from the baseline;
5. what limits this slice has.

Do not mix this project with others. Do not draw conclusions about the person
outside this context. Do not flatter. If there is no evidence, say so.

Baseline:
{baseline}

Sample:
{sample}
"""

MERGE_PROMPT = """Below are the baseline and {count} independent project audits.

Assemble a final profile, but:
- preserve disagreements between projects;
- do not average conflicting observations;
- separate evidence from interpretation;
- keep an evidence link for every strong claim;
- list the limits and what cannot be claimed from this data.

Response format:
1. summary;
2. supported strengths;
3. supported limitations;
4. conflicts and uncertainties;
5. what to check next.

Baseline:
{baseline}

Project audits:
{corrections}
"""


def log(message):
    print("[%s] %s" % (time.strftime("%H:%M:%S"), message), flush=True)


def read_jsonl(path):
    rows = []
    with Path(path).open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def write_jsonl(path, rows):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")


def db_connect(path):
    return sqlite3.connect(
        "file:%s?mode=ro" % Path(path).as_posix(),
        uri=True,
        timeout=30,
    )


def keep_project(project, include_global=False):
    p = (project or "").replace("\\", "/")
    if not p or p == "?":
        return False
    if p == "/" and not include_global:
        return False
    if "/AppData/Local/Temp/" in p:
        return False
    return True


def slugify(value):
    raw = (value or "project").replace("\\", "/").strip("/").replace(":", "")
    out = "".join(c if c.isalnum() or c in "._-" else "_" for c in raw)
    out = out.strip("_") or "project"
    if len(out) > 70:
        out = out[:60] + "_" + hashlib.sha1(raw.encode("utf-8")).hexdigest()[:8]
    return out


def extract_records(db_path, days, max_chars, include_global=False):
    if days < 1 or days > 36500:
        raise SystemExit("--days must be between 1 and 36500")
    cutoff = int((datetime.now() - timedelta(days=days)).timestamp() * 1000)
    sql = """
    SELECT s.id AS session_id,
           COALESCE(pr.worktree, '?') AS project,
           p.time_created AS ts,
           json_extract(p.data, '$.text') AS text,
           COALESCE(s.cost, 0) AS cost
      FROM part p
      JOIN message m ON m.id = p.message_id
      JOIN session s ON s.id = p.session_id
      LEFT JOIN project pr ON pr.id = s.project_id
     WHERE p.time_created >= ?
       AND s.parent_id IS NULL
       AND json_extract(p.data, '$.type') = 'text'
       AND json_extract(m.data, '$.role') = 'user'
       AND length(COALESCE(json_extract(p.data, '$.text'), '')) > 0
       AND length(json_extract(p.data, '$.text')) < ?
     ORDER BY p.time_created
    """
    con = db_connect(db_path)
    try:
        rows = con.execute(sql, (cutoff, max_chars)).fetchall()
    finally:
        con.close()

    records = []
    for session_id, project, ts, text, cost in rows:
        if not keep_project(project, include_global):
            continue
        text = (text or "").strip()
        if not text:
            continue
        records.append({
            "project": project,
            "session_id": session_id,
            "role": "user",
            "ts": int(ts),
            "text": text,
            "cost": float(cost or 0),
        })
    return records


def load_input(path):
    rows = read_jsonl(path)
    required = {"project", "session_id", "role", "ts", "text"}
    for row in rows:
        missing = required - set(row)
        if missing:
            raise SystemExit("input record is missing fields: %s" % sorted(missing))
    return rows


def filter_records(records, max_chars, include_global=False, include_short=False):
    by_session = {}
    for row in records:
        key = (row["project"], row["session_id"])
        by_session.setdefault(key, []).append(row)

    substantive = set()
    for key, items in by_session.items():
        cost = sum(float(item.get("cost", 0)) for item in items)
        if include_short or len(items) >= 4 or cost >= 0.005:
            substantive.add(key)

    seen = set()
    out = []
    for row in records:
        if not keep_project(row.get("project"), include_global):
            continue
        text = (row.get("text") or "").strip()
        if not text or len(text) >= max_chars:
            continue
        key = (row["project"], row["session_id"])
        if key not in substantive:
            continue
        digest = hashlib.sha1(text.encode("utf-8")).hexdigest()
        dedupe_key = (row["project"], digest)
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        out.append(row)
    out.sort(key=lambda item: int(item["ts"]))
    return out


def group_projects(records):
    projects = {}
    for row in records:
        projects.setdefault(row["project"], []).append(row)
    return projects


def build_baseline(records):
    projects = group_projects(records)
    lines = [
        "# Baseline (hypothesis, not a final profile)",
        "",
        "This baseline is deterministic aggregates plus a short narrative. "
        "It is a hypothesis to test with project-level critique.",
        "",
        "| Project | Messages | Sessions | Characters | First | Last |",
        "|---|---:|---:|---:|---|---|",
    ]
    for project in sorted(projects):
        items = projects[project]
        sessions = {item["session_id"] for item in items}
        chars = sum(len(item["text"]) for item in items)
        first = datetime.fromtimestamp(min(int(i["ts"]) for i in items) / 1000).date().isoformat()
        last = datetime.fromtimestamp(max(int(i["ts"]) for i in items) / 1000).date().isoformat()
        lines.append("| %s | %d | %d | %d | %s | %s |" % (
            project, len(items), len(sessions), chars, first, last
        ))
    lines.extend([
        "",
        "## What this baseline can and cannot say",
        "",
        "- It describes the selected slice, not the whole person.",
        "- It does not establish quality, seniority, or intent.",
        "- It must be checked against artifacts and outcomes.",
        "- Missing sources are a limit, not evidence of absence.",
        "",
    ])
    return "\n".join(lines), projects


def call_llm(base_url, api_key, model, messages, max_tokens):
    url = base_url.rstrip("/") + "/chat/completions"
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": max_tokens,
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer %s" % api_key,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError("LLM HTTP %s: %s" % (exc.code, body))
    content = data["choices"][0]["message"]["content"]
    usage = data.get("usage", {})
    return content, usage


def cost_usd(usage, price_in, price_out):
    return (
        float(usage.get("prompt_tokens", 0)) * price_in
        + float(usage.get("completion_tokens", 0)) * price_out
    ) / 1_000_000


def sample_text(items, max_messages, max_chars):
    parts = []
    used = 0
    for item in items[:max_messages]:
        text = item["text"]
        if used + len(text) > max_chars:
            break
        parts.append("- " + text)
        used += len(text)
    return "\n".join(parts)


def scan_files(paths):
    errors = []
    warnings = []
    for path in paths:
        path = Path(path)
        if not path.exists():
            errors.append("missing output: %s" % path)
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for pattern in SENSITIVE_PATTERNS:
            if re.search(pattern, text, re.I):
                errors.append("secret-like pattern in %s: %s" % (path, pattern))
        for pattern in PERSONAL_PATTERNS:
            if re.search(pattern, text, re.I):
                warnings.append("possible personal data in %s: %s" % (path, pattern))
        phone = find_phone(text)
        if phone:
            warnings.append("possible phone number in %s" % path)
    return errors, warnings


def cmd_extract(args):
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    if args.input:
        records = load_input(args.input)
        source = args.input
    else:
        if not args.db:
            raise SystemExit("extract needs --db or --input")
        records = extract_records(args.db, args.days, args.max_chars, args.include_global)
        source = args.db
    target = out / "private" / "records.jsonl"
    write_jsonl(target, records)
    log("extracted %d user records from %s -> %s" % (len(records), source, target))


def cmd_filter(args):
    out = Path(args.out)
    records = read_jsonl(out / "private" / "records.jsonl")
    filtered = filter_records(
        records,
        max_chars=args.max_chars,
        include_global=args.include_global,
        include_short=args.include_short,
    )
    write_jsonl(out / "private" / "filtered.jsonl", filtered)
    projects = group_projects(filtered)
    write_jsonl(out / "private" / "projects.json", [
        {"project": project, "messages": len(items)}
        for project, items in sorted(projects.items())
    ])
    log("kept %d/%d records across %d projects" % (len(filtered), len(records), len(projects)))


def cmd_baseline(args):
    out = Path(args.out)
    records = read_jsonl(out / "private" / "filtered.jsonl")
    baseline, projects = build_baseline(records)
    (out / "baseline.md").write_text(baseline + "\n", encoding="utf-8")
    (out / "baseline.json").write_text(
        json.dumps(
            {project: len(items) for project, items in sorted(projects.items())},
            ensure_ascii=False,
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )
    log("wrote baseline for %d projects" % len(projects))


def cmd_critique(args):
    out = Path(args.out)
    records = read_jsonl(out / "private" / "filtered.jsonl")
    projects = group_projects(records)
    baseline = (out / "baseline.md").read_text(encoding="utf-8")
    corrections_dir = out / "corrections"
    corrections_dir.mkdir(parents=True, exist_ok=True)
    calls_path = out / "calls.jsonl"
    index_path = corrections_dir / "index.json"
    index_entries = []
    index_path.write_text("[]\n", encoding="utf-8")
    total_cost = 0.0
    api_key = os.environ.get(args.api_key_env, "")
    if not api_key and not args.dry_run:
        raise SystemExit("set %s or pass --dry-run" % args.api_key_env)

    for index, project in enumerate(sorted(projects), 1):
        if args.max_projects and index > args.max_projects:
            break
        items = projects[project]
        sample = sample_text(items, args.sample_messages, args.sample_chars)
        prompt = CRITIQUE_PROMPT.format(project=project, baseline=baseline, sample=sample)
        if args.dry_run:
            target = corrections_dir / (slugify(project) + ".prompt.txt")
            log("dry-run: would critique %s (%d messages)" % (project, len(items)))
            target.write_text(prompt + "\n", encoding="utf-8")
            index_entries.append({"project": project, "file": target.name, "dry_run": True})
            index_path.write_text(json.dumps(index_entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            continue
        target = corrections_dir / (slugify(project) + ".md")
        log("critique %s (%d messages)" % (project, len(items)))
        content, usage = call_llm(
            args.base_url, api_key, args.model,
            [{"role": "user", "content": prompt}],
            args.max_tokens,
        )
        target.write_text(content.strip() + "\n", encoding="utf-8")
        index_entries.append({"project": project, "file": target.name, "dry_run": False})
        index_path.write_text(json.dumps(index_entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        total_cost += cost_usd(usage, args.price_in, args.price_out)
        with calls_path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps({
                "stage": "critique",
                "project": project,
                "model": args.model,
                "usage": usage,
                "cost_usd": round(total_cost, 6),
            }, ensure_ascii=False) + "\n")
        if args.budget_usd and total_cost > args.budget_usd:
            raise SystemExit("budget exceeded: $%.4f > $%.4f" % (total_cost, args.budget_usd))
    log("critique done; total cost $%.4f" % total_cost)


def load_correction_paths(out):
    index_path = out / "corrections" / "index.json"
    if index_path.exists():
        entries = json.loads(index_path.read_text(encoding="utf-8"))
        return [
            out / "corrections" / entry["file"]
            for entry in entries
            if not entry.get("dry_run")
        ]
    return sorted((out / "corrections").glob("*.md"))


def cmd_merge(args):
    out = Path(args.out)
    baseline = (out / "baseline.md").read_text(encoding="utf-8")
    corrections = []
    for path in load_correction_paths(out):
        if path.exists() and path.suffix == ".md":
            corrections.append("## %s\n\n%s" % (path.stem, path.read_text(encoding="utf-8")))
    if not corrections:
        raise SystemExit("no corrections found; run critique first")
    prompt = MERGE_PROMPT.format(
        count=len(corrections),
        baseline=baseline,
        corrections="\n\n".join(corrections),
    )
    if args.dry_run:
        (out / "report.prompt.txt").write_text(prompt, encoding="utf-8")
        log("dry-run: wrote report prompt")
        return
    api_key = os.environ.get(args.api_key_env, "")
    if not api_key:
        raise SystemExit("set %s" % args.api_key_env)
    content, usage = call_llm(
        args.base_url, api_key, args.model,
        [{"role": "user", "content": prompt}],
        args.max_tokens,
    )
    (out / "report.md").write_text(content.strip() + "\n", encoding="utf-8")
    with (out / "calls.jsonl").open("a", encoding="utf-8") as fh:
        fh.write(json.dumps({
            "stage": "merge",
            "model": args.model,
            "usage": usage,
            "cost_usd": round(cost_usd(usage, args.price_in, args.price_out), 6),
        }, ensure_ascii=False) + "\n")
    log("wrote report.md")


def cmd_verify(args):
    out = Path(args.out)
    correction_paths = load_correction_paths(out)
    targets = [out / "baseline.md", out / "report.md"] + correction_paths
    errors, warnings = scan_files(targets)
    report = out / "report.md"
    if not correction_paths:
        errors.append("no corrections found")
    if report.exists():
        text = report.read_text(encoding="utf-8").lower()
        for word in ("conflict", "limitation"):
            if word not in text:
                warnings.append("report.md does not mention %s" % word)
    if report.exists() and not (out / "calls.jsonl").exists():
        warnings.append("calls.jsonl is missing")
    for warning in warnings:
        print("WARN:", warning)
    for error in errors:
        print("ERROR:", error)
    if errors:
        raise SystemExit(1)
    print("verify: %d warning(s), 0 error(s)" % len(warnings))


def add_common(parser):
    parser.add_argument("--out", required=True, help="output directory")
    parser.add_argument("--max-chars", type=int, default=DEFAULT_MAX_CHARS)
    parser.add_argument("--include-global", action="store_true")
    parser.add_argument("--include-short", action="store_true")


def add_llm(parser):
    parser.add_argument("--base-url", default=os.environ.get("LLM_BASE_URL", DEFAULT_BASE_URL))
    parser.add_argument("--model", default=os.environ.get("LLM_MODEL", DEFAULT_MODEL))
    parser.add_argument("--api-key-env", default="LLM_API_KEY")
    parser.add_argument("--max-tokens", type=int, default=DEFAULT_OUTPUT_LIMIT)
    parser.add_argument("--price-in", type=float, default=0.0, help="USD per 1M input tokens")
    parser.add_argument("--price-out", type=float, default=0.0, help="USD per 1M output tokens")
    parser.add_argument("--budget-usd", type=float, default=0.0)
    parser.add_argument("--dry-run", action="store_true")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("extract")
    add_common(p)
    p.add_argument("--db")
    p.add_argument("--input", help="existing JSONL export")
    p.add_argument("--days", type=int, default=DEFAULT_DAYS)
    p.set_defaults(func=cmd_extract)

    p = sub.add_parser("filter")
    add_common(p)
    p.set_defaults(func=cmd_filter)

    p = sub.add_parser("baseline")
    add_common(p)
    p.set_defaults(func=cmd_baseline)

    p = sub.add_parser("critique")
    add_common(p)
    add_llm(p)
    p.add_argument("--sample-messages", type=int, default=200)
    p.add_argument("--sample-chars", type=int, default=40000)
    p.add_argument("--max-projects", type=int, default=0)
    p.set_defaults(func=cmd_critique)

    p = sub.add_parser("merge")
    add_common(p)
    add_llm(p)
    p.set_defaults(func=cmd_merge)

    p = sub.add_parser("verify")
    add_common(p)
    p.set_defaults(func=cmd_verify)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
```

## What worked

- Baseline as a hypothesis: it sets the language and frame but is not treated as proof.
- A separate call per project: local observations do not dissolve into a global average.
- An evidence requirement: it sharply reduces beautiful but empty claims.
- Preserving conflicts: disagreements between projects are often more informative than consensus.
- A trace: you can return to the same slice and check where a conclusion came from.

## What did not work, and what limits the method

- **One "tell me about me" call.** It produces smooth text without verifiable links.
- **Mixing projects.** Contexts differ; their average is a bad profile.
- **Free-form output.** Without a schema, the model adds conclusions that are not in the data.
- **Ignoring batch/automation.** Automated sessions can dominate the sample and distort the picture.
- **Publishing raw logs.** They contain third-party data, work context, and secrets; publish the method and synthetic examples, not the source.
- **A single score.** A numeric rating creates false precision and invites optimization against the metric.
- **Four levers as psychometrics.** Framing, veto, abstraction shift, and bridging are a useful lens, not a validated test.
- **Volume bias.** People who write more leave more trace; silent veto and glue work are harder to see.
- **Model sycophancy.** Without counterevidence and negative examples, the model will flatter.
- **Reasoning models can eat the output budget.** One model returned empty content at 6k output tokens because all of it went to reasoning; 16k worked. Check `finish_reason` and reasoning tokens, not just HTTP 200.
- **Not every model speaks the OpenAI protocol.** On one provider, a Claude model returned `ModelProtocolUnsupported` while DeepSeek models worked. Test the chosen model, or add a protocol adapter.
- **"OpenAI-compatible" can still need headers.** A provider accepted the OpenAI request shape but required a workspace and session header. The script sends only `Authorization`; add the headers in `call_llm` or put a small proxy in front.
- **Header names are not secrets.** A verifier that matched bare `x-opencode-*` and `OPENCODE_*` names failed on a legitimate mention. Match only `name: value` or `name=value`; then a real run passed with one phone-number warning.

## Attestation instead of certification

The method has a product extension, but it is a design proposal, not a standard.

The "export resume" button is an abstraction. The delivery point can be an API, a webhook, a credential endpoint, an auto-filled profile, or a wallet. The UI is not the point; the contract is: who signed, what exactly, for which period, with what scope, until when, and whether it can be revoked.

Roles:

- **source** signs the raw trace and answers for what it observed;
- **AI** interprets the trace into profile claims but does not attest them;
- **candidate** chooses what to disclose and to whom; nothing is disclosed by default;
- **consumer** checks the signature, scope, evidence, and consistency across sources.

If the export "always sits" in a profile, it is a live attestation. It needs a TTL, selective disclosure, and storage of signed claims with evidence pointers rather than raw logs. Otherwise it is not attestation; it is surveillance.

A source signature attests observation, not the person's quality. A provider sees only its own silo; it has a conflict of interest; people whose work is not logged fall into a blind spot. A single vendor's button is a new lock-in; an open contract is a chance to build a resume from several independent exports.

### The second layer: growth, not just a resume

The same export can power two products:

- **outward** — verifiable claims for the market;
- **inward** — a private growth report that the source gives back to the person.

The inward report can show evidence gaps: "strong framing and bridging, but no closure case; here are three ways to produce one." That is more useful than a single score and less like a certification funnel. But the growth report must be private by default, with separate consent, and must not go to the employer.

The risk is not verification itself; it is coercion. If an employer requires the export as a condition of hiring, voluntariness breaks. If the source sells certifications, recommendations become a funnel. Attestation and the growth report should be separated by a contract, not by marketing.

### The first reader is the person

The first reader of a work trace is not a recruiter; it is the person. A resume is a persuasion document. A trace is a mirror with receipts: it shows what you actually did, what you kept treating as routine, what you did when no one asked, what you avoided, and where you grew.

This matters because expertise becomes invisible to its owner. People discount the skills they use automatically, describe complex work as "just wiring things together", and forget the decisions that others found hard. A trace can surface that normalized work — not to inflate the person, but to calibrate the story.

It can also show the opposite: gaps, avoidance, and contradictions. That is why the goal is calibration, not affirmation. The useful output is not "you are better than you think"; it is "here is the evidence, decide what it means."

This is why the private growth report should be separate from the public export. The person needs a candid mirror before deciding what to disclose. If the same artifact is always employer-facing, self-censorship starts and the mirror stops working.

## What is not in this dump

This dump deliberately does not contain:

- a real profile or conclusions about a specific person;
- project names or project outcomes;
- raw logs, quotes, or personal details;
- model responses for real projects;
- local paths, usernames, or links to token files.

This is not censorship; it is the publication boundary. The method can be reused; the profile cannot. The synthetic examples above show the format, not anyone's real work.

## Artifacts

- `raw.md` — this document: method, prompts, schema, and code.
- `summary.md` — a short human-facing brief.
- `REDACTIONS.md` — what was removed and why.

The original logs and the final profile stay private. If you repeat the method, start with one project and one source of consequences; do not publish raw logs and do not turn the profile into a single score.
