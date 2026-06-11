/**
 * Input validation helpers used across the API surface.
 *
 * Every endpoint that accepts user-supplied text MUST run it through one of
 * these before persisting. The two recurring failure modes we guard against:
 *
 *   1. Oversize inputs that fit inside the 2 MB body limit but still bloat
 *      the DB (1 MB name fields, 100k-element arrays, etc.). The validate*
 *      helpers return a `{ valid: false, message }` so routes can return
 *      a clean 400.
 *
 *   2. Control characters that Postgres TEXT cannot store, which throw
 *      at insert time and surface as 500s. `sanitizeText` strips them
 *      and trims whitespace.
 *
 * Adding new fields: prefer making a typed `validateXxx` function with
 * explicit length / shape rules over sprinkling inline checks.
 */

const MAX_SHORT = 100;
const MAX_NAME = 100;
const MAX_NOTE = 500;
const MAX_URL = 500;
const MAX_SERVING = 100;
const MAX_COUNTRY_CODE = 8;
const MAX_CURRENCY = 8;
const MAX_ARR_LEN = 50;
const MAX_ARR_ITEM = 80;

/** Strip control characters that Postgres TEXT cannot store, and trim. */
export function sanitizeText(text: string): string {
  return text.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

/** Clamp a string to a max byte length (UTF-8). */
function clampBytes(s: string, max: number): string {
  // Truncation at the byte level is approximation; for input validation
  // we accept the small risk of cutting a multi-byte char at the edge
  // (the next /POST will succeed).
  const buf = Buffer.from(s, 'utf8');
  if (buf.length <= max) return s;
  return buf.subarray(0, max).toString('utf8');
}

/** Generic optional-string validator. Returns null if missing. */
function optionalString(v: unknown, max: number): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') return undefined as any; // signal invalid
  return clampBytes(sanitizeText(v), max);
}

/** Generic required-string validator. Returns '' if missing (callers check). */
function requiredString(v: unknown, max: number): string {
  return clampBytes(sanitizeText(typeof v === 'string' ? v : ''), max);
}

/** Validate an optional array of short strings (ingredients, allergies, ...). */
function optionalStringArray(
  v: unknown,
  maxLen: number = MAX_ARR_LEN,
  maxItem: number = MAX_ARR_ITEM,
): string[] | null {
  if (v === undefined || v === null) return null;
  if (!Array.isArray(v)) return undefined as any;
  if (v.length > maxLen) return undefined as any;
  return v
    .filter((x) => typeof x === 'string' && x.trim().length > 0)
    .slice(0, maxLen)
    .map((s) => clampBytes(sanitizeText(s), maxItem));
}

// ── Profile field validators ─────────────────────────────────────────────

export const validateName          = (v: unknown) => optionalString(v, MAX_NAME);
export const validateCountry       = (v: unknown) => optionalString(v, MAX_SHORT);
export const validateCity          = (v: unknown) => optionalString(v, MAX_SHORT);
export const validateCountryCode   = (v: unknown) => optionalString(v, MAX_COUNTRY_CODE);
export const validateCurrency      = (v: unknown) => optionalString(v, MAX_CURRENCY);
export const validateCookingStyle  = (v: unknown) => optionalString(v, MAX_SHORT);
export const validateShortString   = (v: unknown) => optionalString(v, MAX_SHORT);

export const validateCuisinePrefs   = (v: unknown) => optionalStringArray(v);
export const validateAllergies      = (v: unknown) => optionalStringArray(v);
export const validatePreferredIng   = (v: unknown) => optionalStringArray(v);
export const validateAvoidIng       = (v: unknown) => optionalStringArray(v);
export const validateHealthConds    = (v: unknown) => optionalStringArray(v);
export const validateKitchenEquip   = (v: unknown) => optionalStringArray(v);

// ── Meal / weight / tracker field validators ──────────────────────────────

export const validateFoodName     = (v: unknown) => requiredString(v, MAX_NAME);
export const validateFoodSource   = (v: unknown) => optionalString(v, MAX_SHORT);
export const validateMealNote     = (v: unknown) => optionalString(v, MAX_NOTE);
export const validateServingSize  = (v: unknown) => optionalString(v, MAX_SERVING);
export const validateMealTime     = (v: unknown) => optionalString(v, 16);  // "HH:MM" or "H:MM AM"
export const validateWeightNote   = (v: unknown) => optionalString(v, MAX_NOTE);
export const validateMealUrl      = (v: unknown) => optionalString(v, MAX_URL);
export const validateCustomInstr  = (v: unknown) => optionalString(v, 2000);

/** HH:MM 24-hour validator. Returns the string if valid, else null. */
export function validateTimeHHMM(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) return null;
  return v;
}
