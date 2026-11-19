import { describe, expect, it } from '../../../pruebas/ejecutor.js';
import { ReconocedorGlifos, RECOGNITION_LEVELS } from './reconocedor-glifos.js';
import { createGlyph } from '../glifos/modelo-glifo.js';
import { STARTER_GLYPHS } from '../../glifos/glifos-iniciales.js';
import { drawGlyphLike, splitStroke } from '../../sinteticos/glifo-sintetico.js';

const glyphs = STARTER_GLYPHS.map(createGlyph);
const byId = (/** @type {string} */ id) => /** @type {import('../glifos/modelo-glifo.js').Glyph} */ (glyphs.find((g) => g.id === id));
const ignis = byId('ignis');
const aqua = byId('aqua');
const glacies = byId('glacies');
const recognizer = new ReconocedorGlifos();

/** @param {import('./reconocedor-glifos.js').RecognitionResult} r */
const codes = (r) => r.issues.map((i) => i.code);

describe('ReconocedorGlifos · configuración', () => {
  it('niveles con umbrales crecientes', () => {
    expect(RECOGNITION_LEVELS.apprentice.threshold).toBeLessThan(RECOGNITION_LEVELS.artisan.threshold);
    expect(RECOGNITION_LEVELS.artisan.threshold).toBeLessThan(RECOGNITION_LEVELS.master.threshold);
  });

  it('valida sus entradas', () => {
    expect(() => new ReconocedorGlifos({ sigma: 0 })).toThrow(RangeError);
    // @ts-expect-error
    expect(() => recognizer.evaluate([], ignis, { level: 'dios' })).toThrow(RangeError);
    // @ts-expect-error
    expect(() => recognizer.evaluate([], { id: 'x' })).toThrow(TypeError);
    // @ts-expect-error
    expect(() => recognizer.evaluate('trazos', ignis)).toThrow(TypeError);
  });

  it('la nota cae con la distancia (curva de meseta)', () => {
    expect(recognizer.scoreFromDistance(0)).toBe(100);
    expect(recognizer.scoreFromDistance(0.04)).toBeGreaterThan(90);
    expect(recognizer.scoreFromDistance(0.1)).toBeLessThan(15);
    expect(recognizer.scoreFromDistance(Infinity)).toBe(0);
  });
});

describe('ReconocedorGlifos · aciertos', () => {
  it.each(glyphs.map((g) => [g.id, g]))('%s bien trazado supera los tres niveles', (_, glyph) => {
    const strokes = drawGlyphLike(glyph, { wobble: 0.03, seed: 7 });
    for (const level of /** @type {const} */ (['apprentice', 'artisan', 'master'])) {
      const result = recognizer.evaluate(strokes, glyph, { level });
      expect(result.passed, `${glyph.id} en ${level}: ${result.score}`).toBe(true);
    }
  });

  it('no depende de la posición ni del tamaño del dibujo', () => {
    const small = recognizer.evaluate(drawGlyphLike(ignis, { cx: 0.25, cy: 0.7, r: 0.15 }), ignis);
    const big = recognizer.evaluate(drawGlyphLike(ignis, { cx: 0.5, cy: 0.5, r: 0.48 }), ignis);
    expect(Math.abs(small.score - big.score)).toBeLessThan(3);
    expect(small.transform?.r).toBeCloseTo(0.15, 1);
  });

  it('acepta trazos como arrays de puntos o como { points }', () => {
    const strokes = drawGlyphLike(ignis);
    const a = recognizer.evaluate(strokes, ignis);
    const b = recognizer.evaluate(strokes.map((s) => s.points), ignis);
    expect(a.score).toBe(b.score);
  });

  it('da retroalimentación por trazo y un resumen', () => {
    const result = recognizer.evaluate(drawGlyphLike(ignis, { wobble: 0 }), ignis);
    expect(result.summary).toBe('¡Trazo impecable!');
    expect(result.strokes.map((s) => [s.role, s.grade])).toEqual([
      ['circle', 'good'],
      ['inner', 'good'],
    ]);
  });
});

