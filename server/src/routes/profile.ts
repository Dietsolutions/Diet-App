import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { calculateTDEE, calculateBMI } from '../utils/tdee';
import {
  validateName,
  validateCountry,
  validateCity,
  validateCountryCode,
  validateCurrency,
  validateCookingStyle,
  validateShortString,
  validateCuisinePrefs,
  validateAllergies,
  validatePreferredIng,
  validateAvoidIng,
  validateHealthConds,
  validateKitchenEquip,
  validateTimeHHMM,
} from '../utils/validation';
import { perUserLimiter } from '../middleware/perUserLimiter';

const router = Router();

// GET /api/profile — get current user's profile
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId: req.userId! }
    });

    if (!profile) {
      res.json({ profile: null });
      return;
    }

    res.json({
      profile: {
        ...profile,
        cuisinePreferences: JSON.parse(profile.cuisinePreferences),
        allergies: JSON.parse(profile.allergies),
        preferredIngredients: JSON.parse(profile.preferredIngredients),
        avoidIngredients: JSON.parse(profile.avoidIngredients),
        healthConditions: JSON.parse(profile.healthConditions),
        kitchenEquipment: JSON.parse(profile.kitchenEquipment),
        bmi: calculateBMI(profile.weightKg, profile.heightCm),
        mealPlanCustomInstructions: profile.mealPlanCustomInstructions || ''
      }
    });
  } catch (err) {
    console.error('Profile fetch error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error', message: 'Failed to load profile.' });
  }
});

