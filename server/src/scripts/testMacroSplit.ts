/**
 * Guard test for the proportional macro split in getMealMacroTargets.
 * All four macros (calories, protein, carbs, fat) must use the same per-meal
 * weight — never an equal 1/mealsPerDay split. A light snack must therefore
 * carry a light carb target (~46g here), not the daily carbs ÷ meals (114.75g).
 *
 * Run: cd server && npx ts-node -P tsconfig.json src/scripts/testMacroSplit.ts
 */
import { getMealMacroTargets, getMealWeightPct } from '../services/macroValidation';

// User from run __8_: 2850 kcal, 112g protein, 459g carbs, 67g fat, 4 meals
const daily = { calories: 2850, proteinG: 112, carbsG: 459, fatG: 67, fibreG: 38 };

console.log('MACRO SPLIT TEST — 4-meal plan, 2850 kcal\n');
const slots = [
  { type: 'breakfast', idx: 0 },
  { type: 'lunch',     idx: 1 },
  { type: 'snack',     idx: 2 },
  { type: 'dinner',    idx: 3 },
];

let allConsistent = true;
let snackCarbs = 0;
for (const s of slots) {
  const t = getMealMacroTargets(daily, 4, s.type, s.idx);
  if (s.type === 'snack') snackCarbs = t.carbsG;
  // Internal consistency: macro-derived kcal should ≈ the calorie target
  const macroKcal = t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9;
  const drift = Math.abs(macroKcal - t.calories) / t.calories * 100;
  const ok = drift < 15;   // within 15% is internally consistent
  if (!ok) allConsistent = false;
  console.log(
    `${s.type.padEnd(10)} cal=${t.calories} | P${t.proteinG} C${t.carbsG} F${t.fatG} ` +
    `| macro-kcal=${Math.round(macroKcal)} | drift=${drift.toFixed(0)}% ${ok ? 'OK' : 'INCONSISTENT'}`
  );
}

const snackOk = snackCarbs > 35 && snackCarbs < 60;   // ~45.9g expected, NOT 114.75g
console.log(`\nSnack carbs = ${snackCarbs}g (expected ~46g, NOT 114.75g): ${snackOk ? 'PASS' : 'FAIL'}`);
console.log(`All slots internally consistent: ${allConsistent ? 'PASS' : 'FAIL'}`);

// ── Logger path guard ────────────────────────────────────────────────────────
// macroValidationLogger computes the per-meal protein/carbs/fat target it WRITES
// to the DB using getMealWeightPct (same weight as getMealMacroTargets). Guard
// against the equal-split regression that logged a 4-meal snack at dailyProtein/4
// (e.g. 152/4 = 38g) instead of the weighted ~15g. Uses the task's reference
// profile: 1400 kcal, 152g protein, 4 meals.
const dailyProtein = 152;
const snackWeight  = getMealWeightPct('snack', 4, 2);
const snackProteinTarget = dailyProtein * snackWeight;          // weighted (correct)
const equalSplitProtein  = dailyProtein / 4;                    // the bug (38g)
const loggerOk = Math.abs(snackProteinTarget - 15.2) < 1 && Math.abs(snackProteinTarget - equalSplitProtein) > 10;
console.log(
  `\nLogger snack protein target = ${snackProteinTarget.toFixed(1)}g ` +
  `(weighted ${snackWeight}×152) vs equal-split ${equalSplitProtein}g: ` +
  `${loggerOk ? 'PASS — weighted, not 38g' : 'FAIL — equal-split regression'}`
);

process.exit(snackOk && allConsistent && loggerOk ? 0 : 1);
