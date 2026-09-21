// tests/unit/audit-llm-channels.test.js — the LLM-channel builder (KDV-REVIEW-26):
// it composes the judge (plus a second run for the ensemble) and the Layer-5
// trace channels, and degrades a configured but failing provider into a VISIBLE
// flag channel (THINK), never a silent merge or a crash. No real network: every
// call goes through an injected fake fetch; no real timer: sleep is injected.
import { describe, it, expect } from 'vitest';
import { buildLlmChannels } from '../../scripts/product/pr-review/audit/llm/llm-channels.mjs';
import { validateChannelResult } from '../../scripts/product/pr-review/audit/channel.mjs';
import { JUDGE_SYSTEM, JUDGE_SYSTEM_SKEPTICAL } from '../../scripts/product/pr-review/audit/llm/judge.mjs';

// A complete provider env with a literal test key — nothing here is a secret.
const ENV = {
  AUDIT_LLM_ENDPOINT: 'https://example.test/v1/chat/completions',
  AUDIT_LLM_MODEL: 'gpt-oss-120b',
  AUDIT_LLM_API_KEY: 'test-key',
};
const FILES = [{ file: 'content/dumps/demo/raw.md', text: 'some safe prose here for the judge to read' }];
const noSleep = async () => {};

// judgeReply(overrides) → a valid judge response (content + reasoning_content).
function judgeReply({ verdict = 'pass', confidence = 0.2, reasoning = 'a short trace' } = {}) {
  const content = JSON.stringify({ verdict, flags: [], spans: [], confidence, reasons: ['clean'] });
  return {
    ok: true,
    status: 200,
    async json() {
      return { choices: [{ message: { content, reasoning_content: reasoning }, finish_reason: 'stop' }] };
    },
    async text() {
      return content;
    },
  };
}

// fakeFetch(reply) → an injected fetch that always answers with `reply`.
const fakeFetch = (reply) => async () => reply;

// recordingFetch(reply) → a fake fetch that also records every request body, so a
// test can inspect which model + system framing each judge run used.
function recordingFetch(reply) {
  const bodies = [];
  const impl = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return reply;
  };
  return { impl, bodies };
}

// judgeCallsOf(bodies) → only the judge requests (not the meta-reviewer), matched
// by their trusted system message.
const judgeCallsOf = (bodies) =>
  bodies.filter((b) => [JUDGE_SYSTEM, JUDGE_SYSTEM_SKEPTICAL].includes(b.messages[0].content));

describe('KDV-REVIEW-26: a configured provider degrades visibly, never silently', () => {
  it('KDV-REVIEW-26: no provider env yields no LLM channels', async () => {
    expect(await buildLlmChannels({ files: FILES, env: {} })).toEqual([]);
    expect(await buildLlmChannels({ files: FILES, env: { AUDIT_LLM_MODEL: 'm' } })).toEqual([]);
  });

  it('KDV-REVIEW-26: a complete env yields the judge, the trace-reader and the meta-reviewer, each valid', async () => {
    const channels = await buildLlmChannels({ files: FILES, env: ENV, fetchImpl: fakeFetch(judgeReply()) });
    const names = channels.map((c) => c.channel);
    expect(names).toContain('llm-judge-ensemble');
    expect(names).toContain('trace-reader');
    expect(names).toContain('meta-reviewer');
    for (const channel of channels) expect(validateChannelResult(channel).ok, channel.channel).toBe(true);
  });

  it('KDV-REVIEW-26: a second model env adds the judge-ensemble channel', async () => {
    const env = { ...ENV, AUDIT_LLM_MODEL_2: 'judge-2' };
    const channels = await buildLlmChannels({ files: FILES, env, fetchImpl: fakeFetch(judgeReply()) });
    expect(channels.map((c) => c.channel)).toContain('llm-judge-ensemble');
    for (const channel of channels) expect(validateChannelResult(channel).ok).toBe(true);
  });

  it('KDV-REVIEW-26: a fetch that always rejects yields exactly one visible llm-error flag channel', async () => {
    const channels = await buildLlmChannels({
      files: FILES,
      env: ENV,
      fetchImpl: async () => {
        throw new Error('network down');
      },
      sleep: noSleep,
    });
    expect(channels).toHaveLength(1);
    expect(channels[0].channel).toBe('llm-error');
    expect(channels[0].verdict).toBe('flag');
    expect(validateChannelResult(channels[0]).ok).toBe(true);
  });

  it('KDV-REVIEW-26: a missing reasoning trace degrades Layer 5 gracefully (no trace channels)', async () => {
    const channels = await buildLlmChannels({
      files: FILES,
      env: ENV,
      fetchImpl: fakeFetch(judgeReply({ reasoning: null })),
    });
    const names = channels.map((c) => c.channel);
    expect(names).toContain('llm-judge-ensemble');
    expect(names).not.toContain('trace-reader');
    expect(names).not.toContain('meta-reviewer');
  });
});

describe('KDV-SCAN-07: the ensemble always reads twice (second framing without a second model)', () => {
  it('KDV-SCAN-07: without AUDIT_LLM_MODEL_2 the same model reruns under the skeptical framing', async () => {
    const { impl, bodies } = recordingFetch(judgeReply({ reasoning: null }));
    const channels = await buildLlmChannels({ files: FILES, env: ENV, fetchImpl: impl });
    const judgeCalls = judgeCallsOf(bodies);
    expect(judgeCalls).toHaveLength(2);
    expect(judgeCalls[0].messages[0].content).toBe(JUDGE_SYSTEM);
    expect(judgeCalls[1].messages[0].content).toBe(JUDGE_SYSTEM_SKEPTICAL);
    expect(judgeCalls[0].model).toBe('gpt-oss-120b');
    expect(judgeCalls[1].model).toBe('gpt-oss-120b');
    expect(channels.map((c) => c.channel)).toContain('llm-judge-ensemble');
  });

  it('KDV-SCAN-07: AUDIT_LLM_MODEL_2 makes the second run that model under the default framing', async () => {
    const env = { ...ENV, AUDIT_LLM_MODEL_2: 'judge-2' };
    const { impl, bodies } = recordingFetch(judgeReply({ reasoning: null }));
    const channels = await buildLlmChannels({ files: FILES, env, fetchImpl: impl });
    const judgeCalls = judgeCallsOf(bodies);
    expect(judgeCalls).toHaveLength(2);
    expect(judgeCalls[1].model).toBe('judge-2');
    expect(judgeCalls[1].messages[0].content).toBe(JUDGE_SYSTEM);
    expect(channels.map((c) => c.channel)).toContain('llm-judge-ensemble');
  });
});
