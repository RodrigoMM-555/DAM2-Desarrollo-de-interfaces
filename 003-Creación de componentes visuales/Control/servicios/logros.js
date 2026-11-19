/**
 * Logros, rangos y combinaciones con nombre.
 *
 * Cada logro es una condición pura sobre las estadísticas del progreso:
 * fácil de probar y de ampliar.
 */

/** @typedef {ReturnType<import('./progreso.js').AlmacenProgreso['totals']>} Totals */

/**
 * @typedef {object} Achievement
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} rune Icono rúnico.
 * @property {(t: Totals, glyphCount: number) => boolean} test
 */

/** @type {readonly Achievement[]} */
export const ACHIEVEMENTS = Object.freeze([
  { id: 'primera-chispa', title: 'Primera chispa', description: 'Supera tu primer glifo.', rune: 'spark', test: (t) => t.successes >= 1 },
  { id: 'aprendiz', title: 'Aprendiz del taller', description: 'Aprende tu primer glifo.', rune: 'grimoire', test: (t) => t.learned >= 1 },
  { id: 'tres-sellos', title: 'Tres sellos', description: 'Aprende tres glifos.', rune: 'seal', test: (t) => t.learned >= 3 },
  {
    id: 'grimorio-completo',
    title: 'Grimorio completo',
    description: 'Aprende todos los glifos.',
    rune: 'grimoire',
    test: (t, n) => n > 0 && t.learned >= n,
  },
  { id: 'trazo-impecable', title: 'Trazo impecable', description: 'Consigue 100 de precisión.', rune: 'target', test: (t) => t.bestScore >= 100 },
  { id: 'maestria', title: 'Maestría', description: 'Domina un glifo en nivel Maestro.', rune: 'progress', test: (t) => t.mastered >= 1 },
  { id: 'lanzador', title: 'Lanzador incansable', description: 'Lanza diez hechizos de memoria.', rune: 'practice', test: (t) => t.casts >= 10 },
  { id: 'alquimista', title: 'Alquimista', description: 'Descubre una combinación en el laboratorio.', rune: 'lab', test: (t) => t.discoveries >= 1 },
  { id: 'constancia', title: 'Constancia', description: 'Practica durante 30 minutos.', rune: 'eye', test: (t) => t.practiceMs >= 30 * 60 * 1000 },
]);

/**
 * Comprueba qué logros se cumplen y desbloquea los nuevos.
 * @param {import('./progreso.js').AlmacenProgreso} store
 * @param {number} glyphCount Glifos del grimorio.
 * @returns {Achievement[]} Logros recién desbloqueados.
 */
export function checkAchievements(store, glyphCount) {
  const totals = store.totals();
  return ACHIEVEMENTS.filter((a) => a.test(totals, glyphCount) && store.unlockAchievement(a.id));
}

/** Rangos del aprendiz, de menor a mayor. */
export const RANKS = Object.freeze([
  { id: 'aprendiz', label: 'Aprendiz', requirement: 'Aprende tu primer glifo.' },
  { id: 'iniciado', label: 'Iniciado', requirement: 'Aprende dos glifos.' },
  { id: 'artesano', label: 'Artesano', requirement: 'Aprende cuatro glifos.' },
  { id: 'maestro', label: 'Maestro glifista', requirement: 'Aprende todos y domina al menos uno.' },
]);

/**
 * Rango actual según lo aprendido.
 * @param {{ learned: number, mastered: number }} totals
 * @param {number} glyphCount
 * @returns {number} Índice en `RANKS`.
 */
export function rankIndex({ learned, mastered }, glyphCount) {
  if (glyphCount > 0 && learned >= glyphCount && mastered >= 1) return 3;
  if (learned >= 4) return 2;
  if (learned >= 2) return 1;
  return 0;
}

/**
 * Combinaciones con nombre propio del laboratorio (por identificadores de
 * glifo ordenados alfabéticamente y unidos con `+`).
 * @type {Readonly<Record<string, { name: string, text: string }>>}
 */
export const NAMED_COMBINATIONS = Object.freeze({
  'ignis+ventus': { name: 'Tormenta ígnea', text: 'El viento aviva las llamas hasta convertirlas en remolino.' },
  'aqua+ignis': { name: 'Velo de vapor', text: 'Agua y fuego se anulan en una niebla cálida.' },
  'aqua+glacies': { name: 'Ventisca', text: 'El agua se congela en el aire antes de caer.' },
  'aqua+ventus': { name: 'Tempestad', text: 'Lluvia arrastrada por un viento furioso.' },
  'aegis+lux': { name: 'Égida solar', text: 'Un escudo que brilla como el mediodía.' },
  'glacies+lux': { name: 'Prisma helado', text: 'La luz se quiebra en mil cristales.' },
  'ignis+lux': { name: 'Sol naciente', text: 'Una llama tan pura que ilumina el taller.' },
  'glacies+ventus': { name: 'Aliento boreal', text: 'Un soplo helado del norte.' },
  'aegis+ignis': { name: 'Muralla de brasas', text: 'Una barrera que quema a quien la toca.' },
  'aegis+aqua': { name: 'Burbuja abisal', text: 'Un refugio de agua en calma.' },
});

/**
 * Identificador de una combinación (orden independiente).
 * @param {string[]} glyphIds
 */
export function combinationId(glyphIds) {
  return [...glyphIds].sort().join('+');
}
