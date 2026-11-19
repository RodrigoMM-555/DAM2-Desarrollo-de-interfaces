import { distance, midpoint, centroid } from '../geometria/vector.js';
import { LANDMARK as L, FINGERS, LANDMARK_COUNT } from './puntos-mano.js';

/**
 * @typedef {{ x: number, y: number, z: number }} Landmark
 */

/**
 * Mano detectada en un fotograma.
 *
 * @typedef {object} TrackedHand
 * @property {'Left' | 'Right'} handedness Mano de la persona (no del espectador).
 * @property {number} score Confianza de la detección (0-1).
 * @property {Landmark[]} landmarks 21 puntos normalizados a la imagen (0-1, y hacia abajo).
 * @property {Landmark[]} [worldLandmarks] 21 puntos en metros, centrados en la mano.
 */

/**
 * @typedef {object} HandFeatures
 * @property {number} palmSize Longitud muñeca → nudillo medio (unidades del espacio usado).
 * @property {number} pinchRatio Contacto pulgar-índice / tamaño de la palma (la menor de: punta-punta, punta del pulgar-DIP del índice, IP del pulgar-punta del índice).
 * @property {{ x: number, y: number }} pinchPoint Punto entre pulgar e índice (coordenadas de imagen).
 * @property {{ x: number, y: number }} indexTip Punta del índice (coordenadas de imagen).
 * @property {{ x: number, y: number }} palmCenter Centro de la palma (coordenadas de imagen).
 * @property {{ thumb: boolean, index: boolean, middle: boolean, ring: boolean, pinky: boolean }} extended Dedos estirados.
 * @property {number} extendedCount Dedos largos estirados (0-4).
 * @property {number} spread Separación media de las puntas / tamaño de la palma.
 * @property {number} indexReach Distancia muñeca → punta del índice / tamaño de la palma.
 * @property {boolean} isOpenPalm Mano abierta con los dedos separados.
 * @property {boolean} isFist Puño cerrado.
 * @property {boolean} isPointing Solo el índice estirado.
 * @property {{ index: number, middle: number, ring: number, pinky: number }} fingerRatios
 *   Extensión de cada dedo: distancia muñeca→punta / muñeca→PIP (≈1,35 estirado, ≈0,75 doblado).
 * @property {number} thumbSpread Distancia punta del pulgar → nudillo del índice / palma.
 */

/**
 * Umbrales para clasificar la forma de la mano. Son proporciones respecto
 * al tamaño de la palma, así que no dependen de la distancia a la cámara.
 */
export const FEATURE_THRESHOLDS = Object.freeze({
  /** Un dedo está estirado si su punta se aleja de la muñeca este factor más que su PIP. */
  fingerExtended: 1.12,
  /** Un dedo está doblado si su punta queda más cerca de la muñeca que este factor × su PIP. */
  fingerCurled: 0.98,
  /** El pulgar está fuera si su punta se aleja del nudillo del índice al menos esto. */
  thumbOut: 0.5,
  /** Mano **bien** abierta: cada dedo largo claramente estirado… */
  openFinger: 1.2,
  /** …el pulgar bien separado… */
  openThumb: 0.6,
  /** …y los dedos abiertos en abanico. */
  openSpread: 0.32,
  /** Puño **bien** cerrado: los cuatro dedos (índice incluido) claramente doblados. */
  fistCurl: 0.85,
  /** Señalar: índice claramente estirado… */
  pointIndex: 1.15,
  /** …y el resto de dedos largos recogidos. */
  pointCurl: 0.95,
});

/**
 * Calcula las características geométricas de una mano.
 *
 * Usa los `worldLandmarks` (en metros, 3D) para las proporciones porque no
 * se deforman con la perspectiva ni con la relación de aspecto de la
 * cámara. Si no existen, usa los puntos de imagen corrigiendo el aspecto.
 *
 * @param {TrackedHand} hand
 * @param {{ aspect?: number }} [options] Ancho/alto de la imagen (solo sin worldLandmarks).
 * @returns {HandFeatures}
 */
