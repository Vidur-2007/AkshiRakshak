import type { Drill, DrillChoice, DrillNode, L10n, SignalId } from '@akshi/contracts';

/**
 * Scam Dojo drills (SPEC.md M11.1, SPEC_C_DATA.md §7): scripted chats where the player picks a reply.
 * Every drill has a path that ends "safe" (the player kept their money) and one that ends "scammed", 2–3
 * choices at each decision, feedback on every choice, and a red flag on the key moments.
 * 10 drills in English, Hindi and Telugu, one scam category each.
 */

type Three = [en: string, hi: string, te: string];
const t = ([en, hi, te]: Three): L10n => ({ en, hi, te });

const choice = (id: string, next: string, points: number, text: Three, feedback: Three, redFlag?: SignalId): DrillChoice => ({
  id,
  text: t(text),
  next,
  points,
  feedback: t(feedback),
  ...(redFlag ? { redFlag } : {}),
});
const say = (id: string, text: Three, choices: DrillChoice[]): DrillNode => ({ id, from: 'them', text: t(text), choices });
const end = (id: string, kind: 'safe' | 'scammed', text: Three): DrillNode => ({ id, from: 'system', text: t(text), end: kind });

function drill(d: Omit<Drill, 'nodes' | 'langs' | 'start'>, nodes: DrillNode[]): Drill {
  return { ...d, langs: ['en', 'hi', 'te'], start: nodes[0]!.id, nodes: Object.fromEntries(nodes.map((n) => [n.id, n])) };
}

const SAFE_REPORT: Three = [
  'You kept your money and reported the number. Reporting on Chakshu (sancharsaathi.gov.in) helps stop the next attempt.',
  'आपके पैसे बच गए और आपने नंबर की शिकायत की। चक्षु (sancharsaathi.gov.in) पर शिकायत करने से अगली कोशिश रोकने में मदद मिलती है।',
  'మీ డబ్బు సురక్షితంగా ఉంది, మీరు నంబర్‌పై ఫిర్యాదు చేశారు. చక్షు (sancharsaathi.gov.in) లో ఫిర్యాదు చేయడం తదుపరి ప్రయత్నాన్ని ఆపడానికి సహాయపడుతుంది.',
];

