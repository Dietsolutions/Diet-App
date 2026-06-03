/**
 * Food search routes — 6-step waterfall:
 *   1. INDB Indian Recipes      (self-hosted, 1,014 recipes)
 *   2. ICMR-NIN Ingredients     (self-hosted, 542 raw foods)
 *   3. Open Food Facts           (global packaged foods, no key)
 *   4. CalorieNinjas             (natural-language nutrition API, optional key)
 *   5. USDA FoodData Central     (US/global nutrients, optional key)
 *   6. Claude AI fallback        (last resort, rate-limited)
 *
 * Steps 3–6 are only called if the earlier steps didn't produce enough results.
 * Cache: 7-day TTL for real data, 2-day TTL when AI estimates are included.
 */

import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { searchOpenFoodFacts } from '../services/openFoodFactsService';
import { searchUSDA } from '../services/usdaService';
import { getAIFoodEstimate, getAINaturalLanguageEstimate } from '../services/aiFoodService';
import { searchINDB, searchICMRNIN } from '../services/indianFoodService';
import { getMealMacrosFromCalorieNinjas } from '../services/calorieNinjasService';
import { FoodResult } from '../services/foodTypes';

const router = Router();

// ── Constants ──────────────────────────────────────────────────────────────

const WATERFALL_MIN_RESULTS  = 3;   // keep trying until we have at least this many
const INDB_HIGH_CONF         = 0.70; // skip remaining steps if INDB hit is this confident
const INDB_MIN_SCORE         = 0.55; // keeps biryani (0.61) but drops partial "butter" hits (0.50)
const ICMR_MIN_SCORE         = 0.55; // same bar — both DBs use the same scoring function

// AI fallback: max 5 calls per user per hour (separate from the explicit /ai-estimate endpoint)
const AI_FALLBACK_MAX_PER_HOUR = 5;
const aiFallbackUsage = new Map<string, { count: number; resetAt: number }>();

// Explicit AI estimate endpoint: 20 calls per user per day
const AI_DAILY_LIMIT = parseInt(process.env.AI_FOOD_ESTIMATE_DAILY_LIMIT || '20', 10);
const aiRateLimitMap = new Map<string, { count: number; resetAt: number }>();

// ── Rate limiters ──────────────────────────────────────────────────────────

function checkAIRateLimit(userId: string): boolean {
  const now   = Date.now();
  const entry = aiRateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    aiRateLimitMap.set(userId, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= AI_DAILY_LIMIT) return false;
  entry.count++;
  return true;
}

