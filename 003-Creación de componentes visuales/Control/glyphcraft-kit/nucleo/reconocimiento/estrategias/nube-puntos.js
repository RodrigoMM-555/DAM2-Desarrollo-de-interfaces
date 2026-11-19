import { resample, pathLength, directedChamfer } from '../../geometria/trazo.js';

/** @typedef {{ x: number, y: number }} Point */

/**
 * Estrategia de "nube de puntos".
 *
 * Junta todos los trazos en una sola nube de puntos (repartidos según la
 * longitud de cada trazo) y compara las nubes con la distancia de Chamfer.
 *
 * Se toma el **máximo** de las dos direcciones (dibujo → modelo y modelo →
 * dibujo) en lugar de la media: así un trazo que falta o uno que sobra
 * cuentan enteros. Medido con dibujos sintéticos, separa mejor los glifos
 * equivocados (distancia mínima 0,085 frente a 0,078 con la media).
 *
 * Ventaja: no le importa ni el orden, ni el sentido, ni en cuántos trazos
 * se dibujó la figura (un triángulo de un trazo o de tres da igual). Es la
 * comparación adecuada para el nivel Aprendiz y para clasificar.
 */

/**
 * @param {Point[][]} strokes
 * @param {number} total Puntos totales de la nube.
 * @returns {Point[]}
 */
export function toCloud(strokes, total = 96) {
  const lengths = strokes.map(pathLength);
  const sum = lengths.reduce((a, b) => a + b, 0) || 1;
  return strokes.flatMap((points, i) => resample(points, Math.max(4, Math.round((lengths[i] / sum) * total))));
}

/**
 * Distancia entre dos dibujos (mismo espacio de coordenadas).
 * @param {Point[][]} a
 * @param {Point[][]} b
 */
export function cloudDistance(a, b) {
  if (!a.length || !b.length) return Infinity;
  const cloudA = toCloud(a);
  const cloudB = toCloud(b);
  return Math.max(directedChamfer(cloudA, cloudB), directedChamfer(cloudB, cloudA));
}
