import { computeHandFeatures } from './rasgos-mano.js';
import { FiltroPunto } from '../filtros/filtro-un-euro.js';
import { clamp } from '../geometria/vector.js';

/** @typedef {import('./rasgos-mano.js').TrackedHand} TrackedHand */
/** @typedef {import('./rasgos-mano.js').HandFeatures} HandFeatures */

/**
 * Fotograma con las manos detectadas.
 *
 * @typedef {object} HandFrame
 * @property {number} timestamp Milisegundos (monótono).
 * @property {number} [imageWidth] Ancho de la imagen analizada en píxeles.
 * @property {number} [imageHeight] Alto de la imagen analizada en píxeles.
 * @property {TrackedHand[]} hands
 */

/** @typedef {'idle' | 'drawing' | 'erasing' | 'sealing' | 'pointing'} HandGestureState */
/** @typedef {'none' | HandGestureState} GestureState */
/** @typedef {'any' | 'Left' | 'Right'} WritingHand */
/** @typedef {'point' | 'pinch'} DrawGesture */

/**
 * @typedef {object} GestureConfig
 * @property {DrawGesture} drawGesture Gesto para dibujar: `point` (índice levantado, resto recogido) o `pinch` (pinza).
 * @property {number} pointKeep Extensión mínima del índice para **seguir** dibujando (más permisiva que para empezar).
 * @property {number} curlKeep Extensión máxima del resto de dedos para seguir dibujando.
 * @property {number} pinchStart (Modo pinza) Proporción pulgar-índice/palma por debajo de la cual empieza.
 * @property {number} pinchEnd (Modo pinza) Proporción por encima de la cual termina (histéresis: > pinchStart).
 * @property {number} framesToStart Fotogramas seguidos con el gesto para empezar a dibujar.
 * @property {number} framesToEnd Fotogramas seguidos sin el gesto para terminar el trazo.
 * @property {number} lostGraceMs Tiempo que se tolera perder la mano sin cortar el trazo.
 * @property {number} eraseHoldMs Tiempo con la palma abierta para borrar.
 * @property {number} sealHoldMs Tiempo con el puño cerrado para sellar.
 * @property {number} commandCooldownMs Pausa tras borrar o sellar antes de aceptar otra orden.
 * @property {number} minScore Confianza mínima de lateralidad (izquierda/derecha). MediaPipe ya filtra la presencia de la mano; por defecto 0 (no se filtra).
 * @property {number} ratioSmoothing Suavizado de la medida de la pinza (0 = ninguno, 0,9 = mucho).
 * @property {WritingHand} writingHand Mano que puede dibujar (`any` = cualquiera).
 * @property {{ minCutoff: number, beta: number }} smoothing Parámetros del filtro One Euro.
 */

/** Configuración predeterminada. */
export const DEFAULT_GESTURE_CONFIG = Object.freeze({
  drawGesture: /** @type {DrawGesture} */ ('point'),
  pointKeep: 1.02,
  curlKeep: 1.08,
  pinchStart: 0.3,
  pinchEnd: 0.55,
  framesToStart: 2,
  framesToEnd: 4,
  lostGraceMs: 350,
  eraseHoldMs: 800,
  sealHoldMs: 600,
  commandCooldownMs: 1000,
  minScore: 0,
  ratioSmoothing: 0.4,
  writingHand: /** @type {WritingHand} */ ('any'),
  smoothing: Object.freeze({ minCutoff: 1.5, beta: 6 }),
});

/** Prioridad para resumir varias manos en un único estado. */
const PRIORITY = /** @type {const} */ (['none', 'idle', 'pointing', 'sealing', 'erasing', 'drawing']);

