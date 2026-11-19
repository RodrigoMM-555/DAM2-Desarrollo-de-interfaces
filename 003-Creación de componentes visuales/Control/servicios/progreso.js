import { readJSON, writeJSON } from './almacenamiento.js';

/**
 * Progreso de la persona: aprendizaje de glifos, estadísticas, logros y
 * descubrimientos del laboratorio.
 *
 * Reglas de aprendizaje:
 * - Un glifo queda **aprendido** tras superarlo `CASTS_TO_LEARN` veces en la
 *   práctica guiada (en cualquier nivel).
 * - Queda **dominado** tras superarlo `CASTS_TO_MASTER` veces en nivel Maestro.
 * - Solo los glifos aprendidos se pueden lanzar en «Practicar magia».
 *
 * Todo lo que se lee se valida: datos corruptos o imposibles vuelven a sus
 * valores por defecto sin romper la aplicación.
 */

export const CASTS_TO_LEARN = 3;
export const CASTS_TO_MASTER = 3;
export const PROGRESS_VERSION = 2;
const KEY = 'glyphcraft:progress';

/**
 * @typedef {object} GlyphProgress
 * @property {number} attempts Intentos en la práctica guiada.
 * @property {number} successes Intentos superados.
 * @property {number} masterSuccesses Intentos superados en nivel Maestro.
 * @property {number} bestScore Mejor puntuación.
 * @property {number | null} lastScore Última puntuación.
 * @property {number} scoreSum Suma de puntuaciones (para la media).
 * @property {number} casts Lanzamientos libres conseguidos.
 * @property {string | null} learnedAt Fecha ISO en que se aprendió.
 * @property {string | null} masteredAt Fecha ISO en que se dominó.
 */

/** @returns {GlyphProgress} */
const emptyProgress = () => ({
  attempts: 0,
  successes: 0,
  masterSuccesses: 0,
  bestScore: 0,
  lastScore: null,
  scoreSum: 0,
  casts: 0,
  learnedAt: null,
  masteredAt: null,
});

const count = (/** @type {unknown} */ v) => (Number.isInteger(v) && /** @type {number} */ (v) >= 0 ? /** @type {number} */ (v) : 0);
const score = (/** @type {unknown} */ v) => (Number.isFinite(v) ? Math.min(100, Math.max(0, /** @type {number} */ (v))) : null);
const date = (/** @type {unknown} */ v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);

/**
 * @param {any} raw
 * @returns {GlyphProgress}
 */
function sanitizeGlyph(raw) {
  if (!raw || typeof raw !== 'object') return emptyProgress();
  const attempts = count(raw.attempts);
  return {
    attempts,
    successes: Math.min(count(raw.successes), attempts || count(raw.successes)),
    masterSuccesses: count(raw.masterSuccesses),
    bestScore: score(raw.bestScore) ?? 0,
    lastScore: score(raw.lastScore),
    // v1 no guardaba la suma: se estima con la última puntuación.
    scoreSum: Number.isFinite(raw.scoreSum) && raw.scoreSum >= 0 ? raw.scoreSum : (score(raw.lastScore) ?? 0) * attempts,
    casts: count(raw.casts),
    learnedAt: date(raw.learnedAt),
    masteredAt: date(raw.masteredAt),
  };
}

/**
 * @param {unknown} raw
 * @returns {Record<string, string>}
 */
function sanitizeDates(raw) {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(Object.entries(raw).filter(([k, v]) => /^[a-z0-9+-]+$/.test(k) && date(v)));
}

/**
 * Almacén del progreso. Emite `change` con `{ glyphId }` (o `{ glyphId: '' }`).
 */
export class AlmacenProgreso extends EventTarget {
  /** @type {Storage | undefined} */
  #storage;
  /** @type {Record<string, GlyphProgress>} */
  #glyphs = {};
  #practiceMs = 0;
  /** @type {Record<string, string>} */
  #achievements = {};
  /** @type {Record<string, string>} */
  #discoveries = {};

  /** @param {Storage} [storage] */
  constructor(storage = globalThis.localStorage) {
    super();
    this.#storage = storage;
    this.#load(readJSON(KEY, storage));
  }

  // ── Consultas ─────────────────────────────────────────────

