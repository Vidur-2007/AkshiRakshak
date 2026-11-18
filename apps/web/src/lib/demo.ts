/**
 * Recording mode (`?demo=1`): the samples used in the demo video come first in the
 * sample chips, in script order (SPEC.md §13.1). Only the order changes; the samples'
 * text, and so every verdict and score, stays the same.
 */
import type { SampleMessage } from './engine';

/** Fake KYC (Quick Scan, offline), Hindi (Elder STOP + Hindi voice), Telugu, collect refund. */
export const DEMO_SAMPLE_ORDER = [
  'sample-fake-kyc',
  'sample-electricity-hi',
  'sample-job-te',
  'sample-collect-refund',
] as const;

export function orderSamples<T extends Pick<SampleMessage, 'id'>>(
  samples: readonly T[],
  demo: boolean,
): T[] {
  if (!demo) return [...samples];
  const rank = (id: string) => {
    const i = (DEMO_SAMPLE_ORDER as readonly string[]).indexOf(id);
    return i < 0 ? DEMO_SAMPLE_ORDER.length : i;
  };
  // stable: the rest keep their bundled order
  return samples
    .map((s, i) => ({ s, i }))
    .sort((a, b) => rank(a.s.id) - rank(b.s.id) || a.i - b.i)
    .map(({ s }) => s);
}
