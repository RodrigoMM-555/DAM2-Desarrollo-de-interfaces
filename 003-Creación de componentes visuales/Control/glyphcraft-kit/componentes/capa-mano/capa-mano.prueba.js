import { afterEach, describe, expect, it, vi } from '../../../pruebas/ejecutor.js';
import { GcCapaMano } from './capa-mano.js';
import { GcIndicadorGesto } from '../indicador-gesto/indicador-gesto.js';
import { createSyntheticHand, createSyntheticFrame } from '../../sinteticos/mano-sintetica.js';

GcCapaMano.define();
GcIndicadorGesto.define();

/** @param {string} [attrs] */
async function mount(attrs = '') {
  document.body.insertAdjacentHTML('beforeend', `<gc-hand-overlay ${attrs} style="display:block;width:400px;height:300px"></gc-hand-overlay>`);
  const el = /** @type {GcCapaMano} */ (document.body.lastElementChild);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); // tamaño inicial
  return el;
}

/** @param {GcCapaMano} el */
const litPixels = (el) => {
  const canvas = /** @type {HTMLCanvasElement} */ (el.shadowRoot?.querySelector('canvas'));
  const data = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d')).getImageData(0, 0, canvas.width, canvas.height).data;
  let lit = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) lit++;
  return lit;
};

const frameWith = (/** @type {any[]} */ hands, t = 0) => createSyntheticFrame(hands, t);

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('<gc-hand-overlay> · propiedades', () => {
  it('valores predeterminados', async () => {
    const el = await mount();
    expect(el.variant).toBe('skeleton');
    expect(el.mirror).toBe('on');
    expect(el.fit).toBe('cover');
    expect(el.region).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(el.guide).toBeNull();
    expect(el.frame).toBeNull();
    expect(el.handCount).toBe(0);
  });

  it('valida frame, region y guide', async () => {
    const el = await mount();
    // @ts-expect-error
    expect(() => (el.frame = { foo: 1 })).toThrow(TypeError);
    expect(() => (el.region = { x: 0, y: 0, width: 0, height: 1 })).toThrow(TypeError);
    // @ts-expect-error
    expect(() => (el.guide = 'centro')).toThrow(TypeError);
    el.guide = null;
    expect(el.guide).toBeNull();
  });
});

describe('<gc-hand-overlay> · proyección', () => {
  it('fill + espejo: el centro queda en el centro y la x se invierte', async () => {
    const el = await mount('fit="fill"');
    expect(el.projectPoint({ x: 0.5, y: 0.5 })).toEqual({ x: 200, y: 150 });
    expect(el.projectPoint({ x: 0, y: 0 })).toEqual({ x: 400, y: 0 });
    el.mirror = 'off';
    expect(el.projectPoint({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('region: la zona indicada ocupa toda la caja', async () => {
    const el = await mount('fit="fill" mirror="off"');
    el.region = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
    expect(el.projectPoint({ x: 0.25, y: 0.25 })).toEqual({ x: 0, y: 0 });
    expect(el.projectPoint({ x: 0.75, y: 0.75 })).toEqual({ x: 400, y: 300 });
  });

  it('cover recorta igual que el vídeo con object-fit: cover', async () => {
    const el = await mount('mirror="off"');
    // Imagen 4:3 en caja 4:3 → sin recorte
    el.frame = frameWith([]);
    expect(el.projectPoint({ x: 1, y: 1 })).toEqual({ x: 400, y: 300 });
    // Imagen 16:9 en caja 4:3 → se recortan los lados
    el.frame = createSyntheticFrame([], 0, { imageWidth: 1280, imageHeight: 720 });
    expect(el.projectPoint({ x: 0, y: 0.5 }).x).toBeLessThan(0);
  });
});

describe('<gc-hand-overlay> · dibujo y eventos', () => {
  it('dibuja las manos en los tres estilos', async () => {
    const el = await mount();
    for (const variant of /** @type {const} */ (['skeleton', 'constellation', 'minimal'])) {
      el.variant = variant;
      el.frame = frameWith([createSyntheticHand({ pose: 'open' })]);
      await vi.waitFor(() => expect(litPixels(el)).toBeGreaterThan(50));
    }
  });

  it('clear() borra el dibujo', async () => {
    const el = await mount();
    el.frame = frameWith([createSyntheticHand()]);
    await vi.waitFor(() => expect(litPixels(el)).toBeGreaterThan(0));
    el.clear();
    expect(litPixels(el)).toBe(0);
  });

  it('emite hand-detected al aparecer una mano y hand-lost al desaparecer', async () => {
    const el = await mount();
    const detected = vi.fn();
    const lost = vi.fn();
    el.addEventListener('hand-detected', detected);
    el.addEventListener('hand-lost', lost);

    el.frame = frameWith([createSyntheticHand({ handedness: 'Left' })]);
    el.frame = frameWith([createSyntheticHand({ handedness: 'Left' })]);
    expect(detected).toHaveBeenCalledOnce();
    expect(detected.mock.calls[0][0].detail).toEqual({ count: 1, handedness: ['Left'] });

    el.frame = frameWith([]); // un parpadeo no cuenta
    expect(lost).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 350));
    el.frame = frameWith([]);
    expect(lost).toHaveBeenCalledOnce();
  });

  it('muestra el progreso de borrado con el estado de gesto', async () => {
    const el = await mount();
    el.frame = frameWith([createSyntheticHand({ pose: 'open' })]);
    await vi.waitFor(() => expect(litPixels(el)).toBeGreaterThan(0));
    const before = litPixels(el);
    el.gestures = [{ id: 'Right', state: 'erasing', progress: 0.8, point: null }];
    await vi.waitFor(() => expect(litPixels(el)).toBeGreaterThan(before));
  });
});

describe('<gc-gesture-indicator>', () => {
  it('muestra el estado y el progreso, y valida los valores', () => {
    document.body.insertAdjacentHTML('beforeend', '<gc-gesture-indicator></gc-gesture-indicator>');
    const el = /** @type {GcIndicadorGesto} */ (document.body.lastElementChild);
    expect(el.state).toBe('none');
    expect(el.getAttribute('role')).toBe('status');
    expect(el.shadowRoot?.textContent).toContain('Sin manos');

    el.state = 'erasing';
    el.progress = 0.5;
    expect(el.shadowRoot?.textContent).toContain('Borrando');
    expect(el.getAttribute('aria-label')).toBe('Gesto: Borrando…');
    expect(el.matches(':state(erasing)')).toBe(true);

    el.progress = 7;
    expect(el.progress).toBe(1);
    el.state = 'drawing';
    expect(el.progress).toBe(0); // el progreso solo tiene sentido al borrar/sellar

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // @ts-expect-error
    el.state = 'volando';
    expect(el.state).toBe('drawing');
    expect(warn).toHaveBeenCalled();
  });
});
