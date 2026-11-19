/**
 * glyphcraft-kit · API pública
 *
 * Importar este módulo registra todos los componentes:
 *
 * ```js
 * import 'glyphcraft-kit';
 * ```
 *
 * También se pueden importar las clases y registrar solo las necesarias:
 *
 * ```js
 * import { GcBotonRuna } from 'glyphcraft-kit';
 * GcBotonRuna.define();
 * ```
 *
 * Todo lo que no se exporta aquí es interno y puede cambiar sin aviso.
 *
 * @module glyphcraft-kit
 */
import { GcBotonRuna } from './componentes/boton-runa/boton-runa.js';
import { GcFondoArcano } from './componentes/fondo-arcano/fondo-arcano.js';
import { GcSusurro } from './componentes/susurro/susurro.js';
import { GcVistaCamara, CAMERA_ERROR_MESSAGES } from './componentes/vista-camara/vista-camara.js';
import { GcCapaMano } from './componentes/capa-mano/capa-mano.js';
import { GcIndicadorGesto, GESTURE_STATES } from './componentes/indicador-gesto/indicador-gesto.js';
import { GcLienzoGlifo } from './componentes/lienzo-glifo/lienzo-glifo.js';
import { GcGlifo } from './componentes/glifo/glifo.js';
import { GcMedidorArcano } from './componentes/medidor-arcano/medidor-arcano.js';
import { GcTarjetaGlifo, ELEMENT_LABELS } from './componentes/tarjeta-glifo/tarjeta-glifo.js';
import { GcInterruptorRuna } from './componentes/interruptor-runa/interruptor-runa.js';
import { GcDeslizadorRuna } from './componentes/deslizador-runa/deslizador-runa.js';

export {
  GcBotonRuna,
  GcFondoArcano,
  GcSusurro,
  GcVistaCamara,
  CAMERA_ERROR_MESSAGES,
  GcCapaMano,
  GcIndicadorGesto,
  GESTURE_STATES,
  GcLienzoGlifo,
  GcGlifo,
  GcMedidorArcano,
  GcTarjetaGlifo,
  ELEMENT_LABELS,
  GcInterruptorRuna,
  GcDeslizadorRuna,
};
export { ControladorBucle } from './controladores/controlador-bucle.js';
export { ControladorTamano } from './controladores/controlador-tamano.js';
export { ControladorMovimientoReducido } from './controladores/controlador-movimiento-reducido.js';
export { runeIcon, RUNE_NAMES } from './iconos/runas.js';

/** Registra todos los componentes de la biblioteca. Es idempotente. */
export function defineAll() {
  GcBotonRuna.define();
  GcFondoArcano.define();
  GcSusurro.define();
  GcVistaCamara.define();
  GcCapaMano.define();
  GcIndicadorGesto.define();
  GcLienzoGlifo.define();
  GcGlifo.define();
  GcMedidorArcano.define();
  GcTarjetaGlifo.define();
  GcInterruptorRuna.define();
  GcDeslizadorRuna.define();
}

defineAll();
