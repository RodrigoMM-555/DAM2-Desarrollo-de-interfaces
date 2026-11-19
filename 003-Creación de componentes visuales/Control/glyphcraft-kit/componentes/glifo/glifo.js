import { defineElement } from '../../interno/definir.js';
import { css, baseStyles } from '../../interno/estilos.js';
import { emit, readEnum, readNumber } from '../../interno/atributos.js';
import { glyphLibrary } from '../../nucleo/glifos/modelo-glifo.js';
import { pathLength } from '../../nucleo/geometria/trazo.js';

/** @typedef {import('../../nucleo/glifos/modelo-glifo.js').Glyph} Glyph */

const SVG_NS = 'http://www.w3.org/2000/svg';
const TICKS = 48;

const styles = css`
  :host {
    --_ink: var(--gc-glyph-ink, var(--gc-color-gold, #e8c675));
    --_size: 160px;
    display: inline-block;
    inline-size: var(--_size);
    block-size: var(--_size);
    color: var(--_ink);
  }
  svg {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    overflow: visible;
  }
  /* Los grosores van en unidades del glifo (--_stroke-u, calculado a partir
     del tamaño en píxeles). No se usa vector-effect: non-scaling-stroke
     porque haría que stroke-dasharray se midiera en píxeles de pantalla y
     rompería la animación de trazado basada en pathLength="1". */
  .strokes path,
  .glow path {
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .strokes path { stroke-width: var(--_stroke-u, 0.034); }
  .glow {
    opacity: var(--_glow, 0.6);
    /* Dentro del SVG las longitudes del filtro van en unidades del viewBox
       (el círculo exterior mide 1), no en píxeles de pantalla. */
    filter: blur(var(--gc-glyph-blur, 0.035px));
  }
  .glow path { stroke-width: calc(var(--_stroke-u, 0.034) * 3); }
  :host([mode='ghost']) .strokes { opacity: 0.35; }
  :host([mode='ghost']) .glow { display: none; }

  .ornament {
    fill: none;
    stroke: currentColor;
    stroke-width: calc(var(--_stroke-u, 0.034) * 0.4);
    opacity: 0.35;
  }
  .markers circle { fill: currentColor; }
  .markers text {
    fill: var(--gc-color-night, #0e0c1f);
    font: 600 0.11px var(--gc-font-display, Georgia, serif);
    text-anchor: middle;
    dominant-baseline: central;
  }
  .markers g { transition: opacity var(--gc-duration, 320ms); }
  .markers g.is-dim { opacity: 0.25; }
  .strokes path.is-highlight { stroke-width: calc(var(--_stroke-u, 0.034) * 1.8); }
  .strokes path.is-dim,
  .glow path.is-dim { opacity: 0.25; }
`;

/**
 * Representación visual de un glifo (SVG).
 *
 * Además de dibujarlo, puede **enseñar a trazarlo** (`playTrace()` dibuja
 * los trazos en orden, con su número y su punto de inicio) y **activarlo**
 * (`ignite()`: el glifo se ilumina y se consume).
 *
 * El glifo se indica con `glyph-id` (se busca en `glyphLibrary`) o
 * asignando directamente la propiedad `glyph`.
 *
 * @tag gc-glyph
 * @summary Glifo en SVG con animación de trazado y activación.
 *
 * @attr {string} glyph-id - Identificador en la biblioteca de glifos.
 * @attr {number} size - Lado en píxeles (16-1024). Por defecto `160`.
 * @attr {'static' | 'ghost'} mode - `ghost` lo muestra tenue, como guía. Por defecto `static`.
 * @attr {number} glow - Intensidad del halo (0-1). Por defecto `0.6`.
 * @attr {boolean} ornate - Añade anillos decorativos exteriores.
 * @attr {boolean} numbered - Muestra el número e inicio de cada trazo.
 *
 * @prop {Glyph | null} glyph - Glifo mostrado.
 * @prop {boolean} tracing - (Solo lectura) Se está reproduciendo el trazado.
 *
 * @fires {CustomEvent<{glyphId: string}>} trace-start
 * @fires {CustomEvent<{index: number}>} trace-stroke - Empieza a dibujarse el trazo `index`.
 * @fires {CustomEvent<{completed: boolean}>} trace-end - `completed` es false si se detuvo antes.
 * @fires {CustomEvent<{glyphId: string}>} glyph-ignited - Terminó la activación.
 *
 * @csspart svg - El SVG.
 * @cssprop --gc-glyph-ink - Color del glifo.
 * @cssprop --gc-glyph-stroke - Grosor del trazo (por defecto 2.2px).
 * @cssprop --gc-glyph-blur - Desenfoque del halo en unidades del glifo (radio = 1). Por defecto 0.035px.
 */
export class GcGlifo extends HTMLElement {
  static tagName = 'gc-glyph';
  static observedAttributes = ['glyph-id', 'size', 'glow', 'ornate', 'numbered'];

  static define() {
    return defineElement(this.tagName, this);
  }

