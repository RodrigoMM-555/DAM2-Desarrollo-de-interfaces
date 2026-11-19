import * as THREE from 'three';
import { defineElement, upgradeProperties } from '../../interno/definir.js';
import { css, baseStyles } from '../../interno/estilos.js';
import { emit, readEnum, readNumber } from '../../interno/atributos.js';
import { ControladorBucle } from '../../controladores/controlador-bucle.js';
import { ControladorTamano } from '../../controladores/controlador-tamano.js';
import { activation, ACTIVATION_BURST } from '../../efectos/hechizos/activacion.js';
import { getSpell, spellIds, registerSpell } from '../../efectos/registro.js';

/** @typedef {'low' | 'medium' | 'high'} StageQuality */
/** @typedef {import('../../efectos/efecto.js').Efecto} Efecto */

/**
 * @typedef {object} CastOptions
 * @property {number} [x=0.5] Centro del glifo, normalizado a la caja del escenario (0-1).
 * @property {number} [y=0.5]
 * @property {number} [radius=0.4] Radio del círculo, relativo al ancho de la caja.
 * @property {{ x: number, y: number }[][]} [strokes] Trazos dibujados (mismas coordenadas).
 * @property {number} [intensity=1] 0-1: potencia del hechizo (p. ej. la precisión).
 * @property {number} [stability=1] 0-1: si es baja, el efecto parpadea.
 */

/** Ajustes por calidad: partículas y densidad de píxeles. */
const QUALITY = {
  low: { density: 0.4, maxPixelRatio: 1 },
  medium: { density: 1, maxPixelRatio: 1.5 },
  high: { density: 1.8, maxPixelRatio: 2 },
};
const FOV = 35;

const styles = css`
  :host {
    display: block;
    position: relative;
    pointer-events: none;
  }
  canvas {
    position: absolute;
    inset: calc(var(--_overflow, 0.25) * -100%);
    inline-size: calc(100% * (1 + 2 * var(--_overflow, 0.25)));
    block-size: calc(100% * (1 + 2 * var(--_overflow, 0.25)));
  }
`;

/**
 * Escenario 3D donde se manifiestan los hechizos (Three.js / WebGL).
 *
 * Se coloca encima del lienzo de dibujo, con el mismo tamaño: las
 * coordenadas de `cast()` son las mismas (0-1), así el hechizo brota
 * exactamente del glifo dibujado. El lienzo WebGL es transparente y se
 * extiende más allá de la caja (`overflow`) para que las llamas o los rayos
 * puedan salir del círculo.
 *
 * Cada lanzamiento combina la secuencia de activación común (el glifo se
 * enciende, se consume y estalla) con el efecto del elemento.
 *
 * El bucle de animación solo funciona mientras hay efectos activos, y el
 * contexto WebGL se libera al quitar el componente.
 *
 * @tag gc-spell-stage
 * @summary Efectos mágicos en 3D.
 *
 * @attr {'low' | 'medium' | 'high'} quality - Partículas y resolución. Por defecto `medium`.
 * @attr {number} overflow - Cuánto se extiende el lienzo fuera de la caja por cada lado (0-1). Por defecto `0.25`.
 *
 * @prop {boolean} ready - (Solo lectura) WebGL inicializado.
 * @prop {boolean} isCasting - (Solo lectura) Hay algún hechizo en curso.
 * @prop {{ effects: number, particles: number }} stats - (Solo lectura) Efectos y partículas activos.
 *
 * @fires {CustomEvent<{}>} stage-ready - WebGL está listo.
 * @fires {CustomEvent<{reason: string}>} stage-error - No hay WebGL disponible.
 * @fires {CustomEvent<{spell: string}>} spell-cast - Empieza un hechizo.
 * @fires {CustomEvent<{spell: string}>} spell-finished - Termina un hechizo.
 *
 * @csspart canvas
 */
export class GcEscenarioHechizo extends HTMLElement {
  static tagName = 'gc-spell-stage';
  static observedAttributes = ['quality', 'overflow'];

  static define() {
    return defineElement(this.tagName, this);
  }

  /** Hechizos disponibles. */
  static get spells() {
    return spellIds();
  }

  /** Registra un hechizo propio (ver `registerSpell`). */
  static registerSpell = registerSpell;

