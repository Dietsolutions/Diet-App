import { FoodResult, Macros } from './foodTypes';

const BASE = 'https://world.openfoodfacts.org';

function scaleMacros(caloriesPer100g: number, n: any, servingGrams: number): Macros {
  const factor = servingGrams / 100;
  return {
    calories: Math.round(caloriesPer100g * factor),
    protein: Math.round((n['proteins_100g'] ?? 0) * factor * 10) / 10,
    carbs: Math.round((n['carbohydrates_100g'] ?? 0) * factor * 10) / 10,
    fat: Math.round((n['fat_100g'] ?? 0) * factor * 10) / 10,
    fibre: Math.round((n['fiber_100g'] ?? 0) * factor * 10) / 10,
  };
}

function parseServingSize(s: string | undefined): number | null {
  if (!s) return null;
  // Grams: "30g" or "30 g"
  const gMatch = s.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (gMatch) return parseFloat(gMatch[1]);
  // ml (density ~1g/ml for most foods)
  const mlMatch = s.match(/(\d+(?:\.\d+)?)\s*ml\b/i);
  if (mlMatch) return parseFloat(mlMatch[1]);
  // Cup: 1 cup ≈ 240g
  const cupMatch = s.match(/(\d+(?:\.\d+)?)\s*cup/i);
  if (cupMatch) return parseFloat(cupMatch[1]) * 240;
  // Tbsp: 1 tbsp ≈ 15g
  const tbspMatch = s.match(/(\d+(?:\.\d+)?)\s*tbsp/i);
  if (tbspMatch) return parseFloat(tbspMatch[1]) * 15;
  // Tsp: 1 tsp ≈ 5g
  const tspMatch = s.match(/(\d+(?:\.\d+)?)\s*tsp/i);
  if (tspMatch) return parseFloat(tspMatch[1]) * 5;
  // oz: 1 oz ≈ 28.35g
  const ozMatch = s.match(/(\d+(?:\.\d+)?)\s*oz\b/i);
  if (ozMatch) return parseFloat(ozMatch[1]) * 28.35;
  return null;
}

function mapOpenFoodFactsProduct(p: any): FoodResult {
  const n = p.nutriments || {};

  const caloriesPer100g =
    n['energy-kcal_100g'] ??
    n['energy-kcal'] ??
    (n['energy_100g'] ? n['energy_100g'] / 4.184 : 0);

  const servingGrams = parseServingSize(p.serving_size) ?? 100;

  return {
    id: `off-${p.code || p._id || Date.now()}`,
    name: [p.product_name, p.brands].filter(Boolean).join(' — '),
    description: p.brands ?? '',
    source: 'open_food_facts',
    servingSizes: [
      { label: p.serving_size || '100g', grams: servingGrams },
      { label: '100g', grams: 100 },
    ],
    defaultServing: { label: p.serving_size || '100g', grams: servingGrams },
    per100g: {
      calories: Math.round(caloriesPer100g),
      protein: Math.round((n['proteins_100g'] ?? 0) * 10) / 10,
      carbs: Math.round((n['carbohydrates_100g'] ?? 0) * 10) / 10,
      fat: Math.round((n['fat_100g'] ?? 0) * 10) / 10,
      fibre: Math.round((n['fiber_100g'] ?? 0) * 10) / 10,
    },
    perServing: scaleMacros(caloriesPer100g, n, servingGrams),
    isAiEstimate: false,
  };
}

export async function searchOpenFoodFacts(query: string): Promise<FoodResult[]> {
  const url =
    `${BASE}/cgi/search.pl?` +
    new URLSearchParams({
      search_terms: query,
      search_simple: '1',
      action: 'process',
      json: '1',
      page_size: '8',
      fields: 'code,product_name,brands,serving_size,nutriments',
    });

  const res = await fetch(url, {
    headers: { 'User-Agent': 'DietPlanTracker/1.0 (https://ai-dpt.vercel.app)' },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`Open Food Facts responded with ${res.status}`);

  const data: any = await res.json();

  return (data.products || [])
    .filter(
      (p: any) =>
        p.product_name &&
        p.nutriments &&
        (p.nutriments['energy-kcal_100g'] || p.nutriments['energy-kcal'] || p.nutriments['energy_100g'])
    )
    .map((p: any) => mapOpenFoodFactsProduct(p))
    .slice(0, 6);
}
