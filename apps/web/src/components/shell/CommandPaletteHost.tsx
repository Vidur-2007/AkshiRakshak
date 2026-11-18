import { lazy, Suspense, useEffect, useState } from 'react';
import { isPaletteShortcut, usePalette } from './paletteStore';

// cmdk and the dialog load only when the palette is first opened.
const CommandPalette = lazy(() => import('./CommandPalette'));

/** Listens for Ctrl/Cmd+K everywhere and mounts the palette on first use. */
export function CommandPaletteHost() {
  const open = usePalette((s) => s.open);
  const toggle = usePalette((s) => s.toggle);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (open) setLoaded(true);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isPaletteShortcut(e)) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  if (!loaded) return null;
  return (
    <Suspense fallback={null}>
      <CommandPalette />
    </Suspense>
  );
}
