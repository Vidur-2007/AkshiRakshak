/**
 * Builds packages/engine/assets/ for self-hosted OCR (SPEC_A_ENGINE.md §10).
 * Run: npm run ocr-assets   (outputs are committed; rerun after bumping tesseract.js)
 *
 *  assets/tesseract/worker.min.js                      ← tesseract.js/dist
 *  assets/tesseract/tesseract-core-*lstm.wasm.js (×3)  ← tesseract.js-core (LSTM-only variants:
 *                                                        relaxed SIMD, SIMD, plain; the worker picks one)
 *  assets/tessdata/{eng,hin,tel,ben}.traineddata.gz    ← github.com/tesseract-ocr/tessdata_fast @ TESSDATA_COMMIT
 *  assets/MANIFEST.json                                ← versions, sources, sizes and SHA-256 of every file
 */
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const TESSDATA_COMMIT = '87416418657359cb625c412a48b6e1d6d41c29bd'; // tessdata_fast main, 2024-08-01
const LANGS = ['eng', 'hin', 'tel', 'ben'] as const;
const CORES = [
  'tesseract-core-relaxedsimd-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-lstm.wasm.js',
];

const root = fileURLToPath(new URL('../packages/engine/', import.meta.url));
const assets = join(root, 'assets');
const require = createRequire(join(root, 'package.json'));
const tessPkg = require.resolve('tesseract.js/package.json');
const corePkg = createRequire(tessPkg).resolve('tesseract.js-core/package.json');
const version = (p: string) => (JSON.parse(readFileSync(p, 'utf8')) as { version: string }).version;
const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');

mkdirSync(join(assets, 'tesseract'), { recursive: true });
mkdirSync(join(assets, 'tessdata'), { recursive: true });

const files: { path: string; source: string; bytes: number; sha256: string }[] = [];
const record = (rel: string, source: string) => {
  const abs = join(assets, rel);
  files.push({ path: rel, source, bytes: statSync(abs).size, sha256: sha256(readFileSync(abs)) });
};

copyFileSync(
  join(dirname(tessPkg), 'dist', 'worker.min.js'),
  join(assets, 'tesseract', 'worker.min.js'),
);
record('tesseract/worker.min.js', `npm:tesseract.js@${version(tessPkg)}/dist/worker.min.js`);
for (const c of CORES) {
  copyFileSync(join(dirname(corePkg), c), join(assets, 'tesseract', c));
  record(`tesseract/${c}`, `npm:tesseract.js-core@${version(corePkg)}/${c}`);
}

for (const lang of LANGS) {
  const url = `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/${TESSDATA_COMMIT}/${lang}.traineddata`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const raw = Buffer.from(await res.arrayBuffer());
  writeFileSync(join(assets, 'tessdata', `${lang}.traineddata.gz`), gzipSync(raw, { level: 9 }));
  record(`tessdata/${lang}.traineddata.gz`, `${url} (gzipped; original sha256 ${sha256(raw)})`);
  console.log(
    `${lang}: ${raw.length} → ${statSync(join(assets, 'tessdata', `${lang}.traineddata.gz`)).size} bytes`,
  );
}

writeFileSync(
  join(assets, 'MANIFEST.json'),
  JSON.stringify(
    {
      generatedBy: 'scripts/ocr-assets.ts',
      tesseractJs: version(tessPkg),
      tesseractCore: version(corePkg),
      tessdata: {
        repo: 'https://github.com/tesseract-ocr/tessdata_fast',
        commit: TESSDATA_COMMIT,
        licence: 'Apache-2.0',
      },
      files,
    },
    null,
    2,
  ) + '\n',
);
console.log(`wrote ${files.length} files to ${assets}`);
