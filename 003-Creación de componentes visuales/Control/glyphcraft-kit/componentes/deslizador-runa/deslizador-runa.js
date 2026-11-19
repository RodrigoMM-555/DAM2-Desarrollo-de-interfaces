import { defineElement } from '../../interno/definir.js';
import { css, baseStyles } from '../../interno/estilos.js';
import { emit, readNumber } from '../../interno/atributos.js';

const styles = css`
  :host {
    display: block;
    --_accent: var(--gc-rune-slider-accent, var(--gc-color-gold, #e8c675));
  }
  :host([disabled]) { opacity: 0.45; }
  label {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.35rem 1rem;
    font-family: var(--gc-font-body, Georgia, serif);
    font-size: 1.05rem;
    color: var(--gc-color-ink, #ece7ff);
  }
  .value {
    font-family: var(--gc-font-display, Georgia, serif);
    font-size: 0.85rem;
    letter-spacing: 0.06em;
    color: var(--_accent);
  }
  input {
    grid-column: 1 / -1;
    inline-size: 100%;
    margin: 0;
    appearance: none;
    background: transparent;
    cursor: pointer;
    --_fill: 50%;
  }
  input:disabled { cursor: not-allowed; }
  input::-webkit-slider-runnable-track {
    block-size: 3px;
    background: linear-gradient(90deg, var(--_accent) var(--_fill), color-mix(in oklab, var(--_accent) 22%, transparent) var(--_fill));
  }
  input::-moz-range-track {
    block-size: 3px;
    background: linear-gradient(90deg, var(--_accent) var(--_fill), color-mix(in oklab, var(--_accent) 22%, transparent) var(--_fill));
  }
  input::-webkit-slider-thumb {
    appearance: none;
    inline-size: 1rem;
    block-size: 1rem;
    margin-block-start: -0.4rem;
    border-radius: 50%;
    background: var(--gc-color-night, #0e0c1f);
    border: 2px solid var(--_accent);
    box-shadow: 0 0 10px color-mix(in oklab, var(--_accent) 60%, transparent);
  }
  input::-moz-range-thumb {
    inline-size: 0.8rem;
    block-size: 0.8rem;
    border-radius: 50%;
    background: var(--gc-color-night, #0e0c1f);
    border: 2px solid var(--_accent);
  }
  input:focus-visible { outline: 1px solid var(--_accent); outline-offset: 6px; }
`;

/**
 * Deslizador rúnico **asociado a formularios**.
 *
 * Por dentro usa un `<input type="range">` nativo (teclado y lectores de
 * pantalla funcionan sin trabajo extra) y por fuera se comporta como un
 * control de formulario gracias a `ElementInternals`.
 *
 * @tag gc-rune-slider
 * @summary Deslizador para formularios.
 *
 * @attr {string} label - Texto de la etiqueta.
 * @attr {number} min - Mínimo. Por defecto `0`.
 * @attr {number} max - Máximo. Por defecto `100`.
 * @attr {number} step - Paso. Por defecto `1`.
 * @attr {number} value - Valor inicial (y valor al restablecer el formulario).
 * @attr {string} name - Nombre del campo en el formulario.
 * @attr {boolean} disabled
 *
 * @prop {number} value - (Ejecución) Valor actual.
 * @prop {(value: number) => string} formatter - (Diseño) Cómo se muestra el valor. Por defecto, el número.
 * @prop {HTMLFormElement | null} form - (Solo lectura)
 *
 * @fires {InputEvent} input - Mientras se arrastra (evento nativo del input interno).
 * @fires {CustomEvent<{value: number}>} change - Al soltar o con el teclado.
 *
 * @csspart input
 * @csspart value
 * @cssprop --gc-rune-slider-accent
 */
export class GcDeslizadorRuna extends HTMLElement {
  static tagName = 'gc-rune-slider';
  static formAssociated = true;
  static observedAttributes = ['label', 'min', 'max', 'step', 'value', 'disabled'];

  static define() {
    return defineElement(this.tagName, this);
  }

  /** @type {ElementInternals} */
  #internals;
  /** @type {HTMLInputElement} */
  #input;
  /** @type {HTMLElement} */
  #valueText;
  /** @type {(value: number) => string} */
  #formatter = (v) => String(v);
  #dirty = false;

  constructor() {
    super();
    this.#internals = this.attachInternals();
    const root = this.attachShadow({ mode: 'open', delegatesFocus: true });
    root.adoptedStyleSheets = [baseStyles, styles];
    root.innerHTML = `
      <label>
        <span class="label"></span>
        <span class="value" part="value" aria-hidden="true"></span>
        <input type="range" part="input">
      </label>`;
    this.#input = /** @type {HTMLInputElement} */ (root.querySelector('input'));
    this.#valueText = /** @type {HTMLElement} */ (root.querySelector('.value'));
    // `input` es un evento "composed": sale del Shadow DOM por sí solo.
    this.#input.addEventListener('input', () => {
      this.#dirty = true;
      this.#sync();
    });
    // `change` no lo es: se reemite desde el componente.
    this.#input.addEventListener('change', () => emit(this, 'change', { value: this.value }));
  }

  connectedCallback() {
    this.#syncAttributes();
  }

  /**
   * @param {string} name
   * @param {string | null} oldValue
   * @param {string | null} newValue
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) this.#syncAttributes(name);
  }

  get min() {
    return readNumber(this, 'min', { fallback: 0 });
  }
  get max() {
    return readNumber(this, 'max', { fallback: 100 });
  }
  get step() {
    return readNumber(this, 'step', { fallback: 1, min: 1e-9 });
  }

  get value() {
    return Number(this.#input.value);
  }
  set value(v) {
    if (!Number.isFinite(Number(v))) throw new TypeError('<gc-rune-slider>.value debe ser numérico.');
    this.#dirty = true;
    this.#input.value = String(v);
    this.#sync();
  }

  get formatter() {
    return this.#formatter;
  }
  set formatter(fn) {
    if (typeof fn !== 'function') throw new TypeError('<gc-rune-slider>.formatter debe ser una función.');
    this.#formatter = fn;
    this.#sync();
  }

  get name() {
    return this.getAttribute('name') ?? '';
  }

  get form() {
    return this.#internals.form;
  }

  formResetCallback() {
    this.#dirty = false;
    this.#syncAttributes();
  }

  /** @param {boolean} disabled */
  formDisabledCallback(disabled) {
    this.toggleAttribute('disabled', disabled);
  }

  /** @param {string} [changed] */
  #syncAttributes(changed) {
    /** @type {HTMLElement} */ (this.shadowRoot?.querySelector('.label')).textContent = this.getAttribute('label') ?? '';
    this.#input.min = String(this.min);
    this.#input.max = String(this.max);
    this.#input.step = String(this.step);
    this.#input.disabled = this.hasAttribute('disabled');
    this.#input.setAttribute('aria-label', this.getAttribute('label') ?? '');
    if (!this.#dirty || changed === undefined) {
      const initial = readNumber(this, 'value', { fallback: (this.min + this.max) / 2 });
      this.#input.value = String(initial);
    }
    this.#sync();
  }

  #sync() {
    const value = this.value;
    const text = this.#formatter(value);
    this.#valueText.textContent = text;
    this.#input.setAttribute('aria-valuetext', text);
    const fill = ((value - this.min) / (this.max - this.min || 1)) * 100;
    this.#input.style.setProperty('--_fill', `${fill}%`);
    this.#internals.setFormValue(String(value));
  }
}
