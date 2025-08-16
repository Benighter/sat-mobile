// Lightweight notification sound using Web Audio API (no external assets)
// Plays up to ~3 seconds or until manually stopped (e.g., when opening the bell)

let audioCtx: AudioContext | null = null;
let oscillator: OscillatorNode | null = null;
let gainNode: GainNode | null = null;
let stopTimeout: number | null = null;
let pulseInterval: number | null = null;
let isPlaying = false;

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

  const ctx = ensureContext();
  if (!ctx) return; // Audio not supported or blocked

  oscillator = ctx.createOscillator();
  gainNode = ctx.createGain();

  // Gentle tone (triangle) at 880Hz; not too loud
  oscillator.type = 'triangle';
  oscillator.frequency.value = 880; // A5

  // Envelope and initial volume
  const now = ctx.currentTime;
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.06, now + 0.05); // quick attack

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start();

  // Create a subtle pulsing effect to be more "notification-like"
  let on = true;
  pulseInterval = window.setInterval(() => {
    if (!ctx || !gainNode) return;
    const t = ctx.currentTime + 0.01;
    if (on) {
      gainNode.gain.cancelScheduledValues(t);
      gainNode.gain.setTargetAtTime(0.01, t, 0.03);
    } else {
      gainNode.gain.cancelScheduledValues(t);
      gainNode.gain.setTargetAtTime(0.06, t, 0.03);
    }
    on = !on;
  }, 220);

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
  if (pulseInterval) {
    window.clearInterval(pulseInterval);
    pulseInterval = null;
  }

  try {
    const ctx = audioCtx;
    if (gainNode && ctx) {
      const now = ctx.currentTime;
      // quick release to avoid clicks
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setTargetAtTime(0.0001, now, 0.03);
    }
    if (oscillator) {
      // Stop a bit later to allow release
      setTimeout(() => {
        try { oscillator?.stop(); } catch { /* ignore */ }
        try { oscillator?.disconnect(); } catch { /* ignore */ }
        try { gainNode?.disconnect(); } catch { /* ignore */ }
        oscillator = null;
        gainNode = null;
      }, 80);
    }
  } finally {
    isPlaying = false;
  }
}

export function isNotificationSoundPlaying() {
  return isPlaying;
}
