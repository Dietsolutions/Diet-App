// useAudioGuide — Web Speech API hook for cooking audio guide.
//
// Root-cause notes on previous silent-playback bug:
//   Calling speechSynthesis.cancel() on a cold engine (nothing playing) and
//   immediately following it with speak() leaves the utterance in silent limbo
//   on WebKit / iOS: queued, no audio, no onend, no onerror.
//
// Fix: only call cancel() when the engine is already active (speaking or paused).
//   • Cold start  → speak() directly, no cancel.
//   • Hot restart → cancel() + 100 ms delay + speak() (gives WebKit time to settle).
//   • Resume      → resume() only.

import { useState, useRef, useEffect } from 'react';

function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function useAudioGuide(script: string | null) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused,  setIsPaused]  = useState(false);
  const [progress,  setProgress]  = useState(0);

  // Refs so closures (setInterval, setTimeout) always read the latest values
  const scriptRef        = useRef<string | null>(script);
  const estimatedSecsRef = useRef<number>(1);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef     = useRef<number>(0);
  const elapsedRef       = useRef<number>(0);
  const pendingRef       = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    scriptRef.current        = script;
    estimatedSecsRef.current = script
      ? Math.max(1, Math.round((script.split(/\s+/).length / 130) * 60))
      : 1;
  }, [script]);

  // ── helpers ────────────────────────────────────────────────────────────────

  function clearTimer() {
    if (timerRef.current)   { clearInterval(timerRef.current);  timerRef.current  = null; }
    if (pendingRef.current) { clearTimeout(pendingRef.current); pendingRef.current = null; }
  }

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const totalElapsed = elapsedRef.current + (Date.now() - startTimeRef.current) / 1000;
      setProgress(Math.min((totalElapsed / estimatedSecsRef.current) * 100, 99));
    }, 300);
  }

  function getBestVoice(): SpeechSynthesisVoice | null {
    const voices = speechSynthesis.getVoices();
    return (
      voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ||
      voices.find(v => v.lang === 'en-GB') ||
      voices.find(v => v.lang === 'en-US') ||
      voices.find(v => v.lang.startsWith('en')) ||
      (voices.length > 0 ? voices[0] : null)
    );
  }

  function buildUtterance(text: string): SpeechSynthesisUtterance {
    const u = new SpeechSynthesisUtterance(text);
    u.rate   = 0.9;
    u.pitch  = 1.0;
    u.volume = 1.0;
    const voice = getBestVoice();
    if (voice) u.voice = voice;

    u.onstart = () => {
      // Belt-and-suspenders: keep state in sync if it wasn't set pre-speak
      setIsPlaying(true);
      setIsPaused(false);
    };
    u.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setProgress(100);
      clearTimer();
      elapsedRef.current = 0;
    };
    u.onerror = (e) => {
      // 'interrupted' / 'canceled' are normal when cancel() is called — ignore
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      setIsPlaying(false);
      setIsPaused(false);
      clearTimer();
    };
    return u;
  }

  // ── public controls ────────────────────────────────────────────────────────

  function play() {
    if (!isSpeechSupported()) return;
    const text = scriptRef.current;
    if (!text) return;

    // ── RESUME ──────────────────────────────────────────────────────────────
    if (isPaused && speechSynthesis.paused) {
      speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      startTimer();
      return;
    }

    // ── FRESH START ─────────────────────────────────────────────────────────
    const utterance = buildUtterance(text);
    elapsedRef.current = 0;
    setProgress(0);

    const engineActive = speechSynthesis.speaking || speechSynthesis.pending;

    if (!engineActive) {
      // Cold start — speak immediately, no cancel needed (avoids silent-limbo bug)
      setIsPlaying(true);
      setIsPaused(false);
      startTimer();
      speechSynthesis.speak(utterance);
    } else {
      // Hot restart — cancel, then give WebKit 100 ms to fully reset
      speechSynthesis.cancel();
      setIsPlaying(true);
      setIsPaused(false);
      startTimer();
      pendingRef.current = setTimeout(() => {
        speechSynthesis.speak(utterance);
      }, 100);
    }
  }

  function pause() {
    if (!isSpeechSupported()) return;
    if (!speechSynthesis.speaking) return;
    elapsedRef.current += (Date.now() - startTimeRef.current) / 1000;
    speechSynthesis.pause();
    setIsPaused(true);
    setIsPlaying(false);
    clearTimer();
  }

  function stop() {
    if (isSpeechSupported()) speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
    clearTimer();
    elapsedRef.current = 0;
  }

  // Pre-load voices + cleanup
  useEffect(() => {
    if (!isSpeechSupported()) return;
    speechSynthesis.getVoices();
    const onVoicesChanged = () => speechSynthesis.getVoices();
    speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
    return () => {
      speechSynthesis.cancel();
      clearTimer();
      speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
    };
  }, []);

  return { isPlaying, isPaused, progress, play, pause, stop };
}
