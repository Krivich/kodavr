# Free hunt: a console bridge and an exploratory walk that find the bugs before the human does

Raw dump. Author voice, dead ends included. You do not need an LLM in your product for
any of this: you need an HTTP API and a development agent with a console. The perimeter
machinery below is runtime-agnostic — it works with any agent harness, and half of it
works with human developers too, because it is discipline with tooling, not magic.
Working code is inlined at the end of each part; names and paths are placeholders you
match to your project — including doc references such as `docs/human-emulator.md`, whose
map is condensed in this dump.

## Context

The project is a web service with an HTTP API and a test suite that passes. For months
the ritual was: suite green → agent reports "ready" → I open the app and find, within ten
minutes, bugs the suite never imagined. Each round cost an evening and a little trust.
The insult was that the agent knew better than any test: it had just implemented the
feature; it knew which endpoints it touched, which invariants it bent, where the side
effects could hide. That knowledge died at session end, and my evening became its
graveyard.

The fix was not "write more tests". It was to stop making the human the first thing that
ever exercises a feature end-to-end. On 2026-09-06 I built an emulator of the human over
the product's own HTTP surface and let the agent drive it. It found four bugs in one
session — a reply that died mid-envelope at the token limit and leaked a shard, a model
that asked the human for an id it was supposed to take from a tag, a BOM/CRLF contract
blindness, and a drift in the emulator's own fold tags — and it walked a chain (connect an
external server → ask about the project → produce a full overview) that had never once
been completed end-to-end. The walk became a standing step between "suite green" and "the
human looks".

## The bridge

The bridge maps the project's HTTP API into the agent's own console: short commands
(status, chat, approve, tools, dump, tail, log, get) with a read/write split and hard
deadlines on every call. Why console and not curl one-liners: one command = one bounded
call with a timeout; output lands in files, not in context; the write side is gated
behind the human approval that already exists in the product. The map
(`docs/human-emulator.md`) is the contract: which commands exist, which are read-only,
which mutate, and what the underlying wire really is.

Two design facts make it work:

- **The frontend is a dumb renderer.** Everything a human does through the UI is
  expressible as HTTP: chat is a POST of the ancestor chain of the current leaf, approval
  is a POST of a pending proposal id, and every reply, proposal, tool result and
  continuation lands in the same stream file the UI reads. So the agent that used to
  analyze pasted dumps can now *produce* those dumps itself.
- **The stream file is the only source of truth.** No websocket is needed: whatever rides
  the live fan-out is also persisted in the stream, so `dump`/`tail` see timer alerts,
  widgets and continuations exactly as the human's page would.

An agent that can only read is a spectator; an agent that can write without a gate is a
hazard; the read/write split plus the product's own approval gate is what makes it a
colleague.

**It is a dev instance, not production — and nearly a sandbox.** The bridge drives a
running server, but in practice a local dev one, so the blast radius is a disposable data
dir and its config — close to a sandbox, though not one: config patches connect real
external servers, saved widget templates persist, timers fire. The human accepted that
pollution in exchange for a loop that exercises the real thing; unwanted side artifacts are
deleted by hand, never silently. On top of that the proposal-only gate holds every write:
a change is a proposal the human approves, and a proposal that cannot be formed is a
visible refusal, never a silent success.

### The console map (`docs/human-emulator.md`, condensed)

