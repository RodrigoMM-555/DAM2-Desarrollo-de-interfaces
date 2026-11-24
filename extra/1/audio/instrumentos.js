// @ts-check
/**
 * Instrumentos sintetizados con Web Audio (sin archivos de sonido).
 *
 * Cada función programa un sonido en el instante `t` (segundos del reloj del
 * contexto) y lo conecta a `destino`. Funcionan igual en un AudioContext (en
 * directo) que en un OfflineAudioContext (para generar la canción entera).
 *
 * Idea común: un oscilador o ruido + una envolvente de volumen
 * (subida rápida y caída exponencial), que es lo que hace sonar a percusión.
 */

/** @typedef {BaseAudioContext} Contexto */

/** @type {WeakMap<BaseAudioContext, AudioBuffer>} */
const ruidos = new WeakMap();

/** Un segundo de ruido blanco, reutilizado por cada contexto. @param {Contexto} ctx */
function ruido(ctx) {
  let buffer = ruidos.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const datos = buffer.getChannelData(0);
    for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
    ruidos.set(ctx, buffer);
  }
  return buffer;
}

/**
 * Volumen con subida casi instantánea y caída exponencial.
 * @param {Contexto} ctx @param {number} t @param {number} pico @param {number} caida segundos
 */
function envolvente(ctx, t, pico, caida) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(pico, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + caida);
  return g;
}

/**
 * Oscilador con caída de tono (el "tum" de un tambor).
 * @param {Contexto} ctx @param {AudioNode} destino @param {number} t
 * @param {{ tipo?: OscillatorType, desde: number, hasta: number, bajada: number, pico: number, caida: number }} o
 */
function tono(ctx, destino, t, { tipo = 'sine', desde, hasta, bajada, pico, caida }) {
  const osc = ctx.createOscillator();
  osc.type = tipo;
  osc.frequency.setValueAtTime(desde, t);
  osc.frequency.exponentialRampToValueAtTime(hasta, t + bajada);
  const g = envolvente(ctx, t, pico, caida);
  osc.connect(g).connect(destino);
  osc.start(t);
  osc.stop(t + caida + 0.05);
}

/**
 * Ruido filtrado (maracas, chasquidos).
 * @param {Contexto} ctx @param {AudioNode} destino @param {number} t
 * @param {{ filtro: BiquadFilterType, frecuencia: number, pico: number, caida: number }} o
 */
function soplo(ctx, destino, t, { filtro, frecuencia, pico, caida }) {
  const fuente = ctx.createBufferSource();
  fuente.buffer = ruido(ctx);
  const f = ctx.createBiquadFilter();
  f.type = filtro;
  f.frequency.value = frecuencia;
  const g = envolvente(ctx, t, pico, caida);
  fuente.connect(f).connect(g).connect(destino);
  fuente.start(t, Math.random() * 0.5);
  fuente.stop(t + caida + 0.05);
}

/** Frecuencia de una nota escrita como "A2", "C#3", "Eb4". @param {string} nombre */
export function frecuencia(nombre) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(nombre);
  if (!m) throw new Error(`Nota no válida: ${nombre}`);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] ?? 0;
  const alteracion = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const midi = (Number(m[3]) + 1) * 12 + base + alteracion;
  return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * Notas de un acorde: "Am" → A3, C4, E4. "E7" → E3, G#3, B3, D4.
 * @param {string} acorde
 * @returns {number[]} Frecuencias.
 */
