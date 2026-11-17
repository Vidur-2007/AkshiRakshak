import type { Entities, Signal, SignalId } from '@akshi/contracts';
import { loadCalibration } from '@akshi/model';
import { describe, expect, it } from 'vitest';
import { actionText } from '../src/i18n';
import { chooseActions } from '../src/pipeline/actions';
import {
  chooseCategory,
  confidenceOf,
  fuse,
  highestFloor,
  rulesLayerScore,
  severityOf,
  verdictOf,
} from '../src/pipeline/fusion';
import { inspectUrlLocal } from '../src/links/inspect';
import { CATALOG } from '../src/rules/catalog';

const sig = (id: SignalId, weight = CATALOG[id].weight): Signal => ({
  id,
  weight,
  label: id,
  detail: '',
  spans: [],
  source: 'rule',
});
const noEntities = (): Entities => ({
  urls: [],
  upiIds: [],
  phones: [],
  amounts: [],
  emails: [],
  apkMentions: [],
  brands: [],
});
const cal = loadCalibration();
const base = {
  calibration: cal,
  useLinks: true,
  indicators: null,
  maxReports: 0,
  model: null,
  ai: null,
};

describe('§8.1 layer scores', () => {
  it('rules: noisy-OR of positive weights × (1 + Σ negatives)', () => {
    expect(rulesLayerScore([sig('THREAT_BLOCK'), sig('URGENCY')])).toBeCloseTo(
      100 * (1 - 0.75 * 0.85),
    );
    expect(rulesLayerScore([sig('THREAT_BLOCK'), sig('SAFETY_ADVICE')])).toBeCloseTo(25 * 0.7);
  });

  it('negative weights do not apply when a floor-carrying signal fired', () => {
    expect(rulesLayerScore([sig('RECEIVE_WITH_PIN'), sig('SAFETY_ADVICE')])).toBeCloseTo(70);
  });

  it('uses a signal’s own weight (collect +0.15)', () => {
    expect(rulesLayerScore([sig('COLLECT_REQUEST', 0.35)])).toBeCloseTo(35);
  });

  it('ignores link-layer signals in the rules layer', () => {
    expect(rulesLayerScore([sig('RISKY_TLD'), sig('SHORTENED_URL')])).toBe(0);
  });
});

describe('§8.2 combination', () => {
  it('renormalises over available, relevant layers', () => {
    expect(
      fuse({ ...base, signals: [sig('THREAT_LEGAL')], entities: noEntities() }).riskScore,
    ).toBe(30); // rules only
    const e = noEntities();
    e.urls = [inspectUrlLocal('http://sbi-kyc-update.xyz/verify')]; // risk 69
    const r = fuse({ ...base, signals: [sig('THREAT_LEGAL')], entities: e });
    expect(r.riskScore).toBe(Math.round((0.45 * 30 + 0.2 * 69) / 0.65));
    expect(
      fuse({ ...base, signals: [sig('THREAT_LEGAL')], entities: e, model: 90 }).riskScore,
    ).toBe(Math.round((0.45 * 30 + 0.35 * 90 + 0.2 * 69) / 1));
  });

  it('uses only the links layer for single-item inputs', () => {
    const e = noEntities();
    e.urls = [inspectUrlLocal('https://amaz0n-deals.top/offer')];
    const r = fuse({ ...base, signals: [], entities: e, rulesRelevant: false });
    expect(r.riskScore).toBe(e.urls[0]!.risk);
  });

  it('takes the indicators score as a minimum', () => {
    expect(fuse({ ...base, signals: [], entities: noEntities(), indicators: 60 }).riskScore).toBe(
      60,
    );
  });

  it('blends AI but never lifts more than 15 points', () => {
    const r = fuse({ ...base, signals: [sig('THREAT_LEGAL')], entities: noEntities(), ai: 100 });
    expect(r.riskScore).toBe(Math.round(Math.min(0.8 * 30 + 0.2 * 100, 30 + 15)));
  });

  it('applies floors after fusion, with context conditions', () => {
    expect(
      fuse({ ...base, signals: [sig('RECEIVE_WITH_PIN')], entities: noEntities() }).riskScore,
    ).toBe(85);
    expect(fuse({ ...base, signals: [sig('APK_LINK')], entities: noEntities() }).riskScore).toBe(
      55,
    );
    expect(
      fuse({
        ...base,
        signals: [sig('APK_LINK')],
        entities: noEntities(),
        contexts: new Set(['official_claim']),
      }).riskScore,
    ).toBe(80);
    expect(fuse({ ...base, signals: [], entities: noEntities(), extraFloor: 90 }).riskScore).toBe(
      90,
    );
    expect(highestFloor([sig('KNOWN_INDICATOR')], { maxReports: 2 })).toBe(0);
    expect(highestFloor([sig('KNOWN_INDICATOR')], { maxReports: 3 })).toBe(75);
    expect(highestFloor([sig('ASKS_PIN')])).toBe(0);
    expect(highestFloor([sig('ASKS_PIN'), sig('PRIZE_LOTTERY')])).toBe(85);
  });

  it('reports layer shares that sum to at most 1', () => {
    const e = noEntities();
    e.urls = [inspectUrlLocal('http://sbi-kyc-update.xyz/verify')];
    const r = fuse({ ...base, signals: [sig('THREAT_LEGAL')], entities: e });
    const sum = r.layers.reduce((a, l) => a + l.share, 0);
    expect(sum).toBeLessThanOrEqual(1.0001);
    expect(sum).toBeGreaterThan(0.9);
  });
});

