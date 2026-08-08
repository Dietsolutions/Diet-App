repo: Dietsolutions/Diet-App
branch: main
path: client/src

## Last sync
date: 2026-08-08T12:08:00Z

### Updated in this project
- Read the real app structure: 6 tabs (Meals, Tracker, Recipes, Shopping, Learn, Profile) — the earlier v3 designs had only 5 and were missing Recipes.
- Rebuilt nav, Learn, Shopping and the onboarding against the real source and field lists.
- Grounded Plan overview, Change meal, Notification settings and Weight progress in their component files.
- Added the system states read in App.tsx and ShoppingTab.tsx, plus a Reset password screen.
- Design applied: v3 Fresh Light (all-light variant).
- **Audit produced** (`Code Audit - Design to App.html`) plus a Claude Code migration prompt
  (`claude-code-prompt.md`), covering the Strain v2 → Fresh Light token swap, the three contrast
  traps a naive swap misses, the four data shapes needing backend work, and the deliberate spec
  deviations. Audited against `client/src/theme/tokens.ts`, `index.css`, `tailwind.config.js`,
  `index.html`, `components/ui/*` and an 836-hit survey of `s2.*` usage.

## Screen map
Rows marked **read** were built from the source file. Rows marked *partial* had only their data
model read, not their layout component. Rows marked *not read* are designed
from the data model and app conventions only — read the source before treating them as tracked.

