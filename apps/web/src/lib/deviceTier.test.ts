import { describe, expect, it } from 'vitest';
import { computeTier, TIER_SETTINGS } from './deviceTier';

describe('computeTier', () => {
  it('is high with ≥ 8 cores and ≥ 8 GB', () => {
    expect(computeTier({ cores: 8, memoryGb: 8 })).toBe('high');
    expect(computeTier({ cores: 16, memoryGb: 16 })).toBe('high');
  });

  it('is high with ≥ 8 cores when memory is not exposed', () => {
    expect(computeTier({ cores: 12 })).toBe('high');
  });

  it('is low with ≤ 4 cores, ≤ 4 GB, Save-Data or reduced motion', () => {
    expect(computeTier({ cores: 4, memoryGb: 8 })).toBe('low');
    expect(computeTier({ cores: 8, memoryGb: 4 })).toBe('low');
    expect(computeTier({ cores: 8, memoryGb: 8, saveData: true })).toBe('low');
    expect(computeTier({ cores: 8, memoryGb: 8, reducedMotion: true })).toBe('low');
  });

  it('is mid otherwise', () => {
    expect(computeTier({ cores: 6, memoryGb: 8 })).toBe('mid');
    expect(computeTier({ cores: 8, memoryGb: 6 })).toBe('mid');
    expect(computeTier({})).toBe('mid');
  });

  it('maps tiers to the documented settings', () => {
    expect(TIER_SETTINGS.high).toMatchObject({ shieldPoints: 6000, dprCap: 1.5 });
    expect(TIER_SETTINGS.mid).toMatchObject({ shieldPoints: 2500, dprCap: 1.25 });
    expect(TIER_SETTINGS.low).toMatchObject({ shieldPoints: 0, lenis: false, blurLayers: 0 });
  });
});
