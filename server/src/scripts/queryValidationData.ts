/**
 * Diagnostic query script for MacroValidationLog data.
 *
 * Usage:
 *   cd server && npx tsx src/scripts/queryValidationData.ts [mealPlanId]
 *
 * With no argument: prints aggregate stats across all logged plans.
 * With a mealPlanId argument: prints per-meal detail for that plan.
 */

import prisma from '../lib/prisma';

const mealPlanId = process.argv[2] ?? null;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function pct(n: number, d: number): string {
  return d === 0 ? '—' : `${((n / d) * 100).toFixed(1)}%`;
}

function avg(arr: number[]): string {
  return arr.length === 0 ? '—' : (arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1);
}

function pad(s: string | number, width: number): string {
  return String(s).padEnd(width);
}

function hr(char = '─', len = 72): string {
  return char.repeat(len);
}

// ─────────────────────────────────────────────────────────────────────────────
// Query 1 — Outcome distribution
// ─────────────────────────────────────────────────────────────────────────────

async function queryOutcomeDistribution(planId?: string): Promise<void> {
  console.log('\n' + hr('═'));
  console.log('  OUTCOME DISTRIBUTION');
  console.log(hr('═'));

  const where = planId ? { mealPlanId: planId } : {};
  const rows = await prisma.macroValidationLog.groupBy({
    by: ['finalOutcome'],
    where,
    _count: { finalOutcome: true },
    orderBy: { _count: { finalOutcome: 'desc' } },
  });

  const total = rows.reduce((s, r) => s + r._count.finalOutcome, 0);
  console.log(`  Total logged meals: ${total}${planId ? ` (plan ${planId})` : ''}\n`);
  console.log(`  ${pad('Outcome', 30)} ${pad('Count', 8)} ${pad('Share', 8)}`);
  console.log('  ' + hr('-', 48));
  for (const r of rows) {
    console.log(
      `  ${pad(r.finalOutcome, 30)} ${pad(r._count.finalOutcome, 8)} ${pct(r._count.finalOutcome, total)}`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Query 2 — Scaling effectiveness
// ─────────────────────────────────────────────────────────────────────────────

async function queryScalingEffectiveness(planId?: string): Promise<void> {
  console.log('\n' + hr('═'));
  console.log('  SCALING EFFECTIVENESS');
  console.log(hr('═'));

  const where = planId ? { mealPlanId: planId, scalingApplied: true } : { scalingApplied: true };
  const scaled = await prisma.macroValidationLog.findMany({
    where,
    select: {
      scaleFactor:      true,
      scalingResolved:  true,
      postScaleDeviation: true,
      deviationPct:     true,
    },
  });

  if (scaled.length === 0) {
    console.log('  No scaling events found.');
    return;
  }

  const resolved   = scaled.filter(r => r.scalingResolved === true).length;
  const unresolved = scaled.filter(r => r.scalingResolved === false).length;
  const factors    = scaled.filter(r => r.scaleFactor !== null).map(r => r.scaleFactor!);
  const preDevs    = scaled.filter(r => r.deviationPct !== null).map(r => r.deviationPct!);
  const postDevs   = scaled.filter(r => r.postScaleDeviation !== null).map(r => r.postScaleDeviation!);

  console.log(`  Scaling events:      ${scaled.length}`);
  console.log(`  Resolved (≤35%):     ${resolved}  (${pct(resolved, scaled.length)})`);
  console.log(`  Unresolved (>35%):   ${unresolved}  (${pct(unresolved, scaled.length)})`);
  console.log(`  Avg scale factor:    ${avg(factors)}×`);
  console.log(`  Avg pre-scale dev:   ${avg(preDevs)}%`);
  console.log(`  Avg post-scale dev:  ${avg(postDevs)}%`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Query 3 — Partial match failures
// ─────────────────────────────────────────────────────────────────────────────

async function queryPartialMatchFailures(planId?: string): Promise<void> {
  console.log('\n' + hr('═'));
  console.log('  PARTIAL MATCH FAILURES');
  console.log(hr('═'));

  const where = planId
    ? { mealPlanId: planId, partialMatchGuard: true }
    : { partialMatchGuard: true };

  const rows = await prisma.macroValidationLog.findMany({
    where,
    select: {
      mealPlanId:      true,
      dayIndex:        true,
      mealIndex:       true,
      claudeMealName:  true,
      cnQueryString:   true,
      cnItemsMatched:  true,
      claudeCalories:  true,
      cnReturnedCalories: true,
    },
    orderBy: [{ mealPlanId: 'asc' }, { dayIndex: 'asc' }, { mealIndex: 'asc' }],
    take: 50,
  });

  if (rows.length === 0) {
    console.log('  No partial match failures found.');
    return;
  }

  console.log(`  Found ${rows.length} partial match failure(s):\n`);
  for (const r of rows) {
    console.log(`  Plan ${r.mealPlanId}  Day ${(r.dayIndex ?? 0) + 1}  Meal ${(r.mealIndex ?? 0) + 1}`);
    console.log(`    Meal:       ${r.claudeMealName}`);
    console.log(`    Query:      ${r.cnQueryString}`);
    console.log(`    Items matched: ${r.cnItemsMatched ?? '?'}`);
    console.log(`    Claude kcal:   ${r.claudeCalories}`);
    console.log(`    CN kcal:       ${r.cnReturnedCalories ?? '—'}`);
    console.log('');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Query 4 — Day-level corrections
// ─────────────────────────────────────────────────────────────────────────────

async function queryDayLevelCorrections(planId?: string): Promise<void> {
  console.log('\n' + hr('═'));
  console.log('  DAY-LEVEL CORRECTIONS');
  console.log(hr('═'));

  const where = planId
    ? { mealPlanId: planId, wasDayLevelReplacement: true }
    : { wasDayLevelReplacement: true };

  const rows = await prisma.macroValidationLog.findMany({
    where,
    select: {
      mealPlanId:                true,
      dayIndex:                  true,
      mealIndex:                 true,
      claudeMealName:            true,
      dayTotalBeforeReplacement: true,
      dayTotalAfterReplacement:  true,
    },
    orderBy: [{ mealPlanId: 'asc' }, { dayIndex: 'asc' }],
    take: 50,
  });

  if (rows.length === 0) {
    console.log('  No day-level corrections found.');
    return;
  }

  console.log(`  Found ${rows.length} day-level correction(s):\n`);
  console.log(
    `  ${pad('Plan', 20)} ${pad('Day', 5)} ${pad('Meal', 6)} ` +
    `${pad('Before', 10)} ${pad('After', 10)} ${'Meal name'}`
  );
  console.log('  ' + hr('-', 70));
  for (const r of rows) {
    console.log(
      `  ${pad(r.mealPlanId, 20)} ${pad((r.dayIndex ?? 0) + 1, 5)} ${pad((r.mealIndex ?? 0) + 1, 6)} ` +
      `${pad(r.dayTotalBeforeReplacement?.toFixed(0) ?? '—', 10)} ` +
      `${pad(r.dayTotalAfterReplacement?.toFixed(0) ?? '—', 10)} ` +
      `${r.claudeMealName}`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Query 5 — Meal target check failures
// ─────────────────────────────────────────────────────────────────────────────

async function queryMealTargetFailures(planId?: string): Promise<void> {
  console.log('\n' + hr('═'));
  console.log('  MEAL TARGET CHECK FAILURES  (final meal outside ±15% of budget)');
  console.log(hr('═'));

  const where = planId
    ? { mealPlanId: planId, mealTargetCheckPassed: false }
    : { mealTargetCheckPassed: false };

  const rows = await prisma.macroValidationLog.findMany({
    where,
    select: {
      mealPlanId:            true,
      dayIndex:              true,
      mealIndex:             true,
      claudeMealName:        true,
      finalOutcome:          true,
      finalCalories:         true,
      mealTargetCalories:    true,
      mealTargetDeviationPct: true,
    },
    orderBy: [{ mealPlanId: 'asc' }, { dayIndex: 'asc' }, { mealIndex: 'asc' }],
    take: 50,
  });

  if (rows.length === 0) {
    console.log('  No meal target failures found.');
    return;
  }

  console.log(`  Found ${rows.length} meal target failure(s):\n`);
  console.log(
    `  ${pad('Plan', 20)} ${pad('Day', 5)} ${pad('Meal', 6)} ` +
    `${pad('Final', 8)} ${pad('Target', 8)} ${pad('Dev%', 8)} ${'Outcome'}`
  );
  console.log('  ' + hr('-', 72));
  for (const r of rows) {
    console.log(
      `  ${pad(r.mealPlanId, 20)} ${pad((r.dayIndex ?? 0) + 1, 5)} ${pad((r.mealIndex ?? 0) + 1, 6)} ` +
      `${pad(r.finalCalories?.toFixed(0) ?? '—', 8)} ` +
      `${pad(r.mealTargetCalories?.toFixed(0) ?? '—', 8)} ` +
      `${pad(r.mealTargetDeviationPct?.toFixed(1) ?? '—', 8)} ` +
      `${r.finalOutcome}`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Query 6 — Attempt budget usage per day
// ─────────────────────────────────────────────────────────────────────────────

async function queryAttemptBudget(planId?: string): Promise<void> {
  console.log('\n' + hr('═'));
  console.log('  ATTEMPT BUDGET USAGE PER DAY');
  console.log(hr('═'));

  const where = planId ? { mealPlanId: planId } : {};
  const rows = await prisma.macroValidationLog.findMany({
    where,
    select: {
      mealPlanId:            true,
      dayIndex:              true,
      attemptsUsedAtThisMeal: true,
    },
    orderBy: [{ mealPlanId: 'asc' }, { dayIndex: 'asc' }, { mealIndex: 'asc' }],
  });

  if (rows.length === 0) {
    console.log('  No attempt data found.');
    return;
  }

  // Group by plan+day, pick max attemptsUsedAtThisMeal (= total attempts consumed that day)
  const dayMap = new Map<string, number>();
  for (const r of rows) {
    if (r.attemptsUsedAtThisMeal === null) continue;
    const key = `${r.mealPlanId}__day${(r.dayIndex ?? 0) + 1}`;
    dayMap.set(key, Math.max(dayMap.get(key) ?? 0, r.attemptsUsedAtThisMeal));
  }

  const MAX = 5;
  let exhausted = 0;
  let highUsage  = 0;

  console.log(`  ${pad('Key', 36)} ${pad('Max attempts', 14)}`);
  console.log('  ' + hr('-', 52));
  for (const [key, attempts] of dayMap.entries()) {
    const flag = attempts >= MAX ? ' ⚠ EXHAUSTED' : attempts >= 3 ? ' ↑ high' : '';
    console.log(`  ${pad(key, 36)} ${attempts}${flag}`);
    if (attempts >= MAX) exhausted++;
    if (attempts >= 3)  highUsage++;
  }

  console.log('');
  console.log(`  Days that exhausted budget (≥${MAX}): ${exhausted}`);
  console.log(`  Days with high usage (≥3):           ${highUsage}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-plan detail table
// ─────────────────────────────────────────────────────────────────────────────

async function queryPlanDetail(planId: string): Promise<void> {
  console.log('\n' + hr('═'));
  console.log(`  MEAL-BY-MEAL DETAIL  (plan ${planId})`);
  console.log(hr('═'));

  const rows = await prisma.macroValidationLog.findMany({
    where: { mealPlanId: planId },
    orderBy: [{ dayIndex: 'asc' }, { mealIndex: 'asc' }, { iteration: 'asc' }],
  });

  if (rows.length === 0) {
    console.log('  No rows found for this plan.');
    return;
  }

  const hdr =
    `  ${pad('Day', 4)} ${pad('Meal', 5)} ${pad('Outcome', 25)} ` +
    `${pad('Action', 22)} ${pad('Dev%', 6)} ${pad('Final', 6)} ${pad('Target', 6)} ${'Name'}`;
  console.log(hdr);
  console.log('  ' + hr('-', 100));

  for (const r of rows) {
    const dev    = r.deviationPct !== null ? `${Math.round(r.deviationPct)}%` : '—';
    const action = r.deviationAction ?? '—';
    console.log(
      `  ${pad((r.dayIndex ?? 0) + 1, 4)} ${pad((r.mealIndex ?? 0) + 1, 5)} ` +
      `${pad(r.finalOutcome, 25)} ${pad(action, 22)} ${pad(dev, 6)} ` +
      `${pad(r.finalCalories?.toFixed(0) ?? '—', 6)} ` +
      `${pad(r.mealTargetCalories?.toFixed(0) ?? '—', 6)} ` +
      `${r.claudeMealName ?? '—'}`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(hr('═'));
  console.log('  MACRO VALIDATION LOG — DIAGNOSTIC REPORT');
  if (mealPlanId) console.log(`  Filtered to plan: ${mealPlanId}`);
  console.log(hr('═'));

  await queryOutcomeDistribution(mealPlanId ?? undefined);
  await queryScalingEffectiveness(mealPlanId ?? undefined);
  await queryPartialMatchFailures(mealPlanId ?? undefined);
  await queryDayLevelCorrections(mealPlanId ?? undefined);
  await queryMealTargetFailures(mealPlanId ?? undefined);
  await queryAttemptBudget(mealPlanId ?? undefined);

  if (mealPlanId) {
    await queryPlanDetail(mealPlanId);
  }

  console.log('\n' + hr('═'));
  console.log('  Done.');
  console.log(hr('═') + '\n');
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
