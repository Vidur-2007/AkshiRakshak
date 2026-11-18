/**
 * Bundles each Vercel Function in api/ for production (SPEC.md §16).
 *
 * Vercel's Node builder compiles every .ts file on its own and runs the output in plain Node.
 * Our workspace packages are not runnable that way: their package.json `exports` point at .ts
 * sources and their relative imports have no extensions (Vite, Vitest and tsx resolve both, Node
 * does not). So, inside the Vercel build only, this script bundles each function entry together
 * with api/_lib and the @akshi/* packages into one ES module and writes it over the entry file.
 * Published npm packages (ai, zod, undici, …) stay external; Vercel's file tracer includes them.
 *
 * The overwrite only happens when VERCEL=1 (set by Vercel during builds), so local sources are
 * never touched. `--check` bundles into a temporary folder instead, anywhere.
 *
 *   npm run build:api            # in the Vercel build: bundle and overwrite api/**\/*.ts entries
 *   npm run build:api -- --check # anywhere: bundle to a temp folder and report sizes
 */
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build, type Plugin } from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const apiDir = path.join(root, 'api');
const check = process.argv.includes('--check');

if (!check && process.env.VERCEL !== '1') {
  console.error('build-api overwrites api/ entries and only runs in the Vercel build (VERCEL=1).');
  console.error('Use `npm run build:api -- --check` to try the bundle locally.');
  process.exit(1);
}

/** Function entries as Vercel sees them: .ts under api/, skipping _-prefixed paths and tests. */
function entries(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name.startsWith('_') || name.startsWith('.')) return [];
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return entries(full);
    return name.endsWith('.ts') && !name.endsWith('.d.ts') && !name.endsWith('.test.ts')
      ? [full]
      : [];
  });
}

/** Bundle our workspace code; leave every published package to Node and Vercel's tracer. */
const externalPackages: Plugin = {
  name: 'external-packages',
  setup(b) {
    b.onResolve({ filter: /^[^./]/ }, (args) => {
      if (args.path.startsWith('@akshi/') || path.isAbsolute(args.path)) return undefined;
      return { path: args.path, external: true };
    });
  },
};

const files = entries(apiDir);
const out = check ? mkdtempSync(path.join(tmpdir(), 'akshi-api-')) : null;
let failed = false;
for (const file of files) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  const result = await build({
    entryPoints: [file],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    plugins: [externalPackages],
    logLevel: 'silent',
    // The result replaces a .ts entry that Vercel then type-checks; it is plain JS by now.
    banner: { js: `// @ts-nocheck\n// Bundled from ${rel} by scripts/build-api.ts for Vercel.` },
  }).catch((err: unknown) => {
    failed = true;
    console.error(`✗ ${rel}`, err instanceof Error ? err.message : err);
    return null;
  });
  const code = result?.outputFiles[0]?.text;
  if (!code) continue;
  const dest = out ? path.join(out, rel) : file;
  if (out) mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, code);
  console.log(`✓ ${rel}  ${(code.length / 1024).toFixed(1)} KB`);
}
if (out) rmSync(out, { recursive: true, force: true });
if (failed || files.length === 0) process.exit(1);
