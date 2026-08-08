# Migrate Planyourplate from Strain v2 (warm-dark) to Fresh Light

You are migrating the client UI of this repo from its current **Strain v2 warm-dark** theme to a
new **Fresh Light** design. The new design exists as a set of reference React files (see Phase 0).
Work in phases, commit after each, and run `npm run typecheck` before every commit.

Do not redesign anything on your own initiative. Where this document and the reference files
disagree, the reference files win. Where both are silent, keep the current behaviour.

---

## Phase 0 — Setup

1. The design reference lives in `design-reference/` (the user will add it). It contains:
   - `v3-theme.jsx` — token object + 12 styling primitives. **This is the spec for the new look.**
   - `v3-screens-*.jsx` — one file per screen group, each a faithful render of the target design.
   - `Planyourplate - Full App v4.html` — opens the whole set as a browsable canvas.
   Read `v3-theme.jsx` first, in full. Every value in this prompt is taken from it.

2. Add the two new fonts to `client/index.html`, replacing the Strain font link:
   ```html
   <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
   ```
   Keep `preconnect`. Remove Space Grotesk, IBM Plex Mono, DM Mono, DM Sans and Fraunces if
   nothing else references them.

3. Update `client/tailwind.config.js` `fontFamily`:
   ```js
   sans: ["'Plus Jakarta Sans'", 'system-ui', 'sans-serif'],
   disp: ["'Archivo'", 'system-ui', 'sans-serif'],
   ```
   Leave the `mono` key present but pointed at Plus Jakarta Sans (see Phase 1, note on `mono`).

---

## Phase 1 — The token layer

**Why this is the whole ballgame:** there are 836+ references to `s2.*` across
`client/src/components/`, virtually all inside inline `style={{ }}` objects. Rewriting
`client/src/theme/tokens.ts` while **keeping every existing key name** flips most of the app in
one edit. Add new keys; do not rename or remove existing ones in this phase.

Replace `client/src/theme/tokens.ts` with:

```ts
// Fresh Light design tokens — single source of truth
export const s2 = {
  // ── Surfaces (NOTE: elevation direction is inverted vs the old dark theme) ──
  bg:         '#F2F1EC',   // page background (was the darkest colour; now the *tinted* one)
  bg2:        '#FFFFFF',   // raised from page
  surface:    '#FFFFFF',   // cards
  surface2:   '#F2F1EC',   // nested raise inside a white card
  ink:        '#0F140F',   // NEW — near-black, for dark cards and dark buttons
  ink2:       '#19201A',
  // ── Borders ──
  line:       'rgba(15,20,15,0.08)',
  lineStrong: 'rgba(15,20,15,0.18)',
  lineDark:   'rgba(246,247,243,0.12)',   // NEW — borders on ink surfaces
  // ── Text ──
  text:       '#0F140F',
  textDim:    'rgba(15,20,15,0.56)',
  textDimmer: 'rgba(15,20,15,0.34)',
  onDark:     '#F6F7F3',                  // NEW — text on ink
  onDarkDim:  'rgba(246,247,243,0.56)',   // NEW
  onDarkDimmer:'rgba(246,247,243,0.32)',  // NEW
  // ── Accent ──
  // Split deliberately. Lime is a FILL colour; it fails contrast as text on white.
  accent:     '#5F8C12',   // accent TEXT and strokes on light surfaces
  accentSoft: '#9FD62B',   // mid lime — chart strokes, secondary accent text
  accentFill: '#C6F24E',   // block fill; always pair with `color: s2.ink`
  accentWash: '#E9FBB8',   // NEW — tinted panel background
  warn:       '#E5484D',
  // ── Pastels (NEW — used for summary cards and category tints) ──
  peach:      '#FFC3A2',
  lilac:      '#CBB8F9',
  mint:       '#A9E8BE',
  butter:     '#FFDF8A',
  sky:        '#A9D9F2',
  // ── Macro colours (retuned for light backgrounds) ──
  protein:    '#6FB93B',
  carbs:      '#F2B93B',
  fat:        '#FF8A6B',
  fibre:      '#59C7B4',
  water:      '#63B8E8',
  // Darker variants for macro TEXT on white — the fills above are too light to read.
  proteinText:'#4A7D22',
  carbsText:  '#B0871C',
  fatText:    '#C4573A',
  fibreText:  '#2F8C7C',
  waterText:  '#1F7FB8',
  // ── Typography ──
  disp:       "'Archivo', system-ui, sans-serif",        // NEW — numerals and headlines
  sans:       "'Plus Jakarta Sans', system-ui, sans-serif",
  mono:       "'Plus Jakarta Sans', system-ui, sans-serif", // repointed; see note
  // ── Radius (NEW — Strain was square, Fresh Light is heavily rounded) ──
  rSm: 12, rMd: 18, rLg: 24, rXl: 32, rPill: 999,
} as const;
```

