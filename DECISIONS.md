# Architectural Decisions

## 1. SQLite over PostgreSQL
**Decision**: Use SQLite (`file:./dev.db`) instead of PostgreSQL.
**Reason**: No Docker available on the dev machine. SQLite is zero-config, runs in-process, and Prisma supports it natively. JSON arrays are stored as serialized strings and parsed in route handlers.
**Trade-off**: No native JSON column type; manual `JSON.parse()` / `JSON.stringify()` required for array fields.

## 2. User ID as CUID String
**Decision**: Changed User `id` from auto-increment Int to `@default(cuid())` String.
**Reason**: Google OAuth users need a stable ID before database insertion. CUIDs are URL-safe, globally unique, and don't leak sequence information. All foreign keys (`userId`) across models reference this string ID.

## 3. Manual Google OAuth (no Passport.js)
**Decision**: Implement Google OAuth 2.0 flow manually using `fetch()` calls to Google's token and userinfo endpoints.
**Reason**: Avoids adding Passport middleware complexity for a single OAuth provider. The flow is straightforward: redirect → callback → exchange code → fetch profile → find-or-create user → issue JWT cookie → redirect to frontend.

## 4. JWT in httpOnly Cookies
**Decision**: Store JWT tokens in httpOnly, SameSite=Lax cookies instead of localStorage.
**Reason**: httpOnly cookies are not accessible via JavaScript, preventing XSS token theft. SameSite=Lax allows the Google OAuth redirect flow while blocking CSRF from third-party sites.

## 5. Zustand for State Management
**Decision**: Use Zustand over Redux or React Context.
**Reason**: Minimal boilerplate, no providers needed, excellent TypeScript support, and built-in shallow equality checks. The app's state is moderate in complexity — Zustand handles it cleanly without Redux's ceremony.

## 6. AI Meal Plan Generation via Claude API
**Decision**: Use Anthropic's Claude API for generating personalised 7-day meal plans.
**Reason**: Claude excels at structured JSON generation from natural language prompts. The prompt includes all user profile data (macros, preferences, allergies, cuisine, equipment) to produce contextually relevant meal plans.
**Rate limit**: 3 generations per user per day (in-memory map).

## 7. TDEE Calculation: Mifflin-St Jeor
**Decision**: Use Mifflin-St Jeor equation for BMR calculation.
**Reason**: Most accurate BMR formula for the general population (within ±10%). Combined with activity level multipliers and diet intensity deficits (300/500/750 kcal) to derive daily calorie targets.

## 8. Variable Meals Per Day (3/4/5)
**Decision**: Support 3, 4, or 5 meals per day as a user preference.
**Reason**: Different dietary approaches (IF, standard, frequent feeding) require different meal counts. The tracker, calendar dots, and plan view all dynamically adapt to the user's chosen meal count.

## 9. Shopping List People Multiplier
**Decision**: Client-side quantity multiplication (1-5x) with server-persisted people count.
**Reason**: Keeps the shopping list generation simple (always for 1 person) while allowing families to scale quantities. The multiplier is applied in the UI using `multiplyQuantity()` — no re-generation needed.

## 10. Onboarding as Gated Flow
**Decision**: Users must complete a 7-step onboarding wizard before accessing the main app.
**Reason**: AI meal plan generation requires body stats, preferences, and goals. The onboarding collects all necessary data in a guided, mobile-friendly flow. Users can skip AI generation and use hardcoded plans as fallback.

## 11. Optimistic UI for Meal Tracking
**Decision**: Toggle meal eaten status optimistically in Zustand, then sync to server. Rollback on failure.
**Reason**: Immediate visual feedback is critical for a tracking app. The toggle operation is low-risk (idempotent PUT), and the server is the source of truth on page reload.

## 13. Custom Meal Plan Instructions via Free-Text Input
**Decision**: Add a free-text textarea (max 500 chars) in the Profile tab to let users provide natural language customisation instructions for AI meal plan generation.
**Reason**: Users need fine-grained control beyond profile preferences (e.g. "more eggs at breakfast", "avoid rajma this week"). Instructions are appended to the Claude prompt with highest priority (after allergy/safety restrictions). Auto-saved with 500ms debounce to avoid a manual save button.
**Trade-off**: Using `claude-sonnet-4-20250514` (not Haiku) since the deprecated Haiku model is unavailable as of April 2026. Custom instructions are persisted in DB (not ephemeral) so they carry over across regenerations — user must explicitly clear them.

## 12. PWA with Workbox Runtime Caching
**Decision**: Cache Google Fonts with CacheFirst, API responses with NetworkFirst.
**Reason**: Fonts rarely change (365-day cache). API data should always try network first for freshness, falling back to cache for offline resilience.

## 15. Vercel + Neon Production Deployment
**Decision**: Deploy as a single Vercel project with the React SPA and an Express API serverless function. Use Neon serverless PostgreSQL via `@prisma/adapter-neon` + `@neondatabase/serverless` (with `ws` for the WebSocket pool) for both local dev and production. This supersedes decision #1 (SQLite for local dev).
**Reason**: Vercel + Neon is the lowest-friction free-tier path for a JWT-cookie SPA + Express API. The Neon driver adapter avoids cold-start TCP connection cost on serverless by using HTTP/WebSocket pooling. Splitting `src/index.ts` into `src/app.ts` (no `.listen()`) + `src/server.ts` (local dev `.listen()`) + `api/index.ts` (Vercel handler) gives the same Express app a production serverless entry without forking code. Moving local dev to Neon (free tier branch) eliminates provider drift between environments — migrations behave identically everywhere.
**Trade-off**: Local dev now requires a Neon connection string instead of a zero-config SQLite file, so the first-time setup has one extra step. The existing local SQLite users database is not migrated — seed script must be re-run against Neon. `schema.postgres.prisma` is kept as a backup copy of the active schema.

## 16. Lazy-Loaded Neon Adapter
**Decision**: The Prisma singleton in `server/src/lib/prisma.ts` only requires `@prisma/adapter-neon` / `@neondatabase/serverless` / `ws` when `NODE_ENV === 'production'` and `DATABASE_URL` is set. Otherwise it falls back to a standard `new PrismaClient()`.
**Reason**: Keeps local development working when Neon-related env vars aren't configured, and lets the test/migration scripts use the standard client without pulling in serverless dependencies.

## 14. Username/Password Signup (No Email Verification)
**Decision**: Add a simple signup flow with just username + password — no email, no OTP, no verification. Usernames stored lowercase and matched case-insensitively. Passwords hashed with bcrypt (saltRounds: 12). Rate limit: 5 signups per IP per hour, 30 username checks per minute.
**Reason**: Keep friction low for new users while providing basic abuse protection. Username uniqueness is enforced case-insensitively by normalising to lowercase before storage and lookup. Login endpoint falls back to exact-match lookup for any legacy mixed-case accounts.
**Trade-off**: No password recovery (no email on file), no account deduplication across Google+credentials (a user may have both). Reserved usernames (admin, root, system, support, help, dietplan, api, null, undefined) are blocked server-side and client-side.

---

## Production Deployment Audit (2026-04-12)

Full audit and fix pass for Vercel production deployment. Below are all root causes found and files changed.

### Root Causes Found

1. **Cookie SameSite misconfiguration (CRITICAL)** — `setAuthCookie.ts` used `sameSite: 'none'` in production. Since the API and frontend share the same origin on Vercel (via rewrites), `SameSite=None` is wrong — it requires `Secure` and can cause cookies to be rejected by some browsers. Changed to `sameSite: 'lax'` (same-origin default) which works correctly for both same-origin requests and top-level navigations like Google OAuth redirects.

