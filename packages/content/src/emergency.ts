import type { EmergencyContent } from '@akshi/contracts';

/**
 * "I think I'm being scammed" (SPEC.md M6.1, SPEC_C_DATA.md §7). General instructions only: no bank-specific
 * procedures, no promises about getting money back. Contacts: 1930, cybercrime.gov.in, and Chakshu on Sanchar
 * Saathi for suspected fraud communication (not completed fraud).
 */
export const EMERGENCY: EmergencyContent = {
  questions: [
    {
      id: 'sent_money',
      text: {
        en: 'Did money leave your account?',
        hi: 'क्या आपके खाते से पैसे गए?',
        te: 'మీ ఖాతా నుండి డబ్బు వెళ్లిందా?',
        bn: 'আপনার অ্যাকাউন্ট থেকে কি টাকা চলে গেছে?',
      },
    },
    {
      id: 'entered_pin',
      text: {
        en: 'Did you enter your UPI PIN?',
        hi: 'क्या आपने अपना UPI PIN डाला?',
        te: 'మీరు మీ UPI పిన్ ఎంటర్ చేశారా?',
        bn: 'আপনি কি আপনার UPI পিন দিয়েছেন?',
      },
    },
    {
      id: 'shared_otp',
      text: {
        en: 'Did you share an OTP?',
        hi: 'क्या आपने कोई OTP बताया?',
        te: 'మీరు ఏదైనా OTP చెప్పారా?',
        bn: 'আপনি কি কোনো OTP বলে দিয়েছেন?',
      },
    },
    {
      id: 'installed_app',
      text: {
        en: 'Did you install an app or file they sent?',
        hi: 'क्या आपने उनका भेजा कोई ऐप या फ़ाइल इंस्टॉल की?',
        te: 'వారు పంపిన యాప్ లేదా ఫైల్‌ను మీరు ఇన్‌స్టాల్ చేశారా?',
        bn: 'ওদের পাঠানো কোনো অ্যাপ বা ফাইল কি ইনস্টল করেছেন?',
      },
    },
    {
      id: 'gave_remote_access',
      text: {
        en: 'Did you let them see or control your screen?',
        hi: 'क्या आपने उन्हें अपनी स्क्रीन दिखाई या चलाने दी?',
        te: 'మీ స్క్రీన్‌ను చూడటానికి లేదా నడపటానికి వారిని అనుమతించారా?',
        bn: 'আপনার স্ক্রিন কি ওদের দেখতে বা চালাতে দিয়েছেন?',
      },
    },
    {
      id: 'shared_card',
      text: {
        en: 'Did you share card details (number, CVV, expiry)?',
        hi: 'क्या आपने कार्ड की जानकारी (नंबर, CVV, एक्सपायरी) बताई?',
        te: 'కార్డ్ వివరాలు (నంబర్, CVV, గడువు తేదీ) చెప్పారా?',
        bn: 'কার্ডের তথ্য (নম্বর, CVV, মেয়াদ) কি বলে দিয়েছেন?',
      },
    },
  ],
  steps: [
    {
      id: 'step-1930',
      when: 'always',
      priority: 1,
      title: {
        en: 'Call 1930 if money left your account',
        hi: 'खाते से पैसे गए हों तो 1930 पर कॉल करें',
        te: 'డబ్బు వెళ్లి ఉంటే 1930 కు కాల్ చేయండి',
        bn: 'টাকা চলে গেলে 1930 নম্বরে ফোন করুন',
      },
      body: {
        en: 'Call the national cyber crime helpline 1930 as soon as you can. Reporting quickly gives the best chance of stopping the money before it moves on.',
        hi: 'जितनी जल्दी हो सके राष्ट्रीय साइबर क्राइम हेल्पलाइन 1930 पर कॉल करें। जल्दी शिकायत करने से पैसे आगे जाने से पहले रोके जाने की संभावना सबसे अच्छी रहती है।',
        te: 'వీలైనంత త్వరగా జాతీయ సైబర్ క్రైమ్ హెల్ప్‌లైన్ 1930 కు కాల్ చేయండి. త్వరగా ఫిర్యాదు చేస్తే డబ్బు ముందుకు వెళ్లకముందే ఆపే అవకాశం ఎక్కువ.',
        bn: 'যত তাড়াতাড়ি পারেন জাতীয় সাইবার ক্রাইম হেল্পলাইন 1930 নম্বরে ফোন করুন। তাড়াতাড়ি জানালে টাকা অন্যত্র সরে যাওয়ার আগে আটকানোর সম্ভাবনা সবচেয়ে বেশি।',
      },
      action: {
        kind: 'tel',
        value: '1930',
        label: { en: 'Call 1930', hi: '1930 पर कॉल करें', te: '1930 కు కాల్ చేయండి', bn: '1930-এ ফোন করুন' },
      },
    },
    {
      id: 'step-portal',
      when: 'always',
      priority: 2,
      title: {
        en: 'Or report at cybercrime.gov.in',
        hi: 'या cybercrime.gov.in पर शिकायत करें',
        te: 'లేదా cybercrime.gov.in లో ఫిర్యాదు చేయండి',
        bn: 'অথবা cybercrime.gov.in-এ অভিযোগ করুন',
      },
      body: {
        en: 'If money left your account, you can also file a complaint online on the National Cyber Crime Reporting Portal. Keep the complaint number it gives you.',
        hi: 'अगर खाते से पैसे गए हैं, तो आप राष्ट्रीय साइबर क्राइम रिपोर्टिंग पोर्टल पर ऑनलाइन शिकायत भी कर सकते हैं। जो शिकायत संख्या मिले, उसे संभालकर रखें।',
        te: 'డబ్బు వెళ్లి ఉంటే, జాతీయ సైబర్ క్రైమ్ రిపోర్టింగ్ పోర్టల్‌లో ఆన్‌లైన్‌లో కూడా ఫిర్యాదు చేయవచ్చు. అది ఇచ్చే ఫిర్యాదు నంబర్‌ను దాచుకోండి.',
        bn: 'টাকা চলে গেলে জাতীয় সাইবার ক্রাইম রিপোর্টিং পোর্টালে অনলাইনেও অভিযোগ করতে পারেন। যে অভিযোগ নম্বর পাবেন, সেটা রেখে দিন।',
      },
      action: {
        kind: 'url',
        value: 'https://cybercrime.gov.in',
        label: { en: 'Open cybercrime.gov.in', hi: 'cybercrime.gov.in खोलें', te: 'cybercrime.gov.in తెరవండి', bn: 'cybercrime.gov.in খুলুন' },
      },
    },
    {
      id: 'step-bank',
      when: ['sent_money'],
      priority: 3,
      title: {
        en: "Call your bank's official helpline",
        hi: 'अपने बैंक की आधिकारिक हेल्पलाइन पर कॉल करें',
        te: 'మీ బ్యాంక్ అధికారిక హెల్ప్‌లైన్‌కు కాల్ చేయండి',
        bn: 'আপনার ব্যাংকের অফিসিয়াল হেল্পলাইনে ফোন করুন',
      },
      body: {
        en: 'Use the number on the back of your card, in your passbook or in the bank\'s own app, not one from a search result or a message. Tell them the transaction ID (UTR), the amount and the time, and ask them to raise a fraud complaint.',
        hi: 'कार्ड के पीछे, पासबुक में या बैंक के अपने ऐप में दिया नंबर इस्तेमाल करें, किसी सर्च रिज़ल्ट या मैसेज वाला नहीं। उन्हें लेनदेन संख्या (UTR), रकम और समय बताएं और धोखाधड़ी की शिकायत दर्ज करने को कहें।',
        te: 'కార్డ్ వెనుక, పాస్‌బుక్‌లో లేదా బ్యాంక్ సొంత యాప్‌లో ఉన్న నంబర్‌నే వాడండి, సెర్చ్ ఫలితం లేదా మెసేజ్‌లోని నంబర్ కాదు. లావాదేవీ నంబర్ (UTR), మొత్తం, సమయం చెప్పి మోసం ఫిర్యాదు నమోదు చేయమని అడగండి.',
        bn: 'কার্ডের পিছনে, পাসবইয়ে বা ব্যাংকের নিজের অ্যাপে দেওয়া নম্বর ব্যবহার করুন, সার্চের ফল বা মেসেজের নম্বর নয়। লেনদেন নম্বর (UTR), টাকার অঙ্ক আর সময় জানিয়ে প্রতারণার অভিযোগ নিতে বলুন।',
      },
    },
    {
      id: 'step-pin',
      when: ['entered_pin'],
      priority: 4,
      title: {
        en: 'Change your UPI PIN and check for payments',
        hi: 'अपना UPI PIN बदलें और भुगतान जांचें',
        te: 'మీ UPI పిన్ మార్చి, చెల్లింపులు చూసుకోండి',
        bn: 'UPI পিন বদলান আর পেমেন্টগুলো দেখে নিন',
      },
      body: {
        en: 'Change your UPI PIN from your bank\'s app or your UPI app. Then look through recent payments; if any are not yours, call your bank and 1930.',
        hi: 'बैंक के ऐप या अपने UPI ऐप से UPI PIN बदलें। फिर हाल के भुगतान देखें; कोई भुगतान आपका नहीं है तो बैंक और 1930 पर कॉल करें।',
        te: 'మీ బ్యాంక్ యాప్ లేదా UPI యాప్ నుండి UPI పిన్ మార్చండి. తర్వాత ఇటీవలి చెల్లింపులు చూడండి; మీవి కానివి ఉంటే బ్యాంక్‌కు, 1930 కు కాల్ చేయండి.',
        bn: 'ব্যাংকের অ্যাপ বা UPI অ্যাপ থেকে UPI পিন বদলে নিন। তারপর সাম্প্রতিক পেমেন্টগুলো দেখুন; কোনোটা আপনার না হলে ব্যাংকে আর 1930-এ ফোন করুন।',
      },
    },
    {
      id: 'step-otp',
      when: ['shared_otp'],
      priority: 5,
      title: {
        en: 'Tell your bank and change your passwords',
        hi: 'बैंक को बताएं और पासवर्ड बदलें',
        te: 'బ్యాంక్‌కు చెప్పి, పాస్‌వర్డ్‌లు మార్చండి',
        bn: 'ব্যাংককে জানান আর পাসওয়ার্ড বদলান',
      },
      body: {
        en: 'Call your bank on its official number and say you shared an OTP. Change your net banking and app passwords, and the password of any account the OTP was for.',
        hi: 'बैंक के आधिकारिक नंबर पर कॉल करके बताएं कि आपने OTP बता दिया। नेट बैंकिंग और ऐप के पासवर्ड बदलें, और उस खाते का भी जिसके लिए OTP आया था।',
        te: 'బ్యాంక్ అధికారిక నంబర్‌కు కాల్ చేసి మీరు OTP చెప్పారని తెలియజేయండి. నెట్ బ్యాంకింగ్, యాప్ పాస్‌వర్డ్‌లు, OTP ఏ ఖాతా కోసం వచ్చిందో దాని పాస్‌వర్డ్ కూడా మార్చండి.',
        bn: 'ব্যাংকের অফিসিয়াল নম্বরে ফোন করে জানান যে OTP বলে দিয়েছেন। নেট ব্যাংকিং আর অ্যাপের পাসওয়ার্ড বদলান, আর যে অ্যাকাউন্টের জন্য OTP এসেছিল সেটারও।',
      },
    },
    {
      id: 'step-app',
      when: ['installed_app'],
      priority: 6,
      title: {
        en: 'Cut the app off, then remove it',
        hi: 'ऐप का इंटरनेट बंद करें, फिर उसे हटाएं',
        te: 'యాప్‌కు ఇంటర్నెట్ ఆపి, తర్వాత తీసేయండి',
        bn: 'অ্যাপের ইন্টারনেট বন্ধ করে তারপর মুছে ফেলুন',
      },
      body: {
        en: 'Switch on airplane mode. Uninstall the app. In Settings, remove its Accessibility access and its permission to "display over other apps" if it still appears. Then call your bank from another phone if you can.',
        hi: 'फ़ोन को एयरप्लेन मोड पर करें। ऐप अनइंस्टॉल करें। अगर वह फिर भी दिखे तो सेटिंग्स में उसकी Accessibility अनुमति और "दूसरे ऐप्स के ऊपर दिखाने" की अनुमति हटाएं। फिर हो सके तो किसी दूसरे फ़ोन से बैंक को कॉल करें।',
        te: 'ఎయిర్‌ప్లేన్ మోడ్ ఆన్ చేయండి. యాప్‌ను అన్‌ఇన్‌స్టాల్ చేయండి. అది ఇంకా కనిపిస్తే సెట్టింగ్స్‌లో దాని Accessibility అనుమతి, "ఇతర యాప్‌లపై చూపించు" అనుమతి తీసేయండి. వీలైతే వేరే ఫోన్ నుండి బ్యాంక్‌కు కాల్ చేయండి.',
        bn: 'এয়ারপ্লেন মোড চালু করুন। অ্যাপটা আনইনস্টল করুন। তবুও দেখা গেলে সেটিংসে ওর Accessibility অনুমতি আর "অন্য অ্যাপের উপরে দেখানো"-র অনুমতি সরিয়ে দিন। পারলে অন্য ফোন থেকে ব্যাংকে ফোন করুন।',
      },
    },
    {
      id: 'step-remote',
      when: ['gave_remote_access'],
      priority: 7,
      title: {
        en: 'End the screen sharing and remove the app',
        hi: 'स्क्रीन शेयरिंग बंद करें और ऐप हटाएं',
        te: 'స్క్రీన్ షేరింగ్ ఆపి, యాప్ తీసేయండి',
        bn: 'স্ক্রিন শেয়ারিং বন্ধ করে অ্যাপ মুছে দিন',
      },
      body: {
        en: 'Close the session and uninstall the remote-access app (for example AnyDesk or TeamViewer). Then call your bank on its official number: whoever saw your screen may have seen your PIN or OTPs.',
        hi: 'सेशन बंद करें और रिमोट-एक्सेस ऐप (जैसे AnyDesk या TeamViewer) अनइंस्टॉल करें। फिर बैंक के आधिकारिक नंबर पर कॉल करें: जिसने आपकी स्क्रीन देखी, उसने आपका PIN या OTP भी देखा हो सकता है।',
        te: 'సెషన్ మూసేసి, రిమోట్ యాక్సెస్ యాప్ (ఉదాహరణకు AnyDesk లేదా TeamViewer) అన్‌ఇన్‌స్టాల్ చేయండి. తర్వాత బ్యాంక్ అధికారిక నంబర్‌కు కాల్ చేయండి: మీ స్క్రీన్ చూసినవారు మీ పిన్ లేదా OTP కూడా చూసి ఉండవచ్చు.',
        bn: 'সেশন বন্ধ করে রিমোট-অ্যাক্সেস অ্যাপ (যেমন AnyDesk বা TeamViewer) আনইনস্টল করুন। তারপর ব্যাংকের অফিসিয়াল নম্বরে ফোন করুন: যে আপনার স্ক্রিন দেখেছে, সে আপনার পিন বা OTP-ও দেখে থাকতে পারে।',
      },
    },
    {
      id: 'step-card',
      when: ['shared_card'],
      priority: 8,
      title: {
        en: 'Block the card',
        hi: 'कार्ड ब्लॉक करें',
        te: 'కార్డ్‌ను బ్లాక్ చేయండి',
        bn: 'কার্ড ব্লক করুন',
      },
      body: {
        en: "Block the card in your bank's official app, or by calling the number on the back of the card. Ask for a new card.",
        hi: 'बैंक के आधिकारिक ऐप से या कार्ड के पीछे लिखे नंबर पर कॉल करके कार्ड ब्लॉक करें। नया कार्ड मंगवाएं।',
        te: 'బ్యాంక్ అధికారిక యాప్‌లో లేదా కార్డ్ వెనుక ఉన్న నంబర్‌కు కాల్ చేసి కార్డ్‌ను బ్లాక్ చేయండి. కొత్త కార్డ్ అడగండి.',
        bn: 'ব্যাংকের অফিসিয়াল অ্যাপ থেকে বা কার্ডের পিছনের নম্বরে ফোন করে কার্ড ব্লক করুন। নতুন কার্ড চেয়ে নিন।',
      },
    },
    {
      id: 'step-chakshu',
      when: 'no_loss',
      priority: 9,
      title: {
        en: 'Report the message or number on Chakshu',
        hi: 'मैसेज या नंबर की शिकायत चक्षु पर करें',
        te: 'మెసేజ్ లేదా నంబర్‌ను చక్షులో రిపోర్ట్ చేయండి',
        bn: 'মেসেজ বা নম্বরটা চক্ষু-তে জানান',
      },
      body: {
        en: 'Nothing was lost, which is good. Chakshu on Sanchar Saathi takes reports of suspected fraud calls and messages, so the number can be looked into. It is for suspected fraud communication, not for money already lost.',
        hi: 'कोई नुकसान नहीं हुआ, यह अच्छी बात है। संचार साथी पर चक्षु संदिग्ध धोखाधड़ी वाले कॉल और मैसेज की शिकायत लेता है, ताकि नंबर की जांच हो सके। यह संदिग्ध धोखाधड़ी वाले संदेशों के लिए है, जा चुके पैसों के लिए नहीं।',
        te: 'ఏమీ నష్టపోలేదు, అది మంచి విషయం. సంచార్ సాథీలోని చక్షు అనుమానాస్పద మోసపు కాల్స్, మెసేజ్‌లపై ఫిర్యాదులు తీసుకుంటుంది, తద్వారా ఆ నంబర్‌ను పరిశీలించవచ్చు. ఇది అనుమానాస్పద మోసపు సందేశాల కోసం, ఇప్పటికే పోయిన డబ్బు కోసం కాదు.',
        bn: 'কিছু খোয়া যায়নি, এটা ভালো খবর। সঞ্চার সাথীর চক্ষু সন্দেহজনক প্রতারণার কল আর মেসেজের অভিযোগ নেয়, যাতে নম্বরটা খতিয়ে দেখা যায়। এটা সন্দেহজনক প্রতারণামূলক যোগাযোগের জন্য, চলে যাওয়া টাকার জন্য নয়।',
      },
      action: {
        kind: 'url',
        value: 'https://sancharsaathi.gov.in/sfc/',
        label: { en: 'Open Chakshu', hi: 'चक्षु खोलें', te: 'చక్షు తెరవండి', bn: 'চক্ষু খুলুন' },
      },
    },
  ],
  evidenceChecklist: [
    {
      en: 'Screenshots of the messages, chat or call log',
      hi: 'मैसेज, चैट या कॉल लॉग के स्क्रीनशॉट',
      te: 'మెసేజ్‌లు, చాట్ లేదా కాల్ లాగ్ స్క్రీన్‌షాట్‌లు',
      bn: 'মেসেজ, চ্যাট বা কল লগের স্ক্রিনশট',
    },
    {
      en: 'The phone numbers that called or messaged you',
      hi: 'जिन नंबरों से कॉल या मैसेज आया',
      te: 'మీకు కాల్ లేదా మెసేజ్ చేసిన నంబర్లు',
      bn: 'যে নম্বরগুলো থেকে ফোন বা মেসেজ এসেছে',
    },
    {
      en: 'UPI IDs and account details you were asked to pay',
      hi: 'जिन UPI ID और खातों में पैसे भेजने को कहा गया',
      te: 'చెల్లించమని అడిగిన UPI IDలు, ఖాతా వివరాలు',
      bn: 'যে UPI ID আর অ্যাকাউন্টে টাকা পাঠাতে বলা হয়েছিল',
    },
    {
      en: 'Links and app names they sent',
      hi: 'उनके भेजे लिंक और ऐप के नाम',
      te: 'వారు పంపిన లింక్‌లు, యాప్ పేర్లు',
      bn: 'ওদের পাঠানো লিঙ্ক আর অ্যাপের নাম',
    },
    {
      en: 'Transaction IDs (UTR), amounts, dates and times',
      hi: 'लेनदेन संख्या (UTR), रकम, तारीख और समय',
      te: 'లావాదేవీ నంబర్లు (UTR), మొత్తాలు, తేదీలు, సమయాలు',
      bn: 'লেনদেন নম্বর (UTR), টাকার অঙ্ক, তারিখ আর সময়',
    },
  ],
};
