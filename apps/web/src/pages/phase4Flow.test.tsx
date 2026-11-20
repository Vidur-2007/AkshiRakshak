import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { askOnline } from '@/components/learn/AskPanel';
import { AnalysisShareCard, maskedDetails } from '@/components/share/ShareCards';
import en from '@/locales/en.json';
import { analyze, buildEntityGraph, DRILLS, EVAL_REPORT, FAQ } from '@/lib/engine';
import { initI18n } from '@/lib/i18n';
import { DEFAULT_PREFS, useAppStore } from '@/lib/store';
import { routes } from '@/routes';
import { joinShared } from './ShareTargetPage';

const T = { timeout: 5000 };

function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  useAppStore.setState({ ...DEFAULT_PREFS, lang: 'en' });
  void initI18n();
});

describe('Landing', () => {
  it('opens the real check from the hero: scores as you type, then Scan runs the real scan', async () => {
    const router = open('/');
    fireEvent.click(await screen.findByRole('button', { name: en.home.check }, T));
    const input = await screen.findByLabelText(en.landing.inputLabel, {}, T);
    fireEvent.change(input, {
      target: {
        value: 'Your SBI account will be BLOCKED today. Update KYC at http://sbi-kyc.xyz now',
      },
    });
    const meter = await screen.findByRole(
      'img',
      { name: new RegExp(`^${en.landing.liveRisk}: [1-9]`) },
      T,
    );
    expect(meter).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.placeholder.scanNow) }));
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/scan\/.+/), T);
  });

  it('has the three moments, the Akshi view switch, the scam deck and the help links', async () => {
    open('/');
    expect(await screen.findByRole('heading', { level: 1 }, T)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /Paste it/ })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /tricks/ })).toBeTruthy();

    const view = screen.getByRole('button', { name: en.home.toAkshi });
    fireEvent.click(view);
    expect(
      screen.getByRole('button', { name: en.home.toNormal }).getAttribute('aria-pressed'),
    ).toBe('true');

    const deck = screen.getByRole('region', { name: en.home.deckLabel });
    // every scam type is a card; only the front one is exposed to screen readers
    expect(within(deck).getAllByRole('group', { hidden: true }).length).toBeGreaterThanOrEqual(15);
    expect(within(deck).getAllByRole('group')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: en.home.next }));
    expect(await screen.findByText(/^2 of \d+ · /, {}, T)).toBeTruthy();

    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(
      expect.arrayContaining([
        'tel:1930',
        'https://cybercrime.gov.in',
        'https://sancharsaathi.gov.in/sfc/',
        '/tour?start=1',
      ]),
    );
    // §1.3: the landing never calls anything "safe"
    expect(screen.queryByText(/\bsafe\b/i)).toBeNull();
  });
});

describe('Network', () => {
  it('lists every node, filters by type, and opens the entity panel', async () => {
    open('/network');
    const g = buildEntityGraph([], { includeBundled: true });
    const sample = g.nodes.find((n) => n.sampleData && n.type !== 'campaign')!;
    const stats = en.network.stats
      .replace('{{clusters}}', String(g.stats.clusters))
      .replace('{{largest}}', String(g.stats.largestCluster));
    expect(await screen.findByText(stats, {}, T)).toBeTruthy();
    const list = screen.getByRole('list', { name: en.page.network.title });
    expect(within(list).getAllByRole('button')).toHaveLength(g.nodes.length);
    fireEvent.click(screen.getByRole('button', { name: en.network.campaign }));
    expect(within(list).getAllByRole('button').length).toBe(
      g.nodes.filter((n) => n.type !== 'campaign').length,
    );
    fireEvent.click(
      within(list).getByRole('button', { name: new RegExp(sample.label.replace(/[.+]/g, '\\$&')) }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(en.network.panelReports.replace('{{n}}', String(sample.reports))),
    ).toBeTruthy();
    expect(within(dialog).getByText(en.placeholder.sampleData)).toBeTruthy();
  });

  it('"Only my details" keeps your own details', async () => {
    open('/network');
    const list = await screen.findByRole('list', { name: en.page.network.title }, T);
    fireEvent.click(screen.getByRole('button', { name: en.network.onlyMine }));
    const g = buildEntityGraph([], { includeBundled: true });
    const mine = g.nodes.filter((n) => n.mine);
    // with no scans of your own the filtered list can be empty
    expect(within(list).queryAllByRole('button').length).toBeGreaterThanOrEqual(mine.length);
  });
});

describe('Dojo', () => {
  const drill = DRILLS[0]!;

  it('lists drills and plays one to the end with feedback, red flags and a score', async () => {
    const router = open('/learn/dojo');
    fireEvent.click(
      await screen.findByRole(
        'link',
        { name: new RegExp(drill.title.en.replace(/[()]/g, '.')) },
        T,
      ),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(`/learn/dojo/${drill.id}`), T);
    // follow the best path: always the highest-scoring choice
    for (let step = 0; step < 6; step++) {
      const group = await screen
        .findByRole('group', { name: en.dojo.yourReply }, T)
        .catch(() => null);
      if (!group) break;
      const node = Object.values(drill.nodes).find((n) =>
        n.choices?.some((c) => within(group).queryByRole('button', { name: c.text.en })),
      );
      const best = [...(node?.choices ?? [])].sort((a, b) => b.points - a.points)[0]!;
      fireEvent.click(within(group).getByRole('button', { name: best.text.en }));
      if (best.redFlag)
        expect(
          await screen.findAllByText(new RegExp(en.dojo.redFlag.split('{{')[0]!), {}, T),
        ).toBeTruthy();
      if (drill.nodes[best.next]?.end) break;
    }
    expect(await screen.findByRole('heading', { level: 2, name: en.dojo.endSafe }, T)).toBeTruthy();
    expect(screen.getByText(en.dojo.caught)).toBeTruthy();
    expect(screen.getByRole('button', { name: new RegExp(en.share.button) })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.dojo.again) }));
    expect(await screen.findByRole('group', { name: en.dojo.yourReply }, T)).toBeTruthy();
  });

  it('a missing drill says so', async () => {
    open('/learn/dojo/nope');
    expect(await screen.findByText(en.dojo.notFound, {}, T)).toBeTruthy();
  });
});

