/**
 * Repeated collect requests (2026-11-22): scammers send the same collect request again and again,
 * hoping one gets approved by mistake. From your own check history, this counts how often a UPI ID
 * has sent you collect requests before, and how many were for the same amount.
 *
 * Only collect-request checks count, matched on the requester's UPI ID (lower-case). The check
 * being shown is left out, so "before" means before this one.
 */
import { normalise, resultDetails } from './crossLinks';
import type { ScanRecord } from './db';
import type { AnalysisResult, Verdict } from './engine';

export interface PriorRequest {
  scanId: string;
  at: string;
  amount: number | null;
  verdict: Verdict;
  risk: number;
}

/** The requester's UPI ID of a collect-request check ("Collect request from … (upi) for ₹…"). */
export function requesterOf(result: Pick<AnalysisResult, 'kind' | 'entities'>): string | null {
  if (result.kind !== 'collect_request') return null;
  return resultDetails(result).find((d) => d.type === 'upi')?.value ?? null;
}

/** Earlier collect requests from this UPI ID in your history, newest first. */
export function priorRequests(
  upi: string,
  history: readonly ScanRecord[],
  excludeId?: string,
): PriorRequest[] {
  const key = normalise('upi', upi);
  if (!key) return [];
  return history
    .filter(
      (c) =>
        c.kind === 'collect_request' &&
        c.id !== excludeId &&
        resultDetails(c.result).some((d) => d.type === 'upi' && d.value === key),
    )
    .map((c) => ({
      scanId: c.id,
      at: c.createdAt,
      amount: c.result.entities.amounts[0]?.value ?? null,
      verdict: c.verdict,
      risk: c.riskScore,
    }))
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** How many earlier requests asked for exactly this amount. */
export function sameAmountCount(prior: readonly PriorRequest[], amount: number | null): number {
  return amount === null ? 0 : prior.filter((p) => p.amount === amount).length;
}
