import { resample, chamfer, pointwiseDistance, signedArea } from '../../geometria/trazo.js';

/** @typedef {{ x: number, y: number }} Point */

/**
 * Estrategia de "emparejamiento de trazos": compara trazo a trazo.
 * Permite comprobar el orden y el sentido (niveles Artesano y Maestro).
 */

/** Puntos con los que se compara cada trazo. */
export const STROKE_SAMPLES = 32;

/**
 * @param {Point[][]} strokes
 * @returns {Point[][]}
 */
export function prepareStrokes(strokes) {
  return strokes.map((points) => resample(points, STROKE_SAMPLES));
}

/**
 * Matriz de distancias (forma) entre cada trazo del usuario y cada trazo modelo.
 * @param {Point[][]} user Trazos ya preparados.
 * @param {Point[][]} template
 * @returns {number[][]}
 */
export function distanceMatrix(user, template) {
  return user.map((u) => template.map((t) => chamfer(u, t)));
}

/**
 * Empareja trazos sin tener en cuenta el orden (voraz: siempre la pareja
 * más parecida que quede libre). Suficiente para pocos trazos.
 *
 * @param {number[][]} matrix `matrix[i][j]` = distancia usuario i ↔ modelo j.
 * @returns {(number | null)[]} Para cada trazo del usuario, el índice del modelo (o `null`).
 */
export function greedyAssignment(matrix) {
  /** @type {(number | null)[]} */
  const result = matrix.map(() => null);
  const usedT = new Set();
  const pairs = matrix.flatMap((row, i) => row.map((d, j) => ({ i, j, d }))).sort((a, b) => a.d - b.d);
  for (const { i, j } of pairs) {
    if (result[i] !== null || usedT.has(j)) continue;
    result[i] = j;
    usedT.add(j);
  }
  return result;
}

/**
 * `true` si el trazo del usuario va en el mismo sentido que el modelo.
 * - Figuras cerradas: se compara el sentido de giro (signo del área).
 * - Trazos abiertos: se compara punto a punto con el modelo y con el modelo invertido.
 *
 * @param {Point[]} user Preparado.
 * @param {Point[]} template Preparado.
 * @param {boolean} closed
 */
export function sameDirection(user, template, closed) {
  if (closed) return Math.sign(signedArea(user)) === Math.sign(signedArea(template));
  return pointwiseDistance(user, template) <= pointwiseDistance(user, [...template].reverse());
}
