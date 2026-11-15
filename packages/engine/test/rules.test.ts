import {
  LANGS,
  normalizeText,
  SCAM_CATEGORIES,
  SIGNAL_IDS,
  ACTION_IDS,
  STAGES,
  type SignalId,
} from '@akshi/contracts';
import { describe, expect, it } from 'vitest';
import { actionText, loadAllStrings, signalText } from '../src/i18n';
import { CATALOG } from '../src/rules/catalog';
import {
  deobfuscate,
  detectObfuscation,
  loadLexicons,
  matchRules,
  scriptOfString,
} from '../src/rules/engine';

const STRINGS = await loadAllStrings();
const LEXICONS = await loadLexicons();

const ids = (raw: string) =>
  matchRules(normalizeText(raw))
    .map((h) => h.id)
    .sort();
const spans = (raw: string, id: SignalId) =>
  matchRules(normalizeText(raw))
    .find((h) => h.id === id)
    ?.spans.map((s) => s.text) ?? [];

/** Signals with the most real-world variety; SPEC_A §5.1 targets ≥ 15 (en, hi) and ≥ 8 (te, bn). */
const MAJOR: SignalId[] = [
  'URGENCY',
  'THREAT_BLOCK',
  'THREAT_LEGAL',
  'AUTHORITY_CLAIM',
  'SECRECY',
  'ASKS_OTP',
  'ASKS_PIN',
  'ASKS_REMOTE_APP',
  'APK_LINK',
  'RECEIVE_WITH_PIN',
  'ADVANCE_FEE',
  'PRIZE_LOTTERY',
  'TOO_GOOD_RETURNS',
  'TASK_JOB_PAYMENT',
  'BANK_IMPERSONATION',
  'SAFETY_ADVICE',
];
const LEXICAL = SIGNAL_IDS.filter((id) => CATALOG[id].lexical);

