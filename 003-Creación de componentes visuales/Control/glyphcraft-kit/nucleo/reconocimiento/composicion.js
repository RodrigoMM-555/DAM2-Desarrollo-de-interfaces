import { directedChamfer, boundingBox } from '../geometria/trazo.js';
import { analyzeCircle } from './estrategias/circulo.js';
import { toCloud } from './estrategias/nube-puntos.js';

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {import('../glifos/modelo-glifo.js').Glyph} Glyph */

/**
 * @typedef {object} SymbolMatch
 * @property {Glyph} glyph Glifo al que se parece el grupo de trazos.
 * @property {number} distance Distancia normalizada (menor = más parecido).
 * @property {number[]} strokes Índices de los trazos interiores del grupo.
 */

/**
 * @typedef {object} CompositionResult
 * @property {import('./estrategias/circulo.js').CircleAnalysis | null} circle Círculo exterior (o `null`).
 * @property {Glyph[]} elements Símbolos reconocidos (sin repetir), vacío si ninguno encaja.
 * @property {SymbolMatch[]} symbols Detalle de cada grupo de trazos.
 * @property {number} distance Distancia de la peor coincidencia de la mejor explicación.
 * @property {{ cx: number, cy: number, r: number } | null} transform
 */

/**
 * Distancia máxima para aceptar un símbolo. Calibrada con dibujos
 * sintéticos en cuatro disposiciones: los aciertos llegan hasta ≈0,18. Es
 * permisiva a propósito: el laboratorio es para experimentar.
 */
export const DEFAULT_COMPOSITION_THRESHOLD = 0.18;
/**
 * Penalización por cada símbolo extra. Medido: con 0 se aciertan más
 * combinaciones (dividir un símbolo en trozos ya sale caro por sí solo,
 * porque cada trozo suelto se parece poco a cualquier glifo).
 */
const EXTRA_SYMBOL_PENALTY = 0;
/** Máximo de trazos interiores que se analizan (el resto se ignora). */
const MAX_STROKES = 14;

/**
 * Normaliza puntos a su caja contenedora: centro en (0, 0) y el lado mayor
 * de -1 a 1. Así un símbolo se compara igual sea grande o pequeño y esté
 * donde esté.
 * @param {Point[]} points
 * @returns {Point[]}
 */
function normalize(points) {
  const box = boundingBox(points);
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const half = Math.max(box.width, box.height) / 2 || 1;
  return points.map((p) => ({ x: (p.x - cx) / half, y: (p.y - cy) / half }));
}

/**
 * Nube de puntos normalizada de un conjunto de trazos.
 * @param {Point[][]} strokes
 */
function normalizedCloud(strokes) {
  return normalize(toCloud(strokes, 96));
}

/**
 * Detecta qué símbolos elementales se han dibujado dentro de un mismo
 * círculo (laboratorio), estén donde estén y del tamaño que sean: lado a
 * lado, uno encima de otro, superpuestos o uno grande y otro pequeño.
 *
 * Supone que se termina un símbolo antes de empezar el siguiente: prueba
 * todas las formas de partir los trazos interiores, **en orden de dibujo**,
 * en 1, 2 o 3 grupos consecutivos. Cada grupo se normaliza a su propia caja
 * y se compara con cada glifo normalizado igual. Gana la partición en la
 * que todos los grupos se parecen mejor a algún glifo.
 *
 * @param {({ points: Point[] } | Point[])[]} strokes
 * @param {Iterable<Glyph>} glyphs
 * @param {{ threshold?: number, maxElements?: number }} [options]
 * @returns {CompositionResult}
 */
export function detectElements(strokes, glyphs, { threshold = DEFAULT_COMPOSITION_THRESHOLD, maxElements = 3 } = {}) {
  const user = (Array.isArray(strokes) ? strokes : [])
    .map((s) => (Array.isArray(s) ? s : s?.points))
    .filter((p) => Array.isArray(p) && p.length >= 2);

  const analyses = user.map((points) => analyzeCircle(points));
  let circleIndex = -1;
  analyses.forEach((a, i) => {
    if (a?.candidate && (circleIndex < 0 || a.r > /** @type {any} */ (analyses[circleIndex]).r)) circleIndex = i;
  });
  const empty = { elements: [], symbols: [], distance: Infinity };
  if (circleIndex < 0) return { circle: null, transform: null, ...empty };

  const circle = /** @type {import('./estrategias/circulo.js').CircleAnalysis} */ (analyses[circleIndex]);
  const transform = { cx: circle.cx, cy: circle.cy, r: circle.r };
  const inner = user.filter((_, i) => i !== circleIndex).slice(0, MAX_STROKES);
  if (!inner.length) return { circle, transform, ...empty };

  const list = [...glyphs];
  const templates = list.map((g) => normalizedCloud(/** @type {Point[][]} */ (g.sampled.slice(1))));

  // Coincidencia de cada grupo consecutivo de trazos [i, j) (se memoriza).
  /** @type {Map<string, { index: number, distance: number }>} */
  const cache = new Map();
  const matchGroup = (/** @type {number} */ i, /** @type {number} */ j) => {
    const key = `${i}-${j}`;
    let best = cache.get(key);
    if (!best) {
      const cloud = normalizedCloud(inner.slice(i, j));
      best = { index: -1, distance: Infinity };
      templates.forEach((t, index) => {
        const distance = Math.max(directedChamfer(cloud, t), directedChamfer(t, cloud));
        if (distance < /** @type {{distance: number}} */ (best).distance) best = { index, distance };
      });
      cache.set(key, best);
    }
    return best;
  };

  /** @type {{ score: number, groups: [number, number][] } | null} */
  let bestPartition = null;
  for (const cuts of partitions(inner.length, maxElements)) {
    const bounds = [0, ...cuts, inner.length];
    /** @type {[number, number][]} */
    const groups = bounds.slice(1).map((end, k) => [bounds[k], end]);
    // Se elige por la media (un símbolo algo tembloroso no hunde una buena
    // explicación); el umbral de aceptación usa después el peor grupo.
    const distances = groups.map(([i, j]) => matchGroup(i, j).distance);
    const mean = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const score = mean + EXTRA_SYMBOL_PENALTY * (groups.length - 1);
    if (!bestPartition || score < bestPartition.score) bestPartition = { score, groups };
  }
  if (!bestPartition) return { circle, transform, ...empty };

  const symbols = bestPartition.groups.map(([i, j]) => {
    const { index, distance } = matchGroup(i, j);
    return { glyph: list[index], distance, strokes: Array.from({ length: j - i }, (_, k) => i + k) };
  });
  const distance = Math.max(...symbols.map((s) => s.distance));
  if (distance > threshold) return { circle, transform, elements: [], symbols, distance };
  const elements = [...new Set(symbols.map((s) => s.glyph))];
  return { circle, transform, elements, symbols, distance };
}

/**
 * Posiciones de corte para partir `n` trazos en 1..max grupos consecutivos.
 * @param {number} n
 * @param {number} max
 * @returns {number[][]} Cada elemento son los índices donde empieza un grupo nuevo.
 */
function partitions(n, max) {
  /** @type {number[][]} */
  const out = [[]];
  const walk = (/** @type {number} */ start, /** @type {number[]} */ cuts) => {
    if (cuts.length === max - 1) return;
    for (let c = start; c < n; c++) {
      const next = [...cuts, c];
      out.push(next);
      walk(c + 1, next);
    }
  };
  walk(1, []);
  return out;
}
