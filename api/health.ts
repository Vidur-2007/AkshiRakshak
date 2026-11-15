// GET /api/health — SPEC.md §6.6, SPEC_A_ENGINE.md §12.6.
// Reports which AI providers are configured (key and model set), never the values.
import type { HealthResponse } from '@akshi/contracts';
import { ENGINE_VERSION } from '@akshi/engine';
import { json } from './_lib/http.js';

export async function GET(_request: Request): Promise<Response> {
  const env = process.env;
  const body: HealthResponse = {
    ok: true,
    version: ENGINE_VERSION,
    ai: {
      groq: Boolean(env.GROQ_API_KEY && env.GROQ_MODEL),
      gemini: Boolean(env.GEMINI_API_KEY && env.GEMINI_MODEL),
    },
  };
  return json(body);
}
