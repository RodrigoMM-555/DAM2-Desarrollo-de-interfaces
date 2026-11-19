import { defineElement } from '../../interno/definir.js';
import { css, baseStyles } from '../../interno/estilos.js';
import { readEnum, readNumber } from '../../interno/atributos.js';
import { ControladorBucle } from '../../controladores/controlador-bucle.js';
import { ControladorTamano } from '../../controladores/controlador-tamano.js';
import { ControladorMovimientoReducido } from '../../controladores/controlador-movimiento-reducido.js';

/** @typedef {'arcane' | 'ember' | 'frost'} BackdropPalette */

/**
 * @typedef {object} Mote Mota de polvo mágico que flota de fondo.
 * @property {number} x Posición horizontal normalizada (0-1).
 * @property {number} y Posición vertical normalizada (0-1).
 * @property {number} size Radio en píxeles CSS.
 * @property {number} depth 0 = lejos (lenta, tenue), 1 = cerca.
 * @property {number} phase Desfase para el centelleo y el balanceo.
 * @property {number} color Índice del color en la paleta.
 */

/**
 * @typedef {object} Spark Chispa de una ráfaga (`burst`).
 * @property {number} x Píxeles CSS.
 * @property {number} y Píxeles CSS.
 * @property {number} vx
 * @property {number} vy
 * @property {number} life Segundos restantes.
 * @property {number} maxLife
 * @property {number} color
 */

/** @type {readonly BackdropPalette[]} */
const PALETTES = ['arcane', 'ember', 'frost'];

/** Colores RGB por paleta (el primero es el dominante). */
/** @type {Record<BackdropPalette, [number, number, number][]>} */
const PALETTE_COLORS = {
  arcane: [[232, 198, 117], [111, 182, 255], [139, 108, 240]],
  ember: [[255, 138, 76], [232, 198, 117], [255, 92, 92]],
  frost: [[168, 230, 255], [111, 182, 255], [236, 231, 255]],
};

/** Motas por cada 10 000 px² con densidad 1. */
const MOTES_PER_AREA = 1.2;
const MAX_MOTES = 320;
const MAX_SPARKS = 400;

const styles = css`
  :host {
    display: block;
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(ellipse 80% 60% at 50% 38%, var(--_nebula), transparent 70%),
      radial-gradient(ellipse 60% 50% at 15% 85%, var(--_nebula-2), transparent 70%),
      var(--gc-color-void, #07060f);
    --_nebula: color-mix(in oklab, var(--gc-color-indigo, #2a2560) 70%, transparent);
    --_nebula-2: color-mix(in oklab, var(--gc-color-violet, #8b6cf0) 16%, transparent);
  }
  :host([palette='ember']) {
    --_nebula: color-mix(in oklab, #5a2418 70%, transparent);
    --_nebula-2: color-mix(in oklab, var(--gc-color-ember, #ff8a4c) 14%, transparent);
  }
  :host([palette='frost']) {
    --_nebula: color-mix(in oklab, #173a5c 70%, transparent);
    --_nebula-2: color-mix(in oklab, var(--gc-color-frost, #a8e6ff) 12%, transparent);
  }
  canvas {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
  }
  /* Viñeta: oscurece los bordes y centra la mirada */
  .vignette {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(ellipse at center, transparent 55%, rgb(0 0 0 / 0.55));
  }
`;

/**
 * Fondo animado de motas de polvo mágico con ráfagas de chispas.
 *
 * Usa Canvas 2D (no WebGL) para ser ligero: se reserva el único contexto
 * WebGL de la página para los efectos de hechizos. Cada color se pre-dibuja
 * una vez como "sprite" con degradado radial y luego se estampa con
 * `drawImage`, que es mucho más rápido que crear degradados en cada mota.
 *
 * Si la persona ha pedido reducir el movimiento, se dibuja un único
 * fotograma estático.
 *
 * @tag gc-arcane-backdrop
 * @summary Fondo de partículas flotantes con ráfagas de chispas.
 *
 * @attr {number} density - Densidad de motas de 0 a 1. Por defecto `0.5`.
 * @attr {'arcane' | 'ember' | 'frost'} palette - Paleta de color. Por defecto `arcane`.
 *
 * @prop {number} moteCount - (Solo lectura) Motas activas según tamaño y densidad.
 * @prop {boolean} running - (Solo lectura) `true` si la animación está en marcha.
 *
 * @csspart canvas - Lienzo de las partículas.
 */
