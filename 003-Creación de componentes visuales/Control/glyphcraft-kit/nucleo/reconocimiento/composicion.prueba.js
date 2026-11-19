import { describe, expect, it } from '../../../pruebas/ejecutor.js';
import { detectElements } from './composicion.js';
import { createGlyph } from '../glifos/modelo-glifo.js';
import { STARTER_GLYPHS } from '../../glifos/glifos-iniciales.js';
import { drawGlyphLike } from '../../sinteticos/glifo-sintetico.js';

const glyphs = STARTER_GLYPHS.map(createGlyph);
const [outer] = drawGlyphLike(glyphs[0], { wobble: 0.03 });
const ids = (/** @type {import('./composicion.js').CompositionResult} */ r) => r.elements.map((g) => g.id).sort();

/** Disposiciones habituales al combinar dos símbolos en el mismo círculo. */
const LAYOUTS = {
  'superpuestos en el centro': [{ cx: 0.5, cy: 0.5, r: 0.4 }, { cx: 0.5, cy: 0.5, r: 0.4 }],
  'uno al lado del otro': [{ cx: 0.36, cy: 0.5, r: 0.17 }, { cx: 0.64, cy: 0.5, r: 0.17 }],
  'uno encima del otro': [{ cx: 0.5, cy: 0.36, r: 0.16 }, { cx: 0.5, cy: 0.64, r: 0.16 }],
  'uno grande y otro pequeño': [{ cx: 0.5, cy: 0.5, r: 0.38 }, { cx: 0.62, cy: 0.62, r: 0.12 }],
};

describe('detectElements', () => {
  it('reconoce cada símbolo suelto, de cualquier tamaño y en cualquier sitio', () => {
    for (const glyph of glyphs) {
      for (const place of [{ r: 0.35 }, { cx: 0.4, cy: 0.6, r: 0.15 }]) {
        const strokes = [outer, ...drawGlyphLike(glyph, { ...place, wobble: 0.05, seed: 3 }).slice(1)];
        expect(ids(detectElements(strokes, glyphs)), glyph.id).toEqual([glyph.id]);
      }
    }
  });

  for (const [name, [a, b]] of Object.entries(LAYOUTS)) {
    it(`reconoce las 15 parejas: ${name}`, () => {
      for (let i = 0; i < glyphs.length; i++) {
        for (let j = i + 1; j < glyphs.length; j++) {
          const strokes = [
            outer,
            ...drawGlyphLike(glyphs[i], { ...a, wobble: 0.04, seed: 10 + i }).slice(1),
            ...drawGlyphLike(glyphs[j], { ...b, wobble: 0.04, seed: 20 + j }).slice(1),
          ];
          expect(ids(detectElements(strokes, glyphs)), `${glyphs[i].id} + ${glyphs[j].id}`).toEqual([glyphs[i].id, glyphs[j].id].sort());
        }
      }
    });
  }

  it('indica qué trazos forman cada símbolo', () => {
    const strokes = [
      outer,
      ...drawGlyphLike(glyphs[0], { cx: 0.36, r: 0.17 }).slice(1), // Ignis: 1 trazo
      ...drawGlyphLike(glyphs[1], { cx: 0.64, r: 0.17 }).slice(1), // Aqua: 3 trazos
    ];
    const { symbols } = detectElements(strokes, glyphs);
    expect(symbols.map((s) => [s.glyph.id, s.strokes])).toEqual([
      ['ignis', [0]],
      ['aqua', [1, 2, 3]],
    ]);
  });

  it('sin círculo no hay combinación', () => {
    const [, triangle] = drawGlyphLike(glyphs[0]);
    const result = detectElements([triangle], glyphs);
    expect(result.circle).toBeNull();
    expect(result.elements).toEqual([]);
  });

  it('un círculo vacío no produce elementos', () => {
    expect(detectElements([outer], glyphs).elements).toEqual([]);
  });

  it('un umbral estricto rechaza lo que no se parece lo suficiente', () => {
    const strokes = [outer, ...drawGlyphLike(glyphs[0], { wobble: 0.12, seed: 4 }).slice(1)];
    expect(detectElements(strokes, glyphs, { threshold: 0.01 }).elements).toEqual([]);
  });

  it('devuelve dónde está el círculo dibujado', () => {
    const result = detectElements(drawGlyphLike(glyphs[1], { cx: 0.3, cy: 0.6, r: 0.2 }), glyphs);
    expect(result.transform?.cx).toBeCloseTo(0.3, 1);
    expect(result.transform?.r).toBeCloseTo(0.2, 1);
  });
});