```markdown
# Semi-real testing: the human emulator + an external watchdog

The tier between deterministic unit tests and the human's manual clicking.
Real code, real LLM, real HTTP, mock outside-world servers — and the HUMAN is
emulated by a script.

## The loop
1. Scenario step = one emulator command, always through the watchdog:
     node scripts/lab-watchdog.mjs 240 node scripts/human-emulator.mjs chat "<text>" --new
     node scripts/lab-watchdog.mjs 240 node scripts/human-emulator.mjs approve <proposalId>
2. Observe: dump (the thread, human-visible text), dump --content (agent-side
   content), tail / log (the wire: LLM call/reply with finish_reason, gate
   events, widget previews).
3. Decide as the human would — approve, reject, or the next message.
4. Findings graduate: every real bug becomes a deterministic test with a stable
   requirement id (the suite stays the single source of truth; the semi-real
   run is how the truth is DISCOVERED).

## Commands
  status                       # is the live agent reachable?
  chat "<text>" [--new]        # one turn; --new = fresh thread (replyTo null)
  chat "<text>" --reply <id>   # reply inside a specific line
  approve <id> [--reject]      # the human's decision on a pending proposal
  tools                        # per-server tool counts + index
  dump [--content] [n]         # readable stream tail
  tail [n] | log <regex>       # the JSONL log, compact / grep
  get <path>                   # ad-hoc GET with a deadline

All fetches carry AbortController deadlines — a slow turn never hangs the
caller; the turn keeps running server-side and dump/tail retrieve it.

## The UI contract the emulator implements
- Chain, not history: each turn sends the ancestor chain of the current leaf
  (walk replyTo to the root, send root->leaf); the new message replies to the
  leaf. --new leaves replyTo null — a fresh line, so a test dialog never
  hijacks the human's current thread.
- Fold tags: tool rows in the chain are sent TAGGED
  (`[widget server/tool #id] content`) — exactly the controller's fold. An
  untagged chain makes the model guess ids it is told to take from tags.
- The envelope: replies arrive parsed ({reply, proposal}); the continuation
  after an approve arrives in the same HTTP response.

## Discipline (hard-won)
- Watchdog everywhere: every step goes through the external watchdog; a firing
  is LOGGED, never a silent lock.
- No bare fetch: ad-hoc probes go through `get` or a script with its own
  AbortController.
- Logs are the oracle: read the JSONL log after every surprising step, not only
  on failures.
- Side effects are REAL: the run is on the live server. Delete unwanted side
  artifacts by hand; never silently clean someone else's data.
- Pixels out of scope: CSS/layout stays with screenshot tooling. This bridge
  judges dialog, not looks.
- No questions mid-walk: bounded timeouts, dump-after-step, decide from
  observations. A walk means walk.
```

### Bridge source — `scripts/human-emulator.mjs`

Display strings in the source are translated to English for publication; the fold format
they emit is unchanged.

```javascript
#!/usr/bin/env node
// The console bridge: speak to the LIVE <project> agent over the same HTTP
// API the frontend uses (nothing is faked server-side; configs are not
// touched from here — the human curates the live config).
//
//   node scripts/human-emulator.mjs status
//   node scripts/human-emulator.mjs chat "<text>" [--new]   — one turn; --new starts a fresh thread (replyTo null)
//   node scripts/human-emulator.mjs approve <id> [--reject] — the human's decision on a pending proposal
//   node scripts/human-emulator.mjs tools | dump [--content] | tail [n] | log <regex> | get <path>
//
// The stream/log are read from the LIVE data dir (<data-dir>/), the same place
// the UI reads from. Every call has a deadline (fetchJ) — nothing hangs; pair
// with scripts/lab-watchdog.mjs for a hard outer kill.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const BASE = process.env.BRIDGE_URL || 'http://127.0.0.1:4141';
const LIVE = path.join(REPO, '<data-dir>');

const out = (s) => process.stdout.write(s + '\n');
const flag = (name) => process.argv.slice(2).includes(name);

async function fetchJ(what, url, opts = {}, deadlineMs = 200000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), deadlineMs);
  const t0 = Date.now();
  try {
    const res = await fetch(url, { ...opts, signal: ctl.signal });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    return { code: res.status, body, ms: Date.now() - t0 };
  } catch (e) {
    return {
      code: 0,
      body: { error: `${what}: ${e.name === 'AbortError' ? `timeout after ${deadlineMs / 1000}s (the turn keeps running server-side — dump/tail will show)` : String(e.message || e)}` },
      ms: Date.now() - t0
    };
  } finally { clearTimeout(t); }
}

