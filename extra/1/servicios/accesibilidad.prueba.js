// @ts-check
/**
 * Pruebas de accesibilidad (RA4 i):
 * 1. Contraste WCAG de los colores reales de `estilo.css`.
 * 2. Estructura accesible de cada pantalla real de la aplicación.
 */
import { describe, expect, it } from '../pruebas/ejecutor.js';
import { MINIMO_COMPONENTE, MINIMO_TEXTO, contraste, variablesDeColor } from './contraste.js';

describe('contraste WCAG (fórmula)', () => {
  it('blanco sobre negro es 21:1 y un color consigo mismo 1:1', () => {
    expect(contraste('#ffffff', '#000000')).toBeCloseTo(21);
    expect(contraste('#4da3ff', '#4da3ff')).toBeCloseTo(1);
  });

  it('el orden de los colores no importa', () => {
    expect(contraste('#150f26', '#f7efe3')).toBeCloseTo(contraste('#f7efe3', '#150f26'));
  });
});

// Se lee el CSS real antes de declarar las pruebas (await en el módulo).
const css = await (await fetch(new URL('../estilo.css', import.meta.url))).text();
const c = variablesDeColor(css);

describe('contraste de los colores de estilo.css', () => {
  /** [primer plano, fondo, mínimo, para qué] */
  const pares = /** @type {[string, string, number, string][]} */ ([
    ['color-texto', 'color-fondo', MINIMO_TEXTO, 'texto general'],
    ['color-texto', 'color-superficie', MINIMO_TEXTO, 'texto en tarjetas y diálogos'],
    ['color-texto-suave', 'color-superficie', MINIMO_TEXTO, 'notas y ayudas'],
    ['color-texto-suave', 'color-superficie-2', MINIMO_TEXTO, 'notas sobre botones'],
    ['color-izquierda', 'color-fondo', MINIMO_TEXTO, 'texto azul (mano izquierda)'],
    ['color-derecha', 'color-fondo', MINIMO_TEXTO, 'texto naranja (mano derecha)'],
    ['color-fondo', 'color-izquierda', MINIMO_TEXTO, 'letra I sobre la mano / botón principal'],
    ['color-fondo', 'color-derecha', MINIMO_TEXTO, 'letra D sobre la mano / botón principal'],
    ['color-acento', 'color-superficie', MINIMO_TEXTO, 'enlaces y récords'],
    ['color-error', 'color-superficie', MINIMO_TEXTO, 'mensajes de error'],
    ['color-borde-control', 'color-superficie', MINIMO_COMPONENTE, 'borde de botones (1.4.11)'],
    ['color-borde-control', 'color-superficie-2', MINIMO_COMPONENTE, 'borde de controles sobre botón (1.4.11)'],
    ['color-acento', 'color-fondo', MINIMO_COMPONENTE, 'contorno de foco (1.4.11)'],
  ]);

  it.each(pares)('%s sobre %s ≥ %s:1 (%s)', (primero, fondo, minimo) => {
    expect(c[primero]).toBeDefined();
    expect(c[fondo]).toBeDefined();
    expect(contraste(c[primero], c[fondo])).toBeGreaterThanOrEqual(minimo);
  });
});

// Solo en el navegador: se monta la aplicación real y se recorren sus rutas.
if (typeof document !== 'undefined') await probarPantallas();

async function probarPantallas() {
  const { Aplicacion } = await import('../nucleo/aplicacion.js');
  await Promise.all(
    ['menu', 'canciones', 'partida', 'resultados', 'calibracion', 'ajustes', 'editor'].map((v) => import(`../vistas/vista-${v}.js`)),
  );
  const raiz = document.createElement('main');
  document.body.append(raiz);
  const app = new Aplicacion(raiz);
  const cancion = await app.cancion('primer-tumbao');
  app.ultimoResultado = {
    cancion,
    dificultad: 'facil',
    nuevoRecord: true,
    resumen: { puntos: 1000, combo: 0, comboMaximo: 5, multiplicador: 1, precision: 0.9, nota: 'A', cuenta: { perfecto: 3, bien: 1, justo: 0, fallo: 1 }, juzgadas: 5 },
  };
  app.iniciar();

  /** Nombre accesible aproximado de un elemento. @param {Element} el */
  const nombre = (el) =>
    (el.getAttribute('aria-label') ?? el.textContent ?? '').trim() ||
    (el.getAttribute('aria-labelledby') ? document.getElementById(/** @type {string} */ (el.getAttribute('aria-labelledby')))?.textContent?.trim() : '');

  const rutas = ['/', '/canciones', '/partida/primer-tumbao/facil', '/resultados', '/calibracion', '/ajustes', '/editor'];
  describe('estructura accesible de cada pantalla', () => {
    for (const ruta of rutas) {
      it(`${ruta}: un único h1 y títulos sin saltos de nivel`, async () => {
        app.ir(ruta);
        await new Promise((r) => setTimeout(r, 250)); // carga de canciones, etc.
        expect(raiz.querySelectorAll('h1').length).toBe(1);
        let anterior = 1;
        for (const h of raiz.querySelectorAll('h1, h2, h3, h4')) {
          const nivel = Number(h.tagName[1]);
          expect(nivel - anterior).toBeLessThanOrEqual(1);
          anterior = nivel;
        }
      });

      it(`${ruta}: botones y enlaces con nombre, campos con etiqueta, sin tabindex positivo`, () => {
        for (const el of raiz.querySelectorAll('button, a[href]')) {
          expect(nombre(el)).not.toBe('');
        }
        for (const campo of raiz.querySelectorAll('input, select, textarea')) {
          const etiquetado =
            !!campo.closest('label') || campo.hasAttribute('aria-label') || campo.hasAttribute('aria-labelledby') ||
            (!!campo.id && !!raiz.querySelector(`label[for="${campo.id}"]`));
          expect(etiquetado).toBe(true);
        }
        for (const el of raiz.querySelectorAll('[tabindex]')) {
          expect(Number(el.getAttribute('tabindex'))).toBeLessThanOrEqual(0);
        }
      });
    }

    it('al terminar, se apaga lo que haya encendido la última pantalla', () => {
      app.ir('/');
      expect(app.camara.situacion).not.toBe('activa');
    });
  });
}
