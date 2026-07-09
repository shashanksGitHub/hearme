# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

HearMe is a voice-first AI conversation companion — a personal reflection and emotional-support companion. It is **not** an AI girlfriend/boyfriend, dating app, or therapy replacement. Keep product copy, prompts, and features aligned with that framing.

## Commands

Run from the repo root (pnpm + Turborepo workspace):

```bash
pnpm install
pnpm dev                 # web (:3000) + api (:4000) in watch mode
pnpm dev:web             # web only
pnpm dev:api             # api only
pnpm emulators           # Firebase Auth/Firestore/Storage emulators (separate shell, run before dev)
pnpm build               # build all packages (respects dependency graph)
pnpm lint                # eslint across workspace
pnpm typecheck           # tsc --noEmit across workspace
pnpm test                # all tests
pnpm format              # prettier --write
```

Per-package: `pnpm --filter @hearme/api test`, `pnpm --filter @hearme/web typecheck`, etc.

Running a single API test: `pnpm --filter @hearme/api exec jest <pattern>` (Jest + ts-jest). The web app has no tests yet (`test` is a no-op). The `@hearme/shared` and `@hearme/config` packages have no lint configured (their `lint` scripts are stubs).

**`pnpm lint` currently fails repo-wide** — ESLint 9 is installed but there is no flat `eslint.config.*`, so it errors before linting anything. Treat `pnpm typecheck` (strict `tsc --noEmit`) as the real correctness gate until a flat config is added.

**Build order matters:** `@hearme/shared` and `@hearme/config` compile to `dist/` and are consumed as `workspace:*` deps. Turbo's `^build` dependsOn handles this, but if you see stale types in web/api, rebuild the changed package (`pnpm --filter @hearme/shared build`). `dev` tasks also depend on `^build`, so the shared packages must build before the apps start.

## Architecture

Monorepo: two apps over two shared packages.

- `apps/web` — **Next.js 15** (App Router, React 19, Turbopack). Two surfaces in one app:
  - **Marketing** under `src/app/[locale]/` — SSG/ISR, localized via `next-intl`, SEO-heavy (sitemap, robots, JsonLd, hreflang).
  - **Authed app** under `src/app/(app)/` (dashboard, conversation, onboarding) and `(auth)` — client-rendered, Firebase-auth gated, **not** localized.
  - `src/middleware.ts` runs `next-intl` routing on marketing routes **only**; its matcher explicitly excludes the app/auth/admin routes. When you add a new authed top-level route, add it to that exclusion list or it will get locale-prefixed.
- `apps/api` — **NestJS 11**. Feature modules under `src/modules/*` (voice, conversations, memory, reports, billing, users, onboarding, dashboard, admin, analytics, auth, health). External integrations are isolated under `src/infrastructure/*` (firebase, openai, anthropic, elevenlabs, stripe) and imported as global modules.
- `packages/config` — **single source of truth for env**. Zod schemas with three entrypoints: `@hearme/config` (server, `loadServerEnv`), `@hearme/config/public` (`loadPublicEnv`, NEXT_PUBLIC_* only, safe for client), `@hearme/config/server`. Never import the server schema into client components — it carries secrets.
- `packages/shared` — TS types, Zod schemas, and DTOs shared by web + api (`domain.ts` = entities, `ws-protocol.ts`, `constants.ts`, `dashboard.ts`). The canonical data contracts live here.

### Voice pipeline (important: turn-based, not streaming)

Each turn is push-to-talk over **HTTP multipart**, orchestrated in `apps/api/src/modules/voice/voice.service.ts`:

`mic → POST /voice/conversations/:id/turn (audio blob) → STT → load history+memory, buildSystemPrompt → LLM chat → TTS (provider-swappable) → base64 audio back`

The stages are fully **serial with no streaming** and every provider round-trip is on the critical path, so per-turn latency ≈ STT + LLM + TTS added together (typically several seconds each). This is the main reason turns feel slow; real speed-ups mean overlapping/streaming the stages, not swapping vendors.

Endpoints: `POST /voice/conversations` (start, pre-flights daily free-minute budget), `POST /voice/conversations/:id/turn`, `POST /voice/conversations/:id/end`. The web client uses `apiUpload`/`apiFetch` in `src/lib/api.ts`.

`packages/shared/src/ws-protocol.ts` defines a WebSocket streaming protocol, and the README describes the pipeline as "streaming." **That WS path is not wired up** — there is no `WebSocketGateway` in the API and no WS client in web. Treat the current implementation as the turn-based HTTP one; the WS protocol is aspirational/future.

### Provider swappability + cost metering

