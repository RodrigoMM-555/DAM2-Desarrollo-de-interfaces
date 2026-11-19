import { resample, fitCircle, angularCoverage } from '../../geometria/trazo.js';

/** @typedef {{ x: number, y: number }} Point */

/**
 * @typedef {object} CircleAnalysis
 * @property {number} cx
 * @property {number} cy
 * @property {number} r
 * @property {number} residual Irregularidad (0 = perfecto; 0,1 = bastante deformado).
 * @property {number} coverage Fracción de vuelta recorrida (0-1).
 * @property {number} closure Hueco entre inicio y final, relativo al radio.
 * @property {number} score Calidad del círculo (0-100).
 * @property {boolean} candidate Si es razonable considerarlo el círculo exterior.
 */

/**
 * Analiza si un trazo es un círculo y lo puntúa.
 *
 * La calidad combina tres factores (todos entre 0 y 1):
 * - redondez: según el residuo del ajuste;
 * - completitud: cuánto de la vuelta recorre;
 * - cierre: si el final vuelve al inicio.
 *
 * @param {Point[]} points
 * @returns {CircleAnalysis | null}
 */
export function analyzeCircle(points) {
  if (points.length < 3) return null;
  const pts = resample(points, 64);
  const fit = fitCircle(pts);
  if (!fit) return null;
  const coverage = angularCoverage(pts, fit.cx, fit.cy);
  const first = pts[0];
  const last = pts[pts.length - 1];
  const closure = Math.hypot(first.x - last.x, first.y - last.y) / fit.r;

  const roundness = Math.exp(-((fit.residual / 0.13) ** 2));
  const completeness = Math.min(1, Math.max(0, (coverage - 0.6) / 0.35));
  const closed = Math.exp(-((Math.max(0, closure - 0.2) / 0.4) ** 2));

  return {
    cx: fit.cx,
    cy: fit.cy,
    r: fit.r,
    residual: fit.residual,
    coverage,
    closure,
    score: 100 * roundness * completeness * closed,
    // Un círculo a mano alzada queda en 0,03-0,1; un triángulo, en torno a 0,17.
    candidate: coverage >= 0.7 && fit.residual <= 0.15,
  };
}
