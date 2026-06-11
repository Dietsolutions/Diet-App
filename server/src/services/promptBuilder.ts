import { calculateBMI } from '../utils/tdee';
import { CANONICAL_MEAL_TYPES, getMealMacroTargets } from './macroValidation';

const GOAL_LABELS: Record<string, string> = {
  lose_weight:     'Lose fat (calorie deficit)',
  gain_muscle:     'Gain muscle (calorie surplus)',
  maintain:        'Maintain weight',
  improve_fitness: 'Improve athletic fitness',
  manage_health:   'Manage health condition',
  eat_healthy:     'General healthy eating — balanced nutrition based on daily RDA',
};

function goalLabel(goal: string): string {
  return GOAL_LABELS[goal] ?? goal;
}

function getMealTypes(mealsPerDay: number): string[] {
  if (mealsPerDay === 3) return ['Breakfast', 'Lunch', 'Dinner'];
  if (mealsPerDay === 5) return ['Breakfast', 'Mid-Morning Snack', 'Lunch', 'Evening Snack', 'Dinner'];
  return ['Breakfast', 'Lunch', 'Snack', 'Dinner'];
}

// ── Per-meal target section for the Claude prompt ────────────────────────────
function buildMealTargetsSection(
  dailyTargets: { calories: number; proteinG: number; carbsG: number; fatG: number; fibreG: number },
  mealsPerDay:  number,
): string {
  const canonical = CANONICAL_MEAL_TYPES[mealsPerDay as 3 | 4 | 5] ?? [];

  if (canonical.length === 0) {
    const perMeal = Math.round(dailyTargets.calories / mealsPerDay);
    return `Each of the ${mealsPerDay} meals should contain approximately ${perMeal} kcal.`;
  }

  const mealLabels: Record<string, string> = {
    breakfast:     'Breakfast',
    lunch:         'Lunch',
    snack:         'Snack',
    morning_snack: 'Morning snack',
    evening_snack: 'Evening snack',
    dinner:        'Dinner',
  };

  const lines = canonical.map((typeKey, index) => {
    const t = getMealMacroTargets(dailyTargets, mealsPerDay, typeKey, index);
    return (
      `  - ${mealLabels[typeKey] ?? typeKey} (${Math.round(t.weight * 100)}%):` +
      ` ~${t.calories} kcal · Protein ${t.proteinG}g · Carbs ${t.carbsG}g · Fat ${t.fatG}g`
    );
  });

  return (
    `PER-MEAL MACRO TARGETS — follow all four macros precisely, not equal splits:\n` +
    lines.join('\n') + '\n\n' +
    `Daily total: ${dailyTargets.calories} kcal · Protein ${dailyTargets.proteinG}g` +
    ` · Carbs ${dailyTargets.carbsG}g · Fat ${dailyTargets.fatG}g`
  );
}

