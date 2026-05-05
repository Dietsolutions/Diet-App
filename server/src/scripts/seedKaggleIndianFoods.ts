/**
 * Kaggle Indian Food Dataset Seeder
 *
 * Seeds three Kaggle Indian food datasets into the IndianRecipe table.
 * Each dataset file must be manually downloaded and placed at the paths below
 * (Kaggle requires authentication — CLI download not available in all environments).
 *
 * Required files (place before running):
 *   server/src/data/indian-food/kaggle/batthulavinay.csv
 *     → https://www.kaggle.com/datasets/batthulavinay/indian-food-nutrition
 *     → Download "indian_food_nutrition.csv" and rename to batthulavinay.csv
 *
 *   server/src/data/indian-food/kaggle/syedkhalid076.csv
 *     → https://www.kaggle.com/datasets/syedkhalid076/indian-food-nutrition
 *     → Download the main CSV and rename to syedkhalid076.csv
 *
 *   server/src/data/indian-food/kaggle/sooryaprakash12.csv
 *     → https://www.kaggle.com/datasets/sooryaprakash12/cleaned-indian-recipes-dataset
 *     → Download "Cleaned_Indian_Food_Dataset.csv" and rename to sooryaprakash12.csv
 *
 * Run: cd server && npm run seed:kaggle
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// ── CSV parser (supports multi-line quoted fields) ─────────────────────────

function parseCSV(filePath: string): { headers: string[]; rows: string[][] } | null {
  if (!fs.existsSync(filePath)) {
    console.warn(`[CSV] File not found: ${filePath}`);
    console.warn(`[CSV] Place the downloaded CSV at this path and re-run seed:kaggle`);
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8')
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .replace(/^﻿/, ''); // strip BOM

  // Character-by-character parse — handles embedded newlines inside quoted fields
  function parseAll(raw: string): string[][] {
    const records: string[][] = [];
    let field = '';
    let fields: string[] = [];
    let inQuotes = false;

    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === '"') {
        if (inQuotes && raw[i + 1] === '"') { field += '"'; i++; } // escaped ""
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        fields.push(field.trim().replace(/^"|"$/g, ''));
        field = '';
      } else if (ch === '\n' && !inQuotes) {
        fields.push(field.trim().replace(/^"|"$/g, ''));
        field = '';
        if (fields.some(f => f.length > 0)) records.push(fields);
        fields = [];
      } else {
        field += ch;
      }
    }
    // flush last record
    if (field.trim() || fields.length > 0) {
      fields.push(field.trim().replace(/^"|"$/g, ''));
      if (fields.some(f => f.length > 0)) records.push(fields);
    }
    return records;
  }

  const records = parseAll(content);
  if (records.length === 0) return null;

  const headers = records[0].map(h => h.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_'));
  const rows    = records.slice(1);

  console.log(`\n[CSV] ${path.basename(filePath)}: ${rows.length} rows`);
  console.log(`[CSV] Headers: ${headers.slice(0, 12).join(' | ')}`);

  return { headers, rows };
}

// ── Column resolver ────────────────────────────────────────────────────────

function makeResolver(headers: string[]) {
  return function col(row: string[], ...names: string[]): string {
    for (const name of names) {
      const variants = [
        name.toLowerCase().trim(),
        name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        name.toLowerCase().replace(/[^a-z0-9]/g, ' '),
        name.toLowerCase().replace(/[^a-z0-9]/g, ''),
      ];
      for (const v of variants) {
        const idx = headers.indexOf(v);
        if (idx !== -1 && idx < row.length) return (row[idx] || '').trim().replace(/^"|"$/g, '');
      }
    }
    return '';
  };
}

function toFloat(val: string): number {
  if (!val || val === '-' || val.toLowerCase() === 'na' || val.toLowerCase() === 'n/a') return 0;
  const n = parseFloat(val.replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : Math.round(n * 10) / 10;
}

/**
 * Parse energy from formatted strings like "84 kj\n(20 kcal)" or "335 kJ".
 * Prefers the explicit kcal value when present; falls back to kJ ÷ 4.184.
 */
function toKcal(val: string): number {
  if (!val) return 0;
  // Explicit kcal e.g. "(20 kcal)" or "20 kcal"
  const kcalMatch = val.match(/\(?\s*(\d+(?:\.\d+)?)\s*kcal\s*\)?/i);
  if (kcalMatch) return parseFloat(kcalMatch[1]);
  // kJ only — convert
  const kjMatch = val.match(/(\d+(?:\.\d+)?)\s*kj/i);
  if (kjMatch) return Math.round(parseFloat(kjMatch[1]) / 4.184 * 10) / 10;
  // Plain number fallback
  return toFloat(val);
}

function toCode(name: string, prefix: string, index: number): string {
  return `${prefix}_${name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 28)}_${index}`;
}

// ── Upsert with quality guards ─────────────────────────────────────────────

