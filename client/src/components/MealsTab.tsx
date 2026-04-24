import { useEffect, useState } from 'react';
import { format, parseISO, addWeeks, startOfWeek, addDays } from 'date-fns';
import { useAppStore } from '../store/appStore';
import { useMealReplacerStore } from '../store/mealReplacerStore';
import { useAdditionalMealsStore } from '../store/additionalMealsStore';
import { useTracker } from '../hooks/useTracker';
import { usePlan } from '../hooks/usePlan';
import { Meal, MealReplacement } from '../types';
import { MealReplacerSheet } from './MealReplacerSheet';
import { MealDetailSheet } from './MealDetailSheet';
import { WaterIntakeCard } from './WaterIntakeCard';
import { WaterDetailSheet } from './WaterDetailSheet';
import { MacroAchievementCard } from './MacroAchievementCard';
import { AddMealButton } from './AddMealButton';
import { ErrorBoundary } from './ErrorBoundary';
import { s2 } from '../theme/tokens';
import { HairLabel, Pill, Card, Check } from './ui';

// ── helpers ────────────────────────────────────────────────────────────────
function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function getWeekDates(weekOffset: number): string[] {
  const today = new Date();
  const monday = startOfWeek(today, { weekStartsOn: 1 });
  const targetMonday = addWeeks(monday, weekOffset);
  return Array.from({ length: 7 }, (_, i) =>
    addDays(targetMonday, i).toISOString().split('T')[0]
  );
}

// ── NavArrow ──────────────────────────────────────────────────────────────
function NavArrow({
  dir,
  disabled,
  onClick,
}: {
  dir: 'left' | 'right';
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'transparent',
        border: `1px solid ${s2.lineStrong}`,
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? s2.textDimmer : s2.text,
        flexShrink: 0,
      }}
    >
      {dir === 'left' ? (
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M6 1 L2 5 L6 9" stroke="currentColor" strokeWidth="1.2" fill="none" />
        </svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M4 1 L8 5 L4 9" stroke="currentColor" strokeWidth="1.2" fill="none" />
        </svg>
      )}
    </button>
  );
}

