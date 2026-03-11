import { Capacitor } from '@capacitor/core';

// Lightweight fallback notification sound for the browser.
// Native mobile platforms should use the OS notification sound instead.

let audioCtx: AudioContext | null = null;
let oscillators: OscillatorNode[] = [];
let gainNode: GainNode | null = null;
let stopTimeout: number | null = null;
let isPlaying = false;

function shouldUseNativeNotificationSound(): boolean {
  return Capacitor.isNativePlatform();
}

function ensureContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      // Safari prefix support via window.AudioContext fallback handled by TS lib dom
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Some browsers require a user gesture before audio can play; resume if suspended.
    if (audioCtx && audioCtx.state === 'suspended') {
      void audioCtx.resume().catch(() => {/* ignore */});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export function startNotificationSound(maxDurationMs: number = 3000) {
  if (isPlaying) return; // prevent overlapping
  if (shouldUseNativeNotificationSound()) return;

  const ctx = ensureContext();
  if (!ctx) return; // Audio not supported or blocked

  gainNode = ctx.createGain();

  const now = ctx.currentTime;
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.connect(ctx.destination);

  const playTone = (frequency: number, startAt: number, duration: number, volume: number) => {
    const oscillator = ctx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startAt);
    oscillator.connect(gainNode!);
    gainNode!.gain.setValueAtTime(0.0001, startAt);
    gainNode!.gain.exponentialRampToValueAtTime(volume, startAt + 0.03);
    gainNode!.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.03);
    oscillators.push(oscillator);
  };

  // Two short soft tones read more like a clean notification chime than a pulse.
  playTone(740, now, 0.18, 0.03);
  playTone(988, now + 0.15, 0.24, 0.035);

  // Auto stop after maxDurationMs
  stopTimeout = window.setTimeout(() => stopNotificationSound(), maxDurationMs) as unknown as number;
  isPlaying = true;
}

export function stopNotificationSound() {
  if (!isPlaying) return;

  if (stopTimeout) {
    window.clearTimeout(stopTimeout);
    stopTimeout = null;
  }

  try {
    const ctx = audioCtx;
    if (gainNode && ctx) {
      const now = ctx.currentTime;
      // quick release to avoid clicks
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setTargetAtTime(0.0001, now, 0.03);
    }
    setTimeout(() => {
      oscillators.forEach(node => {
        try { node.stop(); } catch { /* ignore */ }
        try { node.disconnect(); } catch { /* ignore */ }
      });
      try { gainNode?.disconnect(); } catch { /* ignore */ }
      oscillators = [];
      gainNode = null;
    }, 80);
  } finally {
    isPlaying = false;
  }
}

export function isNotificationSoundPlaying() {
  return isPlaying;
}
