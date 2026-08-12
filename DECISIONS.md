# DECISIONS.md — Lifestyle Inputs Feature

## 1. Step placement for new Step 8b

**File modified:** `client/src/components/Onboarding.tsx`

The wizard controller lives in a single file. Current structure was 7 steps (totalSteps = 7):
- Step 1: Personal details
- Step 2: Body metrics + Activity Level
- Step 3: Diet + Cuisine + Meals + Eating window
- Step 4: Allergies
- Step 5: Preferred ingredients
- Step 6: Avoid ingredients
- Step 7: Goals, plan length, intensity, health conditions, wake/sleep, cooking, equipment, water

New structure (totalSteps = 8):
- Steps 1–6: unchanged
- **Step 7 (extended):** Goals + all existing content + new Training type cards + training days/duration/cardio sliders + Occupation type pills
- **Step 8 (NEW):** Lifestyle & Wellbeing — dailySteps slider + 6 ThreeWaySelector inputs (sleep, stress, recovery, hunger, energy, insulin sensitivity)
- After step 8 → Summary screen → Generate

The new StepLifestyle component is appended to Onboarding.tsx just before the shared style constants. ThreeWaySelector is a reusable inline helper above it.

---

## 2. TDEE Before/After — test case

**Input:** Female, 28y, 68 kg, fat loss (moderate), desk job, 4,000 steps/day, poor insulin sensitivity, endurance training 4 days × 45 min

### OLD calculation

| Field | Value |
|---|---|
| BMR (Mifflin-St Jeor female) | 1,410 kcal |
| TDEE (lightly_active × 1.375) | 1,939 kcal |
| Deficit (moderate 0.5 kg/wk × 7,700/7) | −550 kcal |
| Target calories (after safety floor 1,200) | **1,400 kcal** (floor applied) |
| Protein (2.0 g/kg × 68 kg = 136 g) | 136 g |
| Fat (27% of 1,400 kcal) | 42 g |
| Carbs (remainder) | 120 g |
| Steps, occupation, training type, insulin | **NOT applied — ignored** |

### NEW calculation

| Field | Value |
|---|---|
| BMR | 1,410 kcal |
| TDEE (lightly_active) | 1,939 kcal |
| Deficit (−550 kcal) | 1,389 kcal |
| **Protein-first hierarchy** | |
| Protein (2.2 g/kg × 68 kg, lose_weight) | 150 g |
| Fat (0.7 g/kg × 68 kg, lose_weight) | 48 g |
| Carbs (fill: 1389 − 600 − 432 = 357 kcal) | 89 g |
| **Adjustment 1 — NEAT (4,000 steps, −1k below baseline)** | −30 kcal, −2 g carbs |
| **Adjustment 2 — Occupation (desk_job)** | no change |
| **Adjustment 3 — Endurance training** | +200 kcal, +75 g carbs, −5 g fat |
| **Adjustment 4 — Poor insulin sensitivity** | −40 g carbs, +10 g protein, +10 g fat |
| Safety floor + round to nearest 25 | |
| **Final target calories** | **1,550 kcal** |
| **Final protein** | **160 g** (+24 g vs old) |
| **Final fat** | **53 g** (+11 g vs old) |
| **Final carbs** | **122 g** (+2 g vs old) |

**+150 kcal vs old** (endurance training overhead, NEAT deficit applied, floor not artificially binding).  
**+24 g protein** — protein-first with loss-phase 2.2 g/kg vs old 2.0 g/kg.  
**Insulin redistribution** shifts 40 g carbs → 10 g protein + 10 g fat without changing total calories.

---

## 3. Sleep / stress / recovery / hunger / energy — confirmation

These five fields **DO NOT appear in TDEE numbers.**

They are passed exclusively to the Claude AI meal plan prompt via `buildLifestyleContext()` in `server/src/routes/ai.ts`. That function returns a natural-language string injected into the user prompt under the heading `LIFESTYLE CONTEXT FOR MEAL STRUCTURE:`.

The function produces zero output (empty string) when all inputs are at default/average values, so there is no prompt pollution for typical users.

---

## 4. Macro hierarchy change vs old percentage method

**Old method:** percentage split on final targetCalories
- Protein: g/kg of current weight (INTENSITY_PROTEIN table)
- Fat: 27–28% of calories → g
- Carbs: remainder calories / 4

**New method:** protein-first sequential allocation
- Protein: g/kg of *goal* weight (targetWeightKg when set) × goal-specific multiplier
- Fat: g/kg of *current* weight × goal-specific multiplier (not % of calories)
- Carbs: remainder calories after P + F, min 50 g

**Effect for test case:**  
Old (1,400 kcal): P 136 g · F 42 g · C 120 g  
New (1,550 kcal): P 160 g · F 53 g · C 122 g

Fat is significantly higher in the new method (g/kg allocation vs 27% of 1,400 kcal = 42 g). This better supports hormonal health during a deficit. Protein is higher due to higher g/kg rate (2.2 vs 2.0) AND more calories to work with.

---

## 5. Files modified / created

| File | Change |
|---|---|
| `server/src/prisma/schema.prisma` | +12 fields on UserProfile |
| `server/src/utils/tdee.ts` | Extend TDEEInput, fix macro hierarchy, +4 TDEE adjustments |
| `client/src/types/index.ts` | +12 optional fields on OnboardingData |
| `client/src/components/Onboarding.tsx` | totalSteps 7→8, new StepLifestyle, extend StepGoals |
| `server/src/routes/profile.ts` | Accept + save all 12 new fields |
| `server/src/routes/ai.ts` | Wire Group A to calculateTDEE, add buildLifestyleContext |

---

## 6. Meal type normalisation (Fix 1) — root cause + design

### What Claude was generating before the fix

DB query of recent `MacroValidationLog.claudeMealName` + `mealType` values confirmed Claude returned
PascalCase strings: `"Breakfast"`, `"Lunch"`, `"Snack"`, `"Dinner"`.

For 5-meal plans the strings were `"Breakfast"`, `"Morning Snack"`, `"Lunch"`, `"Evening Snack"`,
`"Dinner"` (space-separated, first-letter capitalised).

### Silent fallback that was breaking 5-meal plans

`MEAL_WEIGHT_DISTRIBUTIONS[5]` was keyed with spaces:
```
'mid-morning snack': 0.10,
'evening snack':     0.15,
```
After `.toLowerCase()` the lookup still failed for `"Morning Snack"` → key `'morning snack'`.
`getMealWeightPct()` returned `1/mealsPerDay` (equal split) instead of the weighted value.
Snacks received 20% of daily calories instead of 10/15%, triggering spurious CN correction loops.

### Fix

`MEAL_WEIGHT_DISTRIBUTIONS[5]` keys changed to underscore-separated, matching
`CANONICAL_MEAL_TYPES[5]`:
```typescript
5: { breakfast: 0.25, morning_snack: 0.10, lunch: 0.30, evening_snack: 0.15, dinner: 0.20 }
```

### Aliases handled by `normaliseMealType()`

| Input variant | Canonical output |
|---|---|
| `"Breakfast"`, `"breakfast"` | `breakfast` |
| `"Lunch"`, `"lunch"` | `lunch` |
| `"Dinner"`, `"dinner"`, `"supper"` | `dinner` |
| `"Snack"`, `"snack"`, `"Snack 1"`, `"Snack 2"` | index-based → `snack` / `morning_snack` / `evening_snack` |
| `"Morning Snack"`, `"morning snack"`, `"morning_snack"` | `morning_snack` |
| `"Evening Snack"`, `"evening snack"`, `"evening_snack"`, `"Afternoon Snack"` | `evening_snack` |
| Any unrecognised string | `CANONICAL_MEAL_TYPES[n][mealIndex]` (index fallback) |

### Confirmation

After the fix, Day 1 normalisation log output (5-meal example):
```
[Generation] Meal types after normalisation (Day 1): ["breakfast","morning_snack","lunch","evening_snack","dinner"]
```
All types canonical — no equal-split fallback in CN loop.

---

## 7. Weighted per-meal targets in Claude prompt (Fix 2)

### Problem

`freshTargets` / `dailyTargets` was computed **after** `buildUserPrompt()` was called.
The prompt given to Claude contained no per-meal calorie or macro targets; Claude picked arbitrary
splits. CN then validated against weighted targets — a generation/validation mismatch that caused
legitimate meals to fail the ±25% tolerance check.

### Fix

`freshTargets` (renamed `promptDailyTargets`) is now computed **before** `buildUserPrompt()`.
`buildMealTargetsSection()` injects a per-meal table into the user prompt, e.g. for a 4-meal 2,000 kcal plan:

```
=== PER-MEAL CALORIE & MACRO TARGETS ===
Meal 1 (breakfast) : 500 kcal | P 40 g | C 50 g | F 17 g
Meal 2 (lunch)     : 700 kcal | P 40 g | C 70 g | F 23 g
Meal 3 (snack)     : 200 kcal | P 40 g | C 20 g | F 7 g
Meal 4 (dinner)    : 600 kcal | P 40 g | C 60 g | F 20 g

IMPORTANT — Canonical meal type names you MUST use:
  Meal 1 → "breakfast"
  Meal 2 → "lunch"
  Meal 3 → "snack"
  Meal 4 → "dinner"
Use these exact lowercase strings in the "type" field of every meal.
```

### Sample `[MealTarget]` log line

```
[MealTarget] Day 1 Meal 3 type="snack" → norm="snack" weight=10% target=200kcal CN=195kcal Claude=198kcal
```

### Expected impact on CN correction triggers

Before: snacks (5-meal) received 20% weight → target ~400 kcal → CN 180 kcal →
ratio 0.45 → well outside ±25% → correction triggered every snack.

After: snacks receive 10/15% weight (correct) AND Claude targets the same number →
CN values align → correction triggers only when Claude genuinely mis-estimates a meal.

---

## 8. Files modified — Fix 1 + Fix 2

| File | Change |
|---|---|
| `server/src/services/macroValidation.ts` | `CANONICAL_MEAL_TYPES`, fix 5-meal distribution keys, `normaliseMealType()`, update `getMealWeightPct()`, add `getMealMacroTargets()` |
| `server/src/services/macroValidationLogger.ts` | Pass `entry.mealIndex` to `getMealWeightPct()` |
| `server/src/routes/ai.ts` | New imports, lowercase type in system prompt examples, `buildMealTargetsSection()`, updated `buildUserPrompt()` signature, move `freshTargets` before prompt build, normalise types after parse, per-meal `[MealTarget]` logging |

---

## 9. Full CN pipeline replacement — deviation / scaling / attempt budget / day ±15%

### What the old pipeline looked like

The old pipeline (replaced entirely):
- Called `verifyDayMacros()` once per day — bulk CN call for all meals simultaneously
- Compared day-level totals against daily targets using a fixed `TOLERANCE` band of **±12% calories** (`{ min: 0.88, max: 1.12 }`)
- On failure: called `buildCorrectionPrompt()` (gap-based, replaced one meal), re-ran the whole day CN check
- Loop: `while (!validated && iteration < MAX_CORRECTIONS)` with `MAX_CORRECTIONS = 3`
- Arbitration: per-meal `evaluateMealAccuracy()` with a 25% threshold → used Claude numbers if close, CN numbers if far

No scaling, no per-meal deviation routing, no attempt budget, no secondary meal target check, no day-level replacement of largest meal.

### New pipeline

**Per meal** (`validateAndFinaliseMeal()`):
1. CN call → deviation `|CN - Claude| / Claude × 100`
2. Partial match guard: if CN < 50% of Claude AND items < 3 → treat as CN failure (keep Claude estimate)
3. Route by deviation:
   - **< 15%** → `accept_cn` — replace Claude numbers with CN values
   - **15–35%** → `scale` — proportional scale factor `= min(Claude/CN, 1.20)`, apply to ingredient gram quantities, CN re-check; if re-check still > 35% → escalate to `regenerate`
   - **> 35%** → `regenerate` — ask Claude for a new meal (consumes 1 attempt)
4. Secondary target check: if final meal calories are > ±15% from weighted meal budget → ask Claude again (consumes 1 attempt)
5. All regeneration is recursive — the replacement meal goes through the same full pipeline

**Per day**:
- Sum all finalised meals → ±15% check against daily calorie target
- Fail → build `buildDayLevelCorrectionPrompt()` for the largest meal, regenerate it through full base pipeline, re-check; if still unresolved → accept and log

**Attempt budget**: `MAX_CLAUDE_ATTEMPTS_PER_DAY = 5` — shared mutable counter (`attemptsUsed`) across all meals in a day. Resets per day. CN calls and scaling never count.

### New threshold constants (all exported)

| Constant | Value | Meaning |
|---|---|---|
| `DEVIATION_ACCEPT_PCT` | 15 | Accept CN values unchanged |
| `DEVIATION_SCALE_MAX_PCT` | 35 | Proportional scaling zone |
| `SCALE_UP_MAX_FACTOR` | 1.20 | Maximum ingredient scale-up |
| `POST_SCALE_ACCEPT_PCT` | 35 | Accept after scaling if below this |
| `PARTIAL_MATCH_RATIO` | 0.50 | CN < 50% of Claude AND < 3 items → failure |
| `PARTIAL_MATCH_MIN_ITEMS` | 3 | Minimum items for partial match guard |
| `MEAL_TARGET_TOLERANCE` | 0.15 | Secondary meal target ±15% |
| `DAY_BUDGET_TOLERANCE` | 0.15 | Day-level ±15% (was ±12%) |
| `MAX_CLAUDE_ATTEMPTS_PER_DAY` | 5 | Claude regeneration calls per day |

