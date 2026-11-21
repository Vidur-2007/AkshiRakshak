import { useEffect, useState } from 'react';
import type { ScanRecord } from '@/lib/db';
import { safeLocalStorage } from '@/lib/safeStorage';
import { buildSampleHistory } from '@/lib/sampleHistory';
import { useAppStore } from '@/lib/store';

const SAMPLE_PREF_KEY = 'akshi-dash-sample';

/**
 * Sample history (dashboard and network): shown by default until the person has checks of their own,
 * and they can show or hide it at any time (the choice is remembered on this device).
 */
export function useSampleHistory(own: ScanRecord[] | null) {
  const lang = useAppStore((s) => s.lang);
  const [pref, setPref] = useState<'on' | 'off' | null>(() => {
    const v = safeLocalStorage.getItem(SAMPLE_PREF_KEY);
    return v === 'on' || v === 'off' ? v : null;
  });
  const show = own !== null && (pref ? pref === 'on' : own.length === 0);
  const [samples, setSamples] = useState<ScanRecord[]>([]);
  useEffect(() => {
    if (!show) return;
    let alive = true;
    void buildSampleHistory(lang).then((list) => {
      if (alive) setSamples(list);
    });
    return () => {
      alive = false;
    };
  }, [show, lang]);
  const setShow = (on: boolean) => {
    safeLocalStorage.setItem(SAMPLE_PREF_KEY, on ? 'on' : 'off');
    setPref(on ? 'on' : 'off');
  };
  return { show, samples: show ? samples : [], setShow };
}
