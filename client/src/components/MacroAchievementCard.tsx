// MacroAchievementCard — data layer
// Computes consumed macros from meals/replacements + additional meals, maps to MacroBand props.

import { AdditionalMealLog, Meal, MealReplacement, UserProfile } from '../types';
import { MacroBand } from './MacroBand';

interface Props {
  meals: Meal[];
  eatenMask: boolean[];
  replacements: Record<string, MealReplacement | undefined>;
  date: string;
  profile: UserProfile;
  eatenCount: number;
  mealsPerDay: number;
  additionalMeals?: AdditionalMealLog[];
}

function computeConsumed(
  meals: Meal[],
  eatenMask: boolean[],
  replacements: Record<string, MealReplacement | undefined>,
  date: string,
  additionalMeals: AdditionalMealLog[]
) {
  // Calories from plan meals (eaten/replaced)
  const planTotals = meals.reduce(
    (acc, meal, idx) => {
      if (!eatenMask[idx]) return acc;
      const rep = replacements[`${date}-${idx}`];
      return {
        calories: acc.calories + (rep ? rep.calories : meal.calories || 0),
        protein:  acc.protein  + (rep ? rep.proteinG : meal.protein  || 0),
        carbs:    acc.carbs    + (rep ? rep.carbsG   : meal.carbs    || 0),
        fat:      acc.fat      + (rep ? rep.fatG     : meal.fat      || 0),
        fibre:    acc.fibre    + (rep ? rep.fibreG   : meal.fibre    ?? 0),
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }
  );

  // Stack additional meals on top (always included)
  return additionalMeals.reduce(
    (acc, extra) => ({
      calories: acc.calories + extra.calories,
      protein:  acc.protein  + extra.proteinG,
      carbs:    acc.carbs    + extra.carbsG,
      fat:      acc.fat      + extra.fatG,
      fibre:    acc.fibre    + extra.fibreG,
    }),
    planTotals
  );
}

// Local-timezone date as YYYY-MM-DD — must match how selectedDate is computed in MealsTab.
// new Date().toISOString() gives UTC, which is behind IST by 5h30m, causing both this
// card and AddMealButton to disappear between midnight and 05:30 IST every day.
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function MacroAchievementCard({
  meals, eatenMask, replacements, date, profile, eatenCount, mealsPerDay,
  additionalMeals = [],
}: Props) {
  // Don't render for future dates (compare using LOCAL date, not UTC)
  if (date > localToday()) return null;

  const consumed = computeConsumed(meals, eatenMask, replacements, date, additionalMeals);

  return (
    <MacroBand
      date={date}
      mealsEaten={eatenCount}
      totalMeals={mealsPerDay}
      calories={{ consumed: consumed.calories, target: profile.targetCalories }}
      protein={{  consumed: consumed.protein,  target: profile.proteinTarget  }}
      carbs={{    consumed: consumed.carbs,    target: profile.carbTarget     }}
      fat={{      consumed: consumed.fat,      target: profile.fatTarget      }}
      fibre={{    consumed: consumed.fibre,    target: profile.fibreTarget    }}
    />
  );
}
