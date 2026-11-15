/**
 * Shared HTTP helpers for the Vercel Functions. `_lib` is not served as a function (Vercel skips
 * paths that start with an underscore). Logging is metadata only — never message text.
 */
import type { ApiError } from '@akshi/contracts';

const BASE_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...BASE_HEADERS, ...(init.headers as Record<string, string> | undefined) },
  });
}

export function apiError(
  status: number,
  code: ApiError['error']['code'],
  message: string,
  headers: Record<string, string> = {},
): Response {
  const body: ApiError = { error: { code, message } };
  return json(body, { status, headers });
}

/** Client IP for rate limiting (Vercel sets x-forwarded-for; the first entry is the client). */
export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip')?.trim() || 'local';
}

export async function readJson(request: Request, maxBytes = 64_000): Promise<unknown> {
  const text = await request.text();
  if (text.length > maxBytes) throw new Error('too_large');
  return JSON.parse(text) as unknown;
}

/** One JSON line per request: route, status and timings only. */
export function logEvent(
  route: string,
  fields: Record<string, string | number | boolean | undefined>,
): void {
  if (process.env.VITEST) return;
  console.log(JSON.stringify({ route, ...fields }));
}
