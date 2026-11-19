import { defineElement } from '../../interno/definir.js';
import { css, baseStyles } from '../../interno/estilos.js';
import { emit, readEnum, readNumber } from '../../interno/atributos.js';
import { runeIcon } from '../../iconos/runas.js';

/** @typedef {'info' | 'success' | 'warning' | 'error' | 'arcane'} WhisperType */
/** @typedef {'top-end' | 'top-center' | 'bottom-end' | 'bottom-center'} WhisperPosition */
/** @typedef {'timeout' | 'user' | 'program' | 'overflow'} DismissReason */

/**
 * @typedef {object} WhisperOptions
 * @property {string} message Texto principal (obligatorio).
 * @property {string} [title] Título opcional.
 * @property {WhisperType} [type] Tipo visual. Por defecto `info`.
 * @property {number} [duration] Milisegundos visible. `0` = hasta cerrarlo. Por defecto 4000.
 */

/**
 * @typedef {object} ActiveWhisper
 * @property {string} id
 * @property {HTMLElement} element
 * @property {number} timer
 * @property {number} remaining Milisegundos restantes (para pausar al pasar el ratón).
 * @property {number} startedAt
 */

/** @type {readonly WhisperType[]} */
const TYPES = ['info', 'success', 'warning', 'error', 'arcane'];
/** @type {readonly WhisperPosition[]} */
const POSITIONS = ['top-end', 'top-center', 'bottom-end', 'bottom-center'];
const DEFAULT_DURATION = 4000;

/** @type {Record<WhisperType, string>} */
const ICONS = { info: 'spark', success: 'seal', warning: 'warning', error: 'warning', arcane: 'spark' };

const styles = css`
  :host {
    position: fixed;
    z-index: var(--gc-whisper-z, 1000);
    inset-block-start: var(--gc-space-4, 1.5rem);
    inset-inline-end: var(--gc-space-4, 1.5rem);
    display: grid;
    gap: var(--gc-space-2, 0.5rem);
    inline-size: min(22rem, calc(100vw - 2rem));
    pointer-events: none;
  }
  :host([position='top-center']) {
    inset-inline: 0;
    margin-inline: auto;
  }
  :host([position='bottom-end']) {
    inset-block: auto var(--gc-space-4, 1.5rem);
  }
  :host([position='bottom-center']) {
    inset-block: auto var(--gc-space-4, 1.5rem);
    inset-inline: 0;
    margin-inline: auto;
  }

  .whisper {
    --_tone: var(--gc-color-gold, #e8c675);
    pointer-events: auto;
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: start;
    gap: 0.75rem;
    padding: 0.85rem 0.9rem 0.85rem 1rem;
    color: var(--gc-color-ink, #ece7ff);
    font-family: var(--gc-font-body, Georgia, serif);
    font-size: 1.02rem;
    line-height: 1.35;
    background:
      linear-gradient(135deg, color-mix(in oklab, var(--_tone) 12%, transparent), transparent 60%),
      color-mix(in oklab, var(--gc-color-night, #0e0c1f) 88%, transparent);
    border: 1px solid color-mix(in oklab, var(--_tone) 45%, transparent);
    box-shadow: 0 10px 30px rgb(0 0 0 / 0.45), 0 0 18px color-mix(in oklab, var(--_tone) 18%, transparent);
    backdrop-filter: blur(6px);
  }
  /* Filete dorado a la izquierda, como el canto de un pergamino */
  .whisper::before {
    content: '';
    position: absolute;
    inset-block: 6px;
    inset-inline-start: -1px;
    inline-size: 2px;
    background: var(--_tone);
    box-shadow: 0 0 8px var(--_tone);
  }
  .whisper[data-type='success'] { --_tone: var(--gc-color-success, #7fe0b5); }
  .whisper[data-type='warning'] { --_tone: var(--gc-color-warning, #f2c36b); }
  .whisper[data-type='error'] { --_tone: var(--gc-color-danger, #ff6b7d); }
  .whisper[data-type='arcane'] { --_tone: var(--gc-color-violet, #8b6cf0); }

  .icon { color: var(--_tone); padding-block-start: 0.1rem; }
  .icon svg { inline-size: 1.15rem; block-size: 1.15rem; display: block; }
  .title {
    margin: 0 0 0.15rem;
    font-family: var(--gc-font-display, Georgia, serif);
    font-size: 0.9rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--_tone);
  }
  .title:empty { display: none; }
  .message { margin: 0; }

  .close {
    all: unset;
    cursor: pointer;
    color: var(--gc-color-muted, #a6a1c9);
    display: grid;
    place-items: center;
    inline-size: 1.6rem;
    block-size: 1.6rem;
    border-radius: 50%;
    transition: color var(--gc-duration-fast, 160ms);
  }
  .close:hover,
  .close:focus-visible { color: var(--gc-color-ink, #ece7ff); }
  .close:focus-visible { outline: 1px solid var(--_tone); }
  .close svg { inline-size: 0.95rem; block-size: 0.95rem; }
`;

