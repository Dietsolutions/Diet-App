/**
 * Maps a calendar date to a plan day index using modulo arithmetic.
 * Returns -1 only if the date is before the plan started.
 * For any date on or after plan start, cycles 0 → planDuration-1 indefinitely.
 */
export function getPlanDayIndex(
  dateStr: string,
  planStartStr: string | null,
  planDuration: number,
): number {
  if (!planStartStr || !planDuration) return -1;
  const d = new Date(dateStr     + 'T00:00:00'); d.setHours(0, 0, 0, 0);
  const s = new Date(planStartStr + 'T00:00:00'); s.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - s.getTime()) / 86400000);
  if (diffDays < 0) return -1;
  return diffDays % planDuration;
}
