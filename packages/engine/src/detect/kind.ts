/**
 * detectInputKind (SPEC_A_ENGINE.md §4.2). Order: qr → upi_id → url → phone → chat → email → message.
 * 'image' and 'collect_request' come from the UI (upload / guided form), never from text.
 */
import type { InputKind } from '@akshi/contracts';
import { parse } from 'tldts';
import { UPI_ID_FULL } from '../extract/entities';

/** WhatsApp exports: iOS "[dd/mm/yy, hh:mm(:ss)] Name:" and Android "dd/mm/yyyy, hh:mm - Name:" */
export const WA_IOS_LINE =
  /^\[\d{1,2}\/\d{1,2}\/\d{2,4},? \d{1,2}:\d{2}(?::\d{2})?(?:\s?[ap]\.?m\.?)?\] ([^:]{1,60}):/i;
export const WA_ANDROID_LINE =
  /^\d{1,2}\/\d{1,2}\/\d{2,4},? \d{1,2}:\d{2}(?:\s?[ap]\.?m\.?)? - ([^:]{1,60}):/i;
export const NAME_LINE = /^([\p{L}][\p{L}\p{M} .'-]{0,30}):\s/u;

const URL_SCHEME = /^(?:https?:\/\/|www\.)\S+$/i;
const BARE_DOMAIN = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/?#]\S*)?$/i;
const PHONE_ONLY = /^(?:(?:\+?91|0)?[6-9]\d{9}|18[06]0\d{7})$/;

function isBareDomain(t: string): boolean {
  if (!BARE_DOMAIN.test(t)) return false;
  const host = t.split(/[/?#]/)[0] ?? '';
  const p = parse(host);
  return p.isIcann === true && p.domain !== null && !/^\d+$/.test(p.publicSuffix ?? '');
}

export function detectInputKind(raw: string): { kind: InputKind; confidence: number } {
  const t = raw.trim();
  if (!t) return { kind: 'message', confidence: 0.5 };
  if (/^upi:\/\//i.test(t)) return { kind: 'qr', confidence: 0.99 };

  const single = !/\s/.test(t);
  if (single && UPI_ID_FULL.test(t)) return { kind: 'upi_id', confidence: 0.95 };
  if (single && URL_SCHEME.test(t)) return { kind: 'url', confidence: 0.95 };
  if (single && isBareDomain(t)) return { kind: 'url', confidence: 0.85 };

  const digits = t.replace(/[\s()-]/g, '');
  if (PHONE_ONLY.test(digits)) return { kind: 'phone', confidence: 0.9 };

  const lines = t.split(/\r?\n/).map((l) => l.trim());
  const waLines = lines.filter((l) => WA_IOS_LINE.test(l) || WA_ANDROID_LINE.test(l)).length;
  if (waLines >= 2) return { kind: 'chat', confidence: 0.95 };

  const hasFrom = lines.some((l) => /^from:\s*\S/i.test(l));
  const hasSubject = lines.some((l) => /^subject:/i.test(l));
  if (hasFrom && hasSubject) return { kind: 'email', confidence: 0.9 };

  const nameLines = lines.filter(
    (l) => NAME_LINE.test(l) && !/^(?:from|to|subject|reply-to|cc|date|note|https?)\s*:/i.test(l),
  ).length;
  if (nameLines >= 3) return { kind: 'chat', confidence: 0.7 };

  return { kind: 'message', confidence: lines.length > 1 ? 0.7 : 0.8 };
}
