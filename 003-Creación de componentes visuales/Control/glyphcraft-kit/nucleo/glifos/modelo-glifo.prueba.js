import { describe, expect, it, vi } from '../../../pruebas/ejecutor.js';
import { createGlyph, sampleStroke, placeGlyph, pointsToPath, BibliotecaGlifos, isClosedStroke } from './modelo-glifo.js';
import { STARTER_GLYPHS } from '../../glifos/glifos-iniciales.js';
import { fitCircle, signedArea } from '../geometria/trazo.js';

const ignisDef = /** @type {import('./modelo-glifo.js').GlyphDef} */ (STARTER_GLYPHS[0]);

describe('primitivas', () => {
  it('circle: radio, inicio arriba y sentido horario', () => {
    const points = sampleStroke({ type: 'circle', r: 1, start: -90, dir: 'cw' });
    expect(points[0].x).toBeCloseTo(0);
    expect(points[0].y).toBeCloseTo(-1);
    expect(/** @type {any} */ (fitCircle(points)).r).toBeCloseTo(1, 3);
    expect(signedArea(points)).toBeGreaterThan(0); // horario con y hacia abajo
    expect(signedArea(sampleStroke({ type: 'circle', r: 1, dir: 'ccw' }))).toBeLessThan(0);
  });

  it('line, polyline cerrada, onda y espiral', () => {
    const line = sampleStroke({ type: 'line', from: [0, 0], to: [1, 0] });
    expect(line[0]).toEqual({ x: 0, y: 0 });
    expect(line.at(-1)).toEqual({ x: 1, y: 0 });
    const tri = sampleStroke({ type: 'polyline', points: [[0, 0], [1, 0], [0, 1]], closed: true });
    expect(tri.at(-1)).toEqual(tri[0]);
    const wave = sampleStroke({ type: 'wave', from: [0, 0], to: [1, 0], amplitude: 0.1, periods: 1 });
    expect(Math.max(...wave.map((p) => p.y))).toBeCloseTo(0.1, 2);
    const spiral = sampleStroke({ type: 'spiral', r0: 0.1, r1: 0.5, turns: 2 });
    expect(Math.hypot(spiral.at(-1).x, spiral.at(-1).y)).toBeCloseTo(0.5);
  });

  it('isClosedStroke', () => {
    expect(isClosedStroke({ type: 'circle', r: 1 })).toBe(true);
    expect(isClosedStroke({ type: 'polyline', points: [[0, 0], [1, 1]] })).toBe(false);
    expect(isClosedStroke({ type: 'line', from: [0, 0], to: [1, 1] })).toBe(false);
  });

  it('pointsToPath genera un path SVG', () => {
    expect(pointsToPath([{ x: 0, y: 0 }, { x: 1.23456, y: -1 }])).toBe('M0 0L1.235 -1');
  });
});

describe('createGlyph', () => {
  it('prepara puntos, paths y figuras cerradas, y es inmutable', () => {
    const glyph = createGlyph(ignisDef);
    expect(glyph.sampled).toHaveLength(2);
    expect(glyph.paths[0]).toMatch(/^M/);
    expect(glyph.closed).toEqual([true, true]);
    expect(Object.isFrozen(glyph)).toBe(true);
    expect(() => {
      /** @type {any} */ (glyph).name = 'Otro';
    }).toThrow();
  });

  it('los seis glifos del grimorio inicial son válidos', () => {
    expect(() => STARTER_GLYPHS.forEach((def) => createGlyph(def))).not.toThrow();
  });

  it('valida la definición con mensajes claros', () => {
    const bad = (/** @type {object} */ changes) => () => createGlyph(/** @type {any} */ ({ ...ignisDef, ...changes }));
    expect(bad({ id: 'Con Espacios' })).toThrow(/id/);
    expect(bad({ element: 'plasma' })).toThrow(/element/);
    expect(bad({ difficulty: 9 })).toThrow(/difficulty/);
    expect(bad({ strokes: [ignisDef.strokes[1], ignisDef.strokes[0]] })).toThrow(/círculo exterior/);
    expect(bad({ strokes: [ignisDef.strokes[0]] })).toThrow(/al menos un trazo interior/);
    expect(bad({ strokes: [ignisDef.strokes[0], { type: 'line', from: [0, 0], to: [0, Number.NaN] }] })).toThrow(/coordenadas/);
    expect(bad({ strokes: [ignisDef.strokes[0], { type: 'hexagono' }] })).toThrow(/tipo/);
  });

  it('placeGlyph lo coloca sobre el lienzo', () => {
    const [circle] = placeGlyph(createGlyph(ignisDef), { cx: 0.5, cy: 0.5, r: 0.4 });
    const fit = /** @type {any} */ (fitCircle(circle));
    expect(fit.cx).toBeCloseTo(0.5, 3);
    expect(fit.r).toBeCloseTo(0.4, 3);
  });
});

describe('BibliotecaGlifos', () => {
  it('añade, busca, lista por dificultad y avisa de los cambios', () => {
    const library = new BibliotecaGlifos();
    const onChange = vi.fn();
    library.addEventListener('change', onChange);
    library.add(...[...STARTER_GLYPHS].reverse());
    expect(library.size).toBe(6);
    expect(library.get('aqua')?.name).toBe('Aqua');
    expect(library.get('nada')).toBeNull();
    expect(library.list()[0].id).toBe('ignis');
    expect(onChange.mock.calls[0][0].detail.ids).toHaveLength(6);
    library.clear();
    expect(library.has('aqua')).toBe(false);
  });
});