describe('catalog (§5.2)', () => {
  it('has an entry for every SignalId with weight in −1..1', () => {
    for (const id of SIGNAL_IDS) {
      expect(CATALOG[id], id).toBeDefined();
      expect(Math.abs(CATALOG[id].weight)).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the specified floors', () => {
    expect(CATALOG.RECEIVE_WITH_PIN.floor?.score).toBe(85);
    expect(CATALOG.QR_TO_RECEIVE.floor?.score).toBe(85);
    expect(CATALOG.ASKS_PIN.floor?.score).toBe(85);
    expect(CATALOG.APK_LINK.floor?.score).toBe(80);
    expect(CATALOG.LOOKALIKE_DOMAIN.floor?.score).toBe(75);
    expect(CATALOG.KNOWN_INDICATOR.floor).toEqual({ score: 75, minReports: 3 });
    expect(CATALOG.BLOCKLISTED.floor?.score).toBe(80);
    expect(CATALOG.SAFETY_ADVICE.weight).toBeLessThan(0);
    expect(CATALOG.OFFICIAL_DOMAIN.weight).toBeLessThan(0);
  });
});

describe('lexicons (§5.1)', () => {
  it('cover every lexical signal in all four languages', () => {
    for (const lang of LANGS) {
      for (const id of LEXICAL) expect(LEXICONS[lang].signals[id], `${lang} ${id}`).toBeDefined();
    }
  });

  it('meet the phrase-count targets', () => {
    for (const lang of LANGS) {
      const min = lang === 'en' || lang === 'hi' ? 15 : 8;
      for (const id of MAJOR) {
        const e = LEXICONS[lang].signals[id];
        expect(
          (e?.phrases.length ?? 0) + (e?.regex.length ?? 0),
          `${lang} ${id}`,
        ).toBeGreaterThanOrEqual(min);
      }
    }
  });

  it('give Hindi both Devanagari and romanised phrases for every lexical signal', () => {
    for (const id of LEXICAL) {
      const scripts = new Set(LEXICONS.hi.signals[id]?.phrases.map(scriptOfString));
      expect(scripts.has('deva'), id).toBe(true);
      expect(scripts.has('latn') || (LEXICONS.hi.signals[id]?.regex.length ?? 0) > 0, id).toBe(
        true,
      );
    }
  });

  it('compile every regex (engine flags gi, and u-compatible)', () => {
    for (const lang of LANGS) {
      for (const e of Object.values(LEXICONS[lang].signals)) {
        for (const r of e.regex) {
          expect(() => new RegExp(r, 'gi')).not.toThrow();
          expect(() => new RegExp(r, 'giu')).not.toThrow();
          expect(
            r,
            `${lang}: lexicon regexes must not use \\p{…} (matchers run without the u flag)`,
          ).not.toMatch(/\\[pP]\{/);
        }
      }
    }
  });
});

describe('matching', () => {
  it('matches Latin phrases on word boundaries, case-insensitively', () => {
    expect(ids('Your account WILL BE BLOCKED')).toContain('THREAT_BLOCK');
    expect(ids('the pinnacle of shopping')).not.toContain('ASKS_PIN');
    expect(spans('Lottery! You have WON', 'PRIZE_LOTTERY')).toEqual(['Lottery', 'You have WON']);
  });

  it('matches Indic phrases as substrings after normalisation', () => {
    expect(ids('आपका खाता बंद हो जाएगा')).toContain('THREAT_BLOCK');
    expect(ids('మీ ఖాతా బ్లాక్ అవుతుంది')).toContain('THREAT_BLOCK');
    expect(ids('আপনার অ্যাকাউন্ট ব্লক হয়ে যাবে')).toContain('THREAT_BLOCK');
  });

  it('runs romanised Hindi on Latin text', () => {
    expect(ids('Aapka khata band ho jayega, otp batao')).toEqual(
      expect.arrayContaining(['THREAT_BLOCK', 'ASKS_OTP']),
    );
  });

  it('returns spans that index the normalised text', () => {
    const text = normalizeText('Dear SBI customer,  your  a/c will be BLOCKED. Share the OTP now!');
    for (const h of matchRules(text))
      for (const s of h.spans) expect(text.slice(s.start, s.end)).toBe(s.text);
  });
});

describe('SAFETY_ADVICE and negation', () => {
  it('fires on genuine wording in four languages', () => {
    expect(ids('Do not share your OTP with anyone.')).toEqual(['SAFETY_ADVICE']);
    expect(ids('OTP किसी को न बताएं।')).toEqual(['SAFETY_ADVICE']);
    expect(ids('OTP ని ఎవరికీ చెప్పవద్దు.')).toEqual(['SAFETY_ADVICE']);
    expect(ids('আপনার OTP 482913। এটি কাউকে বলবেন না।')).toEqual(['SAFETY_ADVICE']);
  });

  it('does not fire when the message also asks for the OTP', () => {
    const r = ids(
      'Do not share your OTP with anyone. Our officer will call you, tell him the OTP to verify.',
    );
    expect(r).toContain('ASKS_OTP');
    expect(r).not.toContain('SAFETY_ADVICE');
    expect(ids('OTP पंपండి')).not.toContain('SAFETY_ADVICE');
    const bn = ids('OTP পাঠান, কাউকে বলবেন না');
    expect(bn).toEqual(expect.arrayContaining(['ASKS_OTP', 'SECRECY']));
    expect(bn).not.toContain('SAFETY_ADVICE');
  });

  it('drops negated asks ("never install apps from unknown sources")', () => {
    expect(ids('Never install apps from unknown sources.')).not.toContain('APK_LINK');
    expect(ids('You do not need to enter your PIN to receive money.')).not.toContain(
      'RECEIVE_WITH_PIN',
    );
    expect(ids('Install this app from the link and enter your PIN to receive money.')).toEqual(
      expect.arrayContaining(['APK_LINK', 'RECEIVE_WITH_PIN']),
    );
  });

  it('keeps scammer secrecy when there is no genuine OTP advice', () => {
    expect(ids('यह बात किसी को मत बताना, यह गोपनीय जांच है')).toContain('SECRECY');
  });
});

describe('OBFUSCATION', () => {
  it('catches spaced-out key words', () => {
    expect(detectObfuscation(normalizeText('share O T P and K.Y.C')).map((s) => s.text)).toEqual([
      'O T P',
      'K.Y.C',
    ]);
  });

  it('catches digit-for-letter swaps in brand and key words', () => {
    expect(
      detectObfuscation('your acc0unt is bl0cked, pay via p4ytm, call SB1').map((s) => s.text),
    ).toEqual(['acc0unt', 'bl0cked', 'p4ytm', 'SB1']);
    expect(detectObfuscation('valid 24hrs on 4g, ref AB12CD, pay a1@ybl')).toEqual([]);
  });

  it('catches Cyrillic or Greek letters inside a Latin word', () => {
    const cyrillicA = String.fromCodePoint(0x0430);
    expect(detectObfuscation(`login to p${cyrillicA}ytm now`).map((s) => s.text)).toEqual([
      `p${cyrillicA}ytm`,
    ]);
    expect(detectObfuscation('OTPबताएं')).toEqual([]); // Latin + Devanagari typing is common, not flagged
  });

  it('de-obfuscates without changing length so spans stay valid', () => {
    const t = 'Your a/c is bl0cked, share 0TP';
    expect(deobfuscate(t)).toHaveLength(t.length);
    expect(ids(t)).toEqual(expect.arrayContaining(['THREAT_BLOCK', 'ASKS_OTP', 'OBFUSCATION']));
    expect(spans(t, 'ASKS_OTP')).toEqual(['share 0TP']);
  });
});

describe('engine strings (§13)', () => {
  it('has every signal, category, action and stage in all four languages', () => {
    for (const lang of LANGS) {
      const s = STRINGS[lang];
      for (const id of SIGNAL_IDS)
        expect(s.signals[id]?.label, `${lang} signal ${id}`).toBeTruthy();
      for (const id of SIGNAL_IDS)
        expect(s.signals[id]?.detail, `${lang} detail ${id}`).toBeTruthy();
      for (const c of SCAM_CATEGORIES)
        expect(s.categories[c]?.name && s.categories[c]?.oneLiner, `${lang} ${c}`).toBeTruthy();
      for (const a of ACTION_IDS)
        expect(s.actions[a]?.label && s.actions[a]?.body, `${lang} ${a}`).toBeTruthy();
      for (const st of STAGES) expect(s.stages[st], `${lang} ${st}`).toBeTruthy();
      for (const t of ['noSigns', 'reasons', 'listSep', 'genericLead'] as const)
        expect(s.templates[t], `${lang} ${t}`).toBeTruthy();
    }
  });

  it('marks non-English files for human review', () => {
    expect(STRINGS.hi._review).toBe('pending');
    expect(STRINGS.te._review).toBe('pending');
    expect(STRINGS.bn._review).toBe('pending');
  });

  it('never calls a message "safe" in English copy', () => {
    const all = JSON.stringify(STRINGS.en);
    expect(all).not.toMatch(/\bsafe\b/i);
  });

  it('returns localised text with hrefs where relevant', () => {
    expect(signalText('ASKS_OTP', 'hi').label).toBe('OTP मांगना');
    expect(actionText('report_1930', 'te').href).toBe('tel:1930');
    expect(actionText('report_chakshu', 'bn').href).toBe('https://sancharsaathi.gov.in/sfc/');
  });
});
