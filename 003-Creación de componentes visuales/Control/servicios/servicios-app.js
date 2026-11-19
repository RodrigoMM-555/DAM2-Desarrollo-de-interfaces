/**
 * Servicios compartidos por toda la aplicación (un único lugar donde se
 * crean, para que las vistas no dependan de cómo se construyen).
 */
import { settings } from './ajustes.js';
import { progressStore } from './progreso.js';
import { ServicioAudio } from './audio.js';

export { settings, progressStore };

/** Sonido de la aplicación. */
export const audio = new ServicioAudio(settings);

/**
 * Tolerancia de reconocimiento (ajuste 0-1) → `sigma` del reconocedor.
 * 0 = exigente (0,065) · 0,5 = predeterminado (0,08) · 1 = permisivo (0,1).
 * @param {number} tolerance
 */
export function sigmaFromTolerance(tolerance) {
  return tolerance <= 0.5 ? 0.065 + tolerance * 0.03 : 0.08 + (tolerance - 0.5) * 0.04;
}

/**
 * Suavizado (ajuste 0-1) → parámetros del filtro One Euro.
 * Más suavizado = frecuencia de corte en reposo más baja.
 * @param {number} smoothing
 */
export function oneEuroFromSmoothing(smoothing) {
  return { minCutoff: 3 - smoothing * 2.4, beta: 6 };
}
