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

});

const LANGS3 = ['en', 'hi', 'te'] as const;
const has = (l: Partial<Record<string, string>>, langs: readonly string[]) =>
  langs.every((k) => typeof l[k] === 'string' && l[k]!.trim().length > 0);
const SCRIPT = { hi: /[ऀ-ॿ]/, te: /[ఀ-౿]/, bn: /[ঀ-৿]/ } as const;
/** Each translation is in its own script (catches an English string pasted into the Hindi slot). */
const inScript = (l: Partial<Record<string, string>>) =>
  (Object.keys(SCRIPT) as (keyof typeof SCRIPT)[]).every((k) => l[k] === undefined || SCRIPT[k].test(l[k]!));
const allText = (x: unknown): string[] =>
  typeof x === 'string' ? [x] : Array.isArray(x) ? x.flatMap(allText) : x && typeof x === 'object' ? Object.values(x).flatMap(allText) : [];

describe('FAQ', () => {
  it('has at least 30 items with unique ids, in all four languages', () => {
    expect(FAQ.length).toBeGreaterThanOrEqual(30);
    expect(new Set(FAQ.map((f) => f.id)).size).toBe(FAQ.length);
    for (const f of FAQ) {
      expect(has(f.q, ['en', 'hi', 'te', 'bn']), f.id).toBe(true);
      expect(has(f.a, ['en', 'hi', 'te', 'bn']), f.id).toBe(true);
      expect(inScript(f.q) && inScript(f.a), f.id).toBe(true);
      expect(f.tags.length).toBeGreaterThan(0);
    }
  });

  it('keeps the ids other packages refer to and covers the required topics', () => {
    const ids = new Set(FAQ.map((f) => f.id));
    for (const id of ['faq-pin-sends-money', 'faq-qr-receive', 'faq-bank-never-asks-otp', 'faq-digital-arrest', 'faq-how-to-report']) {
      expect(ids.has(id), id).toBe(true);
    }
    const en = FAQ.map((f) => f.q.en + ' ' + f.a.en).join(' ').toLowerCase();
    for (const topic of ['qr', 'pin', 'collect request', 'otp', '.bank.in', 'digital arrest', '.apk', 'anydesk', 'refund',
      'customer care', 'job', 'guarantee', 'mistake', '1930', 'cybercrime.gov.in', 'chakshu', 'in your browser']) {
      expect(en, topic).toContain(topic);
    }
  });

  it('follows the truth rules: no statistics and no promise that money comes back', () => {
    for (const s of allText(FAQ)) {
      expect(s).not.toMatch(/\d+\s?%|percent of|crore|lakh people/i);
      expect(s).not.toMatch(/\bguaranteed? (to )?(get|recover)/i);
    }
  });
});

describe('EMERGENCY', () => {
  it('asks the six questions in the order the web flow expects', () => {
    expect(EMERGENCY.questions.map((q) => q.id)).toEqual([
      'sent_money', 'entered_pin', 'shared_otp', 'installed_app', 'gave_remote_access', 'shared_card',
    ]);
    EMERGENCY.questions.forEach((q) => expect(has(q.text, ['en', 'hi', 'te', 'bn']) && inScript(q.text)).toBe(true));
  });

  it('has a step for every answer, the always steps, and Chakshu only when nothing was lost', () => {
    const always = EMERGENCY.steps.filter((s) => s.when === 'always');
    expect(always.map((s) => s.action?.value)).toEqual(['1930', 'https://cybercrime.gov.in']);
    for (const q of EMERGENCY.questions) {
      expect(EMERGENCY.steps.some((s) => Array.isArray(s.when) && s.when.includes(q.id)), q.id).toBe(true);
    }
    const noLoss = EMERGENCY.steps.filter((s) => s.when === 'no_loss');
    expect(noLoss).toHaveLength(1);
    expect(noLoss[0]!.action?.value).toBe('https://sancharsaathi.gov.in/sfc/');
    expect(noLoss[0]!.body.en).toContain('not for money already lost');
    expect(new Set(EMERGENCY.steps.map((s) => s.priority)).size).toBe(EMERGENCY.steps.length);
    expect(new Set(EMERGENCY.steps.map((s) => s.id)).size).toBe(EMERGENCY.steps.length);
    for (const s of EMERGENCY.steps) {
      expect(has(s.title, ['en', 'hi', 'te', 'bn']) && has(s.body, ['en', 'hi', 'te', 'bn']), s.id).toBe(true);
      expect(inScript(s.title) && inScript(s.body), s.id).toBe(true);
    }
  });

  it('gives the specific actions the spec asks for', () => {
    const body = (id: string) => EMERGENCY.steps.find((s) => s.id === id)!.body.en;
    expect(body('step-bank')).toMatch(/UTR/);
    expect(body('step-pin')).toMatch(/Change your UPI PIN/);
    expect(body('step-app')).toMatch(/airplane mode.*Uninstall.*Accessibility.*display over other apps/s);
    expect(body('step-remote')).toMatch(/uninstall the remote-access app/i);
    expect(body('step-card')).toMatch(/Block the card/);
    expect(EMERGENCY.evidenceChecklist.map((e) => e.en).join(' ')).toMatch(/Screenshots.*phone numbers.*UPI IDs.*Links.*Transaction IDs/s);
  });
});

