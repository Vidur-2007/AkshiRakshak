/**
 * Performance behaviour (SPEC_B_WEB.md §7): ShieldCore animates while visible and
 * pauses when scrolled offscreen. Desktop Chrome only.
 */
import { expect, test, type Page } from '@playwright/test';

// Playwright needs a destructuring pattern for the fixtures argument, even when unused.
// eslint-disable-next-line no-empty-pattern
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'desktop Chrome only');
});

async function canvasHash(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('canvas');
    if (!c) return null;
    const url = c.toDataURL();
    let h = 0;
    for (let i = 0; i < url.length; i += 7) h = (h * 31 + url.charCodeAt(i)) | 0;
    return String(h);
  });
}

test('ShieldCore animates in view and pauses offscreen', async ({ page }) => {
  // a high-tier device profile so the canvas core (not the poster) is used
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 12 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 16 });
  });
  await page.goto('/');
  await expect(page.locator('canvas')).toHaveCount(1, { timeout: 10_000 });
  await page.waitForTimeout(600);
  const a = await canvasHash(page);
  await page.waitForTimeout(300);
  const b = await canvasHash(page);
  expect(a).not.toBe(b); // rotating while visible

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(700);
  const c = await canvasHash(page);
  await page.waitForTimeout(400);
  const d = await canvasHash(page);
  expect(c).toBe(d); // paused offscreen
});
