import { ReconocedorGlifos, glyphLibrary } from 'glyphcraft-kit/nucleo';
import { viewHeader } from '../marco-vista.js';
import { settings, progressStore, audio, sigmaFromTolerance } from '../../servicios/servicios-app.js';

/** @typedef {import('./estacion-lanzamiento.js').EstacionLanzamiento} EstacionLanzamiento */
/** @typedef {import('glyphcraft-kit').GcGlifo} GcGlifo */
/** @typedef {import('glyphcraft-kit').GcMedidorArcano} GcMedidorArcano */
/** @typedef {import('glyphcraft-kit').GcSusurro} GcSusurro */

/**
 * Practicar magia: lanzamiento libre.
 *
 * Se dibuja sin guía; al sellar, el reconocedor busca cuál de los glifos
 * del grimorio se ha trazado. Solo se pueden lanzar los glifos aprendidos.
 */
export class VistaPractica extends HTMLElement {
  /** @type {EstacionLanzamiento} */ #station = /** @type {any} */ (null);
  /** @type {AbortController | null} */ #listeners = null;

  connectedCallback() {
    if (!this.childElementCount) this.#render();
    this.#listeners = new AbortController();
    const { signal } = this.#listeners;
    this.#station.addEventListener('glyph-sealed', this.#onSealed, { signal });
    progressStore.addEventListener('change', () => this.#renderKnown(), { signal });
    this.#renderKnown();
  }

  disconnectedCallback() {
    this.#listeners?.abort();
  }

  #render() {
    this.className = 'view view--practice';
    this.innerHTML = `
      ${viewHeader({
        kicker: 'Círculo de lanzamiento',
        title: 'Practicar magia',
        intro: 'Traza de memoria cualquiera de los glifos que hayas aprendido y séllalo: el círculo lo reconocerá.',
      })}
      <gc-casting-station></gc-casting-station>`;
    this.#station = /** @type {EstacionLanzamiento} */ (this.querySelector('gc-casting-station'));
    this.#station.extras.innerHTML = `
      <section class="cast-result" hidden aria-live="polite">
        <gc-glyph class="cast-result__glyph" size="72"></gc-glyph>
        <div>
          <p class="kicker cast-result__kicker"></p>
          <p class="cast-result__name"></p>
          <p class="cast-result__message"></p>
        </div>
        <gc-arcane-meter class="cast-result__score" label="Precisión"></gc-arcane-meter>
      </section>
      <div class="cast-known"></div>`;
  }

  /** Lista de glifos que se pueden lanzar. */
  #renderKnown() {
    const known = /** @type {HTMLElement} */ (this.querySelector('.cast-known'));
    const learned = glyphLibrary.list().filter((g) => progressStore.isLearned(g.id));
    if (!learned.length) {
      known.innerHTML = `
        <p>Aún no has aprendido ningún glifo. Estúdialos en el grimorio: cada uno queda aprendido tras trazarlo bien tres veces.</p>
        <gc-rune-button rune="grimoire" size="sm" data-nav="/grimoire">Abrir el grimorio</gc-rune-button>`;
      return;
    }
    known.innerHTML = `<p class="kicker">Glifos que dominas</p><ul class="cast-known__list"></ul>`;
    const list = /** @type {HTMLElement} */ (known.querySelector('ul'));
    for (const glyph of learned) {
      const li = document.createElement('li');
      li.innerHTML = '<gc-glyph size="34"></gc-glyph><span></span>';
      /** @type {GcGlifo} */ (li.querySelector('gc-glyph')).glyphId = glyph.id;
      /** @type {HTMLElement} */ (li.querySelector('span')).textContent = glyph.name;
      list.append(li);
    }
  }

  /** @param {Event} event */
  #onSealed = async (event) => {
    const { strokes } = /** @type {CustomEvent} */ (event).detail;
    const recognizer = new ReconocedorGlifos({ sigma: sigmaFromTolerance(settings.get('recognition.tolerance')) });
    const [best] = recognizer.classify(strokes, glyphLibrary.list());
    if (!best) return;
    const { glyph, result } = best;
    const panel = /** @type {HTMLElement} */ (this.querySelector('.cast-result'));
    const $ = (/** @type {string} */ s) => /** @type {HTMLElement} */ (panel.querySelector(s));
    const meter = /** @type {GcMedidorArcano} */ ($('.cast-result__score'));
    panel.hidden = false;

    if (!result.passed) {
      audio.play('fail');
      panel.dataset.outcome = 'fail';
      /** @type {GcGlifo} */ ($('.cast-result__glyph')).glyph = null;
      $('.cast-result__kicker').textContent = 'Sin respuesta';
      $('.cast-result__name').textContent = 'El círculo permanece en silencio';
      $('.cast-result__message').textContent =
        result.score > 35 ? `Se parece un poco a ${glyph.name}. ${result.summary}` : result.summary;
      meter.setValue(result.score);
      return;
    }

    /** @type {GcGlifo} */ ($('.cast-result__glyph')).glyph = glyph;
    $('.cast-result__name').textContent = glyph.name;
    meter.setValue(result.score);

    if (!progressStore.isLearned(glyph.id)) {
      panel.dataset.outcome = 'unlearned';
      $('.cast-result__kicker').textContent = 'Glifo reconocido';
      $('.cast-result__message').innerHTML = '';
      $('.cast-result__message').append(
        `Reconozco ${glyph.name}, pero aún no lo has aprendido. `,
        Object.assign(document.createElement('a'), { href: `#/grimoire/${glyph.id}`, textContent: 'Estúdialo en el grimorio.' }),
      );
      this.#station.setFeedback(result.strokes.map((s) => s.grade));
      return;
    }

    panel.dataset.outcome = 'cast';
    $('.cast-result__kicker').textContent = 'Hechizo lanzado';
    $('.cast-result__message').textContent = result.summary;
    progressStore.recordCast(glyph.id);
    if (result.transform) await this.#station.activate(glyph, result.transform, { score: result.score });
  };
}