describe('§7.3 verdict and severity, §8.3 confidence', () => {
  it('uses calibration thresholds and severity bands', () => {
    expect([
      verdictOf(70, cal),
      verdictOf(69, cal),
      verdictOf(40, cal),
      verdictOf(39, cal),
    ]).toEqual(['scam', 'suspicious', 'suspicious', 'no_signs']);
    expect([85, 84, 70, 69, 40, 39, 15, 14].map((s) => severityOf(s))).toEqual([
      'critical',
      'high',
      'high',
      'medium',
      'medium',
      'low',
      'low',
      'none',
    ]);
  });

  it('computes confidence from strong signals and agreement', () => {
    expect(
      confidenceOf([sig('ASKS_OTP'), sig('STAY_ON_CALL'), sig('APK_LINK')], 80, null, 'scam', 100),
    ).toBeCloseTo(0.55 + 0.3 + 0.075, 1);
    expect(confidenceOf([], 0, 0, 'no_signs', 10)).toBe(0.6);
  });
});

describe('§8.4 category', () => {
  it('takes the hint of the highest-weighted rule signal, refined by context', () => {
    expect(chooseCategory('scam', [sig('STAY_ON_CALL'), sig('URGENCY')], '', null).category).toBe(
      'digital_arrest',
    );
    expect(
      chooseCategory(
        'scam',
        [sig('THREAT_BLOCK'), sig('URGENCY')],
        'your electricity will be cut',
        null,
      ).category,
    ).toBe('bill_disconnection');
    expect(
      chooseCategory('scam', [sig('LOOKALIKE_DOMAIN'), sig('THREAT_BLOCK')], '', null).category,
    ).toBe('fake_kyc'); // rules first
    expect(chooseCategory('scam', [sig('LOOKALIKE_DOMAIN')], '', null).category).toBe(
      'phishing_link',
    ); // links fallback
    expect(chooseCategory('no_signs', [sig('URGENCY')], '', null).category).toBeNull();
  });

  it('prefers the rules category; a confident model category fills in when no rule names one', () => {
    const model = {
      pScam: 0.9,
      category: 'job_task' as const,
      categoryProbs: { job_task: 0.8 },
      contributions: [],
    };
    expect(chooseCategory('scam', [sig('ASKS_OTP')], '', model).category).toBe('otp_theft');
    expect(chooseCategory('scam', [sig('URGENCY')], '', model)).toEqual({
      category: 'job_task',
      confidence: 0.8,
    });
    const unsure = { ...model, categoryProbs: { job_task: 0.4 } };
    expect(chooseCategory('scam', [sig('URGENCY')], '', unsure).category).toBe('other');
  });
});

describe('§8.6 actions and action text', () => {
  it('maps categories to ordered actions (max 5)', () => {
    expect(chooseActions('scam', 'fake_kyc', [], '')).toEqual([
      'do_not_click',
      'do_not_share_otp',
      'verify_official',
      'report_chakshu',
      'block_sender',
    ]);
    expect(chooseActions('scam', 'digital_arrest', [], '').slice(0, 4)).toEqual([
      'end_call',
      'verify_official',
      'report_1930',
      'warn_family',
    ]);
    expect(chooseActions('no_signs', null, [], 'Your HDFC Bank OTP')).toEqual([
      'no_action_needed',
      'verify_official',
    ]);
    expect(chooseActions('no_signs', null, [], 'See you at 5')).toEqual(['no_action_needed']);
    expect(
      chooseActions('suspicious', 'job_task', [sig('ASKS_REMOTE_APP')], '').length,
    ).toBeLessThanOrEqual(5);
  });

  it('links 1930, cybercrime.gov.in and Chakshu (suspected fraud communication only)', () => {
    expect(actionText('report_1930', 'en').href).toBe('tel:1930');
    expect(actionText('report_cybercrime_portal', 'en').href).toBe('https://cybercrime.gov.in');
    const chakshu = actionText('report_chakshu', 'en');
    expect(chakshu.href).toBe('https://sancharsaathi.gov.in/sfc/');
    expect(chakshu.body).toMatch(/suspicious/i);
  });
});
