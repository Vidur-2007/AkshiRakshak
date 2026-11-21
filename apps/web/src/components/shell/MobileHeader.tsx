import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Logo } from './Logo';
import { usePalette } from './paletteStore';
import { SosFab } from './SosButton';

/** Mobile header (< lg). Sticky, so the SOS button stays pinned top-right on every screen. */
export function MobileHeader() {
  const { t } = useTranslation();
  const openPalette = usePalette((s) => s.setOpen);
  return (
    <header
      data-shell-header
      className="sticky top-0 z-40 border-b border-glass-border bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:hidden"
    >
      <div className="flex h-topbar items-center gap-2 px-4">
        <Logo />
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => openPalette(true)}
            aria-label={t('shell.openPalette')}
            className="inline-flex size-tap items-center justify-center rounded-chip text-text-2 hover:text-text outline-none focus-visible:outline-2 focus-visible:outline-brand"
          >
            <Search className="size-5" aria-hidden />
          </button>
          <SosFab />
        </div>
      </div>
    </header>
  );
}
