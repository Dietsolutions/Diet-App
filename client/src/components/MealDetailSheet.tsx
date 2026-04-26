// MealDetailSheet — Strain v2 full-screen detail view for a single meal.
// Opened by tapping a meal card in MealsTab.
// Includes on-demand cooking instructions + audio guide (Web Speech API).

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { s2 } from '../theme/tokens';
import { HairLabel, VBar, DataRow, TopBar, Bar } from './ui';
import { Meal, MealReplacement, UserProfile, MealCookingInstructions } from '../types';
import { useAudioGuide } from '../hooks/useAudioGuide';

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
  /** Active meal plan ID — required for cooking instructions */
  mealPlanId: string | null;
  /** Day index within the plan — required for cooking instructions */
  dayIndex: number;
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
  mealPlanId,
  dayIndex,
  onClose,
  onToggleEaten,
  onOpenReplacer,
  onUndoReplacement,
}: MealDetailSheetProps) {
  const isReplaced = !!replacement;

  // ── Cooking instructions state ─────────────────────────────────────────────
  const [cookInstr,       setCookInstr]       = useState<MealCookingInstructions | null>(null);
  const [cookLoading,     setCookLoading]     = useState(true);   // initial fetch
  const [cookGenerating,  setCookGenerating]  = useState(false);  // text generation in progress
  const [audioGenerating, setAudioGenerating] = useState(false);  // audio script generation
  const [cookError,       setCookError]       = useState('');
  const [cookExpanded,    setCookExpanded]    = useState(false);  // accordion open/close

  const { isPlaying, isPaused, progress: audioProgress, play, pause, stop } = useAudioGuide(cookInstr?.audioScript ?? null);

  // Fetch existing instructions on open (only if mealPlanId is known)
  useEffect(() => {
    if (!mealPlanId) { setCookLoading(false); return; }
    setCookLoading(true);
    axios.get('/api/meals/instructions', {
      params: { mealPlanId, dayIndex, mealIndex },
      withCredentials: true,
    })
      .then(r => setCookInstr(r.data.instructions || null))
      .catch(() => {/* silent — show "not generated" state */})
      .finally(() => setCookLoading(false));
  }, [mealPlanId, dayIndex, mealIndex]);

  const handleGenerateInstructions = useCallback(async () => {
    if (!mealPlanId) return;
    setCookGenerating(true);
    setCookError('');
    try {
      const r = await axios.post('/api/meals/instructions/generate', { mealPlanId, dayIndex, mealIndex }, { withCredentials: true });
      setCookInstr(r.data.instructions);
      setCookExpanded(true);
    } catch (err: any) {
      setCookError(err?.response?.data?.error || 'Failed to generate. Try again.');
    } finally {
      setCookGenerating(false);
    }
  }, [mealPlanId, dayIndex, mealIndex]);

  const handleGenerateAudio = useCallback(async () => {
    if (!mealPlanId) return;
    setAudioGenerating(true);
    setCookError('');
    try {
      const r = await axios.post('/api/meals/instructions/generate-audio', { mealPlanId, dayIndex, mealIndex }, { withCredentials: true });
      setCookInstr(r.data.instructions);
    } catch (err: any) {
      setCookError(err?.response?.data?.error || 'Failed to generate audio. Try again.');
    } finally {
      setAudioGenerating(false);
    }
  }, [mealPlanId, dayIndex, mealIndex]);

  // ── Resolved macros (replacement overrides plan meal)
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

  // ── Audio button shared style ──
  const audioBtn: React.CSSProperties = {
    width: 34, height: 34, flexShrink: 0,
    background: 'transparent',
    border: `1px solid ${s2.lineStrong}`,
    color: s2.textDim,
    fontFamily: s2.mono, fontSize: 13,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

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

        {/* ── Cooking Instructions ─────────────────────────────────────── */}
        {mealPlanId && (
          <div style={{ margin: '12px 20px 0' }}>

            {/* Accordion header */}
            <button
              onClick={() => setCookExpanded(p => !p)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
                background: 'transparent', border: `1px solid ${s2.line}`,
                padding: '10px 14px', cursor: 'pointer',
              }}
            >
              <HairLabel style={{ margin: 0 }}>COOKING INSTRUCTIONS</HairLabel>
              <span style={{ fontFamily: s2.mono, fontSize: 10, color: s2.textDimmer }}>
                {cookExpanded ? '▲' : '▼'}
              </span>
            </button>

            {cookExpanded && (
              <div style={{ border: `1px solid ${s2.line}`, borderTop: 'none', background: s2.surface }}>

                {/* ── Loading skeleton ── */}
                {cookLoading && (
                  <div style={{ padding: '20px 14px', textAlign: 'center' }}>
                    <div style={{ fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.18em', color: s2.textDimmer }}>
                      CHECKING…
                    </div>
                  </div>
                )}

                {/* ── Not yet generated ── */}
                {!cookLoading && !cookInstr && !cookGenerating && (
                  <div style={{ padding: '20px 14px', textAlign: 'center' }}>
                    <div style={{
                      fontFamily: s2.sans, fontSize: 13, color: s2.textDim,
                      lineHeight: 1.5, marginBottom: 16,
                    }}>
                      Get step-by-step instructions with exact ingredients and quantities.
                    </div>
                    {cookError && (
                      <div style={{
                        marginBottom: 12, padding: '8px 10px',
                        border: `1px solid rgba(255,62,62,0.35)`,
                        background: 'rgba(255,62,62,0.07)',
                        fontFamily: s2.sans, fontSize: 11, color: s2.warn,
                      }}>{cookError}</div>
                    )}
                    <button
                      onClick={handleGenerateInstructions}
                      style={{
                        width: '100%', padding: '13px 0',
                        background: 'transparent', border: `1px solid ${s2.accent}`,
                        fontFamily: s2.mono, fontSize: 10, fontWeight: 600,
                        letterSpacing: '0.18em', color: s2.accent,
                        cursor: 'pointer', textTransform: 'uppercase',
                      }}
                    >
                      GENERATE INSTRUCTIONS
                    </button>
                  </div>
                )}

                {/* ── Generating spinner ── */}
                {cookGenerating && (
                  <div style={{ padding: '28px 14px', textAlign: 'center' }}>
                    <div style={{ fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.2em', color: s2.textDimmer }}>
                      GENERATING…
                    </div>
                    <div style={{ fontFamily: s2.sans, fontSize: 11, color: s2.textDimmer, marginTop: 6 }}>
                      About 10 seconds
                    </div>
                  </div>
                )}

                {/* ── Instructions loaded ── */}
                {!cookLoading && !cookGenerating && cookInstr && (
                  <>
                    {/* Time strip */}
                    <div style={{ display: 'flex', borderBottom: `1px solid ${s2.line}` }}>
                      {[
                        { label: 'PREP',  value: cookInstr.prepTime  },
                        { label: 'COOK',  value: cookInstr.cookTime  },
                        { label: 'TOTAL', value: cookInstr.totalTime },
                      ].map((s, i) => (
                        <div key={i} style={{
                          flex: 1, padding: '12px 0', textAlign: 'center',
                          borderRight: i < 2 ? `1px solid ${s2.line}` : 'none',
                        }}>
                          <HairLabel style={{ marginBottom: 4, fontSize: 7 }}>{s.label}</HairLabel>
                          <div style={{ fontFamily: s2.mono, fontSize: 12, color: s2.text }}>{s.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Audio guide */}
                    <div style={{ padding: '12px 14px', borderBottom: `1px solid ${s2.line}` }}>
                      <HairLabel style={{ marginBottom: 8 }}>AUDIO GUIDE</HairLabel>

                      {cookInstr.audioScript ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isPlaying ? 8 : 0 }}>
                            <div style={{ flex: 1, fontFamily: s2.sans, fontSize: 12, color: s2.textDim }}>
                              {isPlaying ? 'Playing…' : isPaused ? 'Paused' : 'Listen while you cook'}
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {isPlaying ? (
                                <>
                                  <button onClick={pause} style={audioBtn}>⏸</button>
                                  <button onClick={stop}  style={{ ...audioBtn, color: s2.textDimmer }}>⏹</button>
                                </>
                              ) : (
                                <button onClick={play} style={{ ...audioBtn, borderColor: s2.accent, color: s2.accent }}>▶</button>
                              )}
                              {isPaused && (
                                <button onClick={play} style={{ ...audioBtn, borderColor: s2.accent, color: s2.accent }}>▶</button>
                              )}
                            </div>
                          </div>
                          {isPlaying && (
                            <div style={{ height: 3, background: s2.line, position: 'relative' }}>
                              <div style={{
                                position: 'absolute', top: 0, left: 0,
                                height: '100%', background: s2.accent,
                                width: `${audioProgress}%`, transition: 'width 0.3s linear',
                              }} />
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {cookError && (
                            <div style={{
                              marginBottom: 8, padding: '6px 10px',
                              border: `1px solid rgba(255,62,62,0.35)`,
                              background: 'rgba(255,62,62,0.07)',
                              fontFamily: s2.sans, fontSize: 11, color: s2.warn,
                            }}>{cookError}</div>
                          )}
                          <button
                            onClick={handleGenerateAudio}
                            disabled={audioGenerating}
                            style={{
                              width: '100%', padding: '10px 0',
                              background: 'transparent',
                              border: `1px solid ${s2.lineStrong}`,
                              fontFamily: s2.mono, fontSize: 9,
                              letterSpacing: '0.18em', color: s2.textDim,
                              cursor: audioGenerating ? 'default' : 'pointer',
                              textTransform: 'uppercase',
                            }}
                          >
                            {audioGenerating ? 'BUILDING AUDIO GUIDE…' : '♪ BUILD AUDIO GUIDE'}
                          </button>
                        </>
                      )}
                    </div>

                    {/* Ingredients */}
                    <div style={{ padding: '12px 14px', borderBottom: `1px solid ${s2.line}` }}>
                      <HairLabel style={{ marginBottom: 10 }}>INGREDIENTS</HairLabel>
                      {[...new Set(cookInstr.ingredients.map(i => i.group))].map(group => (
                        <div key={group} style={{ marginBottom: 12 }}>
                          <div style={{
                            fontFamily: s2.mono, fontSize: 8, letterSpacing: '0.18em',
                            color: s2.accent, textTransform: 'uppercase', marginBottom: 6,
                          }}>{group}</div>
                          {cookInstr.ingredients.filter(i => i.group === group).map((ing, idx) => (
                            <div key={idx} style={{
                              display: 'flex', alignItems: 'flex-start', gap: 10,
                              padding: '7px 0', borderBottom: `1px solid ${s2.line}`,
                            }}>
                              <span style={{
                                fontFamily: s2.mono, fontSize: 10, color: s2.text,
                                minWidth: 72, flexShrink: 0,
                              }}>
                                {ing.quantity} {ing.unit}
                              </span>
                              <div>
                                <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.text }}>{ing.name}</div>
                                {ing.notes && (
                                  <div style={{ fontFamily: s2.sans, fontSize: 11, color: s2.textDimmer, marginTop: 2 }}>
                                    {ing.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>

                    {/* Steps */}
                    <div style={{ padding: '12px 14px', borderBottom: `1px solid ${s2.line}` }}>
                      <HairLabel style={{ marginBottom: 12 }}>METHOD</HairLabel>
                      {cookInstr.steps.map(step => (
                        <div key={step.stepNumber} style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
                          {/* Step number */}
                          <div style={{
                            width: 24, height: 24, flexShrink: 0,
                            border: `1px solid ${s2.accent}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: s2.mono, fontSize: 10, color: s2.accent, fontWeight: 600,
                            marginTop: 1,
                          }}>
                            {step.stepNumber}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontFamily: s2.sans, fontSize: 13, fontWeight: 500,
                              color: s2.text, marginBottom: 4,
                            }}>
                              {step.title}
                              {step.duration && (
                                <span style={{
                                  fontFamily: s2.mono, fontSize: 9, color: s2.textDimmer,
                                  fontWeight: 400, marginLeft: 8,
                                }}>
                                  {step.duration}
                                </span>
                              )}
                            </div>
                            <div style={{
                              fontFamily: s2.sans, fontSize: 13,
                              color: s2.textDim, lineHeight: 1.6,
                            }}>
                              {step.instruction}
                            </div>
                            {step.tip && (
                              <div style={{
                                marginTop: 8, padding: '7px 10px',
                                borderLeft: `2px solid ${s2.accent}`,
                                background: s2.accentFill,
                                fontFamily: s2.sans, fontSize: 11,
                                color: s2.accentSoft, lineHeight: 1.5,
                              }}>
                                {step.tip}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Tips */}
                    {cookInstr.tips.length > 0 && (
                      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${s2.line}` }}>
                        <HairLabel style={{ marginBottom: 10 }}>CHEF'S TIPS</HairLabel>
                        {cookInstr.tips.map((tip, i) => (
                          <div key={i} style={{
                            display: 'flex', gap: 10, marginBottom: 8,
                            padding: '9px 12px',
                            border: `1px solid ${s2.line}`,
                            background: s2.bg2,
                          }}>
                            <span style={{ fontFamily: s2.mono, fontSize: 10, color: s2.accent, flexShrink: 0 }}>✦</span>
                            <span style={{ fontFamily: s2.sans, fontSize: 12, color: s2.textDim, lineHeight: 1.55 }}>{tip}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Substitution */}
                    {cookInstr.substitution && (
                      <div style={{ padding: '10px 14px' }}>
                        <HairLabel style={{ marginBottom: 6 }}>SUBSTITUTION</HairLabel>
                        <div style={{ fontFamily: s2.sans, fontSize: 12, color: s2.textDim, lineHeight: 1.55 }}>
                          {cookInstr.substitution}
                        </div>
                      </div>
                    )}

                    {/* Regenerate link */}
                    <div style={{ padding: '4px 14px 12px', textAlign: 'center' }}>
                      <button
                        onClick={handleGenerateInstructions}
                        disabled={cookGenerating}
                        style={{
                          background: 'transparent', border: 'none',
                          fontFamily: s2.mono, fontSize: 8, letterSpacing: '0.15em',
                          color: s2.textDimmer, cursor: 'pointer', textTransform: 'uppercase',
                        }}
                      >
                        ↻ REGENERATE
                      </button>
                    </div>
                  </>
                )}

              </div>
            )}
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
