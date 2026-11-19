import { afterEach, describe, expect, it, vi } from '../../../pruebas/ejecutor.js';
import { userEvent } from '../../../pruebas/ejecutor.js';
import { GcLienzoGlifo } from './lienzo-glifo.js';

GcLienzoGlifo.define();

/** @param {string} [attrs] */
function mount(attrs = '') {
  document.body.insertAdjacentHTML('beforeend', `<gc-glyph-canvas ${attrs} style="display:block;width:300px;height:300px"></gc-glyph-canvas>`);
  return /** @type {GcLienzoGlifo} */ (document.body.lastElementChild);
}

/**
 * Dibuja una línea recta desde código.
 * @param {GcLienzoGlifo} el
 * @param {[number, number]} from
 * @param {[number, number]} to
 */
function line(el, from, to, steps = 10) {
  el.beginStroke({ x: from[0], y: from[1] });
  for (let i = 1; i <= steps; i++) {
    el.addPoint({ x: from[0] + ((to[0] - from[0]) * i) / steps, y: from[1] + ((to[1] - from[1]) * i) / steps });
  }
  return el.endStroke();
}

/** @param {GcLienzoGlifo} el */
const litPixels = (el) => {
  const canvas = /** @type {HTMLCanvasElement} */ (el.shadowRoot?.querySelector('canvas'));
  const data = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d')).getImageData(0, 0, canvas.width, canvas.height).data;
  let lit = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) lit++;
  return lit;
};

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('<gc-glyph-canvas> · estado inicial', () => {
  it('empieza vacío con valores predeterminados y etiqueta accesible', () => {
    const el = mount();
    expect(el.strokeCount).toBe(0);
    expect(el.strokes).toEqual([]);
    expect(el.isDrawing).toBe(false);
    expect(el.ink).toBe('#e8c675');
    expect(el.lineWidth).toBe(4);
    expect(el.maxStrokes).toBe(32);
    expect(el.pointerInput).toBe(false);
    expect(el.getAttribute('role')).toBe('img');
    expect(el.getAttribute('aria-label')).toMatch(/vacío/);
  });

  it('valida line-width y max-strokes', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = mount('line-width="900" max-strokes="0"');
    expect(el.lineWidth).toBe(40);
    expect(el.maxStrokes).toBe(1);
  });
});

describe('<gc-glyph-canvas> · trazos', () => {
  it('beginStroke / addPoint / endStroke crean un trazo y emiten eventos', () => {
    const el = mount();
    const started = vi.fn();
    const ended = vi.fn();
    const changed = vi.fn();
    el.addEventListener('drawing-started', started);
    el.addEventListener('drawing-ended', ended);
    el.addEventListener('strokes-changed', changed);

    const stroke = line(el, [0.1, 0.5], [0.9, 0.5]);

    expect(started.mock.calls[0][0].detail.source).toBe('program');
    expect(ended.mock.calls[0][0].detail).toMatchObject({ accepted: true, index: 0 });
    expect(changed.mock.calls[0][0].detail.count).toBe(1);
    expect(stroke?.points.length).toBe(11);
    expect(el.strokeCount).toBe(1);
    expect(el.getAttribute('aria-label')).toMatch(/1 trazo/);
  });

  it('dibuja de verdad en el lienzo', async () => {
    const el = mount();
    line(el, [0.1, 0.1], [0.9, 0.9]);
    await vi.waitFor(() => expect(litPixels(el)).toBeGreaterThan(500));
  });

  it('descarta trazos demasiado cortos (toques accidentales)', () => {
    const el = mount();
    const ended = vi.fn();
    el.addEventListener('drawing-ended', ended);
    el.beginStroke({ x: 0.5, y: 0.5 });
    el.addPoint({ x: 0.505, y: 0.5 });
    expect(el.endStroke()).toBeNull();
    expect(ended.mock.calls[0][0].detail).toEqual({ stroke: null, accepted: false, index: -1 });
    expect(el.strokeCount).toBe(0);
  });

  it('ignora puntos casi idénticos al anterior', () => {
    const el = mount();
    el.beginStroke({ x: 0.5, y: 0.5 });
    expect(el.addPoint({ x: 0.5001, y: 0.5 })).toBe(false);
    expect(el.addPoint({ x: 0.6, y: 0.5 })).toBe(true);
  });

  it('limita los puntos al rango 0-1 y rechaza valores no numéricos', () => {
    const el = mount();
    el.beginStroke({ x: -0.5, y: 2 });
    el.addPoint({ x: 0.5, y: 0.5 });
    const stroke = /** @type {import('./lienzo-glifo.js').Stroke} */ (el.endStroke());
    expect(stroke.points[0]).toMatchObject({ x: 0, y: 1 });
    expect(() => el.beginStroke({ x: Number.NaN, y: 0 })).toThrow(TypeError);
    // @ts-expect-error
    expect(() => el.beginStroke(null)).toThrow(TypeError);
  });

  it('addPoint sin trazo en curso devuelve false', () => {
    expect(mount().addPoint({ x: 0.2, y: 0.2 })).toBe(false);
  });

  it('respeta readonly y max-strokes', () => {
    const el = mount('max-strokes="1"');
    line(el, [0.1, 0.1], [0.9, 0.1]);
    expect(el.beginStroke({ x: 0.1, y: 0.5 })).toBe(false);
    el.maxStrokes = 5;
    el.readonly = true;
    expect(el.beginStroke({ x: 0.1, y: 0.5 })).toBe(false);
  });

  it('la propiedad strokes es una copia: no expone el estado interno', () => {
    const el = mount();
    line(el, [0.1, 0.1], [0.9, 0.1]);
    const copy = el.strokes;
    copy[0].points[0].x = 999;
    copy.pop();
    expect(el.strokes[0].points[0].x).toBeCloseTo(0.1);
  });
});

