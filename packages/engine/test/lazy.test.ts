/**
 * Lazy lexicon packs and strings (SPEC_A_ENGINE.md §14) on a fresh module graph (the setup file
 * preloads everything for the other tests).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as I18nModule from '../src/i18n';
import type * as EngineModule from '../src/index';
import type * as RulesModule from '../src/rules/engine';

type Engine = typeof EngineModule;
type Rules = typeof RulesModule;
type I18n = typeof I18nModule;

let engine: Engine;
let rules: Rules;
let i18n: I18n;

beforeEach(async () => {
  vi.resetModules();
  rules = await import('../src/rules/engine');
  i18n = await import('../src/i18n');
  engine = await import('../src/index');
});

const HINDI = 'आपका खाता आज बंद हो जाएगा, तुरंत OTP बताएं';
const ROMAN = 'aapka khata band ho jayega, turant otp bhejo';
const OFF = { expandLinks: false, domainAge: false, layers: { indicators: false } } as const;

describe('lazy lexicons', () => {
  it('has the Latin packs (English, romanised Hindi) without loading anything', () => {
    expect(rules.lexiconsReady(['latn'])).toBe(true);
    expect(rules.lexiconsReady(['deva'])).toBe(false);
    const ids = engine.scoreLive(ROMAN, 'hi').topSignals;
    expect(ids).toEqual(expect.arrayContaining(['THREAT_BLOCK']));
  });

  it('scoreLive starts loading a missing script and finds it on the next call', async () => {
    const before = engine.scoreLive(HINDI, 'hi');
    expect(before.topSignals).not.toContain('THREAT_BLOCK');
    await rules.ensureLexicons(['deva']);
    expect(rules.lexiconsReady(['deva'])).toBe(true);
    const after = engine.scoreLive(HINDI, 'hi');
    expect(after.topSignals).toContain('THREAT_BLOCK');
    expect(after.riskScore).toBeGreaterThan(before.riskScore);
  });

  it('analyze() awaits the packs it needs, so the first scan is complete', async () => {
    const first = await engine.analyze({ kind: 'message', text: HINDI, lang: 'hi', options: OFF });
    expect(first.signals.map((s) => s.id)).toContain('THREAT_BLOCK');
    // localised from the first call too
    expect(first.signals.find((s) => s.id === 'ASKS_OTP')?.label).toBe(
      i18n.signalText('ASKS_OTP', 'hi').label,
    );
    expect(i18n.stringsReady('hi')).toBe(true);
    const again = await engine.analyze({ kind: 'message', text: HINDI, lang: 'hi', options: OFF });
    expect(again.riskScore).toBe(first.riskScore);
  });

  it('warmup(lang) loads only that language; warmup() loads everything', async () => {
    await engine.warmup('te');
    expect(rules.lexiconsReady(['telu'])).toBe(true);
    expect(rules.lexiconsReady(['beng'])).toBe(false);
    expect(i18n.stringsReady('te')).toBe(true);
    expect(i18n.stringsReady('bn')).toBe(false);
    await engine.warmup();
    expect(rules.lexiconsReady(['latn', 'deva', 'telu', 'beng'])).toBe(true);
    expect(i18n.stringsReady('bn')).toBe(true);
  });
});

describe('lazy strings', () => {
  it('falls back to English until the language has loaded', async () => {
    expect(i18n.stringsReady('bn')).toBe(false);
    const en = i18n.signalText('ASKS_OTP', 'en').label;
    expect(i18n.signalText('ASKS_OTP', 'bn').label).toBe(en);
    await i18n.ensureStrings('bn');
    expect(i18n.signalText('ASKS_OTP', 'bn').label).not.toBe(en);
  });

  it('the live listener starts loading its language at creation', async () => {
    engine.createLiveListener('bn');
    await rules.ensureLexicons(['beng']);
    await i18n.ensureStrings('bn');
    expect(rules.lexiconsReady(['beng'])).toBe(true);
    expect(i18n.stringsReady('bn')).toBe(true);
  });
});
