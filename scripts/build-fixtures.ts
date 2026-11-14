/**
 * Regenerates packages/contracts/fixtures/*.json (SPEC.md §6.7).
 * Run: npm run fixtures
 *
 * Every span is computed from the normalised text, so offsets are always correct.
 * All content is synthetic: phone numbers, UPI IDs and domains are invented.
 * Owner: Laptop A. Update this script (not the JSON by hand) when a contract changes.
 */
import { writeFileSync } from 'node:fs';
import type { z } from 'zod';
import {
  AnalysisResultSchema,
  DrillSchema,
  EntityGraphSchema,
  EvalReportSchema,
  StatementAnalysisSchema,
  normalizeText,
  type AnalysisResult,
  type Entities,
  type GraphEdge,
  type GraphNode,
  type LayerContribution,
  type OcrBox,
  type Severity,
  type Signal,
  type SignalId,
  type Span,
  type StageTiming,
  type Txn,
} from '@akshi/contracts';

const OUT = new URL('../packages/contracts/fixtures/', import.meta.url);

function write<T>(name: string, schema: z.ZodType<T>, data: T): void {
  schema.parse(data);
  writeFileSync(new URL(`${name}.json`, OUT), JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`wrote ${name}.json`);
}

// ───────────── helpers ─────────────

function doc(raw: string) {
  const text = normalizeText(raw);
  function at(phrase: string, nth = 1): Span {
    const p = normalizeText(phrase);
    let idx = -1;
    for (let i = 0; i < nth; i++) {
      idx = text.indexOf(p, idx + 1);
      if (idx < 0) throw new Error(`"${phrase}" (#${nth}) not found in: ${text}`);
    }
    return { start: idx, end: idx + p.length, text: p };
  }
  return { text, at };
}

function sig(
  id: SignalId,
  weight: number,
  source: Signal['source'],
  label: string,
  detail: string,
  spans: Span[] = [],
): Signal {
  return { id, weight, label, detail, spans, source };
}

function severityOf(score: number): Severity {
  if (score >= 85) return 'critical';
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 15) return 'low';
  return 'none';
}

type LayerName = LayerContribution['layer'];
function layers(
  spec: Partial<Record<LayerName, [score: number, share: number]>>,
): LayerContribution[] {
  const order: LayerName[] = ['rules', 'model', 'links', 'upi', 'indicators', 'ai'];
  return order.map((layer) => {
    const v = spec[layer];
    return v
      ? { layer, score: v[0], share: v[1], available: true }
      : { layer, score: 0, share: 0, available: false };
  });
}

function stages(spec: Partial<Record<StageTiming['stage'], number>>): StageTiming[] {
  const order: StageTiming['stage'][] = ['read', 'ocr', 'links', 'patterns', 'model', 'ai'];
  return order.map((stage) => {
    const ms = spec[stage];
    return ms === undefined ? { stage, ms: 0, status: 'skipped' } : { stage, ms, status: 'done' };
  });
}

function entities(e: Partial<Entities> = {}): Entities {
  return {
    urls: [],
    upiIds: [],
    phones: [],
    amounts: [],
    emails: [],
    apkMentions: [],
    brands: [],
    ...e,
  };
}

function sortSignals(s: Signal[]): Signal[] {
  return [...s].sort((a, b) => b.weight - a.weight);
}

const BASE = {
  engineVersion: '0.0.0-fixture',
  modelVersion: 'fixture',
} as const;

function analysis(
  name: string,
  r: Omit<AnalysisResult, 'id' | 'engineVersion' | 'severity'> & { severity?: Severity },
): AnalysisResult {
  return {
    id: `fx-${name}`,
    ...r,
    severity: r.severity ?? severityOf(r.riskScore),
    signals: sortSignals(r.signals),
    ...BASE,
    modelVersion: r.modelVersion ?? BASE.modelVersion,
  };
}

const SBI_DOMAINS = ['sbi.co.in', 'onlinesbi.sbi', 'sbi.bank.in'];

// ───────────── 1. analysis-scam-kyc (en, SMS) ─────────────
{
  const d = doc(
    'Dear Customer, your SBI account will be BLOCKED today due to pending KYC. Update KYC immediately at http://sbi-kyc-update.xyz/verify or call our helpline 98765 00001. -SBI Team',
  );
  const url = d.at('http://sbi-kyc-update.xyz/verify');
  const phone = d.at('98765 00001');
  write(
    'analysis-scam-kyc',
    AnalysisResultSchema,
    analysis('analysis-scam-kyc', {
      createdAt: '2026-11-14T09:12:04.000Z',
      kind: 'message',
      lang: 'en',
      detectedLang: 'en',
      text: d.text,
      verdict: 'scam',
      riskScore: 94,
      confidence: 0.93,
      category: 'fake_kyc',
      categoryConfidence: 0.88,
      signals: [
        sig(
          'LOOKALIKE_DOMAIN',
          0.55,
          'url',
          'Fake bank website',
          'The link uses "sbi" in its name but is not an SBI website.',
          [url],
        ),
        sig(
          'BRAND_MISMATCH',
          0.45,
          'url',
          "Link doesn't match the bank",
          'Says it is from SBI, but the link goes to sbi-kyc-update.xyz.',
          [d.at('SBI account'), url],
        ),
        sig(
          'THREAT_BLOCK',
          0.25,
          'rule',
          'Threat to block your account',
          'Scammers scare you with a blocked account so you act without thinking.',
          [d.at('will be BLOCKED today')],
        ),
        sig(
          'CUSTOMER_CARE_NUMBER',
          0.25,
          'rule',
          'Unknown helpline number',
          'Banks do not ask you to call a mobile number from an SMS.',
          [phone],
        ),
        sig(
          'MODEL_PATTERN',
          0.3,
          'model',
          'Wording seen in scams',
          'Wording seen in many scam messages.',
          [d.at('pending KYC'), d.at('Update KYC immediately')],
        ),
        sig(
          'BANK_IMPERSONATION',
          0.2,
          'rule',
          'Pretends to be a bank',
          'Uses a bank name together with an urgent account action.',
          [d.at('-SBI Team')],
        ),
        sig('URGENCY', 0.15, 'rule', 'Rushing you', 'Asks you to act "immediately".', [
          d.at('immediately'),
        ]),
        sig(
          'RISKY_TLD',
          0.15,
          'url',
          'Unusual web address ending',
          '.xyz addresses are cheap and often used for scam sites.',
          [],
        ),
      ],
      claimVsReality: [
        {
          claim: 'Says it is from SBI',
          reality: 'Link goes to sbi-kyc-update.xyz, not sbi.co.in or sbi.bank.in',
          mismatch: true,
          signal: 'BRAND_MISMATCH',
        },
        {
          claim: 'Gives a bank helpline',
          reality: '98765 00001 is a mobile number, not an official SBI number',
          mismatch: true,
          signal: 'CUSTOMER_CARE_NUMBER',
        },
      ],
      entities: entities({
        urls: [
          {
            raw: url.text,
            span: url,
            normalized: 'http://sbi-kyc-update.xyz/verify',
            host: 'sbi-kyc-update.xyz',
            registrableDomain: 'sbi-kyc-update.xyz',
            tld: 'xyz',
            risk: 91,
            flags: ['LOOKALIKE_DOMAIN', 'BRAND_MISMATCH', 'RISKY_TLD', 'SUSPICIOUS_LINK'],
            lookalikeOf: 'sbi.co.in',
            isOfficial: false,
            isShortener: false,
            isApk: false,
          },
        ],
        phones: [
          { raw: phone.text, span: phone, e164: '+919876500001', claimedAs: 'customer_care' },
        ],
        brands: [
          {
            brand: 'SBI',
            kind: 'bank',
            span: d.at('SBI'),
            officialDomains: SBI_DOMAINS,
            mismatch: true,
            evidence: 'Link domain sbi-kyc-update.xyz is not an SBI domain',
          },
        ],
      }),
      layers: layers({ rules: [72, 0.38], model: [90, 0.36], links: [91, 0.26] }),
      explanation:
        "This looks like a fake KYC message. It threatens to block your account and sends you to a website that is not SBI's.",
      actions: [
        'do_not_click',
        'do_not_share_otp',
        'verify_official',
        'report_chakshu',
        'block_sender',
      ],
      stages: stages({ read: 1.2, links: 2.4, patterns: 3.1, model: 6.8 }),
      aiUsed: false,
      offline: true,
      latencyMs: 14,
    }),
  );
}

