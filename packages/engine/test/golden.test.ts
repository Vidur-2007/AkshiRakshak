/**
 * Golden cases (SPEC_A_ENGINE.md §15). Written by Laptop A, separate from C's dataset.
 * Phase 1: rules + local link checks, no model, indicators off (bundled indicators are C's
 * and will change). "flagged" means scam or suspicious; Phase 2 tightens several to "scam".
 */
import {
  AnalysisResultSchema,
  type InputKind,
  type Lang,
  type ScamCategory,
  type SignalId,
} from '@akshi/contracts';
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/index';

interface Golden {
  name: string;
  lang: Lang;
  text: string;
  kind?: InputKind;
  expect: 'scam' | 'flagged' | 'no_signs';
  minScore?: number;
  signals?: SignalId[];
  absent?: SignalId[];
  category?: ScamCategory;
}

const GOLDEN: Golden[] = [
  // ── English ──
  {
    name: 'genuine HDFC-style OTP SMS with "do not share"',
    lang: 'en',
    text: '482913 is your OTP for a transaction of Rs 2,499.00 at AMAZON on your HDFC Bank card ending XX0000. Valid for 10 minutes. Do not share your OTP with anyone. If this was not you, report it in the official HDFC Bank app.',
    expect: 'no_signs',
    signals: ['SAFETY_ADVICE'],
    absent: ['ASKS_OTP'],
  },
  {
    name: 'genuine debit alert',
    lang: 'en',
    text: 'Rs 1,250.00 debited from A/c XX1234 on 12-11-26 to VPA swiggy.merchant@okaxis. UPI Ref 600000000001. Not you? Report it in your bank app or call the number on your card.',
    expect: 'no_signs',
  },
  {
    name: 'genuine delivery update with an official courier domain',
    lang: 'en',
    text: 'Your Amazon order has been shipped and will be delivered today by 9 PM. Track your package at https://www.amazon.in/progress-tracker',
    expect: 'no_signs',
  },
  {
    name: 'genuine bank safety advisory',
    lang: 'en',
    text: 'SBI never asks for your OTP, PIN or CVV. Never share them with anyone, even if the caller says they are from the bank.',
    expect: 'no_signs',
    absent: ['ASKS_OTP', 'ASKS_PIN', 'ASKS_CVV_PASSWORD'],
  },
  {
    name: '"accept the request to receive ₹5,000 refund"',
    lang: 'en',
    text: 'Your refund of ₹5,000 is approved. Accept the request and enter your UPI PIN to receive the amount in your account.',
    expect: 'scam',
    minScore: 85,
    signals: ['RECEIVE_WITH_PIN'],
    category: 'upi_collect',
  },
  {
    name: 'fake KYC block with OTP ask',
    lang: 'en',
    text: 'Dear SBI customer, your account will be blocked today. Update KYC immediately and share the OTP you received with our executive.',
    expect: 'flagged',
    signals: ['THREAT_BLOCK', 'ASKS_OTP', 'BANK_IMPERSONATION', 'URGENCY'],
    category: 'fake_kyc',
  },
  {
    name: 'fake customer care asking for AnyDesk',
    lang: 'en',
    text: 'This is Paytm customer care. To process your refund, download AnyDesk and share the 9 digit code. Call us on 98765 00009.',
    expect: 'flagged',
    signals: ['ASKS_REMOTE_APP', 'CUSTOMER_CARE_NUMBER'],
  },
  {
    name: 'bank-branded APK link',
    lang: 'en',
    text: 'Dear SBI customer, your reward points worth Rs 7,250 expire today. Install the SBI Rewards app from this link to redeem: http://sbi-rewards-points.top/SBI_Rewards.apk',
    expect: 'scam',
    minScore: 80,
    signals: ['APK_LINK', 'BANK_IMPERSONATION'],
    category: 'malicious_apk',
  },
  {
    name: 'KBC lottery with processing fee',
    lang: 'en',
    text: 'Congratulations! You have won Rs 25 lakh in the KBC lucky draw. Pay a processing fee of Rs 9,999 to claim your prize.',
    expect: 'flagged',
    signals: ['PRIZE_LOTTERY', 'ADVANCE_FEE'],
    category: 'lottery_prize',
  },
  {
    name: 'guaranteed daily returns',
    lang: 'en',
    text: 'Join our VIP trading group for guaranteed returns of 5% daily. Double your money in 30 days, limited time offer!',
    expect: 'flagged',
    signals: ['TOO_GOOD_RETURNS', 'URGENCY'],
    category: 'investment_crypto',
  },
  {
    name: '"sent by mistake, please return"',
    lang: 'en',
    text: 'Hello sir, I sent Rs 2,000 to your number by mistake. Please return it urgently, it was for my mother’s hospital bill.',
    expect: 'flagged',
    signals: ['WRONG_TRANSFER_RETURN'],
    category: 'wrong_transfer',
  },
  {
    name: 'electricity disconnection with a phone number',
    lang: 'en',
    text: 'Dear consumer, your electricity power will be disconnected tonight at 9:30 PM because your last month bill was not updated. Please call electricity officer immediately on 98765 00004.',
    expect: 'flagged',
    signals: ['THREAT_BLOCK', 'CUSTOMER_CARE_NUMBER', 'URGENCY'],
    category: 'bill_disconnection',
  },
  {
    name: 'obfuscated KYC block',
    lang: 'en',
    text: 'Your S B I a/c is bl0cked. Share O T P now to unblock.',
    expect: 'flagged',
    signals: ['OBFUSCATION', 'ASKS_OTP', 'THREAT_BLOCK'],
  },
  {
    name: '"do not share" followed by an OTP ask',
    lang: 'en',
    text: 'Do not share your OTP with anyone. Our bank officer will call you shortly, please tell him the OTP to verify your account.',
    expect: 'flagged',
    signals: ['ASKS_OTP'],
    absent: ['SAFETY_ADVICE'],
  },
  // ── Hindi ──
  {
    name: 'digital-arrest script in Hindi',
    lang: 'hi',
    text: 'मैं मुंबई साइबर क्राइम से इंस्पेक्टर शर्मा बोल रहा हूं। आपके आधार से एक पार्सल में ड्रग्स मिले हैं। आप डिजिटल अरेस्ट में हैं, कॉल मत काटना और किसी को मत बताना। केस बंद करने के लिए तुरंत पैसे भेजें, वरना गिरफ्तार हो जाएंगे।',
    expect: 'scam',
    signals: ['THREAT_LEGAL', 'STAY_ON_CALL', 'SECRECY', 'AUTHORITY_CLAIM'],
    category: 'digital_arrest',
  },
  {
    name: 'digital-arrest script in Hinglish',
    lang: 'hi',
    text: 'Main Mumbai cyber crime se inspector bol raha hoon. Aapke Aadhaar se parcel mein drugs mile hain, case darj hai. Call disconnect mat kijiye aur kisi ko mat batana, warna giraftar ho jaoge.',
    expect: 'scam',
    signals: ['THREAT_LEGAL', 'STAY_ON_CALL', 'SECRECY'],
    category: 'digital_arrest',
  },
  {
    name: 'digital arrest with a parcel and a "verification amount" (not courier_customs)',
    lang: 'hi',
    text: 'Main Mumbai Cyber Crime se Inspector Sharma bol raha hoon. Aapke Aadhaar se ek parcel mein drugs mile hain. Aap digital arrest mein hain, call disconnect mat kijiye aur kisi ko mat batana. Case band karne ke liye turant verification amount bhejo.',
    expect: 'scam',
    signals: ['THREAT_LEGAL', 'STAY_ON_CALL', 'ADVANCE_FEE'],
    category: 'digital_arrest',
  },
  {
    name: 'Hinglish KYC block with OTP ask',
    lang: 'hi',
    text: 'Aapka khata band ho jayega. Turant KYC update karein aur aaya hua OTP bhejo.',
    expect: 'flagged',
    signals: ['THREAT_BLOCK', 'ASKS_OTP'],
    category: 'fake_kyc',
  },
  {
    name: 'electricity disconnection in Hindi',
    lang: 'hi',
    text: 'प्रिय उपभोक्ता, आपका बिजली बिल बकाया है। आज रात 9:30 बजे आपकी बिजली काट दी जाएगी। तुरंत बिजली अधिकारी से 98765 00004 पर संपर्क करें।',
    expect: 'flagged',
    signals: ['THREAT_BLOCK', 'URGENCY', 'CUSTOMER_CARE_NUMBER'],
    category: 'bill_disconnection',
  },
  {
    name: 'genuine OTP SMS in Hindi',
    lang: 'hi',
    text: 'आपका OTP 482913 है। यह 10 मिनट के लिए मान्य है। OTP किसी को न बताएं। - SBI',
    expect: 'no_signs',
    signals: ['SAFETY_ADVICE'],
    absent: ['ASKS_OTP', 'SECRECY'],
  },
  {
    name: 'genuine debit alert in Hindi',
    lang: 'hi',
    text: 'आपके खाते XX1234 से ₹1,250 डेबिट हुए हैं। यदि यह लेनदेन आपने नहीं किया है, तो तुरंत बैंक को सूचित करें।',
    expect: 'no_signs',
  },
  // ── Telugu ──
  {
    name: 'part-time like-and-earn job in Telugu',
    lang: 'te',
    text: 'హలో! ఇంటి నుండే పార్ట్ టైమ్ ఉద్యోగం. యూట్యూబ్ వీడియోలకు లైక్ చేస్తే రోజుకు ₹2,000 సంపాదించండి. మొదటి టాస్క్ కోసం ₹500 రిజిస్ట్రేషన్ ఫీజు చెల్లించండి.',
    expect: 'flagged',
    signals: ['TASK_JOB_PAYMENT', 'ADVANCE_FEE'],
    category: 'job_task',
  },
  {
    name: 'KYC block with OTP ask in Telugu',
    lang: 'te',
    text: 'మీ SBI ఖాతా ఈరోజే బ్లాక్ అవుతుంది. వెంటనే KYC అప్డేట్ చేయండి, మీ ఫోన్ కు వచ్చిన OTP చెప్పండి.',
    expect: 'flagged',
    signals: ['THREAT_BLOCK', 'URGENCY', 'ASKS_OTP', 'BANK_IMPERSONATION'],
  },
  {
    name: 'electricity disconnection screenshot text in Telugu',
    lang: 'te',
    text: 'ప్రియమైన వినియోగదారుడా, మీ విద్యుత్ బిల్లు బకాయి ఉంది. ఈ రాత్రి 9:30 గంటలకు మీ కరెంట్ కనెక్షన్ నిలిపివేయబడుతుంది. వెంటనే విద్యుత్ అధికారికి 98765 00002 నంబరుకు కాల్ చేయండి.',
    expect: 'flagged',
    signals: ['THREAT_BLOCK', 'URGENCY', 'CUSTOMER_CARE_NUMBER'],
    category: 'bill_disconnection',
  },
  {
    name: 'genuine OTP SMS in Telugu',
    lang: 'te',
    text: 'మీ OTP 482913. దీన్ని ఎవరితోనూ పంచుకోవద్దు. - HDFC బ్యాంక్',
    expect: 'no_signs',
    signals: ['SAFETY_ADVICE'],
  },
  // ── Bengali ──
  {
    name: 'courier customs chat in Bengali',
    lang: 'bn',
    kind: 'chat',
    text: [
      '[12/11/26, 10:02] Swift Courier: নমস্কার, আপনার নামে একটি পার্সেল কাস্টমসে আটকে আছে।',
      '[12/11/26, 10:03] Rina: কোন পার্সেল? আমি তো কিছু অর্ডার করিনি।',
      '[12/11/26, 10:05] Swift Courier: পার্সেলে বেআইনি জিনিস পাওয়া গেছে। এখনই ₹12,500 কাস্টমস ফি না দিলে পুলিশ কেস হবে।',
      '[12/11/26, 10:08] Swift Courier: কাউকে বলবেন না, এটা গোপনীয় তদন্ত। আপনার ফোনে আসা OTP এখনই পাঠান।',
    ].join('\n'),
    expect: 'flagged',
    signals: ['THREAT_LEGAL', 'ADVANCE_FEE', 'SECRECY', 'ASKS_OTP'],
    category: 'courier_customs',
  },
  {
    name: 'wedding invitation APK in Bengali',
    lang: 'bn',
    text: 'আমাদের বিয়ের নিমন্ত্রণপত্র দেখতে এই অ্যাপটি ইনস্টল করুন: http://biye-card.site/Wedding_Card.apk',
    expect: 'flagged',
    signals: ['APK_LINK'],
    category: 'malicious_apk',
  },
  {
    name: 'KYC block with OTP ask in Bengali',
    lang: 'bn',
    text: 'প্রিয় SBI গ্রাহক, আপনার অ্যাকাউন্ট আজই ব্লক হয়ে যাবে। এখনই KYC আপডেট করুন এবং OTP পাঠান।',
    expect: 'flagged',
    signals: ['THREAT_BLOCK', 'ASKS_OTP', 'BANK_IMPERSONATION'],
  },
  {
    name: 'genuine OTP SMS in Bengali',
    lang: 'bn',
    text: 'আপনার OTP 482913। এটি কাউকে বলবেন না। কারও সাথে শেয়ার করবেন না।',
    expect: 'no_signs',
    absent: ['SECRECY'],
  },
];