// ── Lifestyle context block — Group B inputs (not TDEE; passed as Claude guidance) ──
function buildLifestyleContext(profile: any): string {
  const lines: string[] = [];

  const sleepQuality     = profile.sleepQuality     ?? 'average';
  const stressLevel      = profile.stressLevel      ?? 'medium';
  const recoveryCapacity = profile.recoveryCapacity ?? 'average';
  const hungerLevel      = profile.hungerLevel      ?? 'medium';
  const energyLevel      = profile.energyLevel      ?? 'moderate';
  const trainingType     = profile.trainingType     ?? 'none';
  const steps            = profile.dailySteps       ?? 5000;

  const hasNonDefault =
    sleepQuality !== 'average' || stressLevel !== 'medium' ||
    recoveryCapacity !== 'average' || hungerLevel !== 'medium' ||
    energyLevel !== 'moderate' || trainingType !== 'none' || steps !== 5000;

  if (!hasNonDefault) return '';

  lines.push('\nLIFESTYLE CONTEXT (use to improve meal composition and timing, not to change calorie targets):');

  if (sleepQuality === 'poor') {
    lines.push('- Sleep: poor — include magnesium-rich foods (nuts, leafy greens, legumes) and minimise high-sugar evening snacks that disrupt sleep.');
  } else if (sleepQuality === 'good') {
    lines.push('- Sleep: good — recovery is well-supported; no sleep-specific adjustments needed.');
  }

  if (stressLevel === 'high') {
    lines.push('- Stress: high — include adaptogens if relevant (ashwagandha in warm milk), B-vitamin-rich foods (whole grains, eggs), and avoid excess caffeine.');
  } else if (stressLevel === 'low') {
    lines.push('- Stress: low — standard meal variety is fine.');
  }

  if (recoveryCapacity === 'poor') {
    lines.push('- Recovery: poor — emphasise anti-inflammatory foods (turmeric, fatty fish, berries, leafy greens) and ensure post-workout protein within 2h.');
  } else if (recoveryCapacity === 'excellent') {
    lines.push('- Recovery: excellent — standard nutrient timing is sufficient.');
  }

  if (hungerLevel === 'high') {
    lines.push('- Hunger: high — include high-volume, high-fibre meals (lentils, vegetables, whole grains) and a protein-rich breakfast to sustain satiety.');
  } else if (hungerLevel === 'low') {
    lines.push('- Hunger: low — keep portions moderate and flavourful; do not force large meals.');
  }

  if (energyLevel === 'low') {
    lines.push('- Energy: low — prioritise slow-digesting complex carbs (oats, brown rice, sweet potato) pre-workout and iron-rich foods (spinach, lentils, tofu) if vegetarian/vegan.');
  } else if (energyLevel === 'high') {
    lines.push('- Energy: high — performance-focused fuelling is appropriate; emphasise pre- and post-workout nutrition.');
  }

  if (trainingType === 'endurance') {
    lines.push(`- Training: endurance, ~${steps.toLocaleString()} steps/day — schedule higher-carb meals on training days; ensure electrolyte-containing foods (banana, coconut water, yogurt).`);
  } else if (trainingType === 'strength') {
    lines.push(`- Training: strength, ~${steps.toLocaleString()} steps/day — post-workout meal must be protein-forward (≥30g) within 90 min; include creatine-friendly foods (red meat or vegetarian alternatives).`);
  } else if (trainingType === 'crossfit') {
    lines.push(`- Training: CrossFit/HIIT, ~${steps.toLocaleString()} steps/day — mix of fast and slow carbs around sessions; adequate protein for muscle repair.`);
  } else if (trainingType !== 'none') {
    lines.push(`- Training: ${trainingType}, ~${steps.toLocaleString()} steps/day — standard nutrient timing applies.`);
  } else if (steps > 8000) {
    lines.push(`- Activity: ~${steps.toLocaleString()} steps/day — schedule energising lunch with complex carbs to sustain afternoon activity.`);
  }

  return lines.join('\n');
}

