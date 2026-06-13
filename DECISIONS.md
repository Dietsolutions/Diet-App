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
