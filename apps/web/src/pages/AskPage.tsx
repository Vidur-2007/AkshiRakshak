import { useTranslation } from 'react-i18next';
import { AskPanel } from '@/components/learn/AskPanel';
import { usePageTitle } from '@/hooks/usePageTitle';

/** Ask Akshi (§5.13, M11.3). */
export default function AskPage() {
  const { t } = useTranslation();
  usePageTitle(t('page.ask.title'));
  return (
    <section
      aria-labelledby="page-title"
      className="mx-auto flex w-full max-w-2xl flex-col px-4 pt-8 sm:px-6 lg:pt-12"
    >
      <h1 id="page-title" className="text-xl font-semibold tracking-tight sm:text-2xl">
        {t('page.ask.title')}
      </h1>
      <p className="mt-2 text-text-2">{t('page.ask.body')}</p>
      <div className="surface mt-6 p-4 sm:p-5">
        <AskPanel />
      </div>
    </section>
  );
}
