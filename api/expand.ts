// GET /api/expand?url= — SPEC.md §6.6, SPEC_A_ENGINE.md §12.2.
// Redirect chain only (never page content), SSRF-guarded on every hop, cached 10 minutes.
import { apiError, json, logEvent } from './_lib/http.js';
import { limited } from './_lib/ratelimit.js';
import { checkTarget, expandUrl, SsrfError } from './_lib/ssrf.js';

export async function GET(request: Request): Promise<Response> {
  const t0 = Date.now();
  const limit = limited('expand', request);
  if (limit) return limit;
  const target = new URL(request.url).searchParams.get('url') ?? '';
  try {
    checkTarget(target);
  } catch (err) {
    const code = err instanceof SsrfError ? err.code : 'bad_url';
    return apiError(400, 'bad_request', `url not allowed: ${code}`);
  }
  const chain = await expandUrl(target);
  logEvent('expand', {
    status: 200,
    hops: chain.hops.length,
    error: chain.error,
    ms: Date.now() - t0,
  });
  return json(chain, { headers: { 'cache-control': 'private, max-age=600' } });
}
