/**
 * @callback FrameCallback
 * @param {number} dt Segundos desde el fotograma anterior (máx. 0,1 s).
 * @param {number} time Segundos desde que arrancó el bucle.
 * @returns {void}
 */

/**
 * Bucle de animación basado en `requestAnimationFrame`.
 *
 * Es un *controller*: un objeto pequeño que un componente **compone** (lo
 * guarda en un campo privado) en vez de heredar de una clase base. Así
 * cualquier componente puede animarse sin compartir jerarquía.
 *
 * - Se detiene solo cuando la pestaña está oculta y se reanuda al volver.
 * - Limita `dt` para que, tras una pausa larga, la animación no dé un salto.
 *
 * @example
 * #loop = new ControladorBucle((dt) => this.#update(dt));
 * connectedCallback() { this.#loop.start(); }
 * disconnectedCallback() { this.#loop.stop(); }
 */
export class ControladorBucle {
  /** @type {FrameCallback} */
  #callback;
  #frame = 0;
  #last = 0;
  #elapsed = 0;
  #wanted = false;

  #onVisibility = () => {
    if (!this.#wanted) return;
    if (document.hidden) this.#cancel();
    else this.#schedule();
  };

  /** @param {FrameCallback} callback */
  constructor(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('ControladorBucle necesita una función callback.');
    }
    this.#callback = callback;
  }

  /** `true` mientras el bucle está solicitado (aunque la pestaña esté oculta). */
  get running() {
    return this.#wanted;
  }

  /** Arranca el bucle. Llamarlo varias veces no crea bucles duplicados. */
  start() {
    if (this.#wanted) return;
    this.#wanted = true;
    document.addEventListener('visibilitychange', this.#onVisibility);
    if (!document.hidden) this.#schedule();
  }

  /** Detiene el bucle y libera el oyente de visibilidad. */
  stop() {
    this.#wanted = false;
    this.#cancel();
    document.removeEventListener('visibilitychange', this.#onVisibility);
  }

  #schedule() {
    if (this.#frame) return;
    this.#last = performance.now();
    this.#frame = requestAnimationFrame(this.#tick);
  }

  #cancel() {
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
  }

  /** @param {number} now */
  #tick = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - this.#last) / 1000));
    this.#last = now;
    this.#elapsed += dt;
    this.#frame = requestAnimationFrame(this.#tick);
    this.#callback(dt, this.#elapsed);
  };
}
