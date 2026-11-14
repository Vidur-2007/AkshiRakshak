/**
 * Quick Scan helpers: building the AnalyzeRequest and keeping results reachable even
 * when IndexedDB is unavailable (private windows, blocked storage).
 */
import { getScan, saveScan } from './db';
import type { AnalysisResult, AnalyzeRequest, InputKind, Lang } from './engine';

export const MAX_INPUT = 20_000;

/** Kinds the Quick Scan box can auto-detect. */
export type TextKind = Extract<
  InputKind,
  'message' | 'chat' | 'email' | 'url' | 'upi_id' | 'phone' | 'qr'
>;

export function toTextKind(kind: InputKind): TextKind {
  switch (kind) {
    case 'chat':
    case 'email':
    case 'url':
    case 'upi_id':
    case 'phone':
    case 'qr':
      return kind;
    default:
      return 'message';
  }
}

export interface ScanOptions {
  lang: Lang;
  cloudAI: boolean;
  online: boolean;
  blocklist: string[];
  signal?: AbortSignal;
}

/** One request per input kind; the raw text always rides along. */
export function buildRequest(raw: string, kind: InputKind, o: ScanOptions): AnalyzeRequest {
  const text = raw.slice(0, MAX_INPUT);
  const value = text.trim();
  const req: AnalyzeRequest = {
    kind: toTextKind(kind),
    text,
    lang: o.lang,
    options: {
      cloudAI: o.cloudAI && o.online,
      expandLinks: o.online,
      domainAge: o.online,
      blocklist: o.blocklist,
      ...(o.signal ? { signal: o.signal } : {}),
    },
  };
  if (req.kind === 'url') req.url = value;
  if (req.kind === 'upi_id') req.upiId = value;
  if (req.kind === 'phone') req.phone = value;
  if (req.kind === 'qr') req.qrPayload = value;
  return req;
}

const memory = new Map<string, AnalysisResult>();

/**
 * Saves to IndexedDB (which also broadcasts to other tabs) and keeps an in-memory
 * copy, so the Analysis screen opens even if storage fails.
 */
export async function storeResult(result: AnalysisResult): Promise<void> {
  memory.set(result.id, result);
  try {
    await saveScan(result);
  } catch {
    /* history unavailable; this tab still has the result */
  }
}

export async function loadResult(id: string): Promise<AnalysisResult | null> {
  const cached = memory.get(id);
  if (cached) return cached;
  try {
    return (await getScan(id))?.result ?? null;
  } catch {
    return null;
  }
}

/** Synchronous look-up of a result made in this tab. */
export function peekResult(id: string): AnalysisResult | null {
  return memory.get(id) ?? null;
}

/** Test helper. */
export function rememberResult(result: AnalysisResult): void {
  memory.set(result.id, result);
}
