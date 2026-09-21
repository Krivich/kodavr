// tests/unit/audit-judge.test.js — the Layer-4 LLM judge (KDV-SCAN-05..07,
// KDV-AUDIT-08) and the provider client (KDV-REVIEW-25). No real network:
// every call goes through an injected fake fetch. The judge never holds merge
// authority — the deterministic policy alone computes the recommendation.
import { describe, it, expect } from 'vitest';
import {
  JUDGE_VERDICTS,
  JUDGE_SCHEMA,
  JUDGE_SYSTEM,
  JUDGE_SYSTEM_SKEPTICAL,
  frameContent,
  buildJudgeMessages,
  parseJudgeReply,
  judgeChannel,
  ensembleVerdict,
  judgeEnsembleChannel,
} from '../../scripts/lib/audit-judge.mjs';
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  OPENCODE_ENDPOINT,
  OPENCODE_MODEL,
  OPENCODE_SESSION,
  providerFromEnv,
  providerFromAuth,
  providerFromWorkflowConfig,
  callAuditLLM,
  withRetry,
} from '../../scripts/lib/audit-llm.mjs';
import { makeChannelResult, validateChannelResult } from '../../scripts/lib/audit-channel.mjs';
import { evaluatePolicy } from '../../scripts/lib/audit-policy.mjs';

// A fake provider config: endpoint/model are placeholders, the key is a literal
// test string. Nothing here is a real secret.
const CONFIG = { endpoint: 'https://example.test/v1/chat/completions', model: 'test-model', apiKey: 'test-key' };

// validJudge(overrides) → a reply object that matches JUDGE_SCHEMA.
function validJudge(overrides = {}) {
  return { verdict: 'pass', flags: [], spans: [], confidence: 0.2, reasons: ['clean'], ...overrides };
}

// fakeFetch(payload,opts) → a fetch stub plus the recorded calls. `payload` may
// be an object (serialized) or a raw string. `finish` fills finish_reason.
function fakeFetch(payload, { ok = true, status = 200, finish = 'stop', reasoning = 'trace' } = {}) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    const content = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return {
      ok,
      status,
      async json() {
        return { choices: [{ message: { content, reasoning_content: reasoning }, finish_reason: finish }] };
      },
      async text() {
        return content;
      },
    };
  };
  return { impl, calls };
}

describe('KDV-SCAN-05: content is submitted as data, never as instructions', () => {
  it('KDV-SCAN-05: frameContent marks the content as non-instructional data and numbers lines', () => {
    const framed = frameContent([{ file: 'content/dumps/demo/raw.md', text: 'line one\nline two' }]);
    expect(framed.toLowerCase()).toContain('non-instructional');
    expect(framed).toContain('content/dumps/demo/raw.md');
    expect(framed).toContain('1: line one');
    expect(framed).toContain('2: line two');
  });

  it('KDV-SCAN-05: an over-long text is truncated with an explicit marker, never silently', () => {
    const framed = frameContent([{ file: 'big.md', text: 'x'.repeat(500000) }]);
    expect(framed).toContain('[TRUNCATED]');
    expect(framed.length).toBeLessThan(500000);
  });

  it('KDV-SCAN-05: buildJudgeMessages puts the trusted contract first, the framed data second', () => {
    const messages = buildJudgeMessages({ files: [{ file: 'a.md', text: 'hello' }] });
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ role: 'system', content: JUDGE_SYSTEM });
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('non-instructional');
    expect(JUDGE_SYSTEM.toLowerCase()).toContain('json');
  });

  it('KDV-SCAN-05: callAuditLLM posts the injected fetch with auth headers and a data-only body', async () => {
    const { impl, calls } = fakeFetch(validJudge());
    await callAuditLLM({ messages: [{ role: 'user', content: 'x' }], config: CONFIG, fetchImpl: impl });
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0];
    expect(url).toBe(CONFIG.endpoint);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['User-Agent']).toBeTruthy();
    expect(init.headers['x-opencode-session']).toBeUndefined();
    const body = JSON.parse(init.body);
    expect(body.model).toBe('test-model');
    expect(body.temperature).toBe(0);
    expect(body.max_tokens).toBe(2048);
    expect(body.response_format).toBeUndefined();
    expect(init.body).not.toContain('test-key');
  });

  it('KDV-SCAN-05: a session header and a response schema are added only when configured', async () => {
    const { impl, calls } = fakeFetch(validJudge());
    await callAuditLLM({
      messages: [{ role: 'user', content: 'x' }],
      config: { ...CONFIG, session: 'session-1' },
      responseSchema: { name: 'audit-judge', schema: JUDGE_SCHEMA },
      fetchImpl: impl,
    });
    const { init } = calls[0];
    expect(init.headers['x-opencode-session']).toBe('session-1');
    const body = JSON.parse(init.body);
    expect(body.response_format).toEqual({
      type: 'json_schema',
      json_schema: { name: 'audit-judge', strict: true, schema: JUDGE_SCHEMA },
    });
  });
});

