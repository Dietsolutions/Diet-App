import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { SHOPPING_LIST } from '../data/shoppingList';
import { perUserLimiter } from '../middleware/perUserLimiter';

const router = Router();

// GET /api/shopping
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    // Check for AI-generated shopping list first
    const activePlan = await prisma.mealPlan.findFirst({
      where: { userId, isActive: true }
    });

    if (activePlan) {
      const genList = await prisma.generatedShoppingList.findFirst({
        where: { userId, mealPlanId: activePlan.id },
        orderBy: { createdAt: 'desc' }
      });

      if (genList) {
        const categories = JSON.parse(genList.categories);
        const dbItems = await prisma.shoppingItem.findMany({ where: { userId }, take: 500 });
        const dbItemMap = new Map(dbItems.map(d => [d.itemKey, d]));

        const enrichedCategories = categories.map((cat: any, catIdx: number) => ({
          name: cat.category || cat.name,
          items: (cat.items || []).map((item: any, itemIdx: number) => {
            const key = `gen-${catIdx}-${itemIdx}`;
            const dbItem = dbItemMap.get(key);
            return {
              key,
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              bought: dbItem?.bought ?? false
            };
          })
        }));

        const totalItems = enrichedCategories.reduce((sum: number, cat: any) => sum + cat.items.length, 0);
        const boughtItems = enrichedCategories.reduce((sum: number, cat: any) =>
          sum + cat.items.filter((i: any) => i.bought).length, 0);

        res.json({
          categories: enrichedCategories,
          totalItems,
          boughtItems,
          isGenerated: true,
          peopleCount: genList.peopleCount
        });
        return;
      }
    }

    // Fallback to hardcoded shopping list
    const dbItems = await prisma.shoppingItem.findMany({ where: { userId }, take: 500 });
    const dbItemMap = new Map(dbItems.map(d => [d.itemKey, d]));

    const categories = SHOPPING_LIST.map((cat, catIdx) => ({
      name: cat.name,
      items: cat.items.map((itemName, itemIdx) => {
        const key = `${catIdx}-${itemIdx}`;
        const dbItem = dbItemMap.get(key);
        return { key, name: itemName, bought: dbItem?.bought ?? false };
      })
    }));

    const totalItems = SHOPPING_LIST.reduce((sum, cat) => sum + cat.items.length, 0);
    const boughtItems = dbItems.filter(i => i.bought).length;

    res.json({ categories, totalItems, boughtItems, isGenerated: false, peopleCount: 1 });
  } catch (err) {
    console.error('Shopping fetch error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error', message: 'Failed to load shopping list.' });
  }
});

// POST /api/shopping/:key/toggle
router.post('/:key/toggle', requireAuth, perUserLimiter({ windowMs: 60_000, max: 60, keyPrefix: 'shopping-toggle' }), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { key } = req.params;

    // Validate key format: allow alphanumeric, hyphens, underscores only (max 64 chars)
    if (!key || key.length > 64 || !/^[\w-]+$/.test(key)) {
      res.status(400).json({ error: 'Invalid item key' });
      return;
    }

    const existing = await prisma.shoppingItem.findUnique({
      where: { userId_itemKey: { userId, itemKey: key } }
    });

    let item;
    if (existing) {
      item = await prisma.shoppingItem.update({
        where: { id: existing.id },
        data: { bought: !existing.bought }
      });
    } else {
      item = await prisma.shoppingItem.create({
        data: { userId, itemKey: key, bought: true }
      });
    }

    res.json({ key, bought: item.bought });
  } catch (err) {
    console.error('Shopping toggle error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error', message: 'Failed to toggle item.' });
  }
});

// DELETE /api/shopping/reset
router.delete('/reset', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    await prisma.shoppingItem.updateMany({
      where: { userId },
      data: { bought: false }
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Shopping reset error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error', message: 'Failed to reset shopping list.' });
  }
});

// POST /api/shopping/people-count
router.post('/people-count', requireAuth, perUserLimiter({ windowMs: 60_000, max: 10, keyPrefix: 'shopping-people-count' }), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { peopleCount } = req.body;

    if (typeof peopleCount !== 'number' || peopleCount < 1 || peopleCount > 20 || !Number.isInteger(peopleCount)) {
      res.status(400).json({ error: 'peopleCount must be an integer between 1 and 20' });
      return;
    }

    const activePlan = await prisma.mealPlan.findFirst({
      where: { userId, isActive: true }
    });

    if (!activePlan) {
      res.status(400).json({ error: 'No active meal plan' });
      return;
    }

    const genList = await prisma.generatedShoppingList.findFirst({
      where: { userId, mealPlanId: activePlan.id },
      orderBy: { createdAt: 'desc' }
    });

    if (genList) {
      await prisma.generatedShoppingList.update({
        where: { id: genList.id },
        data: { peopleCount: peopleCount || 1 }
      });
    }

    res.json({ ok: true, peopleCount });
  } catch (err) {
    console.error('Shopping people-count error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error', message: 'Failed to update people count.' });
  }
});

export default router;