  /** @type {Glyph | null} */
  #glyph = null;
  /** @type {SVGSVGElement} */
  #svg;
  /** @type {SVGPathElement[]} */
  #paths = [];
  /** @type {SVGPathElement[]} */
  #glowPaths = [];
  /** @type {SVGGElement[]} */
  #markers = [];
  /** @type {Animation[]} */
  #animations = [];
  #tracing = false;
  #traceToken = 0;

  #onLibraryChange = () => {
    if (!this.#glyph || this.#glyph.id === this.getAttribute('glyph-id')) this.#resolve();
  };

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [baseStyles, styles];
    this.#svg = document.createElementNS(SVG_NS, 'svg');
    this.#svg.setAttribute('viewBox', '-1.25 -1.25 2.5 2.5');
    this.#svg.setAttribute('part', 'svg');
    this.#svg.setAttribute('aria-hidden', 'true');
    root.append(this.#svg);
  }

  connectedCallback() {
    if (!this.hasAttribute('role')) this.setAttribute('role', 'img');
    glyphLibrary.addEventListener('change', this.#onLibraryChange);
    this.#applySize();
    this.#resolve();
  }

  disconnectedCallback() {
    glyphLibrary.removeEventListener('change', this.#onLibraryChange);
    this.stop();
  }

  /**
   * @param {string} name
   * @param {string | null} oldValue
   * @param {string | null} newValue
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === 'glyph-id') this.#resolve();
    else if (name === 'size') this.#applySize();
    else if (name === 'glow') this.style.setProperty('--_glow', String(this.glow));
    else this.#render();
  }

  // ── Propiedades ───────────────────────────────────────────

  get glyphId() {
    return this.getAttribute('glyph-id') ?? '';
  }
  set glyphId(value) {
    this.setAttribute('glyph-id', value);
  }

  get size() {
    return readNumber(this, 'size', { fallback: 160, min: 16, max: 1024 });
  }
  set size(value) {
    this.setAttribute('size', String(value));
  }

  get mode() {
    return readEnum(this, 'mode', /** @type {const} */ (['static', 'ghost']), 'static');
  }
  set mode(value) {
    this.setAttribute('mode', value);
  }

  get glow() {
    return readNumber(this, 'glow', { fallback: 0.6, min: 0, max: 1 });
  }
  set glow(value) {
    this.setAttribute('glow', String(value));
  }

  get ornate() {
    return this.hasAttribute('ornate');
  }
  set ornate(value) {
    this.toggleAttribute('ornate', Boolean(value));
  }

  get numbered() {
    return this.hasAttribute('numbered');
  }
  set numbered(value) {
    this.toggleAttribute('numbered', Boolean(value));
  }

  /** @returns {Glyph | null} */
  get glyph() {
    return this.#glyph;
  }
  set glyph(value) {
    if (value !== null && !value?.sampled) throw new TypeError('<gc-glyph>.glyph necesita un glifo creado con createGlyph().');
    this.#glyph = value;
    this.#render();
  }

  get tracing() {
    return this.#tracing;
  }

  // ── Métodos públicos ──────────────────────────────────────