// ── MealsTab ───────────────────────────────────────────────────────────────
export function MealsTab() {
  const [showWaterDetail, setShowWaterDetail]   = useState(false);
  const [detailMealIdx,   setDetailMealIdx]     = useState<number | null>(null);

  const {
    selectedDate,
    setSelectedDate,
    mealsCalendarOffset,
    setMealsCalendarOffset,
    planDays,
    mealsPerDay,
    planDuration,
    profile,
  } = useAppStore();
  const { weekData, toggleMeal } = useTracker();
  const { planDays: planDaysFromPlan } = usePlan();
  const { replacements, openReplacer, undoReplacement, fetchReplacementsForWeek } =
    useMealReplacerStore();
  const { fetchForDate, getForDate } = useAdditionalMealsStore();

  const today = todayStr();

  useEffect(() => {
    fetchReplacementsForWeek();
  }, [fetchReplacementsForWeek]);

  useEffect(() => {
    if (selectedDate && selectedDate <= today) {
      fetchForDate(selectedDate);
    }
  }, [selectedDate, fetchForDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const additionalMeals = getForDate(selectedDate);

  const calendarDates = getWeekDates(mealsCalendarOffset);
  const canGoForward  = mealsCalendarOffset < 0;
  const canGoBack     = mealsCalendarOffset > -8;

  const weekDataByDate: Record<string, typeof weekData[0]> = {};
  weekData.forEach((d) => { weekDataByDate[d.date] = d; });

  const planDayIdx    = weekData.findIndex((d) => d.date === selectedDate);
  const isPlanDate    = planDayIdx !== -1;
  const planDay       = isPlanDate ? planDaysFromPlan[planDayIdx] || planDays[planDayIdx] : null;
  const meals: Meal[] = planDay?.meals || [];
  const dayTrackerData = weekData[planDayIdx];

  const getMealEaten = (mealIndex: number) =>
    dayTrackerData?.meals[mealIndex]?.eaten ?? false;

  const handleToggle = (mealIndex: number) => {
    if (!dayTrackerData) return;
    toggleMeal(dayTrackerData.date, mealIndex, getMealEaten(mealIndex));
  };

  const handleOpenReplacer = (mealIdx: number) => {
    const meal = meals[mealIdx];
    if (!meal || !selectedDate) return;
    const mealType =
      meal.type ||
      ['Breakfast', 'Lunch', 'Snack', 'Dinner', 'Snack 2'][mealIdx] ||
      'Meal';
    openReplacer({
      date: selectedDate,
      dayIndex: planDayIdx,
      mealIndex: mealIdx,
      mealName: `${mealType} · ${planDay?.label || 'Day ' + (planDayIdx + 1)}`,
    });
  };

  const selectedIsFuture = selectedDate > today;
  const eatenCount = dayTrackerData?.meals.filter((m) => m.eaten).length ?? 0;

  // Month label — use middle day to avoid week-boundary wraps
  const monthLabel = format(parseISO(calendarDates[3]), 'MMM yyyy').toUpperCase();

  return (
    <div style={{
      background: s2.bg,
      minHeight: '100%',
      color: s2.text,
      paddingBottom: 90,
    }}>

      {/* ── Section header ────────────────────────────────────────────────── */}
      <div style={{
        padding: '14px 20px 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
      }}>
        <div>
          <HairLabel>{monthLabel}</HairLabel>
          <div style={{
            fontFamily: s2.sans,
            fontSize: 30,
            fontWeight: 400,
            letterSpacing: '-0.025em',
            marginTop: 4,
            lineHeight: 1,
          }}>
            Meals
          </div>
        </div>
        {isPlanDate && (
          <Pill color={s2.accent}>{eatenCount}/{mealsPerDay} EATEN</Pill>
        )}
      </div>

      {/* ── Week strip ────────────────────────────────────────────────────── */}
      <div style={{ padding: '18px 20px 0' }}>
        {/* Navigation row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <NavArrow
            dir="left"
            disabled={!canGoBack}
            onClick={() => setMealsCalendarOffset(mealsCalendarOffset - 1)}
          />
          <HairLabel>
            WEEK OF {format(parseISO(calendarDates[0]), 'dd MMM').toUpperCase()}
          </HairLabel>
          <NavArrow
            dir="right"
            disabled={!canGoForward}
            onClick={() => setMealsCalendarOffset(mealsCalendarOffset + 1)}
          />
        </div>

        {/* 7-day grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {calendarDates.map((date) => {
            const isFuture   = date > today;
            const isSelected = date === selectedDate;
            const dayData    = weekDataByDate[date];
            const eaten      = dayData?.meals.filter((m) => m.eaten).length ?? 0;
            // EEEEE = single-char (M T W T F S S) in date-fns
            const dayLetter  = format(parseISO(date), 'EEEEE');
            const dayNum     = format(parseISO(date), 'd');

            return (
              <button
                key={date}
                disabled={isFuture}
                onClick={() => { if (!isFuture) setSelectedDate(date); }}
                style={{
                  cursor: isFuture ? 'default' : 'pointer',
                  background: isSelected ? s2.accentFill : 'transparent',
                  border: `1px solid ${isSelected ? s2.accent : s2.line}`,
                  padding: '8px 4px',
                  opacity: isFuture ? 0.35 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <div style={{
                  fontFamily: s2.mono,
                  fontSize: 9,
                  color: s2.textDim,
                  letterSpacing: '0.1em',
                }}>
                  {dayLetter}
                </div>
                <div style={{
                  fontFamily: s2.sans,
                  fontSize: 18,
                  fontWeight: 400,
                  color: isSelected ? s2.accent : s2.text,
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                }}>
                  {dayNum}
                </div>
                {/* 3 px square meal-progress dots (max 4) */}
                <div style={{ display: 'flex', gap: 2 }}>
                  {Array.from({ length: Math.min(mealsPerDay, 4) }, (_, k) => (
                    <div
                      key={k}
                      style={{
                        width: 3,
                        height: 3,
                        background: k < eaten ? s2.accent : s2.line,
                      }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Date header ───────────────────────────────────────────────────── */}
      <div style={{
        padding: '22px 20px 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
      }}>
        <div>
          {isPlanDate ? (
            <HairLabel>
              DAY {planDayIdx + 1} OF {planDuration} ·{' '}
              {format(parseISO(selectedDate), 'EEEE').toUpperCase()}
            </HairLabel>
          ) : (
            <HairLabel>{selectedIsFuture ? 'FUTURE DATE' : 'NOT A PLAN DAY'}</HairLabel>
          )}
          <div style={{
            fontFamily: s2.sans,
            fontSize: 22,
            fontWeight: 400,
            marginTop: 4,
            letterSpacing: '-0.02em',
          }}>
            {format(parseISO(selectedDate), 'd MMMM')}
          </div>
        </div>
        {isPlanDate && (
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontFamily: s2.sans,
              fontSize: 28,
              fontWeight: 300,
              color: s2.accent,
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}>
              {eatenCount}
              <span style={{ color: s2.textDim, fontSize: 16 }}>/{mealsPerDay}</span>
            </div>
            <HairLabel style={{ marginTop: 2 }}>EATEN</HairLabel>
          </div>
        )}
      </div>

      {/* ── No-plan empty state ───────────────────────────────────────────── */}
      {!isPlanDate && !selectedIsFuture && (
        <div style={{ padding: '22px 20px 0' }}>
          <Card padding={18}>
            <HairLabel>NO PLAN</HairLabel>
            <div style={{
              fontFamily: s2.sans,
              fontSize: 14,
              color: s2.textDim,
              marginTop: 8,
              lineHeight: 1.5,
            }}>
              No meal plan for this date.
              {weekData.length > 0 && (
                <> Your active plan covers{' '}
                  {weekData[0]?.date} – {weekData[weekData.length - 1]?.date}.
                </>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ── Plan content (only when this date has a plan) ─────────────────── */}
      {isPlanDate && (
        <>
          {/* Water */}
          <div style={{ padding: '18px 20px 0' }}>
            <WaterIntakeCard date={selectedDate} onExpand={() => setShowWaterDetail(true)} />
          </div>

          {/* Macro band */}
          {profile && (
            <div style={{ padding: '12px 20px 0' }}>
              <ErrorBoundary>
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
              </ErrorBoundary>
            </div>
          )}

          {/* ── Meal list ─────────────────────────────────────────────────── */}
          <div style={{ padding: '18px 20px 0' }}>
            <HairLabel style={{ marginBottom: 10 }}>TODAY'S PLAN</HairLabel>

            {meals.map((meal, mealIdx) => {
              const repKey      = `${selectedDate}-${mealIdx}`;
              const replacement = replacements[repKey] as MealReplacement | undefined;
              const isReplaced  = !!replacement;
              const eaten       = getMealEaten(mealIdx);
              const mealType    =
                meal.type ||
                ['Breakfast', 'Lunch', 'Snack', 'Dinner', 'Snack 2'][mealIdx] ||
                'Meal';
              const indexLabel  = String(mealIdx + 1).padStart(2, '0');

              // Resolved nutritional data (replacement overrides plan meal)
              const kcal = isReplaced ? replacement!.calories : meal.calories ?? 0;
              const prot = isReplaced ? replacement!.proteinG : meal.protein  ?? 0;
              const carb = isReplaced ? replacement!.carbsG   : meal.carbs    ?? 0;
              const fat_ = isReplaced ? replacement!.fatG     : meal.fat      ?? 0;
              const fibr = isReplaced ? replacement!.fibreG   : meal.fibre    ?? 0;
              const name = isReplaced ? replacement!.foodName  : meal.name;

              return (
                <div key={mealIdx} style={{ marginBottom: 10 }}>
                  <Card
                    padding={14}
                    style={
                      isReplaced
                        ? { borderColor: s2.accentSoft, background: 'rgba(255,176,102,0.04)' }
                        : eaten
                          ? { background: s2.accentFill }
                          : {}
                    }
                    onClick={() => setDetailMealIdx(mealIdx)}
                  >
                    <div style={{ display: 'flex', gap: 12 }}>
                      {/* ── Index number ────────────────────────────────── */}
                      <div style={{
                        fontFamily: s2.mono,
                        fontSize: 11,
                        color: eaten ? s2.accent : s2.textDim,
                        width: 24,
                        paddingTop: 2,
                        flexShrink: 0,
                      }}>
                        {indexLabel}
                      </div>

                      {/* ── Body ────────────────────────────────────────── */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Type + time header */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          marginBottom: 4,
                        }}>
                          <HairLabel color={eaten ? s2.accent : s2.textDim}>
                            {mealType.toUpperCase()} · {meal.time}
                          </HairLabel>
                          {isReplaced && (
                            <HairLabel color={s2.accentSoft}>↻ SWAPPED</HairLabel>
                          )}
                        </div>

                        {/* Meal name */}
                        <div style={{
                          fontFamily: s2.sans,
                          fontSize: 14,
                          fontWeight: 500,
                          lineHeight: 1.3,
                          color: eaten ? s2.textDim : s2.text,
                          textDecoration: eaten ? 'line-through' : 'none',
                        }}>
                          {name}
                        </div>

                        {/* Macro row */}
                        <div style={{
                          marginTop: 8,
                          display: 'flex',
                          gap: 12,
                          fontFamily: s2.mono,
                          fontSize: 10,
                        }}>
                          <span style={{ color: s2.textDim }}>
                            {kcal}
                            <span style={{ color: s2.textDimmer }}> kcal</span>
                          </span>
                          <span style={{ color: s2.protein }}>P{prot}</span>
                          <span style={{ color: s2.carbs   }}>C{carb}</span>
                          <span style={{ color: s2.fat     }}>F{fat_}</span>
                          <span style={{ color: s2.fibre   }}>Fi{fibr}</span>
                        </div>

                        {/* Swap / undo link */}
                        <div style={{ marginTop: 8 }}>
                          {isReplaced ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); undoReplacement(selectedDate, mealIdx); }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                padding: 0,
                                fontFamily: s2.mono,
                                fontSize: 9,
                                letterSpacing: '0.15em',
                                color: s2.textDimmer,
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                              }}
                            >
                              UNDO SWAP
                            </button>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenReplacer(mealIdx); }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                padding: 0,
                                fontFamily: s2.mono,
                                fontSize: 9,
                                letterSpacing: '0.15em',
                                color: s2.textDimmer,
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                              }}
                            >
                              ↻ SWAP MEAL
                            </button>
                          )}
                        </div>
                      </div>

                      {/* ── Check square ────────────────────────────────── */}
                      <div style={{ paddingTop: 4, flexShrink: 0 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggle(mealIdx); }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                          }}
                        >
                          <Check on={eaten} size={18} />
                        </button>
                      </div>
                    </div>
                  </Card>
                </div>
              );
            })}

            {/* ── Off-plan extra meals ───────────────────────────────────── */}
            {additionalMeals.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <HairLabel style={{ marginBottom: 10 }}>EXTRA MEALS LOGGED</HairLabel>
                {additionalMeals.map((extra) => (
                  <div key={extra.id} style={{ marginBottom: 8 }}>
                    <Card padding={12} style={{ borderColor: s2.lineStrong }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontFamily: s2.sans,
                            fontSize: 13,
                            fontWeight: 500,
                            color: s2.text,
                            lineHeight: 1.3,
                          }}>
                            {extra.foodName || 'Extra meal'}
                          </div>
                          <div style={{
                            marginTop: 6,
                            display: 'flex',
                            gap: 10,
                            fontFamily: s2.mono,
                            fontSize: 10,
                          }}>
                            <span style={{ color: s2.textDim }}>
                              {extra.calories}
                              <span style={{ color: s2.textDimmer }}> kcal</span>
                            </span>
                            <span style={{ color: s2.protein }}>P{extra.proteinG}</span>
                            <span style={{ color: s2.carbs   }}>C{extra.carbsG}</span>
                            <span style={{ color: s2.fat     }}>F{extra.fatG}</span>
                            <span style={{ color: s2.fibre   }}>Fi{extra.fibreG}</span>
                          </div>
                        </div>
                        <HairLabel style={{ marginLeft: 8, flexShrink: 0 }}>OFF-PLAN</HairLabel>
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            )}

            {/* ── + LOG EXTRA MEAL dashed button ────────────────────────── */}
            <div style={{ marginTop: 10 }}>
              <AddMealButton date={selectedDate} />
            </div>
          </div>
        </>
      )}

      <div style={{ height: 16 }} />

      {/* Meal replacer sheet (modal) — logic unchanged */}
      <MealReplacerSheet />

      {/* Water detail full-screen sheet */}
      {showWaterDetail && (
        <WaterDetailSheet
          date={selectedDate}
          onClose={() => setShowWaterDetail(false)}
        />
      )}

      {/* Meal detail full-screen sheet */}
      {detailMealIdx !== null && meals[detailMealIdx] && (() => {
        const mIdx = detailMealIdx;
        const repKey = `${selectedDate}-${mIdx}`;
        return (
          <MealDetailSheet
            meal={meals[mIdx]}
            replacement={replacements[repKey] as MealReplacement | undefined}
            mealIndex={mIdx}
            mealCount={meals.length}
            date={selectedDate}
            planDayLabel={planDay?.label ?? ''}
            eaten={getMealEaten(mIdx)}
            profile={profile}
            allMeals={meals}
            eatenMask={meals.map((_, i) => getMealEaten(i))}
            replacements={replacements as Record<string, MealReplacement | undefined>}
            onClose={() => setDetailMealIdx(null)}
            onToggleEaten={() => handleToggle(mIdx)}
            onOpenReplacer={() => { setDetailMealIdx(null); handleOpenReplacer(mIdx); }}
            onUndoReplacement={() => { undoReplacement(selectedDate, mIdx); setDetailMealIdx(null); }}
          />
        );
      })()}
    </div>
  );
}