describe('golden cases', () => {
  it('covers all four languages and at least 20 cases', () => {
    expect(GOLDEN.length).toBeGreaterThanOrEqual(20);
    expect(new Set(GOLDEN.map((g) => g.lang))).toEqual(new Set(['en', 'hi', 'te', 'bn']));
  });

  for (const g of GOLDEN) {
    it(`[${g.lang}] ${g.name}`, async () => {
      const r = AnalysisResultSchema.parse(
        await analyze({
          kind: g.kind ?? 'message',
          text: g.text,
          lang: g.lang,
          options: { layers: { indicators: false } },
        }),
      );
      const got = r.signals.map((s) => s.id);
      const why = `${r.verdict} ${r.riskScore} [${got.join(', ')}]`;
      if (g.expect === 'flagged') expect(r.verdict, why).not.toBe('no_signs');
      else expect(r.verdict, why).toBe(g.expect);
      if (g.minScore !== undefined) expect(r.riskScore, why).toBeGreaterThanOrEqual(g.minScore);
      for (const s of g.signals ?? []) expect(got, why).toContain(s);
      for (const s of g.absent ?? []) expect(got, why).not.toContain(s);
      if (g.category) expect(r.category, why).toBe(g.category);
      if (g.expect === 'no_signs') {
        expect(r.category).toBeNull();
        expect(r.actions[0]).toBe('no_action_needed');
      }
      for (const s of r.signals.flatMap((x) => x.spans))
        expect(r.text.slice(s.start, s.end)).toBe(s.text);
    });
  }
});