| Project screen | Repo source | Grounding |
| --- | --- | --- |
| Sign in / Sign up | client/src/components/AuthScreen.tsx | **read** |
| Forgot password | client/src/components/AuthScreen.tsx (modal) | **read** |
| Reset password (4 states) | client/src/components/ResetPasswordScreen.tsx | **read** |
| Onboarding 1-5 | client/src/data/onboarding.ts, types/index.ts (OnboardingData), Onboarding.tsx (option values) | **read** — all option lists verbatim (56 countries, 57 cuisines/12 regions, 14 allergens, 6 ingredient groups, 6 goals, 5 training types, 5 meal preferences, sleep/stress/recovery/hunger/energy/insulin). Layout composition NOT read. **Deliberate deviation:** app has 7 steps; condensed to 5 at user request (1 personal+body, 2 diet+window+allergies, 3 foods loved, 4 foods avoided, 5 goals+routine). Every OnboardingData field retained; long lists searchable. Slide CTA only on the final step. TDEE shown on step 5 where activity/training make it derivable. Weekly budget/currency OMITTED — present in OnboardingData defaults but never rendered as an input in Onboarding.tsx. |
| Generating plan | client/src/components/Onboarding.tsx | *not read* |
| Review & customise | client/src/components/PlanOverviewScreen.tsx | **read** |
| Change meal · rules | client/src/components/ChangeMealSheet.tsx (screen 1) | **read** |
| Change meal · 4 options | client/src/components/ChangeMealSheet.tsx (screen 2) | **read** |
| Plan review | client/src/components/PlanReviewScreen.tsx | *not read* |
| Plan · Today | client/src/components/MealsTab.tsx, MacroBand.tsx, MealRow.tsx | **read** |
| Plan · no plan for date | client/src/components/MealsTab.tsx (empty state) | **read** |
| Meal detail | client/src/components/MealDetailSheet.tsx | **read** |
| Cooking instructions | client/src/components/MealDetailSheet.tsx (loaded state) | **read** |
| Share recipe | client/src/components/MealShareSheet.tsx | **read** |
| Replacer · add meal category | client/src/components/MealReplacerSheet.tsx (CategoryPicker) | **read** |
| Replacer · search entry | client/src/components/MealReplacerSearch.tsx | **read** |
| Replacer · results | client/src/components/MealReplacerResults.tsx, FoodResultCard.tsx | **read** |
| Replacer · no results | client/src/components/MealReplacerResults.tsx (empty state) | **read** |
| Replacer · quantity | client/src/components/MealReplacerQuantity.tsx | **read** |
| Replacer · AI describe / breakdown | client/src/components/MealReplacerAI.tsx | **read** |
| Meal detail · swapped | client/src/components/MealDetailSheet.tsx (isReplaced) | **read** |
| Regenerate one meal | client/src/components/SingleMealRegenerateSheet.tsx | *not read* |
| Log off-plan meal | client/src/components/AdditionalMealCard.tsx | *not read* |
| Track | client/src/components/TrackerTab.tsx, hooks/useTracker.ts | **read** — restyled to Fresh Light; metric switcher + day-detail card are AHEAD of the app (see below) |
| Track · no data yet | client/src/components/TrackerTab.tsx (empty state) | **read** |
| Monthly macros | client/src/components/MonthlyCalorieChart.tsx | **read** — plus daily-avg / under / over cells, AHEAD of the app |
| Water | client/src/components/WaterDetailSheet.tsx, WaterIntakeCard.tsx | **read** — restyled to Fresh Light; 250 ml/glass kept |
| Recipes · browse | client/src/components/BrowseRecipesTab.tsx | **read** |
| Recipe detail | client/src/components/BrowseRecipesTab.tsx (RecipeDetail) | **read** |
| Save recipe to plan | client/src/components/BrowseRecipesTab.tsx (SaveToPlanModal) | **read** |
| Shop | client/src/components/ShoppingTab.tsx | **read** |
| Shopping share | client/src/components/ShoppingShareSheet.tsx | *not read* |
| Learn | client/src/components/TipsTab.tsx | **read** |
| Meal prep guide | client/src/components/MealPrepGuide.tsx | *not read* |
| You · profile | client/src/components/ProfileTab.tsx | **read** |
| Delete account | client/src/components/ProfileTab.tsx (delete flow) | **read** |
| Customise meal plan | client/src/components/MealPlanCustomiser.tsx | **read** |
| Customise · limit reached | client/src/components/MealPlanCustomiser.tsx (disabled) | **read** |
| Regenerate · confirm | client/src/components/ProfileTab.tsx (showConfirm) | **read** |
| Regenerate · progress / error | client/src/components/ProfileTab.tsx (regenerating) | **read** |
| Log weight | client/src/components/weight/WeightLogModal.tsx | *not read* |
| Weight progress | client/src/components/weight/WeightLogList.tsx, WeightStatsHeader.tsx | **read** |
| Notification settings | client/src/components/NotificationSettings.tsx | **read** |
| States & banners | client/src/App.tsx, ShoppingTab.tsx | **read** |
| Nav | client/src/components/BottomNav.tsx | **read** |
| Design tokens (old) | client/src/theme/tokens.ts | **read** |
| Global stylesheet | client/src/index.css | **read** — hardcodes dark body bg + Space Grotesk |
| Tailwind / fonts | client/tailwind.config.js, client/index.html | **read** |
| Shared primitives | client/src/components/ui/{Card,HairLabel,Pill}.tsx | **read** — highest-leverage restyle targets |

## Design changes needing app work
Things the design now shows that the current code cannot produce. Running list for the
code-vs-design audit — each needs a backend or hook change, not just a component restyle.

| # | Screen | What the design shows | What the app needs |
| --- | --- | --- | --- |
| 1 | Track | Metric switcher over 7 pills (Calories, Protein, Carbs, Fat, Fibre, Water, Adherence), each a 14-day line chart against its target | `useTracker.ts` exposes no per-day macro series. Needs a daily aggregate per macro — date, consumed, target — for a rolling window. Water and adherence already have per-day data; the four macros do not. |
| 2 | Track | Day-detail card under the calendar: “Day 17 of 49”, weekday + date, `3 / 4 eaten`, % logged, View plan / Mark all eaten | Needs per-day meal counts addressable by date (eaten vs planned), plus a bulk “mark all eaten” mutation for a given day. |
| 3 | Track | Plan-adherence month calendar, each cell tinted 0–100% | Needs per-day adherence % for the month. Derivable from existing meal logs, but not currently aggregated or exposed. |
| 4 | Monthly macros | Daily avg / Under target / Over target cells that recompute per macro tab | `MonthlyCalorieChart.tsx` computes these for calories only. Needs the same reduction per macro. |