/**
 * @typedef {object} HandRecord
 * @property {string} id
 * @property {'Left' | 'Right'} handedness
 * @property {HandGestureState} state
 * @property {number} lastSeen
 * @property {number} startFrames
 * @property {number} releaseFrames
 * @property {number | null} holdStart
 * @property {number} progress
 * @property {'erasing' | 'sealing' | null} latched Orden ya ejecutada; no se repite hasta soltar el gesto.
 * @property {{ x: number, y: number } | null} point
 * @property {FiltroPunto} filter
 * @property {HandFeatures | null} features
 * @property {number | null} ratio Medida de la pinza suavizada (modo pinza).
 * @property {{ x: number, y: number } | null} palm Último centro de la palma (para seguir la mano).
 * @property {number} frameIndex Posición de la mano en el último fotograma (-1 si no está).
 */

/** Distancia máxima (normalizada) que puede saltar una palma entre fotogramas y seguir siendo la misma mano. */
const MAX_PALM_JUMP = 0.25;

/**
 * Convierte fotogramas de manos en gestos.
 *
 * No sabe nada de cámaras ni de dibujo: recibe {@link HandFrame} con
 * `update()` y emite eventos. Por eso se puede probar con datos simulados y
 * reutilizar con cualquier fuente de manos.
 *
 * Gestos:
 * - **Índice levantado** (resto de dedos recogidos): dibujar con la punta
 *   del índice. `draw-start` → `draw-move`… → `draw-end`.
 *   (Con `drawGesture: 'pinch'` se dibuja con la pinza y señalar mueve un cursor: `pointer-move`.)
 * - **Mano bien abierta** mantenida: borrar. `erase-progress` → `erase`.
 * - **Puño bien cerrado** mantenido: sellar el glifo. `seal-progress` → `seal`.
 *
 * Protecciones contra activaciones accidentales:
 * - Histéresis: empezar a dibujar exige un gesto más claro que seguir dibujando.
 * - Varios fotogramas seguidos para empezar y terminar un trazo.
 * - Si la mano se pierde menos de `lostGraceMs`, el trazo continúa.
 * - Borrar y sellar exigen mantener el gesto; se cancelan al soltarlo.
 * - Nadie puede borrar ni sellar mientras alguna mano dibuja.
 * - Tras una orden hay una pausa y hay que deshacer el gesto para repetirla.
 *
 * @fires gesture-changed - `{ hand, state, previous, overall }`
 * @fires draw-start - `{ hand, point, timestamp }`
 * @fires draw-move - `{ hand, point, timestamp }`
 * @fires draw-end - `{ hand, point, timestamp, reason: 'released' | 'lost' | 'reset' }`
 * @fires erase-progress - `{ hand, progress, timestamp }` (progress 0 = cancelado)
 * @fires erase - `{ hand, timestamp }`
 * @fires seal-progress - `{ hand, progress, timestamp }`
 * @fires seal - `{ hand, timestamp }`
 * @fires pointer-move - `{ hand, point, timestamp }`
 * @fires hands-changed - `{ count, hands }`
 */
export class MotorGestos extends EventTarget {
  /** @type {GestureConfig} */
  #config;
  /** @type {Map<string, HandRecord>} */
  #hands = new Map();
  #cooldownUntil = -Infinity;
  #lastTimestamp = -Infinity;

  /** @param {Partial<GestureConfig>} [config] */
  constructor(config = {}) {
    super();
    this.#config = MotorGestos.validateConfig({ ...DEFAULT_GESTURE_CONFIG, ...config });
  }