describe('<gc-glyph-canvas> · deshacer, borrar y cargar', () => {
  it('undo() elimina el último trazo', () => {
    const el = mount();
    line(el, [0.1, 0.1], [0.9, 0.1]);
    line(el, [0.1, 0.5], [0.9, 0.5]);
    expect(el.undo()).toBe(true);
    expect(el.strokeCount).toBe(1);
    el.undo();
    expect(el.undo()).toBe(false);
  });

  it('clear() emite glyph-clearing y glyph-cleared', async () => {
    const el = mount();
    line(el, [0.1, 0.1], [0.9, 0.1]);
    const clearing = vi.fn();
    const cleared = vi.fn();
    el.addEventListener('glyph-clearing', clearing);
    el.addEventListener('glyph-cleared', cleared);
    expect(await el.clear({ animated: false })).toBe(true);
    expect(clearing).toHaveBeenCalledOnce();
    expect(cleared.mock.calls[0][0].detail.count).toBe(1);
    expect(el.strokeCount).toBe(0);
  });

  it('glyph-clearing es cancelable con preventDefault()', async () => {
    const el = mount();
    line(el, [0.1, 0.1], [0.9, 0.1]);
    el.addEventListener('glyph-clearing', (e) => e.preventDefault());
    expect(await el.clear()).toBe(false);
    expect(el.strokeCount).toBe(1);
  });

  it('clear() animado termina borrando el lienzo', async () => {
    const el = mount();
    line(el, [0.1, 0.1], [0.9, 0.9]);
    await el.clear();
    expect(el.strokeCount).toBe(0);
    expect(litPixels(el)).toBe(0);
  });

  it('clear() sin trazos no hace nada', async () => {
    expect(await mount().clear()).toBe(false);
  });

  it('loadStrokes() restaura un dibujo y toJSON() lo serializa', () => {
    const a = mount();
    line(a, [0.2, 0.2], [0.8, 0.8]);
    const saved = JSON.parse(JSON.stringify(a));
    const b = mount();
    b.loadStrokes(saved.strokes);
    expect(b.strokes).toEqual(a.strokes);
    // @ts-expect-error
    expect(() => b.loadStrokes([{}])).toThrow(TypeError);
  });
});

describe('<gc-glyph-canvas> · entrada con ratón', () => {
  it('sin pointer-input el ratón no dibuja', async () => {
    const el = mount();
    await userEvent.pointer([{ target: el, keys: '[MouseLeft>]', coords: { x: 50, y: 50 } }, { coords: { x: 250, y: 250 } }, { keys: '[/MouseLeft]' }]);
    expect(el.strokeCount).toBe(0);
  });

  it('con pointer-input se dibuja arrastrando el ratón', async () => {
    const el = mount('pointer-input');
    const started = vi.fn();
    el.addEventListener('drawing-started', started);
    const r = el.getBoundingClientRect();
    await userEvent.pointer([
      { target: el, keys: '[MouseLeft>]', coords: { x: r.left + 30, y: r.top + 150 } },
      { coords: { x: r.left + 150, y: r.top + 150 } },
      { coords: { x: r.left + 270, y: r.top + 150 } },
      { keys: '[/MouseLeft]' },
    ]);
    expect(started.mock.calls[0][0].detail.source).toBe('pointer');
    expect(el.strokeCount).toBe(1);
    const points = el.strokes[0].points;
    expect(points[0].x).toBeCloseTo(0.1, 1);
    expect(points.at(-1)?.x).toBeCloseTo(0.9, 1);
  });
});

describe('<gc-glyph-canvas> · guía y corrección', () => {
  const square = [[{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.8, y: 0.8 }]];

  it('guide: valida, copia y dibuja la guía', async () => {
    const el = mount();
    expect(el.guide).toBeNull();
    expect(el.guideStyle).toBe('ghost');
    // @ts-expect-error
    expect(() => (el.guide = [[{ x: 'a' }]])).toThrow(TypeError);
    el.guide = square;
    const copy = /** @type {any} */ (el.guide);
    copy[0][0].x = 99;
    expect(el.guide?.[0][0].x).toBe(0.2);
    await vi.waitFor(() => expect(litPixels(el)).toBeGreaterThan(100));
  });

  it('guide-style="none" oculta la guía', async () => {
    const el = mount('guide-style="none"');
    el.guide = square;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    expect(litPixels(el)).toBe(0);
  });

  it('feedback colorea los trazos y se borra al cambiar el dibujo', async () => {
    const el = mount();
    line(el, [0.1, 0.5], [0.9, 0.5]);
    el.feedback = ['poor'];
    expect(el.feedback).toEqual(['poor']);
    const canvas = /** @type {HTMLCanvasElement} */ (el.shadowRoot?.querySelector('canvas'));
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    await vi.waitFor(() => {
      const [r, g] = ctx.getImageData(Math.round(canvas.width / 2), Math.round(canvas.height / 2), 1, 1).data;
      expect(r).toBeGreaterThan(g); // rojo: corrección "poor"
    });
    // @ts-expect-error valores desconocidos se ignoran
    el.feedback = ['excelente'];
    expect(el.feedback).toEqual([null]);
    el.feedback = ['good'];
    line(el, [0.1, 0.2], [0.9, 0.2]);
    expect(el.feedback).toEqual([]);
  });
});
