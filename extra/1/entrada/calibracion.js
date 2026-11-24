// @ts-check
/**
 * Comprobación de izquierda/derecha de la calibración.
 *
 * El jugador levanta solo la mano izquierda y luego solo la derecha. Mientras,
 * se cuentan las etiquetas que da la cámara (ya corregidas con el ajuste de
 * espejo actual). Con eso se decide si hay que invertir el ajuste y si el
 * resultado es fiable.
 *
 * Lógica pura.
 */

/** @typedef {{ i: number, d: number }} Conteo */

/** Fotogramas mínimos (sumando los dos pasos) para fiarse. */
export const MINIMO_FOTOGRAMAS = 20;
/** Proporción mínima de etiquetas coherentes para fiarse. */
export const PROPORCION_FIABLE = 0.75;

/**
 * @param {Conteo} conIzquierda Etiquetas vistas mientras se levantaba la izquierda.
 * @param {Conteo} conDerecha Etiquetas vistas mientras se levantaba la derecha.
 * @returns {{ invertir: boolean, fiable: boolean, proporcion: number }}
 */
export function decidirEspejo(conIzquierda, conDerecha) {
  const bien = conIzquierda.i + conDerecha.d; // coincide con el ajuste actual
  const alReves = conIzquierda.d + conDerecha.i; // justo lo contrario
  const total = bien + alReves;
  const faltaUnPaso = conIzquierda.i + conIzquierda.d === 0 || conDerecha.i + conDerecha.d === 0;
  if (total < MINIMO_FOTOGRAMAS || faltaUnPaso) {
    return { invertir: false, fiable: false, proporcion: 0 };
  }
  const invertir = alReves > bien;
  const proporcion = Math.max(bien, alReves) / total;
  return { invertir, fiable: proporcion >= PROPORCION_FIABLE, proporcion };
}

/** Muestras mínimas para dar por buena una medición de retraso. */
export const MINIMO_MUESTRAS = 5;
/** Retraso máximo que se acepta (s): más sería un error de medida. */
export const LATENCIA_MAXIMA = 0.3;

/**
 * Estima el retraso de la cámara con el metrónomo: el jugador cambia la mano
 * de carril con cada clic y se mide cuánto después lo registra el juego.
 *
 * Para cada clic se toma el primer cambio que cae cerca (de 0,25 s antes a
 * 0,4 s después). El resultado es la **mediana** de esas diferencias: un
 * cambio despistado no la mueve, como pasaría con la media.
 *
 * @param {number[]} cambios Instantes (s) en que el juego registró un cambio de carril.
 * @param {number[]} clics Instantes (s) en que sonó cada clic.
 * @returns {{ latencia: number, muestras: number } | null} `null` si no hay datos suficientes.
 */
export function estimarLatencia(cambios, clics) {
  const usados = new Set();
  /** @type {number[]} */
  const diferencias = [];
  for (const clic of clics) {
    const k = cambios.findIndex((c, i) => !usados.has(i) && c >= clic - 0.25 && c <= clic + 0.4);
    if (k < 0) continue;
    usados.add(k);
    diferencias.push(cambios[k] - clic);
  }
  if (diferencias.length < MINIMO_MUESTRAS) return null;
  diferencias.sort((a, b) => a - b);
  const mitad = diferencias.length >> 1;
  const mediana = diferencias.length % 2 ? diferencias[mitad] : (diferencias[mitad - 1] + diferencias[mitad]) / 2;
  return { latencia: Math.min(LATENCIA_MAXIMA, Math.max(0, mediana)), muestras: diferencias.length };
}
