/**
 * Owns the Web Audio graph:
 *
 *   music voices -> musicFilter -> musicGain -\
 *                                              +-> master -> compressor -> speakers
 *   sound effects ---------------> sfxGain ---/
 *
 * Browsers only allow audio after a user gesture, so the context is created
 * lazily in `unlock()`. Every public method is safe to call before that.
 */
export class AudioEngine {
  constructor(settings) {
    this.context = null;
    this.settings = settings;
    this.noiseBuffer = null;
  }

  get isReady() {
    return this.context !== null;
  }

  get now() {
    return this.context ? this.context.currentTime : 0;
  }

  unlock() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume();
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      this.context = new AudioContextClass();
    } catch (error) {
      console.warn('AFTERSHOCK: audio unavailable.', error);
      return;
    }
    const ctx = this.context;

    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -14;
    this.compressor.ratio.value = 4;
    this.compressor.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.connect(this.compressor);

    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 18000;
    this.musicGain = ctx.createGain();
    this.musicFilter.connect(this.musicGain);
    this.musicGain.connect(this.master);

    this.sfxGain = ctx.createGain();
    this.sfxGain.connect(this.master);

    // Shared feedback delay gives leads and arps a spacious, neon-soaked tail.
    this.delay = ctx.createDelay(1);
    this.delay.delayTime.value = 0.28;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    this.delayInput = ctx.createGain();
    this.delayInput.gain.value = 0.35;
    this.delayInput.connect(this.delay);
    this.delay.connect(feedback);
    feedback.connect(this.delay);
    this.delay.connect(this.musicFilter);

    this.noiseBuffer = this.createNoiseBuffer();
    this.applySettings();
  }

  createNoiseBuffer() {
    const length = this.context.sampleRate * 1.5;
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  applySettings() {
    if (!this.context) return;
    const { soundEnabled, musicVolume, effectsVolume } = this.settings;
    const time = this.context.currentTime;
    this.master.gain.setTargetAtTime(soundEnabled ? 0.9 : 0, time, 0.05);
    this.musicGain.gain.setTargetAtTime(musicVolume * 0.55, time, 0.05);
    this.sfxGain.gain.setTargetAtTime(effectsVolume * 0.8, time, 0.05);
  }

  /** Muffles the music (used during slow motion and pause). */
  setMusicMuffled(isMuffled) {
    if (!this.context) return;
    this.musicFilter.frequency.setTargetAtTime(isMuffled ? 700 : 18000, this.context.currentTime, 0.15);
  }

  /** Short envelope helper: attack to `peak`, exponential decay to silence. */
  envelope(gainNode, startTime, attack, peak, decay) {
    const gain = gainNode.gain;
    gain.setValueAtTime(0.0001, startTime);
    gain.linearRampToValueAtTime(peak, startTime + attack);
    gain.exponentialRampToValueAtTime(0.0001, startTime + attack + decay);
  }

  createNoiseSource() {
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    return source;
  }
}