describe('ReconocedorGlifos · errores', () => {
  it('un glifo equivocado no se acepta en ningún nivel', () => {
    for (const drawn of glyphs) {
      for (const target of glyphs) {
        if (drawn === target) continue;
        const result = recognizer.evaluate(drawGlyphLike(drawn, { wobble: 0.03, seed: 2 }), target);
        expect(result.passed, `${drawn.id} evaluado como ${target.id}: ${result.score}`).toBe(false);
      }
    }
  });

  it('sin trazos', () => {
    const result = recognizer.evaluate([], ignis);
    expect(result.score).toBe(0);
    expect(codes(result)).toEqual(['empty']);
  });

  it('sin círculo exterior', () => {
    const [, triangle] = drawGlyphLike(ignis);
    const result = recognizer.evaluate([triangle], ignis);
    expect(result.passed).toBe(false);
    expect(codes(result)).toContain('no-circle');
  });

  it('solo el círculo: falta el símbolo interior', () => {
    const [circle] = drawGlyphLike(ignis);
    const result = recognizer.evaluate([circle], ignis);
    expect(result.passed).toBe(false);
    expect(result.score).toBeLessThanOrEqual(30);
    expect(codes(result)).toContain('no-inner');
  });

  it('círculo sin cerrar', () => {
    const result = recognizer.evaluate(drawGlyphLike(ignis, { circleGap: 0.2 }), ignis);
    expect(codes(result)).toContain('circle-open');
  });

  it('falta un trazo grande: Aqua con dos de sus tres ondas no se acepta', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const strokes = drawGlyphLike(aqua, { seed }).slice(0, 3);
      const result = recognizer.evaluate(strokes, aqua);
      expect(result.passed, `semilla ${seed}: ${result.score}`).toBe(false);
    }
  });

  it('dibujo incompleto: faltan trazos', () => {
    const strokes = drawGlyphLike(aqua).slice(0, 2); // círculo + una sola onda
    const result = recognizer.evaluate(strokes, aqua);
    expect(result.passed).toBe(false);
  });
});

describe('ReconocedorGlifos · niveles', () => {
  it('Aprendiz no tiene en cuenta el orden, Artesano sí', () => {
    const strokes = drawGlyphLike(glacies, { order: [0, 4, 3, 2, 1] });
    expect(recognizer.evaluate(strokes, glacies, { level: 'apprentice' }).passed).toBe(true);
    const artisan = recognizer.evaluate(strokes, glacies, { level: 'artisan' });
    expect(artisan.passed).toBe(false);
    expect(codes(artisan)).toContain('order');
  });

  it('el círculo debe trazarse primero a partir de Artesano', () => {
    const strokes = drawGlyphLike(ignis, { order: [1, 0] });
    expect(recognizer.evaluate(strokes, ignis, { level: 'apprentice' }).passed).toBe(true);
    expect(codes(recognizer.evaluate(strokes, ignis, { level: 'artisan' }))).toContain('circle-first');
  });

  it('Maestro exige el sentido correcto de cada trazo', () => {
    const strokes = drawGlyphLike(aqua, { reverse: [2] });
    expect(recognizer.evaluate(strokes, aqua, { level: 'artisan' }).passed).toBe(true);
    const master = recognizer.evaluate(strokes, aqua, { level: 'master' });
    expect(master.passed).toBe(false);
    expect(master.issues.find((i) => i.code === 'direction')?.stroke).toBe(2);
  });

  it('Maestro detecta el círculo en sentido contrario', () => {
    const master = recognizer.evaluate(drawGlyphLike(ignis, { reverse: [0] }), ignis, { level: 'master' });
    expect(master.issues.some((i) => i.code === 'direction' && i.stroke === 0)).toBe(true);
  });

  it('dividir un trazo en varios vale en Aprendiz pero no en Artesano', () => {
    const [circle, triangle] = drawGlyphLike(ignis);
    const strokes = [circle, ...splitStroke(triangle, 3)];
    expect(recognizer.evaluate(strokes, ignis, { level: 'apprentice' }).passed).toBe(true);
    const artisan = recognizer.evaluate(strokes, ignis, { level: 'artisan' });
    expect(artisan.passed).toBe(false);
    expect(codes(artisan)).toContain('stroke-count');
  });
});

describe('ReconocedorGlifos · classify', () => {
  it('reconoce cada glifo entre los seis, con distintos dibujos', () => {
    for (const glyph of glyphs) {
      for (let seed = 1; seed <= 5; seed++) {
        const strokes = drawGlyphLike(glyph, { wobble: 0.06, seed, cx: 0.45, r: 0.35 });
        const [best, second] = recognizer.classify(strokes, glyphs);
        expect(best.glyph.id).toBe(glyph.id);
        expect(best.result.score - second.result.score).toBeGreaterThan(20);
      }
    }
  });
});
