// @ts-check
/**
 * Pruebas unitarias de los Web Components (necesitan navegador: pruebas.html).
 * Cada componente se monta en el DOM y se comprueba su API pública:
 * valores por defecto, atributos ↔ propiedades, dibujo y eventos.
 */
import { afterEach, describe, expect, it } from '../pruebas/ejecutor.js';
import './index.js';

/** @template {HTMLElement} T @param {string} etiqueta @param {string} [estilo] @returns {T} */
function montar(etiqueta, estilo = 'width:400px;height:300px;display:block') {
  const el = /** @type {T} */ (document.createElement(etiqueta));
  el.setAttribute('style', estilo);
  document.body.append(el);
  return el;
}

/** Alfa del píxel (x, y) del canvas interno (en píxeles CSS). */
function alfa(/** @type {HTMLElement} */ el, /** @type {number} */ x, /** @type {number} */ y) {
  const lienzo = /** @type {HTMLCanvasElement} */ (el.shadowRoot?.querySelector('canvas'));
  const escala = lienzo.width / el.clientWidth;
  return lienzo.getContext('2d')?.getImageData(Math.round(x * escala), Math.round(y * escala), 1, 1).data[3] ?? 0;
}

const espera = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));

afterEach(() => document.body.replaceChildren());

describe('<tb-pista>', () => {
  it('está registrado', () => {
    expect(customElements.get('tb-pista')).toBeDefined();
  });

  it('valores por defecto', () => {
    const p = /** @type {any} */ (montar('tb-pista'));
    expect([p.antelacion, p.transparente, p.notas, p.pulso, p.geometria]).toEqual([2, false, [], 0, null]);
  });

  it('atributo y propiedad antelacion van sincronizados; un valor no válido vuelve al de defecto', () => {
    const p = /** @type {any} */ (montar('tb-pista'));
    p.setAttribute('antelacion', '3');
    expect(p.antelacion).toBe(3);
    p.antelacion = 1.5;
    expect(p.getAttribute('antelacion')).toBe('1.5');
    p.setAttribute('antelacion', 'rápido');
    expect(p.antelacion).toBe(2);
  });

  it('transparente es un atributo booleano reflejado', () => {
    const p = /** @type {any} */ (montar('tb-pista'));
    p.transparente = true;
    expect(p.hasAttribute('transparente')).toBe(true);
    p.removeAttribute('transparente');
    expect(p.transparente).toBe(false);
  });

  it('dibuja una nota en su carril al llegar a la línea', async () => {
    const p = /** @type {any} */ (montar('tb-pista'));
    await espera(30); // el ResizeObserver ajusta el lienzo
    p.notas = [{ id: 0, tiempo: 1, mano: 'i', carril: 0, duracion: 0, pulso: 0 }];
    p.dibujar(1, { i: null, d: null });
    // Geometría por defecto: pista centrada de ancho 0,8 × alto = 240 px; línea al 84 %.
    const x0 = (400 - 240) / 2;
    expect(alfa(p, x0 + 30, 300 * 0.84)).toBeGreaterThan(0);
  });

  it('con geometría, los carriles se colocan donde se indica', async () => {
    const p = /** @type {any} */ (montar('tb-pista'));
    await espera(30);
    p.geometria = { x0: 0, ancho: 200, yLinea: 100 };
    p.notas = [{ id: 0, tiempo: 1, mano: 'd', carril: 3, duracion: 0, pulso: 0 }];
    p.dibujar(1, { i: null, d: null });
    expect(alfa(p, 175, 100)).toBeGreaterThan(0); // centro del carril 3 = 175 px
  });

  it('marcar() emite «marcada» con el juicio', () => {
    const p = /** @type {any} */ (montar('tb-pista'));
    /** @type {any[]} */
    const recibidos = [];
    p.addEventListener('marcada', (/** @type {CustomEvent} */ e) => recibidos.push(e.detail.juicio.calificacion));
    p.marcar({ nota: { id: 0, tiempo: 0, mano: 'i', carril: 0, duracion: 0 }, tipo: 'cabeza', calificacion: 'bien', tiempo: 0, entrada: 0 });
    expect(recibidos).toEqual(['bien']);
  });
});

