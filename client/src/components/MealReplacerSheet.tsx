// MealReplacerSheet — Strain v2 bottom sheet. All drag-to-dismiss logic preserved.

import { useEffect, useRef, useState } from 'react';
import { useMealReplacerStore } from '../store/mealReplacerStore';
import { MealReplacerSearch } from './MealReplacerSearch';
import { MealReplacerResults } from './MealReplacerResults';
import { MealReplacerQuantity } from './MealReplacerQuantity';
import { MealReplacerAI } from './MealReplacerAI';
import { s2 } from '../theme/tokens';
import { HairLabel } from './ui';

const MEAL_CATEGORIES: { id: string; label: string }[] = [
  { id: 'breakfast',     label: 'BREAKFAST'     },
  { id: 'brunch',        label: 'BRUNCH'        },
  { id: 'lunch',         label: 'LUNCH'         },
  { id: 'evening_snack', label: 'EVENING SNACK' },
  { id: 'dinner',        label: 'DINNER'        },
  { id: 'other',         label: 'OTHER'         },
];

export function MealReplacerSheet() {
  const { isOpen, currentScreen, closeReplacer, setScreen, setSearchQuery, addModeCategory, setAddModeCategory } = useMealReplacerStore();
  const sheetRef     = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const dragStartY   = useRef(0);
  const isDragging   = useRef(false);
  const [initialQuery, setInitialQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setDragY(0);
      setInitialQuery('');
      setSelectedCategory(addModeCategory || '');
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDragStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    isDragging.current = true;
  };
  const handleDragMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta > 0) setDragY(delta);
  };
  const handleDragEnd = () => {
    isDragging.current = false;
    if (dragY > 120) closeReplacer();
    setDragY(0);
  };
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) closeReplacer();
  };
  const handleSearchFocus = () => { setInitialQuery(''); setScreen('results'); };
  const handleQuickPick   = (query: string) => { setInitialQuery(query); setSearchQuery(query); setScreen('results'); };
  const handleAIMode      = () => setScreen('ai');

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        backdropFilter: 'blur(6px)',
      }}
    >
      {/* Overlay */}
      <div
        onClick={handleOverlayClick}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)' }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 512,
          background: s2.bg,
          borderTop: `1px solid ${s2.lineStrong}`,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          transform: `translateY(${dragY}px)`,
          transition: isDragging.current ? 'none' : 'transform 0.2s ease',
        }}
      >
        {/* Drag handle */}
        <div
          style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px', cursor: 'grab' }}
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          <div style={{ width: 32, height: 2, background: s2.lineStrong }} />
        </div>

        {/* Inner scroll */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 28px', overscrollBehavior: 'contain' }}>
          {currentScreen === 'category' && (
            <CategoryPicker
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              onNext={() => { setAddModeCategory(selectedCategory); setScreen('search'); }}
            />
          )}
          {currentScreen === 'search' && (
            <MealReplacerSearch
              onSearchFocus={handleSearchFocus}
              onQuickPick={handleQuickPick}
              onAIMode={handleAIMode}
            />
          )}
          {currentScreen === 'results' && (
            <MealReplacerResults
              initialQuery={initialQuery}
              onBack={() => setScreen('search')}
            />
          )}
          {currentScreen === 'quantity' && (
            <MealReplacerQuantity onBack={() => setScreen('results')} />
          )}
          {currentScreen === 'ai' && (
            <MealReplacerAI onBack={() => setScreen('search')} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Category picker ─────────────────────────────────────────────────────────
function CategoryPicker({
  selectedCategory,
  setSelectedCategory,
  onNext,
}: {
  selectedCategory: string;
  setSelectedCategory: (id: string) => void;
  onNext: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ paddingTop: 4 }}>
        <HairLabel style={{ marginBottom: 6 }}>ADD MEAL</HairLabel>
        <div style={{ fontFamily: s2.sans, fontSize: 22, fontWeight: 400, letterSpacing: '-0.02em', color: s2.text }}>
          What kind of meal?
        </div>
      </div>

      {/* 2×3 grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {MEAL_CATEGORIES.map((cat) => {
          const active = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: '16px 14px',
                border: `1px solid ${active ? s2.accent : s2.line}`,
                background: active ? s2.accentFill : s2.surface,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{
                fontFamily: s2.mono,
                fontSize: 10,
                letterSpacing: '0.15em',
                color: active ? s2.accent : s2.textDim,
              }}>
                {cat.label}
              </div>
            </button>
          );
        })}
      </div>

      <button
        disabled={!selectedCategory}
        onClick={onNext}
        style={{
          width: '100%',
          padding: '14px 0',
          background: selectedCategory ? s2.accent : s2.surface,
          border: `1px solid ${selectedCategory ? s2.accent : s2.line}`,
          fontFamily: s2.mono,
          fontSize: 10,
          letterSpacing: '0.2em',
          color: selectedCategory ? s2.bg : s2.textDimmer,
          cursor: selectedCategory ? 'pointer' : 'default',
          textTransform: 'uppercase',
          marginTop: 4,
        }}
      >
        NEXT →
      </button>
    </div>
  );
}
