import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth, AuthRequest } from '../middleware/auth';

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

const router = Router();

// POST /api/meals/replace
router.post('/replace', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const {
      date, dayIndex, mealIndex,
      foodName, foodSource, foodExternalId,
      servingSize, servingQty, servingGrams,
      calories, proteinG, carbsG, fatG, fibreG,
      note, isAiEstimate,
    } = req.body;

    // Validate required fields
    if (!date || typeof mealIndex !== 'number' || !foodName || !foodSource) {
      res.status(400).json({ error: 'Missing required fields: date, mealIndex, foodName, foodSource' });
      return;
    }

    if (mealIndex < 0 || mealIndex > 5) {
      res.status(400).json({ error: 'Invalid mealIndex' });
      return;
    }

    // Upsert the replacement
    const replacement = await prisma.mealReplacement.upsert({
      where: {
        userId_date_mealIndex: { userId, date, mealIndex },
      },
      update: {
        dayIndex: dayIndex ?? 0,
        foodName,
        foodSource,
        foodExternalId: foodExternalId || null,
        servingSize: servingSize || '1 serving',
        servingQty: servingQty ?? 1,
        servingGrams: servingGrams ?? null,
        calories: calories ?? 0,
        proteinG: proteinG ?? 0,
        carbsG: carbsG ?? 0,
        fatG: fatG ?? 0,
        fibreG: fibreG ?? 0,
        note: note || '',
        isAiEstimate: isAiEstimate ?? false,
      },
      create: {
        userId,
        date,
        dayIndex: dayIndex ?? 0,
        mealIndex,
        foodName,
        foodSource,
        foodExternalId: foodExternalId || null,
        servingSize: servingSize || '1 serving',
        servingQty: servingQty ?? 1,
        servingGrams: servingGrams ?? null,
        calories: calories ?? 0,
        proteinG: proteinG ?? 0,
        carbsG: carbsG ?? 0,
        fatG: fatG ?? 0,
        fibreG: fibreG ?? 0,
        note: note || '',
        isAiEstimate: isAiEstimate ?? false,
      },
    });

    // Also mark the meal as eaten
    try {
      const planDates = getPlanDates();
      const dIdx = planDates.indexOf(date);
      await prisma.mealLog.upsert({
        where: { userId_date_mealIndex: { userId, date, mealIndex } },
        update: { eaten: true, loggedAt: new Date() },
        create: { userId, date, dayIndex: dIdx >= 0 ? dIdx : (dayIndex ?? 0), mealIndex, eaten: true },
      });
    } catch {
      // non-critical
    }

    // Upsert RecentFoodLog — keep latest 10 per user
    try {
      await prisma.recentFoodLog.create({
        data: {
          userId,
          foodName,
          foodSource,
          foodData: {
            foodExternalId,
            servingSize,
            servingGrams,
            calories, proteinG, carbsG, fatG, fibreG,
            isAiEstimate,
          },
          usedAt: new Date(),
        },
      });

      // Clean old entries beyond 10
      const allRecent = await prisma.recentFoodLog.findMany({
        where: { userId },
        orderBy: { usedAt: 'desc' },
        select: { id: true },
      });
      if (allRecent.length > 10) {
        const toDelete = allRecent.slice(10).map(r => r.id);
        await prisma.recentFoodLog.deleteMany({
          where: { id: { in: toDelete } },
        });
      }
    } catch {
      // non-critical
    }

    res.json({ replacement });
  } catch (err: any) {
    console.error('Meal replace error:', err?.message || err);
    res.status(500).json({ error: 'Failed to save meal replacement' });
  }
});

// GET /api/meals/replacements?date=YYYY-MM-DD
router.get('/replacements', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const date = req.query.date as string;

    if (!date) {
      res.status(400).json({ error: 'date query parameter is required' });
      return;
    }

    const replacements = await prisma.mealReplacement.findMany({
      where: { userId, date },
    });

    res.json({ replacements });
  } catch (err: any) {
    console.error('Get replacements error:', err?.message || err);
    res.status(500).json({ error: 'Failed to load replacements' });
  }
});

// GET /api/meals/replacements/week — get all replacements for current week
router.get('/replacements/week', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const dates = getPlanDates();

    const replacements = await prisma.mealReplacement.findMany({
      where: { userId, date: { in: dates } },
    });

    res.json({ replacements });
  } catch (err: any) {
    console.error('Get week replacements error:', err?.message || err);
    res.status(500).json({ error: 'Failed to load week replacements' });
  }
});

