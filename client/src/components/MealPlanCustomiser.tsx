// MealPlanCustomiser — Strain v2. All save/debounce/auto-resize logic preserved.

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiUrl } from '../lib/api';
import { s2 } from '../theme/tokens';
import { HairLabel } from './ui';

const SUGGESTION_CHIPS = [
  { label: '+ More protein',    text: 'Include more high-protein options in every meal' },
  { label: '+ Lighter dinners', text: 'Make dinners lighter, under 300 calories' },
  { label: '+ No repetition',   text: 'Do not repeat any meal more than once in the week' },
  { label: '+ Add soups',       text: 'Include at least one soup or broth per day' },
  { label: '+ Quick recipes',   text: 'All meals should be cookable in under 20 minutes' },
  { label: '+ Budget friendly', text: 'Keep meals budget-friendly using affordable ingredients' },
  { label: '+ More variety',    text: 'Maximise variety across all 7 days' },
  { label: '+ Less spicy',      text: 'Keep all meals mild, minimal chilli and spices' },
  { label: '+ Bigger breakfast',text: 'Make breakfast the largest meal of the day' },
];

const MAX_CHARS = 500;

interface MealPlanCustomiserProps {
  initialValue: string;
  onInstructionsChange: (text: string) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  disabled?: boolean;
}

