import { glyphLibrary } from 'glyphcraft-kit/nucleo';
import { ELEMENT_LABELS } from 'glyphcraft-kit';
import { viewHeader } from '../marco-vista.js';
import { progressStore, CASTS_TO_LEARN, CASTS_TO_MASTER } from '../../servicios/progreso.js';

/** @typedef {import('glyphcraft-kit').GcGlifo} GcGlifo */
/** @typedef {import('glyphcraft-kit').GcTarjetaGlifo} GcTarjetaGlifo */
/** @typedef {import('glyphcraft-kit').GcMedidorArcano} GcMedidorArcano */
/** @typedef {import('glyphcraft-kit/nucleo').Glyph} Glyph */

/** Duración del pase de página (ms). */
const TURN_MS = 760;

/**
 * Grimorio: un libro abierto. A la izquierda, el índice de glifos con sus
 * sellos de aprendizaje; a la derecha, la página del glifo elegido con su
 * animación de trazado y el acceso a la práctica guiada.
 *
 * Al elegir otro glifo **se pasa la página** (una hoja gira en 3D sobre el
 * lomo) en lugar de cambiar de pantalla: la vista implementa
 * `updateRoute(params)` y el contenedor de la app la actualiza en el sitio.
 * Las flechas ← y → del teclado pasan las páginas.
 */
export class VistaGrimorio extends HTMLElement {
  /** @type {Record<string, string>} */
  #params = {};
  /** @type {AbortController | null} */
  #listeners = null;
  /** @type {Animation | null} */
  #turning = null;

  /** Parámetros de la ruta: `glyphId` abre esa página. */
  set params(value) {
    this.#params = value ?? {};
  }
  get params() {
    return this.#params;
  }

