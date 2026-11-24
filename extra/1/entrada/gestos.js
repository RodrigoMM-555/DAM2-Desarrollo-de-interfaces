// @ts-check
/**
 * Gestos de movimiento del cuerpo (RA2 d): **levantar las dos manos**.
 *
 * Durante el juego las manos se mueven dentro de la zona de juego; subir las
 * dos por encima de ella es un movimiento claro y voluntario, imposible de
 * hacer sin querer mientras se juega. Se usa para pausar y para empezar.
 *
 * Para evitar falsos positivos, hay que mantener el gesto un instante
 * (`duracion`) y, tras activarse, bajar las manos antes de que vuelva a contar.
 *
 * Lógica pura: recibe las posiciones de las manos y el borde superior de la zona.
 */

/** @typedef {import('./seguidor-manos.js').PosicionesManos} PosicionesManos */

export class DetectorManosArriba {
  #duracion;
  #margen;
  /** @type {number | null} */
  #desde = null;
  #gastado = false;

  /**
   * @param {{ duracion?: number, margen?: number }} [opciones]
   *   `duracion` (s) que hay que mantenerlas arriba; `margen` por encima del borde.
   */
  constructor({ duracion = 0.6, margen = 0.03 } = {}) {
    this.#duracion = duracion;
    this.#margen = margen;
  }

  /**
   * @param {number} t Segundos.
   * @param {PosicionesManos} posiciones
   * @param {number} arriba Borde superior de la zona de juego (0–1).
   * @returns {{ arriba: boolean, progreso: number, activado: boolean }}
   */
  actualizar(t, posiciones, arriba) {
    const limite = arriba - this.#margen;
    const ambasArriba = !!posiciones.i && !!posiciones.d && posiciones.i.y < limite && posiciones.d.y < limite;
    if (!ambasArriba) {
      this.#desde = null;
      this.#gastado = false;
      return { arriba: false, progreso: 0, activado: false };
    }
    this.#desde ??= t;
    if (this.#gastado) return { arriba: true, progreso: 0, activado: false };
    const progreso = Math.min(1, (t - this.#desde) / this.#duracion);
    if (progreso >= 1) this.#gastado = true;
    return { arriba: true, progreso, activado: progreso >= 1 };
  }
}
