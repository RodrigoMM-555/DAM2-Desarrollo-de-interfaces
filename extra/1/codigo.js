// @ts-check
/**
 * Punto de entrada: registra las vistas y arranca la aplicación.
 */
import { Aplicacion } from './nucleo/aplicacion.js';
import './vistas/vista-menu.js';
import './vistas/vista-canciones.js';
import './vistas/vista-partida.js';
import './vistas/vista-resultados.js';
import './vistas/vista-calibracion.js';
import './vistas/vista-ajustes.js';
import './vistas/vista-editor.js';

const raiz = document.getElementById('app');
if (!raiz) throw new Error('Falta el elemento #app en index.html');

const app = new Aplicacion(raiz);
app.iniciar();

// Acceso desde la consola del navegador para depurar.
/** @type {any} */ (window).tumbao = app;
