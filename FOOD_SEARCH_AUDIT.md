# Food Search Audit

## Databases Currently Integrated

| Database | File | Status | Notes |
|---|---|---|---|
| Open Food Facts | `server/src/services/openFoodFactsService.ts` | Active | No API key needed. Returns max 6 results, filtered to those with calorie data. 8s timeout. |
| USDA FoodData Central | `server/src/services/usdaService.ts` | Active (key-gated) | **Silently returns `[]` if `USDA_API_KEY` is not set.** Only active if env var present. Returns max 6 results. 8s timeout. |
| Claude AI (search fallback) | `server/src/services/aiFoodService.ts` | Active | Called only when OFF + USDA return fewer than 3 combined results. No rate-limit guard here (only on the explicit `/api/food/ai-estimate` endpoint). |
| Claude AI (describe a meal) | `server/src/services/aiFoodService.ts` | Active | Separate endpoint `POST /api/food/ai-estimate`. Breaks a meal description into components with per-component macros. Has in-memory daily rate limit (`AI_FOOD_ESTIMATE_DAILY_LIMIT`, default 20). |
| CalorieNinjas | `server/src/services/calorieNinjasService.ts` | Active — plan-only | **NOT used for food search at all.** Only called post-plan-generation to verify macro accuracy. Irrelevant to the search waterfall. |

---

## Search Flow (current waterfall order)

1. **Cache check** — `FoodSearchCache` table in Postgres, keyed by `(query.toLowerCase(), source='combined')`, 7-day TTL. Returns immediately on hit.
2. **Parallel fetch** — Open Food Facts and USDA are called simultaneously via `Promise.allSettled`. Either can fail without killing the other.
3. **Merge** — OFF results go first, then USDA appended. Deduplicated by `name.toLowerCase().trim()`.
4. **AI fallback** — if fewer than 3 merged results, `getAIFoodEstimate(query)` is called (Claude). Results appended and re-deduplicated.
5. **Slice + cache** — trimmed to `limit` (default 10, max 20), then cached for 7 days.
6. **Response** — `{ results: FoodResult[], cached: boolean }`.

Separate flow for **AI natural-language mode**:
- User taps "Ask AI to estimate" on the search home screen.
- `POST /api/food/ai-estimate` with `{ description: "..." }`.
- Claude returns a component breakdown (each ingredient with grams + macros) plus totals.
- Rate-limited to 20 calls/user/day (in-memory, resets on server restart).

---

## API Keys Required

| Key name | Present in `.env.example` | Notes |
|---|---|---|
| `USDA_API_KEY` | ❌ **Missing** | Referenced in `app.ts` startup check and `usdaService.ts` but not documented in `.env.example`. Get free key at https://fdc.nal.usda.gov/api-key-signup.html |
| `ANTHROPIC_API_KEY` | ✅ Yes | Required for both AI search fallback and AI estimate endpoint. |
| `CALORIE_NINJAS_API_KEY` | ✅ Yes | Not relevant to food search — only used for post-plan macro verification. |
| `AI_FOOD_ESTIMATE_DAILY_LIMIT` | ❌ **Missing** | Controls daily cap on `/api/food/ai-estimate` calls. Defaults to 20 but not in `.env.example`. |

---

## What Each Database Covers

