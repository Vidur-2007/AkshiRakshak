# Akshi Rakshak — instructions for Claude Code

Scam and fraud detector for Indian UPI users (Arthaton 2026). Read docs/SPEC.md first, then your laptop's spec (SPEC_A_ENGINE.md, SPEC_B_WEB.md or SPEC_C_DATA.md), then your progress log in docs/progress/.

## Ownership — one session since 2026-11-20
The human decided that all work (formerly Laptops A, B and C) is done in one session, on branch feat/engine. Laptops B and C must not edit or push anything, including feat/web and feat/data.
- The areas below are kept as a map of the code. They are no longer separate owners:
  - engine and platform: packages/contracts, packages/engine, api/, scripts/, root config files, vercel.json, .github/, CLAUDE.md, docs/SPEC*.md, docs/PROMPTS*.md
  - web: apps/web/
  - data: packages/model, packages/insights, packages/content, ml/, data/, eval/, README.md, docs/dataset-card.md, docs/eval-notes.md, docs/i18n-review.md, docs/demo-script.md, docs/screenshots/
- Keep each area's progress log current: docs/progress/engine.md, web.md and data.md.
- The data rules still apply: tune only on validation findings, never on the test or handwritten splits.

## Contracts
packages/contracts is frozen after Phase 0. Follow SPEC.md §9.4 for any change. Import types only from @akshi/contracts.

## Rules
- TypeScript strict. No `any` in exported APIs. Validate data crossing package or network boundaries with zod.
- No secrets, real personal data, real bank details, PAN or Aadhaar numbers in the repo. Use obviously synthetic values.
- No paid services. Free tiers and open-source packages only.
- Text checks must keep working offline.
- Follow the truth rules in SPEC.md §1.3 in all user-facing text.
- Prefer small, well-known dependencies. Ask the human before adding a dependency over 100 KB gzipped to the web bundle.
- Write tests for logic. Keep commits small with conventional messages.

## Before you end a phase
1. npm run typecheck && npm test (and npm run build -w @akshi/web if web code changed)
2. Update your progress log: done, deferred, known issues, requests
3. Commit and push your branch
4. Print a short summary for the human: what works, how to see it, what is next

## Commands
npm install · npm run dev · npm run dev:api · npm test · npm run typecheck · npm run lint · npm run eval