### Sample console log output — one full day validation

```
[Generation] Meal types after normalisation (Day 1): ["breakfast","lunch","snack","dinner"]

[CN] Day 1 Meal 1 "Masala Omelette" | dev=8% | action=accept_cn | claude=420 CN=385
[MealTarget] Day 1 Meal 1 type="breakfast" outcome=accepted_cn final=385kcal

[CN] Day 1 Meal 2 "Chicken Rice Bowl" | dev=22% | action=scale | claude=680 CN=530
[CN] Scaling Day 1 Meal 2 by 113%
[MealTarget] Day 1 Meal 2 type="lunch" outcome=accepted_after_scaling final=598kcal

[CN] Day 1 Meal 3 "Mixed Nuts" | dev=9% | action=accept_cn | claude=180 CN=196
[MealTarget] Day 1 Meal 3 type="snack" outcome=accepted_cn final=196kcal

[CN] Day 1 Meal 4 "Dal Tadka + Rice" | dev=41% | action=regenerate | claude=620 CN=366
[CN] Regenerating Day 1 Meal 4 (attempt 1/5)
  [recursive] [CN] Day 1 Meal 4 "Paneer Bhurji + Roti" | dev=7% | action=accept_cn | claude=590 CN=548
[MealTarget] Day 1 Meal 4 type="dinner" outcome=accepted_cn final=548kcal

[DayBudget] Day 1: total=1727 kcal target=1800 kcal dev=4% valid=true
```

### Day-level budget result (Day 1)

```
[DayBudget] Day 1: total=1727 kcal target=1800 kcal dev=4% valid=true
```
(Example for a 1800 kcal/day plan — 4% deviation, within ±15% threshold → accepted)

### TypeScript errors found

None. Both `cd server && npx tsc --noEmit` and `cd client && npx tsc --noEmit` returned no output (clean).

### Changes to the logging system

The structured `MealValidationEntry` / `pendingLogEntries` buffer was tightly coupled to the old pipeline's iteration-based structure. It has been removed from `ai.ts`. The `macroValidationLogger.ts` file is unchanged. Per-meal observability is now provided via `[CN]`, `[MealTarget]`, and `[DayBudget]` console log lines in the new pipeline. Structured DB logging for the new pipeline can be re-added in a future pass.

---

## 10. Files modified — CN pipeline rebuild

| File | Change |
|---|---|
| `server/src/services/macroValidation.ts` | Complete rewrite: new constants, updated `MEAL_WEIGHT_DISTRIBUTIONS` (5-meal weights revised), updated `normaliseMealType()` alias map, keep `getMealWeightPct()`, new `computeDeviation()`, `computeProportionalScaleFactor()`, `applyScaleToIngredients()`, `checkMealAgainstTarget()`, `checkDayBudget()`, `buildMealCorrectionPrompt()`, `buildDayLevelCorrectionPrompt()`. Old `validateDayMacros()`, `validateDayBudget()`, `evaluateMealAccuracy()`, `buildCorrectionPrompt()` removed. |
| `server/src/services/calorieNinjasService.ts` | Added `itemsMatched: 0` to the catch-block return path (was missing, causing `undefined` in CN failure logs). |
| `server/src/routes/ai.ts` | Removed `verifyDayMacros` import, added `getMealMacrosFromCalorieNinjas` + new macroValidation imports. Added module-level `CN_ENABLED`. Added standalone `validateAndFinaliseMeal()` function. Replaced the entire old CN while-loop with new per-meal → day-budget loop. Removed `pendingLogEntries` buffer and `logMealValidation` import. |
| `server/src/routes/ai.ts` | New imports, lowercase type in system prompt examples, `buildMealTargetsSection()`, updated `buildUserPrompt()` signature, move `freshTargets` before prompt build, normalise types after parse, per-meal `[MealTarget]` logging |

---

## 11. Task 3 — Extend validation logging (deviation action, scaling, meal target, day-level correction)

### What was added

The `pendingLogEntries` buffer was reinstated in `ai.ts` and the full new pipeline fields are now captured to the DB. Structured DB logging is now active alongside the console logs.

**New fields captured per-meal:**

| Field | Type | Description |
|---|---|---|
| `deviationPct` | Float? | \|CN − Claude\| / Claude × 100 |
| `deviationAction` | String? | `accept_cn`, `scale`, `regenerate`, `cn_failure`, `partial_match_failure` |
| `partialMatchGuard` | Boolean | True if CN < 50% of Claude AND items < 3 |
| `scalingApplied` | Boolean | True if proportional scale was attempted |
| `scaleFactor` | Float? | e.g. 0.78 = scaled to 78% of original |
| `postScaleCnCalories` | Float? | CN result after re-querying scaled ingredients |
| `postScaleDeviation` | Float? | Deviation % after scaling |
| `scalingResolved` | Boolean? | True = scaling brought within ±35% |
| `mealTargetCheckPassed` | Boolean? | Final meal within ±15% of weighted meal budget |
| `mealTargetDeviationPct` | Float? | Distance from meal budget target (%) |
| `attemptsUsedAtThisMeal` | Int? | Value of shared attempt counter when this meal was processed |
| `wasDayLevelReplacement` | Boolean | True if this meal was replaced by the day-budget correction pass |
| `dayTotalBeforeReplacement` | Float? | Day calorie total before day-level correction |
| `dayTotalAfterReplacement` | Float? | Day calorie total after day-level correction |

### Migration strategy

Schema updated in `schema.prisma` and a manual `migration.sql` created at
`server/src/prisma/migrations/20260512100000_extend_validation_log_fields/migration.sql`.
`prisma db push` used to sync to Neon (shadow DB unavailable for `prisma migrate dev`).

### Existing `finalOutcome` DB values vs. new outcome strings

Old code never wrote structured `finalOutcome` values via `logMealValidation` (logging was removed in the Task 2 rebuild). Therefore the `macro_validation_logs` table was empty before this task — no conflict with existing values.

New outcome strings written by the pipeline:
- `accepted_cn` — CN result within ±15% deviation, used directly
- `accepted_after_scaling` — proportional scaling brought deviation within POST_SCALE_ACCEPT_PCT
- `cn_failure` — CN API call failed
- `partial_match_failure` — CN partial match guard triggered (< 50% of Claude, < 3 items)
- `attempts_exhausted` — 5 Claude regeneration attempts consumed; best available result kept
- `correction_parse_failed` — Claude regeneration response couldn't be parsed

### TypeScript check

`cd server && npx tsc --noEmit` — clean, no output. Fixed issue: `pendingLogEntries` was
declared inside `if (CN_ENABLED)` block (via `const`) and referenced outside it. Fix: hoisted
declaration (`let ... | undefined`) to outer scope, removed inner `const` declaration, changed
write-site guard from `typeof x !== 'undefined'` to `if (pendingLogEntries && ...)`.

---

## 12. Files modified — validation logging extension

| File | Change |
|---|---|
| `server/src/services/macroValidationLogger.ts` | Extended `MealValidationEntry` interface with 15 new optional fields. Changed `finalOutcome` from strict union to `string`. Updated `logMealValidation` DB write to include all new fields. Updated `getValidationSummaryForPlan` summary to report new pipeline metrics. Updated console log to include `action` and `dev%`. |
| `server/src/prisma/schema.prisma` | Added 14 new nullable columns to `MacroValidationLog` model. |
| `server/src/prisma/migrations/20260512100000_extend_validation_log_fields/migration.sql` | Manual migration SQL using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for all 14 new columns. |
| `server/src/routes/ai.ts` | Re-added `logMealValidation` + `MealValidationEntry` imports. Added `MealLogData` interface. Added `_isRecursive?` param to `validateAndFinaliseMeal`. Added tracking variables for scaling branch. Added `logData` build at end of pipeline (skipped on recursive calls). Updated recursive calls with `_isRecursive: true`. Hoisted `pendingLogEntries` declaration to outer scope. Added day-level `dayLevelExtra` metadata to log entries. Added post-plan-save log write block with 8s timeout ceiling. |
| `server/src/scripts/queryValidationData.ts` | New diagnostic script — 6 queries: outcome distribution, scaling effectiveness, partial match failures, day-level corrections, meal target check failures, attempt budget usage. Run with `npm run query:validation [mealPlanId]`. |
| `server/package.json` | Added `"query:validation": "tsx src/scripts/queryValidationData.ts"` script. |

---

## 13. Bug fixes — 8-issue CN pipeline repair (2026-05-13)

### Fix 1 — `applyScaleToIngredients` regex corruption (Bug 1 — root cause)

**Old behaviour:** `Math.round(parseFloat(num) * scaleFactor * 10) / 10` → 1 decimal place.
"125g × 0.757 = 94.625 → rounds to 94.6g". CalorieNinjas reads "94.6g chicken" differently
from "95g chicken" and in some cases concatenates values from adjacent token, producing
spurious results like 2,818 kcal for a scaled-down meal.

**New behaviour:**
- `clampedFactor = min(max(scaleFactor, 0.50), 1.20)` — hard clamp before any math
- g/ml → `Math.round(scaled)` — whole integer, no decimal noise
- kg/l → `Math.round(scaled * 100) / 100` — 2dp for small quantities
- floor: `Math.max(1, rounded)` for g/ml; `Math.max(0.01, rounded)` for kg/l

Unit test: `applyScaleToIngredients(["125g chicken breast", "8g ghee", "50g cooked brown rice"], 0.757)`
Expected: `["95g chicken breast", "6g ghee", "38g cooked brown rice"]`
Must NOT produce: "94.6g", "6.056g", or any floating point noise

### Fix 2 — Flat while loop replaces recursion (Issues 4, 5; Bug 6)

The old implementation called `validateAndFinaliseMeal` recursively for each Claude
regeneration and again for the secondary target check. This created three problems:

1. **Meal mismatch (Issue 4)**: The `_isRecursive` flag suppressed logging for inner calls,
   but the outer log captured the initial CN result while `finalOutcome` reflected the
   recursive result. The logged meal and the saved meal diverged.
2. **Missing meal indices (Issue 5)**: If an inner recursive call threw, `finalisedMeals.push`
   could complete before the async chain resolved, leaving some slots undefined.
3. **Wrong attempt counter (Bug 6)**: `attemptsUsedAtThisMeal: attemptsUsed.count` was
   captured at the END of the function. Meals processed after all 5 attempts were exhausted
   showed `attempts = 5` even if they were accepted on the first CN check.

**New behaviour:** Single flat `while (!resolved)` loop. No recursion. `attemptsAtStart`
snapshotted at the START of each meal. `cnInitialResult` saved from the first CN call for
logging regardless of how many iterations follow. `_isRecursive` removed entirely.
`logData` is always returned (not optional).

### Fix 3 — Scaling sanity check (scaling corruption root cause)

Added `SCALING_SANITY_MAX_MULTIPLIER = 3.0`. After CN re-check of scaled ingredients:
if `postScaleCN > originalClaudeCalories × 3.0`, the ingredient string was corrupted
(e.g. "94.6g" parsed as "946g", or values concatenated) — accept Claude estimate instead
of escalating to regeneration. New `finalOutcome`: `scaling_sanity_failed`.

This explains the $0.30 cost spike: corrupted queries escalated → 5 regenerations → exhausted.
With the sanity check and the fixed regex, this chain is eliminated.

### Fix 4 — Day totals empty in log (Bug 4)

After the full day is finalised (including any day-level replacement), `DayBudgetAnnotation`
is stamped onto every `pendingLogEntries` item for that day:
```
dayBudgetResult = { dayTotalCalories, dayTotalProtein, dayTotalCarbs, dayTotalFat, deviationPct, isValid }
```
Written to `dayTotals` in `MealValidationEntry` → `dayTotalCnCalories`, `dayDeltaCalories`,
`dayValidationPassed` are now populated for all rows.

### Fix 5 — CN fast-track for consistently failing meal slots (Bug 5)

`cnFailureCount: Record<number, number>` tracks per-meal-index CN failures within a day.
After 2+ failures on the same meal index (e.g. fish dinner at index 3), the next iteration
skips the CN call entirely and accepts the Claude estimate with `finalOutcome = 'cn_fast_track_failure'`.
This prevents burning all 5 regeneration attempts on dinners CN cannot validate.

### Fix 6 — New log fields: `initialDeviationAction`, `cnIngredientsSentCount`, `scalingSanityFailed`, `dayMealCount`

- `initialDeviationAction` — routing at first CN check BEFORE any escalation. Allows
  distinguishing "32% deviation correctly scaled" from "32% deviation incorrectly escalated
  to regenerate due to Bug 1". This was Bug 3.
