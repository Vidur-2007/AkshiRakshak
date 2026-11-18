/**
 * Reads From / Reply-To / Subject from a pasted email for the header card (§5.5)
 * and flags a Reply-To on a different domain from the sender.
 */
import { guessRegistrable } from './urlParts';

export interface EmailAddress {
  name: string | null;
  address: string;
  domain: string;
}

export interface EmailHeaders {
  from: EmailAddress | null;
  replyTo: EmailAddress | null;
  subject: string | null;
  /** Reply-To goes to a different registrable domain than From */
  replyToMismatch: boolean;
}

const ADDRESS = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;

export function parseAddress(value: string): EmailAddress | null {
  const address = ADDRESS.exec(value)?.[0]?.toLowerCase();
  if (!address) return null;
  const name = value
    .replace(/<[^>]*>/g, '')
    .replace(address, '')
    .replace(/["']/g, '')
    .trim();
  const host = address.split('@')[1] ?? '';
  return { name: name || null, address, domain: guessRegistrable(host) };
}

function header(text: string, name: string): string | null {
  const m = new RegExp(`^${name}:[ \\t]*(.+)$`, 'im').exec(text);
  return m?.[1]?.trim() ?? null;
}

export function parseEmailHeaders(text: string): EmailHeaders {
  const head = text.split(/\r?\n\s*\r?\n/)[0] ?? text;
  const fromRaw = header(head, 'From');
  const replyRaw = header(head, 'Reply-To');
  const from = fromRaw ? parseAddress(fromRaw) : null;
  const replyTo = replyRaw ? parseAddress(replyRaw) : null;
  return {
    from,
    replyTo,
    subject: header(head, 'Subject'),
    replyToMismatch: !!from && !!replyTo && from.domain !== replyTo.domain,
  };
}

export function looksLikeEmail(text: string): boolean {
  return (
    /^from:/im.test(text) &&
    (/^subject:/im.test(text) || /^to:/im.test(text) || /^reply-to:/im.test(text))
  );
}
