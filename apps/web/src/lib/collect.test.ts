import { describe, expect, it } from 'vitest';
import { analyze } from './engine';
import {
  EMPTY_COLLECT,
  parseAmount,
  prefillFromEntities,
  shouldExplainPin,
  toCollectInput,
} from './collect';

describe('collect form', () => {
  it('parses amounts in Indian formats', () => {
    expect(parseAmount('4,999')).toBe(4999);
    expect(parseAmount('₹ 1,20,000.50')).toBe(120000.5);
    expect(parseAmount('Rs. 500')).toBe(500);
    expect(parseAmount('')).toBeUndefined();
    expect(parseAmount('abc')).toBeUndefined();
  });

  it('maps the form to CollectRequestInput with cautious defaults', () => {
    expect(toCollectInput(EMPTY_COLLECT)).toEqual({
      toldYouWillReceive: false,
      contactedFirst: 'unknown',
      underPressure: false,
      knowRequester: 'unsure',
    });
    expect(
      toCollectInput({
        ...EMPTY_COLLECT,
        requesterUpi: ' x@ybl ',
        amount: '4,999',
        toldYouWillReceive: true,
        contactedFirst: 'them',
        knowRequester: 'no',
      }),
    ).toEqual({
      requesterUpi: 'x@ybl',
      amount: 4999,
      toldYouWillReceive: true,
      contactedFirst: 'them',
      underPressure: false,
      knowRequester: 'no',
    });
  });

  it('pre-fills from a screenshot text', async () => {
    const text = 'Collect request from refund.desk@ybl Rs 4,999 Note: refund processing';
    const r = await analyze({ kind: 'message', text, lang: 'en' });
    expect(prefillFromEntities(r.entities, text)).toMatchObject({
      requesterUpi: 'refund.desk@ybl',
      amount: '4999',
      note: 'refund processing',
    });
  });

  it('explains the PIN when told they will receive, or on RECEIVE_WITH_PIN', async () => {
    const r = await analyze({ kind: 'message', text: 'hello', lang: 'en' });
    expect(shouldExplainPin(r, false)).toBe(false);
    expect(shouldExplainPin(r, true)).toBe(true);
    const withPin = { ...r, signals: [{ ...r.signals[0]!, id: 'RECEIVE_WITH_PIN' as const }] };
    expect(shouldExplainPin(withPin, false)).toBe(true);
  });
});
