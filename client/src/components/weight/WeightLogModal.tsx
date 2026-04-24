// WeightLogModal — Strain v2 bottom sheet. All logic preserved.

import { useState, useEffect } from 'react';
import { useWeightStore } from '../../store/weightStore';
import { s2 } from '../../theme/tokens';
import { HairLabel } from '../ui';

export function WeightLogModal() {
  const { isLogModalOpen, editingLog, closeLogModal, logWeight, updateLog } = useWeightStore();
  const [weight, setWeight] = useState('');
  const [note,   setNote]   = useState('');
  const [date,   setDate]   = useState('');
  const [error,  setError]  = useState('');
  const [saving, setSaving] = useState(false);

  const isEdit = !!editingLog;

  useEffect(() => {
    if (isLogModalOpen) {
      if (editingLog) {
        setWeight(String(editingLog.weightKg));
        setNote(editingLog.note || '');
        setDate(editingLog.loggedAt.substring(0, 10));
      } else {
        setWeight('');
        setNote('');
        setDate(new Date().toISOString().substring(0, 10));
      }
      setError('');
    }
  }, [isLogModalOpen, editingLog]);

  if (!isLogModalOpen) return null;

  const handleSave = async () => {
    const w = parseFloat(weight);
    if (isNaN(w) || w < 20 || w > 300) {
      setError('Enter a weight between 20 and 300 kg');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (isEdit && editingLog) {
        await updateLog(editingLog.id, { weightKg: w, note: note.trim() });
      } else {
        await logWeight({ weightKg: w, note: note.trim(), loggedAt: date });
      }
      closeLogModal();
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={closeLogModal}
    >
      <div
        style={{
          background: s2.surface,
          borderTop: `1px solid ${s2.lineStrong}`,
          width: '100%',
          maxWidth: 480,
          padding: '16px 20px 32px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ width: 28, height: 2, background: s2.lineStrong }} />
        </div>

        <HairLabel style={{ marginBottom: 10 }}>{isEdit ? 'EDIT WEIGHT LOG' : 'LOG WEIGHT'}</HairLabel>
        <div style={{ fontFamily: s2.sans, fontSize: 20, fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 20 }}>
          {isEdit ? 'Edit entry' : 'Record weight'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Weight input */}
          <div>
            <HairLabel style={{ marginBottom: 8 }}>WEIGHT (KG)</HairLabel>
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 75.5"
              autoFocus
              style={{
                width: '100%',
                background: s2.surface2,
                border: `1px solid ${s2.lineStrong}`,
                padding: '13px 14px',
                fontFamily: s2.mono,
                fontSize: 22,
                color: s2.text,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Date (new logs only) */}
          {!isEdit && (
            <div>
              <HairLabel style={{ marginBottom: 8 }}>DATE</HairLabel>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={new Date().toISOString().substring(0, 10)}
                style={{
                  width: '100%',
                  background: s2.surface2,
                  border: `1px solid ${s2.lineStrong}`,
                  padding: '12px 14px',
                  fontFamily: s2.sans,
                  fontSize: 14,
                  color: s2.text,
                  outline: 'none',
                  boxSizing: 'border-box',
                  colorScheme: 'dark',
                }}
              />
            </div>
          )}

          {/* Note */}
          <div>
            <HairLabel style={{ marginBottom: 8 }}>NOTE (OPTIONAL)</HairLabel>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. After morning walk"
              maxLength={100}
              style={{
                width: '100%',
                background: s2.surface2,
                border: `1px solid ${s2.lineStrong}`,
                padding: '12px 14px',
                fontFamily: s2.sans,
                fontSize: 14,
                color: s2.text,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{ border: `1px solid rgba(255,62,62,0.5)`, background: 'rgba(255,62,62,0.08)', padding: '8px 12px' }}>
              <div style={{ fontFamily: s2.sans, fontSize: 12, color: '#FF3E3E' }}>{error}</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            onClick={closeLogModal}
            style={{
              flex: 1,
              padding: '13px 0',
              background: 'transparent',
              border: `1px solid ${s2.lineStrong}`,
              fontFamily: s2.mono,
              fontSize: 10,
              letterSpacing: '0.15em',
              color: s2.textDim,
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1,
              padding: '13px 0',
              background: saving ? s2.surface : s2.accent,
              border: `1px solid ${s2.accent}`,
              fontFamily: s2.mono,
              fontSize: 10,
              letterSpacing: '0.15em',
              color: saving ? s2.textDimmer : s2.bg,
              cursor: saving ? 'default' : 'pointer',
              textTransform: 'uppercase',
            }}
          >
            {saving ? 'SAVING…' : isEdit ? 'UPDATE' : 'SAVE'}
          </button>
        </div>
      </div>
    </div>
  );
}