export function notasAcorde(acorde) {
  const m = /^([A-G][#b]?)(m?)(7?)$/.exec(acorde);
  if (!m) throw new Error(`Acorde no válido: ${acorde}`);
  const raiz = frecuencia(`${m[1]}3`);
  const intervalos = [0, m[2] ? 3 : 4, 7, ...(m[3] ? [10] : [])];
  return intervalos.map((s) => raiz * 2 ** (s / 12));
}

/** @typedef {(ctx: Contexto, destino: AudioNode, t: number, opciones: { acento?: boolean, nota?: string, duracion?: number }) => void} Instrumento */

/** @type {Record<string, Instrumento>} */
export const INSTRUMENTOS = {
  bombo: (ctx, d, t, { acento }) =>
    tono(ctx, d, t, { desde: 140, hasta: 42, bajada: 0.12, pico: acento ? 0.9 : 0.7, caida: 0.35 }),

  conga: (ctx, d, t, { acento }) => {
    tono(ctx, d, t, { desde: 360, hasta: 300, bajada: 0.05, pico: acento ? 0.45 : 0.3, caida: 0.22 });
    soplo(ctx, d, t, { filtro: 'bandpass', frecuencia: 2500, pico: 0.08, caida: 0.03 });
  },

  tumba: (ctx, d, t, { acento }) => {
    tono(ctx, d, t, { desde: 230, hasta: 190, bajada: 0.06, pico: acento ? 0.5 : 0.35, caida: 0.3 });
    soplo(ctx, d, t, { filtro: 'bandpass', frecuencia: 1800, pico: 0.06, caida: 0.03 });
  },

  clave: (ctx, d, t) => {
    tono(ctx, d, t, { desde: 2500, hasta: 2450, bajada: 0.02, pico: 0.25, caida: 0.06 });
    tono(ctx, d, t, { tipo: 'triangle', desde: 1250, hasta: 1240, bajada: 0.02, pico: 0.1, caida: 0.05 });
  },

  maraca: (ctx, d, t, { acento }) =>
    soplo(ctx, d, t, { filtro: 'highpass', frecuencia: 7000, pico: acento ? 0.16 : 0.08, caida: 0.05 }),

  campana: (ctx, d, t, { acento }) => {
    for (const f of [562, 845]) {
      tono(ctx, d, t, { tipo: 'square', desde: f, hasta: f, bajada: 0.01, pico: acento ? 0.06 : 0.04, caida: 0.25 });
    }
  },

  bajo: (ctx, d, t, { nota = 'A2', duracion = 0.3 }) => {
    const f = frecuencia(nota);
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.12, t + duracion * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
    filtro.connect(g).connect(d);
    for (const [tipo, mult] of /** @type {[OscillatorType, number][]} */ ([['triangle', 1], ['sine', 0.5]])) {
      const osc = ctx.createOscillator();
      osc.type = tipo;
      osc.frequency.value = f * mult;
      osc.connect(filtro);
      osc.start(t);
      osc.stop(t + duracion + 0.05);
    }
  },

  acorde: (ctx, d, t, { nota = 'Am', duracion = 2 }) => {
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 1100;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.15);
    g.gain.setValueAtTime(0.05, t + duracion * 0.8);
    g.gain.linearRampToValueAtTime(0.0001, t + duracion);
    filtro.connect(g).connect(d);
    for (const f of notasAcorde(nota)) {
      for (const desafino of [-5, 5]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = f;
        osc.detune.value = desafino;
        osc.connect(filtro);
        osc.start(t);
        osc.stop(t + duracion + 0.05);
      }
    }
  },
};

/** Notas del sonido de acierto en cada carril (pentatónica de La). */
const NOTAS_CARRIL = ['A4', 'C5', 'E5', 'G5'];

/**
 * Sonido de acierto: una marimba con la nota del carril.
 * @param {Contexto} ctx @param {AudioNode} destino @param {number} t @param {number} carril
 */
export function sonidoAcierto(ctx, destino, t, carril) {
  const f = frecuencia(NOTAS_CARRIL[carril] ?? 'A4');
  tono(ctx, destino, t, { desde: f, hasta: f, bajada: 0.01, pico: 0.35, caida: 0.45 });
  tono(ctx, destino, t, { desde: f * 4, hasta: f * 4, bajada: 0.01, pico: 0.06, caida: 0.08 });
}
