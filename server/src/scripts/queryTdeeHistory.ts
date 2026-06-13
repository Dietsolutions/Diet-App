/**
 * Trace a user's TDEE calculations over time — each step of the derivation,
 * plus a movement summary across calculations.
 *
 * Usage: cd server && npm run query:tdee -- <userId>
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const userId = process.argv[2];
  if (!userId) { console.log('Usage: queryTdeeHistory <userId>'); return; }

  const logs = await prisma.tdeeCalculationLog.findMany({
    where:   { userId },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\nTDEE HISTORY for user ${userId} — ${logs.length} calculations\n`);

  logs.forEach((l, i) => {
    console.log(`── Calculation ${i + 1} (${l.createdAt.toISOString().split('T')[0]}) ──`);
    console.log(`  Inputs: ${l.weightKg}kg, ${l.activityLevel}, goal=${l.goal}, steps=${l.dailySteps}`);
    console.log(`  BMR (${l.bmrFormula}):        ${l.bmrValue}`);
    console.log(`  × activity ${l.activityMultiplier}:    ${l.tdeeBeforeAdjust}`);
    console.log(`  + NEAT adjust:           ${(l.neatAdjustment ?? 0) >= 0 ? '+' : ''}${l.neatAdjustment}`);
    console.log(`  + goal adjust:           ${(l.goalAdjustment ?? 0) >= 0 ? '+' : ''}${l.goalAdjustment}`);
    console.log(`  = TDEE after adjust:     ${l.tdeeAfterAdjust}`);
    if (l.safetyFloorApplied) console.log(`  ⚠ safety floor (${l.safetyFloorType})`);
    console.log(`  FINAL: ${l.finalCalories} kcal | P${l.finalProteinG} C${l.finalCarbsG} F${l.finalFatG}`);
    console.log(`  Macro basis: protein=${l.proteinBasis}, fat=${l.fatBasis}, carbs=${l.carbsBasis}`);
    console.log();
  });

  if (logs.length > 1) {
    const first = logs[0], last = logs[logs.length - 1];
    console.log('── MOVEMENT ──');
    const dCal = (last.finalCalories ?? 0) - (first.finalCalories ?? 0);
    console.log(`  Calories: ${first.finalCalories} → ${last.finalCalories} (${dCal >= 0 ? '+' : ''}${dCal})`);
    console.log(`  Weight:   ${first.weightKg}kg → ${last.weightKg}kg`);
    console.log(`  Protein:  ${first.finalProteinG}g → ${last.finalProteinG}g`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
