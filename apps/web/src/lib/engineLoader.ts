/**
 * Loads the engine import surface (lib/engine.ts) after first paint, so pages like
 * /scan render their input before the detection engine arrives (SPEC_B_WEB.md §7;
 * A's request: "load the engine after first paint"). Only lib/engine.ts imports
 * @akshi/* packages; this module just imports it dynamically.
 */
import { useEffect, useState } from 'react';
import type * as Engine from './engine';

export type EngineModule = typeof Engine;

let promise: Promise<EngineModule> | null = null;
let loaded: EngineModule | null = null;

export function loadEngine(): Promise<EngineModule> {
  promise ??= import('./engine').then((m) => {
    loaded = m;
    return m;
  });
  return promise;
}

/** The engine module once loaded (null on the first render), starting the load if needed. */
export function useEngine(): EngineModule | null {
  const [mod, setMod] = useState<EngineModule | null>(loaded);
  useEffect(() => {
    if (mod) return;
    let alive = true;
    void loadEngine()
      .then((m) => alive && setMod(m))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [mod]);
  return mod;
}
