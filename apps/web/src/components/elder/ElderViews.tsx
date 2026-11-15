import {
  CircleCheck,
  Hand,
  List,
  Phone,
  TriangleAlert,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { m } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ReadAloudButton } from '@/components/analysis/ReadAloudButton';
import { buttonVariants } from '@/components/ui/button';
import { telHref } from '@/lib/dashboard';
import { actionText, type AnalysisResult, type Verdict } from '@/lib/engine';
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
          data-tour="elder-verdict"
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
