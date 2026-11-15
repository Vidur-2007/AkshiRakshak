import { ArrowLeft, Bell, RotateCcw, ShieldX } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { RevealProvider } from '@/components/analysis/reveal';
import { ScoreRing } from '@/components/learn/ScoreRing';
import { DojoShareCard, ShareImageButton } from '@/components/share/ShareCards';
import { buttonVariants } from '@/components/ui/button';
import { usePageTitle } from '@/hooks/usePageTitle';
import { saveDojoScore } from '@/lib/db';
import { findChoice, maxScore, scoreShare, tallyFlags } from '@/lib/dojo';
import { DRILLS, signalText, type Drill, type DrillChoice, type SignalId } from '@/lib/engine';
import { l10n } from '@/lib/l10n';
import { spring, transition } from '@/lib/motion';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

type Bubble =
  | { key: string; kind: 'them' | 'system'; text: string }
  | { key: string; kind: 'me'; text: string }
  | { key: string; kind: 'feedback'; text: string; redFlag?: SignalId; good: boolean };

const TYPING_MS = 750;

/** Typing dots: a short one-off indicator before each message (game pacing, not analysis latency). */
function TypingDots({ name }: { name: string }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex items-center gap-2 self-start rounded-card rounded-bl-md bg-surface-2 px-4 py-3"
      role="status"
      aria-label={t('dojo.typing', { name })}
    >
      {[0, 1, 2].map((i) => (
        <m.span
          key={i}
          className="size-2 rounded-full bg-text-2"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 0.7, delay: i * 0.12, repeat: 1 }}
        />
      ))}
    </div>
  );
}

