/**
 * Fixes from C's validation error analysis (docs/eval-notes.md, "For A", model 2026.11.18-a).
 * The sentences here are A's own, written in the same patterns as the misses, so the validation
 * rows stay a fair check. Each fix also has a guard in the other direction.
 */
import { normalizeText, type SignalId } from '@akshi/contracts';
import { describe, expect, it } from 'vitest';
import { extractEntities } from '../src/extract/entities';
import { analyze } from '../src/index';
import { isNegated, matchRules } from '../src/rules/engine';

const OFF = { expandLinks: false, domainAge: false, layers: { indicators: false } } as const;
const ids = (raw: string) => new Set(matchRules(normalizeText(raw)).map((h) => h.id));
const has = (raw: string, id: SignalId) => ids(raw).has(id);

describe('negation and safety advice in Telugu and Bengali (eval-notes 1–3)', () => {
  it('bank advisories that say "never asks" / "not needed" raise no ask', async () => {
    for (const t of [
      // "To receive money you do not need to scan a QR or enter your UPI PIN. – Sample Bank"
      'డబ్బు అందుకోవడానికి క్యూఆర్ స్కాన్ చేయడం లేదా యూపీఐ పిన్ ఎంటర్ చేయడం అవసరం లేదు. -శాంపిల్ బ్యాంక్',
      // "Sample Bank never asks for your OTP, PIN or password by phone. Don't tell them to anyone."
      'శాంపిల్ బ్యాంక్ ఎప్పుడూ ఫోన్ ద్వారా మీ ఓటీపీ, పిన్ లేదా పాస్‌వర్డ్ అడగదు. వాటిని ఎవరికీ చెప్పకండి.',
      // Bengali: "The bank never asks for your PIN or OTP. Don't tell them to anyone."
      'ব্যাংক কখনও আপনার পিন বা ওটিপি চায় না। এগুলো কাউকে বলবেন না।',
    ]) {
      const found = ids(t);
      for (const id of ['ASKS_OTP', 'ASKS_PIN', 'ASKS_CVV_PASSWORD', 'SECRECY'] as const)
        expect(found.has(id), `${id} in ${t}`).toBe(false);
      const r = await analyze({ kind: 'message', text: t, lang: 'te', options: OFF });
      expect(r.verdict, t).toBe('no_signs');
    }
  });

  it('real asks and threats stay flagged', () => {
    // "Tell your OTP now, otherwise the account is blocked" — లేకపోతే is "otherwise", not "not"
    expect(has('మీ ఓటీపీ వెంటనే చెప్పండి, లేకపోతే ఖాతా బ్లాక్ అవుతుంది', 'ASKS_OTP')).toBe(true);
    // a scammer's bare "don't tell anyone" is still secrecy
    expect(has('ఈ విషయం ఎవరికీ చెప్పకండి, వెంటనే డబ్బు పంపండి', 'SECRECY')).toBe(true);
    // a conditional is a threat: "if you don't give …" is not negation
    const text = 'ওটিপি না দিলে অ্যাকাউন্ট বন্ধ হবে';
    const at = text.indexOf('ওটিপি');
    expect(isNegated(text, { start: at, end: at + 'ওটিপি'.length, text: 'ওটিপি' })).toBe(false);
    for (const hi of ['OTP नहीं दिया तो खाता बंद हो जाएगा', 'OTP बताओ नहीं तो खाता बंद']) {
      const i = hi.indexOf('OTP');
      expect(isNegated(hi, { start: i, end: i + 3, text: 'OTP' }), hi).toBe(false);
    }
    // real negation still counts: "never share the OTP with anyone"
    const adv = 'OTP किसी को न बताएं';
    expect(isNegated(adv, { start: 0, end: 3, text: 'OTP' })).toBe(false); // handled by SAFETY_ADVICE
    expect(has('बैंक कभी नहीं मांगता OTP, किसी को न बताएं', 'SAFETY_ADVICE')).toBe(true);
  });
});