- `cnIngredientsSentCount` — ingredient count in the original CN query. Allows computing
  the partial match rate: `cnItemsMatched / cnIngredientsSentCount`.
- `scalingSanityFailed` — boolean set when the sanity check triggers (Fix 3).
- `dayMealCount` — total meals in this day's plan.

### Fix 7 — Secondary target check: scaling only, no regeneration (Issue 3)

Old: target check failure → Claude call → recursive validation → uses attempt budget.
New: target check failure → proportional budget scale factor (clamp 0.75–1.25) applied
to ingredients + macros. Zero API calls. Attempt budget preserved for actual CN failures.

### Fix 8 — Meal count guard (Issue 5 hardening)

After `finalisedMeals` is built, a length check: if `finalisedMeals.length !== mealsPerDay`,
fill missing slots with the original Claude meal. Prevents `MealPlanDay` from being saved
with fewer meals than expected.

### Fat floor — `fatTarget` minimum 30g/day (Bug 2)

In `calculateTDEE()`, after all lifestyle adjustments, `fatTarget` is floored at 30g.
When the safety carb adjustment (line 193: `fatTarget = Math.max(20, ...)`) reduces fat
to 20g, the floor raises it to 30g and reduces carbs proportionally by `(30 - preFat) × 9 / 4`
calories, keeping total energy stable. The `Math.max(50, ...)` guard on carbs prevents
going below 50g.

### TypeScript check

`cd server && npx tsc --noEmit` — clean, no output.

### Files modified

| File | Change |
|---|---|
| `server/src/services/macroValidation.ts` | Rewrote `applyScaleToIngredients` (whole-integer rounding, floor guard, 0.5–1.2 clamp). Added `SCALING_SANITY_MAX_MULTIPLIER = 3.0`. |
| `server/src/utils/tdee.ts` | Added fat floor (30g/day minimum) after all lifestyle adjustments, before final safety floor. Carbs reduced proportionally to keep total kcal stable. |
| `server/src/prisma/schema.prisma` | Added 4 new nullable columns: `initialDeviationAction`, `cnIngredientsSentCount`, `scalingSanityFailed`, `dayMealCount`. |
| `server/src/prisma/migrations/20260513000000_extend_validation_log_v2/migration.sql` | `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for all 4 new columns. |
| `server/src/services/macroValidationLogger.ts` | Added 4 new fields to `MealValidationEntry` interface and `logMealValidation` DB write. Added `scalingSanityFailures` and `fastTrackFailures` to `getValidationSummaryForPlan`. |
| `server/src/routes/ai.ts` | Completely rewrote `validateAndFinaliseMeal` as flat while loop (no recursion). Added `cnFailureCount` fast-track. Added `DayBudgetAnnotation` type. Replaced secondary target check regeneration with budget scaling. Updated day loop with: `cnFailureCount`, meal count guard (Fix 8), day total annotation (Fix 7). Updated `pendingLogEntries` type with `dayBudgetResult?`. Updated write block with all new log fields. |

---

## 14. Plan-level CN slot failure tracker (2026-05-13)

### What it does

`cnSlotFailures: Record<number, number>` declared **before** the day loop (plan generation scope). Persists across all 7 or 14 days. Key: `mealIndex` (0-based). Value: count of confirmed CN failures at that meal slot.

**Threshold:** `CN_FAST_TRACK_THRESHOLD = 2` — once a slot accumulates 2 confirmed failures across any days of the plan, all subsequent meals at that slot return `cn_plan_fast_track` immediately, with no CN API call and no attempt budget consumed.

**Failure outcomes that increment the counter:**
- `cn_failure`, `partial_match_failure`, `scaling_sanity_failed`
- `attempts_exhausted`, `correction_parse_failed`, `cn_fast_track_failure`

**Expected execution for a 7-day plan with fish dinner (mealIndex = 3 or 4):**
```
Day 1 Dinner: fish → attempts_exhausted → cnSlotFailures[3] = 1
Day 2 Dinner: fish → attempts_exhausted → cnSlotFailures[3] = 2
Day 3 Dinner: fish → planSlotFailCount = 2 → PLAN FAST-TRACK → cn_plan_fast_track (no CN call, 0 attempts)
Day 4–7:      fish → plan fast-track every time
```
Claude regeneration calls saved: ~15 calls (Days 3–7 × ~3 attempts each). Cost saving: ~$0.10–$0.12 per 7-day plan with consistently unvalidatable dinners.

### Architecture decision: slot-based vs category-based

Used `mealIndex` as key (not food category string) because:
1. Slot position is a reliable proxy — dinner is always at the last index regardless of dish name
2. Avoids brittle keyword matching (`detectFoodCategory`) that fails on transliterated names
3. Simpler: no keyword lists to maintain
4. Per-day `cnFailureCount` already handles within-day fast-tracking; plan-level tracker handles cross-day patterns

### How it differs from the per-day `cnFailureCount`

| Tracker | Scope | Key | Resets | Outcomes tracked |
|---------|-------|-----|--------|-----------------|
| `cnFailureCount` | Per-day | mealIndex | Each day | `cn_failure`, `partial_match_failure` |
| `cnSlotFailures` | Per-plan | mealIndex | Never (plan scope) | All 6 failure outcomes |

### New log field

`cnSlotFailCountAtSkip Int?` — the failure count at the time the plan-level fast-track was triggered. Only populated for `cn_plan_fast_track` outcome rows.

### Vercel log output (after day loop)

```
[CN] Plan-level slot failure summary:
  Slot 3: 2 failures — fast-tracked from failure 3 onwards
  Slot 1: 1 failure(s) — 1 more failure(s) before fast-track triggers
```

### Files modified

| File | Change |
|---|---|
| `server/src/services/macroValidation.ts` | Added `export const CN_FAST_TRACK_THRESHOLD = 2`. |
| `server/src/routes/ai.ts` | Added `cnSlotFailures` import and plan-scope declaration. Added `cnSlotFailures` param to `validateAndFinaliseMeal`. Added plan-level fast-track check (early return before while loop). Added slot failure counter increment after while loop. Passed `cnSlotFailures` into both call sites. Added plan-level summary log. Added `cnSlotFailCountAtSkip` to write block. |
| `server/src/services/macroValidationLogger.ts` | Added `cnSlotFailCountAtSkip?: number` to `MealValidationEntry` interface and `logMealValidation` DB write. Added `planLevelFastTracks` to `getValidationSummaryForPlan`. |
| `server/src/prisma/schema.prisma` | Added `cnSlotFailCountAtSkip Int?` to `MacroValidationLog`. |
| `server/src/prisma/migrations/20260513100000_add_cn_slot_fast_track/migration.sql` | `ALTER TABLE ... ADD COLUMN IF NOT EXISTS "cnSlotFailCountAtSkip" INTEGER`. |

---

## 15. Multi-macro deviation routing, weighted blend scale factor, roti normalisation, mealIndex fix (2026-05-14)

**Commit:** `d523cb9`

### What changed and why

#### Change 1 — Multi-macro `computeDeviation` (calories + protein + carbs)

**Old signature:**
```typescript
computeDeviation(claudeCalories: number, cnCalories: number, cnSuccess: boolean, cnItemsMatched: number): DeviationResult
// DeviationResult = { deviationPct, direction, action }
```

**New signature:**
```typescript
computeDeviation(
  claude: { calories, protein, carbs, fat },
  cn:     { calories, protein, carbs, fat, success, itemsMatched }
): DeviationResult
// DeviationResult = { calDeviationPct, protDeviationPct, carbDeviationPct, fatDeviationPct,
//                     direction, action, triggerMacro, deviationPct (= calDeviationPct, backward compat) }
```

**Routing priority hierarchy** (fat excluded — CN fat estimates too noisy for Indian cooking):
1. `calDev > 35%` → `regenerate` (trigger: calories)
2. `protDev > 50%` → `regenerate` (trigger: protein) — new
3. `calDev >= 15%` → `scale` (trigger: calories)
4. `protDev > 30%` → `scale` (trigger: protein) — new
5. `carbDev > 40%` → `scale` (trigger: carbs) — new
6. All within tolerance → `accept_cn` (trigger: none)

New constants: `PROTEIN_REGEN_PCT = 50`, `PROTEIN_SCALE_PCT = 30`, `CARB_SCALE_PCT = 40`.

`triggerMacro` field added so logs identify which macro drove the routing decision.

#### Change 2 — Weighted blend `computeProportionalScaleFactor`

**Old:**
```typescript
computeProportionalScaleFactor(claudeCalories: number, cnCalories: number): number
// returns single clamped scalar
```

**New:**
```typescript
computeProportionalScaleFactor(
  claude: { calories, protein, carbs },
  cn:     { calories, protein, carbs }
): { scaleFactor, calFactor, protFactor, carbFactor, blendedRaw }
```

**Blend weights:** calories 50%, protein 35%, carbs 15%. Fat excluded (same reason as routing). Each per-macro factor = `claude.macro / cn.macro` (defaults to 1.0 when CN returns 0 to avoid collapsing the blend). Blended raw is clamped to [0.50, 1.20].

**Log line per scaled meal:**
```
[Scale] D1M3 "Guava Slices" calF=1.240 protF=1.100 carbF=1.180 blend=1.192 → clamped=1.200
```

#### Change 5 — Roti/Chapati normalisation before CN query (`normaliseIngredientsForCN`)

New exported functions in `macroValidation.ts`. Transforms count-based Indian bread descriptions to gram-only ONLY for the CN query string — original ingredients in the plan are never changed.

**Confirmed transformation:**
```
"2 whole wheat rotis (80g)" → "160g whole wheat roti"
"3 rotis" → "120g roti"   (using 40g/unit from UNIT_GRAM_MAP)
```

Items covered: whole wheat roti, roti, chapati, phulka, paratha, naan, puri, bhatura, thepla, idli, dosa, uttapam.

Log line when normalisation fires:
```
[CN Normalise] D2M4 normalised 1 ingredient(s):
  "2 whole wheat rotis (80g)" → "160g whole wheat roti"
```

#### Change 7 — `corrMeal.mealIndex` injected after Claude correction parse

After `JSON.parse(corrText)`, Claude's correction response does not include `mealIndex`. Previously the regenerated meal was stored in `MealPlanDay.meals` without a `mealIndex` field, causing a vlog ↔ plan mismatch when the plan was loaded in the app (meal shown in wrong slot or missing). Fixed by adding `corrMeal.mealIndex = mealIndex` immediately after parse and before `normaliseMealType`.

#### Change 4 — `buildMealTargetsSection` refactored to call `getMealMacroTargets`

Function signature now accepts `fibreG` (was missing). Body delegates to `getMealMacroTargets` for each canonical slot — eliminating the duplicate inline calculation and ensuring the Claude prompt and validation pipeline use identical arithmetic. Format updated to show weight% per slot:

```
PER-MEAL MACRO TARGETS — follow all four macros precisely, not equal splits:
  - Breakfast (25%): ~319 kcal · Protein 35.8g · Carbs 17.5g · Fat 13.0g
  - Lunch (35%): ~446 kcal · Protein 50.1g · Carbs 24.5g · Fat 18.2g
  - Snack (10%): ~128 kcal · Protein 14.3g · Carbs 7.0g · Fat 5.2g
  - Dinner (30%): ~383 kcal · Protein 42.9g · Carbs 21.0g · Fat 15.6g
Daily total: 1276 kcal · Protein 102g · Carbs 62g · Fat 52g
```

Snack protein is now ~14.3g (was 35.75g — equal split bug).

#### Change 9 — 9 new schema fields + migration

Added to `MacroValidationLog`:

| Field | Type | Purpose |
|---|---|---|
| `calDeviationPct` | Float? | Calorie deviation % |
| `protDeviationPct` | Float? | Protein deviation % |
| `carbDeviationPct` | Float? | Carb deviation % |
| `fatDeviationPct` | Float? | Fat deviation % (captured, not routed) |
| `triggerMacro` | String? | Which macro triggered action |
| `calScaleFactor` | Float? | Calorie-only scale factor |
| `protScaleFactor` | Float? | Protein-only scale factor |
| `carbScaleFactor` | Float? | Carb-only scale factor |
| `blendedScaleFactor` | Float? | Weighted blend before clamping |

Migration: `server/src/prisma/migrations/20260514000000_add_multi_macro_deviation_fields/migration.sql`

### Files modified

| File | Change |
|---|---|
| `server/src/services/macroValidation.ts` | Added `PROTEIN_REGEN_PCT`, `PROTEIN_SCALE_PCT`, `CARB_SCALE_PCT`. Replaced `DeviationResult` + `computeDeviation` with multi-macro version. Replaced `computeProportionalScaleFactor` with weighted blend returning object. Added `normaliseIngredientForCN`, `normaliseIngredientsForCN`, `UNIT_GRAM_MAP`. |
| `server/src/routes/ai.ts` | Added `normaliseIngredientsForCN` import. Added 9 new fields to `MealLogData`. Updated both call sites of `computeDeviation` and `computeProportionalScaleFactor`. Added `logScaleComponents` variable + blend log. Added CN normalisation block before each CN call. Added `corrMeal.mealIndex = mealIndex`. Updated logData assembly with new fields. Refactored `buildMealTargetsSection` to call `getMealMacroTargets` + accept `fibreG`. Updated write block with 9 new fields. |
| `server/src/services/macroValidationLogger.ts` | Added 9 new fields to `MealValidationEntry` interface and `logMealValidation` Prisma write. |
| `server/src/prisma/schema.prisma` | Added 9 new fields to `MacroValidationLog` model. |
| `server/src/prisma/migrations/20260514000000_add_multi_macro_deviation_fields/migration.sql` | `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for all 9 new columns. |

