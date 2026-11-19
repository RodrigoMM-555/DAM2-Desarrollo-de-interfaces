import { defineElement } from '../../interno/definir.js';
import { css, baseStyles } from '../../interno/estilos.js';
import { runeIcon } from '../../iconos/runas.js';

/** @typedef {import('../../nucleo/gestos/motor-gestos.js').GestureState} GestureState */

/** @type {Record<GestureState, { label: string, rune: string }>} */
const STATES = {
  none: { label: 'Sin manos', rune: 'eye' },
  idle: { label: 'Esperando', rune: 'palm' },
  pointing: { label: 'Señalando', rune: 'point' },
  drawing: { label: 'Dibujando', rune: 'point' },
  erasing: { label: 'Borrando…', rune: 'palm' },
  sealing: { label: 'Sellando…', rune: 'fist' },
};

/** Estados válidos. */
export const GESTURE_STATES = Object.freeze(/** @type {GestureState[]} */ (Object.keys(STATES)));

const styles = css`
  :host {
    --_tone: var(--gc-color-muted, #a6a1c9);
    display: inline-flex;
    align-items: center;
    gap: 0.7rem;
    font-family: var(--gc-font-display, Georgia, serif);
    letter-spacing: 0.08em;
    color: var(--gc-color-ink, #ece7ff);
  }
  :host(:state(idle)) { --_tone: var(--gc-color-azure, #6fb6ff); }
  :host(:state(pointing)) { --_tone: var(--gc-color-ink, #ece7ff); }
  :host(:state(drawing)) { --_tone: var(--gc-color-gold, #e8c675); }
  :host(:state(erasing)) { --_tone: var(--gc-color-danger, #ff6b7d); }
  :host(:state(sealing)) { --_tone: var(--gc-color-violet, #8b6cf0); }

  .dial {
    position: relative;
    display: grid;
    place-items: center;
    inline-size: 2.8rem;
    block-size: 2.8rem;
    color: var(--_tone);
    transition: color var(--gc-duration, 320ms);
  }
  .dial svg.icon { inline-size: 1.35rem; block-size: 1.35rem; }
  .ring {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    transform: rotate(-90deg);
    fill: none;
    stroke-width: 2;
  }
  .ring .track { stroke: color-mix(in oklab, var(--_tone) 25%, transparent); }
  .ring .value {
    stroke: var(--_tone);
    stroke-linecap: round;
    stroke-dasharray: 1;
    stroke-dashoffset: calc(1 - var(--_progress, 0));
    filter: drop-shadow(0 0 4px var(--_tone));
  }
  :host(:state(drawing)) .ring .value { stroke-dashoffset: 0; }
  .label { font-size: 0.95rem; }
  :host([compact]) .label { display: none; }
`;

/**
 * Indicador del gesto reconocido: icono, texto y anillo de progreso.
 *
 * Es un componente "tonto" (solo presentación): recibe el estado desde
 * fuera y no sabe nada de cámaras ni del motor de gestos.
 *
 * @tag gc-gesture-indicator
 * @summary Muestra qué gesto se está reconociendo.
 *
 * @attr {boolean} compact - Solo el icono, sin texto.
 * @prop {GestureState} state - (Ejecución) Gesto actual. Por defecto `none`.
 * @prop {number} progress - (Ejecución) Progreso de borrar/sellar (0-1). Por defecto 0.
 *
 * @cssstate none | idle | pointing | drawing | erasing | sealing - Gesto actual.
 * @csspart dial - Icono con el anillo.
 * @csspart label - Texto del estado.
 */
export class GcIndicadorGesto extends HTMLElement {
  static tagName = 'gc-gesture-indicator';

  static define() {
    return defineElement(this.tagName, this);
  }

  /** @type {ElementInternals} */
  #internals;
  /** @type {GestureState} */
  #state = 'none';
  #progress = 0;
  /** @type {HTMLElement} */
  #dial;
  /** @type {HTMLElement} */
  #icon;
  /** @type {HTMLElement} */
  #label;

  constructor() {
    super();
    this.#internals = this.attachInternals();
    const root = this.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [baseStyles, styles];
    root.innerHTML = `
      <span class="dial" part="dial">
        <svg class="ring" viewBox="0 0 40 40" aria-hidden="true">
          <circle class="track" cx="20" cy="20" r="18"/>
          <circle class="value" cx="20" cy="20" r="18" pathLength="1"/>
        </svg>
        <span class="icon-slot"></span>
      </span>
      <span class="label" part="label"></span>`;
    this.#dial = /** @type {HTMLElement} */ (root.querySelector('.dial'));
    this.#icon = /** @type {HTMLElement} */ (root.querySelector('.icon-slot'));
    this.#label = /** @type {HTMLElement} */ (root.querySelector('.label'));
  }

  connectedCallback() {
    if (!this.hasAttribute('role')) this.setAttribute('role', 'status');
    this.#render();
  }

  /** @returns {GestureState} */
  get state() {
    return this.#state;
  }
  set state(value) {
    if (!GESTURE_STATES.includes(value)) {
      console.warn(`[glyphcraft-kit] <gc-gesture-indicator> estado "${value}" no válido.`);
      return;
    }
    if (value === this.#state) return;
    this.#state = value;
    if (value !== 'erasing' && value !== 'sealing') this.#progress = 0;
    this.#render();
  }

  get progress() {
    return this.#progress;
  }
  set progress(value) {
    const n = Number(value);
    this.#progress = Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
    this.#dial.style.setProperty('--_progress', String(this.#progress));
  }

  #render() {
    const { label, rune } = STATES[this.#state];
    for (const state of GESTURE_STATES) this.#internals.states.delete(state);
    this.#internals.states.add(this.#state);
    this.#label.textContent = label;
    this.#icon.innerHTML = runeIcon(rune).replace('<svg ', '<svg class="icon" ');
    this.setAttribute('aria-label', `Gesto: ${label}`);
    this.#dial.style.setProperty('--_progress', String(this.#progress));
  }
}
