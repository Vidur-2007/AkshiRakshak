import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  AnalysisResultSchema,
  DrillSchema,
  EntityGraphSchema,
  EvalReportSchema,
  StatementAnalysisSchema,
} from '../src/index';

const DIR = new URL('../fixtures/', import.meta.url);

const SCHEMAS: Record<string, z.ZodType> = {
  'analysis-scam-kyc': AnalysisResultSchema,
  'analysis-suspicious-job': AnalysisResultSchema,
  'analysis-nosigns-otp': AnalysisResultSchema,
  'analysis-collect': AnalysisResultSchema,
  'analysis-qr': AnalysisResultSchema,
  'analysis-url': AnalysisResultSchema,
  'analysis-image': AnalysisResultSchema,
  'analysis-chat': AnalysisResultSchema,
  'analysis-email': AnalysisResultSchema,
  'statement-analysis': StatementAnalysisSchema,
  'entity-graph': EntityGraphSchema,
  'eval-report': EvalReportSchema,
  drill: DrillSchema,
};

function load(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`${name}.json`, DIR), 'utf8'));
}

/** Every object with numeric start/end and a string `text` (Span, OcrBox, ChatTurnRisk). */
function collectSpans(value: unknown, out: { start: number; end: number; text: string }[] = []) {
  if (Array.isArray(value)) value.forEach((v) => collectSpans(v, out));
  else if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.start === 'number' && typeof o.end === 'number' && typeof o.text === 'string') {
      out.push({ start: o.start, end: o.end, text: o.text });
    }
    Object.values(o).forEach((v) => collectSpans(v, out));
  }
  return out;
}

describe('fixtures', () => {
  it('has exactly the files listed in SPEC.md §6.7', () => {
    const files = readdirSync(DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''));
    expect(files.sort()).toEqual(Object.keys(SCHEMAS).sort());
  });

  for (const [name, schema] of Object.entries(SCHEMAS)) {
    it(`${name} parses with its schema and has no unknown keys`, () => {
      const raw = load(name);
      const parsed = schema.parse(raw);
      // zod strips unknown keys; equality proves there were none (catches typos)
      expect(parsed).toEqual(raw);
    });
  }

  const analysisNames = Object.keys(SCHEMAS).filter((n) => n.startsWith('analysis-'));
  for (const name of analysisNames) {
    it(`${name}: every span's text equals text.slice(start, end)`, () => {
      const result = AnalysisResultSchema.parse(load(name));
      const spans = collectSpans({ ...result, text: undefined });
      expect(spans.length).toBeGreaterThan(0);
      for (const s of spans) {
        expect(s.end).toBeGreaterThanOrEqual(s.start);
        expect(s.end).toBeLessThanOrEqual(result.text.length);
        expect(result.text.slice(s.start, s.end)).toBe(s.text);
      }
    });

    it(`${name}: signals are sorted by weight, descending`, () => {
      const { signals } = AnalysisResultSchema.parse(load(name));
      const weights = signals.map((s) => s.weight);
      expect(weights).toEqual([...weights].sort((a, b) => b - a));
    });
  }

  it('covers all four languages across the analysis fixtures', () => {
    const langs = new Set(analysisNames.map((n) => AnalysisResultSchema.parse(load(n)).lang));
    expect([...langs].sort()).toEqual(['bn', 'en', 'hi', 'te']);
  });

  it('drill nodes reference existing nodes and have safe and scammed endings', () => {
    const drill = DrillSchema.parse(load('drill'));
    const ids = new Set(Object.keys(drill.nodes));
    expect(ids.has(drill.start)).toBe(true);
    for (const node of Object.values(drill.nodes)) {
      for (const c of node.choices ?? []) expect(ids.has(c.next)).toBe(true);
    }
    const ends = Object.values(drill.nodes).map((n) => n.end);
    expect(ends).toContain('safe');
    expect(ends).toContain('scammed');
  });

  it('statement anomalies reference existing transactions', () => {
    const s = StatementAnalysisSchema.parse(load('statement-analysis'));
    const ids = new Set(s.txns.map((t) => t.id));
    for (const a of s.anomalies) for (const id of a.txnIds) expect(ids.has(id)).toBe(true);
  });

  it('entity graph edges reference existing nodes', () => {
    const g = EntityGraphSchema.parse(load('entity-graph'));
    const ids = new Set(g.nodes.map((n) => n.id));
    for (const e of g.edges) {
      expect(ids.has(e.source)).toBe(true);
      expect(ids.has(e.target)).toBe(true);
    }
  });
});
