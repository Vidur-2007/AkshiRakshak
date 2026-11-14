// STUB — owned by Laptop C; replaced on feat/data
import type { Drill } from '@akshi/contracts';
import { DRILL_FIXTURE } from '@akshi/contracts/fixtures';

const COLLECT_REFUND_DRILL: Drill = {
  id: 'drill-collect-refund',
  title: { en: 'The "refund" collect request', hi: '"रिफंड" वाली कलेक्ट रिक्वेस्ट' },
  category: 'upi_collect',
  difficulty: 1,
  channel: 'whatsapp',
  persona: { name: 'Refund Desk (fake)', avatar: 'support' },
  langs: ['en', 'hi'],
  start: 'n_start',
  nodes: {
    n_start: {
      id: 'n_start',
      from: 'them',
      text: {
        en: 'Hello, your order refund of ₹2,000 is approved. I have sent a request on your UPI app. Please accept it and enter your PIN to receive the money.',
        hi: 'नमस्ते, आपके ऑर्डर का ₹2,000 रिफंड मंज़ूर हो गया है। आपके UPI ऐप पर रिक्वेस्ट भेजी है। पैसे पाने के लिए उसे स्वीकार करके PIN डालें।',
      },
      choices: [
        {
          id: 'c_accept',
          next: 'end_scammed',
          points: 0,
          redFlag: 'RECEIVE_WITH_PIN',
          text: { en: 'Accept and enter my PIN', hi: 'स्वीकार करके PIN डालें' },
          feedback: {
            en: 'Entering your UPI PIN always sends money. You never need a PIN to receive money.',
            hi: 'UPI PIN डालने से हमेशा पैसे जाते हैं। पैसे पाने के लिए कभी PIN की ज़रूरत नहीं होती।',
          },
        },
        {
          id: 'c_look',
          next: 'n_request',
          points: 5,
          text: {
            en: 'Open the UPI app and read the request first',
            hi: 'पहले UPI ऐप खोलकर रिक्वेस्ट पढ़ें',
          },
          feedback: {
            en: 'Good. Reading the screen carefully shows what will really happen.',
            hi: 'अच्छा। स्क्रीन ध्यान से पढ़ने पर पता चलता है कि असल में क्या होगा।',
          },
        },
      ],
    },
    n_request: {
      id: 'n_request',
      from: 'system',
      text: {
        en: 'The UPI app shows: "refund.help.desk@ybl has requested ₹2,000. Pay / Decline".',
        hi: 'UPI ऐप में दिखता है: "refund.help.desk@ybl ने ₹2,000 मांगे हैं। Pay / Decline"।',
      },
      choices: [
        {
          id: 'r_decline',
          next: 'end_safe',
          points: 10,
          redFlag: 'COLLECT_REQUEST',
          text: { en: 'Decline and block the requester', hi: 'Decline करें और भेजने वाले को ब्लॉक करें' },
          feedback: {
            en: 'Right. "Pay" means money leaves your account. Real refunds arrive without any action from you.',
            hi: 'सही। "Pay" का मतलब है पैसे आपके खाते से जाएंगे। असली रिफंड बिना कुछ किए आता है।',
          },
        },
        {
          id: 'r_pay',
          next: 'end_scammed',
          points: 0,
          redFlag: 'RECEIVE_WITH_PIN',
          text: {
            en: 'Tap Pay, since they said it is a refund',
            hi: 'Pay दबाएं, क्योंकि उन्होंने रिफंड कहा है',
          },
          feedback: {
            en: 'The screen says "Pay". Whatever the message claims, the app will send your money.',
            hi: 'स्क्रीन पर "Pay" लिखा है। संदेश कुछ भी कहे, ऐप आपके पैसे भेज देगा।',
          },
        },
      ],
    },
    end_safe: {
      id: 'end_safe',
      from: 'system',
      end: 'safe',
      text: {
        en: 'Well done, your money stayed in your account. A collect request always takes money from you.',
        hi: 'शाबाश, आपके पैसे आपके खाते में ही रहे। कलेक्ट रिक्वेस्ट हमेशा आपसे पैसे लेती है।',
      },
    },
    end_scammed: {
      id: 'end_scammed',
      from: 'system',
      end: 'scammed',
      text: {
        en: '₹2,000 left your account. If this happens for real, call 1930 right away.',
        hi: '₹2,000 आपके खाते से चले गए। अगर सच में ऐसा हो, तो तुरंत 1930 पर कॉल करें।',
      },
    },
  },
};

export const DRILLS: Drill[] = [DRILL_FIXTURE, COLLECT_REFUND_DRILL];