export function MealPlanCustomiser({
  initialValue,
  onInstructionsChange,
  onRegenerate,
  isRegenerating,
  disabled = false,
}: MealPlanCustomiserProps) {
  const [text, setText]           = useState(initialValue);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef               = useRef<HTMLTextAreaElement>(null);

  // Sync initial value on mount / when it changes externally
  useEffect(() => { setText(initialValue); }, [initialValue]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      const lineHeight = 20;
      const minHeight  = lineHeight * 4;
      const maxHeight  = lineHeight * 10;
      el.style.height  = `${Math.min(Math.max(el.scrollHeight, minHeight), maxHeight)}px`;
    }
  }, [text]);

  const saveInstructions = useCallback(async (value: string) => {
    setSaveStatus('saving');
    try {
      const res = await fetch(apiUrl('/api/profile/meal-instructions'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ instructions: value }),
      });
      if (!res.ok) throw new Error();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, []);

  const handleChange = (value: string) => {
    const truncated = value.length > MAX_CHARS ? value.substring(0, MAX_CHARS) : value;
    setText(truncated);
    onInstructionsChange(truncated);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveInstructions(truncated), 500);
  };

  const handleChipClick = (chipText: string) => {
    const newText  = text.trim() ? `${text.trim()}, ${chipText}` : chipText;
    const truncated = newText.length > MAX_CHARS ? newText.substring(0, MAX_CHARS) : newText;
    setText(truncated);
    onInstructionsChange(truncated);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveInstructions(truncated), 500);
  };

  const handleClear = () => {
    setText('');
    onInstructionsChange('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    saveInstructions('');
  };

  const charCount      = text.length;
  const hasInstructions = text.trim().length > 0;
  const charColor      = charCount >= 480 ? s2.warn : charCount >= 400 ? s2.accentSoft : s2.textDimmer;

  const saveStatusText =
    saveStatus === 'saved'  ? 'SAVED'             :
    saveStatus === 'saving' ? 'SAVING…'           :
    saveStatus === 'error'  ? "COULDN'T SAVE"     : '';
  const saveStatusColor =
    saveStatus === 'saved'  ? s2.fibre  :
    saveStatus === 'saving' ? s2.textDim :
    saveStatus === 'error'  ? s2.warn   : s2.textDimmer;

  return (
    <div style={{
      borderRadius: s2.rMd,
      border: `1px solid ${s2.line}`,
      background: s2.surface,
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      {/* Header */}
      <div>
        <HairLabel style={{ marginBottom: 6 }}>CUSTOMISE MEAL PLAN</HairLabel>
        <div style={{
          fontFamily: s2.sans,
          fontSize: 13,
          color: s2.textDim,
          lineHeight: 1.55,
        }}>
          Tell us anything you'd like changed. Applied on next plan regeneration.
        </div>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isRegenerating}
        placeholder="e.g. Add more eggs to breakfast, avoid rajma this week, make dinners lighter, include a soup every day…"
        maxLength={MAX_CHARS}
        style={{
          borderRadius: s2.rMd,
          width: '100%',
          background: s2.surface2,
          border: `1px solid ${s2.lineStrong}`,
          padding: '12px 14px',
          fontFamily: s2.sans,
          fontSize: 13,
          color: s2.text,
          outline: 'none',
          resize: 'none',
          boxSizing: 'border-box',
          minHeight: 80,
          lineHeight: 1.55,
          opacity: isRegenerating ? 0.5 : 1,
        }}
        onFocus={e => { e.currentTarget.style.borderColor = s2.accent; }}
        onBlur={e  => { e.currentTarget.style.borderColor = s2.lineStrong; }}
      />

      {/* Bottom row: clear + save status + counter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {hasInstructions && (
            <button
              onClick={handleClear}
              disabled={isRegenerating}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontFamily: s2.mono,
                fontSize: 9,
                letterSpacing: '0.15em',
                color: s2.textDimmer,
                cursor: 'pointer',
                textTransform: 'uppercase',
                opacity: isRegenerating ? 0.5 : 1,
              }}
            >
              CLEAR
            </button>
          )}
          {saveStatusText !== '' && (
            <span style={{
              fontFamily: s2.mono,
              fontSize: 8,
              letterSpacing: '0.15em',
              color: saveStatusColor,
              textTransform: 'uppercase',
            }}>
              {saveStatusText}
            </span>
          )}
        </div>
        <span style={{
          fontFamily: s2.mono,
          fontSize: 9,
          color: charColor,
          letterSpacing: '0.05em',
        }}>
          {charCount} / {MAX_CHARS}
        </span>
      </div>

      {/* Suggestion chips — horizontally scrollable */}
      <div style={{
        overflowX: 'auto',
        marginLeft: -16,
        marginRight: -16,
        paddingLeft: 16,
        paddingRight: 16,
        paddingBottom: 4,
      }}>
        <div style={{ display: 'flex', gap: 6, width: 'max-content' }}>
          {SUGGESTION_CHIPS.map((chip) => (
            <button
              key={chip.label}
              onClick={() => handleChipClick(chip.text)}
              disabled={isRegenerating || charCount >= MAX_CHARS}
              style={{
                borderRadius: s2.rMd,
                flexShrink: 0,
                padding: '6px 10px',
                background: 'transparent',
                border: `1px solid ${s2.lineStrong}`,
                fontFamily: s2.mono,
                fontSize: 8,
                letterSpacing: '0.12em',
                color: s2.fibre,
                cursor: isRegenerating || charCount >= MAX_CHARS ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                opacity: isRegenerating || charCount >= MAX_CHARS ? 0.4 : 1,
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Regenerate button */}
      <button
        onClick={onRegenerate}
        disabled={isRegenerating || disabled}
        style={{
          borderRadius: s2.rPill,
          width: '100%',
          padding: '14px 0',
          background: (isRegenerating || disabled) ? s2.surface2 : s2.accentFill,
          border: `1px solid ${(isRegenerating || disabled) ? s2.lineStrong : s2.accent}`,
          fontFamily: s2.mono,
          fontSize: 10,
          letterSpacing: '0.18em',
          color: (isRegenerating || disabled) ? s2.textDimmer : s2.ink,
          cursor: (isRegenerating || disabled) ? 'not-allowed' : 'pointer',
          textTransform: 'uppercase',
          position: 'relative',
        }}
      >
        {isRegenerating
          ? 'REGENERATING…'
          : disabled
            ? 'MONTHLY LIMIT REACHED'
            : hasInstructions
              ? 'REGENERATE WITH MY CHANGES'
              : 'REGENERATE MEAL PLAN'}
        {/* Active-instructions dot */}
        {hasInstructions && !isRegenerating && (
          <span style={{
            position: 'absolute',
            top: 8,
            right: 10,
            width: 5,
            height: 5,
            background: s2.bg,
            borderRadius: '50%',
          }} />
        )}
      </button>
    </div>
  );
}
