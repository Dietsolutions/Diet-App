// ShoppingTab — Strain v2 visual, all hook logic preserved.

import { useEffect, useState, useCallback } from 'react';
import { useShopping } from '../hooks/useShopping';
import { PullRefreshWrapper } from './ui/PullRefreshWrapper';
import { useAppStore } from '../store/appStore';
import { s2 } from '../theme/tokens';
import { HairLabel, Card, Bar, Check } from './ui';
import { ShoppingShareSheet } from './ShoppingShareSheet';
import { track, trackPage } from '../lib/analytics';

// ── helpers ────────────────────────────────────────────────────────────────
function multiplyQuantity(qty: string, multiplier: number): string {
  const num = parseFloat(qty);
  if (isNaN(num)) return qty;
  const result = num * multiplier;
  return Number.isInteger(result) ? String(result) : result.toFixed(1);
}

// Category dot colours. The server emits a fixed set of seven categories
// (see shoppingListUtils' prompt), so these are mapped by name rather than
// cycled by index — a category keeps its colour as the list grows or shrinks.
// The three the reference names explicitly are matched to it: Proteins peach,
// Vegetables mint, pantry butter.
const CATEGORY_TINTS: Record<string, string> = {
  'proteins':         s2.peach,
  'dairy':            s2.sky,
  'vegetables':       s2.mint,
  'fruits':           s2.lilac,
  'dry goods':        s2.butter,
  'pantry & spices':  s2.butter,
  'supplements':      s2.lilac,
};

function categoryTint(name: string): string {
  return CATEGORY_TINTS[name.trim().toLowerCase()] ?? s2.mint;
}

/** Round stepper for the people count. (ref: V3Shopping's Step) */
function StepBtn({ label, onClick, disabled }: {
  label: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label === '+' ? 'Increase people count' : 'Decrease people count'}
      style={{
        width: 38, height: 38, borderRadius: s2.rPill,
        background: disabled ? 'rgba(15,20,15,0.05)' : s2.surface,
        border: disabled ? '1px solid transparent' : `1px solid ${s2.lineStrong}`,
        color: disabled ? s2.textDimmer : s2.text,
        fontFamily: s2.sans, fontSize: 18, fontWeight: 700,
        cursor: disabled ? 'default' : 'pointer',
        flexShrink: 0, lineHeight: 1,
      }}
    >
      {label}
    </button>
  );
}

