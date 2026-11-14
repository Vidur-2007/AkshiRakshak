import { Hammer } from 'lucide-react';
import { m } from 'motion/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '@/hooks/usePageTitle';
import { fadeUp, stagger } from '@/lib/motion';

/**
 * Phase 0 placeholder used by every route until its real screen lands.
 * `pageKey` picks page.<key>.title / .body from the locale files.
 */
export function PagePlaceholder({
  pageKey,
  phase,
  titleSuffix,
  children,
}: {
  pageKey: string;
  /** build phase that delivers the real screen (SPEC_B_WEB.md §1) */
  phase?: number;
  titleSuffix?: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const title = t(`page.${pageKey}.title`);
  usePageTitle(title);
  return (
    <m.section
      variants={stagger(0.06)}
      initial="hidden"
      animate="show"
      aria-labelledby="page-title"
      className="mx-auto w-full max-w-5xl px-4 pt-8 sm:px-6 lg:pt-12"
    >
      {phase !== undefined && (
        <m.p
          variants={fadeUp}
          className="inline-flex items-center gap-1.5 rounded-full border border-glass-border bg-surface px-3 py-1 text-xs font-medium text-text-2"
        >
          <Hammer className="size-3.5" aria-hidden />
          {t('placeholder.inProgress', { phase })}
        </m.p>
      )}
      <m.h1
        id="page-title"
        variants={fadeUp}
        className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl"
      >
        {title}
        {titleSuffix && <span className="font-mono text-text-2"> {titleSuffix}</span>}
      </m.h1>
      <m.p variants={fadeUp} className="mt-2 max-w-2xl text-base text-text-2">
        {t(`page.${pageKey}.body`)}
      </m.p>
      {children && (
        <m.div variants={fadeUp} className="mt-8">
          {children}
        </m.div>
      )}
    </m.section>
  );
}