export const DRILLS: Drill[] = [
  drill(
    {
      id: 'drill-collect-refund',
      title: t(['The "refund" collect request', '"रिफंड" वाली कलेक्ट रिक्वेस्ट', '"రీఫండ్" కలెక్ట్ రిక్వెస్ట్']),
      category: 'upi_collect',
      difficulty: 1,
      channel: 'whatsapp',
      persona: { name: 'Refund Desk', avatar: 'support' },
    },
    [
      say(
        'n_start',
        [
          'Hello sir, your order was cancelled and a refund of ₹2,499 is due. I am sending the refund to your UPI now. Please accept it.',
          'नमस्ते सर, आपका ऑर्डर रद्द हुआ है और ₹2,499 का रिफंड बाकी है। मैं अभी आपके UPI पर रिफंड भेज रहा हूं। कृपया स्वीकार करें।',
          'నమస్తే సార్, మీ ఆర్డర్ రద్దయింది, ₹2,499 రీఫండ్ రావాలి. ఇప్పుడే మీ UPI కి రీఫండ్ పంపుతున్నాను. దయచేసి అంగీకరించండి.',
        ],
        [
          choice(
            'c_accept',
            'n_request',
            0,
            ['OK, send it. What do I do?', 'ठीक है, भेजिए। मुझे क्या करना है?', 'సరే, పంపండి. నేనేం చేయాలి?'],
            [
              'A refund needs nothing from you. Being asked to "accept" one is already a warning sign.',
              'रिफंड के लिए आपको कुछ नहीं करना होता। "स्वीकार" करने को कहा जाना ही चेतावनी है।',
              'రీఫండ్ కోసం మీరు ఏమీ చేయనక్కర్లేదు. "అంగీకరించండి" అని అడగడమే హెచ్చరిక.',
            ],
          ),
          choice(
            'c_look',
            'n_request',
            5,
            ['I will check my orders in the app first.', 'पहले मैं ऐप में अपने ऑर्डर देखूंगा।', 'ముందు యాప్‌లో నా ఆర్డర్లు చూసుకుంటాను.'],
            [
              'Good instinct: check in the official app, not through the person messaging you.',
              'सही सोच: आधिकारिक ऐप में जांचें, मैसेज करने वाले के ज़रिए नहीं।',
              'మంచి ఆలోచన: మెసేజ్ చేస్తున్నవారి ద్వారా కాకుండా అధికారిక యాప్‌లో చూసుకోండి.',
            ],
          ),
        ],
      ),
      say(
        'n_request',
        [
          'I have sent a request of ₹2,499 from sbi.refund.desk@ybl. Open your UPI app, tap Pay and enter your PIN to receive the refund. Quickly please, it expires in 5 minutes.',
          'मैंने sbi.refund.desk@ybl से ₹2,499 की रिक्वेस्ट भेजी है। UPI ऐप खोलें, Pay दबाएं और रिफंड पाने के लिए PIN डालें। जल्दी कीजिए, यह 5 मिनट में खत्म हो जाएगी।',
          'sbi.refund.desk@ybl నుండి ₹2,499 రిక్వెస్ట్ పంపాను. UPI యాప్ తెరిచి Pay నొక్కి రీఫండ్ కోసం పిన్ ఎంటర్ చేయండి. త్వరగా, ఇది 5 నిమిషాల్లో ముగుస్తుంది.',
        ],
        [
          choice(
            'r_decline',
            'end_safe',
            10,
            ['Decline the request and block the number.', 'रिक्वेस्ट Decline करें और नंबर ब्लॉक करें।', 'రిక్వెస్ట్ Decline చేసి నంబర్ బ్లాక్ చేయండి.'],
            [
              'Right. A PIN only ever sends money out. "Enter PIN to receive" is always a scam.',
              'सही। PIN से हमेशा पैसे बाहर जाते हैं। "पैसे पाने के लिए PIN डालें" हमेशा ठगी है।',
              'సరైనది. పిన్ ఎప్పుడూ డబ్బు బయటకు పంపుతుంది. "అందుకోవడానికి పిన్ ఎంటర్ చేయండి" ఎప్పుడూ మోసమే.',
            ],
            'RECEIVE_WITH_PIN',
          ),
          choice(
            'r_pay',
            'end_scammed',
            0,
            ['Tap Pay and enter my PIN.', 'Pay दबाकर PIN डालें।', 'Pay నొక్కి పిన్ ఎంటర్ చేయండి.'],
            [
              'The screen said Pay because it was a payment. Entering the PIN sent ₹2,499 to them.',
              'स्क्रीन पर Pay इसलिए लिखा था क्योंकि यह भुगतान था। PIN डालते ही ₹2,499 उन्हें चले गए।',
              'అది చెల్లింపు కాబట్టే స్క్రీన్‌పై Pay అని ఉంది. పిన్ ఎంటర్ చేయగానే ₹2,499 వారికి వెళ్లిపోయాయి.',
            ],
          ),
          choice(
            'r_ask',
            'n_pressure',
            3,
            ['Why do I need my PIN to receive money?', 'पैसे पाने के लिए PIN क्यों चाहिए?', 'డబ్బు అందుకోవడానికి పిన్ ఎందుకు?'],
            [
              'Good question. You do not, and the answer you get will not change that.',
              'अच्छा सवाल। ज़रूरत नहीं होती, और जवाब कुछ भी हो, यह सच नहीं बदलता।',
              'మంచి ప్రశ్న. అవసరం లేదు, వారు ఏ జవాబు ఇచ్చినా అది మారదు.',
            ],
            'COLLECT_REQUEST',
          ),
        ],
      ),
      say(
        'n_pressure',
        [
          'Sir it is the new RBI rule, PIN is needed for verification. Many customers already got their refund. Do it now or the refund is cancelled.',
          'सर, यह RBI का नया नियम है, वेरिफिकेशन के लिए PIN चाहिए। बहुत से ग्राहकों को रिफंड मिल चुका है। अभी कीजिए वरना रिफंड रद्द हो जाएगा।',
          'సార్, ఇది కొత్త RBI నియమం, ధృవీకరణ కోసం పిన్ కావాలి. చాలా మంది కస్టమర్లకు రీఫండ్ వచ్చేసింది. ఇప్పుడే చేయండి, లేకపోతే రీఫండ్ రద్దవుతుంది.',
        ],
        [
          choice(
            'p_decline',
            'end_reported',
            10,
            ['Decline, block and report the number.', 'Decline करें, ब्लॉक करें और नंबर की शिकायत करें।', 'Decline చేసి, బ్లాక్ చేసి, నంబర్‌పై ఫిర్యాదు చేయండి.'],
            [
              'Right. There is no rule that needs a PIN to receive money, and the hurry is there to stop you thinking.',
              'सही। पैसे पाने के लिए PIN वाला कोई नियम नहीं है, और जल्दबाज़ी इसलिए है कि आप सोच न पाएं।',
              'సరైనది. డబ్బు అందుకోవడానికి పిన్ అడిగే నియమం లేదు, మీరు ఆలోచించకుండా ఉండటానికే తొందర.',
            ],
            'URGENCY',
          ),
          choice(
            'p_pay',
            'end_scammed',
            0,
            ['If it is an RBI rule, I will enter it.', 'अगर RBI का नियम है तो डाल देता हूं।', 'RBI నియమమైతే ఎంటర్ చేస్తాను.'],
            [
              'Naming RBI is a trick to sound official. The PIN sent your money to them.',
              'RBI का नाम लेना आधिकारिक लगने की चाल है। PIN से आपके पैसे उन्हें चले गए।',
              'RBI పేరు చెప్పడం అధికారికంగా అనిపించడానికి చేసే ఉపాయం. పిన్‌తో మీ డబ్బు వారికి వెళ్లింది.',
            ],
          ),
        ],
      ),
      end('end_safe', 'safe', [
        'You kept your money. Real refunds arrive on their own; they never need your PIN, an OTP or a collect request.',
        'आपके पैसे बच गए। असली रिफंड अपने आप आता है; उसके लिए कभी PIN, OTP या कलेक्ट रिक्वेस्ट नहीं चाहिए।',
        'మీ డబ్బు మీ దగ్గరే ఉంది. నిజమైన రీఫండ్ తనంతట తానే వస్తుంది; దానికి పిన్, OTP లేదా కలెక్ట్ రిక్వెస్ట్ ఎప్పుడూ అవసరం లేదు.',
      ]),
      end('end_reported', 'safe', SAFE_REPORT),
      end('end_scammed', 'scammed', [
        'The money went to the scammer. In real life: call 1930 straight away and your bank with the transaction ID.',
        'पैसे ठग के पास चले गए। असल में: तुरंत 1930 पर कॉल करें और लेनदेन संख्या के साथ अपने बैंक को।',
        'డబ్బు మోసగాడికి వెళ్లింది. నిజ జీవితంలో: వెంటనే 1930 కు, లావాదేవీ నంబర్‌తో మీ బ్యాంక్‌కు కాల్ చేయండి.',
      ]),
    ],
  ),

  drill(
    {
      id: 'drill-fake-kyc',
      title: t(['"Your account will be blocked"', '"आपका खाता बंद हो जाएगा"', '"మీ ఖాతా బ్లాక్ అవుతుంది"']),
      category: 'fake_kyc',
      difficulty: 1,
      channel: 'sms',
      persona: { name: 'VK-ALERTS', avatar: 'bank' },
    },
    [
      say(
        'k_start',
        [
          'Dear Customer, your SBI account will be BLOCKED today due to pending KYC. Update now: http://sbi-kyc-update.xyz/verify',
          'प्रिय ग्राहक, KYC बाकी होने के कारण आपका SBI खाता आज बंद हो जाएगा। अभी अपडेट करें: http://sbi-kyc-update.xyz/verify',
          'ప్రియమైన కస్టమర్, KYC పెండింగ్ కారణంగా మీ SBI ఖాతా ఈరోజు బ్లాక్ అవుతుంది. ఇప్పుడే అప్‌డేట్ చేయండి: http://sbi-kyc-update.xyz/verify',
        ],
        [
          choice(
            'k_tap',
            'k_page',
            0,
            ['Tap the link quickly before the account is blocked.', 'खाता बंद होने से पहले जल्दी लिंक दबाएं।', 'ఖాతా బ్లాక్ అయ్యేలోపు త్వరగా లింక్ నొక్కండి.'],
            [
              'The deadline is there to rush you. Look at the address: sbi-kyc-update.xyz is not SBI.',
              'समय-सीमा आपको जल्दबाज़ी में डालने के लिए है। पता देखें: sbi-kyc-update.xyz SBI नहीं है।',
              'గడువు మిమ్మల్ని తొందరపెట్టడానికే. చిరునామా చూడండి: sbi-kyc-update.xyz SBI కాదు.',
            ],
          ),
          choice(
            'k_check',
            'k_end_safe',
            10,
            ['Ignore the link and open the bank\'s own app.', 'लिंक छोड़ें और बैंक का अपना ऐप खोलें।', 'లింక్ వదిలి బ్యాంక్ సొంత యాప్ తెరవండి.'],
            [
              'Right. The link ends in .xyz, not an official bank address. The bank\'s own app shows any real KYC issue.',
              'सही। लिंक .xyz पर खत्म होता है, बैंक के आधिकारिक पते पर नहीं। KYC की असली समस्या बैंक के अपने ऐप में दिखती है।',
              'సరైనది. లింక్ .xyz తో ముగుస్తుంది, అధికారిక బ్యాంక్ చిరునామాతో కాదు. నిజమైన KYC సమస్య బ్యాంక్ సొంత యాప్‌లో కనిపిస్తుంది.',
            ],
            'LOOKALIKE_DOMAIN',
          ),
          choice(
            'k_call',
            'k_call_node',
            3,
            ['Call back the number that sent it.', 'जिस नंबर से आया, उस पर वापस कॉल करें।', 'పంపిన నంబర్‌కు తిరిగి కాల్ చేయండి.'],
            [
              'Calling the sender puts you in touch with the scammer, not the bank.',
              'भेजने वाले को कॉल करने से आप ठग से बात करेंगे, बैंक से नहीं।',
              'పంపినవారికి కాల్ చేస్తే మీరు మోసగాడితోనే మాట్లాడతారు, బ్యాంక్‌తో కాదు.',
            ],
          ),
        ],
      ),
      say(
        'k_page',
        [
          'The page looks like net banking. It asks for your user ID, password, and then the OTP you will receive.',
          'पेज नेट बैंकिंग जैसा दिखता है। यह आपका यूज़र ID, पासवर्ड, और फिर आने वाला OTP मांगता है।',
          'పేజీ నెట్ బ్యాంకింగ్ లాగే కనిపిస్తుంది. ఇది మీ యూజర్ ID, పాస్‌వర్డ్, తర్వాత వచ్చే OTP అడుగుతుంది.',
        ],
        [
          choice(
            'kp_enter',
            'k_end_scammed',
            0,
            ['Enter the details and the OTP.', 'जानकारी और OTP डाल दें।', 'వివరాలు, OTP ఎంటర్ చేయండి.'],
            [
              'The page sent your password and OTP straight to the scammer, who used them to log in.',
              'पेज ने आपका पासवर्ड और OTP सीधे ठग को भेज दिया, जिसने उनसे लॉगिन कर लिया।',
              'ఆ పేజీ మీ పాస్‌వర్డ్, OTP నేరుగా మోసగాడికి పంపింది, అతను వాటితో లాగిన్ అయ్యాడు.',
            ],
          ),
          choice(
            'kp_close',
            'k_end_safe',
            8,
            ['Close the page without typing anything.', 'कुछ टाइप किए बिना पेज बंद कर दें।', 'ఏమీ టైప్ చేయకుండా పేజీ మూసేయండి.'],
            [
              'Good save. Opening the page did no harm because you entered nothing. Next time, check the address first.',
              'अच्छा बचाव। आपने कुछ नहीं डाला, इसलिए पेज खोलने से नुकसान नहीं हुआ। अगली बार पहले पता देखें।',
              'మంచి నిర్ణయం. మీరు ఏమీ ఎంటర్ చేయలేదు కాబట్టి నష్టం లేదు. తదుపరి సారి ముందుగా చిరునామా చూడండి.',
            ],
            'ASKS_OTP',
          ),
        ],
      ),
      say(
        'k_call_node',
        [
          '"Sir, I am from the KYC department. I will update it on the phone. Tell me the OTP you just received."',
          '"सर, मैं KYC विभाग से हूं। फ़ोन पर ही अपडेट कर दूंगा। अभी जो OTP आया वह बताइए।"',
          '"సార్, నేను KYC విభాగం నుండి. ఫోన్‌లోనే అప్‌డేట్ చేస్తాను. ఇప్పుడు వచ్చిన OTP చెప్పండి."',
        ],
        [
          choice(
            'kc_hang',
            'k_end_reported',
            10,
            ['Hang up and report the number.', 'फ़ोन काटें और नंबर की शिकायत करें।', 'కాల్ కట్ చేసి నంబర్‌పై ఫిర్యాదు చేయండి.'],
            [
              'Right. No bank asks for an OTP on a call.',
              'सही। कोई बैंक फ़ोन पर OTP नहीं मांगता।',
              'సరైనది. ఏ బ్యాంకూ కాల్‌లో OTP అడగదు.',
            ],
            'ASKS_OTP',
          ),
          choice(
            'kc_tell',
            'k_end_scammed',
            0,
            ['Read out the OTP.', 'OTP बता दें।', 'OTP చెప్పేయండి.'],
            [
              'That OTP approved a payment or a new login on your account.',
              'उस OTP से आपके खाते में भुगतान या नया लॉगिन मंज़ूर हो गया।',
              'ఆ OTP తో మీ ఖాతాలో చెల్లింపు లేదా కొత్త లాగిన్ ఆమోదం పొందింది.',
            ],
          ),
        ],
      ),
      end('k_end_safe', 'safe', [
        'You kept your account. KYC is updated through the bank\'s app or branch, never through a link in an SMS.',
        'आपका खाता बचा रहा। KYC बैंक के ऐप या शाखा से अपडेट होती है, SMS के लिंक से कभी नहीं।',
        'మీ ఖాతా సురక్షితం. KYC బ్యాంక్ యాప్ లేదా శాఖ ద్వారా అప్‌డేట్ అవుతుంది, SMS లింక్ ద్వారా ఎప్పుడూ కాదు.',
      ]),
      end('k_end_reported', 'safe', SAFE_REPORT),
      end('k_end_scammed', 'scammed', [
        'The scammer got into your account. In real life: call your bank and 1930 at once, and change your passwords.',
        'ठग आपके खाते तक पहुंच गया। असल में: तुरंत बैंक और 1930 पर कॉल करें और पासवर्ड बदलें।',
        'మోసగాడు మీ ఖాతాలోకి ప్రవేశించాడు. నిజ జీవితంలో: వెంటనే బ్యాంక్‌కు, 1930 కు కాల్ చేసి పాస్‌వర్డ్‌లు మార్చండి.',
      ]),
    ],
  ),

  drill(
    {
      id: 'drill-marketplace-qr',
      title: t(['The buyer who sends a QR', 'QR भेजने वाला खरीदार', 'QR పంపే కొనుగోలుదారు']),
      category: 'qr_receive',
      difficulty: 2,
      channel: 'whatsapp',
      persona: { name: 'Army buyer', avatar: 'buyer' },
    },
    [
      say(
        'q_start',
        [
          'Hi, I saw your ad for the sofa. I will take it for ₹12,000, no bargaining. I am in the army so I will pay online and send someone to collect it.',
          'नमस्ते, आपके सोफ़े का विज्ञापन देखा। ₹12,000 में ले लूंगा, मोलभाव नहीं। मैं सेना में हूं, इसलिए ऑनलाइन पैसे दूंगा और किसी को लेने भेजूंगा।',
          'హాయ్, మీ సోఫా ప్రకటన చూశాను. ₹12,000 కు తీసుకుంటాను, బేరం లేదు. నేను ఆర్మీలో ఉన్నాను, ఆన్‌లైన్‌లో చెల్లించి ఎవరినైనా తీసుకెళ్లడానికి పంపుతాను.',
        ],
        [
          choice(
            'q_ok',
            'q_qr',
            3,
            ['Great, please pay to my UPI ID.', 'बढ़िया, मेरी UPI ID पर पैसे भेज दीजिए।', 'బాగుంది, నా UPI ID కి పంపండి.'],
            [
              'Sharing your UPI ID to receive money is fine. Watch what they ask for next.',
              'पैसे पाने के लिए UPI ID बताना ठीक है। देखिए वे आगे क्या मांगते हैं।',
              'డబ్బు అందుకోవడానికి UPI ID చెప్పడం సరైనదే. తర్వాత వారు ఏమి అడుగుతారో చూడండి.',
            ],
          ),
          choice(
            'q_cash',
            'q_end_safe',
            10,
            ['Please come and see it, pay when you pick it up.', 'आकर देख लीजिए, लेते समय पैसे दीजिए।', 'వచ్చి చూసి, తీసుకెళ్లేటప్పుడు చెల్లించండి.'],
            [
              'Good. A quick sale with no viewing and "army" payment is a common setup; paying on pickup avoids it.',
              'अच्छा। बिना देखे जल्दी सौदा और "सेना" वाला भुगतान आम चाल है; लेते समय भुगतान इससे बचाता है।',
              'మంచిది. చూడకుండానే త్వరగా కొనడం, "ఆర్మీ" చెల్లింపు సాధారణ ఉపాయం; తీసుకెళ్లేటప్పుడు చెల్లింపు దీన్ని నివారిస్తుంది.',
            ],
            'AUTHORITY_CLAIM',
          ),
        ],
      ),
      say(
        'q_qr',
        [
          'Our army account works only by QR. I am sending a QR for ₹12,000. Scan it and enter your PIN, the money will come to you.',
          'हमारा सेना का खाता सिर्फ QR से चलता है। ₹12,000 का QR भेज रहा हूं। स्कैन करके PIN डालिए, पैसे आपके पास आ जाएंगे।',
          'మా ఆర్మీ ఖాతా QR ద్వారానే పనిచేస్తుంది. ₹12,000 QR పంపుతున్నాను. స్కాన్ చేసి పిన్ ఎంటర్ చేయండి, డబ్బు మీకు వస్తుంది.',
        ],
        [
          choice(
            'q_scan',
            'q_end_scammed',
            0,
            ['Scan the QR and enter my PIN.', 'QR स्कैन करके PIN डालें।', 'QR స్కాన్ చేసి పిన్ ఎంటర్ చేయండి.'],
            [
              'Scanning a QR pays the person who made it. ₹12,000 left your account.',
              'QR स्कैन करने से उसे बनाने वाले को भुगतान होता है। आपके खाते से ₹12,000 चले गए।',
              'QR స్కాన్ చేస్తే దాన్ని తయారుచేసినవారికి చెల్లింపు జరుగుతుంది. మీ ఖాతా నుండి ₹12,000 వెళ్లిపోయాయి.',
            ],
          ),
          choice(
            'q_refuse',
            'q_end_reported',
            10,
            ['No. Scanning a QR sends money. Pay to my UPI ID or not at all.', 'नहीं। QR स्कैन करने से पैसे जाते हैं। मेरी UPI ID पर भेजिए, वरना नहीं।', 'వద్దు. QR స్కాన్ చేస్తే డబ్బు వెళ్తుంది. నా UPI ID కి పంపండి, లేదంటే వద్దు.'],
            [
              'Exactly. You never scan a QR or enter a PIN to receive money.',
              'बिल्कुल। पैसे पाने के लिए कभी QR स्कैन या PIN नहीं डालना पड़ता।',
              'ఖచ్చితంగా. డబ్బు అందుకోవడానికి QR స్కాన్ లేదా పిన్ ఎప్పుడూ అవసరం లేదు.',
            ],
            'QR_TO_RECEIVE',
          ),
          choice(
            'q_test',
            'q_test_node',
            2,
            ['Can we try with a small amount first?', 'पहले थोड़ी रकम से आज़मा सकते हैं?', 'ముందు చిన్న మొత్తంతో ప్రయత్నించవచ్చా?'],
            [
              'A "small test" is part of the trick: it builds trust before the big one.',
              '"छोटा टेस्ट" भी चाल का हिस्सा है: बड़े भुगतान से पहले भरोसा बनाने के लिए।',
              '"చిన్న టెస్ట్" కూడా ఉపాయంలో భాగమే: పెద్ద మొత్తానికి ముందు నమ్మకం కలిగించడానికి.',
            ],
          ),
        ],
      ),
      say(
        'q_test_node',
        [
          'Sure, scan this ₹5 QR first. ... You see, ₹5 was a test. Now scan the ₹12,000 one quickly, my officer is waiting.',
          'ज़रूर, पहले यह ₹5 वाला QR स्कैन कीजिए। ... देखा, ₹5 टेस्ट था। अब जल्दी ₹12,000 वाला स्कैन कीजिए, मेरे अफ़सर इंतज़ार कर रहे हैं।',
          'సరే, ముందు ఈ ₹5 QR స్కాన్ చేయండి. ... చూశారా, ₹5 టెస్ట్. ఇప్పుడు త్వరగా ₹12,000 దాన్ని స్కాన్ చేయండి, మా అధికారి ఎదురుచూస్తున్నారు.',
        ],
        [
          choice(
            'qt_scan',
            'q_end_scammed',
            0,
            ['Scan the ₹12,000 QR.', '₹12,000 वाला QR स्कैन करें।', '₹12,000 QR స్కాన్ చేయండి.'],
            [
              'Your ₹5 went out too: you paid them twice. Notice that money left you both times.',
              'आपके ₹5 भी गए थे: आपने उन्हें दो बार भुगतान किया। ध्यान दें, दोनों बार पैसे आपसे गए।',
              'మీ ₹5 కూడా వెళ్లాయి: మీరు వారికి రెండుసార్లు చెల్లించారు. రెండుసార్లూ డబ్బు మీ నుండే వెళ్లింది.',
            ],
          ),
          choice(
            'qt_stop',
            'q_end_reported',
            8,
            ['Wait, my balance went down by ₹5. Block and report.', 'रुकिए, मेरा बैलेंस ₹5 कम हुआ। ब्लॉक करें और शिकायत करें।', 'ఆగండి, నా బ్యాలెన్స్ ₹5 తగ్గింది. బ్లాక్ చేసి ఫిర్యాదు చేయండి.'],
            [
              'Well spotted. The test payment proved the QR takes money from you.',
              'अच्छा पकड़ा। टेस्ट भुगतान ने ही दिखा दिया कि QR आपसे पैसे लेता है।',
              'బాగా గమనించారు. టెస్ట్ చెల్లింపే QR మీ నుండి డబ్బు తీసుకుంటుందని నిరూపించింది.',
            ],
            'QR_TO_RECEIVE',
          ),
        ],
      ),
      end('q_end_safe', 'safe', [
        'You kept the sofa and your money. Buyers who will not come and see an item, and who pay by QR, are a common trap.',
        'आपका सोफ़ा और पैसे दोनों बचे। जो खरीदार सामान देखने न आएं और QR से भुगतान करें, वह आम जाल है।',
        'మీ సోఫా, డబ్బు రెండూ సురక్షితం. వస్తువు చూడటానికి రాని, QR ద్వారా చెల్లించే కొనుగోలుదారులు సాధారణ ఉచ్చు.',
      ]),
      end('q_end_reported', 'safe', SAFE_REPORT),
      end('q_end_scammed', 'scammed', [
        'The money went to the "buyer". In real life: call 1930 straight away and your bank with the transaction ID.',
        'पैसे "खरीदार" के पास चले गए। असल में: तुरंत 1930 पर कॉल करें और लेनदेन संख्या के साथ बैंक को।',
        'డబ్బు "కొనుగోలుదారు"కి వెళ్లింది. నిజ జీవితంలో: వెంటనే 1930 కు, లావాదేవీ నంబర్‌తో బ్యాంక్‌కు కాల్ చేయండి.',
      ]),
    ],
  ),

  drill(
    {
      id: 'drill-electricity',
      title: t(['"Power will be cut tonight"', '"आज रात बिजली कट जाएगी"', '"ఈ రాత్రి కరెంట్ కట్ అవుతుంది"']),
      category: 'bill_disconnection',
      difficulty: 1,
      channel: 'sms',
      persona: { name: '+91 98765 0XXXX', avatar: 'unknown' },
    },
    [
      say(
        'e_start',
        [
          'Dear consumer, your electricity will be disconnected tonight at 9:30 PM as your last bill is not updated. Call the electricity officer immediately: 98765 01234',
          'प्रिय उपभोक्ता, पिछला बिल अपडेट न होने के कारण आज रात 9:30 बजे आपकी बिजली काट दी जाएगी। तुरंत बिजली अधिकारी को कॉल करें: 98765 01234',
          'ప్రియమైన వినియోగదారుడా, మీ గత బిల్లు అప్‌డేట్ కాలేదు కాబట్టి ఈ రాత్రి 9:30 కు కరెంట్ కట్ చేయబడుతుంది. వెంటనే విద్యుత్ అధికారికి కాల్ చేయండి: 98765 01234',
        ],
        [
          choice(
            'e_call',
            'e_officer',
            0,
            ['Call the number before 9:30.', '9:30 से पहले नंबर पर कॉल करें।', '9:30 లోపు ఆ నంబర్‌కు కాల్ చేయండి.'],
            [
              'An "officer" on a personal mobile number is a warning sign. Electricity boards do not work this way.',
              'निजी मोबाइल नंबर वाला "अधिकारी" चेतावनी है। बिजली विभाग ऐसे काम नहीं करता।',
              'వ్యక్తిగత మొబైల్ నంబర్‌లో "అధికారి" అనేది హెచ్చరిక. విద్యుత్ సంస్థలు ఇలా పనిచేయవు.',
            ],
          ),
          choice(
            'e_check',
            'e_end_safe',
            10,
            ['Check the bill in the electricity board\'s official app.', 'बिजली विभाग के आधिकारिक ऐप में बिल देखें।', 'విద్యుత్ సంస్థ అధికారిక యాప్‌లో బిల్లు చూడండి.'],
            [
              'Right. The official app shows your real bill. A same-night deadline from a mobile number is the trick.',
              'सही। आधिकारिक ऐप में असली बिल दिखता है। मोबाइल नंबर से उसी रात की समय-सीमा ही चाल है।',
              'సరైనది. అధికారిక యాప్ మీ అసలు బిల్లు చూపుతుంది. మొబైల్ నంబర్ నుండి అదే రాత్రి గడువు అనేదే ఉపాయం.',
            ],
            'THREAT_BLOCK',
          ),
        ],
      ),
      say(
        'e_officer',
        [
          '"Your payment is not showing. Install this app I am sending on WhatsApp and pay ₹10 to update it. Otherwise the lineman will cut your power."',
          '"आपका भुगतान नहीं दिख रहा। WhatsApp पर जो ऐप भेज रहा हूं, उसे इंस्टॉल करके ₹10 भरिए ताकि अपडेट हो जाए। वरना लाइनमैन बिजली काट देगा।"',
          '"మీ చెల్లింపు కనిపించడం లేదు. WhatsApp లో పంపుతున్న యాప్ ఇన్‌స్టాల్ చేసి అప్‌డేట్ కోసం ₹10 కట్టండి. లేకపోతే లైన్‌మ్యాన్ కరెంట్ కట్ చేస్తాడు."',
        ],
        [
          choice(
            'eo_install',
            'e_end_scammed',
            0,
            ['Install the app and pay ₹10.', 'ऐप इंस्टॉल करके ₹10 भरें।', 'యాప్ ఇన్‌స్టాల్ చేసి ₹10 కట్టండి.'],
            [
              'The app could read your screen and SMS. The "₹10" page captured your card details and OTP.',
              'वह ऐप आपकी स्क्रीन और SMS पढ़ सकता था। "₹10" वाले पेज ने आपके कार्ड की जानकारी और OTP ले लिए।',
              'ఆ యాప్ మీ స్క్రీన్, SMS చదవగలదు. "₹10" పేజీ మీ కార్డ్ వివరాలు, OTP తీసుకుంది.',
            ],
          ),
          choice(
            'eo_refuse',
            'e_end_reported',
            10,
            ['Refuse, hang up and report the number.', 'मना करें, फ़ोन काटें और नंबर की शिकायत करें।', 'నిరాకరించి, కాల్ కట్ చేసి, నంబర్‌పై ఫిర్యాదు చేయండి.'],
            [
              'Right. No electricity board asks you to install an app from a chat to pay a bill.',
              'सही। कोई बिजली विभाग बिल भरने के लिए चैट से ऐप इंस्टॉल करने को नहीं कहता।',
              'సరైనది. బిల్లు కట్టడానికి చాట్ నుండి యాప్ ఇన్‌స్టాల్ చేయమని ఏ విద్యుత్ సంస్థా అడగదు.',
            ],
            'APK_LINK',
          ),
          choice(
            'eo_upi',
            'e_end_scammed',
            0,
            ['Pay the pending amount to his UPI ID instead.', 'बकाया रकम उसकी UPI ID पर भेज दें।', 'బకాయి మొత్తాన్ని అతని UPI ID కి పంపండి.'],
            [
              'Bills are paid to the board, never to an officer\'s personal UPI ID.',
              'बिल विभाग को भरा जाता है, किसी अधिकारी की निजी UPI ID पर कभी नहीं।',
              'బిల్లులు సంస్థకే కడతారు, అధికారి వ్యక్తిగత UPI ID కి ఎప్పుడూ కాదు.',
            ],
          ),
        ],
      ),
      end('e_end_safe', 'safe', [
        'Your power and your money are fine. Real bills come with your consumer number and can be checked in the official app.',
        'आपकी बिजली और पैसे दोनों ठीक हैं। असली बिल पर उपभोक्ता संख्या होती है और उसे आधिकारिक ऐप में जांचा जा सकता है।',
        'మీ కరెంట్, డబ్బు రెండూ బాగానే ఉన్నాయి. నిజమైన బిల్లులో సర్వీస్ నంబర్ ఉంటుంది, దాన్ని అధికారిక యాప్‌లో చూడవచ్చు.',
      ]),
      end('e_end_reported', 'safe', SAFE_REPORT),
      end('e_end_scammed', 'scammed', [
        'Money was taken from your account. In real life: switch on airplane mode, remove the app, call your bank and 1930.',
        'आपके खाते से पैसे निकल गए। असल में: एयरप्लेन मोड चालू करें, ऐप हटाएं, बैंक और 1930 पर कॉल करें।',
        'మీ ఖాతా నుండి డబ్బు తీసుకున్నారు. నిజ జీవితంలో: ఎయిర్‌ప్లేన్ మోడ్ ఆన్ చేసి, యాప్ తీసేసి, బ్యాంక్‌కు, 1930 కు కాల్ చేయండి.',
      ]),
    ],
  ),

  drill(
    {
      id: 'drill-digital-arrest',
      title: t(['The "digital arrest" video call', '"डिजिटल अरेस्ट" वीडियो कॉल', '"డిజిటల్ అరెస్ట్" వీడియో కాల్']),
      category: 'digital_arrest',
      difficulty: 3,
      channel: 'call',
      persona: { name: 'Inspector Sharma', avatar: 'police' },
    },
    [
      say(
        'a_start',
        [
          'This is Inspector Sharma, Mumbai Cyber Crime. A parcel booked on your Aadhaar was seized with drugs. An FIR is filed against you. Join the video call now.',
          'मैं इंस्पेक्टर शर्मा, मुंबई साइबर क्राइम से। आपके आधार से बुक हुए पार्सल में ड्रग्स मिले हैं। आप पर FIR दर्ज है। अभी वीडियो कॉल पर आइए।',
          'నేను ఇన్‌స్పెక్టర్ శర్మ, ముంబై సైబర్ క్రైమ్. మీ ఆధార్‌తో బుక్ అయిన పార్సెల్‌లో డ్రగ్స్ దొరికాయి. మీపై FIR నమోదైంది. ఇప్పుడే వీడియో కాల్‌లో చేరండి.',
        ],
        [
          choice(
            'a_join',
            'a_call',
            0,
            ['Join the video call; I have nothing to hide.', 'वीडियो कॉल पर आ जाएं; मेरे पास छिपाने को कुछ नहीं।', 'వీడియో కాల్‌లో చేరండి; నాకు దాచడానికి ఏమీ లేదు.'],
            [
              'Being innocent is exactly what they rely on: you want to cooperate. Police do not question people over video calls like this.',
              'आपका बेगुनाह होना ही उनका सहारा है: आप सहयोग करना चाहते हैं। पुलिस इस तरह वीडियो कॉल पर पूछताछ नहीं करती।',
              'మీరు నిర్దోషి అనే దానిపైనే వారు ఆధారపడతారు: మీరు సహకరించాలనుకుంటారు. పోలీసులు ఇలా వీడియో కాల్‌లో విచారించరు.',
            ],
          ),
          choice(
            'a_hang',
            'a_end_reported',
            10,
            ['Hang up, tell family, and report the number.', 'फ़ोन काटें, परिवार को बताएं और नंबर की शिकायत करें।', 'కాల్ కట్ చేసి, కుటుంబానికి చెప్పి, నంబర్‌పై ఫిర్యాదు చేయండి.'],
            [
              'Right. There is no "digital arrest". Real police send a written notice; they do not hold you on a call.',
              'सही। "डिजिटल अरेस्ट" जैसी कोई चीज़ नहीं होती। असली पुलिस लिखित नोटिस भेजती है; कॉल पर रोककर नहीं रखती।',
              'సరైనది. "డిజిటల్ అరెస్ట్" అనేది లేదు. నిజమైన పోలీసులు లిఖిత నోటీసు పంపుతారు; కాల్‌లో పట్టి ఉంచరు.',
            ],
            'AUTHORITY_CLAIM',
          ),
        ],
      ),
      say(
        'a_call',
        [
          '(On video, in a room that looks like a police station) "You are under digital arrest. Do not tell anyone, do not leave the room, keep the camera on. This is a confidential national security case."',
          '(वीडियो पर, पुलिस थाने जैसे कमरे में) "आप डिजिटल अरेस्ट में हैं। किसी को मत बताइए, कमरे से बाहर मत जाइए, कैमरा चालू रखिए। यह राष्ट्रीय सुरक्षा का गोपनीय मामला है।"',
          '(వీడియోలో, పోలీస్ స్టేషన్ లాంటి గదిలో) "మీరు డిజిటల్ అరెస్ట్‌లో ఉన్నారు. ఎవరికీ చెప్పకండి, గది బయటకు వెళ్లకండి, కెమెరా ఆన్‌లో ఉంచండి. ఇది జాతీయ భద్రతకు సంబంధించిన రహస్య కేసు."',
        ],
        [
          choice(
            'ac_stay',
            'a_money',
            0,
            ['Stay on the call and do as they say.', 'कॉल पर रहें और जैसा कहें वैसा करें।', 'కాల్‌లోనే ఉండి వారు చెప్పినట్లు చేయండి.'],
            [
              'Keeping you alone and on camera stops anyone from telling you it is a scam.',
              'आपको अकेले और कैमरे पर रखने से कोई आपको यह नहीं बता पाता कि यह ठगी है।',
              'మిమ్మల్ని ఒంటరిగా, కెమెరా ముందు ఉంచడం వల్ల ఇది మోసమని ఎవరూ చెప్పలేరు.',
            ],
          ),
          choice(
            'ac_end',
            'a_end_safe',
            10,
            ['End the call and phone a family member.', 'कॉल खत्म करें और परिवार के किसी सदस्य को फ़ोन करें।', 'కాల్ ముగించి కుటుంబ సభ్యుడికి ఫోన్ చేయండి.'],
            [
              'Right. Secrecy and "do not leave the room" are the giveaways. Talking to family breaks the spell.',
              'सही। गोपनीयता और "कमरे से बाहर मत जाइए" ही पहचान हैं। परिवार से बात करने से जाल टूट जाता है।',
              'సరైనది. రహస్యం, "గది బయటకు వెళ్లకండి" అనేవే ఆనవాళ్లు. కుటుంబంతో మాట్లాడితే ఉచ్చు విడిపోతుంది.',
            ],
            'SECRECY',
          ),
        ],
      ),
      say(
        'a_money',
        [
          '"To prove your money is clean, transfer your savings to the RBI verification account. It will be returned in 24 hours after checking."',
          '"अपने पैसे साफ़ साबित करने के लिए अपनी बचत RBI वेरिफिकेशन खाते में भेजिए। जांच के बाद 24 घंटे में लौटा दी जाएगी।"',
          '"మీ డబ్బు సక్రమమైనదని నిరూపించడానికి మీ పొదుపును RBI వెరిఫికేషన్ ఖాతాకు పంపండి. తనిఖీ తర్వాత 24 గంటల్లో తిరిగి ఇస్తారు."',
        ],
        [
          choice(
            'am_send',
            'a_end_scammed',
            0,
            ['Transfer the savings.', 'बचत ट्रांसफ़र कर दें।', 'పొదుపు బదిలీ చేయండి.'],
            [
              'There is no RBI verification account. The savings went to the scammers.',
              'RBI वेरिफिकेशन खाता नाम की कोई चीज़ नहीं है। बचत ठगों के पास चली गई।',
              'RBI వెరిఫికేషన్ ఖాతా అనేది లేదు. పొదుపు మోసగాళ్లకు వెళ్లింది.',
            ],
          ),
          choice(
            'am_stop',
            'a_end_reported',
            8,
            ['Refuse, end the call, and call 1930.', 'मना करें, कॉल खत्म करें और 1930 पर कॉल करें।', 'నిరాకరించి, కాల్ ముగించి, 1930 కు కాల్ చేయండి.'],
            [
              'Right. No agency moves your money to check it. A demand for money proves it is a scam.',
              'सही। कोई एजेंसी जांच के लिए आपके पैसे नहीं मंगवाती। पैसे की मांग ही ठगी का सबूत है।',
              'సరైనది. ఏ సంస్థా తనిఖీ కోసం మీ డబ్బు బదిలీ చేయించదు. డబ్బు అడగడమే మోసానికి రుజువు.',
            ],
            'ADVANCE_FEE',
          ),
        ],
      ),
      end('a_end_safe', 'safe', [
        'You kept your savings. Police, CBI, customs and courts never arrest anyone on a video call or ask for money.',
        'आपकी बचत बच गई। पुलिस, CBI, कस्टम और अदालत कभी वीडियो कॉल पर गिरफ्तार नहीं करते, न पैसे मांगते हैं।',
        'మీ పొదుపు సురక్షితం. పోలీసులు, CBI, కస్టమ్స్, కోర్టులు ఎప్పుడూ వీడియో కాల్‌లో అరెస్ట్ చేయవు, డబ్బు అడగవు.',
      ]),
      end('a_end_reported', 'safe', SAFE_REPORT),
      end('a_end_scammed', 'scammed', [
        'The savings are with the scammers. In real life: call 1930 straight away, then your bank, and tell your family.',
        'बचत ठगों के पास है। असल में: तुरंत 1930 पर कॉल करें, फिर बैंक को, और परिवार को बताएं।',
        'పొదుపు మోసగాళ్ల దగ్గర ఉంది. నిజ జీవితంలో: వెంటనే 1930 కు, తర్వాత బ్యాంక్‌కు కాల్ చేసి, కుటుంబానికి చెప్పండి.',
      ]),
    ],
  ),

  drill(
    {
      id: 'drill-task-job',
      title: t(['Like videos, earn money', 'वीडियो लाइक करो, पैसे कमाओ', 'వీడియోలకు లైక్ చేసి డబ్బు సంపాదించండి']),
      category: 'job_task',
      difficulty: 2,
      channel: 'whatsapp',
      persona: { name: 'HR Priya', avatar: 'recruiter' },
    },
    [
      say(
        'j_start',
        [
          'Hello! I am Priya from HR. Part-time job: like YouTube videos and earn ₹2,000 a day from home. Want to try 3 free tasks?',
          'नमस्ते! मैं HR से प्रिया। पार्ट-टाइम नौकरी: घर बैठे YouTube वीडियो लाइक करके रोज़ ₹2,000 कमाएं। 3 मुफ़्त टास्क आज़माना चाहेंगे?',
          'హలో! నేను HR నుండి ప్రియ. పార్ట్ టైమ్ ఉద్యోగం: ఇంటి నుండే YouTube వీడియోలకు లైక్ చేసి రోజుకు ₹2,000 సంపాదించండి. 3 ఉచిత టాస్క్‌లు ప్రయత్నిస్తారా?',
        ],
        [
          choice(
            'j_try',
            'j_paid',
            3,
            ['Sure, I will try the free ones.', 'ज़रूर, मुफ़्त वाले आज़माता हूं।', 'సరే, ఉచితవి ప్రయత్నిస్తాను.'],
            [
              'The free tasks really do pay a little. That is how they win your trust.',
              'मुफ़्त टास्क सच में थोड़ा पैसा देते हैं। इसी से वे आपका भरोसा जीतते हैं।',
              'ఉచిత టాస్క్‌లు నిజంగానే కొంచెం డబ్బు ఇస్తాయి. అలాగే వారు మీ నమ్మకం గెలుచుకుంటారు.',
            ],
          ),
          choice(
            'j_ignore',
            'j_end_safe',
            10,
            ['No thanks. Block.', 'नहीं, धन्यवाद। ब्लॉक।', 'వద్దు, ధన్యవాదాలు. బ్లాక్.'],
            [
              'Good call. ₹2,000 a day for a few likes is too good to be true.',
              'सही फ़ैसला। कुछ लाइक के लिए रोज़ ₹2,000 सच होने के लिए बहुत अच्छा है।',
              'మంచి నిర్ణయం. కొన్ని లైక్‌లకు రోజుకు ₹2,000 నమ్మలేనంత మంచిది.',
            ],
            'TOO_GOOD_RETURNS',
          ),
        ],
      ),
      say(
        'j_paid',
        [
          'Well done, ₹150 sent to you! Now join our VIP group for premium tasks. Pay ₹1,000 for the first one and get ₹1,300 back in 10 minutes.',
          'शाबाश, आपको ₹150 भेज दिए! अब प्रीमियम टास्क के लिए हमारे VIP ग्रुप में जुड़िए। पहले टास्क के लिए ₹1,000 दीजिए और 10 मिनट में ₹1,300 वापस पाइए।',
          'బాగా చేశారు, మీకు ₹150 పంపాము! ఇప్పుడు ప్రీమియం టాస్క్‌ల కోసం మా VIP గ్రూప్‌లో చేరండి. మొదటిదానికి ₹1,000 చెల్లించి 10 నిమిషాల్లో ₹1,300 తిరిగి పొందండి.',
        ],
        [
          choice(
            'jp_pay',
            'j_frozen',
            0,
            ['Pay ₹1,000; they already paid me once.', '₹1,000 दे दें; उन्होंने एक बार तो पैसे दिए हैं।', '₹1,000 చెల్లించండి; వారు ఒకసారి డబ్బు ఇచ్చారు కదా.'],
            [
              'A job that asks you to pay is not a job. The ₹150 was bait.',
              'जो नौकरी आपसे पैसे मांगे, वह नौकरी नहीं है। ₹150 चारा था।',
              'మిమ్మల్ని డబ్బు కట్టమనే ఉద్యోగం ఉద్యోగం కాదు. ₹150 ఎర మాత్రమే.',
            ],
          ),
          choice(
            'jp_stop',
            'j_end_reported',
            10,
            ['Stop here. Report and leave the group.', 'यहीं रुकें। शिकायत करें और ग्रुप छोड़ें।', 'ఇక్కడే ఆపండి. ఫిర్యాదు చేసి గ్రూప్ వదలండి.'],
            [
              'Right. Paying to earn is the sign of a task scam. You keep the ₹150 and lose nothing.',
              'सही। कमाने के लिए पैसे देना टास्क ठगी की पहचान है। ₹150 आपके पास रहे, नुकसान कुछ नहीं।',
              'సరైనది. సంపాదించడానికి డబ్బు కట్టడం టాస్క్ మోసానికి గుర్తు. ₹150 మీ దగ్గరే, నష్టం లేదు.',
            ],
            'TASK_JOB_PAYMENT',
          ),
        ],
      ),
      say(
        'j_frozen',
        [
          'Your balance is ₹4,800 but withdrawal is frozen because of a mistake in your task. Recharge ₹5,000 now to unlock everything.',
          'आपका बैलेंस ₹4,800 है लेकिन टास्क में गलती के कारण निकासी रुकी है। सब अनलॉक करने के लिए अभी ₹5,000 रिचार्ज करें।',
          'మీ బ్యాలెన్స్ ₹4,800 కానీ టాస్క్‌లో పొరపాటు వల్ల విత్‌డ్రా ఆగిపోయింది. అన్నీ అన్‌లాక్ చేయడానికి ఇప్పుడే ₹5,000 రీఛార్జ్ చేయండి.',
        ],
        [
          choice(
            'jf_pay',
            'j_end_scammed',
            0,
            ['Pay ₹5,000 to get my money out.', 'अपने पैसे निकालने के लिए ₹5,000 दें।', 'నా డబ్బు తీసుకోవడానికి ₹5,000 చెల్లించండి.'],
            [
              'The balance on screen is not real money. Each "unlock" asks for more.',
              'स्क्रीन पर दिख रहा बैलेंस असली पैसा नहीं है। हर "अनलॉक" के लिए और मांगा जाता है।',
              'స్క్రీన్‌పై బ్యాలెన్స్ నిజమైన డబ్బు కాదు. ప్రతి "అన్‌లాక్"కి ఇంకా ఎక్కువ అడుగుతారు.',
            ],
          ),
          choice(
            'jf_stop',
            'j_end_stopped',
            7,
            ['Stop paying and report it on 1930.', 'पैसे देना बंद करें और 1930 पर शिकायत करें।', 'చెల్లించడం ఆపి 1930 లో ఫిర్యాదు చేయండి.'],
            [
              'Right, though ₹1,000 is already gone. Stopping now saves the rest; report it quickly.',
              'सही, हालांकि ₹1,000 जा चुके हैं। अभी रुकने से बाकी बचेगा; जल्दी शिकायत करें।',
              'సరైనది, అయితే ₹1,000 ఇప్పటికే పోయాయి. ఇప్పుడు ఆపితే మిగతాది మిగులుతుంది; త్వరగా ఫిర్యాదు చేయండి.',
            ],
            'ADVANCE_FEE',
          ),
        ],
      ),
      end('j_end_safe', 'safe', [
        'You kept your money. Real jobs pay you; they never ask you to pay to work or to withdraw.',
        'आपके पैसे बच गए। असली नौकरी आपको पैसे देती है; काम करने या पैसे निकालने के लिए कभी पैसे नहीं मांगती।',
        'మీ డబ్బు సురక్షితం. నిజమైన ఉద్యోగాలు మీకు జీతం ఇస్తాయి; పని చేయడానికి లేదా డబ్బు తీసుకోవడానికి ఎప్పుడూ డబ్బు అడగవు.',
      ]),
      end('j_end_reported', 'safe', SAFE_REPORT),
      end('j_end_stopped', 'safe', [
        'You stopped before losing more. The ₹1,000 is gone, so report it on 1930 or cybercrime.gov.in quickly with the payment details.',
        'आपने और नुकसान से पहले रोक दिया। ₹1,000 जा चुके हैं, इसलिए भुगतान की जानकारी के साथ जल्दी 1930 या cybercrime.gov.in पर शिकायत करें।',
        'మరింత నష్టపోకముందే ఆపారు. ₹1,000 పోయాయి, కాబట్టి చెల్లింపు వివరాలతో త్వరగా 1930 లేదా cybercrime.gov.in లో ఫిర్యాదు చేయండి.',
      ]),
      end('j_end_scammed', 'scammed', [
        'You lost ₹6,000 and the "balance" never paid out. In real life: call 1930 straight away with the payment details.',
        'आपने ₹6,000 गंवाए और "बैलेंस" कभी नहीं मिला। असल में: भुगतान की जानकारी के साथ तुरंत 1930 पर कॉल करें।',
        'మీరు ₹6,000 కోల్పోయారు, "బ్యాలెన్స్" ఎప్పటికీ రాలేదు. నిజ జీవితంలో: చెల్లింపు వివరాలతో వెంటనే 1930 కు కాల్ చేయండి.',
      ]),
    ],
  ),

  drill(
    {
      id: 'drill-otp-bank-call',
      title: t(['"Read me the OTP to stop the fraud"', '"धोखाधड़ी रोकने के लिए OTP बताइए"', '"మోసం ఆపడానికి OTP చెప్పండి"']),
      category: 'otp_theft',
      difficulty: 2,
      channel: 'call',
      persona: { name: 'Bank Security Team', avatar: 'bank' },
    },
    [
      say(
        'o_start',
        [
          'Hello, I am calling from your bank\'s security team. Someone is trying to take ₹18,000 from your account right now. I am blocking it. You will get an OTP; read it to me so I can cancel the transaction.',
          'नमस्ते, मैं आपके बैंक की सिक्योरिटी टीम से बोल रहा हूं। अभी कोई आपके खाते से ₹18,000 निकालने की कोशिश कर रहा है। मैं इसे रोक रहा हूं। आपको एक OTP आएगा; लेनदेन रद्द करने के लिए वह मुझे बताइए।',
          'నమస్తే, మీ బ్యాంక్ సెక్యూరిటీ టీమ్ నుండి మాట్లాడుతున్నాను. ఇప్పుడే ఎవరో మీ ఖాతా నుండి ₹18,000 తీసుకోవడానికి ప్రయత్నిస్తున్నారు. నేను దాన్ని ఆపుతున్నాను. మీకు ఒక OTP వస్తుంది; లావాదేవీ రద్దు చేయడానికి అది నాకు చెప్పండి.',
        ],
        [
          choice(
            'o_hang',
            'o_end_safe',
            10,
            ['Hang up and call the number on the back of my card.', 'फ़ोन काटकर कार्ड के पीछे लिखे नंबर पर कॉल करूं।', 'ఫోన్ కట్ చేసి నా కార్డ్ వెనుక ఉన్న నంబర్‌కు కాల్ చేస్తాను.'],
            [
              'Right. A bank never asks you for an OTP. Calling the official number yourself is the safe check.',
              'सही। बैंक कभी OTP नहीं मांगता। खुद आधिकारिक नंबर पर कॉल करना ही सुरक्षित जांच है।',
              'సరైనది. బ్యాంక్ ఎప్పుడూ OTP అడగదు. అధికారిక నంబర్‌కు మీరే కాల్ చేయడం సురక్షితమైన తనిఖీ.',
            ],
            'ASKS_OTP',
          ),
          choice(
            'o_ask',
            'o_push',
            3,
            ['How do I know you are from the bank?', 'मैं कैसे मानूं कि आप बैंक से हैं?', 'మీరు బ్యాంక్ నుండే అని నాకెలా తెలుస్తుంది?'],
            [
              'Good to doubt. A name, an employee ID or a caller ID proves nothing.',
              'शक करना सही है। नाम, कर्मचारी ID या कॉलर ID से कुछ साबित नहीं होता।',
              'అనుమానించడం మంచిదే. పేరు, ఉద్యోగి ID లేదా కాలర్ ID ఏమీ నిరూపించవు.',
            ],
          ),
          choice(
            'o_wait',
            'o_otp',
            0,
            ['OK, I will wait for the OTP.', 'ठीक है, मैं OTP का इंतज़ार करता हूं।', 'సరే, OTP కోసం ఎదురుచూస్తాను.'],
            [
              'An OTP is a key to your account. Nobody who calls you should ever get it.',
              'OTP आपके खाते की चाबी है। फ़ोन करने वाले किसी को भी यह नहीं मिलना चाहिए।',
              'OTP మీ ఖాతాకు తాళంచెవి. మీకు ఫోన్ చేసిన ఎవరికీ అది ఇవ్వకూడదు.',
            ],
          ),
        ],
      ),
      say(
        'o_push',
        [
          'I am Rahul Verma, employee ID 4471. If you do not cooperate, your account will be frozen today. Just tell me the OTP.',
          'मैं राहुल वर्मा हूं, कर्मचारी ID 4471। आपने सहयोग नहीं किया तो आज ही आपका खाता फ़्रीज़ हो जाएगा। बस OTP बता दीजिए।',
          'నేను రాహుల్ వర్మ, ఉద్యోగి ID 4471. మీరు సహకరించకపోతే ఈరోజే మీ ఖాతా ఫ్రీజ్ అవుతుంది. OTP చెప్పండి చాలు.',
        ],
        [
          choice(
            'op_report',
            'o_end_reported',
            10,
            ['Cut the call, block the number and report it.', 'कॉल काटें, नंबर ब्लॉक करें और शिकायत करें।', 'కాల్ కట్ చేసి, నంబర్ బ్లాక్ చేసి, ఫిర్యాదు చేయండి.'],
            [
              'Right. The threat to freeze your account is there to scare you into giving the OTP.',
              'सही। खाता फ़्रीज़ करने की धमकी आपको डराकर OTP लेने के लिए है।',
              'సరైనది. ఖాతా ఫ్రీజ్ చేస్తామనే బెదిరింపు మిమ్మల్ని భయపెట్టి OTP తీసుకోవడానికే.',
            ],
            'THREAT_BLOCK',
          ),
          choice(
            'op_give',
            'o_end_scammed',
            0,
            ['He has an employee ID, so I will tell him.', 'उनके पास कर्मचारी ID है, तो बता देता हूं।', 'ఆయనకు ఉద్యోగి ID ఉంది కాబట్టి చెప్పేస్తాను.'],
            [
              'Anyone can say an employee ID. The OTP approved a payment from your account.',
              'कर्मचारी ID कोई भी बोल सकता है। OTP से आपके खाते से भुगतान मंज़ूर हो गया।',
              'ఉద్యోగి ID ఎవరైనా చెప్పవచ్చు. OTP తో మీ ఖాతా నుండి చెల్లింపు ఆమోదించబడింది.',
            ],
          ),
        ],
      ),
      say(
        'o_otp',
        [
          'The OTP has come, yes? Read it to me now, quickly, the money will leave in two minutes!',
          'OTP आ गया ना? अभी जल्दी बताइए, दो मिनट में पैसे निकल जाएंगे!',
          'OTP వచ్చిందా? ఇప్పుడే త్వరగా చెప్పండి, రెండు నిమిషాల్లో డబ్బు వెళ్లిపోతుంది!',
        ],
        [
          choice(
            'oo_read',
            'o_end_scammed',
            0,
            ['Read out the OTP.', 'OTP पढ़कर बता दें।', 'OTP చదివి చెప్పండి.'],
            [
              'The SMS said the OTP was for a payment of ₹18,000 and not to share it. Reading it out approved that payment.',
              'SMS में लिखा था कि OTP ₹18,000 के भुगतान के लिए है और किसी को न बताएं। बताते ही वह भुगतान मंज़ूर हो गया।',
              'OTP ₹18,000 చెల్లింపు కోసం అని, ఎవరికీ చెప్పవద్దని SMS లో ఉంది. చెప్పగానే ఆ చెల్లింపు ఆమోదించబడింది.',
            ],
          ),
          choice(
            'oo_sms',
            'o_end_reported',
            10,
            [
              'Read the SMS first: it says the OTP is for a payment. Cut the call and report it.',
              'पहले SMS पढ़ें: उसमें लिखा है कि OTP भुगतान के लिए है। कॉल काटें और शिकायत करें।',
              'ముందు SMS చదవండి: OTP చెల్లింపు కోసం అని ఉంది. కాల్ కట్ చేసి ఫిర్యాదు చేయండి.',
            ],
            [
              'Right. The OTP would have approved a payment, not cancelled one. The hurry was there to stop you reading it.',
              'सही। OTP से भुगतान मंज़ूर होता, रद्द नहीं। जल्दबाज़ी इसलिए थी कि आप उसे पढ़ न पाएं।',
              'సరైనది. OTP చెల్లింపును ఆమోదించేది, రద్దు చేసేది కాదు. మీరు చదవకుండా ఉండటానికే తొందర.',
            ],
            'URGENCY',
          ),
        ],
      ),
      end('o_end_safe', 'safe', [
        'You kept your money. If a transaction really is suspicious, your bank blocks it without asking you for an OTP.',
        'आपके पैसे बच गए। लेनदेन सच में संदिग्ध हो तो बैंक आपसे OTP मांगे बिना उसे रोक देता है।',
        'మీ డబ్బు సురక్షితం. లావాదేవీ నిజంగా అనుమానాస్పదమైతే బ్యాంక్ మిమ్మల్ని OTP అడగకుండానే దాన్ని ఆపుతుంది.',
      ]),
      end('o_end_reported', 'safe', SAFE_REPORT),
      end('o_end_scammed', 'scammed', [
        'The OTP approved a payment of ₹18,000 to the scammer. In real life: call 1930 and your bank straight away.',
        'OTP से ठग को ₹18,000 का भुगतान मंज़ूर हो गया। असल में: तुरंत 1930 और अपने बैंक को कॉल करें।',
        'OTP తో మోసగాడికి ₹18,000 చెల్లింపు ఆమోదించబడింది. నిజ జీవితంలో: వెంటనే 1930 కు, మీ బ్యాంక్‌కు కాల్ చేయండి.',
      ]),
    ],
  ),

  drill(
    {
      id: 'drill-parcel-fee',
      title: t(['The ₹25 re-delivery fee', '₹25 की री-डिलीवरी फ़ीस', '₹25 రీ-డెలివరీ ఫీజు']),
      category: 'courier_customs',
      difficulty: 1,
      channel: 'sms',
      persona: { name: 'IN-PARCEL', avatar: 'courier' },
    },
    [
      say(
        'p_start',
        [
          'Your parcel could not be delivered because the address is incomplete. Pay the ₹25 re-delivery fee within 12 hours or it will be returned: https://parcel-redeliver.top/pay',
          'पता अधूरा होने से आपका पार्सल डिलीवर नहीं हो सका। 12 घंटे में ₹25 री-डिलीवरी फ़ीस दें वरना पार्सल लौटा दिया जाएगा: https://parcel-redeliver.top/pay',
          'చిరునామా అసంపూర్తిగా ఉన్నందున మీ పార్సెల్ డెలివరీ కాలేదు. 12 గంటల్లో ₹25 రీ-డెలివరీ ఫీజు చెల్లించండి, లేకపోతే పార్సెల్ తిరిగి పంపబడుతుంది: https://parcel-redeliver.top/pay',
        ],
        [
          choice(
            'p_tap',
            'p_page',
            0,
            ['I am expecting a parcel. Tap the link.', 'मैं पार्सल का इंतज़ार कर रहा हूं। लिंक दबाऊं।', 'నేను పార్సెల్ కోసం ఎదురుచూస్తున్నాను. లింక్ నొక్కుతాను.'],
            [
              'A small fee makes it feel harmless. Look at the address: parcel-redeliver.top is not a courier\'s website.',
              'छोटी फ़ीस से यह मामूली लगता है। पता देखें: parcel-redeliver.top किसी कूरियर की वेबसाइट नहीं है।',
              'చిన్న ఫీజు వల్ల ఇది హానిలేనిదిగా అనిపిస్తుంది. చిరునామా చూడండి: parcel-redeliver.top ఏ కొరియర్ వెబ్‌సైట్ కాదు.',
            ],
          ),
          choice(
            'p_track',
            'p_end_safe',
            10,
            [
              'Check the tracking number in the courier\'s official app instead.',
              'इसकी जगह कूरियर के आधिकारिक ऐप में ट्रैकिंग नंबर देखूं।',
              'దానికి బదులు కొరియర్ అధికారిక యాప్‌లో ట్రాకింగ్ నంబర్ చూస్తాను.',
            ],
            [
              'Right. Couriers do not collect fees through SMS links; the official app or website shows the real status.',
              'सही। कूरियर SMS लिंक से फ़ीस नहीं लेते; असली स्थिति आधिकारिक ऐप या वेबसाइट पर दिखती है।',
              'సరైనది. కొరియర్లు SMS లింక్‌ల ద్వారా ఫీజు తీసుకోవు; అసలు స్థితి అధికారిక యాప్ లేదా వెబ్‌సైట్‌లో కనిపిస్తుంది.',
            ],
            'SUSPICIOUS_LINK',
          ),
          choice(
            'p_ignore',
            'p_end_reported',
            8,
            [
              'I am not expecting anything. Delete it and report the sender.',
              'मैं कुछ नहीं मंगा रहा। मैसेज हटाकर भेजने वाले की शिकायत करूं।',
              'నేను ఏమీ ఆర్డర్ చేయలేదు. మెసేజ్ తొలగించి పంపినవారిపై ఫిర్యాదు చేస్తాను.',
            ],
            [
              'Good. These messages go to thousands of people at once, hoping some are expecting a parcel.',
              'अच्छा। ऐसे मैसेज एक साथ हज़ारों लोगों को जाते हैं, इस उम्मीद में कि कोई पार्सल का इंतज़ार कर रहा हो।',
              'మంచిది. పార్సెల్ కోసం ఎవరో ఎదురుచూస్తుంటారనే ఆశతో ఇలాంటి మెసేజ్‌లు ఒకేసారి వేలమందికి వెళ్తాయి.',
            ],
            'RISKY_TLD',
          ),
        ],
      ),
      say(
        'p_page',
        [
          'The page shows a courier logo and asks for your card number, expiry date and CVV, then: "Enter the OTP sent to your phone to pay ₹25."',
          'पेज पर कूरियर का लोगो है और वह कार्ड नंबर, एक्सपायरी तारीख और CVV मांगता है, फिर: "₹25 भरने के लिए फ़ोन पर आया OTP डालें।"',
          'పేజీలో కొరియర్ లోగో ఉంది, అది కార్డ్ నంబర్, గడువు తేదీ, CVV అడుగుతుంది, ఆ తర్వాత: "₹25 చెల్లించడానికి మీ ఫోన్‌కు వచ్చిన OTP ఎంటర్ చేయండి."',
        ],
        [
          choice(
            'pp_pay',
            'p_end_scammed',
            0,
            ['Enter the card details and the OTP to pay ₹25.', '₹25 भरने के लिए कार्ड की जानकारी और OTP डालूं।', '₹25 చెల్లించడానికి కార్డ్ వివరాలు, OTP ఎంటర్ చేస్తాను.'],
            [
              'The OTP SMS was for a much bigger amount than ₹25. The page was there to get your card details and OTP.',
              'OTP वाला SMS ₹25 से कहीं बड़ी रकम का था। यह पेज आपके कार्ड की जानकारी और OTP लेने के लिए था।',
              'OTP SMS ₹25 కంటే చాలా పెద్ద మొత్తానికి వచ్చింది. మీ కార్డ్ వివరాలు, OTP తీసుకోవడానికే ఆ పేజీ.',
            ],
          ),
          choice(
            'pp_close',
            'p_end_reported',
            8,
            [
              'Close the page. A ₹25 fee should not need my CVV and an OTP. Report it.',
              'पेज बंद करूं। ₹25 की फ़ीस के लिए CVV और OTP की ज़रूरत नहीं होनी चाहिए। शिकायत करूं।',
              'పేజీ మూసేస్తాను. ₹25 ఫీజుకు CVV, OTP అవసరం ఉండకూడదు. ఫిర్యాదు చేస్తాను.',
            ],
            [
              'Right. You stopped before entering anything. If you had typed card details, you would block the card now.',
              'सही। आपने कुछ भी डालने से पहले रोक दिया। अगर कार्ड की जानकारी डाली होती तो अभी कार्ड ब्लॉक करना होता।',
              'సరైనది. ఏదీ ఎంటర్ చేయకముందే ఆపారు. కార్డ్ వివరాలు టైప్ చేసి ఉంటే ఇప్పుడు కార్డ్ బ్లాక్ చేయాలి.',
            ],
            'ASKS_CVV_PASSWORD',
          ),
        ],
      ),
      end('p_end_safe', 'safe', [
        'You kept your money. Check deliveries only in the courier\'s own app or website, never through a link in an SMS.',
        'आपके पैसे बच गए। डिलीवरी हमेशा कूरियर के अपने ऐप या वेबसाइट में देखें, SMS के लिंक से कभी नहीं।',
        'మీ డబ్బు సురక్షితం. డెలివరీని ఎప్పుడూ కొరియర్ సొంత యాప్ లేదా వెబ్‌సైట్‌లోనే చూడండి, SMS లింక్ ద్వారా ఎప్పుడూ కాదు.',
      ]),
      end('p_end_reported', 'safe', SAFE_REPORT),
      end('p_end_scammed', 'scammed', [
        'Your card was charged far more than ₹25. In real life: block the card in your bank app and call 1930 straight away.',
        'आपके कार्ड से ₹25 से कहीं ज़्यादा कट गया। असल में: बैंक ऐप में कार्ड ब्लॉक करें और तुरंत 1930 पर कॉल करें।',
        'మీ కార్డ్ నుండి ₹25 కంటే చాలా ఎక్కువ కట్ అయింది. నిజ జీవితంలో: బ్యాంక్ యాప్‌లో కార్డ్ బ్లాక్ చేసి వెంటనే 1930 కు కాల్ చేయండి.',
      ]),
    ],
  ),

  drill(
    {
      id: 'drill-screen-share',
      title: t(['The helpline from a search result', 'सर्च में मिला हेल्पलाइन नंबर', 'సెర్చ్‌లో దొరికిన హెల్ప్‌లైన్ నంబర్']),
      category: 'remote_access',
      difficulty: 2,
      channel: 'call',
      persona: { name: 'Customer Care', avatar: 'support' },
    },
    [
      say(
        's_start',
        [
          'Thank you for calling customer care. I can see your failed payment of ₹3,200 is stuck. Install the "Quick Help Desk" app from the Play Store and tell me the 9-digit code on the screen, and I will refund it.',
          'कस्टमर केयर पर कॉल करने के लिए धन्यवाद। मैं देख रहा हूं कि आपका ₹3,200 का फेल हुआ भुगतान अटका है। Play Store से "Quick Help Desk" ऐप इंस्टॉल करें और स्क्रीन पर दिखा 9 अंकों का कोड बताएं, मैं रिफंड कर दूंगा।',
          'కస్టమర్ కేర్‌కు కాల్ చేసినందుకు ధన్యవాదాలు. మీ ₹3,200 ఫెయిల్ అయిన చెల్లింపు ఆగిపోయింది. Play Store నుండి "Quick Help Desk" యాప్ ఇన్‌స్టాల్ చేసి స్క్రీన్‌పై కనిపించే 9 అంకెల కోడ్ చెప్పండి, నేను రీఫండ్ చేస్తాను.',
        ],
        [
          choice(
            's_official',
            's_end_safe',
            10,
            [
              'Hang up and raise the complaint in the Help section of the official app.',
              'फ़ोन काटकर आधिकारिक ऐप के Help सेक्शन में शिकायत दर्ज करूं।',
              'ఫోన్ కట్ చేసి అధికారిక యాప్‌లోని Help విభాగంలో ఫిర్యాదు చేస్తాను.',
            ],
            [
              'Right. Scammers plant fake helpline numbers in search results; the help inside the official app is the real one.',
              'सही। ठग सर्च नतीजों में नकली हेल्पलाइन नंबर डालते हैं; आधिकारिक ऐप के अंदर वाली मदद ही असली है।',
              'సరైనది. మోసగాళ్లు సెర్చ్ ఫలితాల్లో నకిలీ హెల్ప్‌లైన్ నంబర్లు పెడతారు; అధికారిక యాప్‌లోని సహాయమే నిజమైనది.',
            ],
            'ASKS_REMOTE_APP',
          ),
          choice(
            's_why',
            's_push',
            3,
            [
              'Why do you need to see my screen for a refund?',
              'रिफंड के लिए आपको मेरी स्क्रीन क्यों देखनी है?',
              'రీఫండ్ కోసం మీరు నా స్క్రీన్ ఎందుకు చూడాలి?',
            ],
            [
              'Good question. Real support never needs to see or control your phone.',
              'अच्छा सवाल। असली सपोर्ट को कभी आपका फ़ोन देखने या चलाने की ज़रूरत नहीं होती।',
              'మంచి ప్రశ్న. నిజమైన సపోర్ట్‌కు మీ ఫోన్ చూడాల్సిన లేదా నియంత్రించాల్సిన అవసరం ఎప్పుడూ ఉండదు.',
            ],
          ),
          choice(
            's_install',
            's_code',
            0,
            ['Install the app as he says.', 'जैसा वे कह रहे हैं, ऐप इंस्टॉल करूं।', 'ఆయన చెప్పినట్టు యాప్ ఇన్‌స్టాల్ చేస్తాను.'],
            [
              'A screen-sharing app lets the caller see everything on your phone, including OTPs and your PIN as you type it.',
              'स्क्रीन शेयरिंग ऐप से कॉल करने वाला आपके फ़ोन पर सब कुछ देख सकता है, OTP और टाइप करते समय आपका PIN भी।',
              'స్క్రీన్ షేరింగ్ యాప్‌తో కాల్ చేసినవారు మీ ఫోన్‌లో అన్నీ చూడగలరు, OTP లు, మీరు టైప్ చేసే పిన్ కూడా.',
            ],
          ),
        ],
      ),
      say(
        's_push',
        [
          'Sir, it is our standard process, every customer does it. Otherwise your refund will be cancelled today.',
          'सर, यह हमारी सामान्य प्रक्रिया है, हर ग्राहक यही करता है। वरना आज आपका रिफंड रद्द हो जाएगा।',
          'సార్, ఇది మా సాధారణ ప్రక్రియ, ప్రతి కస్టమర్ ఇలాగే చేస్తారు. లేకపోతే ఈరోజు మీ రీఫండ్ రద్దవుతుంది.',
        ],
        [
          choice(
            'sp_report',
            's_end_reported',
            10,
            ['Hang up and report the number.', 'फ़ोन काटकर नंबर की शिकायत करूं।', 'ఫోన్ కట్ చేసి నంబర్‌పై ఫిర్యాదు చేస్తాను.'],
            [
              'Right. "Everyone does it" and a deadline are pressure, not a reason.',
              'सही। "सब करते हैं" और समय-सीमा दबाव है, कारण नहीं।',
              'సరైనది. "అందరూ చేస్తారు", గడువు అనేవి ఒత్తిడి మాత్రమే, కారణం కాదు.',
            ],
            'URGENCY',
          ),
          choice(
            'sp_install',
            's_code',
            0,
            ['Fine, I will install it.', 'ठीक है, इंस्टॉल कर देता हूं।', 'సరే, ఇన్‌స్టాల్ చేస్తాను.'],
            [
              'Once the app is open, the caller can watch everything you do.',
              'ऐप खुलते ही कॉल करने वाला आपकी हर हरकत देख सकता है।',
              'యాప్ తెరిచిన వెంటనే కాల్ చేసినవారు మీరు చేసే ప్రతిదీ చూడగలరు.',
            ],
          ),
        ],
      ),
      say(
        's_code',
        [
          'Good, I am connected. Now open your UPI app, enter ₹1 to "verify" and type your PIN. I am watching to guide you.',
          'ठीक है, मैं जुड़ गया। अब अपना UPI ऐप खोलें, "वेरिफ़ाई" करने के लिए ₹1 डालें और अपना PIN टाइप करें। मैं देखकर बताता रहूंगा।',
          'సరే, కనెక్ట్ అయ్యాను. ఇప్పుడు మీ UPI యాప్ తెరిచి "వెరిఫై" చేయడానికి ₹1 ఎంటర్ చేసి పిన్ టైప్ చేయండి. నేను చూస్తూ చెబుతాను.',
        ],
        [
          choice(
            'sc_pin',
            's_end_scammed',
            0,
            ['Type the PIN while he watches.', 'उनके देखते हुए PIN टाइप करूं।', 'ఆయన చూస్తుండగా పిన్ టైప్ చేస్తాను.'],
            [
              'He watched your PIN being typed. With the app still open, he can now send money from your account.',
              'उन्होंने आपको PIN टाइप करते देख लिया। ऐप खुला होने से वे अब आपके खाते से पैसे भेज सकते हैं।',
              'మీరు పిన్ టైప్ చేయడం ఆయన చూశారు. యాప్ ఇంకా తెరిచి ఉండటంతో ఇప్పుడు మీ ఖాతా నుండి డబ్బు పంపగలరు.',
            ],
          ),
          choice(
            'sc_stop',
            's_end_reported',
            8,
            [
              'Stop. Turn on airplane mode, uninstall the app and call my bank.',
              'रुकूं। एयरप्लेन मोड चालू करूं, ऐप अनइंस्टॉल करूं और बैंक को कॉल करूं।',
              'ఆపేస్తాను. ఎయిర్‌ప్లేన్ మోడ్ ఆన్ చేసి, యాప్ అన్‌ఇన్‌స్టాల్ చేసి, బ్యాంక్‌కు కాల్ చేస్తాను.',
            ],
            [
              'Right. Airplane mode and uninstalling cut their access. Tell the bank a remote app was installed.',
              'सही। एयरप्लेन मोड और अनइंस्टॉल करने से उनकी पहुंच कट जाती है। बैंक को बताएं कि रिमोट ऐप इंस्टॉल हुआ था।',
              'సరైనది. ఎయిర్‌ప్లేన్ మోడ్, అన్‌ఇన్‌స్టాల్ వారి యాక్సెస్‌ను కట్ చేస్తాయి. రిమోట్ యాప్ ఇన్‌స్టాల్ అయిందని బ్యాంక్‌కు చెప్పండి.',
            ],
            'ASKS_PIN',
          ),
        ],
      ),
      end('s_end_safe', 'safe', [
        'You kept your money. Find support only inside the official app or on its official website.',
        'आपके पैसे बच गए। मदद सिर्फ़ आधिकारिक ऐप के अंदर या उसकी आधिकारिक वेबसाइट पर खोजें।',
        'మీ డబ్బు సురక్షితం. సహాయం కోసం అధికారిక యాప్‌లో లేదా దాని అధికారిక వెబ్‌సైట్‌లో మాత్రమే చూడండి.',
      ]),
      end('s_end_reported', 'safe', SAFE_REPORT),
      end('s_end_scammed', 'scammed', [
        'Money left your account while he watched. In real life: airplane mode, uninstall the app, then call 1930 and your bank.',
        'उनके देखते-देखते आपके खाते से पैसे निकल गए। असल में: एयरप्लेन मोड, ऐप अनइंस्टॉल, फिर 1930 और बैंक को कॉल करें।',
        'ఆయన చూస్తుండగానే మీ ఖాతా నుండి డబ్బు వెళ్లింది. నిజ జీవితంలో: ఎయిర్‌ప్లేన్ మోడ్, యాప్ అన్‌ఇన్‌స్టాల్, ఆ తర్వాత 1930 కు, బ్యాంక్‌కు కాల్ చేయండి.',
      ]),
    ],
  ),

  drill(
    {
      id: 'drill-investment-group',
      title: t(['"Guaranteed 5% a day"', '"रोज़ 5% पक्का मुनाफ़ा"', '"రోజుకు 5% ఖచ్చితమైన లాభం"']),
      category: 'investment_crypto',
      difficulty: 3,
      channel: 'whatsapp',
      persona: { name: 'Stock Mentor', avatar: 'unknown' },
    },
    [
      say(
        'i_start',
        [
          'Welcome to the VIP Profit Club! Our members earn a guaranteed 5% return every day. See today\'s screenshots from members. Start with just ₹10,000 on our trading app.',
          'VIP प्रॉफ़िट क्लब में स्वागत है! हमारे सदस्य रोज़ 5% पक्का मुनाफ़ा कमाते हैं। सदस्यों के आज के स्क्रीनशॉट देखिए। हमारे ट्रेडिंग ऐप पर सिर्फ़ ₹10,000 से शुरू करें।',
          'VIP ప్రాఫిట్ క్లబ్‌కు స్వాగతం! మా సభ్యులు ప్రతిరోజూ 5% ఖచ్చితమైన లాభం పొందుతారు. సభ్యుల ఈరోజు స్క్రీన్‌షాట్‌లు చూడండి. మా ట్రేడింగ్ యాప్‌లో కేవలం ₹10,000 తో ప్రారంభించండి.',
        ],
        [
          choice(
            'i_check',
            'i_end_safe',
            10,
            [
              'Check first whether the adviser is registered with SEBI.',
              'पहले देखूं कि सलाहकार SEBI में रजिस्टर्ड है या नहीं।',
              'సలహాదారు SEBI లో నమోదై ఉన్నారో లేదో ముందు చూస్తాను.',
            ],
            [
              'Right. No real investment guarantees a daily return, and registered advisers can be looked up on sebi.gov.in.',
              'सही। कोई असली निवेश रोज़ का मुनाफ़ा पक्का नहीं करता, और रजिस्टर्ड सलाहकार sebi.gov.in पर देखे जा सकते हैं।',
              'సరైనది. ఏ నిజమైన పెట్టుబడీ రోజువారీ లాభానికి హామీ ఇవ్వదు, నమోదైన సలహాదారులను sebi.gov.in లో చూడవచ్చు.',
            ],
            'TOO_GOOD_RETURNS',
          ),
          choice(
            'i_leave',
            'i_end_reported',
            8,
            ['Leave the group and report it.', 'ग्रुप छोड़कर शिकायत करूं।', 'గ్రూప్ నుండి బయటకు వచ్చి ఫిర్యాదు చేస్తాను.'],
            [
              'Good. Screenshots of profits are easy to fake, and "guaranteed" returns are the warning sign.',
              'अच्छा। मुनाफ़े के स्क्रीनशॉट आसानी से नकली बनते हैं, और "पक्का" मुनाफ़ा ही चेतावनी है।',
              'మంచిది. లాభాల స్క్రీన్‌షాట్‌లను సులభంగా నకిలీ చేయవచ్చు, "ఖచ్చితమైన" లాభమే హెచ్చరిక.',
            ],
            'TOO_GOOD_RETURNS',
          ),
          choice(
            'i_join',
            'i_profit',
            0,
            ['The screenshots look real. I will start with ₹10,000.', 'स्क्रीनशॉट असली लगते हैं। ₹10,000 से शुरू करता हूं।', 'స్క్రీన్‌షాట్‌లు నిజమైనవిగా ఉన్నాయి. ₹10,000 తో మొదలుపెడతాను.'],
            [
              'The "members" and their screenshots are often part of the same scam.',
              'ये "सदस्य" और उनके स्क्रीनशॉट अक्सर उसी ठगी का हिस्सा होते हैं।',
              'ఆ "సభ్యులు", వారి స్క్రీన్‌షాట్‌లు తరచూ అదే మోసంలో భాగం.',
            ],
          ),
        ],
      ),
      say(
        'i_profit',
        [
          'Congratulations! Your ₹10,000 is now ₹14,600 in the app. Add ₹50,000 today for an institutional IPO slot: 3 times the money on listing day.',
          'बधाई हो! ऐप में आपके ₹10,000 अब ₹14,600 हो गए। संस्थागत IPO स्लॉट के लिए आज ₹50,000 और डालें: लिस्टिंग के दिन तीन गुना।',
          'అభినందనలు! యాప్‌లో మీ ₹10,000 ఇప్పుడు ₹14,600 అయ్యాయి. ఇన్‌స్టిట్యూషనల్ IPO స్లాట్ కోసం ఈరోజు ₹50,000 జోడించండి: లిస్టింగ్ రోజున మూడు రెట్లు.',
        ],
        [
          choice(
            'ip_more',
            'i_end_scammed',
            0,
            ['Add ₹50,000. The app shows I am winning.', '₹50,000 डालूं। ऐप दिखा रहा है कि मैं जीत रहा हूं।', '₹50,000 జోడిస్తాను. నేను గెలుస్తున్నట్టు యాప్ చూపిస్తోంది.'],
            [
              'The numbers in the app are typed in by the scammers. Money sent there does not come back.',
              'ऐप के आंकड़े ठग खुद डालते हैं। वहां भेजा पैसा वापस नहीं आता।',
              'యాప్‌లోని అంకెలను మోసగాళ్లే టైప్ చేస్తారు. అక్కడ పంపిన డబ్బు తిరిగి రాదు.',
            ],
          ),
          choice(
            'ip_withdraw',
            'i_fee',
            5,
            ['First let me withdraw what I have.', 'पहले जो है वह निकालकर देखूं।', 'ముందు ఉన్నది విత్‌డ్రా చేసి చూస్తాను.'],
            [
              'Good test. A real platform lets you take out your own money without new conditions.',
              'अच्छी जांच। असली प्लेटफ़ॉर्म बिना नई शर्तों के आपका पैसा निकालने देता है।',
              'మంచి పరీక్ష. నిజమైన ప్లాట్‌ఫామ్ కొత్త షరతులు లేకుండా మీ డబ్బు తీసుకోనిస్తుంది.',
            ],
          ),
        ],
      ),
      say(
        'i_fee',
        [
          'To withdraw, you must first pay 20% tax: ₹2,920 by UPI to mentor.tax.desk@ybl within 30 minutes, or the account will be frozen.',
          'निकालने के लिए पहले 20% टैक्स भरना होगा: 30 मिनट में ₹2,920 UPI से mentor.tax.desk@ybl पर, वरना खाता फ़्रीज़ हो जाएगा।',
          'విత్‌డ్రా చేయడానికి ముందుగా 20% పన్ను కట్టాలి: 30 నిమిషాల్లో ₹2,920 UPI ద్వారా mentor.tax.desk@ybl కు, లేకపోతే ఖాతా ఫ్రీజ్ అవుతుంది.',
        ],
        [
          choice(
            'if_pay',
            'i_end_scammed',
            0,
            ['Pay the tax so I can withdraw.', 'टैक्स भर दूं ताकि पैसे निकाल सकूं।', 'విత్‌డ్రా చేయడానికి పన్ను కట్టేస్తాను.'],
            [
              'Tax is never paid to a personal UPI ID before a withdrawal. After this fee there will be another.',
              'निकासी से पहले टैक्स कभी किसी निजी UPI ID पर नहीं भरा जाता। इस फ़ीस के बाद एक और आएगी।',
              'విత్‌డ్రాకు ముందు పన్ను ఎప్పుడూ వ్యక్తిగత UPI ID కి కట్టరు. ఈ ఫీజు తర్వాత ఇంకొకటి వస్తుంది.',
            ],
          ),
          choice(
            'if_stop',
            'i_end_stopped',
            8,
            ['Stop paying and report it on 1930.', 'पैसे देना बंद करूं और 1930 पर शिकायत करूं।', 'చెల్లించడం ఆపి 1930 లో ఫిర్యాదు చేస్తాను.'],
            [
              'Right. A fee to release your own money is the clearest sign. Stopping now saves the rest.',
              'सही। अपना ही पैसा निकालने के लिए फ़ीस सबसे साफ़ संकेत है। अभी रुकने से बाकी बचेगा।',
              'సరైనది. మీ సొంత డబ్బు విడుదలకు ఫీజు అడగడమే స్పష్టమైన సంకేతం. ఇప్పుడు ఆపితే మిగతాది మిగులుతుంది.',
            ],
            'ADVANCE_FEE',
          ),
        ],
      ),
      end('i_end_safe', 'safe', [
        'You kept your money. Real returns go up and down, and no registered adviser promises a fixed daily profit.',
        'आपके पैसे बच गए। असली मुनाफ़ा घटता-बढ़ता है, और कोई रजिस्टर्ड सलाहकार रोज़ का तय मुनाफ़ा नहीं देता।',
        'మీ డబ్బు సురక్షితం. నిజమైన లాభాలు పెరుగుతాయి, తగ్గుతాయి; నమోదైన ఏ సలహాదారూ రోజువారీ స్థిర లాభానికి హామీ ఇవ్వరు.',
      ]),
      end('i_end_reported', 'safe', SAFE_REPORT),
      end('i_end_stopped', 'safe', [
        'You stopped before losing more. The ₹10,000 is gone, so report it on 1930 or cybercrime.gov.in quickly with the payment details.',
        'आपने और नुकसान से पहले रोक दिया। ₹10,000 जा चुके हैं, इसलिए भुगतान की जानकारी के साथ जल्दी 1930 या cybercrime.gov.in पर शिकायत करें।',
        'మరింత నష్టపోకముందే ఆపారు. ₹10,000 పోయాయి, కాబట్టి చెల్లింపు వివరాలతో త్వరగా 1930 లేదా cybercrime.gov.in లో ఫిర్యాదు చేయండి.',
      ]),
      end('i_end_scammed', 'scammed', [
        'The app balance was never real and the money is gone. In real life: call 1930 straight away with every payment ID.',
        'ऐप का बैलेंस कभी असली नहीं था और पैसे चले गए। असल में: हर भुगतान की ID के साथ तुरंत 1930 पर कॉल करें।',
        'యాప్ బ్యాలెన్స్ ఎప్పుడూ నిజం కాదు, డబ్బు పోయింది. నిజ జీవితంలో: ప్రతి చెల్లింపు ID తో వెంటనే 1930 కు కాల్ చేయండి.',
      ]),
    ],
  ),
];
