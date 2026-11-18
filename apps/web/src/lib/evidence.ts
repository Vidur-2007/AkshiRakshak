/**
 * Plain-text evidence for "Copy evidence" (SPEC_B_WEB.md §5.3): date/time, channel,
 * sender details, UPI IDs, links, amounts, the message, verdict and reasons.
 */
import type { AnalysisResult } from './engine';

export interface EvidenceLabels {
  heading: string;
  date: string;
  channel: string;
  verdict: string;
  risk: string;
  category: string;
  reasons: string;
  links: string;
  upi: string;
  phones: string;
  emails: string;
  amounts: string;
  message: string;
}

export interface EvidenceInput {
  result: AnalysisResult;
  labels: EvidenceLabels;
  verdictText: string;
  categoryName: string | null;
  channelText?: string;
  /** formats an ISO date for the reader */
  formatDate?: (iso: string) => string;
}

function list(label: string, values: string[]): string[] {
  const unique = [...new Set(values.map((v) => v.trim()).filter(Boolean))];
  return unique.length ? [`${label}: ${unique.join(', ')}`] : [];
}

export function buildEvidenceText({
  result,
  labels,
  verdictText,
  categoryName,
  channelText,
  formatDate = (iso) => new Date(iso).toLocaleString('en-IN'),
}: EvidenceInput): string {
  const e = result.entities;
  const reasons = result.signals
    .filter((s) => s.weight > 0)
    .map((s) => `- ${s.label}: ${s.detail}`);
  const lines = [
    labels.heading,
    `${labels.date}: ${formatDate(result.createdAt)}`,
    ...(channelText ? [`${labels.channel}: ${channelText}`] : []),
    `${labels.verdict}: ${verdictText}`,
    `${labels.risk}: ${result.riskScore}/100`,
    ...(categoryName ? [`${labels.category}: ${categoryName}`] : []),
    ...list(
      labels.phones,
      e.phones.map((p) => p.raw),
    ),
    ...list(
      labels.upi,
      e.upiIds.map((u) => u.raw),
    ),
    ...list(
      labels.links,
      e.urls.map((u) => u.raw),
    ),
    ...list(labels.emails, e.emails),
    ...list(
      labels.amounts,
      e.amounts.map((a) => a.raw),
    ),
    ...(reasons.length ? [`${labels.reasons}:`, ...reasons] : []),
    '',
    `${labels.message}:`,
    result.text,
  ];
  return lines.join('\n');
}

/** Values the user can add to the local blocklist from this result. */
export function blockableValues(
  result: AnalysisResult,
): { value: string; type: 'upi' | 'phone' | 'domain' }[] {
  const out: { value: string; type: 'upi' | 'phone' | 'domain' }[] = [];
  const seen = new Set<string>();
  const add = (value: string | undefined, type: 'upi' | 'phone' | 'domain') => {
    const v = value?.trim().toLowerCase();
    if (!v || seen.has(v)) return;
    seen.add(v);
    out.push({ value: v, type });
  };
  for (const u of result.entities.upiIds) add(u.raw, 'upi');
  for (const p of result.entities.phones) add(p.e164 ?? p.raw.replace(/[\s-]/g, ''), 'phone');
  for (const u of result.entities.urls)
    if (!u.isOfficial) add(u.registrableDomain || u.host, 'domain');
  if (result.qr?.pa) add(result.qr.pa, 'upi');
  return out;
}
