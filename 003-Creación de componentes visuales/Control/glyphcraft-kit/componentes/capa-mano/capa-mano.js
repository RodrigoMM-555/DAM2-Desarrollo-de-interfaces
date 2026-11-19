import { defineElement } from '../../interno/definir.js';
import { css, baseStyles } from '../../interno/estilos.js';
import { emit, readEnum } from '../../interno/atributos.js';
import { ControladorTamano } from '../../controladores/controlador-tamano.js';
import { HAND_CONNECTIONS, FINGERTIPS, LANDMARK_COUNT } from '../../nucleo/gestos/puntos-mano.js';

/** @typedef {import('../../nucleo/gestos/motor-gestos.js').HandFrame} HandFrame */
/** @typedef {import('../../nucleo/gestos/motor-gestos.js').HandGestureState} HandGestureState */
/** @typedef {'skeleton' | 'constellation' | 'minimal'} OverlayVariant */
/** @typedef {{ x: number, y: number, width: number, height: number }} Rect */

/**
 * Estado de gesto de una mano (formato de `MotorGestos.getSnapshot().hands`).
 * @typedef {object} HandGestureInfo
 * @property {string} id
 * @property {HandGestureState} state
 * @property {number} progress
 * @property {{ x: number, y: number } | null} point
 * @property {number} [frameIndex] Posición de la mano en el fotograma (para emparejarla).
 */

/** @type {Record<HandGestureState, string>} */
const STATE_COLORS = {
  idle: '#6fb6ff',
  pointing: '#ece7ff',
  drawing: '#e8c675',
  erasing: '#ff6b7d',
  sealing: '#8b6cf0',
};

const FULL_REGION = Object.freeze({ x: 0, y: 0, width: 1, height: 1 });
/** Tiempo sin manos antes de emitir `hand-lost` (evita parpadeos). */
const LOST_DELAY_MS = 300;

const styles = css`
  :host {
    display: block;
    position: relative;
    pointer-events: none;
  }
  canvas {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
  }
`;

/**
 * Dibuja las manos detectadas: puntos de referencia, articulaciones,
 * conexiones y el estado del gesto (color, anillo de progreso, cursor).
 *
 * Sirve para que la persona entienda qué está viendo el programa y corrija
 * su postura. Puede colocarse:
 * - encima de `<gc-camera-preview>` (mismo `fit` y `mirror`);
 * - sobre el lienzo de dibujo, mostrando solo una `region` de la imagen
 *   (la zona calibrada) con `fit="fill"`.
 *
 * @tag gc-hand-overlay
 * @summary Visualización de manos y gestos.
 *
 * @attr {'skeleton' | 'constellation' | 'minimal'} variant - Estilo: esqueleto, constelación o mínimo. Por defecto `skeleton`.
 * @attr {'on' | 'off'} mirror - Dibujar en espejo. Por defecto `on`.
 * @attr {'cover' | 'contain' | 'fill'} fit - Ajuste de la imagen a la caja. Por defecto `cover`.
 *
 * @prop {HandFrame | null} frame - (Ejecución) Último fotograma de manos.
 * @prop {HandGestureInfo[]} gestures - (Ejecución) Estado de gesto de cada mano.
 * @prop {Rect} region - (Diseño) Parte de la imagen que se muestra, normalizada. Por defecto toda.
 * @prop {Rect | null} guide - (Diseño) Rectángulo guía (p. ej. zona de trazado), normalizado a la imagen.
 * @prop {number} handCount - (Solo lectura) Manos en el último fotograma.
 *
 * @fires {CustomEvent<{count: number, handedness: string[]}>} hand-detected - Aparecen manos tras no haber ninguna.
 * @fires {CustomEvent<{}>} hand-lost - Dejan de verse manos durante 300 ms.
 *
 * @csspart canvas - Lienzo de dibujo.
 */
export class GcCapaMano extends HTMLElement {
  static tagName = 'gc-hand-overlay';
  static observedAttributes = ['variant', 'mirror', 'fit'];

  static define() {
    return defineElement(this.tagName, this);
  }

