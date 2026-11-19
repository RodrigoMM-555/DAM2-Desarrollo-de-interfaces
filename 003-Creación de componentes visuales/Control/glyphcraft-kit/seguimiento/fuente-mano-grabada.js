/** @typedef {import('./fuente-mano.js').HandSourceStatus} HandSourceStatus */
/** @typedef {import('./fuente-mano.js').HandFrame} HandFrame */
/** @typedef {import('../sinteticos/mano-sintetica.js').HandSession} HandSession */

/**
 * Reproduce una sesión de manos grabada (o sintética) respetando sus tiempos.
 *
 * Sirve para:
 * - probar la aplicación completa sin cámara (modo demostración);
 * - el modo demostración;
 * - repetir exactamente un caso problemático grabado con `GrabadorSesion`.
 *
 * Las marcas de tiempo se recalculan sobre `performance.now()` para que el
 * resto del sistema no note diferencia con la cámara real.
 *
 * Cumple la interfaz `HandSource` (ver hand-source.js).
 *
 * @fires frame - `CustomEvent<HandFrame>`
 * @fires status - `CustomEvent<{ status }>`
 * @fires ended - La sesión ha terminado (si no se repite en bucle).
 */
export class FuenteManoGrabada extends EventTarget {
  /** @type {HandSession} */
  #session;
  #loop;
  #speed;
  /** @type {HandSourceStatus} */
  #status = 'ready';
  #index = 0;
  #timer = 0;
  #startedAt = 0;
  #fps = 0;

  /**
   * @param {HandSession} session
   * @param {{ loop?: boolean, speed?: number }} [options]
   */
  constructor(session, { loop = false, speed = 1 } = {}) {
    super();
    FuenteManoGrabada.validate(session);
    if (!(speed > 0)) throw new RangeError('FuenteManoGrabada: "speed" debe ser > 0.');
    this.#session = session;
    this.#loop = loop;
    this.#speed = speed;
    const frames = session.frames;
    const duration = frames[frames.length - 1].timestamp - frames[0].timestamp;
    this.#fps = duration > 0 ? ((frames.length - 1) * 1000) / duration : 0;
  }

  /**
   * Comprueba el formato de una sesión.
   * @param {unknown} session
   * @throws {TypeError}
   */
  static validate(session) {
    const s = /** @type {any} */ (session);
    if (!s || !Array.isArray(s.frames) || s.frames.length === 0) {
      throw new TypeError('Sesión no válida: necesita un array "frames" no vacío.');
    }
    for (const frame of s.frames) {
      if (!Number.isFinite(frame?.timestamp) || !Array.isArray(frame?.hands)) {
        throw new TypeError('Sesión no válida: cada fotograma necesita "timestamp" y "hands".');
      }
    }
  }

  /**
   * Descarga y crea una fuente a partir de un archivo JSON.
   * @param {string} url
   * @param {{ loop?: boolean, speed?: number }} [options]
   */
  static async fromUrl(url, options) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`No se pudo cargar la sesión (${response.status}).`);
    return new FuenteManoGrabada(await response.json(), options);
  }

  get status() {
    return this.#status;
  }

  get stats() {
    return { fps: this.#fps, inferenceMs: 0, backend: /** @type {const} */ ('replay') };
  }

  /** Número total de fotogramas. */
  get length() {
    return this.#session.frames.length;
  }

  /** Empieza (o reinicia) la reproducción. */
  async start() {
    this.stop();
    this.#index = 0;
    this.#startedAt = performance.now();
    this.#setStatus('running');
    this.#scheduleNext();
  }

  stop() {
    clearTimeout(this.#timer);
    this.#timer = 0;
    if (this.#status === 'running') this.#setStatus('stopped');
  }

  #scheduleNext() {
    const frames = this.#session.frames;
    if (this.#index >= frames.length) {
      if (this.#loop) {
        this.#index = 0;
        this.#startedAt = performance.now();
      } else {
        this.#setStatus('stopped');
        this.dispatchEvent(new CustomEvent('ended'));
        return;
      }
    }
    const frame = frames[this.#index];
    const due = this.#startedAt + (frame.timestamp - frames[0].timestamp) / this.#speed;
    this.#timer = window.setTimeout(() => {
      this.#index++;
      /** @type {HandFrame} */
      const out = { ...frame, timestamp: performance.now() };
      this.dispatchEvent(new CustomEvent('frame', { detail: out }));
      this.#scheduleNext();
    }, Math.max(0, due - performance.now()));
  }

  /** @param {HandSourceStatus} status */
  #setStatus(status) {
    if (this.#status === status) return;
    this.#status = status;
    this.dispatchEvent(new CustomEvent('status', { detail: { status } }));
  }
}
