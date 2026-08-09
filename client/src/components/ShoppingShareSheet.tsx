// ShoppingShareSheet — Strain v2. Share shopping list via Web Share, WhatsApp, or clipboard.

import { useState, useEffect, useRef } from 'react';
import { s2 } from '../theme/tokens';
import { HairLabel } from './ui';

// ── Category emoji map ─────────────────────────────────────────────────────
const CATEGORY_EMOJI: Record<string, string> = {
  vegetables:           '🥦',
  vegetable:            '🥦',
  veggies:              '🥦',
  fruits:               '🍎',
  fruit:                '🍎',
  dairy:                '🥛',
  milk:                 '🥛',
  meat:                 '🥩',
  poultry:              '🍗',
  chicken:              '🍗',
  seafood:              '🐟',
  fish:                 '🐟',
  grains:               '🌾',
  cereals:              '🌾',
  rice:                 '🌾',
  pulses:               '🫘',
  legumes:              '🫘',
  lentils:              '🫘',
  beans:                '🫘',
  nuts:                 '🌰',
  seeds:                '🌰',
  oils:                 '🫙',
  fats:                 '🫙',
  spices:               '🧂',
  condiments:           '🧂',
  herbs:                '🌿',
  bakery:               '🍞',
  bread:                '🍞',
  frozen:               '🧊',
  beverages:            '🧃',
  drinks:               '🧃',
  snacks:               '🍿',
  sweets:               '🍬',
  eggs:                 '🥚',
  cheese:               '🧀',
  pantry:               '🥫',
  canned:               '🥫',
  sauces:               '🫙',
};

function categoryEmoji(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, emoji] of Object.entries(CATEGORY_EMOJI)) {
    if (lower.includes(key)) return emoji;
  }
  return '🛒';
}

// ── Build share text ───────────────────────────────────────────────────────
interface ShoppingItem {
  key: string;
  name: string;
  quantity?: string;
  unit?: string;
  bought: boolean;
}

interface ShoppingCategory {
  name: string;
  items: ShoppingItem[];
}

function buildShareText(
  categories: ShoppingCategory[],
  peopleCount: number,
): string {
  const lines: string[] = ['🛍️ Shopping List'];
  if (peopleCount > 1) lines.push(`(scaled for ${peopleCount} people)`);
  lines.push('');

  const boughtLines: string[] = [];

  for (const cat of categories) {
    const unbought = cat.items.filter(i => !i.bought);
    const bought   = cat.items.filter(i => i.bought);

    if (unbought.length === 0 && bought.length === 0) continue;

    if (unbought.length > 0) {
      lines.push(`${categoryEmoji(cat.name)} ${cat.name.toUpperCase()}`);
      for (const item of unbought) {
        const qty = item.quantity
          ? ` — ${item.quantity}${item.unit ? ' ' + item.unit : ''}`
          : '';
        lines.push(`• ${item.name}${qty}`);
      }
      lines.push('');
    }

    for (const item of bought) {
      const qty = item.quantity
        ? ` — ${item.quantity}${item.unit ? ' ' + item.unit : ''}`
        : '';
      boughtLines.push(`✓ ${item.name}${qty}`);
    }
  }

  if (boughtLines.length > 0) {
    lines.push('─── Already bought ───');
    lines.push(...boughtLines);
  }

  return lines.join('\n').trim();
}

