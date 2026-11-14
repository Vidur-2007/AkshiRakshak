// GET /api/expand?url= — SPEC.md §6.6, SPEC_A_ENGINE.md §12.2.
// PHASE 0 STUB: validates the URL and returns a one-hop chain; no network request (SSRF guard comes in P3).
import type { ApiError, RedirectChain } from '@akshi/contracts';

function error(status: number, message: string): Response {
  const body: ApiError = { error: { code: 'bad_request', message } };
  return Response.json(body, { status });
}

export async function GET(request: Request): Promise<Response> {
  const target = new URL(request.url).searchParams.get('url') ?? '';
  if (!target || target.length > 2048) return error(400, 'url is required (max 2,048 characters)');
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return error(400, 'url is not a valid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    return error(400, 'Only http and https URLs are allowed');
  const body: RedirectChain = {
    hops: [{ url: parsed.href, status: 200 }],
    finalUrl: parsed.href,
    truncated: false,
  };
  return Response.json(body);
}
