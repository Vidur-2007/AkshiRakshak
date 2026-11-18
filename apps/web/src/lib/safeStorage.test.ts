import { describe, expect, it } from 'vitest';
import { createSafeStorage } from './safeStorage';

describe('createSafeStorage', () => {
  it('falls back to memory when storage throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    const s = createSafeStorage(() => throwing);
    expect(() => s.setItem('k', 'v')).not.toThrow();
    expect(s.getItem('k')).toBe('v');
    s.removeItem('k');
    expect(s.getItem('k')).toBeNull();
  });

  it('works when storage is missing entirely', () => {
    const s = createSafeStorage(() => {
      throw new Error('SecurityError');
    });
    s.setItem('a', '1');
    expect(s.getItem('a')).toBe('1');
  });
});
