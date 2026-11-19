import { defineElement } from '../../interno/definir.js';
import { css, baseStyles } from '../../interno/estilos.js';
import { emit, readEnum } from '../../interno/atributos.js';

/** @typedef {'idle' | 'requesting' | 'live' | 'stopped' | 'error'} CameraStatus */
/** @typedef {'denied' | 'notfound' | 'busy' | 'insecure' | 'unknown'} CameraErrorReason */
/** @typedef {'low' | 'medium' | 'high'} CameraResolution */

/** @type {Record<CameraResolution, { width: number, height: number }>} */
const RESOLUTIONS = {
  low: { width: 480, height: 360 },
  medium: { width: 640, height: 480 },
  high: { width: 1280, height: 720 },
};

/** Mensajes comprensibles para cada tipo de error. */
/** @type {Record<CameraErrorReason, string>} */
export const CAMERA_ERROR_MESSAGES = {
  denied: 'Has bloqueado el permiso de cámara. Actívalo desde el icono del candado de la barra de direcciones.',
  notfound: 'No se ha encontrado ninguna cámara conectada.',
  busy: 'La cámara está ocupada por otra aplicación. Ciérrala y vuelve a intentarlo.',
  insecure: 'La cámara solo funciona en páginas seguras (https:// o localhost).',
  unknown: 'No se ha podido iniciar la cámara.',
};

const styles = css`
  :host {
    position: relative;
    display: block;
    overflow: hidden;
    background: var(--gc-color-night, #0e0c1f);
    contain: content;
  }
  video {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
    opacity: var(--gc-camera-opacity, 1);
    filter: var(--gc-camera-filter, saturate(0.75) contrast(1.05));
    transition: opacity var(--gc-duration, 320ms);
  }
  :host([fit='contain']) video { object-fit: contain; }
  :host(:not([mirror='off'])) video { transform: scaleX(-1); }
  :host(:not(:state(live))) video { opacity: 0; }
  :host([video-hidden]) video { visibility: hidden; }

  /* Lo que se coloque dentro (p. ej. <gc-hand-overlay>) queda encima del vídeo. */
  ::slotted(*) {
    position: absolute;
    inset: 0;
  }
`;

/**
 * Previsualización de la cámara.
 *
 * Gestiona el permiso, el flujo de vídeo y sus errores. Los elementos
 * hijos se superponen al vídeo, lo que permite componer:
 *
 * ```html
 * <gc-camera-preview>
 *   <gc-hand-overlay></gc-hand-overlay>
 * </gc-camera-preview>
 * ```
 *
 * El vídeo se **muestra** en espejo (como un espejo real) pero la imagen que
 * se entrega a `frameSource` no está invertida: así el reconocimiento de
 * manos distingue bien izquierda y derecha.
 *
 * La cámara se apaga sola al quitar el componente del documento.
 *
 * @tag gc-camera-preview
 * @summary Acceso a la cámara con gestión de permisos y errores.
 *
 * @attr {'on' | 'off'} mirror - Mostrar el vídeo en espejo. Por defecto `on`.
 * @attr {'cover' | 'contain'} fit - Ajuste del vídeo a la caja. Por defecto `cover`.
 * @attr {'user' | 'environment'} facing - Cámara frontal o trasera. Por defecto `user`.
 * @attr {'low' | 'medium' | 'high'} resolution - Resolución pedida. Por defecto `medium` (640×480).
 * @attr {string} device-id - Cámara concreta (ver `listDevices()`).
 * @attr {boolean} video-hidden - Oculta la imagen pero mantiene la cámara activa.
 *
 * @prop {CameraStatus} status - (Solo lectura) Estado de la cámara.
 * @prop {HTMLVideoElement} frameSource - (Solo lectura) Vídeo sin espejo para analizarlo.
 * @prop {{ width: number, height: number }} videoSize - (Solo lectura) Resolución real.
 * @prop {CameraErrorReason | null} lastError - (Solo lectura) Último error.
 *
 * @fires {CustomEvent<{width: number, height: number, deviceId: string}>} camera-ready - La cámara emite imagen.
 * @fires {CustomEvent<{reason: CameraErrorReason, message: string}>} camera-error - No se ha podido iniciar.
 * @fires {CustomEvent<{reason: 'user' | 'ended'}>} camera-stopped - La cámara se ha apagado.
 *
 * @slot - Capas superpuestas al vídeo.
 * @csspart video - El vídeo.
 * @cssprop --gc-camera-opacity - Opacidad del vídeo (por defecto 1).
 * @cssprop --gc-camera-filter - Filtro CSS del vídeo.
 * @cssstate live - La cámara está emitiendo.
 */
export class GcVistaCamara extends HTMLElement {
  static tagName = 'gc-camera-preview';
  static observedAttributes = ['mirror', 'fit', 'facing', 'resolution', 'device-id'];

  static define() {
    return defineElement(this.tagName, this);
  }

