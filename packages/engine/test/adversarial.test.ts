/**
 * Adversarial evasions (Phase 7, plan item 1–2). Scammers disguise the words a filter looks for:
 * "Sh@re y0ur 0TP", "S H A R E your O.T.P.", Cyrillic letters, zero-width characters, repeated
 * letters. Each base scam names the words a scammer would disguise; every transform is applied to
 * those words only, and the scam's main signal must still fire. Genuine messages get the same
 * transforms and must never become "scam".
 *
 * The per-transform catch rate is printed, and the measured numbers are in docs/progress/engine.md.
 */
import type { Lang, SignalId } from '@akshi/contracts';
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/index';

interface Base {
  name: string;
  lang: Lang;
  text: string;
  /** words a scammer would disguise (must appear verbatim in text) */
  disguise: string[];
  signal: SignalId;
}

const SCAMS: Base[] = [
  {
    name: 'OTP ask',
    lang: 'en',
    text: 'Dear customer, your account will be blocked today. Share your OTP with our officer to continue.',
    disguise: ['Share', 'OTP'],
    signal: 'ASKS_OTP',
  },
  {
    name: 'PIN to receive refund',
    lang: 'en',
    text: 'Your refund of Rs 4,999 is ready. Enter your UPI PIN to receive the money now.',
    disguise: ['PIN', 'receive'],
    signal: 'RECEIVE_WITH_PIN',
  },
  {
    name: 'KYC block',
    lang: 'en',
    text: 'Your SBI account will be blocked today due to pending KYC. Update KYC immediately.',
    disguise: ['blocked', 'KYC'],
    signal: 'THREAT_BLOCK',
  },
  {
    name: 'remote app',
    lang: 'en',
    text: 'To get your refund please install AnyDesk and share the code with our support team.',
    disguise: ['AnyDesk'],
    signal: 'ASKS_REMOTE_APP',
  },
  {
    name: 'CVV ask',
    lang: 'en',
    text: 'To stop the fraud transaction, tell me your card CVV and expiry date right now.',
    disguise: ['CVV'],
    signal: 'ASKS_CVV_PASSWORD',
  },
  {
    name: 'lottery',
    lang: 'en',
    text: 'Congratulations! You have won a lottery of Rs 25 lakh. Pay the processing fee to claim your prize.',
    disguise: ['lottery', 'prize'],
    signal: 'PRIZE_LOTTERY',
  },
  {
    name: 'digital arrest secrecy',
    lang: 'en',
    text: 'This is a confidential police investigation. Do not tell your family about this call.',
    disguise: ['police', 'confidential'],
    signal: 'SECRECY',
  },
  {
    name: 'Hinglish OTP ask',
    lang: 'hi',
    text: 'Aapka account block ho jayega. Abhi apna OTP bataiye.',
    disguise: ['OTP'],
    signal: 'ASKS_OTP',
  },
  {
    name: 'Hinglish PIN to receive',
    lang: 'hi',
    text: 'Paise receive karne ke liye apna UPI PIN dalo.',
    disguise: ['PIN'],
    // the rules call this ASKS_PIN, not RECEIVE_WITH_PIN (lexicon gap, noted in progress/engine.md)
    signal: 'ASKS_PIN',
  },
  {
    name: 'Hindi OTP ask',
    lang: 'hi',
    text: 'आपका खाता बंद हो जाएगा। तुरंत अपना OTP बताएं।',
    disguise: ['OTP'],
    signal: 'ASKS_OTP',
  },
  {
    name: 'Telugu OTP ask',
    lang: 'te',
    text: 'మీ ఖాతా బ్లాక్ అవుతుంది. వెంటనే మీ OTP చెప్పండి.',
    disguise: ['OTP'],
    signal: 'ASKS_OTP',
  },
  {
    name: 'Bengali OTP ask',
    lang: 'bn',
    text: 'আপনার অ্যাকাউন্ট বন্ধ হয়ে যাবে। এখনই আপনার OTP বলুন।',
    disguise: ['OTP'],
    signal: 'ASKS_OTP',
  },
];

const GENUINE: Base[] = [
  {
    name: 'bank OTP with "do not share"',
    lang: 'en',
    text: '482913 is your OTP for a transaction of Rs 2,499.00 at AMAZON on your HDFC Bank card ending XX0000. Do not share your OTP with anyone.',
    disguise: ['OTP', 'share'],
    signal: 'SAFETY_ADVICE',
  },
  {
    name: 'debit alert',
    lang: 'en',
    text: 'Rs 1,250.00 debited from your account XX0000 on 12-11-26 by UPI. If not done by you, call the number on your card.',
    disguise: ['debited', 'UPI'],
    signal: 'SAFETY_ADVICE',
  },
  {
    name: 'bank safety advisory',
    lang: 'en',
    text: 'Your bank never asks for your PIN, OTP or CVV. Never share them with anyone, even if they say they are from the bank.',
    disguise: ['PIN', 'OTP', 'CVV'],
    signal: 'SAFETY_ADVICE',
  },
  {
    name: 'Hindi OTP with "do not share"',
    lang: 'hi',
    text: '482913 आपका OTP है। यह OTP किसी को न बताएं।',
    disguise: ['OTP'],
    signal: 'SAFETY_ADVICE',
  },
];