describe('<tb-camara>', () => {
  const zona = { izquierda: 0.1, derecha: 0.9, arriba: 0.1, abajo: 0.8 };
  const detalleCon = (/** @type {any} */ esqueleto) => ({
    posiciones: { i: null, d: null },
    carriles: { i: null, d: null },
    esqueletos: { i: esqueleto, d: null },
  });
  // Una "mano" de 21 puntos en línea horizontal a media altura.
  const linea = Array.from({ length: 21 }, (_, k) => ({ x: 0.2 + k * 0.03, y: 0.5 }));

  it('valores por defecto y vídeo interno', () => {
    const c = /** @type {any} */ (montar('tb-camara'));
    expect([c.esqueleto, c.sinRejilla]).toEqual([false, false]);
    expect(c.video instanceof HTMLVideoElement).toBe(true);
  });

  it('esqueleto y sin-rejilla se reflejan en atributos', () => {
    const c = /** @type {any} */ (montar('tb-camara'));
    c.esqueleto = true;
    c.sinRejilla = true;
    expect([c.hasAttribute('esqueleto'), c.hasAttribute('sin-rejilla')]).toEqual([true, true]);
  });

  it('con «esqueleto» dibuja la mano virtual; sin él, no', () => {
    const c = /** @type {any} */ (montar('tb-camara', 'width:400px;display:block'));
    c.sinRejilla = true;
    c.dibujar(detalleCon(linea), zona);
    const y = c.clientHeight * 0.5;
    expect(alfa(c, 400 * 0.23, y)).toBe(0);
    c.esqueleto = true;
    c.dibujar(detalleCon(linea), zona);
    // El hueso 0→1 va de x = 0,20 a 0,23 a media altura.
    expect(alfa(c, 400 * 0.215, y)).toBeGreaterThan(0);
  });

  it('la rejilla oscurece fuera de la zona de juego', () => {
    const c = /** @type {any} */ (montar('tb-camara', 'width:400px;display:block'));
    c.dibujar(detalleCon(null), zona);
    expect(alfa(c, 5, 5)).toBeGreaterThan(0); // esquina, fuera de la zona
  });
});

describe('<tb-cursor-mano>', () => {
  const preparar = () => {
    const cursor = /** @type {any} */ (montar('tb-cursor-mano', ''));
    const raiz = document.createElement('div');
    raiz.innerHTML = '<button style="position:fixed;left:50px;top:50px;width:120px;height:50px">Dentro</button>';
    const fuera = document.createElement('button');
    fuera.textContent = 'Fuera';
    fuera.setAttribute('style', 'position:fixed;left:250px;top:50px;width:120px;height:50px');
    document.body.append(raiz, fuera);
    cursor.raiz = raiz;
    return { cursor, dentro: /** @type {HTMLButtonElement} */ (raiz.querySelector('button')), fuera };
  };
  /** Mantiene la "mano" en un punto durante `ms`. */
  const mantener = async (/** @type {any} */ cursor, /** @type {any} */ punto, /** @type {number} */ ms) => {
    for (let t = 0; t <= ms; t += 20) {
      cursor.mover(punto);
      await espera(20);
    }
  };

  it('duracion: 1 s por defecto, configurable por atributo', () => {
    const { cursor } = preparar();
    expect(cursor.duracion).toBe(1);
    cursor.setAttribute('duracion', '0.2');
    expect(cursor.duracion).toBe(0.2);
  });

  it('pulsa el botón tras mantener la mano encima y emite «pulsado»', async () => {
    const { cursor, dentro } = preparar();
    cursor.duracion = 0.15;
    let clics = 0;
    /** @type {string[]} */
    const eventos = [];
    dentro.addEventListener('click', () => clics++);
    cursor.addEventListener('pulsado', (/** @type {CustomEvent} */ e) => eventos.push(e.detail.elemento.textContent));
    await mantener(cursor, { x: 100, y: 70 }, 260);
    expect(clics).toBe(1);
    expect(eventos).toEqual(['Dentro']);
  });

  it('no pulsa botones fuera de su raíz', async () => {
    const { cursor, fuera } = preparar();
    cursor.duracion = 0.1;
    let clics = 0;
    fuera.addEventListener('click', () => clics++);
    await mantener(cursor, { x: 300, y: 70 }, 200);
    expect(clics).toBe(0);
  });

  it('marca el botón apuntado y lo desmarca al quitar la mano', () => {
    const { cursor, dentro } = preparar();
    cursor.mover({ x: 100, y: 70 });
    expect(dentro.classList.contains('apuntado-mano')).toBe(true);
    cursor.mover(null);
    expect(dentro.classList.contains('apuntado-mano')).toBe(false);
  });
});
