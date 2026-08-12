import { useEffect, useState, useCallback } from 'react';
import { format, parseISO, addWeeks, startOfWeek, addDays } from 'date-fns';
import { PullRefreshWrapper } from './ui/PullRefreshWrapper';
import { useAppStore } from '../store/appStore';
import { useMealReplacerStore } from '../store/mealReplacerStore';
import { useAdditionalMealsStore } from '../store/additionalMealsStore';
import { useTracker } from '../hooks/useTracker';
import { usePlan } from '../hooks/usePlan';
import { track, trackPage } from '../lib/analytics';
import { Meal, MealReplacement } from '../types';
import { getPlanDayIndex } from '../utils/planUtils';
import { MealReplacerSheet } from './MealReplacerSheet';
import { MealDetailSheet } from './MealDetailSheet';
import { ChangeMealSheet } from './ChangeMealSheet';
import { WaterIntakeCard } from './WaterIntakeCard';
import { WaterDetailSheet } from './WaterDetailSheet';
import { MacroAchievementCard } from './MacroAchievementCard';
import { AddMealButton } from './AddMealButton';
import { ExtraMealCard } from './ExtraMealCard';
import { ErrorBoundary } from './ErrorBoundary';
import { s2 } from '../theme/tokens';
import { HairLabel, Pill, Card, Check } from './ui';

// ── helpers ────────────────────────────────────────────────────────────────
function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function getWeekDates(weekOffset: number): string[] {
  const today = new Date();
  const monday = startOfWeek(today, { weekStartsOn: 1 });
  const targetMonday = addWeeks(monday, weekOffset);
  return Array.from({ length: 7 }, (_, i) =>
    format(addDays(targetMonday, i), 'yyyy-MM-dd')
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
        border: `1.5px solid ${disabled ? s2.line : s2.lineStrong}`,
        borderRadius: s2.rPill,
        width: 30,
        height: 30,
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

// ── Pastel food disc (ref: V3Food) ────────────────────────────────────────
const FOOD_TINTS = [s2.butter, s2.peach, s2.lilac, s2.mint, s2.sky];

function FoodDisc({ size = 50, tint, glyph }: { size?: number; tint: string; glyph?: 'leaf' | 'bowl' }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: s2.rPill, flexShrink: 0,
      display: 'grid', placeItems: 'center',
      background: `radial-gradient(circle at 35% 30%, #fff 0%, ${tint} 55%, ${tint} 100%)`,
      boxShadow: 'inset 0 -4px 10px rgba(15,20,15,0.08)',
    }}>
      <svg width={size * 0.46} height={size * 0.46} viewBox="0 0 24 24" fill="none" stroke="rgba(15,20,15,0.55)" strokeWidth="1.7" strokeLinecap="round">
        {glyph === 'leaf'
          ? <path d="M20 4C10 4 4 10 4 20c10 0 16-6 16-16zM4 20L14 10" />
          : <><path d="M3 11h18a9 9 0 01-18 0z" /><path d="M8 7c0-2 1-3 2-3M13 7c0-3 2-4 3-4" /></>}
      </svg>
    </div>
  );
}

// ── Macro chips row (ref: meal-card chips) ────────────────────────────────
function MacroChips({ kcal, p, c, f }: { kcal: number; p: number; c: number; f: number }) {
  const chip = (bg: string, color: string, label: string) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', background: bg, color,
      borderRadius: s2.rPill, padding: '4px 9px', fontFamily: s2.sans,
      fontSize: 10, fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap',
    }}>{label}</span>
  );
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
      {chip(s2.bg, s2.text, `${Math.round(kcal)} kcal`)}
      {chip('rgba(111,185,59,0.14)', '#4C8526', `P ${Math.round(p)}`)}
      {chip('rgba(242,185,59,0.16)', '#8A6410', `C ${Math.round(c)}`)}
      {chip('rgba(255,138,107,0.16)', '#B3492C', `F ${Math.round(f)}`)}
    </div>
  );
}

