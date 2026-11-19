import { defineElement } from '../../interno/definir.js';
import { css, baseStyles } from '../../interno/estilos.js';
import { emit } from '../../interno/atributos.js';

const styles = css`
  :host {
    display: inline-flex;
    --_accent: var(--gc-rune-toggle-accent, var(--gc-color-gold, #e8c675));
  }
  :host([disabled]) { opacity: 0.45; }
  .control {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    color: var(--gc-color-ink, #ece7ff);
    font-family: var(--gc-font-body, Georgia, serif);
    font-size: 1.05rem;
    outline: none;
  }
  :host([disabled]) .control { cursor: not-allowed; }
  .track {
    position: relative;
    flex: none;
    inline-size: 2.6rem;
    block-size: 1.3rem;
    border-radius: 1rem;
    border: 1px solid color-mix(in oklab, var(--_accent) 50%, transparent);
    background: color-mix(in oklab, var(--gc-color-night, #0e0c1f) 80%, transparent);
    transition: background var(--gc-duration, 320ms), box-shadow var(--gc-duration, 320ms);
  }
  .thumb {
    position: absolute;
    inset-block-start: 50%;
    inset-inline-start: 0.2rem;
    inline-size: 0.85rem;
    block-size: 0.85rem;
    border-radius: 50%;
    background: color-mix(in oklab, var(--_accent) 55%, transparent);
    transform: translateY(-50%);
    transition: transform var(--gc-duration, 320ms) var(--gc-ease-arcane, ease), background var(--gc-duration, 320ms);
  }
  :host(:state(checked)) .track {
    background: color-mix(in oklab, var(--_accent) 22%, transparent);
    box-shadow: 0 0 12px color-mix(in oklab, var(--_accent) 35%, transparent);
  }
  :host(:state(checked)) .thumb {
    background: var(--_accent);
    box-shadow: 0 0 8px var(--_accent);
    transform: translate(1.3rem, -50%);
  }
  .control:focus-visible .track {
    outline: 1px solid var(--_accent);
    outline-offset: 3px;
  }
`;

/**
 * Interruptor rúnico de dos estados, **asociado a formularios**.
 *
 * Con `static formAssociated = true` y `ElementInternals`, el navegador lo
 * trata como un control de formulario: participa en el envío (`name` /
 * `value`), se restablece con `form.reset()` y aparece en `form.elements`.
 * El elemento interno tiene el rol accesible `switch` y toma su nombre del
 * texto de la etiqueta.
 *
 * @tag gc-rune-toggle
 * @summary Interruptor para formularios.
 *
 * @attr {boolean} checked - Estado inicial (también es el valor al restablecer el formulario).
 * @attr {boolean} disabled - Desactivado.
 * @attr {string} name - Nombre del campo en el formulario.
 * @attr {string} value - Valor enviado cuando está activado. Por defecto `on`.
 *
 * @prop {boolean} checked - (Ejecución) Estado actual.
 * @prop {HTMLFormElement | null} form - (Solo lectura) Formulario al que pertenece.
 *
 * @fires {CustomEvent<{checked: boolean}>} change - Cambia por acción de la persona.
 *
 * @slot - Etiqueta.
 * @csspart track
 * @csspart thumb
 * @cssprop --gc-rune-toggle-accent
 * @cssstate checked
 */
export class GcInterruptorRuna extends HTMLElement {
  static tagName = 'gc-rune-toggle';
  static formAssociated = true;
  static observedAttributes = ['checked', 'disabled'];

  static define() {
    return defineElement(this.tagName, this);
  }

  /** @type {ElementInternals} */
  #internals;
  /** @type {HTMLElement} */
  #control;
  #checked = false;
  #dirty = false;

  constructor() {
    super();
    this.#internals = this.attachInternals();
    const root = this.attachShadow({ mode: 'open', delegatesFocus: true });
    root.adoptedStyleSheets = [baseStyles, styles];
    root.innerHTML = `
      <span class="control" role="switch" tabindex="0">
        <span class="track" part="track"><span class="thumb" part="thumb"></span></span>
        <slot></slot>
      </span>`;
    // La semántica (rol switch) va en el elemento interno enfocable: así su
    // nombre accesible sale del texto proyectado en el <slot>.
    this.#control = /** @type {HTMLElement} */ (root.querySelector('.control'));
    this.#control.addEventListener('click', () => this.#toggleByUser());
    this.#control.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this.#toggleByUser();
      }
    });
  }

  connectedCallback() {
    this.#sync();
  }

  /**
   * @param {string} name
   * @param {string | null} oldValue
   * @param {string | null} newValue
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    // El atributo `checked` es el valor por defecto; solo manda mientras la
    // persona no haya cambiado el interruptor (como en <input type=checkbox>).
    if (name === 'checked' && !this.#dirty) this.#checked = newValue !== null;
    this.#sync();
  }

  get checked() {
    return this.#checked;
  }
  set checked(value) {
    this.#dirty = true;
    this.#checked = Boolean(value);
    this.#sync();
  }

  get disabled() {
    return this.hasAttribute('disabled');
  }
  set disabled(value) {
    this.toggleAttribute('disabled', Boolean(value));
  }

  get name() {
    return this.getAttribute('name') ?? '';
  }

  get value() {
    return this.getAttribute('value') ?? 'on';
  }

  get form() {
    return this.#internals.form;
  }

  /** Cambia de estado como si se pulsara (emite `change`). */
  toggle() {
    this.#toggleByUser();
  }

  // ── Ciclo de vida de formulario ───────────────────────────

  formResetCallback() {
    this.#dirty = false;
    this.#checked = this.hasAttribute('checked');
    this.#sync();
  }

  /** @param {string | null} state */
  formStateRestoreCallback(state) {
    this.#checked = state !== null;
    this.#sync();
  }

  /** @param {boolean} disabled */
  formDisabledCallback(disabled) {
    this.toggleAttribute('disabled', disabled);
  }

  #toggleByUser() {
    if (this.disabled) return;
    this.checked = !this.#checked;
    emit(this, 'change', { checked: this.#checked });
  }

  #sync() {
    this.#internals.setFormValue(this.#checked ? this.value : null);
    this.#control.setAttribute('aria-checked', String(this.#checked));
    this.#control.setAttribute('aria-disabled', String(this.disabled));
    this.#control.tabIndex = this.disabled ? -1 : 0;
    if (this.#checked) this.#internals.states.add('checked');
    else this.#internals.states.delete('checked');
  }
}
