/**
 * Live listen sheet (M1.15, P2): put a call on speaker; speech turns into text in
 * the browser, the engine's live listener scores it on this device, and each new
 * call danger ("they asked for your OTP") raises one alert. "Check this transcript"
 * runs the full scan on what was heard.
 */
import { Ear, Mic, MicOff, ScanSearch, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LiveRiskMeter } from '@/components/landing/LiveRiskMeter';
import { buttonVariants } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import type { ListenAlert, LiveListener, LiveScore } from '@/lib/engine';
import { loadEngine } from '@/lib/engineLoader';
import { startListening, type ListenError, type Listening } from '@/lib/listen';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export default function ListenSheet({
  open,
  onOpenChange,
  onScan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (transcript: string) => void;
}) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const online = useAppStore((s) => s.online);
  const haptics = useAppStore((s) => s.haptics);
  const [listening, setListening] = useState(false);
  const [finals, setFinals] = useState('');
  const [interim, setInterim] = useState('');
  const [score, setScore] = useState<LiveScore | null>(null);
  const [alerts, setAlerts] = useState<ListenAlert[]>([]);
  const [error, setError] = useState<ListenError | null>(null);
  const session = useRef<Listening | null>(null);
  const listener = useRef<LiveListener | null>(null);

  const stop = useCallback(() => {
    session.current?.stop();
    session.current = null;
    setListening(false);
    setInterim('');
  }, []);

  const start = async () => {
    setError(null);
    const engine = await loadEngine();
    if (!engine.createLiveListener) {
      setError('unsupported');
      return;
    }
    listener.current = engine.createLiveListener(lang);
    setFinals('');
    setInterim('');
    setScore(null);
    setAlerts([]);
    setListening(true);
    session.current = startListening(
      lang,
      (text, isFinal) => {
        const u = listener.current?.push(text, isFinal);
        if (!u) return;
        setScore(u.score);
        if (isFinal) {
          setFinals((f) => `${f} ${text}`.trim());
          setInterim('');
        } else setInterim(text);
        if (u.alerts.length) {
          setAlerts((a) => [...u.alerts, ...a]);
          if (haptics) navigator.vibrate?.([120, 60, 120]);
        }
      },
      (e) => {
        setError(e);
        stop();
      },
    );
  };

  // stop the microphone when the sheet closes or the page goes away
  useEffect(() => {
    if (!open) stop();
  }, [open, stop]);
  useEffect(() => () => session.current?.stop(), []);

  const transcript = `${finals} ${interim}`.trim();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto flex max-h-[90dvh] max-w-2xl flex-col gap-4">
        <SheetTitle className="pr-10">{t('listen.title')}</SheetTitle>
        <SheetDescription>{t('listen.body')}</SheetDescription>

        <p
          role="note"
          className="rounded-card border border-glass-border bg-surface px-3 py-2 text-sm text-text-2"
        >
          {t('listen.privacy')}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {listening ? (
            <button
              type="button"
              onClick={stop}
              className={buttonVariants({ variant: 'danger', size: 'lg' })}
            >
              <MicOff aria-hidden />
              {t('listen.stop')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void start()}
              disabled={!online}
              className={buttonVariants({ size: 'lg' })}
            >
              <Mic aria-hidden />
              {t('listen.start')}
            </button>
          )}
          {listening && (
            <span className="inline-flex items-center gap-2 text-sm text-text-2" role="status">
              <Ear className="size-4 animate-pulse text-brand" aria-hidden />
              {t('listen.listening')}
            </span>
          )}
          {!online && <span className="text-sm text-text-2">{t('listen.needsInternet')}</span>}
        </div>

        {error && (
          <p role="alert" className="text-sm text-text">
            {t(`listen.error.${error}`)}
          </p>
        )}

        <LiveRiskMeter live={score} />

        {alerts.length > 0 && (
          <ul className="flex flex-col gap-2" aria-label={t('listen.alertsTitle')}>
            {alerts.map((a) => (
              <li
                key={a.id}
                role="alert"
                className="flex gap-3 rounded-card border border-risk-scam/50 bg-risk-scam/10 p-3"
              >
                <TriangleAlert className="mt-0.5 size-5 shrink-0 text-risk-scam" aria-hidden />
                <div className="min-w-0">
                  <p className="font-semibold">{a.label}</p>
                  <p className="text-sm">{t('listen.hangUp')}</p>
                  {a.phrase && (
                    <p className="mt-1 text-sm text-text-2">
                      {t('listen.heard', { phrase: a.phrase })}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="min-h-20 overflow-y-auto rounded-card border border-glass-border bg-surface-2 p-3 text-sm">
          {transcript ? (
            <p>
              {finals} <span className={cn('text-text-2', interim && 'italic')}>{interim}</span>
            </p>
          ) : (
            <p className="text-text-2">{t('listen.empty')}</p>
          )}
        </div>

        {!listening && finals && (
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onScan(finals);
            }}
            className={buttonVariants({ variant: 'outline' })}
          >
            <ScanSearch aria-hidden />
            {t('listen.check')}
          </button>
        )}
      </SheetContent>
    </Sheet>
  );
}
