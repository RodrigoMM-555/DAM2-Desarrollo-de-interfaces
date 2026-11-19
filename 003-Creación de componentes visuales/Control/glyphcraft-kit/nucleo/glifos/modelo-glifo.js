import { pathLength } from '../geometria/trazo.js';

/**
 * Modelo de glifo.
 *
 * Un glifo se describe con **primitivas geométricas** en un espacio
 * normalizado: el círculo exterior tiene centro (0, 0) y radio 1, y el eje y
 * apunta hacia abajo (como en pantalla y en SVG). De esa única definición se
 * obtienen:
 *
 * - los puntos que usa el reconocedor para comparar,
 * - el `path` SVG para dibujarlo y animarlo,
 * - la guía que se proyecta sobre el lienzo de práctica.
 *
 * El orden de `strokes` es el orden en que se enseña a trazarlo, y la
 * dirección de cada primitiva es el sentido correcto del trazo.
 */

/** @typedef {[number, number]} XY */
/** @typedef {{ x: number, y: number }} Point */

/**
 * @typedef {(
 *   { type: 'circle', cx?: number, cy?: number, r: number, start?: number, dir?: 'cw' | 'ccw' } |
 *   { type: 'line', from: XY, to: XY } |
 *   { type: 'polyline', points: XY[], closed?: boolean } |
 *   { type: 'wave', from: XY, to: XY, amplitude: number, periods: number } |
 *   { type: 'spiral', cx?: number, cy?: number, r0: number, r1: number, turns: number, start?: number, dir?: 'cw' | 'ccw' }
 * )} StrokeDef
 */

/** @typedef {'fire' | 'water' | 'wind' | 'light' | 'protection' | 'ice' | 'arcane'} GlyphElement */

/**
 * Definición de un glifo (lo que se escribe en el catálogo).
 * @typedef {object} GlyphDef
 * @property {string} id Identificador en minúsculas (`ignis`).
 * @property {string} name Nombre visible.
 * @property {GlyphElement} element Tipo de magia.
 * @property {number} difficulty Dificultad 1-5.
 * @property {string} [description]
 * @property {string} [lore] Texto ambiental del grimorio.
 * @property {StrokeDef[]} strokes Trazos en orden. El primero debe ser el círculo exterior.
 * @property {string[]} [strokeHints] Explicación de cada trazo.
 * @property {{ spell: string, params?: Record<string, unknown> }} [effect] Efecto mágico asociado.
 */

/**
 * Glifo validado y preparado (inmutable).
 * @typedef {Readonly<Omit<GlyphDef, 'strokes'> & {
 *   strokes: ReadonlyArray<StrokeDef>,
 *   sampled: ReadonlyArray<ReadonlyArray<Readonly<Point>>>,
 *   closed: ReadonlyArray<boolean>,
 *   paths: ReadonlyArray<string>,
 * }>} Glyph
 */

export const GLYPH_ELEMENTS = Object.freeze(
  /** @type {GlyphElement[]} */ (['fire', 'water', 'wind', 'light', 'protection', 'ice', 'arcane']),
);

const STROKE_TYPES = ['circle', 'line', 'polyline', 'wave', 'spiral'];
/** Puntos por unidad de longitud al muestrear. */
const DENSITY = 48;

const rad = (/** @type {number} */ deg) => (deg * Math.PI) / 180;
const pt = (/** @type {number} */ x, /** @type {number} */ y) => ({ x, y });

/**
 * Convierte una primitiva en puntos (espacio del glifo).
 * @param {StrokeDef} def
 * @returns {Point[]}
 */
export function sampleStroke(def) {
  switch (def.type) {
    case 'circle': {
      const { cx = 0, cy = 0, r, start = -90, dir = 'cw' } = def;
      const n = Math.max(24, Math.ceil(2 * Math.PI * r * DENSITY));
      const sign = dir === 'cw' ? 1 : -1; // y hacia abajo: ángulo creciente = horario
      return Array.from({ length: n + 1 }, (_, i) => {
        const a = rad(start) + sign * (i / n) * Math.PI * 2;
        return pt(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      });
    }
    case 'line':
      return densify([pt(...def.from), pt(...def.to)]);
    case 'polyline': {
      const points = def.points.map(([x, y]) => pt(x, y));
      if (def.closed) points.push({ ...points[0] });
      return densify(points);
    }
    case 'wave': {
      const [x0, y0] = def.from;
      const [x1, y1] = def.to;
      const len = Math.hypot(x1 - x0, y1 - y0);
      const [ux, uy] = [(x1 - x0) / len, (y1 - y0) / len];
      const n = Math.max(24, Math.ceil(len * DENSITY * (1 + def.amplitude * def.periods * 4)));
      return Array.from({ length: n + 1 }, (_, i) => {
        const t = i / n;
        const offset = Math.sin(t * def.periods * Math.PI * 2) * def.amplitude;
        return pt(x0 + ux * len * t - uy * offset, y0 + uy * len * t + ux * offset);
      });
    }
    case 'spiral': {
      const { cx = 0, cy = 0, r0, r1, turns, start = -90, dir = 'cw' } = def;
      const sign = dir === 'cw' ? 1 : -1;
      const n = Math.max(48, Math.ceil(turns * Math.PI * (r0 + r1) * DENSITY));
      return Array.from({ length: n + 1 }, (_, i) => {
        const t = i / n;
        const a = rad(start) + sign * t * turns * Math.PI * 2;
        const r = r0 + (r1 - r0) * t;
        return pt(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      });
    }
    default:
      throw new TypeError(`Tipo de trazo desconocido: ${/** @type {any} */ (def).type}`);
  }
}

/**
 * Inserta puntos intermedios en los segmentos rectos.
 * @param {Point[]} points
 */
function densify(points) {
  /** @type {Point[]} */
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * DENSITY));
    for (let s = 1; s <= steps; s++) out.push(pt(a.x + ((b.x - a.x) * s) / steps, a.y + ((b.y - a.y) * s) / steps));
  }
  return out;
}

