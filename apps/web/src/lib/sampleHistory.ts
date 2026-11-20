/**
 * Sample history for the dashboard (2026-11-20): the bundled sample messages, the refund QR, a
 * lookalike link and the refund collect request, checked by the real engine and dated across the
 * last two weeks, so a new user sees what the dashboard shows before making checks of their own.
 *
 * Every value is obviously synthetic (SPEC.md §1.3) and labelled "Sample data" where it appears.
 * Sample checks are never saved to IndexedDB and never counted as the user's own details; they
 * live in memory (rememberResult) so the feed can open them on the analysis screen.
 */
import { toCollectInput, SAMPLE_COLLECT } from './collect';
import { toScanRecord, type ScanRecord } from './db';
import { analyze, SAMPLE_MESSAGES, type AnalyzeRequest, type Lang } from './engine';
import { QR_LINK_SAMPLES } from './qrSamples';
import { rememberResult } from './scan';

/** Ids of sample checks start with this, so the UI can mark them. */
export const SAMPLE_ID_PREFIX = 'sample-check-';

export function isSampleCheck(id: string): boolean {
  return id.startsWith(SAMPLE_ID_PREFIX);
}

type Core = Omit<AnalyzeRequest, 'lang' | 'options'>;

interface PlanItem {
  key: string;
  core: Core;
  /** days before today, and the hour of day */
  daysAgo: number;
  hour: number;
}

/** When each sample "happened": a busy fortnight with a few checks most days. */
const WHEN: readonly [number, number][] = [
  [0, 10],
  [0, 18],
  [1, 9],
  [2, 20],
  [3, 13],
  [4, 11],
  [5, 19],
  [6, 8],
  [8, 16],
  [9, 21],
  [11, 12],
  [12, 17],
  [13, 10],
  [1, 15],
  [7, 14],
];

export function samplePlan(): PlanItem[] {
  const messages: { key: string; core: Core }[] = SAMPLE_MESSAGES.map((s) => ({
    key: s.id,
    core: { kind: s.kind, text: s.text },
  }));
  const extra: { key: string; core: Core }[] = [
    { key: 'refund-qr', core: { kind: 'qr', qrPayload: QR_LINK_SAMPLES[1].value } },
    { key: 'lookalike-link', core: { kind: 'url', url: QR_LINK_SAMPLES[0].value } },
    {
      key: 'refund-collect',
      core: { kind: 'collect_request', collect: toCollectInput(SAMPLE_COLLECT) },
    },
  ];
  return [...messages, ...extra].map((item, i) => {
    const [daysAgo, hour] = WHEN[i % WHEN.length]!;
    return { ...item, daysAgo, hour };
  });
}

function dateFor(now: Date, daysAgo: number, hour: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, (daysAgo * 7) % 60, 0, 0);
  // never in the future (a "today" sample later than now moves to a minute ago)
  return (d > now ? new Date(now.getTime() - 60_000) : d).toISOString();
}

/** Run the engine on every sample (offline: no link expansion, no domain age, no AI). */
export async function buildSampleHistory(lang: Lang, now = new Date()): Promise<ScanRecord[]> {
  const out: ScanRecord[] = [];
  for (const item of samplePlan()) {
    try {
      const r = await analyze({
        ...item.core,
        lang,
        options: { expandLinks: false, domainAge: false, cloudAI: false },
      });
      const result = {
        ...r,
        id: `${SAMPLE_ID_PREFIX}${item.key}`,
        createdAt: dateFor(now, item.daysAgo, item.hour),
      };
      rememberResult(result);
      out.push(toScanRecord(result));
    } catch {
      /* a sample that fails to analyse is left out */
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