function checkAIFallbackRateLimit(userId: string): boolean {
  const now   = Date.now();
  const entry = aiFallbackUsage.get(userId);
  if (!entry || now > entry.resetAt) {
    aiFallbackUsage.set(userId, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= AI_FALLBACK_MAX_PER_HOUR) return false;
  entry.count++;
  return true;
}

// ── Cache helpers ─────────────────────────────────────────────────────────

async function cleanExpiredCache(): Promise<void> {
  try {
    await prisma.foodSearchCache.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  } catch (err) { console.warn('Cache cleanup failed:', (err as Error)?.message); }
}

// ── Deduplication ─────────────────────────────────────────────────────────

function dedup(results: FoodResult[]): FoodResult[] {
  const seen = new Map<string, FoodResult>();
  for (const r of results) {
    const key = r.name.toLowerCase().trim();
    if (!seen.has(key)) seen.set(key, r);
  }
  return Array.from(seen.values());
}

// ── 6-Step Waterfall ──────────────────────────────────────────────────────

async function runWaterfall(
  query:  string,
  limit:  number,
  userId: string,
): Promise<{ results: FoodResult[]; sources: string[]; usedAI: boolean }> {

  const collected: FoodResult[] = [];
  const sources:   string[]     = [];
  let   usedAI = false;

  function add(fresh: FoodResult[], label: string): void {
    const existing = new Set(collected.map(r => r.name.toLowerCase().trim()));
    const novel    = fresh.filter(r => !existing.has(r.name.toLowerCase().trim()));
    if (novel.length > 0) {
      collected.push(...novel);
      sources.push(label);
    }
  }

  // ── Step 1: INDB Indian Recipes ─────────────────────────────────────────
  const indbResults = await searchINDB(query, 5, INDB_MIN_SCORE);
  add(indbResults, 'INDB');

  // High-confidence INDB hit — return immediately, no further API calls
  if (indbResults.length > 0 && indbResults[0].matchScore! >= INDB_HIGH_CONF) {
    console.log(
      `[Waterfall] INDB high-conf: "${indbResults[0].name}" (${indbResults[0].matchScore!.toFixed(2)}) for "${query}"`
    );
    return { results: dedup(collected).slice(0, limit), sources, usedAI };
  }

  if (collected.length >= WATERFALL_MIN_RESULTS) {
    return { results: dedup(collected).slice(0, limit), sources, usedAI };
  }

  // ── Step 2: ICMR-NIN Raw Ingredients ────────────────────────────────────
  const icmrResults = await searchICMRNIN(query, 5, ICMR_MIN_SCORE);
  add(icmrResults, 'ICMR-NIN');

  if (collected.length >= WATERFALL_MIN_RESULTS) {
    return { results: dedup(collected).slice(0, limit), sources, usedAI };
  }

  // ── Step 3: Open Food Facts ──────────────────────────────────────────────
  const [offSettled] = await Promise.allSettled([searchOpenFoodFacts(query)]);
  if (offSettled.status === 'fulfilled') {
    add(offSettled.value, 'Open Food Facts');
  } else {
    console.warn('[Waterfall] OFF failed:', offSettled.reason?.message);
  }

  if (collected.length >= WATERFALL_MIN_RESULTS) {
    return { results: dedup(collected).slice(0, limit), sources, usedAI };
  }

  // ── Step 4: CalorieNinjas ────────────────────────────────────────────────
  if (process.env.CALORIE_NINJAS_API_KEY) {
    try {
      const cn = await getMealMacrosFromCalorieNinjas(query, [query]);
      if (cn.success && cn.macros.calories > 0) {
        add([{
          id:          `cn_${query.replace(/\s+/g, '_').slice(0, 40)}`,
          name:        query,
          description: 'CalorieNinjas estimate',
          source:      'calorie_ninjas',
          sourceLabel: 'CN',
          servingSizes:   [{ label: '100g', grams: 100 }],
          defaultServing: { label: '100g', grams: 100 },
          per100g: {
            calories: cn.macros.calories,
            protein:  cn.macros.proteinG,
            carbs:    cn.macros.carbsG,
            fat:      cn.macros.fatG,
            fibre:    cn.macros.fibreG,
          },
          perServing: {
            calories: cn.macros.calories,
            protein:  cn.macros.proteinG,
            carbs:    cn.macros.carbsG,
            fat:      cn.macros.fatG,
            fibre:    cn.macros.fibreG,
          },
          isAiEstimate: false,
        }], 'CalorieNinjas');
      }
    } catch (err: any) {
      console.warn('[Waterfall] CalorieNinjas failed:', err.message);
    }
  }

  if (collected.length >= WATERFALL_MIN_RESULTS) {
    return { results: dedup(collected).slice(0, limit), sources, usedAI };
  }

  // ── Step 5: USDA FoodData Central ───────────────────────────────────────
  const [usdaSettled] = await Promise.allSettled([searchUSDA(query)]);
  if (usdaSettled.status === 'fulfilled') {
    add(usdaSettled.value, 'USDA');
  } else {
    console.warn('[Waterfall] USDA failed:', usdaSettled.reason?.message);
  }

  if (collected.length >= WATERFALL_MIN_RESULTS) {
    return { results: dedup(collected).slice(0, limit), sources, usedAI };
  }

  // ── Step 6: Claude AI Estimate (last resort) ────────────────────────────
  if (checkAIFallbackRateLimit(userId)) {
    try {
      const aiResults = await getAIFoodEstimate(query);
      add(aiResults, 'AI');
      usedAI = aiResults.length > 0;
    } catch (err: any) {
      console.warn('[Waterfall] AI fallback failed:', err.message);
    }
  } else {
    console.log(`[Waterfall] AI fallback rate-limited for ${userId}`);
  }

  return { results: dedup(collected).slice(0, limit), sources, usedAI };
}

// ── GET /api/food/search ──────────────────────────────────────────────────

router.get('/search', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const query  = (req.query.q as string || '').trim();
    const limit  = Math.min(parseInt(req.query.limit as string || '10', 10), 20);
    const userId = req.userId!;

    if (query.length < 2 || query.length > 200) {
      res.status(400).json({ error: 'Query must be between 2 and 200 characters' });
      return;
    }

    // Passive cache cleanup (best-effort)
    cleanExpiredCache();

    // Cache check
    const normalizedQuery = query.toLowerCase();
    const cached = await prisma.foodSearchCache.findUnique({
      where: { query_source: { query: normalizedQuery, source: 'combined' } },
    });
    if (cached && cached.expiresAt > new Date()) {
      res.json({ results: (cached.results as unknown as FoodResult[]).slice(0, limit), cached: true });
      return;
    }

    // Run the 6-step waterfall
    const { results, sources, usedAI } = await runWaterfall(query, limit, userId);

    if (sources.length > 0) {
      console.log(`[Food search] "${query}" → ${results.length} results from: ${sources.join(', ')}`);
    }

    // Cache: 2 days when AI estimates present, 7 days otherwise
    const ttlDays  = usedAI ? 2 : 7;
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    try {
      await prisma.foodSearchCache.upsert({
        where:  { query_source: { query: normalizedQuery, source: 'combined' } },
        update: { results: results as any, cachedAt: new Date(), expiresAt },
        create: { query: normalizedQuery, source: 'combined', results: results as any, cachedAt: new Date(), expiresAt },
      });
    } catch (err) { console.warn('Food search cache upsert failed:', (err as Error)?.message); }

    res.json({ results, cached: false });
  } catch (err: any) {
    console.error('Food search error:', err?.message || err);
    res.status(500).json({ error: 'Failed to search foods' });
  }
});

