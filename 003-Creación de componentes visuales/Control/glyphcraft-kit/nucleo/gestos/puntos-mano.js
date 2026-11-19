/**
 * Índices de los 21 puntos de referencia (landmarks) de una mano según
 * MediaPipe Hands.
 *
 * ```
 *            8   12  16  20      ← puntas (TIP)
 *            7   11  15  19      ← DIP
 *       4    6   10  14  18      ← PIP
 *      3     5    9  13  17      ← MCP (nudillos)
 *     2
 *    1                           ← pulgar: CMC 1, MCP 2, IP 3, TIP 4
 *         0                      ← muñeca
 * ```
 */
export const LANDMARK = Object.freeze({
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
});

/** Número de landmarks por mano. */
export const LANDMARK_COUNT = 21;

/** Índices de las puntas de los dedos. */
export const FINGERTIPS = Object.freeze([4, 8, 12, 16, 20]);

/**
 * Dedos largos con sus articulaciones [MCP, PIP, DIP, TIP].
 * @type {Readonly<Record<'index' | 'middle' | 'ring' | 'pinky', readonly [number, number, number, number]>>}
 */
export const FINGERS = Object.freeze({
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
});

/**
 * Pares de landmarks unidos por una línea (huesos de la mano).
 * @type {ReadonlyArray<readonly [number, number]>}
 */
export const HAND_CONNECTIONS = Object.freeze([
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [9, 10], [10, 11], [11, 12],
  [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
]);