// --- the live stream, as the UI sees it -------------------------------------

function stream() {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(LIVE, 'stream.json'), 'utf8'));
    return s.messages || [];
  } catch { return []; }
}

// The UI thread: ancestor chain of the LAST stream message (the leaf); a new
// user message then replies to the leaf. --new leaves replyTo null (a fresh
// line) so a test dialog never hijacks the human's current thread.
function chainOfLast() {
  const msgs = stream();
  if (!msgs.length) return { chain: [], leaf: null };
  const map = new Map(msgs.map((m) => [m.id, m]));
  let cur = msgs[msgs.length - 1];
  const up = [];
  while (cur) {
    up.unshift(cur);
    cur = cur.replyTo ? map.get(cur.replyTo) : null;
  }
  return { chain: up, leaf: msgs[msgs.length - 1] };
}

// The UI contract (the controller's fold): tool rows in the chain are sent
// TAGGED, so the agent knows which widget thread it is talking in. The
// emulator must fold identically or the agent loses the ids it is told to
// take from tags (live bug: an untagged chain made the model guess messageId).
function foldTextOf(m) {
  if (m.kind === 'tool-result') {
    return `[widget ${m.server}/${m.tool}${m.id ? ' #' + m.id : ''}${m.alertTitle ? ' · ' + m.alertTitle : ''}] ${m.content}`;
  }
  return `[picked from widget ${m.server}/${m.tool}${m.id ? ' #' + m.id : ''}: ${m.content}]`;
}

async function cmdChat(text, replyArg) {
  const { chain } = chainOfLast();
  const fresh = flag('--new');
  const msg = {
    id: 'drv' + Date.now().toString(36),
    role: 'user',
    content: text,
    replyTo: replyArg || (fresh || !chain.length ? null : chain[chain.length - 1].id)
  };
  // The UI sends the ancestor chain of the NEW message's leaf: a fresh line
  // (`--new`) carries ONLY the new message, no old ancestors — otherwise the
  // emulator drags the whole previous conversation into the context (live bug:
  // a "new thread" request blew the provider's token budget).
  const base = fresh ? [] : chain;
  const thread = [...base.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.kind === 'tool-result' || m.kind === 'selection' ? foldTextOf(m) : m.content,
    replyTo: m.replyTo || null
  })), msg];
  out(`> ${text}${replyArg ? `  (-> ${replyArg})` : fresh ? '  (new thread)' : `  (-> ${msg.replyTo})`}`);
  const { code, body, ms } = await fetchJ('chat', `${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ thread })
  });
  out(`[chat ${code} in ${ms}ms]`);
  if (code !== 200) { out(JSON.stringify(body, null, 2)); return; }
  const r = body.reply || {};
  out('reply: ' + (r.text !== undefined ? r.text : JSON.stringify(r)).slice(0, 1600));
  if (body.proposal) {
    const p = body.proposal;
    out(`proposal ${p.id} (${p.status}): ${p.server}.${p.tool}`);
    out('  args: ' + JSON.stringify(p.args).slice(0, 800));
  }
}

async function cmdApprove(id) {
  const { code, body, ms } = await fetchJ('approve', `${BASE}/api/tools/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...(flag('--reject') ? { action: 'reject' } : {}) })
  });
  out(`[approve ${code} in ${ms}ms]`);
  out(JSON.stringify(body, null, 2).slice(0, 2500));
}

async function cmdTools() {
  const { code, body } = await fetchJ('tools', `${BASE}/api/tools`, {}, 60000);
  out(`[tools ${code}]`);
  const counts = {};
  for (const t of body.tools || []) counts[t.server] = (counts[t.server] || 0) + 1;
  out('per server: ' + JSON.stringify(counts));
  for (const t of body.tools || []) out(`${t.server}.${t.name} — ${t.title || ''}`);
}

