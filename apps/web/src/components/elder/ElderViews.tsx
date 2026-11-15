import {
  CircleCheck,
  Hand,
  ImageUp,
  List,
  Phone,
  QrCode,
  ScanLine,
  TriangleAlert,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { m } from 'motion/react';
import { useId, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ReadAloudButton } from '@/components/analysis/ReadAloudButton';
import { StageTicker } from '@/components/scan/StageTicker';
import { buttonVariants } from '@/components/ui/button';
import { telHref } from '@/lib/dashboard';
import { actionText, type AnalysisResult, type Verdict } from '@/lib/engine';
import { MAX_INPUT } from '@/lib/scan';
import { TEXT_STAGES, type TickerState } from '@/lib/scanTiming';
import { VERDICT_COLOR } from '@/lib/risk';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const ELDER_ICON: Record<Verdict, LucideIcon> = {
  scam: Hand,
  suspicious: TriangleAlert,
  no_signs: CircleCheck,
};

const bigBtn =
  'inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-card px-6 text-xl font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

/** Elder mode Quick Scan (§5.10): one big input, one big Scan button, screenshot, QR. */
export function ElderScan({
  text,
  setText,
  onSubmit,
  busy,
  ticker,
  onScreenshot,
  onQr,
}: {
  text: string;
  setText: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  ticker: TickerState;
  onScreenshot: () => void;
  onQr: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };
  return (
    <section
      aria-labelledby="page-title"
      className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 pt-8"
    >
      <h1 id="page-title" className="text-2xl font-semibold">
        {t('elder.title')}
      </h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label htmlFor={id} className="text-lg">
          {t('scan.inputLabel')}
        </label>
        <textarea
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          maxLength={MAX_INPUT}
          placeholder={t('scan.placeholder')}
          className="w-full resize-y rounded-card border-2 border-glass-border bg-surface p-4 text-xl leading-relaxed text-text outline-none focus-visible:border-brand"
        />
        <button
          type="submit"
          disabled={!text.trim() || busy}
          className={cn(bigBtn, 'bg-brand text-brand-contrast disabled:opacity-50')}
        >
          <ScanLine className="size-7" aria-hidden />
          {busy ? t('scan.scanning') : t('elder.scan')}
        </button>
      </form>
      {busy && <StageTicker state={ticker} stages={TEXT_STAGES} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onScreenshot}
          className={cn(bigBtn, 'border-2 border-glass-border bg-surface-2 text-text')}
        >
          <ImageUp className="size-6" aria-hidden />
          {t('scan.uploadScreenshot')}
        </button>
        <button
          type="button"
          onClick={onQr}
          className={cn(bigBtn, 'border-2 border-glass-border bg-surface-2 text-text')}
        >
          <QrCode className="size-6" aria-hidden />
          {t('scan.scanQr')}
        </button>
      </div>
    </section>
  );
}

export function firstSentence(text: string): string {
  const m1 = /^(.+?[.!?।])(\s|$)/u.exec(text.trim());
  return (m1?.[1] ?? text).trim();
}

/**
 * Full-screen Elder verdict (§5.10): STOP / CAREFUL / No warning signs found, one
 * sentence, the single most important action, and "Call my family".
 */
export function ElderVerdict({
  result,
  fresh,
  onDetails,
}: {
  result: AnalysisResult;
  fresh: boolean;
  onDetails: () => void;
}) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const contact = useAppStore((s) => s.trustedContact);
  const voiceAuto = useAppStore((s) => s.voiceAuto);
  const Icon = ELDER_ICON[result.verdict];
  const color = VERDICT_COLOR[result.verdict];
  const word = t(`elderVerdict.${result.verdict}`);
  const sentence = firstSentence(result.explanation);
  const firstAction = result.actions.find((a) => a !== 'no_action_needed');
  const action = firstAction ? actionText(firstAction, lang) : null;
  const tel = contact ? telHref(contact.phone) : null;
  return (
    <section
      aria-labelledby="elder-verdict"
      className="min-h-[calc(100dvh-var(--topbar-h))]"
      style={{ background: `color-mix(in srgb, ${color} 14%, var(--bg))` }}
    >
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 px-4 pt-10 pb-12 text-center">
        <m.span
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="grid size-32 place-items-center rounded-full"
          style={{ background: color }}
        >
          <Icon className="size-20 text-bg" strokeWidth={2.5} aria-hidden />
        </m.span>
        <h1
          id="elder-verdict"
          className="text-[clamp(2.75rem,12vw,5rem)] leading-none font-bold tracking-tight"
          style={{ color }}
        >
          {word}
        </h1>
        <p className="text-xl leading-relaxed text-text">{sentence}</p>
        {action && (
          <div
            className="w-full rounded-card border-2 bg-surface p-5 text-left"
            style={{ borderColor: color }}
          >
            {action.href ? (
              <a
                href={action.href}
                {...(/^https?:/.test(action.href)
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
                className="text-xl font-semibold underline underline-offset-4"
              >
                {action.label}
              </a>
            ) : (
              <p className="text-xl font-semibold">{action.label}</p>
            )}
            <p className="mt-2 text-lg text-text-2">{action.body}</p>
          </div>
        )}
        {tel && contact ? (
          <a href={tel} className={cn(bigBtn, 'bg-text text-bg')}>
            <Phone className="size-6" aria-hidden />
            {t('elder.callFamily', { name: contact.name || t('settings.contactTitle') })}
          </a>
        ) : (
          <div className="flex w-full flex-col items-center gap-2">
            <p className="text-text-2">{t('elder.noContact')}</p>
            <Link to="/settings" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              <UserPlus aria-hidden />
              {t('elder.setContact')}
            </Link>
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <ReadAloudButton
            className="min-h-tap text-base"
            text={`${word}. ${sentence}${action ? ` ${action.label}. ${action.body}` : ''}`}
            lang={lang}
            {...(fresh && voiceAuto ? { autoPlayAfterMs: 300 } : {})}
          />
          <button
            type="button"
            onClick={onDetails}
            className={buttonVariants({ variant: 'outline', className: 'min-h-tap text-base' })}
          >
            <List aria-hidden />
            {t('elder.details')}
          </button>
        </div>
      </div>
    </section>
  );
}
