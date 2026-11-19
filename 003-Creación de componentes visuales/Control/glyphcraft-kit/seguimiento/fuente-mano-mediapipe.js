import { smoothStat } from './fuente-mano.js';

/** @typedef {import('./fuente-mano.js').HandSourceStatus} HandSourceStatus */
/** @typedef {import('./fuente-mano.js').HandSourceStats} HandSourceStats */
/** @typedef {import('./fuente-mano.js').HandFrame} HandFrame */

/**
 * @typedef {object} MediaPipeHandSourceOptions
 * @property {string} wasmPath Carpeta con `vision_wasm_internal.js` y `.wasm`.
 * @property {string} modelPath Ruta de `hand_landmarker.task`.
 * @property {number} [numHands=2] Manos máximas.
 * @property {number} [minDetectionConfidence=0.5] Confianza para detectar una mano nueva.
 * @property {number} [minPresenceConfidence=0.5] Confianza para seguir considerándola presente.
 * @property {number} [minTrackingConfidence=0.5] Confianza del seguimiento entre fotogramas.
 * @property {'GPU' | 'CPU'} [delegate='GPU'] Preferencia; si la GPU falla se usa la CPU.
 */

/**
 * Fuente de manos real: analiza un `<video>` con MediaPipe HandLandmarker.
 *
 * - Carga MediaPipe bajo demanda (`import()` dinámico): quien no use la
 *   cámara no descarga sus 14 MB.
 * - Analiza cada fotograma nuevo del vídeo con `requestVideoFrameCallback`,
 *   así no se analiza dos veces la misma imagen ni se espera a la pantalla.
 * - Si el delegado GPU no está disponible (frecuente en Linux con drivers
 *   en lista negra), reintenta con CPU.
 * - Analiza la imagen **sin espejo**: así MediaPipe etiqueta bien qué mano
 *   es la izquierda y cuál la derecha de la persona.
 *
 * Cumple la interfaz `HandSource` (ver hand-source.js).
 */
export class FuenteManoMediaPipe extends EventTarget {
  /** @type {Required<MediaPipeHandSourceOptions>} */
  #options;
  /** @type {HandSourceStatus} */
  #status = 'idle';
  /** @type {HandSourceStats} */
  #stats = { fps: 0, inferenceMs: 0, backend: null };
  /** @type {any} HandLandmarker de MediaPipe */
  #landmarker = null;
  /** @type {Promise<void> | null} */
  #loading = null;
  /** @type {HTMLVideoElement | null} */
  #video = null;
  #callbackId = 0;
  #lastTimestamp = 0;
  #lastFrameTime = 0;

