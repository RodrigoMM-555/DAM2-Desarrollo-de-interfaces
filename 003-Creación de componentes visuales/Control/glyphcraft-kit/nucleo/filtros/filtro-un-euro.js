/**
 * Filtro "One Euro" (Casiez, Roussel y Vogel, CHI 2012).
 *
 * Problema: la posición de la mano detectada tiembla unos píxeles en cada
 * fotograma. Un suavizado fijo quita el temblor, pero añade retardo: el trazo
 * va "detrás" de la mano cuando te mueves rápido.
 *
 * Solución: un filtro paso bajo cuya frecuencia de corte se adapta a la
 * velocidad.
 * - Mano lenta → corte bajo → suaviza mucho (adiós temblor).
 * - Mano rápida → corte alto → casi no suaviza (sin retardo).
 *
 * Parámetros:
 * - `minCutoff` (Hz): suavizado en reposo. Menor = más suave.
 * - `beta`: cuánto sube el corte con la velocidad. Mayor = menos retardo.
 * - `dCutoff` (Hz): suavizado de la propia estimación de velocidad.
 */

/**
 * @typedef {object} OneEuroOptions
 * @property {number} [minCutoff=1.5]
 * @property {number} [beta=6]
 * @property {number} [dCutoff=1]
 */

/**
 * Coeficiente de suavizado exponencial para una frecuencia de corte.
 * @param {number} cutoff Hz
 * @param {number} dt Segundos
 */
function smoothingFactor(cutoff, dt) {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

export class FiltroUnEuro {
  #minCutoff;
  #beta;
  #dCutoff;
  /** @type {number | null} */
  #prevValue = null;
  #prevDerivative = 0;
  /** @type {number | null} */
  #prevTime = null;

  /** @param {OneEuroOptions} [options] */
  constructor({ minCutoff = 1.5, beta = 6, dCutoff = 1 } = {}) {
    if (!(minCutoff > 0) || !(dCutoff > 0) || !(beta >= 0)) {
      throw new RangeError('FiltroUnEuro: minCutoff y dCutoff deben ser > 0 y beta >= 0.');
    }
    this.#minCutoff = minCutoff;
    this.#beta = beta;
    this.#dCutoff = dCutoff;
  }

  /**
   * Filtra un valor.
   *
   * @param {number} value Valor medido.
   * @param {number} time Instante en segundos (debe crecer).
   * @returns {number} Valor suavizado.
   */
  filter(value, time) {
    if (this.#prevValue === null || this.#prevTime === null || time <= this.#prevTime) {
      // Primer valor (o reloj que no avanza): no hay historial que suavizar.
      if (this.#prevValue === null || this.#prevTime === null) {
        this.#prevValue = value;
        this.#prevTime = time;
      }
      return this.#prevValue;
    }
    const dt = time - this.#prevTime;
    const derivative = (value - this.#prevValue) / dt;
    const dAlpha = smoothingFactor(this.#dCutoff, dt);
    const smoothedDerivative = dAlpha * derivative + (1 - dAlpha) * this.#prevDerivative;

    const cutoff = this.#minCutoff + this.#beta * Math.abs(smoothedDerivative);
    const alpha = smoothingFactor(cutoff, dt);
    const result = alpha * value + (1 - alpha) * this.#prevValue;

    this.#prevValue = result;
    this.#prevDerivative = smoothedDerivative;
    this.#prevTime = time;
    return result;
  }

  /** Olvida el historial (por ejemplo, al empezar un trazo nuevo). */
  reset() {
    this.#prevValue = null;
    this.#prevDerivative = 0;
    this.#prevTime = null;
  }
}

/**
 * Dos filtros One Euro para un punto 2D.
 */
export class FiltroPunto {
  #x;
  #y;

  /** @param {OneEuroOptions} [options] */
  constructor(options) {
    this.#x = new FiltroUnEuro(options);
    this.#y = new FiltroUnEuro(options);
  }

  /**
   * @param {{ x: number, y: number }} point
   * @param {number} time Segundos.
   * @returns {{ x: number, y: number }}
   */
  filter(point, time) {
    return { x: this.#x.filter(point.x, time), y: this.#y.filter(point.y, time) };
  }

  reset() {
    this.#x.reset();
    this.#y.reset();
  }
}
