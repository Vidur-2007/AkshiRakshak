// POST /api/ask — SPEC.md §6.6, SPEC_A_ENGINE.md §12.4.
// PHASE 0 STUB: validates the request and answers from the first requested FAQ id; no LLM call yet.
import { AskRequestSchema, type ApiError, type AssistantAnswer } from '@akshi/contracts';
import { FAQ } from '@akshi/content';

export async function POST(request: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = undefined;
  }
  const parsed = AskRequestSchema.safeParse(json);
  if (!parsed.success) {
    const body: ApiError = { error: { code: 'bad_request', message: 'Invalid ask request' } };
    return Response.json(body, { status: 400 });
  }
  const { lang, faqIds } = parsed.data;
  const item = FAQ.find((f) => faqIds.includes(f.id));
  const body: AssistantAnswer = item
    ? { answer: item.a[lang] ?? item.a.en, sources: [item.id], mode: 'online', provider: 'groq' }
    : {
        answer:
          'Our guide does not cover this yet. If money left your account, call 1930 or report at cybercrime.gov.in.',
        sources: [],
        mode: 'online',
        provider: 'groq',
      };
  return Response.json(body);
}
