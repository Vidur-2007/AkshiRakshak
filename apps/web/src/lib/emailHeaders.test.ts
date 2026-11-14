import { describe, expect, it } from 'vitest';
import { looksLikeEmail, parseAddress, parseEmailHeaders } from './emailHeaders';

const EMAIL = `From: "SBI Alerts" <alerts@sbi-secure-mail.xyz>
Reply-To: refund.desk@gmail.com
Subject: Your account will be blocked

Dear customer, update KYC now.
From: this line is in the body`;

describe('email headers', () => {
  it('reads From, Reply-To and Subject from the header block only', () => {
    const h = parseEmailHeaders(EMAIL);
    expect(h.from).toEqual({
      name: 'SBI Alerts',
      address: 'alerts@sbi-secure-mail.xyz',
      domain: 'sbi-secure-mail.xyz',
    });
    expect(h.replyTo?.address).toBe('refund.desk@gmail.com');
    expect(h.subject).toBe('Your account will be blocked');
    expect(h.replyToMismatch).toBe(true);
  });

  it('does not flag a Reply-To on the same domain', () => {
    // bank.in is a registry zone, so the bank's own domain is hdfc.bank.in
    const h = parseEmailHeaders(
      'From: a@alerts.hdfc.bank.in\nReply-To: b@help.hdfc.bank.in\nSubject: hi\n\nbody',
    );
    expect(h.replyToMismatch).toBe(false);
  });

  it('copes with missing headers', () => {
    expect(parseEmailHeaders('hello there')).toEqual({
      from: null,
      replyTo: null,
      subject: null,
      replyToMismatch: false,
    });
    expect(parseAddress('no address')).toBeNull();
  });

  it('recognises pasted emails', () => {
    expect(looksLikeEmail(EMAIL)).toBe(true);
    expect(looksLikeEmail('From the desk of')).toBe(false);
  });
});
