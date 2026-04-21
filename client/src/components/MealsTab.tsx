import { useEffect } from 'react';
import { format, parseISO, addWeeks, startOfWeek, addDays } from 'date-fns';
import { useAppStore } from '../store/appStore';
import { useMealReplacerStore } from '../store/mealReplacerStore';
import { useAdditionalMealsStore } from '../store/additionalMealsStore';
import { useTracker } from '../hooks/useTracker';
import { usePlan } from '../hooks/usePlan';
import { Meal, MealTarget } from '../types';
import { ReplacedMealCard } from './ReplacedMealCard';
import { MealReplacerSheet } from './MealReplacerSheet';
import { WaterIntakeCard } from './WaterIntakeCard';
import { MacroAchievementCard } from './MacroAchievementCard';
import { AdditionalMealCard } from './AdditionalMealCard';
import { AddMealButton } from './AddMealButton';

const MEAL_ICONS = ['🌅', '☀️', '🍎', '🌙', '🥗'];

// ── helpers ────────────────────────────────────────────────────────────────
function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function getWeekDates(weekOffset: number): string[] {
  // Get Monday of the current week, then offset by weekOffset weeks
  const today = new Date();
  const monday = startOfWeek(today, { weekStartsOn: 1 });
  const targetMonday = addWeeks(monday, weekOffset);
  return Array.from({ length: 7 }, (_, i) =>
    addDays(targetMonday, i).toISOString().split('T')[0]
  );
}