  /**
   * Lista las cámaras disponibles. Los nombres solo aparecen tras conceder permiso.
   * @returns {Promise<{ deviceId: string, label: string }[]>}
   */
  static async listDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'videoinput')
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Cámara ${i + 1}` }));
  }

  /** @type {ElementInternals} */
  #internals;
  /** @type {HTMLVideoElement} */
  #video;
  /** @type {MediaStream | null} */
  #stream = null;
  /** @type {CameraStatus} */
  #status = 'idle';
  /** @type {CameraErrorReason | null} */
  #lastError = null;
  /** Cuenta las llamadas a start() para descartar respuestas antiguas. */
  #request = 0;

  constructor() {
    super();
    this.#internals = this.attachInternals();
    const root = this.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [baseStyles, styles];
    root.innerHTML = '<video part="video" playsinline muted autoplay></video><slot></slot>';
    this.#video = /** @type {HTMLVideoElement} */ (root.querySelector('video'));
  }

  // ── Propiedades de diseño ─────────────────────────────────

  get mirror() {
    return readEnum(this, 'mirror', /** @type {const} */ (['on', 'off']), 'on');
  }
  set mirror(value) {
    this.setAttribute('mirror', value);
  }

  get fit() {
    return readEnum(this, 'fit', /** @type {const} */ (['cover', 'contain']), 'cover');
  }
  set fit(value) {
    this.setAttribute('fit', value);
  }

  get facing() {
    return readEnum(this, 'facing', /** @type {const} */ (['user', 'environment']), 'user');
  }
  set facing(value) {
    this.setAttribute('facing', value);
  }

  /** @returns {CameraResolution} */
  get resolution() {
    return readEnum(this, 'resolution', /** @type {const} */ (['low', 'medium', 'high']), 'medium');
  }
  set resolution(value) {
    this.setAttribute('resolution', value);
  }

  get deviceId() {
    return this.getAttribute('device-id') ?? '';
  }
  set deviceId(value) {
    if (value) this.setAttribute('device-id', value);
    else this.removeAttribute('device-id');
  }

  get videoHidden() {
    return this.hasAttribute('video-hidden');
  }
  set videoHidden(value) {
    this.toggleAttribute('video-hidden', Boolean(value));
  }

  // ── Propiedades de ejecución ──────────────────────────────

  /** @returns {CameraStatus} */
  get status() {
    return this.#status;
  }

  get frameSource() {
    return this.#video;
  }

  get videoSize() {
    return { width: this.#video.videoWidth, height: this.#video.videoHeight };
  }

  get lastError() {
    return this.#lastError;
  }

  // ── Ciclo de vida ─────────────────────────────────────────

  /**
   * @param {string} name
   * @param {string | null} oldValue
   * @param {string | null} newValue
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    // Cambiar de cámara o resolución con la cámara encendida la reinicia.
    if (['facing', 'resolution', 'device-id'].includes(name) && this.#status === 'live') {
      this.start();
    }
  }

  disconnectedCallback() {
    this.stop();
  }

  // ── Métodos públicos ──────────────────────────────────────

  /**
   * Pide permiso y enciende la cámara.
   * @returns {Promise<boolean>} `true` si la cámara emite; `false` si hubo error (ver `camera-error`).
   */
  async start() {
    const request = ++this.#request;
    this.#releaseStream();

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      return this.#fail('insecure');
    }

    this.#setStatus('requesting');
    const { width, height } = RESOLUTIONS[this.resolution];
    /** @type {MediaTrackConstraints} */
    const video = { width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: 30 } };
    if (this.deviceId) video.deviceId = { exact: this.deviceId };
    else video.facingMode = this.facing;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      if (request !== this.#request || !this.isConnected) {
        stream.getTracks().forEach((t) => t.stop()); // llegó tarde: ya no se quiere
        return false;
      }
      this.#stream = stream;
      const [track] = stream.getVideoTracks();
      track.addEventListener('ended', () => this.#onTrackEnded(stream), { once: true });
      this.#video.srcObject = stream;
      await this.#video.play();
      this.#lastError = null;
      this.#setStatus('live');
      emit(this, 'camera-ready', {
        width: this.#video.videoWidth,
        height: this.#video.videoHeight,
        deviceId: track.getSettings().deviceId ?? '',
      });
      return true;
    } catch (error) {
      if (request !== this.#request) return false;
      this.#releaseStream();
      return this.#fail(GcVistaCamara.classifyError(error));
    }
  }

  /** Apaga la cámara (se apaga el piloto de la webcam). */
  stop() {
    this.#request++;
    const wasActive = this.#stream !== null;
    this.#releaseStream();
    if (wasActive || this.#status === 'requesting') {
      this.#setStatus('stopped');
      emit(this, 'camera-stopped', { reason: 'user' });
    }
  }

  /**
   * Traduce un error de `getUserMedia` a un motivo comprensible.
   * @param {unknown} error
   * @returns {CameraErrorReason}
   */
  static classifyError(error) {
    const name = /** @type {{ name?: string }} */ (error)?.name;
    switch (name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return 'denied';
      case 'NotFoundError':
      case 'OverconstrainedError':
        return 'notfound';
      case 'NotReadableError':
      case 'AbortError':
        return 'busy';
      default:
        return 'unknown';
    }
  }

  // ── Interno ───────────────────────────────────────────────

  /** @param {CameraErrorReason} reason */
  #fail(reason) {
    this.#lastError = reason;
    this.#setStatus('error');
    emit(this, 'camera-error', { reason, message: CAMERA_ERROR_MESSAGES[reason] });
    return false;
  }

  /** @param {MediaStream} stream */
  #onTrackEnded(stream) {
    if (stream !== this.#stream) return;
    this.#releaseStream();
    this.#setStatus('stopped');
    emit(this, 'camera-stopped', { reason: 'ended' });
  }

  #releaseStream() {
    this.#stream?.getTracks().forEach((t) => t.stop());
    this.#stream = null;
    this.#video.srcObject = null;
  }

  /** @param {CameraStatus} status */
  #setStatus(status) {
    this.#status = status;
    if (status === 'live') this.#internals.states.add('live');
    else this.#internals.states.delete('live');
  }
}