  connectedCallback() {
    if (!this.childElementCount) this.#render();
    this.#listeners = new AbortController();
    const { signal } = this.#listeners;
    this.addEventListener('glyph-select', this.#onSelect, { signal });
    this.addEventListener('rune-activate', this.#onAction, { signal });
    document.addEventListener('keydown', this.#onKey, { signal });
    progressStore.addEventListener('change', () => this.#refreshProgress(), { signal });
  }

  disconnectedCallback() {
    this.#listeners?.abort();
  }

  /**
   * Llamado por el contenedor de la app cuando cambia la ruta y sigue siendo
   * el grimorio: pasa la página en lugar de recrear la vista.
   * @param {Record<string, string>} params
   * @returns {boolean} `true` si se ha gestionado.
   */
  updateRoute(params) {
    const previous = this.#selected;
    this.#params = params ?? {};
    const next = this.#selected;
    if (!next || next === previous) return true;
    const glyphs = glyphLibrary.list();
    const forward = glyphs.indexOf(next) > glyphs.indexOf(/** @type {Glyph} */ (previous));
    for (const card of /** @type {NodeListOf<GcTarjetaGlifo>} */ (this.querySelectorAll('gc-glyph-card'))) {
      card.selected = card.glyphId === next.id;
    }
    this.#turnPage(next, forward);
    return true;
  }

  /** @returns {Glyph | null} */
  get #selected() {
    const glyphs = glyphLibrary.list();
    return glyphLibrary.get(this.#params.glyphId ?? '') ?? glyphs[0] ?? null;
  }

  #render() {
    this.className = 'view view--grimoire';
    const glyph = this.#selected;
    this.innerHTML = `
      ${viewHeader({
        kicker: 'Liber signorum',
        title: 'Grimorio',
        intro: `Cada página guarda un glifo. Estúdialo, practícalo y, cuando lo traces bien ${CASTS_TO_LEARN} veces, quedará aprendido.`,
      })}
      <div class="book">
        <section class="book__page book__page--left" aria-label="Índice de glifos">
          <h2 class="book__heading">Índice</h2>
          <ol class="glyph-list"></ol>
          <p class="book__hint">Usa <kbd>←</kbd> <kbd>→</kbd> para pasar las páginas.</p>
        </section>
        <section class="book__page book__page--right glyph-page" aria-live="polite"></section>
      </div>`;

    const list = /** @type {HTMLElement} */ (this.querySelector('.glyph-list'));
    for (const g of glyphLibrary.list()) {
      const li = document.createElement('li');
      const card = /** @type {GcTarjetaGlifo} */ (document.createElement('gc-glyph-card'));
      card.glyphId = g.id;
      card.required = CASTS_TO_LEARN;
      card.selected = g.id === glyph?.id;
      li.append(card);
      list.append(li);
    }
    if (glyph) this.#renderPage(glyph, /** @type {HTMLElement} */ (this.querySelector('.glyph-page')));
    this.#refreshProgress();
  }

  /**
   * Escribe la página de un glifo en un contenedor (la página real o la hoja que gira).
   * @param {Glyph} glyph
   * @param {HTMLElement} page
   */
  #renderPage(glyph, page) {
    const stars = '✦'.repeat(glyph.difficulty) + `<span class="dim">${'✦'.repeat(5 - glyph.difficulty)}</span>`;
    page.innerHTML = `
      <div class="glyph-page__figure">
        <gc-glyph glyph-id="${glyph.id}" size="230" ornate numbered></gc-glyph>
      </div>
      <p class="glyph-page__meta"><span class="glyph-page__element"></span> · <span class="glyph-page__stars" aria-label="Dificultad ${glyph.difficulty} de 5">${stars}</span></p>
      <h2 class="glyph-page__name"></h2>
      <p class="glyph-page__description"></p>
      <p class="glyph-page__lore"></p>
      <h3 class="glyph-page__subheading">Cómo se traza</h3>
      <ol class="glyph-page__steps"></ol>
      <div class="glyph-page__learning">
        <gc-arcane-meter variant="seals" max="${CASTS_TO_LEARN}" label="Aprendizaje"></gc-arcane-meter>
        <p class="glyph-page__status"></p>
      </div>
      <div class="glyph-page__actions">
        <gc-rune-button rune="play" variant="ghost" size="sm" data-action="trace">Ver trazado</gc-rune-button>
        <gc-rune-button rune="practice" data-nav="/grimoire/${glyph.id}/practice">Practicar</gc-rune-button>
      </div>`;
    const text = (/** @type {string} */ s, /** @type {string} */ v) => {
      /** @type {HTMLElement} */ (page.querySelector(s)).textContent = v;
    };
    text('.glyph-page__element', ELEMENT_LABELS[glyph.element]);
    text('.glyph-page__name', glyph.name);
    text('.glyph-page__description', glyph.description ?? '');
    text('.glyph-page__lore', glyph.lore ?? '');
    const steps = /** @type {HTMLElement} */ (page.querySelector('.glyph-page__steps'));
    for (const hint of glyph.strokeHints ?? []) {
      const li = document.createElement('li');
      li.textContent = hint;
      steps.append(li);
    }
    this.#refreshPageProgress(glyph, page);
  }

  /**
   * Pasa la página: una hoja de pergamino en blanco gira sobre el lomo.
   * Hacia delante se levanta desde la derecha y descubre la página nueva;
   * hacia atrás llega desde la izquierda y la cubre.
   *
   * @param {Glyph} glyph
   * @param {boolean} forward
   */
  #turnPage(glyph, forward) {
    const page = /** @type {HTMLElement} */ (this.querySelector('.glyph-page'));
    const book = /** @type {HTMLElement} */ (this.querySelector('.book'));
    this.#turning?.finish();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      this.#renderPage(glyph, page);
      return;
    }

    const leaf = document.createElement('div');
    leaf.className = 'page-leaf';
    leaf.setAttribute('aria-hidden', 'true');
    leaf.inert = true;
    Object.assign(leaf.style, {
      left: `${page.offsetLeft}px`,
      top: `${page.offsetTop}px`,
      width: `${page.offsetWidth}px`,
      height: `${page.offsetHeight}px`,
    });
    // La hoja que gira es pergamino en blanco por las dos caras.
    const front = document.createElement('div');
    front.className = 'page-leaf__face page-leaf__front';
    const back = document.createElement('div');
    back.className = 'page-leaf__face page-leaf__back';
    leaf.append(front, back);

    // Hacia delante, la hoja tapa la página desde el principio: debajo ya
    // puede estar la nueva. Hacia atrás, se cambia al cubrirla (al final).
    if (forward) this.#renderPage(glyph, page);
    book.append(leaf);

    const keyframes = forward
      ? [
          { transform: 'rotateY(0deg)', filter: 'brightness(1)' },
          { transform: 'rotateY(-90deg)', filter: 'brightness(0.82)', offset: 0.5 },
          { transform: 'rotateY(-180deg)', filter: 'brightness(1)' },
        ]
      : [
          { transform: 'rotateY(-180deg)', filter: 'brightness(1)' },
          { transform: 'rotateY(-90deg)', filter: 'brightness(0.82)', offset: 0.5 },
          { transform: 'rotateY(0deg)', filter: 'brightness(1)' },
        ];
    const animation = leaf.animate(keyframes, { duration: TURN_MS, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' });
    this.#turning = animation;
    const done = () => {
      if (!forward) this.#renderPage(glyph, page);
      leaf.remove();
      if (this.#turning === animation) this.#turning = null;
    };
    animation.finished.then(done, done);
  }

  #refreshProgress() {
    for (const card of /** @type {NodeListOf<GcTarjetaGlifo>} */ (this.querySelectorAll('gc-glyph-card'))) {
      const p = progressStore.get(card.glyphId);
      card.progress = p.successes;
      card.learned = progressStore.isLearned(card.glyphId);
      card.mastered = progressStore.isMastered(card.glyphId);
    }
    const glyph = this.#selected;
    const page = /** @type {HTMLElement | null} */ (this.querySelector('.book__page--right'));
    if (glyph && page) this.#refreshPageProgress(glyph, page);
  }

  /**
   * @param {Glyph} glyph
   * @param {HTMLElement} page
   */
  #refreshPageProgress(glyph, page) {
    const meter = /** @type {GcMedidorArcano | null} */ (page.querySelector('.glyph-page__learning gc-arcane-meter'));
    const status = /** @type {HTMLElement | null} */ (page.querySelector('.glyph-page__status'));
    if (!meter || !status) return;
    const p = progressStore.get(glyph.id);
    meter.value = Math.min(p.successes, CASTS_TO_LEARN);
    status.textContent = progressStore.isMastered(glyph.id)
      ? 'Dominado. Lo trazas con precisión de maestría.'
      : progressStore.isLearned(glyph.id)
        ? `Aprendido. Supéralo ${CASTS_TO_MASTER} veces en nivel Maestro para dominarlo (${p.masterSuccesses}/${CASTS_TO_MASTER}).`
        : p.attempts
          ? `${p.successes} de ${CASTS_TO_LEARN} aciertos · mejor precisión ${p.bestScore}`
          : 'Aún no lo has practicado.';
  }

  /** @param {string} glyphId */
  #open(glyphId) {
    this.dispatchEvent(new CustomEvent('navigate', { detail: { path: `/grimoire/${glyphId}` }, bubbles: true }));
  }

  /** @param {Event} event */
  #onSelect = (event) => {
    this.#open(/** @type {CustomEvent} */ (event).detail.glyphId);
  };

  /** @param {KeyboardEvent} event */
  #onKey = (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    if (event.target instanceof HTMLInputElement || event.altKey || event.ctrlKey || event.metaKey) return;
    const glyphs = glyphLibrary.list();
    const index = glyphs.indexOf(/** @type {Glyph} */ (this.#selected));
    const next = glyphs[index + (event.key === 'ArrowRight' ? 1 : -1)];
    if (next) {
      event.preventDefault();
      this.#open(next.id);
    }
  };

  /** @param {Event} event */
  #onAction = (event) => {
    if (/** @type {HTMLElement} */ (event.target).dataset.action === 'trace') {
      /** @type {GcGlifo} */ (this.querySelector('.book__page--right gc-glyph')).playTrace();
    }
  };
}
