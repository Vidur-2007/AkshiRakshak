/**
 * Engine bundle sizes as the web app ships them (SPEC_A_ENGINE.md §14). Builds a scan-page entry
 * (`analyze`, `scoreLive`, `warmup`) with Vite — the web app's bundler — then minifies each chunk
 * with esbuild (Vite lib mode keeps whitespace in ES output) and reports gzip -9 sizes.
 *
 * Core = chunks loaded eagerly by the entry. Lazy = chunks only reached through import().
 * C's packages (@akshi/model, @akshi/content) are external: the model JSON and content are theirs.
 *
 *   npm run size            # fails if the core is over budget
 *   npm run size -- --json  # machine-readable
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { transform } from 'esbuild';
import { build, type Rollup } from 'vite';

/** §14: engine core ≤ 60 KB gz excluding lexicons and model JSON; lexicons ≤ 40 KB gz total. */
const CORE_BUDGET_KB = 60;
const LEXICON_BUDGET_KB = 40;

const root = path.resolve(import.meta.dirname, '..');
const work = mkdtempSync(path.join(tmpdir(), 'akshi-size-'));
const entry = path.join(work, 'scan.ts');
writeFileSync(
  entry,
  `export { analyze, scoreLive, warmup } from ${JSON.stringify(path.join(root, 'packages/engine/src/index.ts').split(path.sep).join('/'))};\n`,
);

interface Row {
  file: string;
  lazy: boolean;
  kb: number;
  /** gzip KB of lexicon JSON inside this chunk (estimated from the module's own code) */
  lexiconKb: number;
  modules: string[];
}

try {
  const out = (await build({
    root,
    logLevel: 'error',
    configFile: false,
    build: {
      write: false,
      minify: 'esbuild',
      target: 'es2022',
      lib: { entry, formats: ['es'], fileName: 'engine' },
      rolldownOptions: {
        external: [/^@akshi\/(content|model)/],
        // the web app must set this too: see docs/progress/engine.md (Rolldown copies the tldts trie)
        optimization: { inlineConst: false },
      },
    },
  })) as Rollup.RollupOutput | Rollup.RollupOutput[];
  const chunks = (Array.isArray(out) ? out.flatMap((o) => o.output) : out.output).filter(
    (c): c is Rollup.OutputChunk => c.type === 'chunk',
  );

  // eager = reachable from the entry through static imports
  const byName = new Map(chunks.map((c) => [c.fileName, c]));
  const eager = new Set<string>();
  const visit = (name: string) => {
    if (eager.has(name)) return;
    eager.add(name);
    for (const i of byName.get(name)?.imports ?? []) visit(i);
  };
  for (const c of chunks) if (c.isEntry) visit(c.fileName);

  const gz = (s: string) => gzipSync(s, { level: 9 }).length / 1024;
  const rows: Row[] = [];
  for (const c of chunks) {
    const min = (await transform(c.code, { minify: true, format: 'esm', loader: 'js' })).code;
    const modules = Object.keys(c.modules).map((m) =>
      path.relative(root, m.replace(/^\0/, '')).split(path.sep).join('/'),
    );
    let lexiconKb = 0;
    for (const [id, m] of Object.entries(c.modules))
      if (/rules[\\/]lexicons[\\/].*\.json$/.test(id) && m.code) lexiconKb += gz(m.code);
    rows.push({ file: c.fileName, lazy: !eager.has(c.fileName), kb: gz(min), lexiconKb, modules });
  }
  rows.sort((a, b) => Number(a.lazy) - Number(b.lazy) || b.kb - a.kb);

  const sum = (xs: Row[], f: (r: Row) => number) => xs.reduce((a, r) => a + f(r), 0);
  const core = rows.filter((r) => !r.lazy);
  const coreKb = sum(core, (r) => r.kb);
  const coreLexKb = sum(core, (r) => r.lexiconKb);
  const lexKb = sum(rows, (r) => r.lexiconKb);
  const coreExLex = coreKb - coreLexKb;
  const ok = coreExLex <= CORE_BUDGET_KB && lexKb <= LEXICON_BUDGET_KB;

  if (process.argv.includes('--json')) {
    console.log(
      JSON.stringify({ coreKb, coreExLexiconsKb: coreExLex, lexiconsKb: lexKb, rows }, null, 2),
    );
  } else {
    const label = (r: Row) => {
      const m = r.modules.join(' ');
      if (/lexicons\/(hi|te|bn)\.json/.test(m) && r.modules.length === 1) return 'lexicon pack';
      if (/i18n\/(hi|te|bn)\.json/.test(m) && r.modules.length === 1) return 'strings';
      if (/contracts\/src\/schemas/.test(m)) return 'zod schemas';
      if (/pipeline\/analyze/.test(m)) return 'analyze pipeline';
      return r.lazy ? '' : 'core';
    };
    for (const r of rows)
      console.log(
        `${r.lazy ? 'lazy' : 'core'}  ${r.kb.toFixed(1).padStart(6)} KB gz  ${r.file.padEnd(28)} ${label(r)}`,
      );
    console.log(
      `\ncore ${coreKb.toFixed(1)} KB gz (${coreExLex.toFixed(1)} KB without lexicons; budget ${CORE_BUDGET_KB}) · ` +
        `lexicons ${lexKb.toFixed(1)} KB gz, each pack gzipped on its own (budget ${LEXICON_BUDGET_KB}) · ` +
        `all chunks ${sum(rows, (r) => r.kb).toFixed(1)} KB gz`,
    );
    console.log(ok ? 'within budget' : 'OVER BUDGET');
  }
  process.exitCode = ok ? 0 : 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}
