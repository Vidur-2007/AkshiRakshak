import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { PagePlaceholder } from '@/components/PagePlaceholder';
import type { ScanPrefillState } from '@/components/shell/paletteStore';
import { buttonVariants } from '@/components/ui/button';

/** Joins the PWA share-target fields (title, text, url) into one scan input (§5.16). */
export function joinShared(params: URLSearchParams): string {
  return ['title', 'text', 'url']
    .map((k) => params.get(k)?.trim() ?? '')
    .filter((v, i, all) => v && all.indexOf(v) === i)
    .join('\n');
}

export default function ShareTargetPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const shared = joinShared(params);
  const state: ScanPrefillState = { prefill: shared, autoScan: true };
  return (
    <PagePlaceholder pageKey="shareTarget" phase={4}>
      {shared && (
        <div className="surface flex flex-col gap-4 p-4">
          <p className="line-clamp-6 break-words whitespace-pre-wrap">{shared}</p>
          <Link to="/scan" state={state} className={buttonVariants({ className: 'self-start' })}>
            {t('placeholder.scanNow')}
          </Link>
        </div>
      )}
    </PagePlaceholder>
  );
}
