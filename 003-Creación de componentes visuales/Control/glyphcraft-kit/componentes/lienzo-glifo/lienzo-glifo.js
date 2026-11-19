import { defineElement } from '../../interno/definir.js';
import { css, baseStyles } from '../../interno/estilos.js';
import { emit, readEnum, readNumber } from '../../interno/atributos.js';
import { ControladorTamano } from '../../controladores/controlador-tamano.js';

/** @typedef {'hand' | 'pointer' | 'program'} StrokeSource */
/** @typedef {{ x: number, y: number, t: number }} StrokePoint */
/**
 * @typedef {object} Stroke
 * @property {StrokePoint[]} points Puntos normalizados (0-1) con instante en ms.
 * @property {StrokeSource} source Origen del trazo.
 */

/** Distancia mínima entre puntos consecutivos (reduce ruido y memoria). */
const MIN_POINT_DISTANCE = 0.0025;
/** Longitud mínima para aceptar un trazo (descarta toques accidentales). */
const MIN_STROKE_LENGTH = 0.02;
const DEFAULT_INK = '#e8c675';
/** Colores de la corrección por trazo. */
const FEEDBACK_COLORS = { good: '#7fe0b5', fair: '#f2c36b', poor: '#ff6b7d' };
/** Opacidad de la guía según su estilo. */
const GUIDE_ALPHA = { ghost: 0.22, faint: 0.09, none: 0 };

/** @typedef {'good' | 'fair' | 'poor' | null} StrokeGrade */

const styles = css`
  :host {
    display: block;
    position: relative;
    touch-action: none;
  }
  canvas {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
  }
  :host([pointer-input]:not([readonly])) { cursor: crosshair; }
`;

/**
 * Lienzo donde se dibujan los trazos de un glifo con tinta luminosa.
 *
 * No sabe de dónde vienen los puntos: los recibe por métodos
 * (`beginStroke` / `addPoint` / `endStroke`) desde los gestos de la mano, o
 * del ratón y la pantalla táctil si `pointer-input` está activo.
 *
 * Las coordenadas son **normalizadas** (0-1 en cada eje), así los trazos no
 * dependen del tamaño en pantalla. Para glifos sin deformar, usa un
 * elemento cuadrado.
 *
 * @tag gc-glyph-canvas
 * @summary Área de dibujo de glifos.
 *
 * @attr {string} ink - Color de la tinta (cualquier color CSS). Por defecto dorado `#e8c675`.
 * @attr {number} line-width - Grosor en píxeles (1-40). Por defecto `4`.
 * @attr {number} max-strokes - Máximo de trazos (1-200). Por defecto `32`.
 * @attr {boolean} pointer-input - Permite dibujar con ratón o pantalla táctil.
 * @attr {boolean} readonly - Impide añadir trazos.
 * @attr {'ghost' | 'faint' | 'none'} guide-style - Visibilidad de la guía. Por defecto `ghost`.
 * @attr {boolean} guide-next - Resalta en la guía el siguiente trazo que toca dibujar.
 *
 * @prop {{ x: number, y: number }[][] | null} guide - (Diseño) Trazos modelo que se muestran como guía.
 * @prop {StrokeGrade[]} feedback - (Ejecución) Corrección por trazo: colorea cada trazo. Se borra al cambiar los trazos.
 *
 * @prop {Stroke[]} strokes - (Solo lectura) Copia de los trazos terminados.
 * @prop {number} strokeCount - (Solo lectura) Número de trazos terminados.
 * @prop {boolean} isDrawing - (Solo lectura) Hay un trazo en curso.
 *
 * @fires {CustomEvent<{point: StrokePoint, source: StrokeSource}>} drawing-started - Empieza un trazo.
 * @fires {CustomEvent<{stroke: Stroke | null, accepted: boolean, index: number}>} drawing-ended - Termina un trazo (rechazado si es demasiado corto).
 * @fires {CustomEvent<{count: number}>} strokes-changed - Cambia el número de trazos.
 * @fires {CustomEvent<{count: number}>} glyph-clearing - Va a borrarse todo. **Cancelable** con `preventDefault()`.
 * @fires {CustomEvent<{count: number}>} glyph-cleared - Se ha borrado todo.
 *
 * @csspart canvas - El lienzo.
 */
export class GcLienzoGlifo extends HTMLElement {
  static tagName = 'gc-glyph-canvas';
  static observedAttributes = ['ink', 'line-width', 'guide-style', 'guide-next'];

  static define() {
    return defineElement(this.tagName, this);
  }

  /** @type {HTMLCanvasElement} */
  #canvas;
  /** @type {CanvasRenderingContext2D} */
  #ctx;
  /** @type {Stroke[]} */
  #strokes = [];
  /** @type {Stroke | null} */
  #current = null;
  #width = 0;
  #height = 0;
  #pixelRatio = 1;
  #drawRequest = 0;
  #pointerId = -1;
  #clearing = false;
  /** @type {{ x: number, y: number }[][] | null} */
  #guide = null;
  /** @type {StrokeGrade[]} */
  #feedback = [];

