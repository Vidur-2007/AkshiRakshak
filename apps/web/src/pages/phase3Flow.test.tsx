import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { firstSentence } from '@/components/elder/ElderViews';
import {
  parseErrorRow,
  sortAnomalies,
  statementGeometry,
} from '@/components/statements/StatementViews';
import en from '@/locales/en.json';
import {
  analyze,
  analyzeStatement,
  EMERGENCY,
  INDICATORS,
  parseStatementCsv,
  SAMPLE_STATEMENTS,
} from '@/lib/engine';
import { initI18n } from '@/lib/i18n';
import { storeResult } from '@/lib/scan';
import { DEFAULT_PREFS, useAppStore } from '@/lib/store';
import { routes } from '@/routes';
import { acceptableCsv, statementVerdict } from './TransactionsPage';

const T = { timeout: 5000 };

function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

beforeEach(() => {
  useAppStore.setState({ ...DEFAULT_PREFS, lang: 'en' });
  void initI18n();
  sessionStorage.clear();
});

/** Answers each question inside its own card (the previous card animates out). */
async function answerAll(first: 'yes' | 'no') {
  for (const [i, q] of EMERGENCY.questions.entries()) {
    const card = await waitFor(() => {
      const el = document.querySelector<HTMLElement>(`[data-question="${q.id}"]`);
      if (!el) throw new Error('card not shown yet');
      return el;
    }, T);
    fireEvent.click(
      within(card).getByRole('button', {
        name: i === 0 && first === 'yes' ? en.sos.yes : en.sos.no,
      }),
    );
  }
}

describe('Emergency', () => {
  it('"Yes" to sent money leads to a tel:1930 action and the bank step', async () => {
    open('/sos');
    expect(await screen.findByText(EMERGENCY.questions[0]!.text.en, {}, T)).toBeTruthy();
    await answerAll('yes');
    expect(await screen.findByText(en.sos.checklistTitle, {}, T)).toBeTruthy();
    const tel = screen.getAllByRole('link').filter((a) => a.getAttribute('href') === 'tel:1930');
    expect(tel.length).toBeGreaterThan(0);
    const bank = EMERGENCY.steps.find(
      (s) => Array.isArray(s.when) && s.when.includes('sent_money'),
    )!;
    expect(
      screen.getAllByText((_, el) => el?.textContent === bank.title.en).length,
    ).toBeGreaterThan(0);
    const noLoss = EMERGENCY.steps.find((s) => s.when === 'no_loss');
    if (noLoss) expect(screen.queryByText(noLoss.title.en)).toBeNull();
  });

  it('a tap on the card that is animating out does not change its answer', async () => {
    open('/sos');
    const first = EMERGENCY.questions[0]!;
    const card = await waitFor(() => {
      const el = document.querySelector<HTMLElement>(`[data-question="${first.id}"]`);
      if (!el) throw new Error('not yet');
      return el;
    }, T);
    fireEvent.click(within(card).getByRole('button', { name: en.sos.yes }));
    // the same (outgoing) card is still in the DOM: a second tap must be ignored
    fireEvent.click(within(card).getByRole('button', { name: en.sos.no }));
    for (const q of EMERGENCY.questions.slice(1)) {
      const c = await waitFor(() => {
        const el = document.querySelector<HTMLElement>(`[data-question="${q.id}"]`);
        if (!el) throw new Error('not yet');
        return el;
      }, T);
      fireEvent.click(within(c).getByRole('button', { name: en.sos.no }));
    }
    await screen.findByText(en.sos.checklistTitle, {}, T);
    const bank = EMERGENCY.steps.find((s) => Array.isArray(s.when) && s.when.includes(first.id))!;
    expect(
      screen.getAllByText((_, el) => el?.textContent === bank.title.en).length,
    ).toBeGreaterThan(0);
  });

  it('all "No" shows the no-loss steps; steps tick off; Back works', async () => {
    open('/sos');
    fireEvent.click(await screen.findByRole('button', { name: en.sos.no }, T));
    fireEvent.click(await screen.findByRole('button', { name: en.sos.back }, T));
    // Back returns to question 1
    expect(
      (await screen.findAllByText(EMERGENCY.questions[0]!.text.en, {}, T)).length,
    ).toBeGreaterThan(0);
    await answerAll('no');
    const noLoss = EMERGENCY.steps.find((s) => s.when === 'no_loss')!;
    expect(
      (await screen.findAllByText((_, el) => el?.textContent === noLoss.title.en, {}, T)).length,
    ).toBeGreaterThan(0);
    const box = screen.getAllByRole('checkbox')[0]!;
    fireEvent.click(box);
    expect(box.getAttribute('aria-checked')).toBe('true');
  });

  it('opens the complaint draft with the answers and a print button', async () => {
    const router = open('/sos');
    await answerAll('yes');
    fireEvent.click(await screen.findByRole('button', { name: en.sos.openReport }, T));
    expect(await screen.findByRole('heading', { level: 1, name: en.report.title }, T)).toBeTruthy();
    expect(router.state.location.pathname).toBe('/sos/report');
    expect(screen.getByText(EMERGENCY.questions[0]!.text.en, { exact: false })).toBeTruthy();
    expect(screen.getByRole('button', { name: en.report.print })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: en.report.whatHappened })).toBeTruthy();
  });
});

