# Handoff: Strain v2 — Full UI Redesign for AI-DPT

## Overview
This handoff is a complete UI redesign of the **Fat-Loss Meal Plan Tracker** (`ai-diet-plan-track`) app. It reimagines every screen in a "Strain" aesthetic — warm-dark performance-tracker vibe with **molten orange** as the accent, **Space Grotesk** for display, and **IBM Plex Mono** for data. All existing views, information, and flows are preserved; only the visual system and layout change.

The redesign covers:
- Auth (Sign in)
- Onboarding (Welcome, Body stats, Goal, Diet, AI Generating)
- 5 core tabs: Meals/Today, Tracker, Shopping, Tips, Profile
- Flows: Meal Detail, Water, Monthly kcal, Meal Replacer, Add Meal, Weight Log, Customise, Regenerate plan, Meal Prep

## About the Design Files
The files in this bundle are **design references built in HTML + React + Babel** — prototypes that show the intended look and behavior, **not production code to copy verbatim**. The task is to **recreate these designs inside the existing `ai-diet-plan-track` codebase** (React + TypeScript + Vite + TailwindCSS + Firestore), preserving all existing logic (auth hooks, Firestore reads/writes, API calls to the meal replacer, PWA setup) and only replacing the UI layer.

Map the mockup screens to the existing component tree (roughly):
| Mock file | Existing component to update |
|---|---|
| `s2-screens-core.jsx → S2Meals` | `client/src/components/MealsTab.tsx` (Today view) |
| `s2-screens-core.jsx → S2Tracker` | `client/src/components/TrackerTab.tsx` |
| `s2-screens-core.jsx → S2Shopping` | Shopping list within `MealsTab` or a dedicated `ShoppingTab` |
| `s2-screens-core.jsx → S2Tips` | Tips view |
| `s2-screens-core.jsx → S2Profile` | `client/src/components/ProfileTab.tsx` |
| `s2-screens-meals.jsx → S2MealDetail` | Meal detail sheet inside `MealsTab` |
| `s2-screens-meals.jsx → S2Water` | Water intake card/sheet |
| `s2-screens-meals.jsx → S2Kcal` | Monthly kcal detail view |
| `s2-screens-flow.jsx` | Modals/sheets: Meal Replacer, Add Meal, Weight Log, Customise, Regen, Meal Prep |
| `s2-screens-onboard.jsx` | Onboarding flow + sign-in |
| `s2-chrome.jsx → S2Scaffold / S2BottomNav / S2TopBar` | `client/src/components/BottomNav.tsx` + app shell |

## Fidelity
**High-fidelity.** Exact colors, typography, spacing, and interactions are finalized. Recreate pixel-perfectly using Tailwind utilities + the design tokens below. The HTML prototypes use inline styles for speed — in the real codebase these should become Tailwind classes or a `theme.ts` config extension.

---

## Design Tokens

### Colors (warm-dark Strain palette)
```ts
// Drop into client/src/theme/tokens.ts or extend tailwind.config.ts

export const strain = {
  // Backgrounds (warm-black, not pure #000)
  bg:         '#0C0907',
  bg2:        '#120D0A',
  surface:    '#17110C',
  surface2:   '#1F1812',

  // Lines (warm translucent — never pure white borders)
  line:       'rgba(255, 182, 128, 0.08)',
  lineStrong: 'rgba(255, 182, 128, 0.18)',

  // Text
  text:       '#F5EFE8',
  textDim:    'rgba(245, 239, 232, 0.55)',
  textDimmer: 'rgba(245, 239, 232, 0.32)',

  // Accent (molten orange)
  accent:     '#FF6A2A',
  accentSoft: '#FFB066',
  accentFill: 'rgba(255, 106, 42, 0.14)',
  warn:       '#FF3E3E',

  // Macros (warm-tuned quartet)
  protein:    '#FF6A2A', // orange
  carbs:      '#C9A3FF', // lilac
  fat:        '#FFD166', // amber
  fibre:      '#7CE0C4', // teal

  // On-accent text color (for buttons filled with accent)
  onAccent:   '#0C0907',
} as const;
```

### Typography
- **Display / body:** `'Space Grotesk', system-ui, sans-serif` (weights 300, 400, 500, 600, 700)
- **Mono / data / kickers:** `'IBM Plex Mono', ui-monospace, monospace` (weights 400, 500, 600)