// ───────────── 2. analysis-suspicious-job (hi, WhatsApp) ─────────────
{
  const d = doc(
    'नमस्ते! घर बैठे पार्ट टाइम जॉब का मौका। बस YouTube वीडियो लाइक करें और रोज़ ₹3,000 तक कमाएं। पहले टास्क के लिए रजिस्ट्रेशन फीस सिर्फ ₹199 है। अभी जुड़ें: t.me/gharsekamai_tasks',
  );
  const url = d.at('t.me/gharsekamai_tasks');
  const a1 = d.at('₹3,000');
  const a2 = d.at('₹199');
  write(
    'analysis-suspicious-job',
    AnalysisResultSchema,
    analysis('analysis-suspicious-job', {
      createdAt: '2026-11-14T09:20:41.000Z',
      kind: 'message',
      lang: 'hi',
      detectedLang: 'hi',
      text: d.text,
      verdict: 'suspicious',
      riskScore: 58,
      confidence: 0.74,
      category: 'job_task',
      categoryConfidence: 0.71,
      signals: [
        sig(
          'TASK_JOB_PAYMENT',
          0.35,
          'rule',
          'काम के बदले कमाई का लालच',
          'वीडियो लाइक करने जैसे आसान काम के लिए पैसे का वादा अक्सर टास्क स्कैम होता है।',
          [d.at('वीडियो लाइक करें'), d.at('रोज़ ₹3,000 तक कमाएं')],
        ),
        sig(
          'ADVANCE_FEE',
          0.35,
          'rule',
          'पहले पैसे मांगना',
          'असली नौकरी के लिए कोई रजिस्ट्रेशन फीस नहीं मांगी जाती।',
          [d.at('रजिस्ट्रेशन फीस')],
        ),
        sig('MODEL_PATTERN', 0.25, 'model', 'स्कैम जैसी भाषा', 'ऐसे शब्द कई स्कैम संदेशों में देखे गए हैं।', [
          d.at('घर बैठे पार्ट टाइम जॉब'),
        ]),
        sig(
          'SUSPICIOUS_LINK',
          0.2,
          'url',
          'अनजान लिंक',
          'यह लिंक एक अनजान Telegram चैनल पर ले जाता है।',
          [url],
        ),
      ],
      claimVsReality: [
        {
          claim: 'घर बैठे आसान नौकरी का ऑफ़र',
          reality: 'काम शुरू करने से पहले ₹199 की फीस मांगी जा रही है',
          mismatch: true,
          signal: 'ADVANCE_FEE',
        },
      ],
      entities: entities({
        urls: [
          {
            raw: url.text,
            span: url,
            normalized: 'https://t.me/gharsekamai_tasks',
            host: 't.me',
            registrableDomain: 't.me',
            tld: 'me',
            risk: 30,
            flags: ['SUSPICIOUS_LINK'],
            isOfficial: false,
            isShortener: false,
            isApk: false,
          },
        ],
        amounts: [
          { raw: a1.text, span: a1, value: 3000, currency: 'INR' },
          { raw: a2.text, span: a2, value: 199, currency: 'INR' },
        ],
      }),
      layers: layers({ rules: [66, 0.5], model: [52, 0.31], links: [30, 0.19] }),
      explanation:
        'यह संदेश टास्क वाली नकली नौकरी जैसा लगता है। आसान कमाई का वादा करके पहले फीस मांगी जा रही है।',
      actions: ['do_not_pay', 'do_not_click', 'block_sender', 'report_chakshu'],
      stages: stages({ read: 1.4, links: 1.1, patterns: 3.6, model: 7.2 }),
      aiUsed: false,
      offline: true,
      latencyMs: 16,
    }),
  );
}

// ───────────── 3. analysis-nosigns-otp (en, genuine bank OTP SMS) ─────────────
{
  const d = doc(
    '482913 is your OTP for a transaction of Rs 2,499.00 at AMAZON on your HDFC Bank card ending XX0000. Valid for 10 minutes. Do not share your OTP with anyone. If this was not you, report it in the official HDFC Bank app.',
  );
  const amt = d.at('Rs 2,499.00');
  write(
    'analysis-nosigns-otp',
    AnalysisResultSchema,
    analysis('analysis-nosigns-otp', {
      createdAt: '2026-11-14T09:31:10.000Z',
      kind: 'message',
      lang: 'en',
      detectedLang: 'en',
      text: d.text,
      verdict: 'no_signs',
      riskScore: 6,
      confidence: 0.86,
      category: null,
      categoryConfidence: 0,
      signals: [
        sig(
          'SAFETY_ADVICE',
          -0.3,
          'rule',
          'Genuine safety advice',
          'Real bank messages remind you never to share your OTP.',
          [d.at('Do not share your OTP with anyone')],
        ),
      ],
      claimVsReality: [],
      entities: entities({
        amounts: [{ raw: amt.text, span: amt, value: 2499, currency: 'INR' }],
        brands: [
          {
            brand: 'HDFC Bank',
            kind: 'bank',
            span: d.at('HDFC Bank'),
            officialDomains: ['hdfcbank.com', 'hdfc.bank.in'],
            mismatch: false,
          },
        ],
      }),
      layers: layers({ rules: [4, 0.4], model: [8, 0.6] }),
      explanation: 'No warning signs found. Still, never share your OTP or PIN with anyone.',
      actions: ['no_action_needed', 'verify_official'],
      stages: stages({ read: 0.9, links: 0.4, patterns: 2.2, model: 5.9 }),
      aiUsed: false,
      offline: true,
      latencyMs: 11,
    }),
  );
}

// ───────────── 4. analysis-collect (en, collect request) ─────────────
{
  const d = doc(
    'Collect request from SBI Refund Desk (sbi.refund.desk@ybl) for ₹5,000. Note: Refund approved. Accept the request and enter your UPI PIN to receive ₹5,000 in your account.',
  );
  const upi = d.at('sbi.refund.desk@ybl');
  const amt1 = d.at('₹5,000');
  const amt2 = d.at('₹5,000', 2);
  write(
    'analysis-collect',
    AnalysisResultSchema,
    analysis('analysis-collect', {
      createdAt: '2026-11-14T09:40:00.000Z',
      kind: 'collect_request',
      lang: 'en',
      detectedLang: 'en',
      text: d.text,
      verdict: 'scam',
      riskScore: 96,
      confidence: 0.95,
      category: 'upi_collect',
      categoryConfidence: 0.97,
      signals: [
        sig(
          'RECEIVE_WITH_PIN',
          0.7,
          'upi',
          'PIN to "receive" money',
          'Entering your UPI PIN always sends money from your account. You never need a PIN to receive money.',
          [d.at('enter your UPI PIN to receive')],
        ),
        sig(
          'UPI_NAME_MISMATCH',
          0.4,
          'upi',
          "Name doesn't match the UPI ID",
          'Calls itself "SBI Refund Desk" but uses a personal PhonePe UPI ID.',
          [d.at('SBI Refund Desk'), upi],
        ),
        sig(
          'COLLECT_REQUEST',
          0.35,
          'upi',
          'Unexpected collect request',
          'They contacted you first and you do not know them.',
          [d.at('Collect request')],
        ),
        sig(
          'URGENCY',
          0.15,
          'context',
          'Rushing you',
          'You said you felt pressure to act quickly.',
          [],
        ),
        sig(
          'PERSONAL_UPI_HANDLE',
          0.15,
          'upi',
          'Personal UPI ID',
          'Banks do not collect or refund money from personal UPI IDs.',
          [upi],
        ),
      ],
      claimVsReality: [
        {
          claim: 'You will receive ₹5,000',
          reality: 'Approving this request sends ₹5,000 from your account to sbi.refund.desk@ybl',
          mismatch: true,
          signal: 'RECEIVE_WITH_PIN',
        },
        {
          claim: 'Calls itself SBI Refund Desk',
          reality: 'The UPI ID is a personal PhonePe ID, not a bank account',
          mismatch: true,
          signal: 'UPI_NAME_MISMATCH',
        },
      ],
      entities: entities({
        upiIds: [
          {
            raw: upi.text,
            span: upi,
            handle: 'ybl',
            psp: 'PhonePe',
            pspKnown: true,
            looksPersonal: true,
            risk: 78,
            flags: ['UPI_NAME_MISMATCH', 'PERSONAL_UPI_HANDLE'],
          },
        ],
        amounts: [
          { raw: amt1.text, span: amt1, value: 5000, currency: 'INR' },
          { raw: amt2.text, span: amt2, value: 5000, currency: 'INR' },
        ],
        brands: [
          {
            brand: 'SBI',
            kind: 'bank',
            span: d.at('SBI'),
            officialDomains: SBI_DOMAINS,
            mismatch: true,
            evidence: 'Requester uses a personal PhonePe handle',
          },
        ],
      }),
      layers: layers({ rules: [93, 0.5], model: [88, 0.29], upi: [78, 0.21] }),
      explanation:
        'This is a collect-request trap. Entering your UPI PIN always sends money from your account; you never need a PIN to receive money.',
      actions: ['decline_request', 'do_not_pay', 'block_sender', 'report_chakshu'],
      stages: stages({ read: 0.8, links: 1.3, patterns: 2.0, model: 6.1 }),
      aiUsed: false,
      offline: true,
      latencyMs: 12,
    }),
  );
}

