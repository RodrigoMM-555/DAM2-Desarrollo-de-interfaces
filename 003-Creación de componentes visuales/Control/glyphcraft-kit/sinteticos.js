/**
 * glyphcraft-kit/sinteticos · Utilidades para probar sin cámara.
 *
 * @module glyphcraft-kit/sinteticos
 */

/** @typedef {import('./sinteticos/mano-sintetica.js').HandSession} HandSession */
/** @typedef {import('./sinteticos/mano-sintetica.js').HandPose} HandPose */

export { createSyntheticHand, createSyntheticFrame, synthesizeSession, HAND_POSES } from './sinteticos/mano-sintetica.js';
export { drawGlyphLike, splitStroke, seededRandom } from './sinteticos/glifo-sintetico.js';
