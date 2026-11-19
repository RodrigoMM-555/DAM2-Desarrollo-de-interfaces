/**
 * @typedef {object} RouteDefinition
 * @property {string} path Patrón, p. ej. `/grimoire/:glyphId?` (`?` = opcional).
 * @property {string} view Etiqueta del custom element que pinta la vista.
 * @property {string} title Título para `document.title`.
 */

/**
 * @typedef {object} RouteMatch
 * @property {string} path Ruta real visitada, p. ej. `/grimoire/ignis`.
 * @property {Record<string, string>} params Parámetros extraídos del patrón.
 * @property {RouteDefinition} route Definición que ha coincidido.
 */

/**
 * @typedef {object} CompiledRoute
 * @property {RouteDefinition} route
 * @property {RegExp} regex
 * @property {string[]} keys
 */

/**
 * Router basado en el *hash* de la URL (`#/grimoire`).
 *
 * Se usa el hash porque GitHub Pages es un alojamiento estático: si la URL
 * fuera `/grimoire`, al recargar la página el servidor buscaría un archivo
 * `grimoire/index.html` y devolvería un 404. Con `#/grimoire` el servidor
 * siempre sirve `index.html` y el resto lo resuelve JavaScript.
 *
 * No conoce las vistas ni el DOM: solo traduce URLs a rutas y avisa con
 * eventos. Así se puede probar de forma aislada.
 *
 * @fires {CustomEvent<RouteMatch & {previous: RouteMatch | null}>} route-change
 * @fires {CustomEvent<{path: string}>} route-not-found - Se redirige después a la ruta de reserva.
 */
export class EnrutadorHash extends EventTarget {
  /** @type {CompiledRoute[]} */
  #routes;
  #fallback;
  /** @type {RouteMatch | null} */
  #current = null;
  #started = false;

  #onHashChange = () => this.#resolve();

  /**
   * @param {RouteDefinition[]} routes
   * @param {{ fallback?: string }} [options] Ruta a la que ir si no hay coincidencia.
   */
  constructor(routes, { fallback = '/' } = {}) {
    super();
    if (!Array.isArray(routes) || routes.length === 0) {
      throw new TypeError('EnrutadorHash necesita al menos una ruta.');
    }
    this.#routes = routes.map((route) => EnrutadorHash.compile(route));
    this.#fallback = fallback;
  }

  /**
   * Convierte un patrón en expresión regular.
   * `/grimoire/:glyphId?` → `^/grimoire(?:/([^/]+))?$`
   *
   * @param {RouteDefinition} route
   * @returns {CompiledRoute}
   */
  static compile(route) {
    /** @type {string[]} */
    const keys = [];
    const source = route.path
      .split('/')
      .filter(Boolean)
      .map((segment) => {
        const param = segment.match(/^:(\w+)(\?)?$/);
        if (!param) return `/${segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
        keys.push(param[1]);
        return param[2] ? '(?:/([^/]+))?' : '/([^/]+)';
      })
      .join('');
    return { route, keys, regex: new RegExp(`^${source || '/'}$`) };
  }

  /**
   * Limpia una ruta: siempre empieza por `/` y nunca acaba en `/` (salvo la raíz).
   * @param {string} raw
   */
  static normalize(raw) {
    const path = `/${String(raw).replace(/^#/, '').split('?')[0]}`.replace(/\/{2,}/g, '/');
    return path.length > 1 ? path.replace(/\/$/, '') : '/';
  }

  /** Ruta activa, o `null` antes de `start()`. */
  get current() {
    return this.#current;
  }

  /**
   * Busca la ruta que coincide con un camino.
   * @param {string} path
   * @returns {RouteMatch | null}
   */
  match(path) {
    const clean = EnrutadorHash.normalize(path);
    for (const { route, regex, keys } of this.#routes) {
      const found = clean.match(regex);
      if (!found) continue;
      /** @type {Record<string, string>} */
      const params = {};
      keys.forEach((key, i) => {
        if (found[i + 1] !== undefined) params[key] = decodeURIComponent(found[i + 1]);
      });
      return { path: clean, params, route };
    }
    return null;
  }

  /** Empieza a escuchar la URL y resuelve la ruta actual. */
  start() {
    if (this.#started) return;
    this.#started = true;
    window.addEventListener('hashchange', this.#onHashChange);
    this.#resolve();
  }

  /** Deja de escuchar la URL. */
  stop() {
    this.#started = false;
    window.removeEventListener('hashchange', this.#onHashChange);
  }

  /**
   * Navega a una ruta.
   *
   * @param {string} path
   * @param {{ replace?: boolean }} [options] `replace` no añade entrada al historial.
   */
  navigate(path, { replace = false } = {}) {
    const target = `#${EnrutadorHash.normalize(path)}`;
    if (replace) {
      history.replaceState(history.state, '', target);
      this.#resolve();
    } else if (location.hash !== target) {
      location.hash = target; // dispara `hashchange` → #resolve()
    }
  }

  #resolve() {
    const path = EnrutadorHash.normalize(location.hash || '/');
    const match = this.match(path);
    if (!match) {
      this.dispatchEvent(new CustomEvent('route-not-found', { detail: { path } }));
      if (path !== EnrutadorHash.normalize(this.#fallback)) this.navigate(this.#fallback, { replace: true });
      return;
    }
    if (this.#current?.path === match.path) return;
    const previous = this.#current;
    this.#current = match;
    this.dispatchEvent(new CustomEvent('route-change', { detail: { ...match, previous } }));
  }
}