// ───────────── 5. analysis-qr (en, UPI QR) ─────────────
{
  const raw = 'upi://pay?pa=9876500001@ybl&pn=SBI%20Refund&am=4999&tn=receive%20refund&cu=INR';
  // The analysed text is the decoded payload, so pn and tn read naturally in highlights.
  const d = doc(decodeURIComponent(raw));
  const upi = d.at('9876500001@ybl');
  write(
    'analysis-qr',
    AnalysisResultSchema,
    analysis('analysis-qr', {
      createdAt: '2026-11-14T09:45:30.000Z',
      kind: 'qr',
      lang: 'en',
      detectedLang: 'en',
      text: d.text,
      verdict: 'scam',
      riskScore: 92,
      confidence: 0.92,
      category: 'qr_receive',
      categoryConfidence: 0.9,
      signals: [
        sig(
          'QR_TO_RECEIVE',
          0.65,
          'upi',
          'QR to "receive" money',
          'Scanning a QR and entering your PIN sends money. A QR is never needed to receive money.',
          [d.at('receive refund')],
        ),
        sig(
          'UPI_NAME_MISMATCH',
          0.4,
          'upi',
          "Name doesn't match the UPI ID",
          'The payee name says "SBI Refund", but the UPI ID is a personal mobile-number ID.',
          [d.at('SBI Refund'), upi],
        ),
        sig(
          'PERSONAL_UPI_HANDLE',
          0.15,
          'upi',
          'Personal UPI ID',
          'Banks do not use personal mobile-number UPI IDs.',
          [upi],
        ),
        sig(
          'PREFILLED_AMOUNT',
          0.1,
          'upi',
          'Amount already filled in',
          '₹4,999 is pre-filled, so one tap and your PIN would pay it.',
          [d.at('am=4999')],
        ),
      ],
      claimVsReality: [
        {
          claim: 'Payee shows as "SBI Refund"',
          reality: 'Money goes to 9876500001@ybl, a personal PhonePe ID',
          mismatch: true,
          signal: 'UPI_NAME_MISMATCH',
        },
        {
          claim: 'Note says "receive refund"',
          reality: 'Paying this QR sends ₹4,999 out of your account',
          mismatch: true,
          signal: 'QR_TO_RECEIVE',
        },
      ],
      entities: entities({
        upiIds: [
          {
            raw: upi.text,
            span: upi,
            handle: 'ybl',
            psp: 'PhonePe',
            pspKnown: true,
            looksPersonal: true,
            risk: 80,
            flags: ['UPI_NAME_MISMATCH', 'PERSONAL_UPI_HANDLE'],
          },
        ],
        amounts: [{ raw: '4999', span: d.at('4999'), value: 4999, currency: 'INR' }],
        brands: [
          {
            brand: 'SBI',
            kind: 'bank',
            span: d.at('SBI'),
            officialDomains: SBI_DOMAINS,
            mismatch: true,
            evidence: 'Payee handle is a personal mobile-number UPI ID',
          },
        ],
      }),
      qr: {
        raw,
        valid: true,
        issues: [],
        pa: '9876500001@ybl',
        pn: 'SBI Refund',
        am: 4999,
        cu: 'INR',
        tn: 'receive refund',
      },
      layers: layers({ rules: [89, 0.55], upi: [80, 0.45] }),
      explanation:
        'This QR asks you to pay ₹4,999 to 9876500001@ybl (shown as "SBI Refund"). Scanning a QR and entering your PIN always sends money; it never receives it.',
      actions: ['do_not_pay', 'block_sender', 'report_chakshu', 'warn_family'],
      stages: stages({ read: 0.6, links: 1.0, patterns: 1.4 }),
      aiUsed: false,
      offline: true,
      latencyMs: 6,
    }),
  );
}

// ───────────── 6. analysis-url (en, link with network extras + AI) ─────────────
{
  const d = doc('https://hdfcbenk.top/netbanking/login?ref=kyc');
  const url = d.at('https://hdfcbenk.top/netbanking/login?ref=kyc');
  write(
    'analysis-url',
    AnalysisResultSchema,
    analysis('analysis-url', {
      createdAt: '2026-11-14T09:52:12.000Z',
      kind: 'url',
      lang: 'en',
      detectedLang: 'en',
      text: d.text,
      verdict: 'scam',
      riskScore: 86,
      confidence: 0.9,
      category: 'phishing_link',
      categoryConfidence: 0.86,
      signals: [
        sig(
          'LOOKALIKE_DOMAIN',
          0.55,
          'url',
          'Lookalike bank address',
          '"hdfcbenk" is one letter away from "hdfcbank".',
          [d.at('hdfcbenk')],
        ),
        sig(
          'NEW_DOMAIN',
          0.45,
          'url',
          'Very new website',
          'This domain was registered 6 days ago.',
          [],
        ),
        sig(
          'AI_FLAG',
          0.3,
          'ai',
          'AI second opinion',
          'A bank login page on an unrelated address is a common phishing trick.',
          [d.at('netbanking/login')],
        ),
        sig(
          'SUSPICIOUS_LINK',
          0.2,
          'url',
          'Login page on an unknown site',
          'Asks you to log in to net banking on a site that is not your bank.',
          [d.at('netbanking/login')],
        ),
        sig(
          'RISKY_TLD',
          0.15,
          'url',
          'Unusual web address ending',
          '.top addresses are cheap and often used for scam sites.',
          [d.at('.top')],
        ),
      ],
      claimVsReality: [
        {
          claim: "Looks like HDFC Bank's website",
          reality:
            'The address is hdfcbenk.top, one letter different from hdfcbank.com, registered 6 days ago',
          mismatch: true,
          signal: 'LOOKALIKE_DOMAIN',
        },
      ],
      entities: entities({
        urls: [
          {
            raw: url.text,
            span: url,
            normalized: 'https://hdfcbenk.top/netbanking/login?ref=kyc',
            host: 'hdfcbenk.top',
            registrableDomain: 'hdfcbenk.top',
            tld: 'top',
            risk: 88,
            flags: ['LOOKALIKE_DOMAIN', 'NEW_DOMAIN', 'RISKY_TLD', 'SUSPICIOUS_LINK'],
            lookalikeOf: 'hdfcbank.com',
            lookalikeDiff: [{ index: 5, expected: 'a', actual: 'e' }],
            isOfficial: false,
            isShortener: false,
            isApk: false,
            expanded: {
              hops: [{ url: 'https://hdfcbenk.top/netbanking/login?ref=kyc', status: 200 }],
              finalUrl: 'https://hdfcbenk.top/netbanking/login?ref=kyc',
              truncated: false,
            },
            domainAge: {
              domain: 'hdfcbenk.top',
              registered: '2026-11-08T00:00:00Z',
              ageDays: 6,
              registrar: 'Example Registrar Ltd (sample)',
            },
          },
        ],
        brands: [
          {
            brand: 'HDFC Bank',
            kind: 'bank',
            span: d.at('hdfcbenk'),
            officialDomains: ['hdfcbank.com', 'hdfc.bank.in'],
            mismatch: true,
            evidence: 'Lookalike of hdfcbank.com',
          },
        ],
      }),
      layers: layers({ rules: [24, 0.07], links: [88, 0.73], ai: [92, 0.2] }),
      explanation:
        'This link imitates HDFC Bank. The address is one letter off from the real one and the site is only 6 days old.',
      actions: ['do_not_click', 'verify_official', 'report_chakshu', 'warn_family'],
      stages: stages({ read: 0.4, links: 840, patterns: 0.9, ai: 1210 }),
      aiUsed: true,
      aiProvider: 'groq',
      offline: false,
      latencyMs: 1460,
    }),
  );
}

