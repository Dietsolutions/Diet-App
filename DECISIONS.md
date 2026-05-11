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
