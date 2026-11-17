import type { Anomaly, Lang, SpendCategory } from '@akshi/contracts';

type Texts = Record<Lang, string>;
type AnomalyType = Anomaly['type'];

/** Replaces {name} placeholders. */
export function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_m, key: string) => String(params[key] ?? ''));
}

export const pick = (texts: Texts, lang: Lang): string => texts[lang] ?? texts.en;

/** ₹ with Indian digit grouping: 148000 → ₹1,48,000. Paise are shown only when present. */
export function money(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const [whole = '0', frac] = Math.abs(rounded).toFixed(2).split('.');
  const head = whole.length > 3 ? whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' : '';
  const grouped = head + whole.slice(-3);
  return (rounded < 0 ? '-' : '') + '₹' + grouped + (frac && frac !== '00' ? '.' + frac : '');
}

export const TITLES: Record<AnomalyType, Texts> = {
  large_new_payee: {
    en: 'Large payment to someone new',
    hi: 'नए व्यक्ति को बड़ा भुगतान',
    te: 'కొత్త వ్యక్తికి పెద్ద చెల్లింపు',
    bn: 'নতুন কাউকে বড় অঙ্কের টাকা পাঠানো',
  },
  burst_small_debits: {
    en: 'Many payments in a few minutes',
    hi: 'कुछ ही मिनटों में कई भुगतान',
    te: 'కొన్ని నిమిషాల్లో చాలా చెల్లింపులు',
    bn: 'কয়েক মিনিটে অনেকগুলো পেমেন্ট',
  },
  odd_hour: {
    en: 'Payment at an unusual hour',
    hi: 'असामान्य समय पर भुगतान',
    te: 'అసాధారణ సమయంలో చెల్లింపు',
    bn: 'অস্বাভাবিক সময়ে পেমেন্ট',
  },
  duplicate: {
    en: 'Possible double charge',
    hi: 'शायद दो बार पैसे कटे',
    te: 'రెండుసార్లు డబ్బు కట్ అయి ఉండవచ్చు',
    bn: 'সম্ভবত দুবার টাকা কাটা হয়েছে',
  },
  credit_then_return: {
    en: 'Money came in, then went out again',
    hi: 'पैसे आए, फिर वापस चले गए',
    te: 'డబ్బు వచ్చింది, మళ్లీ వెళ్లిపోయింది',
    bn: 'টাকা এল, আবার বেরিয়ে গেল',
  },
  round_amount_new_payee: {
    en: 'Round amount to someone new',
    hi: 'नए व्यक्ति को पूरी रकम का भुगतान',
    te: 'కొత్త వ్యక్తికి రౌండ్ మొత్తం',
    bn: 'নতুন কাউকে গোটা অঙ্কের টাকা',
  },
  velocity: {
    en: 'Unusually fast spending',
    hi: 'असामान्य तेज़ी से खर्च',
    te: 'అసాధారణ వేగంతో ఖర్చు',
    bn: 'অস্বাভাবিক দ্রুত খরচ',
  },
  isolation_outlier: {
    en: 'Does not fit your usual pattern',
    hi: 'आपके सामान्य तरीके से अलग',
    te: 'మీ సాధారణ పద్ధతికి సరిపోవడం లేదు',
    bn: 'আপনার স্বাভাবিক ধরনের সঙ্গে মেলে না',
  },
};

