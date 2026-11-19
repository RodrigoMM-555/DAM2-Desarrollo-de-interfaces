import { placeGlyph } from '../nucleo/glifos/modelo-glifo.js';

/** @typedef {import('../nucleo/glifos/modelo-glifo.js').Glyph} Glyph */
/** @typedef {{ x: number, y: number }} Point */

/**
 * Generador pseudoaleatorio reproducible (mismo `seed` → mismo dibujo).
 * @param {number} seed
 */
export function seededRandom(seed = 1) {
  let s = Math.floor(seed) % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Simula a una persona dibujando un glifo sobre un lienzo normalizado.
 *
 * Añade dos tipos de imperfección: una **ondulación** suave (el pulso que se
 * desvía poco a poco) y un **temblor** fino en cada punto.
 *
 * @param {Glyph} glyph
 * @param {object} [options]
 * @param {number} [options.cx=0.5] Centro del círculo en el lienzo.
 * @param {number} [options.cy=0.5]
 * @param {number} [options.r=0.4] Radio del círculo en el lienzo.
 * @param {number} [options.wobble=0.03] Amplitud de la ondulación (relativa al radio).
 * @param {number} [options.jitter=0.004] Amplitud del temblor (unidades del lienzo).
 * @param {number} [options.seed=1]
 * @param {number[]} [options.order] Orden en que se dibujan los trazos (índices del glifo).
 * @param {number[]} [options.reverse] Trazos dibujados en sentido contrario.
 * @param {number} [options.circleGap=0] Parte final del círculo que se deja sin cerrar (0-1).
 * @returns {{ points: Point[] }[]}
 */
export function drawGlyphLike(
  glyph,
  { cx = 0.5, cy = 0.5, r = 0.4, wobble = 0.03, jitter = 0.004, seed = 1, order, reverse = [], circleGap = 0 } = {},
) {
  const random = seededRandom(seed);
  const placed = placeGlyph(glyph, { cx, cy, r });
  const indices = order ?? placed.map((_, i) => i);
  return indices.map((i) => {
    let points = placed[i];
    if (i === 0 && circleGap > 0) points = points.slice(0, Math.max(2, Math.round(points.length * (1 - circleGap))));
    if (reverse.includes(i)) points = [...points].reverse();
    const phase = random() * Math.PI * 2;
    const freq = 1.5 + random() * 2;
    return {
      points: points.map((p, k) => {
        const t = k / Math.max(1, points.length - 1);
        return {
          x: p.x + Math.sin(phase + t * freq * Math.PI * 2) * wobble * r + (random() - 0.5) * 2 * jitter,
          y: p.y + Math.cos(phase * 1.3 + t * freq * Math.PI * 2) * wobble * r + (random() - 0.5) * 2 * jitter,
        };
      }),
    };
  });
}

/**
 * Divide un trazo en `parts` trazos consecutivos (p. ej. un triángulo
 * dibujado como tres líneas sueltas).
 * @param {{ points: Point[] }} stroke
 * @param {number} parts
 */
export function splitStroke(stroke, parts) {
  const size = Math.ceil(stroke.points.length / parts);
  return Array.from({ length: parts }, (_, i) => ({ points: stroke.points.slice(i * size, (i + 1) * size + 1) }));
}
