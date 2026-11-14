import { m } from 'motion/react';
import { useMemo, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Signal } from '@/lib/engine';
import { TONE_COLOR } from '@/lib/risk';
import { buildSegments, rangeTone, type FlaggedRange } from '@/lib/spans';
import { REVEAL_MS, useReveal } from './reveal';

function toneFor(signal: Signal) {
  return rangeTone({ weight: signal.weight, signals: [signal] });
}

/** Label and detail for every signal on a highlighted range. */
export function SignalPopoverBody({ signals }: { signals: Signal[] }) {
  const { t } = useTranslation();
  return (
    <ul className="flex flex-col gap-3">
      {signals.map((s) => (
        <li key={s.id} className="flex gap-2.5">
          <span
            className="mt-1.5 size-2 shrink-0 rounded-full"
            style={{ background: TONE_COLOR[toneFor(s)] }}
            aria-hidden
          />
          <span>
            <span className="block font-medium text-text">
              {s.weight < 0 && <span className="text-risk-safe">{t('analysis.reassuring')}: </span>}
              {s.label}
            </span>
            <span className="mt-0.5 block text-sm text-text-2">{s.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Flag({ text, range }: { text: string; range: FlaggedRange }) {
  const reveal = useReveal();
  const tone = rangeTone(range);
  const color = TONE_COLOR[tone];
  const tint = `color-mix(in srgb, ${color} 14%, transparent)`;
  const line = `linear-gradient(${color}, ${color})`;
  const fill = `linear-gradient(${tint}, ${tint})`;
  const onKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.currentTarget.click();
    }
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        {/* An inline span (not a button) so long phrases can wrap across lines */}
        <m.span
          role="button"
          tabIndex={0}
          aria-haspopup="dialog"
          onKeyDown={onKeyDown}
          className="cursor-pointer rounded-[3px] bg-no-repeat outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
          style={{ backgroundImage: `${fill}, ${line}`, backgroundPosition: '0 0, 0 100%' }}
          initial={{ backgroundSize: reveal.instant ? '100% 100%, 100% 2px' : '0% 100%, 0% 2px' }}
          animate={{ backgroundSize: '100% 100%, 100% 2px' }}
          transition={
            reveal.instant
              ? { duration: 0 }
              : {
                  delay: reveal.delay(REVEAL_MS.underline + range.rank * REVEAL_MS.underlineGap),
                  duration: 0.35,
                  ease: 'easeOut',
                }
          }
        >
          {text}
          <span className="sr-only"> ({range.signals.map((s) => s.label).join('; ')})</span>
        </m.span>
      </PopoverTrigger>
      <PopoverContent align="start">
        <SignalPopoverBody signals={range.signals} />
      </PopoverContent>
    </Popover>
  );
}

/**
 * The checked text with red-flag spans underlined by signal colour (§5.3).
 * Overlapping spans merge; tapping one lists every signal for that range.
 */
export function HighlightedText({
  text,
  signals,
  lang,
}: {
  text: string;
  signals: Signal[];
  lang?: string;
}) {
  const segments = useMemo(() => buildSegments(text, signals), [text, signals]);
  return (
    <p
      lang={lang}
      className="text-[1.0625rem] leading-[1.75] break-words whitespace-pre-wrap text-text"
    >
      {segments.map((seg) =>
        seg.kind === 'plain' ? (
          <span key={seg.start}>{seg.text}</span>
        ) : (
          <Flag key={seg.start} text={seg.text} range={seg.range} />
        ),
      )}
    </p>
  );
}
