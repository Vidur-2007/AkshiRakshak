/**
 * Judge tour (SPEC_B_WEB.md §5.17) and recording mode (?demo=1).
 */
import { expect, test } from '@playwright/test';
import { EN, KYC_TEXT, verdictWord } from './helpers';

test('judge tour: six steps on the real screens, then Elder mode is restored', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Take the 60-second tour' }).click();
  const caption = page.getByTestId('tour-caption');
  const next = (name = 'Next') => caption.getByRole('button', { name, exact: true }).click();

  await expect(caption.getByText('Step 1 of 6')).toBeVisible();
  await expect(page.getByLabel(EN.scanInput)).toHaveValue(KYC_TEXT);
  await expect(page.getByTestId('tour-ring')).toBeVisible();

  await next();
  await page.waitForURL(/\/scan\/[^/]+$/);
  await expect(verdictWord(page)).toHaveText(EN.scam);
  await expect(caption.getByText('Step 2 of 6')).toBeVisible();

  await next();
  await expect(page.getByText(EN.pinTitle)).toBeVisible();
  await expect(page.getByLabel('Requester UPI ID')).toHaveValue('sbi.refund.desk@ybl');

  await next();
  await expect(page.getByText('What this QR really does')).toBeVisible();

  await next();
  await page.waitForURL(/\/proof$/);
  await expect(caption.getByText('Step 5 of 6')).toBeVisible();

  await next();
  await expect(page.getByRole('heading', { level: 1, name: EN.stop })).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/\belder\b/);

  await next('Finish');
  await expect(caption).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveClass(/\belder\b/);
});

test('judge tour: Escape ends it', async ({ page }) => {
  await page.goto('/tour');
  await page.getByRole('button', { name: 'Start the tour' }).click();
  await expect(page.getByTestId('tour-caption')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('tour-caption')).toHaveCount(0);
});

test('?demo=1 clears history and puts the script samples first', async ({ page }) => {
  // one saved check first
  await page.goto('/scan');
  await page.getByRole('button', { name: EN.fakeKyc }).click();
  await page.waitForURL(/\/scan\/[^/]+$/);
  await page.goto('/settings');
  await expect(page.locator('dt', { hasText: 'Saved checks' }).locator('+ dd')).not.toHaveText('0');

  await page.goto('/scan?demo=1');
  const chips = page.getByRole('region', { name: 'Try a sample' }).getByRole('button');
  await expect(chips.nth(0)).toHaveText(EN.fakeKyc);
  await expect(chips.nth(1)).toHaveText('Electricity cut-off (Hindi)');
  await expect(chips.nth(2)).toHaveText('Part-time job (Telugu)');

  await page.goto('/settings');
  await expect(page.locator('dt', { hasText: 'Saved checks' }).locator('+ dd')).toHaveText('0');
});
