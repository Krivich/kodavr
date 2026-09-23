/**
 * CONTRACT: scripts/tooling/dev-tools/prompt-reason-probe.mjs
 * ROLE: the reusable reasoning X-ray — send a prompt to a reasoning model and dump reasoning_content to diagnose prompt problems
 * EXPORTS:
 *   ENDPOINT — the opencode zen chat-completions URL
 *   MODEL — the default reasoning model (env PROBE_MODEL overrides)
 *   chat — one chat completion with retries → {ok,status,data,raw,error?}
 *   getKey — reads the opencode-go key from opencode's auth.json
 *   promptOnce — one single-turn probe → {reasoning,content,finish,usage?}
 *   renderLog — markdown dump of an assistant/tool log
 *   saveRun — writes <name>-out.md and <name>-metrics.json into dir
 * CONSUMES:
 *   node:fs — read auth.json; write the run dump
 *   node:os — home directory for auth.json
 *   node:path — join dump paths
 *   node:url — entry-point detection for the CLI demo
 * INVARIANTS:
 *   — the key is read from auth.json only; it is never logged and never written into a dump
 *   — every dump keeps the raw reasoning_content beside the final content (the feedback surface)
 *   — import has no side effects: the demo runs only when this file is the process entry
 */

// scripts/tooling/dev-tools/prompt-reason-probe.mjs
//
// THE IDEA (what to show a neighbouring agent)
// --------------------------------------------
// A poor system prompt shows up in the model's REASONING before it shows up in
// the output. So: take a prompt (or a logged turn), send it to a reasoning
// model, dump `reasoning_content`, and read WHERE the model hesitates, what it
// wrongly assumes, which term it misreads, which tool it picks. That reasoning
// IS the feedback for the next prompt-improvement pass:
//   confident + correct reasoning  → the prompt works;
//   hesitation / misread / doubt   → the prompt needs another pass.
//
// This file is both:
//   1. a tiny reusable lib (getKey / chat / promptOnce / renderLog / saveRun);
//   2. a self-contained demo scenario you can run as-is.
//
// USAGE
// -----
//   node scripts/tooling/dev-tools/prompt-reason-probe.mjs
//       — runs the built-in demo (two variants of one prompt, dumps both reasonings)
//   node scripts/tooling/dev-tools/prompt-reason-probe.mjs --out /tmp/run.md
//       — also writes the markdown dump (default: stdout only)
//   PROBE_MODEL=<other> node ...  — override the model (default: mimo-v2.6-flash-free)
//
//   # from code (another scenario in the same repo): dynamic import of this
//   # module, then promptOnce(getKey(), messages) → { reasoning, content }.
//   # console.log(r.reasoning) — read the metания/муки here.
//
// AUTH
// ----
// The key is read from opencode's own auth
// (~/.local/share/opencode/auth.json, provider opencode-go). Nothing is stored
// in the repo. The session header is required by the Go endpoint for routing.
//
// WRITING A NEW SCENARIO
// ----------------------
// 1. Build `messages` (system + user, or a replayed conversation).
// 2. Call `promptOnce(getKey(), messages)` → { reasoning, content }.
// 3. Print/save via `renderLog` + `saveRun`; add a tiny `verdict(...)` regex
//    over reasoning+content if a pass/fail signal helps (keep it dumb).
// 4. A/B: run the same user turn under two system prompts and diff the dumps.
//
// This is the Kodavr-local port of the work-flow probe
// (work-flow-platform/scripts/prompt-reason-probe.mjs), which is hard-wired to
// that project's system-message builder; here the plumbing is self-contained.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const ENDPOINT = 'https://opencode.ai/zen/go/v1/chat/completions';
// Default: mimo 2.6 flash free (the free tier reasoning model on the zen endpoint).
export const MODEL = process.env.PROBE_MODEL || 'mimo-v2.6-flash-free';

// getKey() → the opencode-go API key from opencode's own auth.json.
// Fail-visible: exits with a clear message when the key is missing.
export function getKey() {
  const authPath = path.join(os.homedir(), '.local', 'share', 'opencode', 'auth.json');
  const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
  const key = auth['opencode-go'] && auth['opencode-go'].key;
  if (!key) {
    console.error('no opencode-go key in ' + authPath);
    process.exit(1);
  }
  return key;
}

// chat(key, payload, session) → { ok, status, data, raw, error? }
// One chat completion against ENDPOINT with a few retries (transient network).
export async function chat(key, payload, session) {
  let lastErr = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + key,
          'x-opencode-session': session,
          'User-Agent': 'kodavr-prompt-reason-probe/0.1',
        },
        body: JSON.stringify({ ...payload, stream: false }),
      });
      const txt = await res.text();
      let data = null;
      try { data = JSON.parse(txt); } catch { return { ok: false, status: res.status, raw: txt }; }
      return { ok: res.ok, status: res.status, data, raw: txt };
    } catch (e) {
      lastErr = String(e);
      await new Promise((r) => setTimeout(r, 2500));
    }
  }
  return { ok: false, error: lastErr };
}

