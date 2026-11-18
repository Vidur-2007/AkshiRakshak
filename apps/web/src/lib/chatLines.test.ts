import { describe, expect, it } from 'vitest';
import { escalationIndex, toBubble } from './chatLines';

const turn = (text: string, sender: 'them' | 'me' | 'unknown' = 'them', risk = 5) => ({
  index: 0,
  sender,
  text,
  risk,
  start: 0,
  end: text.length,
});

describe('toBubble', () => {
  it('strips WhatsApp prefixes and keeps name and time', () => {
    expect(toBubble(turn('[12/11/26, 10:01] Priya HR: Hello!'))).toMatchObject({
      name: 'Priya HR',
      time: '10:01',
      body: 'Hello!',
    });
    expect(toBubble(turn('12/11/26, 10:01 pm - Me: ok', 'me'))).toMatchObject({
      name: 'Me',
      time: '12/11/26, 10:01 pm'.split(/,\s*/).pop(),
      body: 'ok',
    });
  });

  it('handles plain "Name: text" and lines without a name', () => {
    expect(toBubble(turn('Ravi: send it'))).toMatchObject({ name: 'Ravi', body: 'send it' });
    expect(toBubble(turn('just text'))).toMatchObject({ name: null, body: 'just text' });
    expect(toBubble(turn('https://x.in/a'))).toMatchObject({ name: null });
  });
});

describe('escalationIndex', () => {
  it('finds where risk first crosses 40', () => {
    expect(escalationIndex([5, 10, 45, 80])).toBe(2);
    expect(escalationIndex([50, 20, 60])).toBe(0);
  });

  it('falls back to the biggest jump of 20+, else null', () => {
    expect(escalationIndex([5, 30, 32])).toBe(1);
    expect(escalationIndex([5, 10, 15])).toBeNull();
    expect(escalationIndex([])).toBeNull();
  });
});