function Player({ drill }: { drill: Drill }) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const reduced = useReducedMotion() ?? false;
  const [nodeId, setNodeId] = useState(drill.start);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [typing, setTyping] = useState(false);
  const [chosen, setChosen] = useState<DrillChoice[]>([]);
  const [score, setScore] = useState(0);
  const [ended, setEnded] = useState<'safe' | 'scammed' | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  const node = drill.nodes[nodeId];
  const max = maxScore(drill);
  const shownInEnglish = !drill.langs.includes(lang);

  // Show the node's message: "them" types first, system notes appear at once
  useEffect(() => {
    if (!node) return;
    const add = () => {
      setTyping(false);
      setBubbles((b) => [
        ...b,
        {
          key: `${node.id}-${b.length}`,
          kind: node.from === 'them' ? 'them' : 'system',
          text: l10n(node.text, lang),
        },
      ]);
      if (node.end) setEnded(node.end);
    };
    if (node.from === 'them' && !reduced) {
      setTyping(true);
      const id = window.setTimeout(add, TYPING_MS);
      return () => window.clearTimeout(id);
    }
    add();
    return undefined;
    // Runs per node and per round only; lang is read when the message arrives, so a
    // language switch mid-drill does not replay the history.
  }, [nodeId, round]);

  useEffect(() => {
    logRef.current?.lastElementChild?.scrollIntoView?.({
      block: 'nearest',
      behavior: reduced ? 'auto' : 'smooth',
    });
  }, [bubbles, typing, reduced]);

  useEffect(() => {
    if (ended) void saveDojoScore(drill.id, score).then(setBest);
  }, [ended, drill.id, score]);

  const choose = useCallback(
    (id: string) => {
      const c = findChoice(node, id);
      if (!c || typing || ended) return;
      setChosen((x) => [...x, c]);
      setScore((s) => s + c.points);
      setBubbles((b) => [
        ...b,
        { key: `me-${b.length}`, kind: 'me', text: l10n(c.text, lang) },
        {
          key: `fb-${b.length}`,
          kind: 'feedback',
          text: l10n(c.feedback, lang),
          good: c.points > 0,
          ...(c.redFlag ? { redFlag: c.redFlag } : {}),
        },
      ]);
      setNodeId(c.next);
    },
    [node, typing, ended, lang],
  );

  const restart = () => {
    setBubbles([]);
    setChosen([]);
    setScore(0);
    setEnded(null);
    setBest(null);
    setNodeId(drill.start);
    setRound((r) => r + 1);
  };

  const flags = tallyFlags(chosen);
  const label = (id: SignalId) => signalText(id, lang).label;

  return (
    <div className="flex flex-col gap-4">
      {shownInEnglish && <p className="text-sm text-text-2">{t('dojo.langNote')}</p>}
      <div className="surface overflow-hidden">
        <div className="flex items-center gap-3 border-b border-glass-border bg-surface-2 px-4 py-3">
          <span
            className="grid size-10 place-items-center rounded-full bg-surface text-sm font-semibold"
            aria-hidden
          >
            {drill.persona.name.charAt(0)}
          </span>
          <div>
            <p className="font-medium">{drill.persona.name}</p>
            <p className="text-xs text-text-2">{t(`channel.${drill.channel}`)}</p>
          </div>
        </div>
        <div
          ref={logRef}
          className="flex max-h-[60dvh] min-h-72 flex-col gap-2.5 overflow-y-auto p-4"
          aria-live="polite"
        >
          {bubbles.map((b) => {
            if (b.kind === 'feedback') {
              return (
                <m.div
                  key={b.key}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={transition.base}
                  className="self-center"
                >
                  <div
                    className={cn(
                      'max-w-md rounded-card border px-4 py-3 text-sm',
                      b.good
                        ? 'border-risk-safe/40 bg-risk-safe/8'
                        : 'border-risk-scam/40 bg-risk-scam/8',
                    )}
                  >
                    {b.redFlag && (
                      <m.span
                        className={cn(
                          'mb-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold',
                          b.good ? 'bg-risk-safe/20' : 'bg-risk-scam/20',
                        )}
                        initial={reduced ? false : { scale: 0.8, opacity: 0 }}
                        animate={{ scale: [0.8, 1.08, 1], opacity: 1 }}
                        transition={{ duration: 0.45 }}
                      >
                        <ShieldX className="size-3.5" aria-hidden />
                        {t('dojo.redFlag', { label: label(b.redFlag) })}
                      </m.span>
                    )}
                    <p>{b.text}</p>
                  </div>
                </m.div>
              );
            }
            return (
              <m.div
                key={b.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={spring.ui}
                className={cn(
                  'max-w-[85%] rounded-card px-4 py-2.5 text-[0.95rem] whitespace-pre-wrap',
                  b.kind === 'them' && 'self-start rounded-bl-md bg-surface-2',
                  b.kind === 'me' && 'self-end rounded-br-md bg-brand/15',
                  b.kind === 'system' &&
                    'self-center bg-transparent text-center text-sm text-text-2',
                )}
              >
                {b.kind === 'system' && <Bell className="mr-1.5 inline size-3.5" aria-hidden />}
                {b.text}
              </m.div>
            );
          })}
          {typing && <TypingDots name={drill.persona.name} />}
        </div>
        {!ended && node?.choices && !typing && (
          <div
            className="flex flex-col gap-2 border-t border-glass-border p-3"
            role="group"
            aria-label={t('dojo.yourReply')}
          >
            {node.choices.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => choose(c.id)}
                className="min-h-tap self-end rounded-card rounded-br-md border border-brand/40 bg-brand/8 px-4 py-2.5 text-right text-[0.95rem] transition-colors hover:bg-brand/15 outline-none focus-visible:outline-2 focus-visible:outline-brand"
              >
                {l10n(c.text, lang)}
              </button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {ended && (
          <m.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transition.slow}
            className="surface flex flex-col items-center gap-5 p-6 text-center"
            aria-labelledby="dojo-end"
          >
            <h2 id="dojo-end" className="text-xl font-semibold">
              {ended === 'safe' ? t('dojo.endSafe') : t('dojo.endScammed')}
            </h2>
            <ScoreRing share={scoreShare(score, max)} score={score} max={max} />
            <p className="text-sm text-text-2">
              {t('dojo.score', { score, max })}
              {best !== null && best > score && ` · ${t('dojo.best', { score: best })}`}
            </p>
            <div className="grid w-full max-w-lg gap-4 text-left sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium text-risk-safe">{t('dojo.caught')}</h3>
                <ul className="mt-1 text-sm">
                  {flags.caught.length ? (
                    flags.caught.map((f) => <li key={f}>✓ {label(f)}</li>)
                  ) : (
                    <li className="text-text-2">{t('dojo.none')}</li>
                  )}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium text-risk-scam">{t('dojo.missed')}</h3>
                <ul className="mt-1 text-sm">
                  {flags.missed.length ? (
                    flags.missed.map((f) => <li key={f}>✗ {label(f)}</li>)
                  ) : (
                    <li className="text-text-2">{t('dojo.none')}</li>
                  )}
                </ul>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={restart} className={buttonVariants()}>
                <RotateCcw aria-hidden />
                {t('dojo.again')}
              </button>
              <ShareImageButton
                card={
                  <DojoShareCard
                    title={l10n(drill.title, lang)}
                    score={score}
                    max={max}
                    caught={flags.caught.map(label)}
                  />
                }
                filename={`akshi-dojo-${drill.id}.png`}
                text={`${t('share.dojoTitle')}: ${l10n(drill.title, lang)} — ${score}/${max}`}
              />
            </div>
          </m.section>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Dojo player (§5.13): WhatsApp-style scripted chat, feedback, red flags, score. */
export default function DojoPlayerPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const lang = useAppStore((s) => s.lang);
  const drill = DRILLS.find((d) => d.id === id);
  usePageTitle(drill ? l10n(drill.title, lang) : t('page.dojoPlayer.title'));
  return (
    <section
      aria-labelledby="page-title"
      className="mx-auto w-full max-w-2xl px-4 pt-8 sm:px-6 lg:pt-12"
    >
      <Link
        to="/learn/dojo"
        className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-ml-2' })}
      >
        <ArrowLeft aria-hidden />
        {t('dojo.back')}
      </Link>
      <h1 id="page-title" className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
        {drill ? l10n(drill.title, lang) : t('page.dojoPlayer.title')}
      </h1>
      <div className="mt-5">
        {drill ? (
          <RevealProvider>
            <Player key={drill.id} drill={drill} />
          </RevealProvider>
        ) : (
          <p className="surface p-6 text-text-2">{t('dojo.notFound')}</p>
        )}
      </div>
    </section>
  );
}