// POST /api/profile — create or update profile
router.post('/', requireAuth, perUserLimiter({ windowMs: 60_000, max: 30, keyPrefix: 'profile-save' }), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const data = req.body;

    // Basic bounds validation for critical numeric fields
    if (typeof data.weightKg !== 'number' || data.weightKg < 20 || data.weightKg > 500) {
      res.status(400).json({ error: 'weightKg must be between 20 and 500' });
      return;
    }
    if (typeof data.heightCm !== 'number' || data.heightCm < 50 || data.heightCm > 300) {
      res.status(400).json({ error: 'heightCm must be between 50 and 300' });
      return;
    }
    if (typeof data.age !== 'number' || data.age < 10 || data.age > 120) {
      res.status(400).json({ error: 'age must be between 10 and 120' });
      return;
    }
    // targetWeightKg is optional for goals without a weight target
    if (data.targetWeightKg != null) {
      if (typeof data.targetWeightKg !== 'number' || data.targetWeightKg < 20 || data.targetWeightKg > 500) {
        res.status(400).json({ error: 'targetWeightKg must be between 20 and 500' });
        return;
      }
    }
    // gender — 'prefer_not_to_say' is a valid onboarding choice
    const validGenders = ['male', 'female', 'other', 'prefer_not_to_say'];
    if (!validGenders.includes(data.gender)) {
      res.status(400).json({ error: `gender must be one of: ${validGenders.join(', ')}` });
      return;
    }
    // primaryGoal — eat_healthy is the new generic meal-planning option
    const validGoals = ['lose_weight', 'maintain', 'gain_muscle', 'improve_fitness', 'manage_health', 'eat_healthy'];
    if (!validGoals.includes(data.primaryGoal)) {
      res.status(400).json({ error: `primaryGoal must be one of: ${validGoals.join(', ')}` });
      return;
    }
    // dietIntensity is only required for deficit/surplus goals
    const DEFICIT_GOALS = ['lose_weight', 'gain_muscle'];
    const validIntensities = ['low', 'moderate', 'high'];
    if (DEFICIT_GOALS.includes(data.primaryGoal)) {
      if (!validIntensities.includes(data.dietIntensity)) {
        res.status(400).json({ error: `dietIntensity must be one of: ${validIntensities.join(', ')} for ${data.primaryGoal}` });
        return;
      }
    }

    // Calculate nutrition targets — pass all extended fields for accurate computation.
    // Strip `breakdown` (the TDEE audit object) off the result: it is NOT a
    // UserProfile column, and `...targets` is spread into prisma.userProfile
    // below — leaving it in causes "Unknown argument `breakdown`". The breakdown
    // is only persisted on plan generation (ai.ts), not on profile save.
    const { breakdown: _tdeeBreakdown, ...targets } = calculateTDEE({
      weightKg:               data.weightKg,
      heightCm:               data.heightCm,
      age:                    data.age,
      gender:                 data.gender,
      activityLevel:          data.activityLevel,
      dietIntensity:          data.dietIntensity,
      primaryGoal:            data.primaryGoal,
      targetWeightKg:         data.targetWeightKg    ?? null,
      healthConditions:       data.healthConditions   ?? [],
      eatingWindowHours:      data.eatingWindowHours  ?? null,
      // Group A — TDEE inputs
      trainingType:           data.trainingType          ?? 'none',
      trainingDaysPerWeek:    data.trainingDaysPerWeek   ?? 3,
      trainingDurationMins:   data.trainingDurationMins  ?? 45,
      cardioSessionsPerWeek:  data.cardioSessionsPerWeek ?? 0,
      dailySteps:             data.dailySteps            ?? 5000,
      occupationType:         data.occupationType        ?? 'desk_job',
      insulinSensitivity:     data.insulinSensitivity    ?? 'average',
    });

    const profileData = {
      userId,
      name: validateName(data.name) ?? '',
      age: data.age,
      gender: data.gender,
      country: validateCountry(data.country) ?? '',
      city: validateCity(data.city) ?? '',
      weightKg: data.weightKg,
      heightCm: data.heightCm,
      targetWeightKg: data.targetWeightKg ?? null,
      mealPreference: validateShortString(data.mealPreference) ?? 'vegetarian',
      cuisinePreferences: JSON.stringify(validateCuisinePrefs(data.cuisinePreferences) ?? []),
      mealsPerDay: data.mealsPerDay || 4,
      eatingWindow: validateShortString(data.eatingWindow) ?? 'standard',
      allergies: JSON.stringify(validateAllergies(data.allergies) ?? []),
      preferredIngredients: JSON.stringify(validatePreferredIng(data.preferredIngredients) ?? []),
      avoidIngredients: JSON.stringify(validateAvoidIng(data.avoidIngredients) ?? []),
      primaryGoal: data.primaryGoal,
      dietIntensity: data.dietIntensity ?? null,
      activityLevel: validateShortString(data.activityLevel) ?? 'moderate',
      healthConditions: JSON.stringify(validateHealthConds(data.healthConditions) ?? []),
      wakeUpTime: validateTimeHHMM(data.wakeUpTime) ?? '07:00',
      sleepTime: validateTimeHHMM(data.sleepTime) ?? '23:00',
      cookingStyle: validateCookingStyle(data.cookingStyle) ?? 'home',
      kitchenEquipment: JSON.stringify(validateKitchenEquip(data.kitchenEquipment) ?? []),
      weeklyBudget: data.weeklyBudget || null,
      budgetCurrency: validateCurrency(data.budgetCurrency) ?? 'INR',
      waterIntakeGoal: data.waterIntakeGoal || 8,
      planDuration: data.planDuration === 14 ? 14 : 7,
      countryCode: validateCountryCode(data.countryCode) ?? null,
      eatingWindowHours: data.eatingWindowHours ?? null,
      fastingWindowHours: data.fastingWindowHours ?? null,
      eatingStartTime: validateTimeHHMM(data.eatingStartTime) ?? null,
      eatingEndTime: validateTimeHHMM(data.eatingEndTime) ?? null,
      // Group A — TDEE inputs
      trainingType:          data.trainingType          ?? 'none',
      trainingDaysPerWeek:   data.trainingDaysPerWeek   ?? 3,
      trainingDurationMins:  data.trainingDurationMins  ?? 45,
      cardioSessionsPerWeek: data.cardioSessionsPerWeek ?? 0,
      dailySteps:            data.dailySteps            ?? 5000,
      occupationType:        data.occupationType        ?? 'desk_job',
      insulinSensitivity:    data.insulinSensitivity    ?? 'average',
      // Group B — meal plan context (Claude prompt only)
      sleepQuality:      data.sleepQuality      ?? 'average',
      stressLevel:       data.stressLevel       ?? 'medium',
      recoveryCapacity:  data.recoveryCapacity  ?? 'average',
      hungerLevel:       data.hungerLevel       ?? 'medium',
      energyLevel:       data.energyLevel       ?? 'moderate',
      ...targets
    };

    const existing = await prisma.userProfile.findUnique({ where: { userId } });

    let profile;
    if (existing) {
      profile = await prisma.userProfile.update({
        where: { userId },
        data: profileData
      });
    } else {
      profile = await prisma.userProfile.create({
        data: profileData
      });
    }

    // Mark onboarding as done
    await prisma.user.update({
      where: { id: userId },
      data: { onboardingDone: true }
    });

    // Auto-insert first weight log if none exists
    const existingWeightLog = await prisma.weightLog.findFirst({ where: { userId } });
    if (!existingWeightLog) {
      await prisma.weightLog.create({
        data: { userId, weightKg: data.weightKg, note: 'Starting weight' }
      });
    }

    res.json({
      profile: {
        ...profile,
        cuisinePreferences: JSON.parse(profile.cuisinePreferences),
        allergies: JSON.parse(profile.allergies),
        preferredIngredients: JSON.parse(profile.preferredIngredients),
        avoidIngredients: JSON.parse(profile.avoidIngredients),
        healthConditions: JSON.parse(profile.healthConditions),
        kitchenEquipment: JSON.parse(profile.kitchenEquipment),
        bmi: calculateBMI(profile.weightKg, profile.heightCm)
      },
      targets
    });
  } catch (err) {
    console.error('Profile save error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error', message: 'Failed to save profile.' });
  }
});

// PATCH /api/profile/plan-duration — update plan duration preference
router.patch('/plan-duration', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { planDuration } = req.body;

    if (planDuration !== 7 && planDuration !== 14) {
      res.status(400).json({ error: 'planDuration must be 7 or 14' });
      return;
    }

    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) {
      res.status(400).json({ error: 'Profile not found' });
      return;
    }

    await prisma.userProfile.update({
      where: { userId },
      data: { planDuration }
    });

    res.json({ success: true, planDuration });
  } catch (err) {
    console.error('Plan duration update error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error', message: 'Failed to update plan duration.' });
  }
});

// PATCH /api/profile/meal-instructions — save custom meal plan instructions
router.patch('/meal-instructions', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { instructions } = req.body;

    if (typeof instructions !== 'string') {
      res.status(400).json({ error: 'Instructions must be a string' });
      return;
    }

    const trimmed = instructions.trim();
    if (trimmed.length > 500) {
      res.status(400).json({ error: 'Instructions must be 500 characters or less' });
      return;
    }

    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) {
      res.status(400).json({ error: 'Profile not found' });
      return;
    }

    await prisma.userProfile.update({
      where: { userId },
      data: {
        mealPlanCustomInstructions: trimmed,
        customInstructionsUpdatedAt: new Date()
      }
    });

    res.json({ success: true, savedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Meal instructions error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error', message: 'Failed to save instructions.' });
  }
});

export default router;