// ───────────── 7. analysis-image (te, screenshot + OCR) ─────────────
const IMAGE_W = 1080;
const IMAGE_H = 1600;
function layoutBoxes(text: string): OcrBox[] {
  const boxes: OcrBox[] = [];
  const margin = 60;
  const lineH = 64;
  const charW = 26;
  let x = margin;
  let y = 220;
  for (const m of text.matchAll(/\S+/g)) {
    const word = m[0];
    const w = Array.from(word).length * charW;
    if (x + w > IMAGE_W - margin) {
      x = margin;
      y += lineH;
    }
    boxes.push({ text: word, x, y, w, h: 46, start: m.index, end: m.index + word.length });
    x += w + charW;
  }
  return boxes;
}
let imageFixture: AnalysisResult;
{
  const d = doc(
    'ప్రియమైన వినియోగదారుడా, మీ విద్యుత్ బిల్లు బకాయి ఉంది. ఈ రాత్రి 9:30 గంటలకు మీ కరెంట్ కనెక్షన్ నిలిపివేయబడుతుంది. వెంటనే విద్యుత్ అధికారికి 98765 00002 నంబరుకు కాల్ చేయండి.',
  );
  const phone = d.at('98765 00002');
  const signals = sortSignals([
    sig('THREAT_BLOCK', 0.25, 'rule', 'సేవ నిలిపివేస్తామని బెదిరింపు', 'ఈ రాత్రే కరెంట్ కట్ చేస్తామని భయపెడుతున్నారు.', [
      d.at('కనెక్షన్ నిలిపివేయబడుతుంది'),
    ]),
    sig(
      'CUSTOMER_CARE_NUMBER',
      0.25,
      'rule',
      'తెలియని సహాయ నంబరు',
      'విద్యుత్ సంస్థలు వ్యక్తిగత మొబైల్ నంబరు ఇచ్చి కాల్ చేయమని అడగవు.',
      [phone],
    ),
    sig('MODEL_PATTERN', 0.3, 'model', 'మోసపు సందేశాల్లాంటి భాష', 'ఇలాంటి పదాలు చాలా మోసపు సందేశాల్లో కనిపిస్తాయి.', [
      d.at('విద్యుత్ బిల్లు బకాయి ఉంది'),
    ]),
    sig('URGENCY', 0.15, 'rule', 'తొందరపెట్టడం', 'వెంటనే చర్య తీసుకోమని ఒత్తిడి చేస్తున్నారు.', [
      d.at('ఈ రాత్రి 9:30 గంటలకు'),
      d.at('వెంటనే'),
    ]),
    sig('AUTHORITY_CLAIM', 0.15, 'rule', 'అధికారిగా చెప్పుకోవడం', 'విద్యుత్ అధికారి పేరుతో భయపెడుతున్నారు.', [
      d.at('విద్యుత్ అధికారికి'),
    ]),
  ]);
  const boxes = layoutBoxes(d.text).map((b) => ({
    ...b,
    signalIds: signals
      .filter((s) => s.spans.some((sp) => sp.start < b.end && b.start < sp.end))
      .map((s) => s.id),
  }));
  imageFixture = analysis('analysis-image', {
    createdAt: '2026-11-14T10:02:45.000Z',
    kind: 'image',
    lang: 'te',
    detectedLang: 'te',
    text: d.text,
    verdict: 'scam',
    riskScore: 86,
    confidence: 0.84,
    category: 'bill_disconnection',
    categoryConfidence: 0.82,
    signals,
    claimVsReality: [
      {
        claim: 'విద్యుత్ శాఖ నుండి వచ్చినట్లు చెబుతోంది',
        reality: 'ఒక వ్యక్తిగత మొబైల్ నంబరుకు కాల్ చేయమంటోంది; అధికారిక బిల్లు సందేశాలు ఇలా ఉండవు',
        mismatch: true,
        signal: 'CUSTOMER_CARE_NUMBER',
      },
    ],
    entities: entities({
      phones: [{ raw: phone.text, span: phone, e164: '+919876500002', claimedAs: 'customer_care' }],
      brands: [
        {
          brand: 'Electricity distribution company',
          kind: 'utility',
          span: d.at('విద్యుత్'),
          officialDomains: [],
          mismatch: true,
          evidence: 'వ్యక్తిగత మొబైల్ నంబరు ఇచ్చారు',
        },
      ],
    }),
    layers: layers({ rules: [62, 0.48], model: [84, 0.52] }),
    explanation:
      'ఇది కరెంట్ బిల్లు పేరుతో జరిగే మోసంలా ఉంది. ఈ రాత్రే కనెక్షన్ కట్ చేస్తామని బెదిరించి, తెలియని నంబరుకు కాల్ చేయమంటున్నారు.',
    actions: ['do_not_pay', 'verify_official', 'block_sender', 'report_chakshu'],
    stages: stages({ read: 1.1, ocr: 2840, links: 0.7, patterns: 3.4, model: 7.5 }),
    image: { width: IMAGE_W, height: IMAGE_H, boxes },
    aiUsed: false,
    offline: true,
    latencyMs: 2862,
  });
  write('analysis-image', AnalysisResultSchema, imageFixture);
}

// ───────────── 8. analysis-chat (bn, WhatsApp export) ─────────────
{
  const raw = [
    '[12/11/26, 10:02] Swift Courier: নমস্কার, আপনার নামে একটি পার্সেল কাস্টমসে আটকে আছে।',
    '[12/11/26, 10:03] Rina: কোন পার্সেল? আমি তো কিছু অর্ডার করিনি।',
    '[12/11/26, 10:05] Swift Courier: পার্সেলে বেআইনি জিনিস পাওয়া গেছে। এখনই ₹12,500 কাস্টমস ফি না দিলে পুলিশ কেস হবে।',
    '[12/11/26, 10:06] Swift Courier: এই লিংকে ফি জমা দিন: http://parcel-release-help.site/pay',
    '[12/11/26, 10:07] Rina: আমি আগে আমার ছেলের সাথে কথা বলব।',
    '[12/11/26, 10:08] Swift Courier: কাউকে বলবেন না, এটা গোপনীয় তদন্ত। আপনার ফোনে আসা OTP এখনই পাঠান।',
  ].join('\n');
  const d = doc(raw);
  const url = d.at('http://parcel-release-help.site/pay');
  const amt = d.at('₹12,500');
  const markers = [...d.text.matchAll(/\[\d{2}\/\d{2}\/\d{2}, \d{2}:\d{2}\] ([^:]+):/g)];
  const risks = [30, 5, 74, 82, 5, 95];
  const chat = markers.map((m, i) => {
    const start = m.index;
    const next = markers[i + 1];
    const end = next ? next.index - 1 : d.text.length;
    const name = m[1] ?? '';
    return {
      index: i,
      sender: name === 'Rina' ? ('me' as const) : ('them' as const),
      text: d.text.slice(start, end),
      risk: risks[i] ?? 0,
      start,
      end,
    };
  });
  write(
    'analysis-chat',
    AnalysisResultSchema,
    analysis('analysis-chat', {
      createdAt: '2026-11-14T10:10:00.000Z',
      kind: 'chat',
      lang: 'bn',
      detectedLang: 'bn',
      text: d.text,
      verdict: 'scam',
      riskScore: 95,
      confidence: 0.94,
      category: 'courier_customs',
      categoryConfidence: 0.84,
      signals: [
        sig('ASKS_OTP', 0.35, 'rule', 'OTP চাওয়া', 'কোনো কুরিয়ার বা কাস্টমস কখনও OTP চায় না।', [
          d.at('OTP এখনই পাঠান'),
        ]),
        sig('ADVANCE_FEE', 0.35, 'rule', 'আগে টাকা চাওয়া', 'পার্সেল ছাড়াতে ফি চাওয়া হচ্ছে।', [
          d.at('₹12,500 কাস্টমস ফি'),
        ]),
        sig('THREAT_LEGAL', 0.3, 'rule', 'আইনি হুমকি', 'পুলিশ কেসের ভয় দেখিয়ে টাকা চাওয়া হচ্ছে।', [
          d.at('পুলিশ কেস হবে'),
        ]),
        sig(
          'SECRECY',
          0.25,
          'rule',
          'গোপন রাখতে বলা',
          'কাউকে না বলতে বলা প্রতারণার একটি সাধারণ কৌশল।',
          [d.at('কাউকে বলবেন না')],
        ),
        sig(
          'SUSPICIOUS_LINK',
          0.2,
          'url',
          'সন্দেহজনক লিংক',
          'লিংকটি কোনো সরকারি বা কুরিয়ার সংস্থার ওয়েবসাইট নয়।',
          [url],
        ),
        sig(
          'ESCALATION',
          0.2,
          'context',
          'ধাপে ধাপে চাপ বাড়ানো',
          'প্রথমে সমস্যা, তারপর লিংক, শেষে OTP চাওয়া হয়েছে।',
          [],
        ),
        sig('URGENCY', 0.15, 'rule', 'তাড়াহুড়ো করানো', 'এখনই কাজ করার জন্য চাপ দেওয়া হচ্ছে।', [
          d.at('এখনই'),
          d.at('এখনই', 2),
        ]),
        sig(
          'RISKY_TLD',
          0.15,
          'url',
          'অস্বাভাবিক ওয়েব ঠিকানা',
          '.site ঠিকানা সস্তা এবং প্রায়ই প্রতারণার জন্য ব্যবহার হয়।',
          [d.at('.site')],
        ),
      ],
      claimVsReality: [
        {
          claim: 'কাস্টমস থেকে পার্সেল আটকানোর কথা বলছে',
          reality:
            'ফি জমার লিংক parcel-release-help.site, এটি সরকারি ওয়েবসাইট নয় (সরকারি সাইট .gov.in-এ শেষ হয়)',
          mismatch: true,
          signal: 'SUSPICIOUS_LINK',
        },
      ],
      entities: entities({
        urls: [
          {
            raw: url.text,
            span: url,
            normalized: 'http://parcel-release-help.site/pay',
            host: 'parcel-release-help.site',
            registrableDomain: 'parcel-release-help.site',
            tld: 'site',
            risk: 62,
            flags: ['SUSPICIOUS_LINK', 'RISKY_TLD'],
            isOfficial: false,
            isShortener: false,
            isApk: false,
          },
        ],
        amounts: [{ raw: amt.text, span: amt, value: 12500, currency: 'INR' }],
        brands: [
          {
            brand: 'Customs (CBIC)',
            kind: 'govt',
            span: d.at('কাস্টমসে'),
            officialDomains: ['cbic.gov.in'],
            mismatch: true,
            evidence: 'Payment link is not a .gov.in site',
          },
        ],
      }),
      layers: layers({ rules: [90, 0.47], model: [86, 0.33], links: [62, 0.2] }),
      explanation:
        'এটি কুরিয়ার বা কাস্টমসের নাম করে প্রতারণার মতো দেখাচ্ছে। পুলিশ কেসের ভয় দেখিয়ে ফি আর OTP চাওয়া হচ্ছে।',
      actions: ['do_not_share_otp', 'do_not_pay', 'do_not_click', 'block_sender', 'report_chakshu'],
      stages: stages({ read: 2.1, links: 1.6, patterns: 5.2, model: 9.4 }),
      chat,
      aiUsed: false,
      offline: true,
      latencyMs: 21,
    }),
  );
}