  #resize = new ControladorTamano(this, ({ width, height, pixelRatio }) => {
    this.#width = width;
    this.#height = height;
    this.#pixelRatio = pixelRatio;
    this.#canvas.width = Math.round(width * pixelRatio);
    this.#canvas.height = Math.round(height * pixelRatio);
    this.#draw();
  });

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [baseStyles, styles];
    root.innerHTML = '<canvas part="canvas"></canvas>';
    this.#canvas = /** @type {HTMLCanvasElement} */ (root.querySelector('canvas'));
    this.#ctx = /** @type {CanvasRenderingContext2D} */ (this.#canvas.getContext('2d'));

    this.addEventListener('pointerdown', this.#onPointerDown);
    this.addEventListener('pointermove', this.#onPointerMove);
    this.addEventListener('pointerup', this.#onPointerUp);
    this.addEventListener('pointercancel', this.#onPointerUp);
  }

  connectedCallback() {
    if (!this.hasAttribute('role')) this.setAttribute('role', 'img');
    this.#updateLabel();
    this.#resize.observe();
  }

  disconnectedCallback() {
    this.#resize.disconnect();
    cancelAnimationFrame(this.#drawRequest);
    this.#drawRequest = 0;
  }

  attributeChangedCallback() {
    this.#requestDraw();
  }

  // ── Propiedades de diseño ─────────────────────────────────

  get ink() {
    return this.getAttribute('ink') || DEFAULT_INK;
  }
  set ink(value) {
    this.setAttribute('ink', value);
  }

  get lineWidth() {
    return readNumber(this, 'line-width', { fallback: 4, min: 1, max: 40 });
  }
  set lineWidth(value) {
    this.setAttribute('line-width', String(value));
  }

  get maxStrokes() {
    return Math.round(readNumber(this, 'max-strokes', { fallback: 32, min: 1, max: 200 }));
  }
  set maxStrokes(value) {
    this.setAttribute('max-strokes', String(value));
  }

  get pointerInput() {
    return this.hasAttribute('pointer-input');
  }
  set pointerInput(value) {
    this.toggleAttribute('pointer-input', Boolean(value));
  }

  get readonly() {
    return this.hasAttribute('readonly');
  }
  set readonly(value) {
    this.toggleAttribute('readonly', Boolean(value));
    if (value) this.cancelStroke();
  }

  get guideStyle() {
    return readEnum(this, 'guide-style', /** @type {const} */ (['ghost', 'faint', 'none']), 'ghost');
  }
  set guideStyle(value) {
    this.setAttribute('guide-style', value);
  }

  get guideNext() {
    return this.hasAttribute('guide-next');
  }
  set guideNext(value) {
    this.toggleAttribute('guide-next', Boolean(value));
  }

  /** @returns {{ x: number, y: number }[][] | null} */
  get guide() {
    return this.#guide ? this.#guide.map((s) => s.map((p) => ({ ...p }))) : null;
  }
  set guide(value) {
    if (value !== null && !(Array.isArray(value) && value.every((s) => Array.isArray(s) && s.every((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y))))) {
      throw new TypeError('<gc-glyph-canvas>.guide necesita un array de trazos { x, y }[] o null.');
    }
    this.#guide = value ? value.map((s) => s.map((p) => ({ x: p.x, y: p.y }))) : null;
    this.#requestDraw();
  }

  // ── Propiedades de ejecución ──────────────────────────────

  /** @returns {StrokeGrade[]} */
  get feedback() {
    return [...this.#feedback];
  }
  set feedback(value) {
    const valid = ['good', 'fair', 'poor', null];
    this.#feedback = Array.isArray(value) ? value.map((g) => (valid.includes(g) ? g : null)) : [];
    this.#requestDraw();
  }

  /** @returns {Stroke[]} */
  get strokes() {
    return this.#strokes.map((s) => ({ source: s.source, points: s.points.map((p) => ({ ...p })) }));
  }

  get strokeCount() {
    return this.#strokes.length;
  }

  get isDrawing() {
    return this.#current !== null;
  }

  // ── Métodos públicos ──────────────────────────────────────

  /**
   * Empieza un trazo.
   * @param {{ x: number, y: number }} point Normalizado (0-1).
   * @param {{ source?: StrokeSource }} [options]
   * @returns {boolean} `false` si no se puede dibujar (solo lectura, límite alcanzado o borrando).
   */
  beginStroke(point, { source = 'program' } = {}) {
    const p = GcLienzoGlifo.#toPoint(point);
    if (this.readonly || this.#clearing || this.#strokes.length >= this.maxStrokes) return false;
    if (this.#current) this.endStroke();
    if (this.#feedback.length) this.#feedback = [];
    this.#current = { source, points: [p] };
    emit(this, 'drawing-started', { point: { ...p }, source });
    this.#requestDraw();
    return true;
  }

  /**
   * Añade un punto al trazo en curso. Los puntos casi idénticos al anterior se ignoran.
   * @param {{ x: number, y: number }} point
   * @returns {boolean} `false` si no hay trazo en curso o el punto se ha ignorado.
   */
  addPoint(point) {
    if (!this.#current) return false;
    const p = GcLienzoGlifo.#toPoint(point);
    const last = this.#current.points.at(-1);
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < MIN_POINT_DISTANCE) return false;
    this.#current.points.push(p);
    this.#requestDraw();
    return true;
  }

  /**
   * Termina el trazo en curso. Si es demasiado corto, se descarta.
   * @returns {Stroke | null} El trazo aceptado, o `null`.
   */
  endStroke() {
    const stroke = this.#current;
    if (!stroke) return null;
    this.#current = null;
    const accepted = GcLienzoGlifo.strokeLength(stroke.points) >= MIN_STROKE_LENGTH;
    if (accepted) this.#strokes.push(stroke);
    this.#requestDraw();
    const copy = accepted ? this.strokes.at(-1) ?? null : null;
    emit(this, 'drawing-ended', { stroke: copy, accepted, index: accepted ? this.#strokes.length - 1 : -1 });
    if (accepted) this.#changed();
    return copy;
  }

  /** Descarta el trazo en curso sin guardarlo. */
  cancelStroke() {
    if (!this.#current) return;
    this.#current = null;
    this.#requestDraw();
  }

  /**
   * Elimina el último trazo.
   * @returns {boolean} `false` si no había trazos.
   */
  undo() {
    if (this.#current) {
      this.cancelStroke();
      return true;
    }
    if (!this.#strokes.length) return false;
    this.#strokes.pop();
    this.#requestDraw();
    this.#changed();
    return true;
  }

  /**
   * Borra todos los trazos, con un desvanecimiento opcional.
   * Emite `glyph-clearing` antes (cancelable) y `glyph-cleared` después.
   *
   * @param {{ animated?: boolean }} [options]
   * @returns {Promise<boolean>} `false` si se canceló o no había nada que borrar.
   */
  async clear({ animated = true } = {}) {
    const count = this.#strokes.length + (this.#current ? 1 : 0);
    if (count === 0 || this.#clearing) return false;
    if (!emit(this, 'glyph-clearing', { count }, { cancelable: true })) return false;

    this.#clearing = true;
    this.#current = null;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (animated && !reduced) {
      await this.#canvas.animate(
        [
          { opacity: 1, filter: 'blur(0)' },
          { opacity: 0, filter: 'blur(6px)' },
        ],
        { duration: 450, easing: 'ease-in' },
      ).finished.catch(() => {});
    }
    this.#strokes = [];
    this.#clearing = false;
    this.#draw();
    emit(this, 'glyph-cleared', { count });
    this.#changed();
    return true;
  }

  /**
   * Sustituye los trazos (por ejemplo, para restaurar un dibujo guardado).
   * @param {Stroke[]} strokes
   * @throws {TypeError} si el formato no es válido.
   */
  loadStrokes(strokes) {
    if (!Array.isArray(strokes)) throw new TypeError('loadStrokes necesita un array de trazos.');
    const parsed = strokes.slice(0, this.maxStrokes).map((s) => {
      if (!Array.isArray(s?.points) || s.points.length === 0) throw new TypeError('Cada trazo necesita "points".');
      return { source: s.source ?? 'program', points: s.points.map((p) => GcLienzoGlifo.#toPoint(p, p.t)) };
    });
    this.#current = null;
    this.#strokes = parsed;
    this.#requestDraw();
    this.#changed();
  }

  /** Datos serializables del dibujo. */
  toJSON() {
    return { strokes: this.strokes };
  }

  /**
   * Longitud de un trazo (en unidades normalizadas).
   * @param {{ x: number, y: number }[]} points
   */
  static strokeLength(points) {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return length;
  }

  // ── Interno ───────────────────────────────────────────────

  /**
   * Valida y normaliza un punto.
   * @param {{ x: number, y: number }} point
   * @param {number} [t]
   * @returns {StrokePoint}
   */
  static #toPoint(point, t = performance.now()) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      throw new TypeError('Los puntos necesitan coordenadas numéricas { x, y }.');
    }
    const clamp = (/** @type {number} */ v) => Math.min(1, Math.max(0, v));
    return { x: clamp(point.x), y: clamp(point.y), t: Number.isFinite(t) ? t : performance.now() };
  }

  #changed() {
    this.#feedback = [];
    this.#updateLabel();
    emit(this, 'strokes-changed', { count: this.#strokes.length });
  }

  #updateLabel() {
    const n = this.#strokes.length;
    this.setAttribute('aria-label', n === 0 ? 'Lienzo de glifos vacío' : `Lienzo de glifos con ${n} ${n === 1 ? 'trazo' : 'trazos'}`);
  }

  /** @param {PointerEvent} event */
  #normalize(event) {
    const rect = this.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  }

  /** @param {PointerEvent} event */
  #onPointerDown = (event) => {
    if (!this.pointerInput || this.readonly || event.button !== 0 || this.#pointerId !== -1) return;
    if (!this.beginStroke(this.#normalize(event), { source: 'pointer' })) return;
    this.#pointerId = event.pointerId;
    this.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  /** @param {PointerEvent} event */
  #onPointerMove = (event) => {
    if (event.pointerId !== this.#pointerId) return;
    // Los eventos "coalesced" recuperan los puntos intermedios entre fotogramas.
    const events = event.getCoalescedEvents?.() ?? [event];
    for (const e of events.length ? events : [event]) this.addPoint(this.#normalize(e));
  };

  /** @param {PointerEvent} event */
  #onPointerUp = (event) => {
    if (event.pointerId !== this.#pointerId) return;
    this.#pointerId = -1;
    this.endStroke();
  };

  #requestDraw() {
    if (this.#drawRequest) return;
    this.#drawRequest = requestAnimationFrame(() => {
      this.#drawRequest = 0;
      this.#draw();
    });
  }

  #draw() {
    const ctx = this.#ctx;
    ctx.setTransform(this.#pixelRatio, 0, 0, this.#pixelRatio, 0, 0);
    ctx.clearRect(0, 0, this.#width, this.#height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this.#drawGuide();
    ctx.globalCompositeOperation = 'lighter';
    this.#strokes.forEach((stroke, i) => this.#drawStroke(stroke, false, this.#feedback[i] ?? null));
    if (this.#current) this.#drawStroke(this.#current, true, null);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  /** Guía: trazos modelo discontinuos; el siguiente, más visible y con su inicio marcado. */
  #drawGuide() {
    const alpha = GUIDE_ALPHA[this.guideStyle];
    if (!this.#guide || alpha === 0) return;
    const ctx = this.#ctx;
    const next = this.guideNext ? this.#strokes.length + (this.#current ? 1 : 0) : -1;
    ctx.save();
    ctx.strokeStyle = this.ink;
    ctx.lineWidth = Math.max(1.5, this.lineWidth * 0.6);
    ctx.setLineDash([this.lineWidth * 1.5, this.lineWidth * 1.8]);
    this.#guide.forEach((points, i) => {
      if (points.length < 2) return;
      ctx.globalAlpha = i === next ? Math.min(0.75, alpha * 3) : alpha;
      ctx.beginPath();
      ctx.moveTo(points[0].x * this.#width, points[0].y * this.#height);
      for (const p of points.slice(1)) ctx.lineTo(p.x * this.#width, p.y * this.#height);
      ctx.stroke();
      if (i === next) {
        ctx.fillStyle = this.ink;
        ctx.beginPath();
        ctx.arc(points[0].x * this.#width, points[0].y * this.#height, this.lineWidth * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();
  }

  /**
   * Dibuja un trazo en dos pasadas: halo ancho y tenue + núcleo brillante.
   * Las curvas pasan por los puntos medios entre muestras para suavizarlo.
   * @param {Stroke} stroke
   * @param {boolean} live
   * @param {StrokeGrade} grade Corrección (cambia el color de la tinta).
   */
  #drawStroke(stroke, live, grade) {
    const ctx = this.#ctx;
    const pts = stroke.points.map((p) => ({ x: p.x * this.#width, y: p.y * this.#height }));
    const width = this.lineWidth;
    const path = new Path2D();
    path.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 1) path.lineTo(pts[0].x + 0.01, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      path.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    const end = pts[pts.length - 1];
    if (pts.length > 1) path.lineTo(end.x, end.y);

    const ink = grade ? FEEDBACK_COLORS[grade] : this.ink;
    ctx.strokeStyle = ink;
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = width * 3.5;
    ctx.stroke(path);
    ctx.globalAlpha = live ? 1 : 0.9;
    ctx.lineWidth = width;
    ctx.stroke(path);
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = '#fff8e6';
    ctx.lineWidth = Math.max(1, width * 0.35);
    ctx.stroke(path);

    if (live) {
      const tip = end;
      const glow = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, width * 4);
      glow.addColorStop(0, '#ffffff');
      glow.addColorStop(0.35, ink);
      glow.addColorStop(1, 'transparent');
      ctx.globalAlpha = 1;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, width * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
