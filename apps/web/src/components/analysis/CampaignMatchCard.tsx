import { FlaskConical, Globe, Network, Phone, Wallet, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { matchCampaign, type CampaignMatch, type SharedDetail } from '@/lib/campaignMatch';
import { categoryText, loadCampaignSamples, type AnalysisResult, type Lang } from '@/lib/engine';

const DETAIL_ICON: Record<SharedDetail['type'], LucideIcon> = {
  domain: Globe,
  phone: Phone,
  upi: Wallet,
};

/** The Campaign Match for a result, once the sample data has loaded (null until then, or none). */
export function useCampaignMatch(result: AnalysisResult): CampaignMatch | null {
  const [match, setMatch] = useState<CampaignMatch | null>(null);
  useEffect(() => {
    setMatch(null);
    if (result.verdict === 'no_signs') return;
    let live = true;
    loadCampaignSamples()
      .then((data) => {
        if (live) setMatch(matchCampaign(result, data));
      })
      .catch(() => {
        /* the chunk failed to load (offline before it was cached): the card is simply not shown */
      });
    return () => {
      live = false;
    };
  }, [result]);
  return match;
}

/**
 * "You're not the only one": the campaign a checked message belongs to, how many messages of its
 * kind are in Akshi's sample dataset, the closest example, and a link to that campaign on the
 * Network view. Everything here is labelled as sample data.
 */
export function CampaignMatchCard({ match, lang }: { match: CampaignMatch; lang: Lang }) {
  const { t } = useTranslation();
  const kind = categoryText(match.category, lang).name;
  const campaign = match.campaign
    ? t(`campaigns.${match.campaign}`, { defaultValue: match.campaign })
    : null;
  return (
    <div>
      <p className="flex items-baseline gap-3">
        <span className="font-serif text-5xl leading-none text-text tabular-nums">
          {match.messages}
        </span>
        <span className="text-sm text-text-2">
          {t('campaign.count', { langs: match.langs, kind })}
        </span>
      </p>

      <p className="mt-4 text-text">
        {match.shared.length > 0
          ? t('campaign.shares', { campaign })
          : campaign
            ? t('campaign.looksLike', { campaign })
            : t('campaign.knownKind', { kind })}
      </p>
      {match.shared.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2" aria-label={t('campaign.sharedLabel')}>
          {match.shared.map((d) => {
            const Icon = DETAIL_ICON[d.type];
            return (
              <li
                key={d.value}
                className="inline-flex items-center gap-1.5 rounded-chip border border-risk-scam/40 bg-risk-scam/10 px-2.5 py-1 font-mono text-xs break-all text-text"
              >
                <Icon className="size-3.5 shrink-0 text-risk-scam" aria-hidden />
                {d.value}
              </li>
            );
          })}
        </ul>
      )}

      {match.closest && (
        <figure className="mt-4 rounded-card border border-glass-border bg-surface-2 p-3">
          <figcaption className="text-xs font-medium tracking-wide text-text-2 uppercase">
            {t('campaign.closest')}
          </figcaption>
          <blockquote lang={match.closest.lang} className="mt-1.5 text-sm text-text">
            “{match.closest.text}”
          </blockquote>
        </figure>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        {/* the Network wall lights up this kind of scam among the others */}
        <Link
          to={`/network?category=${encodeURIComponent(match.category)}`}
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
        >
          <Network aria-hidden />
          {t('campaign.seeNetwork')}
        </Link>
        <p className="inline-flex items-center gap-1.5 text-xs text-text-2">
          <FlaskConical className="size-3.5 shrink-0" aria-hidden />
          {t('campaign.sample')}
        </p>
      </div>
    </div>
  );
}