2. **Missing try/catch on route handlers** — Login, signup, check-username, plan GET, and week-start routes were missing try/catch, meaning any Prisma error would crash the serverless function silently instead of returning a 500 JSON response. Wrapped all async route handlers in try/catch.

3. **Prisma binary target missing for Vercel** — `schema.prisma` lacked `binaryTargets = ["native", "rhel-openssl-3.0.x"]`. Without `rhel-openssl-3.0.x`, Prisma Client fails to load on Vercel's Amazon Linux runtime.

4. **Prisma singleton not cached in production** — `prisma.ts` only cached the singleton in `globalThis` when `NODE_ENV !== 'production'`, meaning each warm Lambda invocation could create a new PrismaClient. Fixed to always cache in `globalThis`.

5. **Inconsistent API URL resolution in frontend** — `weightStore.ts` used bare `/api/...` paths (bypassing `apiUrl()`), and `Onboarding.tsx`, `ProfileTab.tsx`, `AuthScreen.tsx`, `Login.tsx`, `MealPlanCustomiser.tsx` all used bare fetch/XHR paths. Fixed all to use `apiUrl()` for consistency.

6. **Axios defaults not configured globally** — `axios.defaults.baseURL` and `axios.defaults.withCredentials` were not set, requiring every call to manually pass `withCredentials: true`. Added global config in `api.ts` imported from `main.tsx`.

7. **Missing env-var startup check** — No logging of which environment variables were missing at boot, making debugging on Vercel painful. Added startup check that logs missing required/optional vars.

8. **Error middleware leaked stack traces** — Production error handler logged `err.message` only (not the full stack). Also lacked `headersSent` guard. Fixed both.

9. **Missing unhandled rejection handler** — Unhandled promise rejections in serverless would crash silently. Added `process.on('unhandledRejection', ...)`.

10. **Deprecated PWA meta tag** — `<meta name="apple-mobile-web-app-capable">` without `<meta name="mobile-web-app-capable">` causes a console deprecation warning. Added the modern tag.

11. **Serverless function timeout too short** — `maxDuration: 30` in `vercel.json` is too short for AI meal plan generation (which streams for 30-60s). Increased to 60.

12. **Pre-deploy script wrong path** — Referenced `server/api/index.ts` instead of `api/index.ts`.

13. **Dead code in Onboarding skip flow** — Empty `POST /api/auth/login` call with no credentials was a no-op. Removed.

### Files Changed

| File | Change |
|------|--------|
| `server/src/utils/setAuthCookie.ts` | Cookie `sameSite: 'none'` → `'lax'` for same-origin Vercel deploys |
| `server/src/app.ts` | Env-var check, error middleware improvements, unhandled rejection handler |
| `server/src/lib/prisma.ts` | Always cache singleton in globalThis (prod + dev) |
| `server/src/prisma/schema.prisma` | Added `binaryTargets = ["native", "rhel-openssl-3.0.x"]` |
| `server/src/routes/auth.ts` | Added try/catch to login, signup, check-username, me |
| `server/src/routes/plan.ts` | Added try/catch to GET /plan |
| `server/src/routes/profile.ts` | Added try/catch to all route handlers |
| `server/src/routes/shopping.ts` | Added try/catch to all route handlers |
| `server/src/routes/tracker.ts` | Added try/catch to all route handlers |
| `server/src/routes/weight.ts` | Added try/catch to all route handlers |
| `client/src/lib/api.ts` | Added axios global defaults (baseURL, withCredentials) |
| `client/src/main.tsx` | Import `api.ts` before App mounts |
| `client/src/store/weightStore.ts` | Use `apiUrl()` for all fetch calls |
| `client/src/components/Onboarding.tsx` | Use `apiUrl()` for XHR, removed dead login call |
| `client/src/components/ProfileTab.tsx` | Use `apiUrl()` for XHR |
| `client/src/components/AuthScreen.tsx` | Use `apiUrl()` for Google OAuth fetch/redirect |
| `client/src/components/Login.tsx` | Use `apiUrl()` for Google OAuth fetch/redirect |
| `client/src/components/MealPlanCustomiser.tsx` | Use `apiUrl()` for meal instructions fetch |
| `client/index.html` | Added `<meta name="mobile-web-app-capable">` |
| `vercel.json` | `maxDuration: 30` → `60` |
| `scripts/pre-deploy-check.sh` | Fixed path `server/api/index.ts` → `api/index.ts` |

### Vercel Environment Variables Required

Ensure these are set in Vercel dashboard → Settings → Environment Variables:

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Neon pooled connection string |
| `DIRECT_URL` | Yes | Neon direct (non-pooled) for migrations |
| `JWT_SECRET` | Yes | Long random string (`openssl rand -base64 48`) |
| `NODE_ENV` | Yes | Must be `production` |
| `ANTHROPIC_API_KEY` | For AI | Required for meal plan generation |
| `FRONTEND_URL` | Recommended | e.g. `https://your-app.vercel.app` — used for CORS and Google OAuth redirects |
| `CLIENT_URL` | Recommended | Same as FRONTEND_URL (legacy compat) |
| `GOOGLE_CLIENT_ID` | For OAuth | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | For OAuth | Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | For OAuth | Must match Google Console exactly, e.g. `https://your-app.vercel.app/api/auth/google/callback` |

### Deploy Commands

```bash
# Push fixes to GitHub (triggers Vercel auto-deploy)
git add -A
git commit -m "fix: production deployment audit — cookie, error handling, API paths"
git push origin main

# Or manual deploy
vercel --prod
```

### Database Sync

No schema changes were made to the data models. The only schema change was adding `binaryTargets` to the generator block, which only affects client generation (not the database). No migrations needed.

---

## 17. Meal Replacer Feature (2026-04-17)

### Overview
The Meal Replacer lets users swap any planned meal with what they actually ate,
tracking real macros against the plan. Three food data sources cascade:
Open Food Facts (free, 3M+ products) → USDA FoodData Central → Claude AI fallback.

### New Database Models

| Model | Purpose | Key constraint |
|---|---|---|
| `MealReplacement` | One replacement per meal slot per day | `@@unique([userId, date, mealIndex])` — upsert semantics |
| `FoodSearchCache` | 7-day TTL cache for combined search results | `@@unique([query, source])` |
| `RecentFoodLog` | Last 10 foods the user searched/logged | Indexed by `[userId, usedAt]` |

### Migration
```bash
# Already applied to Neon production on 2026-04-17
cd server
npx prisma migrate deploy --schema=src/prisma/schema.prisma
```

### New Environment Variables

| Variable | Where | Value |
|---|---|---|
| `USDA_API_KEY` | Vercel env vars (all environments) | `jR8QDTnz7KeQWGEgwQysUNzIBSBC6cY0OZ4KPMUk` |
| `AI_FOOD_ESTIMATE_DAILY_LIMIT` | Vercel env vars | `20` (default if unset) |

> **Action required**: Add these two env vars in the Vercel dashboard under
> Project Settings → Environment Variables for Production, Preview, Development.

### Food Data Sources

1. **Open Food Facts** (`openFoodFactsService.ts`) — Free, no API key, 8s timeout, up to 6 results, handles kJ→kcal conversion
2. **USDA FoodData Central** (`usdaService.ts`) — Free with API key, 8s timeout, nutrient IDs mapped, graceful fallback if key not set
3. **Claude AI** (`aiFoodService.ts`) — Fallback when OFF+USDA return <3 results; 20 requests/user/day rate limit; model: `claude-sonnet-4-20250514`