  /** @type {THREE.WebGLRenderer | null} */
  #renderer = null;
  #scene = new THREE.Scene();
  #camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
  #sizeScale = new THREE.Uniform(1);
  /** @type {{ effect: Efecto, start: number, added: boolean, cast: number }[]} */
  #entries = [];
  /** @type {Map<number, { spell: string, remaining: number, resolve: (v: boolean) => void }>} */
  #casts = new Map();
  #nextCast = 1;
  #time = 0;
  #width = 0;
  #height = 0;
  #pixelRatio = 1;

  #loop = new ControladorBucle((dt) => this.#frame(dt));
  #resize = new ControladorTamano(this, (info) => this.#onResize(info), { maxPixelRatio: 2 });

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [baseStyles, styles];
  }

  connectedCallback() {
    // Este componente suele definirse en diferido (con Three.js): recoge las
    // propiedades que se le asignaran antes de estar definido.
    upgradeProperties(this, ['quality', 'overflow']);
    this.style.setProperty('--_overflow', String(this.overflow));
    if (!this.#renderer) this.#init();
    this.#resize.observe();
  }

  disconnectedCallback() {
    this.clear();
    this.#loop.stop();
    this.#resize.disconnect();
    // Los navegadores permiten pocos contextos WebGL: se libera al salir.
    this.#renderer?.dispose();
    this.#renderer?.forceContextLoss();
    this.#renderer?.domElement.remove();
    this.#renderer = null;
  }

  /**
   * @param {string} name
   * @param {string | null} oldValue
   * @param {string | null} newValue
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === 'overflow') this.style.setProperty('--_overflow', String(this.overflow));
    if (name === 'quality' && this.#width) this.#onResize({ width: this.#width, height: this.#height, pixelRatio: window.devicePixelRatio });
  }

  // ── Propiedades ───────────────────────────────────────────

  /** @returns {StageQuality} */
  get quality() {
    return readEnum(this, 'quality', /** @type {const} */ (['low', 'medium', 'high']), 'medium');
  }
  set quality(value) {
    this.setAttribute('quality', value);
  }

  get overflow() {
    return readNumber(this, 'overflow', { fallback: 0.25, min: 0, max: 1 });
  }
  set overflow(value) {
    this.setAttribute('overflow', String(value));
  }

  get ready() {
    return this.#renderer !== null;
  }

  get isCasting() {
    return this.#casts.size > 0;
  }

  get stats() {
    const active = this.#entries.filter((e) => e.added);
    return { effects: active.length, particles: active.reduce((sum, e) => sum + e.effect.particleCount, 0) };
  }

  // ── Métodos públicos ──────────────────────────────────────

  /**
   * Lanza un hechizo (o varios combinados) sobre el glifo dibujado.
   *
   * Con varios hechizos la activación es única (con el color del primero) y
   * todos los efectos estallan a la vez: así se combinan en el laboratorio.
   *
   * @param {string | string[]} spellId Uno o varios de `GcEscenarioHechizo.spells`.
   * @param {CastOptions} [options]
   * @returns {Promise<boolean>} Se resuelve al terminar; `false` si no hay WebGL o se pidió movimiento reducido.
   * @throws {RangeError} si el hechizo no existe.
   */
  cast(spellId, { x = 0.5, y = 0.5, radius = 0.4, strokes = [], intensity = 1, stability = 1 } = {}) {
    const ids = Array.isArray(spellId) ? spellId : [spellId];
    if (!ids.length) throw new RangeError('cast() necesita al menos un hechizo.');
    const spells = ids.map((id) => {
      const spell = getSpell(id);
      if (!spell) throw new RangeError(`Hechizo desconocido: "${id}". Disponibles: ${spellIds().join(', ')}.`);
      return spell;
    });
    const spell = spells[0];
    const label = ids.join('+');
    if (![x, y, radius, intensity, stability].every(Number.isFinite) || radius <= 0) {
      throw new TypeError('cast(): x, y, radius, intensity y stability deben ser números (radius > 0).');
    }
    if (!this.#renderer || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve(false);

    const clamp01 = (/** @type {number} */ v) => Math.min(1, Math.max(0, v));
    const aspect = this.#width && this.#height ? this.#width / this.#height : 1;
    // Caja del escenario → mundo: alto = 2 unidades, centro en el origen.
    const toWorld = (/** @type {{ x: number, y: number }} */ p) => new THREE.Vector3((p.x - 0.5) * 2 * aspect, (0.5 - p.y) * 2, 0);
    /** @type {import('../../efectos/efecto.js').SpellContext} */
    const ctx = {
      origin: toWorld({ x, y }),
      radius: radius * 2 * aspect,
      strokes: strokes.map((s) => s.filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)).map(toWorld)),
      intensity: clamp01(intensity),
      stability: clamp01(stability),
      density: QUALITY[this.quality].density,
      sizeScale: this.#sizeScale,
      color: spell.color,
      accent: spell.accent,
    };

    const id = this.#nextCast++;
    const parts = [
      { effect: activation(ctx), start: this.#time },
      ...spells.map((s) => ({
        effect: s.create({ ...ctx, color: s.color, accent: s.accent, density: ctx.density / Math.sqrt(spells.length) }),
        start: this.#time + ACTIVATION_BURST,
      })),
    ];
    for (const part of parts) this.#entries.push({ ...part, added: false, cast: id });
    emit(this, 'spell-cast', { spell: label });
    this.#loop.start();
    return new Promise((resolve) => {
      this.#casts.set(id, { spell: label, remaining: parts.length, resolve });
    });
  }

  /** Detiene y elimina todos los efectos en curso. */
  clear() {
    for (const entry of this.#entries) entry.effect.dispose();
    this.#entries = [];
    for (const [, cast] of this.#casts) cast.resolve(false);
    this.#casts.clear();
    this.#render();
  }

  // ── Interno ───────────────────────────────────────────────

  #init() {
    try {
      const canvas = document.createElement('canvas');
      canvas.setAttribute('part', 'canvas');
      canvas.setAttribute('aria-hidden', 'true');
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true });
      renderer.setClearColor(0x000000, 0);
      /** @type {ShadowRoot} */ (this.shadowRoot).append(canvas);
      this.#renderer = renderer;
      emit(this, 'stage-ready', {});
    } catch (error) {
      console.warn('[glyphcraft-kit] <gc-spell-stage> sin WebGL:', error);
      emit(this, 'stage-error', { reason: 'webgl' });
    }
  }

  /** @param {import('../../controladores/controlador-tamano.js').ResizeInfo} info */
  #onResize({ width, height, pixelRatio }) {
    this.#width = width;
    this.#height = height;
    if (!this.#renderer || !width || !height) return;
    const scale = 1 + 2 * this.overflow;
    this.#pixelRatio = Math.min(pixelRatio, QUALITY[this.quality].maxPixelRatio);
    this.#renderer.setPixelRatio(this.#pixelRatio);
    this.#renderer.setSize(width * scale, height * scale, false);
    // La caja mide 2 unidades de alto; el lienzo, `scale` veces más.
    const halfHeight = scale;
    this.#camera.aspect = width / height;
    this.#camera.position.set(0, 0, halfHeight / Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    this.#camera.lookAt(0, 0, 0);
    this.#camera.updateProjectionMatrix();
    // Píxeles reales por unidad a distancia 1 (para el tamaño de las partículas).
    this.#sizeScale.value = (height * scale * this.#pixelRatio) / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    this.#render();
  }

  /** @param {number} dt */
  #frame(dt) {
    this.#time += dt;
    for (const entry of [...this.#entries]) {
      if (this.#time < entry.start) continue;
      if (!entry.added) {
        this.#scene.add(entry.effect.group);
        entry.added = true;
      }
      const alive = entry.effect.update(this.#time - entry.start);
      if (!alive) this.#finish(entry);
    }
    this.#render();
    if (!this.#entries.length) this.#loop.stop();
  }

  /** @param {{ effect: Efecto, cast: number }} entry */
  #finish(entry) {
    entry.effect.dispose();
    this.#entries = this.#entries.filter((e) => e !== entry);
    const cast = this.#casts.get(entry.cast);
    if (!cast) return;
    cast.remaining--;
    if (cast.remaining === 0) {
      this.#casts.delete(entry.cast);
      emit(this, 'spell-finished', { spell: cast.spell });
      cast.resolve(true);
    }
  }

  #render() {
    this.#renderer?.render(this.#scene, this.#camera);
  }
}
