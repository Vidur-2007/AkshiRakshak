/** Every sample screenshot exists in public/samples and is labelled in all four languages. */
import { describe, expect, it } from 'vitest';
import bn from '@/locales/bn.json';
import en from '@/locales/en.json';
import hi from '@/locales/hi.json';
import te from '@/locales/te.json';
import { SAMPLE_SHOTS, sampleShotLangs } from './sampleShots';

const files = Object.keys(import.meta.glob('../../public/samples/*.png')).map((f) =>
  f.slice(f.lastIndexOf('/') + 1),
);

const at = (obj: unknown, key: string) =>
  key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);

describe('sample screenshots', () => {
  it.each(SAMPLE_SHOTS.map((s) => [s.id, s] as const))('%s exists and has labels', (_, s) => {
    expect(files).toContain(`${s.id}.png`);
    for (const locale of [en, hi, te, bn]) expect(at(locale, s.label)).toBeTruthy();
  });

  it('reads a sample in its own language, plus English for numbers and links', () => {
    expect(sampleShotLangs({ lang: 'te' })).toEqual(['te', 'en']);
    expect(sampleShotLangs({ lang: 'en' })).toEqual(['en']);
  });
});