// ── MealsTab ───────────────────────────────────────────────────────────────
export function MealsTab() {
  const [showWaterDetail, setShowWaterDetail]   = useState(false);
  const [detailMealIdx,   setDetailMealIdx]     = useState<number | null>(null);
  const [changeMealIdx,   setChangeMealIdx]     = useState<number | null>(null);

  // Track page view once on mount
  useEffect(() => { trackPage('meals_tab'); }, []);

  const {
    selectedDate,
    setSelectedDate,
    mealsCalendarOffset,
    setMealsCalendarOffset,
    mealsPerDay,
    planDuration,
    planWeekStartDate,
    profile,
    activePlanId,
  } = useAppStore();

  // Auto-select today when the tab first mounts
  useEffect(() => { setSelectedDate(todayStr()); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { weekData, toggleMeal, loadWeekData } = useTracker();
  const { planDays: planDaysFromPlan, loadPlan } = usePlan();
  const { replacements, openReplacer, undoReplacement, fetchReplacementsForWeek } =
    useMealReplacerStore();
  const { fetchForDate, getForDate } = useAdditionalMealsStore();

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      loadPlan(),
      loadWeekData(calendarDates[0]),
      fetchReplacementsForWeek(),
    ]);
  }, [loadPlan, loadWeekData, fetchReplacementsForWeek]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = todayStr();

  const calendarDates = getWeekDates(mealsCalendarOffset);
  const canGoForward  = mealsCalendarOffset < 1;  // allow 1 week ahead to preview cycling plan
  const canGoBack     = mealsCalendarOffset > -8;

  // Re-fetch tracker logs whenever the visible calendar week changes so that
  // the meal-toggle and eaten-status lookups always have data for the current week.
  useEffect(() => {
    loadWeekData(calendarDates[0]);
  }, [mealsCalendarOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchReplacementsForWeek();
  }, [fetchReplacementsForWeek]);

  useEffect(() => {
    if (selectedDate && selectedDate <= today) {
      fetchForDate(selectedDate);
    }
  }, [selectedDate, fetchForDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const additionalMeals = getForDate(selectedDate);

  // Build date-keyed lookup for O(1) eaten-status access
  const weekDataByDate: Record<string, typeof weekData[0]> = {};
  weekData.forEach((d) => { weekDataByDate[d.date] = d; });

  // ── Cycling day-index calculation ────────────────────────────────────────
  // Use modulo arithmetic so plans repeat indefinitely after plan start.
  // -1 only for dates before the plan started (genuinely no plan).
  const planDayIdx     = getPlanDayIndex(selectedDate, planWeekStartDate, planDuration);
  const isPlanDate     = planDayIdx >= 0;
  // A plan covers days that have not happened yet. Nothing has been eaten or
  // drunk on those, so the consumption summaries are hidden — matches
  // MacroAchievementCard's own future-date check, which uses local time.
  const isFutureDate   = selectedDate > todayStr();
  // planDaysFromPlan is always the authoritative source (loaded fresh from the API hook)
  const planDay        = isPlanDate ? (planDaysFromPlan[planDayIdx] ?? null) : null;
  const meals: Meal[]  = planDay?.meals || [];
  // Tracker data: look up by date (independent of position in weekData array)
  const dayTrackerData = weekDataByDate[selectedDate] ?? null;

  const getMealEaten = (mealIndex: number) =>
    dayTrackerData?.meals.find(m => m.mealIndex === mealIndex)?.eaten ?? false;

  const handleToggle = (mealIndex: number) => {
    if (!isPlanDate || selectedIsFuture) return; // can't mark future meals
    const wasEaten = getMealEaten(mealIndex);
    const meal = meals[mealIndex];
    const mealType = meal?.type || ['Breakfast', 'Lunch', 'Snack', 'Dinner', 'Snack 2'][mealIndex] || 'Meal';
    track(wasEaten ? 'meal_unmarked_eaten' : 'meal_marked_eaten', {
      meal_index: mealIndex,
      meal_type:  mealType,
      day_index:  planDayIdx,
    });
    toggleMeal(selectedDate, mealIndex, wasEaten);
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
    <PullRefreshWrapper onRefresh={handleRefresh} style={{ background: s2.bg, minHeight: '100%', color: s2.text, paddingBottom: 90 }}>

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
            fontFamily: s2.disp,
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: '-0.042em',
            marginTop: 6,
            lineHeight: 1.02,
          }}>
            Meals
          </div>
        </div>
        {isPlanDate && (
          <Pill filled>DAY {planDayIdx + 1} OF {planDuration}</Pill>
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
            onClick={() => {
              setMealsCalendarOffset(mealsCalendarOffset - 1);
              track('calendar_week_navigated', { direction: 'back' });
            }}
          />
          <HairLabel>
            WEEK OF {format(parseISO(calendarDates[0]), 'dd MMM').toUpperCase()}
          </HairLabel>
          <NavArrow
            dir="right"
            disabled={!canGoForward}
            onClick={() => {
              setMealsCalendarOffset(mealsCalendarOffset + 1);
              track('calendar_week_navigated', { direction: 'forward' });
            }}
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

            // Future dates: allow tapping to preview cycling plan meals (just can't mark eaten)
            const hasPlanOnDate = getPlanDayIndex(date, planWeekStartDate, planDuration) >= 0;
            const clickable     = hasPlanOnDate || !isFuture;
            return (
              <button
                key={date}
                disabled={!clickable}
                onClick={() => { if (clickable) setSelectedDate(date); }}
                style={{
                  cursor: clickable ? 'pointer' : 'default',
                  background: isSelected ? s2.accentFill : s2.surface,
                  border: 'none',
                  borderRadius: 18,
                  padding: '10px 2px',
                  opacity: !clickable ? 0.35 : isFuture ? 0.65 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <div style={{
                  fontFamily: s2.sans,
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: isSelected ? 'rgba(15,20,15,0.6)' : s2.textDimmer,
                  letterSpacing: '0.08em',
                }}>
                  {dayLetter}
                </div>
                <div style={{
                  fontFamily: s2.disp,
                  fontSize: 17,
                  fontWeight: 700,
                  color: s2.ink,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}>
                  {dayNum}
                </div>
                {/* round meal-progress dots (max 4) */}
                <div style={{ display: 'flex', gap: 2.5 }}>
                  {Array.from({ length: Math.min(mealsPerDay, 4) }, (_, k) => (
                    <div
                      key={k}
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: s2.rPill,
                        background: k < eaten
                          ? (isSelected ? s2.ink : s2.accent)
                          : (isSelected ? 'rgba(15,20,15,0.2)' : 'rgba(15,20,15,0.13)'),
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
            <HairLabel>{selectedIsFuture ? 'FUTURE DATE' : 'BEFORE PLAN START'}</HairLabel>
          )}
          <div style={{
            fontFamily: s2.disp,
            fontSize: 22,
            fontWeight: 700,
            marginTop: 5,
            letterSpacing: '-0.035em',
          }}>
            {format(parseISO(selectedDate), 'd MMMM')}
          </div>
        </div>
        {isPlanDate && (
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontFamily: s2.disp,
              fontSize: 28,
              fontWeight: 700,
              color: s2.accent,
              letterSpacing: '-0.035em',
              lineHeight: 1,
            }}>
              {eatenCount}
              <span style={{ color: s2.textDim, fontSize: 16 }}>/{mealsPerDay}</span>
            </div>
            <HairLabel style={{ marginTop: 3 }}>EATEN</HairLabel>
          </div>
        )}
      </div>

      {/* ── No-plan empty state — only shown for dates BEFORE plan started ── */}
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
              {planWeekStartDate && (
                <> Your plan started on {planWeekStartDate} and repeats every {planDuration} days.
                </>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ── Plan content (only when this date has a plan) ─────────────────── */}
      {isPlanDate && (
        <>
          {/* Macro band + hydration, side by side.
              Hydration used to be a full-width horizontal card stacked above
              the lime band, while the band's own right side — past the short
              macro ticks — sat empty. Pairing them fills that space and saves
              a row of vertical scroll. `alignItems: stretch` makes the sky
              column match the band's height whatever the macro count.

              Both are consumption summaries, so neither belongs on a future
              date: there is nothing eaten and nothing drunk to report yet.
              A future day goes straight from the date header to the plan. */}
          {!isFutureDate && (
            profile ? (
              <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'stretch', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
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
                <div style={{ width: 96, flexShrink: 0 }}>
                  <WaterIntakeCard date={selectedDate} onExpand={() => setShowWaterDetail(true)} />
                </div>
              </div>
            ) : (
              /* No profile — the band cannot render without targets, so
                 hydration keeps the full width rather than sitting in a
                 narrow column beside a gap. */
              <div style={{ padding: '18px 20px 0' }}>
                <WaterIntakeCard date={selectedDate} onExpand={() => setShowWaterDetail(true)} />
              </div>
            )
          )}

          {/* ── Meal list ─────────────────────────────────────────────────── */}
          <div style={{ padding: '18px 20px 0' }}>
            <HairLabel style={{ marginBottom: 10 }}>
              {selectedDate === todayStr() ? "TODAY'S PLAN" : `${format(parseISO(selectedDate), 'EEEE').toUpperCase()}'S PLAN`}
            </HairLabel>

            {meals.filter((m: any) => m != null).map((meal, mealIdx) => {
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
                    padding={15}
                    radius={24}
                    onClick={() => {
                      setDetailMealIdx(mealIdx);
                      track('meal_detail_opened', {
                        meal_type: mealType,
                        meal_name: name,
                      });
                    }}
                  >
                    <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
                      {/* ── Pastel food disc ────────────────────────────── */}
                      <FoodDisc
                        size={50}
                        tint={FOOD_TINTS[mealIdx % FOOD_TINTS.length]}
                        glyph={mealIdx === meals.length - 1 ? 'leaf' : 'bowl'}
                      />

                      {/* ── Body ────────────────────────────────────────── */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Type + time header */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          flexWrap: 'wrap',
                        }}>
                          <HairLabel>
                            {mealType.toUpperCase()} · {meal.time}
                          </HairLabel>
                          {isReplaced && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center',
                              background: s2.accentWash, color: '#4C7010',
                              borderRadius: s2.rPill, padding: '3px 7px',
                              fontFamily: s2.sans, fontSize: 9, fontWeight: 700,
                            }}>↻ SWAPPED</span>
                          )}
                        </div>

                        {/* Meal name */}
                        <div style={{
                          fontFamily: s2.sans,
                          fontSize: 14,
                          fontWeight: 700,
                          letterSpacing: '-0.015em',
                          lineHeight: 1.3,
                          marginTop: 5,
                          color: eaten ? s2.textDim : s2.text,
                        }}>
                          {name}
                        </div>

                        {/* Macro chips */}
                        <MacroChips kcal={kcal} p={prot} c={carb} f={fat_} />

                        {/* Action links row */}
                        <div style={{ marginTop: 8, display: 'flex', gap: 14, alignItems: 'center' }}>
                          {isReplaced ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); undoReplacement(selectedDate, mealIdx); }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                padding: 0,
                                fontFamily: s2.sans,
                                fontSize: 10,
                                fontWeight: 800,
                                letterSpacing: '0.08em',
                                color: s2.textDimmer,
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                              }}
                            >
                              UNDO SWAP
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                track('swap_meal_tapped', { meal_type: mealType });
                                handleOpenReplacer(mealIdx);
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                padding: 0,
                                fontFamily: s2.sans,
                                fontSize: 10,
                                fontWeight: 800,
                                letterSpacing: '0.08em',
                                color: s2.textDimmer,
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                              }}
                            >
                              ↻ SWAP MEAL
                            </button>
                          )}
                          {/* ✎ CHANGE MEAL — permanently replaces in plan */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              track('change_meal_tapped', { meal_type: mealType });
                              setChangeMealIdx(mealIdx);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              padding: 0,
                              fontFamily: s2.sans,
                              fontSize: 10,
                              fontWeight: 800,
                              letterSpacing: '0.08em',
                              color: s2.textDimmer,
                              cursor: 'pointer',
                              textTransform: 'uppercase',
                            }}
                          >
                            ✎ CHANGE
                          </button>
                        </div>
                      </div>

                      {/* ── Check square (hidden for future dates) ─────── */}
                      {!selectedIsFuture && (
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
                            <Check on={eaten} size={26} />
                          </button>
                        </div>
                      )}
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
                  <ExtraMealCard key={extra.id} meal={extra} />
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
            mealPlanId={activePlanId}
            dayIndex={planDay?.dayIndex ?? planDayIdx}
            onClose={() => setDetailMealIdx(null)}
            onToggleEaten={() => handleToggle(mIdx)}
            onOpenReplacer={() => { setDetailMealIdx(null); handleOpenReplacer(mIdx); }}
            onUndoReplacement={() => { undoReplacement(selectedDate, mIdx); setDetailMealIdx(null); }}
          />
        );
      })()}

      {/* ✎ Change Meal — permanently replaces plan meal in DB */}
      {changeMealIdx !== null && meals[changeMealIdx] && (() => {
        const mIdx = changeMealIdx;
        const dayIdx = planDay?.dayIndex ?? planDayIdx;
        return (
          <ChangeMealSheet
            meal={meals[mIdx]}
            mealIndex={mIdx}
            dayIndex={dayIdx}
            onClose={() => setChangeMealIdx(null)}
            onMealUpdated={async () => {
              setChangeMealIdx(null);
              await loadPlan(); // refresh plan from DB so UI reflects the change
            }}
          />
        );
      })()}
    </PullRefreshWrapper>
  );
}