function cmdDump(withContent) {
  const msgs = stream();
  if (!msgs.length) { out('(empty stream)'); return; }
  const KIND = { chat: 'msg', 'tool-proposal': 'PROPOSE', 'tool-result': 'RESULT', alert: 'ALERT' };
  const last = Number(process.argv[3]) || 0;
  for (const m of msgs.slice(last ? -last : undefined)) {
    const head = `#${m.id} ${KIND[m.kind] || m.kind}${m.role ? ' ' + m.role : ''}` +
      (m.server ? ` ${m.server}.${m.tool}` : '') +
      (m.status ? ` [${m.status}]` : '') +
      (m.replyTo ? ` -> ${m.replyTo}` : '');
    out(head);
    if (m.text !== undefined) out('  text: ' + String(m.text).replace(/\n/g, ' | ').slice(0, 400));
    if (m.args && Object.keys(m.args).length) out('  args: ' + JSON.stringify(m.args).slice(0, 400));
    if (withContent && m.content !== undefined) out('  content: ' + String(m.content).replace(/\n/g, ' | ').slice(0, 900));
  }
}

function readLog() {
  try {
    return fs.readFileSync(path.join(LIVE, 'logs', 'server.jsonl'), 'utf8').split('\n').filter(Boolean);
  } catch { return []; }
}

function cmdTail(n = 40) {
  for (const l of readLog().slice(-n)) {
    let e;
    try { e = JSON.parse(l); } catch { out(l.slice(0, 200)); continue; }
    const bits = [new Date(e.ts).toISOString().slice(11, 19), e.evt];
    for (const k of ['model', 'chars', 'ms', 'status', 'error', 'reason', 'tool', 'server', 'code', 'path', 'kind', 'name']) {
      if (e[k] !== undefined) bits.push(`${k}=${String(e[k]).slice(0, 140)}`);
    }
    out(bits.join(' '));
  }
}

function cmdLog(pattern) {
  const re = new RegExp(pattern, 'i');
  const lines = readLog().filter((l) => re.test(l));
  out(`[log: ${lines.length} lines match ${pattern}]`);
  for (const l of lines.slice(-30)) out(l.length > 900 ? l.slice(0, 900) + '…' : l);
}

async function cmdGet(p) {
  const { code, body, ms } = await fetchJ(`GET ${p}`, `${BASE}${p || '/'}`, {}, 30000);
  out(`[GET ${p} ${code} in ${ms}ms]`);
  out(typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body).slice(0, 600));
}

async function cmdStatus() {
  const { code } = await fetchJ('status', `${BASE}/`, {}, 8000);
  out(code === 200 ? `live agent up on ${BASE}` : `live agent DOWN (${code}) on ${BASE}`);
}

const [cmd, ...rest] = process.argv.slice(2);
const go = {
  status: cmdStatus,
  chat: () => {
    const args = [...rest];
    let replyTo = null;
    const ri = args.indexOf('--reply');
    if (ri !== -1) { replyTo = args[ri + 1] || null; args.splice(ri, 2); }
    const ni = args.indexOf('--new');
    if (ni !== -1) args.splice(ni, 1);
    return cmdChat(args.join(' '), replyTo);
  },
  approve: () => cmdApprove(rest[0]),
  tools: cmdTools,
  dump: () => cmdDump(flag('--content')),
  tail: () => cmdTail(Number(rest[0]) || 40),
  log: () => cmdLog(rest[0] || '.'),
  get: () => cmdGet(rest[0])
}[cmd];