describe('DRILLS', () => {
  it('has six drills in English, Hindi and Telugu, with unique ids and the collect drill first', () => {
    expect(DRILLS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(DRILLS.map((d) => d.id)).size).toBe(DRILLS.length);
    expect(DRILLS[0]!.id).toBe('drill-collect-refund');
    expect(new Set(DRILLS.map((d) => d.category)).size).toBe(DRILLS.length);
  });

  it.each(DRILLS.map((d) => [d.id, d] as const))('%s is a well-formed game', (_id, d) => {
    const nodes = Object.values(d.nodes);
    expect(nodes.length).toBeGreaterThanOrEqual(5);
    expect(nodes.length).toBeLessThanOrEqual(9);
    expect(d.langs).toEqual(expect.arrayContaining([...LANGS3]));
    expect(has(d.title, LANGS3) && inScript(d.title)).toBe(true);
    expect(d.nodes[d.start]).toBeDefined();

    const choiceIds = new Set<string>();
    let redFlags = 0;
    for (const [key, n] of Object.entries(d.nodes)) {
      expect(n.id).toBe(key);
      expect(has(n.text, LANGS3) && inScript(n.text), n.id).toBe(true);
      if (n.end) {
        expect(n.choices ?? []).toEqual([]);
        continue;
      }
      expect(n.choices!.length, n.id).toBeGreaterThanOrEqual(2);
      expect(n.choices!.length, n.id).toBeLessThanOrEqual(3);
      for (const c of n.choices!) {
        expect(choiceIds.has(c.id), c.id).toBe(false);
        choiceIds.add(c.id);
        expect(d.nodes[c.next], c.id + ' → ' + c.next).toBeDefined();
        expect(has(c.text, LANGS3) && has(c.feedback, LANGS3), c.id).toBe(true);
        expect(inScript(c.text) && inScript(c.feedback), c.id).toBe(true);
        expect(c.points).toBeGreaterThanOrEqual(0);
        if (c.redFlag) redFlags++;
      }
    }
    expect(redFlags).toBeGreaterThan(0);

    // every node is reachable, and both endings can be reached
    const seen = new Set<string>();
    const walk = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      d.nodes[id]!.choices?.forEach((c) => walk(c.next));
    };
    walk(d.start);
    expect([...seen].sort()).toEqual(Object.keys(d.nodes).sort());
    const ends = new Set(nodes.filter((n) => n.end).map((n) => n.end));
    expect(ends).toEqual(new Set(['safe', 'scammed']));

    // no cycles: every path ends
    const depth = (id: string, path: string[]): number => {
      expect(path.includes(id), 'cycle at ' + id).toBe(false);
      const n = d.nodes[id]!;
      return n.end ? 0 : 1 + Math.max(...n.choices!.map((c) => depth(c.next, [...path, id])));
    };
    expect(depth(d.start, [])).toBeLessThanOrEqual(5);

    // the best-scoring path ends safe, and every choice that leads straight to "scammed" scores 0
    for (const n of nodes) {
      for (const c of n.choices ?? []) {
        if (d.nodes[c.next]!.end === 'scammed') expect(c.points, c.id).toBe(0);
      }
      if (n.choices) {
        const best = n.choices.reduce((a, b) => (b.points > a.points ? b : a));
        expect(d.nodes[best.next]!.end, n.id).not.toBe('scammed');
      }
    }
  });
});

describe('PATTERN_CARDS', () => {
  it('has at least four cards for different scams, in four languages, with no statistics', () => {
    expect(PATTERN_CARDS.length).toBeGreaterThanOrEqual(4);
    expect(new Set(PATTERN_CARDS.map((p) => p.category)).size).toBe(PATTERN_CARDS.length);
    for (const p of PATTERN_CARDS) {
      expect(has(p.title, ['en', 'hi', 'te', 'bn']) && has(p.body, ['en', 'hi', 'te', 'bn']), p.id).toBe(true);
      expect(inScript(p.title) && inScript(p.body), p.id).toBe(true);
      if (!p.sourceUrl) for (const s of allText([p.title, p.body])) expect(s).not.toMatch(/\d/);
    }
  });
});

describe('EVAL_REPORT', () => {
  it('is the harness output, and says so when the engine was a placeholder', () => {
    expect(EVAL_REPORT.notes.join(' ')).not.toContain('PLACEHOLDER — Phase 0 fixture');
    expect(EVAL_REPORT.datasets.map((d) => d.name)).toContain('synthetic-test');
    if (/stub/.test(EVAL_REPORT.engineVersion)) expect(EVAL_REPORT.notes[0]).toContain('NOT A MEASUREMENT');
    expect(EVAL_REPORT.notes.join(' ')).toContain('synthetic');
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
