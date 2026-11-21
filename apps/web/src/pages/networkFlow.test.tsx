/**
 * The Network page (Scam taxonomy · Network V3): title, levers, caption, the message list, the
 * detail panel with the engine's real verdict, ?category= and "Check one like it".
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import en from '@/locales/en.json';
import { initI18n } from '@/lib/i18n';
import { DEFAULT_PREFS, useAppStore } from '@/lib/store';
import { routes } from '@/routes';

const T = { timeout: 8000 };
function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  useAppStore.setState({ ...DEFAULT_PREFS, lang: 'en' });
  void initI18n();
});

// the first test loads the page and the dataset chunk, which can take a few seconds
describe('Network: a taxonomy of scams', { timeout: 15_000 }, () => {
  it('shows the title, the four levers and how many sample messages there are', async () => {
    open('/network');
    expect(await screen.findByRole('heading', { name: en.page.network.title }, T)).toBeTruthy();
    const levers = screen.getByRole('group', { name: en.tax.leversLabel });
    const fear = within(levers).getByRole('button', {
      name: new RegExp(`^${en.tax.lever.fear.name}`),
    });
    expect(within(levers).getAllByRole('button')).toHaveLength(4);
    expect(await screen.findByText(/sample messages, 4 levers/, {}, T)).toBeTruthy();
    fireEvent.click(fear);
    expect(fear.getAttribute('aria-pressed')).toBe('false');
    expect(await screen.findByText(/sample messages, 3 levers/, {}, T)).toBeTruthy();
  });

  it('summarises the wall: kinds, dataset messages, your checks, the largest kind', async () => {
    open('/network');
    const sum = await screen.findByRole('complementary', { name: en.tax.sumTitle }, T);
    const stat = (label: string) =>
      within(sum).getByText(label).parentElement!.querySelector('dd')!.textContent;
    await waitFor(() => expect(stat(en.tax.statKinds)).toBe('19'), T);
    expect(Number(stat(en.tax.statMessages)!.replace(/,/g, ''))).toBeGreaterThan(1000);
    expect(stat(en.tax.statYours)).toBe('0');
    // with no checks of your own, "only my kinds" waits for one
    const only = within(sum).getByRole('switch', { name: en.tax.onlyMine });
    expect((only as HTMLButtonElement).disabled).toBe(true);
    expect(within(sum).getByText(en.tax.onlyMineEmpty)).toBeTruthy();
  });

  it('lists the kinds of scam by size; picking one lights it up', async () => {
    open('/network');
    const kinds = await screen.findByRole('complementary', { name: en.tax.kindsTitle }, T);
    const rows = await within(kinds).findAllByRole('button', {}, T);
    expect(rows).toHaveLength(19);
    const sizes = rows.map((r) =>
      Number(/(\d+) scam messages/.exec(r.getAttribute('aria-label')!)![1]),
    );
    expect([...sizes].sort((x, y) => y - x)).toEqual(sizes);
    const largest = within(screen.getByRole('complementary', { name: en.tax.sumTitle }))
      .getByText(en.tax.statLargest)
      .parentElement!.querySelector('dd')!.textContent;
    expect(String(sizes[0])).toBe(largest);
    fireEvent.click(rows[2]!);
    expect(rows[2]!.getAttribute('aria-pressed')).toBe('true');
  });

  it('switches the scene and remembers it', async () => {
    open('/network');
    const sum = await screen.findByRole('complementary', { name: en.tax.sumTitle }, T);
    const app = sum.closest('.tx-wrap')!.querySelector('.tx-app')!;
    expect(app.getAttribute('data-scene')).toBe('nebula');
    // the scene picker lives in the toolbar, not in the summary panel
    const scenes = screen.getByRole('group', { name: en.tax.scene });
    expect(within(sum).queryByRole('button', { name: en.tax.scene_blueprint })).toBeNull();
    fireEvent.click(within(scenes).getByRole('button', { name: en.tax.scene_blueprint }));
    expect(app.getAttribute('data-scene')).toBe('blueprint');
    expect(localStorage.getItem('akshi-net-scene')).toBe('blueprint');
    localStorage.removeItem('akshi-net-scene');
  });

  it('opens a message from the list: the engine checks it, with tips and actions', async () => {
    const router = open('/network');
    fireEvent.click(await screen.findByText(en.tax.listTitle, {}, T));
    const fearKyc = screen.getByRole('heading', { name: /Fear · Fake KYC/ });
    const first = within(fearKyc.parentElement!).getAllByRole('button')[0]!;
    fireEvent.click(first);
    const panel = screen.getByRole('complementary', { name: en.tax.details });
    expect(within(panel).getByRole('heading', { level: 2 }).textContent).toMatch(/KYC/);
    // the real check of this sample message
    expect(
      await within(panel).findByText(/Akshi's check of this message · risk \d+/, {}, T),
    ).toBeTruthy();
    expect(within(panel).getByText(en.tax.found)).toBeTruthy();
    expect(within(panel).getByText(en.tax.lever.fear.tip1)).toBeTruthy();
    expect(within(panel).getByRole('link', { name: new RegExp(en.tax.report) })).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: en.tax.checkLike }));
    // "Check one like it" opens the check with this message filled in
    await screen.findByLabelText(en.scan.inputLabel, {}, T);
    expect(router.state.location.pathname).toBe('/scan');
    expect((screen.getByLabelText(en.scan.inputLabel) as HTMLTextAreaElement).value).toMatch(/\S/);
  });

  it('closes the panel with its close button', async () => {
    open('/network');
    fireEvent.click(await screen.findByText(en.tax.listTitle, {}, T));
    fireEvent.click(screen.getAllByRole('button', { name: /^SMS · / })[0]!);
    const panel = screen.getByRole('complementary', { name: en.tax.details });
    fireEvent.click(within(panel).getByRole('button', { name: en.tax.close }));
    expect(screen.queryByRole('complementary', { name: en.tax.details })).toBeNull();
  });

  it('?category= (Campaign Match) goes straight to the wall', async () => {
    open('/network?category=fake_kyc');
    const title = (await screen.findByRole('heading', { name: en.page.network.title }, T))
      .parentElement!;
    await screen.findByText(en.tax.listTitle, {}, T);
    await waitFor(() => expect(title.getAttribute('data-off')).toBe('true'));
  });
});
