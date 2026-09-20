
# Navigable JSON as a Turing Machine: Two Orchestration Patterns with Schema-Guided Reasoning

**Type:** `case` · **Domain:** `engineering` · **Stakes:** `low` · **Trust:** `self-tested`
**Tags:** `navigable-json`, `turing-complete`, `schema-guided-reasoning`, `agent-orchestration`, `state-machine`, `hybrid-architecture`, `bohm-jacopini`, `live-validation`

## 0. Abstract

After publishing the original `.njson` format, I kept thinking about what it actually *is*. It's not just a data format with byte offsets — it's a **virtual machine for LLM agents**. The primitives map directly to the **structured program theorem** (Böhm 1964; Böhm-Jacopini 1966). Its **extended form** — the textbook statement usually cited — says that three constructs (**sequence**, **selection**, **iteration**) are sufficient to implement any algorithm; the original 1966 result was sharper still, needing only two (sequence and iteration), since selection can be encoded as iteration. In `.njson`, these become: `no` (next header) is sequence/iteration, `bo` (body offset) is selection, and the reader loop is the while construct. The agent's context is RAM. With pointer manipulation (cyclic `no` links), the format becomes theoretically Turing-complete.

But theoretical elegance crashes into practical reality when your "CPU" is a probabilistic neural network. I ran one live experiment — a small model (`deepseek-v4-flash`) executing real `.njson` fixtures through a byte-offset `read_file` tool — to see what the machine actually does. This dump gives you the mapping, both orchestration patterns as runnable JavaScript, a canonical linker and reader, and the measured results of that run: where the model was comfortable, where it struggled, and the format changes those failures point to.

Two orchestration patterns are compared: (1) **Pure Turing Machine** (Pattern A), where the LLM manages control flow through the `no`/`bo` pointers, and (2) **Hybrid Orchestration** (Pattern B), where a deterministic backend manages state while the LLM acts as a schema-guided decision engine. Pattern B connects directly to Rinat Abdullin's **Schema-Guided Reasoning (SGR)**.

## 1. From Data Format to Virtual Machine: The Böhm-Jacopini Mapping

The structured program theorem, in its extended form, states that any computable function can be implemented using just three program structures:

1. **Sequence**: Execute statement A, then statement B
2. **Selection**: If condition C, then execute A, else execute B
3. **Iteration**: While condition C, execute A

These three are sufficient primitives for a Turing-complete system. Now let's map them to `.njson`. Every `_nj` field is an **absolute byte offset from the file start**, so every move is "read exactly `<size>` bytes at `<offset>`" — no arithmetic:

| Böhm-Jacopini Primitive | `.njson` Equivalent | How It Works |
|-------------------------|---------------------|--------------|
| **Sequence** (A → B) | `_nj.no` (next offset) + `_nj.nl` (its length) | Read header A, then read exactly `nl` bytes at `no` to get header B. `while (no != -1) { readHeader(no, nl); }` |
| **Selection** (if C then A else B) | `_nj.bo` (body offset) + `_nj.bhl` + LLM evaluation | Read header, evaluate condition (e.g., "does `tags` contain 'finance'?"). If yes, read the body (`bl` at `bo`); if no, follow `no`. The LLM is the branch predictor. |
| **Iteration** (while C do A) | Cyclic `no` pointer | A `no` that points back to an earlier record is a loop — the same header is read again on the next pass. The loop ends when the program's own condition leaves it, branching to a header whose `no = -1` (HALT). Revisiting an offset is the mechanism of iteration, not a failure. |
| **Memory / State** | Agent's context window | Every read accumulates in the agent's context. This is the heap/stack. |
| **Call Stack** | Nested `.njson` documents (`bhl > 0`) | When `bhl > 0` the body is itself Navigable JSON: read exactly `bhl` bytes at `bo` to get the nested root `_nj`, then follow *its* absolute `no`/`bo`. This is a function call: a new scope with its own level. |
| **HALT** | `_nj.no = -1`, or SGR `action: "HALT"` | Termination. Reaching it is the *program's* job: because a cyclic `no` is a loop, the exit is a conditional branch to a HALT header, not the sentinel at the end of a chain. In Pattern B the backend enforces limits. §6 sees a model that does not always emit `HALT` by itself. |

### The Key Insight

`.njson` is not passive data. It's **executable bytecode** for an LLM-based virtual machine. The linker is exactly that — a linker: it takes a document and resolves its references into concrete, absolute byte addresses (a relocation pass), no more. What *composes* that JSON in the first place — the source program, the compiler's job — is out of scope here; this article starts from a finished structure. The byte offsets it assigns are absolute addresses, and the LLM with a `read(offset, size)` tool is the CPU running fetch-decode-execute cycles.

This reframes how we think about agent architecture: we're not "feeding documents to a model," we're **running programs on a probabilistic CPU** — and §6 is a first look at how that CPU behaves.

## 2. Pattern A: Pure Turing Machine (LLM-Managed Control Flow)

### Architecture

The LLM is the entire control unit. It:
1. Reads the root `_nj` (the one unsized read) to get the first header offset `no` and its length `nl`
2. Reads exactly `nl` bytes at `no` to get a header, and evaluates its semantic keys (`description`, `tags`)
3. Decides: "Is this relevant?"
   - Yes → read the body: exactly `bl` bytes at `bo`, or exactly `bhl` bytes at `bo` for a nested level
   - No → follow `no` to the next header
