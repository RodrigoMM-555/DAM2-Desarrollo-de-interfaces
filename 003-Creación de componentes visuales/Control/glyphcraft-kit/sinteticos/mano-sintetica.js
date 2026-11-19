/**
 * Manos sintéticas para probar el reconocimiento de gestos sin cámara.
 *
 * Genera los 21 landmarks con el mismo formato que MediaPipe:
 * - `worldLandmarks` en metros (palma de unos 9,5 cm), y hacia abajo.
 * - `landmarks` normalizados a la imagen (0-1).
 *
 * Las poses son aproximaciones anatómicas pensadas para que cada gesto
 * quede claramente dentro de los umbrales de `computeHandFeatures`.
 */

/** @typedef {import('../nucleo/gestos/rasgos-mano.js').TrackedHand} TrackedHand */
/** @typedef {import('../nucleo/gestos/motor-gestos.js').HandFrame} HandFrame */
/** @typedef {'open' | 'relaxed' | 'pinch' | 'fist' | 'point' | 'loose-fist' | 'point-relaxed'} HandPose */
/** @typedef {[number, number, number]} P3 */

/** Poses disponibles. */
export const HAND_POSES = Object.freeze(
  /** @type {HandPose[]} */ (['open', 'relaxed', 'pinch', 'fist', 'point', 'loose-fist', 'point-relaxed']),
);

const WRIST = /** @type {P3} */ ([0, 0, 0]);
const MCP = {
  index: /** @type {P3} */ ([-0.028, -0.088, 0]),
  middle: /** @type {P3} */ ([-0.005, -0.095, 0]),
  ring: /** @type {P3} */ ([0.017, -0.09, 0]),
  pinky: /** @type {P3} */ ([0.036, -0.078, 0]),
};
const THUMB_BASE = /** @type {P3[]} */ ([[-0.025, -0.025, 0], [-0.045, -0.045, 0]]);

/**
 * Dedo estirado con una inclinación (grados respecto a la vertical).
 * @param {P3} mcp
 * @param {number} angleDeg
 * @returns {P3[]}
 */
function straight(mcp, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  const dir = [Math.sin(a), -Math.cos(a)];
  const at = (/** @type {number} */ len) => /** @type {P3} */ ([mcp[0] + dir[0] * len, mcp[1] + dir[1] * len, 0]);
  return [mcp, at(0.038), at(0.062), at(0.084)];
}

/**
 * Dedo doblado hacia la palma.
 * @param {P3} mcp
 * @returns {P3[]}
 */
function curled(mcp) {
  return [
    mcp,
    [mcp[0], mcp[1] - 0.025, -0.015],
    [mcp[0], mcp[1] - 0.01, -0.035],
    [mcp[0], mcp[1] + 0.012, -0.03],
  ];
}

/**
 * Dedo a medio cerrar (ni estirado ni doblado del todo).
 * @param {P3} mcp
 * @returns {P3[]}
 */
function halfCurled(mcp) {
  return [mcp, [mcp[0], mcp[1] - 0.03, -0.01], [mcp[0], mcp[1] - 0.04, -0.03], [mcp[0], mcp[1] - 0.01, -0.045]];
}

/**
 * Landmarks en metros para una pose (mano derecha, palma hacia la cámara).
 * @param {HandPose} pose
 * @returns {P3[]}
 */
function poseLandmarks(pose) {
  /** @type {P3[]} */ let thumb;
  /** @type {P3[][]} */ let fingers;
  switch (pose) {
    case 'open':
      thumb = [...THUMB_BASE, [-0.07, -0.06, 0], [-0.088, -0.072, 0]];
      fingers = [straight(MCP.index, -14), straight(MCP.middle, -4), straight(MCP.ring, 6), straight(MCP.pinky, 16)];
      break;
    case 'relaxed':
      thumb = [...THUMB_BASE, [-0.05, -0.065, -0.01], [-0.045, -0.085, -0.015]];
      fingers = [straight(MCP.index, 0), straight(MCP.middle, 0), straight(MCP.ring, 0), straight(MCP.pinky, 0)];
      break;
    case 'pinch':
      thumb = [...THUMB_BASE, [-0.062, -0.085, -0.01], [-0.054, -0.122, -0.012]];
      fingers = [
        [MCP.index, [-0.035, -0.122, -0.008], [-0.045, -0.135, -0.012], [-0.052, -0.128, -0.012]],
        curled(MCP.middle),
        curled(MCP.ring),
        curled(MCP.pinky),
      ];
      break;
    case 'fist':
      thumb = [...THUMB_BASE, [-0.03, -0.06, -0.025], [-0.005, -0.07, -0.03]];
      fingers = [curled(MCP.index), curled(MCP.middle), curled(MCP.ring), curled(MCP.pinky)];
      break;
    case 'point':
      thumb = [...THUMB_BASE, [-0.03, -0.06, -0.025], [-0.008, -0.065, -0.03]];
      fingers = [straight(MCP.index, 0), curled(MCP.middle), curled(MCP.ring), curled(MCP.pinky)];
      break;
    case 'loose-fist': // puño a medio cerrar: no debe sellar
      thumb = [...THUMB_BASE, [-0.03, -0.06, -0.025], [-0.005, -0.07, -0.03]];
      fingers = [halfCurled(MCP.index), halfCurled(MCP.middle), halfCurled(MCP.ring), halfCurled(MCP.pinky)];
      break;
    case 'point-relaxed': // índice medio estirado: basta para seguir dibujando, no para empezar
      thumb = [...THUMB_BASE, [-0.03, -0.06, -0.025], [-0.008, -0.065, -0.03]];
      fingers = [
        [MCP.index, [-0.028, -0.123, -0.005], [-0.028, -0.135, -0.01], [-0.028, -0.133, -0.01]],
        curled(MCP.middle),
        curled(MCP.ring),
        curled(MCP.pinky),
      ];
      break;
    default:
      throw new RangeError(`Pose desconocida: ${pose}. Usa: ${HAND_POSES.join(', ')}.`);
  }
  return [WRIST, ...thumb, ...fingers.flat()];
}

