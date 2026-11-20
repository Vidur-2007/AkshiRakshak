/**
 * Accessibility checks (SPEC_B_WEB.md §6): axe on the main screens, the keyboard
 * path Quick Scan → Analysis → actions, 200% text zoom, Elder tap targets.
 * Desktop Chrome only (layout-independent checks; the mobile layout is covered by
 * the zoom and Elder tests at phone width).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { EN, KYC_TEXT, openAnalysisFromSample } from './helpers';

// Playwright needs a destructuring pattern for the fixtures argument, even when unused.
// eslint-disable-next-line no-empty-pattern
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'desktop Chrome only');
});

async function axe(page: Page) {
  const r = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  return bad.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} — ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(' | ')}`,
  );
}

const PAGES = [
  '/',
  '/scan',
  '/modules/collect',
  '/modules/qr-link',
  '/modules/messages',
  '/modules/transactions',
  '/dashboard',
  '/sos',
  '/settings',
  '/proof',
  '/learn/dojo',
  '/learn/ask',
  '/network',
];

// Both themes (2026-11-20): the app follows the phone, so the browser's colour scheme picks
// day (light) or night (dark).
for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme === 'light' ? 'day' : 'night'} theme`, () => {
    test.use({ colorScheme: scheme });

    for (const path of PAGES) {
      test(`axe: ${path}`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(800); // page-in transition
        expect(await axe(page)).toEqual([]);
      });
    }

    test('axe: analysis screen after the reveal', async ({ page }) => {
      await openAnalysisFromSample(page, EN.fakeKyc);
      await page.waitForTimeout(1600);
      expect(await axe(page)).toEqual([]);
    });
  });
}

test('keyboard: Quick Scan → Analysis → a highlighted phrase → Copy evidence', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/scan');
  const input = page.getByLabel(EN.scanInput);
  // Tab from the top of the page until the input has focus
  for (let i = 0; i < 40 && !(await input.evaluate((el) => el === document.activeElement)); i++)
    await page.keyboard.press('Tab');
  await expect(input).toBeFocused();
  await page.keyboard.type(KYC_TEXT.slice(0, 120));
  await page.keyboard.press('Control+Enter');
  await page.waitForURL(/\/scan\/[^/]+$/);
  // reach a highlighted phrase by keyboard and open its popover with Enter
  const phrase = page.locator('[aria-haspopup="dialog"][role="button"]').first();
  for (let i = 0; i < 60 && !(await phrase.evaluate((el) => el === document.activeElement)); i++)
    await page.keyboard.press('Tab');
  await expect(phrase).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  // and on to the Copy evidence action
  const copy = page.getByRole('button', { name: EN.copyEvidence }).first();
  for (let i = 0; i < 80 && !(await copy.evaluate((el) => el === document.activeElement)); i++)
    await page.keyboard.press('Tab');
  await expect(copy).toBeFocused();
  // the focused element shows a visible focus ring
  const outline = await copy.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Evidence copied')).toBeVisible();
});

test('verdict is announced and the gauge is labelled', async ({ page }) => {
  await openAnalysisFromSample(page, EN.fakeKyc);
  await expect(page.locator('[aria-live="assertive"]')).toHaveText(/^Scam\. Risk \d+ out of 100\./);
  await expect(page.getByRole('img', { name: /^Risk score \d+ out of 100$/ })).toBeVisible();
});

test.describe('phone width', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  for (const path of ['/', '/scan', '/modules/collect', '/sos', '/settings']) {
    test(`200% text: no horizontal scroll on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  test('Elder mode: tap targets are at least 56px', async ({ page }) => {
    await page.goto('/scan?simple=1');
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('main button, main a[href]')]
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({
          h: el.getBoundingClientRect().height,
          label: el.textContent?.trim().slice(0, 30) ?? el.getAttribute('aria-label'),
        }))
        .filter((x) => x.h < 56),
    );
    expect(small).toEqual([]);
  });
});
