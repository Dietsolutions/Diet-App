// AudioGuidePlayer — HTML5 <audio> player for cooking instruction audio files.
// Replaces the broken Web Speech API approach.
// Uses Strain v2 design tokens — no rounded corners, mono labels, orange accent.

import { useState, useRef, useEffect } from 'react';
import { s2 } from '../theme/tokens';
import { HairLabel } from './ui';
import { track } from '../lib/analytics';

interface Props {
  audioUrl:     string | null;
  isGenerating: boolean;
  error:        string;
  onGenerate:   () => void;
  mealName?:    string;
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const SPEEDS = [1, 1.5, 2, 3, 5] as const;

// Speed button style — compact pill, orange accent when active
function speedBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding:       '3px 7px',
    borderRadius:  '4px',
    border:        `0.5px solid ${active ? 'rgba(196,113,58,0.8)' : 'rgba(255,255,255,0.1)'}`,
    background:    active ? 'rgba(196,113,58,0.15)' : 'transparent',
    color:         active ? '#C4713A' : 'rgba(255,255,255,0.3)',
    fontSize:      '10px',
    fontWeight:    active ? 700 : 400,
    fontFamily:    'DM Mono, monospace',
    cursor:        'pointer',
    letterSpacing: '0.3px',
    lineHeight:    1,
  };
}

export function AudioGuidePlayer({ audioUrl, isGenerating, error, onGenerate, mealName }: Props) {
  const audioRef                          = useRef<HTMLAudioElement>(null);
  const [isPlaying,    setIsPlaying]      = useState(false);
  const [progress,     setProgress]       = useState(0);
  const [currentTime,  setCurrentTime]    = useState(0);
  const [duration,     setDuration]       = useState(0);
  const [playbackRate, setPlaybackRate]   = useState(1);

  // Apply speed to the audio element whenever playbackRate changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Reset speed to 1x when a new audio URL loads
  useEffect(() => {
    setPlaybackRate(1);
    if (audioRef.current) {
      audioRef.current.playbackRate = 1;
    }
  }, [audioUrl]);

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

        {/* Audio language selector — English only, more coming soon */}
        <div style={{ marginBottom: 10 }}>
          <div style={{
            fontFamily: s2.mono, fontSize: 7, letterSpacing: '0.16em',
            color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', marginBottom: 5,
          }}>
            AUDIO LANGUAGE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Static English pill — always selected */}
            <div style={{
              padding: '4px 10px',
              border: `1px solid rgba(196,113,58,0.7)`,
              background: 'rgba(196,113,58,0.12)',
              fontFamily: s2.mono, fontSize: 9, fontWeight: 600,
              letterSpacing: '0.12em', color: '#C4713A',
              cursor: 'default',
            }}>
              English
            </div>
            <div style={{
              fontFamily: s2.sans, fontSize: 10,
              color: 'rgba(255,255,255,0.25)',
              fontStyle: 'italic',
            }}>
              More languages coming soon
            </div>
          </div>
        </div>

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
        onPlay={() => { setIsPlaying(true); track('audio_guide_played', { meal_name: mealName ?? '' }); }}
        onPause={() => {
          const a = audioRef.current;
          const pct = a && a.duration ? Math.round((a.currentTime / a.duration) * 100) : 0;
          setIsPlaying(false);
          track('audio_guide_paused', { progress_pct: pct });
        }}
        onEnded={() => { setIsPlaying(false); setProgress(0); setCurrentTime(0); }}
        onLoadedMetadata={e => {
          const audio = e.target as HTMLAudioElement;
          audio.playbackRate = playbackRate; // apply speed if set before load
          setDuration(audio.duration);
        }}
        onTimeUpdate={e => {
          const a = e.target as HTMLAudioElement;
          setCurrentTime(a.currentTime);
          setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0);
        }}
      />

      {/* Controls + speed row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10, gap: 8,
      }}>
        {/* Left: play / stop controls + label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
          {/* Label */}
          <div>
            <div style={{
              fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.3)', fontFamily: s2.mono, marginBottom: 1,
            }}>
              AUDIO GUIDE
            </div>
            <div style={{ fontFamily: s2.sans, fontSize: 11, color: s2.textDim }}>
              {isPlaying ? 'Playing…' : progress > 0 ? 'Paused' : 'Listen while you cook'}
            </div>
          </div>
        </div>

        {/* Right: speed selector */}
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {SPEEDS.map(speed => (
            <button
              key={speed}
              onClick={() => setPlaybackRate(speed)}
              style={speedBtnStyle(playbackRate === speed)}
            >
              {speed === 1 ? '1x' : `${speed}x`}
            </button>
          ))}
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
