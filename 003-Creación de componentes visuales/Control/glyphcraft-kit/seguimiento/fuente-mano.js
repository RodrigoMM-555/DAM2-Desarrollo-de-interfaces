/**
 * Contrato común de las fuentes de manos.
 *
 * Cualquier objeto que cumpla esta interfaz puede alimentar al
 * `MotorGestos`: la cámara real (`FuenteManoMediaPipe`), una sesión
 * grabada (`FuenteManoGrabada`) o un simulador en las pruebas. El resto de la
 * aplicación no sabe de dónde vienen las manos.
 *
 * Se documenta como interfaz (no como clase base) porque las
 * implementaciones no comparten código: solo forma.
 *
 * @typedef {object} HandSource
 * @property {HandSourceStatus} status Estado actual.
 * @property {HandSourceStats} stats Rendimiento medido.
 * @property {(target?: HTMLVideoElement) => Promise<void>} start Empieza a emitir fotogramas.
 * @property {() => void} stop Deja de emitir fotogramas.
 * @property {EventTarget['addEventListener']} addEventListener
 *   - `frame` → `CustomEvent<HandFrame>`
 *   - `status` → `CustomEvent<{ status: HandSourceStatus, error?: Error }>`
 * @property {EventTarget['removeEventListener']} removeEventListener
 */

/** @typedef {'idle' | 'loading' | 'ready' | 'running' | 'stopped' | 'error'} HandSourceStatus */

/**
 * @typedef {object} HandSourceStats
 * @property {number} fps Fotogramas analizados por segundo.
 * @property {number} inferenceMs Tiempo medio de análisis por fotograma.
 * @property {'GPU' | 'CPU' | 'replay' | null} backend Dónde se ejecuta el modelo.
 */

/** @typedef {import('../nucleo/gestos/motor-gestos.js').HandFrame} HandFrame */

/**
 * Media móvil exponencial para estadísticas estables.
 * @param {number} previous
 * @param {number} value
 * @param {number} [weight=0.1]
 */
export function smoothStat(previous, value, weight = 0.1) {
  return previous === 0 ? value : previous + (value - previous) * weight;
}

export {};
