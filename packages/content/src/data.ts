// STUB — owned by Laptop C; replaced on feat/data
import type {
  EvalReport,
  Indicator,
  Landscape,
  PatternCard,
  SampleMessage,
} from '@akshi/contracts';
import { EVAL_REPORT_FIXTURE } from '@akshi/contracts/fixtures';

/** Synthetic indicators (sample data). Values match the contracts fixtures. */
export const INDICATORS: Indicator[] = [
  {
    value: 'kyc.update.helpdesk@ybl',
    type: 'upi',
    category: 'fake_kyc',
    reports: 7,
    campaign: 'kyc-block-wave',
    sampleData: true,
  },
  {
    value: 'sbi-kyc-update.xyz',
    type: 'domain',
    category: 'fake_kyc',
    reports: 6,
    campaign: 'kyc-block-wave',
    sampleData: true,
  },
  {
    value: '+919876500001',
    type: 'phone',
    category: 'fake_kyc',
    reports: 5,
    campaign: 'kyc-block-wave',
    sampleData: true,
  },
  {
    value: 'sbi.refund.desk@ybl',
    type: 'upi',
    category: 'upi_collect',
    reports: 4,
    campaign: 'refund-collect',
    sampleData: true,
  },
  {
    value: '9876500001@ybl',
    type: 'upi',
    category: 'qr_receive',
    reports: 3,
    campaign: 'refund-collect',
    sampleData: true,
  },
  {
    value: 'hdfcbenk.top',
    type: 'domain',
    category: 'phishing_link',
    reports: 2,
    sampleData: true,
  },
  {
    value: 'parcel-release-help.site',
    type: 'domain',
    category: 'courier_customs',
    reports: 2,
    campaign: 'parcel-customs-fee',
    sampleData: true,
  },
  {
    value: '+919876500003',
    type: 'phone',
    category: 'courier_customs',
    reports: 3,
    campaign: 'parcel-customs-fee',
    sampleData: true,
  },
  {
    value: 'incometax-refund-portal.info',
    type: 'domain',
    category: 'impersonation_govt',
    reports: 4,
    sampleData: true,
  },
  {
    value: 'quickhelp.services77@ybl',
    type: 'upi',
    category: 'fake_customer_care',
    reports: 1,
    sampleData: true,
  },
];

export const SAMPLE_MESSAGES: SampleMessage[] = [
  {
    id: 'sample-fake-kyc',
    label: { en: 'Fake KYC SMS', hi: 'नकली KYC SMS' },
    kind: 'message',
    lang: 'en',
    text: 'Dear Customer, your SBI account will be BLOCKED today due to pending KYC. Update KYC immediately at http://sbi-kyc-update.xyz/verify or call our helpline 98765 00001. -SBI Team',
    expected: 'scam',
    genuine: false,
  },
  {
    id: 'sample-collect-refund',
    label: { en: 'Refund collect request', hi: 'रिफंड कलेक्ट रिक्वेस्ट' },
    kind: 'message',
    lang: 'en',
    text: 'Your refund of Rs 5,000 is ready. Accept the collect request from sbi.refund.desk@ybl and enter your UPI PIN to receive the amount.',
    expected: 'scam',
    genuine: false,
  },
  {
    id: 'sample-electricity-hi',
    label: { en: 'Electricity cut-off (Hindi)', hi: 'बिजली कटौती (हिंदी)' },
    kind: 'message',
    lang: 'hi',
    text: 'प्रिय उपभोक्ता, आपका पिछले महीने का बिजली बिल बकाया है। आज रात 9:30 बजे आपकी बिजली काट दी जाएगी। तुरंत बिजली अधिकारी से 98765 00004 पर संपर्क करें।',
    expected: 'scam',
    genuine: false,
  },
  {
    id: 'sample-digital-arrest-hinglish',
    label: { en: 'Digital arrest call script (Hinglish)', hi: 'डिजिटल अरेस्ट कॉल (हिंग्लिश)' },
    kind: 'message',
    lang: 'hi',
    text: 'Main Mumbai Cyber Crime se Inspector Sharma bol raha hoon. Aapke Aadhaar se ek parcel mein drugs mile hain. Aap digital arrest mein hain, call disconnect mat kijiye aur kisi ko mat batana. Case band karne ke liye turant verification amount bhejo.',
    expected: 'scam',
    genuine: false,
  },
  {
    id: 'sample-job-te',
    label: { en: 'Part-time job (Telugu)', hi: 'पार्ट-टाइम नौकरी (तेलुगु)', te: 'పార్ట్ టైమ్ ఉద్యోగం' },
    kind: 'message',
    lang: 'te',
    text: 'హలో! ఇంటి నుండే పార్ట్ టైమ్ ఉద్యోగం. యూట్యూబ్ వీడియోలకు లైక్ చేస్తే రోజుకు ₹2,000 సంపాదించండి. మొదటి టాస్క్ కోసం ₹500 రిజిస్ట్రేషన్ ఫీజు చెల్లించండి.',
    expected: 'suspicious',
    genuine: false,
  },
  {
    id: 'sample-genuine-otp',
    label: { en: 'Genuine bank OTP', hi: 'असली बैंक OTP' },
    kind: 'message',
    lang: 'en',
    text: '482913 is your OTP for a transaction of Rs 2,499.00 at AMAZON on your HDFC Bank card ending XX0000. Valid for 10 minutes. Do not share your OTP with anyone. If this was not you, report it in the official HDFC Bank app.',
    expected: 'no_signs',
    genuine: true,
  },
];

