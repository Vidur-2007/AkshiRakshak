/// <reference types="node" />
// (this test reads data/messages from disk; the package itself stays free of Node APIs)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildCampaignSamples,
  SAMPLE_TEXT_MAX,
  trimSample,
  type CampaignSamples,
  type DatasetRow,
} from '../src/campaignSamples';
import { INDICATORS } from '../src';
import built from '../src/campaign-samples.json' with { type: 'json' };

const rows = readFileSync(
  fileURLToPath(new URL('../../../data/messages/messages.jsonl', import.meta.url)),
  'utf8',
)
  .split('\n')
  .filter(Boolean)
  .map((l: string) => JSON.parse(l) as DatasetRow);
const json = built as unknown as CampaignSamples;

describe('campaign-samples.json', () => {
  it('is up to date with data/messages (run npm run campaign-samples)', () => {
    expect(json).toEqual(buildCampaignSamples(rows, INDICATORS));
  });

  it('only searches and shows training messages, never validation or test ones', () => {
    const train = new Set(rows.filter((r) => r.split === 'train').map((r) => trimSample(r.text)));
    for (const [, , text] of json.samples) expect(train.has(text)).toBe(true);
    expect(json.samples).toHaveLength(
      rows.filter((r) => r.split === 'train' && r.label === 'scam' && r.category).length,
    );
    expect(json.samples.every(([, , t]) => t.length <= SAMPLE_TEXT_MAX)).toBe(true);
  });

  it('counts every scam message of a category, and maps categories to network campaigns', () => {
    const total = Object.values(json.counts).reduce((a, c) => a + (c?.messages ?? 0), 0);
    expect(total).toBe(rows.filter((r) => r.label === 'scam' && r.category).length);
    expect(json.campaignOf.fake_kyc).toBe('kyc-block-wave');
    const campaigns = new Set(INDICATORS.map((i) => i.campaign).filter(Boolean));
    for (const c of Object.values(json.campaignOf)) expect(campaigns.has(c)).toBe(true);
  });

  it('records how each kind of scam arrived', () => {
    const rowsKyc = rows.filter((r) => r.label === 'scam' && r.category === 'fake_kyc');
    const total = Object.values(json.channelsOf.fake_kyc ?? {}).reduce((a, n) => a + n, 0);
    expect(total).toBe(rowsKyc.length);
    expect(Object.keys(json.channelsOf.fake_kyc ?? {})).toContain('sms');
  });

  it('trimSample cuts long text at a word and marks the cut', () => {
    expect(trimSample('short  text')).toBe('short text');
    const long = trimSample('word '.repeat(100));
    expect(long.length).toBeLessThanOrEqual(SAMPLE_TEXT_MAX);
    expect(long.endsWith('…')).toBe(true);
    expect(long).not.toMatch(/wor…$/);
  });
});
