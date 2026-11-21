/**
 * "Was Akshi right?": answers are kept with the check (in memory here; IndexedDB is not available),
 * a possible miss points to help, and "Change my answer" removes it.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type * as Db from '@/lib/db';
import type { FeedbackRecord } from '@/lib/db';
import { initI18n } from '@/lib/i18n';
import en from '@/locales/en.json';
import { FeedbackBar } from './FeedbackBar';

const store = new Map<string, FeedbackRecord>();
vi.mock('@/lib/db', async (orig) => ({
  ...(await orig<typeof Db>()),
  getFeedback: async (id: string) => store.get(id),
  saveFeedback: async (rec: FeedbackRecord) => void store.set(rec.scanId, rec),
  removeFeedback: async (id: string) => void store.delete(id),
}));

beforeAll(async () => {
  await initI18n();
});

const show = (verdict: FeedbackRecord['verdict'], id: string) =>
  render(
    <RouterProvider
      router={createMemoryRouter([
        {
          path: '/',
          element: <FeedbackBar result={{ id, verdict, riskScore: 5, kind: 'message' }} />,
        },
      ])}
    />,
  );

describe('FeedbackBar', () => {
  it('keeps the answer with the check and can take it back', async () => {
    show('scam', 'c1');
    fireEvent.click(await screen.findByRole('button', { name: en.feedback.scam }));
    expect(await screen.findByText(new RegExp(en.feedback.agreed))).toBeTruthy();
    expect(store.get('c1')).toMatchObject({ label: 'scam', verdict: 'scam', kind: 'message' });

    fireEvent.click(screen.getByRole('button', { name: en.feedback.change }));
    expect(await screen.findByRole('button', { name: en.feedback.legit })).toBeTruthy();
    expect(store.has('c1')).toBe(false);
  });

  it('a scam Akshi missed points to help; the verdict is untouched', async () => {
    show('no_signs', 'c2');
    fireEvent.click(await screen.findByRole('button', { name: en.feedback.scam }));
    expect(await screen.findByText(/call 1930 now/)).toBeTruthy();
    expect(screen.getByRole('link', { name: en.links.help }).getAttribute('href')).toBe('/sos');
    expect(store.get('c2')?.verdict).toBe('no_signs');
  });

  it('shows a saved answer when the check is opened again', async () => {
    store.set('c3', {
      scanId: 'c3',
      at: '2026-11-22T10:00:00Z',
      label: 'legit',
      verdict: 'suspicious',
      riskScore: 55,
      kind: 'message',
    });
    show('suspicious', 'c3');
    expect(await screen.findByText(new RegExp(en.feedback.falseAlarm))).toBeTruthy();
  });
});
