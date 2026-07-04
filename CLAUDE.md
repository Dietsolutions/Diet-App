# Diet Plan & Tracker — Project Memory

Personalised AI diet planning + meal logging app. Indian-market focus (Indian
staples, macro accuracy for roti/dal/rice etc.). This repo is the **mobile build**:
the same web app wrapped with Capacitor to ship as native Android + iOS, plus the
web deploy. App id `com.dietplan.tracker`, name "Diet Plan & Tracker".

## Architecture (read this before assuming anything)

Monorepo, **not** a native rewrite. The app is a React web client rendered inside
a Capacitor WebView. The JS/TS is the app — there is no separate Kotlin/Swift app
to maintain.

```
/client      React 18 + Vite + TypeScript SPA  (Zustand, axios, recharts, date-fns)
/server      Express + TypeScript API           (Prisma ORM → Postgres / Neon)
/api         Vercel serverless entry
/android     Capacitor Android shell            (com.dietplan.tracker)
/ios         Capacitor iOS shell
/fastlane    Store submission automation
capacitor.config.ts   webDir = client/dist; splash/statusbar/plugin config
```

- Client state: Zustand stores in `client/src/store/` (app, auth, weight, mealReplacer, additionalMeals).
- API client: `client/src/lib/api.ts` (axios). Capacitor bridge in `client/src/lib/capacitor.ts`.
- Server routes: `server/src/routes/` — auth, profile, plan, meals, tracker, water, weight, food, shopping, ai, pages.
- Server services: `server/src/services/` — see Integrations below.
- DB schema: `server/src/prisma/schema.prisma` (+ `schema.postgres.prisma`). Migrations in `prisma/migrations/`.

## Core domain

- **Onboarding**: multi-step wizard (`client/src/components/Onboarding.tsx`) → profile + TDEE.
- **Plan generation**: AI-generated multi-day meal plan, streamed (SSE) from `routes/ai.ts`.
- **Macro validation pipeline** (the heart of the app, `services/macroValidation.ts`):
  generated meals are validated against per-meal macro targets, deviation is computed
  (calories + protein + carbs), ingredients are scaled, and out-of-tolerance meals are
  sent back to the LLM for correction within an attempt budget, with a day-level ±15% check.
  Every attempt is logged via `macroValidationLogger.ts`. See DECISIONS.md §9–16.
- **Meal logging / tracker**: `routes/tracker.ts`, `TrackerTab.tsx`; per-meal regenerate, meal replacer, additional meals.
- **Water logging**, **weight tracking + goal projection**, **shopping list**, **TTS cooking guides**.

## Integrations

- **CalorieNinjas** (`calorieNinjasService.ts`) — primary nutrition lookup. CN tokenises
  multi-word names and applies default serving weights, so ingredients are normalised to
  `{grams}g {simple token}` **only for the CN query** before lookup (see normaliser in
  `macroValidation.ts`). ⚠️ See "Known divergence" below — the normaliser here is behind the web repo.
- **USDA** (`usdaService.ts`), **OpenFoodFacts** (`openFoodFactsService.ts`), **Indian food DB**
  (`indianFoodService.ts`, seeded from Kaggle) — fallback / supplementary nutrition sources.
- **LLM** via `services/llmClient.ts` (abstracted client; meal plan + correction prompts).
- **TTS**: `ttsService.ts` → Unreal Speech, audio stored in Vercel Blob.
- **Analytics**: PostHog (`client/src/lib/analytics.ts`).

## Build & deploy

- Local dev: `npm run dev` (runs server + client concurrently).
- DB: `npm run prisma:migrate:dev`, `npm run seed`, `npm run prisma:studio`.
- **Web deploy**: build via `npm run build`; deployed through Vercel. Run `npm run pre-deploy` first.
- **Mobile build**:
  - Android: `npm run cap:build:android` (builds client → `cap sync android` → opens Android Studio). Helper: `scripts/build-android.sh`, keystore via `scripts/generate-android-keystore.sh`.
  - iOS: `npm run cap:build:ios` (→ `cap sync ios` → opens Xcode). Helper: `scripts/build-ios.sh`.
  - CI: `.github/workflows/android.yml`, `ios.yml`. Store metadata in `STORE_METADATA.md`, `PLAYSTORE_DEPLOY.md`, `STORE_REVIEW_NOTES.md`.
- After ANY client change destined for mobile, remember `cap sync` is required for the WebView to pick it up.

## Mobile-specific notes

- `appId: com.dietplan.tracker`. Splash/status bar config in `capacitor.config.ts` (dark `#0F1117`).
- Android release: `allowMixedContent: false`, `webContentsDebuggingEnabled: false` — keep both off for Play.
- iOS requires a privacy manifest (`PrivacyInfo.xcprivacy`); `appleTeamId` via `APPLE_TEAM_ID` env.
- Auth supports Apple Sign-In (migration `add_apple_id`) — needed for App Store approval.
- An App Store review mode flag exists (`add_is_review_flag`).
- Past bug (web): iOS Safari blank screen caused by `@vitejs/plugin-legacy` stack overflow — already resolved; don't reintroduce.

## Repo convergence (RESOLVED — was "Known divergence")

The earlier divergence is **resolved as of 2026-06-11**. This local working copy and the
remote `origin` (https://github.com/Dietsolutions/Diet-App.git) are fully converged —
local `main` == `origin/main`. Treat **origin as the canonical, most-recent source of
truth** for everyone working on this code; the remote workflow is direct-to-`main`.

What was reconciled (no longer outstanding, do NOT re-do):

- **CN ingredient normaliser** — the 5-path version (`isBreadItem`, `simplifyFoodName`,
  ml handling, post-scale recheck) is in place, plus `server/src/scripts/testNormalisation.ts`.
  The "80g whole wheat roti → ~900 kcal" bug class is fixed. Dashboard-v4 follow-ups
  (post-scale normalisation, ml→g in the main pipeline, Path-3 hint semantics,
  duplicate-generation guard) are also in. See DECISIONS.md §17.
- **Browse Recipes** library + the native auth ("username already taken") fix are merged.
- The older local snapshot (pre-`appleId`/`isReview`/token-hashing schema, smaller
  AuthScreen, cookie-vs-Bearer api.ts, looser CORS) was reset to origin's newer versions.

Going forward: after a logic change, remember `cap sync` for the mobile WebView, and set
`VITE_API_URL` for native builds so the WebView reaches the backend. `session-ses_1786.md`
is gitignored on origin (it once leaked an API key) — never commit it.

## Conventions & working style

- TypeScript throughout; functional React components + hooks; Zustand for state (no Redux).
- British spelling in code/comments is used in places (`normalise`, `simplify`) — match existing file.
- For bulk SQL/analytics work elsewhere: prefer hardcoded `IN (...)` lists over variables;
  one-row-per-event output over wide pivots.
- **Agent behaviour**: execute autonomously and deliver complete, working changes — don't stop
  mid-task for check-ins or hand back partial drafts. Run the relevant tests/build before declaring done.
- **Writing**: plain, natural prose in comments, docs, and commit messages. No corporate or
  AI-sounding filler.
- Append a dated entry to `DECISIONS.md` for any non-trivial change, matching the existing format.

## Where the detail lives

- `DECISIONS.md` — full chronological design log (§1–16). Read the relevant section before touching macro/plan logic.
- `FOOD_SEARCH_AUDIT.md`, `SECURITY_AUDIT.md`, `ANALYTICS_SETUP.md`, `NEON_MIGRATION_README.md`.
