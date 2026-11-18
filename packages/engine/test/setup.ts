/**
 * Lexicon packs and non-English strings load lazily (SPEC_A_ENGINE.md §14). Most tests call
 * synchronous functions (scoreLive, matchRules, signalText) directly, so load everything first.
 * test/lazy.test.ts checks the lazy paths on a fresh module graph.
 */
import { loadAllStrings } from '../src/i18n';
import { ensureLexicons } from '../src/rules/engine';

await Promise.all([ensureLexicons(), loadAllStrings()]);
