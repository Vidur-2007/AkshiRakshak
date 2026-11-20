// POST /api/analyze — developer sandbox (SPEC.md §6.6, added 2026-11-20).
// Runs the same on-device engine on the server, for scripts, judges and other apps:
//   curl -X POST https://<host>/api/analyze -H 'content-type: application/json' \
//        -d '{"text":"Your SBI account will be blocked. Share the OTP now.","lang":"en"}'
// Rules, model, link and UPI checks only: no AI call, no link expansion, no domain lookup, so it
// spends no quota and makes no outbound request. The app itself never calls this endpoint (text
// checks stay on the device). 30/min/IP. Never logs the text.
import { LangSchema, type AnalyzeRequest, type InputKind } from '@akshi/contracts';
import { analyze, attackStory, detectInputKind, manipulationTactics } from '@akshi/engine';
import { z } from 'zod';
import { apiError, json, logEvent, readJson } from './_lib/http.js';
import { limited } from './_lib/ratelimit.js';

export const MAX_TEXT = 20_000;
const TEXT_KINDS = ['message', 'chat', 'email', 'url', 'upi_id', 'phone', 'qr'] as const;

const BodySchema = z.object({
  text: z.string(),
  lang: LangSchema.default('en'),
  /** optional: detected from the text when missing */
  kind: z.enum(TEXT_KINDS).optional(),
});

function toRequest(text: string, kind: InputKind, lang: AnalyzeRequest['lang']): AnalyzeRequest {
  const base = {
    kind,
    lang,
    options: { cloudAI: false, expandLinks: false, domainAge: false },
  };
  switch (kind) {
    case 'url':
      return { ...base, url: text.trim() };
    case 'upi_id':
      return { ...base, upiId: text.trim() };
    case 'phone':
      return { ...base, phone: text.trim() };
    case 'qr':
      return { ...base, qrPayload: text.trim() };
    default:
      return { ...base, text };
  }
}

export async function POST(request: Request): Promise<Response> {
  const t0 = Date.now();
  const limit = limited('analyze', request);
  if (limit) return limit;
  let body: unknown;
  try {
    body = await readJson(request, 120_000); // 20,000 Indic characters are up to ~60 KB of UTF-8
  } catch {
    return apiError(400, 'bad_request', 'Body must be JSON');
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success || !parsed.data.text.trim() || parsed.data.text.length > MAX_TEXT) {
    return apiError(
      400,
      'bad_request',
      `Send {"text": "...", "lang": "en|hi|te|bn", "kind"?: "${TEXT_KINDS.join('|')}"}, text up to ${MAX_TEXT.toLocaleString('en-IN')} characters`,
    );
  }
  const { text, lang } = parsed.data;
  const detected = detectInputKind(text).kind;
  const kind: InputKind =
    parsed.data.kind ??
    ((TEXT_KINDS as readonly string[]).includes(detected) ? detected : 'message');
  try {
    const result = await analyze(toRequest(text, kind, lang));
    logEvent('analyze', { status: 200, kind, verdict: result.verdict, ms: Date.now() - t0 });
    return json({
      result,
      attackStory: attackStory(result.signals, lang),
      tactics: manipulationTactics(result.signals, lang),
    });
  } catch {
    logEvent('analyze', { status: 500, kind, ms: Date.now() - t0 });
    return apiError(500, 'internal', 'The check failed. Try again.');
  }
}
