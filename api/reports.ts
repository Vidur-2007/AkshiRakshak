// GET /api/reports?type=&value= and POST /api/reports (P2, M8.6) — SPEC.md §6.6, SPEC_A §12.5.
// Key rep:<type>:<sha256(normalised value)> → hash { count, category }. GET shows a count only
// from 3 reports up (otherwise 0). Max 10 reports per IP per day, tracked under a hash of the IP
// with a 24 h TTL, plus 60 requests/min/IP. Raw values and IPs are never stored or logged by this
// code (note: GET puts the value in the query string, which the platform's request log records).
import { createHash } from 'node:crypto';
import {
  ReportsPostRequestSchema,
  ReportsQuerySchema,
  SCAM_CATEGORIES,
  type ReportType,
  type ReportsGetResponse,
  type ReportsPostResponse,
  type ScamCategory,
} from '@akshi/contracts';
import { parse } from 'tldts';
import { apiError, clientIp, json, logEvent, readJson } from './_lib/http.js';
import { limited } from './_lib/ratelimit.js';
import { redisConfig, redisPipeline, type RedisFetch } from './_lib/redis.js';

export const SHOW_FROM = 3;
export const DAILY_LIMIT = 10;

/** Tests only: replace fetch for the Upstash REST calls. */
let fetchOverride: RedisFetch | null = null;
export function __setRedisFetch(f: RedisFetch | null): void {
  fetchOverride = f;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Canonical value: E.164 phones, lower-case UPI IDs, registrable domains. Null when invalid. */
export function normaliseValue(type: ReportType, value: string): string | null {
  const v = value.trim().toLowerCase();
  if (type === 'phone') {
    const d = v.replace(/[\s()-]/g, '');
    return /^(?:\+?91|0)?[6-9]\d{9}$/.test(d) ? `+91${d.slice(-10)}` : null;
  }
  if (type === 'upi') return /^[a-z0-9.\-_]{2,256}@[a-z][a-z0-9]{1,63}$/.test(v) ? v : null;
  const host = v.replace(/^[a-z]+:\/\//, '').split(/[/?#:]/)[0] ?? '';
  const p = parse(host);
  return p.domain && p.isIcann && !p.isIp ? p.domain : null;
}

const keyFor = (type: ReportType, value: string) => `rep:${type}:${sha256(value)}`;

function fromHash(raw: unknown): { count: number; category?: ScamCategory } {
  // HGETALL returns [field, value, field, value, …]
  const arr = Array.isArray(raw) ? raw.map(String) : [];
  const get = (f: string) => {
    const i = arr.indexOf(f);
    return i >= 0 && i % 2 === 0 ? arr[i + 1] : undefined;
  };
  const count = Number(get('count') ?? 0) || 0;
  const cat = get('category');
  return cat && (SCAM_CATEGORIES as readonly string[]).includes(cat)
    ? { count, category: cat as ScamCategory }
    : { count };
}

function shown(h: { count: number; category?: ScamCategory }): ReportsGetResponse {
  if (h.count < SHOW_FROM) return { reports: 0 };
  return h.category ? { reports: h.count, category: h.category } : { reports: h.count };
}

export async function GET(request: Request): Promise<Response> {
  // per-minute limit per IP (in front of Upstash's free-tier command quota)
  const limit = limited('reports', request);
  if (limit) return limit;
  const cfg = redisConfig();
  if (!cfg) return apiError(503, 'upstream_unavailable', 'Community reports are not configured');
  const q = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = ReportsQuerySchema.safeParse(q);
  const value = parsed.success ? normaliseValue(parsed.data.type, parsed.data.value) : null;
  if (!parsed.success || !value)
    return apiError(400, 'bad_request', 'type (upi|phone|domain) and a valid value are required');
  try {
    const [raw] = await redisPipeline(
      cfg,
      [['HGETALL', keyFor(parsed.data.type, value)]],
      fetchOverride ?? fetch,
    );
    logEvent('reports', { method: 'GET', status: 200 });
    return json(shown(fromHash(raw)));
  } catch {
    return apiError(503, 'upstream_unavailable', 'Community reports are unavailable right now');
  }
}

export async function POST(request: Request): Promise<Response> {
  // per-minute limit per IP (in front of Upstash's free-tier command quota)
  const limit = limited('reports', request);
  if (limit) return limit;
  const cfg = redisConfig();
  if (!cfg) return apiError(503, 'upstream_unavailable', 'Community reports are not configured');
  let body: unknown;
  try {
    body = await readJson(request, 4_000);
  } catch {
    return apiError(400, 'bad_request', 'Body must be JSON');
  }
  const parsed = ReportsPostRequestSchema.safeParse(body);
  const value = parsed.success ? normaliseValue(parsed.data.type, parsed.data.value) : null;
  if (!parsed.success || !value)
    return apiError(400, 'bad_request', 'type, a valid value and a category are required');
  const doFetch = fetchOverride ?? fetch;
  const rlKey = `rl:rep:${sha256(clientIp(request))}`;
  try {
    const [used] = await redisPipeline(
      cfg,
      [
        ['INCR', rlKey],
        ['EXPIRE', rlKey, 86_400, 'NX'],
      ],
      doFetch,
    );
    if (Number(used) > DAILY_LIMIT)
      return apiError(429, 'rate_limited', 'Daily report limit reached', {
        'retry-after': '86400',
      });
    const key = keyFor(parsed.data.type, value);
    const [count] = await redisPipeline(
      cfg,
      [
        ['HINCRBY', key, 'count', 1],
        ['HSETNX', key, 'category', parsed.data.category],
      ],
      doFetch,
    );
    logEvent('reports', { method: 'POST', status: 200 });
    const out: ReportsPostResponse = {
      ok: true,
      reports: shown({ count: Number(count) || 0 }).reports,
    };
    return json(out);
  } catch {
    return apiError(503, 'upstream_unavailable', 'Community reports are unavailable right now');
  }
}
