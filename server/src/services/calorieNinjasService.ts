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
  success:       boolean;
  macros:        CNMacros;
  error?:        string;
  queryString:   string;   // exact query string sent to CN
  statusCode?:   number;   // HTTP status
  itemsMatched?: number;   // how many items CN recognised
}

export interface CNDetailedResult {
  macros:        CNMacros;
  queryString:   string;
  success:       boolean;
  statusCode?:   number;
  itemsMatched?: number;
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
    return { success: false, macros: zeroed(), error: 'CalorieNinjas not configured', queryString: '' };
  }

  const query = ingredients.join(', ');
  const _cnT0 = Date.now();   // [CN-DIAG] timing — must be outside try so catch can read it

  try {
    const url   = `https://api.calorieninjas.com/v1/nutrition?query=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      method:  'GET',
      headers: {
        'X-Api-Key':     apiKey,
        'Content-Type':  'application/json',
      },
      // 5s: the Vercel->CN serverless path is unreliable regardless (calls hang
      // past even 12s for ~half of requests — likely CN throttling datacenter IPs).
      // Raising the timeout did not improve coverage, so keep it short so failures
      // fast-track quickly. The real fix is a paid CN tier or a different source.
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn(`[CN-DIAG] "${mealName}" HTTP ${response.status} in ${Date.now() - _cnT0}ms: ${text.slice(0, 80)}`);
      return {
        success:    false,
        macros:     zeroed(),
        error:      `CalorieNinjas ${response.status}`,
        queryString: query,
        statusCode: response.status,
      };
    }

    const data = await response.json() as any;

    // data.items — one entry per recognised ingredient; sum all items for meal total
    if (!data.items || data.items.length === 0) {
      console.warn(`[CalorieNinjas] No items returned for "${mealName}"`);
      return {
        success:      false,
        macros:       zeroed(),
        error:        'No items returned',
        queryString:  query,
        statusCode:   response.status,
        itemsMatched: 0,
      };
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
      `[CN-DIAG] "${mealName}" OK in ${Date.now() - _cnT0}ms: ${macros.calories}kcal ` +
      `P:${macros.proteinG}g C:${macros.carbsG}g F:${macros.fatG}g`
    );
    return {
      success:      true,
      macros,
      queryString:  query,
      statusCode:   response.status,
      itemsMatched: data.items.length,
    };

  } catch (err: any) {
    console.warn(`[CN-DIAG] "${mealName}" FAILED after ${Date.now() - _cnT0}ms — name=${err?.name} code=${err?.code ?? err?.cause?.code ?? ''} msg=${err?.message}`);
    return {
      success:      false,
      macros:       zeroed(),
      error:        err.message,
      queryString:  query,
      itemsMatched: 0,
    };
  }
}

// Verify all meals in one plan day sequentially.
// Sequential (not parallel) to respect the 100 calls/day free-tier limit.
// 4 meals × 7 days = 28 calls; 4 meals × 14 days = 56 calls — both within limit.
// Returns both the summed CNMacros[] (for backward compat) and detailed CNDetailedResult[].
export async function verifyDayMacros(meals: any[]): Promise<{
  verifiedMacros:  CNMacros[];
  detailedResults: CNDetailedResult[];
}> {
  const verifiedMacros:  CNMacros[]         = [];
  const detailedResults: CNDetailedResult[] = [];

  for (const meal of meals) {
    const ingredients = extractIngredients(meal);
    const result      = await getMealMacrosFromCalorieNinjas(meal.name, ingredients);

    if (result.success) {
      const cnCal     = result.macros.calories;
      const claudeCal = meal.calories ?? 0;

      // Plausibility guard: if CN returns >3× Claude's own estimate, CN has
      // almost certainly defaulted a zero-quantity ingredient to 100 g (or
      // similarly mis-parsed something). Fall back to Claude's estimate.
      // A 3× ceiling is generous enough to allow real discrepancies (e.g.
      // Claude under-estimating by 50%) while blocking clearly bad CN reads.
      if (claudeCal > 50 && cnCal > claudeCal * 3) {
        console.warn(
          `[CalorieNinjas] PLAUSIBILITY FAIL "${meal.name}": ` +
          `CN=${cnCal}kcal is >3× Claude=${claudeCal}kcal — using Claude estimate`
        );
        const fallbackMacros: CNMacros = {
          calories: claudeCal,
          proteinG: meal.protein ?? 0,
          carbsG:   meal.carbs   ?? 0,
          fatG:     meal.fat     ?? 0,
          fibreG:   meal.fibre   ?? 0,
        };
        verifiedMacros.push(fallbackMacros);
        detailedResults.push({
          macros:       fallbackMacros,
          queryString:  result.queryString,
          success:      false,   // treat as failed for logging — plausibility guard fired
          statusCode:   result.statusCode,
          itemsMatched: result.itemsMatched,
        });
      } else {
        verifiedMacros.push(result.macros);
        detailedResults.push({
          macros:       result.macros,
          queryString:  result.queryString,
          success:      true,
          statusCode:   result.statusCode,
          itemsMatched: result.itemsMatched,
        });
      }
    } else {
      // Fall back to Claude's estimates when CN fails for this meal
      const fallbackMacros: CNMacros = {
        calories: meal.calories ?? 0,
        proteinG: meal.protein  ?? 0,
        carbsG:   meal.carbs    ?? 0,
        fatG:     meal.fat      ?? 0,
        fibreG:   meal.fibre    ?? 0,
      };
      verifiedMacros.push(fallbackMacros);
      detailedResults.push({
        macros:       fallbackMacros,
        queryString:  result.queryString,
        success:      false,
        statusCode:   result.statusCode,
        itemsMatched: result.itemsMatched,
      });
    }

    // Small delay between calls to be polite to the rate limit (50ms is enough for Neon pooler)
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return { verifiedMacros, detailedResults };
}

// ── Ingredient extraction ────────────────────────────────────────────────────

// Density map for ml→g conversion.
// CalorieNinjas cannot parse ml for fats/oils — it silently defaults to 100 g.
// "10ml ghee" → CN reads as 100 g ghee → ~900 kcal instead of ~90 kcal.
// Converting to grams before the query fixes this.
const FAT_DENSITY: Array<[RegExp, number]> = [
  [/ghee/i,             0.91],
  [/butter/i,           0.91],
  [/coconut oil/i,      0.92],
  [/olive oil/i,        0.91],
  [/sesame oil/i,       0.92],
  [/mustard oil/i,      0.91],
  [/sunflower oil/i,    0.92],
  [/vegetable oil/i,    0.92],
  [/canola oil/i,       0.92],
  [/oil/i,              0.92],  // generic oil — must be last
];

// Liquid density map (approximately 1 g/ml, but listed explicitly for clarity)
const LIQUID_DENSITY: Array<[RegExp, number]> = [
  [/milk/i,             1.03],
  [/yogurt|curd/i,      1.03],
  [/water/i,            1.00],
  [/broth|stock/i,      1.00],
  [/sauce/i,            1.05],
  [/juice/i,            1.04],
  [/coconut milk/i,     1.00],
];

/**
 * Convert "10ml ghee" → "9g ghee", "200ml milk" → "206g milk", etc.
 * Leaves non-ml ingredients unchanged.
 * Exported so the main validation pipeline (routes/ai.ts) applies the same
 * ml→g conversion as verifyDayMacros — CN defaults unparseable ml to 100g.
 */
export function normaliseMl(ingredient: string): string {
  const mlMatch = ingredient.match(/^(\d+(?:\.\d+)?)\s*ml\s+(.+)$/i);
  if (!mlMatch) return ingredient;

  const ml   = parseFloat(mlMatch[1]);
  const rest = mlMatch[2];

  // Check fats first (higher density deviation from 1g/ml)
  for (const [pattern, density] of FAT_DENSITY) {
    if (pattern.test(rest)) {
      const grams = Math.round(ml * density);
      console.log(`[CN] ml→g: "${ingredient}" → "${grams}g ${rest}"`);
      return `${grams}g ${rest}`;
    }
  }

  // Check other liquids
  for (const [pattern, density] of LIQUID_DENSITY) {
    if (pattern.test(rest)) {
      const grams = Math.round(ml * density);
      return `${grams}g ${rest}`;
    }
  }

  // Default: 1 ml ≈ 1 g (water-like)
  return `${Math.round(ml)}g ${rest}`;
}

function extractIngredients(meal: any): string[] {
  // Case 1 — ingredients is an array of plain strings: ["150g chicken", ...]
  if (Array.isArray(meal.ingredients) && typeof meal.ingredients[0] === 'string') {
    return meal.ingredients.map(normaliseMl);
  }

  // Case 2 — ingredients is an array of objects: [{ quantity, unit, name }, ...]
  if (Array.isArray(meal.ingredients) && meal.ingredients[0]?.name) {
    return meal.ingredients.map((ing: any) => {
      const raw = `${ing.quantity || ''} ${ing.unit || ''} ${ing.name}`.trim();
      return normaliseMl(raw);
    });
  }

  // Case 3 — fall back to meal name + description as a best-effort query
  return [`${meal.name}: ${meal.description || ''}`];
}
