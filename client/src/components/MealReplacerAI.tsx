// MealReplacerAI — Strain v2 visual. All logic preserved.

import { useState } from 'react';
import axios from 'axios';
import { useMealReplacerStore } from '../store/mealReplacerStore';
import { useAdditionalMealsStore } from '../store/additionalMealsStore';
import { AIFoodComponent } from '../types';
import { s2 } from '../theme/tokens';
import { HairLabel, Card } from './ui';

interface Props {
  onBack: () => void;
}

export function MealReplacerAI({ onBack }: Props) {
  const { target, addMode, addModeDate, addModeCategory, closeReplacer, setScreen } = useMealReplacerStore();
  const [description, setDescription] = useState('');
  const [isEstimating, setIsEstimating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    breakdown: AIFoodComponent[];
    totals: { calories: number; proteinG: number; carbsG: number; fatG: number; fibreG: number };
    confidenceNote: string;
  } | null>(null);
  const [isLogging, setIsLogging] = useState(false);

  const handleEstimate = async () => {
    if (description.trim().length < 3) return;
    setIsEstimating(true);
    setError('');
    setResult(null);
    try {
      const res = await axios.post('/api/food/ai-estimate', { description: description.trim() }, { withCredentials: true });
      setResult(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'AI estimation failed');
    } finally {
      setIsEstimating(false);
    }
  };

  const handleLog = async () => {
    if (!result) return;
    setIsLogging(true);
    setError('');
    try {
      if (addMode && addModeDate) {
        const res = await axios.post('/api/meals/additional', {
          date: addModeDate, mealCategory: addModeCategory || 'other',
          mealTime: null, foodName: description.trim(), foodSource: 'ai_estimate',
          servingSize: '1 meal', servingQty: 1, servingGrams: null,
          calories: result.totals.calories, proteinG: result.totals.proteinG,
          carbsG: result.totals.carbsG, fatG: result.totals.fatG, fibreG: result.totals.fibreG,
          note: '', isAiEstimate: true,
        }, { withCredentials: true });
        useAdditionalMealsStore.getState().addToLocal(res.data.additionalMeal);
        closeReplacer();
      } else {
        if (!target) return;
        await axios.post('/api/meals/replace', {
          date: target.date, dayIndex: target.dayIndex, mealIndex: target.mealIndex,
          foodName: description.trim(), foodSource: 'ai_estimate',
          servingSize: '1 meal', servingQty: 1, servingGrams: null,
          calories: result.totals.calories, proteinG: result.totals.proteinG,
          carbsG: result.totals.carbsG, fatG: result.totals.fatG, fibreG: result.totals.fibreG,
          note: '', isAiEstimate: true,
        }, { withCredentials: true });
        const { fetchReplacementsForWeek } = useMealReplacerStore.getState();
        await fetchReplacementsForWeek();
        closeReplacer();
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to log meal');
      setIsLogging(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Back */}
      <button
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'transparent', border: 'none',
          fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.15em',
          color: s2.accent, cursor: 'pointer', textTransform: 'uppercase',
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M6 1 L2 5 L6 9" stroke={s2.accent} strokeWidth="1.2" fill="none"/>
        </svg>
        BACK
      </button>

      {/* Header */}
      <div>
        <HairLabel style={{ marginBottom: 6 }}>AI ESTIMATE</HairLabel>
        <div style={{ fontFamily: s2.sans, fontSize: 22, fontWeight: 400, letterSpacing: '-0.02em', color: s2.text }}>
          Describe your meal
        </div>
      </div>

      {/* Textarea */}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder='e.g. "2 rotis with butter chicken and a small bowl of raita"'
        rows={3}
        style={{
          borderRadius: s2.rMd,
          width: '100%',
          background: s2.surface,
          border: `1px solid ${s2.lineStrong}`,
          padding: '12px 14px',
          fontFamily: s2.sans,
          fontSize: 14,
          color: s2.text,
          outline: 'none',
          resize: 'none',
          boxSizing: 'border-box',
          lineHeight: 1.5,
        }}
      />

      {!result && (
        <button
          onClick={handleEstimate}
          disabled={isEstimating || description.trim().length < 3}
          style={{
            borderRadius: s2.rPill,
            width: '100%',
            padding: '14px 0',
            background: isEstimating || description.trim().length < 3 ? s2.surface : s2.accentFill,
            border: `1px solid ${s2.accent}`,
            fontFamily: s2.mono,
            fontSize: 10,
            letterSpacing: '0.2em',
            color: isEstimating || description.trim().length < 3 ? s2.textDimmer : s2.ink,
            cursor: isEstimating || description.trim().length < 3 ? 'default' : 'pointer',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {isEstimating ? (
            <>
              <div style={{ width: 12, height: 12, border: `1.5px solid ${s2.textDimmer}`, borderTopColor: 'transparent', borderRadius: '50%' }} />
              ESTIMATING…
            </>
          ) : 'ESTIMATE WITH AI'}
        </button>
      )}

      {error && (
        <div style={{
            borderRadius: 18, border: `1px solid rgba(255,62,62,0.5)`, background: 'rgba(255,62,62,0.08)', padding: '10px 14px' }}>
          <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.warn }}>{error}</div>
        </div>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Breakdown */}
          <Card padding={12}>
            <HairLabel style={{ marginBottom: 10 }}>BREAKDOWN</HairLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {result.breakdown.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, paddingBottom: 8, borderBottom: i < result.breakdown.length - 1 ? `1px solid ${s2.line}` : 'none' }}>
                  <div style={{ fontFamily: s2.mono, fontSize: 10, color: s2.accent, width: 16, flexShrink: 0, paddingTop: 2 }}>·</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.text }}>
                      {item.name}
                      {item.portionDescription && (
                        <span style={{ color: s2.textDim }}> — {item.portionDescription}</span>
                      )}
                    </div>
                    <HairLabel style={{ marginTop: 3 }}>
                      {item.calories} KCAL · P:{item.proteinG}g · C:{item.carbsG}g · F:{item.fatG}g · Fi:{item.fibreG}g
                    </HairLabel>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Totals */}
          <Card padding={14}>
            <HairLabel style={{ marginBottom: 8 }}>TOTAL</HairLabel>
            <div style={{ fontFamily: s2.sans, fontSize: 28, fontWeight: 300, letterSpacing: '-0.03em', color: s2.accent, lineHeight: 1, marginBottom: 12 }}>
              {result.totals.calories}<span style={{ fontFamily: s2.mono, fontSize: 12, color: s2.textDim, marginLeft: 6 }}>kcal</span>
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              <div><span style={{ fontFamily: s2.mono, fontSize: 12, color: s2.protein }}>P:{result.totals.proteinG}g</span></div>
              <div><span style={{ fontFamily: s2.mono, fontSize: 12, color: s2.carbs }}>C:{result.totals.carbsG}g</span></div>
              <div><span style={{ fontFamily: s2.mono, fontSize: 12, color: s2.fat }}>F:{result.totals.fatG}g</span></div>
              <div><span style={{ fontFamily: s2.mono, fontSize: 12, color: s2.fibre }}>Fi:{result.totals.fibreG}g</span></div>
            </div>
          </Card>

          <HairLabel style={{ textAlign: 'center', fontSize: 7 }}>
            {result.confidenceNote || 'AI ESTIMATES — ACCURACY MAY VARY ±20–25%'}
          </HairLabel>

          {error && (
            <div style={{
            borderRadius: 18, border: `1px solid rgba(255,62,62,0.5)`, background: 'rgba(255,62,62,0.08)', padding: '10px 14px' }}>
              <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.warn }}>{error}</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleLog}
              disabled={isLogging}
              style={{
                borderRadius: s2.rPill,
                flex: 1,
                padding: '13px 0',
                background: isLogging ? s2.surface : s2.accentFill,
                border: `1px solid ${s2.accent}`,
                fontFamily: s2.mono,
                fontSize: 10,
                letterSpacing: '0.15em',
                color: isLogging ? s2.textDimmer : s2.ink,
                cursor: isLogging ? 'default' : 'pointer',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {isLogging ? (
                <>
                  <div style={{ width: 10, height: 10, border: `1.5px solid ${s2.textDimmer}`, borderTopColor: 'transparent', borderRadius: '50%' }} />
                  LOGGING…
                </>
              ) : addMode ? 'ADD TO MY DAY' : 'LOG THIS MEAL'}
            </button>
            <button
              onClick={() => { setResult(null); setScreen('results'); }}
              style={{
                borderRadius: s2.rMd,
                flex: 1,
                padding: '13px 0',
                background: 'transparent',
                border: `1px solid ${s2.lineStrong}`,
                fontFamily: s2.mono,
                fontSize: 10,
                letterSpacing: '0.15em',
                color: s2.textDim,
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              SEARCH MANUALLY
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