// ───────────── 9. analysis-email (en) ─────────────
{
  const raw = [
    'From: Income Tax Department <refunds@incometax-refund-portal.info>',
    'Reply-To: itr.refund.cell@incometax-helpdesk.online',
    'Subject: Income tax refund of Rs 18,450 approved',
    '',
    'Dear Taxpayer, your refund of Rs 18,450 is pending. Verify your bank account within 24 hours at https://incometax-refund-portal.info/claim or the refund will be cancelled.',
    'Attachment: Refund_Form.html',
  ].join('\n');
  const d = doc(raw);
  const url = d.at('https://incometax-refund-portal.info/claim');
  const from = d.at('refunds@incometax-refund-portal.info');
  const replyTo = d.at('itr.refund.cell@incometax-helpdesk.online');
  const a1 = d.at('Rs 18,450');
  const a2 = d.at('Rs 18,450', 2);
  write(
    'analysis-email',
    AnalysisResultSchema,
    analysis('analysis-email', {
      createdAt: '2026-11-14T10:18:22.000Z',
      kind: 'email',
      lang: 'en',
      detectedLang: 'en',
      text: d.text,
      verdict: 'scam',
      riskScore: 93,
      confidence: 0.93,
      category: 'impersonation_govt',
      categoryConfidence: 0.79,
      signals: [
        sig(
          'LOOKALIKE_DOMAIN',
          0.55,
          'url',
          'Fake government website',
          'Uses "incometax" in the name, but the real site is incometax.gov.in.',
          [url],
        ),
        sig(
          'BRAND_MISMATCH',
          0.45,
          'context',
          "Sender doesn't match",
          'Says it is from the Income Tax Department, but the email comes from incometax-refund-portal.info.',
          [d.at('Income Tax Department'), from],
        ),
        sig(
          'RISKY_ATTACHMENT',
          0.4,
          'context',
          'Risky attachment',
          'An .html attachment can open a fake login page.',
          [d.at('Refund_Form.html')],
        ),
        sig(
          'REPLY_TO_MISMATCH',
          0.3,
          'context',
          'Replies go elsewhere',
          'Your reply would go to a different domain than the sender.',
          [replyTo],
        ),
        sig(
          'URGENCY',
          0.15,
          'rule',
          'Rushing you',
          'Gives you 24 hours before the "refund will be cancelled".',
          [d.at('within 24 hours')],
        ),
        sig(
          'AUTHORITY_CLAIM',
          0.15,
          'rule',
          'Claims to be the government',
          'Uses the name of a government department.',
          [d.at('Income Tax Department')],
        ),
        sig(
          'RISKY_TLD',
          0.15,
          'url',
          'Unusual web address ending',
          'Government websites end in .gov.in, not .info.',
          [],
        ),
      ],
      claimVsReality: [
        {
          claim: 'Says it is from the Income Tax Department',
          reality:
            'Sent from incometax-refund-portal.info; the real department uses incometax.gov.in',
          mismatch: true,
          signal: 'BRAND_MISMATCH',
        },
        {
          claim: 'Sender: incometax-refund-portal.info',
          reality: 'Replies go to incometax-helpdesk.online',
          mismatch: true,
          signal: 'REPLY_TO_MISMATCH',
        },
      ],
      entities: entities({
        urls: [
          {
            raw: url.text,
            span: url,
            normalized: 'https://incometax-refund-portal.info/claim',
            host: 'incometax-refund-portal.info',
            registrableDomain: 'incometax-refund-portal.info',
            tld: 'info',
            risk: 86,
            flags: ['LOOKALIKE_DOMAIN', 'BRAND_MISMATCH', 'RISKY_TLD'],
            lookalikeOf: 'incometax.gov.in',
            isOfficial: false,
            isShortener: false,
            isApk: false,
          },
        ],
        amounts: [
          { raw: a1.text, span: a1, value: 18450, currency: 'INR' },
          { raw: a2.text, span: a2, value: 18450, currency: 'INR' },
        ],
        emails: [from.text, replyTo.text],
        brands: [
          {
            brand: 'Income Tax Department',
            kind: 'govt',
            span: d.at('Income Tax Department'),
            officialDomains: ['incometax.gov.in'],
            mismatch: true,
            evidence: 'Sender domain is incometax-refund-portal.info',
          },
        ],
      }),
      layers: layers({ rules: [88, 0.44], model: [91, 0.35], links: [86, 0.21] }),
      explanation:
        'This email pretends to be from the Income Tax Department. The sender, reply address and link are not government addresses.',
      actions: ['do_not_click', 'verify_official', 'report_cybercrime_portal', 'block_sender'],
      stages: stages({ read: 1.6, links: 2.2, patterns: 4.1, model: 8.3 }),
      aiUsed: false,
      offline: true,
      latencyMs: 18,
    }),
  );
}

