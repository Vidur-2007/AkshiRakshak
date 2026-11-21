import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Bot, Link2, ListChecks, MessageCircle, ShieldCheck } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { RiseText } from './RiseText';

/** "How Akshi decides": the five steps light up one after another when the shield is on. */
function Flow() {
  const { t } = useTranslation();
  const steps = [
    { icon: MessageCircle, key: 'flow1' },
    { icon: ListChecks, key: 'flow2' },
    { icon: Bot, key: 'flow3' },
    { icon: Link2, key: 'flow4' },
    { icon: ShieldCheck, key: 'flow5' },
  ] as const;
  return (
    <aside className="flow" aria-labelledby="home-flow-title">
      <h3 id="home-flow-title">{t('home.flowTitle')}</h3>
      <ol>
        {steps.map(({ icon: Icon, key }, i) => (
          <li key={key} style={{ transitionDelay: `${300 + i * 140}ms` }}>
            <span className="nd" aria-hidden>
              <Icon className="size-[17px]" strokeWidth={1.8} />
            </span>
            <div>
              <b>{t(`home.${key}`)}</b>
              {key === 'flow5' ? (
                <span className="vch">
                  <i style={{ background: '#d91f45', color: '#fff' }}>{t('verdict.scam')}</i>
                  <i style={{ background: 'rgba(245,165,36,.18)', color: '#f5b547' }}>
                    {t('verdict.suspicious')}
                  </i>
                  <i style={{ background: 'rgba(34,197,94,.16)', color: '#4ade80' }}>
                    {t('verdict.no_signs')}
                  </i>
                </span>
              ) : (
                <span className="s">{t(`home.${key}Sub`)}</span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}

const SHIELD = 'M100 14l66 26v48c0 44-28 80-66 98-38-18-66-54-66-98V40z';
const EYE = 'M52 100s20-34 48-34 48 34 48 34-20 34-48 34-48-34-48-34z';

/** Moment 2: the shield-eye switches on (by itself the first time it is seen, then on tap). */
export function ShieldMoment({ id }: { id: string }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLElement>(null);
  const [on, setOn] = useState(false);
  const [seen, setSeen] = useState(false);
  const touched = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    let timer = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setSeen(true);
        if (!touched.current) timer = window.setTimeout(() => setOn(true), 900);
        io.disconnect();
      },
      { threshold: 0.55 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  const toggle = () => {
    touched.current = true;
    setSeen(true);
    setOn((v) => !v);
  };

  return (
    <section
      id={id}
      ref={ref}
      aria-labelledby="home-how-title"
      className="moment shield-moment"
      data-on={on ? 'on' : 'off'}
      data-seen={seen ? 'yes' : 'no'}
    >
      <div className="moment-frame">
        <div className="stage">
          <div className="bloom" />
          <svg className="eye" viewBox="0 0 200 200" aria-hidden>
            <g
              fill="none"
              stroke="#2a2f37"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={SHIELD} />
              <path d={EYE} />
              <circle cx="100" cy="100" r="16" />
            </g>
          </svg>
          <svg className="eye eye-on" viewBox="0 0 200 200" aria-hidden>
            <defs>
              <filter id="akshi-eye-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <radialGradient id="akshi-iris">
                <stop offset="0" stopColor="#e9fbff" />
                <stop offset=".5" stopColor="#3de0ff" />
                <stop offset="1" stopColor="#0a6f86" />
              </radialGradient>
            </defs>
            <g
              filter="url(#akshi-eye-glow)"
              fill="none"
              stroke="#3de0ff"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={SHIELD} />
              <path d={EYE} />
              <circle cx="100" cy="100" r="16" fill="url(#akshi-iris)" />
              <circle cx="100" cy="100" r="5" fill="#05070b" stroke="none" />
            </g>
          </svg>
          <button
            type="button"
            className="tap-zone"
            aria-pressed={on}
            aria-label={on ? t('home.shieldOffLabel') : t('home.shieldOnLabel')}
            onClick={toggle}
          />
        </div>
      </div>

      <button
        type="button"
        className={buttonVariants({
          variant: 'outline',
          size: 'sm',
          className: 'hint text-[#f1ebe0]',
        })}
        aria-pressed={on}
        onClick={toggle}
      >
        {on ? t('home.tapOff') : t('home.tapShield')}
      </button>

      <Flow />

      <div className="pcopy">
        <div className="mb-2.5 text-[13px] text-[#a39c90]">{t('home.shieldSmall')}</div>
        <h2 id="home-how-title">
          <RiseText
            lines={[[{ t: t('home.shieldTitleA') }], [{ t: t('home.shieldTitleB'), em: true }]]}
            delay={400}
          />
        </h2>
        <p>{t('home.shieldBody')}</p>
        <Link to="/scan" className={buttonVariants({ variant: 'cyan', size: 'lg' })}>
          {t('home.tryNow')}
        </Link>
      </div>
    </section>
  );
}
