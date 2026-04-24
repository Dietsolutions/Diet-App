// TipsTab — Strain v2 visual, all logic preserved.

import { useState, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { MealPrepGuide } from './MealPrepGuide';
import { s2 } from '../theme/tokens';
import { HairLabel, Card } from './ui';

// ── Tips data (unchanged) ──────────────────────────────────────────────────
const TIPS_DATA = [
  {
    id: 'meal-timing',
    label: 'MEAL TIMING',
    tips: [
      { title: 'Biggest meal at lunch', body: 'Have your largest meal at lunch when metabolism peaks. Finish dinner by 8 PM for a natural 10-hour overnight fast, improving fat metabolism while you sleep.' },
      { title: 'Eat Before 8PM', body: 'Late eating raises cortisol and blunts overnight fat metabolism. Move your last meal earlier even by 30 minutes to improve your results.' },
      { title: 'Pre-workout fuel', body: 'Eat a small protein + carb meal 1–1.5 hours before training. Rice + egg or banana + peanut butter are ideal for energy without heaviness.' },
    ]
  },
  {
    id: 'hydration',
    label: 'HYDRATION',
    tips: [
      { title: 'Water Is Key', body: 'Drink at least 2.5–3.5L of water daily based on body weight. Dehydration mimics hunger — drink a full glass before each meal to reduce appetite.' },
      { title: 'Electrolytes Matter', body: 'On a calorie deficit, kidneys excrete more sodium. Add a pinch of rock salt to water or use electrolyte powder to prevent fatigue and headaches.' },
      { title: 'Green Tea 2x/Day', body: 'Green tea boosts metabolic rate by 4–5% and improves fat oxidation. Have a cup mid-morning and mid-afternoon. Avoid after 5 PM to protect sleep.' },
    ]
  },
  {
    id: 'avoid',
    label: 'WHAT TO AVOID',
    tips: [
      { title: 'Liquid calories', body: 'Juices, sodas, and sweetened coffees add 200–400 kcal without filling you up. Swap for water, black coffee, or unsweetened green tea.' },
      { title: 'Ultra-processed snacks', body: 'Chips, biscuits, and packaged snacks are engineered to override satiety signals. Keep them out of the house — you cannot moderate what is in arm\'s reach.' },
      { title: 'Skipping meals', body: 'Skipping makes you hungrier for the next meal and lowers metabolism. Eat consistently. If time-pressed, have a protein shake rather than nothing.' },
    ]
  },
  {
    id: 'substitutions',
    label: 'SMART SUBSTITUTIONS',
    tips: [
      { title: 'Cauliflower rice', body: 'Replace white rice with cauliflower rice to save 150–200 kcal per serving with no drop in volume. Grate raw cauliflower and microwave 3 min.' },
      { title: 'Greek yogurt for cream', body: 'Greek yogurt gives the same creamy texture as heavy cream with 5× the protein and 60% fewer calories. Works in curries, smoothies, and dressings.' },
      { title: 'Eggs over protein powder', body: 'Whole eggs are the most bioavailable protein source at a fraction of the cost of supplements. 3 eggs = 18g protein, healthy fats, vitamins.' },
    ]
  },
  {
    id: 'portions',
    label: 'PORTION CONTROL',
    tips: [
      { title: 'Plate method', body: 'Half the plate vegetables, quarter protein, quarter complex carbs. This ratio naturally hits macro targets without weighing food at every meal.' },
      { title: 'Use smaller plates', body: 'A 10-inch plate feels full with 30% less food than a 12-inch plate. Visual cues strongly influence how full you feel. Small change, big impact.' },
      { title: 'Slow down', body: 'Satiety signals take 15–20 minutes to reach your brain. Put the fork down between bites and aim for 20+ minutes per meal. You will naturally eat less.' },
    ]
  },
  {
    id: 'exercise',
    label: 'EXERCISE & RECOVERY',
    tips: [
      { title: 'Strength Train 3–4×/Week', body: 'Resistance training builds muscle that burns calories at rest and prevents metabolic slowdown from dieting. Prioritise compound lifts: squat, press, pull.' },
      { title: '10,000 Steps Daily', body: 'Non-exercise activity (NEAT) accounts for 15–30% of daily calorie burn. Walk to meetings, take stairs — these steps add up to 300–500 extra kcal/day.' },
      { title: 'Morning Walk Fasted', body: 'A 20–30 minute brisk walk before breakfast taps directly into fat stores. Do this 3× per week for accelerated fat loss with no gym required.' },
    ]
  },
  {
    id: 'sleep',
    label: 'SLEEP & STRESS',
    tips: [
      { title: '7–8 Hours Sleep', body: 'Sleep deprivation raises ghrelin (hunger hormone) by 24% and reduces leptin (fullness). Poor sleep will undermine your diet regardless of how strict you are.' },
      { title: 'Manage Stress', body: 'Chronic stress raises cortisol which drives belly fat storage. Even 10 minutes of deep breathing or meditation daily makes a measurable difference.' },
      { title: 'Consistent sleep schedule', body: 'Go to bed and wake at the same times even on weekends. Irregular sleep disrupts cortisol and insulin rhythm, making fat loss harder.' },
    ]
  },
  {
    id: 'tracking',
    label: 'TRACKING & PROGRESS',
    tips: [
      { title: 'Weigh Once a Week', body: 'Weigh every Monday morning after using the bathroom, before eating. Daily fluctuations (0.5–1.5kg) are water weight — focus on the weekly trend.' },
      { title: 'Take Progress Photos', body: 'The scale does not capture body composition changes. Take front, side, and back photos every 2 weeks in the same lighting. Visual progress is motivating.' },
      { title: 'Log Meals Immediately', body: 'Mark meals as eaten right after finishing, not at end of day. Immediate logging reinforces the habit and is more accurate than memory.' },
    ]
  },
];

const LS_KEY = 'tipsExpandedSections';

function getInitialExpanded(): Record<string, boolean> {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { 'prep-guide': true };
}

// ── CollapsibleSection ─────────────────────────────────────────────────────
function CollapsibleSection({
  id, label, expanded, onToggle, children,
}: {
  id: string;
  label: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div style={{
      border: `1px solid ${s2.line}`,
      background: s2.surface,
      overflow: 'hidden',
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{
          fontFamily: s2.mono,
          fontSize: 10,
          letterSpacing: '0.18em',
          color: expanded ? s2.accent : s2.text,
          fontWeight: 500,
          textTransform: 'uppercase',
        }}>
          {label}
        </span>
        {/* Chevron */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          style={{
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 200ms',
            flexShrink: 0,
          }}
        >
          <path d="M3 1 L7 5 L3 9" stroke={expanded ? s2.accent : s2.textDimmer} strokeWidth="1.4" fill="none" />
        </svg>
      </button>

      <div
        ref={contentRef}
        style={{
          maxHeight: expanded ? '3000px' : '0',
          overflow: 'hidden',
          transition: 'max-height 280ms ease-in-out',
        }}
      >
        <div style={{ borderTop: `1px solid ${s2.line}`, padding: '14px 14px 14px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── TipsTab ────────────────────────────────────────────────────────────────
export function TipsTab() {
  const { profile } = useAppStore();
  const [expanded, setExpanded] = useState<Record<string, boolean>>(getInitialExpanded);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const currentWeight  = profile?.weightKg;
  const targetWeight   = profile?.targetWeightKg;
  const targetCalories = profile?.targetCalories;
  const hasGoalData    = currentWeight && targetWeight;

  return (
    <div style={{ background: s2.bg, minHeight: '100%', color: s2.text, paddingBottom: 90 }}>

      {/* ── Section header ──────────────────────────────────────────────────── */}
      <div style={{ padding: '14px 20px 0' }}>
        <HairLabel>SCIENCE-BACKED</HairLabel>
        <div style={{
          fontFamily: s2.sans,
          fontSize: 30,
          fontWeight: 400,
          letterSpacing: '-0.025em',
          marginTop: 4,
          lineHeight: 1,
        }}>
          Learn
        </div>
      </div>

      <div style={{ padding: '16px 20px 0' }}>

        {/* ── Goal context card ────────────────────────────────────────────── */}
        {hasGoalData && (
          <Card padding={16} style={{ marginBottom: 14 }}>
            <HairLabel style={{ marginBottom: 10 }}>YOUR GOAL</HairLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Current */}
              <div>
                <div style={{ fontFamily: s2.mono, fontSize: 28, fontWeight: 400, color: s2.textDim, letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {currentWeight}
                  <span style={{ fontSize: 12, color: s2.textDimmer }}>kg</span>
                </div>
                <HairLabel style={{ marginTop: 4 }}>CURRENT</HairLabel>
              </div>

              {/* Arrow */}
              <svg width="20" height="10" viewBox="0 0 20 10">
                <path d="M0 5 L16 5 M12 1 L18 5 L12 9" stroke={s2.accent} strokeWidth="1.2" fill="none" />
              </svg>

              {/* Target */}
              <div>
                <div style={{ fontFamily: s2.mono, fontSize: 28, fontWeight: 400, color: s2.accent, letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {targetWeight}
                  <span style={{ fontSize: 12, color: s2.accentSoft }}>kg</span>
                </div>
                <HairLabel color={s2.accentSoft} style={{ marginTop: 4 }}>TARGET</HairLabel>
              </div>
            </div>

            {targetCalories && hasGoalData && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${s2.line}` }}>
                <HairLabel>
                  {Math.abs(currentWeight - targetWeight).toFixed(1)}kg to {currentWeight > targetWeight ? 'lose' : 'gain'}
                  {' · '}
                  <span style={{ color: s2.accent }}>{Math.round(targetCalories)} kcal/day</span>
                </HairLabel>
              </div>
            )}
          </Card>
        )}

        {/* ── Collapsible sections ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {TIPS_DATA.map(section => (
            <CollapsibleSection
              key={section.id}
              id={section.id}
              label={section.label}
              expanded={!!expanded[section.id]}
              onToggle={() => toggle(section.id)}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {section.tips.map(tip => (
                  <div
                    key={tip.title}
                    style={{
                      padding: '12px 12px',
                      background: s2.surface2,
                      border: `1px solid ${s2.line}`,
                    }}
                  >
                    <div style={{
                      fontFamily: s2.sans,
                      fontSize: 13,
                      fontWeight: 500,
                      color: s2.text,
                      marginBottom: 6,
                    }}>
                      {tip.title}
                    </div>
                    <div style={{
                      fontFamily: s2.sans,
                      fontSize: 13,
                      color: s2.textDim,
                      lineHeight: 1.55,
                    }}>
                      {tip.body}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          ))}

          {/* Meal Prep Guide */}
          <CollapsibleSection
            id="prep-guide"
            label="WEEKLY MEAL PREP GUIDE"
            expanded={!!expanded['prep-guide']}
            onToggle={() => toggle('prep-guide')}
          >
            <MealPrepGuide />
          </CollapsibleSection>
        </div>

        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}