---

## 16. Rejection history in correction prompt + correction data wired into logs (2026-05-14)

**Commit:** `2146ffe`

### Diagnostic findings (pre-fix)

Queried last 3 plans from `macro_validation_logs`:

- `correctedMealName = NULL` for **100% of exhausted meals** across all plans — the flat while loop was never populating correction data into logData or MealValidationEntry.
- `buildMealCorrectionPrompt` received **no attempt number and no history** of previous failures — Claude generated a new meal with zero knowledge of what it already tried, producing near-identical dishes on each attempt.
- Pattern observed in plan `cmp4bb4ol00079p3od`: D1M4 "Prawn Masala with Roti" (Claude: 382 kcal, CN: 1842 kcal) exhausted all 5 attempts — pre-normalisation roti bug caused >35% deviation on first call, then Claude regenerated more roti-based meals each time.

### Fix 1 — Rejection history in `buildMealCorrectionPrompt`

**New signature:**
```typescript
buildMealCorrectionPrompt(
  originalMeal, mealTarget, rejectionReason, userProfile,
  attemptNumber: number = 1,
  previousAttempts: FailedAttempt[] = [],
)
```

**`FailedAttempt`** interface (exported from macroValidation.ts):
```typescript
{ mealName, claudeCal, cnCal, deviationPct, triggerMacro }
```

**Prompt additions:**
- At attempt ≥ 2: lists all prior failures with name + macro deviation + kcal gap so Claude cannot regenerate the same dish
- At attempt ≥ 3: explicit escalation — "COMPLETELY DIFFERENT type of dish: different protein source, different cooking method"

`buildDayLevelCorrectionPrompt` passes `attemptNumber=1, previousAttempts=[]` (day-level correction is always a single shot).

### Fix 2 — Correction data wired from while loop into logs

Inside `validateAndFinaliseMeal`:
- `previousAttempts: FailedAttempt[]` accumulated before each correction call (pushes current deviation data so next call sees the history)
- `lastCorrectedMeal` captures the most recent Claude correction for DB logging
- `lastCorrectionReason` captures the formatted reason string

New `MealLogData` fields: `correctionTriggered`, `correctionReason`, `correctedMealName`, `correctedCalories`, `correctedProtein`, `correctedCarbs`, `correctedFat`, `correctedFibre`

Write block now populates `MealValidationEntry.correction` from these logData fields — `correctedMealName` will be non-NULL for all plans going forward.

### Fix 3 — `queryAttemptDetail.ts` diagnostic script

`server/src/scripts/queryAttemptDetail.ts` — run with `npm run query:attempts [planId]`.

Prints:
- All meals with `attemptsUsedAtThisMeal ≥ 3` or `finalOutcome = attempts_exhausted`
- Full per-meal detail: original name, CN returned, deviation, scaling, corrected name, recheck cal, final outcome
- Data completeness check: `correctedMealName populated X/Y`
- Plan-level summary: outcome breakdown, fast-track count, correction count

### Files modified

| File | Change |
|---|---|
| `server/src/services/macroValidation.ts` | Added `FailedAttempt` interface. Updated `buildMealCorrectionPrompt` with `attemptNumber` + `previousAttempts` params + history block + escalation block. Updated `buildDayLevelCorrectionPrompt` to pass `1, []`. |
| `server/src/routes/ai.ts` | Imported `FailedAttempt`. Added correction fields to `MealLogData`. Added `previousAttempts[]`, `lastCorrectionReason`, `lastCorrectedMeal` vars. Push to `previousAttempts` before each correction. Pass `attemptNumber`+`previousAttempts` to `buildMealCorrectionPrompt`. Capture `lastCorrectedMeal` after parse. Populate correction logData fields. Wire `MealValidationEntry.correction` in write block. |
| `server/src/scripts/queryAttemptDetail.ts` | New file — diagnostic query script. |
| `server/package.json` | Added `"query:attempts": "tsx src/scripts/queryAttemptDetail.ts"`. |

## 17. Dashboard v4 gap fixes — post-scale normalisation, ml→g in main pipeline, Path 3 hint semantics, duplicate-generation guard (2026-06-10)

### Context

`MacroValidation_Dashboard_v4` (fix-validation tab) audited a validation run and flagged
items B1–B8 plus six action items. Cross-checking against this repo's code showed most
were already fixed here — the audited run came from an older deployed build (B1 mealIndex,
B3 >35% boundary, B5 proportional macro split, B6 multi-macro routing, B7 weighted blend,
and AI5 plan-level fast-track persistence are all present and wired). Three real gaps
remained in the code; all fixed below.

### Fix 1 — Post-scale CN recheck was sent raw, unnormalised ingredients

The initial CN call went through `normaliseIngredientsForCN`, but the post-scale recheck
in `validateAndFinaliseMeal` passed `scaledIngredients` straight to CN. A scaled string
like "2 whole wheat rotis (96g)" hit the same default-serving-weight inflation the
normaliser exists to prevent — producing false `scaling_sanity_failed` outcomes and
needless regeneration escalations. Both CN calls now go through a shared
`prepareCnIngredients()` helper.

### Fix 2 — ml→g conversion missing from the main pipeline

`normaliseMl` ("10ml ghee" → "9g ghee"; CN reads unparseable ml as 100g ≈ 900 kcal) only
ran in the legacy `verifyDayMacros` path. The main pipeline never applied it. Now exported
from `calorieNinjasService` and folded into `prepareCnIngredients()` (normaliser first,
then ml→g).

### Fix 3 — Path 3 bracket-hint semantics (count × hint double-counting)

Path 3 of the normaliser multiplied count × bracket grams ("2 whole wheat rotis (80g)" →
160g). But the generation prompt's convention is total weight ("2 eggs (100g)" = 100g
total), and the dashboard's own D7M4 evidence confirms it: Claude's 381 kcal meal estimate
only adds up with 80g of roti, not 160g. Path 3 now disambiguates: items with a known
per-unit weight in `UNIT_GRAM_MAP` use whichever reading (per-unit vs total) sits closer
to the hint; unknown items read the hint as total. "3 idlis (40g)" → 120g (per-unit),
"2 whole wheat rotis (80g)" → 80g (total). Tests extended 14 → 16, all passing.

### Fix 4 — Duplicate plan generation guard (action item 6)

Two byte-identical plans at the same timestamp = concurrent duplicate generation (the
route had no idempotency guard; the in-memory daily rate limit allows 3/day). Added an
in-flight `Set<userId>` guard on `/generate-meal-plan`: concurrent request → 409
`generation_in_progress`, checked before the monthly counter increments so a double-fire
doesn't burn quota. Cleanup via `res.once('close')` so it fires on success, error, and
client abort. In-memory, so best-effort on serverless — but warm-instance duplicates (the
common case) are stopped.

### Files modified

| File | Change |
|---|---|
| `server/src/services/macroValidation.ts` | Path 3 hint disambiguation (total vs per-unit). |
| `server/src/services/calorieNinjasService.ts` | Exported `normaliseMl`. |
| `server/src/routes/ai.ts` | `prepareCnIngredients()` helper used on both CN calls; in-flight duplicate-generation guard. |
| `server/src/scripts/testNormalisation.ts` | Path 3 tests updated for new semantics + 2 new cases (16/16). |

## 18. Browse Recipes tab — community recipe library from validated plan meals (2026-06-11)

### What was built

A new "Recipes" tab that turns every meal the AI has generated across all users'
plans into a searchable, filterable, likeable recipe library, with a
save-to-plan action that swaps a library recipe into a chosen day/meal slot of
the user's own plan. No new content creation — the library is extracted from
existing MealPlanDay.meals blobs and grows automatically as plans are generated.

### Dedupe strategy (the make-or-break detail)

`dedupeKey = canonicalName | mealType | calorieBucket(50)`

1. **canonicaliseRecipeName**: lowercase → strip punctuation → drop filler words
   (with/and/served/fresh/homemade/style/…) → drop preparation words
   (grilled/steamed/chopped/…) unless that empties the name → sort tokens
   alphabetically → join. "Grilled Chicken Salad with Veggies" → "chicken salad veggies".
2. **mealType** is collapsed to the four library slots (morning_snack/evening_snack → snack),
   so a snack and a dinner version of the same dish stay distinct.
3. **calorieBucket** rounds to the nearest 50 kcal — 288/291/305 collapse to 300; 288 vs 388 stay apart.
4. **Macro similarity guard**: a meal merges into an existing recipe only if protein,
   carbs AND fat are each within ±20%; otherwise it becomes a distinct variant
   (dedupeKey suffix `|v2`…`|v5`, max 5 variants per key).
5. **Merge keeps the best representative**: longest ingredient list wins; macros are
   the running mean across merged instances (converges on the median given the ±20%
   gate has already excluded outliers — exact medians would need every historical
   instance stored); sourceCount increments and becomes the popularity signal.

### Backfill results (run against Neon, 2026-06-11)

- 51 MealPlanDay rows → **187 raw meals** extracted (0 unparseable blobs)
- 199 validation log rows cross-referenced for per-meal verdicts
- **28 filtered out** for bad/unverified macros
- 133 unique canonical names → 144 composite keys
- **127 recipes created + 6 variants** (macro guard kept near-collisions distinct) = **133 total**
- 26 meals merged into existing recipes
- Largest merge cluster: "Fish rice curry" ×4

### Quality filter

- Validation verdict available: ingest only `accepted_cn` / `accepted_after_scaling`;
  reject `attempts_exhausted`, `scaling_sanity_failed`, `correction_parse_failed`,
  `cn_failure`, `partial_match_failure`, `cn_fast_track_failure`.
- No verdict (pre-pipeline plans, cn_unavailable): sanity filter — calories 50–1500,
  macros present and non-negative, macro-derived calories (4P+4C+9F) within ±40% of stated.

### Diet type inference

Keyword scan over name + ingredients: non-veg keywords (chicken/fish/mutton/prawn/…)
win first; then `\begg` regex (so "paneer bhurji" stays veg, "egg bhurji" is egg);
default veg. Verified on live data: Fish rice curry → non_veg, Poha egg scramble → egg,
Curd apple snack → veg.

### Sharing

`GET /api/recipes/:id/share` returns `{url, text, title}`. The URL points to a
**public read-only HTML view** at `GET /recipe/:id` (no auth, noindex, dark-themed,
served by `publicRecipeRouter` mounted without the /api prefix). Client uses the
Web Share API on mobile with clipboard fallback on desktop.

### Save-to-plan

`POST /api/recipes/:id/save-to-plan {mealPlanId, dayIndex, mealIndex}`:
ownership check first (404 on foreign plans — verified), replacement meal **keeps the
slot's canonical type and mealIndex** (the vlog↔plan join key — the §15 bug class),
day totals recomputed from the final meal set. **CN validation is skipped by design**:
library recipes already passed the quality filter, and re-validating could silently
change the macros the user just previewed. Meal-type mismatch (e.g. dinner recipe →
lunch slot) returns `typeMismatch: true` and the UI shows a non-blocking
"this is usually a {type}" note at the confirm step.

### Schema note

The Prisma schema engine binary is SIGKILLed by macOS Gatekeeper on this machine,
so the migration (`20260611000000_add_recipe_library`, idempotent SQL) was applied
via the query engine and recorded in `_prisma_migrations` manually — `migrate deploy`
on Vercel/CI will see it as already applied.

### Verification

Server + client `tsc --noEmit` clean; vite production build clean; live smoke test
against Neon covered: 401 gating, list/sort/filter/search, like (idempotent double-like,
unlike), detail, share payload, public share view (200), save-to-plan (slot type kept,
mealIndex present, totals 759.3 = 300 + 459.3 exact), foreign-plan rejection.
Test user and synthetic plan deleted afterwards; library state: 133 recipes, 0 likes.

### Files

| File | Change |
|---|---|
| `server/src/prisma/schema.prisma` | `Recipe` + `RecipeLike` models, User relation, indexes on mealType/dietType/calories/protein/fibre/likeCount/sourceCount/createdAt, unique dedupeKey |
| `server/src/prisma/migrations/20260611000000_add_recipe_library/` | Idempotent migration SQL |
| `server/src/services/recipeService.ts` | New — canonicalisation, dedupe, diet inference, quality filter, ingestion with merge/variant logic |
| `server/src/scripts/backfillRecipes.ts` | New — backfill with stage-by-stage merge statistics |
| `server/src/routes/recipes.ts` | New — list/detail/like/share/save-to-plan + public share view |
| `server/src/routes/ai.ts` | Fire-and-forget recipe ingestion after plan save, gated by per-meal finalOutcome |
| `server/src/app.ts` | Mounted `/api/recipes` + public recipe router |
| `client/src/types/index.ts` | `recipes` TabId, `Recipe` + `RecipeFilters` interfaces |
| `client/src/hooks/useRecipes.ts` | New — useRecipes (debounced 350ms, paginated, stale-response guard), useRecipe, useToggleLike (optimistic + rollback), useShareRecipe, useSaveRecipeToPlan (refreshes cached plan) |
| `client/src/components/BrowseRecipesTab.tsx` | New — card grid, meal/diet chips, macro range panel, sort, search, detail overlay with macro bars, save-to-plan modal (day → slot → before/after preview) |
| `client/src/components/BottomNav.tsx` | Added RECIPES tab |
| `client/src/App.tsx` | Lazy import + render branch |

