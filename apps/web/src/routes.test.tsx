import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeAll, describe, expect, it } from 'vitest';
import en from '@/locales/en.json';
import { initI18n } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { ROUTE_PATHS, routes } from './routes';

const TITLE: Record<string, string> = {
  '/scan': en.page.scan.title,
  '/scan/abc123': en.analysis.notFoundTitle,
  '/modules/collect': en.page.collect.title,
  '/modules/messages': en.page.messages.title,
  '/modules/transactions': en.page.transactions.title,
  '/modules/qr-link': en.page.qrLink.title,
  '/dashboard': en.page.dashboard.title,
  '/network': en.page.network.title,
  '/sos': en.page.sos.title,
  '/sos/report': en.page.sosReport.title,
  '/learn/dojo': en.page.dojo.title,
  '/learn/dojo/drill-1': en.page.dojoPlayer.title,
  '/learn/ask': en.page.ask.title,
  '/proof': en.page.proof.title,
  '/settings': en.page.settings.title,
  '/share-target': en.page.shareTarget.title,
  '/tour': en.page.tour.title,
  '/': en.home.h1a,
  '/no-such-page': en.page.notFound.title,
};

function concrete(path: string): string {
  return path.replace(':id', path.startsWith('/scan') ? 'abc123' : 'drill-1');
}

describe('routes', () => {
  beforeAll(() => {
    useAppStore.setState({ lang: 'en', elderMode: false });
    initI18n();
  });

  it('covers every route in SPEC_B_WEB.md §4.1', () => {
    for (const p of ROUTE_PATHS) expect(TITLE[concrete(p)], p).toBeDefined();
  });

  it.each(Object.entries(TITLE))('%s renders inside the shell', async (path, title) => {
    const router = createMemoryRouter(routes, { initialEntries: [path] });
    render(<RouterProvider router={router} />);
    const h1 = await screen.findByRole('heading', { level: 1 }, { timeout: 4000 });
    expect(h1.textContent).toContain(title);
    if (path.startsWith('/sos')) {
      // emergency help is a full-screen takeover: no navigation chrome (§5.9)
      expect(screen.queryAllByRole('navigation')).toHaveLength(0);
      if (path === '/sos') {
        const call = screen.getByRole('link', { name: new RegExp(en.sos.call1930) });
        expect(call.getAttribute('href')).toBe('tel:1930');
      }
      return;
    }
    // shell is present: SOS links and the main nav
    expect(screen.getAllByRole('link', { name: en.shell.sosPill }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0);
  });
});
