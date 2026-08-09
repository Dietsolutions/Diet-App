import { useMemo, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { s2 } from '../theme/tokens';
import { HairLabel, Card, Pill, Btn, Bar, TopBar } from './ui';
import { Recipe, RecipeFilters } from '../types';
import {
  useRecipes, useRecipe, useToggleLike, useShareRecipe, useSaveRecipeToPlan,
  DEFAULT_FILTERS,
} from '../hooks/useRecipes';

const MEAL_TYPES = [
  { id: 'all',       label: 'ALL'       },
  { id: 'breakfast', label: 'BREAKFAST' },
  { id: 'lunch',     label: 'LUNCH'     },
  { id: 'snack',     label: 'SNACK'     },
  { id: 'dinner',    label: 'DINNER'    },
];
const DIET_TYPES = [
  { id: 'all',     label: 'ALL'     },
  { id: 'veg',     label: 'VEG'     },
  { id: 'egg',     label: 'EGG'     },
  { id: 'non_veg', label: 'NON-VEG' },
];
const SORTS = [
  { id: 'likes',    dir: 'desc', label: 'MOST LIKED'      },
  { id: 'popular',  dir: 'desc', label: 'MOST POPULAR'    },
  { id: 'protein',  dir: 'desc', label: 'HIGHEST PROTEIN' },
  { id: 'fibre',    dir: 'desc', label: 'HIGHEST FIBRE'   },
  { id: 'calories', dir: 'asc',  label: 'LOWEST CALORIES' },
  { id: 'newest',   dir: 'desc', label: 'NEWEST'          },
] as const;

const DIET_COLOR: Record<string, string> = {
  veg:     s2.fibre,
  egg:     s2.fat,
  non_veg: s2.accent,
};

const MACRO_RANGES = [
  { key: 'Cal',     label: 'CALORIES', max: 1200, step: 25, color: s2.accent  },
  { key: 'Protein', label: 'PROTEIN',  max: 80,   step: 5,  color: s2.protein },
  { key: 'Carbs',   label: 'CARBS',    max: 150,  step: 5,  color: s2.carbs   },
  { key: 'Fat',     label: 'FAT',      max: 60,   step: 5,  color: s2.fat     },
  { key: 'Fibre',   label: 'FIBRE',    max: 25,   step: 1,  color: s2.fibre   },
] as const;

function DietDot({ dietType }: { dietType: string }) {
  const color = DIET_COLOR[dietType] ?? s2.textDim;
  return (
    <span title={dietType.replace('_', '-')} style={{
      width: 10, height: 10, flexShrink: 0,
      border: `1px solid ${color}`,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: color }} />
    </span>
  );
}

function LikeButton({ liked, count, onToggle, large }: {
  liked: boolean; count: number; onToggle: () => void; large?: boolean;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 5,
        color: liked ? s2.accent : s2.textDim,
        fontFamily: s2.mono, fontSize: large ? 12 : 10, fontWeight: 600,
        padding: large ? '8px 0' : 2,
      }}
    >
      <svg width={large ? 16 : 12} height={large ? 16 : 12} viewBox="0 0 24 24"
        fill={liked ? s2.accent : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 000-7.8z"/>
      </svg>
      {count}
    </button>
  );
}

function RecipeCard({ recipe, onOpen, onLike }: {
  recipe: Recipe; onOpen: () => void; onLike: () => void;
}) {
  return (
    <Card onClick={onOpen} padding={14} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <Pill color={s2.textDim}>{recipe.mealType}</Pill>
        <DietDot dietType={recipe.dietType} />
      </div>
      <div style={{
        fontFamily: s2.sans, fontSize: 14, fontWeight: 600, lineHeight: 1.3,
        color: s2.text, minHeight: 36,
      }}>
        {recipe.name}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: s2.mono, fontSize: 20, fontWeight: 700, color: s2.accent }}>
          {Math.round(recipe.calories)}
        </span>
        <HairLabel>kcal</HairLabel>
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        <Pill color={s2.protein}>P {Math.round(recipe.protein)}g</Pill>
        <Pill color={s2.carbs}>C {Math.round(recipe.carbs)}g</Pill>
        <Pill color={s2.fat}>F {Math.round(recipe.fat)}g</Pill>
        {recipe.fibre > 0 && <Pill color={s2.fibre}>FB {Math.round(recipe.fibre)}g</Pill>}
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderTop: `1px solid ${s2.line}`, paddingTop: 8, marginTop: 'auto',
      }}>
        <HairLabel>{recipe.sourceCount > 1 ? `IN ${recipe.sourceCount} PLANS` : 'NEW'}</HairLabel>
        <LikeButton liked={recipe.likedByMe} count={recipe.likeCount} onToggle={onLike} />
      </div>
    </Card>
  );
}