**Note on `mono`:** the old design used IBM Plex Mono for every number and kicker label. Fresh
Light has no mono face. Repointing the key keeps all 400-odd call sites compiling. Where the text
is a *column of numbers* (charts, macro tables), add `fontVariantNumeric: 'tabular-nums'` so the
digits still align. Two chart files hardcode the family and must be edited by hand:
`client/src/components/MonthlyCalorieChart.tsx` (lines ~414, ~419) and
`client/src/components/weight/WeightProgressChart.tsx` (lines ~115, ~127) — replace
`'IBM Plex Mono, monospace'` with `'Plus Jakarta Sans, system-ui, sans-serif'`.

### The three traps a token swap will NOT catch

These are contrast inversions. Fix each by grep, not by eye.

**Trap 1 — dark text on accent fills.** The old code writes near-black text on orange with
`color: s2.bg`, because `s2.bg` used to be near-black. It is now near-white.
```
grep -rn "s2\.accent" client/src --include=*.tsx -A2 -B2 | grep "s2\.bg"
```
Every hit where `s2.accent` is a `background` and `s2.bg` is the `color` must become
`background: s2.accentFill, color: s2.ink`.

**Trap 2 — hardcoded Strain hex literals.** Some components bypass the token object.
```
grep -rn "#0C0907\|#120D0A\|#17110C\|#1F1812\|#F5EFE8\|#FF6A2A\|#FFB066\|#FF3E3E" client/src
```
Known: `BrowseRecipesTab.tsx:453` uses `'#0C0907'` as the text colour on an active accent pill →
`s2.ink`. `AuthScreen.tsx:409` uses `'#4CAF82'` and `'#FF3E3E'` for password strength → map to
`s2.accent` / `s2.warn`. Resolve every hit.

**Trap 3 — the global stylesheet.** `client/src/index.css` hardcodes the dark theme in `@layer base`:
- `body { background-color: #0C0907; color: #F5EFE8; }` → `#F2F1EC` / `#0F140F`
- `html { font-family: 'Space Grotesk', ... }` → `'Plus Jakarta Sans', system-ui, sans-serif`
- the `.shimmer` utility uses purple `#7B6CF6` gradients → restyle to lime
  (`#C6F24E → #E9FBB8 → #C6F24E`) or delete it if the AI buttons no longer shimmer.
- `.card-glow` is `inset 0 1px 0 rgba(255,255,255,0.04)` — an inner highlight that only reads on
  dark. On white it does nothing; either remove it or swap to a soft drop shadow.

### Native shell
This is a Capacitor app (`@capacitor/status-bar` is a dependency). A light theme needs dark status
bar content. Find the `StatusBar.setStyle` call (likely `client/src/main.tsx` or `App.tsx`) and
switch `Style.Dark` → `Style.Light`, and any `setBackgroundColor` to `#F2F1EC`. Also update
`theme-color` in `client/index.html` and the PWA manifest.

---

## Phase 2 — The three shared primitives

`client/src/components/ui/` holds `Card.tsx`, `HairLabel.tsx` and `Pill.tsx`. They are used
throughout, so restyling these three propagates further than any other edit. Match them to the
reference primitives in `v3-theme.jsx`:

| Repo primitive | Reference | Target |
| --- | --- | --- |
| `Card.tsx` | `V3Card` | `background: s2.surface`, `borderRadius: s2.rLg` (24), `padding: 18`, `border: 1px solid transparent`, `transition: transform 200ms ease-out`. Accept a `bg` prop so callers can pass pastels and `s2.ink`. |
| `HairLabel.tsx` | `V3Kick` | 10px `s2.sans`, weight 700, `letterSpacing: 0.14em`, uppercase, `color: s2.textDimmer`. (Was 9px IBM Plex Mono.) |
| `Pill.tsx` | `V3Chip` | `borderRadius: s2.rPill`, `padding: 6px 11px`, 11px weight 600, `background: s2.bg`, `letterSpacing: -0.01em`, `whiteSpace: nowrap`. |

