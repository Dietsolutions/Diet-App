/**
 * Feature switches for things that exist in the code but are not offered to
 * users yet. Mirrors client/src/lib/features.ts — the two are separate builds,
 * so both have to be flipped together when a feature comes back.
 */

/**
 * 14-day plans. Generation still supports them end to end (prompt, token
 * budget, timeout and validation all branch on planDuration), so this only
 * withholds the choice.
 */
export const FOURTEEN_DAY_PLANS_ENABLED = false;

/**
 * The plan length to actually use. Accounts that saved 14 before it was
 * withdrawn would otherwise keep generating 14-day plans, since the stored
 * value outlives the UI that set it.
 */
export function resolvePlanDuration(stored: unknown): 7 | 14 {
  return stored === 14 && FOURTEEN_DAY_PLANS_ENABLED ? 14 : 7;
}