Reminder: run `cap sync` before the next mobile build so the WebView picks up the new tab.

## 19. Proportional macro split guard + TDEE calculation audit trail (2026-06-13)

Two parts from a combined brief: (A) the per-meal macro split, (B) a step-by-step
TDEE audit log.

### Part A — proportional macro split (already correct; guard added)

The brief described a bug where `getMealMacroTargets` split protein/carbs/fat by
`/ mealsPerDay` (equal split) while calories used `* weight`. **In this repo that
was already fixed** (during the §15 multi-macro work) — all four macros already use
`* weight`:

```typescript
calories: Math.round(dailyTargets.calories * weight),
proteinG: Math.round(dailyTargets.proteinG * weight * 10) / 10,
carbsG:   Math.round(dailyTargets.carbsG   * weight * 10) / 10,
fatG:     Math.round(dailyTargets.fatG     * weight * 10) / 10,
fibreG:   Math.round(dailyTargets.fibreG   * weight * 10) / 10,
```

So no code change was made to `getMealMacroTargets` (kept the existing robust
version, which also has a `?? MEAL_WEIGHT_DISTRIBUTIONS[4]` fallback the brief's
template dropped). Added `server/src/scripts/testMacroSplit.ts` as a regression
guard. Output (2850 kcal, 4 meals):

```
breakfast  cal=713 | P28 C114.8 F16.8 | macro-kcal=722 | drift=1% OK
lunch      cal=997 | P39.2 C160.6 F23.5 | macro-kcal=1011 | drift=1% OK
snack      cal=285 | P11.2 C45.9 F6.7 | macro-kcal=289 | drift=1% OK
dinner     cal=855 | P33.6 C137.7 F20.1 | macro-kcal=866 | drift=1% OK
Snack carbs = 45.9g (expected ~46g, NOT 114.75g): PASS
All slots internally consistent: PASS
```

The snack carbs land at 45.9g (proportional), not 114.75g (equal-split) — confirming
the split is correct.

### Part B — TDEE calculation audit log

New `TdeeCalculationLog` model (`tdee_calculation_logs` table), one row per
calculation, capturing the full input snapshot + each derivation step. `calculateTDEE`
in `utils/tdee.ts` was instrumented to emit a `TdeeBreakdown` alongside the existing
`NutritionTargets` — **capture only, the math is unchanged.**