### Search Strategy (`food.ts /api/food/search`)
1. Check `FoodSearchCache` for unexpired combined results
2. `Promise.allSettled([OFF, USDA])` — parallel, either can fail gracefully
3. Deduplicate by normalized food name
4. If <3 results → call Claude AI for additional estimates
5. Cache combined results for 7 days
6. Passive cleanup deletes expired cache entries on each request

### Interaction Model

| Gesture | Action |
|---|---|
| Swipe left on meal card | Reveals terracotta "Replace Meal" action panel |
| Long press (mobile) | Context menu: Replace / Mark eaten |
| Right-click (desktop) | Same context menu |

### Component Architecture
```
MealsTab
├── SwipeableMealCard (per meal)
│   ├── ReplacedMealCard (if replaced — amber styling, undo button)
│   └── Normal meal card (if not)
└── MealReplacerSheet (bottom sheet modal with drag-to-dismiss)
    ├── MealReplacerSearch (screen 1: quick picks, recents, search)
    ├── MealReplacerResults (screen 2: live results with loading)
    ├── MealReplacerQuantity (screen 3: serving, quantity, live macros)
    └── MealReplacerAI (screen 4: natural language AI estimator)
```

### TrackerTab Integration
- `MealRow` shows ✏️ icon and actual food name for replaced meals
- Amber styling distinguishes replaced meals from normal ones
- Day totals in MealsTab use replacement macros when present

### State Management
- `mealReplacerStore.ts` — Zustand store with replacements keyed by `"YYYY-MM-DD-mealIndex"`
- Optimistic undo (instant UI update, revert on API failure)
- `fetchReplacementsForWeek()` loads all replacements on mount

### API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/food/search?q=&limit=` | GET | Combined multi-source search with caching |
| `/api/food/ai-estimate` | POST | Natural language AI macro estimation (rate-limited) |
| `/api/food/recent` | GET | Last 10 recent food logs for quick picks |
| `/api/meals/replace` | POST | Upsert replacement, auto-marks eaten, logs to recent |
| `/api/meals/replacements?date=` | GET | Replacements for a specific date |
| `/api/meals/replacements/week` | GET | All replacements for current week |
| `/api/meals/replace/:id` | DELETE | Delete replacement with ownership check |

### Accuracy Limitations
- Open Food Facts data is community-contributed; some entries may be inaccurate
- USDA provides lab-tested data but mostly US-centric foods
- AI estimates are approximations; marked with ✨ and muted styling in the UI
- All AI-estimated foods set `isAiEstimate: true` in the database

### Files Created (19)
```
server/src/services/foodTypes.ts
server/src/services/openFoodFactsService.ts
server/src/services/usdaService.ts
server/src/services/aiFoodService.ts
server/src/routes/food.ts
server/src/routes/meals.ts
server/src/prisma/migrations/20260417120000_add_meal_replacer/migration.sql
client/src/hooks/useSwipeGesture.ts
client/src/hooks/useLongPress.ts
client/src/hooks/useFoodSearch.ts
client/src/store/mealReplacerStore.ts
client/src/components/MealReplacerSheet.tsx
client/src/components/MealReplacerSearch.tsx
client/src/components/MealReplacerResults.tsx
client/src/components/MealReplacerQuantity.tsx
client/src/components/MealReplacerAI.tsx
client/src/components/FoodResultCard.tsx
client/src/components/ReplacedMealCard.tsx
```

### Files Modified (7)
```
server/src/prisma/schema.prisma     — added 3 models + User relations
server/src/app.ts                   — registered food + meals routes
client/src/types/index.ts           — added meal replacer types
client/src/components/MealsTab.tsx   — full rewrite with swipe/replace/context
client/src/components/MealRow.tsx    — replacement-aware with ✏️ badge
client/src/components/TrackerTab.tsx — fetches replacements, passes date prop
.gitignore                          — updated
```

---

# 6-Feature Drop (2026-04-17)

## Bug Fix: Post-Deploy Click Blocking

**Root cause**: `SwipeableMealCard` spread both `swipe.handlers` and `longPress.handlers` onto the same div. `longPress.onTouchStart` overrides `swipe.onTouchStart`, creating a race condition that caused taps to be swallowed and never dispatched to child buttons.

**Fix**: Rewrote `MealsTab.tsx` entirely, removing `SwipeableMealCard`. All meal interactions now use standard `<button onClick>` handlers with no touch/pointer event customisation.

---

## Feature 1 — Week Calendar Strip (MealsTab)

- `mealsCalendarOffset` in `appStore` (0 = current week, -1 = previous, max -8).
- Dates computed with `date-fns` (`startOfWeek(weekStartsOn:1)`, `addWeeks`, `addDays`).
- Forward navigation disabled when `offset >= 0`.
- `selectedDate` in `appStore` is shared between Meals and Tracker tabs.

---

## Feature 2 — Water Intake Logging

**Schema**: `WaterLog` with `@@unique([userId, date])` — one row per user per calendar day.

**Key decisions**:
- Use ISO date string (not timestamp) as key to avoid timezone edge cases.
- `POST /api/water` upserts using Prisma `@@unique` composite key.
- Tap glass N → set count to N; tap same glass again → decrement to N-1.
- Optimistic UI with revert on API failure.
- State stored in `appStore.waterByDate[date]` (−1 sentinel = not yet loaded).

---

## Feature 3 — Tracker Tab Enhancements

**Weekly + Monthly Adherence**: Two `AdherenceCard` components fed by `GET /api/tracker/summary?period=week` and `?period=month`. Fetched in `Promise.allSettled` to avoid serial waterfalls.

**Goal Countdown** (`GET /api/tracker/goal-countdown`):
- Latest `WeightLog` → current weight.
- `weeklyLossRate`: low=0.3kg, moderate=0.5kg, high=0.75kg/week.
- `weeksNeeded = (currentWeight - targetWeight) / weeklyLossRate`.
- `goalDate = today + weeksNeeded weeks`.
- Urgency threshold: `daysLeft <= 14`.

**Month Calendar**: `trackerCalendarMonth` in `appStore` (YYYY-MM), defaults to current month. Forward navigation capped at current month.

---

## Feature 4 — Collapsible Tip Categories

CSS `max-height` transition (0 → 2000px, 250ms ease-in-out) — no JS height measurement or library needed for static content. State persisted in `localStorage` under key `tipsExpandedSections`. Default: all collapsed except `prep-guide`.

---

## Feature 5 — Weekly Meal Prep Guide

**Decision**: Embed prep guide generation inside the existing AI call (same JSON blob) — no extra API round-trip.

**Storage**: `MealPlan.mealPrepGuide Json?` (JSONB). Null for pre-feature plans → fallback UI prompts user to regenerate.

**API**: `GET /api/plan/meal-prep-guide` returns the active plan's `mealPrepGuide`.

---

## Feature 6 — Plan Duration Choice (7 or 14 days)

**Schema**: `planDuration Int @default(7)` on both `UserProfile` (preference) and `MealPlan` (snapshot at generation time). Snapshot ensures historical plans render correctly if user later switches.

**AI**: Separate `SYSTEM_PROMPT_7` / `SYSTEM_PROMPT_14`. 14-day prompt instructs Claude to maximise variety across two weeks. `maxTokens` = 14000 for 14-day plans vs 8000 for 7-day.

**Validation**: `planData.days.length !== expectedDays` throws — prevents partial plans from being stored.

**Plan day index**: `weekData` ordered by `dayIndex` (0-indexed). For 14-day plans, days 0–13 map to dates starting from `weekStartDate`.

**PATCH `/api/profile/plan-duration`**: Lightweight single-field update in `ProfileTab` so user can change preference without re-POSTing full profile.

---

