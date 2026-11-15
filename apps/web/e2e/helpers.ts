import { expect, type Page } from '@playwright/test';

/** English UI strings the tests look for (kept in one place). */
export const EN = {
  inputLabel: 'Paste any message to see the risk',
  scanInput: 'Message, UPI ID or link to check',
  scam: 'Scam',
  suspicious: 'Suspicious',
  noSigns: 'No warning signs found',
  copyEvidence: 'Copy evidence',
  fakeKyc: 'Fake KYC SMS',
  genuineOtp: 'Genuine bank OTP',
  refundQr: 'Refund QR',
  collectCheck: 'Check this request',
  qReceive: 'Did they say you will receive money?',
  pinTitle: 'What the PIN really does',
  elderCheck: 'Check',
  stop: 'STOP',
  more: 'More',
  checklist: 'Do these now, in order',
  featureCol: 'What',
} as const;

export const KYC_TEXT =
  'Dear Customer, your SBI account will be BLOCKED today due to pending KYC. Update KYC immediately at http://sbi-kyc-update.xyz/verify or call our helpline 98765 00001. -SBI Team';

/** The engine on the page is the Phase 0 stub (before Merge 1). */
export async function isStubEngine(page: Page): Promise<boolean> {
  const v = await page.locator('[data-engine-version]').first().getAttribute('data-engine-version');
  return (v ?? '').includes('stub');
}

/** The analysis verdict word (the one inside the verdict header, not the announcer). */
export function verdictWord(page: Page) {
  return page.locator('[data-engine-version] header p').first();
}

export async function openAnalysisFromSample(page: Page, sample: string) {
  await page.goto('/scan');
  await page.getByRole('button', { name: sample }).click();
  await page.waitForURL(/\/scan\/[^/]+$/);
  await expect(page.locator('[data-engine-version]')).toBeVisible();
}

/** Switch the UI language from the top bar (desktop) or the More sheet (mobile). */
export async function switchLanguage(page: Page, nativeName: string) {
  const topBar = page.getByRole('banner').getByRole('radio', { name: nativeName });
  if (await topBar.isVisible()) {
    await topBar.click();
    return;
  }
  await page.getByRole('button', { name: EN.more }).click();
  await page.getByRole('dialog').getByRole('radio', { name: nativeName }).click();
  await page.keyboard.press('Escape');
}
