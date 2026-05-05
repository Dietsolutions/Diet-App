export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
}

export interface ServingSize {
  label: string;
  grams: number;
}

export interface FoodResult {
  id: string;
  name: string;
  description: string;
  source: 'open_food_facts' | 'usda' | 'ai_estimate' | 'indian_db' | 'calorie_ninjas';
  sourceLabel?: string;   // display label: 'INDB' | 'ICMR-NIN' | 'OFF' | 'USDA' | 'AI' | 'CN'
  servingSizes: ServingSize[];
  defaultServing: ServingSize;
  per100g: Macros;
  perServing: Macros;
  isAiEstimate: boolean;
  matchScore?: number;    // fuzzy match confidence 0–1 (Indian food service)
  dataSource?: string;    // e.g. 'ICMR-NIN IFCT 2017 via INDB'
}

export interface AIComponent {
  name: string;
  portionDescription: string;
  estimatedGrams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG: number;
}

export interface AIEstimateResult {
  components: AIComponent[];
  totals: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fibreG: number;
  };
  confidenceNote: string;
}
