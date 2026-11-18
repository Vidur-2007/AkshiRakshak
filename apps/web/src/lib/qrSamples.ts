/** Bundled QR & link samples, obviously synthetic (SPEC.md §1.3). */
export const QR_LINK_SAMPLES = [
  { key: 'link', value: 'http://sbi-kyc-update.xyz/verify?id=88213' },
  {
    key: 'qr',
    value:
      'upi://pay?pa=refund.desk@ybl&pn=SBI%20Refund%20Desk&am=4999&tn=Refund%20processing&cu=INR',
  },
  { key: 'official', value: 'https://www.onlinesbi.sbi' },
] as const;

/** The "refund" QR used by the judge tour and the demo. */
export const QR_SAMPLE = QR_LINK_SAMPLES[1].value;
