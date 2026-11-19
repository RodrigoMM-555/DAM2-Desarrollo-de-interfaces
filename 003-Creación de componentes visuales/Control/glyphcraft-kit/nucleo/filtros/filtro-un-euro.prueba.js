import { describe, expect, it } from '../../../pruebas/ejecutor.js';
import { FiltroUnEuro, FiltroPunto } from './filtro-un-euro.js';

/** Generador pseudoaleatorio reproducible (para que el test sea determinista). */
function seeded(seed = 42) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647 - 0.5;
  };
}

const std = (/** @type {number[]} */ v) => {
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
};

describe('FiltroUnEuro', () => {
  it('devuelve el primer valor sin cambios', () => {
    expect(new FiltroUnEuro().filter(0.42, 0)).toBe(0.42);
  });

  it('reduce el temblor de una mano quieta', () => {
    const filter = new FiltroUnEuro();
    const noise = seeded();
    const raw = [];
    const out = [];
    for (let i = 0; i < 120; i++) {
      const v = 0.5 + noise() * 0.01; // ±0,5 % de temblor
      raw.push(v);
      out.push(filter.filter(v, i / 30));
    }
    expect(std(out.slice(20))).toBeLessThan(std(raw.slice(20)) * 0.5);
  });

  it('sigue un movimiento rápido con poco retardo', () => {
    const filter = new FiltroUnEuro();
    let last = 0;
    for (let i = 0; i <= 30; i++) last = filter.filter(i / 30, i / 30); // 1 unidad/s
    expect(Math.abs(last - 1)).toBeLessThan(0.08);
  });

  it('reset() olvida el historial', () => {
    const filter = new FiltroUnEuro();
    filter.filter(0, 0);
    filter.filter(0, 0.1);
    filter.reset();
    expect(filter.filter(5, 0.2)).toBe(5);
  });

  it('ignora instantes repetidos o que retroceden', () => {
    const filter = new FiltroUnEuro();
    filter.filter(1, 1);
    expect(filter.filter(9, 1)).toBe(1);
    expect(filter.filter(9, 0.5)).toBe(1);
  });

  it('valida sus parámetros', () => {
    expect(() => new FiltroUnEuro({ minCutoff: 0 })).toThrow(RangeError);
    expect(() => new FiltroUnEuro({ beta: -1 })).toThrow(RangeError);
  });
});

describe('FiltroPunto', () => {
  it('filtra x e y por separado', () => {
    const filter = new FiltroPunto();
    expect(filter.filter({ x: 0.2, y: 0.8 }, 0)).toEqual({ x: 0.2, y: 0.8 });
    const next = filter.filter({ x: 0.3, y: 0.7 }, 1 / 30);
    expect(next.x).toBeGreaterThan(0.2);
    expect(next.x).toBeLessThan(0.3);
    expect(next.y).toBeLessThan(0.8);
  });
});