  /**
   * Comprueba una configuración completa y la devuelve congelada.
   * @param {GestureConfig} config
   * @returns {GestureConfig}
   * @throws {RangeError}
   */
  static validateConfig(config) {
    const positive = ['pointKeep', 'curlKeep', 'pinchStart', 'pinchEnd', 'framesToStart', 'framesToEnd', 'eraseHoldMs', 'sealHoldMs'];
    for (const key of positive) {
      const value = /** @type {Record<string, unknown>} */ (config)[key];
      if (typeof value !== 'number' || !(value > 0)) throw new RangeError(`MotorGestos: "${key}" debe ser un número > 0.`);
    }
    for (const key of ['lostGraceMs', 'commandCooldownMs', 'minScore', 'ratioSmoothing']) {
      const value = /** @type {Record<string, unknown>} */ (config)[key];
      if (typeof value !== 'number' || !(value >= 0)) throw new RangeError(`MotorGestos: "${key}" debe ser un número >= 0.`);
    }
    if (!['point', 'pinch'].includes(config.drawGesture)) {
      throw new RangeError('MotorGestos: "drawGesture" debe ser "point" o "pinch".');
    }
    if (config.pinchEnd <= config.pinchStart) {
      throw new RangeError('MotorGestos: "pinchEnd" debe ser mayor que "pinchStart" (histéresis).');
    }
    if (config.ratioSmoothing >= 1) throw new RangeError('MotorGestos: "ratioSmoothing" debe ser < 1.');
    if (!['any', 'Left', 'Right'].includes(config.writingHand)) {
      throw new RangeError('MotorGestos: "writingHand" debe ser "any", "Left" o "Right".');
    }
    const { minCutoff, beta } = config.smoothing ?? {};
    if (!(minCutoff > 0) || !(beta >= 0)) throw new RangeError('MotorGestos: "smoothing" no es válido.');
    return Object.freeze({ ...config, smoothing: Object.freeze({ minCutoff, beta }) });
  }

  /** Configuración actual (inmutable). */
  get config() {
    return this.#config;
  }

  /**
   * Cambia parte de la configuración.
   * @param {Partial<GestureConfig>} partial
   */
  configure(partial) {
    this.#config = MotorGestos.validateConfig({ ...this.#config, ...partial });
    for (const record of this.#hands.values()) record.filter = this.#createFilter();
  }

  /** Estado combinado de todas las manos. @returns {GestureState} */
  get state() {
    let best = 0;
    for (const record of this.#hands.values()) best = Math.max(best, PRIORITY.indexOf(record.state));
    return PRIORITY[best];
  }

  /** Copia del estado de cada mano, para visualizarlo. */
  getSnapshot() {
    return {
      state: this.state,
      hands: [...this.#hands.values()].map((r) => ({
        id: r.id,
        handedness: r.handedness,
        state: r.state,
        progress: r.progress,
        point: r.point ? { ...r.point } : null,
        frameIndex: r.frameIndex,
      })),
    };
  }

