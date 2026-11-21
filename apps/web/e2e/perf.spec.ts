/**
 * Performance behaviour (SPEC_B_WEB.md §7, landing redesigned 2026-11-20): the scam-pattern deck
 * only flicks by itself while it is on screen, so an idle landing page does no work off screen.
 * Desktop Chrome only.
 */
import { expect, test } from '@playwright/test';

// Playwright needs a destructuring pattern for the fixtures argument, even when unused.
// eslint-disable-next-line no-empty-pattern
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'desktop Chrome only');
});

test('the scam deck flicks while in view and stays still off screen', async ({ page }) => {
  await page.goto('/');
  const count = page.locator('#home-deck .dfoot [aria-live]');
  // off screen (the hero is showing): no automatic flicks
  await expect(count).toHaveText(/^1 of \d+/);
  await page.waitForTimeout(3600);
  await expect(count).toHaveText(/^1 of \d+/);

  // in view: the cards fly up from below (1.7 s), then it moves on by itself every 3.2 s
  await page.evaluate(() => document.getElementById('home-deck')?.scrollIntoView());
  await expect(page.locator('#home-deck .scard.front')).toBeAttached({ timeout: 4000 });
  await expect(count).toHaveText(/^2 of \d+/, { timeout: 6000 });

  // back off screen: it stops again
  await page.evaluate(() => document.getElementById('home-check')?.scrollIntoView());
  const before = await count.textContent();
  await page.waitForTimeout(3600);
  await expect(count).toHaveText(before ?? '');
});
