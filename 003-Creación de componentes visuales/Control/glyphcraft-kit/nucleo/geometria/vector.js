/**
 * Operaciones mínimas con vectores 2D/3D representados como objetos
 * `{ x, y, z? }`. Son funciones puras: no modifican sus argumentos.
 */

/** @typedef {{ x: number, y: number, z?: number }} Vec */

/**
 * Distancia euclídea (usa z si ambos puntos la tienen).
 * @param {Vec} a
 * @param {Vec} b
 */
export function distance(a, b) {
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.hypot(a.x - b.x, a.y - b.y, dz);
}

/**
 * Punto medio.
 * @param {Vec} a
 * @param {Vec} b
 * @returns {Vec}
 */
export function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z ?? 0) + (b.z ?? 0)) / 2 };
}

/**
 * Centroide de varios puntos.
 * @param {Vec[]} points
 * @returns {Vec}
 */
export function centroid(points) {
  const n = points.length || 1;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
    z += p.z ?? 0;
  }
  return { x: x / n, y: y / n, z: z / n };
}

/**
 * Limita un número a un rango.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