4. Repeats until it reaches `no = -1` (HALT) — a loop is just a `no` that points back, and the condition that ends it lives in the program, not in the reader

The agent maintains state in its context: the loop variables and accumulated results (this is RAM), plus the current offset. Revisiting an offset is expected while a loop runs.

### Implementation: The Reader Loop

This is the deterministic reference for the moves the agent must make. It follows `no` until `-1`; a program that never reaches `-1` simply runs long — catching that is the program author's job, not the reader's (the format is C-like: it does not bounds-check your program).

```javascript
// §2 — Pattern A: a deterministic reference for the moves the agent must make.
// The protocol has four moves: read the root `_nj` (the one unsized read), then
// read exactly `nl` bytes at `no` for a header, exactly `bl` bytes at `bo` for an
// atomic body, and exactly `bhl` bytes at `bo` to descend into a nested document.
export const NJ_START = '"_nj":';

// Read the value starting at (or just after) byte `off`; return it and its length.
// Leading JSON whitespace is skipped, so the root `_nj` can be found with indexOf.
export function readNjAt(buf, off) {
  while (off < buf.length && (buf[off] === 0x20 || buf[off] === 0x0a || buf[off] === 0x0d || buf[off] === 0x09)) off++;
  let depth = 0, j = off;
  while (j < buf.length) {
    if (buf[j] === 0x7b) depth++;                                   // {
    else if (buf[j] === 0x7d) { depth--; if (depth === 0) { j++; break; } } // }
    j++;
  }
  return { nj: JSON.parse(buf.slice(off, j).toString('utf8')), len: j - off };
}

// The whole control unit, with no arithmetic on addresses:
//   sequence / iteration = follow `no`;  selection = follow `bo`;  call = descend.
// A cyclic `no` is a loop: revisiting an offset is normal, and only `-1` (HALT)
// ends the walk. `maxIterations` is a watchdog on this demo, not a format rule —
// a program that never reaches HALT is a bug in the program, not something the
// reader detects (the format is C-like and does not bounds-check programs).
export function turingMachineReader(buf, match, entry = null, maxIterations = 100) {
  const start = entry === null
    ? readNjAt(buf, buf.indexOf(NJ_START) + NJ_START.length)   // the unsized read
    : readNjAt(buf, entry);                                    // nested root `_nj`
  let cur = start.nj.no;                                       // first record's `_nj` offset
  let want = start.nj.nl;                                      // exact bytes to read there
  const results = [];
  let iterations = 0;

  while (cur !== -1 && iterations < maxIterations) {           // loop while `no != -1`
    iterations++;
    const nj = JSON.parse(buf.slice(cur, cur + want).toString('utf8'));  // exactly `nl` at `no`
    if (match(nj)) {                                           // selection: the branch prediction
      if (nj.bhl > 0) {
        // Nested body = a call: `bo` is the nested root `_nj`, `bhl` its exact size.
        results.push({ nested: true, child: turingMachineReader(buf, match, nj.bo, maxIterations) });
      } else {
        const body = buf.slice(nj.bo, nj.bo + nj.bl).toString('utf8');   // exactly `bl` at `bo`
        results.push({ description: nj.description, body: JSON.parse(body) });
      }
    }
    cur = nj.no;                                               // sequence / iteration
    want = nj.nl;
  }
  return { results, iterations, halted: cur === -1, hitLimit: iterations >= maxIterations };
}
```

### Expected Failure Modes (and what actually happened)

The failure modes below were the working hypothesis for why a probabilistic CPU would make a poor control unit. They are **not** what a live run showed at small scale — §6 reports the measured results, and the specific predictions here (lost loop state, rereading a forgotten record, reading offset `-1`, hallucinated progress) did **not** reproduce for chains of up to 12 records. For larger documents they remain untested hypothesis, not evidence.

1. **Lost loop state**: the model forgets its loop variable, can no longer tell "the next iteration" from "I'm stuck", and hallucinates progress.
2. **Off-by-one termination errors**: at `no = -1` the model tries to read offset `-1`, or ignores the sentinel and keeps looping.
3. **Context overflow**: after many iterations the context fills with headers it already skipped, and decisions degrade.

**What is safe to say today**: Pattern A is a small-scale demonstration of the mapping. Its reliability at scale is an open question, because (see §6) the model does not actually iterate byte-by-byte — it reads everything once and simulates the loop in its own context.

## 3. Pattern B: Hybrid Orchestration (Backend State Machine + SGR)

### The Insight

If the LLM is bad at managing control flow, **don't let it**. Split the responsibilities:
- `.njson` provides read-only memory with byte-offset addressing
- Backend (JavaScript/Python/Java) manages state: `current_offset`, `visited_ids`, batch size, iteration limits
- LLM acts as a **decision engine**, constrained by Schema-Guided Reasoning (SGR)

