/** @typedef {import('./fuente-mano.js').HandFrame} HandFrame */
/** @typedef {import('../sinteticos/mano-sintetica.js').HandSession} HandSession */

/**
 * Graba los fotogramas de una fuente de manos para reproducirlos después
 * con `FuenteManoGrabada`.
 *
 * Así las pruebas pueden usar movimientos reales de una mano en lugar de
 * datos inventados. Redondea las coordenadas para que los archivos ocupen
 * poco (4 decimales ≈ 0,06 px en una imagen de 640 px).
 */
export class GrabadorSesion {
  /** @type {EventTarget} */
  #source;
  /** @type {HandFrame[]} */
  #frames = [];
  #recording = false;
  #maxFrames;
  #imageWidth = 0;
  #imageHeight = 0;

  /** @param {Event} event */
  #onFrame = (event) => {
    const frame = /** @type {CustomEvent<HandFrame>} */ (event).detail;
    this.#imageWidth ||= frame.imageWidth ?? 0;
    this.#imageHeight ||= frame.imageHeight ?? 0;
    this.#frames.push(GrabadorSesion.compact(frame));
    if (this.#frames.length >= this.#maxFrames) this.stop();
  };

  /**
   * @param {EventTarget} source Cualquier fuente que emita eventos `frame`.
   * @param {{ maxFrames?: number }} [options] Límite de seguridad (por defecto 10 min a 30 fps).
   */
  constructor(source, { maxFrames = 18000 } = {}) {
    this.#source = source;
    this.#maxFrames = maxFrames;
  }

  get recording() {
    return this.#recording;
  }

  get frameCount() {
    return this.#frames.length;
  }

  start() {
    if (this.#recording) return;
    this.#frames = [];
    this.#recording = true;
    this.#source.addEventListener('frame', this.#onFrame);
  }

  /** @returns {HandSession} La sesión grabada. */
  stop() {
    this.#source.removeEventListener('frame', this.#onFrame);
    this.#recording = false;
    return this.toSession();
  }

  /** @returns {HandSession} */
  toSession() {
    const t0 = this.#frames[0]?.timestamp ?? 0;
    return {
      version: 1,
      imageWidth: this.#imageWidth,
      imageHeight: this.#imageHeight,
      frames: this.#frames.map((f) => ({ ...f, timestamp: Math.round(f.timestamp - t0) })),
    };
  }

  /**
   * Copia reducida de un fotograma (coordenadas con 4 decimales).
   * @param {HandFrame} frame
   * @returns {HandFrame}
   */
  static compact(frame) {
    const round = (/** @type {number} */ n) => Math.round(n * 1e4) / 1e4;
    const points = (/** @type {{x:number,y:number,z:number}[] | undefined} */ list) =>
      list?.map((p) => ({ x: round(p.x), y: round(p.y), z: round(p.z) }));
    return {
      timestamp: frame.timestamp,
      imageWidth: frame.imageWidth,
      imageHeight: frame.imageHeight,
      hands: frame.hands.map((h) => ({
        handedness: h.handedness,
        score: round(h.score),
        landmarks: /** @type {any} */ (points(h.landmarks)),
        worldLandmarks: points(h.worldLandmarks),
      })),
    };
  }
}
