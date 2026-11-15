/**
 * Synthesised sound effects. Each recipe builds a tiny oscillator/noise
 * patch, so there are no audio files to load and every sound can be tweaked
 * right here.
 */
export class SoundEffects {
  constructor(engine) {
    this.engine = engine;
    this.lastPlayed = new Map();
  }

  play(name, options = {}) {
    const engine = this.engine;
    if (!engine.isReady || !this.settingsAllowSound()) return;
    const recipe = RECIPES[name];
    if (!recipe) {
      console.warn(`AFTERSHOCK: unknown sound "${name}"`);
      return;
    }
    // Throttle rapid repeats (e.g. many sparks in one frame) to avoid clipping.
    const now = engine.now;
    if (now - (this.lastPlayed.get(name) ?? -1) < (recipe.minGap ?? 0.03)) return;
    this.lastPlayed.set(name, now);
    recipe.play(engine, now, options);
  }

  settingsAllowSound() {
    return this.engine.settings.soundEnabled;
  }
}

function tone(engine, { type = 'square', from, to = from, start, duration, volume = 0.2, attack = 0.005, filter = null }) {
  const ctx = engine.context;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
  engine.envelope(gain, start, attack, volume, duration);
  let output = osc;
  if (filter) {
    const biquad = ctx.createBiquadFilter();
    biquad.type = filter.type;
    biquad.frequency.value = filter.frequency;
    biquad.Q.value = filter.q ?? 1;
    osc.connect(biquad);
    output = biquad;
  }
  output.connect(gain);
  gain.connect(engine.sfxGain);
  osc.start(start);
  osc.stop(start + attack + duration + 0.05);
}

function noise(engine, { start, duration, volume = 0.2, filterType = 'lowpass', from = 2000, to = from, q = 1, attack = 0.003 }) {
  const ctx = engine.context;
  const source = engine.createNoiseSource();
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, start);
  if (to !== from) filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
  const gain = ctx.createGain();
  engine.envelope(gain, start, attack, volume, duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(engine.sfxGain);
  source.start(start, Math.random() * 0.5);
  source.stop(start + attack + duration + 0.05);
}

