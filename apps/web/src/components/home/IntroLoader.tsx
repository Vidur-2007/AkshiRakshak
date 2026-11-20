import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { safeLocalStorage } from '@/lib/safeStorage';
import { useAppStore } from '@/lib/store';

const SEEN_KEY = 'akshi-intro-seen';
const DURATION_MS = 3200;

/**
 * Whether to play the "AKSHI" intro: first visit only, never with reduced motion or in Elder
 * mode, never in recording / tour / simple links, and never under browser automation (tests).
 */
export function shouldPlayIntro(search = typeof location === 'undefined' ? '' : location.search) {
  if (typeof window === 'undefined') return false;
  try {
    if (safeLocalStorage.getItem(SEEN_KEY)) return false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  } catch {
    return false;
  }
  if (navigator.webdriver) return false;
  return !/[?&](demo|simple|start)=/.test(search);
}

/** The design's loader: AKSHI letter by letter, a cyan bar and a counter, then it lifts away. */
export function IntroLoader() {
  const { t } = useTranslation();
  const elder = useAppStore((s) => s.elderMode);
  const [show, setShow] = useState(() => shouldPlayIntro());
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (!show) return;
    try {
      safeLocalStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* private mode: the intro may play again, which is harmless */
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, Math.max(0, (performance.now() - t0 - 250) / 1800));
      const eased = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
      setPct(Math.round(eased * 100));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const done = window.setTimeout(() => setShow(false), DURATION_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(done);
    };
  }, [show]);

  if (!show || elder) return null;
  return (
    <div className="home-loader" aria-hidden>
      <div className="word">
        <span>
          {'AKSHI'.split('').map((l, i) => (
            <span key={i} className="l" style={{ animationDelay: `${0.25 + i * 0.36}s` }}>
              {l}
            </span>
          ))}
        </span>
        <span className="bar">
          <i />
        </span>
      </div>
      <div className="foot">
        <span>{t('home.loaderFoot')}</span>
        <span className="font-mono tabular-nums">{String(pct).padStart(3, '0')}</span>
      </div>
    </div>
  );
}
