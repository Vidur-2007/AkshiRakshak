import { describe, expect, it } from 'vitest';
import { pickVoice } from './speech';

const v = (lang: string, name = lang, localService = false) => ({ lang, name, localService });

describe('pickVoice', () => {
  it('prefers the Indian variant of the UI language', () => {
    expect(pickVoice([v('hi-IN'), v('en-US')], 'hi')?.lang).toBe('hi-IN');
    expect(pickVoice([v('en-US'), v('en-GB'), v('en-IN')], 'en')?.lang).toBe('en-IN');
  });

  it('accepts underscore tags and any region of the language', () => {
    expect(pickVoice([v('te_IN')], 'te')?.lang).toBe('te_IN');
    expect(pickVoice([v('bn-BD')], 'bn')?.lang).toBe('bn-BD');
  });

  it('falls back to English, then null', () => {
    expect(pickVoice([v('en-GB'), v('fr-FR')], 'te')?.lang).toBe('en-GB');
    expect(pickVoice([v('fr-FR')], 'te')).toBeNull();
    expect(pickVoice([], 'en')).toBeNull();
  });
});