This is the same pattern Rinat Abdullin describes in his [Schema-Guided Reasoning](https://abdullin.com/schema-guided-reasoning/) article: translate the domain expert's mental checklist into a structured reasoning schema, enforced via constrained decoding.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Backend (JavaScript/Python/Java) — Deterministic FSM    │
│                                                         │
│  State: current_offset, visited_ids, iteration_count    │
│  Logic: Fetch next batch, enforce limits, manage I/O    │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ LLM (SGR-Constrained) — Probabilistic CPU        │  │
│  │                                                  │  │
│  │  Input: batch of headers (from .njson)           │  │
│  │  Output: structured JSON decision                │  │
│  │    {                                             │  │
│  │      "action": "FETCH_NEXT" | "READ_BODY" | "HALT",│
│  │      "selected_ids": [...],                      │  │
│  │      "reasoning": "...",                         │  │
│  │      "search_refinement": "..."                  │  │
│  │    }                                             │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Implementation: The Orchestrator Loop

The backend owns every byte move; the model only returns a decision. Each offered header's `id` is its absolute `_nj` offset — a value the backend can check and the model can copy, so an id the model invents is rejected instead of trusted.

```javascript
// §3 — Pattern B: a deterministic backend owns every byte move; the LLM only picks.
// `decide(query, batch)` is the SGR-constrained call and must return
//   { action: "FETCH_NEXT" | "READ_BODY" | "HALT", selected_ids: string[], reasoning: string }
// where each offered header's `id` is its absolute `_nj` offset.
export async function execute(query, buf, decide, { batchSize = 10, maxIterations = 10, entry = null } = {}) {
  const start = entry === null
    ? readNjAt(buf, buf.indexOf(NJ_START) + NJ_START.length)
    : readNjAt(buf, entry);
  let current = start.nj.no;
  let want = start.nj.nl;
  const visited = new Set();
  const results = [];
  let iterations = 0;
  let reason = 'MAX_ITERATIONS_REACHED';

  while (iterations < maxIterations) {
    iterations++;

    // FETCH: the backend reads the next batch of headers itself — always exact reads.
    const batch = readHeaders(buf, current, want, batchSize);
    if (batch.headers.length === 0) { reason = 'END_OF_FILE'; break; }   // backend halts on EOF
    current = batch.nextOffset; want = batch.nextLen;

    // DECODE: the model returns only the decision object.
    const decision = await decide(query, batch.headers);

    // EXECUTE: the backend, not the model, touches memory.
    if (decision.action === 'HALT') { reason = decision.reasoning; break; }
    for (const id of decision.selected_ids || []) {
      const header = batch.headers.find(h => h.id === id);
      if (!header) throw new Error(`model selected an id that was never offered: ${id}`);
      results.push({ id, body: readBody(buf, header.nj) });             // exactly `bl` at `bo`
      visited.add(id);
    }
    // FETCH_NEXT falls through to the next batch.
  }
  return { results, iterations, visited: [...visited], reason };
}
```

### The SGR Schema: Forcing Structured Decisions

The key is **constrained decoding**: the LLM is physically unable to output anything except valid JSON matching this schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "NjsonOrchestrationDecision",
  "type": "object",
  "required": ["action", "reasoning"],
  "properties": {
    "action": {
      "type": "string",
      "enum": ["READ_BODY", "FETCH_NEXT", "HALT"],
      "description": "What the agent wants to do next"
    },
    "selected_ids": {
      "type": "array",
      "items": { "type": "string" },
      "description": "IDs of headers to read bodies for (only if action=READ_BODY)"
    },
    "reasoning": {
      "type": "string",
      "description": "Why the agent made this decision (audit trail)"
    },
    "search_refinement": {
      "type": "string",
      "description": "Optional: how to refine the search for the next batch"
    }
  },
  "allOf": [
    {
      "if": { "properties": { "action": { "const": "READ_BODY" } } },
      "then": { "required": ["selected_ids"] }
    }
  ]
}
```

With constrained decoding (OpenAI Structured Outputs, vLLM xgrammar, Ollama JSON Schema), the LLM **cannot** emit free-form text or break the shape of the loop with an invalid id. In the live run (§6) the `json_schema` response format was accepted and every decision parsed; the model selected only offered ids. What constrained decoding does **not** guarantee is that the model chooses to *stop* — see §6.

### Why Pattern B Wins

1. **Guaranteed termination**: the backend enforces `MAX_ITERATIONS` and treats end-of-file as a halt. No infinite loops.
2. **No context pollution**: the LLM only sees the current batch of headers, not the entire history.
3. **Works with local models in principle**: the decision surface is a small constrained JSON object, not free-form reasoning. (This is a hypothesis for local models; §6 did not test any.)
4. **Full audit trail**: every decision is logged with `reasoning`. You can replay the entire execution trace.
5. **Dynamic adaptation**: the backend can use `search_refinement` to filter the next batch (e.g., if the LLM says "add keyword 'multithreading'", the backend applies a tag filter).

## 4. Connection to Schema-Guided Reasoning (SGR)

Rinat Abdullin's SGR pattern is the missing piece that makes Pattern B reliable. From his article:

> "Schema-Guided Reasoning (SGR) is a technique that guides large language models (LLMs) to produce structured, clear, and predictable outputs by enforcing reasoning through predefined steps."

In our context:
- **SGR translates the domain expert's mental checklist** ("evaluate header, decide if relevant, select bodies, refine search") into a JSON Schema.
- **Constrained decoding enforces the schema** at the token level, making schema violations impossible.
- **The LLM becomes a reliable function**: input (query + headers) → output (structured decision).

Without SGR, Pattern B would drift back toward Pattern A's problem: free-form text that is hard to act on. With SGR, the LLM is a **constrained decision engine**, and the backend handles all the messy state management.

## 5. Live Implementation: Canonical Linker + Reader

These are the two pieces the article's examples actually run on. Canonical style means: exactly `JSON.stringify(value, null, 2)`, UTF-8, LF, no BOM; root key order `$schema`, `description`, `_nj`, `records`; each record is `{"_nj": <njValue>, "body": <bodyValue>}`.

### 5.1 The Linker

The linker bakes absolute byte offsets by fixpoint: offsets in the text depend on the offset digits, so it re-emits until the bytes stop changing. A record's `body` that is a JavaScript array means a nested document; any other value is atomic (wrap an array in an object to store an array atomically).

```javascript
// §5.1 — linker: bake absolute byte offsets into canonical njson by fixpoint.
// A record's `body` that is a JS array means a nested document; any other value
// is an atomic body (wrap an array in an object to store it atomically).
export const SCHEMA_URL = 'https://kodavr.xyz/njson/schemas/v1.json';
const blen = s => Buffer.byteLength(s, 'utf8');
const emptyRootNj = () => ({ bo: 0, bl: 0, bhl: 0, no: 0, nl: 0 });

