/**
 * Collect-screen recognition for screenshots (SPEC_A_ENGINE.md §10).
 * OCR text that looks like a UPI app's collect-request screen ("… has requested ₹2,000",
 * "Pay" / "Decline", or the Hindi, Telugu and Bengali equivalents) together with an amount is
 * treated as a collect request with "they said you will receive" unknown:
 *  - COLLECT_REQUEST (+0.15, the requester contacted the user);
 *  - RECEIVE_WITH_PIN when the note on the screen talks about a refund, prize or receiving money.
 */
import type { ClaimCheck, Entities, Lang, Signal, Span } from '@akshi/contracts';
import { amountText } from '../claims/brands';
import { signalText, template } from '../i18n';
import { CATALOG } from '../rules/catalog';
import { RECEIVE_WORDS } from './qr';

/** "X has requested", "collect request", "payment request" and translations. */
const REQUESTED =
  /\b(?:has requested|have requested|requested you|requested money|is requesting|collect request|payment request|money request|request from)\b|अनुरोध किया|भुगतान का अनुरोध|पैसे मांगे|मांग रहा|कलेक्ट रिक्वेस्ट|पेमेंट रिक्वेस्ट|అభ్యర్థించారు|అభ్యర్థన|కలెక్ట్ రిక్వెస్ట్|పేమెంట్ రిక్వెస్ట్|অনুরোধ করেছেন|অনুরোধ|কালেক্ট রিকোয়েস্ট|পেমেন্ট রিকোয়েস্ট/iu;
const PAY_BUTTON =
  /\b(?:pay|approve|accept)\b|भुगतान करें|चुकाएं|స్వీకరించు|చెల్లించండి|చెల్లించు|পেমেন্ট করুন|অনুমোদন/iu;
const DECLINE_BUTTON =
  /\b(?:decline|reject|deny)\b|अस्वीकार|मना करें|తిరస్కరించు|తిరస్కరించండి|প্রত্যাখ্যান|বাতিল/iu;

export interface CollectScreen {
  signals: Signal[];
  claims: ClaimCheck[];
  lead?: string;
  payeeUpi?: string;
}

function firstSpan(text: string, re: RegExp): Span | undefined {
  const m = re.exec(text);
  return m ? { start: m.index, end: m.index + m[0].length, text: m[0] } : undefined;
}

export function detectCollectScreen(
  text: string,
  entities: Entities,
  lang: Lang,
): CollectScreen | null {
  if (!entities.amounts.length) return null;
  const requested = firstSpan(text, REQUESTED);
  const buttons = PAY_BUTTON.test(text) && DECLINE_BUTTON.test(text);
  if (!requested && !buttons) return null;

  const sig = (id: Signal['id'], spans: Span[], weight = CATALOG[id].weight): Signal => ({
    id,
    weight,
    source: 'upi',
    ...signalText(id, lang),
    spans,
  });
  const signals: Signal[] = [
    sig('COLLECT_REQUEST', requested ? [requested] : [], CATALOG.COLLECT_REQUEST.weight + 0.15),
  ];
  const claims: ClaimCheck[] = [];
  const out: CollectScreen = { signals, claims };
  const payee = entities.upiIds[0];
  if (payee) out.payeeUpi = payee.raw;

  const receive = firstSpan(text, RECEIVE_WORDS);
  if (receive) {
    signals.push(sig('RECEIVE_WITH_PIN', [receive]));
    out.lead = template('pinTruth', lang);
    const amount = entities.amounts[0] ? amountText(entities.amounts[0].value) : undefined;
    claims.push({
      claim: amount
        ? template('claimReceive', lang, { amount })
        : template('claimReceiveMoney', lang),
      reality:
        amount && payee
          ? template('realityPinSends', lang, { amount, upi: payee.raw })
          : template('realityPinSendsMoney', lang),
      mismatch: true,
      signal: 'RECEIVE_WITH_PIN',
    });
  }
  return out;
}
