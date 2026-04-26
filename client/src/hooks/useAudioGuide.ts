// useAudioGuide — Web Speech API hook for cooking audio guide.
// Uses browser's built-in speechSynthesis — zero cost, no file storage.
//
// Key design choices:
//  • play/pause/stop are plain functions (not useCallback) so they always
//    read the latest React state — no stale-closure bugs.
//  • setIsPlaying(true) is called immediately when speak() fires, not inside
//    utterance.onstart, because iOS Safari delays or drops onstart events.
//  • onerror ignores 'interrupted'/'canceled' — those fire when cancel() is
//    called before a fresh start and must not reset the playing state.
//  • script and estimatedSecs are stored in refs so the interval closure
//    always has current values without recreating itself.

import { useState, useRef, useEffect } from 'react';

export function useAudioGuide(script: string | null) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused,  setIsPaused]  = useState(false);
  const [progress,  setProgress]  = useState(0);

  // Refs so closures always read the latest value without useCallback deps
  const scriptRef        = useRef<string | null>(script);
  const estimatedSecsRef = useRef<number>(1);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef     = useRef<number>(0);
  const elapsedRef       = useRef<number>(0);

  // Keep refs in sync whenever the prop changes
  useEffect(() => {
    scriptRef.current        = script;
    estimatedSecsRef.current = script
      ? Math.max(1, Math.round((script.split(/\s+/).length / 130) * 60))
      : 1;
  }, [script]);

  // ── helpers ────────────────────────────────────────────────────────────────

  function clearTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  function startTimer() {
    clearTimer();
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const totalElapsed = elapsedRef.current + (Date.now() - startTimeRef.current) / 1000;
      setProgress(Math.min((totalElapsed / estimatedSecsRef.current) * 100, 99));
    }, 300);
  }

  function getBestVoice(): SpeechSynthesisVoice | null {
    if (typeof speechSynthesis === 'undefined') return null;
    const voices = speechSynthesis.getVoices();
    return (
      voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ||
      voices.find(v => v.lang === 'en-GB') ||
      voices.find(v => v.lang === 'en-US') ||
      voices.find(v => v.lang.startsWith('en')) ||
      voices[0] ||
      null
    );
  }

  // ── public controls ────────────────────────────────────────────────────────

  function play() {
    if (typeof speechSynthesis === 'undefined') return;
    const currentScript = scriptRef.current;
    if (!currentScript) return;

    // Resume a paused utterance
    if (isPaused && speechSynthesis.paused) {
      speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      startTimer();
      return;
    }

    // Cancel whatever is playing, then start fresh.
    // NOTE: cancel() will fire onerror('interrupted') on the old utterance —
    // that's expected and must NOT reset our new playing state.
    speechSynthesis.cancel();
    elapsedRef.current = 0;
    setProgress(0);

    const utterance = new SpeechSynthesisUtterance(currentScript);
    utterance.rate   = 0.88;
    utterance.pitch  = 1.0;
    utterance.volume = 1.0;
    const voice = getBestVoice();
    if (voice) utterance.voice = voice;

    // Set playing state BEFORE speak() — don't rely on onstart which iOS drops
    setIsPlaying(true);
    setIsPaused(false);
    startTimer();

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setProgress(100);
      clearTimer();
      elapsedRef.current = 0;
    };

    utterance.onerror = (e) => {
      // 'interrupted' and 'canceled' are normal side-effects of cancel() —
      // ignore them so they don't clobber the playing state we just set.
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      setIsPlaying(false);
      setIsPaused(false);
      clearTimer();
    };

    speechSynthesis.speak(utterance);
  }

  function pause() {
    if (typeof speechSynthesis === 'undefined') return;
    if (!speechSynthesis.speaking) return;
    elapsedRef.current += (Date.now() - startTimeRef.current) / 1000;
    speechSynthesis.pause();
    setIsPaused(true);
    setIsPlaying(false);
    clearTimer();
  }

  function stop() {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
    clearTimer();
    elapsedRef.current = 0;
  }

  // Pre-load voices list + cleanup on unmount
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return;
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
