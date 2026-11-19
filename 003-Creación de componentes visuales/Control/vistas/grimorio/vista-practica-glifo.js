import { ReconocedorGlifos, RECOGNITION_LEVELS, glyphLibrary, placeGlyph } from 'glyphcraft-kit/nucleo';
import { viewHeader } from '../marco-vista.js';
import { CASTS_TO_LEARN } from '../../servicios/progreso.js';
import { settings, progressStore, audio, sigmaFromTolerance } from '../../servicios/servicios-app.js';

/** @typedef {import('../practica/estacion-lanzamiento.js').EstacionLanzamiento} EstacionLanzamiento */
/** @typedef {import('glyphcraft-kit').GcGlifo} GcGlifo */
/** @typedef {import('glyphcraft-kit').GcMedidorArcano} GcMedidorArcano */
/** @typedef {import('glyphcraft-kit').GcBotonRuna} GcBotonRuna */
/** @typedef {import('glyphcraft-kit').GcSusurro} GcSusurro */
/** @typedef {import('glyphcraft-kit/nucleo').Glyph} Glyph */
/** @typedef {import('glyphcraft-kit/nucleo').RecognitionLevel} RecognitionLevel */

/** Radio del glifo guía sobre el lienzo (el círculo exterior ocupa el 84 %). */
const GUIDE_PLACEMENT = { cx: 0.5, cy: 0.5, r: 0.42 };

/**
 * Práctica guiada de un glifo del grimorio.
 *
 * Muestra la guía según el nivel, evalúa cada glifo sellado, colorea los
 * trazos, explica qué mejorar y lleva la cuenta de los aciertos hasta que
 * el glifo queda aprendido.
 */
export class VistaPracticaGlifo extends HTMLElement {
  /** @type {Record<string, string>} */
  #params = {};
  /** @type {RecognitionLevel} */
  #level = /** @type {RecognitionLevel} */ (settings.get('recognition.level'));
  /** @type {Glyph | null} */
  #glyph = null;
  /** @type {EstacionLanzamiento} */ #station = /** @type {any} */ (null);
  /** @type {AbortController | null} */ #listeners = null;

  set params(value) {
    this.#params = value ?? {};
  }
  get params() {
    return this.#params;
  }