// DELETE /api/meals/replace/:id
router.delete('/replace/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.mealReplacement.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      res.status(404).json({ error: 'Replacement not found' });
      return;
    }

    await prisma.mealReplacement.delete({ where: { id } });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete replacement error:', err?.message || err);
    res.status(500).json({ error: 'Failed to delete replacement' });
  }
});

// ── Additional Meal Logging ────────────────────────────────────────────────

const VALID_MEAL_CATEGORIES = ['breakfast', 'brunch', 'lunch', 'evening_snack', 'dinner', 'other'] as const;

// GET /api/meals/additional?date=YYYY-MM-DD
router.get('/additional', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const date = req.query.date as string;
    if (!date) { res.status(400).json({ error: 'date query parameter is required' }); return; }

    const additionalMeals = await prisma.additionalMealLog.findMany({
      where: { userId, date },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ additionalMeals });
  } catch (err: any) {
    console.error('Get additional meals error:', err?.message || err);
    res.status(500).json({ error: 'Failed to load additional meals' });
  }
});

// POST /api/meals/additional
router.post('/additional', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const {
      date, mealCategory, mealTime,
      foodName, foodSource, foodExternalId,
      servingSize, servingQty, servingGrams,
      calories, proteinG, carbsG, fatG, fibreG,
      note, isAiEstimate,
    } = req.body;

    // Validate required fields
    if (!date || !mealCategory || !foodName || !foodSource) {
      res.status(400).json({ error: 'Missing required fields: date, mealCategory, foodName, foodSource' }); return;
    }
    if (!VALID_MEAL_CATEGORIES.includes(mealCategory)) {
      res.status(400).json({ error: `Invalid mealCategory. Must be one of: ${VALID_MEAL_CATEGORIES.join(', ')}` }); return;
    }
    const today = new Date().toISOString().split('T')[0];
    if (date > today) {
      res.status(400).json({ error: 'Cannot log meals for future dates' }); return;
    }
    if (typeof servingQty !== 'number' || servingQty <= 0) {
      res.status(400).json({ error: 'servingQty must be a positive number' }); return;
    }
    if (typeof calories === 'number' && calories < 0) {
      res.status(400).json({ error: 'calories must be >= 0' }); return;
    }

    const additionalMeal = await prisma.additionalMealLog.create({
      data: {
        userId,
        date,
        mealCategory,
        mealTime: mealTime || null,
        foodName,
        foodSource,
        foodExternalId: foodExternalId || null,
        servingSize: servingSize || '1 serving',
        servingQty,
        servingGrams: servingGrams ?? null,
        calories: calories ?? 0,
        proteinG: proteinG ?? 0,
        carbsG: carbsG ?? 0,
        fatG: fatG ?? 0,
        fibreG: fibreG ?? 0,
        note: note || '',
        isAiEstimate: isAiEstimate ?? false,
      },
    });

    // Save to RecentFoodLog (non-critical)
    try {
      await prisma.recentFoodLog.create({
        data: {
          userId,
          foodName,
          foodSource,
          foodData: { foodExternalId, servingSize, servingGrams, calories, proteinG, carbsG, fatG, fibreG, isAiEstimate },
          usedAt: new Date(),
        },
      });
      const allRecent = await prisma.recentFoodLog.findMany({
        where: { userId }, orderBy: { usedAt: 'desc' }, select: { id: true },
      });
      if (allRecent.length > 10) {
        await prisma.recentFoodLog.deleteMany({ where: { id: { in: allRecent.slice(10).map(r => r.id) } } });
      }
    } catch { /* non-critical */ }

    res.json({ additionalMeal });
  } catch (err: any) {
    console.error('Add additional meal error:', err?.message || err);
    res.status(500).json({ error: 'Failed to log additional meal' });
  }
});

// DELETE /api/meals/additional/:id
router.delete('/additional/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const existing = await prisma.additionalMealLog.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      res.status(404).json({ error: 'Additional meal not found' }); return;
    }

    await prisma.additionalMealLog.delete({ where: { id } });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete additional meal error:', err?.message || err);
    res.status(500).json({ error: 'Failed to delete additional meal' });
  }
});

// PATCH /api/meals/additional/:id
router.patch('/additional/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { servingQty, note, mealCategory, mealTime } = req.body;

    const existing = await prisma.additionalMealLog.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      res.status(404).json({ error: 'Additional meal not found' }); return;
    }

    if (mealCategory !== undefined && !VALID_MEAL_CATEGORIES.includes(mealCategory)) {
      res.status(400).json({ error: 'Invalid mealCategory' }); return;
    }

    const updated = await prisma.additionalMealLog.update({
      where: { id },
      data: {
        ...(servingQty !== undefined && { servingQty }),
        ...(note !== undefined && { note }),
        ...(mealCategory !== undefined && { mealCategory }),
        ...(mealTime !== undefined && { mealTime }),
      },
    });

    res.json({ additionalMeal: updated });
  } catch (err: any) {
    console.error('Update additional meal error:', err?.message || err);
    res.status(500).json({ error: 'Failed to update additional meal' });
  }
});

