/**
 * glyphcraft-kit/nucleo · Lógica pura (sin DOM, sin cámara).
 *
 * ```js
 * import { MotorGestos } from 'glyphcraft-kit/nucleo';
 * ```
 *
 * @module glyphcraft-kit/nucleo
 */

/** @typedef {import('./nucleo/glifos/modelo-glifo.js').Glyph} Glyph */
/** @typedef {import('./nucleo/glifos/modelo-glifo.js').GlyphDef} GlyphDef */
/** @typedef {import('./nucleo/reconocimiento/reconocedor-glifos.js').RecognitionResult} RecognitionResult */
/** @typedef {import('./nucleo/reconocimiento/reconocedor-glifos.js').RecognitionLevel} RecognitionLevel */
/** @typedef {import('./nucleo/gestos/motor-gestos.js').HandFrame} HandFrame */
export { MotorGestos, DEFAULT_GESTURE_CONFIG } from './nucleo/gestos/motor-gestos.js';
export { computeHandFeatures, FEATURE_THRESHOLDS } from './nucleo/gestos/rasgos-mano.js';
export { LANDMARK, LANDMARK_COUNT, FINGERTIPS, FINGERS, HAND_CONNECTIONS } from './nucleo/gestos/puntos-mano.js';
export { FiltroUnEuro, FiltroPunto } from './nucleo/filtros/filtro-un-euro.js';
export { distance, midpoint, centroid, clamp } from './nucleo/geometria/vector.js';
export {
  pathLength,
  resample,
  boundingBox,
  fitCircle,
  angularCoverage,
  signedArea,
  chamfer,
  directedChamfer,
  pointwiseDistance,
} from './nucleo/geometria/trazo.js';
export {
  createGlyph,
  sampleStroke,
  isClosedStroke,
  pointsToPath,
  placeGlyph,
  BibliotecaGlifos,
  glyphLibrary,
  GLYPH_ELEMENTS,
} from './nucleo/glifos/modelo-glifo.js';
export { ReconocedorGlifos, RECOGNITION_LEVELS } from './nucleo/reconocimiento/reconocedor-glifos.js';
export { detectElements, DEFAULT_COMPOSITION_THRESHOLD } from './nucleo/reconocimiento/composicion.js';