// ── Props ──────────────────────────────────────────────────────────────────
interface ShoppingShareSheetProps {
  categories: ShoppingCategory[];
  peopleCount: number;
  onClose: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────
export function ShoppingShareSheet({
  categories,
  peopleCount,
  onClose,
}: ShoppingShareSheetProps) {
  const [copied, setCopied]           = useState(false);
  const [hasWebShare]                 = useState(() => typeof navigator !== 'undefined' && !!navigator.share);
  const overlayRef                    = useRef<HTMLDivElement>(null);

  const shareText = buildShareText(categories, peopleCount);
  const totalUnbought = categories.reduce(
    (sum, c) => sum + c.items.filter(i => !i.bought).length, 0,
  );
  const totalBought = categories.reduce(
    (sum, c) => sum + c.items.filter(i => i.bought).length, 0,
  );

  // Close on backdrop click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleWebShare = async () => {
    try {
      await navigator.share({ title: 'Shopping List', text: shareText });
    } catch {
      // user cancelled or not supported
    }
  };

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select a textarea
    }
  };

  return (
    /* Overlay */
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position:        'fixed',
        inset:           0,
        background:      'rgba(0,0,0,0.55)',
        zIndex:          1000,
        display:         'flex',
        alignItems:      'flex-end',
        justifyContent:  'center',
      }}
    >
      {/* Sheet */}
      <div style={{
        width:          '100%',
        maxWidth:       520,
        background:     s2.surface,
        borderTop:      `1px solid ${s2.lineStrong}`,
        padding:        '20px 20px 32px',
        display:        'flex',
        flexDirection:  'column',
        gap:            16,
      }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <HairLabel>SHARE LIST</HairLabel>
            <div style={{
              fontFamily: s2.mono,
              fontSize:   10,
              color:      s2.textDimmer,
              letterSpacing: '0.1em',
              marginTop:  4,
            }}>
              {totalUnbought} TO BUY · {totalBought} DONE
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background:    'transparent',
              border:        'none',
              color:         s2.textDimmer,
              fontSize:      20,
              cursor:        'pointer',
              lineHeight:    1,
              padding:       '0 2px',
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Preview */}
        <div style={{
          borderRadius: s2.rMd,
          background:     s2.surface2,
          border:         `1px solid ${s2.line}`,
          padding:        '12px 14px',
          maxHeight:      160,
          overflowY:      'auto',
          fontFamily:     s2.mono,
          fontSize:       10,
          color:          s2.textDim,
          whiteSpace:     'pre-wrap',
          lineHeight:     1.65,
          letterSpacing:  '0.03em',
        }}>
          {shareText}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Web Share — only shown when API is available */}
          {hasWebShare && (
            <button
              onClick={handleWebShare}
              style={{
                display:        'flex',
                alignItems:     'center',
                gap:            12,
                padding:        '14px 16px',
                background:     s2.accentFill,
                border:         `1px solid ${s2.accent}`,
                cursor:         'pointer',
                width:          '100%',
                textAlign:      'left',
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>↗</span>
              <div>
                <div style={{
                  fontFamily:    s2.mono,
                  fontSize:      10,
                  letterSpacing: '0.15em',
                  color:         s2.ink,
                  textTransform: 'uppercase',
                }}>SHARE VIA…</div>
                <div style={{
                  fontFamily:    s2.sans,
                  fontSize:      11,
                  color:         s2.ink,
                  opacity:       0.7,
                  marginTop:     2,
                }}>Messages, Notes, Mail, and more</div>
              </div>
            </button>
          )}

          {/* WhatsApp */}
          <button
            onClick={handleWhatsApp}
            style={{
              borderRadius: s2.rMd,
              display:        'flex',
              alignItems:     'center',
              gap:            12,
              padding:        '14px 16px',
              background:     'transparent',
              border:         `1px solid ${s2.lineStrong}`,
              cursor:         'pointer',
              width:          '100%',
              textAlign:      'left',
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>💬</span>
            <div>
              <div style={{
                fontFamily:    s2.mono,
                fontSize:      10,
                letterSpacing: '0.15em',
                color:         s2.text,
                textTransform: 'uppercase',
              }}>SEND ON WHATSAPP</div>
              <div style={{
                fontFamily:    s2.sans,
                fontSize:      11,
                color:         s2.textDim,
                marginTop:     2,
              }}>Opens WhatsApp with the list pre-filled</div>
            </div>
          </button>

          {/* Copy */}
          <button
            onClick={handleCopy}
            style={{
              display:        'flex',
              alignItems:     'center',
              gap:            12,
              padding:        '14px 16px',
              background:     'transparent',
              border:         `1px solid ${copied ? s2.fibre : s2.lineStrong}`,
              cursor:         'pointer',
              width:          '100%',
              textAlign:      'left',
              transition:     'border-color 0.2s',
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>{copied ? '✓' : '📋'}</span>
            <div>
              <div style={{
                fontFamily:    s2.mono,
                fontSize:      10,
                letterSpacing: '0.15em',
                color:         copied ? s2.fibre : s2.text,
                textTransform: 'uppercase',
              }}>{copied ? 'COPIED!' : 'COPY TO CLIPBOARD'}</div>
              <div style={{
                fontFamily:    s2.sans,
                fontSize:      11,
                color:         s2.textDim,
                marginTop:     2,
              }}>Paste anywhere — Notes, SMS, email…</div>
            </div>
          </button>

        </div>
      </div>
    </div>
  );
}
