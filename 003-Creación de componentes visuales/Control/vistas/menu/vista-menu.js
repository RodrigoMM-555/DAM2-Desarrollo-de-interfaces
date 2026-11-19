import { arcaneSigil } from './sigilo-arcano.js';

/** Entradas del menú principal. */
const ENTRIES = [
  { path: '/practice', rune: 'practice', label: 'Practicar magia', hint: 'Lanza los glifos que ya has aprendido' },
  { path: '/grimoire', rune: 'grimoire', label: 'Grimorio', hint: 'Estudia cada glifo y practícalo hasta aprenderlo' },
  { path: '/lab', rune: 'lab', label: 'Laboratorio', hint: 'Combina sigilos y descubre efectos nuevos' },
  { path: '/progress', rune: 'progress', label: 'Progreso', hint: 'Tu camino de aprendiz a maestro glifista' },
  { path: '/settings', rune: 'settings', label: 'Ajustes', hint: 'Cámara, manos, efectos y sonido' },
];

/**
 * Menú principal: entrada a toda la experiencia.
 *
 * No navega por sí mismo: sus botones llevan `data-nav` y el contenedor de
 * la aplicación decide qué hacer al recibir `rune-activate`.
 */
export class VistaMenu extends HTMLElement {
  connectedCallback() {
    if (this.childElementCount) return;
    this.className = 'view view--menu';
    this.innerHTML = `
      <div class="menu">
        <div class="menu__hero">
          ${arcaneSigil()}
          <div class="menu__title">
            <p class="kicker">Taller de glifos</p>
            <h1 class="view__title" tabindex="-1">GlyphCraft</h1>
            <p class="menu__tagline">Traza el círculo. Escribe la runa.<br>Despierta la magia.</p>
          </div>
        </div>
        <nav class="menu__nav" aria-label="Menú principal">
          ${ENTRIES.map(
            (e, i) => `
            <gc-rune-button variant="inscription" rune="${e.rune}" data-nav="${e.path}" style="--i:${i}">
              ${e.label}<span slot="hint">${e.hint}</span>
            </gc-rune-button>`,
          ).join('')}
        </nav>
      </div>
      <p class="menu__footer">
        Dibuja con el índice frente a la cámara o con el ratón · <kbd>Esc</kbd> vuelve al menú ·
        <a href="catalogo.html">Catálogo de componentes</a>
      </p>`;
  }
}