  /**
   * Dibuja los trazos uno a uno, en el orden correcto.
   * @param {{ speed?: number, loop?: boolean }} [options]
   * @returns {Promise<boolean>} `true` si terminó; `false` si se detuvo antes.
   */
  async playTrace({ speed = 1, loop = false } = {}) {
    if (!this.#glyph) return false;
    if (!(speed > 0)) throw new RangeError('playTrace: "speed" debe ser > 0.');
    this.stop();
    const token = ++this.#traceToken;
    this.#tracing = true;
    emit(this, 'trace-start', { glyphId: this.#glyph.id });
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    do {
      [...this.#paths, ...this.#glowPaths].forEach((p) => (p.style.strokeDashoffset = '1'));
      this.#markers.forEach((m) => m.classList.add('is-dim'));
      for (let i = 0; i < this.#paths.length; i++) {
        if (token !== this.#traceToken) return false;
        emit(this, 'trace-stroke', { index: i });
        this.#markers[i]?.classList.remove('is-dim');
        const duration = reduced ? 1 : (350 + pathLength(/** @type {any} */ (this.#glyph.sampled[i])) * 420) / speed;
        const keyframes = [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }];
        const options = { duration, easing: 'ease-in-out', fill: /** @type {const} */ ('forwards') };
        const anims = [this.#paths[i].animate(keyframes, options), this.#glowPaths[i].animate(keyframes, options)];
        this.#animations.push(...anims);
        try {
          await anims[0].finished;
        } catch {
          return false; // cancelada con stop()
        }
        await wait(reduced ? 0 : 160 / speed);
      }
      if (loop) await wait(900 / speed);
    } while (loop && token === this.#traceToken);

    if (token !== this.#traceToken) return false;
    this.#tracing = false;
    emit(this, 'trace-end', { completed: true });
    return true;
  }

  /** Detiene la animación y muestra el glifo completo. */
  stop() {
    const wasTracing = this.#tracing;
    this.#traceToken++;
    this.#animations.forEach((a) => a.cancel());
    this.#animations = [];
    this.#tracing = false;
    [...this.#paths, ...this.#glowPaths].forEach((p) => (p.style.strokeDashoffset = '0'));
    this.#markers.forEach((m) => m.classList.remove('is-dim'));
    this.#svg.style.opacity = '';
    if (wasTracing) emit(this, 'trace-end', { completed: false });
  }

  /**
   * Activa el glifo: se ilumina, crece y se consume hasta desaparecer.
   * Tras la activación queda invisible hasta llamar a `reset()`.
   * @param {{ duration?: number }} [options]
   * @returns {Promise<void>}
   */
  async ignite({ duration = 1400 } = {}) {
    this.stop();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animation = this.#svg.animate(
      [
        { transform: 'scale(1)', filter: 'brightness(1) drop-shadow(0 0 0 transparent)', opacity: 1 },
        { transform: 'scale(1.04)', filter: 'brightness(1.8) drop-shadow(0 0 10px currentColor)', opacity: 1, offset: 0.35 },
        { transform: 'scale(1.08)', filter: 'brightness(2.6) drop-shadow(0 0 22px currentColor)', opacity: 1, offset: 0.6 },
        { transform: 'scale(1.3)', filter: 'brightness(3) blur(6px)', opacity: 0 },
      ],
      { duration: reduced ? 1 : duration, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' },
    );
    this.#animations.push(animation);
    await animation.finished.catch(() => {});
    emit(this, 'glyph-ignited', { glyphId: this.#glyph?.id ?? '' });
  }

  /** Vuelve a mostrar el glifo tras `ignite()` o `playTrace()`. */
  reset() {
    this.stop();
  }

  /**
   * Resalta un trazo (o ninguno con `null`) atenuando los demás.
   * @param {number | null} index
   */
  highlightStroke(index) {
    this.#paths.forEach((p, i) => {
      p.classList.toggle('is-highlight', i === index);
      p.classList.toggle('is-dim', index !== null && i !== index);
      this.#glowPaths[i].classList.toggle('is-dim', index !== null && i !== index);
    });
  }

  // ── Interno ───────────────────────────────────────────────

  #applySize() {
    const size = this.size;
    this.style.setProperty('--_size', `${size}px`);
    // Grosor en píxeles de pantalla → unidades del viewBox (2,5 unidades de lado).
    const px = this.isConnected ? parseFloat(getComputedStyle(this).getPropertyValue('--gc-glyph-stroke')) : NaN;
    this.style.setProperty('--_stroke-u', String(((Number.isFinite(px) ? px : 2.2) * 2.5) / size));
  }

  #resolve() {
    const id = this.getAttribute('glyph-id');
    if (id) this.#glyph = glyphLibrary.get(id);
    this.#render();
  }

  #render() {
    this.stop();
    this.#svg.replaceChildren();
    this.#paths = [];
    this.#glowPaths = [];
    this.#markers = [];
    const glyph = this.#glyph;
    this.setAttribute('aria-label', glyph ? `Glifo ${glyph.name}` : 'Glifo');
    if (!glyph) return;

    if (this.ornate) this.#svg.append(ornament());
    const glow = svg('g', { class: 'glow' });
    const strokes = svg('g', { class: 'strokes' });
    glyph.paths.forEach((d) => {
      const attrs = { d, pathLength: '1', 'stroke-dasharray': '1' };
      const g = /** @type {SVGPathElement} */ (svg('path', attrs));
      const p = /** @type {SVGPathElement} */ (svg('path', attrs));
      glow.append(g);
      strokes.append(p);
      this.#glowPaths.push(g);
      this.#paths.push(p);
    });
    this.#svg.append(glow, strokes);

    if (this.numbered) {
      const markers = svg('g', { class: 'markers' });
      glyph.sampled.forEach((points, i) => {
        const start = points[0];
        const group = /** @type {SVGGElement} */ (svg('g', {}));
        group.append(svg('circle', { cx: start.x, cy: start.y, r: 0.08 }));
        const text = svg('text', { x: start.x, y: start.y });
        text.textContent = String(i + 1);
        group.append(text);
        markers.append(group);
        this.#markers.push(group);
      });
      this.#svg.append(markers);
    }
  }
}

/**
 * @param {string} tag
 * @param {Record<string, string | number>} attrs
 */
function svg(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** Anillos decorativos con marcas, como un círculo de transmutación. */
function ornament() {
  const g = svg('g', { class: 'ornament' });
  g.append(svg('circle', { r: 1.18 }), svg('circle', { r: 1.1 }));
  for (let i = 0; i < TICKS; i++) {
    const a = (i / TICKS) * Math.PI * 2;
    const inner = i % 4 === 0 ? 1.1 : 1.13;
    g.append(svg('line', { x1: Math.cos(a) * inner, y1: Math.sin(a) * inner, x2: Math.cos(a) * 1.18, y2: Math.sin(a) * 1.18 }));
  }
  return g;
}

/** @param {number} ms */
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
