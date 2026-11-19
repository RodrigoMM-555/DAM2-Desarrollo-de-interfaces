/**
 * Cabecera común de las secciones: botón de volver, antetítulo, título y
 * entradilla. Devuelve HTML porque todo el contenido es estático y propio
 * (nunca datos de la persona usuaria).
 *
 * @param {{ kicker: string, title: string, intro: string, back?: { path: string, label: string } }} options
 * @returns {string}
 */
export function viewHeader({ kicker, title, intro, back = { path: '/', label: 'Menú' } }) {
  return `
    <header class="view__header">
      <gc-rune-button class="view__back" variant="ghost" size="sm" rune="back" data-nav="${back.path}">${back.label}</gc-rune-button>
      <p class="kicker">${kicker}</p>
      <h1 class="view__title" tabindex="-1">${title}</h1>
      <p class="view__intro">${intro}</p>
    </header>`;
}
