/**
 * Repeated collect requests: the card on a result and the hint on the form, with a history in
 * memory (IndexedDB is not available here).
 */
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type * as Db from '@/lib/db';
import { toScanRecord, type ScanRecord } from '@/lib/db';
import { analyze, type AnalysisResult, type CollectRequestInput } from '@/lib/engine';
import { initI18n } from '@/lib/i18n';
import en from '@/locales/en.json';
import { RepeatRequestHint, RepeatRequestsCard } from './RepeatRequests';

const history: ScanRecord[] = [];
vi.mock('@/lib/db', async (orig) => ({
  ...(await orig<typeof Db>()),
  allScans: async () => history,
  addToBlocklist: async () => {},
}));

const collect = (amount: number): CollectRequestInput => ({
  requesterUpi: 'refund.desk2026@ybl',
  amount,
  toldYouWillReceive: true,
  contactedFirst: 'them',
  underPressure: true,
  knowRequester: 'no',
});
let current: AnalysisResult;

beforeAll(async () => {
  await initI18n();
  for (const [amount, at] of [
    [4999, '2026-11-18T10:00:00Z'],
    [2000, '2026-11-20T10:00:00Z'],
  ] as const) {
    const r = await analyze({ kind: 'collect_request', collect: collect(amount), lang: 'en' });
    history.push({ ...toScanRecord(r), createdAt: at });
  }
  current = await analyze({ kind: 'collect_request', collect: collect(4999), lang: 'en' });
  history.push(toScanRecord(current));
});

const show = (ui: React.ReactNode) =>
  render(<RouterProvider router={createMemoryRouter([{ path: '/', element: ui }])} />);

describe('repeated collect requests', () => {
  it('a result shows the earlier requests (not itself) and the same-amount count', async () => {
    show(<RepeatRequestsCard result={current} />);
    expect(
      await screen.findByRole('heading', {
        name: en.repeat.title.replace('{{n}}', '2'),
      }),
    ).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(
      screen.getByText(en.repeat.same.replace('{{amount}}', '₹4,999').replace('{{n}}', '1')),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: en.repeat.block })).toBeTruthy();
  });

  it('a first request from a UPI ID shows nothing', async () => {
    const r = await analyze({
      kind: 'collect_request',
      collect: { ...collect(100), requesterUpi: 'new.person.demo@okaxis' },
      lang: 'en',
    });
    const { container } = show(<RepeatRequestsCard result={r} />);
    await waitFor(() => expect(container.textContent).toBe(''));
  });

  it('the form hint counts every earlier request as you type', async () => {
    show(<RepeatRequestHint upi="Refund.Desk2026@ybl" id="hint" />);
    expect(await screen.findByText(/sent you collect requests before \(3×/)).toBeTruthy();
    expect(screen.getByRole('link', { name: en.repeat.openLatest })).toBeTruthy();
  });
});