Then add the primitives the new design relies on that have no repo equivalent. Port them from
`v3-theme.jsx` as real TSX components in `client/src/components/ui/`:
`Btn` (V3Btn — 6 kinds: lime/dark/light/ghost/onDark/warn, pill-shaped),
`Ring` (V3Ring — donut gauge with a dashed-remainder track),
`Bar` (V3Bar — rounded progress bar),
`Check` (V3Check — round checkbox),
`IconBtn` (V3IconBtn — circular icon button),
`Row` (V3Row — label-left/value-right list row),
`H` (V3H — Archivo display headline, `letterSpacing: -0.042em`).

---

## Phase 3 — Screens

Restyle in this order. For each, open the matching reference file, match layout and spacing, and
**keep all existing state, props, handlers and data flow**. This is a re-skin plus the specific
structural changes listed.

| # | Repo file(s) | Reference | Structural change beyond restyling |
| --- | --- | --- | --- |
| 1 | `BottomNav.tsx` | `v3-chrome.jsx` | Rounded/pill active treatment. Still 6 tabs. Active colour `s2.accent`, inactive `s2.textDimmer`. |
| 2 | `AuthScreen.tsx` | `v3-screens-profile.jsx` → `V3Auth` | Login/Sign-up becomes a **pill segmented toggle**, not underlined tabs. The medical disclaimer moves out of the body into a **link** sitting beside Privacy Policy and Terms of Service. Google + Apple buttons side by side. |
| 3 | `MealsTab.tsx`, `MacroBand.tsx`, `MealRow.tsx` | `v3-screens-mealstab.jsx` | Calorie ring, macro tiles including **fibre**, rounded meal cards. |
| 4 | `MealDetailSheet.tsx` | `v3-screens-mealdetail.jsx` | Photo hero, macro tiles, Ingredients/Steps tabs, servings stepper, language pills, impact card. The `isReplaced` state is the **same component with a flag**, not a second layout — keep it that way. |
| 5 | `TrackerTab.tsx` | `v3-screens-tracker.jsx` → `V3Tracker` | **Largest change.** Three pastel summary cards; a dark (`s2.ink`) chart card with a 7-metric switcher; a plan-adherence month calendar; a day-detail card. Needs new data — see Phase 4. |
| 6 | `MonthlyCalorieChart.tsx` | `v3-screens-profile.jsx` → `V3Kcal` | Adds Daily avg / Under target / Over target cells that **recompute per macro tab**. Needs Phase 4 item 4. |
| 7 | `WaterDetailSheet.tsx`, `WaterIntakeCard.tsx` | `v3-screens-tracker.jsx` → `V3Water` | Ring hero on a sky card, 5-column glass grid, quick-add row, 7-day bar chart. **1 glass stays 250 ml, goal stays 10 glasses / 2.5 L** — do not change these to match any older mock. |
| 8 | `ProfileTab.tsx` | `v3-screens-profile.jsx` → `V3Profile` | Restructured as grouped cards. All existing controls retained. |
| 9 | `Onboarding.tsx` | `v3-screens-onboard7.jsx` | **See Phase 5 — this one has a deliberate spec change.** |
| 10 | `BrowseRecipesTab.tsx`, `ShoppingTab.tsx`, `TipsTab.tsx` | `v3-screens-recipes.jsx`, `v3-screens-core.jsx` | Restyle only. |
| 11 | `MealReplacer*.tsx`, `FoodResultCard.tsx` | `v3-screens-replacer.jsx` | Restyle only. Result cards keep the 5 macro cells and source tag. |
| 12 | `NotificationSettings.tsx`, `weight/*`, `ResetPasswordScreen.tsx` | `v3-screens-*.jsx` | Restyle only. |

---

## Phase 4 — Data the new design needs and the app cannot yet provide

Four items. Each needs a hook or endpoint change, not a component change. Build these **before**
Phase 3 item 5, or stub them behind a feature flag and land the UI dark.

**1. Per-day macro series (Tracker metric switcher)**
The switcher charts 14 days for each of Calories, Protein, Carbs, Fat, Fibre, Water and Adherence.
`hooks/useTracker.ts` exposes no per-day macro series today — only the monthly calorie aggregate.
Add a daily aggregate per macro: `{ date, consumed, target }[]` over a rolling window.
Water and adherence already have per-day data; the four macros do not.

