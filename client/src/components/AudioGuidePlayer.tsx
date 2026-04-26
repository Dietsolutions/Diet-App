// AudioGuidePlayer — HTML5 <audio> player for cooking instruction audio files.
// Replaces the broken Web Speech API approach.
// Uses Strain v2 design tokens — no rounded corners, mono labels, orange accent.

import { useState, useRef } from 'react';
import { s2 } from '../theme/tokens';
import { HairLabel } from './ui';

interface Props {
  audioUrl:     string | null;
  isGenerating: boolean;
  error:        string;
  onGenerate:   () => void;
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function AudioGuidePlayer({ audioUrl, isGenerating, error, onGenerate }: Props) {
  const audioRef                      = useRef<HTMLAudioElement>(null);
  const [isPlaying,    setIsPlaying]  = useState(false);
  const [progress,     setProgress]   = useState(0);
  const [currentTime,  setCurrentTime]= useState(0);
  const [duration,     setDuration]   = useState(0);

  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying) { a.pause(); } else { a.play(); }
  }

  function handleStop() {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const a = audioRef.current;
    if (!a || !duration) return;
    a.currentTime = (parseFloat(e.target.value) / 100) * duration;
  }

  // ── No audio URL yet — show generate button ────────────────────────────────
  if (!audioUrl) {
    return (
      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${s2.line}` }}>
        <HairLabel style={{ marginBottom: 8 }}>AUDIO GUIDE</HairLabel>
        {error && (
          <div style={{
            marginBottom: 8, padding: '7px 10px',
            border: `1px solid rgba(255,62,62,0.35)`,
            background: 'rgba(255,62,62,0.07)',
            fontFamily: s2.sans, fontSize: 11, color: s2.warn,
          }}>
            {error}
          </div>
        )}
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          style={{
            width: '100%', padding: '11px 0',
            background: 'transparent',
            border: `1px solid ${isGenerating ? s2.line : s2.lineStrong}`,
            fontFamily: s2.mono, fontSize: 9, fontWeight: 600,
            letterSpacing: '0.18em', color: isGenerating ? s2.textDimmer : s2.textDim,
            cursor: isGenerating ? 'default' : 'pointer',
            textTransform: 'uppercase',
          }}
        >
          {isGenerating ? 'GENERATING AUDIO…' : '♪ GENERATE AUDIO GUIDE'}
        </button>
        {isGenerating && (
          <div style={{
            marginTop: 6, fontFamily: s2.sans, fontSize: 11,
            color: s2.textDimmer, textAlign: 'center',
          }}>
            This takes about 15 seconds
          </div>
        )}
      </div>
    );
  }

  // ── Audio file ready — show HTML5 player ──────────────────────────────────
  return (
    <div style={{ padding: '12px 14px', borderBottom: `1px solid ${s2.line}` }}>
      <HairLabel style={{ marginBottom: 10 }}>AUDIO GUIDE</HairLabel>

      {/* Hidden HTML5 audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => { setIsPlaying(false); setProgress(0); setCurrentTime(0); }}
        onLoadedMetadata={e => setDuration((e.target as HTMLAudioElement).duration)}
        onTimeUpdate={e => {
          const a = e.target as HTMLAudioElement;
          setCurrentTime(a.currentTime);
          setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0);
        }}
      />

      {/* Status + controls row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontFamily: s2.sans, fontSize: 12, color: s2.textDim }}>
          {isPlaying ? 'Playing…' : progress > 0 ? 'Paused' : 'Listen while you cook'}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {/* Play / Pause */}
          <button
            onClick={togglePlay}
            style={{
              width: 34, height: 34, flexShrink: 0,
              background: isPlaying ? s2.accentFill : 'transparent',
              border: `1px solid ${s2.accent}`,
              color: s2.accent,
              fontFamily: s2.mono, fontSize: 13,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          {/* Stop */}
          <button
            onClick={handleStop}
            style={{
              width: 34, height: 34, flexShrink: 0,
              background: 'transparent',
              border: `1px solid ${s2.lineStrong}`,
              color: s2.textDimmer,
              fontFamily: s2.mono, fontSize: 13,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ⏹
          </button>
        </div>
      </div>

      {/* Seek bar */}
      <input
        type="range"
        min="0"
        max="100"
        step="0.1"
        value={progress}
        onChange={handleSeek}
        style={{
          width: '100%', height: 3,
          accentColor: s2.accent,
          cursor: 'pointer',
          display: 'block',
          marginBottom: 4,
        }}
      />

      {/* Time display */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontFamily: s2.mono, fontSize: 9, color: s2.textDimmer,
        letterSpacing: '0.08em',
      }}>
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