## Database Migration (20260417200000_water_prep_plan_duration)

Applied with `npx prisma migrate deploy --schema=src/prisma/schema.prisma`.

```sql
ALTER TABLE "MealPlan" ADD COLUMN "planDuration" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "MealPlan" ADD COLUMN "mealPrepGuide" JSONB;
ALTER TABLE "UserProfile" ADD COLUMN "planDuration" INTEGER NOT NULL DEFAULT 7;
CREATE TABLE "water_logs" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  glasses INTEGER NOT NULL,
  "goalGlasses" INTEGER NOT NULL,
  "loggedAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ,
  UNIQUE("userId", date)
);
```

**Breaking changes**: None. All new columns have DEFAULT values; existing rows are unaffected.

---

## Shared Date State

`selectedDate` (ISO `YYYY-MM-DD`) in `appStore` is the single source of truth for both Meals and Tracker tabs. `navigateToMealsFromTracker(dayIndex, date)` sets it and switches tabs simultaneously so tapping a Tracker day → "View Meal Plan" opens Meals on that exact date.

---

# Bug Fixes & Feature Enhancements — 2026-04-17 (second drop)

## Files Changed

| File | Description |
|---|---|
| `client/src/components/WaterIntakeCard.tsx` | Rewritten as compact single-row dot grid |
| `client/src/components/MacroAchievementCard.tsx` | New — daily macro consumed vs. target card |
| `client/src/components/MealsTab.tsx` | Added MacroAchievementCard below water row |
| `client/src/components/TrackerTab.tsx` | Fixed calendar nav timezone bug |
| `client/src/components/Onboarding.tsx` | Country-linked city dropdown, numeric input fix, grouped cuisine, IF windows, mandatory steps 5+6 |
| `client/src/data/onboarding.ts` | Added CUISINE_OPTIONS (grouped), COUNTRY_CODES map |
| `client/src/types/index.ts` | Added IF window fields + avoidNone to OnboardingData |
| `server/src/prisma/schema.prisma` | Added countryCode, eatingWindowHours, fastingWindowHours, eatingStartTime, eatingEndTime to UserProfile |
| `server/src/prisma/migrations/20260417210000_if_windows_country_code/migration.sql` | SQL for new UserProfile columns |
| `server/src/routes/profile.ts` | Save new IF/countryCode fields from POST body |
| `server/src/routes/ai.ts` | Filter __none__ from avoidIngredients; include IF window details in prompt |

## Migration Command

```bash
cd server && npx prisma migrate deploy --schema=src/prisma/schema.prisma
```

Applied migration: `20260417210000_if_windows_country_code`

## __none__ Sentinel for avoidIngredients

- **Frontend**: when user taps "I have no ingredients to avoid", `avoidIngredients` is set to `['__none__']` and `avoidNone: true` in local state.
- **Backend profile save**: the array is saved as-is to `UserProfile.avoidIngredients`.
- **AI prompt builder** (`routes/ai.ts`): `avoidRaw.filter(a => a !== '__none__')` strips the sentinel before building the Claude prompt, so Claude never sees it.
- **Step 6 gating**: `canNext()` for step 6 checks `avoidIngredients.length > 0 || avoidNone === true` — both `['__none__']` and real selections satisfy this.

## Eating Window Hours and End Time Calculation

- `eatingWindowHours`: user-editable (4–20 hours), stored as `Int?` in `UserProfile`.
- `fastingWindowHours`: computed as `24 - eatingWindowHours`, stored as `Int?`.
- `eatingStartTime`: user-set time picker (HH:MM string), stored as `String?`.
- `eatingEndTime`: computed as `eatingStartTime + eatingWindowHours`, stored as `String?`.
- Calculation: `(startHour + eatingWindowHours) % 24`, zero-padded to HH:MM.
- AI prompt includes: `"Eating Xh (HH:MM–HH:MM), fasting Yh. Schedule all meals within the eating window."`
- Old `16_8`/`18_6` values are handled with backward-compat defaults in the prompt builder.

## Calendar Navigation Race Condition Fix (TrackerTab)

**Root cause**: `getMonthStr` used `date.toISOString().slice(0, 7)` which returns UTC time. `parseISO('YYYY-MM-01')` parses as LOCAL midnight (date-fns v2 behaviour for date-only strings). In UTC+ timezones (e.g. IST = UTC+5:30), `parseISO('2026-04-01')` = March 31 18:30 UTC, so `toISOString()` returned `'2026-03'` — making every ← click subtract TWO months instead of one.

**Fix**: Replace `getMonthStr` with `format(date, 'yyyy-MM')` from date-fns (local time). Also fixed `todayStr()` in TrackerTab and `currentMonthStr` to use `format()` for consistency. This ensures `parseISO` and `getMonthStr` both use local time, making the arithmetic correct in all timezones.

## City Data Limitations

The `country-state-city` npm package uses GeoNames database which covers major cities globally. **Limitations**:
- Smaller towns (<50k population) are often missing.
- Some countries have incomplete state coverage.
- Village-level settlements are not included.
- **Fallback**: "City not listed? Type it manually" link switches to a free-text input so no user is blocked.
- Countries not in `COUNTRY_CODES` map default to empty ISO code → free-text city input shown directly.

---

# Monthly Calorie Chart + Circular Macro Rings (2026-04-17)

## Files Created / Modified

| File | Action | Description |
|---|---|---|
| `client/src/components/MonthlyCalorieChart.tsx` | Created | Monthly calorie bar chart with cumulative progress bar and insight line |
| `client/src/components/CircularMacroRing.tsx` | Created | Reusable SVG circular ring component + MACRO_COLORS |
| `client/src/components/MacroAchievementCard.tsx` | Modified | Replaced horizontal bars with circular ring grid |
| `client/src/components/TrackerTab.tsx` | Modified | Added MonthlyCalorieChart below GoalCountdown, above calendar |
| `server/src/routes/tracker.ts` | Modified | Added GET /api/tracker/monthly-calories endpoint |

## Monthly Calorie Delta Calculation (Partial Logging)

For each day that falls within `[planStartDate, today]` in the requested month:
- For each meal slot `0..mealsPerDay-1`:
  - If a `MealReplacement` exists for `(userId, date, mealIndex)`: use `replacement.calories` (replacements are explicitly logged, so they always count as consumed)
  - Else if `MealLog.eaten = true` for that slot: look up `planDay.meals[mealIndex].calories`
  - Else: 0
- Days with no logged meals contribute `0` consumed calories but still count against the cumulative target (i.e., uneaten plan days show as deficit)

This matches the same logic used in `MacroAchievementCard` on the client.

## Plan Day Index Derivation (Modulo Logic)

```typescript
const daysSinceStart = Math.floor((dateMs - planStartMs) / 86400000);
const planDayIndex   = daysSinceStart % planDuration;
```

- For a 7-day plan: day 0–6 maps to days 0–6, day 7 wraps back to day 0, etc.
- For a 14-day plan: days 0–13 map directly; day 14 wraps to day 0.
- `planDuration` is read from `UserProfile.planDuration` (default 7).
- Handles rolling weeks correctly — no hard-coded calendar week assumption.

## Circular Ring SVG — Over-100% Visual Cap

```typescript
const pct = target > 0 ? Math.min(consumed / target, 1) : 0;
```

- `pct` is capped at 1.0 (100%) for the `strokeDashoffset` calculation, so the ring never overflows its track.
- `isOver = consumed > target` uses the uncapped value to detect over-target state.
- When over: ring colour changes to `#DC2626` (red) and the percentage still reads the capped value (100%).
- The raw consumed/target numbers shown below the ring are always actual values, so the user sees the true overage.
- Near-target (90–100%): ring colour transitions to `#F0B429` (amber) as a warning.

