// POST /api/ai/analyze — SPEC.md §6.6, SPEC_A_ENGINE.md §12.1.
// Groq first, Gemini fallback, 8 s each; validated JSON out. Never logs maskedText or output text.
import { AiAnalyzeRequestSchema } from '@akshi/contracts';
import { providersFromEnv, runAi, type AiProvider } from '../_lib/ai.js';
import { apiError, json, logEvent, readJson } from '../_lib/http.js';
import { limited } from '../_lib/ratelimit.js';

/** Tests only: replace the env-based providers. */
let providerOverride: AiProvider[] | null = null;
export function __setProviders(p: AiProvider[] | null): void {
  providerOverride = p;
}

export async function POST(request: Request): Promise<Response> {
  const t0 = Date.now();
  const limit = limited('ai', request);
  if (limit) return limit;
  let body: unknown;
  try {
    body = await readJson(request);
  } catch {
    return apiError(400, 'bad_request', 'Body must be JSON (max 64 KB)');
  }
  const parsed = AiAnalyzeRequestSchema.safeParse(body);
  if (!parsed.success)
    return apiError(400, 'bad_request', 'Invalid AiAnalyzeRequest (maskedText ≤ 4,000 characters)');

  const providers = providerOverride ?? providersFromEnv();
  if (!providers.length)
    return apiError(503, 'upstream_unavailable', 'No AI provider is configured');
  const result = await runAi(parsed.data, providers, {
    log: (f) => logEvent('ai/analyze', { provider: f.provider, ms: f.ms, status: f.status }),
  });
  logEvent('ai/analyze', { status: result.ok ? 200 : result.status, ms: Date.now() - t0 });
  if (!result.ok)
    return apiError(result.status, result.code, 'AI providers are unavailable right now');
  return json(result.body);
}
