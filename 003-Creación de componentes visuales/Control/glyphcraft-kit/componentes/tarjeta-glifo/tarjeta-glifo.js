import { defineElement } from '../../interno/definir.js';
import { css, baseStyles } from '../../interno/estilos.js';
import { emit, readNumber } from '../../interno/atributos.js';
import { glyphLibrary } from '../../nucleo/glifos/modelo-glifo.js';
import { GcGlifo } from '../glifo/glifo.js';
import { GcMedidorArcano } from '../medidor-arcano/medidor-arcano.js';

/** Nombres en castellano de cada tipo de magia. */
export const ELEMENT_LABELS = Object.freeze({
  fire: 'Fuego',
  water: 'Agua',
  wind: 'Viento',
  light: 'Luz',
  protection: 'Protección',
  ice: 'Hielo',
  arcane: 'Arcano',
});

const styles = css`
  :host {
    display: block;
    --_ink: var(--gc-glyph-card-ink, #2b2135);
    --_accent: var(--gc-glyph-card-accent, #8a3b12);
  }
  button {
    all: unset;
    box-sizing: border-box;
    inline-size: 100%;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.9rem;
    padding: 0.55rem 0.7rem;
    cursor: pointer;
    color: var(--_ink);
    border-radius: 3px;
    transition: background var(--gc-duration-fast, 160ms);
  }
  button:hover { background: rgb(91 61 30 / 0.07); }
  button:focus-visible { outline: 1px solid var(--_accent); outline-offset: 2px; }
  :host([selected]) button {
    background: rgb(138 59 18 / 0.1);
    box-shadow: inset 2px 0 0 var(--_accent);
  }
  gc-glyph {
    --gc-glyph-ink: var(--_ink);
    --gc-glyph-stroke: 1.6px;
    --gc-glyph-blur: 0px;
  }
  :host([learned]) gc-glyph { --gc-glyph-ink: var(--_accent); }
  .name {
    font-family: var(--gc-font-display, Georgia, serif);
    font-size: 1.1rem;
    letter-spacing: 0.04em;
  }
  .meta {
    display: block;
    font-family: var(--gc-font-body, Georgia, serif);
    font-style: italic;
    color: color-mix(in oklab, var(--_ink) 65%, transparent);
  }
  .stars { color: #a06a1c; letter-spacing: 0.1em; font-style: normal; }
  .stars .dim { opacity: 0.25; }
  .status { display: grid; justify-items: end; gap: 0.25rem; }
  .badge {
    font-family: var(--gc-font-display, Georgia, serif);
    font-size: 0.68rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--_accent);
  }
  .badge:empty { display: none; }
  gc-arcane-meter {
    --gc-meter-color: var(--_accent);
    --gc-meter-seal-size: 0.75rem;
  }
`;

/**
 * Entrada del grimorio: miniatura del glifo, nombre, tipo de magia,
 * dificultad y sellos de aprendizaje.
 *
 * Es un ejemplo de **composición**: reutiliza `<gc-glyph>` y
 * `<gc-arcane-meter>` dentro de su Shadow DOM.
 *
 * @tag gc-glyph-card
 * @summary Tarjeta de un glifo del grimorio.
 *
 * @attr {string} glyph-id - Glifo de la biblioteca.
 * @attr {number} progress - Aciertos conseguidos. Por defecto `0`.
 * @attr {number} required - Aciertos necesarios para aprenderlo. Por defecto `3`.
 * @attr {boolean} learned - El glifo está aprendido.
 * @attr {boolean} mastered - El glifo está dominado.
 * @attr {boolean} selected - Es la página abierta del grimorio.
 *
 * @fires {CustomEvent<{glyphId: string}>} glyph-select - Se ha elegido la tarjeta.
 *
 * @csspart card - El botón de la tarjeta.
 * @cssprop --gc-glyph-card-ink - Color del texto y del glifo.
 * @cssprop --gc-glyph-card-accent - Color de lo destacado.
 */
export class GcTarjetaGlifo extends HTMLElement {
  static tagName = 'gc-glyph-card';
  static observedAttributes = ['glyph-id', 'progress', 'required', 'learned', 'mastered', 'selected'];

