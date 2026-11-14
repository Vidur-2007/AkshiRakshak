# Progress — web

## Done

### Phase 0 — scaffold, tokens, shell (14 Nov 2026)

- `apps/web` is the `@akshi/web` workspace: Vite 8, React 19, React Router 8 (data router), Tailwind CSS v4 (`@tailwindcss/vite`), shadcn/ui (`components.json`, new-york style; primitives in `components/ui/` restyled to our tokens: button, switch, dropdown-menu, sheet, command, sonner), lucide-react, sonner, cmdk, Motion for React, i18next + react-i18next, Dexie, Zustand, zod.
- `vite.config.ts`: copies `packages/engine/assets/**` to `dist/engine-assets/` (checked: `engine-assets/README.md` lands there); `/api` proxies to `http://localhost:3001`; `manualChunks` for three / @react-three, recharts, react-force-graph, tesseract.js and the model JSON; `@/` alias.
- Scripts: `dev` (vite, port 5173), `build` (`tsc -b && vite build`), `typecheck`, `test`. Root `npm run dev` and `npm run build` pick them up.
- `styles/tokens.css`: every §3.1 token (surfaces, glass, text, brand, ai, the three risk colours, glow, radii 12/16/24, 4px spacing, type scale 14/16/20/28/40 + hero clamp), plus the Elder (`html.elder`: 20px base, 56px taps, solid glass) and low-tier (`html.tier-low`: no blur) overrides. `globals.css` maps tokens into Tailwind and the shadcn variable names. `fonts.css`: Geist Sans and Geist Mono, Noto Sans Devanagari, Telugu and Bengali via Fontsource, applied per `:lang()`, with line height 1.4 Latin and 1.6 Indic.
- `lib/`: `engine.ts` (the only `@akshi/*` importer; OCR is a lazy wrapper so tesseract stays out of the first load), `motion.ts` (§3.3 tokens, page/sheet/fade variants), `deviceTier.ts` (§3.4 rules + per-tier settings), `store.ts` (Zustand, persisted prefs through a storage wrapper that never throws, values checked when read back; runtime `deviceTier`, `online`, `lastResultId`; `?simple=1` and `?lang=` flags), `db.ts` (Dexie `akshi` with `scans`, `blocklist`, `statements`, `dojo`; `saveScan` broadcasts; `blocklistValues`; `deleteEverything`), `broadcast.ts` (`BroadcastChannel('akshi')`, messages checked with zod), `i18n.ts`, `risk.ts`, `langs.ts`.
- Locales `en`, `hi`, `te`, `bn` with real translations in plain everyday words. Non-English files start with `"_review": "pending"`.
- App shell: desktop glass top bar (≥ 1024px) with Scan, Modules menu, Dashboard, Network, Learn menu, palette button, language switcher (EN / हि / తె / বা), Elder toggle and the red "I think I'm being scammed" pill (shows "SOS" between 1024 and 1280px). Mobile: sticky header with the SOS button pinned top-right, bottom tab bar (Home, Dashboard, raised Scan in the centre, Learn, More) and a More sheet (Modules, Learn, Network, Settings, Tour, language, Elder mode). Command palette on Ctrl/Cmd+K (routes, paste-and-scan, language, Elder mode). Offline pill. Skip link. `LazyMotion` + `MotionConfig reducedMotion="user"`, and `AnimatePresence mode="wait"` page transitions keyed by pathname. `ScrollRestoration` resets scroll to the top except on back/forward.
- Every §4.1 route exists as a lazy page with a placeholder that uses the shell. The landing page already runs `scoreLive` in a simple meter, `/scan` calls `warmup()` and shows palette/share-target prefill, `/sos` has a `tel:1930` button, and `/settings` has the language and Elder controls.
- Tests (51 in `apps/web`): device tier, store (defaults, Elder → voice, URL flags, sanitising), safe storage, broadcast, db helpers, risk helpers, locale parity (same keys, `_review` first, no empty strings, placeholders kept, never "safe"), `UI_LANGS` matches the contract `LANGS`, and every route renders inside the shell.
- Bundle: the first load is **193 KB gzipped JS** (budget 200 KB). The palette (cmdk), sonner and Motion features (33 KB) load lazily. The engine stub chunk is 47 KB gzipped and loads with the first page that uses the engine.

## In progress

- Nothing. Phase 1 (Quick Scan + Analysis) is next.

## Deferred

- vite-plugin-pwa and the manifest/share target: Phase 4, as SPEC_B_WEB §2.1 says.
- `playwright.config.ts` and e2e specs: Phase 5. CI's e2e job skips until the config exists.
- `lib/share.ts`, `lib/speech.ts`, `styles/print.css`: they arrive with the features that use them (P1 read aloud, P3 complaint draft, P4 share cards).
- shadcn components beyond the five primitives are added as screens need them, using `components.json`.

## Known issues

- `/scan` will load about 240 KB gzipped (193 KB shell + 47 KB engine stub), which is over the 200 KB budget. Most of the stub's weight is `@akshi/contracts/fixtures`, which parses every fixture with zod when the module loads. See Request 2.
- The root `npm run typecheck` does not cover `apps/web` yet (see Request 1). `npm run build -w @akshi/web` runs `tsc -b` on the web project, so type errors still fail the build and CI's build step.
- Font files (all scripts, 400/500/600/700) are emitted but only fetched when a glyph in their unicode-range is shown.

## Requests

1. **Laptop A — root `tsconfig.json`:** add `{ "path": "apps/web" }` to `references` so `npm run typecheck` covers the web app. `apps/web/tsconfig.json` is a solution file, and its two projects are composite and emit to `.tsbuild/web/` (already gitignored).
2. **Laptop A — engine bundle size:** please keep `@akshi/contracts/fixtures` out of the real engine (the Phase 0 stub imports it), and add `"sideEffects": false` to `packages/{contracts,engine,content,insights,model}/package.json` if the modules allow it, so the web bundler can drop unused exports. Goal: the engine chunk fits inside `/scan`'s 200 KB budget together with the 193 KB shell, or we agree to load the engine after first paint.