describe('Elder Safety Mode', () => {
  const KYC =
    'Dear Customer, your SBI account will be BLOCKED today. Update KYC immediately at http://sbi-kyc-update.xyz/verify or call 98765 00001.';

  it('?simple=1 gives the simplified scan and a full-screen STOP verdict', async () => {
    const router = open('/scan?simple=1');
    const input = await screen.findByLabelText(en.scan.inputLabel, {}, T);
    expect(useAppStore.getState().elderMode).toBe(true);
    expect(screen.getByRole('heading', { level: 1, name: en.elder.title })).toBeTruthy();
    expect(screen.queryByText(en.scan.samplesTitle)).toBeNull();
    fireEvent.change(input, { target: { value: KYC } });
    fireEvent.click(screen.getByRole('button', { name: en.elder.scan }));
    expect(
      await screen.findByRole('heading', { level: 1, name: en.elderVerdict.scam }, T),
    ).toBeTruthy();
    expect(router.state.location.pathname).toMatch(/^\/scan\/.+/);
    expect(screen.getByRole('link', { name: new RegExp(esc(en.elder.setContact)) })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(esc(en.elder.details)) }));
    expect(await screen.findByText(en.analysis.reasonsTitle, {}, T)).toBeTruthy();
  });

  it('"Call my family" dials the trusted contact', async () => {
    useAppStore.setState({
      elderMode: true,
      trustedContact: { name: 'Amma', phone: '+91 90000 00000' },
    });
    open('/scan');
    fireEvent.change(await screen.findByLabelText(en.scan.inputLabel, {}, T), {
      target: { value: KYC },
    });
    fireEvent.click(screen.getByRole('button', { name: en.elder.scan }));
    const call = await screen.findByRole(
      'link',
      { name: new RegExp(esc(en.elder.callFamily.replace('{{name}}', 'Amma'))) },
      T,
    );
    expect(call.getAttribute('href')).toBe('tel:+919000000000');
  });

  it('takes the first sentence for the one-line explanation', () => {
    expect(firstSentence('This is a scam. Do not pay.')).toBe('This is a scam.');
    expect(firstSentence('यह धोखा है। पैसे न भेजें।')).toBe('यह धोखा है।');
    expect(firstSentence('No full stop')).toBe('No full stop');
  });
});

describe('Settings', () => {
  it('validates and saves the trusted contact, toggles AI', async () => {
    open('/settings');
    fireEvent.change(await screen.findByLabelText(en.settings.contactName, {}, T), {
      target: { value: 'Amma' },
    });
    const phone = screen.getByLabelText(en.settings.contactPhone);
    fireEvent.change(phone, { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: en.settings.save }));
    expect(screen.getByRole('alert').textContent).toBe(en.settings.invalidPhone);
    fireEvent.change(phone, { target: { value: '+91 90000 00000' } });
    fireEvent.click(screen.getByRole('button', { name: en.settings.save }));
    expect(useAppStore.getState().trustedContact).toEqual({
      name: 'Amma',
      phone: '+91 90000 00000',
    });
    fireEvent.click(screen.getByRole('switch', { name: en.scan.aiTitle }));
    expect(useAppStore.getState().aiOptIn).toBe(true);
    expect(screen.getByText(en.settings.aiCalls)).toBeTruthy();
  });

  it('asks before deleting everything', async () => {
    open('/settings');
    fireEvent.click(
      (await screen.findAllByRole('button', { name: en.settings.deleteTitle }, T))[0]!,
    );
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByRole('button', { name: en.settings.cancel })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: en.settings.deleteConfirm })).toBeTruthy();
  });
});