STT, LLM, **and TTS** are all swappable via env with no code changes (`STT_PROVIDER` = openai|elevenlabs, `LLM_PROVIDER` = openai|anthropic, `TTS_PROVIDER` = openai|elevenlabs|google) — each implementation lives behind an `src/infrastructure/*` service, and `voice.service.ts` branches on the env value (`transcribe`/`chat`/`synthesize`). Every turn records per-component cost (`sttCost`/`llmCost`/`ttsCost`/`totalCost`) on the conversation, which drives admin profitability/dashboard views. When touching the voice path, keep cost metering intact and add the unit-cost env knobs (e.g. `*_COST_PER_*` in `config/server.ts`) for any new provider.

TTS default is **Google Cloud TTS** (~20–75× cheaper than ElevenLabs, returns MP3 directly); ElevenLabs is the premium option; OpenAI is the fallback. Because Google voices are language-locked (unlike ElevenLabs' one multilingual voice), voice selection is modeled as cross-language **personas** in `infrastructure/google/google-tts.service.ts` — the stored `voiceId` is a persona id that resolves to the right per-language voice at synth time. Onboarding's `listVoices()` is provider-aware, and `GET /onboarding/voices/:id/preview` (public) synthesizes on-the-fly previews since Google has no preview URLs.

### Auth

- Web: Firebase client SDK. `src/lib/auth.tsx` exposes `useAuth()`; `getIdToken()` feeds the bearer token into every API call (`src/lib/api.ts`).
- API: `FirebaseAuthGuard` (`src/common/guards/firebase-auth.guard.ts`) verifies `Authorization: Bearer <Firebase ID token>` and attaches `req.user`. Read it in controllers via the `@CurrentUser()` decorator. Apply with `@UseGuards(FirebaseAuthGuard)`.

### Config / env conventions

- Env is validated **once at boot** through the shared Zod schema (`ConfigModule` provides the typed `ServerEnv` under the `ENV` token; inject with `@Inject(ENV)`). `apps/api/src/load-env.ts` MUST be the first import in `main.ts` because `app.module.ts` reads env at import time.
- **⚠️ `.env` files shadow each other — the root is NOT the only one.** `load-env.ts` walks *up* from `apps/api/src` and loads the **nearest** `.env`; if `apps/api/.env` exists it wins and **the root `.env` is never read by the API**. The repo currently has three: root `.env`, `apps/api/.env` (what the API actually reads), and `apps/web/.env` (what Next reads). So editing only the root `.env` silently has no effect on the API — change `apps/api/.env` for API config, and keep the files in sync. (This also means local and prod can drift, e.g. `ANTHROPIC_MODEL` differing between `apps/api/.env` and the deployed spec.) Env is read once at boot, so **restart the dev server after editing any `.env`**.
- Feature flags, pricing/plan numbers, free-tier minutes, supported languages, and retention are all env-driven (see `packages/config/src/server.ts`) — prefer adding a flag/number there over hardcoding. Next inlines `NEXT_PUBLIC_*` at build time (referenced statically via `apps/web/src/env.ts`).

## Deployment

Production runs on **DigitalOcean App Platform** — a single app named `hear-me` (region `blr`) with **two services built from this same repo** (`shashanksGitHub/hearme`, branch `main`): `web` (Next.js, `pnpm start:web`) and `api` (NestJS, `pnpm start:api`), both on port 8080. Ingress routes `/api/*` → the `api` service and `/*` → `web`, so the browser reaches the API at `<domain>/api` (that `/api` prefix is why `NEXT_PUBLIC_API_URL` ends in `/api`). **`deploy_on_push: true` on `main`** — every push to `main` builds and redeploys both services.

- **Env vars live in the DO app spec, not in `.env` files** (the `.env` files are local/dev only). Manage with `doctl` (`doctl apps list`, `doctl apps spec get <app-id>`, `doctl apps update <app-id> --spec <file>`); secrets are stored encrypted as `EV[...]` and preserved on re-apply. Updating the spec triggers a redeploy.
- **Ordering when flipping an env-driven provider** (e.g. `TTS_PROVIDER`): push the code first, *then* change the env — otherwise the still-deployed old code may reject a new enum value at boot and crash.
- Older docs reference Netlify (`netlify.toml`) / Render (`render.yaml`, `Dockerfile`); those files no longer exist — ignore them.
- Firebase rules/indexes live in `firebase/` (`firestore.rules`, `firestore.indexes.json`, `storage.rules`); `.firebaserc` default project is `hearme-companion`, local emulator project is `hearme-local`.

## Conventions

- TypeScript strict mode repo-wide with `noUncheckedIndexedAccess` (`tsconfig.base.json`) — index access yields `T | undefined`; handle it.
- Validate inputs with Zod schemas from `@hearme/shared` (the API deliberately has **no** global `ValidationPipe`; validation is per-route with Zod — see `main.ts`).
- Prettier enforced (`.prettierrc.json`); run `pnpm format` before committing.
- When a type or DTO crosses the web/api boundary, define it in `packages/shared` rather than duplicating.
