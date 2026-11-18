import { ShieldCheck, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { maskPII, type AnalysisResult } from '@/lib/engine';

/** "Checked on this device in 84 ms · AI second opinion: off" (§5.3). */
export function PrivacyFooter({ result }: { result: AnalysisResult }) {
  const { t } = useTranslation();
  const ms = Math.max(1, Math.round(result.latencyMs));
  const provider = result.aiProvider === 'gemini' ? 'Gemini' : 'Groq';
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-2">
      <span className="inline-flex items-center gap-1.5">
        <ShieldCheck className="size-4 text-brand" aria-hidden />
        {t('analysis.privacyLocal', { ms })}
      </span>
      <span aria-hidden>·</span>
      <span className="inline-flex items-center gap-1.5">
        {result.aiUsed && <Sparkles className="size-4 text-ai" aria-hidden />}
        {result.aiUsed
          ? t('analysis.aiOn', { provider, n: maskPII(result.text).replacements })
          : t('analysis.aiOff')}
      </span>
    </p>
  );
}
