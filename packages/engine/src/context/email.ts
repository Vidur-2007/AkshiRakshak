/**
 * Email header parsing (SPEC_A_ENGINE.md §9). P1: parse From / Reply-To / Subject / Return-Path
 * and attachment names. P4: BRAND_MISMATCH, REPLY_TO_MISMATCH and RISKY_ATTACHMENT signals.
 */
export interface EmailHeaders {
  from?: string;
  replyTo?: string;
  subject?: string;
  returnPath?: string;
  attachments: string[];
}

const HEADER = /^(from|reply-to|subject|return-path)\s*:\s*(.*)$/i;
const ATTACHMENT = /\b[\w.-]+\.(?:apk|exe|scr|html?|zip|pdf|docx?|xlsx?)\b/gi;

export function parseEmailHeaders(raw: string): EmailHeaders {
  const out: EmailHeaders = { attachments: [] };
  for (const line of raw.split(/\r?\n/)) {
    const m = HEADER.exec(line.trim());
    if (!m) continue;
    const key = (m[1] ?? '').toLowerCase();
    const value = (m[2] ?? '').trim();
    if (key === 'from') out.from ??= value;
    else if (key === 'reply-to') out.replyTo ??= value;
    else if (key === 'subject') out.subject ??= value;
    else out.returnPath ??= value;
  }
  out.attachments = [...new Set(raw.match(ATTACHMENT) ?? [])];
  return out;
}

/** Domain of an address like "Name <a@b.com>" or "a@b.com". */
export function addressDomain(addr: string | undefined): string | undefined {
  return addr?.match(/@([a-z0-9.-]+\.[a-z]{2,})/i)?.[1]?.toLowerCase();
}
