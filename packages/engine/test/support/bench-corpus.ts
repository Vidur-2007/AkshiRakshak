/**
 * Benchmark corpus for analyze() (SPEC_A_ENGINE.md §14). Uses C's 200 validation texts from
 * packages/model/test/parity-fixtures.json when that file exists; until then, 200 synthetic
 * messages (four languages, scam and genuine, chats and emails, 40–2,000 characters). All
 * numbers, IDs and domains are obviously synthetic.
 */
import type { AnalyzeRequest, Lang } from '@akshi/contracts';

const FRAGMENTS: Record<Lang, { scam: string[]; genuine: string[] }> = {
  en: {
    scam: [
      'Dear Customer, your SBI account will be BLOCKED today due to pending KYC.',
      'Update KYC immediately at http://sbi-kyc-update.xyz/verify and share the OTP sent to you.',
      'You have won a cashback of ₹4,999. Enter your UPI PIN to receive the amount in your account.',
      'Your parcel is held at customs. Pay ₹1,250 clearance fee to refund.desk@okaxis now.',
      'Part-time job: earn ₹3,000 daily by liking videos. Pay ₹500 registration to start the task.',
      'This is the Cyber Crime department. A case is filed on your Aadhaar. Stay on the call and do not tell anyone.',
      'Electricity will be disconnected tonight at 9:30 pm. Call officer 98765 00001 immediately.',
      'Install AnyDesk so our executive can fix your refund. Download http://bit.ly/refund-help-x',
    ],
    genuine: [
      'Your order #A1234 has been shipped and will arrive on Tuesday.',
      'Hi, are we still meeting for lunch tomorrow at 1?',
      'Rs 450.00 debited from A/c XX1234 on 12-11-26 to Swiggy. Not you? Call the number on your card.',
      'Your OTP for login is 482913. Do not share it with anyone. Bank staff will never ask for it.',
      'Reminder: your electricity bill of ₹1,120 is due on 20 Nov. Pay on the official app.',
      'Happy birthday! Have a great year ahead.',
    ],
  },
  hi: {
    scam: [
      'आपका खाता आज बंद हो जाएगा, तुरंत KYC अपडेट करें।',
      'OTP बताएं वरना आपका खाता ब्लॉक हो जाएगा। किसी को मत बताना।',
      'आपने ₹5,000 का इनाम जीता है, पैसे पाने के लिए UPI PIN डालें।',
      'घर बैठे कमाएं ₹3,000 रोज़, बस ₹499 रजिस्ट्रेशन फीस भरें।',
      'Aapka khata band ho jayega, turant otp bhejo aur link par click karo http://kyc-hindi-update.xyz',
    ],
    genuine: [
      'कल शाम को घर पर मिलते हैं।',
      'आपका ऑर्डर भेज दिया गया है, मंगलवार तक पहुंचेगा।',
      'माँ, मैं ट्रेन में बैठ गया हूँ, रात को पहुँचूँगा।',
    ],
  },
  te: {
    scam: [
      'మీ ఖాతా ఈరోజే బ్లాక్ అవుతుంది. వెంటనే OTP చెప్పండి.',
      'మీకు ₹10,000 బహుమతి వచ్చింది, డబ్బు పొందడానికి UPI PIN నమోదు చేయండి.',
      'మీ పార్సెల్ కస్టమ్స్‌లో ఉంది, ₹1,500 చెల్లించండి 98765 00002 కు కాల్ చేయండి.',
      'ఇంటి నుండే రోజుకు ₹2,000 సంపాదించండి, ముందుగా ₹300 చెల్లించండి.',
    ],
    genuine: [
      'రేపు ఉదయం పది గంటలకు కలుద్దాం.',
      'మీ ఆర్డర్ పంపబడింది, గురువారం వస్తుంది.',
      'అమ్మా, నేను బస్సు ఎక్కాను.',
    ],
  },
  bn: {
    scam: [
      'আপনার অ্যাকাউন্ট আজই ব্লক হয়ে যাবে। এখনই OTP পাঠান।',
      'আপনি ₹৫,০০০ পুরস্কার জিতেছেন, টাকা পেতে UPI PIN দিন।',
      'কাউকে বলবেন না, এই লিঙ্কে KYC আপডেট করুন http://bn-kyc-update.xyz',
      'ঘরে বসে দিনে ₹২,০০০ আয় করুন, প্রথমে ₹৫০০ জমা দিন।',
    ],
    genuine: [
      'কাল সন্ধ্যায় দেখা হবে।',
      'আপনার অর্ডার পাঠানো হয়েছে, বৃহস্পতিবার পৌঁছাবে।',
      'মা, আমি ট্রেনে উঠেছি।',
    ],
  },
};

