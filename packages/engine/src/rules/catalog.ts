/**
 * Signal catalog (SPEC_A_ENGINE.md §5.2): weight, floor and category hint per signal.
 * Initial weights; C's evaluation informs changes. One typed table, keyed by every SignalId.
 */
import type { ScamCategory, SignalId } from '@akshi/contracts';

export type SignalLayer = 'rules' | 'links' | 'upi' | 'indicators' | 'model' | 'ai';

export interface Floor {
  /** minimum final risk score when this signal fires */
  score: number;
  /** floor applies only if at least one of these signals also fired */
  requiresAny?: readonly SignalId[];
  /** floor applies only if a matched indicator has at least this many reports */
  minReports?: number;
}

export interface CatalogEntry {
  /** contribution −1..1; negative reduces risk */
  weight: number;
  /** category hint (§8.4 step 3), or null for "—" */
  category: ScamCategory | null;
  /** which fusion layer the signal belongs to */
  layer: SignalLayer;
  floor?: Floor;
  /** true when the signal is found by the lexicons (has phrases in rules/lexicons/*.json) */
  lexical: boolean;
}

const RECEIVE_WORDING: readonly SignalId[] = [
  'RECEIVE_WITH_PIN',
  'QR_TO_RECEIVE',
  'PRIZE_LOTTERY',
  'WRONG_TRANSFER_RETURN',
  'COLLECT_REQUEST',
];
const OFFICIAL_CLAIM: readonly SignalId[] = [
  'BANK_IMPERSONATION',
  'AUTHORITY_CLAIM',
  'BRAND_MISMATCH',
  'THREAT_BLOCK',
];

const rule = (weight: number, category: ScamCategory | null, floor?: Floor): CatalogEntry =>
  floor
    ? { weight, category, layer: 'rules', lexical: true, floor }
    : { weight, category, layer: 'rules', lexical: true };
const link = (weight: number, category: ScamCategory | null, floor?: Floor): CatalogEntry =>
  floor
    ? { weight, category, layer: 'links', lexical: false, floor }
    : { weight, category, layer: 'links', lexical: false };

export const CATALOG: Readonly<Record<SignalId, CatalogEntry>> = {
  // language and pressure
  URGENCY: rule(0.15, null),
  THREAT_BLOCK: rule(0.25, 'fake_kyc'), // also bill_disconnection; see CATEGORY_CONTEXT
  THREAT_LEGAL: rule(0.3, 'digital_arrest'),
  AUTHORITY_CLAIM: rule(0.15, 'impersonation_govt'),
  SECRECY: rule(0.25, 'digital_arrest'),
  STAY_ON_CALL: rule(0.35, 'digital_arrest'),
  // credential and payment asks
  // Floor 45 (not in §5.2): a message that asks for an OTP must never read "No warning signs found".
  // ASKS_PIN/CVV/REMOTE_APP already reach ≥ 45 by weight alone.
  ASKS_OTP: rule(0.35, 'otp_theft', { score: 45 }),
  ASKS_PIN: rule(0.55, 'upi_collect', { score: 85, requiresAny: RECEIVE_WORDING }),
  ASKS_CVV_PASSWORD: rule(0.45, 'phishing_link'),
  ASKS_REMOTE_APP: rule(0.5, 'remote_access'),
  APK_LINK: rule(0.55, 'malicious_apk', { score: 80, requiresAny: OFFICIAL_CLAIM }),
  RECEIVE_WITH_PIN: rule(0.7, 'upi_collect', { score: 85 }),
  COLLECT_REQUEST: rule(0.2, 'upi_collect'),
  QR_TO_RECEIVE: rule(0.65, 'qr_receive', { score: 85 }),
  ADVANCE_FEE: rule(0.35, 'job_task'), // also loan_app; see CATEGORY_CONTEXT
  // lures
  PRIZE_LOTTERY: rule(0.35, 'lottery_prize'),
  TOO_GOOD_RETURNS: rule(0.35, 'investment_crypto'),
  TASK_JOB_PAYMENT: rule(0.35, 'job_task'),
  WRONG_TRANSFER_RETURN: rule(0.4, 'wrong_transfer'),
  CUSTOMER_CARE_NUMBER: rule(0.25, 'fake_customer_care'),
  // identity
  BANK_IMPERSONATION: rule(0.2, 'fake_kyc'),
  BRAND_MISMATCH: link(0.45, 'phishing_link'),
  UPI_NAME_MISMATCH: { weight: 0.4, category: 'qr_receive', layer: 'upi', lexical: false },
  PERSONAL_UPI_HANDLE: { weight: 0.15, category: null, layer: 'upi', lexical: false },
  REPLY_TO_MISMATCH: { weight: 0.3, category: 'phishing_link', layer: 'rules', lexical: false },
  // links and files
  SUSPICIOUS_LINK: link(0.2, 'phishing_link'),
  LOOKALIKE_DOMAIN: link(0.55, 'phishing_link', { score: 75, requiresAny: OFFICIAL_CLAIM }),
  SHORTENED_URL: link(0.15, null),
  IP_URL: link(0.4, 'phishing_link'),
  RISKY_TLD: link(0.15, null),
  PUNYCODE: link(0.4, 'phishing_link'),
  NEW_DOMAIN: link(0.35, 'phishing_link'), // 0.45 when < 30 days (set by the links stage)
  REDIRECT_CHAIN: link(0.1, null),
  RISKY_ATTACHMENT: { weight: 0.4, category: 'malicious_apk', layer: 'rules', lexical: false },
  PREFILLED_AMOUNT: { weight: 0.1, category: 'qr_receive', layer: 'upi', lexical: false },
  OBFUSCATION: { weight: 0.15, category: null, layer: 'rules', lexical: false },
  // context
  ESCALATION: { weight: 0.2, category: null, layer: 'rules', lexical: false },
  KNOWN_INDICATOR: {
    weight: 0.6,
    category: null,
    layer: 'indicators',
    lexical: false,
    floor: { score: 75, minReports: 3 },
  },
  BLOCKLISTED: {
    weight: 0.7,
    category: null,
    layer: 'indicators',
    lexical: false,
    floor: { score: 80 },
  },
  // layers
  MODEL_PATTERN: { weight: 0, category: null, layer: 'model', lexical: false },
  AI_FLAG: { weight: 0, category: null, layer: 'ai', lexical: false },
  // risk-reducing
  SAFETY_ADVICE: rule(-0.3, null),
  OFFICIAL_DOMAIN: link(-0.25, null),
};

