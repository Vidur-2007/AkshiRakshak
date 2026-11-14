import { m } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { AnalysisResult, Signal } from '@/lib/engine';
import { TONE_COLOR } from '@/lib/risk';
import { rangeTone } from '@/lib/spans';
import { SignalPopoverBody } from './HighlightedText';
import { REVEAL_MS, useReveal } from './reveal';

type Box = NonNullable<AnalysisResult['image']>['boxes'][number];

export interface FlaggedBox {
  box: Box;
  signals: Signal[];
  /** 0 = strongest */
  rank: number;
}

/** Boxes with at least one known signal, strongest first. */
export function flaggedBoxes(result: AnalysisResult): FlaggedBox[] {
  const byId = new Map(result.signals.map((s) => [s.id, s]));
  return (result.image?.boxes ?? [])
    .map((box) => ({
      box,
      signals: box.signalIds
        .map((id) => byId.get(id))
        .filter((s): s is Signal => !!s)
        .sort((a, b) => b.weight - a.weight),
    }))
    .filter((b) => b.signals.length > 0)
    .sort((a, b) => (b.signals[0]?.weight ?? 0) - (a.signals[0]?.weight ?? 0))
    .map((b, rank) => ({ ...b, rank }));
}

/** Percent position of a box over an image of the given size. */
export function boxStyle(b: Pick<Box, 'x' | 'y' | 'w' | 'h'>, width: number, height: number) {
  const pct = (v: number, of: number) =>
    `${of > 0 ? Math.max(0, Math.min(100, (v / of) * 100)) : 0}%`;
  return {
    left: pct(b.x, width),
    top: pct(b.y, height),
    width: pct(b.w, width),
    height: pct(b.h, height),
  };
}

/** The uploaded screenshot with boxes over flagged words, tappable like spans (M2.2). */
export function ScreenshotOverlay({ result, image }: { result: AnalysisResult; image: Blob }) {
  const { t } = useTranslation();
  const reveal = useReveal();
  const [url, setUrl] = useState<string | null>(null);
  const boxes = useMemo(() => flaggedBoxes(result), [result]);
  const width = result.image?.width ?? 0;
  const height = result.image?.height ?? 0;

  useEffect(() => {
    const u = URL.createObjectURL(image);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [image]);

  if (!url) return null;
  return (
    <div>
      <p className="mb-3 text-sm text-text-2">
        {boxes.length ? t('overlay.hint') : t('overlay.noBoxes')}
      </p>
      <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-card border border-glass-border">
        <img src={url} alt={t('overlay.title')} className="block h-auto w-full" />
        {boxes.map(({ box, signals, rank }) => {
          const tone = rangeTone({ weight: signals[0]?.weight ?? 0, signals });
          const color = TONE_COLOR[tone];
          return (
            <Popover key={`${box.start}-${box.x}-${box.y}`}>
              <PopoverTrigger asChild>
                <m.button
                  type="button"
                  aria-label={t('overlay.box', { text: box.text })}
                  className="absolute rounded-[4px] border-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  style={{
                    ...boxStyle(box, width, height),
                    borderColor: color,
                    background: `color-mix(in srgb, ${color} 18%, transparent)`,
                  }}
                  initial={{ opacity: reveal.instant ? 1 : 0, scale: reveal.instant ? 1 : 1.15 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={
                    reveal.instant
                      ? { duration: 0 }
                      : {
                          delay: reveal.delay(REVEAL_MS.underline + rank * REVEAL_MS.underlineGap),
                          duration: 0.3,
                        }
                  }
                />
              </PopoverTrigger>
              <PopoverContent align="start">
                <p className="mb-3 font-mono text-sm text-text-2">“{box.text}”</p>
                <SignalPopoverBody signals={signals} />
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </div>
  );
}
