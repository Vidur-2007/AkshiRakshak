import { Phone, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useRouteError } from 'react-router';
import { buttonVariants } from '@/components/ui/button';

/**
 * Shown instead of React Router's developer error page when a screen crashes. Plain words, a way
 * back, and the 1930 helpline, because someone may be in the middle of a scam when it happens.
 * The error goes to the console for debugging; nothing is sent anywhere.
 */
export function RouteError() {
  const { t } = useTranslation();
  const error = useRouteError();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main
      role="alert"
      className="mx-auto flex min-h-[70dvh] w-full max-w-xl flex-col justify-center gap-4 px-6 py-16"
    >
      <h1 className="text-2xl">{t('errors.title')}</h1>
      <p className="text-text-2">{t('errors.body')}</p>
      <div className="mt-2 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={buttonVariants({ size: 'lg' })}
        >
          <RotateCcw aria-hidden />
          {t('errors.reload')}
        </button>
        <Link to="/" reloadDocument className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          {t('errors.home')}
        </Link>
        <a href="tel:1930" className={buttonVariants({ variant: 'danger', size: 'lg' })}>
          <Phone aria-hidden />
          {t('errors.call1930')}
        </a>
      </div>
    </main>
  );
}