  connectedCallback() {
    this.#glyph = glyphLibrary.get(this.#params.glyphId ?? '');
    if (!this.childElementCount) this.#render();
    if (!this.#glyph) return;
    this.#listeners = new AbortController();
    const { signal } = this.#listeners;
    this.#station.addEventListener('glyph-sealed', this.#onSealed, { signal });
    this.addEventListener('rune-activate', this.#onAction, { signal });
    this.#applyLevel();
    this.#refreshSeals();
  }

  disconnectedCallback() {
    this.#listeners?.abort();
  }

  #render() {
    this.className = 'view view--practice view--glyph-practice';
    const glyph = this.#glyph;
    if (!glyph) {
      this.innerHTML = `${viewHeader({
        kicker: 'Práctica guiada',
        title: 'Página en blanco',
        intro: 'Este glifo no existe en el grimorio.',
        back: { path: '/grimoire', label: 'Grimorio' },
      })}`;
      return;
    }
    this.innerHTML = `
      ${viewHeader({
        kicker: 'Práctica guiada',
        title: '',
        intro: '',
        back: { path: `/grimoire/${glyph.id}`, label: 'Grimorio' },
      })}
      <gc-casting-station></gc-casting-station>`;
    /** @type {HTMLElement} */ (this.querySelector('.view__title')).textContent = glyph.name;
    /** @type {HTMLElement} */ (this.querySelector('.view__intro')).textContent =
      `${glyph.description ?? ''} Sigue la guía, traza el glifo y séllalo. ${CASTS_TO_LEARN} aciertos y quedará aprendido.`;

    this.#station = /** @type {EstacionLanzamiento} */ (this.querySelector('gc-casting-station'));
    this.#station.extras.innerHTML = `
      <div class="levels" role="group" aria-label="Nivel de exigencia">
        ${Object.entries(RECOGNITION_LEVELS)
          .map(([id, l]) => `<gc-rune-button size="sm" variant="ghost" data-level="${id}">${l.label}</gc-rune-button>`)
          .join('')}
      </div>
      <p class="levels__help"></p>
      <div class="model">
        <gc-glyph class="model__glyph" size="96" numbered></gc-glyph>
        <gc-rune-button rune="play" variant="ghost" size="sm" data-action="trace">Ver trazado</gc-rune-button>
      </div>
      <div class="scores">
        <gc-arcane-meter class="scores__precision" label="Precisión"></gc-arcane-meter>
        <gc-arcane-meter class="scores__seals" variant="seals" max="${CASTS_TO_LEARN}" label="Aprendizaje"></gc-arcane-meter>
      </div>
      <div class="evaluation" aria-live="polite">
        <p class="evaluation__summary"></p>
        <ul class="evaluation__issues"></ul>
      </div>`;
    /** @type {GcGlifo} */ (this.querySelector('.model__glyph')).glyph = glyph;
  }

  /** Guía, umbral y botones según el nivel elegido. */
  #applyLevel() {
    const glyph = /** @type {Glyph} */ (this.#glyph);
    const config = RECOGNITION_LEVELS[this.#level];
    this.#station.setGuide(placeGlyph(glyph, GUIDE_PLACEMENT), { style: config.guide, next: this.#level === 'apprentice' });
    /** @type {GcMedidorArcano} */ (this.querySelector('.scores__precision')).threshold = config.threshold;
    for (const button of /** @type {NodeListOf<GcBotonRuna>} */ (this.querySelectorAll('[data-level]'))) {
      const active = button.dataset.level === this.#level;
      button.variant = active ? 'primary' : 'ghost';
      button.pressed = active;
    }
    const help = {
      apprentice: `Guía visible. Da igual el orden de los trazos. Hace falta ${config.threshold} de precisión.`,
      artisan: `Guía tenue. Respeta el orden y el número de trazos. Hace falta ${config.threshold}.`,
      master: `Sin guía. Orden y sentido de cada trazo. Hace falta ${config.threshold}.`,
    };
    /** @type {HTMLElement} */ (this.querySelector('.levels__help')).textContent = help[this.#level];
  }

  #refreshSeals() {
    const glyph = /** @type {Glyph} */ (this.#glyph);
    /** @type {GcMedidorArcano} */ (this.querySelector('.scores__seals')).value = Math.min(
      progressStore.get(glyph.id).successes,
      CASTS_TO_LEARN,
    );
  }

  /** @param {Event} event */
  #onAction = (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (target.dataset.level) {
      this.#level = /** @type {RecognitionLevel} */ (target.dataset.level);
      settings.set('recognition.level', this.#level);
      this.#applyLevel();
    }
    if (target.dataset.action === 'trace') {
      /** @type {GcGlifo} */ (this.querySelector('.model__glyph')).playTrace();
    }
  };

  /** @param {Event} event */
  #onSealed = async (event) => {
    const glyph = /** @type {Glyph} */ (this.#glyph);
    const { strokes } = /** @type {CustomEvent} */ (event).detail;
    const recognizer = new ReconocedorGlifos({ sigma: sigmaFromTolerance(settings.get('recognition.tolerance')) });
    const result = recognizer.evaluate(strokes, glyph, { level: this.#level });
    audio.play(result.passed ? 'success' : 'fail');

    this.#station.setFeedback(result.strokes.map((s) => s.grade));
    /** @type {GcMedidorArcano} */ (this.querySelector('.scores__precision')).setValue(result.score);
    const summary = /** @type {HTMLElement} */ (this.querySelector('.evaluation__summary'));
    summary.textContent = result.passed ? `${result.summary} (${result.score})` : `Aún no: ${result.score} de ${result.threshold}.`;
    summary.dataset.outcome = result.passed ? 'pass' : 'fail';
    const issues = /** @type {HTMLElement} */ (this.querySelector('.evaluation__issues'));
    issues.replaceChildren(
      ...result.issues.slice(0, 3).map((issue) => Object.assign(document.createElement('li'), { textContent: issue.message })),
    );

    const { progress, learnedNow, masteredNow } = progressStore.recordPractice(glyph.id, {
      score: result.score,
      passed: result.passed,
      level: this.#level,
    });
    this.#refreshSeals();
    if (!result.passed) return;

    if (result.transform) await this.#station.activate(glyph, result.transform, { score: result.score });
    const whisper = /** @type {GcSusurro | null} */ (document.querySelector('gc-whisper'));
    if (learnedNow) {
      audio.play('learned');
      whisper?.show({
        type: 'arcane',
        title: `¡Has aprendido ${glyph.name}!`,
        message: 'Su sello ya está completo. Ahora puedes lanzarlo de memoria en «Practicar magia».',
        duration: 8000,
      });
    } else if (masteredNow) {
      whisper?.show({ type: 'arcane', title: `${glyph.name} dominado`, message: 'Lo trazas con precisión de maestro glifista.', duration: 8000 });
    } else if (!progressStore.isLearned(glyph.id)) {
      whisper?.show({ type: 'success', title: 'Glifo superado', message: `Llevas ${progress.successes} de ${CASTS_TO_LEARN} aciertos.` });
    }
  };
}
