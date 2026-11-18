import { Square, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Lang } from '@/lib/engine';
import { speak, speechSupported, stopSpeaking } from '@/lib/speech';
import { cn } from '@/lib/utils';

/** Reads the verdict and explanation aloud in the UI language (M1.14). */
export function ReadAloudButton({
  text,
  lang,
  autoPlayAfterMs,
  className,
}: {
  text: string;
  lang: Lang;
  /** start reading by itself after this delay (voice auto-read) */
  autoPlayAfterMs?: number;
  className?: string;
}) {
  const { t } = useTranslation();
  const [speaking, setSpeaking] = useState(false);
  const supported = speechSupported();
  const stopRef = useRef<() => void>(() => undefined);

  const start = useCallback(() => {
    setSpeaking(true);
    stopRef.current = speak(text, lang, () => setSpeaking(false));
  }, [text, lang]);

  useEffect(() => {
    if (!supported || autoPlayAfterMs === undefined) return;
    const id = window.setTimeout(start, autoPlayAfterMs);
    return () => window.clearTimeout(id);
  }, [supported, autoPlayAfterMs, start]);

  useEffect(() => () => stopSpeaking(), []);

  if (!supported) return null;
  return (
    <button
      type="button"
      aria-pressed={speaking}
      onClick={() => {
        if (speaking) {
          stopRef.current();
          setSpeaking(false);
        } else start();
      }}
      className={cn(
        'inline-flex min-h-10 items-center gap-2 rounded-chip border border-glass-border px-3 text-sm text-text-2 transition-colors duration-150 hover:text-text outline-none focus-visible:outline-2 focus-visible:outline-brand',
        speaking && 'border-brand/50 text-text',
        className,
      )}
    >
      {speaking ? (
        <Square className="size-4" aria-hidden />
      ) : (
        <Volume2 className="size-4" aria-hidden />
      )}
      {speaking ? t('analysis.stopReading') : t('analysis.readAloud')}
    </button>
  );
}