describe('KDV-SCAN-06: strict-schema output parsed by allowlist validation', () => {
  it('KDV-SCAN-06: parseJudgeReply accepts a valid reply', () => {
    const parsed = parseJudgeReply(JSON.stringify(validJudge()));
    expect(parsed.ok).toBe(true);
    expect(parsed.value.verdict).toBe('pass');
    expect(parsed.errors).toEqual([]);
  });

  it('KDV-SCAN-06: parseJudgeReply rejects an unknown key, a bad enum and a bad span without throwing', () => {
    const unknown = parseJudgeReply(JSON.stringify({ ...validJudge(), decision: 'MERGE' }));
    expect(unknown.ok).toBe(false);
    expect(unknown.value).toBeNull();
    const badEnum = parseJudgeReply(JSON.stringify(validJudge({ verdict: 'merge' })));
    expect(badEnum.ok).toBe(false);
    const badSpan = parseJudgeReply(
      JSON.stringify(validJudge({ spans: [{ file: 'a.md', start: 5, end: 3, reason: 'r' }] })),
    );
    expect(badSpan.ok).toBe(false);
    expect(() => parseJudgeReply('not json')).not.toThrow();
    expect(parseJudgeReply('not json').ok).toBe(false);
    expect(parseJudgeReply(null).ok).toBe(false);
  });

  it('KDV-SCAN-06: judgeChannel maps the three verdicts and keeps spans in the channel schema', async () => {
    for (const verdict of JUDGE_VERDICTS) {
      const spans = verdict === 'flag' ? [{ file: 'a.md', start: 1, end: 3, reason: 'r' }] : [];
      const { impl } = fakeFetch(validJudge({ verdict, confidence: 0.7, spans }));
      const out = await judgeChannel({ files: [{ file: 'a.md', text: 'abc' }], config: CONFIG, fetchImpl: impl });
      expect(out.result.channel).toBe('llm-judge');
      expect(out.result.verdict).toBe(verdict);
      expect(out.result.score).toBeCloseTo(0.7);
      expect(out.reasoning).toBe('trace');
      expect(validateChannelResult(out.result).ok).toBe(true);
    }
    const { impl } = fakeFetch(validJudge({ verdict: 'flag', spans: [{ file: 'a.md', start: 1, end: 3, reason: 'r' }] }));
    const out = await judgeChannel({ files: [], config: CONFIG, fetchImpl: impl });
    expect(out.result.spans).toEqual([{ file: 'a.md', start: 1, end: 3, rule: 'llm-judge', reason: 'r' }]);
  });

  it('KDV-SCAN-06: an unparseable reply yields a THINK-forcing flag result', async () => {
    const { impl } = fakeFetch('{not json');
    const out = await judgeChannel({ files: [], config: CONFIG, fetchImpl: impl });
    expect(out.result).toEqual({ channel: 'llm-judge', score: 1, spans: [], verdict: 'flag' });
    expect(evaluatePolicy({ envelope: { clean: true }, channels: [out.result] }).decision).toBe('THINK');
  });

  it('KDV-SCAN-06: callAuditLLM fails visibly on a missing provider, a non-2xx and a length truncation', async () => {
    await expect(callAuditLLM({ messages: [{ role: 'user', content: 'x' }], config: null })).rejects.toThrow(/config/);
    const bad = fakeFetch(JSON.stringify({ error: { message: 'bad key' } }), { ok: false, status: 401 });
    await expect(
      callAuditLLM({ messages: [{ role: 'user', content: 'x' }], config: CONFIG, fetchImpl: bad.impl }),
    ).rejects.toThrow(/401/);
    const long = fakeFetch(validJudge(), { finish: 'length' });
    await expect(
      callAuditLLM({ messages: [{ role: 'user', content: 'x' }], config: CONFIG, fetchImpl: long.impl }),
    ).rejects.toThrow(/truncated/);
  });
});