/**
 * Crea una mano sintética.
 *
 * El punto (x, y) indica dónde queda el **ancla**: la punta del índice
 * (`anchor: 'index'`, el punto que dibuja al señalar) o el punto medio
 * entre pulgar e índice (`anchor: 'pinch'`).
 *
 * @param {object} [options]
 * @param {HandPose} [options.pose='relaxed']
 * @param {number} [options.x=0.5] Posición normalizada en la imagen.
 * @param {number} [options.y=0.5]
 * @param {number} [options.scale=1] Tamaño aparente (1 ≈ palma del 19 % del alto).
 * @param {number} [options.rotation=0] Giro en el plano de la imagen (grados).
 * @param {'Left' | 'Right'} [options.handedness='Right']
 * @param {number} [options.score=0.95]
 * @param {number} [options.aspect=4/3] Ancho/alto de la imagen.
 * @param {'index' | 'pinch'} [options.anchor='index'] Qué punto de la mano se coloca en (x, y).
 * @returns {TrackedHand}
 */
export function createSyntheticHand({
  pose = 'relaxed',
  x = 0.5,
  y = 0.5,
  scale = 1,
  rotation = 0,
  handedness = 'Right',
  score = 0.95,
  aspect = 4 / 3,
  anchor: anchorMode = 'index',
} = {}) {
  const mirror = handedness === 'Left' ? -1 : 1;
  const a = (rotation * Math.PI) / 180;
  const [cos, sin] = [Math.cos(a), Math.sin(a)];
  const world = poseLandmarks(pose).map(([px, py, pz]) => {
    const mx = px * mirror;
    return { x: mx * cos - py * sin, y: mx * sin + py * cos, z: pz };
  });

  const k = 2 * scale; // metros → fracción del alto de la imagen
  const anchor =
    anchorMode === 'pinch'
      ? { x: (world[4].x + world[8].x) / 2, y: (world[4].y + world[8].y) / 2 }
      : { x: world[8].x, y: world[8].y };
  const landmarks = world.map((p) => ({
    x: x + ((p.x - anchor.x) * k) / aspect,
    y: y + (p.y - anchor.y) * k,
    z: p.z * k,
  }));
  return { handedness, score, landmarks, worldLandmarks: world };
}

/**
 * Crea un fotograma con varias manos.
 * @param {TrackedHand[]} hands
 * @param {number} timestamp ms
 * @param {{ imageWidth?: number, imageHeight?: number }} [size]
 * @returns {HandFrame}
 */
export function createSyntheticFrame(hands, timestamp, { imageWidth = 640, imageHeight = 480 } = {}) {
  return { timestamp, imageWidth, imageHeight, hands };
}

/**
 * @typedef {object} SessionStep Tramo de una sesión sintética.
 * @property {HandPose | null} pose `null` = sin mano visible.
 * @property {number} durationMs
 * @property {{ x: number, y: number } | ((t: number) => { x: number, y: number })} [at]
 *   Posición fija o función del progreso del tramo (0-1).
 */

/**
 * @typedef {object} HandSession Sesión grabada o sintética.
 * @property {number} version
 * @property {number} imageWidth
 * @property {number} imageHeight
 * @property {HandFrame[]} frames
 */

/**
 * Genera una sesión completa a partir de tramos (para la demostración y las pruebas).
 *
 * @param {SessionStep[]} steps
 * @param {{ fps?: number, imageWidth?: number, imageHeight?: number, handedness?: 'Left' | 'Right', anchor?: 'index' | 'pinch' }} [options]
 * @returns {HandSession}
 */
export function synthesizeSession(steps, { fps = 30, imageWidth = 640, imageHeight = 480, handedness = 'Right', anchor = 'index' } = {}) {
  const aspect = imageWidth / imageHeight;
  const dt = 1000 / fps;
  /** @type {HandFrame[]} */
  const frames = [];
  let time = 0;
  let last = { x: 0.5, y: 0.5 };
  for (const step of steps) {
    const count = Math.max(1, Math.round(step.durationMs / dt));
    for (let i = 0; i < count; i++) {
      const progress = count === 1 ? 1 : i / (count - 1);
      if (typeof step.at === 'function') last = step.at(progress);
      else if (step.at) last = step.at;
      const hands = step.pose ? [createSyntheticHand({ pose: step.pose, ...last, handedness, aspect, anchor })] : [];
      frames.push(createSyntheticFrame(hands, Math.round(time), { imageWidth, imageHeight }));
      time += dt;
    }
  }
  return { version: 1, imageWidth, imageHeight, frames };
}