function njValue(meta, bo, bl, bhl, no, nl) {
  return { bo, bl, bhl, no, nl,
    description: meta.description || '', tags: meta.tags || [],
    stakes: meta.stakes || 'low', trust_level: meta.trust_level || 'raw' };
}
function makeRecord(spec) {
  const meta = { description: spec.description || '', tags: spec.tags || [],
    stakes: spec.stakes || 'low', trust_level: spec.trust_level || 'raw' };
  const r = { meta, nj: njValue(meta, 0, 0, 0, 0, 0), atom: undefined, child: undefined,
    njStart: 0, njLen: 0, bodyStart: 0, bodyEnd: 0 };
  if (Array.isArray(spec.body)) r.child = makeDoc(spec.body);
  else r.atom = spec.body;
  return r;
}
function makeDoc(specs) {
  return { headBefore: [], headAfter: [], rootNj: emptyRootNj(), recs: specs.map(makeRecord) };
}

// Emit canonical JSON while recording the byte position of every `_nj` value and body.
function emitAll(root) {
  const out = { chunks: [], pos: 0 };
  const put = s => { out.chunks.push(s); out.pos += blen(s); };
  function emitValue(v, depth) {
    const t = typeof v;
    if (v === null) { put('null'); return; }
    if (t === 'boolean') { put(v ? 'true' : 'false'); return; }
    if (t === 'number') { put(JSON.stringify(v)); return; }
    if (t === 'string') { put(JSON.stringify(v)); return; }
    const ind = '  '.repeat(depth), inner = '  '.repeat(depth + 1);
    if (Array.isArray(v)) {
      if (!v.length) { put('[]'); return; }
      put('[\n');
      v.forEach((x, i) => { if (i) put(',\n'); put(inner); emitValue(x, depth + 1); });
      put('\n' + ind + ']');
      return;
    }
    const keys = Object.keys(v);
    if (!keys.length) { put('{}'); return; }
    put('{\n');
    keys.forEach((k, i) => {
      if (i) put(',\n');
      put(inner + JSON.stringify(k) + ': ');
      emitValue(v[k], depth + 1);
    });
    put('\n' + ind + '}');
  }
  function emitDoc(doc, depth) {
    const ind = '  '.repeat(depth), inner = '  '.repeat(depth + 1);
    put('{\n');
    let first = true;
    const key = k => { if (!first) put(',\n'); first = false; put(inner + JSON.stringify(k) + ': '); };
    for (const [k, v] of doc.headBefore) { key(k); emitValue(v, depth + 1); }
    key('_nj');
    doc.rootNjStart = out.pos; emitValue(doc.rootNj, depth + 1);
    doc.rootNjLen = out.pos - doc.rootNjStart;
    for (const [k, v] of doc.headAfter) { key(k); emitValue(v, depth + 1); }
    key('records');
    put('[\n');
    doc.recs.forEach((rec, i) => { if (i) put(',\n'); put(inner + '  '); emitRecord(rec, depth + 2); });
    put('\n' + inner + ']');
    put('\n' + ind + '}');
  }
  function emitRecord(rec, depth) {
    const ind = '  '.repeat(depth), inner = '  '.repeat(depth + 1);
    put('{\n');
    put(inner + '"_nj": ');
    rec.njStart = out.pos; emitValue(rec.nj, depth + 1); rec.njLen = out.pos - rec.njStart;
    put(',\n' + inner + '"body": ');
    rec.bodyStart = out.pos;
    if (rec.child) emitDoc(rec.child, depth + 1);
    else emitValue(rec.atom, depth + 1);
    rec.bodyEnd = out.pos;
    put('\n' + ind + '}');
  }
  emitDoc(root, 0);
  return out;
}

function updateDoc(doc) {
  doc.recs.forEach((rec, i) => {
    const next = doc.recs[i + 1];
    const no = next ? next.njStart : -1;              // -1 = end of level
    const nl = next ? next.njLen : 0;
    if (rec.child) {
      rec.nj = njValue(rec.meta, rec.child.rootNjStart, rec.bodyEnd - rec.child.rootNjStart,
        rec.child.rootNjLen, no, nl);
    } else {
      rec.nj = njValue(rec.meta, rec.bodyStart, rec.bodyEnd - rec.bodyStart, 0, no, nl);
    }
    if (rec.child) updateDoc(rec.child);
  });
  const first = doc.recs[0];
  doc.rootNj = { bo: 0, bl: 0, bhl: 0, no: first ? first.njStart : -1, nl: first ? first.njLen : 0 };
}