function buildUserPrompt(
  profile:      any,
  dailyTargets: { calories: number; proteinG: number; carbsG: number; fatG: number; fibreG: number },
): string {
  const bmi = calculateBMI(profile.weightKg, profile.heightCm);
  const cuisines = JSON.parse(profile.cuisinePreferences);
  const allergies = JSON.parse(profile.allergies);
  const preferred = JSON.parse(profile.preferredIngredients);
  const avoidRaw = JSON.parse(profile.avoidIngredients);
  const avoid = avoidRaw.filter((a: string) => a !== '__none__');
  const health = JSON.parse(profile.healthConditions);
  const equipment = JSON.parse(profile.kitchenEquipment);

  const profileAny = profile as any;
  const mealPref = profile.mealPreference?.toLowerCase() || '';
  const nonVegItems = ['chicken', 'fish', 'tuna', 'prawns', 'mutton'];
  const nonVeganItems = [...nonVegItems, 'eggs', 'paneer', 'whey protein', 'curd/yogurt', 'milk', 'cheese', 'butter', 'ghee', 'buttermilk'];

  let filteredPreferred = preferred;
  if (mealPref === 'vegan') {
    filteredPreferred = preferred.filter((i: string) => !nonVeganItems.some(nv => i.toLowerCase().includes(nv)));
  } else if (mealPref === 'vegetarian') {
    filteredPreferred = preferred.filter((i: string) => !nonVegItems.some(nv => i.toLowerCase().includes(nv)));
  } else if (mealPref === 'eggetarian') {
    filteredPreferred = preferred.filter((i: string) => !nonVegItems.some(nv => i.toLowerCase().includes(nv)));
  } else if (mealPref === 'pescatarian') {
    const landMeat = ['chicken', 'mutton'];
    filteredPreferred = preferred.filter((i: string) => !landMeat.some(nv => i.toLowerCase().includes(nv)));
  }

  const mealTypes = getMealTypes(profile.mealsPerDay);

  const customInstructions = (profile.mealPlanCustomInstructions || '').trim();
  const customBlock = customInstructions ? `

USER CUSTOMISATION INSTRUCTIONS (highest priority — follow these exactly):
"${customInstructions}"

These are specific instructions from the user to modify their meal plan.
Apply these on top of their profile preferences. If an instruction
conflicts with a dietary restriction or allergy, ignore the instruction
and keep the restriction. Otherwise, honour these instructions precisely.` : '';

  const planDays = profileAny.planDuration === 14 ? 14 : 7;
  const dayRange = planDays === 14
    ? 'Generate exactly 14 days (Day 1 through Day 14). Week 2 must use completely different meals from Week 1.'
    : 'Generate exactly 7 days (Monday through Sunday).';

  const lifestyleContext   = buildLifestyleContext(profile);
  const mealTargetsSection = buildMealTargetsSection(dailyTargets, profile.mealsPerDay ?? 4);
  const canonicalTypes     = CANONICAL_MEAL_TYPES[profile.mealsPerDay as 3 | 4 | 5]
    ?? CANONICAL_MEAL_TYPES[4];

  // ── Verification: log proportional per-meal macro targets so we can confirm
  //    protein/carbs/fat are weighted (not equal-split) in Vercel logs.
  {
    const mealsPerDayV = profile.mealsPerDay ?? 4;
    const verifyLines  = canonicalTypes.map((t, i) => {
      const mt = getMealMacroTargets(dailyTargets, mealsPerDayV, t, i);
      return `  ${t}: ${mt.calories}kcal P${mt.proteinG}g C${mt.carbsG}g F${mt.fatG}g (×${(mt.weight * 100).toFixed(0)}%)`;
    });
    console.log('[MealTargets] Per-meal proportional split:\n' + verifyLines.join('\n'));
  }

  return `${dayRange}

Profile: ${profile.name}, ${profile.age}y ${profile.gender}, ${profile.city} ${profile.country}
${profile.weightKg}kg${profile.targetWeightKg != null ? ` → ${profile.targetWeightKg}kg` : ''}, ${profile.heightCm}cm, BMI ${bmi}
Goal: ${goalLabel(profile.primaryGoal)}${profile.dietIntensity ? `, Intensity: ${profile.dietIntensity}` : ''}
Activity: ${profile.activityLevel}, Diet: ${profile.mealPreference}
Cuisines: ${cuisines.join(', ') || 'Any'}
${profile.mealsPerDay} meals/day: ${mealTypes.join(', ')}
Window: ${(profile.eatingWindow === 'intermittent_fasting' || profile.eatingWindow === '16_8' || profile.eatingWindow === '18_6')
    ? `Intermittent Fasting — eating ${profileAny.eatingWindowHours || (profile.eatingWindow === '18_6' ? 6 : 8)}h (${profileAny.eatingStartTime || '07:00'}–${profileAny.eatingEndTime || (profile.eatingWindow === '18_6' ? '13:00' : '15:00')}), fasting ${profileAny.fastingWindowHours || (profile.eatingWindow === '18_6' ? 18 : 16)}h. Schedule all meals within the eating window.`
    : 'Standard (no fasting)'}, Wake: ${profile.wakeUpTime || '07:00'}, Sleep: ${profile.sleepTime || '23:00'}
Allergies: ${allergies.length > 0 ? allergies.join(', ') : 'None'}
Preferred: ${filteredPreferred.length > 0 ? filteredPreferred.join(', ') : 'Any'}
Avoid: ${avoid.length > 0 ? avoid.join(', ') : 'None'}
Health: ${health.length > 0 ? health.join(', ') : 'None'}
Cooking: ${profile.cookingStyle || 'home'}, Equipment: ${equipment.length > 0 ? equipment.join(', ') : 'Stovetop'}
${profile.weeklyBudget ? `Budget: ${profile.budgetCurrency} ${profile.weeklyBudget}/week` : ''}

DAILY NUTRITION TARGETS:
${mealTargetsSection}
Daily total: ${dailyTargets.calories} kcal · P ${dailyTargets.proteinG}g · C ${dailyTargets.carbsG}g · F ${dailyTargets.fatG}g · Fibre ${dailyTargets.fibreG}g

CRITICAL RULES FOR MACRO DISTRIBUTION:
1. Size each meal according to its per-meal target above — NOT as equal splits
2. Snacks must be genuinely light (fruit, nuts, yoghurt, or a small dish ≤ ~${Math.round(dailyTargets.calories * 0.12)} kcal)
3. Lunch and dinner carry the bulk of daily calories and protein
4. The "type" field in your JSON must be EXACTLY one of: ${JSON.stringify(canonicalTypes)}
5. Do not use "Breakfast", "Morning Snack", "Snack 1", or any other variant${lifestyleContext}${customBlock}`;
}

