import { useReducedMotion } from 'motion/react';
import {
  Fish,
  Link2,
  RotateCcw,
  ShieldCheck,
  Target,
  Timer,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { AttackStage } from '@/lib/engine';
import { sentenceCase, type Replay } from '@/lib/replay';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const STAGE_ICON: Record<AttackStage, LucideIcon> = {
  hook: Fish,
  pressure: Timer,
  compromise: Link2,
  extraction: WalletCards,
};
/** the stages that ask you to act are red; the set-up is amber */
const STAGE_TONE: Record<AttackStage, string> = {
  hook: 'border-risk-warn text-risk-warn',
  pressure: 'border-risk-warn text-risk-warn',
  compromise: 'border-risk-scam text-risk-scam',
  extraction: 'border-risk-scam text-risk-scam',
};
const STEP_MS = 850;

type Item =
  | { kind: 'step'; index: number }
  | { kind: 'shield' }
  | { kind: 'goal'; goal: 'money' | 'control' };

function itemsOf(replay: Replay): Item[] {
  const items: Item[] = [];
  replay.steps.forEach((_, index) => {
    if (index === replay.stopAt) items.push({ kind: 'shield' });
    items.push({ kind: 'step', index });
  });
  if (replay.stopAt >= replay.steps.length) items.push({ kind: 'shield' });
  if (replay.goal) items.push({ kind: 'goal', goal: replay.goal });
  return items;
}

/**
 * Scam Replay: the attack this message sets up, played step by step — the bait, the pressure, the
 * trap, the demand — each with the words from the message and the trick it uses, and a shield where
 * Akshi's warning comes in. Plays once when it scrolls into view; Replay plays it again. Reduced
 * motion and Elder mode show every step at once. The page shows it only when buildReplay() finds a
 * sequence (two or more stages) in a result with warning signs.
 */
export function ScamReplay({ replay }: { replay: Replay }) {
  const { t } = useTranslation();
  const elder = useAppStore((s) => s.elderMode);
  const reduced = useReducedMotion() ?? false;
  const still = reduced || elder;
  const items = useMemo(() => itemsOf(replay), [replay]);
  const total = items.length;
  const [shown, setShown] = useState(still ? total : 0);
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // start once, the first time the replay is on screen
  useEffect(() => {
    if (still) {
      setShown(total);
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(total);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setPlaying(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [still, total]);

  useEffect(() => {
    if (!playing) return;
    if (shown >= total) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setShown((n) => n + 1), shown === 0 ? 250 : STEP_MS);
    return () => window.clearTimeout(timer);
  }, [playing, shown, total]);

  const replayAgain = () => {
    if (still) return;
    setShown(0);
    setPlaying(true);
  };

  // the red rail grows down to the last item shown
  const progress = total > 1 ? Math.max(0, Math.min(1, (shown - 1) / (total - 1))) : 1;
  let stepNo = 0;

  return (
    <div ref={ref}>
      <div className="flex items-start gap-3">
        <p className="text-sm text-text-2">{t('replay.sub')}</p>
        {!still && (
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto shrink-0"
            onClick={replayAgain}
            disabled={playing}
          >
            <RotateCcw aria-hidden />
            {t('replay.play')}
          </Button>
        )}
      </div>
      <ol className="relative mt-5" aria-label={t('replay.title')}>
        <span aria-hidden className="absolute top-5 bottom-5 left-[19px] w-px bg-glass-border" />
        <span
          aria-hidden
          className="absolute top-5 left-[19px] w-px origin-top bg-gradient-to-b from-risk-warn to-risk-scam transition-[height] duration-700 ease-out"
          style={{ height: `calc((100% - 2.5rem) * ${progress})` }}
        />
        {items.map((item, i) => {
          const on = i < shown;
          if (item.kind === 'shield')
            return (
              <Row key="shield" on={on}>
                <span
                  className={cn(
                    'relative z-10 grid size-10 shrink-0 place-items-center rounded-full border border-cyan bg-surface text-cyan',
                    on &&
                      !still &&
                      'shadow-[0_0_0_6px_color-mix(in_srgb,var(--cyan)_18%,transparent)]',
                  )}
                >
                  <ShieldCheck className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 rounded-card border border-cyan/40 bg-cyan/5 px-4 py-3">
                  <p className="font-medium text-text">{t('replay.shield')}</p>
                  <p className="mt-0.5 text-sm text-text-2">{t('replay.shieldSub')}</p>
                </div>
              </Row>
            );
          if (item.kind === 'goal')
            return (
              <Row key="goal" on={on}>
                <span className="relative z-10 grid size-10 shrink-0 place-items-center rounded-full border border-dashed border-risk-scam bg-surface text-risk-scam">
                  <Target className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 pt-1">
                  <p className="text-xs font-medium tracking-wide text-text-2 uppercase">
                    {t('replay.goalLead')}
                  </p>
                  <p className="mt-1 font-medium text-text">{t(`replay.goal.${item.goal}`)}</p>
                </div>
              </Row>
            );
          const step = replay.steps[item.index]!;
          const Icon = STAGE_ICON[step.stage];
          const after = item.index >= replay.stopAt;
          stepNo += 1;
          return (
            <Row key={`step-${item.index}`} on={on}>
              <span
                className={cn(
                  'relative z-10 grid size-10 shrink-0 place-items-center rounded-full border bg-surface',
                  STAGE_TONE[step.stage],
                  after && 'border-dashed',
                )}
              >
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <p className="text-xs font-medium tracking-wide text-text-2 uppercase">
                  {t('replay.step', { n: stepNo })} · {t(`replay.stage.${step.stage}`)}
                </p>
                <p className="mt-1 font-medium text-text">{sentenceCase(step.text)}</p>
                {step.quote && (
                  <blockquote className="mt-2 border-l-2 border-glass-border pl-3 font-mono text-sm break-words text-text-2">
                    <span className="sr-only">{t('replay.evidence')}: </span>“{step.quote}”
                  </blockquote>
                )}
                {step.tactics.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t('replay.tactics')}>
                    {step.tactics.map((tac) => (
                      <li
                        key={tac}
                        className="rounded-full border border-glass-border bg-surface-2 px-2.5 py-0.5 text-xs text-text"
                      >
                        {tac}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Row>
          );
        })}
      </ol>
    </div>
  );
}

/** One timeline row; hidden (and out of the accessibility tree) until the replay reaches it. */
function Row({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <li
      className={cn(
        'relative flex gap-4 pb-5 transition-[opacity,transform,visibility] duration-500 ease-out last:pb-0',
        on ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-2 opacity-0',
      )}
    >
      {children}
    </li>
  );
}