// ── POST /api/food/ai-estimate ────────────────────────────────────────────

router.post('/ai-estimate', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { description } = req.body;

    if (!description || typeof description !== 'string' || description.trim().length < 3 || description.trim().length > 500) {
      res.status(400).json({ error: 'Description must be between 3 and 500 characters' });
      return;
    }

    if (!checkAIRateLimit(userId)) {
      res.status(429).json({ error: `AI estimation limit reached (${AI_DAILY_LIMIT}/day). Try searching manually.` });
      return;
    }

    if (!process.env.OPENROUTER_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      res.status(500).json({ error: 'AI service not configured' });
      return;
    }

    const result = await getAINaturalLanguageEstimate(description.trim());

    res.json({
      breakdown:      result.components || [],
      totals:         result.totals || { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fibreG: 0 },
      isAiEstimate:   true,
      confidenceNote: result.confidenceNote || 'AI estimates may vary +/- 20-25%',
    });
  } catch (err: any) {
    console.error('AI estimate error:', err?.message || err);
    if (err.message?.includes('timeout') || err.message?.includes('ETIMEDOUT')) {
      res.status(408).json({ error: 'AI estimation timed out. Try searching manually.' });
    } else {
      res.status(500).json({ error: 'AI returned an unexpected response. Try again.' });
    }
  }
});

// ── GET /api/food/recent ──────────────────────────────────────────────────

router.get('/recent', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const recent = await prisma.recentFoodLog.findMany({
      where:   { userId },
      orderBy: { usedAt: 'desc' },
      take:    10,
    });
    res.json({ recent });
  } catch (err: any) {
    console.error('Recent food error:', err?.message || err);
    res.status(500).json({ error: 'Failed to load recent foods' });
  }
});

export default router;