function RangeRow({ label, color, max, step, minVal, maxVal, onMin, onMax }: {
  label: string; color: string; max: number; step: number;
  minVal?: number; maxVal?: number;
  onMin: (v?: number) => void; onMax: (v?: number) => void;
}) {
  const lo = minVal ?? 0;
  const hi = maxVal ?? max;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 1fr 72px', gap: 10, alignItems: 'center' }}>
      <HairLabel color={color}>{label}</HairLabel>
      <input type="range" min={0} max={max} step={step} value={lo}
        onChange={e => { const v = Number(e.target.value); onMin(v === 0 ? undefined : v); }}
        style={{ accentColor: color, width: '100%' }} />
      <input type="range" min={0} max={max} step={step} value={hi}
        onChange={e => { const v = Number(e.target.value); onMax(v === max ? undefined : v); }}
        style={{ accentColor: color, width: '100%' }} />
      <span style={{ fontFamily: s2.mono, fontSize: 9, color: s2.textDim, textAlign: 'right' }}>
        {lo}–{hi === max ? 'MAX' : hi}
      </span>
    </div>
  );
}

function SaveToPlanModal({ recipe, onClose, onSaved }: {
  recipe: Recipe; onClose: () => void; onSaved: () => void;
}) {
  const { planDays, activePlanId } = useAppStore();
  const { save, saving } = useSaveRecipeToPlan();
  const [dayIdx, setDayIdx]   = useState<number | null>(null);
  const [slotIdx, setSlotIdx] = useState<number | null>(null);
  const [error, setError]     = useState('');

  const day  = dayIdx  !== null ? planDays[dayIdx]      : null;
  const slot = day && slotIdx !== null ? day.meals[slotIdx] : null;

  const dayTotal    = day ? Math.round(day.totalCalories ?? day.meals.reduce((s, m) => s + (m.calories || 0), 0)) : 0;
  const newDayTotal = slot ? Math.round(dayTotal - (slot.calories || 0) + recipe.calories) : 0;
  const typeMismatch = slot?.type && !slot.type.toLowerCase().includes(recipe.mealType)
    && recipe.mealType !== 'snack' || (slot?.type && recipe.mealType === 'snack' && !slot.type.toLowerCase().includes('snack'));

  const confirm = async () => {
    if (!activePlanId || dayIdx === null || slotIdx === null) return;
    const realDayIndex = planDays[dayIdx].dayIndex ?? dayIdx;
    const res = await save(recipe.id, activePlanId, realDayIndex, slotIdx);
    if (res.ok) onSaved();
    else setError(res.error || 'Failed to save');
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto',
          background: s2.bg2, borderTop: `1px solid ${s2.lineStrong}`,
          padding: '20px 20px max(28px, env(safe-area-inset-bottom))',
        }}
      >
        <HairLabel color={s2.accent} style={{ marginBottom: 4 }}>SAVE TO MY PLAN</HairLabel>
        <div style={{ fontFamily: s2.sans, fontSize: 16, fontWeight: 600, marginBottom: 18, color: s2.text }}>
          {recipe.name} · {Math.round(recipe.calories)} kcal
        </div>

        {!activePlanId || planDays.length === 0 ? (
          <div style={{ color: s2.textDim, fontFamily: s2.sans, fontSize: 13, padding: '12px 0 20px' }}>
            You need an active meal plan first. Generate a plan, then save recipes into it.
          </div>
        ) : dayIdx === null ? (
          <>
            <HairLabel style={{ marginBottom: 10 }}>1 · PICK A DAY</HairLabel>
            <div style={{ display: 'grid', gap: 8 }}>
              {planDays.map((d, i) => (
                <Card key={i} onClick={() => setDayIdx(i)} padding={12}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: s2.sans, fontSize: 13, fontWeight: 600 }}>{d.label}</span>
                  <span style={{ fontFamily: s2.mono, fontSize: 11, color: s2.textDim }}>
                    {Math.round(d.totalCalories ?? d.meals.reduce((s, m) => s + (m.calories || 0), 0))} KCAL
                  </span>
                </Card>
              ))}
            </div>
          </>
        ) : slotIdx === null ? (
          <>
            <button onClick={() => setDayIdx(null)} style={{
              background: 'transparent', border: 'none', color: s2.textDim,
              fontFamily: s2.mono, fontSize: 10, cursor: 'pointer', padding: 0, marginBottom: 10,
              letterSpacing: '0.15em',
            }}>← {day!.label}</button>
            <HairLabel style={{ marginBottom: 10 }}>2 · PICK THE MEAL TO REPLACE</HairLabel>
            <div style={{ display: 'grid', gap: 8 }}>
              {day!.meals.map((m, i) => (
                <Card key={i} onClick={() => setSlotIdx(i)} padding={12}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                    <Pill color={s2.textDim}>{m.type ?? `MEAL ${i + 1}`}</Pill>
                    <span style={{ fontFamily: s2.mono, fontSize: 11, color: s2.textDim }}>
                      {Math.round(m.calories || 0)} KCAL
                    </span>
                  </div>
                  <div style={{ fontFamily: s2.sans, fontSize: 13, fontWeight: 600 }}>{m.name}</div>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <>
            <button onClick={() => setSlotIdx(null)} style={{
              background: 'transparent', border: 'none', color: s2.textDim,
              fontFamily: s2.mono, fontSize: 10, cursor: 'pointer', padding: 0, marginBottom: 10,
              letterSpacing: '0.15em',
            }}>← BACK</button>
            <HairLabel style={{ marginBottom: 10 }}>3 · CONFIRM THE SWAP</HairLabel>
            <Card padding={14} style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: s2.sans, fontSize: 13, lineHeight: 1.6, color: s2.text }}>
                Replacing <b>{slot!.name}</b> ({Math.round(slot!.calories || 0)} kcal)
                <br />with <b style={{ color: s2.accent }}>{recipe.name}</b> ({Math.round(recipe.calories)} kcal)
              </div>
              <div style={{
                marginTop: 10, paddingTop: 10, borderTop: `1px solid ${s2.line}`,
                fontFamily: s2.mono, fontSize: 11, color: s2.textDim,
              }}>
                {day!.label} TOTAL: {dayTotal} → <span style={{
                  color: Math.abs(newDayTotal - dayTotal) > 150 ? s2.warn : s2.fibre,
                }}>{newDayTotal} KCAL</span>
              </div>
            </Card>
            {typeMismatch && (
              <div style={{
                fontFamily: s2.sans, fontSize: 12, color: s2.fat, marginBottom: 12,
                padding: '8px 10px', background: 'rgba(255,209,102,0.08)',
                border: `1px solid rgba(255,209,102,0.25)`,
              }}>
                This is usually a {recipe.mealType} — save it to this {slot!.type} slot anyway?
              </div>
            )}
            {error && (
              <div style={{ fontFamily: s2.sans, fontSize: 12, color: s2.warn, marginBottom: 12 }}>{error}</div>
            )}
            <Btn primary full onClick={confirm} disabled={saving}>
              {saving ? 'SAVING…' : 'CONFIRM SWAP'}
            </Btn>
          </>
        )}
      </div>
    </div>
  );
}

