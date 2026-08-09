// WeightLogList — Strain v2 visual. All logic preserved.

import { useState } from 'react';
import { useWeightStore } from '../../store/weightStore';
import { s2 } from '../../theme/tokens';
import { HairLabel } from '../ui';

export function WeightLogList() {
  const { logs, openLogModal, deleteLog } = useWeightStore();
  const [expanded, setExpanded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (logs.length === 0) return null;

  const sortedLogs  = [...logs].reverse();
  const displayLogs = expanded ? sortedLogs : sortedLogs.slice(0, 5);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteLog(id);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div style={{ border: `1px solid ${s2.line}`, background: s2.surface }}>
      {/* Header */}
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${s2.line}` }}>
        <HairLabel>WEIGHT HISTORY</HairLabel>
        <HairLabel>{logs.length} ENTRIES</HairLabel>
      </div>

      {/* Log rows */}
      <div>
        {displayLogs.map((log) => {
          const logIndex = logs.findIndex(l => l.id === log.id);
          const prev     = logIndex > 0 ? logs[logIndex - 1] : null;
          const delta    = prev ? Math.round((log.weightKg - prev.weightKg) * 10) / 10 : null;
          const isFirst  = logIndex === 0;

          const dateStr = new Date(log.loggedAt).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short',
          });

          const deltaColor = delta === null ? s2.textDimmer : delta < 0 ? s2.accent : delta > 0 ? s2.warn : s2.textDimmer;

          return (
            <div
              key={log.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderBottom: `1px solid ${s2.line}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: s2.mono, fontSize: 10, color: s2.textDimmer, width: 36, flexShrink: 0 }}>
                  {dateStr}
                </div>
                <div style={{ fontFamily: s2.mono, fontSize: 14, fontWeight: 500, color: s2.text }}>
                  {log.weightKg} kg
                </div>
                {delta !== null && (
                  <div style={{ fontFamily: s2.mono, fontSize: 10, color: deltaColor }}>
                    {delta > 0 ? '+' : ''}{delta}
                  </div>
                )}
                {log.note && (
                  <div style={{ fontFamily: s2.sans, fontSize: 11, color: s2.textDimmer, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.note}
                  </div>
                )}
              </div>

              {/* Edit / delete */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, marginLeft: 8 }}>
                <button
                  onClick={() => openLogModal(log)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: s2.textDimmer, fontSize: 13, padding: 0 }}
                  title="Edit"
                >
                  ✏️
                </button>
                {!isFirst && (
                  confirmDeleteId === log.id ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button
                        onClick={() => handleDelete(log.id)}
                        disabled={deletingId === log.id}
                        style={{
                          background: 'rgba(255,62,62,0.12)', border: 'none',
                          fontFamily: s2.mono, fontSize: 8, letterSpacing: '0.1em',
                          color: s2.warn, cursor: 'pointer', padding: '4px 8px',
                        }}
                      >
                        {deletingId === log.id ? '…' : 'YES'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        style={{
                          background: 'transparent', border: 'none',
                          fontFamily: s2.mono, fontSize: 8, letterSpacing: '0.1em',
                          color: s2.textDimmer, cursor: 'pointer',
                        }}
                      >
                        NO
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(log.id)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: s2.textDimmer, fontSize: 13, padding: 0 }}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Show more */}
      {sortedLogs.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            width: '100%',
            padding: '10px 0',
            background: 'transparent',
            border: 'none',
            borderTop: expanded ? `1px solid ${s2.line}` : 'none',
            fontFamily: s2.mono,
            fontSize: 9,
            letterSpacing: '0.18em',
            color: s2.accent,
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          {expanded ? 'SHOW LESS' : `SHOW ALL ${sortedLogs.length} ENTRIES`}
        </button>
      )}
    </div>
  );
}
