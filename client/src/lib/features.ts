/**
 * Feature switches for things that exist in the code but are not offered to
 * users yet. Each one is a single boolean so re-enabling is a one-line change
 * rather than an archaeology exercise.
 */

/**
 * 14-day plans. The generation path still supports them end to end — the
 * prompt, token budget, timeout and validation all branch on planDuration — so
 * this only hides the choice. The server clamps to 7 as well; the UI alone
 * would not stop an account whose profile was already saved at 14.
 */
export const FOURTEEN_DAY_PLANS_ENABLED = false;