const CYRILLIC: Readonly<Record<string, string>> = {
  a: 'а',
  e: 'е',
  o: 'о',
  p: 'р',
  c: 'с',
  x: 'х',
  y: 'у',
  A: 'А',
  E: 'Е',
  O: 'О',
  P: 'Р',
  C: 'С',
  T: 'Т',
  K: 'К',
  H: 'Н',
  M: 'М',
  B: 'В',
  X: 'Х',
};
const LEET: Readonly<Record<string, string>> = {
  o: '0',
  O: '0',
  a: '@',
  A: '4',
  i: '1',
  I: '1',
  e: '3',
  E: '3',
  s: '$',
  S: '5',
};

type Transform = (word: string) => string;
const letters = (w: string) => [...w];
const TRANSFORMS: Readonly<Record<string, Transform>> = {
  leet: (w) =>
    letters(w)
      .map((c) => LEET[c] ?? c)
      .join(''),
  spaced: (w) => letters(w).join(' '),
  dotted: (w) => `${letters(w).join('.')}.`,
  starred: (w) => letters(w).join('*'),
  zeroWidth: (w) => letters(w).join('​'),
  homoglyph: (w) =>
    letters(w)
      .map((c) => CYRILLIC[c] ?? c)
      .join(''),
  mixedCase: (w) =>
    letters(w)
      .map((c, i) => (i % 2 ? c.toLowerCase() : c.toUpperCase()))
      .join(''),
  repeated: (w) =>
    letters(w)
      .map((c, i) => (i === letters(w).length - 1 ? c.repeat(4) : c))
      .join(''),
  emoji: (w) => letters(w).join('🔥'),
};

function disguise(b: Base, t: Transform): string {
  let text = b.text;
  for (const word of b.disguise) text = text.split(word).join(t(word));
  return text;
}

async function run(text: string, lang: Lang) {
  return analyze({
    kind: 'message',
    text,
    lang,
    options: { expandLinks: false, domainAge: false, layers: { indicators: false } },
  });
}

describe('adversarial evasions', () => {
  it('every base scam is caught before any disguise', async () => {
    for (const b of SCAMS) {
      const r = await run(b.text, b.lang);
      expect(
        r.signals.map((s) => s.id),
        b.name,
      ).toContain(b.signal);
      expect(r.verdict, b.name).not.toBe('no_signs');
    }
  });

  it('still finds the main signal under every disguise', async () => {
    const rows: string[] = [];
    const misses: string[] = [];
    let caught = 0;
    let total = 0;
    for (const [name, t] of Object.entries(TRANSFORMS)) {
      let ok = 0;
      for (const b of SCAMS) {
        const text = disguise(b, t);
        const r = await run(text, b.lang);
        const hit = r.signals.some((s) => s.id === b.signal) && r.verdict !== 'no_signs';
        if (hit) ok++;
        else
          misses.push(
            `${name} · ${b.name}: ${r.verdict} [${r.signals.map((s) => s.id).join(', ')}]`,
          );
        for (const s of r.signals.flatMap((x) => x.spans))
          expect(r.text.slice(s.start, s.end), `${name} · ${b.name}`).toBe(s.text);
      }
      caught += ok;
      total += SCAMS.length;
      rows.push(`${name.padEnd(10)} ${ok}/${SCAMS.length}`);
    }
    console.log(`adversarial catch rate ${caught}/${total}\n${rows.join('\n')}`);
    if (misses.length) console.log(`misses:\n${misses.join('\n')}`);
    expect(misses).toEqual([]);
  });

  it('reads a fully spaced-out sentence word by word, with spans on the original letters', async () => {
    const text = 'S H A R E Y O U R O T P now or your account will be blocked';
    const r = await run(text, 'en');
    const otp = r.signals.find((s) => s.id === 'ASKS_OTP');
    expect(otp, r.signals.map((s) => s.id).join(', ')).toBeDefined();
    for (const s of otp!.spans) expect(text.slice(s.start, s.end)).toBe(s.text);
    expect(otp!.spans[0]!.text.startsWith('S H A R E')).toBe(true);
  });

  it('leaves ordinary single letters and initials alone', async () => {
    const r = await run('I am at a bank in A. K. Nagar. Plan B is fine.', 'en');
    expect(r.verdict).toBe('no_signs');
  });

  it('never turns a disguised genuine message into a scam', async () => {
    const wrong: string[] = [];
    for (const [name, t] of Object.entries(TRANSFORMS)) {
      for (const b of GENUINE) {
        const r = await run(disguise(b, t), b.lang);
        if (r.verdict === 'scam')
          wrong.push(
            `${name} · ${b.name}: ${r.riskScore} [${r.signals.map((s) => s.id).join(', ')}]`,
          );
      }
    }
    if (wrong.length) console.log(`genuine → scam:\n${wrong.join('\n')}`);
    expect(wrong).toEqual([]);
  });
});
