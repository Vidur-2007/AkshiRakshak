import { describe, expect, it } from 'vitest';
import { EMERGENCY } from './engine';
import { actionHref, allNo, buildChecklist } from './emergency';

const Q = EMERGENCY.questions;
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe('buildChecklist', () => {
  it('puts always steps first, then matching steps by priority', () => {
    const list = buildChecklist(
      EMERGENCY.steps,
      { sent_money: true, shared_otp: true, entered_pin: false },
      Q,
    );
    const order = ids(list);
    const always = EMERGENCY.steps.filter((s) => s.when === 'always').map((s) => s.id);
    expect(order.slice(0, always.length).sort()).toEqual([...always].sort());
    const rest = list.slice(always.length);
    expect(rest.every((s) => Array.isArray(s.when))).toBe(true);
    expect(rest.map((s) => s.priority)).toEqual(
      [...rest.map((s) => s.priority)].sort((a, b) => a - b),
    );
    expect(order).not.toContain(EMERGENCY.steps.find((s) => s.when === 'no_loss')?.id);
  });

  it('adds no_loss steps only when every answer is No', () => {
    const none = Object.fromEntries(Q.map((q) => [q.id, false]));
    const noLoss = EMERGENCY.steps.filter((s) => s.when === 'no_loss').map((s) => s.id);
    expect(ids(buildChecklist(EMERGENCY.steps, none, Q))).toEqual(expect.arrayContaining(noLoss));
    const partial = { [Q[0]!.id]: false };
    for (const id of noLoss)
      expect(ids(buildChecklist(EMERGENCY.steps, partial, Q))).not.toContain(id);
    expect(allNo({}, [])).toBe(false);
  });

  it('includes 1930 when money was sent', () => {
    const list = buildChecklist(EMERGENCY.steps, { sent_money: true }, Q);
    expect(list.some((s) => s.action && actionHref(s.action) === 'tel:1930')).toBe(true);
  });

  it('builds hrefs for actions', () => {
    expect(actionHref({ kind: 'tel', value: '1930', label: { en: 'x' } })).toBe('tel:1930');
    expect(
      actionHref({ kind: 'url', value: 'https://cybercrime.gov.in', label: { en: 'x' } }),
    ).toBe('https://cybercrime.gov.in');
    expect(actionHref({ kind: 'internal', value: '/sos/report', label: { en: 'x' } })).toBe(
      '/sos/report',
    );
  });
});