Add to `client/index.html` in `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

### Type scale (observed in the mockups)
| Role | Size | Weight | Tracking | Font |
|---|---|---|---|---|
| Hero metric (large numbers like 1,265 kcal) | 72–96px | 200–300 | -0.04em to -0.05em | Space Grotesk |
| Screen title | 28px | 300–400 | -0.03em | Space Grotesk |
| Card title | 18–22px | 400 | -0.01em | Space Grotesk |
| Body | 13–14px | 400 | 0 | Space Grotesk |
| Data / values | 11–13px | 500 | -0.01em | IBM Plex Mono |
| **Hair label** (the micro-caps on every card) | 9px | 500 | **0.22em uppercase** | IBM Plex Mono |
| Button text | 10–11px | 600 | 0.2em uppercase | IBM Plex Mono |

### Spacing / sizing
- Screen edge padding: **20–24 px** horizontal, varies vertical
- Card internal padding: **14–20 px**
- Section gap: **22–28 px**
- Border radius: **0** everywhere (sharp corners are a core part of the aesthetic — do not round anything)
- Bar thickness for progress: **3 px**
- Border width: **1 px** using `line` or `lineStrong`

### Core visual rules (must-follow for the aesthetic to land)
1. **No rounded corners anywhere.** Cards, buttons, images, inputs — all `rounded-none`.
2. **Every card/section has a hair label** (tiny IBM Plex Mono uppercase kicker in `textDimmer`) above it.
3. **Numbers are huge and light-weighted** (Space Grotesk 200/300) with tight negative tracking.
4. **Borders are warm translucent** (`rgba(255,182,128,0.08)`), never pure white / gray / black.
5. **Primary CTA = solid accent fill + black text + uppercase mono label.**
6. **Secondary CTA = transparent bg + `lineStrong` border + light text + uppercase mono label.**
7. Macro colors never deviate — protein always orange, carbs lilac, fat amber, fibre teal.

---

## Screens & Behavior

### 1. Auth — Sign In (`s2-screens-onboard.jsx → S2SignIn`)
Warm-black bg, centered logo "AI-DPT" in Space Grotesk 300 with accent dot, "GET STARTED" kicker. Two stacked buttons: primary "SIGN IN WITH GOOGLE" (accent fill), secondary "CONTINUE AS GUEST". Preserves existing `useAuth` hook behavior.

### 2. Onboarding flow (4 steps + 1 generating)
- **Welcome:** one-sentence value prop, big accent "BEGIN" button
- **Body stats:** stepper inputs for age / weight / height / sex — huge mono numerals, +/- buttons
- **Goal:** three cards (Fat loss / Maintain / Muscle), tapping one highlights with accent border
- **Diet:** checkbox grid (Veg / Non-veg / Eggs / Jain / Gluten-free…) — existing backend mapping
- **Generating:** full-screen "AI-GENERATING YOUR PLAN" loader with a pulsing mono progress strip and rotating status lines ("ANALYSING MACROS…", "BALANCING WEEK…", etc.)

State at the end is the same `User` + `MealPlan` objects the current app already writes to Firestore.

### 3. Meals / Today tab (`S2Meals`)
- **Header:** kicker "TODAY · MON 24", title "Meals", right: big accent number `logged / total meals`
- **Kcal hero card:** `currentKcal / targetKcal` with 3px progress bar, delta pill ("ON PACE")
- **Water card** (small, tappable → water sheet): `L consumed / L goal`, 10 tiny glasses row
- **Macros quartet:** 4 small bars P / C / F / Fi, each in its macro color with `current / target g`
- **Meal list:** one row per meal of the day — chip showing `LUNCH / DINNER / SNACK`, meal name, `kcal · P/C/F`, status dot (LOGGED accent / PENDING dim / SKIPPED warn). Tapping a row → Meal Detail.
- **Floating "+ ADD MEAL" button** bottom-right, triggers Add Meal sheet.
- Week strip at top (Mon–Sun) for day selection.

### 4. Meal Detail (`S2MealDetail`)
Sheet opening from bottom. Top back button. Ingredients list with `qty + unit`, macro breakdown card, three CTAs: **LOG MEAL** (primary), **REPLACE** (secondary → Meal Replacer), **SKIP**.

### 5. Water sheet (`S2Water`)
- Hero: `L consumed / L goal` in huge accent light-weight numerals
- Percentage + "N OF 10 GLASSES" mono subline
- **10 beaker glasses** in a 5×2 grid, 2:3 aspect ratio. Each is an SVG `<path d="M 5 3 L 25 3 L 27 42 L 3 42 Z" />` (flat-top, inward-slanted sides). Filled glasses: accent fill + accent stroke + thin waterline at y=14 (opacity 0.35); empty: transparent + `lineStrong` border. Number 1–10 centered in Plex Mono 11px.
- Tap a glass to toggle filled count (tap glass 6 → set filled=6; tap the currently-filled top glass → set filled=i)
- Quick-log row: 3 buttons `+1 GLASS (250ml)` / `+BOTTLE (500ml)` / `+LITER (1.0L)`
- Last-7-days bar chart (thin bars, today highlighted accent, past days 40% opacity accentSoft)

### 6. Tracker tab (`S2Tracker`) — **dynamic metric chart**
- Header: kicker "LAST 14 DAYS", title "Tracker"
- **Weekly adherence grid** — a heatmap of adherence % per day per week
- **Dynamic metric chart card:**
  - Header row: left shows current metric label + avg value + delta vs prev period; right shows a **dropdown picker** with a color swatch per option
  - Options: Calories / Protein / Carbs / Fat / Fibre / Water / Adherence
  - Each metric has its own 14-day series, target, color, and unit
  - Tap the selector → dropdown opens, shows each option with swatch + avg value; tap one → chart re-renders
  - Chart is an SVG line + area gradient with a dashed target line and an endpoint dot
  - Y-axis bounds auto-scale to each metric's min/target
- **Daily kcal detail row** (tap → `S2Kcal` monthly view)
- **Weight trend** card (12-point sparkline, current weight big, delta)

The metric data model (put this in a tracker helper module):
```ts
export const METRICS = {
  kcal:    { label:'CALORIES',  unit:'kcal', target:1320, color:'#FF6A2A' },
  protein: { label:'PROTEIN',   unit:'g',    target:120,  color:'#FF6A2A' },
  carbs:   { label:'CARBS',     unit:'g',    target:150,  color:'#C9A3FF' },
  fat:     { label:'FAT',       unit:'g',    target:45,   color:'#FFD166' },
  fibre:   { label:'FIBRE',     unit:'g',    target:25,   color:'#7CE0C4' },
  water:   { label:'WATER',     unit:'L',    target:3.0,  color:'#6BC6FF' },
  adh:     { label:'ADHERENCE', unit:'%',    target:100,  color:'#FFB066' },
};
```
Wire the `series` for each to real Firestore data (14 trailing days) — mock values are placeholders.

### 7. Shopping tab (`S2Shopping`) — **people multiplier**
- Header: "WEEK 03 · N ITEMS", title "Shopping", right: big `bought / total`
- 3 px progress bar
- **People stepper card** (new):
  - Layout: left side has hair label "SHOPPING FOR" + subtitle "Quantities scale ×N"; right side has `−` button, big Space Grotesk numeral (1–12) with "PERSON/PEOPLE" mono caption, and `+` button
  - Clamps 1–12
  - When multiplier > 1, every item's qty renders in accent orange
- Items grouped by category (PROTEIN / PRODUCE / PANTRY). Each item: checkbox, name, right-aligned qty.
- **Quantity scaling rule:** parse each item as `{name, qty, unit}` (e.g. `{n:'Chicken breast', q:1.2, u:'kg'}`). On render: multiply `qty × people`. Units auto-roll (g ≥ 1000 → kg; ml ≥ 1000 → L). Counted items (unit `''`) round **up** with `Math.ceil`.

### 8. Tips tab (`S2Tips`)
- Featured "Meal Prep Sunday batch protocol" card with accent border, arrow, time-saved callout
- Numbered list of principles — each tip has a mono "01 · SATIETY" kicker, big sans title, dim body copy, "3 MIN READ" meta

### 9. Profile tab (`S2Profile`)
- Avatar + name + email header, "EDIT" secondary button
- Big weight metric + 12-point weight sparkline + delta
- Body stats list (height, current weight, target, BMR, TDEE) — mono `s2DataRow` style
- Settings list: Customise plan, Regenerate, Meal prep, Notifications, Theme, Sign out
- Each row = `label` left (body text) + chevron `→` right in mono

### 10. Flow modals (`s2-screens-flow.jsx`)
All open as bottom sheets with the same `S2TopBar` pattern (back arrow, kicker, title).
- **Meal Replacer:** current meal summary → "FIND REPLACEMENT" accent button → AI suggestions list → confirm swap
- **Add Meal:** ingredient search, qty steppers, live macro recalc, "ADD TO TODAY" button
- **Weight Log:** today's weight input (stepper), optional body-fat %, save
- **Customise:** diet prefs, meal count, kcal target slider, macro ratio pie, save
- **Regenerate:** "This will replace week N" warning, pick new start date, confirm destructive
- **Meal Prep:** Sunday batch protocol checklist, timer suggestions per step

---

## Component Primitives to Extract

Build these Tailwind/React primitives first — every screen uses them:

| Primitive | Purpose |
|---|---|
| `<HairLabel>` | 9px Plex Mono uppercase 0.22em kicker (accepts `color` prop) |
| `<DataRow label value unit accent last />` | Flex row: label left (mono kicker), value right (mono 13px), hairline bottom border |
| `<Pill color filled>` | 3px padding chip, mono 9px 0.15em uppercase, outlined or filled |
| `<Btn primary secondary full small>` | Sharp-corner button, accent fill or transparent+border |
| `<Card onClick padding border>` | `bg-surface` + `line` border, no radius |
| `<Bar pct color h>` | Horizontal progress bar, configurable height (default 3px) |
| `<Check on size>` | Square checkbox, accent fill when on, transparent+border when off |
| `<Scaffold tab onNav>` | Shell: fixed top bar + scroll body + `<BottomNav activeTab>` |
| `<BottomNav activeTab onNav>` | 5-tab bar: MEALS / TRACKER / SHOP / TIPS / PROFILE. Active tab = accent text + top border accent |
| `<TopBar onBack kicker title right>` | Back arrow + stacked kicker/title + optional right slot |
| `<SectionTitle kicker title right>` | Big screen-header block |

---

## Interactions & Animations

- **Transitions:** 200ms ease-out on hover/active. No springy / bouncy easing.
- **Tab switches:** instant (no slide).
- **Sheet opens:** slide up from bottom, 280ms ease-out. Backdrop fade to rgba(0,0,0,0.5).
- **Metric dropdown:** 150ms opacity/translate-y-2 → 0.
- **Progress bars:** animate width on mount, 400ms ease-out.
- **No parallax, no gradients beyond the faint area-fill under line charts.**

---

## State Management
Reuse all existing hooks (`useAuth`, any Firestore subscription hooks). New state to add:
- `trackerMetric: 'kcal' | 'protein' | ...` — local `useState` in `TrackerTab`
- `shoppingPeople: number` (1–12) — local `useState` in `ShoppingTab`, optionally persisted to `localStorage`
- `waterFilled: number` (0–10) — already exists or should back Firestore water doc

No architectural changes needed to Firestore schema, routing, or auth.

---

## Assets
- Fonts: Google Fonts (Space Grotesk, IBM Plex Mono) — imported via `<link>` in `index.html`
- Icons: **none** — the design is intentionally icon-free. Chevrons and arrows are `→` `←` characters in Plex Mono.
- No image assets in the mockups — meal thumbnails should come from your existing source (if any) or be replaced with colored placeholder blocks using `accentFill` bg.

---

## Implementation Order (recommended)

1. Add Google Fonts link + `theme.ts` tokens + extend `tailwind.config.ts` with the `strain.*` colors.
2. Build the primitives (`HairLabel`, `DataRow`, `Pill`, `Btn`, `Card`, `Bar`, `Scaffold`, `BottomNav`, `TopBar`).
3. Rebuild `BottomNav.tsx` + global layout shell.
4. Rebuild `MealsTab.tsx` (Today view) — highest user value.
5. Rebuild `TrackerTab.tsx` with the dynamic metric chart.
6. Rebuild `ProfileTab.tsx`.
7. Ship Shopping + Tips tabs.
8. Ship all sheets/modals (Meal Detail, Water, Add Meal, etc.).
9. Onboarding + Auth.
10. QA pass — verify every info point from the original app is still present (no regressions).

---

## Files in this Bundle

| File | What it contains |
|---|---|
| `Redesign v2 - Strain.html` | Entry point — loads all the below JSX files |
| `s2-theme.jsx` | Design tokens + shared atom primitives (HairLabel, DataRow, Pill, Btn) |
| `s2-chrome.jsx` | Scaffold, BottomNav, TopBar, SectionTitle, Card, Bar, Check |
| `s2-screens-core.jsx` | Meals/Today, Tracker (with dynamic metric chart), Shopping (with people multiplier), Tips, Profile |
| `s2-screens-meals.jsx` | Meal Detail, Water (beaker glasses), Monthly kcal |
| `s2-screens-flow.jsx` | Meal Replacer, Add Meal, Weight Log, Customise, Regen, Meal Prep |
| `s2-screens-onboard.jsx` | Sign in + 5-step onboarding |
| `s2-app.jsx` | Router mapping screen IDs to components |
| `Theme Explorer.html` | Bonus — 8 alternate color palettes applied to a sample screen, for reference if you want to pivot accent color |

Open `Redesign v2 - Strain.html` locally to run the prototype and inspect exact spacing/colors.

---

## For Claude Code
When invoked in the `ai-diet-plan-track` repo:
1. Read this `README.md` first — it is the single source of truth.
2. Read the JSX files in this bundle as **visual reference only** — do not copy the inline-style JSX into the real app. Translate to Tailwind classes.
3. Preserve all existing logic in `client/src/components/*.tsx`, `hooks/*.ts`, and API calls. Only replace the JSX + styles.
4. Keep the existing tab ids / routing structure. Map the new design to the current component tree as shown in the table above.
5. Verify every piece of information from the old UI survived the redesign — if something doesn't have a home in a new screen, flag it and ask rather than deleting.