/**
 * Secondary category hints (§8.4 step 3 refinement): when the top signal fires together with
 * one of `withAny`, or the text matches `textAny`, the hint switches to `category`.
 * Checked in order; first match wins.
 */
export interface CategoryContext {
  when: SignalId;
  withAny?: readonly SignalId[];
  textAny?: RegExp;
  category: ScamCategory;
}

const UTILITY_WORDS =
  /electricity|power cut|power supply|bijli|bijlee|light bill|gas connection|बिजली|विद्युत|బిల్లు|విద్యుత్|కరెంట్|বিদ্যুৎ|বিদ্যুতের|ইলেকট্রিক/iu;
const PARCEL_WORDS =
  /parcel|courier|customs|fedex|dtdc|पार्सल|कूरियर|कुरियर|कस्टम|పార్సెల్|కొరియర్|కస్టమ్స్|পার্সেল|কুরিয়ার|কাস্টমস/iu;
const LOAN_WORDS = /\bloan\b|लोन|ऋण|రుణం|లోన్|ঋণ|লোন/iu;
const SIM_WORDS = /\bsim\b|सिम|సిమ్|সিম/iu;
const DIGITAL_ARREST_WORDS = /digital arrest|डिजिटल अरेस्ट|డిజిటల్ అరెస్ట్|ডিজিটাল অ্যারেস্ট/iu;
/** Digital-arrest scripts often mention a parcel with drugs; the call-control signals decide. */
const ARREST_CONTEXT: readonly SignalId[] = ['STAY_ON_CALL'];

export const CATEGORY_CONTEXT: readonly CategoryContext[] = [
  {
    when: 'THREAT_LEGAL',
    withAny: ARREST_CONTEXT,
    textAny: DIGITAL_ARREST_WORDS,
    category: 'digital_arrest',
  },
  {
    when: 'ADVANCE_FEE',
    withAny: ARREST_CONTEXT,
    textAny: DIGITAL_ARREST_WORDS,
    category: 'digital_arrest',
  },
  {
    when: 'AUTHORITY_CLAIM',
    withAny: ARREST_CONTEXT,
    textAny: DIGITAL_ARREST_WORDS,
    category: 'digital_arrest',
  },
  { when: 'THREAT_BLOCK', textAny: UTILITY_WORDS, category: 'bill_disconnection' },
  { when: 'THREAT_BLOCK', textAny: SIM_WORDS, category: 'impersonation_govt' },
  { when: 'URGENCY', textAny: UTILITY_WORDS, category: 'bill_disconnection' },
  { when: 'ADVANCE_FEE', withAny: ['PRIZE_LOTTERY'], category: 'lottery_prize' },
  { when: 'ADVANCE_FEE', withAny: ['TASK_JOB_PAYMENT'], category: 'job_task' },
  { when: 'ADVANCE_FEE', textAny: PARCEL_WORDS, category: 'courier_customs' },
  { when: 'ADVANCE_FEE', textAny: LOAN_WORDS, category: 'loan_app' },
  { when: 'THREAT_LEGAL', textAny: PARCEL_WORDS, category: 'courier_customs' },
  { when: 'ASKS_OTP', withAny: ['BANK_IMPERSONATION', 'THREAT_BLOCK'], category: 'fake_kyc' },
  { when: 'CUSTOMER_CARE_NUMBER', textAny: UTILITY_WORDS, category: 'bill_disconnection' },
];

/** Signals whose presence turns off negative weights (any floor-carrying signal, §8.1). */
export const FLOOR_SIGNALS: ReadonlySet<SignalId> = new Set(
  (Object.entries(CATALOG) as [SignalId, CatalogEntry][])
    .filter(([, e]) => e.floor)
    .map(([id]) => id),
);
