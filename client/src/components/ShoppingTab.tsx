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

      {/* 3 px progress bar */}
      <div style={{ padding: '12px 20px 0' }}>
        <Bar pct={progress} color={s2.accent} h={3} />
      </div>

      <div style={{ padding: '16px 20px 0' }}>

        {/* ── People stepper ───────────────────────────────────────────────── */}
        {isShoppingGenerated && (
          <Card padding={14} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <HairLabel>SHOPPING FOR</HairLabel>
                <div style={{
                  fontFamily: s2.sans,
                  fontSize: 34,
                  fontWeight: 300,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                  marginTop: 6,
                  color: s2.text,
                }}>
                  {peopleCount}
                </div>
                <div style={{
                  fontFamily: s2.mono,
                  fontSize: 9,
                  letterSpacing: '0.22em',
                  color: s2.textDimmer,
                  textTransform: 'uppercase',
                  marginTop: 4,
                }}>
                  {peopleCount === 1 ? 'PERSON' : 'PEOPLE'}
                </div>
              </div>

              {/* − / + buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    const newCount = Math.max(1, peopleCount - 1);
                    updatePeopleCount(newCount);
                    if (newCount !== peopleCount) track('shopping_people_count_changed', { count: newCount });
                  }}
                  disabled={peopleCount <= 1}
                  style={{
                    width: 38,
                    height: 38,
                    border: `1px solid ${s2.lineStrong}`,
                    background: 'transparent',
                    color: peopleCount <= 1 ? s2.textDimmer : s2.text,
                    fontFamily: s2.sans,
                    fontSize: 20,
                    cursor: peopleCount <= 1 ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  −
                </button>
                <button
                  onClick={() => {
                    updatePeopleCount(peopleCount + 1);
                    track('shopping_people_count_changed', { count: peopleCount + 1 });
                  }}
                  style={{
                    width: 38,
                    height: 38,
                    border: `1px solid ${s2.lineStrong}`,
                    background: 'transparent',
                    color: s2.text,
                    fontFamily: s2.sans,
                    fontSize: 20,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  +
                </button>
              </div>
            </div>

            {peopleCount > 1 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${s2.line}` }}>
                <HairLabel color={s2.accent}>QUANTITIES SCALED FOR {peopleCount}×</HairLabel>
              </div>
            )}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {shoppingCategories.map((cat) => {
              const catBought = cat.items.filter((i: any) => i.bought).length;
              return (
                <div key={cat.name}>
                  {/* Category header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <HairLabel color={s2.textDim}>{cat.name.toUpperCase()}</HairLabel>
                    <HairLabel>{catBought}/{cat.items.length}</HairLabel>
                  </div>

                  {/* Items */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {cat.items.map((item: any) => {
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
                            padding: '11px 12px',
                            background: item.bought ? 'rgba(255,106,42,0.06)' : s2.surface,
                            border: `1px solid ${item.bought ? s2.lineStrong : s2.line}`,
                            cursor: 'pointer',
                            textAlign: 'left',
                            width: '100%',
                          }}
                        >
                          <Check on={item.bought} color={s2.accent} size={16} />

                          {/* Name */}
                          <div style={{
                            flex: 1,
                            fontFamily: s2.sans,
                            fontSize: 14,
                            color: item.bought ? s2.textDimmer : s2.text,
                            textDecoration: item.bought ? 'line-through' : 'none',
                            textDecorationColor: s2.textDimmer,
                          }}>
                            {item.name}
                          </div>

                          {/* Quantity */}
                          {displayQty && (
                            <div style={{
                              fontFamily: s2.mono,
                              fontSize: 10,
                              color: qtyMultiplied ? s2.accent : s2.textDimmer,
                              letterSpacing: '0.05em',
                              flexShrink: 0,
                            }}>
                              {displayQty}{item.unit ? ` ${item.unit}` : ''}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
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