if (!go) {
  out('usage: human-emulator.mjs status|chat|approve|tools|dump|tail|log|get');
  process.exit(2);
}
Promise.resolve(go()).catch((e) => { out('FATAL: ' + String((e && e.stack) || e)); process.exit(1); });
```

### Watchdog source — `scripts/lab-watchdog.mjs`

```javascript
#!/usr/bin/env node
// External watchdog: run a command with a hard deadline. On expiry the child
// (and its tree) is killed and the firing is LOGGED — every hang leaves a
// visible trace, never a silent lock.
//
//   node scripts/lab-watchdog.mjs <seconds> <cmd> [args...]
//
// Log: %TEMP%\<lab-dir>\watchdog.log — one line per firing (ts + the command).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [secs, cmd, ...args] = process.argv.slice(2);
if (!secs || !cmd) {
  console.error('usage: lab-watchdog.mjs <seconds> <cmd> [args...]');
  process.exit(2);
}
const LAB = process.env.BRIDGE_LAB_HOME || path.join(os.tmpdir(), '<lab-dir>');
fs.mkdirSync(LAB, { recursive: true });
const LOG = path.join(LAB, 'watchdog.log');

const child = spawn(cmd, args, { stdio: 'inherit', shell: false });
const t0 = Date.now();
const line = (s) => {
  fs.appendFileSync(LOG, `${new Date().toISOString()} ${s} [${secs}s] ${cmd} ${args.join(' ')}\n`);
};
const killer = setTimeout(() => {
  line(`FIRED (killed after ${Math.round((Date.now() - t0) / 1000)}s)`);
  try { child.kill(); } catch {}
  // belt: the child may have its own children (npm runs, etc.)
  try { spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
  setTimeout(() => process.exit(124), 1500);
}, Number(secs) * 1000);

child.on('exit', (code) => {
  clearTimeout(killer);
  if (code === 124) line('reported by nested watchdog');
  process.exit(code === null ? 1 : code);
});
child.on('error', (e) => {
  clearTimeout(killer);
  line(`spawn error: ${String(e.message || e)}`);
  process.exit(1);
});
```

## Free hunt protocol

The hunt is not a test run. It is exploration with a declared budget. Rules that survived
contact with reality:

1. **Scope allows-list.** The brief lists the areas, seeds and endpoints the hunt may
   touch; everything else is out of bounds by default. "Look around" is not a scope. When
   the change is fresh, the most valuable scope is "what we just changed, and the
   capabilities the registry claims are done".
2. **Read before write.** The agent maps state (`status`, `tools`, `dump`) before it
   mutates anything; every write goes through the product's approval gate, so a mutation
   is a proposal the human (or the emulated human) can refuse.
3. **Evidence to files.** Every finding = request, response, expected vs observed,
   appended to a journal file; the context receives paths, never payloads. Confirmed
   anomalies graduate into deterministic tests; the journal points at the log event.
4. **Hunted and not-hunted.** The report lists what was hunted AND explicitly what was
   not, so the human reads the blind spots first.
5. **Declared budgets.** Timebox and mutation budget are stated upfront; hitting either
   ends the hunt with a partial report, never silently.

Two more rules the walks added on their own:

- **Mode parity.** If the product has more than one reply-envelope tier (a schema-enforced
  JSON tier and a markdown tier), run the same seed in BOTH. The markdown tier is the one
  with no `response_format`; tier-only breaks hide there.
- **Minimize, then neighbour-check.** On any break, run the smallest variation that still
  breaks, then ask "does the same class break elsewhere?" (the sibling tools, the sibling
  directive, the sibling refusal path) before calling it fixed.

The oracle is the agent's own context: what it implemented this session, what it bent,
which invariants it promised. Tests check what you thought of. The hunt checks what you
didn't.

### Origin incident — the long line that ate its own evidence

The first walks had no evidence-to-files rule. Findings lived in the conversation: the
agent would discover an anomaly, paste the full request and response into context,
comment on it, then move on. On 2026-09-08 a single line ran through five scenarios; by
the end its context carried tens of thousands of tokens of raw tool results (large
MCP payloads, full mode with image arrays), the free-tier provider refused the
continuation at 55,908 input tokens against a 46,112 limit, and the workspace had to be
abandoned onto fresh lines. The findings that mattered had already scrolled to the top of
a line nobody could continue. It did not lie when asked later — it genuinely could not
see what it had found three hundred messages earlier.

The same day, a second symptom pointed at the same seam: the emulator's `--new` flag set
`replyTo: null` but still sent the LAST leaf's entire ancestor chain in `thread` — a
"new line" dragged 47 messages / 164k characters into the request and hit the same
provider limit. The controller, for a genuinely new line, sends only the new message.

Both fixes are the same idea, and it became rule 3:

- a walk writes its findings to `docs/testing/<date>.md` and its snapshots to
  `docs/incidents/<slug>/` (a script extracts the whole turn byte-for-byte from the log);
- the emulator sends the chain the controller would send, nothing more.

The rule exists because an agent that keeps its evidence in its head keeps losing it.

## The catch

Four real catches from the walk logs. Each lived in a seam between two components that
each passed their own tests.

- **The directive that taught the call but not the contract.** A natural first-ask —
  "this is unreadable, make a proper list: name, price, image, rating" — produced three
  widget-template proposals in a row, each refused by the preview gate for a different
  violation (an inline `onerror=` handler; a dotted numeric path `{{this.images.0}}` that
  Handlebars parses as a syntax error). None reached the human. The pack directive taught
  *which tool to call*, but the template contract lived in an authoring skill the agent
  did not read on its own. The moment the human said "look in the widget skill" the very
  next proposal compiled. The suite tested the gate and the renderer separately; nothing
  tested the routing between the directive and the contract.
- **The wire that forces a big payload through an escaped string.** The envelope schema
  declared `args` as `type: "string"`, so a large template (with `"` in every `style=`
  attribute) had to be serialized as an escaped JSON string inside the envelope JSON —
  double-escaping, where one stray brace kills the whole call (`JSON.parse` threw at
  position 1620). The parser already accepted an object OR a string; only the schema
  forbade the object form. Loosening it to `["string","object"]` fixed the class — but
  the canonical examples still taught the string form, so the teaching had to change too.
  The seam: what the schema allows vs what the examples say.
