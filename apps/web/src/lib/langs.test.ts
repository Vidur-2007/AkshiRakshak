import { describe, expect, it } from 'vitest';
import { LANGS } from './engine';
import { UI_LANGS } from './langs';

describe('UI_LANGS', () => {
  it('matches the contract LANGS', () => {
    expect([...UI_LANGS]).toEqual([...LANGS]);
  });
});