  /** @param {MediaPipeHandSourceOptions} options */
  constructor(options) {
    super();
    if (!options?.wasmPath || !options?.modelPath) {
      throw new TypeError('FuenteManoMediaPipe necesita { wasmPath, modelPath }.');
    }
    this.#options = {
      numHands: 2,
      minDetectionConfidence: 0.5,
      minPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      delegate: 'GPU',
      ...options,
    };
  }

  get status() {
    return this.#status;
  }

  get stats() {
    return { ...this.#stats };
  }

  /**
   * Descarga e inicializa el modelo. Es idempotente: varias llamadas
   * comparten la misma carga.
   * @returns {Promise<void>}
   */
  load() {
    this.#loading ??= this.#load().catch((error) => {
      this.#loading = null;
      this.#setStatus('error', error);
      throw error;
    });
    return this.#loading;
  }

  async #load() {
    this.#setStatus('loading');
    const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(this.#options.wasmPath);
    const create = (/** @type {'GPU' | 'CPU'} */ delegate) =>
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: this.#options.modelPath, delegate },
        runningMode: 'VIDEO',
        numHands: this.#options.numHands,
        minHandDetectionConfidence: this.#options.minDetectionConfidence,
        minHandPresenceConfidence: this.#options.minPresenceConfidence,
        minTrackingConfidence: this.#options.minTrackingConfidence,
      });

    try {
      this.#landmarker = await create(this.#options.delegate);
      this.#stats.backend = this.#options.delegate;
    } catch (error) {
      if (this.#options.delegate === 'CPU') throw error;
      console.warn('[glyphcraft-kit] GPU no disponible para MediaPipe; se usa la CPU.', error);
      this.#landmarker = await create('CPU');
      this.#stats.backend = 'CPU';
    }
    this.#setStatus('ready');
  }

  /**
   * Empieza a analizar un vídeo.
   * @param {HTMLVideoElement} [video]
   */
  async start(video) {
    if (!(video instanceof HTMLVideoElement)) {
      throw new TypeError('FuenteManoMediaPipe.start necesita un <video>.');
    }
    await this.load();
    this.stop();
    this.#video = video;
    this.#lastFrameTime = 0;
    this.#setStatus('running');
    this.#schedule();
  }

  /** Deja de analizar (el modelo sigue cargado para reanudar rápido). */
  stop() {
    if (this.#video && this.#callbackId) {
      if ('cancelVideoFrameCallback' in this.#video) this.#video.cancelVideoFrameCallback(this.#callbackId);
      else cancelAnimationFrame(this.#callbackId);
    }
    this.#callbackId = 0;
    this.#video = null;
    if (this.#status === 'running') this.#setStatus('stopped');
  }

  /**
   * Cambia la sensibilidad en caliente (desde Ajustes).
   * @param {Partial<Pick<MediaPipeHandSourceOptions, 'numHands' | 'minDetectionConfidence' | 'minPresenceConfidence' | 'minTrackingConfidence'>>} options
   */
  async setOptions(options) {
    Object.assign(this.#options, options);
    if (!this.#landmarker) return;
    await this.#landmarker.setOptions({
      numHands: this.#options.numHands,
      minHandDetectionConfidence: this.#options.minDetectionConfidence,
      minHandPresenceConfidence: this.#options.minPresenceConfidence,
      minTrackingConfidence: this.#options.minTrackingConfidence,
    });
  }

  /** Libera el modelo y la memoria de la GPU. */
  dispose() {
    this.stop();
    this.#landmarker?.close();
    this.#landmarker = null;
    this.#loading = null;
    this.#setStatus('idle');
  }

  #schedule() {
    const video = this.#video;
    if (!video) return;
    this.#callbackId =
      'requestVideoFrameCallback' in video
        ? video.requestVideoFrameCallback(this.#onVideoFrame)
        : requestAnimationFrame(this.#onVideoFrame);
  }

  #onVideoFrame = () => {
    const video = this.#video;
    if (!video || !this.#landmarker) return;
    if (video.readyState >= 2 && video.videoWidth > 0) {
      // MediaPipe exige marcas de tiempo estrictamente crecientes.
      const timestamp = Math.max(performance.now(), this.#lastTimestamp + 1);
      this.#lastTimestamp = timestamp;
      const started = performance.now();
      const result = this.#landmarker.detectForVideo(video, timestamp);
      const elapsed = performance.now() - started;

      this.#stats.inferenceMs = smoothStat(this.#stats.inferenceMs, elapsed);
      if (this.#lastFrameTime) {
        this.#stats.fps = smoothStat(this.#stats.fps, 1000 / Math.max(1, started - this.#lastFrameTime));
      }
      this.#lastFrameTime = started;

      this.dispatchEvent(new CustomEvent('frame', { detail: this.#toFrame(result, timestamp, video) }));
    }
    this.#schedule();
  };

  /**
   * Convierte el resultado de MediaPipe a nuestro formato `HandFrame`.
   * @param {any} result
   * @param {number} timestamp
   * @param {HTMLVideoElement} video
   * @returns {HandFrame}
   */
  #toFrame(result, timestamp, video) {
    const handedness = result.handedness ?? result.handednesses ?? [];
    return {
      timestamp,
      imageWidth: video.videoWidth,
      imageHeight: video.videoHeight,
      hands: (result.landmarks ?? []).map((/** @type {any[]} */ landmarks, /** @type {number} */ i) => ({
        handedness: handedness[i]?.[0]?.categoryName === 'Left' ? 'Left' : 'Right',
        score: handedness[i]?.[0]?.score ?? 1,
        landmarks: landmarks.map(({ x, y, z }) => ({ x, y, z })),
        worldLandmarks: (result.worldLandmarks?.[i] ?? []).map((/** @type {any} */ { x, y, z }) => ({ x, y, z })),
      })),
    };
  }

  /**
   * @param {HandSourceStatus} status
   * @param {unknown} [error]
   */
  #setStatus(status, error) {
    if (this.#status === status) return;
    this.#status = status;
    this.dispatchEvent(new CustomEvent('status', { detail: { status, error } }));
  }
}
