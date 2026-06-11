// Browse Recipes API — list/filter/sort/search, detail, like toggle, share,
// and save-to-plan. All endpoints behind auth except the public share view.

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// ── Sort whitelist ────────────────────────────────────────────────────────────
const SORT_FIELDS: Record<string, string> = {
  likes:     'likeCount',
  popular:   'sourceCount',
  calories:  'calories',
  protein:   'protein',
  fibre:     'fibre',
  newest:    'createdAt',
};

function numParam(v: unknown): number | undefined {
  if (typeof v !== 'string' || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// ── GET /api/recipes — paginated list with filter/sort/search ────────────────
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = req.query;

    const where: any = {};
    if (typeof q.mealType === 'string' && q.mealType !== 'all') where.mealType = q.mealType;
    if (typeof q.dietType === 'string' && q.dietType !== 'all') where.dietType = q.dietType;
    if (typeof q.cuisineType === 'string' && q.cuisineType !== 'all') where.cuisineType = q.cuisineType;

    const ranges: Array<[string, string, string]> = [
      ['calories', 'minCal',     'maxCal'],
      ['protein',  'minProtein', 'maxProtein'],
      ['carbs',    'minCarbs',   'maxCarbs'],
      ['fat',      'minFat',     'maxFat'],
      ['fibre',    'minFibre',   'maxFibre'],
    ];
    for (const [field, minKey, maxKey] of ranges) {
      const min = numParam(q[minKey]);
      const max = numParam(q[maxKey]);
      if (min !== undefined || max !== undefined) {
        where[field] = {
          ...(min !== undefined ? { gte: min } : {}),
          ...(max !== undefined ? { lte: max } : {}),
        };
      }
    }

    if (typeof q.q === 'string' && q.q.trim()) {
      const term = q.q.trim();
      where.OR = [
        { name:        { contains: term, mode: 'insensitive' } },
        { ingredients: { contains: term, mode: 'insensitive' } },
      ];
    }

    const sortField = SORT_FIELDS[String(q.sortBy ?? 'likes')] ?? 'likeCount';
    const sortDir   = q.sortDir === 'asc' ? 'asc' : 'desc';

    const page     = Math.max(1, numParam(q.page) ?? 1);
    const pageSize = Math.min(50, Math.max(1, numParam(q.pageSize) ?? 20));

    const [total, recipes] = await Promise.all([
      prisma.recipe.count({ where }),
      prisma.recipe.findMany({
        where,
        orderBy: [{ [sortField]: sortDir }, { id: 'asc' }],   // id tiebreak → stable pages
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // likedByMe for just this page
    const likes = await prisma.recipeLike.findMany({
      where: { userId: req.userId!, recipeId: { in: recipes.map(r => r.id) } },
      select: { recipeId: true },
    });
    const likedIds = new Set(likes.map(l => l.recipeId));

    res.json({
      total,
      page,
      pageSize,
      recipes: recipes.map(r => ({
        ...r,
        ingredients: JSON.parse(r.ingredients || '[]'),
        likedByMe: likedIds.has(r.id),
      })),
    });
  } catch (err: any) {
    console.error('[Recipes] List failed:', err.message);
    res.status(500).json({ error: 'Failed to load recipes' });
  }
});

// ── GET /api/recipes/:id — full detail ────────────────────────────────────────
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const recipe = await prisma.recipe.findUnique({ where: { id: req.params.id } });
    if (!recipe) { res.status(404).json({ error: 'Recipe not found' }); return; }

    const liked = await prisma.recipeLike.findUnique({
      where: { userId_recipeId: { userId: req.userId!, recipeId: recipe.id } },
    });

    res.json({
      ...recipe,
      ingredients: JSON.parse(recipe.ingredients || '[]'),
      likedByMe: !!liked,
    });
  } catch (err: any) {
    console.error('[Recipes] Detail failed:', err.message);
    res.status(500).json({ error: 'Failed to load recipe' });
  }
});

