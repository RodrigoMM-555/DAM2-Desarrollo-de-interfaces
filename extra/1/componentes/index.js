// @ts-check
/**
 * tumbao-componentes: punto de entrada del paquete.
 *
 * Importarlo registra los tres componentes (`<tb-pista>`, `<tb-camara>`,
 * `<tb-cursor-mano>`) y exporta sus clases y la lógica de permanencia.
 *
 *   import 'tumbao-componentes';                       // solo registrar
 *   import { TbPista } from 'tumbao-componentes';      // usar la clase
 */
export { TbPista, dibujarMano } from './tb-pista.js';
export { TbCamara } from './tb-camara.js';
export { TbCursorMano } from './tb-cursor-mano.js';
export { Permanencia, aPantalla } from './permanencia.js';

/** Versión del paquete (igual que en package.json). */
export const VERSION = '1.0.0';
