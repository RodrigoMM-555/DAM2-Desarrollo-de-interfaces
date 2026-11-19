/**
 * Sonido procedural con la Web Audio API: todos los sonidos se sintetizan
 * (osciladores y ruido filtrado), sin archivos de audio.
 *
 * Los navegadores no permiten sonar hasta que la persona interactúa con la
 * página, así que el contexto de audio se crea con el primer clic o tecla.
 */

/** @typedef {'click' | 'stroke' | 'erase' | 'seal' | 'charge' | 'success' | 'fail' | 'learned' | `spell:${string}`} SoundName */

/**
 * @typedef {object} SoundSettings
 * @property {(key: any) => any} get
 * @property {EventTarget['addEventListener']} addEventListener
 */

export class ServicioAudio {
  /** @type {AudioContext | null} */
  #ctx = null;
  /** @type {GainNode | null} */
  #master = null;
  /** @type {AudioBuffer | null} */
  #noise = null;
  /** @type {SoundSettings} */
  #settings;

  /** @param {SoundSettings} settings */
  constructor(settings) {
    this.#settings = settings;
    const unlock = () => this.#ensure();
    document.addEventListener('pointerdown', unlock, { once: true, capture: true });
    document.addEventListener('keydown', unlock, { once: true, capture: true });
    settings.addEventListener('change', () => this.#applyVolume());
  }

  /** `true` si el sonido está activado y el navegador ya lo permite. */
  get ready() {
    return this.#ctx !== null && this.#settings.get('sound.enabled');
  }

  /**
   * Reproduce un sonido.
   * @param {SoundName} name
   */
  play(name) {
    if (!this.#settings.get('sound.enabled')) return;
    const ctx = this.#ensure();
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + 0.01;
    switch (name) {
      case 'click':
        this.#tone(880, t, { duration: 0.08, gain: 0.07 });
        this.#tone(1320, t + 0.02, { duration: 0.08, gain: 0.04 });
        break;
      case 'stroke':
        this.#tone(520, t, { duration: 0.12, gain: 0.035, type: 'triangle', glideTo: 640 });
        break;
      case 'erase':
        this.#noiseBurst(t, { duration: 0.45, gain: 0.12, filter: 'highpass', freq: 1200, sweepTo: 5000 });
        break;
      case 'seal':
        this.#tone(220, t, { duration: 0.4, gain: 0.1 });
        this.#tone(330, t + 0.05, { duration: 0.4, gain: 0.07 });
        break;
      case 'charge':
        this.#tone(220, t, { duration: 1.1, gain: 0.07, type: 'sawtooth', glideTo: 880, lowpass: 1600 });
        break;
      case 'success':
        [523.25, 659.25, 783.99].forEach((f, i) => this.#tone(f, t + i * 0.08, { duration: 0.35, gain: 0.07 }));
        break;
      case 'fail':
        this.#tone(196, t, { duration: 0.45, gain: 0.08, type: 'triangle', glideTo: 155 });
        break;
      case 'learned':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.#tone(f, t + i * 0.12, { duration: 0.9, gain: 0.07 }));
        this.#tone(2093, t + 0.5, { duration: 1.2, gain: 0.02 });
        break;
      default:
        if (name.startsWith('spell:')) this.#spell(name.slice(6), t);
    }
  }

  /**
   * @param {string} element
   * @param {number} t
   */
  #spell(element, t) {
    switch (element) {
      case 'fire':
        this.#noiseBurst(t, { duration: 2.2, gain: 0.16, filter: 'lowpass', freq: 900 });
        for (let i = 0; i < 14; i++) this.#noiseBurst(t + Math.random() * 2, { duration: 0.03, gain: 0.12, filter: 'bandpass', freq: 2500 });
        break;
      case 'water':
        for (let i = 0; i < 8; i++) {
          const f = 300 + Math.random() * 300;
          this.#tone(f, t + i * 0.18 + Math.random() * 0.08, { duration: 0.15, gain: 0.06, glideTo: f * 2 });
        }
        break;
      case 'wind':
        this.#noiseBurst(t, { duration: 2.4, gain: 0.14, filter: 'bandpass', freq: 400, sweepTo: 1800, q: 3 });
        break;
      case 'light':
        [1046.5, 1318.5, 1568].forEach((f, i) => this.#tone(f, t + i * 0.1, { duration: 1.8, gain: 0.035 }));
        break;
      case 'aegis':
        this.#tone(110, t, { duration: 1.8, gain: 0.12 });
        this.#tone(880, t + 0.1, { duration: 1.2, gain: 0.04 });
        break;
      case 'ice':
        [2093, 2637, 3136, 2349, 2794].forEach((f, i) => this.#tone(f, t + i * 0.13, { duration: 0.35, gain: 0.03, type: 'triangle' }));
        break;
    }
  }

  /** @returns {AudioContext | null} */
  #ensure() {
    if (this.#ctx) {
      if (this.#ctx.state === 'suspended') this.#ctx.resume();
      return this.#ctx;
    }
    const Ctx = window.AudioContext;
    if (!Ctx) return null;
    this.#ctx = new Ctx();
    this.#master = this.#ctx.createGain();
    this.#master.connect(this.#ctx.destination);
    this.#applyVolume();
    // Un segundo de ruido blanco reutilizable
    const buffer = this.#ctx.createBuffer(1, this.#ctx.sampleRate, this.#ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.#noise = buffer;
    return this.#ctx;
  }

  #applyVolume() {
    if (this.#master) this.#master.gain.value = this.#settings.get('sound.volume');
  }

  /**
   * Oscilador con envolvente suave.
   * @param {number} freq
   * @param {number} when
   * @param {{ duration: number, gain: number, type?: OscillatorType, glideTo?: number, lowpass?: number }} options
   */
  #tone(freq, when, { duration, gain, type = 'sine', glideTo, lowpass }) {
    const ctx = /** @type {AudioContext} */ (this.#ctx);
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, when + duration);
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(gain, when + Math.min(0.03, duration / 4));
    env.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    let node = /** @type {AudioNode} */ (osc);
    if (lowpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      osc.connect(filter);
      node = filter;
    }
    node.connect(env).connect(/** @type {GainNode} */ (this.#master));
    osc.start(when);
    osc.stop(when + duration + 0.05);
  }

  /**
   * Ráfaga de ruido filtrado.
   * @param {number} when
   * @param {{ duration: number, gain: number, filter: BiquadFilterType, freq: number, sweepTo?: number, q?: number }} options
   */
  #noiseBurst(when, { duration, gain, filter, freq, sweepTo, q = 1 }) {
    const ctx = /** @type {AudioContext} */ (this.#ctx);
    const source = ctx.createBufferSource();
    source.buffer = this.#noise;
    source.loop = true;
    const biquad = ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.Q.value = q;
    biquad.frequency.setValueAtTime(freq, when);
    if (sweepTo) {
      biquad.frequency.linearRampToValueAtTime(sweepTo, when + duration * 0.6);
      biquad.frequency.linearRampToValueAtTime(freq, when + duration);
    }
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(gain, when + Math.min(0.15, duration / 3));
    env.gain.linearRampToValueAtTime(0, when + duration);
    source.connect(biquad).connect(env).connect(/** @type {GainNode} */ (this.#master));
    source.start(when, Math.random());
    source.stop(when + duration + 0.05);
  }
}
