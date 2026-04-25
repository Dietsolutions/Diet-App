/**
 * shoppingListUtils.ts
 *
 * Shared utility for regenerating the AI shopping list after any meal change.
 * Fires in background (callers should not await) so API responses stay fast.
 *
 * Preserves:
 *   - Bought states — items with the same name stay ticked across regeneration
 *   - peopleCount   — the multiplier the user set is never reset
 */

import prisma from '../lib/prisma';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function regenerateShoppingList(
  userId: string,
  mealPlanId: string
): Promise<void> {
  try {
    // ── 1. Load existing list for bought-state + peopleCount preservation ──
    const existingList = await prisma.generatedShoppingList.findFirst({
      where: { userId, mealPlanId },
      orderBy: { createdAt: 'desc' },
    });

    let existingCategories: any[] = [];
    try {
      existingCategories = existingList
        ? JSON.parse(existingList.categories || '[]')
        : [];
    } catch { /* leave empty */ }

    // Build name → was-bought map from ShoppingItem records (the source of truth)
    const existingDbItems = await prisma.shoppingItem.findMany({
      where: { userId, itemKey: { startsWith: 'gen-' } },
    });

    const boughtByName = new Map<string, boolean>();
    existingCategories.forEach((cat: any, catIdx: number) => {
      (cat.items || []).forEach((item: any, itemIdx: number) => {
        const key = `gen-${catIdx}-${itemIdx}`;
        const dbItem = existingDbItems.find(d => d.itemKey === key);
        if (dbItem?.bought) {
          boughtByName.set(String(item.name).toLowerCase(), true);
        }
      });
    });

    // ── 2. Fetch all MealPlanDay records ──
    const days = await prisma.mealPlanDay.findMany({
      where: { mealPlanId },
      orderBy: { dayIndex: 'asc' },
    });

    // ── 3. Collect all ingredients from every meal ──
    const allIngredients: string[] = [];
    days.forEach(day => {
      try {
        const meals: any[] = JSON.parse(day.meals || '[]');
        meals.forEach(meal => {
          if (Array.isArray(meal.ingredients)) {
            allIngredients.push(...meal.ingredients);
          }
        });
      } catch { /* skip malformed day */ }
    });

    if (allIngredients.length === 0) return; // nothing to consolidate

    // ── 4. Ask Claude to consolidate and categorise ──
    const prompt = `You are a nutritionist creating a shopping list.
Below are all the raw ingredient strings from a ${days.length}-day meal plan.
Consolidate duplicates, aggregate quantities where possible, and organise by category.

INGREDIENTS:
${allIngredients.join('\n')}

Respond ONLY with valid JSON — no markdown, no explanation:
{
  "categories": [
    {
      "category": "Category Name",
      "items": [
        { "name": "item name", "quantity": "quantity string", "unit": "unit string" }
      ]
    }
  ]
}

Use only these categories (skip empty ones):
Proteins, Dairy, Vegetables, Fruits, Dry Goods, Pantry & Spices, Supplements`;

    const response = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText =
      response.content[0].type === 'text' ? response.content[0].text : '';

    // Extract JSON from the response (handle possible markdown fences)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('regenerateShoppingList: no JSON found in Claude response');
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.categories)) return;

    // ── 5. Save the new shopping list (findFirst + create / update) ──
    // GeneratedShoppingList has no @@unique on mealPlanId — use id for update.
    const newCategoriesJson = JSON.stringify(parsed.categories);

    if (existingList) {
      await prisma.generatedShoppingList.update({
        where: { id: existingList.id },
        data: { categories: newCategoriesJson },
      });
    } else {
      await prisma.generatedShoppingList.create({
        data: {
          userId,
          mealPlanId,
          categories: newCategoriesJson,
          peopleCount: 1,
        },
      });
    }

    // ── 6. Preserve bought states ──
    // Delete old gen-* ShoppingItem records then recreate for items that were bought.
    await prisma.shoppingItem.deleteMany({
      where: { userId, itemKey: { startsWith: 'gen-' } },
    });

    const toCreate: { userId: string; itemKey: string; bought: boolean }[] = [];
    parsed.categories.forEach((cat: any, catIdx: number) => {
      (cat.items || []).forEach((item: any, itemIdx: number) => {
        if (boughtByName.get(String(item.name).toLowerCase())) {
          toCreate.push({
            userId,
            itemKey: `gen-${catIdx}-${itemIdx}`,
            bought: true,
          });
        }
      });
    });

    if (toCreate.length > 0) {
      await prisma.shoppingItem.createMany({ data: toCreate });
    }

    console.log(
      `regenerateShoppingList: done for mealPlanId=${mealPlanId} ` +
      `(${parsed.categories.length} categories, ${toCreate.length} bought items restored)`
    );
  } catch (err) {
    // Non-fatal — shopping regen is always background
    console.error(
      'regenerateShoppingList error:',
      err instanceof Error ? err.message : String(err)
    );
  }
}