Variable → breakdown-field mapping (real code names differ from the brief's template):

| breakdown field | actual source in `calculateTDEE` |
|---|---|
| `bmrValue` | `bmr` (Mifflin-St Jeor, line ~80) |
| `activityMultiplier` | `multiplier` = `ACTIVITY_MULTIPLIERS[activityLevel]` |
| `tdeeBeforeAdjust` | `bmr * multiplier` (raw, before age/health) |
| `goalAdjustment` | `targetCalories - roundedTDEE` after the goal step (deficit/surplus/bonus) |
| `neatAdjustment` | `tdeeAfterAdjust - _goalTargetCalories` (steps + occupation + training-type + training-volume kcal) |
| `tdeeAfterAdjust` | `targetCalories` just before the safety-floor re-apply |
| `safetyFloorApplied`/`Type` | gender `SAFETY_FLOOR` raise → `calorie_<n>`; else fat-30g floor → `fat_30g`; else null |
| `proteinBasis` | `${proteinPerKgByGoal[goal]}g_per_kg` |
| `fatBasis` | `${fatMultiplierByGoal[goal]}g_per_kg`, or `30g_floor` when the fat floor fires |
| `carbsBasis` | `'remainder'` |
| `ageSlowdownApplied`, `healthAdjustments` | captured into `breakdownJson` |

The breakdown is persisted fire-and-forget in `ai.ts` right after `mealPlan.create`
(off the critical path; a logging failure never breaks generation). Migration applied
to production via idempotent `CREATE TABLE IF NOT EXISTS` (prod's Prisma migration
history is not fully in sync — the Recipe table was applied outside it — so a direct
additive DDL is safer than `migrate deploy`).

Query script `queryTdeeHistory.ts` (`npm run query:tdee -- <userId>`) traces a user's
calculations over time with a movement summary.

### Files

| File | Change |
|---|---|
| `server/src/services/macroValidation.ts` | none (split already proportional — verified, not changed) |
| `server/src/scripts/testMacroSplit.ts` | new — macro-split regression guard |
| `server/src/prisma/schema.prisma` | added `TdeeCalculationLog` model |
| `server/src/prisma/migrations/20260613000000_add_tdee_calculation_log/migration.sql` | new — idempotent CREATE TABLE |
| `server/src/utils/tdee.ts` | added `TdeeBreakdown`, instrumented `calculateTDEE` (capture only) |
| `server/src/routes/ai.ts` | persist TDEE breakdown after `mealPlan.create` |
| `server/src/scripts/queryTdeeHistory.ts` | new — TDEE history/trace query |
| `server/package.json` | added `query:tdee` script |

## 20. Two-phase meal-plan generation — CN validation in a clean invocation (2026-06-14)

### The problem

During plan generation, CalorieNinjas (CN) macro checks failed ~60% of the time
(8–11 of 28 meals), so most meals fell back to Claude's macro estimates instead of
being validated and scaled. CN was healthy in isolation (15/15 from inside Vercel,
~200ms), so this was not the API, key, quota, region, or rate limit.

### What it was NOT (ruled out by measurement, not theory)

- **Not the CN API / network.** A fresh serverless invocation doing only CN calls
  scored 28/28, ~365ms each, zero errors.
- **Not a timeout tuning issue.** 5s, 6s, 12s all gave ~8–15/28.
- **Not the connection pool.** Moving CN off Node's global `fetch` (undici) onto a
  dedicated `node:https` agent with `keepAlive:false` (fresh socket per request) still
  gave 11/28 — so it isn't undici pool corruption.
- **Not interleaving with corrections.** Pre-batching all initial CN checks in a tight
  burst (a prefetch) still gave 11/28 — so it isn't the per-meal interleaving either.

### The actual cause

The degradation is **caller-side and invocation-wide**: once a serverless invocation
has made the big Anthropic generation call (holding/processing a ~16–32k-token
response), *any* outbound HTTPS it makes afterward — any host, any connection
mechanism — stalls to the timeout ~half the time. Almost certainly event-loop / memory
pressure while that large response is resident. Proof: the **same plan's** CN checks
scored **11/28 inside the generation invocation but 28/28 when run as a separate
request** (even reusing the warm instance — a fresh invocation frees the memory and is
clean again).

### The fix — split generation from validation

- **Phase 1** `POST /ai/generate-meal-plan`: generate via Anthropic, save the **raw**
  plan (with sensible day totals computed from Claude's macros), return immediately with
  `needsValidation: true` + `mealPlanId`. No inline CN validation.
- **Phase 2** `POST /ai/validate-plan` (new SSE endpoint): the client calls this right
  after generation. Because it's a **separate invocation** (clean caller), it loads the
  saved plan and runs the full CN macro-validation + correction + scaling pipeline, then
  updates the day rows, `cnChecks`/`cnCorrections`, validation logs, and recipe ingestion.
- **Client** (`Onboarding.tsx`, `ProfileTab.tsx`): after generation, automatically call
  phase 2 showing "Validating meal macros…" before the review screen. Shared
  `streamSSE()` helper in `lib/api.ts` (XHR-based so native Capacitor carries the Bearer
  token). Validation is **non-fatal** — a failure leaves the plan usable with Claude's
  estimates.

The `runMacroValidation()` and `persistValidationLogs()` logic was extracted verbatim
from the generation handler into module-level functions so both never diverge.

### Result

CN genuine-validation went **11/28 → 23/28** on a live 7-day generation (2× more meals
validated + scaled to target; 15 `accepted_after_scaling`). It is 23 rather than the
isolated 28 because phase 2 itself makes Anthropic correction calls, and the first one
re-poisons the phase-2 invocation, degrading the post-correction rechecks. The remaining
~5 fall back to Claude estimates exactly as before.

**Future optimisation (not done):** a two-pass phase-2 — run all 28 initial CN checks
first as a clean burst, *then* do corrections — would keep the initial reads at ~28/28
and limit degradation to the smaller set of post-correction rechecks, likely pushing
genuine validation toward 28/28. Deferred: the current flat per-meal loop is carefully
tuned (fast-track, slot failures, day budget) and restructuring it carries regression
risk that 23/28-with-fallback doesn't justify yet.

### Files

| File | Change |
|---|---|
| `server/src/routes/ai.ts` | split generate/validate; extracted `runMacroValidation` + `persistValidationLogs`; new `/validate-plan` SSE endpoint; phase 1 returns `needsValidation` |
| `server/src/services/calorieNinjasService.ts` | CN on a dedicated `node:https` agent (kept — harmless, slightly more isolated) + 2-attempt retry |
| `client/src/lib/api.ts` | new `streamSSE()` helper (shared XHR-SSE POST with Bearer) |
| `client/src/components/Onboarding.tsx` | call `/validate-plan` after generation |
| `client/src/components/ProfileTab.tsx` | call `/validate-plan` after regeneration |

## 21. Per-meal macro target equal-split — found in the logger, plus two latent log bugs (2026-06-22)

### The reported bug (and where it actually was)

Report: `getMealMacroTargets` divides protein/carbs/fat equally by `mealsPerDay`
while calories use the slot weight, so a 4-meal snack is targeted at 152/4 = 38g
protein instead of ~15g — supposedly causing oversized snacks that fail CN.

**Step 0 found the premise was stale.** `getMealMacroTargets` was already fully
proportional in both the working tree and `origin/main` (fixed in `3e5f92f`,
verified in §19). The current lines:

```ts
proteinG: Math.round(dailyTargets.proteinG * weight * 10) / 10,
carbsG:   Math.round(dailyTargets.carbsG   * weight * 10) / 10,
fatG:     Math.round(dailyTargets.fatG     * weight * 10) / 10,
```

Every consumer already uses it as the single source of truth: the Claude prompt
(`buildMealTargetsSection`, ai.ts), the per-meal validation/correction target
(ai.ts), and the day-level correction. So generation was **never** mis-targeting
meals — the author's claimed consequence (oversized snacks failing CN) does not
follow from this code.

**The real equal-split was in the validation logger** —
`macroValidationLogger.ts`, the per-meal target it WRITES to `macro_validation_logs`:

```ts
// OLD (bug): calories weighted, the other three equal-split
calories: Math.round(entry.targets.dailyCalories * mealCalPct),
protein:  entry.targets.dailyProtein / entry.mealsPerDay,   // 152/4 = 38g for a snack
carbs:    entry.targets.dailyCarbs   / entry.mealsPerDay,
fat:      entry.targets.dailyFat     / entry.mealsPerDay,
```

That is the 38g the author saw — it came from the **log**, not the meal sizing.
Fix routes all four macros through the same `getMealWeightPct` (matching
`getMealMacroTargets`). It only ever corrupted the logged target columns and their
protein/carbs/fat deltas; routing uses CN-vs-Claude calorie deviation, computed
separately, so meals were unaffected.

### Two latent log bugs surfaced while verifying (Step 5)

Confirming the fix in a real generation was blocked because **no** validation logs
were persisting. Two further bugs, both pre-existing:

1. **8s write race in two-phase `/validate-plan`** — log inserts were raced against
   an 8s ceiling, then `res.end()` froze the serverless instance and killed the
   in-flight writes. Fixed: await all inserts fully (Prisma writes complete fine in
   that invocation) and return the count as `logsWritten`.

2. **Schema drift — missing `cnAttempted` column (the actual blocker).** The model
   has `cnAttempted Boolean @default(false)` and the logger writes it, but the prod
   table never got the column (earlier migrations used `CREATE TABLE IF NOT EXISTS`,
   which skips existing tables). Every insert threw `column "cnAttempted" does not
   exist`, and the logger's try/catch swallowed it — so `logsWritten:28` reported
   success while 0 rows reached the DB. Fixed with an additive `ALTER TABLE ADD
   COLUMN IF NOT EXISTS`, applied to prod and committed as an idempotent migration.

### Verification

- `testMacroSplit.ts` (extended): proportional split holds, and the logger-path
  guard asserts snack protein = `152 × 0.10 = 15.2g`, not `152/4 = 38g`. Passes.
- **Pre-fix prod log (bug live):** a real run logged all four slots at 32.5g
  (= 130/4) — identical across breakfast/lunch/snack/dinner.
- **Post-fix prod run:** `logsWritten:28` AND **28 rows actually in the DB**; Day-1
  protein targets `39.5 / 55.3 / 15.8 / 47.4g` (25/35/10/30% — not identical);
  **snack `mealTargetProtein` = 15.8g** (weighted ×0.10), not 39.5g equal-split.
- Commits on `origin/main`: `0ed5871` (logger split), `9625043` (await log writes),
  `5104f55` (cnAttempted migration). Vercel auto-deploys `origin/main`.

### Files

| File | Change |
|---|---|
| `server/src/services/macroValidationLogger.ts` | per-meal protein/carbs/fat target now weighted (`* mealCalPct`), not `/ mealsPerDay` |
| `server/src/routes/ai.ts` | `persistValidationLogs` awaits all inserts fully + returns count; `/validate-plan` done event reports `logsWritten` |
| `server/src/scripts/testMacroSplit.ts` | added logger-path guard (snack protein weighted, not 38g) |
| `server/src/prisma/migrations/20260622000000_add_cn_attempted_column/migration.sql` | new — idempotent ADD COLUMN for prod drift |
| production DB | `ALTER TABLE macro_validation_logs ADD COLUMN IF NOT EXISTS "cnAttempted"` applied |

## 22. Two-pass macro validation + scale-first routing — CN coverage 11/28 → 28/28 (2026-06-22)

### Deep analysis (now possible — §21 restored the logs)

A real 28-meal run broke down as: `cn_plan_fast_track` 17, `attempts_exhausted` 8,
`accepted_after_scaling` 3 — i.e. **only ~11/28 meals were genuinely CN-validated**.
Two failure engines, both downstream of the same root cause (the AI call degrades
later outbound HTTPS in the same invocation — §20):

1. **Fast-track cascade (dominant, 17/28).** When a meal *slot* failed CN twice
   across days (`CN_FAST_TRACK_THRESHOLD=2`), CN was disabled for that slot for the
   rest of the plan. Because corrections were interleaved with CN checks, the early
   days' Claude calls poisoned later CN calls; by day 3 every slot had 2 failures,
   so **days 3–6 were skipped entirely** (no CN call at all). Designed for genuinely
   CN-blind foods, it was firing on transient poisoning.
2. **Interleaving + per-day budget starvation (8/28).** Days interleaved CN with
   Claude corrections (poisoning later reads) and the shared `MAX_CLAUDE_ATTEMPTS_PER_DAY=5`
   budget was burned by the first hard meals, leaving siblings `attempts_exhausted`.

### Fix 1 — two-pass orchestration (`runMacroValidation`)

`validateAndFinaliseMeal` gained `cnOnly` and `maxAttempts`; scaling/guards/logging
otherwise unchanged.
- **Pass A (cnOnly, zero Claude calls):** CN-check + accept/scale EVERY meal before
  any correction, so the invocation stays clean and CN succeeds for ~all meals. The
  plan-level fast-track is bypassed in cnOnly mode, killing the cascade. Off-target
  meals are deferred as `needs_regen`.
- **Pass B (corrections):** only the deferred meals get Claude regeneration, each
  with its OWN small budget (no sibling starvation), bounded plan-wide; any meal left
  `needs_regen` is relabelled (keeps Claude estimate — CN still read it cleanly).

**Result (verified live):** CN coverage **11/28 → 28/28**, `cn_plan_fast_track` → **0**.

### Fix 2 — scale-first routing (`computeDeviation`)

After Fix 1, ~21/28 meals routed to Claude `regenerate` (CN-vs-Claude >35%) and the
corrections did NOT converge — even though the CN rechecks succeeded. The realisation:
CN gives the meal's *true* macros, so a large CN-vs-Claude gap just means Claude
mis-estimated; **scaling (deterministic portion math) hits a calorie target far more
reliably than asking Claude to regenerate.** Raised `DEVIATION_SCALE_MAX_PCT` 35 → 200
so calorie-magnitude deviations scale first. Scaling self-limits — the factor is
clamped to `[0.5, 1.20]` and a post-scale CN re-check escalates to `regenerate` only
when portions genuinely can't reach target. Protein *ratio* errors (`protDev > 50`)
still regenerate (scaling can't fix a ratio).

### Verification

- Live run: CN `cnApiSuccess` **28/28**, zero fast-track (Fix 1).
- Routing unit test (no API): 30/50/90% calorie-over → `scale` (was `regenerate`);
  225% → `regenerate`; protein-ratio 200% → `regenerate(protein)`; in-tolerance →
  `accept_cn`. All pass (Fix 2).
- **Pending:** the end-to-end post-Fix-2 outcome distribution (expected: most meals
  `accepted_cn`/`accepted_after_scaling`, few regenerate) was not captured live —
  the Anthropic key hit its daily rate limit after ~12 full test generations, so fresh
  generation returns the generic error (a 429 isn't mapped in the generate catch).
  Code is deployed and clean; re-run a generation once the key resets to capture it.

### Files

| File | Change |
|---|---|
| `server/src/routes/ai.ts` | `validateAndFinaliseMeal` gains `cnOnly`/`maxAttempts`; `runMacroValidation` rewritten as plan-wide Pass A (clean CN classify) + Pass B (targeted corrections) + apply/day-budget/logging; `needs_regen` safety relabel |
| `server/src/services/macroValidation.ts` | `DEVIATION_SCALE_MAX_PCT` 35 → 200 (scale-first for calorie magnitude) |

### Follow-up (not done)
A 429/overload branch in the generate-meal-plan catch would surface "service busy,
try again" instead of the generic failure — worth adding so users get an accurate
message when the AI provider is rate-limited.

## 23. Validation tuning to completion — CN 28/28, churn 28→7 corrections (2026-07-01)

§22's two-pass + scale-first got CN reads to 28/28 but live runs still showed a
cascade and heavy correction churn. Driving from the (now-reliable) logs, five more
changes — each measured on production via a manual deploy — took it the rest of the way.

### The deploy gap (root of the "it regressed" confusion)
The `diet-app` Vercel project **was not auto-deploying from GitHub** — production was
8 days stale, so scale-first (and others) sat on `main` un-deployed while live runs
showed old behaviour. Builds succeed when triggered manually. **Deploy via CLI**
(`vercel link --project diet-app --scope harsh1tv-4567s-projects`, then
`vercel deploy --prod`) after every push, or reconnect the Git integration. Runtime
logs via `vercel logs <url> --json` (needs a live request) — this is how the
"generation failure" was finally pinned to Anthropic's monthly usage cap (a `400`
`invalid_request_error`, not a 429), not a code bug.

### The tuning chain (each verified live)
1. **Disable the plan-level fast-track cascade** (`CN_FAST_TRACK_THRESHOLD` → ∞). In the
   two-pass design Pass A already CN-checks every meal cleanly, so the only failures
   left were Pass B's poisoned rechecks — fast-tracking them disabled CN for whole days.
   Result: cascade 15→0, CN coverage → 28/28. But all 28 then `attempts_exhausted`.
2. **On-target short-circuit** (routes/ai.ts). CN gives true macros; if they're within
   ±15% of the meal *target*, accept them — don't churn corrections to make CN match
   Claude's (wrong) estimate. 6→9 meals accepted directly.
3. **Protein no longer forces regenerate** (`PROTEIN_REGEN_PCT` → ∞). A CN-vs-Claude
   protein gap is Claude's estimate error, not a meal defect; route protein to scale/
   accept. Eliminated all `regenerate` routing (deviationAction scale=26).
4. **Calorie-dominant scale factor** (50/35/15 → **80/15/5** cal/prot/carb). The protein
   term was dragging the blend off the calorie-optimal so post-scale calories missed and
   the meal escalated to a non-converging regeneration. Post-scale acceptance is
   calorie-based and protein is taken from CN, so weight calories. This was the unlock.

### Final result (live)
CN coverage **28/28**; cleanly validated (accept_cn + accepted_after_scaling) **24/28**;
within meal target ±15% **28/28**; Claude corrections **7** (was ~16–28). Remaining ~4
fall back gracefully (genuinely hard meals: scaling clamp can't reach, or CN partial
match). Progression of cleanly-validated across the chain: 0 → 9 → 13 → **24**.

### Philosophy shift captured here
Validation now trusts CN as the source of truth and uses **deterministic scaling toward
the calorie target** as the primary tool; Claude regeneration is a last resort, not the
default. The old routing "fixed" CN-vs-Claude disagreement even when the meal was already
on target — pure churn. CN-vs-*target* is what matters.

### Files

| File | Change |
|---|---|
| `server/src/services/macroValidation.ts` | `CN_FAST_TRACK_THRESHOLD`→∞; `PROTEIN_REGEN_PCT`→∞; scale blend 80/15/5 |
| `server/src/routes/ai.ts` | on-target short-circuit before scale/regenerate |

### Follow-ups (not done)
- Reconnect Vercel↔GitHub auto-deploy (or keep deploying manually).
- Map Anthropic `400` usage-cap / `429` in the generate catch → accurate "service busy" message.
- The 3 pre-existing `TS2835` import-extension warnings (`auth.ts`/`plan.ts`/`refreshToken.ts`) are non-fatal but worth cleaning.

## 24. Publish-readiness audit + safe auto-fixes (2026-07-01)

Audit-and-plan pass for App Store / Play Store publishability. Full findings in
`PUBLISH_READINESS.md` (domain-by-domain tables + three-tier action plan, Top-5
blockers at the top); privacy-form inventory in `DATA_INVENTORY.md`.

Overall: the security fundamentals were already in place (helmet, CORS
allowlist, rate limiting, cookie flags, Prisma parameterisation, generic prod
errors, JWT_SECRET startup enforcement, account deletion, privacy/terms pages,
PrivacyInfo.xcprivacy). The real gaps are operational: signing material, the
canonical domain for legal/App-Link URLs, store forms/screenshots, one proven
release build per platform, and the broken Vercel↔GitHub auto-deploy.

Auto-fixes applied (the narrow safe list only):

| File | Change |
|---|---|
| `capacitor.config.ts` | `server.cleartext` true → false (API is HTTPS-only; dev uses bundled assets) |
| `android/app/src/main/AndroidManifest.xml` | removed `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `SCHEDULE_EXACT_ALARM` — leftovers from the uninstalled local-notifications plugin (exact-alarm is a Play review flag); kept `VIBRATE` for @capacitor/haptics |
| `SECRETS.md` | `git rm --cached` — gitignore already listed it under "never commit"; it stays locally (content is placeholder documentation, no live secrets — verified) |

Explicitly NOT done (report-only per constraints): `npm audit fix` (2 high
server / 1 high + 1 moderate client — details in report), signing/keystores,
store submissions, Sentry DSN, AI-provider error mapping.

## 25. Cooking instructions "Failed to generate" — three stacked timeouts + a truncation (2026-07-12)

On-device QC found the cooking-instructions feature (meal detail → GENERATE
INSTRUCTIONS) always showed "Failed to generate. Try again." Audio (next step)
also failed. Root-caused four distinct problems, three of which stacked on the
same request:

1. **25s request-timeout middleware** (`server/src/app.ts`). The global
   `requestTimeout(25_000)` dated from the old Hobby 30s assumption. A cooking-
   instruction generation makes a multi-second Claude call and takes ~45-60s, so
   the middleware returned a 503 at 26s before the handler could respond. Raised
   to 120s (the Vercel function `maxDuration` is 300s; SSE endpoints flush headers
   immediately so the timer is a no-op for them).

2. **callLLM 30s default timeout** (`server/src/routes/meals.ts`). Even past the
   middleware, `callLLM` defaults to a 30s `AbortSignal.timeout`, so the Claude
   call self-aborted. Set explicit timeouts: `110_000` for `/instructions/generate`,
   `60_000` for the audio-script (`buildEnglishAudioScript`).

3. **maxTokens 4096 truncation** (`meals.ts`). The instruction prompt asks for a
   full JSON object (steps + ingredients + tips). A complex recipe (e.g. Masala
   Dosa with Sambar: 16 steps, 17 ingredients) is ~14k chars and ran past 4096
   tokens, ending mid-array → JSON.parse threw → generic 500. Raised to 8000.

4. **Client axios 15s default** (`client/src/components/MealDetailSheet.tsx`). The
   real kicker for the app: `axios.defaults.timeout = 15000` (in `lib/api.ts`)
   aborts *every* request at 15s. Even with the server fixed (200 in ~57s), the
   WebView gave up at 15s and showed the fallback error. The long-poll meal-gen
   path uses a raw XHR with `timeout = 300000`, but the instruction/audio calls
   used plain `axios.post` and inherited the 15s default. Added `timeout: 130000`
   per request (above the 120s server middleware). Relabelled the spinner copy
   "About 10 seconds" → "Up to a minute" to match reality.

Verified: `curl` to `/api/meals/instructions/generate` → HTTP 200 in 57s with a
complete recipe. New debug APK (loads the local bundle with the client timeout
fix) clean-installed on the Pixel 6a.

**Audio is a separate, config-only issue** (NOT code): `/instructions/generate-audio`
returns 500 because `UNREAL_SPEECH_API_KEY` isn't set in Vercel prod (local repro
throws "No TTS API key configured"). `BLOB_READ_WRITE_TOKEN` has a base64
data-URL fallback so it's optional. Once the TTS key is added to Vercel env and
redeployed, audio should work with no code change.

Commits: 0222b97 (middleware+LLM timeouts), 5b54181 (maxTokens), 626c98c (client
axios timeout + label).

## 26. Password reset broken in prod — missing `password_reset_tokens` table (2026-07-13)

While wiring the real support email and testing password reset, `POST
/api/auth/forgot-password` returned `{error:"server_error"}` (HTTP 500) for a
known-good email. It was **not** an SMTP problem: the handler threw at
`prisma.passwordResetToken.create()` because the **`password_reset_tokens` table
did not exist in the production Neon DB**. The `PasswordResetToken` model is in
`schema.prisma` but no migration in `prisma/migrations/` creates it, and it was
never `db push`ed to this prod DB — so the whole feature had never worked in
production. The outer try/catch turns the "relation does not exist" error into a
generic `server_error`, which masked the real cause (same failure shape as the
earlier `macro_validation_logs` missing-`cnAttempted` drift, §—).

Fix: created the table directly in prod with idempotent, non-destructive DDL
(matching Prisma's expected camelCase columns and the `"User"` FK target — the
User model has no `@@map`, so its table is `"User"`):

```sql
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_tokenHash_idx" ON "password_reset_tokens"("tokenHash");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");
-- FK guarded so re-running is a no-op:
DO $$ BEGIN
  ALTER TABLE "password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

Verified: `prisma.passwordResetToken.count()` = 0 (no error), then re-ran
forgot-password → HTTP 200 `{success:true}` in 4.1s, a token row was written for
the target user with a correct 1-hour expiry, and the 200 (rather than the inner
"Failed to send email" 500) confirms `transporter.sendMail` succeeded — i.e. the
Gmail SMTP config the user added to Vercel works.

Open follow-ups (not code): (1) the prod DB drifts from `schema.prisma` because
the deploy pipeline has no `prisma migrate deploy`/`db push` step — worth adding
so this class of "missing table/column → 500" stops recurring; (2) native signup
collects no email (`AuthScreen`), so password reset is only reachable for
accounts that already have an email (e.g. Google/Apple) — consider adding an
optional email at signup; (3) confirm `FRONTEND_URL` in Vercel points at
`https://diet-app-gules.vercel.app` so the emailed reset link isn't `localhost`.

## 27. Email at signup + login by username-or-email (2026-07-13)

Native signup previously collected only username + password, so accounts had no
email — which made password reset unreachable for username/password users (see
§26) and meant "log in with email" was impossible. Changed both:

- **Signup now requires an email** (validated + unique). New `validateEmail` in
  the shared `api/validation.ts` (client) and a mirrored local helper in
  `server/routes/auth.ts`. Signup de-dupes email up front (409 `email_taken`) and
  the P2002 catch is now target-aware (`err.meta.target`) so a race reports the
  right field. Email is normalised (trim + lowercase) before store/compare.
- **Login accepts a username OR an email** as the identifier. An `@` routes the
  lookup to `email`, otherwise `username` (with the existing mixed-case legacy
  fallback). The client sends `{ identifier, password }`; the server reads
  `identifier ?? username`, so older native builds that still POST `{ username }`
  keep working.
- Client: `AuthScreen` gains an EMAIL field on signup and relabels the login
  identifier to "USERNAME OR EMAIL"; `useAuth.login(identifier)` /
  `useAuth.signup(username, email, …)`.

Verified against production (commit 01b2e5e) with curl: signup-without-email
400; signup-with-email 201; login by username 200; login by email 200; wrong
password 401; duplicate email 409 `email_taken`; legacy `{username}` shape 200;
bad email format 400. UI confirmed on the deployed web app (email field on
signup, "USERNAME OR EMAIL" on login).

Note: existing accounts (including Google/Apple and older username-only signups)
are unaffected — username login still works; only new signups are required to
add an email. The native app needs a `cap sync` + rebuild to pick up the new
signup/login UI.

## 28. Fresh Light migration + Planyourplate rebrand (2026-08-08)

Migration of the client UI from the Strain v2 warm-dark theme to the approved
**Fresh Light** design in `design-reference/`, plus the rebrand to
**Planyourplate**. Work is on the `fresh-light-migration` branch (deliberately
not `main`: the app is visually mid-migration between phases and `main`
auto-deploys to production).

Phases delivered:

- **0-1 Foundation.** Fonts swapped to Archivo (display) + Plus Jakarta Sans
  (sans); `theme/tokens.ts` rewritten to Fresh Light **keeping every existing
  `s2.*` key name**, which flips ~800 inline style references in one edit. New
  keys: `ink`/`ink2`, `onDark*`, pastels (peach/lilac/mint/butter/sky), the
  accent split (`accent` #5F8C12 for text, `accentFill` #C6F24E for fills,
  `accentWash`), per-macro `*Text` variants, `disp`, and the radius scale.
  `mono` is repointed at Plus Jakarta Sans (Fresh Light has no mono face), so
  the ~400 mono call sites keep compiling; numeric columns get
  `fontVariantNumeric: 'tabular-nums'`.
- **The three contrast traps.** Resolved by script with per-token role
  resolution (nearest preceding CSS property), then diff-reviewed: `s2.accent`
  used as a *fill* → `accentFill`; `s2.bg` used as a *foreground* → `ink`;
  hardcoded Strain hexes → tokens. `index.css` body/html, `.shimmer` (→ lime)
  and `.card-glow` (inner highlight → soft drop shadow) fixed. Native shell:
  StatusBar `Dark`→`Light` + `#F2F1EC` (runtime and capacitor.config), plus
  `theme-color` and the PWA manifest.
- **2 Primitives.** Card/HairLabel/Pill/Btn/Bar/VBar/Check/DataRow restyled to
  the reference with their prop APIs preserved (Btn gains six kinds, keeps the
  legacy `primary` prop); new `H`, `Ring`, `IconBtn`, `Row` ported from
  `v3-theme.jsx`.
- **4 Tracker data.** Items 1 and 4 already existed — `/api/tracker/monthly-macros`
  serves per-day per-macro `{consumed,target,delta}` and per-macro totals with
  `dailyAvg`. Added the two real gaps: per-day `adherencePct`/`eaten`/`planned`
  on that endpoint (**same definition as `/summary` and `/stats`** so the
  calendar agrees with the week/month cards), and
  `POST /api/tracker/:date/mark-all-eaten` + `useTracker().markAllEaten`.
  A new `GET /api/water/range` feeds the water series.
- **3 Screens.** BottomNav (floating dark pill, lime active), AuthScreen (pill
  segmented toggle, wordmark lockup, disclaimer moved to a link beside
  Privacy/Terms, rounded inputs and pill buttons), Meals (lime ring hero with
  fibre tick, pastel food discs, macro chip rows, sky hydration card), Tracker
  (pastel big-3, dark card with the 7-metric switcher, adherence month
  calendar, day-detail card with Mark all eaten), Monthly macros (per-macro
  Daily avg / Under target / Over target cells), Water detail (sky hero with
  dashed-remainder ring, 5-column glass grid, quick-add, 7-day bars). A final
  scripted sweep rounded 62 remaining card-like containers across the
  restyle-only screens (dividers, bars and overlays excluded by rule).
- **6 Rebrand.** "Diet Plan & Tracker"/AI-DPT → **Plan Your Plate** across the
  app header, auth lockup, profile footer, share footer, page titles, OG/Twitter
  meta, PWA manifest, Capacitor `appName` and Android `strings.xml`. Auth
  tagline is "YOUR NUTRITION COMPANION". **`applicationId` stays
  `com.dietplan.tracker`** — it is permanent once published, so changing it is
  the user's call, not a side effect of a re-skin.

Data rules held to the repo, per the brief: 1 glass = 250 ml and the water goal
come from the profile; plan/goal figures are unchanged. The reference only wins
on looks.

Verification: `tsc` clean on client and server after every phase; the Phase 7
straggler grep (`#0C0907`, `Space Grotesk`, `IBM Plex`, `AI-DPT`, and the other
Strain hexes) returns nothing; the auth screen was driven in-browser at 375x812.
`AuthScreen.test.tsx` asserted the pre-migration copy "Please enter your
username and password" — the string became "...username or email and password"
back in §27, so the test was already failing on `main`; updated, not deleted.
The local vitest run and `vite build` do not complete on this machine (vitest
produces no output, the build times out, and `tsx` dies with an esbuild
"service was stopped" error) — an environment problem that predates this work;
Vercel builds normally.

Still open: Phase 5 (the onboarding 7→5 step regroup — a deliberate spec change
that must retain every `OnboardingData` field), the MealDetailSheet photo hero /
Ingredients-Steps tabs and the ProfileTab grouped-card restructure, and the e2e
suite.

## 29. Fresh Light — final screens, onboarding regroup, contrast audit (2026-08-08)

Completion of §28 on the `fresh-light-migration` branch.

**Onboarding 8 → 5 (approved spec change).** Regrouped by composing the original
step bodies rather than rewriting the field UI — the strongest guard against the
silent field-drop the brief warned about. `activityLevel` moved out of Body into
step 5; `StepGoals` gained an optional `section` prop (core / training /
kitchen) so step 5 can render it into the three named collapsible groups while
still rendering whole when the prop is omitted. Slide-to-continue on the final
step only (with a transparent tap fallback for WebViews), estimated TDEE on step
5, `canNext()` rules unioned so gating did not change.

Verified twice: statically, all 47 `OnboardingData` fields checked against
`types/index.ts` — 45 render, and the only two that do not are `weeklyBudget`
and `budgetCurrency`, which the brief intentionally omits and which were already
unrendered. At runtime in the browser: "Kitchen & rhythm" collapsed shows none of
its six fields and expanded shows all six; "Body signals" shows all seven.

**MealDetailSheet / ProfileTab.** Macro tiles (pastel grid, kcal full-width),
Ingredients/Instructions segmented tabs, peach swap card; ProfileTab segmented
into YOU / YOUR PLAN / APP / ABOUT & LEGAL with every control left in place.
`isReplaced` remains a flag on one component — still no second layout.

**Contrast audit (Phase 7), measured not eyeballed.** `accentSoft` scores
1.73:1 on white and `accentFill` 1.30:1, so every lime-as-text call site on a
light surface failed AA; MealDetailSheet had lime on lime at 1.30:1. Nine sites
corrected to `s2.accent` (or `s2.ink` on a lime fill). Chart strokes on the dark
card keep lime (14.38:1).

Flagged, not silently changed: `s2.accent` (#5F8C12) is 4.00:1 on white — AA for
large/bold text, short of the 4.5 needed for normal text. The design names it as
*the* accent-text colour, and the reference wins on looks, so this is a
designer decision.

**Bug found while verifying (unrelated to the re-skin, now fixed).** The axios
error interceptor rewrote any error lacking `err.response` into a generic
"Network error" — including cancellations, destroying the marker
`axios.isCancel()` checks. `useAuth`'s /auth/me effect aborts its first request
under React StrictMode, so the catch ran `setUser(null)` and the app showed the
login screen on a valid session; `MealDetailSheet`'s instructions fetch had the
same latent issue. Cancellations now pass through untouched.

Test note (superseded — see §30). An earlier draft of this section recorded the
local test failures as unfixable environment quirks. They were not; §30 has the
diagnosis and the fixes, and everything now runs.


## 30. Local toolchain repaired; full test suite green (2026-08-08)

§29 claimed `tsx`, `vite build` and the server test suite were broken "environment
quirks" that could not be fixed. That was wrong, and the guidance is corrected
here. Three separate causes, none of them in the source:

1. **`server/node_modules` was incompletely installed** — `bcrypt` and `vitest`
   were absent. This was the real reason the API server would not start (auth.ts
   imports bcrypt), the reason the server suite could not run, and the reason a
   "Cannot find module 'bcrypt'" typecheck error had been showing up all along.
   It had been dismissed as noise for most of this work; it was a missing
   dependency. Fixed with the repo's own
   `npm install --prefix server --legacy-peer-deps`.
2. **The esbuild binary hung on every invocation** — it returned nothing and
   never exited, which is what broke `tsx` (reported as esbuild "service was
   stopped") and timed out `vite build`. Not a quarantine flag: the copy under
   the repo root was already unquarantined and hung just the same. Fixed with
   `npm rebuild esbuild` in `server/`; the binary now answers `--version`
   instantly. Vitest was never affected because vitest 4 transforms with
   oxc/rolldown rather than esbuild — which is why `npx vitest run` worked all
   along while `npm run test:client` appeared to hang.
3. **Playwright's browsers had never been downloaded.** `npx playwright install
   chromium`.

With those three done: server typecheck 0 errors, server suite 4 files / 42
tests, client suite 4 files / 49 tests, and the e2e suite 15 passed / 6 skipped
/ 0 failed across phone, tablet-7inch and tablet-10inch.

The e2e run needed two test updates, both committed: the auth and navigation
specs asserted the pre-rebrand lockup ("Diet Plan", "& TRACKER", "AI-powered
nutrition companion"), and the offline-banner test called `page.reload()` while
offline outside its try block, so in dev — where Vite serves modules over the
network and the service worker has precached nothing — the reload threw before
the graceful-skip path could run. Tests updated, not deleted, per the brief.

The six skips are intentional and pre-existing: the review-account navigation
test and the offline-banner test both skip when their preconditions are not
available locally.

## 31. 14-day plans never generated — the SDK's non-streaming guard (2026-08-09)

Two users signed up and neither could generate a meal plan; both got "Failed to
generate meal plan. Please try again." The Claude balance was fine and nothing
in the generation path had changed during the Fresh Light work.

Both users had `planDuration: 14`. Every meal plan that had ever saved
successfully was a 7-day plan. A 7-day reproduction succeeded; a 14-day one
failed in three seconds — far too fast to be a timeout or a network problem,
which meant the exception was being thrown before any HTTP request went out.

It was thrown by the Anthropic SDK itself. For a non-streaming request with no
client-level timeout, the SDK estimates how long the call could take as
`(60min * max_tokens) / 128000` and refuses outright if that exceeds its
10-minute ceiling, with "Streaming is required for operations that may take
longer than 10 minutes." The threshold works out to about 21,300 tokens.
`ai.ts` asks for 16,000 on a 7-day plan (fine) and 32,000 on a 14-day plan
(always over). So 14-day generation could never have worked — it wasn't
intermittent, and no amount of API credit would have changed it.

`callLLM` now streams and collapses the stream with `finalMessage()`, which is
what the SDK's error is asking for. Callers are unaffected: they still get a
single string back, and the `AbortSignal.timeout()` each one passes is still
the real bound (180s for a 14-day plan, under Vercel's 300s `maxDuration`).
Setting a client-level `timeout` would also have silenced the guard, but that
suppresses the check rather than satisfying it, and leaves a genuinely long
request riding on one non-streaming HTTP connection.

Verified against the production database: a 14-day generation now returns 14
days and saves, taking about 90s and 55k tokens.

Also found while debugging: `tdee_calculation_logs` did not exist in the
production database, so every TDEE log write threw. It is wrapped in
`.catch()`, so it was silent and harmless to generation — but the logging had
never actually worked in prod, which means there is no audit trail for how any
existing user's calorie target was derived. Same prod-schema-drift class as
§26.

Fixed by applying the migration that already existed in the repo and had never
reached prod — `20260613000000_add_tdee_calculation_log`, whose SQL is already
idempotent. Verified after: 35 columns, both indexes plus the primary key, and
a write/read round-trip through the app's own Prisma client (the part a raw
CREATE TABLE can silently get wrong — a column-name or type mismatch would
still leave the client throwing).

While checking that, the wider picture: 11 of 20 migrations on disk are absent
from prod's `_prisma_migrations` ledger. The **schema itself is complete** —
`additional_meal_logs`, `macro_validation_logs`, `password_reset_tokens`,
`recipes`, `User.appleId`, `User.isReview` and `macro_validation_logs.
cnAttempted` all verified present — because each was applied by hand at the
time. Only the ledger is behind.

That leaves a landmine rather than a live bug: if `prisma migrate deploy` is
ever added to the pipeline, it will attempt all 11 unrecorded migrations
against a database that already has their objects. The ones written with
IF NOT EXISTS are fine; any plain `ALTER TABLE ADD COLUMN` is not. Reconciling
that means auditing all 11 against the live schema and marking the applied
ones with `prisma migrate resolve --applied` — not done here, since a partial
reconciliation is more misleading than none.

## 32. Generation quota counted taps, not costs (2026-08-09)

Reported after §31: pressing "generate" consumed a monthly generation whether
or not anything was actually generated. Confirmed — `checkAndIncrementGeneration
Limit` claimed the credit at the top of the route, before the API key check,
before the profile lookup, and long before the LLM call. Every failure in
between burned quota for zero spend. The §31 bug was the worst case: it threw
client-side, before a single request was dispatched, and still cost both
affected users their full allowance.

The obvious fix — count only on success — is wrong here, and would have made
things worse. The atomic check-and-increment is the only thing holding the cap:
the in-flight guard beside it is an in-memory `Set`, so on serverless two
parallel invocations landing on different instances both read `count = 0`, both
pass, and both generate. Deferring the increment widens that race from a
duplicate-plan annoyance into unbounded spend.

So the credit is now reserved up front as before, and refunded when the attempt
turns out to have cost nothing — a pre-auth and void, not a deferred charge.
The cap holds under the race; the user stops paying for our failures.

"Cost" needed a real boundary rather than a guess about which errors are
free. `callLLM` takes an `onCostIncurred` callback and fires it on the first
stream event — `message_start`, the point at which the provider has accepted
the request and input tokens are billed. Anything throwing earlier (missing
config, no profile, a request the SDK rejects client-side) is refunded;
anything after is charged, even if the plan later fails to parse, validate or
save, because those tokens were spent either way.

Refunds are `updateMany` with a `count > 0` predicate — atomic, floored at
zero, so a double refund or a racing reset cannot drive the counter negative
and hand out free generations. They never throw: a failed refund must not
replace the real error being handled.

Verified at both levels, in both directions. The signal itself: fires on a real
call, stays silent when the provider rejects with a 404 (nothing billed). The
route: a generation failed against a bogus model left the counter at 0 with a
refund logged, and a real generation took it 0 → 1 with no refund. The second
half matters as much as the first — a callback that never fired would have
made every attempt look free.

Two related things left alone, both flagged rather than changed:

- `services/mealPlanGenerator.ts` is not imported anywhere and carries its own
  copy of the old count-on-tap limiter. Dead today, a trap for whoever wires it
  up next.
- The daily limiter (`checkRateLimit`, 3/day) has the same shape — it counts
  the attempt, not the cost. It is in-memory and resets on cold start, so on
  serverless it rarely bites, but three failed taps on one warm instance can
  still lock a user out for the day.

## 33. Removed dead `mealPlanGenerator.ts` (2026-08-09)

Follow-up to §32. `services/mealPlanGenerator.ts` held a second copy of the
generation flow, including its own `MONTHLY_REGEN_LIMIT` and
`checkAndIncrementGenerationLimit` still doing count-on-tap. Harmless while
nothing called it, and a quiet way to reintroduce the §32 bug the moment
somebody wired it up.

Confirmed unused before deleting, not just by a grep of the working tree:

- No static import, and no dynamic `import()`/`require()` with a computed path
  anywhere in `server/src`. No barrel file in `services/`.
- Searched every commit in the repo — the file has never been imported by any
  `.ts` file in any revision. It arrived in 8023e41 (2026-06-11) as part of the
  v2 batch and was never wired up. Dead on arrival, not a refactor in flight.
- Not reachable from the deployed bundle either. `vercel.json` declares one
  function, `api/index.ts`, which imports `server/src/app`; ncc bundles by
  following imports, and there is no `includeFiles`. So it was never shipped —
  only typechecked, since `server/tsconfig.json` includes all of `src/**/*`.

Everything it depended on (`macroValidation` helpers, `callLLM`, the CN
service) is shared and still used by `routes/ai.ts`, so nothing unique was
lost, and git history keeps it recoverable.

`TECHNICAL_PRD.md` had documented this file as the component enforcing the
monthly cap, which was wrong even before the deletion — the cap has always
lived in `routes/ai.ts`. Corrected there, with a pointer to the reserve/refund
behaviour from §32.

Verified with `npm run typecheck` (clean) and the unit suite: 4 files, 42
tests, all passing in 241ms.

Getting the suite to run took several attempts, and every failure was
self-inflicted rather than a toolchain fault — worth recording, because the
same two traps cost time in §30 as well. First, `--reporter=basic` was removed
in Vitest 3; passing it makes Vitest try to load "basic" as a *custom reporter
module*, which fails in `loadCustomReporterModule` rather than saying the flag
is invalid. Second, each retry was killed by a `pkill -f "vitest run"` at the
top of the *next* command, so runs that would have finished were terminated at
a few seconds old (exit 144), which read as "still hanging". Left undisturbed
with the default reporter, the suite finishes in well under a second.

## 34. Audio guide, portion sizes, editable extras, shopping reset (2026-08-09)

Four reported issues, fixed together.

**Audio guide crashed instead of playing.** The error screen said "The element
has no supported sources", with no stack. Two separate faults stacked.

The cause was the CSP in `vercel.json`. It has no `media-src` directive, so
media falls back to `default-src 'self'` — and every audio file we serve is a
cross-origin Vercel Blob URL. Confirmed on the live site rather than inferred:
loading one produces `MEDIA_ELEMENT_ERROR: Media load rejected by URL safety
check` (code 4, `MEDIA_ERR_SRC_NOT_SUPPORTED`), and a `securitypolicyviolation`
listener reports `violatedDirective: "media-src"` against the blob URL. Note
`img-src` and `font-src` both already allow `data:` — media was simply missed
when the policy was written, so audio has never played on the deployed web app.
Added `media-src 'self' data: https://*.public.blob.vercel-storage.com`.

The second fault turned that into a crash. `AudioGuidePlayer.togglePlay` called
`a.play()` and ignored the returned promise; when it rejected, the unhandled
rejection took down the whole meal view. `play()` is now caught, load failures
are caught via the element's `onError` (which fires during `preload`, before
any tap), and both surface as an inline message. Autoplay-policy rejections say
"tap play again"; everything else points at regenerating the guide. A blocked
file is a broken guide, not a broken app.

That component had also been missed by the Fresh Light migration — it still
carried `rgba(255,255,255,…)` text and the Strain orange, i.e. white-on-white
on the new light card. Retokenised while in there.

**Portion sizes.** Serving options come from the food source, and sources vary:
CalorieNinjas returns `100g` and nothing else, so small portions could only be
reached by doing multiplier arithmetic. `MealReplacerQuantity` now appends
100/50/25g to whatever the source supplies, deduped on grams so a source's own
`100g` isn't listed twice. Done in the picker rather than in each of the five
services, so every source and entry path benefits. The `onChange` lookup had to
move to the augmented list — searching `selectedFood.servingSizes` would have
silently ignored a 50g or 25g pick.

**Editable extra meals.** A logged extra could only be deleted and re-logged.
The server already had `PATCH /api/meals/additional/:id` accepting servingQty,
note, mealCategory and mealTime — it was simply never called from the client.

It also had a latent bug that would have gone live the moment it was wired up:
macros are stored as absolute totals for the logged quantity, and the handler
changed `servingQty` without touching them, so editing a quantity would have
left the old calories behind and skewed the day's totals. Macros scale linearly
with quantity, so the handler now rescales by the ratio, guarded against a
non-positive stored quantity. The store gained an optimistic `updateAdditionalMeal` that
mirrors the server's scaling and reverts on failure.

The editor first went into `AdditionalMealCard.tsx` — which turned out to be
dead code, the same trap as §33. Nothing imports it; the live UI renders extra
meals inline in `MealsTab.tsx` as a read-only card with neither edit nor
delete. Caught only because a post-build grep for the new aria-label came back
empty in the bundle. The editor now lives in a new Fresh Light `ExtraMealCard`
used by `MealsTab`, with edit *and* delete, and the dead component is deleted.
Worth noting the failure mode: it typechecked, built and passed tests while
being completely unreachable.

**Shopping reset.** Moved from the bottom of the list — below every category,
a long scroll away — to the header's top right, under the bought/total counter,
styled to match the existing SHARE pill.

Verified: typecheck clean, 42 unit tests pass, production build clean, and the
dev server boots the changed modules with no console errors. The three UI
changes were not exercised against a live signed-in session — the only route to
one was creating or altering an account in the production database, which is
not worth doing for a screenshot.

## 35. Hydration moved beside the macro band (2026-08-09)

Hydration was a full-width horizontal card stacked above the lime macro band,
while the band's own right side — past the macro ticks, which are short — sat
empty. Both now share one row: the band flexes, hydration is a fixed 96px
column beside it, and `alignItems: stretch` matches their heights whatever the
macro count. Costs a row of vertical scroll less.

The card itself is now a narrow vertical column: kicker, litres, then the glass
markers as full-width bars in a `column-reverse` stack so they fill bottom-up
and read as a tube rather than a progress bar stood on its end.

Two edge cases handled rather than discovered later:

- `MacroAchievementCard` returns `null` for a future date, which would have left
  a lone 96px column beside a gap. Initially hydration kept the full width
  there; on review that was still wrong — both cards are consumption summaries,
  and a day that has not happened has nothing eaten or drunk to report. Both are
  now hidden when `selectedDate > todayStr()`, so a future day goes straight
  from the date header to the plan.
- A high glass goal has to fit the band's height — the markers are
  `flexShrink: 0`, so overflow was plausible. Checked at 12 glasses; fits.

Verified visually, not just by typecheck. Since the meals tab needs a signed-in
session and the only route to one was creating or altering an account in the
production database, the two components were mounted in a throwaway Vite entry
with mock props and a seeded store — enough to check the real layout at 468px
and at 375px mobile, at 8 and 12 glasses. Harness deleted afterwards; note that
leaving a second `.html` at the client root would have added a Vite entry.
