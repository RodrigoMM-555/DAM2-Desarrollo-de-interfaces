/**
 * @typedef {object} ResizeInfo
 * @property {number} width Ancho en píxeles CSS.
 * @property {number} height Alto en píxeles CSS.
 * @property {number} pixelRatio Densidad de píxeles aplicada (ya limitada).
 */

/**
 * Observa el tamaño de un elemento con `ResizeObserver`.
 *
 * Limita la densidad de píxeles (`devicePixelRatio`) porque en pantallas 4K
 * un canvas a densidad 2 o 3 multiplica por 4-9 el trabajo de dibujo sin una
 * mejora visible en efectos difuminados.
 */
export class ControladorTamano {
  /** @type {Element} */
  #target;
  /** @type {(info: ResizeInfo) => void} */
  #callback;
  #maxPixelRatio;
  /** @type {ResizeObserver | null} */
  #observer = null;

  /**
   * @param {Element} target Elemento a observar.
   * @param {(info: ResizeInfo) => void} callback
   * @param {{ maxPixelRatio?: number }} [options]
   */
  constructor(target, callback, { maxPixelRatio = 2 } = {}) {
    this.#target = target;
    this.#callback = callback;
    this.#maxPixelRatio = maxPixelRatio;
  }

  /** Empieza a observar. El callback se llama también con el tamaño inicial. */
  observe() {
    if (this.#observer) return;
    this.#observer = new ResizeObserver((entries) => {
      const box = entries[entries.length - 1].contentRect;
      this.#callback({
        width: box.width,
        height: box.height,
        pixelRatio: Math.min(this.#maxPixelRatio, window.devicePixelRatio || 1),
      });
    });
    this.#observer.observe(this.#target);
  }

  /** Deja de observar. */
  disconnect() {
    this.#observer?.disconnect();
    this.#observer = null;
  }
}
