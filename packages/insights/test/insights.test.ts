// STUB — owned by Laptop C; replaced on feat/data
import { describe, expect, it } from 'vitest';
import {
  EntityGraphSchema,
  ParsedStatementSchema,
  StatementAnalysisSchema,
} from '@akshi/contracts';
import {
  analyzeStatement,
  buildEntityGraph,
  parseStatementCsv,
  SAMPLE_STATEMENTS,
} from '../src/index';

describe('insights stub', () => {
  it('parses the 30-row sample statement', () => {
    const sample = SAMPLE_STATEMENTS[0];
    expect(sample).toBeDefined();
    const parsed = ParsedStatementSchema.parse(parseStatementCsv(sample!.csv));
    expect(parsed.format).toBe('canonical');
    expect(parsed.errors).toEqual([]);
    expect(parsed.txns).toHaveLength(30);
  });

  it('analyzeStatement returns a valid analysis with anomalies pointing at real txns', () => {
    const { txns } = parseStatementCsv(SAMPLE_STATEMENTS[0]!.csv);
    const result = StatementAnalysisSchema.parse(analyzeStatement(txns, 'en'));
    expect(result.txns).toEqual(txns);
    expect(result.anomalies.length).toBeGreaterThan(0);
  });

  it('reports unsupported formats without throwing', () => {
    expect(parseStatementCsv('Date,Narration,Amount,Dr/Cr,Balance\n').format).toBe('unknown');
    expect(parseStatementCsv('').txns).toEqual([]);
  });

  it('buildEntityGraph returns a valid graph', () => {
    EntityGraphSchema.parse(buildEntityGraph([]));
  });
});
