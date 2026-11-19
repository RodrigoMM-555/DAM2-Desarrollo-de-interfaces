import { afterEach, describe, expect, it, vi } from '../../../pruebas/ejecutor.js';
import { userEvent } from '../../../pruebas/ejecutor.js';
import { GcSusurro } from './susurro.js';

GcSusurro.define();

/**
 * @param {string} [attrs]
 * @returns {GcSusurro}
 */
function mount(attrs = '') {
  document.body.insertAdjacentHTML('beforeend', `<gc-whisper ${attrs}></gc-whisper>`);
  return /** @type {GcSusurro} */ (document.body.lastElementChild);
}

/**
 * Espera al siguiente evento de un tipo.
 * @param {EventTarget} target
 * @param {string} type
 * @returns {Promise<CustomEvent>}
 */
const nextEvent = (target, type) =>
  new Promise((resolve) => target.addEventListener(type, (e) => resolve(/** @type {CustomEvent} */ (e)), { once: true }));

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('<gc-whisper> · estado inicial y atributos', () => {
  it('empieza vacío con valores predeterminados y semántica accesible', () => {
    const el = mount();
    expect(el.count).toBe(0);
    expect(el.position).toBe('top-end');
    expect(el.maxVisible).toBe(3);
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
  });

  it('valida position y max-visible', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = mount('position="middle" max-visible="50"');
    expect(el.position).toBe('top-end');
    expect(el.maxVisible).toBe(10);
    expect(warn).toHaveBeenCalled();
  });
});

describe('<gc-whisper> · show()', () => {
  it('muestra un aviso, devuelve su id y emite whisper-shown', () => {
    const el = mount();
    const handler = vi.fn();
    el.addEventListener('whisper-shown', handler);
    const id = el.show({ title: 'Glifo aprendido', message: 'Ignis ya forma parte de tu grimorio', type: 'success' });

    expect(id).toMatch(/^whisper-\d+$/);
    expect(el.count).toBe(1);
    const node = el.shadowRoot?.getElementById(id);
    expect(node?.textContent).toContain('Ignis ya forma parte de tu grimorio');
    expect(node?.dataset.type).toBe('success');
    expect(handler.mock.calls[0][0].detail).toEqual({
      id,
      type: 'success',
      title: 'Glifo aprendido',
      message: 'Ignis ya forma parte de tu grimorio',
    });
  });

  it('inserta el contenido como texto, nunca como HTML', () => {
    const el = mount();
    const id = el.show({ message: '<img src=x onerror="alert(1)">' });
    const node = el.shadowRoot?.getElementById(id);
    expect(node?.querySelector('img')).toBeNull();
    expect(node?.textContent).toContain('<img');
  });

  it('los errores usan role="alert"', () => {
    const el = mount();
    const id = el.show({ message: 'Cámara no disponible', type: 'error' });
    expect(el.shadowRoot?.getElementById(id)?.getAttribute('role')).toBe('alert');
  });

  it('rechaza entradas no válidas', () => {
    const el = mount();
    // @ts-expect-error: probamos un uso incorrecto a propósito
    expect(() => el.show()).toThrow(TypeError);
    // @ts-expect-error
    expect(() => el.show({ title: 'Sin mensaje' })).toThrow(TypeError);
    expect(() => el.show({ message: '   ' })).toThrow(TypeError);
    expect(el.count).toBe(0);
  });

  it('corrige type y duration incorrectos', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = mount();
    // @ts-expect-error
    const id = el.show({ message: 'Hola', type: 'rainbow', duration: -5 });
    expect(el.shadowRoot?.getElementById(id)?.dataset.type).toBe('info');
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('<gc-whisper> · retirada de avisos', () => {
  it('desaparece solo al terminar su duración', async () => {
    const el = mount();
    const dismissed = nextEvent(el, 'whisper-dismissed');
    const id = el.show({ message: 'Breve', duration: 40 });
    const event = await dismissed;
    expect(event.detail).toEqual({ id, reason: 'timeout' });
    expect(el.count).toBe(0);
  });

  it('duration 0 lo mantiene hasta cerrarlo', async () => {
    const el = mount();
    el.show({ message: 'Persistente', duration: 0 });
    await new Promise((r) => setTimeout(r, 100));
    expect(el.count).toBe(1);
  });

  it('el botón de cerrar lo retira con motivo user', async () => {
    const el = mount();
    const id = el.show({ message: 'Ciérrame', duration: 0 });
    const dismissed = nextEvent(el, 'whisper-dismissed');
    const close = /** @type {HTMLElement} */ (el.shadowRoot?.querySelector(`#${id} .close`));
    await userEvent.click(close);
    expect((await dismissed).detail.reason).toBe('user');
  });

  it('dismiss() y dismissAll() devuelven lo que han retirado', () => {
    const el = mount();
    const a = el.show({ message: 'A', duration: 0 });
    el.show({ message: 'B', duration: 0 });
    expect(el.dismiss(a)).toBe(true);
    expect(el.dismiss(a)).toBe(false);
    expect(el.dismiss('no-existe')).toBe(false);
    expect(el.dismissAll()).toBe(1);
    expect(el.count).toBe(0);
  });

  it('respeta max-visible retirando los más antiguos (overflow)', () => {
    const el = mount('max-visible="2"');
    const reasons = /** @type {string[]} */ ([]);
    el.addEventListener('whisper-dismissed', (e) => reasons.push(/** @type {CustomEvent} */ (e).detail.reason));
    el.show({ message: '1', duration: 0 });
    el.show({ message: '2', duration: 0 });
    el.show({ message: '3', duration: 0 });
    expect(el.count).toBe(2);
    expect(reasons).toEqual(['overflow']);
  });

  it('limpia los temporizadores al salir del documento', () => {
    const el = mount();
    el.show({ message: 'Adiós', duration: 50 });
    el.remove();
    expect(el.count).toBe(0);
  });
});
