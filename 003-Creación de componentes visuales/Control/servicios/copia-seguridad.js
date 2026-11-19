/**
 * Copia de seguridad: exporta e importa ajustes y progreso en un JSON.
 */

const APP_ID = 'glyphcraft';

/**
 * @param {{ toJSON(): unknown }} settings
 * @param {{ toJSON(): unknown }} progress
 */
export function exportData(settings, progress) {
  return {
    app: APP_ID,
    format: 1,
    exportedAt: new Date().toISOString(),
    settings: settings.toJSON(),
    progress: progress.toJSON(),
  };
}

/**
 * Comprueba y aplica una copia. No modifica nada si el formato no es válido.
 * @param {unknown} data
 * @param {{ import(data: unknown): void }} settings
 * @param {{ import(data: unknown): void }} progress
 * @throws {TypeError} si no es una copia de GlyphCraft.
 */
export function importData(data, settings, progress) {
  const d = /** @type {any} */ (data);
  if (!d || d.app !== APP_ID || typeof d.settings !== 'object' || typeof d.progress !== 'object') {
    throw new TypeError('El archivo no es una copia de GlyphCraft.');
  }
  settings.import(d.settings);
  progress.import(d.progress);
}
