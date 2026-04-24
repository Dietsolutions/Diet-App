// MealReplacerResults — Strain v2 visual. All logic preserved.

import { useEffect } from 'react';
import { useFoodSearch } from '../hooks/useFoodSearch';
import { useMealReplacerStore } from '../store/mealReplacerStore';
import { FoodResultCard } from './FoodResultCard';
import { s2 } from '../theme/tokens';
import { HairLabel } from './ui';

interface Props {
  initialQuery?: string;
  onBack: () => void;
}

export function MealReplacerResults({ initialQuery, onBack }: Props) {
  const { searchQuery, setSearchQuery, searchResults, isSearching } = useFoodSearch();
  const { selectFood, setScreen } = useMealReplacerStore();

  useEffect(() => {
    if (initialQuery && !searchQuery) setSearchQuery(initialQuery);
  }, [initialQuery, searchQuery, setSearchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Search bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: `1px solid ${s2.lineStrong}`,
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M6 1 L2 5 L6 9" stroke={s2.text} strokeWidth="1.2" fill="none"/>
          </svg>
        </button>

        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          background: s2.surface,
          border: `1px solid ${s2.accent}`,
        }}>
          <span style={{ fontFamily: s2.mono, fontSize: 13, color: s2.accent }}>⌕</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search foods..."
            autoFocus
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontFamily: s2.sans,
              fontSize: 14,
              color: s2.text,
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'transparent', border: 'none', color: s2.textDimmer, cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {isSearching && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{
              width: 20, height: 20,
              border: `2px solid ${s2.accent}`,
              borderTopColor: 'transparent',
              borderRadius: '50%',
              margin: '0 auto 12px',
              animation: 'spin 0.8s linear infinite',
            }} />
            <HairLabel>SEARCHING…</HairLabel>
          </div>
        )}

        {!isSearching && searchResults.length === 0 && searchQuery.length >= 2 && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <HairLabel style={{ marginBottom: 12 }}>NO RESULTS FOR "{searchQuery.toUpperCase()}"</HairLabel>
            <button
              onClick={() => setScreen('ai')}
              style={{
                padding: '12px 20px',
                background: s2.accentFill,
                border: `1px solid ${s2.accent}`,
                fontFamily: s2.mono,
                fontSize: 9,
                letterSpacing: '0.18em',
                color: s2.accent,
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              ✨ DESCRIBE IT — LET AI ESTIMATE
            </button>
          </div>
        )}

        {!isSearching && searchResults.map((food) => (
          <FoodResultCard key={food.id} food={food} onSelect={selectFood} />
        ))}

        {!isSearching && searchResults.length > 0 && (
          <HairLabel style={{ textAlign: 'center', padding: '8px 0' }}>
            SOURCES: OPEN FOOD FACTS · USDA · AI
          </HairLabel>
        )}
      </div>
    </div>
  );
}
