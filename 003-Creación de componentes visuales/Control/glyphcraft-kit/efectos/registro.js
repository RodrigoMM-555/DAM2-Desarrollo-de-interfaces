import { fire, water, wind, light, aegis, ice } from './hechizos/elementos.js';

/** @typedef {[number, number, number]} RGB */
/** @typedef {import('./efecto.js').SpellContext} SpellContext */
/** @typedef {import('./efecto.js').Efecto} Efecto */

/**
 * @typedef {object} SpellDefinition
 * @property {string} label Nombre visible.
 * @property {RGB} color Color principal (también tiñe la activación).
 * @property {RGB} accent Color secundario.
 * @property {(ctx: SpellContext) => Efecto} create Construye el efecto.
 */

/** @type {Map<string, SpellDefinition>} */
const spells = new Map();

/**
 * Registra (o sustituye) un hechizo. Así otros proyectos pueden añadir
 * efectos propios sin tocar la biblioteca.
 *
 * @param {string} id
 * @param {SpellDefinition} definition
 */
export function registerSpell(id, definition) {
  if (typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id)) throw new TypeError('registerSpell: id no válido.');
  if (typeof definition?.create !== 'function') throw new TypeError('registerSpell: falta la función "create".');
  const rgb = (/** @type {unknown} */ c) => Array.isArray(c) && c.length === 3 && c.every((v) => Number.isFinite(v));
  if (!rgb(definition.color) || !rgb(definition.accent)) throw new TypeError('registerSpell: "color" y "accent" deben ser [r, g, b].');
  spells.set(id, Object.freeze({ ...definition }));
}

/** @param {string} id */
export function getSpell(id) {
  return spells.get(id) ?? null;
}

/** Identificadores de los hechizos registrados. */
export function spellIds() {
  return [...spells.keys()];
}

registerSpell('fire', { label: 'Fuego', color: [1, 0.5, 0.12], accent: [1, 0.85, 0.4], create: fire });
registerSpell('water', { label: 'Agua', color: [0.3, 0.7, 1], accent: [0.7, 0.95, 1], create: water });
registerSpell('wind', { label: 'Viento', color: [0.55, 0.95, 0.8], accent: [0.9, 1, 0.95], create: wind });
registerSpell('light', { label: 'Luz', color: [1, 0.88, 0.5], accent: [1, 1, 0.9], create: light });
registerSpell('aegis', { label: 'Protección', color: [0.65, 0.55, 1], accent: [0.85, 0.8, 1], create: aegis });
registerSpell('ice', { label: 'Hielo', color: [0.6, 0.85, 1], accent: [0.95, 1, 1], create: ice });
