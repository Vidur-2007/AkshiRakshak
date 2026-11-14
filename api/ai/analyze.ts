// POST /api/ai/analyze — SPEC.md §6.6, SPEC_A_ENGINE.md §12.1.
// PHASE 0 STUB: validates the request and returns a fixture-shaped response; no LLM call yet.
// Never log maskedText or response text.
import { AiAnalyzeRequestSchema, type AiAnalyzeResponse, type ApiError } from '@akshi/contracts';

function error(status: number, code: ApiError['error']['code'], message: string): Response {
  const body: ApiError = { error: { code, message } };
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return error(400, 'bad_request', 'Body must be JSON');
  }
  const parsed = AiAnalyzeRequestSchema.safeParse(json);
  if (!parsed.success) return error(400, 'bad_request', 'Invalid AiAnalyzeRequest');
  const req = parsed.data;
  const body: AiAnalyzeResponse = {
    provider: 'groq',
    model: 'stub',
    category: req.localCategory,
    likelihood: req.localScore,
    explanation:
      'Stub AI response: this mirrors the local checks until the real AI second opinion is connected.',
    redFlags: [],
    advice: 'Never share your OTP or UPI PIN with anyone.',
  };
  return Response.json(body);
}
