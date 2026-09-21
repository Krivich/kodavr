/**
 * CONTRACT: scripts/product/pr-review/audit/llm/llm.mjs
 * ROLE: the LLM provider client — resolve credentials (env/auth/config) and one strict-JSON chat call
 * EXPORTS:
 *   DEFAULT_REQUEST_TIMEOUT_MS — the per-request abort timeout in milliseconds
 *   OPENCODE_ENDPOINT — the opencode-go chat-completions endpoint
 *   OPENCODE_MODEL — the default opencode-go judge model
 *   OPENCODE_SESSION — the routing/caching session id the opencode-go endpoint requires
 *   providerFromEnv — AUDIT_LLM_* env → {endpoint,model,apiKey[,session]} or null when incomplete
 *   providerFromAuth — a parsed opencode auth.json → the opencode-go provider, or null without a key
 *   providerFromWorkflowConfig — a work-flow config.json → {endpoint,model,apiKey} or null when incomplete
 *   callAuditLLM — POST one chat completion → {content,reasoning,finish}; throws when broken or timed out
 *   withRetry — await fn() with exponential-backoff retries; rethrows the last error when exhausted
 * INVARIANTS:
 *   — the key is never logged, returned in an error, or placed in the request body
 *   — an incomplete provider or a non-2xx / truncated response is a loud throw, never a silent fallback
 *   — every request is bounded by an AbortController timeout; a hung provider is a loud throw
 *   — fetch is injected so tests never touch the network
 */

// A hung provider must not stall the audit job, so each request is bounded.
export const DEFAULT_REQUEST_TIMEOUT_MS = 60000;

export const OPENCODE_ENDPOINT = 'https://opencode.ai/zen/go/v1/chat/completions';
export const OPENCODE_MODEL = 'deepseek-v4-flash';
// The opencode-go endpoint requires a session header for routing/caching (the
// provider answers 400 without it); a stable per-tool id is enough — no secret.
export const OPENCODE_SESSION = 'kodavr-pr-audit-0001';

// isNonEmptyString(v) → true when v is a string with visible content
const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';

// providerFromEnv(env) → the AUDIT_LLM_* provider, or null when endpoint/model/key are incomplete.
// The session is optional: a missing/blank session is simply absent.
export function providerFromEnv(env = {}) {
  const endpoint = env.AUDIT_LLM_ENDPOINT;
  const model = env.AUDIT_LLM_MODEL;
  const apiKey = env.AUDIT_LLM_API_KEY;
  if (!isNonEmptyString(endpoint) || !isNonEmptyString(model) || !isNonEmptyString(apiKey)) return null;
  return {
    endpoint,
    model,
    apiKey,
    session: isNonEmptyString(env.AUDIT_LLM_SESSION) ? env.AUDIT_LLM_SESSION : undefined,
  };
}

// providerFromAuth(auth,{model}) → the opencode-go provider from a PARSED auth.json.
// `auth['opencode-go'].key` is the only accepted source; no key → null (fail-visible).
export function providerFromAuth(auth = {}, { model = OPENCODE_MODEL } = {}) {
  const entry = auth && typeof auth === 'object' ? auth['opencode-go'] : null;
  const key = entry && typeof entry === 'object' ? entry.key : null;
  if (!isNonEmptyString(key)) return null;
  return {
    endpoint: OPENCODE_ENDPOINT,
    model: isNonEmptyString(model) ? model : OPENCODE_MODEL,
    apiKey: key,
    session: OPENCODE_SESSION,
  };
}

// providerFromWorkflowConfig(cfg) → the work-flow config shape ({apiEndpoint,model,apiKey}).
// All three must be non-empty strings; anything less → null.
export function providerFromWorkflowConfig(cfg) {
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return null;
  const { apiEndpoint, model, apiKey } = cfg;
  if (!isNonEmptyString(apiEndpoint) || !isNonEmptyString(model) || !isNonEmptyString(apiKey)) return null;
  return { endpoint: apiEndpoint, model, apiKey };
}

