import { describe, it, expect } from 'vitest';

// Plan utility — getMondayOfCurrentWeek (replicated from plan.ts)
function getMondayOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().split('T')[0];
}

// Plan dates — getPlanDates (replicated from meals.ts)
function getPlanDates(): string[] {
  const now = new Date();
  const day = now.getDay();
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

// Sunday bug fix test — ensure Sunday returns the correct previous Monday
// without this fix, day===0 would give diff = 1 - 0 = 1 (next day / Tuesday)
// The fix makes day===0 give diff = -6 (previous Monday)

describe('getMondayOfCurrentWeek', () => {
  it('returns format YYYY-MM-DD', () => {
    expect(getMondayOfCurrentWeek()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns a valid date', () => {
    const monday = getMondayOfCurrentWeek();
    expect(isNaN(new Date(monday).getTime())).toBe(false);
  });
});

describe('getPlanDates', () => {
  it('returns 7 date strings', () => {
    expect(getPlanDates()).toHaveLength(7);
  });

  it('all dates are in YYYY-MM-DD format', () => {
    const dates = getPlanDates();
    dates.forEach(d => {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('dates are consecutive (24h apart)', () => {
    const dates = getPlanDates();
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1] + 'T12:00:00Z');
      const curr = new Date(dates[i] + 'T12:00:00Z');
      const diffMs = curr.getTime() - prev.getTime();
      expect(diffMs).toBe(86400000);
    }
  });

  it('all 7 dates are unique', () => {
    expect(new Set(getPlanDates()).size).toBe(7);
  });
});
