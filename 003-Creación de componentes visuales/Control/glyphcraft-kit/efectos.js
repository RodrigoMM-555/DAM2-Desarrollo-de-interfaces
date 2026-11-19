/**
 * glyphcraft-kit/efectos · Efectos mágicos en 3D (Three.js).
 *
 * Es un punto de entrada aparte porque depende de `three` (peerDependency):
 * quien no lo importe no descarga Three.js. Importarlo registra
 * `<gc-spell-stage>`.
 *
 * ```js
 * import 'glyphcraft-kit/efectos';
 * stage.cast('fire', { x: 0.5, y: 0.5, radius: 0.4, intensity: 0.9 });
 * ```
 *
 * @module glyphcraft-kit/efectos
 */
import { GcEscenarioHechizo } from './componentes/escenario-hechizo/escenario-hechizo.js';

export { GcEscenarioHechizo };
export { registerSpell, getSpell, spellIds } from './efectos/registro.js';
export { SistemaParticulas } from './efectos/particulas.js';
export { Efecto, rand, inDisk, onSphere, amount, particles } from './efectos/efecto.js';
export { ringMaterial, shellMaterial, rayMaterial, iceMaterial } from './efectos/materiales.js';
export { ACTIVATION_BURST } from './efectos/hechizos/activacion.js';

GcEscenarioHechizo.define();