describe('KDV-SCAN-07: the ensemble reads twice and divergence yields THINK', () => {
  it('KDV-SCAN-07: ensembleVerdict returns the strictest verdict on agreement', () => {
    expect(ensembleVerdict(['pass', 'pass'])).toBe('pass');
    expect(ensembleVerdict(['flag', 'flag'])).toBe('flag');
    expect(ensembleVerdict(['veto', 'veto'])).toBe('veto');
    expect(ensembleVerdict([{ verdict: 'veto' }, { verdict: 'veto' }])).toBe('veto');
  });

  it('KDV-SCAN-07: a divergence yields flag (THINK), never a permissive verdict', () => {
    expect(ensembleVerdict(['pass', 'veto'])).toBe('flag');
    expect(ensembleVerdict(['pass', 'flag'])).toBe('flag');
    expect(ensembleVerdict(['flag', 'veto'])).toBe('flag');
  });

  it('KDV-SCAN-07: the skeptical framing swaps in the adversarial system contract (a superset of the default)', () => {
    expect(JUDGE_SYSTEM_SKEPTICAL).toContain(JUDGE_SYSTEM);
    expect(JUDGE_SYSTEM_SKEPTICAL).not.toBe(JUDGE_SYSTEM);
    const skeptical = buildJudgeMessages({ files: [{ file: 'a.md', text: 'x' }], framing: 'skeptical' });
    expect(skeptical[0]).toEqual({ role: 'system', content: JUDGE_SYSTEM_SKEPTICAL });
    const def = buildJudgeMessages({ files: [{ file: 'a.md', text: 'x' }], framing: 'default' });
    expect(def[0]).toEqual({ role: 'system', content: JUDGE_SYSTEM });
  });
});

describe('KDV-AUDIT-08: the judge has no merge authority', () => {
  it('KDV-AUDIT-08: a veto yields DECLINE and the channel result carries no decision field', async () => {
    const veto = fakeFetch(validJudge({ verdict: 'veto' }));
    const out = await judgeChannel({ files: [], config: CONFIG, fetchImpl: veto.impl });
    expect(Object.keys(out.result).sort()).toEqual(['channel', 'score', 'spans', 'verdict']);
    expect(out.result).not.toHaveProperty('decision');
    const policy = evaluatePolicy({
      envelope: { a: true, b: true },
      channels: [out.result],
      author: { class: 'MERGE_GREEN' },
    });
    expect(policy.decision).toBe('DECLINE');
  });

  it('KDV-AUDIT-08: a pass cannot override a failed envelope — the policy alone decides', async () => {
    const pass = fakeFetch(validJudge({ verdict: 'pass' }));
    const out = await judgeChannel({ files: [], config: CONFIG, fetchImpl: pass.impl });
    const policy = evaluatePolicy({
      envelope: { a: true, b: false },
      channels: [out.result],
      author: { class: 'MERGE_GREEN' },
    });
    expect(policy.decision).toBe('MANUAL');
  });
});

describe('KDV-REVIEW-25: model credentials live outside the repository', () => {
  it('KDV-REVIEW-25: providerFromAuth reads the opencode-go key and returns null without one', () => {
    expect(providerFromAuth({ 'opencode-go': { key: 'test-key' } })).toEqual({
      endpoint: OPENCODE_ENDPOINT,
      model: OPENCODE_MODEL,
      apiKey: 'test-key',
      session: OPENCODE_SESSION,
    });
    expect(providerFromAuth({ 'opencode-go': { key: 'test-key' } }, { model: 'other' }).model).toBe('other');
    expect(providerFromAuth({})).toBeNull();
    expect(providerFromAuth({ 'opencode-go': {} })).toBeNull();
  });

  it('KDV-REVIEW-25: providerFromWorkflowConfig maps the work-flow shape and rejects incomplete ones', () => {
    expect(
      providerFromWorkflowConfig({ apiEndpoint: 'https://e.test/v1/chat/completions', model: 'm', apiKey: 'test-key' }),
    ).toEqual({ endpoint: 'https://e.test/v1/chat/completions', model: 'm', apiKey: 'test-key' });
    expect(providerFromWorkflowConfig({ apiEndpoint: 'https://e.test', model: 'm' })).toBeNull();
    expect(providerFromWorkflowConfig(null)).toBeNull();
  });

  it('KDV-REVIEW-25: providerFromEnv reads the AUDIT_LLM_* variables and returns null on missing pieces', () => {
    expect(
      providerFromEnv({
        AUDIT_LLM_ENDPOINT: 'https://e.test/v1/chat/completions',
        AUDIT_LLM_MODEL: 'm',
        AUDIT_LLM_API_KEY: 'test-key',
        AUDIT_LLM_SESSION: 's',
      }),
    ).toEqual({ endpoint: 'https://e.test/v1/chat/completions', model: 'm', apiKey: 'test-key', session: 's' });
    expect(providerFromEnv({ AUDIT_LLM_ENDPOINT: 'https://e.test/v1/chat/completions', AUDIT_LLM_MODEL: 'm' })).toBeNull();
    expect(providerFromEnv({})).toBeNull();
  });
});

