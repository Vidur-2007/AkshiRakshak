import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeAll, describe, expect, it } from 'vitest';
import en from '@/locales/en.json';
import { initI18n } from '@/lib/i18n';
import { DEFAULT_PREFS, useAppStore } from '@/lib/store';
import { routes } from '@/routes';

const KYC =
  'Dear Customer, your SBI account will be BLOCKED today due to pending KYC. Update KYC immediately at http://sbi-kyc-update.xyz/verify or call 98765 00001.';

describe('Quick Scan → Analysis', () => {
  beforeAll(() => {
    useAppStore.setState({ ...DEFAULT_PREFS, lang: 'en' });
    initI18n();
  });

  it('scans, opens /scan/:id and shows verdict, highlights, actions and the announcement', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/scan'] });
    render(<RouterProvider router={router} />);
    const input = await screen.findByLabelText(en.scan.inputLabel, {}, { timeout: 4000 });
    fireEvent.change(input, { target: { value: KYC } });
    fireEvent.click(screen.getByRole('button', { name: en.scan.scan }));

    // stays on /scan for at least the 400 ms ticker floor, then navigates (the first scan loads the
    // engine, which can take over the default 1 s on a busy machine)
    expect(await screen.findByLabelText(en.scan.stagesLabel, {}, { timeout: 4000 })).toBeTruthy();
    await screen.findByText(en.analysis.messageTitle, {}, { timeout: 4000 });
    expect(router.state.location.pathname).toMatch(/^\/scan\/.+/);

    expect(screen.getAllByText(en.verdict.scam).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /BLOCKED/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: en.analysis.copyEvidence })).toBeTruthy();
    expect(screen.getByRole('link', { name: en.analysis.sos })).toBeTruthy();
    const alert = await screen.findByRole('alert');
    await screen.findByText(/Risk \d+ out of 100/);
    expect(alert.textContent).toMatch(/^Scam\. Risk \d+ out of 100\./);
    // a whole flow, including the first engine load: past vitest's 5 s default on a slow laptop
  }, 15_000);

  it('marks the genuine OTP sample as no warning signs, never "safe"', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/scan'] });
    render(<RouterProvider router={router} />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Genuine bank OTP' }, { timeout: 4000 }),
    );
    await screen.findByText(en.analysis.messageTitle, {}, { timeout: 4000 });
    expect(screen.getAllByText(en.verdict.no_signs).length).toBeGreaterThan(0);
    expect(screen.queryByText(/\bsafe\b/i)).toBeNull();
    // reassuring signal is listed, in the green "Reassuring" form
    expect(screen.getAllByText(new RegExp(`${en.analysis.reassuring}:`)).length).toBeGreaterThan(0);
  });
});
