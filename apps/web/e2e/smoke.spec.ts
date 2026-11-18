/**
 * The ten smoke tests from SPEC_B_WEB.md §8, for every project
 * (Desktop Chrome, Desktop Edge where installed, Pixel-sized mobile Chrome).
 */
import { expect, test } from '@playwright/test';
import {
  EN,
  isStubEngine,
  KYC_TEXT,
  openAnalysisFromSample,
  switchLanguage,
  verdictWord,
} from './helpers';

test('1. landing: typing a scam phrase moves the live meter above 40', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel(EN.inputLabel).fill(KYC_TEXT);
  const meter = page.getByRole('img', { name: /^Live risk: \d+ out of 100$/ });
  await expect(async () => {
    const label = (await meter.getAttribute('aria-label')) ?? '';
    expect(Number(/(\d+) out of/.exec(label)?.[1] ?? 0)).toBeGreaterThan(40);
  }).toPass();
});

test('2. Quick Scan fake KYC sample: Scam, a highlighted span, the action dock', async ({
  page,
}) => {
  await openAnalysisFromSample(page, EN.fakeKyc);
  await expect(verdictWord(page)).toHaveText(EN.scam);
  await expect(page.locator('[aria-haspopup="dialog"][role="button"]').first()).toBeVisible();
  await expect(page.getByRole('button', { name: EN.copyEvidence }).first()).toBeVisible();
});

test('3. genuine bank OTP sample: No warning signs found', async ({ page }) => {
  await openAnalysisFromSample(page, EN.genuineOtp);
  await expect(verdictWord(page)).toHaveText(EN.noSigns);
  await expect(page.getByText(/\bsafe\b/i)).toHaveCount(0);
});

test('4. collect request "they said I will receive money": Scam and the PIN explainer', async ({
  page,
}) => {
  await page.goto('/modules/collect');
  await page.getByLabel('Requester UPI ID').fill('refund.desk@ybl');
  await page.getByLabel('Amount (₹)').fill('4999');
  await page
    .getByRole('radiogroup', { name: EN.qReceive })
    .getByRole('radio', { name: 'Yes' })
    .click();
  await page.getByRole('button', { name: EN.collectCheck }).click();
  await expect(page.getByText(EN.pinTitle)).toBeVisible();
  // The Phase 0 stub cannot produce RECEIVE_WITH_PIN and scores this Suspicious;
  // the real engine floors it at 85 (Scam), which is what §8 expects.
  const expected = (await isStubEngine(page))
    ? new RegExp(`^(${EN.scam}|${EN.suspicious})$`)
    : new RegExp(`^${EN.scam}$`);
  await expect(page.locator('[data-engine-version] header p').first()).toHaveText(expected);
});

test('5. QR sample payload: the x-ray shows the UPI ID', async ({ page }) => {
  await page.goto('/modules/qr-link');
  await page.getByRole('button', { name: EN.refundQr }).click();
  await expect(page.getByText('What this QR really does')).toBeVisible();
  await expect(page.locator('dd').filter({ hasText: 'refund.desk@ybl' }).first()).toBeVisible();
});

test('6. switching to Hindi changes the verdict to Devanagari', async ({ page }) => {
  await openAnalysisFromSample(page, EN.fakeKyc);
  await expect(verdictWord(page)).toHaveText(EN.scam);
  await switchLanguage(page, 'हिन्दी');
  await expect(verdictWord(page)).toHaveText(/[ऀ-ॿ]/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
});

test('7. Elder mode via ?simple=1: full-screen verdict', async ({ page }) => {
  await page.goto('/scan?simple=1');
  await page.getByLabel(EN.scanInput).fill(KYC_TEXT);
  await page.getByRole('button', { name: EN.elderCheck, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: EN.stop })).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/\belder\b/);
});

test('8. offline: after one visit, a scan still gives a verdict', async ({
  page,
  context,
  baseURL,
}) => {
  test.skip(
    !!process.env.BASE_URL && !baseURL?.startsWith('https'),
    'service workers need https or localhost',
  );
  await page.goto('/');
  // wait for the service worker to install and control the page (precache done)
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
    }
    return reg.active?.state;
  });
  await context.setOffline(true);
  await page.goto('/scan');
  await page.getByRole('button', { name: EN.fakeKyc }).click();
  await page.waitForURL(/\/scan\/[^/]+$/);
  await expect(verdictWord(page)).toHaveText(EN.scam);
  await context.setOffline(false);
});

test('9. transactions sample statement: at least one anomaly card', async ({ page }) => {
  await page.goto('/modules/transactions');
  await page.getByRole('button', { name: /Salaried professional/ }).click();
  await expect(page.getByRole('columnheader', { name: EN.featureCol })).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Unusual payments' }).getByRole('button').first(),
  ).toBeVisible();
});

test('10. emergency: Yes to "sent money" gives a tel:1930 action', async ({ page }) => {
  await page.goto('/sos');
  const card = () => page.locator('[data-question]');
  await expect(card()).toHaveAttribute('data-question', 'sent_money');
  await card().getByRole('button', { name: 'Yes' }).click();
  for (const id of [
    'entered_pin',
    'shared_otp',
    'installed_app',
    'gave_remote_access',
    'shared_card',
  ]) {
    await expect(page.locator(`[data-question="${id}"]`)).toHaveCount(1);
    await page.locator(`[data-question="${id}"]`).getByRole('button', { name: 'No' }).click();
  }
  await expect(page.getByRole('heading', { name: EN.checklist })).toBeVisible();
  await expect(page.locator('ol a[href="tel:1930"]').first()).toBeVisible();
});