async function upsertRecipe(data: {
  recipeCode:      string;
  recipeName:      string;
  aliases:         string | null;
  caloriesPer100g: number;
  proteinPer100g:  number;
  carbsPer100g:    number;
  fatPer100g:      number;
  fibrePer100g:    number;
  servingGrams:    number;
  servingName:     string;
  source:          string;
  dataSource:      string;
  allowNoMacros?:  boolean;   // sooryaprakash: name-only rows are useful for search index
}): Promise<boolean> {
  if (data.recipeName.length < 3) return false;
  // Skip rows that have zero for both calories and protein — almost certainly bad data
  // (unless this dataset is name-only by design)
  if (!data.allowNoMacros && data.caloriesPer100g === 0 && data.proteinPer100g === 0) return false;
  // Skip implausible calories (>900 kcal/100g is only possible for pure fats)
  if (data.caloriesPer100g > 950) return false;

  const { allowNoMacros: _ignored, ...prismaData } = data;

  try {
    await prisma.indianRecipe.upsert({
      where:  { recipeCode: prismaData.recipeCode },
      create: prismaData,
      update: {
        caloriesPer100g: prismaData.caloriesPer100g,
        proteinPer100g:  prismaData.proteinPer100g,
        carbsPer100g:    prismaData.carbsPer100g,
        fatPer100g:      prismaData.fatPer100g,
        fibrePer100g:    prismaData.fibrePer100g,
        aliases:         prismaData.aliases,
      },
    });
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// DATASET 1 — batthulavinay/indian-food-nutrition
// Headers (after normalization):
//   dish_name | calories__kcal_ | carbohydrates__g_ | protein__g_ | fats__g_ | fibre__g_
// The double-underscore comes from "Calories (kcal)" → "calories__kcal_".
// ─────────────────────────────────────────────────────────────────────────

async function seedBatthulavinay(): Promise<number> {
  const filePath = path.join(__dirname, '../data/indian-food/kaggle/batthulavinay.csv');
  const parsed = parseCSV(filePath);
  if (!parsed) return 0;

  const { headers, rows } = parsed;
  const col  = makeResolver(headers);
  let count  = 0;

  for (let i = 0; i < rows.length; i++) {
    const row  = rows[i];
    const name = col(row, 'dish_name', 'food_name', 'name', 'item', 'food', 'dish');
    if (!name) continue;

    // Actual normalized column names from this dataset use double-underscores
    // e.g. "Calories (kcal)" → "calories__kcal_"
    const cal   = toFloat(col(row, 'calories__kcal_',   'energy_kcal', 'calories', 'energy', 'kcal'));
    const prot  = toFloat(col(row, 'protein__g_',        'protein_g',   'protein',  'proteins'));
    const carb  = toFloat(col(row, 'carbohydrates__g_',  'carbohydrate_g', 'carbohydrates', 'carbs'));
    const fat   = toFloat(col(row, 'fats__g_',           'fat_g',       'fat',      'total_fat'));
    const fibre = toFloat(col(row, 'fibre__g_',          'fiber_g',     'fiber',    'fibre', 'dietary_fiber'));
    const servG = toFloat(col(row, 'serving_size', 'serving_g', 'portion', 'serving')) || 100;

    const ok = await upsertRecipe({
      recipeCode:      toCode(name, 'KGBV', i),
      recipeName:      name,
      aliases:         null,
      caloriesPer100g: cal,
      proteinPer100g:  prot,
      carbsPer100g:    carb,
      fatPer100g:      fat,
      fibrePer100g:    fibre,
      servingGrams:    servG,
      servingName:     `1 serving (${servG}g)`,
      source:          'KAGGLE',
      dataSource:      'Kaggle: batthulavinay/indian-food-nutrition',
    });
    if (ok) count++;
  }

  console.log(`[Batthulavinay] Seeded ${count} / ${rows.length} rows`);
  return count;
}

// ─────────────────────────────────────────────────────────────────────────
// DATASET 2 — syedkhalid076/indian-food-nutrition
// Headers: food_link | name | brand | nutri_score | processing_score |
//          nutri_energy | nutri_fat | nutri_satufat | nutri_carbohydrate |
//          nutri_sugar | nutri_fiber | nutri_protein | nutri_salt
//
// Energy field is a formatted string: "84 kj\n(20 kcal)" — handled by toKcal().
// Other macro fields are like "1.5 g" — toFloat() strips the unit.
// ─────────────────────────────────────────────────────────────────────────

async function seedSyedkhalid(): Promise<number> {
  const filePath = path.join(__dirname, '../data/indian-food/kaggle/syedkhalid076.csv');
  const parsed = parseCSV(filePath);
  if (!parsed) return 0;

  const { headers, rows } = parsed;
  const col  = makeResolver(headers);
  let count  = 0;

  for (let i = 0; i < rows.length; i++) {
    const row  = rows[i];
    const name = col(row, 'name', 'food_name', 'food', 'item', 'dish');
    if (!name) continue;

    // Energy is a formatted string — use toKcal() instead of toFloat()
    const calRaw = col(row, 'nutri_energy', 'energy_kcal', 'energy', 'calories', 'kcal');
    const cal    = toKcal(calRaw);
    const prot   = toFloat(col(row, 'nutri_protein',       'protein_g',  'protein',  'proteins'));
    const carb   = toFloat(col(row, 'nutri_carbohydrate',  'carbohydrate_g', 'carbohydrates', 'carbs'));
    const fat    = toFloat(col(row, 'nutri_fat',            'fat_g',      'fat',      'total_fat'));
    const fibre  = toFloat(col(row, 'nutri_fiber',  'nutri_fibre', 'fiber_g', 'fiber', 'fibre'));

    const ok = await upsertRecipe({
      recipeCode:      toCode(name, 'KGSK', i),
      recipeName:      name,
      aliases:         null,
      caloriesPer100g: cal,
      proteinPer100g:  prot,
      carbsPer100g:    carb,
      fatPer100g:      fat,
      fibrePer100g:    fibre,
      servingGrams:    100,
      servingName:     '100g',
      source:          'KAGGLE',
      dataSource:      'Kaggle: syedkhalid076/indian-food-nutrition',
    });
    if (ok) count++;
  }

  console.log(`[Syedkhalid] Seeded ${count} / ${rows.length} rows`);
  return count;
}

// ─────────────────────────────────────────────────────────────────────────
// DATASET 3 — sooryaprakash12/cleaned-indian-recipes-dataset
// Headers: TranslatedRecipeName | TranslatedIngredients | TotalTimeInMins |
//          Cuisine | TranslatedInstructions | URL | Cleaned-Ingredients | ...
//
// No macro columns — allowNoMacros is set so name-only rows go through.
// Recipe names expand the fuzzy search index even without nutrition data.
// ─────────────────────────────────────────────────────────────────────────

async function seedSooryaprakash(): Promise<number> {
  const filePath = path.join(__dirname, '../data/indian-food/kaggle/sooryaprakash12.csv');
  const parsed = parseCSV(filePath);
  if (!parsed) return 0;

  const { headers, rows } = parsed;
  const col  = makeResolver(headers);
  let count  = 0;
  let withMacros = 0;

  for (let i = 0; i < rows.length; i++) {
    const row  = rows[i];
    // "TranslatedRecipeName" normalizes to "translatedrecipename" (no separators)
    // The resolver variant that strips all non-alnum chars will match it.
    const name = col(row, 'translated_recipe_name', 'translatedrecipename',
                       'recipe_name', 'name', 'dish', 'food_name', 'recipename');
    if (!name) continue;

    const cal   = toFloat(col(row, 'calories', 'energy', 'kcal', 'energy_kcal'));
    const prot  = toFloat(col(row, 'protein', 'protein_g'));
    const carb  = toFloat(col(row, 'carbs', 'carbohydrates', 'carbohydrate', 'total_carbs'));
    const fat   = toFloat(col(row, 'fat', 'fat_g', 'total_fat'));
    const fibre = toFloat(col(row, 'fibre', 'fiber', 'fibre_g', 'dietary_fiber'));

    if (cal > 0 || prot > 0) withMacros++;

    const cuisine = col(row, 'cuisine', 'region', 'course', 'category');
    const diet    = col(row, 'diet', 'veg_or_nonveg', 'type', 'dietary_preference');
    const aliases = [cuisine, diet].filter(s => s && s.length < 40).join(',') || null;

    const ok = await upsertRecipe({
      recipeCode:      toCode(name, 'KGSP', i),
      recipeName:      name,
      aliases,
      caloriesPer100g: cal,
      proteinPer100g:  prot,
      carbsPer100g:    carb,
      fatPer100g:      fat,
      fibrePer100g:    fibre,
      servingGrams:    100,
      servingName:     '100g',
      source:          'KAGGLE',
      dataSource:      'Kaggle: sooryaprakash12/cleaned-indian-recipes-dataset',
      allowNoMacros:   true, // name-only rows still expand the search index
    });
    if (ok) count++;
  }

  console.log(`[Sooryaprakash] Seeded ${count} / ${rows.length} rows (${withMacros} had macro data)`);
  return count;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Kaggle Indian Food Seeder ===');
  console.log('Place CSV files in server/src/data/indian-food/kaggle/ before running.\n');

  const before = await prisma.indianRecipe.count();
  console.log(`Before: ${before} recipes\n`);

  const counts = {
    batthulavinay: await seedBatthulavinay(),
    syedkhalid:    await seedSyedkhalid(),
    sooryaprakash: await seedSooryaprakash(),
  };

  const after = await prisma.indianRecipe.count();

  console.log('\n=== Results ===');
  console.log(`batthulavinay/indian-food-nutrition:       ${counts.batthulavinay}`);
  console.log(`syedkhalid076/indian-food-nutrition:       ${counts.syedkhalid}`);
  console.log(`sooryaprakash12/cleaned-recipes-dataset:   ${counts.sooryaprakash}`);
  console.log(`\nDatabase before: ${before}`);
  console.log(`Database after:  ${after}`);
  console.log(`Net new entries: ${after - before}`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