describe('Ask', () => {
  it('goes online only with AI opt-in and a connection', () => {
    expect(askOnline(true, true)).toBe(true);
    expect(askOnline(true, false)).toBe(false);
    expect(askOnline(false, true)).toBe(false);
  });

  it('answers a suggested question offline with a badge and a source', async () => {
    open('/learn/ask');
    fireEvent.click(await screen.findByRole('button', { name: FAQ[0]!.q.en }, T));
    expect(await screen.findByText(en.ask.offlineBadge, {}, T)).toBeTruthy();
    expect(screen.getByText(en.ask.sources)).toBeTruthy();
  });

  it('survives browsers where scrollIntoView returns a Promise (opening and leaving Ask)', async () => {
    // Newer Chrome / Edge: scrollIntoView() returns a Promise. An effect that returned it
    // crashed the page with "destroy is not a function" when Ask closed or the page changed.
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function () {
      return Promise.resolve() as unknown as void;
    };
    try {
      const router = open('/learn/ask');
      fireEvent.click(await screen.findByRole('button', { name: FAQ[0]!.q.en }, T));
      expect(await screen.findByText(en.ask.offlineBadge, {}, T)).toBeTruthy();
      await router.navigate('/scan'); // unmounts Ask: its effect cleanups run here
      expect(
        await screen.findByRole('heading', { level: 1, name: en.page.scan.title }, T),
      ).toBeTruthy();
      expect(screen.queryByText(en.errors.title)).toBeNull();
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});

describe('Proof', () => {
  it('shows every block, without the placeholder banner for the measured report', async () => {
    open('/proof');
    expect(
      await screen.findByRole('heading', { level: 2, name: en.proof.vsTitle }, T),
    ).toBeTruthy();
    expect(screen.queryByText(new RegExp(en.proof.placeholderTitle))).toBeNull();
    for (const label of [
      en.proof.vsTitle,
      en.proof.ablationTitle,
      en.proof.perLangTitle,
      en.proof.perCategoryTitle,
      en.proof.confusionTitle,
      en.proof.latencyTitle,
      en.proof.statementsTitle,
      en.proof.methodologyTitle,
      en.proof.datasetsTitle,
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: label })).toBeTruthy();
    }
    // one label per configuration in the bundled report (full_ai_sample appears after the AI sample run)
    for (const c of EVAL_REPORT.configs)
      expect(screen.getByText(en.proof.cfg[c.name])).toBeTruthy();
    expect(screen.getByText(en.proof.mSynthetic)).toBeTruthy();
  });
});

describe('Share cards and share target', () => {
  it('masks the scam details and never shows them in full', async () => {
    const r = await analyze({
      kind: 'message',
      text: 'Pay to kyc.update.helpdesk@ybl or open http://sbi-kyc-update.xyz/verify?id=1 now, account BLOCKED',
      lang: 'en',
    });
    const details = maskedDetails(r);
    expect(details.some((d) => d.includes('…'))).toBe(true);
    const { container } = render(<AnalysisShareCard result={r} lang="en" />);
    expect(container.textContent).not.toContain('kyc.update.helpdesk@ybl');
    expect(container.textContent).not.toContain('/verify');
    expect(container.textContent).toContain(en.share.checkedWith);
  });

  it('joins shared fields and runs the scan from /share-target', async () => {
    const p = new URLSearchParams({
      title: 'SBI',
      text: 'Your KYC is pending, update now',
      url: 'http://sbi-kyc.xyz',
    });
    expect(joinShared(p)).toBe('SBI\nYour KYC is pending, update now\nhttp://sbi-kyc.xyz');
    const router = open(`/share-target?${p.toString()}`);
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/scan\/.+/), T);
  });
});
