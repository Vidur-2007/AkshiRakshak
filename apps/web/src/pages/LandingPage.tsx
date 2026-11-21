import '@/styles/home.css';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HeroXray } from '@/components/home/HeroXray';
import { IntroLoader } from '@/components/home/IntroLoader';
import { ScamDeck } from '@/components/home/ScamDeck';
import { ShieldMoment } from '@/components/home/ShieldMoment';
import { usePageTitle } from '@/hooks/usePageTitle';

const MOMENTS = [
  { id: 'home-check', key: 'home.secCheck' },
  { id: 'home-how', key: 'home.secHow' },
  { id: 'home-deck', key: 'home.secDeck' },
] as const;

/** Snap one moment at a time on this page only; the rest of the app scrolls normally. */
function useSnapScroll() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('home-snap');
    return () => root.classList.remove('home-snap');
  }, []);
}

/** Which moment is on screen, for the dots. */
function useCurrentMoment(): string {
  const [current, setCurrent] = useState<string>(MOMENTS[0].id);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCurrent(e.target.id);
      },
      { threshold: 0.6 },
    );
    for (const m of MOMENTS) {
      const el = document.getElementById(m.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);
  return current;
}

/**
 * Landing (design 2026-11-20): the phone x-ray with a real "Check a message" box, the shield eye,
 * and the scam-pattern deck, each a full screen that snaps into place.
 */
export default function LandingPage() {
  const { t } = useTranslation();
  usePageTitle('');
  useSnapScroll();
  const current = useCurrentMoment();
  const [xray, setXray] = useState(false);
  // the top bar turns dark over the dark moments, as in the design
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('nav-night', current !== 'home-check' || xray);
    return () => root.classList.remove('nav-night');
  }, [current, xray]);
  return (
    <>
      <IntroLoader />
      <nav aria-label={t('home.sections')} className="moment-dots">
        {MOMENTS.map((m) => (
          <a
            key={m.id}
            href={`#${m.id}`}
            aria-label={t(m.key)}
            aria-current={current === m.id ? 'true' : undefined}
          />
        ))}
      </nav>
      <HeroXray id="home-check" onXrayChange={setXray} />
      <ShieldMoment id="home-how" />
      <ScamDeck id="home-deck" />
    </>
  );
}
