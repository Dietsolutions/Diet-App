import { format, parseISO } from 'date-fns';
import { Meal, MealReplacement, UserProfile } from '../types';
import { CircularMacroRing, MACRO_COLORS } from './CircularMacroRing';

interface Props {
  meals: Meal[];
  eatenMask: boolean[];
  replacements: Record<string, MealReplacement | undefined>;
  date: string;
  profile: UserProfile;
  eatenCount: number;
  mealsPerDay: number;
}

interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
}

function computeConsumed(
  meals: Meal[],
  eatenMask: boolean[],
  replacements: Record<string, MealReplacement | undefined>,
  date: string
): Macros {
  return meals.reduce(
    (acc, meal, idx) => {
      if (!eatenMask[idx]) return acc;
      const rep = replacements[`${date}-${idx}`];
      return {
        calories: acc.calories + (rep ? rep.calories       : meal.calories || 0),
        protein:  acc.protein  + (rep ? rep.proteinG       : meal.protein  || 0),
        carbs:    acc.carbs    + (rep ? rep.carbsG         : meal.carbs    || 0),
        fat:      acc.fat      + (rep ? rep.fatG           : meal.fat      || 0),
        fibre:    acc.fibre    + (rep ? rep.fibreG         : meal.fibre    ?? 0),
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }
  );
}

export function MacroAchievementCard({
  meals, eatenMask, replacements, date, profile, eatenCount, mealsPerDay,
}: Props) {
  const today = new Date().toISOString().split('T')[0];
  if (date > today) return null;

  const consumed = computeConsumed(meals, eatenMask, replacements, date);
  const targets: Macros = {
    calories: profile.targetCalories,
    protein:  profile.proteinTarget,
    carbs:    profile.carbTarget,
    fat:      profile.fatTarget,
    fibre:    profile.fibreTarget,
  };

  const noMealsEaten = eatenCount === 0;
  const calRemaining = targets.calories - consumed.calories;
  const calOver      = calRemaining < 0;

  const isToday   = date === today;
  const dateLabel = isToday ? 'Today' : format(parseISO(date), 'EEE, d MMM');
  const dayTitle  = isToday ? "Today's Macros" : `${format(parseISO(date), 'EEEE')}'s Macros`;

  return (
    <div
      className="rounded-2xl border border-border card-glow"
      style={{ backgroundColor: '#1A1D27', padding: '10px 12px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold font-sans text-primary">{dayTitle}</span>
        <div className="flex items-center gap-1 text-right">
          <span className="text-[11px] font-sans text-secondary">
            {dateLabel} · {eatenCount}/{mealsPerDay} meals
          </span>
          {!noMealsEaten && (
            <span className={`text-[11px] font-mono font-semibold ${calOver ? 'text-red-400' : 'text-success'}`}>
              · {Math.round(Math.abs(calRemaining)).toLocaleString()} {calOver ? 'over' : 'left'}
            </span>
          )}
        </div>
      </div>

      {/* Row 1: Calories, Protein, Carbs — size 56, stroke 5 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <CircularMacroRing
          label="Calories"
          consumed={consumed.calories}
          target={targets.calories}
          unit="kcal"
          color={MACRO_COLORS.calories}
          size={56}
          strokeWidth={5}
        />
        <CircularMacroRing
          label="Protein"
          consumed={consumed.protein}
          target={targets.protein}
          unit="g"
          color={MACRO_COLORS.protein}
          size={56}
          strokeWidth={5}
        />
        <CircularMacroRing
          label="Carbs"
          consumed={consumed.carbs}
          target={targets.carbs}
          unit="g"
          color={MACRO_COLORS.carbs}
          size={56}
          strokeWidth={5}
        />
      </div>

      {/* Row 2: Fat, Fibre — size 64, stroke 5, flush with row 1 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 8,
        marginTop: 6,
      }}>
        <CircularMacroRing
          label="Fat"
          consumed={consumed.fat}
          target={targets.fat}
          unit="g"
          color={MACRO_COLORS.fat}
          size={64}
          strokeWidth={5}
        />
        <CircularMacroRing
          label="Fibre"
          consumed={consumed.fibre}
          target={targets.fibre}
          unit="g"
          color={MACRO_COLORS.fibre}
          size={64}
          strokeWidth={5}
        />
      </div>

      {noMealsEaten && (
        <p className="text-[11px] text-dimmed font-sans text-center mt-2">
          Log meals above to track your progress
        </p>
      )}
    </div>
  );
}
