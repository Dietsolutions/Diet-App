import { callLLMJson } from './llmClient';
import { FoodResult, AIEstimateResult } from './foodTypes';

export async function getAIFoodEstimate(query: string): Promise<FoodResult[]> {
  const prompt = `You are a nutrition database. Return macro information for "${query}".
Provide 1-2 common serving options.
Respond ONLY with valid JSON, no markdown, no preamble:
{
  "results": [
    {
      "name": "string",
      "servingDescription": "string (e.g. 1 bowl, 1 cup, 1 piece)",
      "servingGrams": 0,
      "per100g": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "fibre": 0 },
      "perServing": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "fibre": 0 }
    }
  ]
}`;

  const parsed = await callLLMJson<{ results: any[] }>(prompt, { maxTokens: 600 });

  return (parsed.results || []).map((r: any) => ({
    id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: r.name,
    description: r.servingDescription || '',
    source: 'ai_estimate' as const,
    servingSizes: [
      { label: r.servingDescription, grams: r.servingGrams },
      { label: '100g', grams: 100 },
    ],
    defaultServing: { label: r.servingDescription, grams: r.servingGrams },
    per100g: {
      calories: Math.round(r.per100g?.calories ?? 0),
      protein: Math.round((r.per100g?.protein ?? 0) * 10) / 10,
      carbs: Math.round((r.per100g?.carbs ?? 0) * 10) / 10,
      fat: Math.round((r.per100g?.fat ?? 0) * 10) / 10,
      fibre: Math.round((r.per100g?.fibre ?? 0) * 10) / 10,
    },
    perServing: {
      calories: Math.round(r.perServing?.calories ?? 0),
      protein: Math.round((r.perServing?.protein ?? 0) * 10) / 10,
      carbs: Math.round((r.perServing?.carbs ?? 0) * 10) / 10,
      fat: Math.round((r.perServing?.fat ?? 0) * 10) / 10,
      fibre: Math.round((r.perServing?.fibre ?? 0) * 10) / 10,
    },
    isAiEstimate: true,
  }));
}

export async function getAINaturalLanguageEstimate(
  description: string
): Promise<AIEstimateResult> {
  const prompt = `You are a professional nutritionist. A user has described what they ate. Break it down into individual components and estimate accurate macros for each.

Meal description: ${description}

Respond ONLY with valid JSON, no preamble, no explanation:
{
  "components": [
    {
      "name": "string",
      "portionDescription": "string",
      "estimatedGrams": 0,
      "calories": 0,
      "proteinG": 0,
      "carbsG": 0,
      "fatG": 0,
      "fibreG": 0
    }
  ],
  "totals": {
    "calories": 0,
    "proteinG": 0,
    "carbsG": 0,
    "fatG": 0,
    "fibreG": 0
  },
  "confidenceNote": "string"
}`;

  return callLLMJson<AIEstimateResult>(prompt, { maxTokens: 800 });
}
