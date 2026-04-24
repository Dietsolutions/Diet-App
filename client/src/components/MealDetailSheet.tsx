// MealDetailSheet — Strain v2 full-screen detail view for a single meal.
// Opened by tapping a meal card in MealsTab.

import { s2 } from '../theme/tokens';
import { HairLabel, VBar, DataRow, TopBar, Bar } from './ui';
import { Meal, MealReplacement, UserProfile } from '../types';

// ── helpers ────────────────────────────────────────────────────────────────

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

// ── sub-components ─────────────────────────────────────────────────────────

interface MacroColProps {
  label: string;
  value: number;
  pct: number;
  color: string;
  unit?: string;
}

function MacroCol({ label, value, pct, color, unit = 'g' }: MacroColProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <VBar pct={clamp01(pct)} color={color} h={64} />
      <div style={{ fontFamily: s2.mono, fontSize: 12, color, fontWeight: 500 }}>
        {value}
        <span style={{ fontSize: 9, color: s2.textDimmer, marginLeft: 1 }}>{unit}</span>
      </div>
      <HairLabel style={{ fontSize: 7 }}>{label}</HairLabel>
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────

export interface MealDetailSheetProps {
  meal: Meal;
  replacement?: MealReplacement;
  mealIndex: number;
  mealCount: number;
  date: string;
  planDayLabel: string;
  eaten: boolean;
  profile: UserProfile | null;
  /** All plan meals for the selected day — used for day-impact calc */
  allMeals: Meal[];
  /** eaten[i] === true if meal i is marked eaten */
  eatenMask: boolean[];
  /** keyed by `${date}-${mealIndex}` */
  replacements: Record<string, MealReplacement | undefined>;
  onClose: () => void;
  onToggleEaten: () => void;
  onOpenReplacer: () => void;
  onUndoReplacement: () => void;
}

// ── MealDetailSheet ────────────────────────────────────────────────────────

export function MealDetailSheet({
  meal,
  replacement,
  mealIndex,
  mealCount,
  date: _date,
  eaten,
  profile,
  allMeals,
  eatenMask,
  replacements,
  onClose,
  onToggleEaten,
  onOpenReplacer,
  onUndoReplacement,
}: MealDetailSheetProps) {
  const isReplaced = !!replacement;

  // Resolved macros (replacement overrides plan meal)
  const kcal = isReplaced ? replacement!.calories    : meal.calories ?? 0;
  const prot = isReplaced ? replacement!.proteinG    : meal.protein  ?? 0;
  const carb = isReplaced ? replacement!.carbsG      : meal.carbs    ?? 0;
  const fat_ = isReplaced ? replacement!.fatG        : meal.fat      ?? 0;
  const fibr = isReplaced ? replacement!.fibreG      : meal.fibre    ?? 0;
  const name = isReplaced ? replacement!.foodName    : meal.name;

  const mealType = meal.type
    || ['Breakfast', 'Lunch', 'Snack', 'Dinner', 'Snack 2'][mealIndex]
    || 'Meal';

  const indexLabel  = String(mealIndex + 1).padStart(2, '0');
  const countLabel  = String(mealCount).padStart(2, '0');
  const kicker      = `MEAL ${indexLabel} OF ${countLabel} · ${mealType.toUpperCase()} · ${meal.time}`;

  // ── Macro targets for VBar fill ──
  const protTarget  = profile?.proteinTarget ?? 1;
  const carbTarget  = profile?.carbTarget    ?? 1;
  const fatTarget   = profile?.fatTarget     ?? 1;
  const fibreTarget = profile?.fibreTarget   ?? 1;
  const kcalTarget  = profile?.targetCalories ?? 1;

  // ── Day-impact calculation ──
  // Sum kcal of meals that are currently eaten (excluding this one to get "so far")
  let soFarKcal = 0;
  allMeals.forEach((m, i) => {
    if (i === mealIndex) return; // skip this meal
    if (!eatenMask[i]) return;
    const repKey = `${_date}-${i}`;
    const rep = replacements[repKey];
    soFarKcal += rep ? rep.calories : (m.calories ?? 0);
  });
  const withMealKcal = soFarKcal + kcal;
  const soFarPct     = clamp01(soFarKcal / kcalTarget);
  const withMealPct  = clamp01(withMealKcal / kcalTarget);
  const overTarget   = withMealKcal > kcalTarget;

  // ── Ingredients ──
  const ingredients = meal.ingredients ?? [];

  // ── Render ──
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 480,
        background: s2.bg,
        zIndex: 45,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <TopBar
        onBack={onClose}
        kicker={kicker}
        right={
          isReplaced ? (
            <div
              style={{
                fontFamily: s2.mono,
                fontSize: 8,
                letterSpacing: '0.12em',
                color: s2.accentSoft,
                textAlign: 'center',
                lineHeight: 1.3,
              }}
            >
              ↻<br />SWAPPED
            </div>
          ) : null
        }
      />

      {/* ── Scrollable body ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 110 }}>

        {/* ── Hero name + description ───────────────────────────────────── */}
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{
            fontFamily: s2.sans,
            fontSize: 28,
            fontWeight: 400,
            letterSpacing: '-0.025em',
            color: eaten ? s2.textDim : s2.text,
            textDecoration: eaten ? 'line-through' : 'none',
            lineHeight: 1.15,
          }}>
            {name}
          </div>
          {meal.description && (
            <div style={{
              fontFamily: s2.sans,
              fontSize: 13,
              color: s2.textDim,
              marginTop: 10,
              lineHeight: 1.55,
            }}>
              {meal.description}
            </div>
          )}
        </div>

        {/* ── Macro hero card ───────────────────────────────────────────── */}
        <div style={{
          margin: '20px 20px 0',
          border: `1px solid ${s2.lineStrong}`,
          background: s2.surface,
          padding: '16px 14px',
        }}>
          {/* Big kcal */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{
              fontFamily: s2.mono,
              fontSize: 52,
              fontWeight: 400,
              color: s2.accent,
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}>
              {kcal}
            </div>
            <HairLabel style={{ marginTop: 6 }}>KCAL THIS MEAL</HairLabel>
          </div>

          {/* 4 VBar columns */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            gap: 6,
            justifyItems: 'center',
          }}>
            <MacroCol label="PROTEIN"  value={prot} pct={prot / protTarget}   color={s2.protein} />
            <MacroCol label="CARBS"    value={carb} pct={carb / carbTarget}   color={s2.carbs}   />
            <MacroCol label="FAT"      value={fat_} pct={fat_ / fatTarget}    color={s2.fat}     />
            <MacroCol label="FIBRE"    value={fibr} pct={fibr / fibreTarget}  color={s2.fibre}   />
          </div>
        </div>

        {/* ── Day impact ────────────────────────────────────────────────── */}
        {kcalTarget > 0 && (
          <div style={{
            margin: '12px 20px 0',
            border: `1px solid ${s2.line}`,
            background: s2.surface,
            padding: '14px',
          }}>
            <HairLabel style={{ marginBottom: 12 }}>IMPACT ON TODAY</HairLabel>

            {/* Before / after bar */}
            <div style={{ position: 'relative', marginBottom: 8 }}>
              {/* So-far fill */}
              <Bar pct={soFarPct} color={s2.lineStrong} h={6} />
              {/* With-this-meal overlay (positioned at soFar px offset) */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: 6,
                pointerEvents: 'none',
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: `${soFarPct * 100}%`,
                  width: `${(withMealPct - soFarPct) * 100}%`,
                  height: '100%',
                  background: overTarget ? s2.warn : s2.accent,
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <div style={{ fontFamily: s2.mono, fontSize: 10, color: s2.textDimmer }}>WITHOUT</div>
                <div style={{ fontFamily: s2.mono, fontSize: 14, color: s2.textDim }}>{soFarKcal} <span style={{ fontSize: 9, color: s2.textDimmer }}>kcal</span></div>
              </div>
              <div style={{ fontFamily: s2.mono, fontSize: 9, color: s2.textDimmer, alignSelf: 'center' }}>→</div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: s2.mono, fontSize: 10, color: s2.textDimmer }}>WITH MEAL</div>
                <div style={{ fontFamily: s2.mono, fontSize: 14, color: overTarget ? s2.warn : s2.accent }}>
                  {withMealKcal} <span style={{ fontSize: 9, color: s2.textDimmer }}>kcal</span>
                </div>
              </div>
            </div>

            {/* Target line */}
            <div style={{
              marginTop: 8,
              display: 'flex',
              justifyContent: 'flex-end',
            }}>
              <HairLabel style={{ fontSize: 7 }}>
                {overTarget
                  ? `${withMealKcal - kcalTarget} KCAL OVER TARGET`
                  : `${kcalTarget - withMealKcal} KCAL REMAINING OF ${kcalTarget}`}
              </HairLabel>
            </div>
          </div>
        )}

        {/* ── Ingredients ──────────────────────────────────────────────── */}
        {ingredients.length > 0 && (
          <div style={{ margin: '12px 20px 0' }}>
            <HairLabel style={{ marginBottom: 4 }}>INGREDIENTS</HairLabel>
            <div style={{ border: `1px solid ${s2.line}`, background: s2.surface, padding: '0 14px' }}>
              {ingredients.map((ing, i) => (
                <DataRow
                  key={i}
                  label={String(i + 1).padStart(2, '0')}
                  value={ing}
                  last={i === ingredients.length - 1}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Cooking tip ───────────────────────────────────────────────── */}
        {meal.cookingTip && (
          <div style={{
            margin: '12px 20px 0',
            border: `1px solid ${s2.line}`,
            background: s2.surface,
            padding: '12px 14px',
          }}>
            <HairLabel style={{ marginBottom: 8 }}>COOKING TIP</HairLabel>
            <div style={{
              fontFamily: s2.sans,
              fontSize: 13,
              color: s2.textDim,
              lineHeight: 1.55,
            }}>
              {meal.cookingTip}
            </div>
          </div>
        )}

        {/* ── Swap info (if replaced) ───────────────────────────────────── */}
        {isReplaced && (
          <div style={{
            margin: '12px 20px 0',
            border: `1px solid ${s2.accentSoft}`,
            background: 'rgba(255,176,102,0.05)',
            padding: '12px 14px',
          }}>
            <HairLabel color={s2.accentSoft} style={{ marginBottom: 8 }}>ORIGINAL PLAN MEAL</HairLabel>
            <div style={{
              fontFamily: s2.sans,
              fontSize: 13,
              color: s2.textDim,
              lineHeight: 1.4,
            }}>
              {meal.name}
            </div>
            <div style={{
              marginTop: 6,
              fontFamily: s2.mono,
              fontSize: 10,
              color: s2.textDimmer,
            }}>
              {meal.calories ?? 0} kcal · P{meal.protein ?? 0} C{meal.carbs ?? 0} F{meal.fat ?? 0}
            </div>
            <button
              onClick={onUndoReplacement}
              style={{
                marginTop: 10,
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
              RESTORE ORIGINAL
            </button>
          </div>
        )}

        <div style={{ height: 20 }} />
      </div>

      {/* ── Pinned CTA bar ─────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: s2.bg,
        borderTop: `1px solid ${s2.lineStrong}`,
        padding: '12px 20px max(env(safe-area-inset-bottom, 0px), 16px)',
        display: 'flex',
        gap: 10,
      }}>
        {/* Mark as eaten / uneaten */}
        <button
          onClick={onToggleEaten}
          style={{
            flex: 2,
            padding: '14px 0',
            background: eaten ? s2.surface2 : s2.accent,
            border: `1px solid ${eaten ? s2.lineStrong : s2.accent}`,
            fontFamily: s2.mono,
            fontSize: 10,
            letterSpacing: '0.15em',
            color: eaten ? s2.textDim : s2.bg,
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          {eaten ? '✓ EATEN — UNDO' : 'MARK AS EATEN'}
        </button>

        {/* Swap with AI */}
        {!isReplaced ? (
          <button
            onClick={onOpenReplacer}
            style={{
              flex: 1,
              padding: '14px 0',
              background: 'transparent',
              border: `1px solid ${s2.lineStrong}`,
              fontFamily: s2.mono,
              fontSize: 10,
              letterSpacing: '0.12em',
              color: s2.textDim,
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            ↻ SWAP
          </button>
        ) : (
          <button
            onClick={onUndoReplacement}
            style={{
              flex: 1,
              padding: '14px 0',
              background: 'transparent',
              border: `1px solid ${s2.lineStrong}`,
              fontFamily: s2.mono,
              fontSize: 10,
              letterSpacing: '0.12em',
              color: s2.textDimmer,
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            UNDO SWAP
          </button>
        )}
      </div>
    </div>
  );
}
