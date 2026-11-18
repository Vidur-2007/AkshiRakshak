import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/** Sets document.title to "<page> · Akshi Rakshak". */
export function usePageTitle(title: string): void {
  const { t } = useTranslation();
  const app = t('app.name');
  useEffect(() => {
    document.title = title && title !== app ? `${title} · ${app}` : `${app} — ${t('app.tagline')}`;
  }, [title, app, t]);
}
