import { defineElement } from '../../interno/definir.js';
import { css, baseStyles } from '../../interno/estilos.js';
import { emit, readEnum, readNumber, reflectBoolean } from '../../interno/atributos.js';
import { runeIcon } from '../../iconos/runas.js';

/** @typedef {'primary' | 'ghost' | 'danger' | 'inscription'} RuneButtonVariant */
/** @typedef {'sm' | 'md' | 'lg'} RuneButtonSize */
/** @typedef {'idle' | 'hover' | 'charging' | 'active' | 'disabled'} RuneButtonState */
/** @typedef {'pointer' | 'keyboard' | 'program'} ActivationSource */

/** @type {readonly RuneButtonVariant[]} */
const VARIANTS = ['primary', 'ghost', 'danger', 'inscription'];
/** @type {readonly RuneButtonSize[]} */
const SIZES = ['sm', 'md', 'lg'];
/** Duración del estado `active` tras activarse (ms). */
const ACTIVE_FLASH_MS = 420;

const styles = css`
  :host {
    --_accent: var(--gc-rune-button-accent, var(--gc-color-gold, #e8c675));
    --_ink: var(--gc-color-ink, #ece7ff);
    display: inline-block;
    font-family: var(--gc-font-display, Georgia, serif);
    -webkit-tap-highlight-color: transparent;
  }
  :host([variant='danger']) {
    --_accent: var(--gc-rune-button-accent, var(--gc-color-danger, #ff6b7d));
  }

  button {
    all: unset;
    box-sizing: border-box;
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.7em;
    inline-size: 100%;
    padding: 0.72em 1.5em;
    color: var(--_ink);
    font-size: 1rem;
    letter-spacing: 0.08em;
    cursor: pointer;
    user-select: none;
    border: 1px solid color-mix(in oklab, var(--_accent) 55%, transparent);
    background:
      linear-gradient(180deg, rgb(255 255 255 / 0.05), transparent 60%),
      color-mix(in oklab, var(--gc-color-night, #0e0c1f) 70%, transparent);
    transition:
      border-color var(--gc-duration, 320ms) var(--gc-ease-arcane, ease),
      box-shadow var(--gc-duration, 320ms) var(--gc-ease-arcane, ease),
      color var(--gc-duration, 320ms) var(--gc-ease-arcane, ease),
      transform var(--gc-duration-fast, 160ms) ease;
  }

  /* Rombos ornamentales en los extremos */
  button::before,
  button::after {
    content: '';
    position: absolute;
    inset-block-start: 50%;
    inline-size: 6px;
    block-size: 6px;
    background: var(--_accent);
    transform: translateY(-50%) rotate(45deg);
    opacity: 0.75;
    transition: opacity var(--gc-duration, 320ms);
  }
  button::before { inset-inline-start: -3.5px; }
  button::after { inset-inline-end: -3.5px; }

  button:hover,
  :host(:state(charging)) button {
    border-color: var(--_accent);
    box-shadow: 0 0 14px color-mix(in oklab, var(--_accent) 45%, transparent),
      inset 0 0 18px color-mix(in oklab, var(--_accent) 12%, transparent);
  }
  button:active { transform: scale(0.98); }
  button:focus-visible {
    outline: 1px solid var(--_accent);
    outline-offset: 4px;
    box-shadow: 0 0 18px color-mix(in oklab, var(--_accent) 55%, transparent);
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.4;
    box-shadow: none;
    border-color: color-mix(in oklab, var(--_accent) 25%, transparent);
  }

  .icon {
    display: inline-grid;
    place-items: center;
    flex: none;
    color: var(--_accent);
  }
  .icon:empty { display: none; }
  .icon svg { inline-size: 1.25em; block-size: 1.25em; }

  .text { display: grid; gap: 0.15em; min-inline-size: 0; }
  .hint {
    font-family: var(--gc-font-body, Georgia, serif);
    font-style: italic;
    font-size: 0.82em;
    letter-spacing: 0.01em;
    color: var(--gc-color-muted, #a6a1c9);
  }
  .hint[hidden] { display: none; }

  /* Barra de carga (modo mantener pulsado) */
  .charge {
    position: absolute;
    inset-inline: 0;
    inset-block-end: -1px;
    block-size: 2px;
    background: var(--_accent);
    box-shadow: 0 0 10px var(--_accent);
    transform-origin: left center;
    transform: scaleX(var(--_charge, 0));
    pointer-events: none;
  }
  :host(:not(:state(charging))) .charge {
    transition: transform var(--gc-duration, 320ms) var(--gc-ease-arcane, ease);
  }

  /* Tamaños */
  :host([size='sm']) button { font-size: 0.85rem; padding: 0.5em 1.1em; }
  :host([size='lg']) button { font-size: 1.2rem; padding: 0.85em 1.8em; }

  /* Variante ghost: sin caja */
  :host([variant='ghost']) button {
    border-color: transparent;
    background: none;
    color: var(--gc-color-muted, #a6a1c9);
    padding-inline: 0.6em;
  }
  :host([variant='ghost']) button::before,
  :host([variant='ghost']) button::after { opacity: 0; }
  :host([variant='ghost']) button:hover,
  :host([variant='ghost']) button:focus-visible {
    color: var(--_ink);
    border-color: transparent;
    box-shadow: none;
  }

  /* Variante inscription: entrada de menú tallada en el grimorio */
  :host([variant='inscription']) button {
    border: none;
    background: none;
    padding: 0.55em 0.2em;
    gap: 1em;
    font-size: 1.3rem;
  }
  :host([variant='inscription']) button::before,
  :host([variant='inscription']) button::after { display: none; }
  :host([variant='inscription']) .icon {
    inline-size: 2.3em;
    block-size: 2.3em;
    border: 1px solid color-mix(in oklab, var(--_accent) 45%, transparent);
    border-radius: 50%;
    transition: box-shadow var(--gc-duration, 320ms), border-color var(--gc-duration, 320ms),
      transform var(--gc-duration-slow, 700ms) var(--gc-ease-arcane, ease);
  }
  :host([variant='inscription']) .icon svg { inline-size: 1.05em; block-size: 1.05em; }
  :host([variant='inscription']) .label {
    position: relative;
    justify-self: start;
  }
  :host([variant='inscription']) .label::after {
    content: '';
    position: absolute;
    inset-inline: 0;
    inset-block-end: -0.12em;
    block-size: 1px;
    background: linear-gradient(90deg, transparent, var(--_accent), transparent);
    transform: scaleX(0);
    transition: transform var(--gc-duration, 320ms) var(--gc-ease-arcane, ease);
  }
  :host([variant='inscription']) button:hover,
  :host([variant='inscription']) button:focus-visible {
    box-shadow: none;
    outline: none;
  }
  :host([variant='inscription']) button:is(:hover, :focus-visible) .icon {
    border-color: var(--_accent);
    box-shadow: 0 0 16px color-mix(in oklab, var(--_accent) 50%, transparent);
    transform: rotate(30deg);
  }
  :host([variant='inscription']) button:is(:hover, :focus-visible) .label::after {
    transform: scaleX(1);
  }

  /* Pulso al activarse */
  :host(:state(active)) button {
    animation: pulse 520ms var(--gc-ease-arcane, ease-out);
  }
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--_accent) 70%, transparent); }
    100% { box-shadow: 0 0 0 14px transparent; }
  }
`;

