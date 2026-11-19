/**
 * Punto de entrada de la aplicación.
 *
 * Importa la biblioteca SOLO por sus puntos de entrada públicos
 * (`glyphcraft-kit`, `glyphcraft-kit/nucleo`…): la app es una consumidora más
 * de su API.
 */
// Las hojas de estilo (fuentes, tokens y estilo de la app) se cargan con
// <link> en index.html: sin compilación, un módulo JS no puede importar CSS.

import 'glyphcraft-kit';
import { glyphLibrary } from 'glyphcraft-kit/nucleo';
import { STARTER_GLYPHS } from 'glyphcraft-kit/glifos';

import { Aplicacion } from './nucleo/aplicacion.js';
import { VistaMenu } from './vistas/menu/vista-menu.js';
import { EstacionLanzamiento } from './vistas/practica/estacion-lanzamiento.js';
import { VistaPractica } from './vistas/practica/vista-practica.js';
import { VistaGrimorio } from './vistas/grimorio/vista-grimorio.js';
import { VistaPracticaGlifo } from './vistas/grimorio/vista-practica-glifo.js';
import { VistaLaboratorio } from './vistas/laboratorio/vista-laboratorio.js';
import { VistaProgreso } from './vistas/progreso/vista-progreso.js';
import { VistaAjustes } from './vistas/ajustes/vista-ajustes.js';

// El catálogo de glifos (datos) se registra antes de crear ninguna vista.
glyphLibrary.add(...STARTER_GLYPHS);

customElements.define('gc-casting-station', EstacionLanzamiento);
customElements.define('gc-view-menu', VistaMenu);
customElements.define('gc-view-practice', VistaPractica);
customElements.define('gc-view-grimoire', VistaGrimorio);
customElements.define('gc-view-glyph-practice', VistaPracticaGlifo);
customElements.define('gc-view-lab', VistaLaboratorio);
customElements.define('gc-view-progress', VistaProgreso);
customElements.define('gc-view-settings', VistaAjustes);
customElements.define('gc-app', Aplicacion);
