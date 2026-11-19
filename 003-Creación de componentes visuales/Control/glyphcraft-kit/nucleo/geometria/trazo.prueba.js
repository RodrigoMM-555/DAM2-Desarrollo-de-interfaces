import { describe, expect, it } from '../../../pruebas/ejecutor.js';
import {
  pathLength,
  resample,
  boundingBox,
  fitCircle,
  angularCoverage,
  signedArea,
  chamfer,
  directedChamfer,
  pointwiseDistance,
} from './trazo.js';

const circle = (cx = 0, cy = 0, r = 1, n = 60, turns = 1) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / (n - 1)) * Math.PI * 2 * turns;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });

describe('pathLength y resample', () => {
  it('mide polilíneas', () => {
    expect(pathLength([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 0 }])).toBe(9);
  });

  it('remuestrea en puntos equidistantes conservando extremos', () => {
    const line = [{ x: 0, y: 0 }, { x: 0.1, y: 0 }, { x: 1, y: 0 }];
    const out = resample(line, 11);
    expect(out).toHaveLength(11);
    out.forEach((p, i) => expect(p.x).toBeCloseTo(i / 10, 6));
  });

  it('casos límite: vacío, un punto, longitud cero', () => {
    expect(resample([], 5)).toEqual([]);
    expect(resample([{ x: 1, y: 2 }], 3)).toEqual([{ x: 1, y: 2 }, { x: 1, y: 2 }, { x: 1, y: 2 }]);
    expect(resample([{ x: 1, y: 1 }, { x: 1, y: 1 }], 4)).toHaveLength(4);
  });

  it('boundingBox', () => {
    expect(boundingBox([{ x: 1, y: 5 }, { x: -2, y: 3 }])).toMatchObject({ minX: -2, maxX: 1, width: 3, height: 2 });
  });
});

describe('fitCircle', () => {
  it('recupera centro y radio de un círculo perfecto', () => {
    const fit = /** @type {import('./trazo.js').CircleFit} */ (fitCircle(circle(0.4, 0.6, 0.25)));
    expect(fit.cx).toBeCloseTo(0.4, 6);
    expect(fit.cy).toBeCloseTo(0.6, 6);
    expect(fit.r).toBeCloseTo(0.25, 6);
    expect(fit.residual).toBeLessThan(1e-6);
  });

  it('funciona con un arco parcial', () => {
    const fit = /** @type {import('./trazo.js').CircleFit} */ (fitCircle(circle(0, 0, 2, 30, 0.5)));
    expect(fit.r).toBeCloseTo(2, 4);
  });

  it('un cuadrado tiene más residuo que un círculo', () => {
    const square = resample([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 0 }], 64);
    expect(/** @type {any} */ (fitCircle(square)).residual).toBeGreaterThan(0.05);
  });

  it('devuelve null con puntos alineados o insuficientes', () => {
    expect(fitCircle([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBeNull();
    expect(fitCircle([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }])).toBeNull();
  });
});

describe('cobertura, área y distancias', () => {
  it('angularCoverage distingue círculo completo de medio círculo', () => {
    expect(angularCoverage(circle(), 0, 0)).toBeCloseTo(1, 1);
    expect(angularCoverage(circle(0, 0, 1, 60, 0.5), 0, 0)).toBeCloseTo(0.5, 1);
  });

  it('signedArea indica el sentido de giro (y hacia abajo: + = horario)', () => {
    const cw = circle();
    expect(signedArea(cw)).toBeGreaterThan(0);
    expect(signedArea([...cw].reverse())).toBeLessThan(0);
    expect(Math.abs(signedArea(cw))).toBeCloseTo(Math.PI, 1);
  });

  it('chamfer es 0 para formas iguales y no depende del orden', () => {
    const a = circle();
    expect(chamfer(a, [...a].reverse())).toBeCloseTo(0, 6);
    const shifted = a.map((p) => ({ x: p.x + 0.1, y: p.y }));
    expect(chamfer(a, shifted)).toBeGreaterThan(0.03);
  });

  it('directedChamfer detecta lo que falta en una sola dirección', () => {
    const full = circle(0, 0, 1, 721); // muestreo denso: medio grado entre puntos
    const half = circle(0, 0, 1, 30, 0.5);
    expect(directedChamfer(half, full)).toBeLessThan(0.01); // todo lo de half está en full
    expect(directedChamfer(full, half)).toBeGreaterThan(0.3); // falta media vuelta
    expect(directedChamfer([], full)).toBe(Infinity);
  });

  it('pointwiseDistance es sensible al sentido', () => {
    const line = resample([{ x: 0, y: 0 }, { x: 1, y: 0 }], 10);
    expect(pointwiseDistance(line, line)).toBe(0);
    expect(pointwiseDistance(line, [...line].reverse())).toBeGreaterThan(0.4);
  });
});
