import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canPlayCosmic, shouldPlayCosmic } from './CosmicIntro';

const SEEN = 'akshi-cosmic-seen';
let reduced = false;

beforeEach(() => {
  reduced = false;
  sessionStorage.clear();
  // jsdom has neither WebGL nor a real matchMedia: pretend both, per test
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) =>
    kind === 'webgl' ? ({} as WebGLRenderingContext) : null) as never);
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (q: string) => ({ matches: reduced && q.includes('reduce') }) as MediaQueryList,
  );
  Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true });
});
afterEach(() => vi.restoreAllMocks());

describe('the cosmic intro', () => {
  it('plays once per session', () => {
    expect(shouldPlayCosmic('')).toBe(true);
    sessionStorage.setItem(SEEN, '1');
    expect(shouldPlayCosmic('')).toBe(false);
  });

  it('?intro=1 plays it again after it was seen, even from a demo or test browser', () => {
    sessionStorage.setItem(SEEN, '1');
    Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true });
    expect(shouldPlayCosmic('?intro=1')).toBe(true);
    expect(shouldPlayCosmic('?x=2&intro=1')).toBe(true);
    expect(shouldPlayCosmic('?intro=10')).toBe(false);
  });

  it('never plays with reduced motion or without WebGL, even when asked', () => {
    reduced = true;
    expect(canPlayCosmic()).toBe(false);
    expect(shouldPlayCosmic('?intro=1')).toBe(false);
    reduced = false;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(canPlayCosmic()).toBe(false);
    expect(shouldPlayCosmic('?intro=1')).toBe(false);
  });

  it('stays off for demo, simple and tour links and under automation', () => {
    expect(shouldPlayCosmic('?demo=1')).toBe(false);
    expect(shouldPlayCosmic('?simple=1')).toBe(false);
    Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true });
    expect(shouldPlayCosmic('')).toBe(false);
  });
});
