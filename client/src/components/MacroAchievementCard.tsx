import { format, parseISO } from 'date-fns';
import { Meal, MealReplacement, UserProfile } from '../types';
import { ArcGauge } from './CircularMacroRing';

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
        calories: acc.calories + (rep ? rep.calories   : meal.calories || 0),
        protein:  acc.protein  + (rep ? rep.proteinG   : meal.protein  || 0),
        carbs:    acc.carbs    + (rep ? rep.carbsG     : meal.carbs    || 0),
        fat:      acc.fat      + (rep ? rep.fatG       : meal.fat      || 0),
        fibre:    acc.fibre    + (rep ? rep.fibreG     : meal.fibre    ?? 0),
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

  const calRemaining = targets.calories - consumed.calories;
  const calOver      = calRemaining < 0;

  const isToday   = date === today;
  const dateLabel = isToday ? 'Today' : format(parseISO(date), 'EEE, d MMM');
  const dayTitle  = isToday ? "Today's Macros" : `${format(parseISO(date), 'EEEE')}'s Macros`;

  return (
    <div style={{
      width: '80%',
      margin: '0 auto',
      background: '#0A0A0F',
      borderRadius: 18,
      padding: '16px 12px',
      border: '1px solid #1A1A2E',
      boxShadow: '0 0 40px rgba(0,0,0,0.6)',
    }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.5)',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          fontFamily: 'sans-serif',
        }}>
          {dayTitle}
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'sans-serif' }}>
          {dateLabel} · {eatenCount}/{mealsPerDay} meals
          {' · '}
          <span style={{ color: calOver ? '#FF2D2D' : '#00FF88' }}>
            {Math.round(Math.abs(calRemaining)).toLocaleString()} kcal {calOver ? 'over' : 'left'}
          </span>
        </span>
      </div>

      {/* ── Gauge grid ─────────────────────────────────────────────────── */}
      {/*
          Layout:
          Col 1 (1fr)    Col 2 (1.8fr)    Col 3 (1fr)
          Row 1: Protein   Calories(large)  Carbs
          Row 2: Fat        <empty>          Fibre
      */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1.8fr 1fr',
        gridTemplateRows: 'auto auto',
        gap: 8,
        alignItems: 'center',
        justifyItems: 'center',
      }}>
        {/* Row 1 */}
        <ArcGauge
          label="PROTEIN"
          consumed={consumed.protein}
          target={targets.protein}
          unit="g"
          size={80}
          strokeWidth={8}
        />
        <ArcGauge
          label="CALORIES"
          consumed={consumed.calories}
          target={targets.calories}
          unit="kcal"
          size={160}
          strokeWidth={14}
          isCenter
        />
        <ArcGauge
          label="CARBS"
          consumed={consumed.carbs}
          target={targets.carbs}
          unit="g"
          size={80}
          strokeWidth={8}
        />

        {/* Row 2 */}
        <ArcGauge
          label="FAT"
          consumed={consumed.fat}
          target={targets.fat}
          unit="g"
          size={80}
          strokeWidth={8}
        />
        {/* Empty centre cell keeps Fat/Fibre aligned under Protein/Carbs */}
        <div />
        <ArcGauge
          label="FIBRE"
          consumed={consumed.fibre}
          target={targets.fibre}
          unit="g"
          size={80}
          strokeWidth={8}
        />
      </div>
    </div>
  );
}