/**
 * Avisos efímeros con estética de susurro arcano (notificaciones).
 *
 * Se coloca una sola vez en la página y se usa mediante su método `show()`.
 * El contenido siempre se inserta como texto (nunca como HTML), así que es
 * seguro mostrar mensajes con datos externos.
 *
 * Accesibilidad: la región es `role="status"` (lectores de pantalla la
 * anuncian sin interrumpir) y los avisos de error usan `role="alert"`.
 *
 * @tag gc-whisper
 * @summary Pila de notificaciones temporales.
 *
 * @attr {'top-end' | 'top-center' | 'bottom-end' | 'bottom-center'} position - Esquina donde aparecen. Por defecto `top-end`.
 * @attr {number} max-visible - Máximo de avisos simultáneos (1-10). Por defecto `3`.
 *
 * @prop {number} count - (Solo lectura) Avisos visibles ahora mismo.
 *
 * @fires {CustomEvent<{id: string, type: WhisperType, title: string, message: string}>} whisper-shown - Se ha mostrado un aviso.
 * @fires {CustomEvent<{id: string, reason: DismissReason}>} whisper-dismissed - Se ha retirado un aviso.
 *
 * @csspart whisper - Cada aviso.
 * @csspart close - Botón de cerrar.
 */
export class GcSusurro extends HTMLElement {
  static tagName = 'gc-whisper';
  static observedAttributes = ['position', 'max-visible'];

  /** Registra `<gc-whisper>` si no estaba registrado. */
  static define() {
    return defineElement(this.tagName, this);
  }

