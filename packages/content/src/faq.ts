import type { FaqItem, L10n } from '@akshi/contracts';

type Four = [en: string, hi: string, te: string, bn: string];
const l10n = ([en, hi, te, bn]: Four): L10n => ({ en, hi, te, bn });
const item = (id: string, tags: string[], q: Four, a: Four): FaqItem => ({ id, tags, q: l10n(q), a: l10n(a) });

/**
 * Answers for "Ask Akshi" (offline retrieval, SPEC.md M11.3) and the Learn pages. General guidance only, no
 * statistics. Ids are stable: the engine's assistant and the web app refer to some of them.
 */
export const FAQ: FaqItem[] = [
  item(
    'faq-pin-sends-money',
    ['upi', 'pin', 'collect', 'receive'],
    [
      'Do I need to enter my UPI PIN to receive money?',
      'क्या पैसे पाने के लिए UPI PIN डालना पड़ता है?',
      'డబ్బు అందుకోవడానికి UPI పిన్ ఎంటర్ చేయాలా?',
      'টাকা পেতে কি UPI পিন দিতে হয়?',
    ],
    [
      'No. Your UPI PIN is only ever used to send money out of your account. If anyone tells you to enter your PIN to receive a refund, prize or payment, it is a scam: entering it pays them.',
      'नहीं। UPI PIN सिर्फ आपके खाते से पैसे भेजने के लिए होता है। अगर कोई रिफंड, इनाम या भुगतान पाने के लिए PIN डालने को कहे, तो यह ठगी है: PIN डालते ही पैसे उन्हें चले जाते हैं।',
      'లేదు. UPI పిన్ మీ ఖాతా నుండి డబ్బు పంపడానికి మాత్రమే. రీఫండ్, బహుమతి లేదా చెల్లింపు అందుకోవడానికి పిన్ ఎంటర్ చేయమని ఎవరైనా చెబితే అది మోసం: పిన్ ఎంటర్ చేస్తే డబ్బు వారికే వెళ్తుంది.',
      'না। UPI পিন শুধু আপনার অ্যাকাউন্ট থেকে টাকা পাঠাতে লাগে। রিফান্ড, পুরস্কার বা পেমেন্ট পেতে কেউ পিন দিতে বললে সেটা প্রতারণা: পিন দিলেই টাকা ওদের কাছে চলে যায়।',
    ],
  ),
  item(
    'faq-qr-receive',
    ['qr', 'scan', 'receive', 'buyer'],
    [
      'Someone sent me a QR code so I can receive money. Is that normal?',
      'किसी ने पैसे पाने के लिए मुझे QR कोड भेजा है। क्या यह सामान्य है?',
      'డబ్బు అందుకోవడానికి ఎవరో నాకు QR కోడ్ పంపారు. ఇది సాధారణమేనా?',
      'টাকা পাওয়ার জন্য কেউ আমাকে QR কোড পাঠিয়েছে। এটা কি স্বাভাবিক?',
    ],
    [
      'No. Scanning a QR code is how you pay someone, never how you get paid. A "buyer" who sends a QR and asks you to scan it and enter your PIN is taking money from you. To receive money, share your own UPI ID or show your own QR.',
      'नहीं। QR कोड स्कैन करके आप किसी को पैसे देते हैं, पैसे लेते नहीं। जो "खरीदार" QR भेजकर स्कैन करने और PIN डालने को कहे, वह आपसे पैसे ले रहा है। पैसे पाने के लिए अपनी UPI ID बताएं या अपना QR दिखाएं।',
      'లేదు. QR కోడ్ స్కాన్ చేస్తే మీరు డబ్బు చెల్లిస్తారు, అందుకోరు. QR పంపి స్కాన్ చేసి పిన్ ఎంటర్ చేయమనే "కొనుగోలుదారు" మీ నుండి డబ్బు తీసుకుంటున్నారు. డబ్బు అందుకోవడానికి మీ UPI ID చెప్పండి లేదా మీ QR చూపించండి.',
      'না। QR কোড স্ক্যান করলে আপনি টাকা দেন, পান না। যে "ক্রেতা" QR পাঠিয়ে স্ক্যান করে পিন দিতে বলে, সে আপনার থেকে টাকা নিচ্ছে। টাকা পেতে নিজের UPI ID দিন বা নিজের QR দেখান।',
    ],
  ),
  item(
    'faq-bank-never-asks-otp',
    ['otp', 'bank', 'call', 'pin', 'cvv'],
    [
      'My bank called and asked for an OTP. Should I tell them?',
      'बैंक से कॉल आया और OTP मांगा। क्या बता दूं?',
      'బ్యాంక్ నుండి కాల్ వచ్చి OTP అడిగారు. చెప్పాలా?',
      'ব্যাংক থেকে ফোন করে OTP চাইছে। বলে দেব?',
    ],
    [
      'Never. Banks do not ask for your OTP, UPI PIN, CVV or passwords by call, SMS, email or WhatsApp. Anyone who asks is not your bank. Cut the call and, if you are worried, call the number on the back of your card.',
      'कभी नहीं। बैंक फ़ोन, SMS, ईमेल या WhatsApp पर OTP, UPI PIN, CVV या पासवर्ड नहीं मांगते। जो मांगे, वह आपका बैंक नहीं है। कॉल काट दें और चिंता हो तो कार्ड के पीछे लिखे नंबर पर कॉल करें।',
      'ఎప్పుడూ చెప్పకండి. బ్యాంకులు కాల్, SMS, ఈమెయిల్ లేదా WhatsApp ద్వారా OTP, UPI పిన్, CVV లేదా పాస్‌వర్డ్‌లు అడగవు. అడిగేవారు మీ బ్యాంక్ కాదు. కాల్ కట్ చేసి, అనుమానం ఉంటే కార్డ్ వెనుక ఉన్న నంబర్‌కు కాల్ చేయండి.',
      'কখনও না। ব্যাংক ফোন, SMS, ইমেল বা WhatsApp-এ OTP, UPI পিন, CVV বা পাসওয়ার্ড চায় না। যে চায়, সে আপনার ব্যাংক নয়। ফোন কেটে দিন, চিন্তা হলে কার্ডের পিছনের নম্বরে ফোন করুন।',
    ],
  ),
  item(
    'faq-digital-arrest',
    ['police', 'cbi', 'arrest', 'video call', 'digital arrest'],
    [
      'A caller says I am under "digital arrest". Is that real?',
      'फ़ोन करने वाला कहता है कि मैं "डिजिटल अरेस्ट" में हूं। क्या यह सच है?',
      'నేను "డిజిటల్ అరెస్ట్"లో ఉన్నానని కాల్ చేసినవారు అంటున్నారు. ఇది నిజమా?',
      'ফোনে বলছে আমি "ডিজিটাল অ্যারেস্ট"-এ আছি। এটা কি সত্যি?',
    ],
    [
      'No. There is no such thing as a digital arrest. Police, CBI, customs or courts do not arrest people on a video call, keep them on camera, or ask for money to clear their name. End the call, tell your family, and report the number.',
      'नहीं। डिजिटल अरेस्ट जैसी कोई चीज़ नहीं होती। पुलिस, CBI, कस्टम या अदालत वीडियो कॉल पर गिरफ्तार नहीं करती, कैमरे पर बैठाकर नहीं रखती, और नाम साफ़ करने के लिए पैसे नहीं मांगती। कॉल काटें, परिवार को बताएं और नंबर की शिकायत करें।',
      'లేదు. డిజిటల్ అరెస్ట్ అనేది లేదు. పోలీసులు, CBI, కస్టమ్స్ లేదా కోర్టులు వీడియో కాల్‌లో అరెస్ట్ చేయవు, కెమెరా ముందు కూర్చోబెట్టవు, పేరు క్లియర్ చేయడానికి డబ్బు అడగవు. కాల్ కట్ చేసి, కుటుంబానికి చెప్పి, నంబర్‌పై ఫిర్యాదు చేయండి.',
      'না। ডিজিটাল অ্যারেস্ট বলে কিছু হয় না। পুলিশ, CBI, কাস্টমস বা আদালত ভিডিও কলে গ্রেপ্তার করে না, ক্যামেরার সামনে বসিয়ে রাখে না, নাম পরিষ্কার করতে টাকা চায় না। ফোন কেটে দিন, পরিবারকে জানান আর নম্বরটার বিরুদ্ধে অভিযোগ করুন।',
    ],
  ),
  item(
    'faq-how-to-report',
    ['report', '1930', 'cybercrime', 'chakshu', 'complaint'],
    [
      'How do I report a scam?',
      'ठगी की शिकायत कैसे करूं?',
      'మోసంపై ఎలా ఫిర్యాదు చేయాలి?',
      'প্রতারণার অভিযোগ কীভাবে করব?',
    ],
    [
      'If money left your account, call 1930 straight away or file a complaint at cybercrime.gov.in, then call your bank on its official number. If you only received a suspicious call or message and lost nothing, report it on Chakshu at sancharsaathi.gov.in.',
      'अगर खाते से पैसे गए हैं तो तुरंत 1930 पर कॉल करें या cybercrime.gov.in पर शिकायत करें, फिर बैंक के आधिकारिक नंबर पर कॉल करें। अगर सिर्फ संदिग्ध कॉल या मैसेज आया और कोई नुकसान नहीं हुआ, तो sancharsaathi.gov.in पर चक्षु में शिकायत करें।',
      'డబ్బు వెళ్లి ఉంటే వెంటనే 1930 కు కాల్ చేయండి లేదా cybercrime.gov.in లో ఫిర్యాదు చేయండి, తర్వాత బ్యాంక్ అధికారిక నంబర్‌కు కాల్ చేయండి. అనుమానాస్పద కాల్ లేదా మెసేజ్ మాత్రమే వచ్చి నష్టం లేకపోతే sancharsaathi.gov.in లో చక్షులో రిపోర్ట్ చేయండి.',
      'টাকা চলে গেলে সঙ্গে সঙ্গে 1930-এ ফোন করুন বা cybercrime.gov.in-এ অভিযোগ করুন, তারপর ব্যাংকের অফিসিয়াল নম্বরে ফোন করুন। শুধু সন্দেহজনক ফোন বা মেসেজ এলে আর কিছু না হারালে sancharsaathi.gov.in-এ চক্ষু-তে জানান।',
    ],
  ),
  item(
    'faq-collect-request',
    ['collect', 'request', 'upi', 'refund'],
    [
      'What is a UPI collect request?',
      'UPI कलेक्ट रिक्वेस्ट क्या होती है?',
      'UPI కలెక్ట్ రిక్వెస్ట్ అంటే ఏమిటి?',
      'UPI কালেক্ট রিকোয়েস্ট কী?',
    ],
    [
      'It is a request for money: someone asks your UPI app to pay them. Accepting it and entering your PIN sends them money. Scammers send collect requests labelled "refund" or "cashback". If you did not expect to pay that person, decline.',
      'यह पैसे की मांग होती है: कोई आपके UPI ऐप से अपने लिए भुगतान मांगता है। इसे स्वीकार करके PIN डालने पर पैसे उन्हें चले जाते हैं। ठग "रिफंड" या "कैशबैक" लिखकर कलेक्ट रिक्वेस्ट भेजते हैं। अगर आपको उस व्यक्ति को पैसे नहीं देने थे, तो Decline करें।',
      'ఇది డబ్బు అడిగే అభ్యర్థన: ఎవరైనా మీ UPI యాప్ నుండి తమకు చెల్లించమని అడుగుతారు. దాన్ని అంగీకరించి పిన్ ఎంటర్ చేస్తే డబ్బు వారికి వెళ్తుంది. మోసగాళ్లు "రీఫండ్" లేదా "క్యాష్‌బ్యాక్" అని రాసి కలెక్ట్ రిక్వెస్ట్ పంపుతారు. ఆ వ్యక్తికి చెల్లించాల్సిన అవసరం లేకపోతే Decline చేయండి.',
      'এটা টাকা চাওয়ার অনুরোধ: কেউ আপনার UPI অ্যাপ থেকে নিজেকে টাকা দিতে বলে। মেনে নিয়ে পিন দিলে টাকা ওদের কাছে চলে যায়। প্রতারকেরা "রিফান্ড" বা "ক্যাশব্যাক" লিখে কালেক্ট রিকোয়েস্ট পাঠায়। ওই লোককে টাকা দেওয়ার কথা না থাকলে Decline করুন।',
    ],
  ),
  item(
    'faq-receive-no-action',
    ['receive', 'upi', 'payment', 'pin'],
    [
      'What do I have to do to receive money on UPI?',
      'UPI पर पैसे पाने के लिए मुझे क्या करना होता है?',
      'UPI లో డబ్బు అందుకోవడానికి నేను ఏమి చేయాలి?',
      'UPI-তে টাকা পেতে আমাকে কী করতে হয়?',
    ],
    [
      'Nothing beyond sharing your UPI ID, phone number or your own QR code. Money arrives without any action from you: no PIN, no OTP, no scanning, no app to install.',
      'अपनी UPI ID, फ़ोन नंबर या अपना QR कोड बताने के अलावा कुछ नहीं। पैसे बिना कुछ किए आ जाते हैं: न PIN, न OTP, न स्कैन, न कोई ऐप इंस्टॉल करना।',
      'మీ UPI ID, ఫోన్ నంబర్ లేదా మీ సొంత QR కోడ్ ఇవ్వడం తప్ప ఏమీ అవసరం లేదు. డబ్బు మీరు ఏమీ చేయకుండానే వస్తుంది: పిన్, OTP, స్కాన్, యాప్ ఇన్‌స్టాల్ ఏవీ అవసరం లేదు.',
      'নিজের UPI ID, ফোন নম্বর বা নিজের QR কোড দেওয়া ছাড়া কিছুই না। টাকা আপনার কিছু না করেই চলে আসে: পিন, OTP, স্ক্যান বা অ্যাপ ইনস্টল কিছুই লাগে না।',
    ],
  ),
  item(
    'faq-bank-in-domain',
    ['link', 'website', 'domain', 'bank.in', 'official'],
    [
      'What does a website ending in .bank.in mean?',
      '.bank.in पर खत्म होने वाली वेबसाइट का क्या मतलब है?',
      '.bank.in తో ముగిసే వెబ్‌సైట్ అంటే ఏమిటి?',
      '.bank.in দিয়ে শেষ হওয়া ওয়েবসাইটের মানে কী?',
    ],
    [
      'The .bank.in ending is reserved for banks regulated in India, and banks are moving their websites to it. Look at the ending of the address, not the start: sbi.bank.in is a bank, but sbi.bank.in.verify-now.top is not. Other official bank addresses still exist, so when unsure, type the address yourself rather than tapping a link.',
      '.bank.in वाला नाम भारत में नियंत्रित बैंकों के लिए आरक्षित है, और बैंक अपनी वेबसाइटें इस पर ला रहे हैं। पते का आखिरी हिस्सा देखें, शुरुआत नहीं: sbi.bank.in बैंक है, लेकिन sbi.bank.in.verify-now.top नहीं। बैंकों के दूसरे आधिकारिक पते भी अभी चलते हैं, इसलिए शक हो तो लिंक दबाने की बजाय पता खुद टाइप करें।',
      '.bank.in ముగింపు భారతదేశంలో నియంత్రణలో ఉన్న బ్యాంకులకు మాత్రమే, బ్యాంకులు తమ వెబ్‌సైట్‌లను దీనికి మారుస్తున్నాయి. చిరునామా చివరి భాగం చూడండి, మొదలు కాదు: sbi.bank.in బ్యాంక్, కానీ sbi.bank.in.verify-now.top కాదు. బ్యాంకుల ఇతర అధికారిక చిరునామాలు కూడా ఇంకా ఉన్నాయి, కాబట్టి అనుమానం ఉంటే లింక్ నొక్కకుండా చిరునామాను మీరే టైప్ చేయండి.',
      '.bank.in শেষাংশ ভারতে নিয়ন্ত্রিত ব্যাংকগুলোর জন্য সংরক্ষিত, আর ব্যাংকগুলো নিজেদের ওয়েবসাইট এখানে সরাচ্ছে। ঠিকানার শেষটা দেখুন, শুরুটা নয়: sbi.bank.in ব্যাংক, কিন্তু sbi.bank.in.verify-now.top নয়। ব্যাংকের অন্য অফিসিয়াল ঠিকানাও এখনও আছে, তাই সন্দেহ হলে লিঙ্কে না চেপে ঠিকানাটা নিজে টাইপ করুন।',
    ],
  ),
  item(
    'faq-check-link',
    ['link', 'website', 'lookalike', 'url'],
    [
      'How can I tell if a link is fake?',
      'कैसे पता करूं कि लिंक नकली है?',
      'లింక్ నకిలీదో ఎలా తెలుసుకోవాలి?',
      'লিঙ্ক ভুয়ো কি না কীভাবে বুঝব?',
    ],
    [
      'Read the part just before the first single "/": that is the real site. Watch for a brand name with extra words (sbi-kyc-update), a misspelling (hdfcbenk), odd endings like .xyz, .top or .click, and shortened links. Paste the link into Akshi Rakshak to see each part explained.',
      'पहले अकेले "/" से ठीक पहले वाला हिस्सा पढ़ें: असली साइट वही है। ध्यान दें: ब्रांड के नाम के साथ अतिरिक्त शब्द (sbi-kyc-update), गलत वर्तनी (hdfcbenk), .xyz, .top या .click जैसे अजीब अंत, और छोटे किए गए लिंक। लिंक को अक्षि रक्षक में पेस्ट करें, हर हिस्से का मतलब दिखेगा।',
      'మొదటి ఒంటరి "/" కు ముందు ఉన్న భాగం చదవండి: అదే అసలు సైట్. బ్రాండ్ పేరుతో అదనపు పదాలు (sbi-kyc-update), తప్పు స్పెల్లింగ్ (hdfcbenk), .xyz, .top లేదా .click వంటి వింత ముగింపులు, చిన్నగా చేసిన లింక్‌లను గమనించండి. లింక్‌ను అక్షి రక్షక్‌లో పేస్ట్ చేస్తే ప్రతి భాగం వివరంగా కనిపిస్తుంది.',
      'প্রথম একক "/"-এর ঠিক আগের অংশটা পড়ুন: আসল সাইট সেটাই। খেয়াল রাখুন: ব্র্যান্ডের নামের সঙ্গে বাড়তি শব্দ (sbi-kyc-update), ভুল বানান (hdfcbenk), .xyz, .top বা .click-এর মতো অদ্ভুত শেষাংশ, আর ছোট করা লিঙ্ক। লিঙ্কটা অক্ষি রক্ষকে পেস্ট করলে প্রতিটা অংশের ব্যাখ্যা দেখতে পাবেন।',
    ],
  ),
  item(
    'faq-kyc-sms',
    ['kyc', 'sms', 'account blocked', 'pan'],
    [
      'I got an SMS saying my account will be blocked unless I update KYC. What should I do?',
      'SMS आया है कि KYC अपडेट नहीं की तो खाता बंद हो जाएगा। क्या करूं?',
      'KYC అప్‌డేట్ చేయకపోతే ఖాతా బ్లాక్ అవుతుందని SMS వచ్చింది. ఏం చేయాలి?',
      'SMS এসেছে KYC আপডেট না করলে অ্যাকাউন্ট বন্ধ হবে। কী করব?',
    ],
    [
      'Do not tap the link or call the number in it. Banks do not block accounts through a link in an SMS. If you want to check your KYC, open your bank\'s own app or visit your branch.',
      'मैसेज के लिंक पर न दबाएं और उसके नंबर पर कॉल न करें। बैंक SMS के लिंक से खाते बंद नहीं करते। KYC जांचनी है तो बैंक का अपना ऐप खोलें या शाखा जाएं।',
      'మెసేజ్‌లోని లింక్ నొక్కకండి, దానిలోని నంబర్‌కు కాల్ చేయకండి. బ్యాంకులు SMS లింక్ ద్వారా ఖాతాలను బ్లాక్ చేయవు. KYC చూసుకోవాలంటే బ్యాంక్ సొంత యాప్ తెరవండి లేదా శాఖకు వెళ్లండి.',
      'মেসেজের লিঙ্কে চাপবেন না, ওর নম্বরেও ফোন করবেন না। ব্যাংক SMS-এর লিঙ্ক দিয়ে অ্যাকাউন্ট বন্ধ করে না। KYC দেখতে চাইলে ব্যাংকের নিজের অ্যাপ খুলুন বা শাখায় যান।',
    ],
  ),
  item(
    'faq-apk-files',
    ['apk', 'app', 'install', 'wedding', 'file'],
    [
      'Someone sent me an .apk file (a wedding card, a challan, a bank app). Is it safe to open?',
      'किसी ने .apk फ़ाइल भेजी है (शादी का कार्ड, चालान, बैंक ऐप)। क्या इसे खोलना ठीक है?',
      'ఎవరో .apk ఫైల్ పంపారు (పెళ్లి పత్రిక, చలాన్, బ్యాంక్ యాప్). దాన్ని తెరవవచ్చా?',
      'কেউ .apk ফাইল পাঠিয়েছে (বিয়ের কার্ড, চালান, ব্যাংক অ্যাপ)। খোলা কি ঠিক?',
    ],
    [
      'Do not open or install it. An .apk is an app, not a card or a document, and apps sent on chat can read your SMS and OTPs. Install apps only from the Play Store, and delete the file.',
      'इसे न खोलें, न इंस्टॉल करें। .apk एक ऐप होता है, कार्ड या दस्तावेज़ नहीं, और चैट पर भेजे गए ऐप आपके SMS और OTP पढ़ सकते हैं। ऐप सिर्फ Play Store से इंस्टॉल करें और फ़ाइल हटा दें।',
      'దాన్ని తెరవకండి, ఇన్‌స్టాల్ చేయకండి. .apk అనేది యాప్, పత్రిక లేదా పత్రం కాదు, చాట్‌లో పంపిన యాప్‌లు మీ SMS, OTPలను చదవగలవు. యాప్‌లను Play Store నుండి మాత్రమే ఇన్‌స్టాల్ చేయండి, ఫైల్‌ను తొలగించండి.',
      'খুলবেন না, ইনস্টলও করবেন না। .apk একটা অ্যাপ, কার্ড বা নথি নয়, আর চ্যাটে পাঠানো অ্যাপ আপনার SMS আর OTP পড়ে নিতে পারে। অ্যাপ শুধু Play Store থেকে ইনস্টল করুন, ফাইলটা মুছে দিন।',
    ],
  ),
  item(
    'faq-screen-sharing',
    ['anydesk', 'teamviewer', 'screen share', 'remote', 'support'],
    [
      'Customer support asked me to install AnyDesk or TeamViewer. Should I?',
      'कस्टमर सपोर्ट ने AnyDesk या TeamViewer इंस्टॉल करने को कहा। करूं?',
      'కస్టమర్ సపోర్ట్ AnyDesk లేదా TeamViewer ఇన్‌స్టాల్ చేయమన్నారు. చేయాలా?',
      'কাস্টমার সাপোর্ট AnyDesk বা TeamViewer ইনস্টল করতে বলছে। করব?',
    ],
    [
      'No. These apps let the other person see and use your phone, including your banking app, PIN and OTPs. Banks and payment apps do not need them to fix a refund or a KYC problem.',
      'नहीं। ये ऐप दूसरे व्यक्ति को आपका फ़ोन देखने और चलाने देते हैं, बैंकिंग ऐप, PIN और OTP समेत। रिफंड या KYC की समस्या ठीक करने के लिए बैंक या पेमेंट ऐप को इनकी ज़रूरत नहीं होती।',
      'వద్దు. ఈ యాప్‌లు మీ బ్యాంకింగ్ యాప్, పిన్, OTPలతో సహా మీ ఫోన్‌ను ఇతరులు చూడటానికి, వాడటానికి అనుమతిస్తాయి. రీఫండ్ లేదా KYC సమస్య పరిష్కరించడానికి బ్యాంకులకు, పేమెంట్ యాప్‌లకు ఇవి అవసరం లేదు.',
      'না। এই অ্যাপগুলো অন্য লোককে আপনার ফোন দেখতে আর চালাতে দেয়, ব্যাংকিং অ্যাপ, পিন আর OTP সমেত। রিফান্ড বা KYC-র সমস্যা মেটাতে ব্যাংক বা পেমেন্ট অ্যাপের এগুলো লাগে না।',
    ],
  ),
  item(
    'faq-refund',
    ['refund', 'cashback', 'pin', 'otp'],
    [
      'How do genuine refunds work?',
      'असली रिफंड कैसे आता है?',
      'నిజమైన రీఫండ్ ఎలా వస్తుంది?',
      'আসল রিফান্ড কীভাবে আসে?',
    ],
    [
      'A genuine refund goes back to the way you paid, on its own, usually within a few working days. It never needs your PIN, an OTP, a QR scan, a collect request or a "small fee" first.',
      'असली रिफंड अपने आप उसी तरीके में वापस आता है जिससे आपने भुगतान किया था, आम तौर पर कुछ कार्य दिवसों में। इसके लिए कभी PIN, OTP, QR स्कैन, कलेक्ट रिक्वेस्ट या पहले "छोटी फ़ीस" की ज़रूरत नहीं होती।',
      'నిజమైన రీఫండ్ మీరు చెల్లించిన మార్గంలోనే తనంతట తానే తిరిగి వస్తుంది, సాధారణంగా కొన్ని పని దినాల్లో. దీనికి పిన్, OTP, QR స్కాన్, కలెక్ట్ రిక్వెస్ట్ లేదా ముందుగా "చిన్న ఫీజు" ఎప్పుడూ అవసరం లేదు.',
      'আসল রিফান্ড নিজে থেকেই যে উপায়ে টাকা দিয়েছিলেন সেখানে ফেরত আসে, সাধারণত কয়েক কর্মদিবসে। এর জন্য কখনও পিন, OTP, QR স্ক্যান, কালেক্ট রিকোয়েস্ট বা আগে "ছোট ফি" লাগে না।',
    ],
  ),
  item(
    'faq-customer-care-search',
    ['customer care', 'helpline', 'search', 'number'],
    [
      'Can I trust a customer care number I found on the internet?',
      'क्या इंटरनेट पर मिले कस्टमर केयर नंबर पर भरोसा कर सकता हूं?',
      'ఇంటర్నెట్‌లో దొరికిన కస్టమర్ కేర్ నంబర్‌ను నమ్మవచ్చా?',
      'ইন্টারনেটে পাওয়া কাস্টমার কেয়ার নম্বরে কি ভরসা করা যায়?',
    ],
    [
      'Be careful. Scammers post fake helpline numbers in search results, ads and review sites. Take the number from the company\'s own app, its official website, or the back of your card.',
      'सावधान रहें। ठग सर्च रिज़ल्ट, विज्ञापनों और रिव्यू साइटों पर नकली हेल्पलाइन नंबर डालते हैं। नंबर कंपनी के अपने ऐप, उसकी आधिकारिक वेबसाइट या अपने कार्ड के पीछे से लें।',
      'జాగ్రత్త. మోసగాళ్లు సెర్చ్ ఫలితాలు, ప్రకటనలు, రివ్యూ సైట్‌లలో నకిలీ హెల్ప్‌లైన్ నంబర్లు పెడతారు. నంబర్‌ను కంపెనీ సొంత యాప్, అధికారిక వెబ్‌సైట్ లేదా మీ కార్డ్ వెనుక నుండి తీసుకోండి.',
      'সাবধান। প্রতারকেরা সার্চের ফল, বিজ্ঞাপন আর রিভিউ সাইটে ভুয়ো হেল্পলাইন নম্বর দেয়। নম্বর নিন কোম্পানির নিজের অ্যাপ, অফিসিয়াল ওয়েবসাইট বা কার্ডের পিছন থেকে।',
    ],
  ),
  item(
    'faq-job-tasks',
    ['job', 'task', 'part time', 'like', 'telegram'],
    [
      'A part-time job pays me to like videos, but now asks me to pay for the next task. Is it real?',
      'एक पार्ट-टाइम नौकरी वीडियो लाइक करने के पैसे देती है, पर अब अगले टास्क के लिए पैसे मांग रही है। क्या यह असली है?',
      'వీడియోలకు లైక్ చేస్తే డబ్బు ఇచ్చే పార్ట్ టైమ్ ఉద్యోగం ఇప్పుడు తదుపరి టాస్క్ కోసం డబ్బు అడుగుతోంది. ఇది నిజమా?',
      'ভিডিওতে লাইক দিলে টাকা দেয় এমন পার্ট টাইম কাজ এখন পরের টাস্কের জন্য টাকা চাইছে। এটা কি আসল?',
    ],
    [
      'No. A real job does not ask you to pay to work or to "recharge" to withdraw your earnings. The first small payouts are bait; the deposits get bigger and the money never comes out. Stop paying and report it.',
      'नहीं। असली नौकरी काम करने के लिए या कमाई निकालने के लिए "रिचार्ज" करने को नहीं कहती। शुरू के छोटे भुगतान चारा होते हैं; जमा रकम बढ़ती जाती है और पैसा कभी नहीं निकलता। पैसे देना बंद करें और शिकायत करें।',
      'లేదు. నిజమైన ఉద్యోగం పని చేయడానికి లేదా సంపాదన తీసుకోవడానికి "రీఛార్జ్" చేయమని అడగదు. మొదటి చిన్న చెల్లింపులు ఎర మాత్రమే; డిపాజిట్లు పెరుగుతూ పోతాయి, డబ్బు ఎప్పటికీ బయటకు రాదు. చెల్లించడం ఆపి ఫిర్యాదు చేయండి.',
      'না। আসল চাকরি কাজ করতে বা রোজগার তুলতে "রিচার্জ" করতে বলে না। প্রথমের ছোট টাকাগুলো টোপ; জমার অঙ্ক বাড়তে থাকে আর টাকা কখনও বেরোয় না। টাকা দেওয়া বন্ধ করে অভিযোগ করুন।',
    ],
  ),
  item(
    'faq-guaranteed-returns',
    ['investment', 'stock', 'crypto', 'returns', 'trading'],
    [
      'A group promises guaranteed returns on stocks or crypto. Should I invest?',
      'एक ग्रुप शेयर या क्रिप्टो पर पक्के मुनाफ़े का वादा करता है। क्या निवेश करूं?',
      'ఒక గ్రూప్ షేర్లు లేదా క్రిప్టోలో గ్యారంటీ లాభం అంటోంది. పెట్టుబడి పెట్టాలా?',
      'একটা গ্রুপ শেয়ার বা ক্রিপ্টোতে নিশ্চিত লাভের কথা বলছে। বিনিয়োগ করব?',
    ],
    [
      'No genuine investment can guarantee high returns. Groups that show big "profits", use their own trading app, and ask for tax or fees before you can withdraw are scams. Invest only through registered brokers and apps you find yourself.',
      'कोई भी असली निवेश ऊंचे मुनाफ़े की गारंटी नहीं दे सकता। जो ग्रुप बड़ा "मुनाफ़ा" दिखाते हैं, अपना ट्रेडिंग ऐप इस्तेमाल करवाते हैं, और पैसे निकालने से पहले टैक्स या फ़ीस मांगते हैं, वे ठग हैं। निवेश सिर्फ पंजीकृत ब्रोकर और खुद ढूंढे गए ऐप से करें।',
      'ఏ నిజమైన పెట్టుబడీ ఎక్కువ లాభాన్ని గ్యారంటీ చేయలేదు. పెద్ద "లాభాలు" చూపించి, తమ సొంత ట్రేడింగ్ యాప్ వాడించి, డబ్బు తీసుకునే ముందు పన్ను లేదా ఫీజు అడిగే గ్రూపులు మోసం. నమోదైన బ్రోకర్లు, మీరే వెతికిన యాప్‌ల ద్వారానే పెట్టుబడి పెట్టండి.',
      'কোনো আসল বিনিয়োগ বেশি লাভের নিশ্চয়তা দিতে পারে না। যে গ্রুপ বড় "লাভ" দেখায়, নিজেদের ট্রেডিং অ্যাপ ব্যবহার করায়, আর টাকা তোলার আগে কর বা ফি চায়, সেগুলো প্রতারণা। বিনিয়োগ করুন শুধু নথিভুক্ত ব্রোকার আর নিজে খুঁজে নেওয়া অ্যাপ দিয়ে।',
    ],
  ),
  item(
    'faq-wrong-transfer',
    ['wrong transfer', 'mistake', 'return money', 'sent by mistake'],
    [
      'A stranger says they sent me money by mistake and wants it back. What should I do?',
      'कोई अनजान कहता है कि उसने गलती से मुझे पैसे भेज दिए और वापस मांग रहा है। क्या करूं?',
      'పొరపాటున డబ్బు పంపానని ఒక అపరిచితుడు తిరిగి అడుగుతున్నారు. ఏం చేయాలి?',
      'অচেনা কেউ বলছে ভুল করে টাকা পাঠিয়েছে, ফেরত চাইছে। কী করব?',
    ],
    [
      'First check your balance in your bank\'s own app; screenshots can be fake. Do not send money to a different UPI ID or accept a request from them. If the credit is real, tell them to ask their bank to reverse it, or ask your own bank how to return it.',
      'पहले बैंक के अपने ऐप में बैलेंस देखें; स्क्रीनशॉट नकली हो सकते हैं। किसी दूसरी UPI ID पर पैसे न भेजें और उनकी रिक्वेस्ट स्वीकार न करें। अगर पैसे सच में आए हैं, तो उन्हें अपने बैंक से रिवर्स कराने को कहें, या अपने बैंक से वापस करने का तरीका पूछें।',
      'ముందు మీ బ్యాంక్ సొంత యాప్‌లో బ్యాలెన్స్ చూడండి; స్క్రీన్‌షాట్‌లు నకిలీవి కావచ్చు. వేరే UPI IDకి డబ్బు పంపకండి, వారి రిక్వెస్ట్‌ను అంగీకరించకండి. డబ్బు నిజంగా వస్తే, తమ బ్యాంక్ ద్వారా రివర్స్ చేయించుకోమని చెప్పండి, లేదా మీ బ్యాంక్‌ను తిరిగి ఇచ్చే మార్గం అడగండి.',
      'আগে ব্যাংকের নিজের অ্যাপে ব্যালেন্স দেখুন; স্ক্রিনশট ভুয়ো হতে পারে। অন্য কোনো UPI ID-তে টাকা পাঠাবেন না, ওদের রিকোয়েস্টও মানবেন না। টাকা সত্যিই এলে ওদের নিজেদের ব্যাংক থেকে ফেরত করাতে বলুন, বা নিজের ব্যাংকের কাছে ফেরত দেওয়ার উপায় জেনে নিন।',
    ],
  ),
  item(
    'faq-shared-otp',
    ['otp', 'shared', 'what now', 'mistake'],
    [
      'I already shared an OTP. What now?',
      'मैंने OTP बता दिया है। अब क्या करूं?',
      'నేను ఇప్పటికే OTP చెప్పేశాను. ఇప్పుడు ఏం చేయాలి?',
      'আমি OTP বলে দিয়েছি। এখন কী করব?',
    ],
    [
      'Act now. Call your bank on its official number and tell them; change your net banking and app passwords; check your recent transactions. If money has gone, call 1930. The Emergency page in this app gives you a checklist.',
      'तुरंत कदम उठाएं। बैंक के आधिकारिक नंबर पर कॉल करके बताएं; नेट बैंकिंग और ऐप के पासवर्ड बदलें; हाल के लेनदेन देखें। पैसे गए हों तो 1930 पर कॉल करें। इस ऐप का इमरजेंसी पेज पूरी सूची देता है।',
      'వెంటనే చర్య తీసుకోండి. బ్యాంక్ అధికారిక నంబర్‌కు కాల్ చేసి చెప్పండి; నెట్ బ్యాంకింగ్, యాప్ పాస్‌వర్డ్‌లు మార్చండి; ఇటీవలి లావాదేవీలు చూడండి. డబ్బు పోతే 1930 కు కాల్ చేయండి. ఈ యాప్‌లోని ఎమర్జెన్సీ పేజీ పూర్తి జాబితా ఇస్తుంది.',
      'এখনই ব্যবস্থা নিন। ব্যাংকের অফিসিয়াল নম্বরে ফোন করে জানান; নেট ব্যাংকিং আর অ্যাপের পাসওয়ার্ড বদলান; সাম্প্রতিক লেনদেন দেখুন। টাকা গেলে 1930-এ ফোন করুন। এই অ্যাপের ইমার্জেন্সি পাতায় পুরো তালিকা আছে।',
    ],
  ),
  item(
    'faq-sent-money',
    ['paid', 'lost money', 'scammed', 'what now', '1930'],
    [
      'I paid a scammer. Can I get my money back?',
      'मैंने ठग को पैसे दे दिए। क्या पैसे वापस मिल सकते हैं?',
      'నేను మోసగాడికి డబ్బు చెల్లించాను. డబ్బు తిరిగి వస్తుందా?',
      'আমি প্রতারককে টাকা দিয়ে ফেলেছি। টাকা কি ফেরত পাব?',
    ],
    [
      'Sometimes, if you report fast. Call 1930 or file at cybercrime.gov.in straight away, then call your bank with the transaction ID (UTR). Banks can try to hold money that has not yet moved on. Nobody can promise it will come back, so be wary of anyone who offers to "recover" it for a fee.',
      'कभी-कभी, अगर आप जल्दी शिकायत करें। तुरंत 1930 पर कॉल करें या cybercrime.gov.in पर शिकायत करें, फिर लेनदेन संख्या (UTR) के साथ बैंक को कॉल करें। जो पैसा अभी आगे नहीं गया, बैंक उसे रोकने की कोशिश कर सकते हैं। कोई वापसी का वादा नहीं कर सकता, इसलिए फ़ीस लेकर पैसे "वापस दिलाने" वालों से सावधान रहें।',
      'కొన్నిసార్లు, మీరు త్వరగా ఫిర్యాదు చేస్తే. వెంటనే 1930 కు కాల్ చేయండి లేదా cybercrime.gov.in లో ఫిర్యాదు చేయండి, తర్వాత లావాదేవీ నంబర్ (UTR)తో బ్యాంక్‌కు కాల్ చేయండి. ఇంకా ముందుకు వెళ్లని డబ్బును ఆపడానికి బ్యాంకులు ప్రయత్నించగలవు. డబ్బు తిరిగి వస్తుందని ఎవరూ హామీ ఇవ్వలేరు, కాబట్టి ఫీజు తీసుకుని "తిరిగి ఇప్పిస్తాం" అనేవారితో జాగ్రత్త.',
      'কখনও কখনও, যদি তাড়াতাড়ি জানান। সঙ্গে সঙ্গে 1930-এ ফোন করুন বা cybercrime.gov.in-এ অভিযোগ করুন, তারপর লেনদেন নম্বর (UTR) নিয়ে ব্যাংকে ফোন করুন। যে টাকা এখনও সরেনি, ব্যাংক তা আটকানোর চেষ্টা করতে পারে। কেউ ফেরতের নিশ্চয়তা দিতে পারে না, তাই ফি নিয়ে টাকা "উদ্ধার" করে দেওয়ার কথা যে বলে, তার থেকে সাবধান।',
    ],
  ),
  item(
    'faq-chakshu',
    ['chakshu', 'sanchar saathi', 'report number', 'spam'],
    [
      'What is Chakshu?',
      'चक्षु क्या है?',
      'చక్షు అంటే ఏమిటి?',
      'চক্ষু কী?',
    ],
    [
      'Chakshu is a facility on the government\'s Sanchar Saathi portal (sancharsaathi.gov.in) for reporting suspected fraud calls, SMS and WhatsApp messages. Use it when you were targeted but lost nothing. If money was lost, call 1930 or use cybercrime.gov.in instead.',
      'चक्षु सरकार के संचार साथी पोर्टल (sancharsaathi.gov.in) पर संदिग्ध धोखाधड़ी वाले कॉल, SMS और WhatsApp मैसेज की शिकायत करने की सुविधा है। इसका इस्तेमाल तब करें जब आपको निशाना बनाया गया पर कोई नुकसान नहीं हुआ। पैसे गए हों तो 1930 पर कॉल करें या cybercrime.gov.in इस्तेमाल करें।',
      'చక్షు అనేది ప్రభుత్వ సంచార్ సాథీ పోర్టల్ (sancharsaathi.gov.in) లో అనుమానాస్పద మోసపు కాల్స్, SMS, WhatsApp మెసేజ్‌లపై ఫిర్యాదు చేసే సదుపాయం. మిమ్మల్ని లక్ష్యంగా చేసుకున్నా నష్టం జరగనప్పుడు దీన్ని వాడండి. డబ్బు పోతే 1930 కు కాల్ చేయండి లేదా cybercrime.gov.in వాడండి.',
      'চক্ষু হল সরকারের সঞ্চার সাথী পোর্টালে (sancharsaathi.gov.in) সন্দেহজনক প্রতারণার ফোন, SMS আর WhatsApp মেসেজের অভিযোগ জানানোর ব্যবস্থা। আপনাকে নিশানা করা হয়েছে কিন্তু কিছু হারাননি, তখন এটা ব্যবহার করুন। টাকা গেলে 1930-এ ফোন করুন বা cybercrime.gov.in ব্যবহার করুন।',
    ],
  ),
  item(
    'faq-1930',
    ['1930', 'helpline', 'cyber crime'],
    [
      'What is 1930?',
      '1930 क्या है?',
      '1930 అంటే ఏమిటి?',
      '1930 কী?',
    ],
    [
      '1930 is the national cyber crime helpline in India. Call it as soon as you notice money has been taken through online fraud.',
      '1930 भारत की राष्ट्रीय साइबर क्राइम हेल्पलाइन है। ऑनलाइन धोखाधड़ी से पैसे जाने का पता चलते ही इस पर कॉल करें।',
      '1930 భారతదేశ జాతీయ సైబర్ క్రైమ్ హెల్ప్‌లైన్. ఆన్‌లైన్ మోసంతో డబ్బు పోయిందని తెలిసిన వెంటనే దీనికి కాల్ చేయండి.',
      '1930 ভারতের জাতীয় সাইবার ক্রাইম হেল্পলাইন। অনলাইন প্রতারণায় টাকা গেছে বুঝলেই এখানে ফোন করুন।',
    ],
  ),
  item(
    'faq-electricity-cut',
    ['electricity', 'bill', 'disconnection', 'power cut'],
    [
      'A message says my electricity will be cut tonight. Should I call the officer\'s number?',
      'मैसेज आया है कि आज रात बिजली कट जाएगी। क्या अधिकारी के नंबर पर कॉल करूं?',
      'ఈ రాత్రి కరెంట్ కట్ చేస్తారని మెసేజ్ వచ్చింది. అధికారి నంబర్‌కు కాల్ చేయాలా?',
      'মেসেজ এসেছে আজ রাতে বিদ্যুৎ কেটে দেবে। অফিসারের নম্বরে ফোন করব?',
    ],
    [
      'No. Electricity boards send bills and reminders, not threats from a personal mobile number. Check your bill in the board\'s official app or website, or at the bill counter. Never install an app or share card details to "update" a bill.',
      'नहीं। बिजली विभाग बिल और रिमाइंडर भेजता है, किसी निजी मोबाइल नंबर से धमकी नहीं। अपना बिल विभाग के आधिकारिक ऐप, वेबसाइट या बिल काउंटर पर देखें। बिल "अपडेट" करने के लिए कभी कोई ऐप इंस्टॉल न करें, न कार्ड की जानकारी दें।',
      'వద్దు. విద్యుత్ సంస్థలు బిల్లులు, రిమైండర్లు పంపుతాయి, వ్యక్తిగత మొబైల్ నంబర్ నుండి బెదిరింపులు కాదు. మీ బిల్లును సంస్థ అధికారిక యాప్, వెబ్‌సైట్ లేదా బిల్ కౌంటర్‌లో చూడండి. బిల్ "అప్‌డేట్" కోసం ఎప్పుడూ యాప్ ఇన్‌స్టాల్ చేయకండి, కార్డ్ వివరాలు ఇవ్వకండి.',
      'না। বিদ্যুৎ দপ্তর বিল আর রিমাইন্ডার পাঠায়, ব্যক্তিগত মোবাইল নম্বর থেকে হুমকি নয়। বিল দেখুন দপ্তরের অফিসিয়াল অ্যাপ, ওয়েবসাইট বা বিল কাউন্টারে। বিল "আপডেট" করতে কখনও অ্যাপ ইনস্টল করবেন না, কার্ডের তথ্যও দেবেন না।',
    ],
  ),
  item(
    'faq-courier-fee',
    ['courier', 'parcel', 'customs', 'delivery fee'],
    [
      'A courier says my parcel is held and I must pay a small fee. Is it real?',
      'कूरियर वाले कहते हैं कि पार्सल रुका है और छोटी फ़ीस देनी होगी। क्या यह सच है?',
      'పార్సెల్ ఆగిపోయింది, చిన్న ఫీజు కట్టాలి అని కొరియర్ అంటోంది. ఇది నిజమా?',
      'কুরিয়ার বলছে পার্সেল আটকে আছে, ছোট ফি দিতে হবে। এটা কি সত্যি?',
    ],
    [
      'Usually not. Fake "redelivery" and "customs" messages link to lookalike sites that steal card details. Check the tracking number on the courier\'s official website or app, which you type in yourself.',
      'अक्सर नहीं। नकली "री-डिलीवरी" और "कस्टम" मैसेज मिलती-जुलती साइटों पर ले जाते हैं जो कार्ड की जानकारी चुरा लेती हैं। ट्रैकिंग नंबर कूरियर की आधिकारिक वेबसाइट या ऐप पर खुद टाइप करके जांचें।',
      'సాధారణంగా కాదు. నకిలీ "రీడెలివరీ", "కస్టమ్స్" మెసేజ్‌లు కార్డ్ వివరాలు దొంగిలించే నకిలీ సైట్‌లకు తీసుకెళ్తాయి. ట్రాకింగ్ నంబర్‌ను కొరియర్ అధికారిక వెబ్‌సైట్ లేదా యాప్‌లో మీరే టైప్ చేసి చూడండి.',
      'সাধারণত না। ভুয়ো "রিডেলিভারি" আর "কাস্টমস" মেসেজ নকল সাইটে নিয়ে যায়, যারা কার্ডের তথ্য চুরি করে। ট্র্যাকিং নম্বর কুরিয়ারের অফিসিয়াল ওয়েবসাইট বা অ্যাপে নিজে টাইপ করে দেখুন।',
    ],
  ),
  item(
    'faq-lottery',
    ['lottery', 'prize', 'kbc', 'lucky draw'],
    [
      'I won a lottery or lucky draw I never entered. How do I claim it?',
      'मैंने ऐसी लॉटरी या लकी ड्रॉ जीता है जिसमें हिस्सा ही नहीं लिया। इनाम कैसे लूं?',
      'నేను పాల్గొనని లాటరీ లేదా లక్కీ డ్రా గెలిచానట. బహుమతి ఎలా తీసుకోవాలి?',
      'যে লটারি বা লাকি ড্র-তে নামই দিইনি, সেটা জিতেছি বলছে। পুরস্কার কীভাবে নেব?',
    ],
    [
      'You cannot win a draw you did not enter. Messages about KBC, brand anniversaries or lucky draws that ask for a tax or processing fee are scams. Do not pay, and do not share bank details.',
      'जिस ड्रॉ में आपने हिस्सा नहीं लिया, उसे आप जीत नहीं सकते। KBC, किसी ब्रांड की सालगिरह या लकी ड्रॉ के नाम पर टैक्स या प्रोसेसिंग फ़ीस मांगने वाले मैसेज ठगी हैं। पैसे न दें और बैंक की जानकारी न बताएं।',
      'మీరు పాల్గొనని డ్రా గెలవలేరు. KBC, బ్రాండ్ వార్షికోత్సవం లేదా లక్కీ డ్రా పేరుతో పన్ను లేదా ప్రాసెసింగ్ ఫీజు అడిగే మెసేజ్‌లు మోసం. డబ్బు చెల్లించకండి, బ్యాంక్ వివరాలు చెప్పకండి.',
      'যে ড্র-তে নাম দেননি, সেটা জেতা যায় না। KBC, কোনো ব্র্যান্ডের বর্ষপূর্তি বা লাকি ড্র-র নামে কর বা প্রসেসিং ফি চাওয়া মেসেজ প্রতারণা। টাকা দেবেন না, ব্যাংকের তথ্যও বলবেন না।',
    ],
  ),
  item(
    'faq-loan-app',
    ['loan', 'instant loan', 'app', 'harassment', 'processing fee'],
    [
      'An app offers an instant loan without documents. What should I watch for?',
      'एक ऐप बिना कागज़ात के तुरंत लोन देता है। किन बातों का ध्यान रखूं?',
      'ఒక యాప్ పత్రాలు లేకుండా వెంటనే లోన్ ఇస్తానంటోంది. దేనిపై జాగ్రత్తగా ఉండాలి?',
      'একটা অ্যাপ কাগজপত্র ছাড়াই সঙ্গে সঙ্গে লোন দিচ্ছে। কী খেয়াল রাখব?',
    ],
    [
      'Be wary of any lender that asks for a fee before paying out, or an app that wants access to your contacts and photos. Some use that access to threaten borrowers. Borrow only from banks and lenders you can check are registered, through apps from the Play Store.',
      'जो लोन देने से पहले फ़ीस मांगे, या जो ऐप आपके कॉन्टैक्ट और फ़ोटो की अनुमति मांगे, उससे सावधान रहें। कुछ ऐप इसी अनुमति से कर्ज़ लेने वालों को धमकाते हैं। सिर्फ उन बैंकों और कर्जदाताओं से लोन लें जिनका पंजीकरण आप जांच सकें, Play Store के ऐप से।',
      'లోన్ ఇచ్చే ముందు ఫీజు అడిగే రుణదాత, లేదా మీ కాంటాక్ట్స్, ఫోటోలకు అనుమతి అడిగే యాప్ పట్ల జాగ్రత్త. కొన్ని యాప్‌లు ఆ అనుమతితో అప్పు తీసుకున్నవారిని బెదిరిస్తాయి. నమోదైనవని మీరు చూసుకోగల బ్యాంకులు, రుణదాతల నుండే, Play Store యాప్‌ల ద్వారా అప్పు తీసుకోండి.',
      'লোন দেওয়ার আগে যে ফি চায়, বা যে অ্যাপ আপনার কন্ট্যাক্ট আর ছবির অনুমতি চায়, তার থেকে সাবধান। কিছু অ্যাপ সেই অনুমতি দিয়ে ঋণগ্রহীতাদের হুমকি দেয়। শুধু এমন ব্যাংক আর ঋণদাতার কাছ থেকে নিন যাদের নথিভুক্তি যাচাই করা যায়, Play Store-এর অ্যাপ দিয়ে।',
    ],
  ),
  item(
    'faq-sim-block',
    ['sim', 'trai', 'number blocked', 'telecom'],
    [
      'A caller says my SIM will be blocked in two hours. What should I do?',
      'कॉल आया कि दो घंटे में मेरा सिम बंद हो जाएगा। क्या करूं?',
      'రెండు గంటల్లో మీ సిమ్ బ్లాక్ అవుతుందని కాల్ వచ్చింది. ఏం చేయాలి?',
      'ফোনে বলছে দু ঘণ্টার মধ্যে আমার সিম বন্ধ হয়ে যাবে। কী করব?',
    ],
    [
      'Hang up. Telecom regulators and police do not call to block your SIM, and pressing a number to "speak to an officer" is how the scam continues. For problems with your connection, use your operator\'s own app or store.',
      'फ़ोन काट दें। टेलीकॉम नियामक या पुलिस सिम बंद करने के लिए फ़ोन नहीं करते, और "अधिकारी से बात" के लिए कोई बटन दबाना ही ठगी का अगला कदम है। कनेक्शन की किसी समस्या के लिए अपने ऑपरेटर का ऐप या स्टोर इस्तेमाल करें।',
      'కాల్ కట్ చేయండి. టెలికాం నియంత్రణ సంస్థలు, పోలీసులు సిమ్ బ్లాక్ చేయడానికి కాల్ చేయరు, "అధికారితో మాట్లాడటానికి" బటన్ నొక్కడమే మోసంలో తదుపరి అడుగు. కనెక్షన్ సమస్యలకు మీ ఆపరేటర్ సొంత యాప్ లేదా స్టోర్‌ను వాడండి.',
      'ফোন রেখে দিন। টেলিকম নিয়ন্ত্রক বা পুলিশ সিম বন্ধ করতে ফোন করে না, আর "অফিসারের সঙ্গে কথা" বলতে বোতাম টেপাই প্রতারণার পরের ধাপ। সংযোগের সমস্যায় অপারেটরের নিজের অ্যাপ বা দোকানে যান।',
    ],
  ),
  item(
    'faq-police-money',
    ['police', 'fine', 'money', 'safe account', 'rbi'],
    [
      'An officer asks me to move my savings to a "safe" or RBI account for checking. Should I?',
      'एक अधिकारी जांच के लिए मेरी बचत को "सुरक्षित" या RBI खाते में भेजने को कह रहा है। भेजूं?',
      'తనిఖీ కోసం నా పొదుపును "సురక్షిత" లేదా RBI ఖాతాకు పంపమని ఒక అధికారి అంటున్నారు. పంపాలా?',
      'একজন অফিসার যাচাইয়ের জন্য আমার সঞ্চয় একটা "নিরাপদ" বা RBI অ্যাকাউন্টে পাঠাতে বলছে। পাঠাব?',
    ],
    [
      'Never. No police force, court, RBI or tax department asks people to transfer money to "verify" it. Whoever asks is stealing it. End the call and tell someone you trust.',
      'कभी नहीं। कोई पुलिस, अदालत, RBI या टैक्स विभाग पैसे "जांचने" के लिए ट्रांसफ़र करने को नहीं कहता। जो कहता है, वह पैसे चुरा रहा है। कॉल काटें और किसी भरोसेमंद व्यक्ति को बताएं।',
      'ఎప్పుడూ వద్దు. ఏ పోలీసులు, కోర్టు, RBI లేదా పన్ను శాఖ డబ్బును "తనిఖీ" చేయడానికి బదిలీ చేయమని అడగవు. అడిగేవారు దొంగిలిస్తున్నారు. కాల్ కట్ చేసి, మీరు నమ్మే వారికి చెప్పండి.',
      'কখনও না। কোনো পুলিশ, আদালত, RBI বা কর দপ্তর টাকা "যাচাই" করতে ট্রান্সফার করতে বলে না। যে বলে, সে টাকা চুরি করছে। ফোন কেটে দিন, ভরসার কাউকে জানান।',
    ],
  ),
  item(
    'faq-short-links',
    ['short link', 'bit.ly', 'link', 'url'],
    [
      'Why are shortened links risky?',
      'छोटे किए गए लिंक जोखिम भरे क्यों होते हैं?',
      'చిన్నగా చేసిన లింక్‌లు ఎందుకు ప్రమాదకరం?',
      'ছোট করা লিঙ্ক কেন ঝুঁকির?',
    ],
    [
      'A short link hides where it really goes, so you cannot read the site name before you tap. Banks and government offices rarely send them for anything involving money or logins. When online, Akshi Rakshak can follow the link for you and show the final address.',
      'छोटा लिंक असली पता छिपा देता है, इसलिए दबाने से पहले साइट का नाम नहीं पढ़ सकते। बैंक और सरकारी दफ़्तर पैसे या लॉगिन वाले काम के लिए ऐसे लिंक कम ही भेजते हैं। ऑनलाइन होने पर अक्षि रक्षक लिंक को आगे खोलकर आखिरी पता दिखा सकता है।',
      'చిన్న లింక్ అసలు ఎక్కడికి వెళ్తుందో దాచేస్తుంది, కాబట్టి నొక్కే ముందు సైట్ పేరు చదవలేరు. డబ్బు లేదా లాగిన్ పనులకు బ్యాంకులు, ప్రభుత్వ కార్యాలయాలు ఇలాంటివి అరుదుగా పంపుతాయి. ఆన్‌లైన్‌లో ఉన్నప్పుడు అక్షి రక్షక్ లింక్‌ను అనుసరించి చివరి చిరునామాను చూపగలదు.',
      'ছোট লিঙ্ক আসল ঠিকানা লুকিয়ে রাখে, তাই চাপার আগে সাইটের নাম পড়া যায় না। টাকা বা লগইনের ব্যাপারে ব্যাংক আর সরকারি দপ্তর এমন লিঙ্ক কমই পাঠায়। অনলাইনে থাকলে অক্ষি রক্ষক লিঙ্কটা অনুসরণ করে শেষ ঠিকানা দেখাতে পারে।',
    ],
  ),
  item(
    'faq-help-elders',
    ['parents', 'elderly', 'family', 'elder mode'],
    [
      'How can I help my parents avoid these scams?',
      'अपने माता-पिता को इन ठगियों से बचने में कैसे मदद करूं?',
      'నా తల్లిదండ్రులు ఈ మోసాలకు గురి కాకుండా ఎలా సహాయం చేయాలి?',
      'বাবা-মাকে এই প্রতারণা থেকে বাঁচতে কীভাবে সাহায্য করব?',
    ],
    [
      'Agree on three simple rules: never share a PIN or OTP, never install an app someone sends, and call family before paying anyone who is in a hurry. Turn on Elder mode in this app for large text and a clear STOP screen, and save your number as their trusted contact.',
      'तीन आसान नियम तय करें: PIN या OTP कभी न बताएं, किसी का भेजा ऐप कभी इंस्टॉल न करें, और जल्दबाज़ी करने वाले किसी को भी पैसे देने से पहले परिवार को फ़ोन करें। इस ऐप में बुज़ुर्ग मोड चालू करें, बड़े अक्षर और साफ़ STOP स्क्रीन के लिए, और अपना नंबर उनके भरोसेमंद संपर्क के रूप में सेव करें।',
      'మూడు సులువైన నియమాలు పెట్టుకోండి: పిన్ లేదా OTP ఎప్పుడూ చెప్పకూడదు, ఎవరో పంపిన యాప్ ఎప్పుడూ ఇన్‌స్టాల్ చేయకూడదు, తొందరపెట్టే వారికి డబ్బు ఇచ్చే ముందు కుటుంబానికి ఫోన్ చేయాలి. పెద్ద అక్షరాలు, స్పష్టమైన STOP స్క్రీన్ కోసం ఈ యాప్‌లో పెద్దల మోడ్ ఆన్ చేసి, మీ నంబర్‌ను వారి నమ్మకమైన కాంటాక్ట్‌గా సేవ్ చేయండి.',
      'তিনটে সহজ নিয়ম ঠিক করুন: পিন বা OTP কখনও বলবেন না, কারও পাঠানো অ্যাপ কখনও ইনস্টল করবেন না, আর তাড়া দেওয়া কাউকে টাকা দেওয়ার আগে পরিবারকে ফোন করবেন। বড় লেখা আর পরিষ্কার STOP স্ক্রিনের জন্য এই অ্যাপে বয়স্ক মোড চালু করুন, আর নিজের নম্বর ওঁদের ভরসার কন্ট্যাক্ট হিসেবে সেভ করুন।',
    ],
  ),
  item(
    'faq-how-it-works',
    ['how it works', 'akshi rakshak', 'model', 'offline'],
    [
      'How does Akshi Rakshak decide whether a message is a scam?',
      'अक्षि रक्षक कैसे तय करता है कि मैसेज ठगी है या नहीं?',
      'మెసేజ్ మోసమో కాదో అక్షి రక్షక్ ఎలా నిర్ణయిస్తుంది?',
      'মেসেজটা প্রতারণা কি না অক্ষি রক্ষক কীভাবে ঠিক করে?',
    ],
    [
      'It combines checks that run on your phone: rules for warning phrases in four languages, checks on links, UPI IDs and phone numbers, and a small trained model. It shows the phrases and reasons behind each verdict. It can be wrong, so treat the result as advice and check with the real organisation when in doubt.',
      'यह आपके फ़ोन पर चलने वाली जांचों को जोड़ता है: चार भाषाओं में खतरे वाले वाक्यांशों के नियम, लिंक, UPI ID और फ़ोन नंबर की जांच, और एक छोटा प्रशिक्षित मॉडल। हर नतीजे के पीछे के वाक्यांश और कारण दिखाता है। यह गलत भी हो सकता है, इसलिए नतीजे को सलाह मानें और शक हो तो असली संस्था से पुष्टि करें।',
      'ఇది మీ ఫోన్‌లోనే నడిచే తనిఖీలను కలుపుతుంది: నాలుగు భాషల్లో హెచ్చరిక పదబంధాల నియమాలు, లింక్‌లు, UPI IDలు, ఫోన్ నంబర్ల తనిఖీలు, ఒక చిన్న శిక్షణ పొందిన మోడల్. ప్రతి ఫలితం వెనుక ఉన్న పదబంధాలు, కారణాలు చూపిస్తుంది. ఇది తప్పు కావచ్చు, కాబట్టి ఫలితాన్ని సలహాగా తీసుకోండి, అనుమానం ఉంటే అసలు సంస్థతో నిర్ధారించుకోండి.',
      'এটা আপনার ফোনেই চলা কয়েকটা যাচাই মেলায়: চার ভাষায় সতর্ক-বাক্যাংশের নিয়ম, লিঙ্ক, UPI ID আর ফোন নম্বরের যাচাই, আর একটা ছোট প্রশিক্ষিত মডেল। প্রতিটা ফলের পিছনের বাক্যাংশ আর কারণ দেখায়। এটা ভুলও হতে পারে, তাই ফলটাকে পরামর্শ হিসেবে নিন, সন্দেহ হলে আসল সংস্থার কাছে যাচাই করুন।',
    ],
  ),
  item(
    'faq-what-stored',
    ['privacy', 'data', 'history', 'stored', 'delete'],
    [
      'What does Akshi Rakshak store, and where?',
      'अक्षि रक्षक क्या सहेजता है, और कहां?',
      'అక్షి రక్షక్ ఏమి దాచుకుంటుంది, ఎక్కడ?',
      'অক্ষি রক্ষক কী রাখে, আর কোথায়?',
    ],
    [
      'Your scan history, blocklist and settings stay in your browser on this device. Nothing you check is sent anywhere unless you switch on the AI second opinion. You can delete everything from the privacy settings at any time.',
      'आपका स्कैन इतिहास, ब्लॉक सूची और सेटिंग्स इसी डिवाइस के ब्राउज़र में रहती हैं। जब तक आप AI दूसरी राय चालू न करें, आपकी जांची कोई चीज़ कहीं नहीं भेजी जाती। प्राइवेसी सेटिंग्स से आप कभी भी सब कुछ मिटा सकते हैं।',
      'మీ స్కాన్ చరిత్ర, బ్లాక్ జాబితా, సెట్టింగ్స్ ఈ పరికరంలోని బ్రౌజర్‌లోనే ఉంటాయి. మీరు AI రెండో అభిప్రాయం ఆన్ చేస్తే తప్ప మీరు తనిఖీ చేసేది ఎక్కడికీ పంపబడదు. ప్రైవసీ సెట్టింగ్స్ నుండి ఎప్పుడైనా అన్నీ తొలగించవచ్చు.',
      'আপনার স্ক্যানের ইতিহাস, ব্লক তালিকা আর সেটিংস এই ডিভাইসের ব্রাউজারেই থাকে। AI দ্বিতীয় মত চালু না করলে আপনার যাচাই করা কিছুই কোথাও পাঠানো হয় না। প্রাইভেসি সেটিংস থেকে যখন খুশি সব মুছে দিতে পারেন।',
    ],
  ),
  item(
    'faq-ai-second-opinion',
    ['ai', 'second opinion', 'privacy', 'masked', 'online'],
    [
      'What is the AI second opinion, and what does it send?',
      'AI दूसरी राय क्या है, और यह क्या भेजती है?',
      'AI రెండో అభిప్రాయం అంటే ఏమిటి, ఇది ఏమి పంపుతుంది?',
      'AI দ্বিতীয় মত কী, আর এটা কী পাঠায়?',
    ],
    [
      'It is an optional extra check by an online AI model. It is off until you switch it on. When on, the message is sent with phone numbers, UPI IDs, account numbers and emails replaced by tags, so those details do not leave your phone.',
      'यह एक ऑनलाइन AI मॉडल से वैकल्पिक अतिरिक्त जांच है। जब तक आप चालू न करें, यह बंद रहती है। चालू होने पर मैसेज इस तरह भेजा जाता है कि फ़ोन नंबर, UPI ID, खाता संख्या और ईमेल की जगह टैग होते हैं, ताकि ये जानकारियां आपके फ़ोन से बाहर न जाएं।',
      'ఇది ఆన్‌లైన్ AI మోడల్ చేసే ఐచ్ఛిక అదనపు తనిఖీ. మీరు ఆన్ చేసే వరకు ఇది ఆఫ్‌లో ఉంటుంది. ఆన్ చేసినప్పుడు ఫోన్ నంబర్లు, UPI IDలు, ఖాతా నంబర్లు, ఈమెయిల్‌ల స్థానంలో ట్యాగ్‌లు పెట్టి మెసేజ్ పంపుతుంది, కాబట్టి ఆ వివరాలు మీ ఫోన్ నుండి బయటకు వెళ్లవు.',
      'এটা একটা অনলাইন AI মডেলের ঐচ্ছিক বাড়তি যাচাই। আপনি চালু না করা পর্যন্ত বন্ধ থাকে। চালু থাকলে মেসেজটা পাঠানো হয় ফোন নম্বর, UPI ID, অ্যাকাউন্ট নম্বর আর ইমেলের জায়গায় ট্যাগ বসিয়ে, যাতে ওই তথ্য আপনার ফোনের বাইরে না যায়।',
    ],
  ),
  item(
    'faq-verdict-meaning',
    ['verdict', 'no warning signs', 'result', 'meaning'],
    [
      'If Akshi Rakshak says "No warning signs found", is the message definitely genuine?',
      'अगर अक्षि रक्षक कहे "कोई चेतावनी संकेत नहीं मिला", तो क्या मैसेज पक्का असली है?',
      'అక్షి రక్షక్ "హెచ్చరిక సంకేతాలు కనిపించలేదు" అంటే మెసేజ్ ఖచ్చితంగా నిజమైనదేనా?',
      'অক্ষি রক্ষক "কোনো সতর্কতার চিহ্ন পাওয়া যায়নি" বললে কি মেসেজটা নিশ্চিত আসল?',
    ],
    [
      'Not definitely. It means none of our checks found the usual signs of a scam. New tricks can look ordinary. If a message asks for money, a PIN, an OTP or an app install, check with the organisation through its official app or number first.',
      'पक्का नहीं। इसका मतलब है कि हमारी किसी जांच को ठगी के आम संकेत नहीं मिले। नई चालें साधारण भी दिख सकती हैं। अगर मैसेज पैसे, PIN, OTP या ऐप इंस्टॉल मांगे, तो पहले संस्था के आधिकारिक ऐप या नंबर से पुष्टि करें।',
      'ఖచ్చితంగా కాదు. మా తనిఖీలు ఏవీ సాధారణ మోసపు సంకేతాలను కనుగొనలేదని అర్థం. కొత్త మోసాలు సాధారణంగా కనిపించవచ్చు. మెసేజ్ డబ్బు, పిన్, OTP లేదా యాప్ ఇన్‌స్టాల్ అడిగితే, ముందుగా సంస్థ అధికారిక యాప్ లేదా నంబర్ ద్వారా నిర్ధారించుకోండి.',
      'নিশ্চিত নয়। এর মানে আমাদের কোনো যাচাইয়ে প্রতারণার চেনা চিহ্ন মেলেনি। নতুন কৌশল সাধারণ দেখাতে পারে। মেসেজ যদি টাকা, পিন, OTP বা অ্যাপ ইনস্টল চায়, আগে সংস্থার অফিসিয়াল অ্যাপ বা নম্বরে যাচাই করুন।',
    ],
  ),
  item(
    'faq-otp-delivery',
    ['otp', 'delivery', 'code', 'whatsapp code'],
    [
      'Someone says they entered my number by mistake and asks me to forward the code I just got. Should I?',
      'कोई कहता है कि उसने गलती से मेरा नंबर डाल दिया और अभी आया कोड भेजने को कहता है। भेजूं?',
      'పొరపాటున నా నంబర్ ఇచ్చానని, ఇప్పుడు వచ్చిన కోడ్ పంపమని ఎవరో అడుగుతున్నారు. పంపాలా?',
      'কেউ বলছে ভুল করে আমার নম্বর দিয়েছে, এখন আসা কোডটা পাঠাতে বলছে। পাঠাব?',
    ],
    [
      'No. That code lets someone log in to your WhatsApp, bank or shopping account. Never forward a code to anyone, even a friend\'s number: the friend\'s account may already have been taken over.',
      'नहीं। उस कोड से कोई आपके WhatsApp, बैंक या शॉपिंग खाते में लॉगिन कर सकता है। कोड कभी किसी को न भेजें, किसी दोस्त के नंबर पर भी नहीं: हो सकता है दोस्त का खाता पहले ही किसी और के कब्ज़े में हो।',
      'వద్దు. ఆ కోడ్‌తో ఎవరైనా మీ WhatsApp, బ్యాంక్ లేదా షాపింగ్ ఖాతాలోకి లాగిన్ కావచ్చు. ఎవరికీ కోడ్ పంపకండి, స్నేహితుడి నంబర్‌కు కూడా: ఆ స్నేహితుడి ఖాతా ఇప్పటికే వేరేవారి చేతిలో ఉండవచ్చు.',
      'না। ওই কোড দিয়ে কেউ আপনার WhatsApp, ব্যাংক বা শপিং অ্যাকাউন্টে লগইন করতে পারে। কাউকে কোড পাঠাবেন না, বন্ধুর নম্বরেও না: বন্ধুর অ্যাকাউন্ট হয়তো আগেই অন্য কারও দখলে।',
    ],
  ),
];
