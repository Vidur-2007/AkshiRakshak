// GET /api/domain-age?domain= — SPEC.md §6.6, SPEC_A_ENGINE.md §12.3.
// PHASE 0 STUB: validates the domain and returns a fixture-shaped answer; no RDAP lookup yet.
import type { ApiError, DomainAge } from '@akshi/contracts';

const DOMAIN_RE = /^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export async function GET(request: Request): Promise<Response> {
  const domain = (new URL(request.url).searchParams.get('domain') ?? '').trim().toLowerCase();
  if (!DOMAIN_RE.test(domain)) {
    const body: ApiError = {
      error: { code: 'bad_request', message: 'domain must be a registrable domain' },
    };
    return Response.json(body, { status: 400 });
  }
  const body: DomainAge = {
    domain,
    registered: '2026-11-08T00:00:00Z',
    ageDays: 6,
    registrar: 'Stub registrar (sample data)',
  };
  return Response.json(body);
}