// ── POST /api/recipes/:id/like · DELETE /api/recipes/:id/like ────────────────
// likeCount stays consistent because both writes happen in one transaction
// and the unique constraint makes double-likes impossible.
router.post('/:id/like', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const recipeId = req.params.id;
    await prisma.$transaction(async (tx) => {
      await tx.recipeLike.create({ data: { userId: req.userId!, recipeId } });
      await tx.recipe.update({ where: { id: recipeId }, data: { likeCount: { increment: 1 } } });
    });
    res.json({ liked: true });
  } catch (err: any) {
    if (err?.code === 'P2002') { res.json({ liked: true }); return; }       // already liked
    if (err?.code === 'P2003' || err?.code === 'P2025') { res.status(404).json({ error: 'Recipe not found' }); return; }
    console.error('[Recipes] Like failed:', err.message);
    res.status(500).json({ error: 'Failed to like recipe' });
  }
});

router.delete('/:id/like', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const recipeId = req.params.id;
    await prisma.$transaction(async (tx) => {
      await tx.recipeLike.delete({
        where: { userId_recipeId: { userId: req.userId!, recipeId } },
      });
      await tx.recipe.update({ where: { id: recipeId }, data: { likeCount: { decrement: 1 } } });
    });
    res.json({ liked: false });
  } catch (err: any) {
    if (err?.code === 'P2025') { res.json({ liked: false }); return; }      // wasn't liked
    console.error('[Recipes] Unlike failed:', err.message);
    res.status(500).json({ error: 'Failed to unlike recipe' });
  }
});

// ── GET /api/recipes/:id/share — shareable payload ───────────────────────────
router.get('/:id/share', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const recipe = await prisma.recipe.findUnique({ where: { id: req.params.id } });
    if (!recipe) { res.status(404).json({ error: 'Recipe not found' }); return; }

    const base = (process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const url  = `${base}/recipe/${recipe.id}`;
    const text =
      `${recipe.name} — ${Math.round(recipe.calories)} kcal · ` +
      `${Math.round(recipe.protein)}g protein · ${Math.round(recipe.carbs)}g carbs · ` +
      `${Math.round(recipe.fat)}g fat\n${url}`;

    res.json({ url, text, title: recipe.name });
  } catch (err: any) {
    console.error('[Recipes] Share failed:', err.message);
    res.status(500).json({ error: 'Failed to build share link' });
  }
});

// ── POST /api/recipes/:id/save-to-plan ───────────────────────────────────────
// Replaces a specific day/meal slot in one of the user's own plans with this
// recipe. Skips CN validation by design: library recipes already passed the
// quality filter, and re-validating could silently change the macros the user
// just previewed. Day totals are recomputed from the final meal set.
router.post('/:id/save-to-plan', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { mealPlanId, dayIndex, mealIndex } = req.body ?? {};
    if (typeof mealPlanId !== 'string' || !Number.isInteger(dayIndex) || !Number.isInteger(mealIndex)) {
      res.status(400).json({ error: 'mealPlanId, dayIndex and mealIndex are required' });
      return;
    }

    const recipe = await prisma.recipe.findUnique({ where: { id: req.params.id } });
    if (!recipe) { res.status(404).json({ error: 'Recipe not found' }); return; }

    // Ownership check — never write to another user's plan
    const plan = await prisma.mealPlan.findFirst({
      where: { id: mealPlanId, userId: req.userId! },
      select: { id: true },
    });
    if (!plan) { res.status(404).json({ error: 'Plan not found' }); return; }

    const day = await prisma.mealPlanDay.findFirst({
      where: { mealPlanId, dayIndex },
    });
    if (!day) { res.status(404).json({ error: 'Day not found in plan' }); return; }

    let meals: any[];
    try { meals = JSON.parse(day.meals || '[]'); } catch { meals = []; }
    if (!Array.isArray(meals) || mealIndex < 0 || mealIndex >= meals.length) {
      res.status(400).json({ error: `Meal slot ${mealIndex} not found in day ${dayIndex}` });
      return;
    }

    const slot = meals[mealIndex] ?? {};

    // Replacement keeps the slot's structural identity: mealIndex (the
    // vlog↔plan join key — must always be present) and the slot's canonical
    // type, so a breakfast recipe saved into a dinner slot stays "dinner".
    meals[mealIndex] = {
      mealIndex,
      type:        slot.type ?? recipe.mealType,
      time:        slot.time ?? recipe.time ?? '',
      name:        recipe.name,
      description: recipe.description,
      ingredients: JSON.parse(recipe.ingredients || '[]'),
      calories:    recipe.calories,
      protein:     recipe.protein,
      carbs:       recipe.carbs,
      fat:         recipe.fat,
      fibre:       recipe.fibre,
      ...(recipe.prepTime ? { prepTime: recipe.prepTime } : {}),
      savedFromRecipeId: recipe.id,
    };

    const sum = (field: string) => Math.round(
      meals.reduce((s, m) => s + (Number(m?.[field]) || 0), 0) * 10,
    ) / 10;

    const updated = await prisma.mealPlanDay.update({
      where: { id: day.id },
      data: {
        meals:         JSON.stringify(meals),
        totalCalories: sum('calories'),
        totalProtein:  sum('protein'),
        totalCarbs:    sum('carbs'),
        totalFat:      sum('fat'),
        totalFibre:    sum('fibre'),
      },
    });

    res.json({
      success: true,
      day: { ...updated, meals },
      typeMismatch: recipe.mealType !== (slot.type ?? recipe.mealType),
    });
  } catch (err: any) {
    console.error('[Recipes] Save-to-plan failed:', err.message);
    res.status(500).json({ error: 'Failed to save recipe to plan' });
  }
});

