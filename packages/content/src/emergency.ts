// STUB — owned by Laptop C; replaced on feat/data
import type { EmergencyContent } from '@akshi/contracts';

export const EMERGENCY: EmergencyContent = {
  questions: [
    { id: 'sent_money', text: { en: 'Did money leave your account?', hi: 'क्या आपके खाते से पैसे गए?' } },
    {
      id: 'entered_pin',
      text: { en: 'Did you enter your UPI PIN?', hi: 'क्या आपने अपना UPI PIN डाला?' },
    },
    { id: 'shared_otp', text: { en: 'Did you share an OTP?', hi: 'क्या आपने कोई OTP बताया?' } },
    {
      id: 'installed_app',
      text: { en: 'Did you install an app they sent?', hi: 'क्या आपने उनका भेजा कोई ऐप इंस्टॉल किया?' },
    },
    {
      id: 'gave_remote_access',
      text: {
        en: 'Did you let them see or control your screen?',
        hi: 'क्या आपने उन्हें अपनी स्क्रीन दिखाई या चलाने दी?',
      },
    },
    {
      id: 'shared_card',
      text: {
        en: 'Did you share card details (number, CVV, expiry)?',
        hi: 'क्या आपने कार्ड की जानकारी (नंबर, CVV, एक्सपायरी) बताई?',
      },
    },
  ],
  steps: [
    {
      id: 'step-1930',
      when: 'always',
      priority: 1,
      title: { en: 'Call 1930 if money left your account', hi: 'खाते से पैसे गए हों तो 1930 पर कॉल करें' },
      body: {
        en: 'Call the national cyber crime helpline 1930 as soon as possible. The sooner you report, the better the chance of stopping the money.',
        hi: 'जितनी जल्दी हो सके राष्ट्रीय साइबर क्राइम हेल्पलाइन 1930 पर कॉल करें। जल्दी रिपोर्ट करने से पैसे रोकने की संभावना बढ़ती है।',
      },
      action: { kind: 'tel', value: '1930', label: { en: 'Call 1930', hi: '1930 पर कॉल करें' } },
    },
    {
      id: 'step-portal',
      when: 'always',
      priority: 2,
      title: { en: 'Or report at cybercrime.gov.in', hi: 'या cybercrime.gov.in पर रिपोर्ट करें' },
      body: {
        en: 'If money left your account, you can also file a complaint online at the National Cyber Crime Reporting Portal.',
        hi: 'अगर खाते से पैसे गए हैं, तो आप राष्ट्रीय साइबर क्राइम रिपोर्टिंग पोर्टल पर ऑनलाइन शिकायत भी कर सकते हैं।',
      },
      action: {
        kind: 'url',
        value: 'https://cybercrime.gov.in',
        label: { en: 'Open cybercrime.gov.in', hi: 'cybercrime.gov.in खोलें' },
      },
    },
    {
      id: 'step-bank',
      when: ['sent_money'],
      priority: 3,
      title: {
        en: "Call your bank's official helpline",
        hi: 'अपने बैंक की आधिकारिक हेल्पलाइन पर कॉल करें',
      },
      body: {
        en: "Use the number on your card, passbook or the bank's official app, not one from a search result or a message. Note the transaction ID (UTR), amount and time, and report quickly.",
        hi: 'कार्ड, पासबुक या बैंक के आधिकारिक ऐप पर लिखा नंबर इस्तेमाल करें, किसी सर्च रिज़ल्ट या संदेश वाला नहीं। ट्रांज़ैक्शन ID (UTR), रकम और समय लिख लें और जल्दी रिपोर्ट करें।',
      },
    },
    {
      id: 'step-pin',
      when: ['entered_pin'],
      priority: 4,
      title: { en: 'Change your UPI PIN', hi: 'अपना UPI PIN बदलें' },
      body: {
        en: 'Change your UPI PIN from your bank or UPI app, then check your account for debits you did not make.',
        hi: 'बैंक या UPI ऐप से अपना UPI PIN बदलें, फिर खाते में ऐसे डेबिट देखें जो आपने नहीं किए।',
      },
    },
    {
      id: 'step-otp',
      when: ['shared_otp'],
      priority: 5,
      title: { en: 'Call your bank and change passwords', hi: 'बैंक को कॉल करें और पासवर्ड बदलें' },
      body: {
        en: 'Tell your bank an OTP was shared, and change your net banking and app passwords.',
        hi: 'बैंक को बताएं कि OTP शेयर हो गया है, और नेट बैंकिंग व ऐप के पासवर्ड बदलें।',
      },
    },
    {
      id: 'step-app',
      when: ['installed_app'],
      priority: 6,
      title: {
        en: 'Switch on airplane mode and remove the app',
        hi: 'एयरप्लेन मोड चालू करें और ऐप हटाएं',
      },
      body: {
        en: 'Turn on airplane mode, uninstall the app, and remove its Accessibility and "display over other apps" permissions. Then call your bank.',
        hi: 'एयरप्लेन मोड चालू करें, ऐप अनइंस्टॉल करें, और उसकी Accessibility व "दूसरे ऐप्स के ऊपर दिखाएं" अनुमतियां हटाएं। फिर बैंक को कॉल करें।',
      },
    },
    {
      id: 'step-remote',
      when: ['gave_remote_access'],
      priority: 7,
      title: { en: 'End the session and uninstall the app', hi: 'सेशन बंद करें और ऐप हटाएं' },
      body: {
        en: 'Close the screen-sharing session, uninstall the remote-access app, and call your bank.',
        hi: 'स्क्रीन-शेयरिंग सेशन बंद करें, रिमोट-एक्सेस ऐप अनइंस्टॉल करें, और बैंक को कॉल करें।',
      },
    },
    {
      id: 'step-card',
      when: ['shared_card'],
      priority: 8,
      title: { en: 'Block your card', hi: 'अपना कार्ड ब्लॉक करें' },
      body: {
        en: "Block the card through your bank's official app or helpline.",
        hi: 'बैंक के आधिकारिक ऐप या हेल्पलाइन से कार्ड ब्लॉक करें।',
      },
    },
    {
      id: 'step-chakshu',
      when: 'no_loss',
      priority: 9,
      title: { en: 'Report the message on Chakshu', hi: 'संदेश को चक्षु पर रिपोर्ट करें' },
      body: {
        en: 'Chakshu on Sanchar Saathi handles suspected fraud calls and messages where no money was lost. It is not for completed fraud.',
        hi: 'संचार साथी का चक्षु उन संदिग्ध कॉल और संदेशों के लिए है जिनमें पैसे नहीं गए। पूरी हो चुकी धोखाधड़ी के लिए नहीं।',
      },
      action: {
        kind: 'url',
        value: 'https://sancharsaathi.gov.in/sfc/',
        label: { en: 'Open Chakshu', hi: 'चक्षु खोलें' },
      },
    },
  ],
  evidenceChecklist: [
    { en: 'Screenshots of the messages or call log', hi: 'संदेशों या कॉल लॉग के स्क्रीनशॉट' },
    { en: 'Phone numbers and UPI IDs used', hi: 'इस्तेमाल हुए फ़ोन नंबर और UPI ID' },
    { en: 'Links they sent', hi: 'उनके भेजे लिंक' },
    {
      en: 'Transaction IDs (UTR), amounts, dates and times',
      hi: 'ट्रांज़ैक्शन ID (UTR), रकम, तारीख और समय',
    },
  ],
};