export const EXPLANATIONS: Record<AnomalyType | 'burst_any', Texts> = {
  large_new_payee: {
    en: 'You paid {amount} to {payee} for the first time. Your usual payment is about {median}. If someone asked you to send this, check with them on a number you already know.',
    hi: 'आपने {payee} को पहली बार {amount} भेजे। आपका सामान्य भुगतान लगभग {median} होता है। अगर किसी ने यह भेजने को कहा था, तो उनसे पहले से मालूम नंबर पर बात करके पक्का करें।',
    te: 'మీరు {payee} కు మొదటిసారి {amount} పంపారు. మీ సాధారణ చెల్లింపు సుమారు {median}. ఎవరైనా ఇది పంపమని అడిగి ఉంటే, మీకు ముందే తెలిసిన నంబర్‌లో వారితో మాట్లాడి నిర్ధారించుకోండి.',
    bn: 'আপনি {payee} কে প্রথমবার {amount} পাঠিয়েছেন। আপনার সাধারণ পেমেন্ট প্রায় {median}। কেউ এটা পাঠাতে বলে থাকলে, আগে থেকে জানা নম্বরে তাঁর সঙ্গে কথা বলে নিশ্চিত হন।',
  },
  burst_small_debits: {
    en: '{count} small payments, {total} in all, went to {payee} within {minutes} minutes. You had not paid them before. Task and "recharge to withdraw" scams take money this way.',
    hi: '{minutes} मिनट के अंदर {payee} को {count} छोटे भुगतान गए, कुल {total}। आपने इन्हें पहले कभी पैसे नहीं भेजे थे। टास्क और "निकासी के लिए रिचार्ज" वाली ठगी में पैसे इसी तरह लिए जाते हैं।',
    te: '{minutes} నిమిషాల్లో {payee} కు {count} చిన్న చెల్లింపులు వెళ్లాయి, మొత్తం {total}. మీరు వీరికి ఇంతకు ముందు డబ్బు పంపలేదు. టాస్క్ మోసాల్లో డబ్బు ఇలాగే తీసుకుంటారు.',
    bn: '{minutes} মিনিটের মধ্যে {payee} কে {count}টি ছোট পেমেন্ট গেছে, মোট {total}। আগে কখনও এঁকে টাকা পাঠাননি। টাস্ক প্রতারণায় এভাবেই টাকা নেওয়া হয়।',
  },
  burst_any: {
    en: '{count} payments, {total} in all, left your account within {minutes} minutes. Check that you made each of them.',
    hi: '{minutes} मिनट के अंदर आपके खाते से {count} भुगतान हुए, कुल {total}। देख लें कि हर भुगतान आपने ही किया था।',
    te: '{minutes} నిమిషాల్లో మీ ఖాతా నుండి {count} చెల్లింపులు జరిగాయి, మొత్తం {total}. ప్రతి చెల్లింపు మీరే చేశారో చూసుకోండి.',
    bn: '{minutes} মিনিটের মধ্যে আপনার অ্যাকাউন্ট থেকে {count}টি পেমেন্ট হয়েছে, মোট {total}। প্রতিটি আপনিই করেছেন কি না দেখে নিন।',
  },
  odd_hour: {
    en: '{amount} was paid to {payee} at {time}. You do not usually make payments at that hour.',
    hi: '{time} बजे {payee} को {amount} का भुगतान हुआ। आप आम तौर पर इस समय भुगतान नहीं करते।',
    te: '{time} కు {payee} కు {amount} చెల్లించారు. మీరు సాధారణంగా ఆ సమయంలో చెల్లింపులు చేయరు.',
    bn: '{time} সময়ে {payee} কে {amount} দেওয়া হয়েছে। আপনি সাধারণত ওই সময়ে পেমেন্ট করেন না।',
  },
  duplicate: {
    en: '{amount} was paid to {payee} twice, {minutes} min apart. If you meant to pay once, ask the merchant or your bank about the second charge.',
    hi: '{minutes} मिनट के अंदर {payee} को {amount} दो बार गए। अगर आपको एक ही बार देना था, तो दूसरे भुगतान के बारे में दुकानदार या अपने बैंक से पूछें।',
    te: '{minutes} నిమిషాల్లో {payee} కు {amount} రెండుసార్లు వెళ్లింది. మీరు ఒక్కసారే చెల్లించాలనుకుంటే, రెండో చెల్లింపు గురించి వ్యాపారిని లేదా మీ బ్యాంకును అడగండి.',
    bn: '{minutes} মিনিটের মধ্যে {payee} কে {amount} দুবার গেছে। একবারই দেওয়ার কথা থাকলে, দ্বিতীয় পেমেন্ট নিয়ে দোকান বা আপনার ব্যাংককে জিজ্ঞাসা করুন।',
  },
  credit_then_return: {
    en: '{amount} came in from {sender}, whom you had not dealt with before, and {out} went out to {payee} within {hours} hours. Scammers send money "by mistake" and ask for it back to a different account. A real mistake is reversed through the bank.',
    hi: '{sender} से {amount} आए, जिनसे आपका पहले कोई लेनदेन नहीं था, और {hours} घंटे के अंदर {payee} को {out} चले गए। ठग "गलती से" पैसे भेजकर किसी दूसरे खाते में वापस मांगते हैं। असली गलती बैंक के ज़रिए ठीक होती है।',
    te: '{sender} నుండి {amount} వచ్చాయి, వీరితో మీకు ఇంతకు ముందు లావాదేవీ లేదు. {hours} గంటల్లో {payee} కు {out} వెళ్లాయి. మోసగాళ్లు "పొరపాటున" డబ్బు పంపి వేరే ఖాతాకు తిరిగి అడుగుతారు. నిజమైన పొరపాటును బ్యాంకు ద్వారా సరిచేస్తారు.',
    bn: '{sender} এর কাছ থেকে {amount} এসেছে, এঁর সঙ্গে আগে আপনার কোনো লেনদেন ছিল না। {hours} ঘণ্টার মধ্যে {payee} কে {out} চলে গেছে। প্রতারকেরা "ভুল করে" টাকা পাঠিয়ে অন্য অ্যাকাউন্টে ফেরত চায়। সত্যিকারের ভুল ব্যাংকের মাধ্যমে ঠিক হয়।',
  },
  round_amount_new_payee: {
    en: 'A round amount of {amount} went to {payee}, whom you had not paid before.',
    hi: '{payee} को {amount} की पूरी रकम गई, जिन्हें आपने पहले कभी भुगतान नहीं किया था।',
    te: '{payee} కు {amount} రౌండ్ మొత్తం వెళ్లింది. వీరికి మీరు ఇంతకు ముందు చెల్లించలేదు.',
    bn: '{payee} কে {amount} গোটা অঙ্কের টাকা গেছে। এঁকে আগে কখনও টাকা দেননি।',
  },
  velocity: {
    en: '{count} payments adding up to {total} went out within one hour. On a usual day you spend about {daily}.',
    hi: 'एक घंटे के अंदर {count} भुगतान हुए, कुल {total}। आम दिन में आप लगभग {daily} खर्च करते हैं।',
    te: 'ఒక గంటలో {count} చెల్లింపులు జరిగాయి, మొత్తం {total}. సాధారణ రోజున మీరు సుమారు {daily} ఖర్చు చేస్తారు.',
    bn: 'এক ঘণ্টার মধ্যে {count}টি পেমেন্ট হয়েছে, মোট {total}। সাধারণ দিনে আপনি প্রায় {daily} খরচ করেন।',
  },
  isolation_outlier: {
    en: 'The payment of {amount} to {payee} is unlike your other payments. That alone does not make it fraud; check that you recognise it.',
    hi: '{payee} को {amount} का भुगतान आपके बाकी भुगतानों से अलग है। सिर्फ इससे यह धोखाधड़ी नहीं हो जाता; देख लें कि आप इसे पहचानते हैं।',
    te: '{payee} కు {amount} చెల్లింపు మీ మిగతా చెల్లింపుల కంటే భిన్నంగా ఉంది. అంతమాత్రాన అది మోసం కాదు; ఇది మీకు తెలిసిన చెల్లింపేనా చూసుకోండి.',
    bn: '{payee} কে {amount} পেমেন্টটি আপনার অন্য পেমেন্টের থেকে আলাদা। শুধু এতেই এটা প্রতারণা হয়ে যায় না; পেমেন্টটি চেনেন কি না দেখে নিন।',
  },
};

