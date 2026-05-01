import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { searchOpenFoodFacts } from '../services/openFoodFactsService';
import { searchUSDA } from '../services/usdaService';
import { getAIFoodEstimate, getAINaturalLanguageEstimate } from '../services/aiFoodService';
import { FoodResult } from '../services/foodTypes';

const router = Router();

// Rate limit for AI food estimation
const aiRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const AI_DAILY_LIMIT = parseInt(process.env.AI_FOOD_ESTIMATE_DAILY_LIMIT || '20', 10);

function checkAIRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = aiRateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    aiRateLimitMap.set(userId, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= AI_DAILY_LIMIT) return false;
  entry.count++;
  return true;
}

// Passive cleanup of expired cache entries (run on each search)
async function cleanExpiredCache(): Promise<void> {
  try {
    await prisma.foodSearchCache.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  } catch {
    // silent — cleanup is best-effort
  }
}

// Deduplicate by normalized food name
function deduplicateResults(results: FoodResult[]): FoodResult[] {
  const seen = new Map<string, FoodResult>();
  for (const r of results) {
    const key = r.name.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.set(key, r);
    }
  }
  return Array.from(seen.values());
}

// GET /api/food/search?q=...&limit=10
router.get('/search', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const query = (req.query.q as string || '').trim();
    const limit = Math.min(parseInt(req.query.limit as string || '10', 10), 20);

    if (query.length < 2 || query.length > 200) {
      res.status(400).json({ error: 'Query must be between 2 and 200 characters' });
      return;
    }

    // Passive cache cleanup
    cleanExpiredCache();

    // Check cache
    const normalizedQuery = query.toLowerCase();
    const cached = await prisma.foodSearchCache.findUnique({
      where: { query_source: { query: normalizedQuery, source: 'combined' } },
    });

    if (cached && cached.expiresAt > new Date()) {
      res.json({ results: (cached.results as unknown as FoodResult[]).slice(0, limit), cached: true });
      return;
    }

    // Call Open Food Facts and USDA in parallel
    const [offResult, usdaResult] = await Promise.allSettled([
      searchOpenFoodFacts(query),
      searchUSDA(query),
    ]);

    const offResults = offResult.status === 'fulfilled' ? offResult.value : [];
    const usdaResults = usdaResult.status === 'fulfilled' ? usdaResult.value : [];

    if (offResult.status === 'rejected') {
      console.warn('Open Food Facts search failed:', offResult.reason?.message || offResult.reason);
    }
    if (usdaResult.status === 'rejected') {
      console.warn('USDA search failed:', usdaResult.reason?.message || usdaResult.reason);
    }

    // Merge: OFF first, then USDA
    let merged = deduplicateResults([...offResults, ...usdaResults]);

    // If fewer than 3 results, call AI fallback
    if (merged.length < 3) {
      try {
        const aiResults = await getAIFoodEstimate(query);
        merged = deduplicateResults([...merged, ...aiResults]);
      } catch (err: any) {
        console.warn('AI food estimate fallback failed:', err?.message || err);
      }
    }

    const finalResults = merged.slice(0, limit);

    // Cache results for 7 days
    try {
      await prisma.foodSearchCache.upsert({
        where: { query_source: { query: normalizedQuery, source: 'combined' } },
        update: {
          results: finalResults as any,
          cachedAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        create: {
          query: normalizedQuery,
          source: 'combined',
          results: finalResults as any,
          cachedAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    } catch {
      // silent — caching failure shouldn't break the response
    }

    res.json({ results: finalResults, cached: false });
  } catch (err: any) {
    console.error('Food search error:', err?.message || err);
    res.status(500).json({ error: 'Failed to search foods' });
  }
});

// POST /api/food/ai-estimate
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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'AI service not configured' });
      return;
    }

    const result = await getAINaturalLanguageEstimate(description.trim());

    res.json({
      breakdown: result.components || [],
      totals: result.totals || { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fibreG: 0 },
      isAiEstimate: true,
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

// GET /api/food/recent
router.get('/recent', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const recent = await prisma.recentFoodLog.findMany({
      where: { userId },
      orderBy: { usedAt: 'desc' },
      take: 10,
    });

    res.json({ recent });
  } catch (err: any) {
    console.error('Recent food error:', err?.message || err);
    res.status(500).json({ error: 'Failed to load recent foods' });
  }
});

export default router;
