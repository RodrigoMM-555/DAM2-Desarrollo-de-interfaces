// @ts-check
import { describe, expect, it } from '../pruebas/ejecutor.js';
import { ZonaJuego } from './zona-juego.js';
import { SeguidorManos } from './seguidor-manos.js';
import { FiltroUnEuro } from './filtro-un-euro.js';

// Zona 0,1–0,9 de ancho (cada carril mide 0,2) y 0,2–0,8 de alto.
const ZONA = { izquierda: 0.1, derecha: 0.9, arriba: 0.2, abajo: 0.8 };
const p = (/** @type {number} */ x, y = 0.5) => ({ x, y });

describe('zona de juego', () => {
  it('cada columna es un carril', () => {
    const zona = new ZonaJuego(ZONA);
    expect([0.15, 0.35, 0.55, 0.85].map((x) => new ZonaJuego(ZONA).carril('i', p(x)))).toEqual([0, 1, 2, 3]);
    expect(zona.carril('i', null)).toBe(null);
  });

  it('por debajo o por encima de la zona la mano no cuenta (reposo)', () => {
    const zona = new ZonaJuego(ZONA);
    expect(zona.carril('i', p(0.3, 0.9))).toBe(null);
    expect(zona.carril('i', p(0.3, 0.1))).toBe(null);
  });

  it('un poco por fuera de los lados cuenta en el carril del borde', () => {
    const zona = new ZonaJuego(ZONA);
    expect(zona.carril('i', p(0.05))).toBe(0);
    expect(zona.carril('d', p(0.95))).toBe(3);
    expect(new ZonaJuego(ZONA).carril('d', p(0.999))).toBe(null); // margen: 0,12 × 0,8 = 0,096
  });

  it('histéresis: en la frontera no cambia hasta entrar en el carril nuevo', () => {
    const zona = new ZonaJuego(ZONA, 0.15); // 0,15 de carril = 0,03 de imagen
    expect(zona.carril('i', p(0.28))).toBe(0);
    expect(zona.carril('i', p(0.31))).toBe(0); // ya en el carril 1, pero poco
    expect(zona.carril('i', p(0.34))).toBe(1); // ahora sí
    expect(zona.carril('i', p(0.29))).toBe(1); // volver un poco no basta
    expect(zona.carril('i', p(0.26))).toBe(0);
  });

  it('cada mano tiene su propia histéresis', () => {
    const zona = new ZonaJuego(ZONA);
    zona.carril('i', p(0.25));
    expect(zona.carril('d', p(0.31))).toBe(1);
  });

  it('posición relativa: 0 en el borde izquierdo, 1 en el derecho, y si cuenta', () => {
    const zona = new ZonaJuego(ZONA);
    expect(zona.posicionRelativa(p(0.1))).toEqual({ u: 0, dentro: true });
    expect(zona.posicionRelativa(p(0.5))?.u).toBeCloseTo(0.5);
    expect(zona.posicionRelativa(p(0.5, 0.9))?.dentro).toBe(false); // demasiado baja
    expect(zona.posicionRelativa(null)).toBe(null);
  });

  it('posición relativa no altera la histéresis de las manos', () => {
    const zona = new ZonaJuego(ZONA);
    zona.carril('i', p(0.28));
    zona.posicionRelativa(p(0.85));
    expect(zona.carril('i', p(0.31))).toBe(0);
  });

  it('rechaza zonas fuera de la imagen o demasiado pequeñas', () => {
    expect(() => new ZonaJuego({ izquierda: 0.4, derecha: 0.5, arriba: 0.2, abajo: 0.8 })).toThrow();
    expect(() => new ZonaJuego({ izquierda: -0.1, derecha: 0.9, arriba: 0.2, abajo: 0.8 })).toThrow();
  });
});

