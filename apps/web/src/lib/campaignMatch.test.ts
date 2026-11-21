import { beforeAll, describe, expect, it } from 'vitest';
import { analyze, loadCampaignSamples, type AnalysisResult } from './engine';
import {
  CLOSEST_MIN,
  closestSample,
  matchCampaign,
  type CampaignSamplesData,
} from './campaignMatch';

const KYC =
  'Dear Customer, your SBI account will be BLOCKED today due to pending KYC. Update KYC immediately at http://sbi-kyc-update.xyz/verify or call our helpline 98765 00001. -SBI Team';
const POWER =
  'Dear customer your electricity connection will be disconnected tonight at 9.30 pm because previous month bill was not updated. Please immediately contact electricity officer 9876543210';
const OTP = 'Your OTP for login is 482913. Do not share it with anyone. -HDFC Bank';

let data: CampaignSamplesData;
beforeAll(async () => {
  data = await loadCampaignSamples();
});
const check = (text: string) => analyze({ kind: 'message', text, lang: 'en' });

describe('matchCampaign', () => {
  it('links a message to a campaign through the details it shares with it', async () => {
    const m = matchCampaign(await check(KYC), data)!;
    expect(m.campaign).toBe('kyc-block-wave');
    expect(m.category).toBe('fake_kyc');
    expect(m.shared).toEqual(
      expect.arrayContaining([
        { type: 'domain', value: 'sbi-kyc-update.xyz' },
        { type: 'phone', value: '+919876500001' },
      ]),
    );
    expect(m.messages).toBe(data.counts.fake_kyc!.messages);
    expect(m.langs).toBe(4);
    // the closest example is a training message of the same kind
    expect(data.samples.some(([c, , t]) => c === 'fake_kyc' && t === m.closest?.text)).toBe(true);
  });

  it('falls back to the kind of scam when no detail is shared', async () => {
    const m = matchCampaign(await check(POWER), data)!;
    expect(m.shared).toEqual([]);
    expect(m.category).toBe('bill_disconnection');
    expect(m.campaign).toBe(data.campaignOf.bill_disconnection);
    expect(m.closest?.text).toMatch(/electricity/i);
  });

  it('matches nothing when no warning signs were found', async () => {
    expect(matchCampaign(await check(OTP), data)).toBeNull();
  });

  it('keeps the kind of scam but no campaign when no campaign has it', () => {
    const result = {
      verdict: 'scam',
      category: 'romance',
      text: 'I love you, send me money for the flight ticket',
      entities: { urls: [], upiIds: [], phones: [], amounts: [], brands: [] },
    } as unknown as AnalysisResult;
    const m = matchCampaign(result, data)!;
    expect(data.campaignOf.romance).toBeUndefined();
    expect(m.campaign).toBeNull();
    expect(m.messages).toBe(data.counts.romance!.messages);
  });

  it('needs a kind of scam or a shared detail', () => {
    const result = {
      verdict: 'suspicious',
      category: null,
      text: 'hello',
      entities: { urls: [], upiIds: [], phones: [], amounts: [], brands: [] },
    } as unknown as AnalysisResult;
    expect(matchCampaign(result, data)).toBeNull();
  });
});

describe('closestSample', () => {
  it('returns the exact sample for its own text, and nothing for unrelated text', () => {
    const [category, lang, text] = data.samples.find(([c]) => c === 'job_task')!;
    const hit = closestSample(text, category, data)!;
    expect(hit.text).toBe(text);
    expect(hit.lang).toBe(lang);
    expect(hit.similarity).toBeCloseTo(1, 5);
    expect(closestSample('zzzz qqqq xxxx', 'job_task', data)).toBeNull();
    expect(CLOSEST_MIN).toBeGreaterThan(0);
  });
});