// ── component ──────────────────────────────────────────────────────────────
export function MealsTab() {
  const {
    selectedDate, setSelectedDate,
    mealsCalendarOffset, setMealsCalendarOffset,
    planDays, mealsPerDay, planDuration,
    profile
  } = useAppStore();
  const { weekData, toggleMeal } = useTracker();
  const { planDays: planDaysFromPlan } = usePlan();
  const { replacements, openReplacer, undoReplacement, fetchReplacementsForWeek } = useMealReplacerStore();
  const { fetchForDate, getForDate } = useAdditionalMealsStore();

  const today = todayStr();

  useEffect(() => {
    fetchReplacementsForWeek();
  }, [fetchReplacementsForWeek]);

  // Fetch additional meals whenever the selected date changes
  useEffect(() => {
    if (selectedDate && selectedDate <= today) {
      fetchForDate(selectedDate);
    }
  }, [selectedDate, fetchForDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const additionalMeals = getForDate(selectedDate);

  // Show current week by default (offset 0)
  const calendarDates = getWeekDates(mealsCalendarOffset);
  const canGoForward = mealsCalendarOffset < 0; // can only go forward if we went back
  const canGoBack = mealsCalendarOffset > -8;   // max 8 weeks back

  // Map weekData by date for quick lookup
  const weekDataByDate: Record<string, typeof weekData[0]> = {};
  weekData.forEach(d => { weekDataByDate[d.date] = d; });

  // Find the plan day for the selected date
  const planDayIdx = weekData.findIndex(d => d.date === selectedDate);
  const isPlanDate = planDayIdx !== -1;
  const planDay = isPlanDate ? planDaysFromPlan[planDayIdx] || planDays[planDayIdx] : null;
  const meals: Meal[] = planDay?.meals || [];
  const dayTrackerData = weekData[planDayIdx];

  const getMealEaten = (mealIndex: number) => dayTrackerData?.meals[mealIndex]?.eaten ?? false;
  const handleToggle = (mealIndex: number) => {
    if (!dayTrackerData) return;
    toggleMeal(dayTrackerData.date, mealIndex, getMealEaten(mealIndex));
  };

  const handleOpenReplacer = (mealIdx: number) => {
    const meal = meals[mealIdx];
    if (!meal || !selectedDate) return;
    const mealType = meal.type || ['Breakfast', 'Lunch', 'Snack', 'Dinner', 'Snack 2'][mealIdx] || 'Meal';
    const target: MealTarget = {
      date: selectedDate,
      dayIndex: planDayIdx,
      mealIndex: mealIdx,
      mealName: `${mealType} · ${planDay?.label || 'Day ' + (planDayIdx + 1)}`,
    };
    openReplacer(target);
  };

  const selectedIsFuture = selectedDate > today;
  const eatenCount = dayTrackerData?.meals.filter(m => m.eaten).length ?? 0;

  return (
    <div className="flex flex-col h-full">
      {/* ── Week Calendar Strip ──────────────────────────────────────────── */}
      <div className="bg-surface border-b border-border px-4 py-3 flex-shrink-0">
        {/* Month header + navigation */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => canGoBack && setMealsCalendarOffset(mealsCalendarOffset - 1)}
            disabled={!canGoBack}
            className={`p-1.5 rounded-lg transition-colors ${canGoBack ? 'text-primary hover:bg-elevated' : 'text-dimmed/40 cursor-not-allowed'}`}
          >
            ←
          </button>
          <span className="text-sm font-semibold font-sans text-primary">
            {format(parseISO(calendarDates[0]), 'MMMM yyyy')}
          </span>
          <button
            onClick={() => canGoForward && setMealsCalendarOffset(mealsCalendarOffset + 1)}
            disabled={!canGoForward}
            className={`p-1.5 rounded-lg transition-colors ${canGoForward ? 'text-primary hover:bg-elevated' : 'text-dimmed/40 cursor-not-allowed'}`}
          >
            →
          </button>
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDates.map((date) => {
            const isFuture = date > today;
            const isToday = date === today;
            const isSelected = date === selectedDate;
            const dayData = weekDataByDate[date];
            const isPlan = !!dayData;
            const eaten = dayData?.meals.filter(m => m.eaten).length ?? 0;

            return (
              <button
                key={date}
                onClick={() => {
                  if (!isFuture) setSelectedDate(date);
                }}
                disabled={isFuture}
                className={`flex flex-col items-center py-1.5 rounded-xl transition-all ${
                  isFuture
                    ? 'opacity-35 cursor-not-allowed'
                    : isSelected
                      ? 'bg-elevated ring-1 ring-accent/60'
                      : isToday
                        ? 'bg-accent/20'
                        : 'hover:bg-elevated/70'
                }`}
              >
                <span className="text-[9px] font-sans text-secondary font-medium">
                  {format(parseISO(date), 'EEE').slice(0, 2)}
                </span>
                <span className={`text-sm font-bold font-mono leading-none mt-0.5 ${
                  isToday ? 'text-accent' : isSelected ? 'text-primary' : 'text-primary'
                }`}>
                  {format(parseISO(date), 'd')}
                </span>
                {/* Meal dots */}
                {isPlan && (
                  <div className="flex gap-[2px] mt-1">
                    {Array.from({ length: Math.min(mealsPerDay, 5) }, (_, i) => (
                      <div
                        key={i}
                        className={`w-1 h-1 rounded-full ${
                          i < eaten ? 'bg-success' : 'bg-border'
                        }`}
                      />
                    ))}
                  </div>
                )}
                {!isPlan && <div className="h-3 mt-1" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Selected Date Header ─────────────────────────────────────────── */}
      <div className="px-5 pt-3 pb-1 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-primary">
              {format(parseISO(selectedDate), 'EEEE, d MMMM')}
            </h2>
            {isPlanDate ? (
              <p className="text-xs text-secondary font-sans">
                Day {planDayIdx + 1} of {planDuration} · {eatenCount}/{mealsPerDay} eaten
              </p>
            ) : (
              <p className="text-xs text-dimmed font-sans">Not a plan day</p>
            )}
          </div>
          {isPlanDate && (
            <span className="text-xs font-sans font-semibold bg-elevated px-2.5 py-1 rounded-full border border-border text-secondary">
              {eatenCount}/{mealsPerDay} eaten
            </span>
          )}
        </div>
      </div>

      {/* ── Scrollable Content ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
        {/* No plan for this date */}
        {!isPlanDate && !selectedIsFuture && (
          <div className="bg-surface rounded-2xl p-6 text-center border border-border card-glow">
            <p className="text-4xl mb-2">📅</p>
            <p className="text-secondary font-sans text-sm">No meal plan for this date.</p>
            <p className="text-dimmed font-sans text-xs mt-1">
              Your active plan covers {weekData.length > 0 ? `${weekData[0]?.date} – ${weekData[weekData.length - 1]?.date}` : 'this week'}.
            </p>
          </div>
        )}

        {isPlanDate && (
          <>
            {/* Water intake */}
            <WaterIntakeCard date={selectedDate} />

            {/* Macro achievement */}
            {profile && (
              <MacroAchievementCard
                meals={meals}
                eatenMask={meals.map((_, i) => getMealEaten(i))}
                replacements={replacements}
                date={selectedDate}
                profile={profile}
                eatenCount={eatenCount}
                mealsPerDay={mealsPerDay}
                additionalMeals={additionalMeals}
              />
            )}

            {/* Meal cards */}
            {meals.map((meal, mealIdx) => {
              const repKey = `${selectedDate}-${mealIdx}`;
              const replacement = replacements[repKey];
              const isReplaced = !!replacement;
              const eaten = getMealEaten(mealIdx);
              const icon = MEAL_ICONS[mealIdx] || '🍽️';
              const mealType = meal.type || ['Breakfast', 'Lunch', 'Snack', 'Dinner', 'Snack 2'][mealIdx] || 'Meal';

              return (
                <div
                  key={mealIdx}
                  className={`rounded-2xl border transition-all card-glow ${
                    isReplaced
                      ? 'bg-amber-500/5 border-amber-500/20'
                      : eaten
                        ? 'bg-success-fill border-success/30'
                        : 'bg-surface border-border'
                  }`}
                >
                  {isReplaced && replacement ? (
                    <ReplacedMealCard
                      replacement={replacement}
                      originalMeal={meal}
                      mealIcon={icon}
                      mealType={mealType}
                      onUndo={() => undoReplacement(selectedDate, mealIdx)}
                    />
                  ) : (
                    <MealCard
                      meal={meal}
                      mealIdx={mealIdx}
                      eaten={eaten}
                      onToggle={() => handleToggle(mealIdx)}
                      onReplace={() => handleOpenReplacer(mealIdx)}
                    />
                  )}
                </div>
              );
            })}

            {/* Additional meals logged for this day */}
            {additionalMeals.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-dimmed font-sans uppercase tracking-wide px-0.5">
                  Extra meals logged
                </p>
                {additionalMeals.map((extra) => (
                  <AdditionalMealCard key={extra.id} meal={extra} />
                ))}
              </div>
            )}

            {/* Add meal button */}
            <AddMealButton date={selectedDate} />
          </>
        )}

        <div className="h-4" />
      </div>

      <MealReplacerSheet />
    </div>
  );
}

// ── MealCard ───────────────────────────────────────────────────────────────
interface MealCardProps {
  meal: Meal;
  mealIdx: number;
  eaten: boolean;
  onToggle: () => void;
  onReplace: () => void;
}

function MealCard({ meal, mealIdx, eaten, onToggle, onReplace }: MealCardProps) {
  const icon = MEAL_ICONS[mealIdx] || '🍽️';
  const mealType = meal.type || ['Breakfast', 'Lunch', 'Snack', 'Dinner', 'Snack 2'][mealIdx] || 'Meal';

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{icon}</span>
            <span className="text-xs font-semibold font-sans text-secondary uppercase tracking-wide">
              {mealType} · {meal.time}
            </span>
          </div>
          <h3 className={`font-sans font-semibold text-sm leading-snug ${eaten ? 'line-through text-dimmed' : 'text-primary'}`}>
            {meal.name}
          </h3>
        </div>
        {/* Eaten toggle */}
        <button
          onClick={onToggle}
          className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center mt-0.5 transition-all ${
            eaten ? 'bg-success border-success' : 'border-border bg-surface hover:border-success/50'
          }`}
        >
          {eaten && <span className="text-white text-xs">✓</span>}
        </button>
      </div>

      {meal.description && (
        <p className="text-xs text-secondary font-sans leading-relaxed mt-1.5 pl-6">{meal.description}</p>
      )}

      {/* Macros */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-border/60">
        <MacroPill label="Protein" value={`${meal.protein}g`} bgColor="bg-success-fill" textColor="text-success" />
        <MacroPill label="Carbs" value={`${meal.carbs}g`} bgColor="bg-accent-fill" textColor="text-accent" />
        <MacroPill label="Fat" value={`${meal.fat}g`} bgColor="bg-violet-fill" textColor="text-violet" />
        <MacroPill label="Fibre" value={`${meal.fibre ?? 0}g`} bgColor="bg-fibre-fill" textColor="text-fibre" />
        <MacroPill label="kcal" value={`${meal.calories}`} bgColor="bg-primary/[0.08]" textColor="text-primary" bold />
      </div>

      {/* Replace button */}
      <button
        onClick={onReplace}
        className="mt-2.5 flex items-center gap-1.5 text-xs font-sans text-accent/70 hover:text-accent transition-colors"
      >
        <span>✏️</span>
        <span>Replace this meal</span>
      </button>
    </div>
  );
}

function MacroPill({ label, value, bgColor, textColor, bold }: {
  label: string; value: string; bgColor: string; textColor: string; bold?: boolean
}) {
  return (
    <div className={`flex-1 text-center rounded-3xl py-1 ${bgColor}`}>
      <p className={`text-[11px] font-semibold font-mono ${textColor} ${bold ? 'font-bold' : ''}`}>{value}</p>
      <p className="text-[9px] text-secondary font-sans">{label}</p>
    </div>
  );
}
