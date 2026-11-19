import { defineElement } from '../../interno/definir.js';
import { css, baseStyles } from '../../interno/estilos.js';
import { emit, readEnum, readNumber } from '../../interno/atributos.js';

/** @typedef {'ring' | 'seals' | 'bar'} MeterVariant */

const styles = css`
  :host {
    --_tone: var(--gc-meter-color, var(--gc-color-gold, #e8c675));
    --_track: color-mix(in oklab, var(--_tone) 18%, transparent);
    display: inline-grid;
    justify-items: center;
    gap: 0.35rem;
    font-family: var(--gc-font-display, Georgia, serif);
    color: var(--gc-color-ink, #ece7ff);
  }
  :host(:state(passed)) { --_tone: var(--gc-meter-pass-color, var(--gc-color-success, #7fe0b5)); }
  :host(:state(failed)) { --_tone: var(--gc-meter-fail-color, var(--gc-color-danger, #ff6b7d)); }
  .label {
    font-size: 0.72rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--gc-color-muted, #a6a1c9);
  }
  .label:empty { display: none; }

  /* Anillo */
  .ring {
    position: relative;
    inline-size: var(--gc-meter-size, 6rem);
    aspect-ratio: 1;
    display: grid;
    place-items: center;
  }
  .ring svg {
    position: absolute;
    inset: 0;
    transform: rotate(-90deg);
    fill: none;
    stroke-width: 3;
    overflow: visible;
  }
  .ring .track { stroke: var(--_track); }
  .ring .value {
    stroke: var(--_tone);
    stroke-linecap: round;
    stroke-dasharray: 1;
    stroke-dashoffset: calc(1 - var(--_ratio, 0));
    filter: drop-shadow(0 0 5px var(--_tone));
    transition: stroke-dashoffset 700ms var(--gc-ease-arcane, ease), stroke 320ms;
  }
  .ring .threshold { stroke: var(--gc-color-ink, #ece7ff); stroke-width: 1.5; opacity: 0.7; }
  .number {
    font-size: calc(var(--gc-meter-size, 6rem) * 0.3);
    color: var(--_tone);
    transition: color 320ms;
  }

  /* Sellos */
  .seals { display: flex; gap: 0.45rem; }
  .seal {
    inline-size: var(--gc-meter-seal-size, 1.1rem);
    aspect-ratio: 1;
    border-radius: 50%;
    border: 1px solid color-mix(in oklab, var(--_tone) 60%, transparent);
    box-shadow: inset 0 0 0 3px transparent;
    transition: background 400ms, box-shadow 400ms, transform 400ms var(--gc-ease-arcane, ease);
  }
  .seal.is-filled {
    background: radial-gradient(circle, #fff 0 18%, var(--_tone) 40%, color-mix(in oklab, var(--_tone) 60%, transparent));
    box-shadow: 0 0 10px var(--_tone);
    transform: scale(1.08);
  }

  /* Barra */
  .bar {
    inline-size: var(--gc-meter-width, 10rem);
    block-size: 3px;
    background: var(--_track);
    overflow: hidden;
  }
  .bar span {
    display: block;
    block-size: 100%;
    background: var(--_tone);
    box-shadow: 0 0 8px var(--_tone);
    transform-origin: left;
    transform: scaleX(var(--_ratio, 0));
    transition: transform 700ms var(--gc-ease-arcane, ease);
  }
  :host(:not([variant='seals'])) .seals,
  :host(:not([variant='bar'])) .bar,
  :host([variant='seals']) .ring,
  :host([variant='bar']) .ring { display: none; }
`;

/**
 * Indicador de progreso con tres estilos: anillo con número (precisión),
 * sellos (aciertos para aprender un glifo) o barra.
 *
 * Usa `ElementInternals` para exponer el rol ARIA `meter` y su valor: los
 * lectores de pantalla lo anuncian como un medidor real.
 *
 * @tag gc-arcane-meter
 * @summary Indicador de progreso o precisión.
 *
 * @attr {number} value - Valor actual (0-max). Por defecto `0`.
 * @attr {number} max - Valor máximo (> 0). Por defecto `100`.
 * @attr {'ring' | 'seals' | 'bar'} variant - Estilo. Por defecto `ring`.
 * @attr {string} label - Etiqueta visible y accesible.
 * @attr {number} threshold - Valor a superar: añade una marca y los estados `passed`/`failed`.
 *
 * @fires {CustomEvent<{value: number, max: number}>} meter-complete - El valor alcanza el máximo.
 *
 * @csspart label
 * @cssprop --gc-meter-color - Color principal.
 * @cssprop --gc-meter-size - Diámetro del anillo.
 * @cssstate passed - El valor alcanza `threshold`.
 * @cssstate failed - Hay `threshold` y no se alcanza (con valor > 0).
 */
export class GcMedidorArcano extends HTMLElement {
  static tagName = 'gc-arcane-meter';
  static observedAttributes = ['value', 'max', 'variant', 'label', 'threshold'];

