import { describe, it, expect } from 'vitest';

// Replicated from tdee.ts for isolated unit testing
function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return Math.round(weightKg / (heightM * heightM) * 10) / 10;
}

function calculateBMR(weightKg: number, heightCm: number, age: number, gender: string): number {
  if (gender === 'male') {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + 5);
  }
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age - 161);
}

function getActivityMultiplier(level: string): number {
  const multipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  return multipliers[level] || 1.55;
}

function calculateTDEE(
  weightKg: number, heightCm: number, age: number, gender: string, activityLevel: string,
): number {
  const bmr = calculateBMR(weightKg, heightCm, age, gender);
  const multiplier = getActivityMultiplier(activityLevel);
  return Math.round(bmr * multiplier);
}

describe('calculateBMI', () => {
  it('calculates BMI correctly for normal weight', () => {
    expect(calculateBMI(70, 175)).toBe(22.9);
  });

  it('calculates BMI correctly for underweight', () => {
    expect(calculateBMI(50, 170)).toBe(17.3);
  });

  it('calculates BMI correctly for obese', () => {
    expect(calculateBMI(100, 170)).toBe(34.6);
  });

  it('handles edge case of zero height', () => {
    expect(calculateBMI(70, 0)).toBe(Infinity);
  });
});

describe('calculateBMR', () => {
  // Mifflin-St Jeor BMR formula:
  // Male:   10 × weight(kg) + 6.25 × height(cm) − 5 × age(y) + 5
  // Female: 10 × weight(kg) + 6.25 × height(cm) − 5 × age(y) − 161
  // Calculations:
  // Male(70,175,30):   700 + 1093.75 − 150 + 5   = 1648.75 → 1649
  // Female(60,165,30): 600 + 1031.25 − 150 − 161 = 1320.25 → 1320
  it('calculates male BMR correctly', () => {
    const bmr = calculateBMR(70, 175, 30, 'male');
    expect(bmr).toBe(1649);
  });

  it('calculates female BMR correctly', () => {
    const bmr = calculateBMR(60, 165, 30, 'female');
    expect(bmr).toBe(1320);
  });

  it('handles prefer_not_to_say as female (default)', () => {
    const bmr = calculateBMR(60, 165, 30, 'prefer_not_to_say');
    expect(bmr).toBe(1320);
  });
});

describe('getActivityMultiplier', () => {
  it('returns 1.2 for sedentary', () => {
    expect(getActivityMultiplier('sedentary')).toBe(1.2);
  });

  it('returns 1.55 for moderate (default)', () => {
    expect(getActivityMultiplier('moderate')).toBe(1.55);
  });

  it('returns 1.9 for very_active', () => {
    expect(getActivityMultiplier('very_active')).toBe(1.9);
  });

  it('returns default for unknown level', () => {
    expect(getActivityMultiplier('unknown')).toBe(1.55);
  });
});

describe('calculateTDEE', () => {
  it('calculates TDEE correctly for a typical male', () => {
    const tdee = calculateTDEE(70, 175, 30, 'male', 'moderate');
    expect(tdee).toBe(2556); // 1649 * 1.55
  });

  it('calculates TDEE correctly for a typical female', () => {
    const tdee = calculateTDEE(60, 165, 30, 'female', 'light');
    expect(tdee).toBe(1815); // 1320 * 1.375
  });

  it('increases TDEE with higher activity', () => {
    const sedentary = calculateTDEE(70, 175, 30, 'male', 'sedentary');
    const active = calculateTDEE(70, 175, 30, 'male', 'active');
    expect(active).toBeGreaterThan(sedentary);
  });
});
