// GET /api/domain-age?domain= — SPEC.md §6.6, SPEC_A_ENGINE.md §12.3.
// RDAP via rdap.org, 5 s timeout, cached 1 hour; { domain, error: "unavailable" } when no answer.
import { apiError, json, logEvent } from './_lib/http.js';
import { limited } from './_lib/ratelimit.js';
import { BadDomainError, lookupDomainAge } from './_lib/rdap.js';

export async function GET(request: Request): Promise<Response> {
  const t0 = Date.now();
  const limit = limited('domain-age', request);
  if (limit) return limit;
  const domain = new URL(request.url).searchParams.get('domain') ?? '';
  try {
    const age = await lookupDomainAge(domain);
    logEvent('domain-age', { status: 200, found: age.ageDays !== undefined, ms: Date.now() - t0 });
    return json(age, { headers: { 'cache-control': 'private, max-age=3600' } });
  } catch (err) {
    if (err instanceof BadDomainError)
      return apiError(400, 'bad_request', 'domain must be a registrable domain, e.g. example.com');
    return apiError(500, 'internal', 'Lookup failed');
  }
}