- **The retry that silently dropped `once`.** "Remind me in 2 minutes to drink water" →
  the first timer proposal carried `once:true` (correct) but the gate refused it for a
  missing required filter. On the retry the model supplied the filter and dropped
  `once` → `once:false` → a timer that fires every two minutes. It spammed an alert and
  the human had to kill it. A gate refusal on one required arg loses the other args'
  intent on the model's retry. The fix was to stop requiring the filter, so the common
  case never needs the retry that lost the flag.
- **The doomed call that passed the gate, then repeated.** A memory write named a
  collection that did not exist. The gate did not check it, so the card reached the human
  and was approved; only then did execution refuse. And because the refusal was *returned*
  as an ordinary result rather than *thrown*, the duplicate guard was blind and the
  follow-up re-proposed the identical call. Two seams at once: gate ↔ execution belt, and
  the refusal channel ↔ the duplicate guard.

The pattern: every caught bug lived in a seam between two components that each passed
their own tests. The suite tested bricks. The hunt tested mortar.

### Case from another project: hunting a data format instead of an HTTP API

The same loop caught design bugs in a data format built for LLM readers. The artifact was
a large index file; the "interface" was a generic byte-read tool
(`read_file(path, offset, limit)`) with no knowledge of the format; the hunt was a live
agent asked to find one record and report it. Two failures were worth more than the
successes:

- **Round chunks.** Told loosely to "read what you need", the agent asked for round
  windows (1024 bytes) and spilled past headers into bodies it had not chosen. The fix
  was one sentence in the document's embedded instructions: *after the first, unsized
  read, request exactly the size a header gives.* The agent then obeyed the rule and even
  cited it back. The bug was not the agent's laziness; it was an instruction the format
  had forgotten to state.
