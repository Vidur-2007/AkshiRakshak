import { ChevronLeft, ChevronRight, Lock, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  categoryText,
  SCAM_CATEGORIES,
  signalText,
  type ScamCategory,
  type SignalId,
} from '@/lib/engine';
import { CATEGORY_ICON } from '@/lib/risk';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

/** Two warning signs that typically come with each scam type (labels come from the engine). */
export const CATEGORY_TAGS: Record<Exclude<ScamCategory, 'other'>, [SignalId, SignalId]> = {
  fake_kyc: ['THREAT_BLOCK', 'SUSPICIOUS_LINK'],
  upi_collect: ['COLLECT_REQUEST', 'RECEIVE_WITH_PIN'],
  bill_disconnection: ['THREAT_BLOCK', 'CUSTOMER_CARE_NUMBER'],
  courier_customs: ['ADVANCE_FEE', 'SUSPICIOUS_LINK'],
  job_task: ['TASK_JOB_PAYMENT', 'ADVANCE_FEE'],
  lottery_prize: ['PRIZE_LOTTERY', 'ADVANCE_FEE'],
  loan_app: ['APK_LINK', 'THREAT_LEGAL'],
  digital_arrest: ['THREAT_LEGAL', 'STAY_ON_CALL'],
  remote_access: ['ASKS_REMOTE_APP', 'STAY_ON_CALL'],
  qr_receive: ['QR_TO_RECEIVE', 'PREFILLED_AMOUNT'],
  fake_customer_care: ['CUSTOMER_CARE_NUMBER', 'ASKS_REMOTE_APP'],
  investment_crypto: ['TOO_GOOD_RETURNS', 'URGENCY'],
  otp_theft: ['ASKS_OTP', 'URGENCY'],
  refund_cashback: ['RECEIVE_WITH_PIN', 'COLLECT_REQUEST'],
  wrong_transfer: ['WRONG_TRANSFER_RETURN', 'URGENCY'],
  malicious_apk: ['APK_LINK', 'RISKY_ATTACHMENT'],
  impersonation_govt: ['AUTHORITY_CLAIM', 'THREAT_LEGAL'],
  phishing_link: ['LOOKALIKE_DOMAIN', 'ASKS_CVV_PASSWORD'],
  romance: ['SECRECY', 'ADVANCE_FEE'],
};

/** Card order: the most common scams first (the order of CATEGORY_TAGS). */
export const DECK = (Object.keys(CATEGORY_TAGS) as Exclude<ScamCategory, 'other'>[]).filter((c) =>
  (SCAM_CATEGORIES as readonly string[]).includes(c),
);
const N = DECK.length;
const HUE = [
  192, 200, 188, 206, 196, 210, 190, 202, 186, 198, 208, 194, 204, 190, 200, 196, 188, 206, 198,
];

/** Shortest signed distance from the active card, around the ring. */
function distance(i: number, active: number): number {
  let d = (((i - active) % N) + N) % N;
  if (d > N / 2) d -= N;
  return d;
}

/** 3D pose of a card `d` places from the front (the design's fanned deck). */
function pose(d: number, width: number): string {
  const a = Math.abs(d);
  const s = Math.sign(d);
  const x = s * a ** 0.7 * width * 0.52;
  const y = a * width * 0.015;
  const z = -a * 150;
  const ry = -s * Math.min(a, 3) * 20;
  const rz = s * a * 2.2;
  const sc = 1 - a * 0.035;
  return `translate3d(${x}px, ${y}px, ${z}px) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${sc})`;
}

function Emblem({ category }: { category: ScamCategory }) {
  const Icon = CATEGORY_ICON[category];
  return (
    <div className="emb">
      <svg className="frame" viewBox="0 0 100 100" aria-hidden>
        <circle className="ring" cx="50" cy="50" r="48" />
        <circle className="ring" cx="50" cy="50" r="40" />
        <path className="sh" d="M50 14l26 10v20c0 18-11 32-26 39-15-7-26-21-26-39V24z" />
      </svg>
      <Icon className="gl" strokeWidth={1.5} aria-hidden />
    </div>
  );
}