export const FEATURE_NAMES = {
  amount: { en: 'Amount', hi: 'रकम', te: 'మొత్తం', bn: 'টাকার অঙ্ক' },
  time: { en: 'Time', hi: 'समय', te: 'సమయం', bn: 'সময়' },
  payee: { en: 'Payee', hi: 'पाने वाला', te: 'గ్రహీత', bn: 'প্রাপক' },
  inHour: { en: 'Payments in the hour before', hi: 'पिछले एक घंटे में भुगतान', te: 'ముందు గంటలో చెల్లింపులు', bn: 'আগের এক ঘণ্টায় পেমেন্ট' },
  round: { en: 'Round amount', hi: 'पूरी रकम', te: 'రౌండ్ మొత్తం', bn: 'গোটা অঙ্ক' },
  count: { en: 'Payments', hi: 'भुगतान', te: 'చెల్లింపులు', bn: 'পেমেন্ট' },
  credit: { en: 'Money received', hi: 'आई रकम', te: 'వచ్చిన డబ్బు', bn: 'আসা টাকা' },
  gap: { en: 'Time between', hi: 'बीच का समय', te: 'మధ్య సమయం', bn: 'মাঝের সময়' },
} satisfies Record<string, Texts>;

export const VALUES = {
  usual: { en: 'usual {value}', hi: 'सामान्य {value}', te: 'సాధారణం {value}', bn: 'সাধারণত {value}' },
  usualHours: { en: 'usual {from}:00–{to}:00', hi: 'सामान्य {from}:00–{to}:00', te: 'సాధారణం {from}:00–{to}:00', bn: 'সাধারণত {from}:00–{to}:00' },
  firstPayment: { en: 'First payment to them', hi: 'इन्हें पहला भुगतान', te: 'వీరికి మొదటి చెల్లింపు', bn: 'এঁকে প্রথম পেমেন্ট' },
  paidBefore: { en: 'usually someone you paid before', hi: 'आम तौर पर पहले से जाने-पहचाने', te: 'సాధారణంగా ముందే చెల్లించిన వారు', bn: 'সাধারণত আগে টাকা দেওয়া কেউ' },
  yes: { en: 'Yes', hi: 'हां', te: 'అవును', bn: 'হ্যাঁ' },
  rarely: { en: 'rare for you', hi: 'आपके लिए कम ही होता है', te: 'మీకు అరుదు', bn: 'আপনার ক্ষেত্রে কম হয়' },
  usuallyNone: { en: 'usually 0 or 1', hi: 'आम तौर पर 0 या 1', te: 'సాధారణంగా 0 లేదా 1', bn: 'সাধারণত 0 বা 1' },
  once: { en: 'expected once', hi: 'एक बार होना चाहिए', te: 'ఒక్కసారే ఉండాలి', bn: 'একবার হওয়ার কথা' },
  unknownSender: { en: 'from someone new', hi: 'किसी नए व्यक्ति से', te: 'కొత్త వ్యక్తి నుండి', bn: 'নতুন কারও কাছ থেকে' },
  minutes: { en: '{n} min', hi: '{n} मिनट', te: '{n} నిమిషాలు', bn: '{n} মিনিট' },
  hours: { en: '{n} h', hi: '{n} घंटे', te: '{n} గంటలు', bn: '{n} ঘণ্টা' },
  perDay: { en: 'about {value} a day', hi: 'रोज़ लगभग {value}', te: 'రోజుకు సుమారు {value}', bn: 'দিনে প্রায় {value}' },
} satisfies Record<string, Texts>;

