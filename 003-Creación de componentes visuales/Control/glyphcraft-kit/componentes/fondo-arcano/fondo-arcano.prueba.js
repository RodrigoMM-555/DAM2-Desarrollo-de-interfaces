import { afterEach, describe, expect, it, vi } from '../../../pruebas/ejecutor.js';
import { GcFondoArcano } from './fondo-arcano.js';

GcFondoArcano.define();

/**
 * @param {string} [attrs]
 * @returns {Promise<GcFondoArcano>}
 */
async function mount(attrs = '') {
  document.body.insertAdjacentHTML(
    'beforeend',
    `<gc-arcane-backdrop ${attrs} style="display:block;width:800px;height:500px"></gc-arcane-backdrop>`,
  );
  const el = /** @type {GcFondoArcano} */ (document.body.lastElementChild);
  // El ResizeObserver informa del tamaño de forma asíncrona.
  await vi.waitFor(() => expect(el.moteCount).toBeGreaterThan(0));
  return el;
}

/** @param {GcFondoArcano} el */
const canvas = (el) => /** @type {HTMLCanvasElement} */ (el.shadowRoot?.querySelector('canvas'));

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('<gc-arcane-backdrop>', () => {
  it('tiene valores predeterminados documentados', async () => {
    const el = await mount();
    expect(el.density).toBe(0.5);
    expect(el.palette).toBe('arcane');
  });

  it('ajusta el canvas al tamaño del elemento', async () => {
    const el = await mount();
    const c = canvas(el);
    expect(c.width).toBeGreaterThanOrEqual(800);
    expect(c.height).toBeGreaterThanOrEqual(500);
  });

  it('el número de motas crece con la densidad', async () => {
    const el = await mount('density="0.2"');
    const low = el.moteCount;
    el.density = 1;
    expect(el.moteCount).toBeGreaterThan(low);
    el.density = 0;
    expect(el.moteCount).toBe(0);
  });

  it('valida density y palette', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = await mount('density="7" palette="neon"');
    expect(el.density).toBe(1);
    expect(el.palette).toBe('arcane');
    expect(warn).toHaveBeenCalled();
  });

  it('acepta las paletas válidas', async () => {
    const el = await mount('palette="ember"');
    expect(el.palette).toBe('ember');
    el.palette = 'frost';
    expect(el.getAttribute('palette')).toBe('frost');
  });

  it('pause() y resume() controlan la animación', async () => {
    const el = await mount();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    expect(el.running).toBe(!reduced);
    el.pause();
    expect(el.running).toBe(false);
    el.resume();
    expect(el.running).toBe(!reduced);
  });

  it('detiene el bucle al salir del documento (sin fugas)', async () => {
    const el = await mount();
    el.remove();
    expect(el.running).toBe(false);
  });

  it('burst() crea chispas y valida sus argumentos', async () => {
    const el = await mount();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const created = el.burst(100, 100, { count: 10 });
    expect(created).toBe(reduced ? 0 : 10);
    expect(() => el.burst(Number.NaN, 0)).toThrow(TypeError);
  });

  it('dibuja algo en el canvas', async () => {
    const el = await mount('density="1"');
    const c = canvas(el);
    const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
    await vi.waitFor(() => {
      const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
      let lit = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) lit++;
      expect(lit).toBeGreaterThan(0);
    });
  });
});