// ───────────── 10. statement-analysis ─────────────
type Row = [
  date: string,
  time: string,
  description: string,
  debit: number,
  credit: number,
  channel: Txn['channel'],
  counterparty: string,
  upiId: string | undefined,
  category: Txn['category'],
];
const ROWS: Row[] = [
  [
    '2026-10-01',
    '09:05',
    'NEFT CR SALARY ACME SOFTWARE PVT LTD',
    0,
    85000,
    'NEFT',
    'Acme Software Pvt Ltd',
    undefined,
    'salary',
  ],
  [
    '2026-10-01',
    '10:30',
    'UPI/DR/R SHARMA/House rent Oct',
    22000,
    0,
    'UPI',
    'R Sharma',
    'sharma.rent.demo@oksbi',
    'rent',
  ],
  ['2026-10-02', '13:10', 'UPI/DR/SWIGGY/Food order', 420, 0, 'UPI', 'Swiggy', undefined, 'food'],
  ['2026-10-03', '08:45', 'UPI/DR/UBER/Trip', 260, 0, 'UPI', 'Uber', undefined, 'transport'],
  [
    '2026-10-04',
    '19:20',
    'UPI/DR/BIGBASKET/Groceries',
    1850,
    0,
    'UPI',
    'BigBasket',
    undefined,
    'groceries',
  ],
  ['2026-10-05', '21:00', 'UPI/DR/JIO/Prepaid recharge', 349, 0, 'UPI', 'Jio', undefined, 'bills'],
  ['2026-10-06', '13:30', 'UPI/DR/SWIGGY/Food order', 380, 0, 'UPI', 'Swiggy', undefined, 'food'],
  ['2026-10-07', '18:10', 'CARD POS AMAZON', 2499, 0, 'CARD', 'Amazon', undefined, 'shopping'],
  [
    '2026-10-08',
    '09:00',
    'SIP GROWW MUTUAL FUND',
    5000,
    0,
    'OTHER',
    'Groww',
    undefined,
    'investment',
  ],
  [
    '2026-10-09',
    '20:15',
    'UPI/DR/NEHA P/Dinner share',
    1200,
    0,
    'UPI',
    'Neha P',
    'neha.p.demo@okaxis',
    'transfers',
  ],
  ['2026-10-10', '12:40', 'UPI/DR/ZOMATO/Food order', 510, 0, 'UPI', 'Zomato', undefined, 'food'],
  ['2026-10-11', '11:00', 'ATM CASH WITHDRAWAL', 3000, 0, 'ATM', 'ATM', undefined, 'cash'],
  ['2026-10-12', '08:50', 'UPI/DR/UBER/Trip', 240, 0, 'UPI', 'Uber', undefined, 'transport'],
  ['2026-10-13', '13:20', 'UPI/DR/SWIGGY/Food order', 450, 0, 'UPI', 'Swiggy', undefined, 'food'],
  ['2026-10-14', '20:31', 'UPI/DR/MYNTRA/Order', 1299, 0, 'UPI', 'Myntra', undefined, 'shopping'],
  ['2026-10-14', '20:36', 'UPI/DR/MYNTRA/Order', 1299, 0, 'UPI', 'Myntra', undefined, 'shopping'],
  [
    '2026-10-15',
    '19:00',
    'BILLPAY CITY POWER LTD Electricity',
    1450,
    0,
    'OTHER',
    'City Power Ltd',
    undefined,
    'bills',
  ],
  ['2026-10-16', '13:05', 'UPI/DR/SWIGGY/Food order', 395, 0, 'UPI', 'Swiggy', undefined, 'food'],
  [
    '2026-10-17',
    '10:10',
    'UPI/DR/WELLNESS PHARMACY/Medicines',
    680,
    0,
    'UPI',
    'Wellness Pharmacy',
    undefined,
    'health',
  ],
  [
    '2026-10-18',
    '18:45',
    'UPI/DR/BOOKMYSHOW/Tickets',
    700,
    0,
    'UPI',
    'BookMyShow',
    undefined,
    'entertainment',
  ],
  ['2026-10-19', '09:30', 'UPI/DR/UBER/Trip', 310, 0, 'UPI', 'Uber', undefined, 'transport'],
  [
    '2026-10-20',
    '14:00',
    'UPI/CR/NEHA P/Movie share',
    0,
    600,
    'UPI',
    'Neha P',
    'neha.p.demo@okaxis',
    'transfers',
  ],
  [
    '2026-10-21',
    '19:40',
    'UPI/DR/BIGBASKET/Groceries',
    2100,
    0,
    'UPI',
    'BigBasket',
    undefined,
    'groceries',
  ],
  [
    '2026-10-22',
    '02:47',
    'UPI/DR/QUICK HELP SERVICES/Payment',
    48000,
    0,
    'UPI',
    'Quick Help Services',
    'quickhelp.services77@ybl',
    'transfers',
  ],
  ['2026-10-23', '12:30', 'UPI/DR/ZOMATO/Food order', 470, 0, 'UPI', 'Zomato', undefined, 'food'],
  ['2026-10-24', '08:55', 'UPI/DR/UBER/Trip', 280, 0, 'UPI', 'Uber', undefined, 'transport'],
  [
    '2026-10-25',
    '17:20',
    'UPI/DR/FLIPKART/Order',
    1599,
    0,
    'UPI',
    'Flipkart',
    undefined,
    'shopping',
  ],
  ['2026-10-26', '20:10', 'UPI/DR/AIRTEL/Broadband', 799, 0, 'UPI', 'Airtel', undefined, 'bills'],
  ['2026-10-27', '13:15', 'UPI/DR/SWIGGY/Food order', 430, 0, 'UPI', 'Swiggy', undefined, 'food'],
  [
    '2026-10-28',
    '09:00',
    'NACH DR CAR LOAN EMI',
    9500,
    0,
    'OTHER',
    'Car loan EMI',
    undefined,
    'emi',
  ],
];
{
  let balance = 42000;
  const txns: Txn[] = ROWS.map(
    ([date, time, description, debit, credit, channel, counterparty, upiId, category], i) => {
      balance += credit - debit;
      const t: Txn = {
        id: `txn-${String(i + 1).padStart(3, '0')}`,
        date: `${date}T${time}:00`,
        hasTime: true,
        description,
        amount: debit || credit,
        direction: debit ? 'debit' : 'credit',
        balance,
        channel,
        counterparty,
        category,
      };
      if (upiId) t.upiId = upiId;
      return t;
    },
  );
  const debits = txns
    .filter((t) => t.direction === 'debit')
    .map((t) => t.amount)
    .sort((a, b) => a - b);
  const q = (p: number) =>
    debits[Math.min(debits.length - 1, Math.floor(p * (debits.length - 1)))] ?? 0;
  const mid = debits.length / 2;
  const median =
    debits.length % 2
      ? (debits[Math.floor(mid)] ?? 0)
      : ((debits[mid - 1] ?? 0) + (debits[mid] ?? 0)) / 2;
  const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const totalIn = txns.filter((t) => t.direction === 'credit').reduce((s, t) => s + t.amount, 0);
  const totalOut = debits.reduce((s, n) => s + n, 0);
  const byCat = new Map<Txn['category'], number>();
  for (const t of txns)
    if (t.direction === 'debit') byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
  const payeeCount = new Map<string, number>();
  for (const t of txns)
    if (t.direction === 'debit' && t.counterparty)
      payeeCount.set(t.counterparty, (payeeCount.get(t.counterparty) ?? 0) + 1);
  write('statement-analysis', StatementAnalysisSchema, {
    txns,
    anomalies: [
      {
        id: 'anom-1',
        txnIds: ['txn-024'],
        type: 'large_new_payee',
        severity: 'high',
        score: 0.94,
        title: '₹48,000 to a new payee at 2:47 AM',
        explanation:
          'This is your first payment to Quick Help Services, and it is much larger than your usual payments. It was made at 2:47 AM, outside the hours you normally pay.',
        features: [
          { name: 'Amount', value: inr(48000), baseline: `usual ${inr(Math.round(median))}` },
          { name: 'Time', value: '02:47', baseline: 'usual 08:45–21:00' },
          { name: 'Payee', value: 'First payment', baseline: 'regular payees' },
        ],
      },
      {
        id: 'anom-2',
        txnIds: ['txn-015', 'txn-016'],
        type: 'duplicate',
        severity: 'low',
        score: 0.38,
        title: 'Possible duplicate charge of ₹1,299',
        explanation:
          'Two payments of ₹1,299 to Myntra were made 5 minutes apart. Check whether you were charged twice.',
        features: [
          { name: 'Amount', value: inr(1299), baseline: 'same amount twice' },
          { name: 'Gap', value: '5 min', baseline: 'within 10 min' },
        ],
      },
    ],
    baseline: {
      medianDebit: median,
      p90Debit: q(0.9),
      usualHours: [8, 21],
      frequentPayees: [...payeeCount].filter(([, n]) => n >= 3).map(([p]) => p),
    },
    summary: {
      totalIn,
      totalOut,
      byCategory: [...byCat]
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
      byMonth: [{ month: '2026-10', in: totalIn, out: totalOut }],
    },
    riskScore: 63,
    narrative:
      'Most of your spending this month went to transfers and rent. Two payments stand out: ₹48,000 to a new payee at 2:47 AM, and a possible duplicate ₹1,299 charge.',
  });
}

