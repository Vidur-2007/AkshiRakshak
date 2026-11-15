import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import en from '@/locales/en.json';
import { initI18n } from '@/lib/i18n';
import { DEFAULT_PREFS, useAppStore } from '@/lib/store';
import { routes } from '@/routes';

describe('offline shell', () => {
  it('renders /scan with the offline pill', async () => {
    useAppStore.setState({ ...DEFAULT_PREFS, lang: 'en', online: false });
    void initI18n();
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    const router = createMemoryRouter(routes, { initialEntries: ['/scan'] });
    render(<RouterProvider router={router} />);
    expect(await screen.findByText(en.shell.offline, {}, { timeout: 4000 })).toBeTruthy();
    expect(await screen.findByText(en.scan.aiOffline, {}, { timeout: 4000 })).toBeTruthy();
  });
});