describe('seguidor de manos', () => {
  const izq = (/** @type {number} */ x, confianza = 0.9, y = 0.5) => ({ x, y, etiqueta: /** @type {const} */ ('i'), confianza });
  const der = (/** @type {number} */ x, confianza = 0.9, y = 0.5) => ({ x, y, etiqueta: /** @type {const} */ ('d'), confianza });
  const fps = 1 / 30;

  it('sin manos no hay nada', () => {
    expect(new SeguidorManos().actualizar(0, [])).toEqual({ i: null, d: null });
  });

  it('dos manos bien etiquetadas', () => {
    const r = new SeguidorManos().actualizar(0, [der(0.7), izq(0.3)]);
    expect(r.i?.x).toBe(0.3);
    expect(r.d?.x).toBe(0.7);
  });

  it('un fotograma con las etiquetas al revés no cambia la identidad', () => {
    const s = new SeguidorManos();
    for (let k = 0; k < 15; k++) s.actualizar(k * fps, [izq(0.3), der(0.7)]);
    const r = s.actualizar(16 * fps, [der(0.31), izq(0.69)]); // MediaPipe se equivoca
    expect(r.i?.x).toBe(0.31);
    expect(r.d?.x).toBe(0.69);
  });

  it('si cambia el orden de las detecciones, se empareja por posición', () => {
    const s = new SeguidorManos();
    s.actualizar(0, [izq(0.3), der(0.7)]);
    const r = s.actualizar(fps, [der(0.72), izq(0.32)]);
    expect(r).toEqual({ i: { x: 0.32, y: 0.5 }, d: { x: 0.72, y: 0.5 } });
  });

  it('con los brazos cruzados conserva quién es quién', () => {
    const s = new SeguidorManos();
    for (let k = 0; k < 15; k++) s.actualizar(k * fps, [izq(0.3), der(0.7)]);
    // Las manos se cruzan poco a poco (una por encima de la otra, como al
    // cruzar los brazos) y MediaPipe además se confunde a mitad.
    let r = { i: /** @type {any} */ (null), d: /** @type {any} */ (null) };
    for (let k = 1; k <= 8; k++) {
      const xi = 0.3 + k * 0.05;
      const xd = 0.7 - k * 0.05;
      const confundido = k > 3 && k < 6;
      r = s.actualizar((15 + k) * fps, confundido ? [der(xi, 0.6, 0.4), izq(xd, 0.6, 0.6)] : [izq(xi, 0.9, 0.4), der(xd, 0.9, 0.6)]);
    }
    expect(r.i.x).toBeCloseTo(0.7);
    expect(r.d.x).toBeCloseTo(0.3);
  });

  it('si las dos manos dicen lo mismo, gana la de voto más alto', () => {
    const s = new SeguidorManos();
    for (let k = 0; k < 15; k++) s.actualizar(k * fps, [izq(0.3), der(0.7)]);
    const r = s.actualizar(16 * fps, [izq(0.3, 0.5), izq(0.7, 0.5)]);
    expect(r.i?.x).toBe(0.3);
    expect(r.d?.x).toBe(0.7);
  });

  it('una mano que desaparece un instante se conserva en su sitio', () => {
    const s = new SeguidorManos({ memoria: 0.2 });
    s.actualizar(0, [izq(0.3), der(0.7)]);
    const r = s.actualizar(0.1, [izq(0.31)]);
    expect(r.d?.x).toBe(0.7);
  });

  it('pasado el tiempo de memoria, la mano desaparece', () => {
    const s = new SeguidorManos({ memoria: 0.2 });
    s.actualizar(0, [izq(0.3), der(0.7)]);
    const r = s.actualizar(0.3, [izq(0.31)]);
    expect(r.d).toBe(null);
    expect(s.cantidad).toBe(1);
  });

  it('una sola mano: su etiqueta decide', () => {
    expect(new SeguidorManos().actualizar(0, [der(0.4)]).d?.x).toBe(0.4);
  });

  it('una sola mano con etiqueta dudosa: decide la posición', () => {
    const r = new SeguidorManos().actualizar(0, [der(0.2, 0.2)]);
    expect(r.i?.x).toBe(0.2);
  });
});

describe('filtro One Euro', () => {
  it('el primer valor pasa tal cual', () => {
    expect(new FiltroUnEuro().filtrar(5, 0)).toBe(5);
  });

  it('suaviza el temblor con la mano quieta', () => {
    const f = new FiltroUnEuro();
    let ultimo = 0;
    for (let k = 0; k < 60; k++) ultimo = f.filtrar(0.5 + (k % 2 ? 0.01 : -0.01), k / 30);
    expect(Math.abs(ultimo - 0.5)).toBeLessThan(0.005);
  });

  it('casi no retrasa un movimiento rápido', () => {
    const f = new FiltroUnEuro();
    let ultimo = 0;
    for (let k = 0; k <= 10; k++) ultimo = f.filtrar(k * 0.05, k / 30); // 1,5 imágenes por segundo
    expect(ultimo).toBeGreaterThan(0.4);
  });
});