describe('UPI ID before a full stop (eval-notes 9)', () => {
  it('extracts the ID at the end of a sentence; an email stays an email', () => {
    const upi = extractEntities(
      normalizeText('Send Rs.1,700 to sample.task.reward@ibl. All members done.'),
    );
    expect(upi.upiIds.map((u) => u.raw)).toEqual(['sample.task.reward@ibl']);
    const danda = extractEntities(normalizeText('₹500 sample.pay@okaxis। जल्दी करें'));
    expect(danda.upiIds.map((u) => u.raw)).toEqual(['sample.pay@okaxis']);
    const mail = extractEntities(normalizeText('Write to ravi.sample@gmail.com. Thanks'));
    expect(mail.upiIds).toEqual([]);
    expect(mail.emails.length).toBe(1);
  });
});

describe('phrase gaps (eval-notes 4–16)', () => {
  it.each<[string, SignalId[]]>([
    ['A code came to your phone by mistake, please send me that code fast.', ['ASKS_OTP']],
    ['Reply with the OTP today to avoid account blocking.', ['ASKS_OTP', 'THREAT_BLOCK']],
    [
      'To get the bonus of Rs 5,000 scan this QR and approve, the money will come to you.',
      ['QR_TO_RECEIVE'],
    ],
    [
      'Your refund QR is ready, scan it and confirm with P.I.N to credit Rs 9,000.',
      ['QR_TO_RECEIVE'],
    ],
    [
      'Your funds are frozen. Recharge Rs 3,000 to withdraw before 5 PM.',
      ['TASK_JOB_PAYMENT', 'ADVANCE_FEE', 'URGENCY'],
    ],
    ['To withdraw your salary you must finish the combo task first.', ['TASK_JOB_PAYMENT']],
    [
      'Bhai galat number pe 8,000 chala gaya, request bheji hai accept karke PIN daal do.',
      ['WRONG_TRANSFER_RETURN', 'RECEIVE_WITH_PIN'],
    ],
    [
      'ఇది రహస్య కేసు. కెమెరా ఆన్‌లో ఉంచండి. కాల్ కట్ చేస్తే పోలీసులు మీ ఇంటికి వస్తారు.',
      ['SECRECY', 'STAY_ON_CALL', 'THREAT_LEGAL'],
    ],
    ['విత్‌డ్రా చేయడానికి ముందు సర్వీస్ ఛార్జ్ కట్టాలి, లేకపోతే ఖాతా ఫ్రీజ్ అవుతుంది.', ['ADVANCE_FEE', 'THREAT_BLOCK']],
    ['ఈరోజు పెట్టుబడి పెడితే మూడు రెట్లు ఖాయం.', ['TOO_GOOD_RETURNS']],
    [
      'লোন বকেয়া। ৩ ঘণ্টার মধ্যে টাকা না দিলে আপনার ছবি সব কন্টাক্টে পাঠিয়ে দেওয়া হবে।',
      ['THREAT_LEGAL', 'URGENCY'],
    ],
    ['আপনার ফান্ড আটকে গেছে, তুলতে হলে আজ 500 টাকা রিচার্জ করুন।', ['TASK_JOB_PAYMENT', 'ADVANCE_FEE']],
  ])('%s', (text, expected) => {
    const found = ids(text);
    for (const id of expected) expect(found.has(id), id).toBe(true);
  });

  it('the Bengali loan threat is a loan_app scam', async () => {
    const r = await analyze({
      kind: 'message',
      text: 'লোন বকেয়া। ৩ ঘণ্টার মধ্যে টাকা না দিলে আপনার ছবি সব কন্টাক্টে পাঠিয়ে দেওয়া হবে।',
      lang: 'bn',
      options: OFF,
    });
    expect(r.verdict).not.toBe('no_signs');
    expect(r.category).toBe('loan_app');
  });

  it('genuine look-alikes stay clear', () => {
    // a genuine OTP SMS mentions a 6-digit code but asks nobody to send it
    expect(
      has('123456 is your 6 digit code for login. Do not share it with anyone.', 'ASKS_OTP'),
    ).toBe(false);
    // a mobile recharge confirmation is not a task-job fee
    expect(has('Recharge of Rs 299 successful. Validity 28 days.', 'ADVANCE_FEE')).toBe(false);
    expect(has('Recharge of Rs 299 successful. Validity 28 days.', 'TASK_JOB_PAYMENT')).toBe(false);
  });
});