// Static system prompt — cacheable across requests
const SYSTEM_PROMPT_7 = `You are a professional nutritionist. Generate a 7-day meal plan as pure JSON.

RULES:
- Respect ALL allergies strictly
- Use preferred ingredients
- Easy meals (<30 min)
- Vary meals across the week
- Day totals within ±50 kcal of target
- Short descriptions with gram quantities (e.g. "Sauté 150g chicken, 100g onions, serve with 80g rice")
- ONLY valid JSON, no markdown

INGREDIENT QUANTITIES — MANDATORY:
- EVERY item in the ingredients array MUST include a numeric quantity — no bare names like "turmeric" or "oil"
- Proteins: 80–200g · Grains (raw): 60–100g · Vegetables: 50–150g · Legumes (raw): 60–80g
- Oils and ghee: use grams, never ml (e.g. "10g ghee", "8g oil")
- Spice reference — use these real-world cooking amounts:
  turmeric 1-2g · red chili powder 2-3g · coriander powder 3-5g · cumin seeds 2-3g
  mustard seeds 3-5g · curry leaves 5g · ginger 5g · garlic 5g
  garam masala 2g · sambar powder 5g · tamarind paste 10g · salt 2g
- Liquids: coconut milk 50-150ml · lemon juice 10ml · water 100-200ml
- Discrete items are fine as count with weight: "2 eggs (100g)" · "1 whole wheat roti (40g)"

JSON STRUCTURE (use exactly this shape):
{"weekSummary":{"avgCalories":0,"avgProtein":0,"avgCarbs":0,"avgFat":0,"avgFibre":0},"days":[{"dayIndex":0,"dayName":"Monday","totalCalories":0,"totalProtein":0,"totalCarbs":0,"totalFat":0,"totalFibre":0,"meals":[{"mealIndex":0,"type":"breakfast","time":"8:00 AM","name":"meal name","description":"brief instructions with gram quantities","ingredients":["150g chicken breast","80g onion","1g turmeric","2g red chili powder","3g coriander powder","5g ghee"],"calories":0,"protein":0,"carbs":0,"fat":0,"fibre":0}]}],"shoppingList":[{"category":"Proteins","items":[{"name":"Chicken breast","quantity":"1","unit":"kg"}]}],"mealPrepGuide":{"estimatedMinutes":45,"intro":"Do these tasks on Sunday to set yourself up for the week.","sections":[{"category":"Proteins","emoji":"🥩","tasks":[{"instruction":"Marinate 600g chicken in curd and spices. Use Mon–Wed.","usedOn":"Mon, Tue, Wed"}]}]}}

MEAL TYPE VALUES — use ONLY these exact lowercase strings in the "type" field:
- 3 meals/day: "breakfast", "lunch", "dinner"
- 4 meals/day: "breakfast", "lunch", "snack", "dinner"
- 5 meals/day: "breakfast", "morning_snack", "lunch", "evening_snack", "dinner"
Do NOT use "Breakfast", "Morning Snack", "Snack 1", or any other variant.

Keep descriptions under 20 words. Include mealPrepGuide with practical weekly prep tasks. Be concise.`;