**Open Food Facts**
- Packaged/branded consumer food products worldwide (barcoded items).
- Strong coverage for: packaged snacks, cereals, dairy, beverages, branded Indian products (Amul, Haldiram's, MTR ready-to-eat).
- Weak coverage for: raw whole foods (chicken breast, rice, lentils) and Indian home-cooked dishes (dal tadka, poha, upma).
- Returns per-100g + serving macros. Serving size parsed from `serving_size` string (gram-regex only).

**USDA FoodData Central**
- USDA's national nutrient database: raw ingredients, branded US products, restaurant items.
- Strong coverage for: raw meats, grains, vegetables, fruits, US fast food.
- Weak coverage for: Indian regional foods, international brands.
- Returns nutrient IDs 1008 (calories), 1003 (protein), 1005 (carbs), 1004 (fat), 1079 (fibre).
- `servingSize` field from USDA is used as-is; many entries default to 100g.

**Claude AI (search fallback)**
- Fires only when fewer than 3 real results found.
- Returns 1–2 serving options per food with estimated macros.
- No confidence scoring. `isAiEstimate: true` flag set, displayed with ✨ and "ESTIMATE — ACCURACY MAY VARY".
- No rate limit in this path — a query that consistently returns 0 real results will call Claude every time until the cache is populated.

**Claude AI (describe a meal)**
- User types free-text: "2 chapatis with sabzi and raita".
- Claude returns per-component breakdown with estimated grams.
- This is the most useful path for Indian home-cooked meals.

---

## Gaps Found

1. **`USDA_API_KEY` missing from `.env.example`** — Any developer (or Vercel env) that doesn't know to add this will silently get only Open Food Facts results. The console just warns `USDA_API_KEY not set, skipping USDA search` — no visible error to the user.

2. **`AI_FOOD_ESTIMATE_DAILY_LIMIT` missing from `.env.example`** — Undocumented knob.

3. **No Indian food database** — OFF and USDA both have poor coverage for home-cooked Indian meals (the app's primary user base per quick picks: "Rice + Dal", "Boiled eggs"). The AI fallback fires heavily for Indian dishes but gives unverified estimates.

4. **AI search fallback has no rate limit** — If a user searches for "dal tadka" (likely 0 real results), every non-cached query hits Claude. The cache helps after the first hit, but the 7-day TTL means repeated novel Indian dish queries will drain Claude API budget.

5. **Cache TTL is 7 days for all queries** — AI-estimated results (which can be inaccurate) are cached just as long as real database results. A bad AI estimate gets served from cache for a week.

6. **Deduplication is name-only** — `r.name.toLowerCase().trim()` deduplicates. "Banana" from OFF and "Banana" from USDA would be deduped, keeping only the OFF version (since OFF goes first). USDA's more granular nutrient data is silently dropped.

7. **OFF serving size parsing is brittle** — `parseServingSize` only matches `(\d+(?:\.\d+)?)\s*g` (gram strings). "1 cup", "1 tbsp", "30ml" all fall back to 100g as the serving size. This makes the displayed "per serving" macros wrong for many OFF results.

8. **USDA `servingSize` field is unreliable** — Many USDA entries have `servingSize: null` or non-standard units, defaulting to 100g. The `servingSizeUnit` may be "GRM", "oz", "cup" — only grams are handled correctly in the scaling math (`(cal * servingGrams) / 100` assumes servingGrams is in grams).

9. **No source-priority reordering** — Results are OFF-first always. For Indian raw ingredients (e.g. "masoor dal"), USDA data may be more accurate but always gets deduped away if OFF has a match.

10. **No Nutritionix, FatSecret, or Edamam** — These cover restaurant items and Indian foods better than OFF/USDA. Not integrated.

11. **AI rate limit is in-memory** — Resets on every server restart (Vercel cold start). On serverless, each function instance has its own counter, so the effective daily limit is `20 × number of instances`.

12. **`FoodResult.source` type is hardcoded** — `foodTypes.ts` defines `source: 'open_food_facts' | 'usda' | 'ai_estimate'`. Adding a new database requires touching the type, both services, and the frontend `SOURCE_LABELS` map.

---

## Files Involved

**Server — routes**
- `server/src/routes/food.ts` — Main search endpoint (`GET /api/food/search`), AI estimate endpoint (`POST /api/food/ai-estimate`), recent foods (`GET /api/food/recent`). Contains cache logic, deduplication, AI fallback trigger, and rate limiter.
- `server/src/app.ts` — Mounts `/api/food` router; includes `USDA_API_KEY` in startup env-var check array.

**Server — services**
- `server/src/services/openFoodFactsService.ts` — OFF `search.pl` API call + product mapper. Returns max 6 results.
- `server/src/services/usdaService.ts` — USDA FDC `/foods/search` call + nutrient mapper. Returns max 6 results. Key-gated.
- `server/src/services/aiFoodService.ts` — `getAIFoodEstimate()` (search fallback) + `getAINaturalLanguageEstimate()` (describe-a-meal). Both use Claude.
- `server/src/services/calorieNinjasService.ts` — CN nutrition lookup. **Not part of search waterfall** — plan verification only.
- `server/src/services/foodTypes.ts` — Shared TS interfaces: `FoodResult`, `Macros`, `ServingSize`, `AIComponent`, `AIEstimateResult`.

**Client — components**
- `client/src/components/MealReplacerSearch.tsx` — Search home screen. Quick picks, recent foods list, AI mode entry button.
- `client/src/components/MealReplacerResults.tsx` — Live search results. Input box + `FoodResultCard` list. Shows "DESCRIBE IT — LET AI ESTIMATE" on zero results.
- `client/src/components/FoodResultCard.tsx` — Single result card with macros, source badge (`OFF` / `USDA` / `AI`), ✨ marker for AI estimates.

**Client — hooks + store**
- `client/src/hooks/useFoodSearch.ts` — 400ms debounced search. Calls `GET /api/food/search?q=...&limit=10`. Silent error handling (sets results to `[]`).
- `client/src/store/mealReplacerStore.ts` — Zustand store for the full meal-replacer/add flow: screen navigation, selected food, quantity, computed macros, recent foods, submission to `POST /api/meal-replacements` or `POST /api/additional-meals`.

**Database**
- `FoodSearchCache` table (Prisma) — Fields: `query`, `source` (always `'combined'`), `results` (JSON), `cachedAt`, `expiresAt`. Unique on `(query, source)`.
- `RecentFoodLog` table (Prisma) — Stores last 10 foods per user. Populated on successful meal submission.
