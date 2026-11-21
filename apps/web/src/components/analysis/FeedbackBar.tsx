import { LifeBuoy, ShieldAlert, ThumbsUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { getFeedback, removeFeedback, saveFeedback, type FeedbackRecord } from '@/lib/db';
import type { AnalysisResult } from '@/lib/engine';
import { flagged } from '@/lib/feedback';

/**
 * "Was Akshi right?" under a result: two answers, kept on this device with the check. The answer
 * never changes the verdict or trains anything; Settings shows a summary and can download them.
 */
export function FeedbackBar({
  result,
}: {
  result: Pick<AnalysisResult, 'id' | 'verdict' | 'riskScore' | 'kind'>;
}) {
  const { t } = useTranslation();
  // undefined while loading, null when there is no answer yet
  const [saved, setSaved] = useState<FeedbackRecord | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void getFeedback(result.id).then((f) => {
      if (live) setSaved(f ?? null);
    });
    return () => {
      live = false;
    };
  }, [result.id]);

  const choose = async (label: FeedbackRecord['label']) => {
    const rec: FeedbackRecord = {
      scanId: result.id,
      at: new Date().toISOString(),
      label,
      verdict: result.verdict,
      riskScore: result.riskScore,
      kind: result.kind,
    };
    try {
      await saveFeedback(rec);
    } catch {
      /* storage unavailable: the thanks still shows; nothing is kept */
    }
    setSaved(rec);
  };
  const change = async () => {
    try {
      await removeFeedback(result.id);
    } catch {
      /* nothing kept to remove */
    }
    setSaved(null);
  };

  if (saved === undefined) return null;
  if (!saved)
    return (
      <div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('feedback.title')}>
          <button
            type="button"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
            onClick={() => void choose('scam')}
          >
            <ShieldAlert aria-hidden />
            {t('feedback.scam')}
          </button>
          <button
            type="button"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
            onClick={() => void choose('legit')}
          >
            <ThumbsUp aria-hidden />
            {t('feedback.legit')}
          </button>
        </div>
        <p className="mt-2 text-xs text-text-2">{t('feedback.privacy')}</p>
      </div>
    );

  const agreed = (saved.label === 'scam') === flagged(saved);
  const missed = !agreed && saved.label === 'scam';
  return (
    <div role="status">
      <p className="text-sm text-text">
        {t(saved.label === 'scam' ? 'feedback.savedScam' : 'feedback.savedLegit')}{' '}
        {agreed ? t('feedback.agreed') : missed ? t('feedback.missed') : t('feedback.falseAlarm')}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {missed && (
          <Link to="/sos" className={buttonVariants({ variant: 'danger', size: 'sm' })}>
            <LifeBuoy aria-hidden />
            {t('links.help')}
          </Link>
        )}
        <button
          type="button"
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          onClick={() => void change()}
        >
          {t('feedback.change')}
        </button>
      </div>
    </div>
  );
}
