/**
 * Informa de si la persona ha pedido reducir el movimiento en su sistema
 * operativo (`prefers-reduced-motion: reduce`) y avisa cuando cambia.
 *
 * Los componentes animados lo usan para mostrar una versión estática.
 */
export class ControladorMovimientoReducido {
  /** @type {MediaQueryList | null} */
  #query = null;
  /** @type {(reduced: boolean) => void} */
  #callback;

  #onChange = () => this.#callback(this.reduced);

  /** @param {(reduced: boolean) => void} [callback] */
  constructor(callback = () => {}) {
    this.#callback = callback;
  }

  /** `true` si hay que evitar animaciones. */
  get reduced() {
    return this.#query?.matches ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  connect() {
    if (this.#query) return;
    this.#query = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.#query.addEventListener('change', this.#onChange);
  }

  disconnect() {
    this.#query?.removeEventListener('change', this.#onChange);
    this.#query = null;
  }
}
