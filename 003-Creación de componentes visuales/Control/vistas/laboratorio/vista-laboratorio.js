import { detectElements, glyphLibrary } from 'glyphcraft-kit/nucleo';
import { viewHeader } from '../marco-vista.js';
import { progressStore, audio } from '../../servicios/servicios-app.js';
import { NAMED_COMBINATIONS, combinationId } from '../../servicios/logros.js';

/** @typedef {import('../practica/estacion-lanzamiento.js').EstacionLanzamiento} EstacionLanzamiento */
/** @typedef {import('glyphcraft-kit/nucleo').Glyph} Glyph */

/**
 * Laboratorio: combinar símbolos de varios glifos dentro de un mismo círculo.
 *
 * Al sellar, `detectElements` averigua qué combinación de símbolos explica
 * el dibujo y se lanzan todos sus hechizos a la vez. Algunas combinaciones
 * tienen nombre propio y se anotan como descubrimientos.
 *
 * Es un espacio de experimentación: no hace falta haber aprendido los glifos.
 */
export class VistaLaboratorio extends HTMLElement {
  /** @type {EstacionLanzamiento} */ #station = /** @type {any} */ (null);
  /** @type {AbortController | null} */ #listeners = null;

  connectedCallback() {
    if (!this.childElementCount) this.#render();
    this.#listeners = new AbortController();
    const { signal } = this.#listeners;
    this.#station.addEventListener('glyph-sealed', this.#onSealed, { signal });
    progressStore.addEventListener('change', () => this.#renderDiscoveries(), { signal });
    this.#renderDiscoveries();
  }

  disconnectedCallback() {
    this.#listeners?.abort();
  }

  #render() {
    this.className = 'view view--practice view--lab';
    this.innerHTML = `
      ${viewHeader({
        kicker: 'Mesa de experimentos',
        title: 'Laboratorio',
        intro:
          'Traza el círculo y, dentro, dos o tres símbolos del grimorio —por ejemplo, el triángulo de Ignis y la espiral de Ventus—. Ponlos donde quieras y del tamaño que quieras: lado a lado, uno encima de otro o superpuestos. Termina cada símbolo antes de empezar el siguiente y sella.',
      })}
      <gc-casting-station></gc-casting-station>`;
    this.#station = /** @type {EstacionLanzamiento} */ (this.querySelector('gc-casting-station'));
    this.#station.setHint('Traza el círculo y combina símbolos dentro');
    this.#station.extras.innerHTML = `
      <section class="lab-result" hidden aria-live="polite">
        <p class="kicker lab-result__kicker"></p>
        <p class="lab-result__name"></p>
        <p class="lab-result__text"></p>
        <ul class="lab-result__elements"></ul>
      </section>
      <section class="lab-discoveries">
        <h2 class="lab-discoveries__title">Descubrimientos <span class="lab-discoveries__count"></span></h2>
        <ul class="lab-discoveries__list"></ul>
      </section>`;
  }

  #renderDiscoveries() {
    const found = progressStore.discoveries();
    const named = Object.entries(NAMED_COMBINATIONS);
    const count = named.filter(([id]) => found[id]).length;
    /** @type {HTMLElement} */ (this.querySelector('.lab-discoveries__count')).textContent = `${count}/${named.length}`;
    const list = /** @type {HTMLElement} */ (this.querySelector('.lab-discoveries__list'));
    list.replaceChildren(
      ...named.map(([id, combo]) => {
        const li = document.createElement('li');
        li.className = found[id] ? 'is-found' : '';
        li.textContent = found[id] ? combo.name : '· · ·';
        li.title = found[id] ? combo.text : 'Combinación por descubrir';
        return li;
      }),
    );
  }

  /** @param {Event} event */
  #onSealed = async (event) => {
    const { strokes } = /** @type {CustomEvent} */ (event).detail;
    const result = detectElements(strokes, glyphLibrary.list());
    const panel = /** @type {HTMLElement} */ (this.querySelector('.lab-result'));
    const $ = (/** @type {string} */ s) => /** @type {HTMLElement} */ (panel.querySelector(s));
    panel.hidden = false;
    $('.lab-result__elements').replaceChildren();

    if (!result.circle || !result.transform) {
      audio.play('fail');
      panel.dataset.outcome = 'fail';
      $('.lab-result__kicker').textContent = 'Sin círculo';
      $('.lab-result__name').textContent = 'La mezcla se dispersa';
      $('.lab-result__text').textContent = 'Todo experimento empieza por el círculo exterior, trazado de un solo gesto.';
      return;
    }
    if (!result.elements.length) {
      audio.play('fail');
      panel.dataset.outcome = 'fail';
      $('.lab-result__kicker').textContent = 'Sin reacción';
      $('.lab-result__name').textContent = 'Los símbolos no responden';
      $('.lab-result__text').textContent =
        'No reconozco los símbolos. Termina cada uno antes de empezar el siguiente y trázalos parecidos a los de sus páginas del grimorio.';
      return;
    }

    const glyphs = result.elements;
    const id = combinationId(glyphs.map((g) => g.id));
    const combo = NAMED_COMBINATIONS[id];
    panel.dataset.outcome = 'cast';
    $('.lab-result__elements').replaceChildren(
      ...glyphs.map((g) => Object.assign(document.createElement('li'), { textContent: g.name })),
    );
    if (glyphs.length === 1) {
      $('.lab-result__kicker').textContent = 'Un solo símbolo';
      $('.lab-result__name').textContent = glyphs[0].name;
      $('.lab-result__text').textContent = 'Funciona, pero en el laboratorio la magia está en combinar: añade otro símbolo dentro del círculo.';
    } else {
      const isNew = progressStore.recordDiscovery(id);
      $('.lab-result__kicker').textContent = isNew ? '¡Nuevo descubrimiento!' : 'Combinación conocida';
      $('.lab-result__name').textContent = combo?.name ?? 'Experimento sin catalogar';
      $('.lab-result__text').textContent = combo?.text ?? 'Una mezcla que ningún grimorio recoge todavía. Su efecto es imprevisible.';
      if (isNew && combo) {
        /** @type {import('glyphcraft-kit').GcSusurro | null} */ (document.querySelector('gc-whisper'))?.show({
          type: 'arcane',
          title: `Descubrimiento: ${combo.name}`,
          message: combo.text,
          duration: 7000,
        });
      }
    }
    await this.#station.activate(glyphs, result.transform, { score: 85 });
  };
}
