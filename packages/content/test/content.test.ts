import { describe, expect, it } from 'vitest';
import {
  DrillSchema,
  EmergencyContentSchema,
  EvalReportSchema,
  FaqItemSchema,
  IndicatorSchema,
  LandscapeSchema,
  PatternCardSchema,
  SampleMessageSchema,
  SCAM_CATEGORIES,
  normalizeText,
} from '@akshi/contracts';
import {
  DRILLS,
  EMERGENCY,
  EVAL_REPORT,
  FAQ,
  INDICATORS,
  LANDSCAPE,
  PATTERN_CARDS,
  SAMPLE_MESSAGES,
} from '../src/index';

describe('content validates against the contracts', () => {
  it('every export parses with its schema', () => {
    DRILLS.forEach((d) => DrillSchema.parse(d));
    FAQ.forEach((f) => FaqItemSchema.parse(f));
    EmergencyContentSchema.parse(EMERGENCY);
    INDICATORS.forEach((i) => IndicatorSchema.parse(i));
    SAMPLE_MESSAGES.forEach((s) => SampleMessageSchema.parse(s));
    PATTERN_CARDS.forEach((p) => PatternCardSchema.parse(p));
    LandscapeSchema.parse(LANDSCAPE);
    EvalReportSchema.parse(EVAL_REPORT);
  });

  it('still has the Phase 0 stubs for the exports that later phases replace', () => {
    expect(DRILLS).toHaveLength(2);
    expect(FAQ).toHaveLength(5);
    expect(EMERGENCY.questions).toHaveLength(6);
    expect(EMERGENCY.steps.length).toBeGreaterThanOrEqual(6);
    expect(PATTERN_CARDS).toHaveLength(2);
  });
});

describe('SAMPLE_MESSAGES', () => {
  const byId = new Map(SAMPLE_MESSAGES.map((s) => [s.id, s]));

  it('has the 12 samples the spec lists, with unique ids', () => {
    expect(SAMPLE_MESSAGES).toHaveLength(12);
    expect(byId.size).toBe(12);
    const scams = SAMPLE_MESSAGES.filter((s) => !s.genuine);
    expect(scams.map((s) => s.lang).sort()).toEqual(['bn', 'bn', 'en', 'en', 'en', 'hi', 'hi', 'te', 'te']);
  });

  it('has three genuine messages that expect "No warning signs found"', () => {
    const genuine = SAMPLE_MESSAGES.filter((s) => s.genuine);
    expect(genuine.map((s) => s.id).sort()).toEqual([
      'sample-genuine-debit-hi',
      'sample-genuine-delivery',
      'sample-genuine-otp',
    ]);
    genuine.forEach((s) => expect(s.expected).toBe('no_signs'));
    SAMPLE_MESSAGES.filter((s) => !s.genuine).forEach((s) => expect(s.expected).not.toBe('no_signs'));
  });

  it('keeps the ids the web app and tour look up', () => {
    for (const id of ['sample-fake-kyc', 'sample-collect-refund', 'sample-electricity-hi', 'sample-job-te']) {
      expect(byId.has(id)).toBe(true);
    }
    expect(SAMPLE_MESSAGES[0]?.id).toBe('sample-fake-kyc');
  });

  it('has labels in all four languages and text that is already normalised', () => {
    for (const s of SAMPLE_MESSAGES) {
      expect(Object.keys(s.label).sort()).toEqual(['bn', 'en', 'hi', 'te']);
      expect(s.kind).toBe('message');
      expect(normalizeText(s.text)).toBe(s.text);
    }
  });

  it('uses only invented phone numbers', () => {
    const mobile = /(?<!\d)(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/g;
    const invented = /^(?:\+91[\s-]?)?(?:98765[\s-]?[01]\d{4}|90000[\s-]?0\d{4})$/;
    for (const s of SAMPLE_MESSAGES) {
      for (const m of s.text.match(mobile) ?? []) expect(m).toMatch(invented);
    }
  });
});

describe('INDICATORS', () => {
  it('has about 150 unique sample entries of all three types', () => {
    expect(INDICATORS.length).toBeGreaterThanOrEqual(140);
    expect(INDICATORS.length).toBeLessThanOrEqual(160);
    expect(new Set(INDICATORS.map((i) => `${i.type}:${i.value}`)).size).toBe(INDICATORS.length);
    for (const type of ['upi', 'phone', 'domain'] as const) {
      expect(INDICATORS.filter((i) => i.type === type).length).toBeGreaterThanOrEqual(30);
    }
    INDICATORS.forEach((i) => {
      expect(i.sampleData).toBe(true);
      expect(i.reports).toBeGreaterThanOrEqual(1);
      expect(i.category).not.toBe('other');
    });
  });

  it('groups them into 8 to 12 named campaigns', () => {
    const campaigns = new Set(INDICATORS.flatMap((i) => (i.campaign ? [i.campaign] : [])));
    expect(campaigns.size).toBeGreaterThanOrEqual(8);
    expect(campaigns.size).toBeLessThanOrEqual(12);
  });

  it('uses the value formats the engine looks up', () => {
    for (const i of INDICATORS) {
      if (i.type === 'phone') expect(i.value).toMatch(/^\+91(98765[01]|900000)\d{4}$/);
      if (i.type === 'upi') expect(i.value).toMatch(/^[a-z0-9._-]+@[a-z]+$/);
      if (i.type === 'domain') expect(i.value).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/);
    }
  });

  it('keeps the entries other packages test against', () => {
    expect(INDICATORS[0]).toMatchObject({ value: 'kyc.update.helpdesk@ybl', reports: 7, campaign: 'kyc-block-wave' });
    const find = (v: string) => INDICATORS.find((i) => i.value === v);
    expect(find('sbi-kyc-update.xyz')?.reports).toBe(6);
    expect(find('+919876500001')?.category).toBe('fake_kyc');
    expect(find('sbi.refund.desk@ybl')?.category).toBe('upi_collect');
    expect(find('hdfcbenk.top')?.category).toBe('phishing_link');
  });
});

describe('LANDSCAPE', () => {
  it('covers the 19 dataset categories and four languages, and the three views agree', () => {
    expect(LANDSCAPE.sampleData).toBe(true);
    expect(LANDSCAPE.byCategory.map((c) => c.category).sort()).toEqual(
      SCAM_CATEGORIES.filter((c) => c !== 'other').sort(),
    );
    expect(LANDSCAPE.byLang.map((l) => l.lang)).toEqual(['en', 'hi', 'te', 'bn']);
    const total = (rows: { count: number }[]) => rows.reduce((a, r) => a + r.count, 0);
    expect(total(LANDSCAPE.byCategory)).toBe(total(LANDSCAPE.byLang));
    expect(total(LANDSCAPE.byChannel)).toBe(total(LANDSCAPE.byLang));
    expect(total(LANDSCAPE.byLang)).toBeGreaterThanOrEqual(1200);
  });
});