// readErrorDetail(response) → a short provider message from a failed response, or ''.
// The raw body is only a fallback and is truncated; the key is never in the request body.
async function readErrorDetail(response) {
  if (!response || typeof response.text !== 'function') return '';
  try {
    const raw = await response.text();
    if (!isNonEmptyString(raw)) return '';
    try {
      const parsed = JSON.parse(raw);
      const err = parsed && parsed.error;
      const message = err && typeof err === 'object' ? err.message : err;
      if (isNonEmptyString(message)) return message;
    } catch {
      // not JSON — fall through to the truncated raw text
    }
    return raw.slice(0, 300);
  } catch {
    return '';
  }
}

// callAuditLLM({messages,responseSchema,maxTokens,config,timeoutMs,fetchImpl}) →
// {content,reasoning,finish}. POSTs one chat completion; the provider config must
// be complete. A non-2xx response, a `finish_reason === 'length'` reply, or a
// request that outlives timeoutMs (aborted via AbortController) throws.
export async function callAuditLLM({
  messages,
  responseSchema = null,
  responseFormat = null,
  maxTokens = 2048,
  config,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('audit-llm: messages must be a non-empty array');
  }
  if (!config || typeof config !== 'object') {
    throw new Error('audit-llm: provider config is missing');
  }
  const { endpoint, model, apiKey, session } = config;
  if (!isNonEmptyString(endpoint) || !isNonEmptyString(model) || !isNonEmptyString(apiKey)) {
    throw new Error('audit-llm: provider config needs endpoint, model and apiKey');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('audit-llm: a fetch implementation is required');
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'User-Agent': 'kodavr-audit/1.0',
  };
  if (isNonEmptyString(session)) headers['x-opencode-session'] = session;

  const body = {
    model,
    messages,
    temperature: 0,
    max_tokens: maxTokens,
    ...(responseSchema
      ? {
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: responseSchema.name || 'audit',
              strict: true,
              schema: responseSchema.schema || responseSchema,
            },
          },
        }
      : responseFormat
        ? { response_format: typeof responseFormat === 'string' ? { type: responseFormat } : responseFormat }
        : {}),
  };

  // Bound the call: a provider that never answers must not hang the audit. The
  // timer is unref'd so it never keeps a process alive on its own.
  const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 0;
  const controller = ms && typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(new Error(`audit-llm: request timed out after ${ms}ms`)), ms)
    : null;
  if (timer && typeof timer.unref === 'function') timer.unref();

  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      ...(controller ? { signal: controller.signal } : {}),
    });
  } catch (error) {
    if (controller && controller.signal.aborted) throw new Error(`audit-llm: request timed out after ${ms}ms`);
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!response || response.ok !== true) {
    const status = response && response.status !== undefined ? response.status : 'unknown';
    const detail = await readErrorDetail(response);
    throw new Error(`audit-llm: provider responded ${status}${detail ? `: ${detail}` : ''}`);
  }

  const data = await response.json();
  const choice = data && Array.isArray(data.choices) ? data.choices[0] : null;
  if (!choice || !choice.message) {
    throw new Error('audit-llm: provider returned no message');
  }
  if (choice.finish_reason === 'length') {
    throw new Error('audit-llm: response was truncated (finish_reason=length)');
  }

  return {
    content: choice.message.content ?? '',
    reasoning: choice.message.reasoning_content ?? null,
    finish: choice.finish_reason ?? null,
  };
}

// The default backoff timer: a real promise so production actually waits between
// attempts. Tests inject `sleep` and never touch a timer.
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// withRetry(fn,{attempts,baseDelayMs,sleep}) → await fn() with exponential
// backoff. Transient provider errors are retried up to attempts-1 more times,
// waiting baseDelayMs * 2**(i-1) before attempt i+1 (500, 1000, 2000 ...). The
// LAST error is rethrown when the attempts are exhausted. `sleep` is injectable
// so tests never wait. attempts < 1 degenerates to a single call.
export async function withRetry(fn, { attempts = 3, baseDelayMs = 500, sleep = defaultSleep } = {}) {
  const total = Number.isInteger(attempts) && attempts > 0 ? attempts : 1;
  let lastError;
  for (let i = 1; i <= total; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < total) await sleep(baseDelayMs * 2 ** (i - 1));
    }
  }
  throw lastError;
}
