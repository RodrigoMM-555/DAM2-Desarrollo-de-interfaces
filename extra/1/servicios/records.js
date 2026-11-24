// @ts-check
/**
 * Récords por canción y dificultad, guardados en `localStorage`.
 *
 * El almacén se puede cambiar (en las pruebas se pasa uno falso) y la clave
 * lleva versión: si algún día cambia el formato, se cambia la clave y los
 * datos viejos no rompen nada.
 */

/** @typedef {import('../motor/puntuacion.js').Resumen} Resumen */

/**
 * @typedef {object} Record
 * @property {number} puntos
 * @property {number} precision
 * @property {string} nota
 * @property {number} comboMaximo
 * @property {string} fecha ISO
 */

export const CLAVE = 'tumbao.records.v1';

export class Records {
  #almacen;
  /** @type {Record<string, Record>} */
  #datos;

  /** @param {Pick<Storage, 'getItem' | 'setItem'>} [almacen] */
  constructor(almacen = localStorage) {
    this.#almacen = almacen;
    try {
      const leido = JSON.parse(almacen.getItem(CLAVE) ?? '{}');
      this.#datos = leido && typeof leido === 'object' && !Array.isArray(leido) ? leido : {};
    } catch {
      this.#datos = {}; // datos corruptos: se empieza de cero
    }
  }

  /** @param {string} cancion @param {string} dificultad @returns {Record | null} */
  obtener(cancion, dificultad) {
    return this.#datos[`${cancion}/${dificultad}`] ?? null;
  }

  /** Borra todos los récords. */
  borrar() {
    this.#datos = {};
    try {
      this.#almacen.setItem(CLAVE, '{}');
    } catch {
      /* nada que hacer */
    }
  }

  /**
   * Guarda el resultado si mejora el récord.
   * @param {string} cancion @param {string} dificultad @param {Resumen} resumen
   * @returns {boolean} `true` si es un récord nuevo.
   */
  guardar(cancion, dificultad, resumen) {
    const anterior = this.obtener(cancion, dificultad);
    if (anterior && anterior.puntos >= resumen.puntos) return false;
    this.#datos[`${cancion}/${dificultad}`] = {
      puntos: resumen.puntos,
      precision: resumen.precision,
      nota: resumen.nota,
      comboMaximo: resumen.comboMaximo,
      fecha: new Date().toISOString(),
    };
    try {
      this.#almacen.setItem(CLAVE, JSON.stringify(this.#datos));
    } catch {
      /* almacenamiento lleno o bloqueado: el récord vale para esta sesión */
    }
    return true;
  }
}