export const CATEGORY_NAMES: Record<SpendCategory, Texts> = {
  food: { en: 'food', hi: 'खाना', te: 'ఆహారం', bn: 'খাবার' },
  groceries: { en: 'groceries', hi: 'किराना', te: 'కిరాణా', bn: 'মুদিখানা' },
  shopping: { en: 'shopping', hi: 'खरीदारी', te: 'షాపింగ్', bn: 'কেনাকাটা' },
  transport: { en: 'transport', hi: 'यात्रा', te: 'ప్రయాణం', bn: 'যাতায়াত' },
  bills: { en: 'bills', hi: 'बिल', te: 'బిల్లులు', bn: 'বিল' },
  rent: { en: 'rent', hi: 'किराया', te: 'అద్దె', bn: 'ভাড়া' },
  education: { en: 'education', hi: 'शिक्षा', te: 'చదువు', bn: 'শিক্ষা' },
  health: { en: 'health', hi: 'सेहत', te: 'ఆరోగ్యం', bn: 'স্বাস্থ্য' },
  entertainment: { en: 'entertainment', hi: 'मनोरंजन', te: 'వినోదం', bn: 'বিনোদন' },
  transfers: { en: 'transfers to people', hi: 'लोगों को भेजे पैसे', te: 'వ్యక్తులకు పంపిన డబ్బు', bn: 'লোকজনকে পাঠানো টাকা' },
  salary: { en: 'salary', hi: 'वेतन', te: 'జీతం', bn: 'বেতন' },
  cash: { en: 'cash withdrawals', hi: 'नकद निकासी', te: 'నగదు విత్‌డ్రా', bn: 'নগদ তোলা' },
  investment: { en: 'investments', hi: 'निवेश', te: 'పెట్టుబడులు', bn: 'বিনিয়োগ' },
  emi: { en: 'loan EMIs', hi: 'लोन की किस्तें', te: 'లోన్ ఈఎంఐలు', bn: 'লোনের কিস্তি' },
  other: { en: 'other payments', hi: 'अन्य भुगतान', te: 'ఇతర చెల్లింపులు', bn: 'অন্যান্য পেমেন্ট' },
};

