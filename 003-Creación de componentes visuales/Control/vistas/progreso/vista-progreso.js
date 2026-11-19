import { glyphLibrary } from 'glyphcraft-kit/nucleo';
import { runeIcon } from 'glyphcraft-kit';
import { viewHeader } from '../marco-vista.js';
import { progressStore } from '../../servicios/servicios-app.js';
import { CASTS_TO_LEARN } from '../../servicios/progreso.js';
import { ACHIEVEMENTS, RANKS, rankIndex, NAMED_COMBINATIONS } from '../../servicios/logros.js';

/** @typedef {import('glyphcraft-kit').GcMedidorArcano} GcMedidorArcano */
/** @typedef {import('glyphcraft-kit').GcGlifo} GcGlifo */

/**
 * Duración legible: «1 h 05 min», «12 min», «40 s».
 * @param {number} ms
 */
export function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

/** @param {string} iso */
const formatDate = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Progreso: rango, estadísticas, glifos, logros y descubrimientos.
 * Se actualiza en vivo cuando cambia el progreso.
 */
export class VistaProgreso extends HTMLElement {
  /** @type {AbortController | null} */ #listeners = null;

  connectedCallback() {
    if (!this.childElementCount) this.#render();
    this.#listeners = new AbortController();
    progressStore.addEventListener('change', () => this.#update(), { signal: this.#listeners.signal });
    this.#update();
  }

  disconnectedCallback() {
    this.#listeners?.abort();
  }

  #render() {
    this.className = 'view view--progress';
    this.innerHTML = `
      ${viewHeader({
        kicker: 'Bitácora del taller',
        title: 'Progreso',
        intro: 'Tu camino de aprendiz a maestro glifista: lo que has aprendido, tu precisión y los logros conseguidos.',
      })}
      <section class="rank" aria-label="Rango">
        <p class="kicker">Rango actual</p>
        <p class="rank__name"></p>
        <p class="rank__next"></p>
        <ol class="ranks"></ol>
      </section>

      <section class="stats" aria-label="Estadísticas">
        <div class="stats__meters">
          <gc-arcane-meter class="stat-learned" label="Aprendidos"></gc-arcane-meter>
          <gc-arcane-meter class="stat-mastered" label="Dominados"></gc-arcane-meter>
          <gc-arcane-meter class="stat-accuracy" label="Precisión media"></gc-arcane-meter>
        </div>
        <dl class="stats__numbers"></dl>
      </section>

      <section class="progress-glyphs" aria-label="Glifos">
        <h2 class="section-title">Glifos</h2>
        <ul class="progress-glyphs__list"></ul>
      </section>

      <section class="achievements" aria-label="Logros">
        <h2 class="section-title">Logros <span class="achievements__count"></span></h2>
        <ul class="achievements__grid"></ul>
      </section>`;
  }

  #update() {
    const glyphs = glyphLibrary.list();
    const totals = progressStore.totals();

    // Rango
    const rank = rankIndex(totals, glyphs.length);
    /** @type {HTMLElement} */ (this.querySelector('.rank__name')).textContent = RANKS[rank].label;
    /** @type {HTMLElement} */ (this.querySelector('.rank__next')).textContent =
      rank < RANKS.length - 1 ? `Siguiente rango: ${RANKS[rank + 1].label}. ${RANKS[rank + 1].requirement}` : 'Has alcanzado el rango más alto.';
    /** @type {HTMLElement} */ (this.querySelector('.ranks')).innerHTML = RANKS.map(
      (r, i) => `<li class="ranks__item${i === rank ? ' is-current' : ''}${i < rank ? ' is-done' : ''}">${r.label}</li>`,
    ).join('');

    // Medidores
    const meter = (/** @type {string} */ s) => /** @type {GcMedidorArcano} */ (this.querySelector(s));
    meter('.stat-learned').max = Math.max(1, glyphs.length);
    meter('.stat-learned').value = totals.learned;
    meter('.stat-mastered').max = Math.max(1, glyphs.length);
    meter('.stat-mastered').value = totals.mastered;
    meter('.stat-accuracy').value = Math.round(totals.averageScore);

    const numbers = [
      ['Intentos', String(totals.attempts)],
      ['Aciertos', String(totals.successes)],
      ['Hechizos lanzados', String(totals.casts)],
      ['Mejor precisión', String(Math.round(totals.bestScore))],
      ['Tiempo de práctica', formatDuration(totals.practiceMs)],
      ['Descubrimientos', `${totals.discoveries} / ${Object.keys(NAMED_COMBINATIONS).length}`],
    ];
    /** @type {HTMLElement} */ (this.querySelector('.stats__numbers')).innerHTML = numbers
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
      .join('');

    // Glifos
    const list = /** @type {HTMLElement} */ (this.querySelector('.progress-glyphs__list'));
    list.replaceChildren(
      ...glyphs.map((g) => {
        const p = progressStore.get(g.id);
        const li = document.createElement('li');
        li.innerHTML = `
          <gc-glyph size="44"></gc-glyph>
          <span class="progress-glyphs__name"></span>
          <gc-arcane-meter variant="seals" max="${CASTS_TO_LEARN}" value="${Math.min(p.successes, CASTS_TO_LEARN)}"></gc-arcane-meter>
          <span class="progress-glyphs__detail"></span>`;
        /** @type {GcGlifo} */ (li.querySelector('gc-glyph')).glyph = g;
        /** @type {HTMLElement} */ (li.querySelector('.progress-glyphs__name')).textContent = g.name;
        const status = progressStore.isMastered(g.id) ? 'Dominado' : progressStore.isLearned(g.id) ? 'Aprendido' : p.attempts ? 'En estudio' : 'Sin practicar';
        /** @type {HTMLElement} */ (li.querySelector('.progress-glyphs__detail')).textContent =
          `${status} · ${p.attempts} intentos · mejor ${p.bestScore} · ${p.casts} lanzamientos`;
        li.dataset.status = status;
        return li;
      }),
    );

    // Logros
    const unlocked = progressStore.achievements();
    /** @type {HTMLElement} */ (this.querySelector('.achievements__count')).textContent =
      `${Object.keys(unlocked).length}/${ACHIEVEMENTS.length}`;
    /** @type {HTMLElement} */ (this.querySelector('.achievements__grid')).innerHTML = ACHIEVEMENTS.map((a) => {
      const date = unlocked[a.id];
      return `
        <li class="achievement${date ? ' is-unlocked' : ''}">
          <span class="achievement__icon" aria-hidden="true">${runeIcon(a.rune)}</span>
          <span class="achievement__title">${a.title}</span>
          <span class="achievement__description">${a.description}</span>
          <span class="achievement__date">${date ? formatDate(date) : 'Bloqueado'}</span>
        </li>`;
    }).join('');
  }
}