## Monthly Chart ↔ Calendar Month Sync

`MonthlyCalorieChart` reads `trackerCalendarMonth` directly from `useAppStore()`. When the user navigates the Tracker calendar with the `←`/`→` buttons, `setTrackerCalendarMonth` is called in `appStore`, which updates the Zustand state. The chart's `useEffect` depends on `trackerCalendarMonth` and re-fetches `GET /api/tracker/monthly-calories?month=YYYY-MM` whenever it changes. No prop-drilling or event bus needed — both components share the same atom of state.

## 2026-04-18 — UI overhaul: macro rings, tracker summary, monthly totals fix

### Files modified
- `client/src/components/CircularMacroRing.tsx` — resized, label moved below, new colour logic
- `client/src/components/MacroAchievementCard.tsx` — smaller ring sizes, tighter gaps, flush row 2
- `client/src/components/TrackerTab.tsx` — removed radial weekly adherence card + large goal card; replaced 2-col adherence grid with 3-col summary (Week | Month | Goal)
- `server/src/routes/tracker.ts` — fixed monthly plan-day count; fixed `totalPlanDaysInMonth` in monthly-calories endpoint

### Change 1 — CircularMacroRing resize + new colour logic

**Size reduction:** Row 1 rings 88px → 56px; Row 2 rings 96px → 64px; strokeWidth 8 → 5; card padding 14/16px → 10/12px; row gap 12px → 6px. Label moved from above the ring to below the consumed/target text.

**New colour logic (replaces per-macro baseColor system):**
```
> 100% consumed → #DC2626 (red)
80–100%          → #4CAF82 (green)
< 80%            → #F0B429 (amber)
```
Applied to: SVG ring stroke, centre % text, consumed number.

**Over-100% ring rendering:** `strokeDashoffset` is capped at 0 (full ring) when `pct >= 1`, but the text shows the real uncapped percentage (e.g. `124%` in red). No wrap-around animation.

### Change 2 — Monthly total meals fix

**Root cause:** The summary endpoint used `getPlanDates()` (current week only) to intersect with month dates, giving a maximum of 7 plan days regardless of month length. The monthly-calories endpoint set `totalPlanDaysInMonth = daysInMonth` (all 28–31 calendar days).

**Fix:** Both endpoints now query the active `MealPlan.weekStartDate`, derive `planStartLocal`, then:
- Denominator (`total`/`totalPlanDaysInMonth`): all dates in the month that are `>= planStartLocal` (no future cap, so it represents the full plan scope for that month)
- Numerator (`eaten`/`planDaysElapsed`): dates that are `>= planStartLocal && <= today`

**Edge cases handled:**
- Plan starts mid-month: only days on/after plan start are counted
- 14-day plan spanning two months: modulo arithmetic in monthly-calories already handles rolling plan days; the count fix just ensures the denominator reflects actual plan days not all calendar days
- Future months: `validDates` will be empty → returns the empty response
- No active plan: `planDatesInMonth = []`, total = 0, adherencePct = 0

### Change 3 — Removed weekly adherence rectangular section

Removed the large `bg-surface rounded-2xl` card that contained a `RadialBarChart` (recharts), weekly adherence %, streak count, and remaining meals count. Also removed:
- `RadialBarChart, RadialBar, ResponsiveContainer` imports from recharts
- `adherenceData` array variable (was only used in the radial chart)
- `useCallback`, `endOfMonth`, `getYear`, `getMonth` unused imports

The `stats?.streak` and `stats?.remaining` data is no longer shown. The adherence % is still surfaced via the "This Week" card in the 3-col summary.

### Change 4 — 3-column summary row