  /** @param {string} glyphId */
  get(glyphId) {
    return { ...(this.#glyphs[glyphId] ?? emptyProgress()) };
  }

  /** @param {string} glyphId */
  isLearned(glyphId) {
    return this.#glyphs[glyphId]?.learnedAt != null;
  }

  /** @param {string} glyphId */
  isMastered(glyphId) {
    return this.#glyphs[glyphId]?.masteredAt != null;
  }

  learnedIds() {
    return Object.keys(this.#glyphs).filter((id) => this.isLearned(id));
  }

  masteredIds() {
    return Object.keys(this.#glyphs).filter((id) => this.isMastered(id));
  }

  /** Estadísticas globales. */
  totals() {
    const all = Object.values(this.#glyphs);
    const attempts = all.reduce((s, g) => s + g.attempts, 0);
    return {
      attempts,
      successes: all.reduce((s, g) => s + g.successes, 0),
      casts: all.reduce((s, g) => s + g.casts, 0),
      averageScore: attempts ? all.reduce((s, g) => s + g.scoreSum, 0) / attempts : 0,
      bestScore: all.reduce((s, g) => Math.max(s, g.bestScore), 0),
      practiceMs: this.#practiceMs,
      learned: this.learnedIds().length,
      mastered: this.masteredIds().length,
      discoveries: Object.keys(this.#discoveries).length,
    };
  }

  /** Logros desbloqueados: `{ id: fechaISO }`. */
  achievements() {
    return { ...this.#achievements };
  }

  /** Combinaciones descubiertas en el laboratorio: `{ id: fechaISO }`. */
  discoveries() {
    return { ...this.#discoveries };
  }

  // ── Cambios ───────────────────────────────────────────────

  /**
   * Registra un intento de la práctica guiada.
   * @param {string} glyphId
   * @param {{ score: number, passed: boolean, level: 'apprentice' | 'artisan' | 'master' }} attempt
   * @returns {{ progress: GlyphProgress, learnedNow: boolean, masteredNow: boolean }}
   */
  recordPractice(glyphId, { score: value, passed, level }) {
    if (typeof glyphId !== 'string' || !glyphId) throw new TypeError('recordPractice necesita un glyphId.');
    if (!Number.isFinite(value)) throw new TypeError('recordPractice necesita una puntuación numérica.');
    const entry = this.#glyphs[glyphId] ?? emptyProgress();
    const now = new Date().toISOString();
    const rounded = Math.round(Math.min(100, Math.max(0, value)));
    entry.attempts++;
    entry.lastScore = rounded;
    entry.scoreSum += rounded;
    entry.bestScore = Math.max(entry.bestScore, rounded);
    let learnedNow = false;
    let masteredNow = false;
    if (passed) {
      entry.successes++;
      if (level === 'master') entry.masterSuccesses++;
      if (!entry.learnedAt && entry.successes >= CASTS_TO_LEARN) {
        entry.learnedAt = now;
        learnedNow = true;
      }
      if (!entry.masteredAt && entry.masterSuccesses >= CASTS_TO_MASTER) {
        entry.masteredAt = now;
        masteredNow = true;
      }
    }
    this.#glyphs[glyphId] = entry;
    this.#save(glyphId);
    return { progress: { ...entry }, learnedNow, masteredNow };
  }

  /** @param {string} glyphId */
  recordCast(glyphId) {
    const entry = this.#glyphs[glyphId] ?? emptyProgress();
    entry.casts++;
    this.#glyphs[glyphId] = entry;
    this.#save(glyphId);
    return { ...entry };
  }

  /**
   * Suma tiempo de práctica.
   * @param {number} ms
   */
  addPracticeTime(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return;
    this.#practiceMs += Math.min(ms, 60 * 60 * 1000); // como mucho 1 h por llamada
    this.#save('');
  }

  /**
   * Anota una combinación del laboratorio.
   * @param {string} id Identificadores de los glifos unidos por `+`, ordenados.
   * @returns {boolean} `true` si es un descubrimiento nuevo.
   */
  recordDiscovery(id) {
    if (!/^[a-z0-9+-]+$/.test(id)) throw new TypeError('Identificador de descubrimiento no válido.');
    if (this.#discoveries[id]) return false;
    this.#discoveries[id] = new Date().toISOString();
    this.#save('');
    return true;
  }

  /**
   * Desbloquea un logro.
   * @param {string} id
   * @returns {boolean} `true` si no lo estaba ya.
   */
  unlockAchievement(id) {
    if (this.#achievements[id]) return false;
    this.#achievements[id] = new Date().toISOString();
    this.#save('');
    return true;
  }

  /** Borra todo el progreso. */
  reset() {
    this.#glyphs = {};
    this.#practiceMs = 0;
    this.#achievements = {};
    this.#discoveries = {};
    this.#save('');
  }

  toJSON() {
    return {
      version: PROGRESS_VERSION,
      glyphs: structuredClone(this.#glyphs),
      practiceMs: this.#practiceMs,
      achievements: { ...this.#achievements },
      discoveries: { ...this.#discoveries },
    };
  }

  /**
   * Sustituye el progreso por uno importado (se valida todo).
   * @param {unknown} data
   */
  import(data) {
    if (!data || typeof data !== 'object' || !('glyphs' in data)) throw new TypeError('Progreso importado no válido.');
    this.#load(data);
    this.#save('');
  }

  /** @param {any} raw */
  #load(raw) {
    const glyphs = raw?.glyphs && typeof raw.glyphs === 'object' ? raw.glyphs : {};
    this.#glyphs = Object.fromEntries(
      Object.entries(glyphs)
        .filter(([id]) => /^[a-z0-9-]+$/.test(id))
        .map(([id, value]) => [id, sanitizeGlyph(value)]),
    );
    this.#practiceMs = Number.isFinite(raw?.practiceMs) && raw.practiceMs > 0 ? raw.practiceMs : 0;
    this.#achievements = sanitizeDates(raw?.achievements);
    this.#discoveries = sanitizeDates(raw?.discoveries);
  }

  /** @param {string} glyphId */
  #save(glyphId) {
    writeJSON(KEY, this.toJSON(), this.#storage);
    this.dispatchEvent(new CustomEvent('change', { detail: { glyphId } }));
  }
}

/** Almacén compartido por toda la aplicación. */
export const progressStore = new AlmacenProgreso();
