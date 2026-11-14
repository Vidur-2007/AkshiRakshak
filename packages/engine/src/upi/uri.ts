/**
 * parseUpiUri (SPEC_A_ENGINE.md §6.4). QR payload rules (QR_TO_RECEIVE, PREFILLED_AMOUNT,
 * UPI_NAME_MISMATCH) come in P2.
 */
import type { UpiPayload } from '@akshi/contracts';
import { UPI_ID_FULL } from '../extract/entities';

const KNOWN_PARAMS = new Set([
  'pa',
  'pn',
  'am',
  'cu',
  'tn',
  'mc',
  'tr',
  'url',
  'mode',
  'tid',
  'mam',
  'orgid',
  'sign',
  'purpose',
]);

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function parseUpiUri(raw: string): UpiPayload {
  const issues: string[] = [];
  const out: UpiPayload = { raw, valid: false, issues };
  const m = /^upi:\/\/([a-z]+)\/?\?(.*)$/is.exec(raw.trim());
  if (!m) {
    issues.push('Not a upi:// payment link');
    return out;
  }
  const action = (m[1] ?? '').toLowerCase();
  if (action !== 'pay') issues.push(`Unusual UPI action "${action}"`);
  for (const part of (m[2] ?? '').split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const key = (eq < 0 ? part : part.slice(0, eq)).toLowerCase();
    const value = safeDecode(eq < 0 ? '' : part.slice(eq + 1));
    if (!KNOWN_PARAMS.has(key)) {
      issues.push(`Unknown parameter "${key}"`);
      continue;
    }
    if (key === 'am') {
      const n = Number(value);
      if (value !== '' && Number.isFinite(n) && n >= 0) out.am = n;
      else issues.push('Malformed amount');
    } else if (
      key === 'pa' ||
      key === 'pn' ||
      key === 'cu' ||
      key === 'tn' ||
      key === 'mc' ||
      key === 'tr' ||
      key === 'url' ||
      key === 'mode'
    ) {
      out[key] = value;
    }
  }
  if (!out.pa) issues.push('Missing payee UPI ID (pa)');
  else if (!UPI_ID_FULL.test(out.pa)) issues.push('Payee UPI ID is not valid');
  out.valid = action === 'pay' && out.pa !== undefined && UPI_ID_FULL.test(out.pa);
  return out;
}
