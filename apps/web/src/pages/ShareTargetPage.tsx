import { useTranslation } from 'react-i18next';
import { Link, Navigate, useSearchParams } from 'react-router';
import type { ScanPrefillState } from '@/components/shell/paletteStore';
import { buttonVariants } from '@/components/ui/button';
import { usePageTitle } from '@/hooks/usePageTitle';
import { MAX_INPUT } from '@/lib/scan';

/** Joins the PWA share-target fields (title, text, url) into one scan input (§5.16). */
export function joinShared(params: URLSearchParams): string {
  return ['title', 'text', 'url']
    .map((k) => params.get(k)?.trim() ?? '')
    .filter((v, i, all) => v && all.indexOf(v) === i)
    .join('\n')
    .slice(0, MAX_INPUT);
}

/**
 * Android share target (M13.2): something shared from another app pre-fills Quick
 * Scan and runs the scan at once.
 */
export default function ShareTargetPage() {
  const { t } = useTranslation();
  usePageTitle(t('page.shareTarget.title'));
  const [params] = useSearchParams();
  const shared = joinShared(params);
  if (shared) {
    const state: ScanPrefillState = { prefill: shared, autoScan: true };
    return <Navigate to="/scan" replace state={state} />;
  }
  return (
    <section
      aria-labelledby="page-title"
      className="mx-auto w-full max-w-xl px-4 pt-8 sm:px-6 lg:pt-12"
    >
      <h1 id="page-title" className="text-xl font-semibold tracking-tight sm:text-2xl">
        {t('page.shareTarget.title')}
      </h1>
      <p className="mt-2 text-text-2">{t('page.shareTarget.body')}</p>
      <Link to="/scan" className={buttonVariants({ className: 'mt-6' })}>
        {t('placeholder.scanNow')}
      </Link>
    </section>
  );
}