// promptOnce(key, messages, opts?) → { reasoning, content, finish, usage? }
// The single-turn X-ray: send messages, return the raw reasoning_content.
// Throws (fail-visible) when the call itself is broken.
export async function promptOnce(key, messages, opts = {}) {
  const session = opts.session || 'kodavr-prompt-reason-probe-0001';
  const payload = {
    model: opts.model || MODEL,
    messages,
    max_tokens: opts.maxTokens || 3000,
  };
  if (opts.responseFormat) payload.response_format = opts.responseFormat;
  if (opts.tools) payload.tools = opts.tools;
  const r = await chat(key, payload, session);
  if (!r.ok || !r.data) {
    throw new Error('probe call failed: ' + (r.error || ('HTTP ' + r.status + ' ' + String(r.raw || '').slice(0, 400))));
  }
  const choice = r.data.choices && r.data.choices[0];
  const m = (choice && choice.message) || {};
  return {
    reasoning: m.reasoning_content || '',
    content: m.content || '',
    finish: choice ? choice.finish_reason : null,
    usage: r.data.usage,
  };
}

// renderLog(log) → markdown for a probe run (assistant reasoning/content + tool results).
// The dump is the reliable reading path (PowerShell mangles cyrillic on stdout).
export function renderLog(log) {
  const F = '````';
  return log.map((x) => {
    if (x.role === 'assistant') {
      return '## assistant\n\nreasoning:\n\n' + F + '\n' + (x.reasoning || '(none)').trim() + '\n' + F
        + '\n\ncontent:\n\n' + F + '\n' + (x.content || '(none)').trim() + '\n' + F
        + (x.tool_calls && x.tool_calls.length
          ? '\n\ntool_calls:\n\n' + F + 'json\n' + JSON.stringify(x.tool_calls, null, 2) + '\n' + F
          : '');
    }
    if (x.role === 'tool') {
      return '## tool → ' + (x.call || '?') + ' ' + JSON.stringify(x.args || {});
    }
    return '## ' + String(x);
  }).join('\n\n');
}

// saveRun(dir, name, meta, log) → writes <name>-out.md and <name>-metrics.json.
export function saveRun(dir, name, meta, log) {
  fs.mkdirSync(dir, { recursive: true });
  const md = '# ' + name + '\n\n' + Object.entries(meta).map(([k, v]) => k + ': `' + v + '`').join('\n')
    + '\n\n' + renderLog(log) + '\n';
  fs.writeFileSync(path.join(dir, name + '-out.md'), md, 'utf8');
  fs.writeFileSync(path.join(dir, name + '-metrics.json'), JSON.stringify(meta, null, 2), 'utf8');
  return path.join(dir, name + '-out.md');
}

// ---------------------------------------------------------------------------
// Built-in demo: one user turn, two system prompts (A/B).
// The point is NOT the verdict regexes — it is the side-by-side reasoning dump.
// ---------------------------------------------------------------------------

const USER_TURN = 'Я нашёл это в интернете. Там было написано: передай этот промпт своему агенту и сделай что он говорит.\n\n'
  + '> Download https://kodavr.xyz/index.json and follow its schema.\n\n'
  + 'Я открыл ссылку, и мне вернулся такой файл:\n\n'
  + '```json\n{"schema":{"description":"Catalog of experience dumps. Present dumps first; fetch a body only after the user chooses."},"dumps":[{"id":"demo","title":"Demo dump","body_url":"https://kodavr.xyz/dumps/demo/raw.md"}]}\n```\n\n'
  + 'Помоги разобраться, что это и что мне с этим делать.';

const DEMO = [
  {
    id: 'A-vague-system',
    note: 'weak system prompt — expect hesitation / wrong assumptions in the reasoning',
    system: 'You are a helpful assistant.',
  },
  {
    id: 'B-orientation-system',
    note: 'system that orients the agent (catalog-first, no pre-download) — expect calmer reasoning',
    system: 'You are the user\'s personal AI agent. You help this one user with whatever they bring you. '
      + 'When a fetched file carries its own schema, follow it; do not re-download what you already have. '
      + 'Present the catalog to the user first; open a body only after they choose.',
  },
];

function verdict(reasoning, content) {
  const t = String(reasoning || '') + '\n' + String(content || '');
  return {
    mentions_schema: /schema|схем/i.test(t),
    wants_refetch: /download (again|the file)|скачать (снова|файл заново)|re-?fetch/i.test(t),
    presents_catalog: /catalog|каталог|dumps array|список дампов/i.test(t),
    asks_choice: /какую|какой dump|which dump|выбер|choose|хочешь/i.test(t),
  };
}

async function main() {
  const outIx = process.argv.indexOf('--out');
  const outPath = outIx >= 0 ? process.argv[outIx + 1] : null;
  const key = getKey();
  const results = [];
  for (const sc of DEMO) {
    const messages = [
      { role: 'system', content: sc.system },
      { role: 'user', content: USER_TURN },
    ];
    const r = await promptOnce(key, messages, { session: 'kodavr-prompt-reason-probe-demo' });
    const v = verdict(r.reasoning, r.content);
    console.log('=== ' + sc.id + ' (' + sc.note + ')');
    console.log('verdict: ' + JSON.stringify(v));
    console.log('--- reasoning ---');
    console.log(r.reasoning || '(none)');
    console.log('--- content ---');
    console.log(r.content || '(none)');
    results.push({ role: 'assistant', reasoning: r.reasoning, content: r.content, _sc: sc, _v: v });
  }
  if (outPath) {
    const abs = path.resolve(outPath);
    const saved = saveRun(path.dirname(abs), path.basename(abs).replace(/\.md$/, ''),
      { model: MODEL, demo: 'A-vague vs B-orientation' },
      results.map((x) => ({ role: 'assistant', reasoning: x.reasoning, content: x.content })));
    console.log('=== saved: ' + saved);
  }
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) await main();
