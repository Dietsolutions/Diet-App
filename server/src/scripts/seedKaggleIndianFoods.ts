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

// ── CSV parser ─────────────────────────────────────────────────────────────

function parseCSV(filePath: string): { headers: string[]; rows: string[][] } | null {
  if (!fs.existsSync(filePath)) {
    console.warn(`[CSV] File not found: ${filePath}`);
    console.warn(`[CSV] Place the downloaded CSV at this path and re-run seed:kaggle`);
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8')
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    // strip BOM
    .replace(/^﻿/, '');

  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length === 0) return null;

  function parseLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { result.push(current.trim().replace(/^"|"$/g, '')); current = ''; }
      else { current += ch; }
    }
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
  }

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_'));
  const rows    = lines.slice(1).map(l => parseLine(l));

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
}): Promise<boolean> {
  if (data.recipeName.length < 3) return false;
  // Skip rows that have zero for both calories and protein — almost certainly bad data
  if (data.caloriesPer100g === 0 && data.proteinPer100g === 0) return false;
  // Skip implausible calories (>900 kcal/100g is only possible for pure fats)
  if (data.caloriesPer100g > 950) return false;

  try {
    await prisma.indianRecipe.upsert({
      where:  { recipeCode: data.recipeCode },
      create: data,
      update: {
        // Only overwrite macros; preserve recipeName from the first source that added it
        caloriesPer100g: data.caloriesPer100g,
        proteinPer100g:  data.proteinPer100g,
        carbsPer100g:    data.carbsPer100g,
        fatPer100g:      data.fatPer100g,
        fibrePer100g:    data.fibrePer100g,
        aliases:         data.aliases,
      },
    });
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// DATASET 1 — batthulavinay/indian-food-nutrition
// Typical columns: food_name, energy_kcal, protein_g, carbohydrate_g, fat_g, fibre_g
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
    const name = col(row, 'food_name', 'name', 'item', 'food', 'dish', 'food name',
                       'item_name', 'dish_name', 'recipe', 'recipe_name');
    if (!name) continue;

    const cal   = toFloat(col(row, 'energy_kcal', 'calories', 'energy', 'kcal', 'cal', 'calorie'));
    const prot  = toFloat(col(row, 'protein_g', 'protein', 'proteins'));
    const carb  = toFloat(col(row, 'carbohydrate_g', 'carbohydrates', 'carbs', 'carbohydrate',
                               'cho', 'total_carbohydrate', 'total carbohydrate'));
    const fat   = toFloat(col(row, 'fat_g', 'fat', 'total_fat', 'fats', 'total fat'));
    const fibre = toFloat(col(row, 'fibre_g', 'fiber', 'fibre', 'dietary_fiber', 'dietary fiber',
                               'dietary_fibre'));
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
// Typical columns: food_name (or name), energy, protein, carbohydrate, fat, fibre
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
    const name = col(row, 'food_name', 'name', 'food', 'item', 'dish',
                       'food_name', 'item_name', 'dish_name');
    if (!name) continue;

    const cal   = toFloat(col(row, 'energy', 'calories', 'kcal', 'energy_kcal', 'cal'));
    const prot  = toFloat(col(row, 'protein', 'protein_g', 'proteins'));
    const carb  = toFloat(col(row, 'carbohydrate', 'carbohydrates', 'carbs',
                               'carbohydrate_g', 'cho'));
    const fat   = toFloat(col(row, 'fat', 'fat_g', 'total_fat', 'fats'));
    const fibre = toFloat(col(row, 'fibre', 'fiber', 'fibre_g', 'dietary_fiber', 'dietary_fibre'));

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
// This dataset contains recipe names + ingredients but typically no macros.
// Even without macros, recipe names improve search matching.
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
    const name = col(row, 'recipe_name', 'name', 'translated_recipe_name',
                       'recipe name', 'dish', 'food_name', 'recipename');
    if (!name) continue;

    const cal   = toFloat(col(row, 'calories', 'energy', 'kcal', 'energy_kcal'));
    const prot  = toFloat(col(row, 'protein', 'protein_g'));
    const carb  = toFloat(col(row, 'carbs', 'carbohydrates', 'carbohydrate', 'total_carbs'));
    const fat   = toFloat(col(row, 'fat', 'fat_g', 'total_fat'));
    const fibre = toFloat(col(row, 'fibre', 'fiber', 'fibre_g', 'dietary_fiber'));

    if (cal > 0 || prot > 0) withMacros++;

    // Build aliases from cuisine / diet columns for better fuzzy matching
    const cuisine = col(row, 'cuisine', 'region', 'course', 'category');
    const diet    = col(row, 'diet', 'veg_or_nonveg', 'type', 'dietary_preference');
    const aliases = [cuisine, diet].filter(s => s && s.length < 40).join(',') || null;

    // Even name-only rows (no macros) are useful if cal+prot are 0 —
    // they still expand the search name index.
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
