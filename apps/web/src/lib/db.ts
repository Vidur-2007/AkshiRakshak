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

/** The screenshot behind an image scan, kept on this device for the box overlay (M2.2). */
export interface ImageRecord {
  id: string;
  blob: Blob;
  createdAt: string;
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
  images!: EntityTable<ImageRecord, 'id'>;

  constructor(name = 'akshi') {
    super(name);
    this.version(1).stores({
      scans: 'id, createdAt, kind, verdict, riskScore, category',
      blocklist: 'value, type, addedAt',
      statements: 'id, createdAt, name',
      dojo: 'drillId, score, completedAt',
    });
    // v2 (Phase 2): screenshots for image scans, keyed by scan id
    this.version(2).stores({ images: 'id, createdAt' });
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

// ── Phase 3: statements, blocklist management, privacy counts ───────────────

export async function saveStatement(
  name: string,
  analysis: StatementAnalysis,
): Promise<StatementRecord> {
  const rec: StatementRecord = {
    id: globalThis.crypto?.randomUUID?.() ?? `st-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    name,
    analysis,
  };
  try {
    await db.statements.put(rec);
    broadcast({ type: 'statement', id: rec.id });
  } catch {
    /* history unavailable; the analysis is still on screen */
  }
  return rec;
}

export async function recentStatements(limit = 5): Promise<StatementRecord[]> {
  try {
    return await db.statements.orderBy('createdAt').reverse().limit(limit).toArray();
  } catch {
    return [];
  }
}

export async function listBlocklist(): Promise<BlockEntry[]> {
  try {
    return await db.blocklist.orderBy('addedAt').reverse().toArray();
  } catch {
    return [];
  }
}

export async function removeFromBlocklist(value: string): Promise<void> {
  await db.blocklist.delete(value);
  broadcast({ type: 'blocklist' });
}

export interface StorageCounts {
  scans: number;
  blocklist: number;
  statements: number;
  images: number;
  dojo: number;
}

/** What is stored on this device, for the privacy panel. */
export async function storageCounts(): Promise<StorageCounts> {
  const count = async (t: { count(): Promise<number> }) => {
    try {
      return await t.count();
    } catch {
      return 0;
    }
  };
  const [scans, blocklist, statements, images, dojo] = await Promise.all([
    count(db.scans),
    count(db.blocklist),
    count(db.statements),
    count(db.images),
    count(db.dojo),
  ]);
  return { scans, blocklist, statements, images, dojo };
}

export async function allScans(): Promise<ScanRecord[]> {
  try {
    return await db.scans.orderBy('createdAt').reverse().toArray();
  } catch {
    return [];
  }
}

export async function scansByIds(ids: string[]): Promise<ScanRecord[]> {
  try {
    const rows = await db.scans.bulkGet(ids);
    return rows.filter((r): r is ScanRecord => !!r);
  } catch {
    return [];
  }
}

// ── Phase 4: Dojo scores ─────────────────────────────────────────────────────

/** Keeps the best score per drill. Returns the stored best. */
export async function saveDojoScore(drillId: string, score: number): Promise<number> {
  try {
    const prev = await db.dojo.get(drillId);
    if (prev && prev.score >= score) return prev.score;
    await db.dojo.put({ drillId, score, completedAt: new Date().toISOString() });
  } catch {
    /* scores are a convenience; ignore storage failures */
  }
  return score;
}

export async function dojoScores(): Promise<Map<string, number>> {
  try {
    return new Map((await db.dojo.toArray()).map((d) => [d.drillId, d.score]));
  } catch {
    return new Map();
  }
}
