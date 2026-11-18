import { describe, expect, it, vi } from 'vitest';
import { broadcast, BroadcastMessageSchema, subscribe } from './broadcast';

describe('broadcast', () => {
  it('delivers to listeners in the same tab', () => {
    const fn = vi.fn();
    const off = subscribe(fn);
    broadcast({ type: 'scan', id: 'abc' });
    expect(fn).toHaveBeenCalledWith({ type: 'scan', id: 'abc' });
    off();
    broadcast({ type: 'scan', id: 'def' });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed messages', () => {
    expect(BroadcastMessageSchema.safeParse({ type: 'scan' }).success).toBe(false);
    expect(BroadcastMessageSchema.safeParse({ type: 'evil', id: 'x' }).success).toBe(false);
  });
});
