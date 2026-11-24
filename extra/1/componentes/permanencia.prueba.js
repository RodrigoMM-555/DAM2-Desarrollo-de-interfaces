// @ts-check
import { describe, expect, it } from '../pruebas/ejecutor.js';
import { Permanencia, aPantalla } from './permanencia.js';

describe('pulsar por permanencia', () => {
  it('se activa tras mantener la mano el tiempo indicado', () => {
    const p = new Permanencia(1);
    expect(p.actualizar('a', 0).progreso).toBe(0);
    expect(p.actualizar('a', 0.5).progreso).toBeCloseTo(0.5);
    expect(p.actualizar('a', 1).activado).toBe(true);
  });

  it('cambiar de objetivo reinicia el progreso', () => {
    const p = new Permanencia(1);
    p.actualizar('a', 0);
    p.actualizar('a', 0.8);
    expect(p.actualizar('b', 0.9).progreso).toBe(0);
    expect(p.actualizar('b', 1.5).activado).toBe(false);
  });

  it('se activa una sola vez: para repetir hay que salir y volver', () => {
    const p = new Permanencia(1);
    p.actualizar('a', 0);
    expect(p.actualizar('a', 1).activado).toBe(true);
    expect(p.actualizar('a', 3).activado).toBe(false);
    p.actualizar(null, 3.1);
    p.actualizar('a', 3.2);
    expect(p.actualizar('a', 4.2).activado).toBe(true);
  });

  it('sin objetivo no hay progreso', () => {
    expect(new Permanencia(1).actualizar(null, 5)).toEqual({ objetivo: null, progreso: 0, activado: false });
  });
});

describe('mano → pantalla', () => {
  it('la parte central de la imagen ocupa toda la pantalla', () => {
    expect(aPantalla({ x: 0.2, y: 0.15 }, 1000, 800)).toEqual({ x: 0, y: 0 });
    const esquina = aPantalla({ x: 0.8, y: 0.7 }, 1000, 800);
    expect(esquina.x).toBeCloseTo(1000);
    expect(esquina.y).toBeCloseTo(800);
    expect(aPantalla({ x: 0.5, y: 0.425 }, 1000, 800).x).toBeCloseTo(500);
  });

  it('fuera de la parte central se queda en el borde', () => {
    expect(aPantalla({ x: 0, y: 1 }, 1000, 800)).toEqual({ x: 0, y: 800 });
  });
});