// ── Cooking Instructions ──────────────────────────────────────────────────

// GET /api/meals/instructions?mealPlanId=&dayIndex=&mealIndex=
router.get('/instructions', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { mealPlanId, dayIndex, mealIndex } = req.query as Record<string, string>;
    if (!mealPlanId || dayIndex === undefined || mealIndex === undefined) {
      res.status(400).json({ error: 'mealPlanId, dayIndex, mealIndex are required' }); return;
    }
    const instructions = await prisma.mealCookingInstructions.findUnique({
      where: { userId_mealPlanId_dayIndex_mealIndex: { userId, mealPlanId, dayIndex: Number(dayIndex), mealIndex: Number(mealIndex) } },
    });
    res.json({ instructions: instructions || null });
  } catch (err: any) {
    console.error('Get cooking instructions error:', err?.message || err);
    res.status(500).json({ error: 'Failed to load instructions' });
  }
});

// POST /api/meals/instructions/generate
router.post('/instructions/generate', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { mealPlanId, dayIndex, mealIndex } = req.body;
    if (!mealPlanId || typeof dayIndex !== 'number' || typeof mealIndex !== 'number') {
      res.status(400).json({ error: 'mealPlanId, dayIndex, mealIndex are required' }); return;
    }

    // Rate limit: 20 text generations per user per day
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const todayCount = await prisma.mealCookingInstructions.count({ where: { userId, generatedAt: { gte: dayStart } } });
    if (todayCount >= 20) { res.status(429).json({ error: 'Daily generation limit reached (20/day). Try again tomorrow.' }); return; }

    // Fetch the meal from the plan
    const planDay = await prisma.mealPlanDay.findFirst({ where: { mealPlanId, dayIndex } });
    if (!planDay) { res.status(404).json({ error: 'Plan day not found' }); return; }

    const mealsArr = JSON.parse(planDay.meals as string) as any[];
    const meal = mealsArr[mealIndex];
    if (!meal) { res.status(404).json({ error: 'Meal not found at that index' }); return; }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) { res.status(500).json({ error: 'AI service not configured' }); return; }
    const client = new Anthropic({ apiKey });

    const ingredientsList = Array.isArray(meal.ingredients) ? meal.ingredients.join('\n') : 'Based on the meal name and description';

    const prompt = `You are a professional chef and culinary instructor. Generate extremely detailed, beginner-friendly cooking instructions for the following meal.

MEAL: ${meal.name}
DESCRIPTION: ${meal.description || ''}
MEAL TYPE: ${meal.type || 'Meal'} (${meal.time || ''})
SERVINGS: 1 person

KNOWN INGREDIENTS (from meal plan):
${ingredientsList}

REQUIREMENTS:
1. List ALL ingredients with precise quantities for 1 serving
   - Use standard measurements (grams, ml, tsp, tbsp, cups)
   - Include preparation notes on each ingredient (e.g. "finely chopped", "at room temperature")
   - Group ingredients into: Main ingredients, Spices & seasonings, For cooking

2. Step-by-step instructions must be:
   - Extremely detailed — assume the cook has never made this before
   - Each step must describe exactly what to do, what it should look like, smell like, or feel like when done correctly
   - Include temperature settings, pan types, heat levels
   - Include timing for each step
   - Warn about common mistakes at critical steps
   - Mention what "done" looks like for each step

3. Include:
   - Prep time, cook time, total time
   - 3-5 pro cooking tips specific to this dish
   - One substitution suggestion for the main protein or key ingredient

Respond ONLY with valid JSON matching this exact structure:
{
  "mealName": string,
  "prepTime": string,
  "cookTime": string,
  "totalTime": string,
  "servings": 1,
  "ingredients": [
    { "group": string, "name": string, "quantity": string, "unit": string, "notes": string }
  ],
  "steps": [
    { "stepNumber": number, "title": string, "instruction": string, "duration": string, "tip": string }
  ],
  "tips": string[],
  "substitution": string
}`;

    const aiRes = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = aiRes.content[0].type === 'text' ? aiRes.content[0].text : '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) { res.status(500).json({ error: 'AI returned invalid format. Please try again.' }); return; }
    const parsed = JSON.parse(jsonMatch[0]);

    // Upsert instructions
    const instructions = await prisma.mealCookingInstructions.upsert({
      where: { userId_mealPlanId_dayIndex_mealIndex: { userId, mealPlanId, dayIndex, mealIndex } },
      update: {
        mealName: parsed.mealName || meal.name,
        ingredients: parsed.ingredients || [],
        steps: parsed.steps || [],
        totalTime: parsed.totalTime || '',
        prepTime: parsed.prepTime || '',
        cookTime: parsed.cookTime || '',
        servings: parsed.servings || 1,
        tips: parsed.tips || [],
        substitution: parsed.substitution || null,
        audioScript: null,
        audioDuration: null,
        audioGeneratedAt: null,
        generatedAt: new Date(),
      },
      create: {
        userId,
        mealPlanId,
        dayIndex,
        mealIndex,
        mealName: parsed.mealName || meal.name,
        ingredients: parsed.ingredients || [],
        steps: parsed.steps || [],
        totalTime: parsed.totalTime || '',
        prepTime: parsed.prepTime || '',
        cookTime: parsed.cookTime || '',
        servings: parsed.servings || 1,
        tips: parsed.tips || [],
        substitution: parsed.substitution || null,
      },
    });

    res.json({ instructions });
  } catch (err: any) {
    console.error('Generate cooking instructions error:', err?.message || err);
    res.status(500).json({ error: 'Failed to generate instructions. Please try again.' });
  }
});