  /** @type {HTMLCanvasElement} */
  #canvas;
  /** @type {CanvasRenderingContext2D} */
  #ctx;
  /** @type {HandFrame | null} */
  #frame = null;
  /** @type {HandGestureInfo[]} */
  #gestures = [];
  /** @type {Rect} */
  #region = FULL_REGION;
  /** @type {Rect | null} */
  #guide = null;
  #width = 0;
  #height = 0;
  #pixelRatio = 1;
  #frameRequest = 0;
  #present = false;
  #lastSeen = 0;

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
    root.innerHTML = '<canvas part="canvas" aria-hidden="true"></canvas>';
    this.#canvas = /** @type {HTMLCanvasElement} */ (root.querySelector('canvas'));
    this.#ctx = /** @type {CanvasRenderingContext2D} */ (this.#canvas.getContext('2d'));
  }

  connectedCallback() {
    this.#resize.observe();
  }

  disconnectedCallback() {
    this.#resize.disconnect();
    cancelAnimationFrame(this.#frameRequest);
    this.#frameRequest = 0;
  }

  attributeChangedCallback() {
    this.#requestDraw();
  }

  // ── Propiedades de diseño ─────────────────────────────────

  /** @returns {OverlayVariant} */
  get variant() {
    return readEnum(this, 'variant', /** @type {const} */ (['skeleton', 'constellation', 'minimal']), 'skeleton');
  }
  set variant(value) {
    this.setAttribute('variant', value);
  }

  get mirror() {
    return readEnum(this, 'mirror', /** @type {const} */ (['on', 'off']), 'on');
  }
  set mirror(value) {
    this.setAttribute('mirror', value);
  }

  get fit() {
    return readEnum(this, 'fit', /** @type {const} */ (['cover', 'contain', 'fill']), 'cover');
  }
  set fit(value) {
    this.setAttribute('fit', value);
  }

  /** @returns {Rect} */
  get region() {
    return { ...this.#region };
  }
  set region(value) {
    this.#region = GcCapaMano.validateRect(value, 'region') ?? FULL_REGION;
    this.#requestDraw();
  }

  /** @returns {Rect | null} */
  get guide() {
    return this.#guide ? { ...this.#guide } : null;
  }
  set guide(value) {
    this.#guide = value === null ? null : GcCapaMano.validateRect(value, 'guide');
    this.#requestDraw();
  }

  // ── Propiedades de ejecución ──────────────────────────────

  get frame() {
    return this.#frame;
  }
  set frame(value) {
    if (value !== null && (!value || !Array.isArray(value.hands))) {
      throw new TypeError('<gc-hand-overlay>.frame necesita un HandFrame o null.');
    }
    this.#frame = value;
    this.#trackPresence(value);
    this.#requestDraw();
  }

  get gestures() {
    return this.#gestures.map((g) => ({ ...g }));
  }
  set gestures(value) {
    this.#gestures = Array.isArray(value) ? value : [];
    this.#requestDraw();
  }

  get handCount() {
    return this.#frame?.hands.length ?? 0;
  }

  // ── Métodos públicos ──────────────────────────────────────

  /**
   * Convierte un punto normalizado de la imagen a píxeles de este elemento,
   * aplicando `region`, `fit` y `mirror`. Útil para alinear otras capas.
   * @param {{ x: number, y: number }} point
   * @returns {{ x: number, y: number }}
   */
  projectPoint(point) {
    return this.#project(point);
  }

  /** Borra el dibujo y olvida el último fotograma. */
  clear() {
    this.#frame = null;
    this.#gestures = [];
    this.#draw();
  }

  /**
   * Comprueba que un rectángulo normalizado es válido.
   * @param {unknown} value
   * @param {string} name
   * @returns {Rect}
   */
  static validateRect(value, name) {
    const r = /** @type {Rect} */ (value);
    const ok =
      r && [r.x, r.y, r.width, r.height].every(Number.isFinite) && r.width > 0 && r.height > 0;
    if (!ok) throw new TypeError(`<gc-hand-overlay>.${name} necesita { x, y, width, height } con tamaño positivo.`);
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }

  // ── Interno ───────────────────────────────────────────────

  /** @param {HandFrame | null} frame */
  #trackPresence(frame) {
    const count = frame?.hands.length ?? 0;
    const now = performance.now();
    if (count > 0) {
      this.#lastSeen = now;
      if (!this.#present) {
        this.#present = true;
        emit(this, 'hand-detected', { count, handedness: frame?.hands.map((h) => h.handedness) ?? [] });
      }
    } else if (this.#present && now - this.#lastSeen > LOST_DELAY_MS) {
      this.#present = false;
      emit(this, 'hand-lost', {});
    }
  }

  #requestDraw() {
    if (this.#frameRequest) return;
    this.#frameRequest = requestAnimationFrame(() => {
      this.#frameRequest = 0;
      this.#draw();
    });
  }

  /**
   * Convierte un punto normalizado de la imagen a píxeles del lienzo.
   * @param {{ x: number, y: number }} p
   */
  #project(p) {
    const r = this.#region;
    const imgW = this.#frame?.imageWidth ?? 640;
    const imgH = this.#frame?.imageHeight ?? 480;
    const u = (p.x - r.x) / r.width;
    const v = (p.y - r.y) / r.height;
    const W = this.#width;
    const H = this.#height;
    let dw = W;
    let dh = H;
    if (this.fit !== 'fill') {
      const contentW = r.width * imgW;
      const contentH = r.height * imgH;
      const s = this.fit === 'cover' ? Math.max(W / contentW, H / contentH) : Math.min(W / contentW, H / contentH);
      dw = contentW * s;
      dh = contentH * s;
    }
    let x = (W - dw) / 2 + u * dw;
    const y = (H - dh) / 2 + v * dh;
    if (this.mirror === 'on') x = W - x;
    return { x, y };
  }

  #draw() {
    const ctx = this.#ctx;
    ctx.setTransform(this.#pixelRatio, 0, 0, this.#pixelRatio, 0, 0);
    ctx.clearRect(0, 0, this.#width, this.#height);
    if (this.#guide) this.#drawGuide(this.#guide);
    if (!this.#frame) return;

    this.#frame.hands.forEach((hand, index) => {
      if (hand.landmarks?.length !== LANDMARK_COUNT) return;
      // Se empareja por posición en el fotograma (el motor sigue las manos por
      // continuidad); si no se indica, por la etiqueta de la mano.
      const gesture =
        this.#gestures.find((g) => g.frameIndex === index) ??
        this.#gestures.find((g) => g.frameIndex === undefined && g.id === hand.handedness);
      const color = STATE_COLORS[gesture?.state ?? 'idle'];
      const points = hand.landmarks.map((p) => this.#project(p));
      this.#drawHand(points, color);
      if (gesture) this.#drawGesture(gesture, points, color);
    });
  }

  /**
   * @param {{ x: number, y: number }[]} pts
   * @param {string} color
   */
  #drawHand(pts, color) {
    const ctx = this.#ctx;
    const variant = this.variant;
    const scale = Math.hypot(pts[0].x - pts[9].x, pts[0].y - pts[9].y) / 60 || 1;

    if (variant !== 'minimal') {
      ctx.strokeStyle = color;
      ctx.globalAlpha = variant === 'skeleton' ? 0.85 : 0.35;
      ctx.lineWidth = variant === 'skeleton' ? 2 : 1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.moveTo(pts[a].x, pts[a].y);
        ctx.lineTo(pts[b].x, pts[b].y);
      }
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    pts.forEach((p, i) => {
      const isTip = FINGERTIPS.includes(i);
      if (variant === 'minimal' && !isTip) return;
      const r = (isTip ? 4.5 : 2.8) * Math.min(1.6, Math.max(0.7, scale));
      if (variant === 'constellation') {
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3.2);
        glow.addColorStop(0, '#ffffff');
        glow.addColorStop(0.25, color);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 3.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = isTip ? '#ffffff' : color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        if (isTip) ctx.stroke();
      }
    });
  }

  /**
   * Indicadores del gesto: anillo de progreso (borrar/sellar) o cursor.
   * @param {HandGestureInfo} gesture
   * @param {{ x: number, y: number }[]} pts
   * @param {string} color
   */
  #drawGesture(gesture, pts, color) {
    const ctx = this.#ctx;
    if ((gesture.state === 'erasing' || gesture.state === 'sealing') && gesture.progress > 0) {
      const palm = [0, 5, 9, 13, 17].map((i) => pts[i]);
      const cx = palm.reduce((s, p) => s + p.x, 0) / palm.length;
      const cy = palm.reduce((s, p) => s + p.y, 0) / palm.length;
      const radius = Math.hypot(pts[0].x - pts[9].x, pts[0].y - pts[9].y) * 1.15;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgb(255 255 255 / 0.15)';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + gesture.progress * Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    if ((gesture.state === 'drawing' || gesture.state === 'pointing') && gesture.point) {
      const p = this.#project(gesture.point);
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 18);
      glow.addColorStop(0, '#ffffff');
      glow.addColorStop(0.3, color);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** @param {Rect} rect */
  #drawGuide(rect) {
    const a = this.#project({ x: rect.x, y: rect.y });
    const b = this.#project({ x: rect.x + rect.width, y: rect.y + rect.height });
    const ctx = this.#ctx;
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgb(232 198 117 / 0.75)';
    ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    ctx.restore();
  }
}
