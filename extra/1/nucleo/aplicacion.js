// @ts-check
/**
 * La aplicación: crea los servicios compartidos y cambia de vista cuando
 * cambia la ruta. Es el **mediador**: las vistas no se conocen entre sí, solo
 * hablan con la aplicación (`this.app`).
 */
import { Enrutador } from './enrutador.js';
import { MotorAudio } from '../audio/motor-audio.js';
import { Records } from '../servicios/records.js';
import { Ajustes } from '../servicios/ajustes.js';
import { EntradaCamara } from '../entrada/camara.js';

/** @typedef {import('../motor/partitura.js').Cancion} Cancion */

/**
 * @typedef {object} ResultadoPartida
 * @property {Cancion} cancion
 * @property {string} dificultad
 * @property {import('../motor/puntuacion.js').Resumen} resumen
 * @property {boolean} nuevoRecord
 */

export const RUTAS = [
  { patron: '/', vista: 'tb-vista-menu', titulo: 'Menú' },
  { patron: '/canciones', vista: 'tb-vista-canciones', titulo: 'Canciones' },
  { patron: '/partida/:cancion/:dificultad', vista: 'tb-vista-partida', titulo: 'Partida' },
  { patron: '/resultados', vista: 'tb-vista-resultados', titulo: 'Resultados' },
  { patron: '/calibracion', vista: 'tb-vista-calibracion', titulo: 'Calibrar la cámara' },
  { patron: '/ajustes', vista: 'tb-vista-ajustes', titulo: 'Ajustes' },
  { patron: '/editor', vista: 'tb-vista-editor', titulo: 'Editor de partituras' },
];

const CARPETA_CANCIONES = new URL('../canciones/', import.meta.url);

export class Aplicacion {
  audio = new MotorAudio();
  records = new Records();
  ajustes = new Ajustes();
  /** Una sola entrada de cámara para toda la app (el modelo se carga una vez). */
  camara = new EntradaCamara();
  enrutador = new Enrutador(RUTAS);
  /** @type {ResultadoPartida | null} */
  ultimoResultado = null;
  #raiz;
  /** @type {Map<string, Promise<Cancion>>} */
  #canciones = new Map();
  /** @type {Promise<{ id: string, archivo: string }[]> | null} */
  #lista = null;

  /** @param {HTMLElement} raiz Donde se montan las vistas. */
  constructor(raiz) {
    this.#raiz = raiz;
    this.enrutador.addEventListener('cambio', (e) => this.#mostrar(/** @type {CustomEvent} */ (e).detail));
  }

  iniciar() {
    this.aplicarAjustes();
    this.enrutador.iniciar();
  }

  /** Aplica los ajustes que afectan a toda la app (volumen, movimiento). */
  aplicarAjustes() {
    const a = this.ajustes.datos;
    this.audio.volumen(a.volumenMusica, a.volumenEfectos);
    document.documentElement.classList.toggle('reducir-movimiento', a.reducirMovimiento);
  }

  /** @param {string} camino */
  ir(camino) {
    this.enrutador.ir(camino);
  }

  /** Carpeta de las canciones (para resolver sus archivos de audio). */
  get carpetaCanciones() {
    return CARPETA_CANCIONES.href;
  }

  /** @returns {Promise<Cancion[]>} Todas las canciones, en el orden de `lista.json`. */
  async canciones() {
    this.#lista ??= leerJson(new URL('lista.json', CARPETA_CANCIONES));
    const lista = await this.#lista;
    return Promise.all(lista.map((c) => this.cancion(c.id)));
  }

  /**
   * Añade una canción que no está en `canciones/` (la del editor). Solo dura
   * esta sesión: para que se quede, se descarga el JSON y se añade a la carpeta.
   * @param {Cancion} cancion
   */
  registrarCancion(cancion) {
    this.#canciones.set(cancion.id, Promise.resolve(cancion));
  }

  /** @param {string} id @returns {Promise<Cancion>} */
  async cancion(id) {
    if (!/^[\w-]+$/.test(id)) throw new Error(`Identificador de canción no válido: ${id}`);
    let promesa = this.#canciones.get(id);
    if (!promesa) {
      promesa = leerJson(new URL(`${id}.json`, CARPETA_CANCIONES));
      promesa.catch(() => this.#canciones.delete(id));
      this.#canciones.set(id, promesa);
    }
    return promesa;
  }

  /** @param {{ ruta: import('./enrutador.js').Ruta, parametros: Record<string, string> }} destino */
  #mostrar({ ruta, parametros }) {
    const vista = /** @type {any} */ (document.createElement(ruta.vista));
    vista.app = this;
    vista.parametros = parametros;
    document.title = `${ruta.titulo} · Tumbao`;
    this.#raiz.replaceChildren(vista);
  }
}

/** @param {URL} url */
async function leerJson(url) {
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`No se pudo cargar ${url.pathname} (${respuesta.status}).`);
  return respuesta.json();
}