const SYSTEM_PROMPT_14 = `You are a professional nutritionist. Generate a 14-day meal plan as pure JSON.

RULES:
- Respect ALL allergies strictly
- Use preferred ingredients
- Easy meals (<30 min)
- Maximise variety — Week 2 must have completely different meals from Week 1
- Day totals within ±50 kcal of target
- Short descriptions with gram quantities
- ONLY valid JSON, no markdown
- Generate ALL 14 days (dayIndex 0-13)

INGREDIENT QUANTITIES — MANDATORY:
- EVERY item in the ingredients array MUST include a numeric quantity — no bare names like "turmeric" or "oil"
- Proteins: 80–200g · Grains (raw): 60–100g · Vegetables: 50–150g · Legumes (raw): 60–80g
- Oils and ghee: use grams, never ml (e.g. "10g ghee", "8g oil")
- Spice reference — use these real-world cooking amounts:
  turmeric 1-2g · red chili powder 2-3g · coriander powder 3-5g · cumin seeds 2-3g
  mustard seeds 3-5g · curry leaves 5g · ginger 5g · garlic 5g
  garam masala 2g · sambar powder 5g · tamarind paste 10g · salt 2g
- Liquids: coconut milk 50-150ml · lemon juice 10ml · water 100-200ml
- Discrete items are fine as count with weight: "2 eggs (100g)" · "1 whole wheat roti (40g)"

JSON STRUCTURE (same as 7-day but with 14 days in the days array):
{"weekSummary":{"avgCalories":0,"avgProtein":0,"avgCarbs":0,"avgFat":0,"avgFibre":0},"days":[{"dayIndex":0,"dayName":"Day 1","totalCalories":0,"totalProtein":0,"totalCarbs":0,"totalFat":0,"totalFibre":0,"meals":[{"mealIndex":0,"type":"breakfast","time":"8:00 AM","name":"meal name","description":"brief instructions","ingredients":["150g chicken breast","80g onion","1g turmeric","2g red chili powder","5g oil"],"calories":0,"protein":0,"carbs":0,"fat":0,"fibre":0}]}],"shoppingList":[{"category":"Proteins","items":[{"name":"Chicken breast","quantity":"1.5","unit":"kg"}]}],"mealPrepGuide":{"estimatedMinutes":60,"intro":"Do these tasks on Sunday to set yourself up for two full weeks.","sections":[{"category":"Proteins","emoji":"🥩","tasks":[{"instruction":"Prep instruction with quantities.","usedOn":"Days 1–5"}]}]}}

MEAL TYPE VALUES — use ONLY these exact lowercase strings in the "type" field:
- 3 meals/day: "breakfast", "lunch", "dinner"
- 4 meals/day: "breakfast", "lunch", "snack", "dinner"
- 5 meals/day: "breakfast", "morning_snack", "lunch", "evening_snack", "dinner"
Do NOT use "Breakfast", "Morning Snack", "Snack 1", or any other variant.

Keep descriptions under 20 words. Be concise.`;

export {
  SYSTEM_PROMPT_7,
  SYSTEM_PROMPT_14,
  goalLabel,
  getMealTypes,
  buildMealTargetsSection,
  buildLifestyleContext,
  buildUserPrompt,
};
