/**
 * Regenerates packages/content/src/campaign-samples.json (Campaign Match on the Analysis screen)
 * from data/messages/messages.jsonl and the sample indicators.
 * Run: npm run campaign-samples    (a content test fails when the JSON is out of date)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { buildCampaignSamples, INDICATORS, type DatasetRow } from '@akshi/content';

const rows = readFileSync('data/messages/messages.jsonl', 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l) as DatasetRow);
const out = buildCampaignSamples(rows, INDICATORS);
writeFileSync('packages/content/src/campaign-samples.json', JSON.stringify(out) + '\n');
console.log(
  `campaign-samples.json: ${out.samples.length} samples, ${Object.keys(out.counts).length} categories, ${Object.keys(out.campaignOf).length} with a campaign`,
);
