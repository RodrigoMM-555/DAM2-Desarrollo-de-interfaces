// @ts-check
import { describe, expect, it } from '../pruebas/ejecutor.js';
import { interpretarOrden, normalizar } from './voz.js';
import { DetectorManosArriba } from './gestos.js';

describe('órdenes de voz', () => {
  it.each([
    ['pausa', 'pausa'],
    ['Para', 'pausa'],
    ['continúa', 'continuar'],
    ['vale sigue', 'continuar'],
    ['¡Empezar!', 'empezar'],
    ['otra vez', 'reiniciar'],
    ['volver al menú', 'menu'],
    ['quiero salir', 'salir'],
  ])('«%s» → %s', (texto, orden) => {
    expect(interpretarOrden(texto)).toBe(orden);
  });

  it('sin tildes ni mayúsculas', () => {
    expect(normalizar('Menú CANCIÓN')).toBe('menu cancion');
  });

  it('palabras enteras: «parada» no es «para»', () => {
    expect(interpretarOrden('parada de autobús')).toBe(null);
  });

  it('si hay varias, gana la primera que se dice', () => {
    expect(interpretarOrden('para no mejor sigue')).toBe('pausa');
  });

  it('solo las órdenes permitidas en la pantalla actual', () => {
    expect(interpretarOrden('pausa', ['empezar', 'salir'])).toBe(null);
    expect(interpretarOrden('vamos', ['empezar', 'salir'])).toBe('empezar');
  });

  it('frases sin orden → null', () => {
    expect(interpretarOrden('qué bonita canción')).toBe(null);
  });
});

describe('gesto: levantar las dos manos', () => {
  const ARRIBA = 0.2;
  const alto = { x: 0.3, y: 0.05 };
  const alto2 = { x: 0.7, y: 0.08 };
  const medio = { x: 0.5, y: 0.5 };

  it('se activa tras mantener las dos manos arriba', () => {
    const g = new DetectorManosArriba({ duracion: 0.6 });
    expect(g.actualizar(0, { i: alto, d: alto2 }, ARRIBA).activado).toBe(false);
    expect(g.actualizar(0.3, { i: alto, d: alto2 }, ARRIBA).progreso).toBeCloseTo(0.5);
    expect(g.actualizar(0.6, { i: alto, d: alto2 }, ARRIBA).activado).toBe(true);
  });

  it('con una sola mano arriba no cuenta', () => {
    const g = new DetectorManosArriba({ duracion: 0.6 });
    g.actualizar(0, { i: alto, d: medio }, ARRIBA);
    expect(g.actualizar(1, { i: alto, d: medio }, ARRIBA).activado).toBe(false);
  });

  it('justo en el borde de la zona no cuenta (hay margen)', () => {
    const g = new DetectorManosArriba({ duracion: 0.1, margen: 0.03 });
    const borde = { x: 0.3, y: 0.19 };
    g.actualizar(0, { i: borde, d: { x: 0.7, y: 0.19 } }, ARRIBA);
    expect(g.actualizar(1, { i: borde, d: { x: 0.7, y: 0.19 } }, ARRIBA).activado).toBe(false);
  });

  it('se activa una vez: hay que bajar las manos para repetir', () => {
    const g = new DetectorManosArriba({ duracion: 0.1 });
    g.actualizar(0, { i: alto, d: alto2 }, ARRIBA);
    expect(g.actualizar(0.2, { i: alto, d: alto2 }, ARRIBA).activado).toBe(true);
    expect(g.actualizar(1, { i: alto, d: alto2 }, ARRIBA).activado).toBe(false);
    g.actualizar(1.1, { i: medio, d: medio }, ARRIBA);
    g.actualizar(1.2, { i: alto, d: alto2 }, ARRIBA);
    expect(g.actualizar(1.4, { i: alto, d: alto2 }, ARRIBA).activado).toBe(true);
  });
});
