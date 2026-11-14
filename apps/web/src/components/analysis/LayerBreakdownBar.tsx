import { m } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { LayerContribution } from '@/lib/engine';
import { cn } from '@/lib/utils';
import { REVEAL_MS, useRevealTransition } from './reveal';

const ORDER: LayerContribution['layer'][] = ['rules', 'model', 'links', 'upi', 'indicators', 'ai'];

// Layer colours are not risk colours (§3): brand shades, and --ai for the LLM.
const LAYER_COLOR: Record<LayerContribution['layer'], string> = {
  rules: 'var(--brand)',
  model: 'color-mix(in srgb, var(--brand) 70%, var(--surface-2))',
  links: 'color-mix(in srgb, var(--brand) 48%, var(--surface-2))',
  upi: 'color-mix(in srgb, var(--brand) 32%, var(--surface-2))',
  indicators: 'var(--text-2)',
  ai: 'var(--ai)',
};

export type LayerStatus = { kind: 'share'; pct: number } | { kind: 'off' | 'offline' | 'unused' };

export function layerStatus(
  l: LayerContribution,
  ctx: { online: boolean; aiUsed: boolean },
): LayerStatus {
  if (l.available) return { kind: 'share', pct: Math.round(l.share * 100) };
  if (l.layer === 'ai') return { kind: ctx.online || ctx.aiUsed ? 'off' : 'offline' };
  if (l.layer === 'model') return { kind: 'off' };
  return { kind: 'unused' };
}

/** "How we decided" (M1.9): share of the final score per layer; unavailable layers greyed. */
export function LayerBreakdownBar({
  layers,
  online,
  aiUsed,
}: {
  layers: LayerContribution[];
  online: boolean;
  aiUsed: boolean;
}) {
  const { t } = useTranslation();
  const tr = useRevealTransition();
  const sorted = ORDER.map((name) => layers.find((l) => l.layer === name)).filter(
    (l): l is LayerContribution => !!l,
  );
  const visible = sorted.filter((l) => l.available && l.share > 0);
  const total = visible.reduce((sum, l) => sum + l.share, 0) || 1;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-white/6" aria-hidden>
        {visible.map((l, i) => (
          <m.div
            key={l.layer}
            className={cn('h-full', i > 0 && 'border-l-2 border-surface')}
            style={{ background: LAYER_COLOR[l.layer], originX: 0 }}
            initial={{ width: 0 }}
            animate={{ width: `${(l.share / total) * 100}%` }}
            transition={tr(REVEAL_MS.reasons + i * 80, 0.6)}
          />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
        {sorted.map((l) => {
          const s = layerStatus(l, { online, aiUsed });
          const label = t(`analysis.layer.${l.layer}`);
          return (
            <li
              key={l.layer}
              className={cn(
                'flex items-center gap-2 text-sm',
                s.kind !== 'share' && 'text-text-2/70',
              )}
            >
              <span
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{
                  background: s.kind === 'share' ? LAYER_COLOR[l.layer] : 'rgba(255,255,255,0.12)',
                }}
                aria-hidden
              />
              <span className={s.kind === 'share' ? 'text-text' : undefined}>{label}</span>
              <span className="ml-auto font-mono text-xs">
                {s.kind === 'share'
                  ? `${s.pct}%`
                  : s.kind === 'off'
                    ? t('analysis.layerOff')
                    : s.kind === 'offline'
                      ? t('analysis.layerOffline')
                      : t('analysis.layerUnused')}
              </span>
              {s.kind === 'share' && (
                <span className="sr-only">{t('analysis.layerShare', { pct: s.pct })}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
