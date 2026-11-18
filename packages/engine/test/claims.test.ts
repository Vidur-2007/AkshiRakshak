import { normalizeText, type Signal } from '@akshi/contracts';
import { describe, expect, it } from 'vitest';
import { analyzeIdentity, findBrandClaims } from '../src/claims/brands';
import { extractEntities } from '../src/extract/entities';
import { matchRules, toSignals } from '../src/rules/engine';

function identity(raw: string) {
  const text = normalizeText(raw);
  const entities = extractEntities(text);
  const ruleSignals: Signal[] = toSignals(matchRules(text), 'en');
  return { text, entities, ...analyzeIdentity({ text, entities, ruleSignals, lang: 'en' }) };
}
const ids = (r: { signals: Signal[] }) => r.signals.map((s) => s.id);

describe('brand claims', () => {
  it('finds brand names in four languages', () => {
    expect(findBrandClaims('Dear SBI customer').map((h) => h.brand.id)).toEqual(['sbi']);
    expect(findBrandClaims('एसबीआई ग्राहक').map((h) => h.brand.id)).toEqual(['sbi']);
    expect(findBrandClaims('మీ HDFC ఖాతా').map((h) => h.brand.id)).toEqual(['hdfc']);
    expect(findBrandClaims('আমাজন অর্ডার').map((h) => h.brand.id)).toEqual(['amazon']);
    expect(findBrandClaims('Your Blue Dart parcel').map((h) => h.brand.id)).toEqual(['bluedart']);
  });

  it('ignores brand tokens inside links and UPI IDs (those are the reality side)', () => {
    const r = identity('Verify at http://sbi-kyc-update.xyz now');
    expect(r.brands).toEqual([]);
    expect(r.claims[0]).toMatchObject({
      claim: "Looks like SBI's website",
      mismatch: true,
      signal: 'LOOKALIKE_DOMAIN',
    });
  });

  it('BRAND_MISMATCH when a claimed brand links elsewhere', () => {
    const r = identity(
      'Dear HDFC customer, your account is on hold. Verify at https://secure-verify-now.com/login',
    );
    expect(ids(r)).toContain('BRAND_MISMATCH');
    expect(r.brands[0]).toMatchObject({
      brand: 'HDFC Bank',
      mismatch: true,
      evidence: 'Link domain secure-verify-now.com is not an official HDFC Bank domain',
    });
    expect(r.claims[0]).toMatchObject({
      claim: 'Says it is from HDFC Bank',
      reality: 'Link goes to secure-verify-now.com, not hdfc.bank.in',
    });
    for (const s of r.signals.flatMap((x) => x.spans))
      expect(r.text.slice(s.start, s.end)).toBe(s.text);
  });

  it('OFFICIAL_DOMAIN when every link is official for the claimed brand', () => {
    const r = identity(
      'Your HDFC Bank statement is ready. Log in at https://netbanking.hdfc.bank.in to view it.',
    );
    expect(ids(r)).toContain('OFFICIAL_DOMAIN');
    expect(ids(r)).not.toContain('BRAND_MISMATCH');
    expect(r.brands[0]?.mismatch).toBe(false);
  });

  it('does not call a link to another well-known brand a mismatch', () => {
    const r = identity(
      'Download the SBI YONO app from https://play.google.com/store/apps/details?id=com.sbi.lotusintouch',
    );
    expect(ids(r)).not.toContain('BRAND_MISMATCH');
  });

  it('official claim + personal mobile + pressure → BRAND_MISMATCH; without pressure it does not', () => {
    const threat = identity(
      'Your electricity will be disconnected tonight. Call electricity officer on 98765 00004 immediately.',
    );
    expect(ids(threat)).toContain('BRAND_MISMATCH');
    expect(threat.claims[0]?.reality).toBe(
      'Asks you to call 98765 00004, a personal mobile number',
    );
    const calm = identity(
      'Electricity board: planned maintenance on Sunday 10am to 2pm. Lineman 98765 00004.',
    );
    expect(ids(calm)).not.toContain('BRAND_MISMATCH');
  });

  it('SUSPICIOUS_LINK only for non-official links in financial messages', () => {
    expect(
      ids(identity('Your refund of Rs 500 is ready, claim at https://claim-now.example')),
    ).toContain('SUSPICIOUS_LINK');
    expect(ids(identity('Look at these photos https://photos-share.example'))).not.toContain(
      'SUSPICIOUS_LINK',
    );
  });

  it('sets floor contexts', () => {
    expect([...identity('SBI: install https://x.site/a.apk').contexts]).toContain('official_claim');
    expect([...identity('Pay at https://parivahan-echallan.top').contexts]).toContain(
      'bank_or_govt_lookalike',
    );
    expect([...identity('Shop at https://amaz0n-deals.top').contexts]).not.toContain(
      'bank_or_govt_lookalike',
    );
  });
});