export class GcFondoArcano extends HTMLElement {
  static tagName = 'gc-arcane-backdrop';
  static observedAttributes = ['density', 'palette'];

  /** Registra `<gc-arcane-backdrop>` si no estaba registrado. */
  static define() {
    return defineElement(this.tagName, this);
  }

  /** @type {HTMLCanvasElement} */
  #canvas;
  /** @type {CanvasRenderingContext2D} */
  #ctx;
  /** @type {Mote[]} */
  #motes = [];
  /** @type {Spark[]} */
  #sparks = [];
  /** @type {HTMLCanvasElement[]} */
  #sprites = [];
  #width = 0;
  #height = 0;
  #pixelRatio = 1;
  #time = 0;
  #paused = false;

  #loop = new ControladorBucle((dt, t) => this.#frame(dt, t));
  #resize = new ControladorTamano(this, (info) => this.#onResize(info), { maxPixelRatio: 1.5 });
  #motion = new ControladorMovimientoReducido(() => this.#syncLoop());

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [baseStyles, styles];
    root.innerHTML = '<canvas part="canvas" aria-hidden="true"></canvas><div class="vignette"></div>';
    this.#canvas = /** @type {HTMLCanvasElement} */ (root.querySelector('canvas'));
    const ctx = this.#canvas.getContext('2d');
    if (!ctx) throw new Error('<gc-arcane-backdrop> necesita Canvas 2D.');
    this.#ctx = ctx;
    this.#buildSprites();
  }

  // ── Propiedades de diseño ─────────────────────────────────

  /** @returns {number} */
  get density() {
    return readNumber(this, 'density', { fallback: 0.5, min: 0, max: 1 });
  }
  set density(value) {
    this.setAttribute('density', String(value));
  }

  /** @returns {BackdropPalette} */
  get palette() {
    return readEnum(this, 'palette', PALETTES, 'arcane');
  }
  set palette(value) {
    this.setAttribute('palette', value);
  }

  // ── Propiedades de ejecución ──────────────────────────────

  /** @returns {number} */
  get moteCount() {
    return this.#motes.length;
  }

  /** @returns {boolean} */
  get running() {
    return this.#loop.running;
  }

  // ── Ciclo de vida ─────────────────────────────────────────

  connectedCallback() {
    this.#motion.connect();
    this.#resize.observe();
    this.#syncLoop();
  }

  disconnectedCallback() {
    this.#loop.stop();
    this.#resize.disconnect();
    this.#motion.disconnect();
  }

  /**
   * @param {string} name
   * @param {string | null} oldValue
   * @param {string | null} newValue
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === 'palette') {
      this.#buildSprites();
      this.#drawStatic();
    }
    if (name === 'density') {
      this.#syncMoteCount();
      this.#drawStatic();
    }
  }

  // ── Métodos públicos ──────────────────────────────────────

  /** Congela la animación (por ejemplo, durante un hechizo exigente). */
  pause() {
    this.#paused = true;
    this.#syncLoop();
  }

  /** Reanuda la animación tras `pause()`. */
  resume() {
    this.#paused = false;
    this.#syncLoop();
  }

  /**
   * Lanza una ráfaga de chispas desde un punto de la ventana.
   *
   * Recibe coordenadas de ventana (`clientX`/`clientY`) para poder pasarle
   * directamente las de un evento de ratón o el centro de un botón.
   *
   * @param {number} clientX
   * @param {number} clientY
   * @param {{ count?: number, spread?: number }} [options]
   * @returns {number} Número de chispas creadas (0 si el movimiento está reducido).
   */
  burst(clientX, clientY, { count = 28, spread = 1 } = {}) {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      throw new TypeError('burst() necesita coordenadas numéricas.');
    }
    if (this.#motion.reduced) return 0;
    const rect = this.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const n = Math.max(0, Math.min(Math.round(count), MAX_SPARKS - this.#sparks.length));
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (40 + Math.random() * 160) * spread;
      const life = 0.6 + Math.random() * 0.9;
      this.#sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life,
        maxLife: life,
        color: Math.random() < 0.7 ? 0 : 1 + Math.floor(Math.random() * 2),
      });
    }
    return n;
  }

  // ── Interno ───────────────────────────────────────────────

  #syncLoop() {
    const shouldRun = this.isConnected && !this.#paused && !this.#motion.reduced;
    if (shouldRun) this.#loop.start();
    else {
      this.#loop.stop();
      this.#drawStatic();
    }
  }

  /** @param {import('../../controladores/controlador-tamano.js').ResizeInfo} info */
  #onResize({ width, height, pixelRatio }) {
    this.#width = width;
    this.#height = height;
    this.#pixelRatio = pixelRatio;
    this.#canvas.width = Math.round(width * pixelRatio);
    this.#canvas.height = Math.round(height * pixelRatio);
    this.#syncMoteCount();
    this.#drawStatic();
  }

  #targetMoteCount() {
    const area = this.#width * this.#height;
    return Math.min(MAX_MOTES, Math.round((area / 10000) * MOTES_PER_AREA * this.density));
  }

  #syncMoteCount() {
    const target = this.#targetMoteCount();
    if (this.#motes.length > target) this.#motes.length = target;
    while (this.#motes.length < target) this.#motes.push(this.#createMote());
  }

  /** @returns {Mote} */
  #createMote() {
    const depth = Math.random() ** 1.6; // más motas lejanas que cercanas
    return {
      x: Math.random(),
      y: Math.random(),
      size: 0.6 + depth * 2.2,
      depth,
      phase: Math.random() * Math.PI * 2,
      color: Math.random() < 0.6 ? 0 : 1 + Math.floor(Math.random() * 2),
    };
  }

  /** Pre-dibuja un sprite con halo por cada color de la paleta. */
  #buildSprites() {
    this.#sprites = PALETTE_COLORS[this.palette].map(([r, g, b]) => {
      const size = 32;
      const sprite = document.createElement('canvas');
      sprite.width = sprite.height = size;
      const c = /** @type {CanvasRenderingContext2D} */ (sprite.getContext('2d'));
      const gradient = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, `rgb(255 255 255 / 1)`);
      gradient.addColorStop(0.18, `rgb(${r} ${g} ${b} / 0.95)`);
      gradient.addColorStop(0.45, `rgb(${r} ${g} ${b} / 0.25)`);
      gradient.addColorStop(1, `rgb(${r} ${g} ${b} / 0)`);
      c.fillStyle = gradient;
      c.fillRect(0, 0, size, size);
      return sprite;
    });
  }

  /**
   * @param {number} dt
   * @param {number} time
   */
  #frame(dt, time) {
    this.#time = time;
    for (const m of this.#motes) {
      // Las motas suben despacio y se balancean; las cercanas, más rápido.
      m.y -= dt * (0.004 + m.depth * 0.018);
      m.x += Math.sin(time * 0.3 + m.phase) * dt * 0.003 * (0.4 + m.depth);
      if (m.y < -0.02) {
        m.y = 1.02;
        m.x = Math.random();
      }
    }
    for (const s of this.#sparks) {
      s.life -= dt;
      s.vx *= 1 - 1.8 * dt;
      s.vy = s.vy * (1 - 1.8 * dt) - 12 * dt; // flotan hacia arriba al frenar
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    this.#sparks = this.#sparks.filter((s) => s.life > 0);
    this.#draw();
  }

  #drawStatic() {
    if (!this.#loop.running) this.#draw();
  }

  #draw() {
    const ctx = this.#ctx;
    const pr = this.#pixelRatio;
    ctx.setTransform(pr, 0, 0, pr, 0, 0);
    ctx.clearRect(0, 0, this.#width, this.#height);
    ctx.globalCompositeOperation = 'lighter';

    for (const m of this.#motes) {
      const twinkle = 0.55 + 0.45 * Math.sin(this.#time * (0.8 + m.depth * 1.6) + m.phase);
      const radius = m.size * 4;
      ctx.globalAlpha = (0.18 + m.depth * 0.6) * twinkle;
      ctx.drawImage(
        this.#sprites[m.color],
        m.x * this.#width - radius,
        m.y * this.#height - radius,
        radius * 2,
        radius * 2,
      );
    }

    for (const s of this.#sparks) {
      const t = s.life / s.maxLife;
      const radius = 3 + 6 * t;
      ctx.globalAlpha = t;
      ctx.drawImage(this.#sprites[s.color], s.x - radius, s.y - radius, radius * 2, radius * 2);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
