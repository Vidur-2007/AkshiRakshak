import { describe, expect, it } from 'vitest';
import { stageText } from './engine';
import { initI18n, loadAllLanguages } from './i18n';

describe('stageText', () => {
  it('names every stage in every language', async () => {
    await initI18n();
    await loadAllLanguages();
    for (const lang of ['en', 'hi', 'te', 'bn'] as const) {
      for (const stage of ['read', 'ocr', 'links', 'patterns', 'model', 'ai'] as const) {
        const name = stageText(stage, lang);
        expect(name, `${lang}.${stage}`).not.toBe(stage);
        expect(name.trim()).not.toBe('');
      }
    }
    // the engine's wording when it has one ("Checking links and UPI IDs"), else ours
    expect(stageText('links', 'en')).toMatch(/^Checking links/);
  });
});
