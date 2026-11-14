// GET /api/health — SPEC.md §6.6. Reports which providers have keys configured, never their values.
import type { HealthResponse } from '@akshi/contracts';
import { ENGINE_VERSION } from '@akshi/engine';

export async function GET(_request: Request): Promise<Response> {
  const body: HealthResponse = {
    ok: true,
    version: ENGINE_VERSION,
    ai: { groq: Boolean(process.env.GROQ_API_KEY), gemini: Boolean(process.env.GEMINI_API_KEY) },
  };
  return Response.json(body, { headers: { 'cache-control': 'no-store' } });
}
