/**
 * The Network page (Scam network V2): legend, numbers, the list, cards, Block, ?campaign= and find.
 * IndexedDB is not available here, so the blocklist is kept in memory.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/locales/en.json';
import type * as Db from '@/lib/db';
import type { BlockEntry, BlockType } from '@/lib/db';
import { INDICATORS } from '@/lib/engine';
import { initI18n } from '@/lib/i18n';
import { DEFAULT_PREFS, useAppStore } from '@/lib/store';
import { routes } from '@/routes';

const store = new Map<string, BlockEntry>();
vi.mock('@/lib/db', async (orig) => ({
  ...(await orig<typeof Db>()),
  allScans: async () => [],
  listBlocklist: async () => [...store.values()],
  blocklistValues: async () => [...store.keys()],
  addToBlocklist: async (value: string, type: BlockType) => {
    const v = value.trim().toLowerCase();
    store.set(v, { value: v, type, addedAt: new Date().toISOString() });
  },
  removeFromBlocklist: async (value: string) => {
    store.delete(value);
  },
}));

const T = { timeout: 5000 };
function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  store.clear();
  useAppStore.setState({ ...DEFAULT_PREFS, lang: 'en' });
  void initI18n();
});

describe('Network', () => {
  const openList = async () => {
    fireEvent.click(await screen.findByText(en.net.listTitle, {}, T));
    return screen.getByRole('list', { name: en.net.listTitle });
  };

  it('shows the console: title, legend, numbers and every node in the list', async () => {
    open('/network');
    expect(await screen.findByRole('heading', { name: en.page.network.title }, T)).toBeTruthy();
    const legend = screen.getByRole('complementary', { name: en.net.legend });
    const campaigns = new Set(INDICATORS.map((i) => i.campaign).filter(Boolean));
    const campBtn = within(legend).getByRole('button', { name: new RegExp(en.net.campaigns) });
    // the network appears once the sample data has loaded
    await waitFor(() => expect(campBtn.textContent).toContain(String(campaigns.size)), T);
    // a legend item hides that layer
    expect(campBtn.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(campBtn);
    expect(campBtn.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText(en.net.kChecked)).toBeTruthy();
    const list = await openList();
    expect(within(list).getByRole('button', { name: en.campaigns['kyc-block-wave'] })).toBeTruthy();
    expect(within(list).getByRole('button', { name: 'sbi-kyc-update.xyz' })).toBeTruthy();
  });

  it('opens a card from the list, and Block puts the detail on the blocklist', async () => {
    open('/network');
    const list = await openList();
    fireEvent.click(within(list).getByRole('button', { name: 'sbi-kyc-update.xyz' }));
    const card = await screen.findByRole('region', { name: 'sbi-kyc-update.xyz' }, T);
    expect(within(card).getByText(/sample data/)).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: en.net.block }));
    await waitFor(() => expect(store.has('sbi-kyc-update.xyz')).toBe(true), T);
    await within(card).findByRole('button', { name: en.net.unblock }, T);
    fireEvent.click(within(card).getByRole('button', { name: en.net.close }));
    expect(screen.queryByRole('region', { name: 'sbi-kyc-update.xyz' })).toBeNull();
  });

  it('?campaign= opens that campaign (Campaign Match "See it on the network")', async () => {
    open('/network?campaign=kyc-block-wave');
    const card = await screen.findByRole('region', { name: en.campaigns['kyc-block-wave'] }, T);
    expect(within(card).getByRole('button', { name: en.net.blockAll })).toBeTruthy();
    expect(within(card).getByRole('link', { name: new RegExp(en.net.report) })).toBeTruthy();
  });

  it('finds a campaign by name, and says so when nothing matches', async () => {
    open('/network');
    const input = await screen.findByLabelText(en.net.askLabel, {}, T);
    await screen.findByText(en.net.listTitle, {}, T); // the network has loaded
    fireEvent.change(input, { target: { value: 'parcel' } });
    fireEvent.submit(input.closest('form')!);
    expect(
      await screen.findByRole('region', { name: en.campaigns['parcel-customs-fee'] }, T),
    ).toBeTruthy();
    fireEvent.change(input, { target: { value: 'zzqq' } });
    fireEvent.submit(input.closest('form')!);
    expect(await screen.findByText(en.net.answerNone, { exact: false }, T)).toBeTruthy();
    expect(screen.getByRole('link', { name: en.net.askAkshi })).toBeTruthy();
  });
});
