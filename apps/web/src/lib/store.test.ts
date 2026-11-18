import { beforeEach, describe, expect, it } from 'vitest';
import { applyUrlFlags, DEFAULT_PREFS, initialLang, sanitizePrefs, useAppStore } from './store';

describe('store', () => {
  beforeEach(() => {
    useAppStore.setState({ ...DEFAULT_PREFS });
  });

  it('picks a supported browser language, else English', () => {
    expect(initialLang(['te-IN', 'en-US'])).toBe('te');
    expect(initialLang(['fr-FR', 'hi'])).toBe('hi');
    expect(initialLang(['ta-IN'])).toBe('en');
    expect(initialLang([])).toBe('en');
  });

  it('keeps AI second opinion off by default', () => {
    expect(useAppStore.getState().aiOptIn).toBe(false);
  });

  it('turns voice on when Elder mode turns on', () => {
    useAppStore.getState().setElderMode(true);
    expect(useAppStore.getState()).toMatchObject({ elderMode: true, voiceAuto: true });
    useAppStore.getState().toggleElderMode();
    expect(useAppStore.getState().elderMode).toBe(false);
  });

  it('applies ?simple=1 and ?lang= flags', () => {
    applyUrlFlags('?simple=1&lang=bn');
    expect(useAppStore.getState()).toMatchObject({ elderMode: true, lang: 'bn' });
    applyUrlFlags('?lang=xx');
    expect(useAppStore.getState().lang).toBe('bn');
  });

  it('drops malformed persisted values', () => {
    expect(sanitizePrefs(null)).toEqual({});
    expect(
      sanitizePrefs({ lang: 'fr', elderMode: 'yes', aiOptIn: true, trustedContact: { name: 1 } }),
    ).toEqual({ aiOptIn: true });
    expect(sanitizePrefs({ trustedContact: { name: 'Amma', phone: '+910000000000' } })).toEqual({
      trustedContact: { name: 'Amma', phone: '+910000000000' },
    });
  });
});