export function computeHandFeatures(hand, { aspect = 4 / 3 } = {}) {
  if (!hand?.landmarks || hand.landmarks.length !== LANDMARK_COUNT) {
    throw new TypeError(`computeHandFeatures necesita ${LANDMARK_COUNT} landmarks.`);
  }
  const image = hand.landmarks;
  const space =
    hand.worldLandmarks?.length === LANDMARK_COUNT
      ? hand.worldLandmarks
      : image.map((p) => ({ x: p.x * aspect, y: p.y, z: 0 }));

  const palmSize = distance(space[L.WRIST], space[L.MIDDLE_MCP]) || 1e-6;
  const reach = (/** @type {number} */ i) => distance(space[L.WRIST], space[i]);

  const fingerState = (/** @type {readonly number[]} */ [, pip, , tip]) => {
    const ratio = reach(tip) / (reach(pip) || 1e-6);
    return {
      ratio,
      extended: ratio > FEATURE_THRESHOLDS.fingerExtended,
      curled: ratio < FEATURE_THRESHOLDS.fingerCurled,
    };
  };
  const index = fingerState(FINGERS.index);
  const middle = fingerState(FINGERS.middle);
  const ring = fingerState(FINGERS.ring);
  const pinky = fingerState(FINGERS.pinky);
  const thumbSpread = distance(space[L.THUMB_TIP], space[L.INDEX_MCP]) / palmSize;
  const thumbOut = thumbSpread > FEATURE_THRESHOLDS.thumbOut;

  const tips = [L.INDEX_TIP, L.MIDDLE_TIP, L.RING_TIP, L.PINKY_TIP].map((i) => space[i]);
  const spread =
    (distance(tips[0], tips[1]) + distance(tips[1], tips[2]) + distance(tips[2], tips[3])) / 3 / palmSize;

  const extended = {
    thumb: thumbOut,
    index: index.extended,
    middle: middle.extended,
    ring: ring.extended,
    pinky: pinky.extended,
  };
  const extendedCount = [index, middle, ring, pinky].filter((f) => f.extended).length;
  const indexReach = reach(L.INDEX_TIP) / palmSize;
  // Al pellizcar, el pulgar no siempre toca la punta exacta del índice: a
  // veces toca su última falange. Se toma el contacto más cercano para que
  // un pellizco real no se "suelte" por un pequeño cambio de postura.
  const pinchRatio =
    Math.min(
      distance(space[L.THUMB_TIP], space[L.INDEX_TIP]),
      distance(space[L.THUMB_TIP], space[L.INDEX_DIP]),
      distance(space[L.THUMB_IP], space[L.INDEX_TIP]),
    ) / palmSize;

  const T = FEATURE_THRESHOLDS;
  const longFingers = [index, middle, ring, pinky];
  const others = [middle, ring, pinky];
  // Umbrales estrictos: borrar y sellar exigen gestos claros e inequívocos.
  const isOpenPalm =
    longFingers.every((f) => f.ratio > T.openFinger) && thumbSpread > T.openThumb && spread > T.openSpread;
  const isFist = longFingers.every((f) => f.ratio < T.fistCurl);
  const isPointing = index.ratio > T.pointIndex && others.every((f) => f.ratio < T.pointCurl);

  const pinch = midpoint(image[L.THUMB_TIP], image[L.INDEX_TIP]);
  const palm = centroid([image[L.WRIST], image[L.INDEX_MCP], image[L.MIDDLE_MCP], image[L.RING_MCP], image[L.PINKY_MCP]]);

  return {
    palmSize,
    pinchRatio,
    pinchPoint: { x: pinch.x, y: pinch.y },
    indexTip: { x: image[L.INDEX_TIP].x, y: image[L.INDEX_TIP].y },
    palmCenter: { x: palm.x, y: palm.y },
    extended,
    extendedCount,
    spread,
    indexReach,
    isOpenPalm,
    isFist,
    isPointing,
    fingerRatios: { index: index.ratio, middle: middle.ratio, ring: ring.ratio, pinky: pinky.ratio },
    thumbSpread,
  };
}