  static define() {
    return defineElement(this.tagName, this);
  }

  /** @type {ElementInternals} */
  #internals;
  /** @type {ShadowRoot} */
  #root;
  #shown = 0;
  #countFrame = 0;
  #previous = 0;

  constructor() {
    super();
    this.#internals = this.attachInternals();
    this.#internals.role = 'meter';
    this.#root = this.attachShadow({ mode: 'open' });
    this.#root.adoptedStyleSheets = [baseStyles, styles];
    this.#root.innerHTML = `
      <div class="ring">
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <circle class="track" cx="20" cy="20" r="18"/>
          <circle class="value" cx="20" cy="20" r="18" pathLength="1"/>
          <line class="threshold" x1="38" y1="20" x2="41.5" y2="20"/>
        </svg>
        <span class="number" aria-hidden="true">0</span>
      </div>
      <div class="seals" aria-hidden="true"></div>
      <div class="bar" aria-hidden="true"><span></span></div>
      <span class="label" part="label"></span>`;
  }

  connectedCallback() {
    this.#update(false);
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.#countFrame);
  }

  /**
   * @param {string} name
   * @param {string | null} oldValue
   * @param {string | null} newValue
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) this.#update(name === 'value');
  }

  get value() {
    return readNumber(this, 'value', { fallback: 0, min: 0, max: this.max });
  }
  set value(v) {
    this.setAttribute('value', String(v));
  }

  get max() {
    return readNumber(this, 'max', { fallback: 100, min: 1e-9, max: Infinity });
  }
  set max(v) {
    this.setAttribute('max', String(v));
  }

  /** @returns {MeterVariant} */
  get variant() {
    return readEnum(this, 'variant', /** @type {const} */ (['ring', 'seals', 'bar']), 'ring');
  }
  set variant(v) {
    this.setAttribute('variant', v);
  }

  get label() {
    return this.getAttribute('label') ?? '';
  }
  set label(v) {
    this.setAttribute('label', v);
  }

  /** @returns {number | null} */
  get threshold() {
    return this.hasAttribute('threshold') ? readNumber(this, 'threshold', { fallback: 0, min: 0, max: this.max }) : null;
  }
  set threshold(v) {
    if (v === null) this.removeAttribute('threshold');
    else this.setAttribute('threshold', String(v));
  }

  /**
   * Cambia el valor, con o sin animación del número.
   * @param {number} value
   * @param {{ animate?: boolean }} [options]
   */
  setValue(value, { animate = true } = {}) {
    if (!Number.isFinite(value)) throw new TypeError('setValue necesita un número.');
    if (!animate) this.#shown = Math.min(this.max, Math.max(0, value));
    this.value = value;
  }

  /** @param {boolean} animate */
  #update(animate) {
    const value = this.value;
    const max = this.max;
    const ratio = value / max;
    const threshold = this.threshold;

    this.style.setProperty('--_ratio', String(ratio));
    /** @type {HTMLElement} */ (this.#root.querySelector('.label')).textContent = this.label;

    // Marca del umbral en el anillo
    const line = /** @type {SVGLineElement} */ (this.#root.querySelector('.threshold'));
    line.style.display = threshold === null ? 'none' : '';
    if (threshold !== null) line.setAttribute('transform', `rotate(${(threshold / max) * 360} 20 20)`);

    // Sellos
    const seals = /** @type {HTMLElement} */ (this.#root.querySelector('.seals'));
    if (this.variant === 'seals') {
      const count = Math.min(20, Math.round(max));
      if (seals.childElementCount !== count) seals.innerHTML = '<span class="seal"></span>'.repeat(count);
      [...seals.children].forEach((s, i) => s.classList.toggle('is-filled', i < Math.round(value)));
    }

    // Estados y accesibilidad
    const states = this.#internals.states;
    states.delete('passed');
    states.delete('failed');
    if (threshold !== null && value > 0) states.add(value >= threshold ? 'passed' : 'failed');
    this.#internals.ariaValueNow = String(value);
    this.#internals.ariaValueMin = '0';
    this.#internals.ariaValueMax = String(max);
    this.#internals.ariaLabel = this.label || null;

    this.#animateNumber(value, animate);
    if (value >= max && this.#previous < max) emit(this, 'meter-complete', { value, max });
    this.#previous = value;
  }

  /**
   * @param {number} target
   * @param {boolean} animate
   */
  #animateNumber(target, animate) {
    const number = /** @type {HTMLElement} */ (this.#root.querySelector('.number'));
    cancelAnimationFrame(this.#countFrame);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!animate || reduced || !this.isConnected) {
      this.#shown = target;
      number.textContent = String(Math.round(target));
      return;
    }
    const from = this.#shown;
    const start = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / 700);
      this.#shown = from + (target - from) * (1 - (1 - t) ** 3);
      number.textContent = String(Math.round(this.#shown));
      if (t < 1) this.#countFrame = requestAnimationFrame(step);
    };
    step();
  }
}