export default router;

// ── Public read-only share view (no auth) ─────────────────────────────────────
// Mounted at app level without the /api prefix → GET /recipe/:id
export const publicRecipeRouter = Router();

publicRecipeRouter.get('/recipe/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const recipe = await prisma.recipe.findUnique({ where: { id: req.params.id } });
    if (!recipe) { res.status(404).send('Recipe not found'); return; }

    const ingredients: string[] = JSON.parse(recipe.ingredients || '[]');
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(recipe.name)} - Diet Plan &amp; Tracker</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0C0907; color: #F5EFE8; margin: 0; padding: 24px; }
  .card { max-width: 560px; margin: 0 auto; background: #17110C; border: 1px solid rgba(255,182,128,0.18); padding: 28px; }
  h1 { font-size: 1.5rem; margin: 0 0 4px; }
  .meta { color: rgba(245,239,232,0.55); font-size: 0.85rem; margin-bottom: 20px; text-transform: capitalize; }
  .macros { display: flex; gap: 18px; flex-wrap: wrap; margin-bottom: 22px; }
  .macros div { text-align: center; }
  .macros b { display: block; font-size: 1.25rem; color: #FF6A2A; }
  .macros span { font-size: 0.72rem; color: rgba(245,239,232,0.55); text-transform: uppercase; letter-spacing: 0.1em; }
  h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.15em; color: rgba(245,239,232,0.55); }
  ul { padding-left: 20px; line-height: 1.8; }
  .foot { margin-top: 26px; font-size: 0.8rem; color: rgba(245,239,232,0.4); }
</style>
</head>
<body>
<div class="card">
  <h1>${esc(recipe.name)}</h1>
  <div class="meta">${esc(recipe.mealType)} · ${esc(recipe.dietType.replace('_', '-'))} · ${esc(recipe.cuisineType)}${recipe.prepTime ? ' · ' + esc(recipe.prepTime) : ''}</div>
  <div class="macros">
    <div><b>${Math.round(recipe.calories)}</b><span>kcal</span></div>
    <div><b>${Math.round(recipe.protein)}g</b><span>protein</span></div>
    <div><b>${Math.round(recipe.carbs)}g</b><span>carbs</span></div>
    <div><b>${Math.round(recipe.fat)}g</b><span>fat</span></div>
    <div><b>${Math.round(recipe.fibre)}g</b><span>fibre</span></div>
  </div>
  ${recipe.description ? `<p>${esc(recipe.description)}</p>` : ''}
  <h2>Ingredients</h2>
  <ul>${ingredients.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
  <p class="foot">Shared from Diet Plan &amp; Tracker — AI meal plans with validated macros.</p>
</div>
</body>
</html>`);
  } catch (err: any) {
    console.error('[Recipes] Public view failed:', err.message);
    res.status(500).send('Something went wrong');
  }
});