- **Two coordinate systems.** A draft version stored nested offsets relative to each
  nested document, so reading a nested record meant computing
  `parent_base + relative_offset`. The agent, following the instructions literally, read a
  truncated header and its reasoning dissolved into byte arithmetic it kept getting wrong.
  The format was asking the reader to compute. Making every offset absolute from the file
  start removed both the arithmetic and the special case; the re-run read cleanly with no
  counting.

Both catches came from watching a real agent fail, not from reasoning about what an agent
ought to do. The suite-analogy holds: a format spec is the bricks; a live agent reading
it is the mortar.

## Autonomous fixes and their safety

Bugs found at 2am cannot wake the human; waking me for every catch is how you train me to
ignore the agent. So a hunt that finds a bug spawns a fix delegate automatically — inside
a perimeter. The perimeter is not trust. It is machinery, and it grows from the context
machine pack (the companion dumps on agent-control and requirements-machine):

- **Scope by requirement IDs.** Every fix brief carries the registry IDs it serves. The
  registry is one file of one-line requirements with stable IDs and statuses; the brief's
  CONTRACT section names files the delegate may and may not touch. An out-of-scope change
  is a review failure, not a discussion. New behaviour gets a new ID and a red test
  before the implementation.
- **Blast radius readable before the first edit.** The code map and the linted flow map
  say who consumes what; the delegate takes its zone from the map and does one targeted
  read. Survey walks are forbidden and, more importantly, unnecessary. The map is
  generated and its drift is itself a gate failure, so it cannot quietly lie.
- **Gates hold the line.** `npm run req` fails on a test referencing an unknown ID and on
  a ✅ row without a test; the flow-map lint fails on drift between the drawn flow and the
  code tree; `npm test` fails on regressions. A fix that "works" while breaking the
  registry–test–code contract does not merge. The contract is held by gates, not by pleas
  in the prompt: a weak model does not obey prose, it obeys exit codes.
- **Autonomy must be recoverable.** Mechanical checkpoints (verbatim human instructions +
  todo + touched files) are written on every compaction regardless of model quality; the
  checkpoint head stays tiny by diet. A delegate that dies mid-fix leaves a trail a next
  session can resume, not a mystery.
- **Money and permission are gates too.** Delegation tools ask by default; a child always
  starts with a fresh context, so every delegation costs tokens; auto-approval is
  per-tier and explicit, never silent.
- **Fail-visible.** A delegate that lacks data returns BLOCKER instead of guessing; a
  refusal is thrown onto the one refusal channel and is visible to both the human and the
  guard. A broken verdict is an alert, never silence.

What changed is the definition of done, not the tooling: "done" now means hunted, fixed
inside perimeter, gates green, report with blind spots named.

## Control commands the hunt leans on

These are the operations the walk and the fixer call; they are the concrete gates named
above. The command names come from two of the author's projects — this platform's gates
(`req`, `contract`, `state:diet`, `workflow-arrows:lint`) and the hunted project's
scripts (`incident`, `logs:md`, `start.ps1`…) — so treat the block as a pattern to adapt
to your own repo, not a copy-paste. Install/mapping detail is in the companion dumps.

```bash
npm test                          # the whole suite (the single source of truth)
npm run req                       # reconcile test IDs against the requirements registry;
                                  #   exits non-zero on a typo'd ID or a ✅ row with no test
npm run contract                  # regenerate the code maps; drift => exit 1
npm run workflow-arrows:lint      # the drawn flow map vs the code tree; drift => exit 1
npm run state:diet                # keep the always-on checkpoint tiny (archive the tail)
npm run incident "<fragment>"     # extract one whole turn from the JSONL log into
                                  #   docs/incidents/<slug>/ (prompt + reply + decisions)
npm run logs:md                   # log -> human-readable play + full JSON transcript

# server lifecycle (agent-safe: never run the server in the foreground of a tool call)
scripts/start.ps1                 # start; stop.ps1 to stop; health.mjs to check
```

