/**
 * queryAttemptDetail.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Prints a human-readable report of meals that consumed multiple Claude
 * regeneration attempts (attemptsUsedAtThisMeal >= 3 or attempts_exhausted).
 *
 * Usage:
 *   npm run query:attempts              # scan all plans
 *   npm run query:attempts -- <planId>  # single plan
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const planId = process.argv[2];
  const where  = planId ? { mealPlanId: planId } : {};

  // ── 1. Multi-attempt meals ──────────────────────────────────────────────────
  const exhausted = await prisma.macroValidationLog.findMany({
    where: {
      ...where,
      OR: [
        { finalOutcome: 'attempts_exhausted' },
        { attemptsUsedAtThisMeal: { gte: 3 } },
      ],
    },
    orderBy: [
      { mealPlanId: 'asc' },
      { dayIndex:   'asc' },
      { mealIndex:  'asc' },
    ],
  });

  console.log('\n=== MEALS WITH MULTIPLE CLAUDE ATTEMPTS ===');
  console.log(`Found: ${exhausted.length} meals\n`);

  exhausted.forEach(l => {
    console.log(`Plan: ${l.mealPlanId}  D${l.dayIndex + 1}M${l.mealIndex + 1}`);
    console.log(`  Original Claude meal:  ${l.claudeMealName}  (${l.claudeCalories} kcal)`);
    console.log(`  CN returned:           ${l.cnReturnedCalories} kcal` +
      `  dev=${l.deviationPct?.toFixed(1)}%  trigger=${(l as any).triggerMacro ?? 'n/a'}`);
    console.log(`  Initial action:        ${l.initialDeviationAction ?? l.deviationAction}`);
    console.log(`  Scaling applied:       ${l.scalingApplied}  factor=${l.scaleFactor ?? 'n/a'}`);
    console.log(`  Post-scale CN:         ${l.postScaleCnCalories ?? 'n/a'}  dev=${l.postScaleDeviation?.toFixed(1) ?? 'n/a'}%`);
    console.log(`  Corrected meal name:   ${l.correctedMealName  ?? 'NOT LOGGED'}`);
    console.log(`  Corrected meal cal:    ${l.correctedCalories  ?? 'NOT LOGGED'}`);
    console.log(`  Recheck CN cal:        ${l.recheckCalories    ?? 'NOT LOGGED'}`);
    console.log(`  Final outcome:         ${l.finalOutcome}`);
    console.log(`  Attempts at START:     ${l.attemptsUsedAtThisMeal}`);
    console.log();
  });

  // ── 2. Data completeness check ─────────────────────────────────────────────
  const withCorrData  = exhausted.filter(l => l.correctedMealName);
  const withRecheckDt = exhausted.filter(l => l.recheckCalories);

  console.log('=== DATA COMPLETENESS ===');
  console.log(`correctedMealName populated: ${withCorrData.length}/${exhausted.length}`);
  console.log(`recheckCalories populated:   ${withRecheckDt.length}/${exhausted.length}`);

  if (withCorrData.length === 0 && exhausted.length > 0) {
    console.log('\nWARNING: correctedMealName is NULL for all exhausted meals.');
    console.log('This means the per-iteration correction data is not being captured.');
    console.log('Ensure validateAndFinaliseMeal sets lastCorrectedMeal inside the while loop.');
  }

  // ── 3. Plan-level summary ──────────────────────────────────────────────────
  const recentPlans = await prisma.mealPlan.findMany({
    where:   planId ? { id: planId } : {},
    orderBy: { generatedAt: 'desc' },
    take:    5,
    select:  { id: true, generatedAt: true, planDuration: true },
  });

  console.log('\n=== RECENT PLAN SUMMARY ===');
  for (const plan of recentPlans) {
    const logs = await prisma.macroValidationLog.findMany({
      where:   { mealPlanId: plan.id },
      orderBy: [{ dayIndex: 'asc' }, { mealIndex: 'asc' }],
    });

    const byOutcome: Record<string, number> = {};
    logs.forEach(l => { byOutcome[l.finalOutcome] = (byOutcome[l.finalOutcome] ?? 0) + 1; });

    console.log(`\nPlan: ${plan.id.substring(0, 20)} | ${plan.generatedAt.toISOString().slice(0, 16)} | ${plan.planDuration}d`);
    console.log(`  Total meals: ${logs.length}`);
    Object.entries(byOutcome).sort(([,a],[,b]) => b - a).forEach(([outcome, count]) => {
      console.log(`    ${outcome.padEnd(30)} ${count}`);
    });

    const fastTracks = logs.filter(l => l.finalOutcome === 'cn_plan_fast_track').length;
    const exhaustedC = logs.filter(l => l.finalOutcome === 'attempts_exhausted').length;
    const corrNameOk = logs.filter(l => l.correctedMealName).length;
    const corrFired  = logs.filter(l => l.correctionTriggered).length;

    console.log(`  Plan fast-tracks:    ${fastTracks}`);
    console.log(`  Attempts exhausted:  ${exhaustedC}`);
    console.log(`  Corrections fired:   ${corrFired}`);
    console.log(`  correctedMealName:   ${corrNameOk}/${corrFired} populated`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
