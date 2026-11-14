import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PagePlaceholder } from '@/components/PagePlaceholder';
import { buttonVariants } from '@/components/ui/button';

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <PagePlaceholder pageKey="notFound">
      <div className="flex flex-wrap gap-3">
        <Link to="/scan" className={buttonVariants()}>
          {t('placeholder.scanNow')}
        </Link>
        <Link to="/" className={buttonVariants({ variant: 'outline' })}>
          {t('placeholder.goHome')}
        </Link>
      </div>
    </PagePlaceholder>
  );
}
