import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { detectDeviceTier } from '@/lib/deviceTier';
import { applyUrlFlags, useAppStore } from '@/lib/store';

/** Keeps <html> classes, online status, device tier and URL flags in sync with the store. */
export function useShellEffects(): void {
  const { search } = useLocation();
  const elderMode = useAppStore((s) => s.elderMode);
  const deviceTier = useAppStore((s) => s.deviceTier);

  // ?simple=1 and ?lang= work on any route
  useEffect(() => {
    if (search) applyUrlFlags(search);
  }, [search]);

  useEffect(() => {
    document.documentElement.classList.toggle('elder', elderMode);
  }, [elderMode]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('tier-high', 'tier-mid', 'tier-low');
    root.classList.add(`tier-${deviceTier}`);
  }, [deviceTier]);

  useEffect(() => {
    const { setOnline, setDeviceTier } = useAppStore.getState();
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    let mq: MediaQueryList | null = null;
    const onMotion = () => setDeviceTier(detectDeviceTier());
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      mq.addEventListener('change', onMotion);
    } catch {
      mq = null;
    }
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      mq?.removeEventListener('change', onMotion);
    };
  }, []);
}
