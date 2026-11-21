/**
 * Cross-module links on the Transactions page: the student sample statement pays two UPI IDs that
 * are in Akshi's sample scam data, so "Linked to scams" lists them, labelled as sample data.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import en from '@/locales/en.json';
import { initI18n } from '@/lib/i18n';
import { DEFAULT_PREFS, useAppStore } from '@/lib/store';
import { routes } from '@/routes';

const T = { timeout: 8000 };

beforeEach(() => {
  useAppStore.setState({ ...DEFAULT_PREFS, lang: 'en' });
  void initI18n();
});

describe('Transactions: linked to scams', { timeout: 15_000 }, () => {
  it('lists payments to UPI IDs in the sample scam data, with advice and actions', async () => {
    render(
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: ['/modules/transactions'] })}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: /College student \(sample\)/ }, T));
    const card = (await screen.findByRole('heading', { name: en.links.title }, T)).closest(
      'section',
    )!;
    const rows = within(card).getAllByRole('listitem');
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const text = card.textContent ?? '';
    expect(text).toContain('refund.desk2026@ybl');
    expect(text).toContain('task.payout.hr@ybl');
    // sample data only: labelled as such, never as your own checks
    expect(within(card).getAllByText(/In Akshi's sample scam data/).length).toBeGreaterThan(0);
    expect(within(card).queryByText(/In a message you checked/)).toBeNull();
    expect(within(card).getAllByRole('button', { name: en.links.block }).length).toBeGreaterThan(0);
  });
});
