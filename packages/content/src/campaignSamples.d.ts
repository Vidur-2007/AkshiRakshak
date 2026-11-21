/**
 * Campaign Match data (web: "You're not the only one"). Built from the synthetic message dataset
 * (data/messages) and the sample indicators by scripts/build-campaign-samples.ts; the result is
 * campaign-samples.json, loaded by the web app only when a result needs it.
 *
 * - counts: scam messages per category in the whole dataset, and in how many languages. A plain
 *   fact about the dataset, so every split counts.
 * - samples: the texts the closest-example search runs over. Train split only, so validation and
 *   test messages are never shown or searched.
 * - campaignOf: the network campaign most of a category's sample indicators belong to.
 */
import type { ScamCategory } from '@akshi/contracts';
export interface DatasetRow {
    text: string;
    lang: string;
    label: string;
    category: string | null;
    split: string;
}
export interface IndicatorRow {
    category?: string;
    campaign?: string;
}
/** [category, lang, text] */
export type CampaignSample = [ScamCategory, string, string];
export interface CampaignSamples {
    note: string;
    campaignOf: Partial<Record<ScamCategory, string>>;
    counts: Partial<Record<ScamCategory, {
        messages: number;
        langs: number;
    }>>;
    samples: CampaignSample[];
}
export declare const SAMPLE_TEXT_MAX = 240;
/** Keep a sample short for display: cut at a word boundary and mark the cut. */
export declare function trimSample(text: string, max?: number): string;
export declare function buildCampaignSamples(rows: readonly DatasetRow[], indicators: readonly IndicatorRow[]): CampaignSamples;
