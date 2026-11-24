// @ts-check
/**
 * <tb-cursor-mano>: un cursor que sigue a la mano y "pulsa" el botón sobre
 * el que se queda quieta un segundo (anillo de progreso alrededor).
 *
 * Atributo `duracion` (número, `1`): segundos que hay que mantener la mano.
 * Propiedad `raiz` (`null` = ninguno): elemento dentro del cual se buscan
 * botones y enlaces.
 * Método `mover(punto | null)`: posición en píxeles de la ventana (o null = sin mano).
 *
 * El elemento apuntado recibe la clase `apuntado-mano` para que se vea cuál es.
 * No captura el ratón (`pointer-events: none`): convive con él y con el teclado.
 *
 * Evento: `pulsado` → { elemento } justo antes de hacer clic.
 */
import { Permanencia } from './permanencia.js';

const SELECTOR = 'button:not([disabled]), a[href]';

export class TbCursorMano extends HTMLElement {
  static get observedAttributes() {
    return ['duracion'];
  }

  /** @type {Element | null} */
  raiz = null;
  #permanencia = new Permanencia(1);
  #cursor = document.createElement('div');
  /** @type {Element | null} */
  #apuntado = null;

  constructor() {
    super();
    const sombra = this.attachShadow({ mode: 'open' });
    const estilo = document.createElement('style');
    estilo.textContent = `
      :host { position: fixed; inset: 0; pointer-events: none; z-index: 50; }
      div {
        position: absolute; left: 0; top: 0; width: 44px; height: 44px; margin: -22px 0 0 -22px;
        border-radius: 50%;
        background:
          radial-gradient(circle, var(--color-derecha, #ff9442) 0 9px, transparent 10px),
          conic-gradient(var(--color-acento, #ffd166) calc(var(--progreso, 0) * 1turn), rgb(255 255 255 / 0.25) 0);
        -webkit-mask: radial-gradient(circle, #000 0 10px, transparent 11px 15px, #000 16px);
                mask: radial-gradient(circle, #000 0 10px, transparent 11px 15px, #000 16px);
        box-shadow: 0 0 0 2px rgb(0 0 0 / 0.4);
      }
      div[hidden] { display: none; }
    `;
    this.#cursor.hidden = true;
    this.#cursor.setAttribute('aria-hidden', 'true');
    sombra.append(estilo, this.#cursor);
  }

  get duracion() {
    const valor = Number(this.getAttribute('duracion'));
    return valor > 0 ? valor : 1;
  }

  set duracion(valor) {
    this.setAttribute('duracion', String(valor));
  }

  /** Al cambiar `duracion`, se empieza de cero con el tiempo nuevo. */
  attributeChangedCallback() {
    this.#permanencia = new Permanencia(this.duracion);
  }

  disconnectedCallback() {
    this.mover(null);
  }

  /** @param {{ x: number, y: number } | null} punto Píxeles de la ventana. */
  mover(punto) {
    let objetivo = null;
    if (punto) {
      this.#cursor.hidden = false;
      this.#cursor.style.transform = `translate(${punto.x}px, ${punto.y}px)`;
      const debajo = document.elementFromPoint(punto.x, punto.y)?.closest(SELECTOR) ?? null;
      if (debajo && this.raiz?.contains(debajo)) objetivo = debajo;
    } else {
      this.#cursor.hidden = true;
    }

    if (objetivo !== this.#apuntado) {
      this.#apuntado?.classList.remove('apuntado-mano');
      objetivo?.classList.add('apuntado-mano');
      this.#apuntado = objetivo;
    }
    const { progreso, activado } = this.#permanencia.actualizar(objetivo, performance.now() / 1000);
    this.#cursor.style.setProperty('--progreso', String(progreso));
    if (activado && objetivo) {
      this.dispatchEvent(new CustomEvent('pulsado', { detail: { elemento: objetivo } }));
      /** @type {HTMLElement} */ (objetivo).click();
    }
  }
}

customElements.define('tb-cursor-mano', TbCursorMano);