// ───────────── 11. entity-graph ─────────────
{
  const n = (
    type: GraphNode['type'],
    value: string,
    risk: number,
    mine: boolean,
    reports: number,
    label = value,
  ): GraphNode => ({
    id: `${type}:${value}`,
    type,
    label,
    risk,
    mine,
    reports,
    sampleData: !mine,
  });
  const nodes: GraphNode[] = [
    n('upi', 'kyc.update.helpdesk@ybl', 90, false, 7),
    n('phone', '+919876500001', 92, true, 5, '+91 98765 00001'),
    n('domain', 'sbi-kyc-update.xyz', 91, true, 6),
    n('campaign', 'kyc-block-wave', 90, false, 18, 'KYC block wave (sample)'),
    n('upi', 'sbi.refund.desk@ybl', 85, true, 4),
    n('upi', '9876500001@ybl', 80, true, 3),
    n('campaign', 'refund-collect', 85, false, 9, 'Refund collect requests (sample)'),
    n('domain', 'parcel-release-help.site', 62, true, 2),
    n('phone', '+919876500003', 70, false, 3, '+91 98765 00003'),
    n('campaign', 'parcel-customs-fee', 70, false, 5, 'Parcel customs fee (sample)'),
    n('domain', 'hdfcbenk.top', 88, true, 0),
  ];
  const edges: GraphEdge[] = [
    { source: 'phone:+919876500001', target: 'domain:sbi-kyc-update.xyz', kind: 'appears_with' },
    { source: 'upi:kyc.update.helpdesk@ybl', target: 'campaign:kyc-block-wave', kind: 'part_of' },
    { source: 'phone:+919876500001', target: 'campaign:kyc-block-wave', kind: 'part_of' },
    { source: 'domain:sbi-kyc-update.xyz', target: 'campaign:kyc-block-wave', kind: 'part_of' },
    { source: 'upi:sbi.refund.desk@ybl', target: 'campaign:refund-collect', kind: 'part_of' },
    { source: 'upi:9876500001@ybl', target: 'campaign:refund-collect', kind: 'part_of' },
    { source: 'upi:9876500001@ybl', target: 'phone:+919876500001', kind: 'appears_with' },
    {
      source: 'domain:parcel-release-help.site',
      target: 'campaign:parcel-customs-fee',
      kind: 'part_of',
    },
    { source: 'phone:+919876500003', target: 'campaign:parcel-customs-fee', kind: 'part_of' },
  ];
  // connected components (union-find)
  const parent = new Map(nodes.map((x) => [x.id, x.id]));
  const find = (x: string): string => {
    const p = parent.get(x) ?? x;
    if (p === x) return x;
    const r = find(p);
    parent.set(x, r);
    return r;
  };
  for (const e of edges) parent.set(find(e.source), find(e.target));
  const sizes = new Map<string, number>();
  for (const x of nodes) sizes.set(find(x.id), (sizes.get(find(x.id)) ?? 0) + 1);
  write('entity-graph', EntityGraphSchema, {
    nodes,
    edges,
    stats: { clusters: sizes.size, largestCluster: Math.max(...sizes.values()) },
  });
}

// ───────────── 12. eval-report (placeholder numbers) ─────────────
{
  const m = (
    precision: number,
    recall: number,
    accuracy: number,
    fpr: number,
    support: number,
  ) => ({
    precision,
    recall,
    f1: Number(((2 * precision * recall) / (precision + recall)).toFixed(3)),
    accuracy,
    fpr,
    support,
  });
  write('eval-report', EvalReportSchema, {
    generatedAt: '2026-11-14T00:00:00.000Z',
    engineVersion: '0.0.0-fixture',
    modelVersion: 'fixture',
    datasets: [
      {
        name: 'synthetic-test',
        size: 500,
        description: 'Held-out synthetic messages (family-level split), four languages',
      },
      {
        name: 'handwritten',
        size: 120,
        description: 'Messages written by the team, never used for training or tuning',
      },
    ],
    overall: m(0.94, 0.91, 0.93, 0.04, 500),
    handwritten: m(0.88, 0.84, 0.87, 0.07, 120),
    configs: [
      { name: 'rules_only', metrics: m(0.9, 0.78, 0.86, 0.05, 500), n: 500 },
      { name: 'rules_model', metrics: m(0.93, 0.89, 0.92, 0.04, 500), n: 500 },
      { name: 'full_no_ai', metrics: m(0.94, 0.91, 0.93, 0.04, 500), n: 500 },
      { name: 'full_ai_sample', metrics: m(0.95, 0.93, 0.94, 0.03, 100), n: 100 },
    ],
    perCategory: [
      { category: 'fake_kyc', recall: 0.96, support: 48 },
      { category: 'upi_collect', recall: 0.95, support: 40 },
      { category: 'qr_receive', recall: 0.92, support: 25 },
      { category: 'digital_arrest', recall: 0.9, support: 30 },
      { category: 'job_task', recall: 0.86, support: 35 },
      { category: 'courier_customs', recall: 0.88, support: 26 },
    ],
    perLang: [
      { lang: 'en', precision: 0.95, recall: 0.93, f1: 0.94, support: 180 },
      { lang: 'hi', precision: 0.94, recall: 0.9, f1: 0.92, support: 150 },
      { lang: 'te', precision: 0.92, recall: 0.88, f1: 0.9, support: 100 },
      { lang: 'bn', precision: 0.9, recall: 0.86, f1: 0.88, support: 70 },
    ],
    fprGenuineBank: 0.02,
    confusion: {
      labels: ['scam', 'suspicious', 'no_signs'],
      matrix: [
        [262, 24, 14],
        [6, 4, 2],
        [3, 5, 180],
      ],
    },
    latency: { p50Ms: 9, p95Ms: 31 },
    statements: { injected: 6, caught: 6, falseFlagsPer100: 1.2 },
    notes: [
      'PLACEHOLDER — Phase 0 fixture. These numbers are invented to shape the Proof page and are not measured results.',
      'Replaced by the real eval harness output (packages/content/src/eval-report.json) from Laptop C.',
    ],
  });
}

