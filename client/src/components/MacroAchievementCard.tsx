// MacroAchievementCard — data layer
// Computes consumed macros from meals/replacements, maps to MacroBand props.
// External interface unchanged — MealsTab.tsx needs no edits.

import { Meal, MealReplacement, UserProfile } from '../types';
import { MacroBand } from './MacroBand';

interface Props {
  meals: Meal[];
  eatenMask: boolean[];
  replacements: Record<string, MealReplacement | undefined>;
  date: string;
  profile: UserProfile;
  eatenCount: number;
  mealsPerDay: number;
}

function computeConsumed(
  meals: Meal[],
  eatenMask: boolean[],
  replacements: Record<string, MealReplacement | undefined>,
  date: string
) {
  return meals.reduce(
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
}

export function MacroAchievementCard({
  meals, eatenMask, replacements, date, profile, eatenCount, mealsPerDay,
}: Props) {
  // Don't render for future dates
  const today = new Date().toISOString().split('T')[0];
  if (date > today) return null;

  const consumed = computeConsumed(meals, eatenMask, replacements, date);

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
