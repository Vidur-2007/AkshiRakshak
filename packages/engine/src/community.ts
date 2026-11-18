/**
 * Community reports client (SPEC.md M8.6, P2) over /api/reports. Online only; every failure
 * returns null so the bundled (offline) indicators keep working. Values are normalised by the
 * server and stored only as hashes.
 */
import type { IndicatorMatch, ReportType, ScamCategory } from '@akshi/contracts';
import { getJson, postJson } from './net';
import { netSchemas } from './schemas-lazy';

/** Reports from the community (0 below the server's display threshold of 3), or null offline. */
export async function communityReports(
  type: ReportType,
  value: string,
  opts: { signal?: AbortSignal } = {},
): Promise<IndicatorMatch | null> {
  const raw = await getJson(`/api/reports?type=${type}&value=${encodeURIComponent(value)}`, {
    timeoutMs: 3000,
    ...(opts.signal ? { signal: opts.signal } : {}),
  });
  if (raw === null) return null;
  const parsed = (await netSchemas()).ReportsGetResponseSchema.safeParse(raw);
  if (!parsed.success || parsed.data.reports === 0) return null;
  const match: IndicatorMatch = {
    value,
    type,
    reports: parsed.data.reports,
    source: 'community',
    sampleData: false,
  };
  if (parsed.data.category) match.category = parsed.data.category;
  return match;
}

/** Report a value; resolves the shown count, or null when the report could not be sent. */
export async function reportToCommunity(
  type: ReportType,
  value: string,
  category: ScamCategory,
): Promise<number | null> {
  const raw = await postJson('/api/reports', { type, value, category }, { timeoutMs: 5000 });
  if (raw === null) return null;
  const parsed = (await netSchemas()).ReportsPostResponseSchema.safeParse(raw);
  return parsed.success ? parsed.data.reports : null;
}