const Brackets = () => (
  <>
    <span className="br a" />
    <span className="br b" />
    <span className="br c" />
    <span className="br d" />
  </>
);

/** Moment 3: the scam patterns as a deck of cards to flick through. */
export function ScamDeck({ id }: { id: string }) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const elder = useAppStore((s) => s.elderMode);
  const [active, setActive] = useState(0);
  const [shield, setShield] = useState(false);
  const [width, setWidth] = useState(300);
  const [drag, setDrag] = useState<{ dx: number } | null>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const dragStart = useRef<{ x: number; t: number; lastX: number; v: number } | null>(null);
  const hover = useRef(false);
  const [inView, setInView] = useState(false);

  const go = useCallback((dir: number) => setActive((a) => (a + dir + N) % N), []);

  // measure the card width (poses are in px)
  useEffect(() => {
    const el = deckRef.current;
    if (!el) return;
    const measure = () => setWidth(el.offsetWidth || 300);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // flick to the next card every 3.2 s while the deck is on screen and left alone
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setInView(Boolean(e?.isIntersecting)), {
      threshold: 0.5,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    let reduced: boolean;
    try {
      reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      reduced = false;
    }
    if (!inView || reduced || elder) return;
    const timer = window.setInterval(() => {
      if (!hover.current && !dragStart.current && !document.hidden) go(1);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [inView, elder, go]);

  const onPointerDown = (e: PointerEvent<HTMLElement>, i: number) => {
    if (distance(i, active) !== 0 || (e.target as HTMLElement).closest('a')) return;
    dragStart.current = { x: e.clientX, t: performance.now(), lastX: e.clientX, v: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ dx: 0 });
  };
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const s = dragStart.current;
    if (!s) return;
    const now = performance.now();
    s.v = (e.clientX - s.lastX) / Math.max(1, now - s.t);
    s.lastX = e.clientX;
    s.t = now;
    setDrag({ dx: e.clientX - s.x });
  };
  const onPointerUp = () => {
    const s = dragStart.current;
    dragStart.current = null;
    const dx = drag?.dx ?? 0;
    setDrag(null);
    if (!s) return;
    if (Math.abs(dx) > 0.22 * width || Math.abs(s.v) > 0.5) go(dx < 0 ? 1 : -1);
  };

  const current = DECK[active]!;
  const name = categoryText(current, lang).name;

  return (
    <section
      id={id}
      ref={sectionRef}
      aria-labelledby="home-deck-title"
      className="moment deck-moment"
      data-shield={shield ? 'on' : 'off'}
    >
      <div className="chead">
        <div>
          <h2 id="home-deck-title">
            {t('home.deckTitle', { n: N })} <em>{t('home.deckTitleEm')}</em>
          </h2>
          <p>{t('home.deckSub')}</p>
        </div>
        <button
          type="button"
          aria-pressed={shield}
          aria-label={shield ? t('home.deckToOff') : t('home.deckToOn')}
          onClick={() => setShield((v) => !v)}
          className="inline-flex min-h-tap items-center gap-3 rounded-full px-2 text-sm font-medium outline-none focus-visible:outline-2 focus-visible:outline-[var(--cyan)]"
        >
          <span>{shield ? t('home.deckOn') : t('home.deckOff')}</span>
          <span
            aria-hidden
            className={cn(
              'relative block h-7 w-[3.25rem] rounded-full transition-colors duration-300',
              shield ? 'bg-[#ff3b5c]' : 'bg-[#c8ced5]',
            )}
          >
            <span
              className={cn(
                'absolute top-1 left-1 size-5 rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.3)] transition-transform duration-300',
                shield && 'translate-x-6',
              )}
            />
          </span>
        </button>
      </div>

      <div
        className="deckwrap"
        role="region"
        aria-roledescription="carousel"
        aria-label={t('home.deckLabel')}
        tabIndex={0}
        onMouseEnter={() => (hover.current = true)}
        onMouseLeave={() => (hover.current = false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            go(1);
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            go(-1);
          }
        }}
      >
        <div
          aria-hidden
          className="deck-amb"
          style={{
            background: shield
              ? 'radial-gradient(closest-side,#ff3b5c,transparent)'
              : `radial-gradient(closest-side,hsl(${HUE[active % HUE.length]} 90% 55%),transparent)`,
          }}
        />
        <div aria-hidden className="radar" />
        <div className="deck" ref={deckRef}>
          {DECK.map((c, i) => {
            const d = distance(i, active);
            const a = Math.abs(d);
            const front = d === 0;
            const ct = categoryText(c, lang);
            const dragging = front && drag !== null;
            const transform = dragging
              ? `translate3d(${drag.dx}px,0,0) rotateZ(${drag.dx * 0.025}deg) rotateY(${drag.dx * 0.03}deg)`
              : pose(d, width);
            return (
              <article
                key={c}
                className={cn('scard', front && 'front', dragging && 'dragging')}
                role="group"
                aria-roledescription="slide"
                aria-label={t('home.slide', { i: i + 1, n: N, name: ct.name })}
                aria-hidden={!front}
                style={{
                  transform,
                  zIndex: 20 - a * 2,
                  opacity: a > 3 ? 0 : 1,
                  visibility: a > 3 ? 'hidden' : 'visible',
                  transitionDelay: front ? '0s' : `${0.03 * a}s`,
                }}
                onPointerDown={(e) => onPointerDown(e, i)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <div className="lay2 off">
                  <Brackets />
                  <Emblem category={c} />
                  <span className="stat">
                    <i />
                    {t('home.watching')}
                  </span>
                </div>
                <div
                  className="lay2 hot"
                  style={{ transitionDelay: shield ? `${((i * 7) % N) * 0.04}s` : '0s' }}
                >
                  <Brackets />
                  <Emblem category={c} />
                  <span className="stat">
                    <Lock className="size-3" aria-hidden />
                    {t('home.caught')}
                  </span>
                </div>
                <div className="sweep" />
                <span className="num">AR-{String(i + 1).padStart(2, '0')}</span>
                <div className="info">
                  <span className="cname">{ct.name}</span>
                  <span className="cdesc">{ct.oneLiner}</span>
                  <span className="ctags">
                    {CATEGORY_TAGS[c].map((s) => (
                      <span key={s}>{signalText(s, lang).label}</span>
                    ))}
                  </span>
                </div>
                <Link to="/scan" className="cta" tabIndex={front ? 0 : -1} draggable={false}>
                  <ShieldCheck aria-hidden />
                  {t('home.checkLike')}
                </Link>
                <div
                  className="shade"
                  style={{ opacity: a === 0 ? 0 : Math.min(0.18 + a * 0.2, 0.8) }}
                />
              </article>
            );
          })}
        </div>
        <button
          type="button"
          className="deck-arrow prev"
          aria-label={t('home.prev')}
          onClick={() => go(-1)}
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <button
          type="button"
          className="deck-arrow next"
          aria-label={t('home.next')}
          onClick={() => go(1)}
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>

      <div className="dfoot">
        <span aria-live="polite">{t('home.count', { i: active + 1, n: N, name })}</span>
        <span>{t('home.deckFoot')}</span>
      </div>
      <div className="dfoot">
        <a href="tel:1930">{t('home.help')}</a>
        <a href="https://cybercrime.gov.in" target="_blank" rel="noreferrer">
          {t('home.helpPortal')}
        </a>
        <a href="https://sancharsaathi.gov.in/sfc/" target="_blank" rel="noreferrer">
          {t('home.helpChakshu')}
        </a>
      </div>
    </section>
  );
}
