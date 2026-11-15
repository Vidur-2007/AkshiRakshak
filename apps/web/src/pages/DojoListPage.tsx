import { MessageCircle, MessageSquareText, Phone, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { usePageTitle } from '@/hooks/usePageTitle';
import { dojoScores } from '@/lib/db';
import { maxScore } from '@/lib/dojo';
import { categoryText, DRILLS, type Drill } from '@/lib/engine';
import { l10n } from '@/lib/l10n';
import { CATEGORY_ICON } from '@/lib/risk';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const CHANNEL_ICON: Record<Drill['channel'], typeof Phone> = {
  sms: MessageSquareText,
  whatsapp: MessageCircle,
  call: Phone,
};

/** Dojo list (§5.13): one card per drill with category, difficulty and best score. */
export default function DojoListPage() {
  const { t } = useTranslation();
  usePageTitle(t('page.dojo.title'));
  const lang = useAppStore((s) => s.lang);
  const [best, setBest] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    void dojoScores().then(setBest);
  }, []);
  return (
    <section
      aria-labelledby="page-title"
      className="mx-auto w-full max-w-5xl px-4 pt-8 sm:px-6 lg:pt-12"
    >
      <h1 id="page-title" className="text-xl font-semibold tracking-tight sm:text-2xl">
        {t('page.dojo.title')}
      </h1>
      <p className="mt-2 max-w-2xl text-text-2">{t('page.dojo.body')}</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {DRILLS.map((d) => {
          const Icon = CATEGORY_ICON[d.category];
          const Ch = CHANNEL_ICON[d.channel];
          const b = best.get(d.id);
          return (
            <li key={d.id}>
              <Link
                to={`/learn/dojo/${d.id}`}
                className="surface flex h-full flex-col gap-3 p-5 transition-colors hover:border-brand/40 outline-none focus-visible:outline-2 focus-visible:outline-brand"
              >
                <div className="flex items-center gap-2 text-sm text-text-2">
                  <Icon className="size-4" aria-hidden />
                  {categoryText(d.category, lang).name}
                  <span className="ml-auto inline-flex items-center gap-1">
                    <Ch className="size-4" aria-hidden />
                    {t(`channel.${d.channel}`)}
                  </span>
                </div>
                <h2 className="text-lg font-semibold">{l10n(d.title, lang)}</h2>
                <div className="mt-auto flex items-center justify-between gap-2 text-sm">
                  <span
                    className="inline-flex items-center gap-1"
                    aria-label={t('dojo.difficulty', { n: d.difficulty })}
                  >
                    {[1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={cn(
                          'size-2 rounded-full',
                          i <= d.difficulty ? 'bg-text' : 'bg-white/12',
                        )}
                        aria-hidden
                      />
                    ))}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-text-2">
                    {b !== undefined ? (
                      <>
                        <Trophy className="size-4 text-brand" aria-hidden />
                        {t('dojo.best', { score: `${b}/${maxScore(d)}` })}
                      </>
                    ) : (
                      t('dojo.notPlayed')
                    )}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