  /**
   * Procesa un fotograma.
   * @param {HandFrame} frame
   * @throws {TypeError} si el fotograma no tiene el formato esperado.
   */
  update(frame) {
    if (!frame || !Number.isFinite(frame.timestamp) || !Array.isArray(frame.hands)) {
      throw new TypeError('MotorGestos.update necesita { timestamp: number, hands: [] }.');
    }
    const t = frame.timestamp;
    if (t < this.#lastTimestamp) return; // fotograma desordenado: se ignora
    this.#lastTimestamp = t;

    const before = this.#hands.size;
    const aspect = frame.imageWidth && frame.imageHeight ? frame.imageWidth / frame.imageHeight : undefined;
    /** @type {Set<string>} */
    const seen = new Set();
    for (const record of this.#hands.values()) record.frameIndex = -1;

    const candidates = frame.hands
      .map((hand, index) => ({ hand, index, features: computeHandFeatures(hand, { aspect }) }))
      .filter(({ hand }) => (hand.score ?? 1) >= this.#config.minScore);

    for (const { hand, index, features } of candidates) {
      const record = this.#match(features.palmCenter, hand.handedness, seen);
      seen.add(record.id);
      record.handedness = hand.handedness;
      record.palm = features.palmCenter;
      record.frameIndex = index;
      record.lastSeen = t;
      record.features = features;
      this.#process(record, features, t);
    }

    for (const record of [...this.#hands.values()]) {
      if (seen.has(record.id) || t - record.lastSeen <= this.#config.lostGraceMs) continue;
      if (record.state === 'drawing') {
        this.#emit('draw-end', { hand: record.id, point: record.point, timestamp: t, reason: 'lost' });
      }
      this.#cancelHold(record, t);
      this.#hands.delete(record.id);
      this.#emit('gesture-changed', { hand: record.id, state: 'none', previous: record.state, overall: this.state });
    }

    if (this.#hands.size !== before) {
      this.#emit('hands-changed', { count: this.#hands.size, hands: [...this.#hands.keys()] });
    }
  }

  /** Termina cualquier trazo en curso y olvida todas las manos. */
  reset() {
    const t = this.#lastTimestamp;
    for (const record of this.#hands.values()) {
      if (record.state === 'drawing') {
        this.#emit('draw-end', { hand: record.id, point: record.point, timestamp: t, reason: 'reset' });
      }
    }
    const had = this.#hands.size;
    this.#hands.clear();
    this.#cooldownUntil = -Infinity;
    this.#lastTimestamp = -Infinity;
    if (had) this.#emit('hands-changed', { count: 0, hands: [] });
  }

  // ── Interno ───────────────────────────────────────────────

  #createFilter() {
    return new FiltroPunto(this.#config.smoothing);
  }

  /**
   * @param {string} id
   * @param {'Left' | 'Right'} handedness
   * @returns {HandRecord}
   */
  #createRecord(id, handedness) {
    return {
      id,
      handedness,
      ratio: null,
      palm: null,
      frameIndex: -1,
      state: 'idle',
      lastSeen: 0,
      startFrames: 0,
      releaseFrames: 0,
      holdStart: null,
      progress: 0,
      latched: null,
      point: null,
      filter: this.#createFilter(),
      features: null,
    };
  }

  /**
   * Encuentra qué mano conocida es la que aparece en el fotograma.
   *
   * Se sigue por **continuidad de posición** (la palma más cercana a donde
   * estaba), no por la etiqueta izquierda/derecha: MediaPipe a veces cambia
   * esa etiqueta durante un fotograma y, si se usara como identificador, el
   * trazo se cortaría.
   *
   * @param {{ x: number, y: number }} palm
   * @param {'Left' | 'Right'} handedness
   * @param {Set<string>} taken Manos ya asignadas en este fotograma.
   * @returns {HandRecord}
   */
  #match(palm, handedness, taken) {
    /** @type {HandRecord | null} */
    let best = null;
    let bestDistance = MAX_PALM_JUMP;
    for (const record of this.#hands.values()) {
      if (taken.has(record.id) || !record.palm) continue;
      const d = Math.hypot(record.palm.x - palm.x, record.palm.y - palm.y);
      if (d < bestDistance) {
        best = record;
        bestDistance = d;
      }
    }
    if (best) return best;
    /** @type {string} */
    let id = handedness;
    for (let n = 2; this.#hands.has(id) || taken.has(id); n++) id = `${handedness}#${n}`;
    const record = this.#createRecord(id, handedness);
    this.#hands.set(id, record);
    return record;
  }

  /**
   * @param {HandRecord} record
   * @param {HandFeatures} f
   * @param {number} t
   */
  #process(record, f, t) {
    const cfg = this.#config;
    const seconds = t / 1000;
    const pointMode = cfg.drawGesture === 'point';
    // Media móvil de la pinza (solo modo pinza): un pico de ruido no la suelta.
    const k = cfg.ratioSmoothing;
    record.ratio = record.ratio === null ? f.pinchRatio : record.ratio * k + f.pinchRatio * (1 - k);
    const drawPoint = pointMode ? f.indexTip : f.pinchPoint;
    const othersMax = Math.max(f.fingerRatios.middle, f.fingerRatios.ring, f.fingerRatios.pinky);

    if (record.state === 'drawing') {
      // Para SEGUIR dibujando basta un gesto menos estricto que para empezar.
      const keeps = pointMode
        ? f.fingerRatios.index > cfg.pointKeep && othersMax < cfg.curlKeep
        : /** @type {number} */ (record.ratio) <= cfg.pinchEnd;
      record.point = record.filter.filter(drawPoint, seconds);
      record.releaseFrames = keeps ? 0 : record.releaseFrames + 1;
      if (record.releaseFrames >= cfg.framesToEnd) {
        this.#emit('draw-end', { hand: record.id, point: record.point, timestamp: t, reason: 'released' });
        record.startFrames = 0;
        record.releaseFrames = 0;
        this.#setState(record, 'idle');
      } else {
        this.#emit('draw-move', { hand: record.id, point: record.point, timestamp: t });
      }
      return;
    }

    // 1. Dibujar tiene prioridad sobre las órdenes.
    const canDraw = cfg.writingHand === 'any' || cfg.writingHand === record.handedness;
    const starts = pointMode ? f.isPointing : f.pinchRatio < cfg.pinchStart && !f.isFist;
    record.startFrames = canDraw && starts ? record.startFrames + 1 : 0;
    if (record.startFrames >= cfg.framesToStart) {
      this.#cancelHold(record, t);
      record.filter.reset();
      record.releaseFrames = 0;
      record.point = record.filter.filter(drawPoint, seconds);
      this.#setState(record, 'drawing');
      this.#emit('draw-start', { hand: record.id, point: record.point, timestamp: t });
      return;
    }

    // 2. Órdenes mantenidas (borrar / sellar).
    if (record.latched === 'erasing' && !f.isOpenPalm) record.latched = null;
    if (record.latched === 'sealing' && !f.isFist) record.latched = null;
    const someoneDrawing = [...this.#hands.values()].some((r) => r.state === 'drawing');
    const blocked = someoneDrawing || t < this.#cooldownUntil;

    if (!blocked && f.isOpenPalm && record.latched !== 'erasing') {
      this.#hold(record, 'erasing', cfg.eraseHoldMs, 'erase', t);
      return;
    }
    if (!blocked && f.isFist && record.latched !== 'sealing') {
      this.#hold(record, 'sealing', cfg.sealHoldMs, 'seal', t);
      return;
    }

    // 3. Reposo (o cursor al señalar, en modo pinza).
    this.#cancelHold(record, t);
    if (!pointMode && f.isPointing) {
      if (record.state !== 'pointing') record.filter.reset();
      record.point = record.filter.filter(f.indexTip, seconds);
      this.#setState(record, 'pointing');
      this.#emit('pointer-move', { hand: record.id, point: record.point, timestamp: t });
    } else {
      this.#setState(record, 'idle');
    }
  }

  /**
   * @param {HandRecord} record
   * @param {'erasing' | 'sealing'} state
   * @param {number} duration
   * @param {'erase' | 'seal'} eventName
   * @param {number} t
   */
  #hold(record, state, duration, eventName, t) {
    if (record.state !== state) {
      this.#cancelHold(record, t);
      record.holdStart = t;
      this.#setState(record, state);
    }
    record.progress = clamp((t - /** @type {number} */ (record.holdStart)) / duration, 0, 1);
    this.#emit(`${eventName}-progress`, { hand: record.id, progress: record.progress, timestamp: t });
    if (record.progress >= 1) {
      this.#emit(eventName, { hand: record.id, timestamp: t });
      this.#cooldownUntil = t + this.#config.commandCooldownMs;
      record.latched = state;
      record.holdStart = null;
      record.progress = 0;
      this.#setState(record, 'idle');
    }
  }

  /**
   * Cancela una orden a medias y avisa con progreso 0.
   * @param {HandRecord} record
   * @param {number} t
   */
  #cancelHold(record, t) {
    if (record.state !== 'erasing' && record.state !== 'sealing') return;
    const eventName = record.state === 'erasing' ? 'erase-progress' : 'seal-progress';
    record.holdStart = null;
    record.progress = 0;
    this.#emit(eventName, { hand: record.id, progress: 0, timestamp: t });
    this.#setState(record, 'idle');
  }

  /**
   * @param {HandRecord} record
   * @param {HandGestureState} state
   */
  #setState(record, state) {
    if (record.state === state) return;
    const previous = record.state;
    record.state = state;
    this.#emit('gesture-changed', { hand: record.id, state, previous, overall: this.state });
  }

  /**
   * @param {string} type
   * @param {object} detail
   */
  #emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