/**
 * Botón con estética de runa tallada.
 *
 * Puede activarse con un clic normal o, si `hold-ms` es mayor que 0, exigir
 * que se mantenga pulsado durante ese tiempo. El modo "mantener" sirve para
 * acciones delicadas (como borrar todo) y para pulsar botones sin clic,
 * por ejemplo con gestos.
 *
 * @tag gc-rune-button
 * @summary Botón temático con estados, icono rúnico y activación por pulsación mantenida.
 *
 * @attr {'primary' | 'ghost' | 'danger' | 'inscription'} variant - Estilo visual. Por defecto `primary`.
 * @attr {'sm' | 'md' | 'lg'} size - Tamaño. Por defecto `md`.
 * @attr {string} rune - Nombre del icono rúnico (ver `RUNE_NAMES`). Por defecto, sin icono.
 * @attr {boolean} disabled - Desactiva el botón. Por defecto `false`.
 * @attr {number} hold-ms - Milisegundos que hay que mantenerlo pulsado (0-10000). `0` = clic normal. Por defecto `0`.
 * @attr {'true' | 'false'} pressed - Convierte el botón en interruptor (aria-pressed). Sin atributo, es un botón normal.
 *
 * @prop {RuneButtonState} state - (Solo lectura) Estado de ejecución actual.
 * @prop {number} charge - (Solo lectura) Carga acumulada en modo mantener, de 0 a 1.
 *
 * @fires {CustomEvent<{source: ActivationSource}>} rune-activate - El botón se ha activado.
 * @fires {CustomEvent<{charge: number}>} charge-change - La carga cambia mientras se mantiene pulsado.
 *
 * @slot - Texto principal del botón.
 * @slot hint - Texto secundario bajo el principal (útil en menús).
 *
 * @csspart button - El `<button>` interno.
 * @csspart icon - Contenedor del icono.
 * @csspart label - Texto principal.
 * @csspart hint - Texto secundario.
 * @csspart charge - Barra de carga del modo mantener.
 *
 * @cssprop --gc-rune-button-accent - Color de acento (borde, icono, brillo).
 *
 * @cssstate charging - Se está manteniendo pulsado.
 * @cssstate active - Acaba de activarse.
 */
