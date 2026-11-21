import { IndianRupee, RotateCcw, UserRound } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReveal } from '@/components/analysis/reveal';
import { cn } from '@/lib/utils';

export const PIN_DIGITS = 4;
const PRESS_MS = 520;
/** The keys "pressed" in the demonstration (never a real PIN). */
const SEQUENCE = ['1', '5', '9', '0'];
/** Illustrative starting balance, labelled as a demonstration. */
const DEMO_BALANCE = 24_500;

/** Balance after `presses` of `total` key presses, sending `amount` in equal parts. */
export function balanceAfter(
  start: number,
  amount: number,
  presses: number,
  total = PIN_DIGITS,
): number {
  const p = Math.max(0, Math.min(total, presses));
  return Math.max(0, Math.round(start - (amount * p) / total));
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', ''];

/**
 * PIN-pad explainer (M3.2): as the PIN is "entered", rupees move out of your balance
 * to the requester. Ends on "Entering your PIN sends money. You never need a PIN to receive."
 */
export function PinPadExplainer({
  amount,
  requesterName,
  autoPlay = true,
}: {
  amount?: number;
  requesterName?: string;
  autoPlay?: boolean;
}) {
  const { t } = useTranslation();
  const { instant } = useReveal();
  const sendAmount = amount && amount > 0 ? Math.min(amount, DEMO_BALANCE) : 5000;
  const [presses, setPresses] = useState(instant ? PIN_DIGITS : 0);
  const [playing, setPlaying] = useState(false);
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  const play = useCallback(() => {
    clear();
    if (instant) {
      setPresses(PIN_DIGITS);
      return;
    }
    setPresses(0);
    setPlaying(true);
    for (let i = 1; i <= PIN_DIGITS; i++) {
      timers.current.push(window.setTimeout(() => setPresses(i), 300 + i * PRESS_MS));
    }
    timers.current.push(
      window.setTimeout(() => setPlaying(false), 300 + (PIN_DIGITS + 1) * PRESS_MS),
    );
  }, [instant]);

  useEffect(() => {
    if (autoPlay) play();
    return clear;
  }, [autoPlay, play]);

  const done = presses >= PIN_DIGITS;
  const balance = balanceAfter(DEMO_BALANCE, sendAmount, presses);
  const activeKey =
    !done && playing
      ? SEQUENCE[presses]
      : presses > 0 && playing
        ? SEQUENCE[presses - 1]
        : undefined;
  const name = requesterName?.trim() || t('pin.requester');

  return (
    <div className="flex flex-col gap-5">
      <div className="relative flex items-center justify-between gap-3 rounded-card border border-glass-border bg-surface-2 p-4">
        <div>
          <p className="text-xs text-text-2">{t('pin.balance')}</p>
          <m.p
            key={balance}
            initial={instant ? false : { opacity: 0.4 }}
            animate={{ opacity: 1 }}
            className="font-mono text-xl font-semibold tabular-nums"
          >
            ₹{balance.toLocaleString('en-IN')}
          </m.p>
        </div>
        {/* rupees travel from your balance to the requester */}
        <div className="pointer-events-none absolute inset-y-0 left-[30%] right-[22%]" aria-hidden>
          <AnimatePresence>
            {!instant &&
              Array.from({ length: presses }, (_, i) => (
                <m.span
                  key={`coin-${i}`}
                  className="absolute top-1/2 -mt-3 grid size-6 place-items-center rounded-full bg-risk-scam-solid text-white"
                  initial={{ left: '0%', opacity: 0, scale: 0.6 }}
                  animate={{ left: '100%', opacity: [0, 1, 1, 0], scale: 1 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                >
                  <IndianRupee className="size-3.5" />
                </m.span>
              ))}
          </AnimatePresence>
        </div>
        <div className="flex flex-col items-center gap-1 text-center">
          <span
            className="grid size-10 place-items-center rounded-full bg-surface text-text-2"
            aria-hidden
          >
            <UserRound className="size-5" />
          </span>
          <span className="max-w-[7rem] truncate text-xs text-text-2">{t('pin.to', { name })}</span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[15rem]" role="img" aria-label={t('pin.padLabel')}>
        <div className="mb-4 flex justify-center gap-3" aria-hidden>
          {Array.from({ length: PIN_DIGITS }, (_, i) => (
            <span
              key={i}
              className={cn(
                'size-3.5 rounded-full border-2 border-text-2 transition-colors duration-150',
                i < presses && 'border-text bg-text',
              )}
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2" aria-hidden>
          {KEYS.map((k, i) =>
            k ? (
              <span
                key={i}
                className={cn(
                  'grid h-12 place-items-center rounded-card bg-surface-2 font-mono text-lg transition-[background-color,transform] duration-150',
                  activeKey === k && 'scale-95 bg-overlay/15',
                )}
              >
                {k}
              </span>
            ) : (
              <span key={i} />
            ),
          )}
        </div>
      </div>

      <AnimatePresence>
        {done && (
          <m.p
            initial={instant ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-xl leading-snug font-semibold text-balance sm:text-2xl"
            role="status"
          >
            {t('pin.final')}
          </m.p>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={play}
        disabled={playing}
        className="inline-flex min-h-10 items-center gap-2 self-center rounded-chip border border-glass-border px-3 text-sm text-text-2 hover:text-text disabled:opacity-50 outline-none focus-visible:outline-2 focus-visible:outline-brand"
      >
        <RotateCcw className="size-4" aria-hidden />
        {t('pin.replay')}
      </button>
    </div>
  );
}
