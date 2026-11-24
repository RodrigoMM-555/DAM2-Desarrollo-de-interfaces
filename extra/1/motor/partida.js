// @ts-check
/**
 * Una partida: une la partitura, el juez y la puntuación con un reloj.
 *
 * No sabe nada del DOM, del audio ni de la entrada: recibe un `reloj`
 * (cualquier objeto con `tiempo()`) y el estado de las manos. En el juego el
 * reloj es el MotorAudio; en las pruebas, uno falso que avanzamos a mano.
 *
 * Eventos:
 * - `juzgada` → { juicio, puntos, resumen } por cada nota juzgada.
 * - `fin`     → { resumen } cuando ya no quedan notas y la canción acaba.
 */
import { prepararNotas, segundosPorPulso } from './partitura.js';
import { Juez } from './juez.js';
import { Puntuacion } from './puntuacion.js';

/** @typedef {import('./juez.js').EstadoManos} EstadoManos */
/** @typedef {import('./juez.js').Juicio} Juicio */

/** Segundos de cortesía tras la última nota antes de terminar. */
export const COLA_FINAL = 1.5;

export class Partida extends EventTarget {
  /** @type {import('./partitura.js').Nota[]} */
  notas;
  juez;
  puntuacion = new Puntuacion();
  /** @type {EstadoManos} */
  manos = { i: null, d: null };
  terminada = false;
  /** Instante de la canción en el que termina la partida. */
  fin;
  #reloj;
  #latencia;

  /**
   * @param {object} opciones
   * @param {import('./partitura.js').Cancion} opciones.cancion
   * @param {string} opciones.dificultad
   * @param {{ tiempo(): number }} opciones.reloj
   * @param {number} [opciones.latenciaEntrada] Retraso de la entrada (s): se resta al tiempo.
   */
  constructor({ cancion, dificultad, reloj, latenciaEntrada = 0 }) {
    super();
    this.notas = prepararNotas(cancion, dificultad);
    this.juez = new Juez(this.notas, { pulso: segundosPorPulso(cancion.bpm) });
    this.#reloj = reloj;
    this.#latencia = latenciaEntrada;
    // La última en terminar puede ser una nota de mantener anterior a la última.
    this.fin = Math.max(...this.notas.map((n) => n.tiempo + n.duracion)) + COLA_FINAL;
  }

  /** @param {EstadoManos} manos */
  ponerManos(manos) {
    this.manos = { i: manos.i ?? null, d: manos.d ?? null };
  }

  /**
   * Avanza la partida. Se llama en cada fotograma.
   * @returns {{ t: number, juicios: Juicio[] }}
   */
  fotograma() {
    const t = this.#reloj.tiempo();
    if (this.terminada) return { t, juicios: [] };
    const juicios = this.juez.actualizar(t - this.#latencia, this.manos);
    for (const juicio of juicios) {
      const puntos = this.puntuacion.registrar(juicio.calificacion);
      this.dispatchEvent(
        new CustomEvent('juzgada', { detail: { juicio, puntos, resumen: this.puntuacion.resumen } }),
      );
    }
    if (t >= this.fin && this.juez.pendientes === 0) {
      this.terminada = true;
      this.dispatchEvent(new CustomEvent('fin', { detail: { resumen: this.puntuacion.resumen } }));
    }
    return { t, juicios };
  }
}
