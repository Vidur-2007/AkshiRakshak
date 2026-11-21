import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import en from '@/locales/en.json';
import { initI18n } from '@/lib/i18n';
import type { Replay } from '@/lib/replay';
import { useAppStore } from '@/lib/store';
import { ScamReplay } from './ScamReplay';

const REPLAY: Replay = {
  steps: [
    {
      stage: 'hook',
      text: 'pretends to be your bank',
      quote: 'SBI account',
      tactics: ['Authority pressure'],
    },
    {
      stage: 'pressure',
      text: 'threatens to block your account',
      quote: 'account will be BLOCKED',
      tactics: ['Fear', 'Artificial urgency'],
    },
    { stage: 'extraction', text: 'asks for your OTP', quote: 'Share the OTP', tactics: [] },
  ],
  stopAt: 2,
  goal: 'money',
};

beforeAll(async () => {
  await initI18n();
});
afterEach(() => {
  vi.useRealTimers();
  useAppStore.setState({ elderMode: false });
});

const rows = () =>
  within(screen.getByRole('list', { name: en.replay.title }))
    .getAllByRole('listitem', { hidden: true })
    .filter((li) => li.parentElement?.tagName === 'OL');

describe('ScamReplay', () => {
  it('shows the steps in attack order with the warning before the first demand', () => {
    render(<ScamReplay replay={REPLAY} />);
    const items = rows();
    expect(items).toHaveLength(5);
    expect(items[0]!.textContent).toContain('Step 1 · The bait');
    expect(items[0]!.textContent).toContain('Pretends to be your bank');
    expect(items[0]!.textContent).toContain('“SBI account”');
    expect(items[1]!.textContent).toContain('Step 2 · The pressure');
    expect(items[1]!.textContent).toContain('Fear');
    expect(items[2]!.textContent).toContain(en.replay.shield);
    expect(items[3]!.textContent).toContain('Step 3 · The demand');
    expect(items[4]!.textContent).toContain(en.replay.goal.money);
  });

  it('Replay hides the steps and plays them again one by one', () => {
    vi.useFakeTimers();
    render(<ScamReplay replay={REPLAY} />);
    fireEvent.click(screen.getByRole('button', { name: en.replay.play }));
    expect(rows().every((li) => li.className.includes('invisible'))).toBe(true);
    act(() => void vi.advanceTimersByTime(300));
    expect(rows()[0]!.className).not.toContain('invisible');
    expect(rows()[1]!.className).toContain('invisible');
    for (let i = 0; i < 6; i++) act(() => void vi.advanceTimersByTime(850));
    expect(rows().some((li) => li.className.includes('invisible'))).toBe(false);
  });

  it('Elder mode shows everything at once, with no Replay button', () => {
    useAppStore.setState({ elderMode: true });
    render(<ScamReplay replay={REPLAY} />);
    expect(screen.queryByRole('button', { name: en.replay.play })).toBeNull();
    expect(rows().some((li) => li.className.includes('invisible'))).toBe(false);
  });
});
