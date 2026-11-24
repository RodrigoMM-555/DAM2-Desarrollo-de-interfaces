// @ts-check
/**
 * Ajustes del jugador, guardados en `localStorage`.
 *
 * Al leer se mezclan con los valores por defecto y se validan: si falta un
 * campo (versión antigua) o alguno es absurdo, se usa el valor por defecto.
 */
import { ZONA_POR_DEFECTO } from '../entrada/zona-juego.js';

/**
 * @typedef {object} DatosAjustes
 * @property {boolean} usarCamara Jugar con la cámara (además del teclado).
 * @property {boolean} intercambiarManos La cámara da izquierda y derecha al revés en este equipo.
 * @property {import('../entrada/zona-juego.js').Rectangulo} zona
 * @property {number} latenciaCamara Segundos que tarda la cámara en "ver" la mano.
 * @property {boolean} calibrado Si ya se ha pasado por la calibración.
 * @property {number} volumenMusica 0–1
 * @property {number} volumenEfectos 0–1
 * @property {number} antelacion Segundos que tarda una nota en bajar (menos = más rápido).
 * @property {boolean} reducirMovimiento Quitar animaciones aunque el sistema no lo pida.
 * @property {boolean} usarVoz Órdenes de voz (pausa, continuar…).
 * @property {boolean} leerResultados Leer el resultado en voz alta al terminar.
 * @property {boolean} vistaAR Realidad aumentada: la pista se dibuja sobre la imagen de la cámara.
 */

/** Límites de la antelación (velocidad de las notas). */
export const ANTELACION = Object.freeze({ minima: 1.2, maxima: 3.5 });

export const CLAVE = 'tumbao.ajustes.v1';

/** @type {DatosAjustes} */
export const POR_DEFECTO = Object.freeze({
  usarCamara: false,
  intercambiarManos: false,
  zona: { ...ZONA_POR_DEFECTO },
  latenciaCamara: 0.08,
  calibrado: false,
  volumenMusica: 0.8,
  volumenEfectos: 0.8,
  antelacion: 2,
  reducirMovimiento: false,
  usarVoz: false,
  leerResultados: false,
  vistaAR: false,
});

export class Ajustes {
  #almacen;
  /** @type {DatosAjustes} */
  #datos;

  /** @param {Pick<Storage, 'getItem' | 'setItem'>} [almacen] */
  constructor(almacen = localStorage) {
    this.#almacen = almacen;
    /** @type {any} */
    let leido = {};
    try {
      leido = JSON.parse(almacen.getItem(CLAVE) ?? '{}') ?? {};
    } catch {
      /* corrupto: por defecto */
    }
    this.#datos = validar(leido);
  }

  /** Copia de los ajustes actuales. @returns {DatosAjustes} */
  get datos() {
    return structuredClone(this.#datos);
  }

  /** @param {Partial<DatosAjustes>} cambios */
  guardar(cambios) {
    this.#datos = validar({ ...this.#datos, ...cambios });
    try {
      this.#almacen.setItem(CLAVE, JSON.stringify(this.#datos));
    } catch {
      /* sin almacenamiento: valen para esta sesión */
    }
  }
}

/** @param {any} d @returns {DatosAjustes} */
function validar(d) {
  const z = d?.zona ?? {};
  const zonaValida =
    [z.izquierda, z.derecha, z.arriba, z.abajo].every((v) => typeof v === 'number' && v >= 0 && v <= 1) &&
    z.derecha - z.izquierda >= 0.2 &&
    z.abajo - z.arriba >= 0.1;
  return {
    usarCamara: typeof d?.usarCamara === 'boolean' ? d.usarCamara : POR_DEFECTO.usarCamara,
    intercambiarManos: typeof d?.intercambiarManos === 'boolean' ? d.intercambiarManos : POR_DEFECTO.intercambiarManos,
    zona: zonaValida ? { izquierda: z.izquierda, derecha: z.derecha, arriba: z.arriba, abajo: z.abajo } : { ...POR_DEFECTO.zona },
    latenciaCamara:
      typeof d?.latenciaCamara === 'number' && d.latenciaCamara >= 0 && d.latenciaCamara <= 0.5
        ? d.latenciaCamara
        : POR_DEFECTO.latenciaCamara,
    calibrado: d?.calibrado === true,
    volumenMusica: entre(d?.volumenMusica, 0, 1, POR_DEFECTO.volumenMusica),
    volumenEfectos: entre(d?.volumenEfectos, 0, 1, POR_DEFECTO.volumenEfectos),
    antelacion: entre(d?.antelacion, ANTELACION.minima, ANTELACION.maxima, POR_DEFECTO.antelacion),
    reducirMovimiento: d?.reducirMovimiento === true,
    usarVoz: d?.usarVoz === true,
    leerResultados: d?.leerResultados === true,
    vistaAR: d?.vistaAR === true,
  };
}

/** El número si está en [min, max]; si no, el valor por defecto. */
function entre(/** @type {unknown} */ v, /** @type {number} */ min, /** @type {number} */ max, /** @type {number} */ porDefecto) {
  return typeof v === 'number' && v >= min && v <= max ? v : porDefecto;
}
