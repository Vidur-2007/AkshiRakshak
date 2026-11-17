import type { PatternCard } from '@akshi/contracts';

/**
 * How the major scams work and how to spot them (SPEC.md M11.5). Descriptions only: no statistics, so no
 * source URLs are needed. Phase 3: 4 cards; Phase 4 brings this to 8.
 */
export const PATTERN_CARDS: PatternCard[] = [
  {
    id: 'pattern-collect-refund',
    category: 'upi_collect',
    title: {
      en: 'The "refund" collect request',
      hi: '"रिफंड" वाली कलेक्ट रिक्वेस्ट',
      te: '"రీఫండ్" కలెక్ట్ రిక్వెస్ట్',
      bn: '"রিফান্ড" কালেক্ট রিকোয়েস্ট',
    },
    body: {
      en: 'Someone says you are owed a refund, cashback or payment for something you are selling, and sends a UPI collect request. The app shows "Pay". Entering your PIN sends them the money. Signs: a request you did not expect, the word "refund" on a payment screen, and pressure to approve quickly. Real refunds never need your PIN.',
      hi: 'कोई कहता है कि आपको रिफंड, कैशबैक या बेचे गए सामान का पैसा मिलना है, और UPI कलेक्ट रिक्वेस्ट भेजता है। ऐप में "Pay" दिखता है। PIN डालने से पैसे उन्हें चले जाते हैं। पहचान: बिना उम्मीद की रिक्वेस्ट, भुगतान स्क्रीन पर "रिफंड" शब्द, और जल्दी मंज़ूर करने का दबाव। असली रिफंड के लिए कभी PIN नहीं चाहिए।',
      te: 'మీకు రీఫండ్, క్యాష్‌బ్యాక్ లేదా మీరు అమ్ముతున్న వస్తువుకు డబ్బు రావాలని చెప్పి ఎవరో UPI కలెక్ట్ రిక్వెస్ట్ పంపుతారు. యాప్‌లో "Pay" కనిపిస్తుంది. పిన్ ఎంటర్ చేస్తే డబ్బు వారికి వెళ్తుంది. గుర్తులు: మీరు ఊహించని రిక్వెస్ట్, చెల్లింపు స్క్రీన్‌పై "రీఫండ్" అనే పదం, త్వరగా ఆమోదించమనే ఒత్తిడి. నిజమైన రీఫండ్‌కు పిన్ ఎప్పుడూ అవసరం లేదు.',
      bn: 'কেউ বলে আপনার রিফান্ড, ক্যাশব্যাক বা বিক্রি করা জিনিসের টাকা পাওনা, আর UPI কালেক্ট রিকোয়েস্ট পাঠায়। অ্যাপে "Pay" দেখায়। পিন দিলে টাকা ওদের কাছে চলে যায়। চিহ্ন: অপ্রত্যাশিত রিকোয়েস্ট, পেমেন্ট স্ক্রিনে "রিফান্ড" শব্দ, আর তাড়াতাড়ি মেনে নেওয়ার চাপ। আসল রিফান্ডে কখনও পিন লাগে না।',
    },
  },
  {
    id: 'pattern-digital-arrest',
    category: 'digital_arrest',
    title: {
      en: '"Digital arrest" video calls',
      hi: '"डिजिटल अरेस्ट" वीडियो कॉल',
      te: '"డిజిటల్ అరెస్ట్" వీడియో కాల్స్',
      bn: '"ডিজিটাল অ্যারেস্ট" ভিডিও কল',
    },
    body: {
      en: 'A caller posing as police, CBI, customs or a courier says a parcel or SIM in your name is linked to a crime. They move you to a video call with uniforms and a fake office, tell you not to tell anyone, keep you on camera for hours, and ask you to move your savings to a "verification" account. Signs: secrecy, an arrest over the phone, and any demand for money. No agency works this way.',
      hi: 'पुलिस, CBI, कस्टम या कूरियर बनकर कोई कहता है कि आपके नाम का पार्सल या सिम किसी अपराध से जुड़ा है। वे वर्दी और नकली दफ़्तर वाली वीडियो कॉल पर ले जाते हैं, किसी को न बताने को कहते हैं, घंटों कैमरे पर रखते हैं, और बचत "वेरिफिकेशन" खाते में भेजने को कहते हैं। पहचान: गोपनीयता, फ़ोन पर गिरफ्तारी, और पैसे की कोई भी मांग। कोई एजेंसी ऐसे काम नहीं करती।',
      te: 'పోలీసులు, CBI, కస్టమ్స్ లేదా కొరియర్ అని చెప్పి, మీ పేరుతో ఉన్న పార్సెల్ లేదా సిమ్ నేరంతో ముడిపడి ఉందని ఎవరో అంటారు. యూనిఫాం, నకిలీ కార్యాలయం ఉన్న వీడియో కాల్‌కు మార్చి, ఎవరికీ చెప్పవద్దని, గంటల తరబడి కెమెరా ముందు ఉంచి, పొదుపును "వెరిఫికేషన్" ఖాతాకు పంపమంటారు. గుర్తులు: రహస్యం, ఫోన్‌లో అరెస్ట్, డబ్బు కోసం ఏ డిమాండ్ అయినా. ఏ సంస్థా ఇలా పనిచేయదు.',
      bn: 'পুলিশ, CBI, কাস্টমস বা কুরিয়ার সেজে কেউ বলে আপনার নামের পার্সেল বা সিম কোনো অপরাধে জড়িত। ওরা উর্দি আর নকল অফিসওয়ালা ভিডিও কলে নিয়ে যায়, কাউকে বলতে মানা করে, ঘণ্টার পর ঘণ্টা ক্যামেরার সামনে রাখে, আর সঞ্চয় একটা "যাচাই" অ্যাকাউন্টে পাঠাতে বলে। চিহ্ন: গোপনীয়তা, ফোনে গ্রেপ্তার, আর টাকার যেকোনো দাবি। কোনো সংস্থা এভাবে কাজ করে না।',
    },
  },
  {
    id: 'pattern-fake-kyc',
    category: 'fake_kyc',
    title: {
      en: 'The "KYC expired" SMS',
      hi: '"KYC खत्म" वाला SMS',
      te: '"KYC గడువు ముగిసింది" SMS',
      bn: '"KYC-র মেয়াদ শেষ" SMS',
    },
    body: {
      en: 'An SMS from an ordinary mobile number says your bank account, wallet or SIM will be blocked today unless you update KYC through a link or by calling a number. The link opens a page that looks like net banking and collects your password, card details and OTP. Signs: a same-day deadline, a link that is not the bank\'s official address, and any request for an OTP.',
      hi: 'किसी आम मोबाइल नंबर से SMS आता है कि लिंक या किसी नंबर पर कॉल करके KYC अपडेट नहीं की तो आज ही आपका बैंक खाता, वॉलेट या सिम बंद हो जाएगा। लिंक नेट बैंकिंग जैसा पेज खोलता है जो पासवर्ड, कार्ड की जानकारी और OTP ले लेता है। पहचान: उसी दिन की समय-सीमा, बैंक के आधिकारिक पते से अलग लिंक, और OTP की कोई भी मांग।',
      te: 'సాధారణ మొబైల్ నంబర్ నుండి SMS వస్తుంది: లింక్ ద్వారా లేదా నంబర్‌కు కాల్ చేసి KYC అప్‌డేట్ చేయకపోతే ఈరోజే మీ బ్యాంక్ ఖాతా, వాలెట్ లేదా సిమ్ బ్లాక్ అవుతుంది. లింక్ నెట్ బ్యాంకింగ్ లాంటి పేజీ తెరిచి పాస్‌వర్డ్, కార్డ్ వివరాలు, OTP తీసుకుంటుంది. గుర్తులు: అదే రోజు గడువు, బ్యాంక్ అధికారిక చిరునామా కాని లింక్, OTP కోసం ఏ అభ్యర్థన అయినా.',
      bn: 'সাধারণ মোবাইল নম্বর থেকে SMS আসে: লিঙ্কে বা কোনো নম্বরে ফোন করে KYC আপডেট না করলে আজই আপনার ব্যাংক অ্যাকাউন্ট, ওয়ালেট বা সিম বন্ধ হবে। লিঙ্কটা নেট ব্যাংকিংয়ের মতো পাতা খোলে, যা পাসওয়ার্ড, কার্ডের তথ্য আর OTP নিয়ে নেয়। চিহ্ন: সেদিনের মধ্যেই সময়সীমা, ব্যাংকের অফিসিয়াল ঠিকানা নয় এমন লিঙ্ক, আর OTP-র যেকোনো অনুরোধ।',
    },
  },
  {
    id: 'pattern-task-job',
    category: 'job_task',
    title: {
      en: 'Like-and-earn task jobs',
      hi: 'लाइक करो, कमाओ वाली टास्क नौकरी',
      te: 'లైక్ చేసి సంపాదించే టాస్క్ ఉద్యోగాలు',
      bn: 'লাইক করে আয়ের টাস্ক চাকরি',
    },
    body: {
      en: 'A "recruiter" offers easy money for liking videos or writing reviews. The first tasks pay a little. Then you are moved to a group where "premium" tasks need a deposit, the balance on screen grows, and withdrawal stays locked until you pay "tax" or fix a "mistake". Signs: paying to work, a balance you cannot withdraw, and earnings that sound too good to be true.',
      hi: 'एक "रिक्रूटर" वीडियो लाइक करने या रिव्यू लिखने के बदले आसान कमाई का ऑफ़र देता है। शुरू के टास्क थोड़ा पैसा देते हैं। फिर आपको ग्रुप में ले जाया जाता है जहां "प्रीमियम" टास्क के लिए पैसे जमा करने होते हैं, स्क्रीन पर बैलेंस बढ़ता है, और "टैक्स" भरने या "गलती" सुधारने तक निकासी बंद रहती है। पहचान: काम के लिए पैसे देना, न निकलने वाला बैलेंस, और सच से ज़्यादा अच्छी लगने वाली कमाई।',
      te: 'ఒక "రిక్రూటర్" వీడియోలకు లైక్ చేయడం లేదా రివ్యూలు రాయడం ద్వారా సులభంగా సంపాదించవచ్చని చెబుతారు. మొదటి టాస్క్‌లు కొంచెం డబ్బు ఇస్తాయి. తర్వాత "ప్రీమియం" టాస్క్‌లకు డిపాజిట్ కావాల్సిన గ్రూప్‌లోకి తీసుకెళ్తారు, స్క్రీన్‌పై బ్యాలెన్స్ పెరుగుతుంది, "పన్ను" కట్టే వరకు లేదా "పొరపాటు" సరిచేసే వరకు విత్‌డ్రా ఆగిపోతుంది. గుర్తులు: పని కోసం డబ్బు కట్టడం, తీసుకోలేని బ్యాలెన్స్, నమ్మలేనంత మంచి సంపాదన.',
      bn: 'এক "রিক্রুটার" ভিডিওতে লাইক বা রিভিউ লেখার বিনিময়ে সহজ আয়ের প্রস্তাব দেয়। প্রথম টাস্কগুলোতে সামান্য টাকা মেলে। তারপর এমন গ্রুপে নিয়ে যাওয়া হয় যেখানে "প্রিমিয়াম" টাস্কের জন্য টাকা জমা দিতে হয়, স্ক্রিনে ব্যালেন্স বাড়ে, আর "কর" না দেওয়া বা "ভুল" না শোধরানো পর্যন্ত টাকা তোলা বন্ধ থাকে। চিহ্ন: কাজের জন্য টাকা দেওয়া, তুলতে না পারা ব্যালেন্স, আর অবিশ্বাস্য রকমের ভালো আয়।',
    },
  },
];