/**
 * `true` si el trazo es una figura cerrada (su punto de inicio no importa).
 * @param {StrokeDef} def
 */
export function isClosedStroke(def) {
  return def.type === 'circle' || (def.type === 'polyline' && Boolean(def.closed));
}

/**
 * Atributo `d` de un path SVG a partir de puntos.
 * @param {readonly Point[]} points
 * @param {number} [precision=3]
 */
export function pointsToPath(points, precision = 3) {
  const f = (/** @type {number} */ n) => Number(n.toFixed(precision));
  return points.map((p, i) => `${i ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`).join('');
}

/**
 * Comprueba una definición y devuelve el glifo preparado.
 *
 * @param {GlyphDef} def
 * @returns {Glyph}
 * @throws {TypeError} con un mensaje que indica qué falla.
 */
export function createGlyph(def) {
  const fail = (/** @type {string} */ msg) => {
    throw new TypeError(`Glifo "${def?.id ?? '?'}": ${msg}`);
  };
  if (!def || typeof def !== 'object') fail('la definición debe ser un objeto.');
  if (typeof def.id !== 'string' || !/^[a-z0-9-]+$/.test(def.id)) fail('"id" debe ser texto en minúsculas sin espacios.');
  if (typeof def.name !== 'string' || !def.name.trim()) fail('falta "name".');
  if (!GLYPH_ELEMENTS.includes(def.element)) fail(`"element" debe ser uno de: ${GLYPH_ELEMENTS.join(', ')}.`);
  if (!Number.isInteger(def.difficulty) || def.difficulty < 1 || def.difficulty > 5) fail('"difficulty" debe ser un entero de 1 a 5.');
  if (!Array.isArray(def.strokes) || def.strokes.length < 2) fail('necesita el círculo exterior y al menos un trazo interior.');
  if (def.strokes[0].type !== 'circle') fail('el primer trazo debe ser el círculo exterior.');

  def.strokes.forEach((s, i) => {
    if (!STROKE_TYPES.includes(s?.type)) fail(`el trazo ${i + 1} tiene un tipo no válido.`);
    const numbers = Object.entries(s).filter(([k]) => !['type', 'dir', 'closed', 'points', 'from', 'to'].includes(k));
    if (numbers.some(([, v]) => !Number.isFinite(v))) fail(`el trazo ${i + 1} tiene parámetros no numéricos.`);
    const pairs = [/** @type {any} */ (s).from, /** @type {any} */ (s).to, ...(/** @type {any} */ (s).points ?? [])].filter(Boolean);
    if (pairs.some((p) => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))) {
      fail(`el trazo ${i + 1} tiene coordenadas no válidas.`);
    }
  });

  const sampled = def.strokes.map((s) => Object.freeze(sampleStroke(s).map((p) => Object.freeze(p))));
  if (sampled.some((points) => pathLength(points) === 0)) fail('hay un trazo de longitud cero.');

  return Object.freeze({
    ...def,
    strokes: Object.freeze([...def.strokes]),
    sampled: Object.freeze(sampled),
    closed: Object.freeze(def.strokes.map(isClosedStroke)),
    paths: Object.freeze(sampled.map((points) => pointsToPath(points))),
  });
}

/**
 * Coloca un glifo sobre un lienzo normalizado (0-1).
 *
 * @param {Glyph} glyph
 * @param {{ cx?: number, cy?: number, r?: number }} [placement] Centro y radio del círculo exterior en el lienzo.
 * @returns {Point[][]} Trazos en coordenadas del lienzo.
 */
export function placeGlyph(glyph, { cx = 0.5, cy = 0.5, r = 0.42 } = {}) {
  return glyph.sampled.map((points) => points.map((p) => ({ x: cx + p.x * r, y: cy + p.y * r })));
}

/**
 * Catálogo de glifos disponibles.
 *
 * Los componentes que muestran un glifo por su `glyph-id` lo buscan aquí,
 * así el catálogo (datos de la app) queda separado de los componentes.
 *
 * @fires change - Se ha añadido o quitado un glifo.
 */
export class BibliotecaGlifos extends EventTarget {
  /** @type {Map<string, Glyph>} */
  #glyphs = new Map();

  /**
   * Añade (o reemplaza) glifos.
   * @param {...GlyphDef} defs
   * @returns {Glyph[]}
   */
  add(...defs) {
    const created = defs.map(createGlyph);
    for (const glyph of created) this.#glyphs.set(glyph.id, glyph);
    this.dispatchEvent(new CustomEvent('change', { detail: { ids: created.map((g) => g.id) } }));
    return created;
  }

  /** @param {string} id */
  get(id) {
    return this.#glyphs.get(id) ?? null;
  }

  /** @param {string} id */
  has(id) {
    return this.#glyphs.has(id);
  }

  /** Glifos ordenados por dificultad y nombre. */
  list() {
    return [...this.#glyphs.values()].sort((a, b) => a.difficulty - b.difficulty || a.name.localeCompare(b.name));
  }

  clear() {
    this.#glyphs.clear();
    this.dispatchEvent(new CustomEvent('change', { detail: { ids: [] } }));
  }

  get size() {
    return this.#glyphs.size;
  }
}

/** Biblioteca compartida por defecto. */
export const glyphLibrary = new BibliotecaGlifos();