// ───────────── 13. drill ─────────────
write('drill', DrillSchema, {
  id: 'drill-fake-kyc-sms',
  title: { en: 'The KYC block SMS', hi: 'KYC ब्लॉक वाला SMS', te: 'KYC బ్లాక్ SMS' },
  category: 'fake_kyc',
  difficulty: 1,
  channel: 'sms',
  persona: { name: 'SBI-ALERT (fake)', avatar: 'bank' },
  langs: ['en', 'hi', 'te'],
  start: 'n_start',
  nodes: {
    n_start: {
      id: 'n_start',
      from: 'them',
      text: {
        en: 'SBI ALERT: Your account will be blocked today. Update your KYC now: http://sbi-kyc-update.xyz',
        hi: 'SBI अलर्ट: आपका खाता आज ब्लॉक हो जाएगा। अभी KYC अपडेट करें: http://sbi-kyc-update.xyz',
        te: 'SBI హెచ్చరిక: మీ ఖాతా ఈరోజు బ్లాక్ అవుతుంది. ఇప్పుడే KYC అప్డేట్ చేయండి: http://sbi-kyc-update.xyz',
      },
      choices: [
        {
          id: 'c_click',
          next: 'n_page',
          points: 0,
          redFlag: 'LOOKALIKE_DOMAIN',
          text: {
            en: 'Open the link and update KYC',
            hi: 'लिंक खोलकर KYC अपडेट करें',
            te: 'లింక్ తెరిచి KYC అప్డేట్ చేయండి',
          },
          feedback: {
            en: 'Risky. Banks do not send KYC links by SMS, and this link is not an SBI website.',
            hi: 'जोखिम भरा। बैंक SMS से KYC लिंक नहीं भेजते, और यह लिंक SBI की वेबसाइट नहीं है।',
            te: 'ప్రమాదకరం. బ్యాంకులు SMS ద్వారా KYC లింకులు పంపవు, ఈ లింక్ SBI వెబ్ సైట్ కాదు.',
          },
        },
        {
          id: 'c_check',
          next: 'n_check',
          points: 10,
          text: {
            en: 'Look closely at the link first',
            hi: 'पहले लिंक को ध्यान से देखें',
            te: 'ముందు లింకును జాగ్రత్తగా చూడండి',
          },
          feedback: {
            en: 'Good habit. Always read the web address before you tap.',
            hi: 'अच्छी आदत। टैप करने से पहले हमेशा वेब पता पढ़ें।',
            te: 'మంచి అలవాటు. నొక్కే ముందు ఎప్పుడూ వెబ్ చిరునామా చదవండి.',
          },
        },
        {
          id: 'c_reply',
          next: 'n_call',
          points: 0,
          redFlag: 'THREAT_BLOCK',
          text: {
            en: 'Reply: "Please help, I don\'t want my account blocked"',
            hi: 'जवाब दें: "मदद कीजिए, मेरा खाता ब्लॉक नहीं होना चाहिए"',
            te: '"దయచేసి సహాయం చేయండి, నా ఖాతా బ్లాక్ కాకూడదు" అని జవాబు ఇవ్వండి',
          },
          feedback: {
            en: 'Replying tells the scammer your number is active. The threat is what makes you rush.',
            hi: 'जवाब देने से ठग को पता चलता है कि आपका नंबर चालू है। धमकी ही आपको जल्दबाज़ी कराती है।',
            te: 'జవాబు ఇస్తే మీ నంబర్ పనిచేస్తోందని మోసగాడికి తెలుస్తుంది. బెదిరింపే మిమ్మల్ని తొందరపెడుతుంది.',
          },
        },
      ],
    },
    n_page: {
      id: 'n_page',
      from: 'system',
      text: {
        en: "The page looks like SBI's site and asks for the OTP just sent to your phone.",
        hi: 'पेज SBI की साइट जैसा दिखता है और अभी आपके फ़ोन पर आया OTP मांगता है।',
        te: 'ఆ పేజీ SBI సైటులా కనిపిస్తుంది, ఇప్పుడే మీ ఫోనుకు వచ్చిన OTP అడుగుతోంది.',
      },
      choices: [
        {
          id: 'p_share',
          next: 'end_scammed',
          points: 0,
          redFlag: 'ASKS_OTP',
          text: { en: 'Enter the OTP', hi: 'OTP डाल दें', te: 'OTP నమోదు చేయండి' },
          feedback: {
            en: 'An OTP lets someone approve a payment or log in as you. Never type it on a page you opened from an SMS.',
            hi: 'OTP से कोई भी आपकी जगह भुगतान या लॉगिन कर सकता है। SMS से खुले पेज पर इसे कभी न डालें।',
            te: 'OTP తో ఎవరైనా మీ పేరుతో చెల్లింపు లేదా లాగిన్ చేయగలరు. SMS నుండి తెరిచిన పేజీలో దాన్ని ఎప్పుడూ టైప్ చేయకండి.',
          },
        },
        {
          id: 'p_close',
          next: 'end_safe',
          points: 5,
          text: {
            en: 'Close the page and check in the official SBI app',
            hi: 'पेज बंद करें और SBI के आधिकारिक ऐप में देखें',
            te: 'పేజీని మూసి, అధికారిక SBI యాప్ లో చూడండి',
          },
          feedback: {
            en: 'Right. If something really needs doing, the official app or your branch will show it.',
            hi: 'सही। अगर सच में कुछ करना है तो आधिकारिक ऐप या आपकी शाखा में दिखेगा।',
            te: 'సరైనది. నిజంగా ఏదైనా చేయాల్సి ఉంటే అధికారిక యాప్ లేదా మీ శాఖలో తెలుస్తుంది.',
          },
        },
      ],
    },
    n_check: {
      id: 'n_check',
      from: 'system',
      text: {
        en: "The address is sbi-kyc-update.xyz. SBI's real websites end in sbi.co.in or sbi.bank.in.",
        hi: 'पता sbi-kyc-update.xyz है। SBI की असली वेबसाइटें sbi.co.in या sbi.bank.in पर होती हैं।',
        te: 'చిరునామా sbi-kyc-update.xyz. SBI అసలు వెబ్ సైట్లు sbi.co.in లేదా sbi.bank.in తో ముగుస్తాయి.',
      },
      choices: [
        {
          id: 'k_report',
          next: 'end_safe',
          points: 10,
          redFlag: 'LOOKALIKE_DOMAIN',
          text: {
            en: 'Delete it and report the SMS on Chakshu',
            hi: 'SMS हटाएं और चक्षु पर रिपोर्ट करें',
            te: 'SMS తొలగించి చక్షులో రిపోర్ట్ చేయండి',
          },
          feedback: {
            en: 'Perfect. Reporting helps stop the same message reaching others.',
            hi: 'बहुत बढ़िया। रिपोर्ट करने से यही संदेश दूसरों तक पहुंचने से रुकता है।',
            te: 'చాలా బాగుంది. రిపోర్ట్ చేస్తే అదే సందేశం ఇతరులకు చేరకుండా ఆగుతుంది.',
          },
        },
        {
          id: 'k_open',
          next: 'n_page',
          points: 0,
          text: {
            en: 'Open it anyway, just to see',
            hi: 'फिर भी खोलकर देखें',
            te: 'అయినా ఒకసారి తెరిచి చూడండి',
          },
          feedback: {
            en: 'Even opening a scam page can lead you into typing details. There is no need.',
            hi: 'स्कैम पेज खोलना भी आपको जानकारी डालने तक ले जा सकता है। इसकी ज़रूरत नहीं।',
            te: 'మోసపు పేజీని తెరవడం కూడా వివరాలు టైప్ చేసేలా చేయవచ్చు. అవసరం లేదు.',
          },
        },
      ],
    },
    n_call: {
      id: 'n_call',
      from: 'them',
      text: {
        en: 'Sir, I am calling from the SBI KYC desk. I sent you an OTP. Tell me quickly or the account closes in 10 minutes.',
        hi: 'सर, मैं SBI KYC डेस्क से बोल रहा हूं। आपको OTP भेजा है। जल्दी बताइए, वरना 10 मिनट में खाता बंद हो जाएगा।',
        te: 'సార్, నేను SBI KYC డెస్క్ నుండి మాట్లాడుతున్నాను. మీకు OTP పంపాను. త్వరగా చెప్పండి, లేకపోతే 10 నిమిషాల్లో ఖాతా మూసివేయబడుతుంది.',
      },
      choices: [
        {
          id: 'l_tell',
          next: 'end_scammed',
          points: 0,
          redFlag: 'ASKS_OTP',
          text: { en: 'Read out the OTP', hi: 'OTP बता दें', te: 'OTP చెప్పేయండి' },
          feedback: {
            en: 'No bank employee ever asks for your OTP. Saying it out loud hands over your account.',
            hi: 'कोई भी बैंक कर्मचारी कभी OTP नहीं मांगता। इसे बताना खाता सौंपने जैसा है।',
            te: 'ఏ బ్యాంక్ ఉద్యోగీ ఎప్పుడూ OTP అడగరు. దాన్ని చెప్పడం మీ ఖాతాను అప్పగించడమే.',
          },
        },
        {
          id: 'l_hang',
          next: 'end_safe',
          points: 10,
          redFlag: 'URGENCY',
          text: {
            en: 'Hang up and call the number on the back of your card',
            hi: 'फ़ोन काटें और कार्ड के पीछे लिखे नंबर पर कॉल करें',
            te: 'ఫోన్ కట్ చేసి, మీ కార్డు వెనుక ఉన్న నంబరుకు కాల్ చేయండి',
          },
          feedback: {
            en: "Exactly. Pressure and a ticking clock are the scammer's tools.",
            hi: 'बिल्कुल सही। दबाव और समय की धमकी ठग के हथियार हैं।',
            te: 'సరిగ్గా. ఒత్తిడి, సమయం బెదిరింపు మోసగాళ్ల ఆయుధాలు.',
          },
        },
      ],
    },
    end_safe: {
      id: 'end_safe',
      from: 'system',
      end: 'safe',
      text: {
        en: 'Well done, you protected your account. Banks never ask for KYC updates, OTPs or PINs through SMS links or calls.',
        hi: 'शाबाश, आपने अपना खाता बचा लिया। बैंक कभी SMS लिंक या कॉल पर KYC, OTP या PIN नहीं मांगते।',
        te: 'శభాష్, మీరు మీ ఖాతాను కాపాడుకున్నారు. బ్యాంకులు SMS లింక్ లేదా కాల్ ద్వారా ఎప్పుడూ KYC, OTP లేదా PIN అడగవు.',
      },
    },
    end_scammed: {
      id: 'end_scammed',
      from: 'system',
      end: 'scammed',
      text: {
        en: 'The scammer used your OTP to move money out of your account. If this happens for real, call 1930 right away.',
        hi: 'ठग ने आपके OTP से खाते से पैसे निकाल लिए। अगर सच में ऐसा हो, तो तुरंत 1930 पर कॉल करें।',
        te: 'మోసగాడు మీ OTP తో మీ ఖాతా నుండి డబ్బు తీసేశాడు. నిజంగా ఇలా జరిగితే, వెంటనే 1930 కు కాల్ చేయండి.',
      },
    },
  },
});
