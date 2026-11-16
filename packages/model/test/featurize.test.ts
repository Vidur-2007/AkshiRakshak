import { describe, expect, it } from 'vitest';
import { PUNCT, analyze, featurize } from '../src/featurize';
import versionJson from '../model/version.json';
import fixtures from './featurize-fixtures.json';

describe('featurizer', () => {
  it('produces exactly the Python analyzer features, in order', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(10);
    for (const f of fixtures) expect(analyze(f.text), JSON.stringify(f.text)).toEqual(f.features);
  });

  it('matches hand-computed features', () => {
    expect(analyze('a')).toEqual(['w:a', 'c: a', 'c:a ', 'c: a ']);
    expect(analyze('Ab!')).toEqual([
      'w:ab',
      'c: a', 'c:ab', 'c:b!', 'c:! ',
      'c: ab', 'c:ab!', 'c:b! ',
      'c: ab!', 'c:ab! ',
      'c: ab! ',
    ]);
    expect(analyze('')).toEqual([]);
  });

  it('uses the punctuation set stored in the exported model', () => {
    expect(PUNCT).toBe('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~“”‘’…–—।॥');
    expect(versionJson.format).toBe('akshi-lr-v1');
  });

  it('records UTF-16 spans that point at the feature in the original text', () => {
    const text = 'Share OTP 🎁 now, खाता बंद!';
    const vocab = new Map(
      ['w:otp', 'w:share otp', 'c:otp', 'c: ot', 'c:tp ', 'w:🎁', 'c: 🎁 ', 'w:now', 'w:खाता', 'c:ाता', 'w:बंद', 'c:द! '].map(
        (f, i) => [f, i] as const,
      ),
    );
    const { counts, spans } = featurize(text, vocab);
    const at = (feature: string) => {
      const flat = spans.get(vocab.get(feature)!)!;
      expect(flat.length % 2).toBe(0);
      return text.slice(flat[0], flat[1]);
    };
    expect(at('w:otp')).toBe('OTP');
    expect(at('w:share otp')).toBe('Share OTP');
    expect(at('c:otp')).toBe('OTP');
    expect(at('c: ot')).toBe('OT'); // pad spaces are not part of the span
    expect(at('c:tp ')).toBe('TP');
    expect(at('w:🎁')).toBe('🎁'); // one code point, two UTF-16 units
    expect(at('c: 🎁 ')).toBe('🎁');
    expect(at('w:now')).toBe('now'); // the comma is stripped from the token
    expect(at('w:खाता')).toBe('खाता');
    expect(at('c:ाता')).toBe('ाता');
    expect(at('w:बंद')).toBe('बंद');
    expect(at('c:द! ')).toBe('द!');
    expect([...counts.values()].every((c) => c === 1)).toBe(true);
  });

  it('counts repeated features and keeps one span per occurrence', () => {
    const vocab = new Map([['w:otp', 0]]);
    const { counts, spans } = featurize('otp OTP Otp', vocab);
    expect(counts.get(0)).toBe(3);
    expect(spans.get(0)).toEqual([0, 3, 4, 7, 8, 11]);
  });

  it('keeps spans right when lower-casing changes the length', () => {
    const text = 'İ OTP'; // "İ".toLowerCase() is two code points
    const { spans } = featurize(text, new Map([['w:otp', 0]]));
    const flat = spans.get(0)!;
    expect(text.slice(flat[0], flat[1])).toBe('OTP');
  });
});
