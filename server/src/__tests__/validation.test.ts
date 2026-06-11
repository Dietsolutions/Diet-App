import { describe, it, expect } from 'vitest';

// Replicated validation helpers for isolated unit testing
function validateFoodName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim().slice(0, 200);
  return trimmed.length > 0 ? trimmed : null;
}

function validateMealNote(note: unknown): string | null {
  if (typeof note !== 'string') return null;
  return note.trim().slice(0, 500);
}

function validateMealTime(time: unknown): string | null {
  if (typeof time !== 'string') return null;
  return time.trim().slice(0, 50);
}

function validateFoodSource(source: unknown): string | null {
  if (typeof source !== 'string') return null;
  const ALLOWED = ['usda', 'open_food_facts', 'calorie_ninjas', 'indian_food', 'manual', 'ai_estimate'];
  return ALLOWED.includes(source) ? source : 'manual';
}

describe('validateFoodName', () => {
  it('accepts valid food name', () => {
    expect(validateFoodName('Chicken Breast')).toBe('Chicken Breast');
  });

  it('rejects non-string', () => {
    expect(validateFoodName(null)).toBeNull();
    expect(validateFoodName(undefined)).toBeNull();
    expect(validateFoodName(123)).toBeNull();
  });

  it('trims whitespace', () => {
    expect(validateFoodName('  Rice  ')).toBe('Rice');
  });

  it('caps at 200 chars', () => {
    const long = 'a'.repeat(300);
    expect(validateFoodName(long)!.length).toBe(200);
  });

  it('rejects empty after trim', () => {
    expect(validateFoodName('   ')).toBeNull();
  });
});

describe('validateMealNote', () => {
  it('accepts valid note', () => {
    expect(validateMealNote('Grilled')).toBe('Grilled');
  });

  it('rejects non-string', () => {
    expect(validateMealNote(null)).toBeNull();
  });

  it('caps at 500 chars', () => {
    const long = 'a'.repeat(1000);
    expect(validateMealNote(long)!.length).toBe(500);
  });

  it('returns empty string for empty note', () => {
    expect(validateMealNote('')).toBe('');
  });
});

describe('validateFoodSource', () => {
  it('accepts allowed sources', () => {
    expect(validateFoodSource('usda')).toBe('usda');
    expect(validateFoodSource('open_food_facts')).toBe('open_food_facts');
    expect(validateFoodSource('calorie_ninjas')).toBe('calorie_ninjas');
    expect(validateFoodSource('ai_estimate')).toBe('ai_estimate');
  });

  it('falls back to manual for unknown sources', () => {
    expect(validateFoodSource('unknown')).toBe('manual');
    expect(validateFoodSource('')).toBe('manual');
  });

  it('rejects non-string with null', () => {
    expect(validateFoodSource(null)).toBeNull();
  });
});

describe('validateMealTime', () => {
  it('accepts valid time string', () => {
    expect(validateMealTime('08:00 AM')).toBe('08:00 AM');
  });

  it('rejects non-string', () => {
    expect(validateMealTime(undefined)).toBeNull();
  });

  it('trims whitespace', () => {
    expect(validateMealTime('  12:00  ')).toBe('12:00');
  });
});
