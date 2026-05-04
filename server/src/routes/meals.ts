import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { generateAudio } from '../services/ttsService';
import { storeAudioFile } from '../services/storageService';

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

const router = Router();

// ── Audio script builder ───────────────────────────────────────────────────
// Extracted so it can be tested independently and safely reused.
// Returns empty string on failure (never throws).
function buildAudioScript(existing: {
  mealName:   string;
  totalTime:  string;
  servings:   number | null;
  ingredients: unknown;
  steps:       unknown;
}): string {
  try {
    const ingredients   = (existing.ingredients as any[]) || [];
    const steps         = (existing.steps       as any[]) || [];
    const audioServings = existing.servings ?? 1;
    const servingsPhrase = audioServings === 1 ? 'one person' : `${audioServings} people`;
    const parts: string[] = [];

    parts.push(`Let's cook ${existing.mealName} for ${servingsPhrase}. Total time: ${existing.totalTime}.`);
    parts.push(`Here's what you'll need for ${audioServings === 1 ? 'one serving' : `${audioServings} servings`}.`);
    ingredients.forEach((i: any) => {
      const part = `${i.quantity ?? ''} ${i.unit ?? ''} ${i.name ?? ''}`.trim();
      if (part) parts.push(`${part}.`);
    });
    parts.push("Let's begin.");
    steps.forEach((step: any) => {
      parts.push(`Step ${step.stepNumber}: ${step.title}. ${step.instruction}`);
    });
    parts.push(`Your ${existing.mealName} for ${servingsPhrase} is ready. Enjoy your meal.`);

    return parts.filter(Boolean).join(' ');
  } catch (err) {
    console.error('[buildAudioScript] Failed to build audio script:', err);
    return '';
  }
}

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
    const record = await prisma.mealCookingInstructions.findUnique({
      where: { userId_mealPlanId_dayIndex_mealIndex: { userId, mealPlanId, dayIndex: Number(dayIndex), mealIndex: Number(mealIndex) } },
    });
    if (!record) { res.json({ instructions: null }); return; }
    // Strip the condensed audioScript — frontend only needs audioUrl for playback
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { audioScript: _audioScript, ...instructionsForClient } = record;
    res.json({ instructions: instructionsForClient });
  } catch (err: any) {
    console.error('Get cooking instructions error:', err?.message || err);
    res.status(500).json({ error: 'Failed to load instructions' });
  }
});

