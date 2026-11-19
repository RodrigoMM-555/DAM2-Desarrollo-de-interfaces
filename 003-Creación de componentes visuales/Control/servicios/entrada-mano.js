import { MotorGestos } from 'glyphcraft-kit/nucleo';
import { FuenteManoMediaPipe, FuenteManoGrabada, GrabadorSesion } from 'glyphcraft-kit/seguimiento';

/** @typedef {import('glyphcraft-kit/nucleo').MotorGestos} Engine */
/** @typedef {'off' | 'camera' | 'demo'} InputMode */

/**
 * Carpeta raíz de la app, resuelta a partir de la página (index.html).
 * Así funciona igual en Live Server, en localhost o en una subcarpeta de
 * GitHub Pages, sin configurar ninguna ruta base.
 */
const BASE = new URL('./', document.baseURI).href;

/**
 * El modelo de MediaPipe se comparte entre visitas a la sección: cargarlo
 * cuesta varios segundos y no tiene sentido repetirlo.
 * @type {FuenteManoMediaPipe | null}
 */
let sharedMediaPipe = null;

/** Confianza de detección pedida (Ajustes → sensibilidad). */
let detection = 0.5;

function getMediaPipe() {
  sharedMediaPipe ??= new FuenteManoMediaPipe({
    wasmPath: `${BASE}lib/mediapipe/wasm`,
    modelPath: `${BASE}lib/mediapipe/hand_landmarker.task`,
    numHands: 2,
    minDetectionConfidence: detection,
    minPresenceConfidence: detection,
    minTrackingConfidence: detection,
  });
  return sharedMediaPipe;
}

/**
 * Entrada de manos de la aplicación: decide qué fuente está activa
 * (cámara real o demostración), alimenta al motor de gestos y reenvía los
 * fotogramas.
 *
 * @fires frame - `CustomEvent<HandFrame>` después de procesarlo el motor.
 * @fires mode-change - `CustomEvent<{ mode: InputMode }>`
 * @fires loading - `CustomEvent<{ loading: boolean }>` mientras se carga el modelo.
 * @fires demo-ended
 */
export class EntradaMano extends EventTarget {
  /** Motor de gestos (público para escuchar sus eventos). */
  engine = new MotorGestos();
  /** @type {InputMode} */
  #mode = 'off';
  /** @type {FuenteManoMediaPipe | FuenteManoGrabada | null} */
  #source = null;
  /** @type {GrabadorSesion | null} */
  #recorder = null;

  /** @param {Event} event */
  #onFrame = (event) => {
    const frame = /** @type {CustomEvent} */ (event).detail;
    this.engine.update(frame);
    this.dispatchEvent(new CustomEvent('frame', { detail: frame }));
  };

  #onDemoEnded = () => {
    this.stop();
    this.dispatchEvent(new CustomEvent('demo-ended'));
  };

  get mode() {
    return this.#mode;
  }

  get stats() {
    return this.#source?.stats ?? { fps: 0, inferenceMs: 0, backend: null };
  }

  /**
   * Confianza mínima para detectar y seguir manos (0-1). Más baja detecta
   * con peor luz pero confunde más; más alta es más estricta.
   * @param {number} confidence
   */
  setDetection(confidence) {
    if (!Number.isFinite(confidence) || confidence === detection) return;
    detection = confidence;
    sharedMediaPipe
      ?.setOptions({ minDetectionConfidence: confidence, minPresenceConfidence: confidence, minTrackingConfidence: confidence })
      .catch((error) => console.warn('No se pudo cambiar la sensibilidad:', error));
  }

  get recording() {
    return this.#recorder?.recording ?? false;
  }

  /**
   * Analiza el vídeo de la cámara con MediaPipe.
   * @param {HTMLVideoElement} video
   */
  async startCamera(video) {
    this.stop();
    const source = getMediaPipe();
    this.dispatchEvent(new CustomEvent('loading', { detail: { loading: true } }));
    try {
      await source.start(video);
    } finally {
      this.dispatchEvent(new CustomEvent('loading', { detail: { loading: false } }));
    }
    this.#attach(source, 'camera');
  }

  /** Reproduce la sesión de demostración. */
  async startDemo() {
    this.stop();
    const source = await FuenteManoGrabada.fromUrl(`${BASE}sesiones/demo.json`);
    source.addEventListener('ended', this.#onDemoEnded);
    this.#attach(source, 'demo');
    await source.start();
  }

  /** Detiene la fuente activa y cierra cualquier trazo en curso. */
  stop() {
    if (this.#recorder?.recording) this.#recorder.stop();
    this.#source?.removeEventListener('frame', this.#onFrame);
    this.#source?.removeEventListener('ended', this.#onDemoEnded);
    this.#source?.stop();
    this.#source = null;
    this.engine.reset();
    this.#setMode('off');
  }

  /**
   * Empieza o termina una grabación de la fuente activa.
   * @returns {import('glyphcraft-kit/sinteticos').HandSession | null} La sesión al terminar.
   */
  toggleRecording() {
    if (this.#recorder?.recording) {
      const session = this.#recorder.stop();
      this.#recorder = null;
      return session;
    }
    if (!this.#source) return null;
    this.#recorder = new GrabadorSesion(this.#source);
    this.#recorder.start();
    return null;
  }

  /**
   * @param {FuenteManoMediaPipe | FuenteManoGrabada} source
   * @param {InputMode} mode
   */
  #attach(source, mode) {
    this.#source = source;
    source.addEventListener('frame', this.#onFrame);
    this.#setMode(mode);
  }

  /** @param {InputMode} mode */
  #setMode(mode) {
    if (this.#mode === mode) return;
    this.#mode = mode;
    this.dispatchEvent(new CustomEvent('mode-change', { detail: { mode } }));
  }
}
