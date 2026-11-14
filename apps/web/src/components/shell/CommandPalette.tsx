import { ClipboardPaste, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { UI_LANGS as LANGS } from '@/lib/langs';
import { useAppStore } from '@/lib/store';
import { ALL_DESTINATIONS, ElderIcon } from './nav';
import { usePalette, type ScanPrefillState } from './paletteStore';

/** Lazy-loaded by CommandPaletteHost. Ctrl/Cmd+K: jump to any route, paste-and-scan, switch language, toggle Elder mode (§4). */
export default function CommandPalette() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const open = usePalette((s) => s.open);
  const setOpen = usePalette((s) => s.setOpen);
  const elderMode = useAppStore((s) => s.elderMode);
  const toggleElderMode = useAppStore((s) => s.toggleElderMode);
  const setLang = useAppStore((s) => s.setLang);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  const pasteAndScan = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        toast(t('palette.clipboardEmpty'));
        return;
      }
      const state: ScanPrefillState = { prefill: text, autoScan: true };
      navigate('/scan', { state });
    } catch {
      toast(t('palette.clipboardDenied'));
      navigate('/scan');
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title={t('palette.title')}>
      <Command loop>
        <CommandInput placeholder={t('palette.placeholder')} />
        <CommandList>
          <CommandEmpty>{t('palette.empty')}</CommandEmpty>
          <CommandGroup heading={t('palette.groupActions')}>
            <CommandItem value="paste scan" onSelect={() => run(() => void pasteAndScan())}>
              <ClipboardPaste aria-hidden />
              {t('palette.pasteAndScan')}
            </CommandItem>
            <CommandItem value="elder mode simple" onSelect={() => run(toggleElderMode)}>
              <ElderIcon aria-hidden />
              {elderMode ? t('palette.elderOff') : t('palette.elderOn')}
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading={t('palette.groupGo')}>
            {ALL_DESTINATIONS.map((d) => (
              <CommandItem
                key={d.to}
                value={`${d.to} ${t(`nav.${d.key}`)}`}
                onSelect={() => run(() => navigate(d.to))}
              >
                <d.icon aria-hidden />
                {t(`nav.${d.key}`)}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading={t('palette.groupLanguage')}>
            {LANGS.map((l) => (
              <CommandItem
                key={l}
                value={`language ${l} ${t(`lang.${l}`)}`}
                onSelect={() => run(() => setLang(l))}
              >
                <Languages aria-hidden />
                <span lang={l}>{t(`lang.${l}`)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