const RECIPES = {
  jump: { play: (e, t) => tone(e, { type: 'square', from: 260, to: 620, start: t, duration: 0.1, volume: 0.08 }) },
  land: { play: (e, t, { impact = 300 }) => noise(e, { start: t, duration: 0.07, volume: Math.min(0.25, impact / 2400), from: 500, to: 120 }) },
  bounce: {
    play: (e, t) => {
      tone(e, { type: 'sine', from: 160, to: 980, start: t, duration: 0.32, volume: 0.22 });
      tone(e, { type: 'triangle', from: 320, to: 1400, start: t + 0.02, duration: 0.25, volume: 0.08 });
    },
  },
  shoot: {
    minGap: 0.04,
    play: (e, t) => {
      tone(e, { type: 'sawtooth', from: 1500, to: 260, start: t, duration: 0.11, volume: 0.09, filter: { type: 'bandpass', frequency: 1400, q: 0.8 } });
      noise(e, { start: t, duration: 0.03, volume: 0.06, filterType: 'highpass', from: 4000 });
    },
  },
  enemyHit: { play: (e, t) => tone(e, { type: 'square', from: 420, to: 180, start: t, duration: 0.07, volume: 0.08 }) },
  explosion: {
    minGap: 0.06,
    play: (e, t, { size = 1 }) => {
      noise(e, { start: t, duration: 0.5 * size, volume: 0.3, from: 2400, to: 90 });
      tone(e, { type: 'sine', from: 120, to: 38, start: t, duration: 0.4 * size, volume: 0.35 });
    },
  },
  shard: {
    play: (e, t) => {
      tone(e, { type: 'sine', from: 1046, start: t, duration: 0.08, volume: 0.09 });
      tone(e, { type: 'sine', from: 1568, start: t + 0.05, duration: 0.12, volume: 0.09 });
    },
  },
  powerUp: {
    play: (e, t) => [523, 659, 784, 1046].forEach((frequency, i) => tone(e, { type: 'square', from: frequency, start: t + i * 0.06, duration: 0.12, volume: 0.07 })),
  },
  hurt: {
    play: (e, t) => {
      tone(e, { type: 'sawtooth', from: 360, to: 70, start: t, duration: 0.32, volume: 0.16 });
      noise(e, { start: t, duration: 0.15, volume: 0.15, from: 1600, to: 300 });
    },
  },
  enemyCharge: { minGap: 0.25, play: (e, t) => tone(e, { type: 'sine', from: 380, to: 1100, start: t, duration: 0.6, volume: 0.035, attack: 0.3 }) },
  enemyFire: { play: (e, t) => tone(e, { type: 'square', from: 700, to: 180, start: t, duration: 0.16, volume: 0.06 }) },
  swarmStart: {
    play: (e, t) => {
      noise(e, { start: t, duration: 0.8, volume: 0.25, filterType: 'bandpass', from: 3500, to: 250, q: 2 });
      tone(e, { type: 'sine', from: 90, to: 40, start: t, duration: 0.9, volume: 0.3 });
    },
  },
  swarmEnd: { play: (e, t) => noise(e, { start: t, duration: 0.5, volume: 0.18, filterType: 'bandpass', from: 300, to: 3500, q: 2 }) },
  lockOn: {
    minGap: 0.4,
    play: (e, t) => [0, 0.14, 0.28].forEach((offset) => tone(e, { type: 'square', from: 1320, start: t + offset, duration: 0.07, volume: 0.06 })),
  },
  rumble: {
    minGap: 0.5,
    play: (e, t, { volume = 0.3 }) => noise(e, { start: t, duration: 1.6, volume, from: 180, to: 60, attack: 0.15 }),
  },
  alarm: {
    minGap: 0.3,
    play: (e, t) => {
      tone(e, { type: 'square', from: 880, start: t, duration: 0.1, volume: 0.05 });
      tone(e, { type: 'square', from: 660, start: t + 0.12, duration: 0.1, volume: 0.05 });
    },
  },
  checkpoint: {
    play: (e, t) => {
      tone(e, { type: 'triangle', from: 660, start: t, duration: 0.12, volume: 0.1 });
      tone(e, { type: 'triangle', from: 990, start: t + 0.08, duration: 0.2, volume: 0.1 });
    },
  },
  uiHover: { minGap: 0.04, play: (e, t) => tone(e, { type: 'square', from: 1400, start: t, duration: 0.025, volume: 0.03 }) },
  uiSelect: { play: (e, t) => tone(e, { type: 'square', from: 600, to: 1300, start: t, duration: 0.09, volume: 0.07 }) },
  uiBack: { play: (e, t) => tone(e, { type: 'square', from: 900, to: 400, start: t, duration: 0.09, volume: 0.06 }) },
  click: { play: (e, t) => noise(e, { start: t, duration: 0.02, volume: 0.08, filterType: 'highpass', from: 3000 }) },
  glitch: {
    minGap: 0.2,
    play: (e, t) => {
      for (let i = 0; i < 12; i++) {
        tone(e, { type: 'square', from: 80 + Math.random() * 2000, start: t + i * 0.045, duration: 0.03, volume: 0.07 });
      }
      noise(e, { start: t, duration: 0.6, volume: 0.12, filterType: 'bandpass', from: 1200, to: 4000, q: 4 });
    },
  },
  bossRoar: {
    play: (e, t) => {
      tone(e, { type: 'sawtooth', from: 55, to: 42, start: t, duration: 1.6, volume: 0.3, attack: 0.2, filter: { type: 'lowpass', frequency: 600 } });
      tone(e, { type: 'sawtooth', from: 56.5, to: 41, start: t, duration: 1.6, volume: 0.25, attack: 0.2, filter: { type: 'lowpass', frequency: 900 } });
      noise(e, { start: t, duration: 1.4, volume: 0.15, from: 900, to: 120, attack: 0.3 });
    },
  },
  bossSlam: {
    play: (e, t) => {
      tone(e, { type: 'sine', from: 90, to: 30, start: t, duration: 0.6, volume: 0.45 });
      noise(e, { start: t, duration: 0.4, volume: 0.3, from: 1200, to: 80 });
    },
  },
  armorHit: { minGap: 0.05, play: (e, t) => tone(e, { type: 'triangle', from: 1800, to: 1200, start: t, duration: 0.06, volume: 0.05 }) },
  criticalHit: {
    minGap: 0.05,
    play: (e, t) => {
      tone(e, { type: 'square', from: 220, to: 90, start: t, duration: 0.12, volume: 0.12 });
      noise(e, { start: t, duration: 0.1, volume: 0.12, filterType: 'bandpass', from: 2000, q: 2 });
    },
  },
  levelComplete: {
    play: (e, t) => [523, 659, 784, 1046, 1318].forEach((frequency, i) => tone(e, { type: 'square', from: frequency, start: t + i * 0.09, duration: 0.25, volume: 0.07 })),
  },
  failure: {
    play: (e, t) => [392, 311, 262, 196].forEach((frequency, i) => tone(e, { type: 'sawtooth', from: frequency, start: t + i * 0.16, duration: 0.3, volume: 0.07, filter: { type: 'lowpass', frequency: 1200 } })),
  },
};