// POST /api/meals/instructions/generate-audio
// Builds a speech-friendly script from existing instructions and stores it.
// The frontend plays it using the Web Speech API (no file storage needed).
router.post('/instructions/generate-audio', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { mealPlanId, dayIndex, mealIndex } = req.body;
    if (!mealPlanId || typeof dayIndex !== 'number' || typeof mealIndex !== 'number') {
      res.status(400).json({ error: 'mealPlanId, dayIndex, mealIndex are required' }); return;
    }

    const existing = await prisma.mealCookingInstructions.findUnique({
      where: { userId_mealPlanId_dayIndex_mealIndex: { userId, mealPlanId, dayIndex, mealIndex } },
    });
    if (!existing) { res.status(404).json({ error: 'Generate text instructions first before creating audio.' }); return; }

    // Rate limit: 10 audio scripts per user per day
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const audioCount = await prisma.mealCookingInstructions.count({
      where: { userId, audioGeneratedAt: { gte: dayStart } },
    });
    if (audioCount >= 10) { res.status(429).json({ error: 'Daily audio limit reached (10/day). Try again tomorrow.' }); return; }

    // Build the speech script
    const ingredients = existing.ingredients as any[];
    const steps = existing.steps as any[];
    const lines: string[] = [];

    lines.push(`Let's cook ${existing.mealName}.`);
    lines.push(`This will take about ${existing.totalTime} — ${existing.prepTime} to prep and ${existing.cookTime} to cook.`);
    lines.push('');
    lines.push("Here's what you'll need.");

    const groups = [...new Set(ingredients.map((i: any) => i.group))];
    groups.forEach((group) => {
      lines.push(`${group}:`);
      ingredients.filter((i: any) => i.group === group).forEach((i: any) => {
        const notes = i.notes ? `, ${i.notes}` : '';
        lines.push(`${i.quantity} ${i.unit} ${i.name}${notes}.`);
      });
      lines.push('');
    });

    lines.push("Got everything? Let's begin.");
    lines.push('');

    steps.forEach((step: any) => {
      lines.push(`Step ${step.stepNumber}. ${step.title}.`);
      lines.push(step.instruction);
      if (step.duration) lines.push(`This should take about ${step.duration}.`);
      if (step.tip) lines.push(`Chef's tip: ${step.tip}`);
      lines.push('');
    });

    lines.push("And that's it! Your meal is ready.");
    if (existing.tips.length > 0) {
      lines.push(`One final tip: ${existing.tips[0]}`);
    }

    const audioScript = lines.join('\n');
    // Rough duration estimate: ~130 words per minute, ~5 chars per word
    const wordCount = audioScript.split(/\s+/).length;
    const audioDuration = Math.round((wordCount / 130) * 60);

    const instructions = await prisma.mealCookingInstructions.update({
      where: { userId_mealPlanId_dayIndex_mealIndex: { userId, mealPlanId, dayIndex, mealIndex } },
      data: { audioScript, audioDuration, audioGeneratedAt: new Date() },
    });

    res.json({ instructions });
  } catch (err: any) {
    console.error('Generate audio script error:', err?.message || err);
    res.status(500).json({ error: 'Failed to generate audio guide. Please try again.' });
  }
});

// Helper: get plan dates for current week
function getPlanDates(): string[] {
  const now = new Date();
  const day = now.getDay();
  // Sunday bug fix: day===0 must go back 6 to reach previous Monday
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

export default router;
