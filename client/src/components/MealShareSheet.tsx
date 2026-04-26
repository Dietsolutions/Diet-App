// MealShareSheet — bottom sheet for sharing cooking instructions.
// Strain v2 design system: no rounded corners, mono labels, orange accent.
// Share targets: native Web Share API, WhatsApp, Telegram, clipboard.

import { useState } from 'react';
import { s2 } from '../theme/tokens';
import { HairLabel } from './ui';
import { MealCookingInstructions } from '../types';

interface MealShareSheetProps {
  isOpen:       boolean;
  onClose:      () => void;
  mealName:     string;
  instructions: MealCookingInstructions;
  audioUrl:     string | null;
}

export function MealShareSheet({
  isOpen, onClose, mealName, instructions, audioUrl,
}: MealShareSheetProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // ── Build share text ──────────────────────────────────────────────────────

  function buildShareText(): string {
    const lines: string[] = [];

    lines.push(`🍽 ${mealName} — Cooking Instructions`);
    lines.push(
      `⏱ Prep: ${instructions.prepTime} | Cook: ${instructions.cookTime} | Total: ${instructions.totalTime}`,
    );
    lines.push('');
    lines.push('📋 INGREDIENTS');

    const groups = [...new Set(instructions.ingredients.map((i: any) => i.group))];
    groups.forEach(group => {
      lines.push(`\n${group}:`);
      instructions.ingredients
        .filter((i: any) => i.group === group)
        .forEach((ing: any) => {
          const notes = ing.notes ? ` (${ing.notes})` : '';
          lines.push(`• ${ing.quantity} ${ing.unit} ${ing.name}${notes}`);
        });
    });

    lines.push('');
    lines.push('👨‍🍳 METHOD');
    instructions.steps.forEach((step: any) => {
      lines.push(`\nStep ${step.stepNumber}: ${step.title}`);
      lines.push(step.instruction);
      if (step.tip) lines.push(`💡 Tip: ${step.tip}`);
    });

    if (instructions.tips?.length > 0) {
      lines.push('');
      lines.push("✦ CHEF'S TIPS");
      instructions.tips.forEach((tip: string) => lines.push(`• ${tip}`));
    }

    if (audioUrl) {
      lines.push('');
      lines.push('🔊 Audio cooking guide:');
      lines.push(audioUrl);
    }

    lines.push('');
    lines.push('Shared via Diet Plan & Tracker — https://ai-dpt.vercel.app');
    return lines.join('\n');
  }

  const shareText = buildShareText();
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(
    audioUrl || 'https://ai-dpt.vercel.app',
  )}&text=${encodeURIComponent(shareText)}`;
  const supportsNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleNativeShare() {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: `${mealName} — Cooking Instructions`,
        text:  shareText,
        url:   audioUrl || undefined,
      });
    } catch {
      // user cancelled — do nothing
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareText);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = shareText;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Shared styles ─────────────────────────────────────────────────────────

  const rowStyle: React.CSSProperties = {
    display:    'flex',
    alignItems: 'center',
    gap:        14,
    padding:    '12px 0',
    borderBottom: `1px solid ${s2.line}`,
    background: 'none',
    border:     'none',
    width:      '100%',
    textAlign:  'left',
    cursor:     'pointer',
    fontFamily: s2.sans,
  };

  const iconBoxStyle: React.CSSProperties = {
    width: 40, height: 40, flexShrink: 0,
    border:     `1px solid ${s2.lineStrong}`,
    background: s2.surface,
    display:    'flex', alignItems: 'center', justifyContent: 'center',
    fontSize:   18, color: s2.textDim,
  };

  return (
    <>
      {/* Dim overlay — closes sheet on tap */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 46,
        }}
      />

      {/* Bottom sheet */}
      <div style={{
        position:   'fixed',
        bottom:     0,
        left:       '50%',
        transform:  'translateX(-50%)',
        width:      '100%',
        maxWidth:   480,
        background: s2.bg,
        borderTop:  `1px solid ${s2.lineStrong}`,
        zIndex:     47,
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)',
      }}>

        {/* Header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${s2.line}` }}>
          <HairLabel>SHARE RECIPE</HairLabel>
          <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.textDim, marginTop: 4, lineHeight: 1.3 }}>
            {mealName}
          </div>
        </div>

        {/* Share options */}
        <div style={{ padding: '0 16px' }}>

          {/* Native share — iOS / Android system sheet */}
          {supportsNativeShare && (
            <button onClick={handleNativeShare} style={rowStyle}>
              <div style={iconBoxStyle}>↗</div>
              <div>
                <div style={{ fontFamily: s2.sans, fontSize: 14, fontWeight: 500, color: s2.text, marginBottom: 2 }}>
                  Share via…
                </div>
                <div style={{ fontFamily: s2.sans, fontSize: 11, color: s2.textDimmer }}>
                  WhatsApp, Messages, Email & more
                </div>
              </div>
            </button>
          )}

          {/* WhatsApp */}
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{ ...rowStyle, cursor: 'pointer' }}>
              <div style={{ ...iconBoxStyle, color: '#25D366' }}>✉</div>
              <div>
                <div style={{ fontFamily: s2.sans, fontSize: 14, fontWeight: 500, color: s2.text, marginBottom: 2 }}>
                  WhatsApp
                </div>
                <div style={{ fontFamily: s2.sans, fontSize: 11, color: s2.textDimmer }}>
                  Send recipe{audioUrl ? ' + audio link' : ''}
                </div>
              </div>
            </div>
          </a>

          {/* Telegram */}
          <a href={telegramUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{ ...rowStyle, cursor: 'pointer' }}>
              <div style={{ ...iconBoxStyle, color: '#2AABEE' }}>✈</div>
              <div>
                <div style={{ fontFamily: s2.sans, fontSize: 14, fontWeight: 500, color: s2.text, marginBottom: 2 }}>
                  Telegram
                </div>
                <div style={{ fontFamily: s2.sans, fontSize: 11, color: s2.textDimmer }}>
                  Send recipe{audioUrl ? ' + audio link' : ''}
                </div>
              </div>
            </div>
          </a>

          {/* Copy to clipboard */}
          <button onClick={handleCopy} style={{ ...rowStyle, borderBottom: 'none' }}>
            <div style={{ ...iconBoxStyle, color: copied ? s2.accent : s2.textDim }}>
              {copied ? '✓' : '⎘'}
            </div>
            <div>
              <div style={{
                fontFamily: s2.sans, fontSize: 14, fontWeight: 500,
                color: copied ? s2.accent : s2.text, marginBottom: 2,
              }}>
                {copied ? 'Copied!' : 'Copy Instructions'}
              </div>
              <div style={{ fontFamily: s2.sans, fontSize: 11, color: s2.textDimmer }}>
                {audioUrl ? 'Copies text + audio link' : 'Copies full recipe text'}
              </div>
            </div>
          </button>

        </div>

        {/* Cancel */}
        <button
          onClick={onClose}
          style={{
            width:       '100%',
            padding:     '14px 0',
            background:  'none',
            border:      'none',
            borderTop:   `1px solid ${s2.line}`,
            fontFamily:  s2.mono,
            fontSize:    9,
            letterSpacing: '0.18em',
            color:       s2.textDimmer,
            cursor:      'pointer',
            textTransform: 'uppercase',
          }}
        >
          CANCEL
        </button>
      </div>
    </>
  );
}
