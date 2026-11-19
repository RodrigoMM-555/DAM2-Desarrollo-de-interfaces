/**
 * Geometría de trazos: funciones puras sobre listas de puntos `{ x, y }`.
 */

/** @typedef {{ x: number, y: number }} Point */

/**
 * Longitud de una polilínea.
 * @param {readonly Point[]} points
 */
export function pathLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return length;
}

/**
 * Remuestrea una polilínea en `n` puntos equidistantes a lo largo de su
 * recorrido. Así dos trazos dibujados a distinta velocidad (y por tanto con
 * distinto número de puntos) se pueden comparar punto a punto.
 *
 * @param {readonly Point[]} points
 * @param {number} n Número de puntos resultante (≥ 2).
 * @returns {Point[]}
 */
export function resample(points, n) {
  if (!points.length) return [];
  if (points.length === 1 || n < 2) return Array.from({ length: Math.max(1, n) }, () => ({ ...points[0] }));
  const total = pathLength(points);
  if (total === 0) return Array.from({ length: n }, () => ({ ...points[0] }));

  const step = total / (n - 1);
  /** @type {Point[]} */
  const out = [{ x: points[0].x, y: points[0].y }];
  let carried = 0; // distancia recorrida desde el último punto emitido
  let prev = points[0];
  for (let i = 1; i < points.length && out.length < n; i++) {
    let current = points[i];
    let segment = Math.hypot(current.x - prev.x, current.y - prev.y);
    while (carried + segment >= step && out.length < n) {
      const t = (step - carried) / segment;
      const point = { x: prev.x + (current.x - prev.x) * t, y: prev.y + (current.y - prev.y) * t };
      out.push(point);
      prev = point;
      segment = Math.hypot(current.x - prev.x, current.y - prev.y);
      carried = 0;
    }
    carried += segment;
    prev = current;
  }
  while (out.length < n) out.push({ ...points[points.length - 1] });
  return out;
}

/**
 * Caja que contiene los puntos.
 * @param {readonly Point[]} points
 */
export function boundingBox(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * @typedef {object} CircleFit
 * @property {number} cx
 * @property {number} cy
 * @property {number} r
 * @property {number} residual Error cuadrático medio de la distancia al centro, relativo al radio (0 = círculo perfecto).
 */

/**
 * Ajusta una circunferencia por mínimos cuadrados (método de Kåsa).
 *
 * Busca D, E, F que minimizan Σ (x² + y² + D·x + E·y + F)². Es un sistema
 * lineal 3×3, rápido y suficientemente preciso para trazos a mano alzada.
 * Centro = (−D/2, −E/2); radio = √(cx² + cy² − F).
 *
 * @param {readonly Point[]} points
 * @returns {CircleFit | null} `null` si los puntos están alineados o son pocos.
 */
export function fitCircle(points) {
  if (points.length < 3) return null;
  // Se centra en la media para mejorar la estabilidad numérica.
  const mx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const my = points.reduce((s, p) => s + p.y, 0) / points.length;
  let sxx = 0, syy = 0, sxy = 0, sx = 0, sy = 0, sz = 0, sxz = 0, syz = 0;
  for (const p of points) {
    const x = p.x - mx;
    const y = p.y - my;
    const z = x * x + y * y;
    sxx += x * x; syy += y * y; sxy += x * y;
    sx += x; sy += y; sz += z;
    sxz += x * z; syz += y * z;
  }
  const n = points.length;
  // [sxx sxy sx][D]   [-sxz]
  // [sxy syy sy][E] = [-syz]
  // [sx  sy  n ][F]   [-sz ]
  const solution = solve3(
    [
      [sxx, sxy, sx],
      [sxy, syy, sy],
      [sx, sy, n],
    ],
    [-sxz, -syz, -sz],
  );
  if (!solution) return null;
  const [D, E, F] = solution;
  const cx = -D / 2;
  const cy = -E / 2;
  const r2 = cx * cx + cy * cy - F;
  if (!(r2 > 0)) return null;
  const r = Math.sqrt(r2);
  let err = 0;
  for (const p of points) {
    const d = Math.hypot(p.x - mx - cx, p.y - my - cy) - r;
    err += d * d;
  }
  return { cx: cx + mx, cy: cy + my, r, residual: Math.sqrt(err / n) / r };
}

/**
 * Resuelve un sistema 3×3 por eliminación gaussiana con pivoteo.
 * @param {number[][]} a
 * @param {number[]} b
 * @returns {number[] | null}
 */
function solve3(a, b) {
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let r = col + 1; r < 3; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    if (Math.abs(m[pivot][col]) < 1e-12) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const f = m[r][col] / m[col][col];
      for (let c = col; c < 4; c++) m[r][c] -= f * m[col][c];
    }
  }
  return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
}

/**
 * Fracción de la vuelta completa (0-1) que recorre un trazo alrededor de un centro.
 * @param {readonly Point[]} points
 * @param {number} cx
 * @param {number} cy
 * @param {number} [bins=36] Sectores de 10°.
 */
export function angularCoverage(points, cx, cy, bins = 36) {
  const seen = new Set();
  for (const p of points) {
    const a = Math.atan2(p.y - cy, p.x - cx);
    seen.add(Math.min(bins - 1, Math.floor(((a + Math.PI) / (2 * Math.PI)) * bins)));
  }
  return seen.size / bins;
}

/**
 * Área con signo (fórmula del cordón), cerrando el polígono.
 * En coordenadas de pantalla (y hacia abajo): positiva = sentido horario.
 * @param {readonly Point[]} points
 */
export function signedArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

/**
 * Distancia media de cada punto de `a` a su punto más cercano de `b`.
 * @param {readonly Point[]} a
 * @param {readonly Point[]} b
 */
export function directedChamfer(a, b) {
  if (!a.length || !b.length) return Infinity;
  let sum = 0;
  for (const p of a) {
    let best = Infinity;
    for (const q of b) {
      const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
      if (d < best) best = d;
    }
    sum += Math.sqrt(best);
  }
  return sum / a.length;
}

/**
 * Distancia de Chamfer simétrica: media de las dos direcciones.
 * Penaliza tanto lo que falta (b → a) como lo que sobra (a → b) y no
 * depende del orden ni del sentido en que se dibujaron los puntos.
 * @param {readonly Point[]} a
 * @param {readonly Point[]} b
 */
export function chamfer(a, b) {
  return (directedChamfer(a, b) + directedChamfer(b, a)) / 2;
}

/**
 * Distancia media punto a punto entre dos trazos ya remuestreados al mismo
 * número de puntos (sensible al sentido del trazo).
 * @param {readonly Point[]} a
 * @param {readonly Point[]} b
 */
export function pointwiseDistance(a, b) {
  const n = Math.min(a.length, b.length);
  if (!n) return Infinity;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  return sum / n;
}