export const NARRATIVE = {
  empty: {
    en: 'There are no transactions to look at.',
    hi: 'देखने के लिए कोई लेनदेन नहीं है।',
    te: 'చూడటానికి లావాదేవీలు లేవు.',
    bn: 'দেখার মতো কোনো লেনদেন নেই।',
  },
  spendTwo: {
    en: 'Most of your spending is on {a} and {b}.',
    hi: 'आपका ज़्यादातर खर्च {a} और {b} पर है।',
    te: 'మీ ఖర్చులో ఎక్కువ భాగం {a}, {b} పై ఉంది.',
    bn: 'আপনার বেশিরভাগ খরচ {a} আর {b} খাতে।',
  },
  spendOne: {
    en: 'Most of your spending is on {a}.',
    hi: 'आपका ज़्यादातर खर्च {a} पर है।',
    te: 'మీ ఖర్చులో ఎక్కువ భాగం {a} పై ఉంది.',
    bn: 'আপনার বেশিরভাগ খরচ {a} খাতে।',
  },
  noSpend: {
    en: 'This statement has no payments going out.',
    hi: 'इस स्टेटमेंट में कोई भुगतान बाहर नहीं गया।',
    te: 'ఈ స్టేట్‌మెంట్‌లో బయటకు వెళ్లిన చెల్లింపులు లేవు.',
    bn: 'এই স্টেটমেন্টে কোনো টাকা বেরোয়নি।',
  },
  none: {
    en: 'Nothing unusual stood out in {count} transactions. That does not prove every payment is genuine.',
    hi: '{count} लेनदेन में कुछ असामान्य नहीं दिखा। इससे यह साबित नहीं होता कि हर भुगतान सही है।',
    te: '{count} లావాదేవీల్లో అసాధారణమైనది ఏదీ కనిపించలేదు. అంతమాత్రాన ప్రతి చెల్లింపు సరైనదని కాదు.',
    bn: '{count}টি লেনদেনে অস্বাভাবিক কিছু চোখে পড়েনি। তাতে প্রমাণ হয় না যে প্রতিটি পেমেন্ট ঠিক আছে।',
  },
  one: {
    en: 'One thing stands out: {first}.',
    hi: 'एक बात ध्यान खींचती है: {first}।',
    te: 'ఒక విషయం ప్రత్యేకంగా కనిపిస్తోంది: {first}.',
    bn: 'একটি বিষয় চোখে পড়ছে: {first}।',
  },
  many: {
    en: '{n} things stand out. The most serious: {first}.',
    hi: '{n} बातें ध्यान खींचती हैं। सबसे गंभीर: {first}।',
    te: '{n} విషయాలు ప్రత్యేకంగా కనిపిస్తున్నాయి. అన్నిటికంటే ముఖ్యమైనది: {first}.',
    bn: '{n}টি বিষয় চোখে পড়ছে। সবচেয়ে গুরুতর: {first}।',
  },
  detail: {
    en: '{title} ({amount}, {date})',
    hi: '{title} ({amount}, {date})',
    te: '{title} ({amount}, {date})',
    bn: '{title} ({amount}, {date})',
  },
} satisfies Record<string, Texts>;
