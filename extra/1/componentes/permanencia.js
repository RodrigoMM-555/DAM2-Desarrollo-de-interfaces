// @ts-check
/**
 * Pulsar sin tocar: un botón se activa cuando la mano se queda encima un
 * tiempo (técnica de "permanencia" o *dwell*, típica de las interfaces sin
 * contacto, en las que no hay clic).
 *
 * Reglas:
 * - El progreso empieza al llegar a un objetivo y se reinicia si cambia.
 * - Al completarse, se activa **una vez**. Para volver a activarlo hay que
 *   salir y volver a entrar (así no se pulsa en bucle sin querer).
 *
 * Lógica pura: recibe el objetivo (cualquier cosa) y el tiempo.
 */

/**
 * @template T
 * @typedef {object} EstadoPermanencia
 * @property {T | null} objetivo
 * @property {number} progreso 0–1
 * @property {boolean} activado `true` solo en la llamada en que se completa.
 */

/** @template T */
export class Permanencia {
  #duracion;
  /** @type {T | null} */
  #objetivo = null;
  #desde = 0;
  #gastado = false;

  /** @param {number} [duracion] Segundos que hay que mantener la mano. */
  constructor(duracion = 1) {
    this.#duracion = duracion;
  }

  /**
   * @param {T | null} objetivo Lo que hay bajo la mano (o `null`).
   * @param {number} t Segundos.
   * @returns {EstadoPermanencia<T>}
   */
  actualizar(objetivo, t) {
    if (objetivo !== this.#objetivo) {
      this.#objetivo = objetivo;
      this.#desde = t;
      this.#gastado = false;
    }
    if (objetivo === null || this.#gastado) return { objetivo, progreso: 0, activado: false };
    const progreso = Math.min(1, (t - this.#desde) / this.#duracion);
    if (progreso >= 1) this.#gastado = true;
    return { objetivo, progreso, activado: progreso >= 1 };
  }
}

/**
 * Pasa la posición de la mano (coordenadas del jugador, 0–1) a la pantalla.
 * Solo se usa la parte central de la imagen: así se llega a las esquinas de
 * la pantalla sin estirar el brazo hasta el borde de la cámara.
 *
 * @param {{ x: number, y: number }} punto
 * @param {number} ancho Píxeles.
 * @param {number} alto Píxeles.
 */
export function aPantalla(punto, ancho, alto) {
  const ajustar = (/** @type {number} */ v, /** @type {number} */ desde, /** @type {number} */ tramo) =>
    Math.min(1, Math.max(0, (v - desde) / tramo));
  return { x: ajustar(punto.x, 0.2, 0.6) * ancho, y: ajustar(punto.y, 0.15, 0.55) * alto };
}