  /** @type {Map<string, ActiveWhisper>} */
  #active = new Map();
  #nextId = 1;
  /** @type {ShadowRoot} */
  #root;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.#root.adoptedStyleSheets = [baseStyles, styles];
  }

  connectedCallback() {
    if (!this.hasAttribute('role')) this.setAttribute('role', 'status');
    if (!this.hasAttribute('aria-live')) this.setAttribute('aria-live', 'polite');
  }

  disconnectedCallback() {
    for (const w of this.#active.values()) clearTimeout(w.timer);
    this.#active.clear();
    this.#root.replaceChildren();
  }

  /**
   * @param {string} name
   * @param {string | null} oldValue
   * @param {string | null} newValue
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === 'position') this.position;
    if (name === 'max-visible') this.#enforceLimit();
  }

  // ── Propiedades de diseño ─────────────────────────────────

  /** @returns {WhisperPosition} */
  get position() {
    return readEnum(this, 'position', POSITIONS, 'top-end');
  }
  set position(value) {
    this.setAttribute('position', value);
  }

  /** @returns {number} */
  get maxVisible() {
    return Math.round(readNumber(this, 'max-visible', { fallback: 3, min: 1, max: 10 }));
  }
  set maxVisible(value) {
    this.setAttribute('max-visible', String(value));
  }

  // ── Propiedades de ejecución ──────────────────────────────

  /** @returns {number} */
  get count() {
    return this.#active.size;
  }

  // ── Métodos públicos ──────────────────────────────────────

  /**
   * Muestra un aviso.
   *
   * @param {WhisperOptions} options
   * @returns {string} Identificador del aviso (para `dismiss`).
   * @throws {TypeError} Si falta `message` o no es texto.
   */
  show(options) {
    if (!options || typeof options !== 'object') {
      throw new TypeError('show() necesita un objeto { message, title?, type?, duration? }.');
    }
    const { message, title = '' } = options;
    if (typeof message !== 'string' || message.trim() === '') {
      throw new TypeError('show() necesita un "message" de texto no vacío.');
    }
    const type = TYPES.includes(/** @type {WhisperType} */ (options.type)) ? /** @type {WhisperType} */ (options.type) : 'info';
    if (options.type !== undefined && type !== options.type) {
      console.warn(`[glyphcraft-kit] <gc-whisper> type="${options.type}" no es válido; se usa "info".`);
    }
    let duration = options.duration ?? DEFAULT_DURATION;
    if (!Number.isFinite(duration) || duration < 0) {
      console.warn(`[glyphcraft-kit] <gc-whisper> duration=${duration} no es válido; se usa ${DEFAULT_DURATION}.`);
      duration = DEFAULT_DURATION;
    }

    const id = `whisper-${this.#nextId++}`;
    const element = this.#render(id, type, String(title), message);
    this.#root.append(element);
    element.animate(
      [
        { opacity: 0, transform: 'translateY(-8px) scale(0.98)', filter: 'blur(6px)' },
        { opacity: 1, transform: 'none', filter: 'blur(0)' },
      ],
      { duration: this.#reducedMotion() ? 1 : 380, easing: 'cubic-bezier(.22,.8,.24,1)' },
    );

    /** @type {ActiveWhisper} */
    const entry = { id, element, timer: 0, remaining: duration, startedAt: 0 };
    this.#active.set(id, entry);
    if (duration > 0) this.#startTimer(entry);

    element.addEventListener('pointerenter', () => this.#pauseTimer(entry));
    element.addEventListener('pointerleave', () => this.#startTimer(entry));

    emit(this, 'whisper-shown', { id, type, title: String(title), message });
    this.#enforceLimit();
    return id;
  }

  /**
   * Retira un aviso.
   *
   * @param {string} id
   * @returns {boolean} `false` si no existía.
   */
  dismiss(id) {
    return this.#remove(id, 'program');
  }

  /**
   * Retira todos los avisos.
   * @returns {number} Cuántos se han retirado.
   */
  dismissAll() {
    const ids = [...this.#active.keys()];
    ids.forEach((id) => this.#remove(id, 'program'));
    return ids.length;
  }

  // ── Interno ───────────────────────────────────────────────

  /**
   * Construye el aviso con `textContent` para no interpretar HTML ajeno.
   * @param {string} id
   * @param {WhisperType} type
   * @param {string} title
   * @param {string} message
   */
  #render(id, type, title, message) {
    const el = document.createElement('div');
    el.className = 'whisper';
    el.part.add('whisper');
    el.id = id;
    el.dataset.type = type;
    if (type === 'error') el.setAttribute('role', 'alert');
    el.innerHTML = `
      <span class="icon">${runeIcon(ICONS[type])}</span>
      <div><p class="title"></p><p class="message"></p></div>
      <button class="close" part="close" type="button" aria-label="Cerrar aviso">${runeIcon('close')}</button>`;
    /** @type {HTMLElement} */ (el.querySelector('.title')).textContent = title;
    /** @type {HTMLElement} */ (el.querySelector('.message')).textContent = message;
    el.querySelector('.close')?.addEventListener('click', () => this.#remove(id, 'user'));
    return el;
  }

  /** @param {ActiveWhisper} entry */
  #startTimer(entry) {
    if (entry.remaining <= 0 || !this.#active.has(entry.id)) return;
    clearTimeout(entry.timer);
    entry.startedAt = performance.now();
    entry.timer = window.setTimeout(() => this.#remove(entry.id, 'timeout'), entry.remaining);
  }

  /** @param {ActiveWhisper} entry */
  #pauseTimer(entry) {
    if (!entry.timer) return;
    clearTimeout(entry.timer);
    entry.timer = 0;
    entry.remaining = Math.max(0, entry.remaining - (performance.now() - entry.startedAt));
  }

  #enforceLimit() {
    const excess = this.#active.size - this.maxVisible;
    if (excess <= 0) return;
    [...this.#active.keys()].slice(0, excess).forEach((id) => this.#remove(id, 'overflow'));
  }

  /**
   * @param {string} id
   * @param {DismissReason} reason
   */
  #remove(id, reason) {
    const entry = this.#active.get(id);
    if (!entry) return false;
    clearTimeout(entry.timer);
    this.#active.delete(id);

    // El aviso se "disuelve" y después se elimina del DOM.
    const animation = entry.element.animate(
      [
        { opacity: 1, filter: 'blur(0)', letterSpacing: '0' },
        { opacity: 0, filter: 'blur(8px)', letterSpacing: '0.12em' },
      ],
      { duration: this.#reducedMotion() ? 1 : 420, easing: 'ease-in', fill: 'forwards' },
    );
    animation.finished.then(
      () => entry.element.remove(),
      () => entry.element.remove(),
    );

    emit(this, 'whisper-dismissed', { id, reason });
    return true;
  }

  #reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
