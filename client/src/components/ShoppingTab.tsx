// ShoppingTab — Strain v2 visual, all hook logic preserved.

import { useShopping } from '../hooks/useShopping';
import { s2 } from '../theme/tokens';
import { HairLabel, Card, Bar, Check } from './ui';

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
    toggleItem, reset, updatePeopleCount,
  } = useShopping();

  const progress = totalItems > 0 ? boughtItems / totalItems : 0;

  return (
    <div style={{ background: s2.bg, minHeight: '100%', color: s2.text, paddingBottom: 90 }}>

      {/* ── Section header ─────────────────────────────────────────────────── */}
      <div style={{ padding: '14px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <HairLabel>{totalItems} ITEMS</HairLabel>
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

        {/* Bought / total counter */}
        <div style={{ textAlign: 'right', paddingBottom: 2 }}>
          <div style={{ fontFamily: s2.sans, fontSize: 30, fontWeight: 300, letterSpacing: '-0.03em', lineHeight: 1, color: s2.accent }}>
            {boughtItems}
            <span style={{ fontSize: 16, color: s2.textDim }}>/{totalItems}</span>
          </div>
          <HairLabel style={{ marginTop: 3 }}>BOUGHT</HairLabel>
        </div>
      </div>

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
                  onClick={() => updatePeopleCount(Math.max(1, peopleCount - 1))}
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
                  onClick={() => updatePeopleCount(peopleCount + 1)}
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
                <HairLabel color={s2.accentSoft}>QUANTITIES SCALED FOR {peopleCount}×</HairLabel>
              </div>
            )}
          </Card>
        )}

        {/* ── Category groups ──────────────────────────────────────────────── */}
        {shoppingCategories.length === 0 ? (
          <div style={{
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
                          onClick={() => toggleItem(item.key, item.bought)}
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

        {/* Reset link */}
        {isShoppingGenerated && (
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <button
              onClick={reset}
              style={{
                background: 'transparent',
                border: 'none',
                fontFamily: s2.mono,
                fontSize: 9,
                letterSpacing: '0.2em',
                color: s2.textDimmer,
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              RESET LIST
            </button>
          </div>
        )}

        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}