// Offset digits depend on the offsets, so iterate until the text stops changing.
// Root key order is `$schema`, `description`, `_nj`, then the rest, then `records`.
export function linkRoot(records, description = 'root', headAfter = {}) {
  const root = makeDoc(records);
  root.headBefore = [['$schema', SCHEMA_URL], ['description', description]];
  root.headAfter = Object.entries(headAfter);
  let prev = null;
  for (let pass = 0; pass < 80; pass++) {
    const text = emitAll(root).chunks.join('');
    if (text === prev) return text;
    prev = text;
    updateDoc(root);
  }
  return prev;
}
```

### 5.2 The Reader

There is no arithmetic anywhere: a batch of headers is "read exactly `nl` at `no`", a body is "read exactly `bl` at `bo`", a nested level is "read exactly `bhl` at `bo`".

```javascript
// §5.2 — reader: the exact-size moves, with no address arithmetic anywhere.
// A batch of headers = read exactly `nl` at `no`, then follow the new `no`/`nl`.
// `navigate` is a *search*: stopping on a revisited offset means it closed a loop
// and found nothing (search bookkeeping, not a format rule — an executor keeps going).
export function readHeaders(buf, firstOffset, firstLen, limit) {
  const headers = [];
  let cur = firstOffset, want = firstLen;
  while (cur !== -1 && headers.length < limit) {
    const nj = JSON.parse(buf.slice(cur, cur + want).toString('utf8'));
    headers.push({ id: String(cur), nj });            // the offset IS the copyable id
    cur = nj.no; want = nj.nl;
  }
  return { headers, nextOffset: cur, nextLen: want };
}
export function readBody(buf, nj) {
  return JSON.parse(buf.slice(nj.bo, nj.bo + nj.bl).toString('utf8')); // exactly `bl` at `bo`
}
export function navigate(buf, match, entry = null) {
  const start = entry === null
    ? readNjAt(buf, buf.indexOf(NJ_START) + NJ_START.length)
    : readNjAt(buf, entry);
  const visited = [];
  let cur = start.nj.no, want = start.nj.nl, readBytes = 0;
  while (cur !== -1) {
    if (visited.includes(cur)) return { hit: null, cycleAt: cur, visited, readBytes };
    visited.push(cur);
    readBytes += want;                               // exactly `nl` at `no`
    const nj = JSON.parse(buf.slice(cur, cur + want).toString('utf8'));
    if (match(nj)) {
      if (nj.bhl > 0) {
        const inner = navigate(buf, match, nj.bo);
        return { hit: nj, descended: true, inner, visited, readBytes: readBytes + inner.readBytes };
      }
      readBytes += nj.bl;                            // exactly `bl` at `bo`
      return { hit: nj, body: readBody(buf, nj), visited, readBytes };
    }
    cur = nj.no; want = nj.nl;
  }
  return { hit: null, visited, readBytes };
}
```

The §3 orchestrator is Pattern B's only implementation; it is built on these reader primitives, so there is no second, divergent copy to maintain.

### 5.3 The demo program, in exact bytes

This is the exact fixture the model ran in §6: `program.njson`, generated by the §5.1 linker. Its six instruction records are chained by `no`, the last ending at `no = -1` (HALT). The `OP:JNZ` record carries `"target_offset": 1891`, the absolute offset of the `OP:LOOP_ADD` header — a backward jump, so iteration is a pointer move, not arithmetic. Executed, it computes `acc = 1000; counter = 6; acc += counter; counter--; loop while counter != 0; HALT` and outputs `1021`. Every offset below is live: each `bo`/`bl`/`no`/`nl` addresses exactly these bytes.

**Code-style convention.** A byte offset is a promise about one *specific* byte sequence, not about the data. Change whitespace, re-sort keys, switch LF↔CRLF, add a BOM, normalize Unicode, escape non-ASCII as `\uXXXX`, or round-trip the document through a markdown/HTML viewer — and baked offsets land mid-token. So the format pins a canonical serialization style, valid only for bytes produced under it:

- exactly `JSON.stringify(value, null, 2)` — two-space indent, `": "` after every key, one entry per line, `{}`/`[]` for empties, no trailing whitespace;
- UTF-8, LF line endings, no BOM;
- fixed key order: root `$schema` → `description` → `_nj` → remaining root fields → `records`; each record `_nj` → `body`; inside `_nj` the five nav fields (`bo`, `bl`, `bhl`, `no`, `nl`) first, then the semantic key (`description`, `tags`, `stakes`, `trust_level`).

Bake offsets as the LAST build step; never hand-edit offsets. Because the canonical form is a fixed point of parse-and-reprint, verification is just `sha256(JSON.stringify(JSON.parse(copy), null, 2)) === published`: parse a copy, re-serialize with the same rule, hash, compare to the published anchor. If it differs, re-serialize against the style until the hash matches — then the printed offsets are exactly the ones that hold.

**Verify this listing.**

```
digest  91adab01-f55528d9-ae249d70-0ca23416-296d8793-2692333e-601370c1-7824ec52
bytes   3589
```

```
const fs = require('fs'), crypto = require('crypto');
const copy = fs.readFileSync('program.njson', 'utf8');
// the same digest, grouped into 8-character blocks
const want = ['91adab01','f55528d9','ae249d70','0ca23416','296d8793','2692333e','601370c1','7824ec52'].join('');
const got = crypto.createHash('sha256')
  .update(JSON.stringify(JSON.parse(copy), null, 2)).digest('hex');