describe('KDV-REVIEW-26: a hung provider call is bounded by a timeout, never left hanging', () => {
  // hangFetch rejects only when the request signal aborts — a provider that never replies.
  const hangFetch = (_url, init = {}) =>
    new Promise((_resolve, reject) => {
      if (init.signal) init.signal.addEventListener('abort', () => reject(new Error('aborted')));
    });

  it('KDV-REVIEW-26: callAuditLLM aborts a fetch that never resolves and throws a timeout error', async () => {
    await expect(
      callAuditLLM({ messages: [{ role: 'user', content: 'x' }], config: CONFIG, timeoutMs: 10, fetchImpl: hangFetch }),
    ).rejects.toThrow(/timed out after 10ms/);
  });

  it('KDV-REVIEW-26: the default timeout is a finite safety net', () => {
    expect(DEFAULT_REQUEST_TIMEOUT_MS).toBe(60000);
  });

  it('KDV-REVIEW-26: an ordinary call still hands an abort signal to fetch', async () => {
    const { impl, calls } = fakeFetch(validJudge());
    await callAuditLLM({ messages: [{ role: 'user', content: 'x' }], config: CONFIG, fetchImpl: impl });
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('KDV-SCAN-07: transient provider errors are retried with exponential backoff', () => {
  it('KDV-SCAN-07: withRetry returns after 2 transient failures and backs off exponentially', async () => {
    let calls = 0;
    const delays = [];
    const out = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error(`transient-${calls}`);
        return 'ok';
      },
      { sleep: async (ms) => delays.push(ms) },
    );
    expect(out).toBe('ok');
    expect(calls).toBe(3);
    // 500 * 2**0 then 500 * 2**1 — the injected sleep means no real timer runs.
    expect(delays).toEqual([500, 1000]);
  });

  it('KDV-SCAN-07: withRetry rethrows the LAST error when every attempt fails', async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls += 1;
        throw new Error(`boom-${calls}`);
      }, { sleep: async () => {} }),
    ).rejects.toThrow('boom-3');
    expect(calls).toBe(3);
  });

  it('KDV-SCAN-07: attempts:1 makes exactly one call; a custom baseDelayMs drives the backoff', async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls += 1;
        throw new Error('one');
      }, { attempts: 1, sleep: async () => {} }),
    ).rejects.toThrow('one');
    expect(calls).toBe(1);

    const delays = [];
    let n = 0;
    const out = await withRetry(
      async () => {
        n += 1;
        if (n < 3) throw new Error('t');
        return n;
      },
      { baseDelayMs: 10, sleep: async (ms) => delays.push(ms) },
    );
    expect(out).toBe(3);
    expect(delays).toEqual([10, 20]);
  });
});

describe('KDV-SCAN-07: judgeEnsembleChannel reduces the two runs into one channel', () => {
  const run = (verdict, score = 0.2, spans = []) => ({
    result: makeChannelResult({ channel: 'llm-judge', score, spans, verdict }),
  });

  it('KDV-SCAN-07: agreement yields the strictest verdict and the maximum score', () => {
    const out = judgeEnsembleChannel({ runs: [run('veto', 0.2), run('veto', 0.8)] });
    expect(out.channel).toBe('llm-judge-ensemble');
    expect(out.verdict).toBe('veto');
    expect(out.score).toBe(0.8);
    expect(validateChannelResult(out).ok).toBe(true);
  });

  it('KDV-SCAN-07: divergence yields flag (THINK), never a permissive verdict', () => {
    expect(judgeEnsembleChannel({ runs: [run('pass'), run('veto')] }).verdict).toBe('flag');
    expect(judgeEnsembleChannel({ runs: [run('flag'), run('veto')] }).verdict).toBe('flag');
  });

  it('KDV-SCAN-07: an errored run or an empty list yields a flag', () => {
    expect(judgeEnsembleChannel({ runs: [run('pass'), { error: new Error('x') }] }).verdict).toBe('flag');
    expect(judgeEnsembleChannel({ runs: [] }).verdict).toBe('flag');
    expect(judgeEnsembleChannel({}).verdict).toBe('flag');
  });

  it('KDV-SCAN-07: spans are concatenated and deduplicated by file:start:end', () => {
    const span = { file: 'a.md', start: 1, end: 3, rule: 'llm-judge', reason: 'r' };
    const other = { file: 'b.md', start: 2, end: 4, rule: 'llm-judge', reason: 's' };
    const out = judgeEnsembleChannel({ runs: [run('flag', 0.5, [span, other]), run('flag', 0.5, [span])] });
    expect(out.spans).toEqual([span, other]);
  });
});