**2. Per-day meal counts (Tracker day-detail card)**
The card reads "Day 17 of 49 · Wednesday, 22 Apr · 3 / 4 eaten · 75% logged" for a selected date,
with a **Mark all eaten** action. Needs meal counts addressable by date (eaten vs planned) and a
bulk mutation for a given day.

**3. Per-day adherence % (Tracker month calendar)**
Each cell is tinted 0–100%. Derivable from existing meal logs but not currently aggregated or
exposed. Return `{ date, adherencePct }[]` for the visible month.
Cross-check the totals: the calendar, the "this week" card and the "this month" card must agree.

**4. Per-macro monthly reductions (Monthly macros screen)**
`MonthlyCalorieChart.tsx` computes daily-average / days-under / days-over for **calories only**.
The design shows those three figures recomputing for whichever macro tab is selected. Generalise
the reduction to run per macro.

---

## Phase 5 — Onboarding: a deliberate spec change

The app has **7 onboarding steps**. The approved design has **5**, by grouping — no field was
removed. Implement the 5-step grouping:

1. **About you** — name, age, gender, current weight, height, target weight, country, city
2. **How you eat** — diet preference, cuisines, meals/day, eating window (including a custom
   window with start/end times and fasting hours), allergens
3. **Foods you love** — proteins, vegetables, fruits, dairy, grains
4. **Foods to avoid** — the skip list, plus a free-text "other"
5. **Goals & routine** — primary goal, intensity, activity level, training type, medical
   conditions, equipment, sleep/stress/recovery/hunger/energy/insulin, water goal, plan duration

Rules carried over from the design review:
- Every field in `OnboardingData` is retained. Verify against `client/src/types/index.ts` before
  you finish — an earlier draft silently dropped fields, and that must not recur.
- Long option lists (56 countries, 57 cuisines, 14 allergens) are **searchable**, not walls of chips.
  Country and city are compact single-selects: a field showing the current value, with results
  appearing only while typing.
- Allergens and Foods-to-avoid each get exactly **one** search zone, with the free-text "other"
  folded in underneath it as a `+ Not listed? Add your own` input. Do not add a second search field
  at the bottom of the step.
- The slide-to-continue CTA appears **only on the final step**. Steps 1–4 use a plain tap button.
- Estimated TDEE is shown on step 5, where activity and training make it derivable — not earlier.
- **Weekly budget / currency stays out.** It exists in `OnboardingData` defaults but is never
  rendered as an input in the current `Onboarding.tsx`; the design intentionally omits it.
- Step 5 uses collapsible groups (Activity & training / Body signals / Kitchen & rhythm) to keep
  the screen short. Nothing inside them is removed.

---

## Phase 6 — Brand rename

The product is no longer "AI-DPT". It is **Planyourplate** (wordmark rendered "Plan Your Plate" in
the app header and logo lockup; lowercase "planyourplate" on marketing surfaces). Update the app
name, splash, manifest, page titles, auth screen lockup, and any user-visible string. The tagline
under the auth logo is **"YOUR NUTRITION COMPANION"**.

---

## Phase 7 — Verification

1. `npm run typecheck` clean.
2. `npm run test:all`.
3. `npm run test:e2e` — expect selector churn; update tests, do not delete them.
4. Grep for stragglers: `grep -rn "#0C0907\|Space Grotesk\|IBM Plex\|AI-DPT" client/src client/index.html`
   should return nothing.
5. Walk every screen on device or in the browser at 402×874 and compare against the reference
   canvas. Check specifically for:
   - light-on-light text where an old `color: s2.bg` survived
   - lime fills with unreadable text (must be `s2.ink`)
   - square corners left over on cards, buttons and inputs
   - numeric columns that no longer align (add `tabular-nums`)
6. Contrast-check every accent text colour against its background at WCAG AA. `#C6F24E` on white
   is **not** readable — that is what `s2.accent` (`#5F8C12`) is for.

---

## Ground rules

- Keep every existing prop, handler, hook and data flow unless this document says otherwise.
- Do not invent copy. Where the reference shows placeholder text, keep the app's current string.
- Do not delete tests.
- Commit per phase with a clear message.
- If the reference files and the repo disagree on a **number** (a goal, a serving size, a target),
  the repo is the source of truth for data and the reference is the source of truth for looks.
  The one exception is the onboarding step grouping in Phase 5, which is an approved spec change.
