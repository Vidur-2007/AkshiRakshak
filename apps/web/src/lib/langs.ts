/**
 * The interface languages, kept separate from lib/engine so the app shell does not
 * pull the detection engine into the first load. Must match LANGS in @akshi/contracts
 * (a test checks this).
 */
import type { Lang } from './engine';

export const UI_LANGS = ['en', 'hi', 'te', 'bn'] as const satisfies readonly Lang[];