The two rules behind the list: **the suite is the only truth** (a semi-real run is how you
find the truth, never how you prove it), and **a claim without gate output paths is not a
claim**.

## If your core generates prompts — the prompt X-ray

If — and only if — your system's core is an LLM that writes prompts for its own delegates,
you will meet the failure mode where the agent blames the model. In our experience the
blame inverted every single time we pulled the failing prompt from the log and read it
honestly. The loop:

1. **Snapshot.** Extract the whole turn from the log (`npm run incident "<fragment>"` in
   the author's project — in yours, whatever cuts one turn out of your JSONL)
   and read the system message as a document, not as context. Look for contradictions
   (examples vs schema), dead/phantom fields, a ban with no legal alternative, duplication,
   dilution, and where the model lacked a needed form.
2. **Hypotheses**, written before any edit.
3. **Sketch.** Copy the system message and edit it BY HAND by the hypotheses — never by
   editing the core that generated it.
4. **X-ray.** Replay the same turn against the sketch on a reasoning-capable model
   (`scripts/tooling/dev-tools/prompt-reason-probe.mjs --from-log <ts> --demo-proposal <sketch>`), A/B
   base vs sketch, n=5 per arm; then an isolation run with one edit per arm to prove which
   edit carries the effect.
5. **Verdict.** A confirmed hypothesis becomes a requirement ID + a core fix (test
   first). A refuted one is logged with the same snapshot as "the prompt was not the
   culprit".

Worked example from the walk: a template kept failing on `{{this.images.0}}`. The naive
read was "weak model invents a field". The snapshot showed the tool description advertised
photos, the chosen mode returned none, the envelope examples actively taught a form the
schema called discouraged, and the prompt banned numeric paths without offering any legal
way to take ONE element. A positive `[0]` form ported into the authoring contract fixed
it on the weak model (0/5 dotted, 5/5 bracket), and an isolation run proved that single
edit carried the whole effect. The model was never the prime suspect once the prompt was
read. (A dedicated prompt-forensics write-up is planned; the failure and the loop are real
and self-contained here.)

## What worked, what did not

Worked: console as the agent's habitat; read-before-write; evidence-to-files; the
not-hunted list (I read it first, every time); perimeter by registry IDs — delegates
stopped wandering the moment briefs started carrying IDs and file contracts; the
positive-form teaching (a legal example beat a prohibition); the prompt X-ray (blame
inverted every time).

Did not work: the first walks without a checklist walked happy paths only — the agent is
lazy in exactly the ways you are, and "look for trouble" without a route finds none;
inline payloads bloated context until the evidence-to-files rule landed; one walk without
a mutation budget rearranged live data and made the next walk's baseline untrustworthy
(the budget became mandatory that day); early delegate reports claimed "fixed" for changes
the gates later rejected — the report template now requires gate output paths, and a claim
without them is not a claim; and a walk once ran for a round against a stale server
because only a health endpoint was checked, not the server's own config line — health is
not liveness.

## Definition of done, v2

- A fix claim without gate output paths is not a claim.
- A "done" without a hunt report (hunted + not-hunted) is not done.
- A delegate brief without requirement IDs is out of perimeter: rejected at review, not
  argued about.
- An action is never reported as done before its approval result came back — a false
  "already working" is worse than a visible failure.

## Artifacts

- This dump's `raw.md` contains, inline: the console map, the full bridge source
  (`scripts/human-emulator.mjs`), the watchdog source (`scripts/lab-watchdog.mjs`), the
  walk protocol, the real catches, the fix perimeter and the control commands — enough to
  re-build the practice in one pass.
- The perimeter machinery (registry protocol, coverage gate, checkpoint sentinel,
  delegation with approval, lazy layers) is published as companion dumps:
  [The agent-control loop](https://kodavr.xyz/dumps/2026-09-18-opencode-agent-control/)
  and
  [The requirements machine](https://kodavr.xyz/dumps/2026-09-18-opencode-requirements-machine/).