  static define() {
    GcGlifo.define();
    GcMedidorArcano.define();
    return defineElement(this.tagName, this);
  }

  /** @type {ShadowRoot} */
  #root;
  #onLibraryChange = () => this.#render();

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open', delegatesFocus: true });
    this.#root.adoptedStyleSheets = [baseStyles, styles];
    this.#root.innerHTML = `
      <button part="card" type="button">
        <gc-glyph size="56"></gc-glyph>
        <span>
          <span class="name"></span>
          <span class="meta"><span class="element"></span> · <span class="stars"></span></span>
        </span>
        <span class="status">
          <span class="badge"></span>
          <gc-arcane-meter variant="seals"></gc-arcane-meter>
        </span>
      </button>`;
    this.#root.querySelector('button')?.addEventListener('click', () => this.select());
  }

  connectedCallback() {
    glyphLibrary.addEventListener('change', this.#onLibraryChange);
    this.#render();
  }

  disconnectedCallback() {
    glyphLibrary.removeEventListener('change', this.#onLibraryChange);
  }

  attributeChangedCallback() {
    this.#render();
  }

  get glyphId() {
    return this.getAttribute('glyph-id') ?? '';
  }
  set glyphId(v) {
    this.setAttribute('glyph-id', v);
  }

  get progress() {
    return Math.round(readNumber(this, 'progress', { fallback: 0, min: 0, max: 1000 }));
  }
  set progress(v) {
    this.setAttribute('progress', String(v));
  }

  get required() {
    return Math.round(readNumber(this, 'required', { fallback: 3, min: 1, max: 20 }));
  }
  set required(v) {
    this.setAttribute('required', String(v));
  }

  get learned() {
    return this.hasAttribute('learned');
  }
  set learned(v) {
    this.toggleAttribute('learned', Boolean(v));
  }

  get mastered() {
    return this.hasAttribute('mastered');
  }
  set mastered(v) {
    this.toggleAttribute('mastered', Boolean(v));
  }

  get selected() {
    return this.hasAttribute('selected');
  }
  set selected(v) {
    this.toggleAttribute('selected', Boolean(v));
  }

  /** Selecciona la tarjeta (como si se pulsara). */
  select() {
    emit(this, 'glyph-select', { glyphId: this.glyphId });
  }

  #render() {
    const glyph = glyphLibrary.get(this.glyphId);
    const $ = (/** @type {string} */ s) => /** @type {HTMLElement} */ (this.#root.querySelector(s));
    const glyphEl = /** @type {GcGlifo} */ ($('gc-glyph'));
    if (glyphEl.glyphId !== this.glyphId) glyphEl.glyphId = this.glyphId;
    $('.name').textContent = glyph?.name ?? this.glyphId;
    $('.element').textContent = glyph ? ELEMENT_LABELS[glyph.element] : '';
    const d = glyph?.difficulty ?? 0;
    $('.stars').innerHTML = `${'✦'.repeat(d)}<span class="dim">${'✦'.repeat(5 - d)}</span>`;
    $('.stars').setAttribute('aria-label', `Dificultad ${d} de 5`);
    $('.badge').textContent = this.mastered ? 'Dominado' : this.learned ? 'Aprendido' : '';

    const meter = /** @type {GcMedidorArcano} */ ($('gc-arcane-meter'));
    meter.max = this.required;
    meter.value = Math.min(this.progress, this.required);
    meter.label = '';
    meter.setAttribute('aria-label', `${Math.min(this.progress, this.required)} de ${this.required} aciertos`);

    const button = $('button');
    button.setAttribute('aria-pressed', String(this.selected));
    button.setAttribute(
      'aria-label',
      `${glyph?.name ?? this.glyphId}, ${glyph ? ELEMENT_LABELS[glyph.element] : ''}, ` +
        `dificultad ${d}${this.learned ? ', aprendido' : `, ${Math.min(this.progress, this.required)} de ${this.required} aciertos`}`,
    );
  }
}
