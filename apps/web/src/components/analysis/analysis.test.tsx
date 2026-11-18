import { fireEvent, render, screen, within } from '@testing-library/react';
import { LazyMotion, MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import en from '@/locales/en.json';
import type { Signal } from '@/lib/engine';
import { initI18n } from '@/lib/i18n';
import { loadMotionFeatures } from '@/lib/motion';
import { initialTicker } from '@/lib/scanTiming';
import { useAppStore } from '@/lib/store';
import { StageTicker } from '../scan/StageTicker';
import { HighlightedText } from './HighlightedText';
import { orderReasons } from './ReasonList';
import { RiskGauge } from './RiskGauge';
import { RevealProvider } from './reveal';

function wrap(ui: ReactNode) {
  return render(
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="always">
        <RevealProvider>{ui}</RevealProvider>
      </MotionConfig>
    </LazyMotion>,
  );
}

const sig = (
  id: Signal['id'],
  weight: number,
  spans: [number, number][],
  detail = `${id} detail`,
): Signal => ({
  id,
  weight,
  label: `${id} label`,
  detail,
  source: 'rule',
  spans: spans.map(([start, end]) => ({ start, end, text: '' })),
});

beforeAll(() => {
  useAppStore.setState({ lang: 'en', elderMode: false });
  initI18n();
});

describe('HighlightedText', () => {
  const text = 'Account BLOCKED today. Update KYC at http://sbi-kyc.xyz';

  it('renders the full text once and merges overlapping spans into one control', () => {
    const { container } = wrap(
      <HighlightedText
        text={text}
        signals={[
          sig('THREAT_BLOCK', 0.3, [[8, 15]]),
          sig('SUSPICIOUS_LINK', 0.2, [[37, 55]]),
          sig('BANK_IMPERSONATION', 0.25, [
            [30, 33],
            [45, 48],
          ]),
        ]}
      />,
    );
    const p = container.querySelector('p')!;
    const visible = [...p.childNodes]
      .map((n) => (n as HTMLElement).firstChild?.textContent ?? n.textContent)
      .join('');
    expect(visible).toBe(text);
    // BLOCKED, KYC, and the link (which contains the second KYC span) → 3 controls
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('lists every signal of a merged range in its popover', async () => {
    wrap(
      <HighlightedText
        text={text}
        signals={[
          sig('SUSPICIOUS_LINK', 0.2, [[37, 55]]),
          sig('BANK_IMPERSONATION', 0.25, [[45, 48]]),
        ]}
      />,
    );
    const link = screen.getByRole('button');
    fireEvent.click(link);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('BANK_IMPERSONATION label')).toBeTruthy();
    expect(within(dialog).getByText('SUSPICIOUS_LINK label')).toBeTruthy();
  });

  it('opens with the keyboard', async () => {
    wrap(<HighlightedText text={text} signals={[sig('THREAT_BLOCK', 0.3, [[8, 15]])]} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(await screen.findByText('THREAT_BLOCK detail')).toBeTruthy();
  });
});

describe('ReasonList ordering', () => {
  it('puts reassuring signals last', () => {
    const order = orderReasons([
      sig('SAFETY_ADVICE', -0.3, []),
      sig('URGENCY', 0.1, []),
      sig('THREAT_BLOCK', 0.4, []),
    ]);
    expect(order.map((s) => s.id)).toEqual(['THREAT_BLOCK', 'URGENCY', 'SAFETY_ADVICE']);
  });
});

describe('RiskGauge', () => {
  it('states the score for screen readers and shows the final number with reduced motion', () => {
    wrap(<RiskGauge score={92} verdict="scam" />);
    const img = screen.getByRole('img', { name: en.analysis.riskLabel.replace('{{score}}', '92') });
    expect(img.textContent).toContain('92');
  });

  it('draws the two threshold ticks', () => {
    const { container } = wrap(<RiskGauge score={10} verdict="no_signs" />);
    expect(container.querySelectorAll('line')).toHaveLength(4); // 2 ticks × (gap + mark)
  });
});

describe('StageTicker', () => {
  it('shows each stage with its status, skipped ones too', () => {
    const state = {
      ...initialTicker(),
      read: 'done' as const,
      links: 'running' as const,
      model: 'skipped' as const,
    };
    wrap(<StageTicker state={state} stages={['read', 'links', 'patterns', 'model', 'ai']} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items[0]!.textContent).toContain(`${en.stage.read}: ${en.stageStatus.done}`);
    expect(items[3]!.textContent).toContain(en.stageStatus.skipped);
  });
});
