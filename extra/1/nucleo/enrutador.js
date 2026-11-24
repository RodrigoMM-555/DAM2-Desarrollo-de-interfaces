// @ts-check
/**
 * Enrutador por *hash* (`#/partida/primer-tumbao/facil`).
 *
 * Se usa el hash porque el juego se sirve como archivos estáticos: al
 * recargar, el servidor siempre devuelve `index.html` y la ruta la resuelve
 * JavaScript. No conoce las vistas ni el DOM: traduce URLs y avisa.
 *
 * Evento: `cambio` → { ruta, parametros, camino }.
 */

/**
 * @typedef {object} Ruta
 * @property {string} patron Por ejemplo `/partida/:cancion/:dificultad`.
 * @property {string} vista Etiqueta del elemento que pinta la vista.
 * @property {string} titulo
 */

export class Enrutador extends EventTarget {
  /** @type {{ ruta: Ruta, regex: RegExp, claves: string[] }[]} */
  #rutas;
  #porDefecto;
  /** @type {string | null} */
  #actual = null;
  #alCambiarHash = () => this.#resolver();

  /** @param {Ruta[]} rutas @param {string} [porDefecto] */
  constructor(rutas, porDefecto = '/') {
    super();
    this.#rutas = rutas.map((ruta) => {
      /** @type {string[]} */
      const claves = [];
      const fuente = ruta.patron.replace(/:(\w+)/g, (_, clave) => {
        claves.push(clave);
        return '([^/]+)';
      });
      return { ruta, claves, regex: new RegExp(`^${fuente}$`) };
    });
    this.#porDefecto = porDefecto;
  }

  /**
   * @param {string} camino
   * @returns {{ ruta: Ruta, parametros: Record<string, string>, camino: string } | null}
   */
  buscar(camino) {
    for (const { ruta, regex, claves } of this.#rutas) {
      const m = regex.exec(camino);
      if (!m) continue;
      /** @type {Record<string, string>} */
      const parametros = {};
      claves.forEach((clave, i) => (parametros[clave] = decodeURIComponent(m[i + 1])));
      return { ruta, parametros, camino };
    }
    return null;
  }

  iniciar() {
    window.addEventListener('hashchange', this.#alCambiarHash);
    this.#resolver();
  }

  detener() {
    window.removeEventListener('hashchange', this.#alCambiarHash);
  }

  /** @param {string} camino */
  ir(camino) {
    if (location.hash === `#${camino}`) {
      this.#actual = null; // misma ruta: se vuelve a pintar (p. ej. "Repetir")
      this.#resolver();
    } else {
      location.hash = camino;
    }
  }

  #resolver() {
    const camino = location.hash.replace(/^#/, '') || '/';
    if (camino === this.#actual) return;
    const encontrada = this.buscar(camino);
    if (!encontrada) {
      history.replaceState(null, '', `#${this.#porDefecto}`);
      this.#resolver();
      return;
    }
    this.#actual = camino;
    this.dispatchEvent(new CustomEvent('cambio', { detail: encontrada }));
  }
}