export class GcBotonRuna extends HTMLElement {
  static tagName = 'gc-rune-button';
  static observedAttributes = ['variant', 'size', 'rune', 'disabled', 'hold-ms', 'pressed'];

  /** Registra `<gc-rune-button>` si no estaba registrado. */
  static define() {
    return defineElement(this.tagName, this);
  }

  // ── Estado interno (privado) ──────────────────────────────
  /** @type {ElementInternals} */
  #internals;
  /** @type {HTMLButtonElement} */
  #button;
  /** @type {HTMLElement} */
  #icon;
  #hovered = false;
  #charge = 0;
  /** @type {ActivationSource | null} */
  #chargeSource = null;
  #chargeStart = 0;
  #chargeFrame = 0;
  #activeTimer = 0;

  constructor() {
    super();
    this.#internals = this.attachInternals();
    const root = this.attachShadow({ mode: 'open', delegatesFocus: true });
    root.adoptedStyleSheets = [baseStyles, styles];
    root.innerHTML = `
      <button part="button" type="button">
        <span part="icon" class="icon"></span>
        <span class="text">
          <span part="label" class="label"><slot></slot></span>
          <span part="hint" class="hint" hidden><slot name="hint"></slot></span>
        </span>
        <span part="charge" class="charge" aria-hidden="true"></span>
      </button>`;
    this.#button = /** @type {HTMLButtonElement} */ (root.querySelector('button'));
    this.#icon = /** @type {HTMLElement} */ (root.querySelector('.icon'));

    // El texto secundario solo ocupa espacio si alguien le asigna contenido.
    const hint = /** @type {HTMLElement} */ (root.querySelector('.hint'));
    const hintSlot = /** @type {HTMLSlotElement} */ (root.querySelector('slot[name="hint"]'));
    hintSlot.addEventListener('slotchange', () => {
      hint.hidden = hintSlot.assignedNodes().length === 0;
    });

    this.#button.addEventListener('click', this.#onClick);
    this.#button.addEventListener('pointerenter', () => this.#setHovered(true));
    this.#button.addEventListener('pointerleave', () => {
      this.#setHovered(false);
      this.#cancelCharge();
    });
    this.#button.addEventListener('pointerdown', this.#onPointerDown);
    this.#button.addEventListener('pointerup', () => this.#cancelCharge());
    this.#button.addEventListener('pointercancel', () => this.#cancelCharge());
    this.#button.addEventListener('keydown', this.#onKeyDown);
    this.#button.addEventListener('keyup', this.#onKeyUp);
    this.#button.addEventListener('blur', () => this.#cancelCharge());
  }

  // ── Propiedades de diseño (reflejadas como atributos) ─────

  /** @returns {RuneButtonVariant} */
  get variant() {
    return readEnum(this, 'variant', VARIANTS, 'primary');
  }
  set variant(value) {
    this.setAttribute('variant', value);
  }

  /** @returns {RuneButtonSize} */
  get size() {
    return readEnum(this, 'size', SIZES, 'md');
  }
  set size(value) {
    this.setAttribute('size', value);
  }

  /** @returns {string} */
  get rune() {
    return this.getAttribute('rune') ?? '';
  }
  set rune(value) {
    if (value) this.setAttribute('rune', value);
    else this.removeAttribute('rune');
  }

  /** @returns {boolean} */
  get disabled() {
    return this.hasAttribute('disabled');
  }
  set disabled(value) {
    reflectBoolean(this, 'disabled', value);
  }

  /**
   * Estado de interruptor: `true`/`false`, o `null` si no es un interruptor.
   * @returns {boolean | null}
   */
  get pressed() {
    const value = this.getAttribute('pressed');
    return value === null ? null : value === 'true';
  }
  set pressed(value) {
    if (value === null) this.removeAttribute('pressed');
    else this.setAttribute('pressed', String(Boolean(value)));
  }

  /** @returns {number} */
  get holdMs() {
    return readNumber(this, 'hold-ms', { fallback: 0, min: 0, max: 10000 });
  }
  set holdMs(value) {
    this.setAttribute('hold-ms', String(value));
  }

  // ── Propiedades de ejecución (solo lectura) ───────────────

  /** @returns {RuneButtonState} */
  get state() {
    if (this.disabled) return 'disabled';
    if (this.#internals.states.has('active')) return 'active';
    if (this.#chargeSource) return 'charging';
    if (this.#hovered) return 'hover';
    return 'idle';
  }

  /** @returns {number} */
  get charge() {
    return this.#charge;
  }

  // ── Ciclo de vida ─────────────────────────────────────────

  /**
   * @param {string} name
   * @param {string | null} oldValue
   * @param {string | null} newValue
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    switch (name) {
      case 'rune': {
        const icon = newValue ? runeIcon(newValue) : '';
        if (newValue && !icon) console.warn(`[glyphcraft-kit] <gc-rune-button> rune="${newValue}" no existe.`);
        this.#icon.innerHTML = icon;
        break;
      }
      case 'disabled':
        this.#button.disabled = this.disabled;
        if (this.disabled) this.#cancelCharge();
        break;
      case 'variant':
        this.variant; // valida y avisa si el valor no es correcto
        break;
      case 'size':
        this.size;
        break;
      case 'pressed':
        // El rol accesible lo tiene el <button> interno, no el elemento anfitrión.
        if (newValue === null) this.#button.removeAttribute('aria-pressed');
        else this.#button.setAttribute('aria-pressed', String(newValue === 'true'));
        break;
      case 'hold-ms':
        if (this.holdMs > 0) this.#button.setAttribute('aria-description', 'Mantén pulsado para activar');
        else this.#button.removeAttribute('aria-description');
        break;
    }
  }

  disconnectedCallback() {
    this.#cancelCharge();
    clearTimeout(this.#activeTimer);
    this.#internals.states.delete('active');
  }

  // ── Métodos públicos ──────────────────────────────────────

  /**
   * Activa el botón desde código (por ejemplo, desde el cursor de la mano).
   *
   * @param {ActivationSource} [source='program']
   * @returns {boolean} `false` si el botón está desactivado.
   */
  activate(source = 'program') {
    if (this.disabled) return false;
    this.#cancelCharge();
    this.pulse();
    emit(this, 'rune-activate', { source });
    return true;
  }

  /** Reproduce el destello de activación sin emitir ningún evento. */
  pulse() {
    clearTimeout(this.#activeTimer);
    this.#internals.states.delete('active');
    // Forzar un reflow reinicia la animación aunque ya estuviera en curso.
    void this.#button.offsetWidth;
    this.#internals.states.add('active');
    this.#activeTimer = window.setTimeout(() => this.#internals.states.delete('active'), ACTIVE_FLASH_MS);
  }

  // ── Comportamiento interno ────────────────────────────────

  /** @param {boolean} value */
  #setHovered(value) {
    this.#hovered = value;
  }

  /** @param {MouseEvent} event */
  #onClick = (event) => {
    if (this.disabled || this.holdMs > 0) return;
    // `detail === 0` indica un clic generado por teclado (Enter / Espacio).
    this.activate(event.detail === 0 ? 'keyboard' : 'pointer');
  };

  /** @param {PointerEvent} event */
  #onPointerDown = (event) => {
    if (event.button !== 0 || this.holdMs <= 0 || this.disabled) return;
    this.#startCharge('pointer');
  };

  /** @param {KeyboardEvent} event */
  #onKeyDown = (event) => {
    if (this.holdMs <= 0 || this.disabled) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault(); // evita el clic nativo
    if (!event.repeat) this.#startCharge('keyboard');
  };

  /** @param {KeyboardEvent} event */
  #onKeyUp = (event) => {
    if (event.key === 'Enter' || event.key === ' ') this.#cancelCharge();
  };

  /** @param {ActivationSource} source */
  #startCharge(source) {
    if (this.#chargeSource) return;
    this.#chargeSource = source;
    this.#chargeStart = performance.now();
    this.#internals.states.add('charging');
    this.#chargeFrame = requestAnimationFrame(this.#tickCharge);
  }

  #tickCharge = () => {
    const progress = Math.min(1, (performance.now() - this.#chargeStart) / this.holdMs);
    this.#setCharge(progress);
    if (progress >= 1) {
      const source = this.#chargeSource ?? 'pointer';
      this.activate(source);
      return;
    }
    this.#chargeFrame = requestAnimationFrame(this.#tickCharge);
  };

  #cancelCharge() {
    cancelAnimationFrame(this.#chargeFrame);
    this.#chargeFrame = 0;
    this.#chargeSource = null;
    this.#internals.states.delete('charging');
    if (this.#charge !== 0) this.#setCharge(0);
  }

  /** @param {number} value */
  #setCharge(value) {
    this.#charge = value;
    this.#button.style.setProperty('--_charge', String(value));
    emit(this, 'charge-change', { charge: value });
  }
}
