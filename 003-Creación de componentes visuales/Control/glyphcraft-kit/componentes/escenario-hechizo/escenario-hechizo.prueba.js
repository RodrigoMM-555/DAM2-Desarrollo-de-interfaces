import { afterEach, describe, expect, it, vi } from '../../../pruebas/ejecutor.js';
import * as THREE from 'three';
import { GcEscenarioHechizo, registerSpell, getSpell, spellIds, SistemaParticulas, Efecto, particles } from '../../efectos.js';

/** @returns {Promise<GcEscenarioHechizo>} */
async function mount(attrs = '') {
  document.body.insertAdjacentHTML('beforeend', `<gc-spell-stage ${attrs} style="display:block;width:300px;height:300px"></gc-spell-stage>`);
  const el = /** @type {GcEscenarioHechizo} */ (document.body.lastElementChild);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return el;
}

const wait = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('registro de hechizos', () => {
  it('incluye los seis elementos', () => {
    expect(spellIds()).toEqual(expect.arrayContaining(['fire', 'water', 'wind', 'light', 'aegis', 'ice']));
    expect(getSpell('fire')?.label).toBe('Fuego');
    expect(getSpell('nada')).toBeNull();
  });

  it('valida los hechizos registrados', () => {
    // @ts-expect-error
    expect(() => registerSpell('Mal Id', { create() {} })).toThrow(TypeError);
    // @ts-expect-error
    expect(() => registerSpell('sin-create', { color: [1, 1, 1], accent: [1, 1, 1] })).toThrow(TypeError);
    // @ts-expect-error
    expect(() => registerSpell('sin-color', { create: () => new Efecto() })).toThrow(TypeError);
  });
});

describe('SistemaParticulas', () => {
  it('calcula su duración y valida sus parámetros', () => {
    const sizeScale = new THREE.Uniform(1);
    const system = new SistemaParticulas({
      count: 10,
      sizeScale,
      emit: (i) => ({ position: [0, 0, 0], delay: i * 0.1, life: 1, size: 0.1 }),
    });
    expect(system.duration).toBeCloseTo(1.9);
    expect(system.points.geometry.getAttribute('aTime').count).toBe(10);
    system.dispose();
    // @ts-expect-error
    expect(() => new SistemaParticulas({ count: 0, sizeScale, emit: () => ({}) })).toThrow(RangeError);
    // @ts-expect-error
    expect(() => new SistemaParticulas({ count: 3, sizeScale })).toThrow(TypeError);
  });
});

describe('<gc-spell-stage>', () => {
  it('inicializa WebGL con valores predeterminados', async () => {
    const stage = await mount();
    expect(stage.ready).toBe(true);
    expect(stage.quality).toBe('medium');
    expect(stage.overflow).toBe(0.25);
    expect(stage.isCasting).toBe(false);
    expect(stage.stats).toEqual({ effects: 0, particles: 0 });
    // El lienzo se extiende fuera de la caja
    const canvas = /** @type {HTMLCanvasElement} */ (stage.shadowRoot?.querySelector('canvas'));
    expect(canvas.getBoundingClientRect().width).toBeCloseTo(450, 0);
  });

  it('valida los argumentos de cast()', async () => {
    const stage = await mount();
    expect(() => stage.cast('meteoro')).toThrow(RangeError);
    expect(() => stage.cast('fire', { radius: -1 })).toThrow(TypeError);
    expect(() => stage.cast('fire', { x: Number.NaN })).toThrow(TypeError);
  });

  it('lanza un hechizo: eventos, estadísticas y promesa', async () => {
    registerSpell('prueba-breve', {
      label: 'Prueba',
      color: [1, 1, 1],
      accent: [1, 1, 1],
      create: (ctx) => {
        const effect = new Efecto();
        effect.addParticles(particles(ctx, { count: 5, emit: () => ({ position: [0, 0, 0], life: 0.1, size: 0.1 }) }));
        return effect;
      },
    });
    const stage = await mount();
    const cast = vi.fn();
    const finished = vi.fn();
    stage.addEventListener('spell-cast', cast);
    stage.addEventListener('spell-finished', finished);

    const done = stage.cast('prueba-breve', { strokes: [[{ x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 }]] });
    expect(stage.isCasting).toBe(true);
    expect(cast.mock.calls[0][0].detail).toEqual({ spell: 'prueba-breve' });
    await vi.waitFor(() => expect(stage.stats.particles).toBeGreaterThan(0));
    expect(await done).toBe(true);
    expect(finished).toHaveBeenCalledOnce();
    expect(stage.isCasting).toBe(false);
    expect(stage.stats.effects).toBe(0);
  }, 10000);

  it('los seis hechizos se dibujan sin errores de shader', async () => {
    const errors = vi.spyOn(console, 'error');
    const stage = await mount('quality="low"');
    for (const spell of ['fire', 'water', 'wind', 'light', 'aegis', 'ice']) {
      stage.cast(spell, { x: 0.5, y: 0.5, radius: 0.35, intensity: 0.8, stability: 0.6 });
    }
    await wait(1800); // tras la activación ya están los efectos de cada elemento
    expect(stage.stats.effects).toBeGreaterThanOrEqual(6);
    expect(errors).not.toHaveBeenCalled();
    stage.clear();
  }, 10000);

  it('combina varios hechizos con una sola activación', async () => {
    const stage = await mount('quality="low"');
    const cast = vi.fn();
    stage.addEventListener('spell-cast', cast);
    stage.cast(['fire', 'wind']);
    expect(cast.mock.calls[0][0].detail.spell).toBe('fire+wind');
    await wait(1400);
    expect(stage.stats.effects).toBe(3); // una sola activación (aún con chispas) + fuego + viento
    expect(() => stage.cast([])).toThrow(RangeError);
    expect(() => stage.cast(['fire', 'nada'])).toThrow(RangeError);
    stage.clear();
  }, 10000);

  it('clear() detiene todo y resuelve las promesas con false', async () => {
    const stage = await mount();
    const done = stage.cast('fire');
    stage.clear();
    expect(await done).toBe(false);
    expect(stage.stats).toEqual({ effects: 0, particles: 0 });
  });

  it('recoge propiedades asignadas antes de definirse (upgrade property)', async () => {
    const early = document.createElement('gc-spell-stage-tardio');
    /** @type {any} */ (early).quality = 'low';
    document.body.append(early);
    class Tardio extends GcEscenarioHechizo {}
    customElements.define('gc-spell-stage-tardio', Tardio);
    expect(early.getAttribute('quality')).toBe('low');
    expect(/** @type {any} */ (early).quality).toBe('low');
  });

  it('libera el contexto WebGL al salir del documento', async () => {
    const stage = await mount();
    stage.remove();
    expect(stage.ready).toBe(false);
    document.body.append(stage);
    expect(stage.ready).toBe(true);
  });
});

describe('SistemaParticulas · uniforms', () => {
  it('sin atracción, el interruptor de atracción queda desactivado (w = 0)', () => {
    const system = new SistemaParticulas({
      count: 1,
      sizeScale: new THREE.Uniform(1),
      emit: () => ({ position: [0.5, 0.5, 0], life: 1, size: 0.1 }),
    });
    const material = /** @type {THREE.ShaderMaterial} */ (system.points.material);
    expect(material.uniforms.uAttract.value.w).toBe(0);
    system.dispose();
  });
});