console.log(got === want);
```

If it differs, the copy's formatting drifted — re-serialize against the style rules until the hash matches; a structural edit (reordered key, smart quote, changed number) then fails loudly instead of letting stale offsets mislead.

```json
{
  "$schema": "https://kodavr.xyz/njson/schemas/v1.json",
  "description": "Navigable JSON PROGRAM. `_nj` fields are BYTE offsets from the FILE start. This file is a program, not a document: each record is an INSTRUCTION, its `description` is the opcode, its atomic `body` (read exactly `bl` bytes at `bo`) is the instruction text. PROTOCOL, EXACT READS ONLY: only the first read is unsized (read 256-1024 bytes to get the root `_nj`); after that each read MUST be exactly the size a header gives. NEXT INSTRUCTION: read exactly `nl` bytes at `no` for the next record header. BODY: read exactly `bl` bytes at `bo`. `no = -1` means HALT (end of program). EXECUTE: keep a register state (acc, counter) in your own context, run instructions in order, and when you hit `OP:JNZ` evaluate its `cond`; if true jump by reading a header at the instruction's explicit `target_offset`, else fall through to the record given by this header's `no`. Copy offsets from `_nj`/body text; never compute them.",
  "_nj": {
    "bo": 0,
    "bl": 0,
    "bhl": 0,
    "no": 1114,
    "nl": 262
  },
  "records": [
    {
      "_nj": {
        "bo": 1392,
        "bl": 79,
        "bhl": 0,
        "no": 1498,
        "nl": 266,
        "description": "OP:INIT_ACC",
        "tags": [
          "opcode",
          "init"
        ],
        "stakes": "low",
        "trust_level": "raw"
      },
      "body": {
        "op": "INIT_ACC",
        "reg": "acc",
        "value": 1000
      }
    },
    {
      "_nj": {
        "bo": 1780,
        "bl": 84,
        "bhl": 0,
        "no": 1891,
        "nl": 291,
        "description": "OP:INIT_COUNTER",
        "tags": [
          "opcode",
          "init"
        ],
        "stakes": "low",
        "trust_level": "raw"
      },
      "body": {
        "op": "INIT_COUNTER",
        "reg": "counter",
        "value": 6
      }
    },
    {
      "_nj": {
        "bo": 2198,
        "bl": 77,
        "bhl": 0,
        "no": 2302,
        "nl": 247,
        "description": "OP:LOOP_ADD",
        "tags": [
          "opcode",
          "loop",
          "backward-target"
        ],
        "stakes": "low",
        "trust_level": "raw"
      },
      "body": {
        "op": "ADD",
        "dst": "acc",
        "src": "counter"
      }
    },
    {
      "_nj": {
        "bo": 2565,
        "bl": 72,
        "bhl": 0,
        "no": 2664,
        "nl": 290,
        "description": "OP:DEC_COUNTER",
        "tags": [
          "opcode"
        ],
        "stakes": "low",
        "trust_level": "raw"
      },
      "body": {
        "op": "DEC",
        "reg": "counter",
        "by": 1
      }
    },
    {
      "_nj": {
        "bo": 2970,
        "bl": 255,
        "bhl": 0,
        "no": 3252,
        "nl": 254,
        "description": "OP:JNZ",
        "tags": [
          "opcode",
          "branch",
          "conditional-jump"
        ],
        "stakes": "low",
        "trust_level": "raw"
      },
      "body": {
        "op": "JNZ",
        "cond": "counter != 0",
        "target_offset": 1891,
        "note": "if cond is true, read the next instruction header at exactly `nl` bytes at absolute byte offset `target_offset`; otherwise fall through to `no`"
      }
    },
    {
      "_nj": {
        "bo": 3522,
        "bl": 55,
        "bhl": 0,
        "no": -1,
        "nl": 0,
        "description": "OP:HALT",
        "tags": [
          "opcode",
          "halt"
        ],
        "stakes": "low",
        "trust_level": "raw"
      },
      "body": {
        "op": "HALT",
        "output": "acc"
      }
    }
  ]
}
```

## 6. Live Validation: What a Real Model Does with the Machine

The concept predicts that a probabilistic CPU will struggle with control flow. To replace guesswork with measurement, I generated real `.njson` fixtures with the linker above and gave one model a single byte-offset tool.

### Method

- **Fixture generator.** `program.njson` (3589 B; the exact listing is in §5.3) is a real program: six instruction records chained by `no`, ending in `no = -1`. A `JNZ` instruction carries an explicit absolute `target_offset` (1891) to the `LOOP_ADD` record, so iteration is a backward pointer move with no arithmetic. The program computes `acc = 1000; counter = 6; acc += counter; counter--; loop while counter != 0; HALT`; the expected output is 1021. `cycle.njson` (2369 B) and `cycle12.njson` (4772 B) are chains that end by pointing `no` back into the chain (5 and 12 distinct records), with **no** record ending in `-1`. Those two are *search* fixtures — a cyclic structure a finder walks once — not programs: under execution semantics a chain with no `-1` simply never halts, which would be a bug in the program, not something the reader is asked to detect.
- **Endpoint and model.** A chat-completions API, model `deepseek-v4-flash` — the only model run. No local model was tested.
- **Tool.** One function `read_file(path, offset, limit)`, byte offsets, capped at 1024 B per call. The executor ignored `path` and served the loaded fixture, so every read is against real bytes.
- **Budget.** `MAX_TURNS` 20–24 per run; temperature 0.2 for the Pattern A runs, 0 for Pattern B. Each read was classified against the fixture as `root`, `header-exact`, `header-partial`, `body-exact`, `scan/misaligned`, or `requested-negative`; "exact" means the bytes the header itself declares (`nl` at `no`, `bl` at `bo`).

### Measured results

| Run | Fixture | LLM turns | exact header reads | exact body reads | repeats | illegal reads | bytes | Outcome |
|-----|---------|-----------|--------------------|------------------|---------|---------------|-------|---------|
| A-program | `program.njson` (3589 B) | 11 | 6/6 | 6/6 | 0 | 0 | 4280 | correct `OUTPUT: 1021`, reached HALT — but every instruction was fetched once and the loop was simulated in context (0 loop back-jumps); 1 unsized read at offset 1024 |
| A-cycle N=5 | `cycle.njson` (2369 B) | 7 | 5/5 | n/a | 0 | 0 | 2253 | correct: "5 distinct records", cycle target 1358 named **record-3** (correct) |
| A-cycle N=12 (run a) | `cycle12.njson` (4772 B) | 14 | 12/12 | n/a | 0 | 0 | 3978 | count (12) and cycle offset (2042) correct; target named **record-4** (truth: record-5) |
| A-cycle N=12 (run b) | `cycle12.njson` (4772 B) | 14 | 12/12 | n/a | 0 | 0 | 3978 | same: 2042 named **record-4** (truth: record-5) |
| B-decision | `index.njson` (12413 B) | 2 decisions | n/a | 1 body (`9155`) | 0 | 0 | 689 + 673 tokens | `json_schema` HTTP 200; `FETCH_NEXT → READ_BODY(9155)`, correct record; 0 invalid ids; **never emitted HALT** — backend halted on end-of-file |

One earlier, superseded 5-record pilot answered "5 distinct" but named its cycle target 1364 as **record-2** (truth: record-3); the mislabel is stochastic, not deterministic.

### Verbatim reasoning (from `reasoning_content`)

**Comfort — the offset scheme was unambiguous**

- A-program, turn 3: `"The root _nj says no: 1114, nl: 262. So the first record header is at offset 1114, length 262 bytes. Let me read that."`
- A-cycle N=5, final: `"The last no pointer (from record-5, at offset 2042) is 1358, which leads back to record-3's header — so the chain loops into a cycle"`
- B-decision, iter 1: `"Header 9155 explicitly describes the requirements-management dump with stable IDs, coverage checks, and TDD registry, matching the query."`

**Struggle — deriving identity, and the root boundary**

- A-program (self-correction after mistaking a jump target): `"Wait, target_offset is 1891 which is the INIT_COUNTER record header... Hmm, but that would be an infinite loop."` … `"Yes! Offset 1891 is the LOOP_ADD header. I confused myself."`
- A-cycle N=12, final: `"Record-12's no pointer leads to offset 2042, which is record-4's header (already visited)"` — the header at 2042 literally reads `"description":"record-5"`, and the same answer body had just listed `record-5 (2042)`.
- A-program, on the root read: the root `_nj` did not fit the first 1024-byte window, so the model issued a second, **unsized** 1024-byte read at offset 1024 — the one exact-read violation in any run.

### Diagnosis

**Comfort.** Exact-size discipline was near-perfect: 6/6, 5/5, 12/12 and 12/12 exact header reads and 6/6 exact body reads, **zero** repeated reads, **zero** requests for offset `-1`, and **zero** out-of-range reads across every run. `no = -1` halted Pattern A correctly; on the two *search* fixtures (which have no `-1`) the model stopped after one pass and reported the loop it found instead of spinning — a search result, not a format rule. Pattern B was clean at the decision level: the schema format was accepted, every decision parsed, no invalid ids, and the right record was chosen. The specific failures the concept predicts at large scale — lost loop state, losing track of a visited record, reading `-1`, hallucinated progress — did **not** reproduce at 12 records.

**Struggle.** Four weak spots showed up, three of them real model failures and the last a design confirmation:
1. **It flattens instead of iterating.** The A-program run fetched each instruction exactly once (`header_visits` all 1, `loop_back_jumps: 0`) and executed the `JNZ` loop inside its own reasoning — `"These are independent reads, so I can do them together."` So Pattern A "worked" by using context as RAM, which is precisely the scaling hazard the concept predicts. That is *consistent* with the thesis, but it is not evidence of true cyclic byte execution.
2. **The root boundary breaks exactness.** Because the root `_nj`'s length is not declared anywhere, the model had to guess a window; when 1024 bytes were not enough, it issued an unsized second read. The rest of the protocol is exact; the very first move is not.
3. **Identity of an offset is unreliable.** The model located the cycle offset correctly (2042) but named the wrong record for it — reproducibly on both N=12 runs and once in the 5-record pilot. It is a *pointer source vs pointer target* confusion: it reports the record whose `no` field equals the offset, not the record whose `_nj` starts there. Crucially, the target header **already carried the label `record-5`**; adding an id would not have helped, because the label was present and was still misread. Identity needs to be machine-checkable/copyable rather than recounted.
4. **No proactive HALT in Pattern B.** The model emitted `FETCH_NEXT`/`READ_BODY` but never `HALT`; termination came from the backend reaching end-of-file. "Guaranteed termination" therefore rests on the backend, which is where the design puts it — confirmed, not contradicted.

### What would make the machine more comfortable

Each item is grounded in an observed failure, not a guess:

- **(a) Keep termination in the program; check it at author time.** A cyclic `no` is a loop, not an end, so the exit is the program's own branch to `no = -1`. The format should not guess — but the *linker/validator* can do what a compiler does and warn when a program can never reach HALT. That is developer tooling for a buggy program, not a reader rule.
- **(b) Make headers self-describing.** Add `hlen` (this header's own length) so a reader never has to guess the root window; the extra unsized read at offset 1024 disappears, and "did I read exactly the right size?" no longer requires cross-referencing the previous header's `nl`.
- **(c) Separate machine opcode from prose.** Put the opcode/kind in a dedicated field (`_nj.kind: "op" | "record"`, and an `op` in the body) and keep `description` human-only. Today the opcode lives in `description`, which conflates the index key with the program counter.
- **(d) For jumps, ship a label beside the offset.** Add `target_label`/`id` next to `target_offset` for conditional jumps; the self-correction quote above shows the model re-deriving which record an offset belongs to — a copyable label removes that step.
- **(e) Improve record identity for reporting.** Identity must be machine-checkable and copyable. For a *search* over a cyclic structure the useful convention is to report a closed loop by the target record's own label/offset; for *execution*, revisiting is normal and there is nothing to report. The model detected the loop unassisted; explicit wording would steer the *labelling* it got wrong, which an id alone did not fix because the label was already there.
- **(f) Give Pattern B data to halt on.** Include `count`/`end` (or a per-batch terminal marker) so the engine can emit and accept `HALT` on data, rather than treating an exhausted batch as the stop condition.

## 7. Token Economy (Hypothesis, Not Measured)

The live run above was too small to measure context pressure, so this section is an **architecture-based hypothesis**, not experimental data. The only real token numbers from the run are Pattern B's two decisions: **689 + 673 tokens** on a 12 KB index, with the target chosen after a single `FETCH_NEXT`.

The structural argument is qualitative:

| Metric | Pattern A (Pure Turing) | Pattern B (Hybrid + SGR) |
|--------|-------------------------|---------------------------|
| LLM calls to `read` | one per header visited, and (observed) one per body even when not needed | one per batch of headers, plus selected bodies only |
| Context growth | every header and body stays in context | only the current batch stays in context |
| Backend state management | none (the model manages everything) | full (offsets, visited set, limits) |
| Audit trail | partial (LLM context) | full (backend logs + SGR reasoning) |

**Hypothesis at larger scale** (explicitly speculative): Pattern A would keep the whole traversal in context and, per the flattening behaviour observed above, could run out of budget on large documents; Pattern B would process fixed-size batches independently and be bounded by batch count. Neither the 50-record nor the 500-record case was tested.

## 8. Honest Caveats

1. **Pattern A is theoretically elegant but unproven at scale.** It is a good teaching tool for understanding `.njson` as a VM, and it produced a correct result on the small program — but by flattening, so true byte-level iteration remains unvalidated.
2. **Pattern B requires more backend code**, but it is the same code you would write for any state machine. The payoff is that the messy state management is deterministic.
3. **Only one model was tested**, (`deepseek-v4-flash`). No local model (Llama/Qwen via Ollama) and no other cloud model was run, so any cross-model or local-model claim is hypothesis. The observed identity mislabel is stochastic, measured on two preserved 12-record runs and one 5-record run.
4. **SGR is not magic.** You still need to design good schemas and test them. It turns "maybe the LLM will follow instructions" into a schema it cannot violate — but it does not make the model *want* to stop, as the missing `HALT` showed.

## 9. Next Steps

1. **Implement Pattern B in production for the Kodavr index.** The 5-dump index from the original article is small enough for Pattern A, but as the registry grows, Pattern B is the bounded option.
2. **Explore fractal RAG**: nested `.njson` bodies with hierarchical SGR schemas. The backend orchestrates the outer loop; the LLM decides when to descend.
3. **Vector search over header descriptions**: instead of batch-fetching headers, use embeddings to select the most relevant ones. This turns Pattern B into a hybrid of symbolic and semantic search.
4. **Try the format changes from §6 in the next probe**: `hlen`, a dedicated `kind`, jump labels, and `count`/`end` for Pattern B — and re-measure identity labelling at larger scale.
5. **Runaway detection as author-time tooling.** A C-like format leaves "does this program ever reach `no = -1`?" to the linker/validator — a compile-time warning, not a reader rule. A search reader keeps its own seen-set; a program that never halts is a bug to fix, not a format feature.

