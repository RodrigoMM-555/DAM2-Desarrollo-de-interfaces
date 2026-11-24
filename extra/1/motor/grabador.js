// @ts-check
/**
 * Grabador de partituras: mientras suena la música, el jugador coloca las
 * manos al ritmo y cada entrada en un carril se convierte en una nota.
 *
 * - **Cuantización:** el instante se redondea al pulso o medio pulso más
 *   cercano (nadie es exacto, la partitura sí debe serlo).
 * - **Mantener:** si la mano se queda 2 pulsos o más, la nota es de mantener.
 * - **Limpieza:** se descartan los roces (< 0,1 s en el carril) y las notas
 *   que no se podrían jugar (misma mano en dos sitios, cambios imposibles),
 *   con las mismas reglas que el validador de partituras.
 *
 * Lógica pura: recibe tiempos y estados de manos (del teclado o la cámara).
 */
import { SEPARACION_MINIMA } from './partitura.js';

/** @typedef {import('./partitura.js').NotaPartitura} NotaPartitura */
/** @typedef {import('./juez.js').EstadoManos} EstadoManos */

/** Segundos mínimos en un carril para que cuente como nota. */
export const ROCE = 0.1;
/** Pulsos mínimos para que una nota sea de mantener. */
export const PULSOS_MANTENER = 2;

export class GrabadorPartitura {
  #bpm;
  #cuantizacion;
  #desfase;
  /** @type {{ i: number | null, d: number | null }} */
  #actual = { i: null, d: null };
  /** @type {{ mano: 'i' | 'd', carril: number, entrada: number, salida: number | null }[]} */
  #entradas = [];

  /**
   * @param {{ bpm: number, cuantizacion?: number, desfase?: number }} opciones
   *   `cuantizacion` en pulsos (1 = negras, 0,5 = corcheas).
   */
  constructor({ bpm, cuantizacion = 0.5, desfase = 0 }) {
    if (!(bpm > 0) || !(cuantizacion > 0)) throw new RangeError('GrabadorPartitura: bpm y cuantización deben ser > 0.');
    this.#bpm = bpm;
    this.#cuantizacion = cuantizacion;
    this.#desfase = desfase;
  }

  /**
   * Registra el estado de las manos en el instante `t` (segundos de la canción).
   * @param {number} t
   * @param {EstadoManos} manos
   */
  registrar(t, manos) {
    for (const mano of /** @type {const} */ (['i', 'd'])) {
      const carril = manos[mano] ?? null;
      if (carril === this.#actual[mano]) continue;
      this.#cerrar(mano, t);
      if (carril !== null) this.#entradas.push({ mano, carril, entrada: t, salida: null });
      this.#actual[mano] = carril;
    }
  }

  /** Termina la grabación en `t` y devuelve las notas. @param {number} t */
  terminar(t) {
    this.#cerrar('i', t);
    this.#cerrar('d', t);
    this.#actual = { i: null, d: null };
    return this.notas();
  }

  /** @param {'i' | 'd'} mano @param {number} t */
  #cerrar(mano, t) {
    const abierta = this.#entradas.findLast((e) => e.mano === mano && e.salida === null);
    if (abierta) abierta.salida = t;
  }

  /** @returns {NotaPartitura[]} Notas ordenadas y jugables. */
  notas() {
    const ppS = this.#bpm / 60; // pulsos por segundo
    const q = this.#cuantizacion;
    /** @type {NotaPartitura[]} */
    const brutas = [];
    for (const e of this.#entradas) {
      const salida = e.salida ?? e.entrada;
      if (e.salida !== null && salida - e.entrada < ROCE) continue;
      const pulso = Math.round(((e.entrada - this.#desfase) * ppS) / q) * q;
      if (pulso < 0) continue;
      const pulsosDentro = (salida - e.entrada) * ppS;
      /** @type {NotaPartitura} */
      const nota = { pulso: redondear(pulso), mano: e.mano, carril: e.carril };
      if (pulsosDentro >= PULSOS_MANTENER) nota.duracion = Math.floor(pulsosDentro);
      brutas.push(nota);
    }
    brutas.sort((a, b) => a.pulso - b.pulso || a.carril - b.carril);

    // Quitar lo injugable, mano por mano.
    const separacion = SEPARACION_MINIMA * ppS; // en pulsos
    /** @type {Record<'i' | 'd', NotaPartitura | null>} */
    const anterior = { i: null, d: null };
    return brutas.filter((n) => {
      const previa = anterior[n.mano];
      if (previa) {
        const libre = previa.pulso + (previa.duracion ?? 0);
        if (n.pulso <= previa.pulso || n.pulso < libre) return false;
        if (n.carril !== previa.carril && n.pulso - libre < separacion) return false;
      }
      anterior[n.mano] = n;
      return true;
    });
  }
}

/** Evita cosas como 7.499999999 en el JSON. @param {number} v */
const redondear = (v) => Math.round(v * 1000) / 1000;