Replaced the 2-col adherence grid + large goal countdown card with a single `display: grid; grid-template-columns: repeat(3, 1fr)` row containing:
- **AdherenceCard (This Week):** pct%, eaten/total meals, 4px green progress bar
- **AdherenceCard (This Month):** same structure, uses corrected monthly totals from Change 2
- **GoalCard:** big number (`Xwks` / `Xd` / `🎉`), target weight + date sub-label
  - Colour: white (>4 weeks), amber (#F0B429, 1–4 weeks), red (#DC2626, <7 days), green (goal reached)

All three cards share the same inline style: `background:#1A1D27, border:1px solid #2A2D3E, borderRadius:12px, padding:12px 10px, textAlign:center`.

## 2026-04-18 — Arc gauge instrument cluster (macro dashboard)

### Files modified
- `client/src/components/CircularMacroRing.tsx` — replaced entirely with `ArcGauge` component (270° SVG arc + glow filter); legacy `CircularMacroRing` re-exported as alias for safety
- `client/src/components/MacroAchievementCard.tsx` — replaced circular ring grid with dark dashboard panel using `ArcGauge`
- `client/src/components/MealsTab.tsx` — no changes required (same import/props interface)

### Arc path geometry (270° speedometer arc)
Using angle convention: 0° = top, 90° = right, 180° = bottom, 270° = left (clockwise).

- **Start**: 225° → lower-left point `(cx − r·cos45°, cy + r·sin45°)`
- **End**:   135° → lower-right point `(cx + r·cos45°, cy + r·sin45°)`
- **SVG arc**: `M start A r r 0 1 1 end` — large-arc=1 (270°>180°), sweep=1 (clockwise)
- **Gap**: 90° at the bottom — the remaining counterclockwise path from 135° to 225°

Fill uses `strokeDasharray = arcLength` and `strokeDashoffset = arcLength * (1 − fillPct)`.
`fillPct` is capped at 1 so the ring never over-shoots visually, but `displayPct` is uncapped for text (can show 124%).

### Glow filter scoping
Each `ArcGauge` embeds its own `<defs><filter id="glow-macro-LABEL">` inside its SVG element. The ID is derived from the label string (non-alphanumeric chars stripped). Since the five labels (PROTEIN, CALORIES, CARBS, FAT, FIBRE) are unique per page, there is no cross-gauge bleed. The filter is applied only to the progress arc path, not the track arc.

### Centre Calories gauge prominence
- `size={160}` vs `size={80}` for small gauges — 4× the area
- `strokeWidth={14}` vs `strokeWidth={8}`
- CSS grid column `1.8fr` gives the centre column extra width
- `isCenter` flag suppresses the label-above slot and renders a richer inner layout: "Calories" label + large 28px % + consumed/target line + "kcal" unit
- Small gauges in rows 1 and 2 flank the large centre; an empty `<div>` in Row 2 Col 2 keeps Fat/Fibre aligned under Protein/Carbs

## 2026-04-18 — Macro band delta lines + Monthly Macro Tracker with dropdown

### Files modified
- `client/src/components/MacroBand.tsx` — delta line, 80/110 thresholds, CSS vars
- `client/src/components/MonthlyCalorieChart.tsx` — full rewrite to Monthly Macro Tracker
- `server/src/routes/tracker.ts` — added `/monthly-macros` endpoint; `/monthly-calories` kept as-is

### Deficit direction per macro
- **Calories, Carbs, Fat** (`deficitGood: true`): being under target is good (fat-loss deficit). Delta shown green when under, red when over. Insight line uses "healthy deficit" language.
- **Protein, Fibre** (`deficitGood: false`): being under target is bad. Delta shown red when under, amber when over (not critical). Insight line uses "prioritise protein-rich foods" language.

The MacroBand always shows deficit as green (simplified for the daily view). The monthly tracker insight respects the per-macro direction.

### Backend `/monthly-macros` per-day computation
For each calendar day in [planStart, today]:
1. Derive `planDayIndex = daysSinceStart % planDuration`
2. Load plan meals JSON for that index
3. For each meal slot 0..mealsPerDay-1:
   - If `MealReplacement` exists for that slot → use `rep.calories / proteinG / carbsG / fatG / fibreG`
   - Else if `MealLog.eaten = true` → use plan meal's `calories / protein / carbs / fat / fibre`
   - Else → 0 for all macros
4. Sum across slots → day's consumed for all 5 macros simultaneously

`totals[macro].target = targets[macro] * planDaysElapsed` (elapsed days × daily target)

### `monthly-calories` backward compatibility
The old endpoint is untouched. `MonthlyCalorieChart.tsx` now calls `/monthly-macros` instead. Both endpoints coexist; no alias needed since the old one was only used by this component.

### Transition on macro switch
`useRef(true)` guards the first render so no fade fires on mount. Subsequent `selectedMacro` changes set `fading=true` (opacity 0, 150ms) then back to false (opacity 1). The entire content area (stats, chart, progress bar, insight) fades as a unit.

## 2026-04-19 — Meal plan visibility bugs (Bug 1 + Bug 2)

### Files modified
- `server/src/routes/tracker.ts` — fix Sunday bug in `getMondayOfCurrentWeek()`
- `server/src/routes/ai.ts` — same Sunday bug fix for `weekStartDate` computation
- `server/src/routes/plan.ts` — Sunday bug fix + Bug 1 fallback + null-safe JSON + return `weekStartDate`/`planDuration`
- `client/src/hooks/usePlan.ts` — sync `planDuration` from plan API into store

### Bug 1 — Old accounts cannot see AI-generated plans

**Root cause**: `POST /api/ai/generate-meal-plan` deactivates ALL existing active plans
(`mealPlan.updateMany({ isActive: false })`) BEFORE the new plan is created. If the AI
call subsequently fails (max_tokens, JSON parse error, network timeout), the old plan is
permanently deactivated and no new active plan exists. `GET /api/plan` had no fallback —
it dropped straight to the hardcoded `MEAL_PLAN` (generic meals, not the user's plan).

**Fix**: `GET /api/plan` now checks if `activePlan` is null or has zero days, and if so
queries for the most recently generated plan regardless of `isActive`. If found, it calls
`mealPlan.update({ isActive: true })` to re-activate it before returning it. This is
idempotent and safe: the most-recent plan is always the user's intended plan.

Also added try/catch null safety around `JSON.parse(d.meals)` and `JSON.parse(weekSummary)`
so a corrupted JSON string in an old row cannot crash the response.

### Bug 2 — Plan shows no meals on Sundays (plan activation from "next Monday")

**Root cause**: `getMondayOfCurrentWeek()` in all three server files used:
```typescript
const diff = day === 0 ? 1 : 1 - day;  // BUG: Sunday gives diff=+1 → NEXT Monday
```
On Sunday (`day = 0`): `diff = 1` → `monday = next day (Monday)`. This is NEXT Monday.

Consequences:
1. `tracker.ts` `getPlanDates()` → returned NEXT week's dates on Sundays. Today (Sunday)
   was not in the returned date array → `isPlanDate = false` → "No meal plan for this date".
2. `ai.ts` `weekStartDate` → set to NEXT Monday when generating on Sunday. Monthly tracker
   `planStartLocal` = next Monday, so Sunday was before plan start → excluded from charts.

**Fix**: Change formula to `day === 0 ? -6 : 1 - day` in all three server files.
- Sunday: `-6` → goes back to the PREVIOUS Monday (current week's Monday). ✓
- Monday: `1-1 = 0` → stays today. ✓
- Saturday: `1-6 = -5` → goes back 5 days to Monday. ✓ (unchanged)

The client-side `getWeekStartStr()` in TrackerTab.tsx already uses `date-fns`
`startOfWeek(today, { weekStartsOn: 1 })` which handles Sunday correctly. Only the server
was broken. No frontend changes needed for this bug.

### `planDuration` sync
`GET /api/plan` now returns `planDuration` and `weekStartDate` in the JSON response.
`usePlan.ts` calls `setPlanDuration(res.data.planDuration)` when this field is present,
ensuring the frontend store has the authoritative value from the DB (not only from the
tracker's stats response).

### SQL patches — run in Neon SQL editor after deploying

```sql
-- 1. Ensure planDuration is set for any old plans that might have NULL
UPDATE meal_plans
SET "planDuration" = 7
WHERE "planDuration" IS NULL;

-- 2. For each user, mark only their MOST RECENT plan as active
--    (deactivate all others to remove duplicates)
UPDATE meal_plans
SET "isActive" = false
WHERE id NOT IN (
  SELECT DISTINCT ON ("userId") id
  FROM meal_plans
  ORDER BY "userId", "generatedAt" DESC
);

-- 3. Ensure the remaining plan per user IS marked active
UPDATE meal_plans
SET "isActive" = true
WHERE id IN (
  SELECT DISTINCT ON ("userId") id
  FROM meal_plans
  ORDER BY "userId", "generatedAt" DESC
);

-- 4. Verification: check result (should show one active plan per user)
SELECT "userId", id, "isActive", "weekStartDate", "generatedAt", "planDuration"
FROM meal_plans
ORDER BY "generatedAt" DESC
LIMIT 20;
```

---

## Plan Review Screen — no-lock implementation (2026-04-26)

### Files Created
- `client/src/components/PlanReviewScreen.tsx` — Review screen shown after generation and re-generation. Fetches `GET /api/plan/review/:mealPlanId`, renders day accordions with ↻ CHANGE buttons and a CONFIRM PLAN footer.
- `client/src/components/SingleMealRegenerateSheet.tsx` — Slide-up sheet. Screen 1: instructions + quick hints → `POST /api/plan/regenerate-single-meal` (3 options). Screen 2: pick option → `PATCH /api/plan/select-meal`.

### Files Modified
| File | Change |
|---|---|
| `server/src/prisma/schema.prisma` | Added `reviewConfirmed Boolean @default(false)` and `reviewConfirmedAt DateTime?` to `MealPlan`. |
| `server/src/routes/ai.ts` | Removed `onboardingDone: true` from generation. It is now set exclusively by `confirm-review`. |
| `server/src/routes/plan.ts` | Added `GET /review/:mealPlanId`, `POST /regenerate-single-meal`, `PATCH /select-meal`, `POST /confirm-review`. |
| `client/src/store/appStore.ts` | Added `showPlanReview`, `planReviewMealPlanId`, `openPlanReview()`, `closePlanReview()`. |
| `client/src/components/Onboarding.tsx` | Switched to `PlanReviewScreen` after generation; defers `refreshUser` until after `confirm-review`. |
| `client/src/components/ProfileTab.tsx` | Shows `PlanReviewScreen` instead of old success screen after re-generation. |

### changedMeals tracking
Local `Record<string, boolean>` in `PlanReviewScreen` keyed by `"dayIndex-mealIndex"`. Session-only — not persisted, resets on unmount. Provides ✓ CHANGED indicator only.

### No locking
No `lockedMeals` field exists. `↻ CHANGE` always visible. `reviewConfirmed` records that the user finished their review session — no meal-level semantics.

### Migration
`npx prisma db push --schema src/prisma/schema.prisma` — backward-compatible nullable fields.

### Build
TypeScript: 0 errors | Vite: ✓ built in 4.94s

---

## On-Demand Cooking Instructions + Audio Guide

### Date
2026-04-26

### Files created
- `client/src/hooks/useAudioGuide.ts` — Web Speech API hook with play/pause/stop and progress tracking

### Files modified
- `server/src/prisma/schema.prisma` — added `MealCookingInstructions` model + `User.cookingInstructions` relation
- `server/src/routes/meals.ts` — added 3 endpoints (GET instructions, POST generate, POST generate-audio)
- `client/src/types/index.ts` — added `MealCookingInstructions`, `CookingIngredient`, `CookingStep` interfaces
- `client/src/store/appStore.ts` — added `activePlanId: string | null` + `setActivePlanId`
- `client/src/hooks/usePlan.ts` — captures `mealPlanId` from `/api/plan` response, stores in `activePlanId`
- `client/src/components/MealDetailSheet.tsx` — added COOKING INSTRUCTIONS accordion section
- `client/src/components/MealsTab.tsx` — passes `mealPlanId={activePlanId}` and `dayIndex` to MealDetailSheet

### Audio approach
**Option A — Web Speech API** (as specified). No file storage, no TTS API costs.  
`POST /api/meals/instructions/generate-audio` builds a speech-friendly plain-text script  
and stores it in `audioScript` (DB). The frontend `useAudioGuide` hook feeds that text into  
`window.speechSynthesis`, with play/pause/stop controls and a linear progress bar.  
`audioUrl` field was omitted from the schema entirely (not needed for Option A).

### Three sheet states in MealDetailSheet
1. **Not generated** — "GENERATE INSTRUCTIONS" button (shown while `cookInstr === null && !cookLoading`)
2. **Generating** — "GENERATING… About 10 seconds" (shown while `cookGenerating === true`)
3. **Loaded** — Full accordion: time strip, audio player, grouped ingredients, numbered steps, tips, substitution, regenerate link

State lives in local `useState` hooks inside `MealDetailSheet` (no Zustand store needed — not persisted cross-session, fetched fresh each open).

### Rate limits
- Text instructions: 20 per user per day (daily count via Prisma)
- Audio scripts: 10 per user per day

### DB unique key
`@@unique([userId, mealPlanId, dayIndex, mealIndex])` — upsert-safe; regeneration overwrites existing text, resets `audioScript` to `null` forcing re-generation of audio.

### Migration
`npx prisma db push --schema src/prisma/schema.prisma` applied successfully.  
New table: `meal_cooking_instructions`.

### Build
TypeScript (client): 0 errors  
TypeScript (server): 0 errors  
Vite: ✓ built in 4.77s  
Commit: dc01611 — pushed to main → Vercel deploy triggered

---

## iOS Safari Blank Screen Fix — 2026-04-27

### Symptoms
App loaded all JS files (from service worker cache, no 404s) but React never mounted on iOS 18.4 Safari. Browser console was completely empty — crash was silent, no error messages visible.

### Diagnosis
Two likely root causes identified:
1. **Stale SW cache serving old `index.html`** with outdated content-hashed JS chunk filenames after a deploy. The `navigateFallback: '/index.html'` Workbox option caused ALL navigate requests to be served from the precache (CacheFirst). If the SW's precached `index.html` was stale, it referenced old chunk names → JS files loaded but the app code was from a previous deploy.
2. **Silent runtime crash** — something threw before React mounted, but with no `window.onerror` handler and no React to catch it, nothing was shown to the user.

### Fixes Applied (8 total)

**Fix 1 — @vitejs/plugin-legacy**
- Installed `@vitejs/plugin-legacy@5` (Vite 5 compatible) + `regenerator-runtime`
- Added to vite.config.ts targeting iOS >= 13, Safari >= 13
- `modernPolyfills: true` injects core-js polyfills into the modern build (loaded on iOS 18.4)
- `renderLegacyChunks: true` generates ES5 bundles for `<script nomodule>` browsers
- **Note**: Legacy plugin OOMs locally with default Node heap (8 MB main chunk × 2 = 16 MB transpilation). Fixed by updating `package.json` build script: `node --max-old-space-size=4096 ./node_modules/.bin/vite build`
- `@vitejs/plugin-legacy@8` is ESM-only and requires Vite 6 — pinned to v5 for Vite 5 compatibility
- `build.target` removed from vite.config (legacy plugin sets it automatically; explicit value generates a warning)

**Fix 2 — Global error handler in index.html**
- Added `window.addEventListener('error', ...)` and `window.addEventListener('unhandledrejection', ...)` scripts in `<head>` before any other scripts
- On error: replaces `document.body.innerHTML` with a red debug panel showing: message, filename, line:col, user agent string
- On unhandled rejection: shows reason, full stack trace, user agent string
- Both include a "Reload App" button
- This makes any crash visible on screen on iPhone instead of showing a blank black page

**Fix 3 — Service worker: NetworkFirst for navigation**
- **Root cause**: `navigateFallback: '/index.html'` in workbox config made Workbox serve the precached (potentially stale) `index.html` for ALL navigate requests (CacheFirst)
- **Fix**: Removed `navigateFallback`. Added `runtimeCaching` entry for `request.mode === 'navigate'` with `handler: 'NetworkFirst'` and `networkTimeoutSeconds: 5`
- Result: on every page load, the browser fetches fresh `index.html` from the network. If network fails (offline), falls back to the cached version. Ensures new deploys immediately deliver updated chunk filenames.

**Fix 4 — iOS polyfills in main.tsx**
- `structuredClone` — missing on iOS < 15.4. Polyfilled with `JSON.parse(JSON.stringify(obj))`
- `crypto.randomUUID` — missing on iOS < 15.4 in non-secure contexts. Polyfilled with Math.random UUID generator
- `Promise.allSettled` — missing on iOS < 13. Polyfilled with Promise.all + catch
- `Array.prototype.at` — missing on iOS < 15.4. Polyfilled with index normalization
- All polyfills placed at the very top of `main.tsx` before any imports

**Fix 5 — Enhanced error boundary**
- Existing `RootErrorBoundary` enhanced to show: full error stack trace, User-Agent string, "Reload App" button
- Previous version only showed `error.message` — not enough to diagnose iOS-specific failures
- Stack trace wrapped in `<pre>` with `white-space: pre-wrap; word-break: break-all` for mobile readability

**Fix 6 — SW version meta tag + SW registration with updateViaCache: 'none'**
- Added `<meta name="sw-version" content="4">` to index.html to track SW cache generations
- SW registration in `main.tsx` now uses `updateViaCache: 'none'` — tells browser to NEVER use HTTP cache when fetching the SW file itself. Critical for iOS Safari which aggressively caches the SW script. Without this, the browser can serve a stale SW version for up to 24 hours.
- Added `reg.update()` call after registration to trigger an immediate SW update check on every page load

**Fix 7 — No top-level await or private class fields found**
- `grep -rn "^await " client/src/` — 0 results
- `grep -rn "#[a-zA-Z]" client/src/` — 0 results (only CSS hex colour strings matched)
- No fixes needed

**Fix 8 — .browserslistrc**
- Created `client/.browserslistrc` targeting iOS >= 13, Safari >= 13, Chrome >= 80, Firefox >= 80
- Informs `@babel/preset-env` (used by legacy plugin) and any other browserslist-aware tools

### Build Output
```
Modern build: polyfills-nau8mE71.js (118.87 kB) — core-js for modern browsers
Legacy build: polyfills-legacy-D9xoPjy5.js (118.49 kB) — ES5 for old browsers
             + *-legacy-*.js chunks for all code-split routes
PWA: 46 entries precached (up from 31 — legacy chunks added)
```
The `index-legacy-*.js` (8.1 MB) exceeds `maximumFileSizeToCacheInBytes: 4 MB` and is not precached — served from network on legacy browsers (expected, acceptable).

### Files Modified
| File | Change |
|---|---|
| `client/vite.config.ts` | Added `@vitejs/plugin-legacy`, removed `navigateFallback`, added NetworkFirst runtime caching for navigate, removed explicit `build.target` |
| `client/index.html` | Added global `window.error`/`unhandledrejection` handlers, `<meta name="sw-version">` |
| `client/src/main.tsx` | Added 4 polyfills at top, enhanced error boundary with stack+UA, added `updateViaCache: 'none'` + `reg.update()` to SW registration |
| `client/.browserslistrc` | Created (iOS >= 13, Safari >= 13, Chrome >= 80, Firefox >= 80) |
| `client/package.json` | Build script: `node --max-old-space-size=4096 ./node_modules/.bin/vite build` to avoid OOM with legacy plugin |

### Expected Outcome
**Scenario A — The app now works**: The NetworkFirst SW fix (Fix 3) resolved the stale cache issue. Deploy confirmed this.  
**Scenario B — Red error screen appears**: The global handler (Fix 2) or enhanced error boundary (Fix 5) caught the crash and displayed the exact error message. Take a screenshot to identify the next fix.

---

# 4-Feature Drop — 2026-05-01

## Feature 1 — Monthly Macros Chart: Selectable Month

### Files modified
- `client/src/components/MonthlyCalorieChart.tsx`

### Decision
Added `← MONTH YEAR →` navigation to `MonthlyCalorieChart` using the existing `trackerCalendarMonth` / `setTrackerCalendarMonth` Zustand atoms already shared with the Tracker calendar. No new state was introduced — both the chart and the calendar grid respond to the same atom. Forward navigation is capped at the current calendar month to prevent browsing the future. The empty-state path (no data returned from `/api/tracker/monthly-macros`) was already handled by the chart's existing zero-data render.

### Key code patterns
- `navigateMonth(dir: -1 | 1)` computes the neighbouring month with pure arithmetic (no date-fns dependency) and guards against `next > currentMonthStr`.
- `[chartY, chartM]` destructured from the YYYY-MM string drive the `MONTH_NAMES[chartM - 1]` label.
- Nav buttons share the same `s2.mono` / `s2.textDimmer` micro-label style as the rest of the Strain v2 UI.

---

## Feature 2 — Meal Plan Generation Limits (2 full regenerations / month)

### Files modified
- `server/src/prisma/schema.prisma` — new `PlanGenerationUsage` model + `User.planGenerationUsage` relation
- `server/src/routes/ai.ts` — `MONTHLY_REGEN_LIMIT`, `checkAndIncrementGenerationLimit`, guard inside `POST /api/ai/generate-meal-plan`
- `server/src/routes/plan.ts` — new `GET /api/plan/generation-usage` endpoint
- `client/src/components/ProfileTab.tsx` — fetches usage, shows badge + warning, passes `disabled` to customiser
- `client/src/components/MealPlanCustomiser.tsx` — added `disabled` prop; button text = `MONTHLY LIMIT REACHED`

### Decision: limit discriminator
`user.onboardingDone` is the exact discriminator for "is this a first-time generation?". Onboarding generation always has `onboardingDone = false` (the flag is set by `confirm-review` AFTER onboarding completes). Subsequent regenerations have `onboardingDone = true`. This cleanly separates the two cases with zero new flags.

### Decision: single-meal regeneration excluded
`POST /api/plan/regenerate-single-meal` does NOT call `checkAndIncrementGenerationLimit`. The limit applies only to full 7/14-day plan regenerations triggered by `POST /api/ai/generate-meal-plan`. The distinction is structural — they are separate route handlers.

### Decision: upsert-then-check pattern
`prisma.planGenerationUsage.upsert({ create: { count: 0 }, update: {} })` retrieves or initialises the row without incrementing. The increment (`{ count: { increment: 1 } }`) happens in a separate `.update()` call only after the limit check passes. This avoids an off-by-one error where the first call of the month would consume a generation before returning the "allowed" response.

### Migration
`npx prisma db push --schema src/prisma/schema.prisma` applied. New table: `plan_generation_usage` with `@@unique([userId, month])` composite key.

### 429 response format
```json
{ "error": "monthly_limit_reached", "message": "...", "resetsOn": "1 June", "used": 2, "limit": 2 }
```
Frontend catches this from the SSE stream's non-ok pre-flight or from a direct 429 before the stream opens.

---

## Feature 3 — Imperial Units in Signup (Onboarding StepBody)

### Files modified
- `client/src/components/Onboarding.tsx` — `StepBody` function rewritten with metric/imperial toggle

### Decision: always store metric
All values are converted to metric before calling `update()`. The `unitSystem` toggle is purely a display preference. The database (`UserProfile.heightCm`, `weightKg`, `targetWeightKg`) always stores metric SI values. This avoids a schema change to the stored units and keeps the AI prompt, TDEE calculation, and all backend logic untouched.

### Decision: unitSystem in UserProfile schema
Added `unitSystem String @default("metric")` to `UserProfile` so the preference persists across sessions. Saved via the existing `PATCH /api/profile` route (no new endpoint needed).

### Conversion functions (client-side only)
```
lbToKg(lb)        → lb / 2.20462
kgToLb(kg)        → kg * 2.20462
cmToFtIn(cm)      → { ft: floor(cm/30.48), in: round((cm%30.48)/2.54) }
ftInToCm(ft, in)  → ft*30.48 + in*2.54
```
All helper functions live above `StepBody` in `Onboarding.tsx` — no shared utility file needed since they are only used in one place.

### Imperial height: two separate inputs
Imperial height uses `heightFt` + `heightIn` local states. Both call `ftInToCm()` on every change and call `update({ heightCm: result })`. This keeps the parent state in metric at all times while the UI reflects feet and inches.

### Toggle conversion
`handleUnitToggle` reads the current metric values and converts them to/from imperial display strings when the user switches. This prevents the displayed values from jumping when toggling — the user sees their input preserved across both unit systems.

---

## Feature 4 — Share Shopping List as Text Message

### Files created
- `client/src/components/ShoppingShareSheet.tsx`

### Files modified
- `client/src/components/ShoppingTab.tsx` — added `↗ SHARE` button in header; renders `ShoppingShareSheet`

### Decision: share text format
Unbought items appear first (grouped by category with emoji headers), bought items appear at the bottom as a flat `─── Already bought ───` section. Category emoji is resolved via a keyword map (`CATEGORY_EMOJI`) — no AI call, no API round-trip. Unknown categories fall back to 🛒.

### Decision: three share options
1. **Web Share API** (`navigator.share`) — shown only when `navigator.share` is available (iOS Safari, Android Chrome). Opens the native OS share sheet for Messages, AirDrop, Mail, Notes, etc.
2. **WhatsApp** (`https://wa.me/?text=...`) — always shown. Opens WhatsApp with the list pre-filled. Works on any device with WhatsApp installed; gracefully opens the web client otherwise.
3. **Clipboard copy** (`navigator.clipboard.writeText`) — always shown. Two-second "COPIED!" confirmation state. Fallback for any platform not covered by the above.

### Decision: bottom sheet modal
`ShoppingShareSheet` renders as a position:fixed overlay with a slide-up panel pinned to the viewport bottom (`alignItems: flex-end`). Backdrop click and Escape key both close it. No library dependency — pure CSS + React state.

### Decision: share button placement
The `↗ SHARE` button is placed inline with the `{totalItems} ITEMS` HairLabel in the section header. It is only visible when `isShoppingGenerated && totalItems > 0`, so it never appears on the empty-state screen. This keeps the header uncluttered when there is nothing to share.

### TypeScript
Both client and server: 0 errors after all 4 features.