// POST /api/meals/instructions/generate
router.post('/instructions/generate', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { mealPlanId, dayIndex, mealIndex, servings: reqServings, language: reqLanguage } = req.body;
    const servings: number = typeof reqServings === 'number' && reqServings >= 1 ? Math.min(reqServings, 10) : 1;
    const VALID_LANGUAGES = ['en', 'hi', 'kn', 'ta', 'te'];
    const language: string = typeof reqLanguage === 'string' && VALID_LANGUAGES.includes(reqLanguage) ? reqLanguage : 'en';
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
    const servingsLabel   = servings === 1 ? '1 person (single serving)' : `${servings} people`;
    const servingsNote    = servings === 1
      ? 'Generate all ingredient quantities for 1 person (single serving).'
      : `Generate all ingredient quantities for ${servings} people. Every gram, ml, tsp, tbsp, and piece count in the ingredients list MUST be multiplied by ${servings} from the base single-serving amount. Do not show per-person quantities — show the total combined quantity needed for ${servings} people. Mention that cooking times for larger batches may increase slightly.`;

    const LANGUAGE_NAMES: Record<string, string> = {
      en: 'English', hi: 'Hindi', kn: 'Kannada', ta: 'Tamil', te: 'Telugu',
    };
    const languageInstruction = language !== 'en'
      ? `IMPORTANT: Write ALL output — every field, ingredient name, step instruction, tip, substitution, and meal name — entirely in ${LANGUAGE_NAMES[language] ?? language}. Do not use English except for standard units of measurement (g, ml, tsp, tbsp, cups). The response JSON structure remains the same but all string values must be in ${LANGUAGE_NAMES[language] ?? language}.\n\n`
      : '';

    const prompt = `${languageInstruction}You are a professional chef and culinary instructor. Generate extremely detailed, beginner-friendly cooking instructions for the following meal.

MEAL: ${meal.name}
DESCRIPTION: ${meal.description || ''}
MEAL TYPE: ${meal.type || 'Meal'} (${meal.time || ''})
SERVINGS: ${servingsLabel}

${servingsNote}

KNOWN INGREDIENTS (base single-serving reference from meal plan):
${ingredientsList}

REQUIREMENTS:
1. List ALL ingredients with precise quantities scaled for ${servingsLabel}
   - Use standard measurements (grams, ml, tsp, tbsp, cups)
   - Include preparation notes on each ingredient (e.g. "finely chopped", "at room temperature")
   - Group ingredients into: Main ingredients, Spices & seasonings, For cooking

2. Step-by-step instructions must be:
   - Extremely detailed — assume the cook has never made this before
   - Each step must describe exactly what to do, what it should look like, smell like, or feel like when done correctly
   - Include temperature settings, pan types, heat levels appropriate for ${servings === 1 ? 'a single serving' : `${servings} servings`}
   - Include timing for each step
   - Warn about common mistakes at critical steps
   - Mention what "done" looks like for each step

3. Include:
   - Prep time, cook time, total time for ${servingsLabel}
   - 3-5 pro cooking tips specific to this dish
   - One substitution suggestion for the main protein or key ingredient

Respond ONLY with valid JSON matching this exact structure:
{
  "mealName": string,
  "prepTime": string,
  "cookTime": string,
  "totalTime": string,
  "servings": ${servings},
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

    // Upsert instructions — use reqServings as the authoritative value so a re-generate
    // for different servings always overwrites, even if the AI JSON echoes a different number.
    const instructions = await prisma.mealCookingInstructions.upsert({
      where: { userId_mealPlanId_dayIndex_mealIndex: { userId, mealPlanId, dayIndex, mealIndex } },
      update: {
        mealName: parsed.mealName || meal.name,
        language,
        ingredients: parsed.ingredients || [],
        steps: parsed.steps || [],
        totalTime: parsed.totalTime || '',
        prepTime: parsed.prepTime || '',
        cookTime: parsed.cookTime || '',
        servings,   // authoritative — from request, not AI echo
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
        language,
        ingredients: parsed.ingredients || [],
        steps: parsed.steps || [],
        totalTime: parsed.totalTime || '',
        prepTime: parsed.prepTime || '',
        cookTime: parsed.cookTime || '',
        servings,   // authoritative — from request, not AI echo
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
// Generates a real .mp3 via TTS (ElevenLabs / Unreal Speech / OpenAI / Play.ht),
// stores it in Vercel Blob, and saves the public URL.
// Reuses an existing file if the same user already has audio for this meal name.
router.post('/instructions/generate-audio', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { mealPlanId, dayIndex, mealIndex, language: reqAudioLanguage } = req.body;
    const VALID_LANGUAGES_AUDIO = ['en', 'hi', 'kn', 'ta', 'te'];
    const audioLanguage: string = typeof reqAudioLanguage === 'string' && VALID_LANGUAGES_AUDIO.includes(reqAudioLanguage) ? reqAudioLanguage : 'en';
    if (!mealPlanId || typeof dayIndex !== 'number' || typeof mealIndex !== 'number') {
      res.status(400).json({ error: 'mealPlanId, dayIndex, mealIndex are required' }); return;
    }

    // Fetch the text instructions record (must exist first)
    const existing = await prisma.mealCookingInstructions.findUnique({
      where: { userId_mealPlanId_dayIndex_mealIndex: { userId, mealPlanId, dayIndex, mealIndex } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Generate text instructions first before creating audio.' }); return;
    }

    // Already has audio for the right language — return immediately (no re-generation)
    if (existing.audioUrl && (existing.language ?? 'en') === audioLanguage) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { audioScript: _s, ...instrForClient } = existing;
      res.json({ instructions: instrForClient }); return;
    }

    // ── Reuse check: same meal name + same language in any other record for this user ────
    const reusable = await prisma.mealCookingInstructions.findFirst({
      where: {
        userId,
        mealName:  { equals: existing.mealName, mode: 'insensitive' },
        language:  audioLanguage,
        audioUrl:  { not: null },
        id:        { not: existing.id },
      },
      orderBy: { audioGeneratedAt: 'desc' },
    });

    if (reusable?.audioUrl) {
      // Reuse — copy the URL to this record and return
      const updated = await prisma.mealCookingInstructions.update({
        where: { id: existing.id },
        data: {
          audioUrl:          reusable.audioUrl,
          audioScript:       reusable.audioScript,
          audioDuration:     reusable.audioDuration,
          audioProviderUsed: reusable.audioProviderUsed,
          audioGeneratedAt:  new Date(),
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { audioScript: _s2, ...instrForClient } = updated;
      res.json({ instructions: instrForClient }); return;
    }

    // ── English-only gate: TTS provider only supports English ─────────────────
    if (audioLanguage !== 'en') {
      res.status(400).json({
        error:              'language_not_supported_for_audio',
        message:            `Audio generation is currently only available in English. Support for ${audioLanguage} is coming soon.`,
        supportedLanguages: ['en'],
      });
      return;
    }

    // ── Rate limit: 10 new TTS calls per user per day ─────────────────────────
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const audioCount = await prisma.mealCookingInstructions.count({
      where: { userId, audioGeneratedAt: { gte: dayStart } },
    });
    if (audioCount >= 10) {
      res.status(429).json({ error: 'Daily audio generation limit reached (10/day). Try again tomorrow.' }); return;
    }

    // ── Build the narration script ────────────────────────────────────────────
    const audioScript = buildAudioScript(existing);
    if (!audioScript) {
      res.status(500).json({ error: 'Failed to build audio script. Please try again.' });
      return;
    }
    const wordCount     = audioScript.split(/\s+/).length;
    const audioDuration = Math.round((wordCount / 130) * 60);

    // ── Call TTS and store the file ───────────────────────────────────────────
    const { buffer, provider } = await generateAudio(audioScript);

    const safeName = existing.mealName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
    const filename  = `audio/${userId}/${safeName}_${Date.now()}.mp3`;
    const audioUrl  = await storeAudioFile(buffer, filename);

    // ── Persist and return (only audio fields — never touch ingredients/steps) ──
    const saved = await prisma.mealCookingInstructions.update({
      where: { id: existing.id },
      data: {
        audioUrl,
        audioScript,       // stored server-side only; stripped before sending to client
        audioDuration,
        audioProviderUsed: provider,
        audioGeneratedAt:  new Date(),
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { audioScript: _s3, ...instrForClient } = saved;
    res.json({ instructions: instrForClient });
  } catch (err: any) {
    console.error('Generate audio error:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Failed to generate audio. Please try again.' });
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
