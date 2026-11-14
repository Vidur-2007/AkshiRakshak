// STUB — owned by Laptop C; replaced on feat/data
import type { FaqItem } from '@akshi/contracts';

export const FAQ: FaqItem[] = [
  {
    id: 'faq-pin-sends-money',
    tags: ['upi', 'pin', 'collect', 'receive'],
    q: {
      en: 'Do I need my UPI PIN to receive money?',
      hi: 'क्या पैसे पाने के लिए UPI PIN चाहिए?',
      te: 'డబ్బు అందుకోవడానికి UPI PIN అవసరమా?',
    },
    a: {
      en: 'No. Entering your UPI PIN always sends money from your account. You never need a PIN, a QR scan or a collect-request approval to receive money.',
      hi: 'नहीं। UPI PIN डालने से हमेशा आपके खाते से पैसे जाते हैं। पैसे पाने के लिए PIN, QR स्कैन या कलेक्ट रिक्वेस्ट स्वीकार करने की कभी ज़रूरत नहीं होती।',
      te: 'లేదు. UPI PIN నమోదు చేస్తే ఎప్పుడూ మీ ఖాతా నుండి డబ్బు వెళ్తుంది. డబ్బు అందుకోవడానికి PIN, QR స్కాన్ లేదా కలెక్ట్ రిక్వెస్ట్ ఆమోదం అవసరం లేదు.',
    },
  },
  {
    id: 'faq-qr-receive',
    tags: ['qr', 'receive', 'buyer'],
    q: {
      en: 'Someone sent me a QR code so I can receive a payment. Is that normal?',
      hi: 'किसी ने पैसे भेजने के लिए मुझे QR कोड भेजा है। क्या यह सामान्य है?',
      te: 'డబ్బు అందుకోవడానికి ఎవరో నాకు QR కోడ్ పంపారు. ఇది సాధారణమేనా?',
    },
    a: {
      en: 'No. Scanning a QR code is only for paying. If a buyer or a "refund desk" asks you to scan a QR to receive money, it is a scam.',
      hi: 'नहीं। QR कोड स्कैन करना सिर्फ़ भुगतान करने के लिए होता है। अगर कोई खरीदार या "रिफंड डेस्क" पैसे पाने के लिए QR स्कैन करने को कहे, तो यह धोखा है।',
      te: 'కాదు. QR కోడ్ స్కాన్ చేయడం చెల్లించడానికి మాత్రమే. డబ్బు అందుకోవడానికి QR స్కాన్ చేయమని కొనుగోలుదారు లేదా "రీఫండ్ డెస్క్" అడిగితే, అది మోసం.',
    },
  },
  {
    id: 'faq-bank-never-asks-otp',
    tags: ['otp', 'bank', 'pin', 'cvv'],
    q: {
      en: 'Will my bank ever ask for my OTP?',
      hi: 'क्या मेरा बैंक कभी मेरा OTP मांगेगा?',
      te: 'నా బ్యాంక్ ఎప్పుడైనా నా OTP అడుగుతుందా?',
    },
    a: {
      en: 'No. Banks never ask for your OTP, PIN, CVV or password by call, SMS, email or WhatsApp. Anyone who asks is not your bank.',
      hi: 'नहीं। बैंक कभी कॉल, SMS, ईमेल या WhatsApp पर आपका OTP, PIN, CVV या पासवर्ड नहीं मांगते। जो मांगे, वह आपका बैंक नहीं है।',
      te: 'లేదు. బ్యాంకులు కాల్, SMS, ఇమెయిల్ లేదా WhatsApp ద్వారా మీ OTP, PIN, CVV లేదా పాస్ వర్డ్ ఎప్పుడూ అడగవు. అడిగేవారు మీ బ్యాంక్ కాదు.',
    },
  },
  {
    id: 'faq-digital-arrest',
    tags: ['digital_arrest', 'police', 'video call'],
    q: {
      en: 'A caller says I am under "digital arrest". What should I do?',
      hi: 'कॉल करने वाला कहता है कि मैं "डिजिटल अरेस्ट" में हूं। मैं क्या करूं?',
      te: 'నేను "డిజిటల్ అరెస్ట్" లో ఉన్నానని కాల్ చేసిన వ్యక్తి చెబుతున్నారు. నేను ఏమి చేయాలి?',
    },
    a: {
      en: 'End the call. There is no such thing as a digital arrest. Police and agencies do not question or arrest people over video calls, or ask for money to close a case. Report it at 1930 or cybercrime.gov.in.',
      hi: 'कॉल काट दें। "डिजिटल अरेस्ट" जैसी कोई चीज़ नहीं होती। पुलिस या एजेंसियां वीडियो कॉल पर पूछताछ या गिरफ़्तारी नहीं करतीं, न ही केस बंद करने के लिए पैसे मांगती हैं। 1930 या cybercrime.gov.in पर रिपोर्ट करें।',
      te: 'కాల్ కట్ చేయండి. "డిజిటల్ అరెస్ట్" అనేది ఏదీ లేదు. పోలీసులు లేదా సంస్థలు వీడియో కాల్ లో విచారించవు, అరెస్ట్ చేయవు, కేసు మూసివేయడానికి డబ్బు అడగవు. 1930 లేదా cybercrime.gov.in లో ఫిర్యాదు చేయండి.',
    },
  },
  {
    id: 'faq-how-to-report',
    tags: ['report', '1930', 'chakshu', 'cybercrime'],
    q: {
      en: 'How do I report a scam?',
      hi: 'धोखाधड़ी की रिपोर्ट कैसे करें?',
      te: 'మోసం గురించి ఎలా ఫిర్యాదు చేయాలి?',
    },
    a: {
      en: 'If money left your account, call 1930 straight away or report at cybercrime.gov.in. For a suspicious call, SMS or WhatsApp message where you did not lose money, report it on Chakshu at sancharsaathi.gov.in.',
      hi: 'अगर खाते से पैसे गए हैं, तो तुरंत 1930 पर कॉल करें या cybercrime.gov.in पर रिपोर्ट करें। अगर संदिग्ध कॉल, SMS या WhatsApp संदेश आया पर पैसे नहीं गए, तो sancharsaathi.gov.in पर चक्षु में रिपोर्ट करें।',
      te: 'మీ ఖాతా నుండి డబ్బు వెళ్తే, వెంటనే 1930 కు కాల్ చేయండి లేదా cybercrime.gov.in లో ఫిర్యాదు చేయండి. డబ్బు పోకుండా అనుమానాస్పద కాల్, SMS లేదా WhatsApp సందేశం వస్తే, sancharsaathi.gov.in లో చక్షులో రిపోర్ట్ చేయండి.',
    },
  },
];