function RecipeDetail({ recipeId, onClose, onListPatch }: {
  recipeId: string;
  onClose: () => void;
  onListPatch: (id: string, patch: Partial<Recipe>) => void;
}) {
  const { recipe, loading, setRecipe } = useRecipe(recipeId);
  const toggleLike = useToggleLike();
  const shareRecipe = useShareRecipe();
  const [shareState, setShareState] = useState('');
  const [showSave, setShowSave]     = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const { setActiveTab } = useAppStore();

  const macroMax = recipe ? Math.max(recipe.protein, recipe.carbs, recipe.fat, recipe.fibre, 1) : 1;

  const handleLike = () => {
    if (!recipe) return;
    toggleLike(recipe, (patch) => {
      setRecipe({ ...recipe, ...patch });
      onListPatch(recipe.id, patch);
    });
  };

  const handleShare = async () => {
    if (!recipe) return;
    const result = await shareRecipe(recipe.id);
    setShareState(result === 'copied' ? 'LINK COPIED' : result === 'failed' ? 'SHARE FAILED' : '');
    if (result === 'copied' || result === 'failed') setTimeout(() => setShareState(''), 2000);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50, background: s2.bg,
      overflowY: 'auto', paddingBottom: 110,
    }}>
      <div style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <TopBar onBack={onClose} kicker="RECIPE" title={recipe?.name ?? ''} />
      </div>

      {loading || !recipe ? (
        <div style={{ padding: 40, textAlign: 'center', fontFamily: s2.mono, fontSize: 10, color: s2.textDimmer }}>
          {loading ? 'LOADING…' : 'RECIPE NOT FOUND'}
        </div>
      ) : (
        <div style={{ padding: '18px 20px', display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <Pill filled color={s2.accent}>{recipe.mealType}</Pill>
            <Pill color={DIET_COLOR[recipe.dietType]}>{recipe.dietType.replace('_', '-')}</Pill>
            <Pill color={s2.textDim}>{recipe.cuisineType}</Pill>
            {recipe.prepTime && <Pill color={s2.textDim}>{recipe.prepTime}</Pill>}
            {recipe.sourceCount > 1 && <Pill color={s2.textDim}>IN {recipe.sourceCount} PLANS</Pill>}
          </div>

          {recipe.description && (
            <p style={{ fontFamily: s2.sans, fontSize: 13.5, lineHeight: 1.65, color: s2.textDim, margin: 0 }}>
              {recipe.description}
            </p>
          )}

          <Card padding={16}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
              <span style={{ fontFamily: s2.mono, fontSize: 28, fontWeight: 700, color: s2.accent }}>
                {Math.round(recipe.calories)}
              </span>
              <HairLabel>KCAL PER SERVING</HairLabel>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {([
                ['PROTEIN', recipe.protein, s2.protein],
                ['CARBS',   recipe.carbs,   s2.carbs],
                ['FAT',     recipe.fat,     s2.fat],
                ['FIBRE',   recipe.fibre,   s2.fibre],
              ] as const).map(([label, value, color]) => (
                <div key={label} style={{ display: 'grid', gridTemplateColumns: '58px 1fr 44px', gap: 10, alignItems: 'center' }}>
                  <HairLabel color={color}>{label}</HairLabel>
                  <Bar pct={value / macroMax} color={color} h={3} />
                  <span style={{ fontFamily: s2.mono, fontSize: 11, color: s2.text, textAlign: 'right' }}>
                    {Math.round(value)}g
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <div>
            <HairLabel style={{ marginBottom: 10 }}>INGREDIENTS</HairLabel>
            <Card padding={0}>
              {recipe.ingredients.map((ing, i) => (
                <div key={i} style={{
                  padding: '10px 14px',
                  borderBottom: i < recipe.ingredients.length - 1 ? `1px solid ${s2.line}` : 'none',
                  fontFamily: s2.sans, fontSize: 13.5, color: s2.text,
                }}>
                  {ing}
                </div>
              ))}
            </Card>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Btn primary style={{ flex: 1 }} onClick={() => setShowSave(true)}>SAVE TO MY PLAN</Btn>
            <Btn onClick={handleShare}>{shareState || 'SHARE'}</Btn>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <LikeButton large liked={recipe.likedByMe} count={recipe.likeCount} onToggle={handleLike} />
          </div>

          {savedFlash && (
            <Card padding={14} style={{ borderColor: s2.fibre }}>
              <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.fibre, marginBottom: 10 }}>
                Saved to your plan ✓
              </div>
              <Btn small onClick={() => { setActiveTab('meals'); }}>VIEW UPDATED PLAN</Btn>
            </Card>
          )}
        </div>
      )}

      {showSave && recipe && (
        <SaveToPlanModal
          recipe={recipe}
          onClose={() => setShowSave(false)}
          onSaved={() => { setShowSave(false); setSavedFlash(true); }}
        />
      )}
    </div>
  );
}

export function BrowseRecipesTab() {
  const [filters, setFilters]       = useState<RecipeFilters>(DEFAULT_FILTERS);
  const [showMacros, setShowMacros] = useState(false);
  const [openId, setOpenId]         = useState<string | null>(null);
  const { recipes, total, loading, error, hasMore, loadMore, patchRecipe } = useRecipes(filters);
  const toggleLike = useToggleLike();

  const sortLabel = useMemo(
    () => SORTS.find(s => s.id === filters.sortBy)?.label ?? 'SORT',
    [filters.sortBy],
  );

  const set = (patch: Partial<RecipeFilters>) => setFilters(f => ({ ...f, ...patch }));

  const macroFiltersActive = MACRO_RANGES.some(r =>
    filters[`min${r.key}` as keyof RecipeFilters] !== undefined ||
    filters[`max${r.key}` as keyof RecipeFilters] !== undefined);

  return (
    <div style={{ background: s2.bg, minHeight: '100%', color: s2.text, paddingBottom: 90 }}>
      <div style={{ padding: '18px 20px 0' }}>
        <HairLabel color={s2.accent}>COMMUNITY LIBRARY</HairLabel>
        <h1 style={{ fontFamily: s2.sans, fontSize: 22, fontWeight: 700, margin: '4px 0 2px' }}>
          Browse Recipes
        </h1>
        <div style={{ fontFamily: s2.mono, fontSize: 10, color: s2.textDimmer, letterSpacing: '0.12em' }}>
          {total} VALIDATED RECIPES FROM REAL PLANS
        </div>
      </div>

      <div style={{ padding: '14px 20px 0' }}>
        <input
          value={filters.q}
          onChange={e => set({ q: e.target.value })}
          placeholder="Search recipes or ingredients…"
          style={{
            borderRadius: s2.rMd,
            width: '100%', boxSizing: 'border-box',
            background: s2.surface, border: `1px solid ${s2.line}`,
            color: s2.text, padding: '12px 14px',
            fontFamily: s2.sans, fontSize: 14, outline: 'none',
          }}
        />
      </div>

      <div style={{ padding: '12px 20px 0', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {MEAL_TYPES.map(t => (
          <button key={t.id} onClick={() => set({ mealType: t.id })} style={{
            background: filters.mealType === t.id ? s2.accentFill : 'transparent',
            color: filters.mealType === t.id ? s2.ink : s2.textDim,
            border: filters.mealType === t.id ? 'none' : `1px solid ${s2.line}`,
            fontFamily: s2.mono, fontSize: 9, fontWeight: 600, letterSpacing: '0.15em',
            padding: '7px 10px', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ padding: '8px 20px 0', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {DIET_TYPES.map(t => (
          <button key={t.id} onClick={() => set({ dietType: t.id })} style={{
            background: 'transparent',
            color: filters.dietType === t.id ? (DIET_COLOR[t.id] ?? s2.accent) : s2.textDimmer,
            border: `1px solid ${filters.dietType === t.id ? (DIET_COLOR[t.id] ?? s2.accent) : s2.line}`,
            fontFamily: s2.mono, fontSize: 9, fontWeight: 600, letterSpacing: '0.15em',
            padding: '6px 9px', cursor: 'pointer',
          }}>{t.label}</button>
        ))}
        <button onClick={() => setShowMacros(v => !v)} style={{
          marginLeft: 'auto', background: 'transparent',
          color: showMacros || macroFiltersActive ? s2.accent : s2.textDimmer,
          border: `1px solid ${showMacros || macroFiltersActive ? s2.accent : s2.line}`,
          fontFamily: s2.mono, fontSize: 9, fontWeight: 600, letterSpacing: '0.15em',
          padding: '6px 9px', cursor: 'pointer',
        }}>MACROS {macroFiltersActive ? '●' : showMacros ? '▴' : '▾'}</button>
      </div>

      {showMacros && (
        <div style={{ margin: '12px 20px 0' }}>
          <Card padding={14} style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 1fr 72px', gap: 10 }}>
              <span />
              <HairLabel>MIN</HairLabel>
              <HairLabel>MAX</HairLabel>
              <span />
            </div>
            {MACRO_RANGES.map(r => (
              <RangeRow
                key={r.key}
                label={r.label} color={r.color} max={r.max} step={r.step}
                minVal={filters[`min${r.key}` as keyof RecipeFilters] as number | undefined}
                maxVal={filters[`max${r.key}` as keyof RecipeFilters] as number | undefined}
                onMin={v => set({ [`min${r.key}`]: v } as Partial<RecipeFilters>)}
                onMax={v => set({ [`max${r.key}`]: v } as Partial<RecipeFilters>)}
              />
            ))}
            {macroFiltersActive && (
              <Btn small onClick={() => set({
                minCal: undefined, maxCal: undefined,
                minProtein: undefined, maxProtein: undefined,
                minCarbs: undefined, maxCarbs: undefined,
                minFat: undefined, maxFat: undefined,
                minFibre: undefined, maxFibre: undefined,
              })}>CLEAR MACRO FILTERS</Btn>
            )}
          </Card>
        </div>
      )}

      <div style={{ padding: '12px 20px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <select
          value={filters.sortBy}
          onChange={e => {
            const s = SORTS.find(x => x.id === e.target.value)!;
            set({ sortBy: s.id, sortDir: s.dir });
          }}
          style={{
            borderRadius: s2.rMd,
            background: s2.surface, color: s2.textDim, border: `1px solid ${s2.line}`,
            fontFamily: s2.mono, fontSize: 9, fontWeight: 600, letterSpacing: '0.15em',
            padding: '7px 10px', cursor: 'pointer', outline: 'none',
            textTransform: 'uppercase',
          }}
        >
          {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      <div style={{
        padding: '14px 20px 0',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12,
      }}>
        {recipes.map(r => (
          <RecipeCard
            key={r.id}
            recipe={r}
            onOpen={() => setOpenId(r.id)}
            onLike={() => toggleLike(r, (patch) => patchRecipe(r.id, patch))}
          />
        ))}
      </div>

      {error && (
        <div style={{ padding: '24px 20px', textAlign: 'center', fontFamily: s2.sans, fontSize: 13, color: s2.warn }}>
          {error}
        </div>
      )}
      {!error && !loading && recipes.length === 0 && (
        <div style={{ padding: '40px 20px', textAlign: 'center', fontFamily: s2.sans, fontSize: 13, color: s2.textDim }}>
          No recipes match these filters yet.<br />Recipes appear here as plans are generated.
        </div>
      )}
      {loading && recipes.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', fontFamily: s2.mono, fontSize: 10, color: s2.textDimmer }}>
          LOADING…
        </div>
      )}
      {hasMore && !loading && recipes.length > 0 && (
        <div style={{ padding: '18px 20px 0' }}>
          <Btn full onClick={loadMore}>LOAD MORE ({recipes.length}/{total})</Btn>
        </div>
      )}
      {loading && recipes.length > 0 && (
        <div style={{ padding: 16, textAlign: 'center', fontFamily: s2.mono, fontSize: 10, color: s2.textDimmer }}>
          LOADING…
        </div>
      )}

      {openId && (
        <RecipeDetail recipeId={openId} onClose={() => setOpenId(null)} onListPatch={patchRecipe} />
      )}
    </div>
  );
}
