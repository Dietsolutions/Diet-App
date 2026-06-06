/**
 * Seed Indian food databases from:
 *  1. INDB.xlsx  — 1,014 Indian recipes (ICMR-NIN IFCT 2017 via INDB project)
 *     Source: github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-
 *     Columns (per 100g): food_code, food_name, energy_kcal, protein_g, carb_g, fat_g, fibre_g
 *     Also has: servings_unit, unit_serving_energy_kcal (used to compute serving grams)
 *     NOTE: the xlsx file is not bundled in the repo (license + size); the seed
 *     script skips with a warning if the file is missing at the expected path.
 *     The xlsx parser dependency was removed (no patched version available);
 *     INDB recipes are not in the production data path.
 *
 *  2. @ifct2017/compositions/index.csv — 542 raw Indian ingredients (ICMR-NIN IFCT 2017)
 *     Energy is in kJ at column index 7 — divide by 4.184 to get kcal.
 *     Column indices: 0=code, 1=name, 3=local_names, 4=group, 7=energy_kj,
 *                     15=fat_g, 19=fibre_g, 21=carb_g, 23=protein_g
 *
 * Run: npx tsx src/scripts/seedIndianFoodDatabases.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// ── helpers ────────────────────────────────────────────────────────────────

function r1(n: number): number { return Math.round(n * 10) / 10; }
function r0(n: number): number { return Math.round(n); }

function parseNum(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return isNaN(n) ? 0 : n;
}

// Parse one CSV row respecting double-quote quoting (values may contain commas inside quotes)
function parseCSVRow(line: string): string[] {
  const cols: string[] = [];
  let inQuote = false;
  let current = '';
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; }
    else if (ch === ',' && !inQuote) { cols.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  cols.push(current.trim());
  return cols;
}

// ── Step 1: Seed INDB recipes from XLSX ───────────────────────────────────

async function seedINDB(): Promise<number> {
  const xlsxPath = path.join(__dirname, '../data/indian-food/INDB.xlsx');

  if (!fs.existsSync(xlsxPath)) {
    console.warn('[INDB] INDB.xlsx not found at', xlsxPath, '— skipping INDB seed.');
    return 0;
  }

  console.warn('[INDB] INDB.xlsx present but xlsx dependency was removed.');
  console.warn('[INDB] To re-enable INDB seeding, add xlsx@>=0.20.3 (or another parser)');
  console.warn('[INDB] and re-introduce the read step here. Skipping.');
  return 0;
}

// ── Step 2: Seed ICMR-NIN raw ingredients from @ifct2017/compositions ──────

async function seedICMRNIN(): Promise<number> {
  const csvPath = path.join(
    __dirname,
    '../../node_modules/@ifct2017/compositions/index.csv'
  );

  if (!fs.existsSync(csvPath)) {
    console.warn('[ICMR-NIN] compositions CSV not found at', csvPath);
    return 0;
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines   = content.split('\n').filter(l => l.trim());
  console.log(`[ICMR-NIN] ${lines.length - 1} rows in compositions CSV`);

  // Column indices (confirmed from header inspection):
  // 0=code, 1=name, 2=scientific, 3=local_names, 4=group,
  // 7=energy_kj, 15=fat_g, 19=fibre_g, 21=carb_g, 23=protein_g
  const COL_CODE  = 0;
  const COL_NAME  = 1;
  const COL_LANG  = 3;   // local/regional names
  const COL_GROUP = 4;
  const COL_ENKJ  = 7;   // energy in kJ — divide by 4.184
  const COL_FAT   = 15;
  const COL_FIBRE = 19;
  const COL_CARB  = 21;
  const COL_PROT  = 23;

  const records: Parameters<typeof prisma.indianIngredient.upsert>[0]['create'][] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVRow(lines[i]);
    if (cols.length < 24) continue;

    const code  = cols[COL_CODE].replace(/"/g, '').trim();
    const name  = cols[COL_NAME].replace(/"/g, '').trim();
    if (!code || !name) continue;

    // Energy is in kJ — convert to kcal
    const energyKj = parseNum(cols[COL_ENKJ].replace(/"/g, ''));
    const cal100   = r0(energyKj / 4.184);
    const prot     = r1(parseNum(cols[COL_PROT].replace(/"/g, '')));
    const carb     = r1(parseNum(cols[COL_CARB].replace(/"/g, '')));
    const fat      = r1(parseNum(cols[COL_FAT].replace(/"/g, '')));
    const fibre    = r1(parseNum(cols[COL_FIBRE].replace(/"/g, '')));

    // Skip rows with all-zero macros
    if (cal100 === 0 && prot === 0 && carb === 0 && fat === 0) continue;

    // Extract local names as aliases (format: "H. Ramdana; Kan. Danthu beeja; ...")
    const rawLang = cols[COL_LANG].replace(/"/g, '').trim();
    // Strip language prefixes like "H.", "Kan.", etc. and keep just the names
    const aliases = rawLang
      ? rawLang
          .split(';')
          .map(s => s.trim().replace(/^[A-Z][a-z]?\.\s*/, ''))
          .filter(s => s.length > 0 && s.length < 60)
          .slice(0, 8)
          .join(', ')
      : null;

    const foodGroup = cols[COL_GROUP].replace(/"/g, '').trim() || null;

    records.push({
      foodCode:        code,
      foodName:        name,
      foodGroup,
      aliases:         aliases || null,
      caloriesPer100g: cal100,
      proteinPer100g:  prot,
      carbsPer100g:    carb,
      fatPer100g:      fat,
      fibrePer100g:    fibre,
      source:          'ICMR-NIN',
    });
  }

  // Upsert in batches of 100
  let count = 0;
  for (let i = 0; i < records.length; i += 100) {
    const batch = records.slice(i, i + 100);
    await Promise.all(
      batch.map(r =>
        prisma.indianIngredient.upsert({
          where:  { foodCode: r.foodCode },
          create: r,
          update: r,
        })
      )
    );
    count += batch.length;
    process.stdout.write(`\r[ICMR-NIN] Seeded ${count} / ${records.length} ingredients`);
  }
  console.log(`\n[ICMR-NIN] Done.`);
  return count;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Indian Food Database Seeder ===\n');

  const indbCount  = await seedINDB();
  const icmrCount  = await seedICMRNIN();

  console.log('\n=== Seeding complete ===');
  console.log(`  INDB recipes:           ${indbCount}`);
  console.log(`  ICMR-NIN ingredients:   ${icmrCount}`);
  console.log(`  Total:                  ${indbCount + icmrCount}`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
