/**
 * QR analysis (SPEC_A_ENGINE.md §6.4).
 *  - `upi://pay` with a valid payee: `am` → PREFILLED_AMOUNT; receive/refund/cashback/prize wording
 *    in `pn` or `tn` (any language) → QR_TO_RECEIVE (floor 85); a brand or institution in `pn`
 *    with a personal handle → UPI_NAME_MISMATCH (done by claims/brands.ts via payeeName).
 *  - `upi://collect` or another action: unusual → COLLECT_REQUEST for collect.
 *  - a plain URL: "This QR opens a website, not a payment", then the URL inspector.
 *  - any other text: analysed as a message.
 * The explanation always shows the payee UPI ID and name as the UPI app will show them.
 */
import {
  normalizeText,
  type ClaimCheck,
  type Lang,
  type Signal,
  type Span,
  type UpiPayload,
} from '@akshi/contracts';
import { amountText } from '../claims/brands';
import { signalText, template } from '../i18n';
import { CATALOG } from '../rules/catalog';
import { parseUpiUri } from './uri';

export const RECEIVE_WORDS =
  /\b(?:receive|receiving|refund|cash ?back|prize|reward|winner|lottery|get money|get paid|claim|credit(?:ed)? to you|bonus)\b|पाएं|पाने|प्राप्त|रिफंड|कैशबैक|इनाम|मिलेगा|मिलेंगे|पొంద|పొందండి|రీఫండ్|క్యాష్ బ్యాక్|బహుమతి|వస్తుంది|পাবেন|পেতে|রিফান্ড|ক্যাশব্যাক|পুরস্কার/iu;

export type QrKind = 'upi' | 'website' | 'text';

export interface QrAnalysis {
  qrKind: QrKind;
  payload?: UpiPayload;
  signals: Signal[];
  claims: ClaimCheck[];
  /** sentence that leads the explanation (payee, or "opens a website") */
  lead?: string;
  payeeName?: string;
  payeeUpi?: string;
}

export function classifyQr(raw: string): QrKind {
  const t = raw.trim();
  if (/^upi:\/\//i.test(t)) return 'upi';
  if (/^(?:https?:\/\/|www\.)\S+$/i.test(t)) return 'website';
  return 'text';
}

function valueSpan(text: string, key: string, value: string): Span | undefined {
  const needle = `${key}=${normalizeText(value)}`;
  const i = text.toLowerCase().indexOf(needle.toLowerCase());
  if (i < 0) return undefined;
  const start = i + key.length + 1;
  return { start, end: i + needle.length, text: text.slice(start, i + needle.length) };
}

/** `text` is the normalised, percent-decoded payload that the rest of the pipeline analyses. */
export function analyzeQr(raw: string, text: string, lang: Lang): QrAnalysis {
  const qrKind = classifyQr(raw);
  const signals: Signal[] = [];
  const claims: ClaimCheck[] = [];
  const sig = (id: Signal['id'], spans: Span[]): Signal => ({
    id,
    weight: CATALOG[id].weight,
    source: 'upi',
    ...signalText(id, lang),
    spans,
  });

  if (qrKind === 'website') {
    const host = (() => {
      try {
        return new URL(/^https?:/i.test(raw.trim()) ? raw.trim() : `http://${raw.trim()}`).hostname;
      } catch {
        return raw.trim();
      }
    })();
    claims.push({
      claim: template('claimQrPayment', lang),
      reality: template('realityQrWebsite', lang, { domain: host }),
      mismatch: true,
    });
    return { qrKind, signals, claims, lead: template('qrWebsite', lang) };
  }
  if (qrKind === 'text') return { qrKind, signals, claims };

  const payload = parseUpiUri(raw);
  const action = /^upi:\/\/([a-z]+)/i.exec(raw.trim())?.[1]?.toLowerCase();
  if (action === 'collect') signals.push(sig('COLLECT_REQUEST', []));
  const out: QrAnalysis = { qrKind, payload, signals, claims };
  if (!payload.pa) return out;

  out.payeeUpi = payload.pa;
  if (payload.pn) out.payeeName = payload.pn;
  out.lead = payload.pn
    ? template('qrPayee', lang, { pa: payload.pa, pn: payload.pn })
    : template('qrPayeeNoName', lang, { pa: payload.pa });

  if (payload.am !== undefined) {
    const s = valueSpan(text, 'am', String(raw.match(/[?&]am=([^&]*)/i)?.[1] ?? payload.am));
    signals.push(sig('PREFILLED_AMOUNT', s ? [s] : []));
  }
  const receiveSpans: Span[] = [];
  for (const key of ['tn', 'pn'] as const) {
    const v = payload[key];
    if (v && RECEIVE_WORDS.test(v)) {
      const s = valueSpan(text, key, v);
      if (s) receiveSpans.push(s);
    }
  }
  if (receiveSpans.length) {
    signals.push({ ...sig('QR_TO_RECEIVE', receiveSpans), source: 'upi' });
    const note = payload.tn && RECEIVE_WORDS.test(payload.tn) ? payload.tn : (payload.pn ?? '');
    claims.push({
      claim: template('claimQrNote', lang, { note }),
      reality:
        payload.am !== undefined
          ? template('realityQrPays', lang, { amount: amountText(payload.am) })
          : template('realityQrPaysMoney', lang),
      mismatch: true,
      signal: 'QR_TO_RECEIVE',
    });
  }
  return out;
}
