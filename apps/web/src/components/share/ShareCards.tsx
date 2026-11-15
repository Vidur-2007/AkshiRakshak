/**
 * Share cards (§5.15, M7.2, M11.2): 1080×1350 cards in the UI language, rendered
 * off-screen and turned into a PNG only when the user shares. Sizes are in px, not
 * rem, so Elder mode's larger root font does not change the image.
 */
import { Share2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { LogoMark } from '@/components/shell/Logo';
import { buttonVariants } from '@/components/ui/button';
import { actionText, categoryText, type AnalysisResult, type Lang } from '@/lib/engine';
import { maskUpi, maskUrl, nodeToPng, shareOrDownload } from '@/lib/share';
import { VERDICT_COLOR } from '@/lib/risk';
import { cn } from '@/lib/utils';

export const CARD_W = 1080;
export const CARD_H = 1350;

/** The scam's details, masked; never the user's own (we only ever have the scam's). */
export function maskedDetails(result: AnalysisResult, max = 2): string[] {
  const upis = [
    ...result.entities.upiIds.map((u) => u.raw),
    ...(result.qr?.pa ? [result.qr.pa] : []),
  ].map(maskUpi);
  const links = result.entities.urls.filter((u) => !u.isOfficial).map((u) => maskUrl(u.raw));
  return [...new Set([...upis, ...links])].slice(0, max);
}

function CardFrame({ children, accent }: { children: ReactNode; accent: string }) {
  const { t } = useTranslation();
  const host = typeof window !== 'undefined' ? window.location.host : '';
  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        background: `radial-gradient(70% 45% at 50% 0%, color-mix(in srgb, ${accent} 22%, transparent), transparent 70%), #05070b`,
        color: '#e8eef6',
        fontFamily:
          "'Geist Sans','Noto Sans Devanagari','Noto Sans Telugu','Noto Sans Bengali',sans-serif",
        padding: 88,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 36, fontWeight: 600 }}
      >
        <LogoMark className="size-[64px]" />
        {t('app.name')}
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 40,
        }}
      >
        {children}
      </div>
      <div
        style={{
          borderTop: '2px solid rgba(255,255,255,0.12)',
          paddingTop: 32,
          fontSize: 30,
          color: '#93a1b5',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>{t('share.checkedWith')}</span>
        <span style={{ fontFamily: "'Geist Mono',monospace" }}>{host}</span>
      </div>
    </div>
  );
}

export function AnalysisShareCard({ result, lang }: { result: AnalysisResult; lang: Lang }) {
  const { t } = useTranslation();
  const color = VERDICT_COLOR[result.verdict];
  const flags = result.signals.filter((s) => s.weight > 0).slice(0, 2);
  const first = result.actions.find((a) => a !== 'no_action_needed') ?? result.actions[0];
  const details = maskedDetails(result);
  return (
    <CardFrame accent={color}>
      <div>
        <div style={{ fontSize: 132, fontWeight: 700, lineHeight: 1, color }}>
          {t(`verdict.${result.verdict}`)}
        </div>
        {result.category && (
          <div style={{ fontSize: 44, marginTop: 24 }}>
            {categoryText(result.category, lang).name}
          </div>
        )}
      </div>
      {flags.length > 0 && (
        <div>
          <div
            style={{ fontSize: 28, color: '#93a1b5', textTransform: 'uppercase', letterSpacing: 2 }}
          >
            {t('share.redFlags')}
          </div>
          {flags.map((f) => (
            <div
              key={f.id}
              style={{
                fontSize: 42,
                marginTop: 14,
                display: 'flex',
                gap: 18,
                alignItems: 'center',
              }}
            >
              <span
                style={{ width: 18, height: 18, borderRadius: 9, background: color, flexShrink: 0 }}
              />
              {f.label}
            </div>
          ))}
        </div>
      )}
      {details.length > 0 && (
        <div style={{ fontFamily: "'Geist Mono',monospace", fontSize: 36, color: '#93a1b5' }}>
          {details.join('   ·   ')}
        </div>
      )}
      {first && (
        <div style={{ background: '#111826', borderRadius: 32, padding: 40 }}>
          <div
            style={{ fontSize: 28, color: '#93a1b5', textTransform: 'uppercase', letterSpacing: 2 }}
          >
            {t('share.advice')}
          </div>
          <div style={{ fontSize: 44, fontWeight: 600, marginTop: 12 }}>
            {actionText(first, lang).label}
          </div>
        </div>
      )}
    </CardFrame>
  );
}

export function DojoShareCard({
  title,
  score,
  max,
  caught,
}: {
  title: string;
  score: number;
  max: number;
  caught: string[];
}) {
  const { t } = useTranslation();
  return (
    <CardFrame accent="#3de0ff">
      <div style={{ fontSize: 40, color: '#93a1b5' }}>{t('share.dojoTitle')}</div>
      <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>{title}</div>
      <div
        style={{
          fontFamily: "'Geist Mono',monospace",
          fontSize: 140,
          fontWeight: 600,
          color: '#3de0ff',
        }}
      >
        {score}
        <span style={{ fontSize: 60, color: '#93a1b5' }}> / {max}</span>
      </div>
      {caught.length > 0 && (
        <div>
          <div
            style={{ fontSize: 28, color: '#93a1b5', textTransform: 'uppercase', letterSpacing: 2 }}
          >
            {t('dojo.caught')}
          </div>
          {caught.slice(0, 3).map((c) => (
            <div key={c} style={{ fontSize: 40, marginTop: 12 }}>
              ✓ {c}
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 32, color: '#93a1b5' }}>{t('share.practised')}</div>
    </CardFrame>
  );
}

/**
 * Renders `card` off-screen on demand, converts it to PNG and shares or downloads it.
 * Falls back to `onFallback` (e.g. a text share) when the image cannot be made.
 */
export function ShareImageButton({
  card,
  filename,
  text,
  label,
  className,
  onFallback,
}: {
  card: ReactNode;
  filename: string;
  text: string;
  label?: string;
  className?: string;
  onFallback?: () => void;
}) {
  const { t } = useTranslation();
  const [rendering, setRendering] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rendering) return;
    let cancelled = false;
    void (async () => {
      try {
        await document.fonts?.ready;
        const node = ref.current;
        if (!node || cancelled) return;
        const blob = await nodeToPng(node, CARD_W, CARD_H);
        const how = await shareOrDownload(blob, filename, text);
        if (how === 'downloaded') toast(t('share.downloaded'));
      } catch {
        if (onFallback) onFallback();
        else toast(t('share.failed'));
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rendering, filename, text, onFallback, t]);

  return (
    <>
      <button
        type="button"
        disabled={rendering}
        onClick={() => setRendering(true)}
        className={cn(buttonVariants({ variant: 'outline' }), className)}
      >
        <Share2 aria-hidden />
        {rendering ? t('share.preparing') : (label ?? t('share.button'))}
      </button>
      {rendering &&
        createPortal(
          <div
            aria-hidden
            style={{ position: 'fixed', left: -20000, top: 0, pointerEvents: 'none' }}
          >
            <div ref={ref}>{card}</div>
          </div>,
          document.body,
        )}
    </>
  );
}
