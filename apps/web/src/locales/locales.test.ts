import { describe, expect, it } from 'vitest';
import bn from './bn.json';
import en from './en.json';
import hi from './hi.json';
import te from './te.json';

type Tree = { [k: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

const flatEn = flatten(en as Tree);
const others = { hi, te, bn } as const;

describe('locales', () => {
  it.each(Object.entries(others))('%s starts with "_review": "pending"', (_lang, file) => {
    expect(Object.keys(file)[0]).toBe('_review');
    expect((file as Tree)._review).toBe('pending');
  });

  it.each(Object.entries(others))('%s has every English key and no extras', (_lang, file) => {
    const flat = flatten(file as Tree);
    delete flat._review;
    expect(Object.keys(flat).sort()).toEqual(Object.keys(flatEn).sort());
  });

  it.each(Object.entries({ en, ...others }))('%s has no empty strings', (_lang, file) => {
    for (const [k, v] of Object.entries(flatten(file as Tree))) {
      expect(v.trim(), k).not.toBe('');
    }
  });

  it('never calls a verdict "safe" (SPEC.md §1.3)', () => {
    for (const [k, v] of Object.entries(flatEn)) {
      expect(/\bsafe\b/i.test(v), `${k}: ${v}`).toBe(false);
    }
    expect(flatEn['verdict.no_signs']).toBe('No warning signs found');
  });

  it('keeps interpolation placeholders in every language', () => {
    for (const [k, v] of Object.entries(flatEn)) {
      const vars = v.match(/\{\{\w+\}\}/g) ?? [];
      for (const file of Object.values(others)) {
        const t = flatten(file as Tree)[k] ?? '';
        for (const name of vars) expect(t, k).toContain(name);
      }
    }
  });
});