const LANGS: Lang[] = ['en', 'hi', 'te', 'bn'];
/** Skewed towards short messages, like real SMS and WhatsApp text. */
const LENGTHS = [40, 80, 120, 160, 220, 300, 450, 700, 1200, 2000];

function pick<T>(xs: readonly T[], i: number): T {
  return xs[i % xs.length]!;
}

function build(lang: Lang, scam: boolean, target: number, seed: number): string {
  const pool = scam
    ? [...FRAGMENTS[lang].scam, ...FRAGMENTS.en.scam.slice(0, 2)]
    : [...FRAGMENTS[lang].genuine, ...FRAGMENTS.en.genuine.slice(0, 2)];
  let t = '';
  for (let k = 0; t.length < target; k++) t += `${pick(pool, seed * 7 + k * 3)} `;
  return t.slice(0, Math.min(target, 2000)).trim();
}

export function syntheticCorpus(n = 200): AnalyzeRequest[] {
  const out: AnalyzeRequest[] = [];
  for (let i = 0; i < n; i++) {
    const lang = pick(LANGS, i);
    const scam = i % 3 !== 2;
    const target = pick(LENGTHS, Math.floor(i / 4) + i);
    if (i % 10 === 7) {
      const lines = Array.from(
        { length: 6 },
        (_, k) =>
          `${k % 2 ? 'You' : 'Ravi Sample'}: ${pick(k % 2 ? FRAGMENTS[lang].genuine : FRAGMENTS[lang][scam ? 'scam' : 'genuine'], i + k)}`,
      );
      out.push({ kind: 'chat', lang, text: lines.join('\n').slice(0, 2000) });
    } else if (i % 10 === 9) {
      const body = build(lang, scam, Math.min(target, 1500), i);
      out.push({
        kind: 'email',
        lang,
        text: `From: "Support Team" <alerts@${scam ? 'secure-refund-desk.xyz' : 'example.com'}>\nSubject: Account notice\n\n${body}`,
      });
    } else out.push({ kind: 'message', lang, text: build(lang, scam, target, i) });
  }
  return out;
}

/** C's validation texts when present (parity fixtures), else null. */
export async function validationCorpus(n = 200): Promise<AnalyzeRequest[] | null> {
  // absolute: a variable specifier is not resolved by Vite, and the file may not exist (stub model)
  const path = new URL('../../../model/test/parity-fixtures.json', import.meta.url).href;
  try {
    const mod = (await import(/* @vite-ignore */ path, { with: { type: 'json' } })) as {
      default?: unknown;
    };
    const raw = (mod.default ?? mod) as unknown;
    const rows = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as { cases?: unknown }).cases)
        ? (raw as { cases: unknown[] }).cases
        : [];
    const reqs = rows
      .map((r) => r as { text?: unknown; lang?: unknown })
      .filter((r) => typeof r.text === 'string' && r.text.length > 0)
      .slice(0, n)
      .map((r): AnalyzeRequest => ({
        kind: 'message',
        lang: LANGS.includes(r.lang as Lang) ? (r.lang as Lang) : 'en',
        text: (r.text as string).slice(0, 2000),
      }));
    return reqs.length >= 50 ? reqs : null;
  } catch {
    return null;
  }
}
