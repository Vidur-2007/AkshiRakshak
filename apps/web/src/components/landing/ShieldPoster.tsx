import { LogoMark } from '@/components/shell/Logo';
import type { Verdict } from '@/lib/engine';
import { VERDICT_COLOR } from '@/lib/risk';
import { cn } from '@/lib/utils';

/** Static ShieldCore poster: low tier, reduced motion, Elder mode, and the first paint (§5.1, §7). */
export function ShieldPoster({
  className,
  settle = null,
}: {
  className?: string;
  settle?: Verdict | null;
}) {
  const color = settle ? VERDICT_COLOR[settle] : 'var(--brand)';
  return (
    <div className={cn('relative grid place-items-center', className)} aria-hidden>
      <div
        className="absolute inset-[12%] rounded-full blur-3xl transition-colors duration-500"
        style={{ background: `color-mix(in srgb, ${color} 18%, transparent)` }}
      />
      <div
        className="absolute inset-[18%] rounded-full border"
        style={{ borderColor: `color-mix(in srgb, ${color} 25%, transparent)` }}
      />
      <div
        className="absolute inset-[30%] rounded-full border"
        style={{ borderColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
      />
      <LogoMark className="relative size-[28%] drop-shadow-[0_0_24px_rgb(61_224_255/0.35)]" />
    </div>
  );
}
