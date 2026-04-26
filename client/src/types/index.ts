export interface User {
  id: string;
  username: string | null;
  email: string | null;
  name: string | null;
  avatar: string | null;
  onboardingDone: boolean;
}

export interface Meal {
  mealIndex?: number;
  type?: string;
  name: string;
  description: string;
  time: string;
  cookingTip?: string;
  ingredients?: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre?: number;
}

export interface DayPlan {
  label: string;
  dayIndex?: number;
  totalCalories?: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
  totalFibre?: number;
  meals: Meal[];
}

export interface MealState {
  mealIndex: number;
  eaten: boolean;
}

export interface DayTrackerState {
  date: string;
  dayIndex: number;
  meals: MealState[];
}

export interface TrackerStats {
  eaten: number;
  total: number;
  adherence: number;
  streak: number;
  remaining: number;
  mealsPerDay?: number;
}

export interface ShoppingItemData {
  key: string;
  name: string;
  quantity?: string;
  unit?: string;
  bought: boolean;
}

export interface ShoppingCategoryData {
  name: string;
  items: ShoppingItemData[];
}

export type TabId = 'meals' | 'tracker' | 'shopping' | 'tips' | 'profile';

// Onboarding types
export interface OnboardingData {
  // Step 1: Personal
  name: string;
  age: number;
  gender: string;
  country: string;
  city: string;
  // Step 2: Body
  weightKg: number;
  heightCm: number;
  targetWeightKg: number;
  // Step 3: Diet
  mealPreference: string;
  cuisinePreferences: string[];
  mealsPerDay: number;
  eatingWindow: string;
  // Step 4: Allergies
  allergies: string[];
  allergyOther: string;
  // Step 5: Preferred
  preferredIngredients: string[];
  // Step 6: Avoid
  avoidIngredients: string[];
  avoidOther: string;
  // Step 7: Goals
  primaryGoal: string;
  dietIntensity: string;
  activityLevel: string;
  healthConditions: string[];
  wakeUpTime: string;
  sleepTime: string;
  cookingStyle: string;
  kitchenEquipment: string[];
  weeklyBudget: number | null;
  budgetCurrency: string;
  waterIntakeGoal: number;
  planDuration: number;
  // Extended fields
  countryCode?: string;
  eatingWindowHours?: number;
  fastingWindowHours?: number;
  eatingStartTime?: string;
  eatingEndTime?: string;
  avoidNone?: boolean; // local UI state for opt-out
}

// Weight tracking types
export interface WeightLog {
  id: string;
  weightKg: number;
  loggedAt: string;
  note: string;
}

export interface WeightProjectionPoint {
  date: string;
  weightKg: number;
}

export interface ChartPoint {
  date: string;
  projected?: number;
  actual?: number;
  isToday?: boolean;
  isGoal?: boolean;
}

export type TimeRange = '1M' | '3M' | '6M' | 'all';

// Meal Replacer types
export interface ServingSize {
  label: string;
  grams: number;
}

export interface FoodMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
}

export interface FoodResult {
  id: string;
  name: string;
  description: string;
  source: 'open_food_facts' | 'usda' | 'ai_estimate';
  servingSizes: ServingSize[];
  defaultServing: ServingSize;
  per100g: FoodMacros;
  perServing: FoodMacros;
  isAiEstimate: boolean;
}

export interface AdditionalMealLog {
  id: string;
  userId?: string;
  date: string;
  mealCategory: string;
  mealTime?: string | null;
  foodName: string;
  foodSource: string;
  foodExternalId?: string | null;
  servingSize: string;
  servingQty: number;
  servingGrams?: number | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG: number;
  note?: string | null;
  isAiEstimate: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface MealReplacement {
  id: string;
  userId: string;
  date: string;
  dayIndex: number;
  mealIndex: number;
  foodName: string;
  foodSource: string;
  foodExternalId?: string;
  servingSize: string;
  servingQty: number;
  servingGrams?: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG: number;
  note?: string;
  isAiEstimate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MealTarget {
  date: string;
  dayIndex: number;
  mealIndex: number;
  mealName: string;
}

export interface AIFoodComponent {
  name: string;
  portionDescription: string;
  estimatedGrams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG: number;
}

export interface RecentFoodLog {
  id: string;
  userId: string;
  foodName: string;
  foodSource: string;
  foodData: any;
  usedAt: string;
}

export interface UserProfile extends OnboardingData {
  id: string;
  userId: string;
  tdee: number;
  targetCalories: number;
  proteinTarget: number;
  fatTarget: number;
  carbTarget: number;
  fibreTarget: number;
  bmi: number;
  mealPlanCustomInstructions?: string;
}

export interface WaterLog {
  id: string;
  userId: string;
  date: string;
  glasses: number;
  goalGlasses: number;
  loggedAt: string;
  updatedAt: string;
}

export interface TrackerSummary {
  eaten: number;
  total: number;
  adherencePct: number;
}

export interface GoalCountdown {
  goalDate: string;
  daysLeft: number;
  weeksLeft: number;
  displayText: string;
  isUrgent: boolean;
  targetWeight?: number;
  currentWeight?: number;
}

export interface MealPrepTask {
  instruction: string;
  usedOn: string;
}

export interface MealPrepSection {
  category: string;
  emoji: string;
  tasks: MealPrepTask[];
}

export interface MealPrepGuide {
  estimatedMinutes: number;
  intro: string;
  sections: MealPrepSection[];
}

// ── Cooking instructions (on-demand generation) ──────────────────────────────

export interface CookingIngredient {
  group: string;
  name: string;
  quantity: string;
  unit: string;
  notes: string;
}

export interface CookingStep {
  stepNumber: number;
  title: string;
  instruction: string;
  duration?: string;
  tip?: string;
}

export interface MealCookingInstructions {
  id: string;
  mealName: string;
  prepTime: string;
  cookTime: string;
  totalTime: string;
  servings: number;
  ingredients: CookingIngredient[];
  steps: CookingStep[];
  tips: string[];
  substitution?: string | null;
  audioScript?: string | null;
  audioDuration?: number | null;
  audioGeneratedAt?: string | null;
  generatedAt: string;
}
