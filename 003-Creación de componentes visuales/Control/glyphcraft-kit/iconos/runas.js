/**
 * Iconos rúnicos de la interfaz (SVG de 24×24, solo trazo).
 *
 * Son diseños propios y geométricos para que los botones parezcan parte del
 * universo mágico y no iconos genéricos. Usan `currentColor`, así que toman
 * el color del texto del componente que los contiene.
 */

/** @type {Readonly<Record<string, string>>} */
const PATHS = Object.freeze({
  practice:
    '<circle cx="12" cy="12" r="9"/><path d="M12 5.6 17.5 15.1H6.5Z"/><circle cx="12" cy="12.2" r="1.3"/>',
  grimoire:
    '<path d="M3.5 5.5c2.8-1.2 5.8-1.1 8.5.6 2.7-1.7 5.7-1.8 8.5-.6v13c-2.8-1.2-5.8-1.1-8.5.6-2.7-1.7-5.7-1.8-8.5-.6Z"/><path d="M12 6.1v13.5"/><circle cx="7.8" cy="11.6" r="1.9"/><path d="M15 10.2h3M15 12.6h3"/>',
  lab:
    '<path d="M9.4 3h5.2M10.4 3v5.3L5.3 17.3A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.2-3.7L13.6 8.3V3"/><path d="M7.4 14.4h9.2"/><circle cx="10.6" cy="17.6" r=".9"/><circle cx="14" cy="16.8" r=".6"/>',
  progress:
    '<path d="m3.5 19 5-6 4 3 6.5-8.5"/><circle cx="3.5" cy="19" r="1.2"/><circle cx="8.5" cy="13" r="1.2"/><circle cx="12.5" cy="16" r="1.2"/><path d="m20 2.8.9 2.1 2.1.9-2.1.9L20 8.8l-.9-2.1-2.1-.9 2.1-.9Z"/>',
  settings:
    '<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="7.4" stroke-dasharray="2.3 2.6"/><path d="M12 1.6v2.6M12 19.8v2.6M1.6 12h2.6M19.8 12h2.6"/>',
  back: '<path d="M9.5 5.5 3 12l6.5 6.5"/><path d="M3.5 12H21"/><path d="m17 9.5 2.5 2.5-2.5 2.5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  spark: '<path d="M12 2.5 13.7 10.3 21.5 12l-7.8 1.7L12 21.5l-1.7-7.8L2.5 12l7.8-1.7Z"/>',
  seal: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21"/>',
  warning: '<path d="M12 3.2 21.3 19.5H2.7Z"/><path d="M12 9.5v4.6"/><circle cx="12" cy="16.9" r=".6"/>',
  fullscreen: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
  // Gestos
  palm: '<path d="M7.5 13V6.5a1.3 1.3 0 0 1 2.6 0V11M10.1 10.5V4.8a1.3 1.3 0 0 1 2.6 0v5.7M12.7 10.5V5.6a1.3 1.3 0 0 1 2.6 0V11M15.3 11V8a1.3 1.3 0 0 1 2.6 0v6.2a6.3 6.3 0 0 1-6.3 6.3h-.6a5.6 5.6 0 0 1-4.5-2.3L3.9 14a1.4 1.4 0 0 1 2.1-1.8l1.5 1.5"/>',
  pinch: '<path d="M8.5 20.5c-2.8-1.6-4.2-4-3.6-6.6l1.2-5.4a1.4 1.4 0 0 1 2.7.6l-.6 3"/><path d="M8 12.4 12.6 6a1.5 1.5 0 0 1 2.4 1.8l-2.6 3.6"/><path d="M12.4 11.4c1.6-.6 3.3-.1 3.9 1.4.7 1.7-.4 3.6-2.7 4.7"/><circle cx="17.8" cy="5.2" r="1.8"/>',
  fist: '<path d="M6.5 11.5V9.3a1.6 1.6 0 0 1 3.2 0v1.2M9.7 10V8.4a1.6 1.6 0 0 1 3.2 0V10M12.9 10V8.8a1.6 1.6 0 0 1 3.2 0V11M16.1 11v-.6a1.6 1.6 0 0 1 3.2 0v3.4a6.7 6.7 0 0 1-6.7 6.7h-1.3a5.7 5.7 0 0 1-5.7-5.7v-1.5a2 2 0 0 1 2-2h3.3a1.6 1.6 0 0 1 0 3.2H9"/>',
  point: '<path d="M10 13.5V4.3a1.4 1.4 0 0 1 2.8 0V12M12.8 11.2a1.4 1.4 0 0 1 2.8 0v1M15.6 11.8a1.4 1.4 0 0 1 2.8 0v2.6a6.1 6.1 0 0 1-6.1 6.1h-.8a5.4 5.4 0 0 1-4.4-2.3L5 15.5a1.4 1.4 0 0 1 2.2-1.8l2.8 2.6"/>',
  camera: '<path d="M3.5 8.5A1.5 1.5 0 0 1 5 7h2.5l1.5-2h6l1.5 2H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5Z"/><circle cx="12" cy="12.8" r="3.6"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.3v7.4l6-3.7Z"/>',
  undo: '<path d="M8.5 5 4 9.5 8.5 14"/><path d="M4.5 9.5h9a5.5 5.5 0 0 1 0 11H10"/>',
  record: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.6"/>',
});

/** Nombres de iconos disponibles. */
export const RUNE_NAMES = Object.freeze(Object.keys(PATHS));

/**
 * Devuelve el SVG de un icono rúnico como cadena.
 *
 * @param {string} name Uno de {@link RUNE_NAMES}.
 * @returns {string} Marcado SVG, o cadena vacía si el nombre no existe.
 */
export function runeIcon(name) {
  const paths = PATHS[name];
  if (!paths) return '';
  return `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}
