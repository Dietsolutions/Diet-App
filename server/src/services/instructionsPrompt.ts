/**
 * The cooking-instructions prompt.
 *
 * Extracted from routes/meals.ts so the prompt can be exercised outside the
 * request path — comparing a wording change against what is already stored
 * needs the real prompt, not a copy of it that drifts the moment either side
 * is edited.
 */

export interface InstructionsPromptInput {
  meal: {
    name: string;
    description?: string | null;
    type?: string | null;
    time?: string | null;
    ingredients?: unknown;
  };
  servings: number;
  language: string;
}

export function buildInstructionsPrompt({ meal, servings, language }: InstructionsPromptInput): string {
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

  const prompt = `${languageInstruction}You are a professional chef and culinary instructor. Generate detailed, beginner-friendly cooking instructions for the following meal.

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
   - Detailed — assume the cook has never made this before
   - Each step must describe exactly what to do
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

  return prompt;
}