export const PATTERN_CARDS: PatternCard[] = [
  {
    id: 'pattern-collect-refund',
    category: 'upi_collect',
    title: { en: 'The "refund" collect request', hi: '"रिफंड" वाली कलेक्ट रिक्वेस्ट' },
    body: {
      en: 'Someone says you are owed a refund or prize and sends a UPI collect request. The app shows "Pay". Entering your PIN sends them money. Real refunds never need your PIN.',
      hi: 'कोई कहता है कि आपको रिफंड या इनाम मिलना है और UPI कलेक्ट रिक्वेस्ट भेजता है। ऐप में "Pay" दिखता है। PIN डालने से पैसे उन्हें चले जाते हैं। असली रिफंड के लिए कभी PIN नहीं चाहिए।',
    },
  },
  {
    id: 'pattern-digital-arrest',
    category: 'digital_arrest',
    title: { en: '"Digital arrest" video calls', hi: '"डिजिटल अरेस्ट" वीडियो कॉल' },
    body: {
      en: 'A caller posing as police, CBI or customs says your ID was used in a crime, keeps you on a video call, tells you not to tell anyone, and asks for money to "clear" your name. No agency works this way.',
      hi: 'पुलिस, CBI या कस्टम्स बनकर कोई कहता है कि आपकी ID किसी अपराध में इस्तेमाल हुई, आपको वीडियो कॉल पर रोके रखता है, किसी को न बताने को कहता है और नाम "साफ़" करने के लिए पैसे मांगता है। कोई भी एजेंसी ऐसे काम नहीं करती।',
    },
  },
];

export const LANDSCAPE: Landscape = {
  byCategory: [
    { category: 'fake_kyc', count: 210 },
    { category: 'upi_collect', count: 180 },
    { category: 'job_task', count: 160 },
    { category: 'digital_arrest', count: 120 },
    { category: 'courier_customs', count: 110 },
    { category: 'qr_receive', count: 90 },
  ],
  byLang: [
    { lang: 'en', count: 340 },
    { lang: 'hi', count: 290 },
    { lang: 'te', count: 150 },
    { lang: 'bn', count: 90 },
  ],
  byChannel: [
    { channel: 'sms', count: 360 },
    { channel: 'whatsapp', count: 330 },
    { channel: 'call', count: 110 },
    { channel: 'email', count: 70 },
  ],
  sampleData: true,
};

export const EVAL_REPORT: EvalReport = EVAL_REPORT_FIXTURE;
