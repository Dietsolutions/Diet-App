/**
 * Search service for self-hosted Indian food databases:
 *   IndianRecipe table  — 1,014 INDB recipes (ICMR-NIN IFCT 2017)
 *   IndianIngredient    — 542  ICMR-NIN raw ingredients
 *
 * Both tables are small enough to scan in memory on each request.
 * Fuzzy matching uses trigram similarity + word coverage, no external library.
 */

import prisma from '../lib/prisma';
import { FoodResult } from './foodTypes';

// ── Fuzzy matching ────────────────────────────────────────────────────────

function getTrigrams(s: string): Set<string> {
  const padded = `  ${s}  `;
  const t = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) {
    t.add(padded.slice(i, i + 3));
  }
  return t;
}

function trigramSim(a: string, b: string): number {
  const ta = getTrigrams(a.toLowerCase());
  const tb = getTrigrams(b.toLowerCase());
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  ta.forEach(t => { if (tb.has(t)) shared++; });
  return (2 * shared) / (ta.size + tb.size);
}

function wordCoverage(query: string, name: string): number {
  const qWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (qWords.length === 0) return 0;
  const lower = name.toLowerCase();
  return qWords.filter(w => lower.includes(w)).length / qWords.length;
}

function score(query: string, name: string, aliases?: string | null): number {
  const qLow  = query.toLowerCase();
  const nLow  = name.toLowerCase();

  // Exact substring match → highest priority
  if (nLow === qLow) return 1.0;
  const exactBonus = nLow.includes(qLow) || qLow.includes(nLow) ? 0.3 : 0;

  const tSim  = trigramSim(query, name);
  const wCov  = wordCoverage(query, name);

  // Check aliases
  let aliasScore = 0;
  if (aliases) {
    for (const a of aliases.split(',').map(x => x.trim()).filter(Boolean)) {
      aliasScore = Math.max(aliasScore, trigramSim(query, a), wordCoverage(query, a));
    }
  }

  return Math.min(1.0, Math.max(tSim, wCov, aliasScore) + exactBonus);
}

// ── Result mapper (maps to existing FoodResult shape) ────────────────────

function toResult(
  item: {
    id: string;
    recipeName?: string;
    foodName?: string;
    caloriesPer100g: number;
    proteinPer100g: number;
    carbsPer100g: number;
    fatPer100g: number;
    fibrePer100g: number;
    servingGrams?: number;
    servingName?: string;
    foodGroup?: string | null;
    source: string;
    dataSource?: string | null;
    aliases?: string | null;
  },
  type: 'recipe' | 'ingredient',
  matchScore: number,
): FoodResult {
  const servingGrams = item.servingGrams ?? 100;
  const scale        = servingGrams / 100;
  const name         = (item.recipeName || item.foodName)!;

  const per100g = {
    calories: Math.round(item.caloriesPer100g),
    protein:  Math.round(item.proteinPer100g  * 10) / 10,
    carbs:    Math.round(item.carbsPer100g    * 10) / 10,
    fat:      Math.round(item.fatPer100g      * 10) / 10,
    fibre:    Math.round(item.fibrePer100g    * 10) / 10,
  };

  const servingLabel = item.servingName || `${servingGrams}g`;

  return {
    id:           item.id,
    name,
    description:  item.foodGroup ?? (type === 'recipe' ? 'Indian Recipe' : 'Indian Ingredient'),
    source:       'indian_db',
    sourceLabel:  type === 'recipe' ? 'INDB' : 'ICMR-NIN',
    servingSizes: [
      { label: servingLabel, grams: servingGrams },
      { label: '100g',       grams: 100          },
    ],
    defaultServing: { label: servingLabel, grams: servingGrams },
    per100g,
    perServing: {
      calories: Math.round(item.caloriesPer100g * scale),
      protein:  Math.round(item.proteinPer100g  * scale * 10) / 10,
      carbs:    Math.round(item.carbsPer100g    * scale * 10) / 10,
      fat:      Math.round(item.fatPer100g      * scale * 10) / 10,
      fibre:    Math.round(item.fibrePer100g    * scale * 10) / 10,
    },
    isAiEstimate: false,
    matchScore,
    dataSource:   item.dataSource ?? item.source,
  };
}

// ── INDB Recipe Search ────────────────────────────────────────────────────

export async function searchINDB(
  query: string,
  limit  = 5,
  minScore = 0.45,
): Promise<FoodResult[]> {
  try {
    const count = await prisma.indianRecipe.count();
    if (count === 0) return [];

    const all = await prisma.indianRecipe.findMany({
      select: {
        id: true, recipeCode: true, recipeName: true,
        aliases: true, caloriesPer100g: true, proteinPer100g: true,
        carbsPer100g: true, fatPer100g: true, fibrePer100g: true,
        servingGrams: true, servingName: true, source: true, dataSource: true,
      },
    });

    return all
      .map(r => ({ r, s: score(query, r.recipeName, r.aliases) }))
      .filter(x => x.s >= minScore)
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map(x => toResult(x.r, 'recipe', x.s));
  } catch (err: any) {
    console.warn('[INDB] search failed:', err.message);
    return [];
  }
}

// ── ICMR-NIN Ingredient Search ────────────────────────────────────────────

export async function searchICMRNIN(
  query: string,
  limit  = 5,
  minScore = 0.40,
): Promise<FoodResult[]> {
  try {
    const count = await prisma.indianIngredient.count();
    if (count === 0) return [];

    const all = await prisma.indianIngredient.findMany({
      select: {
        id: true, foodCode: true, foodName: true, foodGroup: true,
        aliases: true, caloriesPer100g: true, proteinPer100g: true,
        carbsPer100g: true, fatPer100g: true, fibrePer100g: true, source: true,
      },
    });

    return all
      .map(i => ({ i, s: score(query, i.foodName, i.aliases) }))
      .filter(x => x.s >= minScore)
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map(x => toResult(
        { ...x.i, servingGrams: 100, servingName: '100g', dataSource: 'ICMR-NIN IFCT 2017' },
        'ingredient',
        x.s,
      ));
  } catch (err: any) {
    console.warn('[ICMR-NIN] search failed:', err.message);
    return [];
  }
}
