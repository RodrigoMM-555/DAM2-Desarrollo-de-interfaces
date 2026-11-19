/**
 * Calibración: qué parte de la imagen de la cámara corresponde al lienzo.
 *
 * Dibujar usando toda la imagen obligaría a mover mucho el brazo y a
 * acercarse a los bordes, donde el seguimiento empeora. En su lugar se usa
 * una **zona cuadrada** (en píxeles reales) que se proyecta sobre el lienzo
 * cuadrado: movimientos cómodos cubren todo el glifo y un círculo trazado en
 * el aire sigue siendo un círculo en el lienzo.
 *
 * La calibración se guarda como `{ cx, cy, size }` (centro y lado relativo
 * al alto de la imagen) para que no dependa de la resolución de la cámara.
 */

/** @typedef {{ cx: number, cy: number, size: number }} Calibration */
/** @typedef {{ x: number, y: number, width: number, height: number }} Zone */

/** Calibración predeterminada: cuadrado centrado del 85 % del alto. */
export const DEFAULT_CALIBRATION = Object.freeze({ cx: 0.5, cy: 0.5, size: 0.85 });

const MIN_SIZE = 0.25;
const MAX_SIZE = 1;

/**
 * Convierte una calibración en una zona normalizada de la imagen.
 * La zona se desplaza si hace falta para no salirse de la imagen.
 *
 * @param {Calibration} calibration
 * @param {{ imageWidth?: number, imageHeight?: number }} [image]
 * @returns {Zone}
 */
export function calibrationToZone({ cx, cy, size }, { imageWidth = 640, imageHeight = 480 } = {}) {
  const height = clamp(size, MIN_SIZE, MAX_SIZE);
  const width = Math.min(1, (height * imageHeight) / imageWidth);
  const x = clamp(cx - width / 2, 0, 1 - width);
  const y = clamp(cy - height / 2, 0, 1 - height);
  return { x, y, width, height };
}

/**
 * Calcula una calibración a partir del recorrido de un círculo trazado con
 * comodidad. Añade un margen para no tener que llegar al límite.
 *
 * @param {{ x: number, y: number }[]} points Puntos normalizados de la imagen.
 * @param {{ imageWidth?: number, imageHeight?: number, margin?: number }} [options]
 * @returns {Calibration}
 * @throws {RangeError} si el recorrido es demasiado corto o pequeño.
 */
export function calibrationFromPath(points, { imageWidth = 640, imageHeight = 480, margin = 1.5 } = {}) {
  if (!Array.isArray(points) || points.length < 8) {
    throw new RangeError('Traza un círculo más largo para calibrar.');
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const widthPx = (maxX - minX) * imageWidth;
  const heightPx = (maxY - minY) * imageHeight;
  const side = Math.max(widthPx, heightPx) * margin;
  if (side / imageHeight < 0.1) {
    throw new RangeError('El círculo es demasiado pequeño: trázalo más grande.');
  }
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    size: clamp(side / imageHeight, MIN_SIZE, MAX_SIZE),
  };
}

/**
 * Proyecta un punto de la imagen sobre el lienzo (0-1).
 * Con `mirror` la izquierda de la persona queda a la izquierda de la
 * pantalla, como en un espejo.
 *
 * @param {{ x: number, y: number }} point
 * @param {Zone} zone
 * @param {{ mirror?: boolean }} [options]
 * @returns {{ x: number, y: number }}
 */
export function mapToCanvas(point, zone, { mirror = true } = {}) {
  const u = (point.x - zone.x) / zone.width;
  const v = (point.y - zone.y) / zone.height;
  return { x: mirror ? 1 - u : u, y: v };
}

/**
 * Comprueba que un objeto es una calibración válida.
 * @param {unknown} value
 * @returns {value is Calibration}
 */
export function isCalibration(value) {
  const c = /** @type {Calibration} */ (value);
  return Boolean(c) && [c.cx, c.cy, c.size].every(Number.isFinite) && c.size > 0;
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
