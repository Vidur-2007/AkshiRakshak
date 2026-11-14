/**
 * Local history in IndexedDB via Dexie (SPEC_B_WEB.md §2.3). Nothing here leaves the device.
 */
import Dexie, { type EntityTable } from 'dexie';
import { broadcast } from './broadcast';
import type { AnalysisResult, InputKind, ScamCategory, StatementAnalysis, Verdict } from './engine';
import { clearLocalStorage } from './safeStorage';

export interface ScanRecord {
  id: string;
  createdAt: string;
  kind: InputKind;
  verdict: Verdict;
  riskScore: number;
  category: ScamCategory | null;
  inputPreview: string;
  result: AnalysisResult;
}

export type BlockType = 'upi' | 'phone' | 'domain';

export interface BlockEntry {
  value: string;
  type: BlockType;
  addedAt: string;
}

export interface StatementRecord {
  id: string;
  createdAt: string;
  name: string;
  analysis: StatementAnalysis;
}

export interface DojoRecord {
  drillId: string;
  score: number;
  completedAt: string;
}

export class AkshiDB extends Dexie {
  scans!: EntityTable<ScanRecord, 'id'>;
  blocklist!: EntityTable<BlockEntry, 'value'>;
  statements!: EntityTable<StatementRecord, 'id'>;
  dojo!: EntityTable<DojoRecord, 'drillId'>;

  constructor(name = 'akshi') {
    super(name);
    this.version(1).stores({
      scans: 'id, createdAt, kind, verdict, riskScore, category',
      blocklist: 'value, type, addedAt',
      statements: 'id, createdAt, name',
      dojo: 'drillId, score, completedAt',
    });
  }
}

export const db = new AkshiDB();

export const PREVIEW_LENGTH = 120;

/** Short single-line preview for history lists. */
export function makePreview(text: string, max = PREVIEW_LENGTH): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1).trimEnd()}…`;
}

export function toScanRecord(result: AnalysisResult): ScanRecord {
  return {
    id: result.id,
    createdAt: result.createdAt,
    kind: result.kind,
    verdict: result.verdict,
    riskScore: result.riskScore,
    category: result.category,
    inputPreview: makePreview(result.text),
    result,
  };
}

/** Saves a completed scan and tells open tabs (Dashboard) about it. */
export async function saveScan(result: AnalysisResult): Promise<void> {
  await db.scans.put(toScanRecord(result));
  broadcast({ type: 'scan', id: result.id });
}

export function getScan(id: string): Promise<ScanRecord | undefined> {
  return db.scans.get(id);
}

export function recentScans(limit = 20): Promise<ScanRecord[]> {
  return db.scans.orderBy('createdAt').reverse().limit(limit).toArray();
}

/** Values passed as `options.blocklist` in every analyze call. */
export async function blocklistValues(): Promise<string[]> {
  try {
    return (await db.blocklist.toArray()).map((b) => b.value);
  } catch {
    return [];
  }
}

export async function addToBlocklist(value: string, type: BlockType): Promise<void> {
  const v = value.trim().toLowerCase();
  if (!v) return;
  await db.blocklist.put({ value: v, type, addedAt: new Date().toISOString() });
  broadcast({ type: 'blocklist' });
}

/** "Delete everything": clears IndexedDB and local storage, then reloads. */
export async function deleteEverything(): Promise<void> {
  try {
    db.close();
    await Dexie.delete(db.name);
  } catch {
    /* continue clearing the rest */
  }
  clearLocalStorage();
  broadcast({ type: 'cleared' });
  window.location.reload();
}
