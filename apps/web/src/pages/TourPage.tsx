import { Play, WifiOff } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { usePageTitle } from '@/hooks/usePageTitle';
import { TOUR_STEPS, useTour } from '@/lib/tour';

/** Judge tour intro (§5.17). `/tour?start=1` (the landing hero link) starts at once. */
export default function TourPage() {
  const { t } = useTranslation();
  usePageTitle(t('page.tour.title'));
  const start = useTour((s) => s.start);
  const [params] = useSearchParams();
  const started = useRef(false);
  useEffect(() => {
    if (params.get('start') === '1' && !started.current) {
      started.current = true;
      start();
    }
  }, [params, start]);

  return (
    <section
      aria-labelledby="page-title"
      className="mx-auto w-full max-w-2xl px-4 pt-8 sm:px-6 lg:pt-12"
    >
      <h1 id="page-title" className="text-xl font-semibold tracking-tight sm:text-2xl">
        {t('page.tour.title')}
      </h1>
      <p className="mt-2 text-text-2">{t('page.tour.body')}</p>

      <ol className="surface mt-6 flex flex-col gap-3 p-5 sm:p-6">
        {TOUR_STEPS.map((s, i) => (
          <li key={s.id} className="flex gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 font-mono text-sm text-text-2">
              {i + 1}
            </span>
            <span className="pt-0.5">{t(`tour.steps.${s.id}.title`)}</span>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button type="button" onClick={start} className={buttonVariants({ size: 'lg' })}>
          <Play aria-hidden />
          {t('tour.start')}
        </button>
        <p className="inline-flex items-center gap-2 text-sm text-text-2">
          <WifiOff className="size-4" aria-hidden />
          {t('tour.offline')}
        </p>
      </div>
    </section>
  );
}
