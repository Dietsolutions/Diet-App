// useAudioGuide — Web Speech API hook for cooking audio guide.
// Uses browser's built-in speechSynthesis — zero cost, no file storage.

import { useState, useRef, useEffect, useCallback } from 'react';

export function useAudioGuide(script: string | null) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused,  setIsPaused]  = useState(false);
  const [progress,  setProgress]  = useState(0);

  const progressRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedRef   = useRef<number>(0); // accumulated elapsed seconds before any pause

  // Rough duration estimate: ~130 words/min, ~5 chars/word
  const estimatedSecs = script ? Math.max(1, Math.round((script.split(/\s+/).length / 130) * 60)) : 1;

  function clearProgressTimer() {
    if (progressRef.current) {
      clearInterval(progressRef.current);
      progressRef.current = null;
    }
  }

  function startProgressTimer() {
    clearProgressTimer();
    startTimeRef.current = Date.now();
    progressRef.current = setInterval(() => {
      const now = Date.now();
      const totalElapsed = elapsedRef.current + (now - startTimeRef.current) / 1000;
      setProgress(Math.min((totalElapsed / estimatedSecs) * 100, 99));
    }, 300);
  }

  function getBestVoice(): SpeechSynthesisVoice | null {
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

  const play = useCallback(() => {
    if (!script) return;

    // Resume if paused
    if (isPaused && speechSynthesis.paused) {
      speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      startProgressTimer();
      return;
    }

    // Fresh start
    speechSynthesis.cancel();
    elapsedRef.current = 0;
    setProgress(0);

    const utterance = new SpeechSynthesisUtterance(script);
    utterance.rate   = 0.88;
    utterance.pitch  = 1.0;
    utterance.volume = 1.0;
    const voice = getBestVoice();
    if (voice) utterance.voice = voice;

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
      startProgressTimer();
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setProgress(100);
      clearProgressTimer();
      elapsedRef.current = 0;
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
      clearProgressTimer();
    };

    speechSynthesis.speak(utterance);
  }, [script, isPaused, estimatedSecs]);

  const pause = useCallback(() => {
    if (!speechSynthesis.speaking) return;
    // accumulate elapsed time before pausing
    elapsedRef.current += (Date.now() - startTimeRef.current) / 1000;
    speechSynthesis.pause();
    setIsPaused(true);
    setIsPlaying(false);
    clearProgressTimer();
  }, []);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
    clearProgressTimer();
    elapsedRef.current = 0;
  }, []);

  // Stop on unmount and pre-load voices
  useEffect(() => {
    // Pre-load voices list (needed on some browsers)
    speechSynthesis.getVoices();
    const onVoicesChanged = () => speechSynthesis.getVoices();
    speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);

    return () => {
      speechSynthesis.cancel();
      clearProgressTimer();
      speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
    };
  }, []);

  return { isPlaying, isPaused, progress, play, pause, stop };
}
