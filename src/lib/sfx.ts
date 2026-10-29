/**
 * Tiny WebAudio SFX engine — zero assets, works offline, one shared context.
 * Respects the learner's sound toggle and prefers-reduced-motion is handled by callers.
 */
let ctx: AudioContext | null = null;
let enabled = true;
let musicNodes: { osc: OscillatorNode; gain: GainNode; timer?: ReturnType<typeof setInterval> } | null = null;

const getCtx = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
};

export const setSoundEnabled = (v: boolean) => {
  enabled = v;
  if (!v) stopMusic();
};

const tone = (
  freq: number,
  duration = 0.15,
  type: OscillatorType = 'sine',
  gainValue = 0.08,
  delay = 0,
  slideTo?: number,
) => {
  if (!enabled) return;
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(gainValue, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
};

export const sfx = {
  correct() {
    tone(660, 0.12, 'triangle', 0.09);
    tone(880, 0.16, 'triangle', 0.08, 0.1);
    tone(1180, 0.2, 'triangle', 0.06, 0.2);
  },
  wrong() {
    tone(220, 0.22, 'sawtooth', 0.05, 0, 140);
  },
  click() {
    tone(420, 0.05, 'square', 0.035);
  },
  pop() {
    tone(760, 0.08, 'sine', 0.06, 0, 1100);
  },
  coin() {
    tone(1046, 0.07, 'square', 0.045);
    tone(1568, 0.12, 'square', 0.04, 0.06);
  },
  tick() {
    tone(560, 0.04, 'square', 0.025);
  },
  start() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.07, i * 0.09));
  },
  win() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.22, 'triangle', 0.07, i * 0.11));
  },
  breakStart() {
    [392, 523, 659].forEach((f, i) => tone(f, 0.16, 'square', 0.05, i * 0.08));
  },
};

export const startMusic = (intensity = 0) => {
  if (!enabled || typeof window === 'undefined') return;
  stopMusic();
  const ac = getCtx();
  if (!ac) return;
  const gain = ac.createGain();
  gain.gain.value = 0.012;
  const osc = ac.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = 110 + intensity * 10;
  osc.connect(gain).connect(ac.destination);
  osc.start();
  const scale = [220, 261, 293, 329, 392, 440];
  let step = 0;
  const timer = setInterval(() => {
    if (!enabled) return;
    const f = scale[step % scale.length];
    osc.frequency.setTargetAtTime(f / 2, ac.currentTime, 0.2);
    step++;
  }, 620);
  musicNodes = { osc, gain, timer };
};

export const stopMusic = () => {
  if (!musicNodes) return;
  const { osc, gain, timer } = musicNodes;
  musicNodes = null;
  if (timer) clearInterval(timer);
  try {
    const ac = getCtx();
    if (ac) {
      gain.gain.setTargetAtTime(0.0001, ac.currentTime, 0.1);
      osc.stop(ac.currentTime + 0.3);
    }
  } catch {
    /* noop */
  }
};

export const isSoundEnabled = () => enabled;
