// POST /api/ask — SPEC.md §6.6, SPEC_A_ENGINE.md §12.4.
// Grounded only in the requested FAQ items (max 3, looked up in the bundled FAQ), masked question,
// Groq → Gemini fallback, 20/min/IP. The engine falls back to its offline answer on any error.
import { AskRequestSchema } from '@akshi/contracts';
import { FAQ } from '@akshi/content';
import { providersFromEnv, type AiProvider } from './_lib/ai.js';
import { runAsk } from './_lib/ask.js';
import { apiError, json, logEvent, readJson } from './_lib/http.js';
import { limited } from './_lib/ratelimit.js';

/** Tests only: replace the env-based providers. */
let providerOverride: AiProvider[] | null = null;
export function __setProviders(p: AiProvider[] | null): void {
  providerOverride = p;
}

export async function POST(request: Request): Promise<Response> {
  const t0 = Date.now();
  const limit = limited('ask', request);
  if (limit) return limit;
  let body: unknown;
  try {
    body = await readJson(request, 16_000);
  } catch {
    return apiError(400, 'bad_request', 'Body must be JSON');
  }
  const parsed = AskRequestSchema.safeParse(body);
  if (!parsed.success || parsed.data.question.length > 1_000 || !parsed.data.question.trim()) {
    return apiError(400, 'bad_request', 'Invalid ask request (question ≤ 1,000 characters)');
  }
  const { question, lang, faqIds } = parsed.data;
  const items = faqIds
    .slice(0, 3)
    .map((id) => FAQ.find((f) => f.id === id))
    .filter((f): f is NonNullable<typeof f> => f !== undefined);

  const providers = providerOverride ?? providersFromEnv();
  if (!providers.length)
    return apiError(503, 'upstream_unavailable', 'No AI provider is configured');
  const result = await runAsk(question, lang, items, providers, {
    log: (f) => logEvent('ask', { provider: f.provider, ms: f.ms, status: f.status }),
  });
  logEvent('ask', { status: result.ok ? 200 : result.status, ms: Date.now() - t0 });
  if (!result.ok)
    return apiError(503, 'upstream_unavailable', 'AI providers are unavailable right now');
  return json(result.body);
}