// ── ShoppingTab ────────────────────────────────────────────────────────────
export function ShoppingTab() {
  const {
    shoppingCategories, totalItems, boughtItems,
    isShoppingGenerated, peopleCount,
    toggleItem, reset, updatePeopleCount, loadShopping,
  } = useShopping();

  const handleRefresh = useCallback(async () => {
    await loadShopping();
  }, [loadShopping]);

  const { lastShoppingUpdateTime } = useAppStore();
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [showShareSheet, setShowShareSheet]     = useState(false);

  // Track page view once on mount
  useEffect(() => { trackPage('shopping_tab'); }, []);

  // Show update banner when a meal change triggered a shopping list regen recently
  useEffect(() => {
    if (!lastShoppingUpdateTime) return;
    const age = Date.now() - lastShoppingUpdateTime;
    if (age < 60_000) {
      setShowUpdateBanner(true);
      const timer = setTimeout(() => setShowUpdateBanner(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [lastShoppingUpdateTime]);

  const progress = totalItems > 0 ? boughtItems / totalItems : 0;

  return (
    <PullRefreshWrapper onRefresh={handleRefresh} style={{ background: s2.bg, minHeight: '100%', color: s2.text, paddingBottom: 90 }}>

      {/* ── Meal-change update banner ─────────────────────────────────────── */}
      {showUpdateBanner && (
        <div style={{
          padding: '10px 20px',
          background: s2.accentFill,
          borderBottom: `1px solid ${s2.lineStrong}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 6, height: 6,
            borderRadius: '50%',
            background: s2.accentFill,
            flexShrink: 0,
          }} />
          <div style={{
            fontFamily: s2.sans,
            fontSize: 12,
            color: s2.textDim,
            lineHeight: 1.4,
          }}>
            Shopping list updated to reflect your meal changes
          </div>
          <button
            onClick={() => setShowUpdateBanner(false)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              color: s2.textDimmer,
              fontSize: 16,
              cursor: 'pointer',
              marginLeft: 'auto',
              lineHeight: 1,
              flexShrink: 0,
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* ── Section header ─────────────────────────────────────────────────── */}
      <div style={{ padding: '14px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <HairLabel>{totalItems} ITEMS</HairLabel>
            {/* Share button — only shown when there are items */}
            {isShoppingGenerated && totalItems > 0 && (
              <button
                onClick={() => {
                  setShowShareSheet(true);
                  track('shopping_share_opened', { items_total: totalItems, items_bought: boughtItems });
                }}
                style={{
                  borderRadius: s2.rMd,
                  background:    'transparent',
                  border:        `1px solid ${s2.lineStrong}`,
                  padding:       '3px 8px',
                  fontFamily:    s2.mono,
                  fontSize:      8,
                  letterSpacing: '0.15em',
                  color: s2.accent,
                  cursor:        'pointer',
                  textTransform: 'uppercase',
                  display:       'flex',
                  alignItems:    'center',
                  gap:           4,
                  lineHeight:    1.4,
                }}
              >
                ↗ SHARE
              </button>
            )}
          </div>
          <div style={{
            fontFamily: s2.sans,
            fontSize: 30,
            fontWeight: 400,
            letterSpacing: '-0.025em',
            marginTop: 4,
            lineHeight: 1,
          }}>
            Shopping
          </div>
        </div>

        {/* Bought / total counter, with reset tucked underneath */}
        <div style={{ textAlign: 'right', paddingBottom: 2 }}>
          <div style={{ fontFamily: s2.sans, fontSize: 30, fontWeight: 300, letterSpacing: '-0.03em', lineHeight: 1, color: s2.accent }}>
            {boughtItems}
            <span style={{ fontSize: 16, color: s2.textDim }}>/{totalItems}</span>
          </div>
          <HairLabel style={{ marginTop: 3 }}>BOUGHT</HairLabel>

          {/* Reset — moved up here from the bottom of the list, where it sat
              below every category and took a long scroll to reach. */}
          {isShoppingGenerated && (
            <button
              onClick={reset}
              style={{
                marginTop:     8,
                borderRadius:  s2.rMd,
                background:    'transparent',
                border:        `1px solid ${s2.lineStrong}`,
                padding:       '3px 8px',
                fontFamily:    s2.mono,
                fontSize:      8,
                letterSpacing: '0.15em',
                color:         s2.textDim,
                cursor:        'pointer',
                textTransform: 'uppercase',
                lineHeight:    1.4,
              }}
            >
              ↺ RESET
            </button>
          )}
        </div>
      </div>

      {/* ── Share sheet ───────────────────────────────────────────────────── */}
      {showShareSheet && (
        <ShoppingShareSheet
          categories={shoppingCategories}
          peopleCount={peopleCount}
          onClose={() => setShowShareSheet(false)}
        />
      )}

      {/* Chunky striped progress bar (ref: V3Shopping uses h=10, striped) */}
      <div style={{ padding: '12px 20px 0' }}>
        <Bar pct={progress} color={s2.accentFill} h={10} striped />
      </div>

      <div style={{ padding: '16px 20px 0' }}>

        {/* ── People stepper ─────────────────────────────────────────────────
            Cream panel, round steppers, count between them (ref: V3Shopping).
            Previously the count sat on the left at 34px with the buttons
            grouped to the right, which read as two unrelated controls. */}
        {isShoppingGenerated && (
          <Card bg={s2.cream} radius={26} padding={16} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <HairLabel color="rgba(15,20,15,0.45)">SHOPPING FOR</HairLabel>
                <div style={{
                  fontFamily: s2.sans, fontSize: 13, fontWeight: 700,
                  color: s2.text, marginTop: 6,
                }}>
                  Quantities scale ×{peopleCount}
                </div>
                <div style={{
                  fontFamily: s2.sans, fontSize: 11.5, fontWeight: 500,
                  color: s2.textDim, marginTop: 2,
                }}>
                  Cooking for a family or a cook
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <StepBtn
                  label="−"
                  disabled={peopleCount <= 1}
                  onClick={() => {
                    const newCount = Math.max(1, peopleCount - 1);
                    updatePeopleCount(newCount);
                    if (newCount !== peopleCount) track('shopping_people_count_changed', { count: newCount });
                  }}
                />
                <div style={{ minWidth: 52, textAlign: 'center' }}>
                  <div style={{
                    fontFamily: s2.disp, fontSize: 30, fontWeight: 700,
                    letterSpacing: '-0.04em', lineHeight: 1, color: s2.text,
                  }}>
                    {peopleCount}
                  </div>
                  <div style={{
                    fontFamily: s2.sans, fontSize: 9, fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: s2.textDimmer, marginTop: 3,
                  }}>
                    {peopleCount === 1 ? 'Person' : 'People'}
                  </div>
                </div>
                <StepBtn
                  label="+"
                  disabled={peopleCount >= 12}
                  onClick={() => {
                    const newCount = Math.min(12, peopleCount + 1);
                    updatePeopleCount(newCount);
                    if (newCount !== peopleCount) track('shopping_people_count_changed', { count: newCount });
                  }}
                />
              </div>
            </div>
          </Card>
        )}

        {/* ── Category groups ──────────────────────────────────────────────── */}
        {shoppingCategories.length === 0 ? (
          <div style={{
            borderRadius: s2.rMd,
            border: `1px solid ${s2.line}`,
            padding: 24,
            textAlign: 'center',
          }}>
            <HairLabel>NO SHOPPING LIST GENERATED</HairLabel>
            <div style={{ fontFamily: s2.sans, fontSize: 14, color: s2.textDim, marginTop: 10 }}>
              Your shopping list will appear here once your meal plan is set up.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {shoppingCategories.map((cat) => {
              const catBought = cat.items.filter((i: any) => i.bought).length;
              const complete  = catBought === cat.items.length;
              return (
                /* One soft card per category, items as hairline-separated rows.
                   They used to be individually bordered square buttons, which
                   read as a stack of boxes rather than a list (ref: V3Shopping
                   uses r=26 with rows inside). */
                <Card key={cat.name} radius={26} padding={16}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                    <div style={{
                      width: 9, height: 9, borderRadius: s2.rPill,
                      background: categoryTint(cat.name), flexShrink: 0,
                    }} />
                    <HairLabel color={s2.text}>{cat.name}</HairLabel>
                    <span style={{
                      marginLeft: 'auto', fontFamily: s2.sans, fontSize: 11, fontWeight: 700,
                      color: complete ? s2.accent : s2.textDimmer,
                    }}>
                      {catBought}/{cat.items.length}
                    </span>
                  </div>

                  {cat.items.map((item: any, ii: number) => {
                    const rawQty = item.quantity ? String(item.quantity) : '';
                    const displayQty = rawQty && peopleCount > 1
                      ? multiplyQuantity(rawQty, peopleCount)
                      : rawQty;
                    const qtyMultiplied = peopleCount > 1 && rawQty && displayQty !== rawQty;

                    return (
                      <button
                        key={item.key}
                        onClick={() => {
                          if (!item.bought) {
                            track('shopping_item_bought', { category: cat.name });
                          }
                          toggleItem(item.key, item.bought);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '11px 0',
                          background: 'transparent',
                          border: 'none',
                          borderBottom: ii === cat.items.length - 1 ? 'none' : `1px solid ${s2.line}`,
                          cursor: 'pointer',
                          textAlign: 'left',
                          width: '100%',
                        }}
                      >
                        <Check on={item.bought} color={s2.accentFill} size={22} />

                        <span style={{
                          flex: 1,
                          fontFamily: s2.sans,
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: item.bought ? s2.textDimmer : s2.text,
                          textDecoration: item.bought ? 'line-through' : 'none',
                        }}>
                          {item.name}
                        </span>

                        {displayQty && (
                          <span style={{
                            fontFamily: s2.sans,
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: item.bought
                              ? s2.textDimmer
                              : (qtyMultiplied ? s2.accent : s2.textDim),
                            flexShrink: 0,
                          }}>
                            {displayQty}{item.unit ? ` ${item.unit}` : ''}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </Card>
              );
            })}
          </div>
        )}

        {/* Reset now lives in the header, top right. */}

        <div style={{ height: 16 }} />
      </div>
    </PullRefreshWrapper>
  );
}
