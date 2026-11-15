import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/locales/en.json';
import type { ListenUpdate } from '@/lib/engine';
import { initI18n } from '@/lib/i18n';
import { RECOGNITION_LANG, toListenError } from '@/lib/listen';
import { DEFAULT_PREFS, useAppStore } from '@/lib/store';
import ListenSheet from './ListenSheet';

// A listener in the shape of A's createLiveListener (feat/engine listen.ts)
const push = vi.fn((text: string): ListenUpdate => ({
  score: {
    riskScore: /otp/i.test(text) ? 82 : 10,
    verdict: /otp/i.test(text) ? 'scam' : 'no_signs',
    topSignals: [],
  } as unknown as ListenUpdate['score'],
  alerts: /otp/i.test(text)
    ? [{ id: 'ASKS_OTP', label: 'Asks for your OTP', detail: '', phrase: 'share the OTP' }]
    : [],
  transcript: text,
}));
vi.mock('@/lib/engineLoader', () => ({
  loadEngine: async () => ({ createLiveListener: () => ({ push, reset: () => undefined }) }),
}));

type Handler = ((e: unknown) => void) | null;
class FakeRecognition {
  static last: FakeRecognition | null = null;
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: Handler = null;
  onerror: Handler = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  constructor() {
    FakeRecognition.last = this;
  }
  say(text: string, isFinal: boolean) {
    const result = Object.assign([{ transcript: text }], { isFinal });
    this.onresult?.({ resultIndex: 0, results: [result] });
  }
}

beforeAll(async () => {
  await initI18n();
});

describe('live listen (M1.15)', () => {
  beforeEach(() => {
    useAppStore.setState({ ...DEFAULT_PREFS, online: true });
    (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition =
      FakeRecognition;
    push.mockClear();
  });

  it('maps languages and errors', () => {
    expect(RECOGNITION_LANG.te).toBe('te-IN');
    expect(toListenError('not-allowed')).toBe('denied');
    expect(toListenError('network')).toBe('network');
  });

  it('shows interim words, raises one alert, then checks the transcript', async () => {
    const onScan = vi.fn();
    render(<ListenSheet open onOpenChange={() => undefined} onScan={onScan} />);
    expect(screen.getByText(en.listen.privacy)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.listen.start }));
    await vi.waitFor(() => expect(FakeRecognition.last?.start).toHaveBeenCalled());
    const rec = FakeRecognition.last!;
    expect(rec).toMatchObject({ lang: 'en-IN', continuous: true, interimResults: true });

    act(() => rec.say('sir please share the', false));
    expect(screen.getByText('sir please share the')).toBeTruthy();
    act(() => rec.say('sir please share the OTP now', true));
    expect(push).toHaveBeenLastCalledWith('sir please share the OTP now', true);
    expect(await screen.findByText('Asks for your OTP')).toBeTruthy();
    expect(screen.getByText(en.listen.hangUp)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: en.listen.stop }));
    expect(rec.stop).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: en.listen.check }));
    expect(onScan).toHaveBeenCalledWith('sir please share the OTP now');
  });

  it('explains a blocked microphone', async () => {
    render(<ListenSheet open onOpenChange={() => undefined} onScan={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: en.listen.start }));
    await vi.waitFor(() => expect(FakeRecognition.last?.start).toHaveBeenCalled());
    act(() => FakeRecognition.last!.onerror?.({ error: 'not-allowed' }));
    expect(await screen.findByText(en.listen.error.denied)).toBeTruthy();
    expect(screen.getByRole('button', { name: en.listen.start })).toBeTruthy();
  });
});