describe('Transactions', () => {
  it('a sample statement shows the chart, an anomaly card and the summary', async () => {
    open('/modules/transactions');
    const sample = SAMPLE_STATEMENTS[0]!;
    fireEvent.click(
      await screen.findByRole('button', { name: new RegExp(esc(sample.title.en)) }, T),
    );
    expect(await screen.findByText(en.tx.chartTitle, {}, T)).toBeTruthy();
    expect(screen.getByRole('group', { name: en.tx.chartLabel })).toBeTruthy();
    const analysis = analyzeStatement(parseStatementCsv(sample.csv).txns, 'en');
    const top = sortAnomalies(analysis.anomalies)[0]!;
    expect(screen.getAllByText(top.title).length).toBeGreaterThan(0);
    expect(screen.getByText(en.tx.featureCol)).toBeTruthy();
    expect(screen.getByText(en.tx.summaryTitle)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: top.title }).length).toBeGreaterThan(0);
  });

  it('shows parse errors for a file it cannot read', async () => {
    open('/modules/transactions');
    await screen.findByRole('button', { name: en.tx.upload }, T);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const csv = 'date,description,amount\n2026-01-01,foo,abc\n';
    const file = new File([csv], 'bad.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'text', { value: () => Promise.resolve(csv) });
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText(en.tx.errorsTitle, {}, T)).toBeTruthy();
  });

  it('helpers: row numbers, CSV check, geometry, verdict bands', () => {
    expect(parseErrorRow('Row 12: amount is not a number')).toEqual({
      row: 12,
      message: 'amount is not a number',
    });
    expect(parseErrorRow('bad header')).toEqual({ row: null, message: 'bad header' });
    expect(acceptableCsv({ name: 'a.csv', type: '', size: 10 })).toBe(true);
    expect(acceptableCsv({ name: 'a.pdf', type: 'application/pdf', size: 10 })).toBe(false);
    expect(acceptableCsv({ name: 'a.csv', type: 'text/csv', size: 6 * 1024 * 1024 })).toBe(false);
    expect([statementVerdict(80), statementVerdict(50), statementVerdict(10)]).toEqual([
      'scam',
      'suspicious',
      'no_signs',
    ]);
    const a = analyzeStatement(parseStatementCsv(SAMPLE_STATEMENTS[0]!.csv).txns, 'en');
    const g = statementGeometry(a.txns, a.baseline);
    expect(g.debits.every((d) => d.direction === 'debit')).toBe(true);
    const big = Math.max(...g.debits.map((d) => d.amount));
    expect(g.y(big)).toBeLessThan(g.y(a.baseline.medianDebit));
  });
});

describe('Dashboard', () => {
  it('My shield updates live when a scan is broadcast', async () => {
    open('/dashboard');
    expect(await screen.findByText(en.dash.recentEmpty, {}, T)).toBeTruthy();
    const r = await analyze({
      kind: 'message',
      text: 'Your SBI account will be BLOCKED today, update KYC at http://sbi-kyc.xyz',
      lang: 'en',
    });
    await act(async () => {
      await storeResult(r);
    });
    expect(await screen.findByText(r.text.slice(0, 40), { exact: false }, T)).toBeTruthy();
    expect(screen.queryByText(en.dash.recentEmpty)).toBeNull();
    expect(screen.getByText(en.dash.kMoney)).toBeTruthy();
  });

  it('Lookup labels bundled sample data; unknown values are not called trustworthy', async () => {
    open('/dashboard');
    const tab = await screen.findByRole('tab', { name: en.dash.tabLookup }, T);
    fireEvent.mouseDown(tab);
    fireEvent.click(tab);
    const input = await screen.findByLabelText(en.dash.lookupLabel, {}, T);
    const known = INDICATORS[0]!;
    fireEvent.change(input, { target: { value: known.value } });
    fireEvent.click(screen.getByRole('button', { name: en.dash.lookupCheck }));
    expect(
      await screen.findByText(en.dash.lookupFound.replace('{{n}}', String(known.reports))),
    ).toBeTruthy();
    expect(screen.getAllByText(en.placeholder.sampleData).length).toBeGreaterThan(0);
    fireEvent.change(input, { target: { value: 'nobody.at.all@okaxis' } });
    fireEvent.click(screen.getByRole('button', { name: en.dash.lookupCheck }));
    expect(await screen.findByText(en.dash.lookupNone)).toBeTruthy();
  });

  it('Scam landscape carries the Sample data label and the training-mix note', async () => {
    open('/dashboard');
    const tab = await screen.findByRole('tab', { name: en.dash.tabLandscape }, T);
    fireEvent.mouseDown(tab);
    fireEvent.click(tab);
    expect(await screen.findByText(en.dash.landscapeNote)).toBeTruthy();
    expect(screen.getAllByText(en.placeholder.sampleData).length).toBeGreaterThan(1);
  });
});
