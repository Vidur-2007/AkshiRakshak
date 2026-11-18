// POST /api/ai/vision (P2, M2.3) — SPEC.md §6.6. { imageBase64, lang } (≤ 1.5 MB) → { text }.
// Gemini (GEMINI_API_KEY + GEMINI_VISION_MODEL) transcribes the screenshot; 20/min/IP; the image
// and the text are never logged.
import { AiVisionRequestSchema, type AiVisionResponse } from '@akshi/contracts';
import { apiError, json, logEvent, readJson } from '../_lib/http.js';
import { limited } from '../_lib/ratelimit.js';
import {
  parseImage,
  transcribe,
  visionProviderFromEnv,
  type VisionProvider,
} from '../_lib/vision.js';

/** Tests only. */
let override: VisionProvider | null | undefined;
export function __setVisionProvider(p: VisionProvider | null | undefined): void {
  override = p;
}

export async function POST(request: Request): Promise<Response> {
  const t0 = Date.now();
  const limit = limited('ai', request);
  if (limit) return limit;
  let body: unknown;
  try {
    body = await readJson(request, 2_200_000);
  } catch {
    return apiError(413, 'bad_request', 'Image too large (max 1.5 MB)');
  }
  const parsed = AiVisionRequestSchema.safeParse(body);
  if (!parsed.success) return apiError(400, 'bad_request', 'Invalid vision request');
  const img = parseImage(parsed.data.imageBase64);
  if ('error' in img)
    return apiError(
      img.error === 'too_large' ? 413 : 400,
      'bad_request',
      img.error === 'too_large'
        ? 'Image too large (max 1.5 MB)'
        : 'PNG, JPEG or WebP image expected',
    );

  const provider = override === undefined ? visionProviderFromEnv() : override;
  if (!provider) return apiError(503, 'upstream_unavailable', 'Cloud vision is not configured');
  try {
    const text = await transcribe(provider, img.image, img.mediaType, parsed.data.lang);
    logEvent('ai/vision', { status: 200, ms: Date.now() - t0, chars: text.length });
    const out: AiVisionResponse = { text };
    return json(out);
  } catch (err) {
    const timeout = (err as { name?: string })?.name === 'TimeoutError';
    logEvent('ai/vision', { status: timeout ? 504 : 503, ms: Date.now() - t0 });
    return apiError(
      timeout ? 504 : 503,
      timeout ? 'timeout' : 'upstream_unavailable',
      'Cloud vision is unavailable right now',
    );
  }
}
