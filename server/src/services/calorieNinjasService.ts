// CalorieNinjas Nutrition API service
// API docs: https://calorieninjas.com/api
// Free tier: 100 calls/day
// Endpoint: GET https://api.calorieninjas.com/v1/nutrition?query=<ingredients>

export interface CNMacros {
  calories: number;
  proteinG: number;
  carbsG:   number;
  fatG:     number;
  fibreG:   number;
}

interface CNResult {
  success: boolean;
  macros:  CNMacros;
  error?:  string;
}

function zeroed(): CNMacros {
  return { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fibreG: 0 };
}

// One call per meal — joins all ingredients into a single query string.
// CalorieNinjas handles multi-ingredient queries naturally, e.g.:
//   "140g chicken breast, 2 tbsp olive oil, 200g spinach"
export async function getMealMacrosFromCalorieNinjas(
  mealName:    string,
  ingredients: string[],
): Promise<CNResult> {
  const apiKey = process.env.CALORIE_NINJAS_API_KEY;
  if (!apiKey) {
    return { success: false, macros: zeroed(), error: 'CalorieNinjas not configured' };
  }

  try {
    const query = ingredients.join(', ');
    const url   = `https://api.calorieninjas.com/v1/nutrition?query=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      method:  'GET',
      headers: {
        'X-Api-Key':     apiKey,
        'Content-Type':  'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn(`[CalorieNinjas] ${response.status} for "${mealName}":`, text);
      return { success: false, macros: zeroed(), error: `CalorieNinjas ${response.status}` };
    }

    const data = await response.json() as any;

    // data.items — one entry per recognised ingredient; sum all items for meal total
    if (!data.items || data.items.length === 0) {
      console.warn(`[CalorieNinjas] No items returned for "${mealName}"`);
      return { success: false, macros: zeroed(), error: 'No items returned' };
    }

    const totals = data.items.reduce(
      (acc: CNMacros, item: any) => ({
        calories: acc.calories + (item.calories                 ?? 0),
        proteinG: acc.proteinG + (item.protein_g                ?? 0),
        carbsG:   acc.carbsG   + (item.carbohydrates_total_g   ?? 0),
        fatG:     acc.fatG     + (item.fat_total_g              ?? 0),
        fibreG:   acc.fibreG   + (item.fiber_g                  ?? 0),
      }),
      zeroed(),
    );

    const macros: CNMacros = {
      calories: Math.round(totals.calories),
      proteinG: Math.round(totals.proteinG * 10) / 10,
      carbsG:   Math.round(totals.carbsG   * 10) / 10,
      fatG:     Math.round(totals.fatG     * 10) / 10,
      fibreG:   Math.round(totals.fibreG   * 10) / 10,
    };

    console.log(
      `[CalorieNinjas] "${mealName}": ${macros.calories}kcal ` +
      `P:${macros.proteinG}g C:${macros.carbsG}g F:${macros.fatG}g`
    );
    return { success: true, macros };

  } catch (err: any) {
    console.warn(`[CalorieNinjas] Failed for "${mealName}":`, err.message);
    return { success: false, macros: zeroed(), error: err.message };
  }
}

// Verify all meals in one plan day sequentially.
// Sequential (not parallel) to respect the 100 calls/day free-tier limit.
// 4 meals × 7 days = 28 calls; 4 meals × 14 days = 56 calls — both within limit.
export async function verifyDayMacros(meals: any[]): Promise<CNMacros[]> {
  const results: CNMacros[] = [];

  for (const meal of meals) {
    const ingredients = extractIngredients(meal);
    const result      = await getMealMacrosFromCalorieNinjas(meal.name, ingredients);

    if (result.success) {
      results.push(result.macros);
    } else {
      // Fall back to Claude's estimates when CN fails for this meal
      results.push({
        calories: meal.calories ?? 0,
        proteinG: meal.protein  ?? 0,
        carbsG:   meal.carbs    ?? 0,
        fatG:     meal.fat      ?? 0,
        fibreG:   meal.fibre    ?? 0,
      });
    }

    // Small delay between calls to be polite to the rate limit
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return results;
}

// ── Ingredient extraction ────────────────────────────────────────────────────

function extractIngredients(meal: any): string[] {
  // Case 1 — ingredients is an array of plain strings: ["150g chicken", ...]
  if (Array.isArray(meal.ingredients) && typeof meal.ingredients[0] === 'string') {
    return meal.ingredients;
  }

  // Case 2 — ingredients is an array of objects: [{ quantity, unit, name }, ...]
  if (Array.isArray(meal.ingredients) && meal.ingredients[0]?.name) {
    return meal.ingredients.map((ing: any) =>
      `${ing.quantity || ''} ${ing.unit || ''} ${ing.name}`.trim()
    );
  }

  // Case 3 — fall back to meal name + description as a best-effort query
  return [`${meal.name}: ${meal.description || ''}`];
}
