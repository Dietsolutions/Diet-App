// MealPrepGuide — Strain v2. All fetch logic preserved.

import { useEffect, useState } from 'react';
import axios from 'axios';
import { MealPrepGuide as MealPrepGuideType } from '../types';
import { useAppStore } from '../store/appStore';
import { s2 } from '../theme/tokens';
import { HairLabel } from './ui';

export function MealPrepGuide() {
  const { setActiveTab } = useAppStore();
  const [guide, setGuide] = useState<MealPrepGuideType | null | undefined>(undefined); // undefined=loading

  useEffect(() => {
    axios.get('/api/plan/meal-prep-guide', { withCredentials: true })
      .then(res => setGuide(res.data.guide ?? null))
      .catch(() => setGuide(null));
  }, []);

  // ── Loading skeleton ──
  if (guide === undefined) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              height: 48,
              background: s2.surface2,
              animation: 'pulse 1.4s ease-in-out infinite',
            }}
          />
        ))}
      </div>
    );
  }

  // ── Empty state ──
  if (!guide) {
    return (
      <div style={{ padding: '12px 0', textAlign: 'center' }}>
        <div style={{
          fontFamily: s2.sans,
          fontSize: 13,
          color: s2.textDim,
          lineHeight: 1.55,
          marginBottom: 14,
        }}>
          No prep guide yet. Regenerate your meal plan to unlock your personalised weekly prep guide.
        </div>
        <button
          onClick={() => setActiveTab('profile')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            fontFamily: s2.mono,
            fontSize: 9,
            letterSpacing: '0.18em',
            color: s2.accent,
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          GO TO PROFILE → REGENERATE PLAN
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Intro */}
      {guide.intro && (
        <div style={{
          fontFamily: s2.sans,
          fontSize: 13,
          color: s2.textDim,
          lineHeight: 1.6,
        }}>
          {guide.intro}
        </div>
      )}

      {/* Sections */}
      {guide.sections.map((section) => (
        <div key={section.category}>
          {/* Section header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
          }}>
            <span style={{ fontSize: 14 }}>{section.emoji}</span>
            <HairLabel>{section.category.toUpperCase()}</HairLabel>
            <div style={{ flex: 1, height: 1, background: s2.line }} />
          </div>

          {/* Tasks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {section.tasks.map((task, i) => (
              <div
                key={i}
                style={{
                  borderRadius: s2.rMd,
                  border: `1px solid ${s2.line}`,
                  background: s2.surface,
                  padding: '10px 12px',
                }}
              >
                <div style={{
                  fontFamily: s2.sans,
                  fontSize: 13,
                  color: s2.text,
                  lineHeight: 1.45,
                }}>
                  {task.instruction}
                </div>
                {task.usedOn && (
                  <div style={{
                    marginTop: 4,
                    fontFamily: s2.mono,
                    fontSize: 9,
                    letterSpacing: '0.12em',
                    color: s2.accent,
                  }}>
                    📅 {task.usedOn}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Time estimate */}
      <div style={{
        border: `1px solid ${s2.accentSoft}`,
        background: s2.accentFill,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <span style={{ fontSize: 13 }}>⏱️</span>
        <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.text }}>
          Estimated prep time:{' '}
          <span style={{ color: s2.accent, fontFamily: s2.mono }}>
            {guide.estimatedMinutes}–{guide.estimatedMinutes + 15} min
          </span>
        </div>
      </div>
    </div>
  );
}
