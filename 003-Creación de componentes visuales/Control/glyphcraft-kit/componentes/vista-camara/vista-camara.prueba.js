import { afterEach, describe, expect, it, vi } from '../../../pruebas/ejecutor.js';
import { GcVistaCamara } from './vista-camara.js';

GcVistaCamara.define();

/** @param {string} [attrs] */
function mount(attrs = '') {
  document.body.insertAdjacentHTML('beforeend', `<gc-camera-preview ${attrs} style="width:320px;height:240px"></gc-camera-preview>`);
  return /** @type {GcVistaCamara} */ (document.body.lastElementChild);
}

/**
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

describe('<gc-camera-preview> · estado inicial y atributos', () => {
  it('empieza apagada con valores predeterminados', () => {
    const el = mount();
    expect(el.status).toBe('idle');
    expect(el.mirror).toBe('on');
    expect(el.fit).toBe('cover');
    expect(el.facing).toBe('user');
    expect(el.resolution).toBe('medium');
    expect(el.lastError).toBeNull();
    expect(el.frameSource).toBeInstanceOf(HTMLVideoElement);
  });

  it('valida los atributos enumerados', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = mount('mirror="maybe" resolution="8k"');
    expect(el.mirror).toBe('on');
    expect(el.resolution).toBe('medium');
  });

  it('muestra el vídeo en espejo pero entrega la imagen sin invertir', () => {
    const el = mount();
    const video = /** @type {HTMLVideoElement} */ (el.shadowRoot?.querySelector('video'));
    expect(getComputedStyle(video).transform).not.toBe('none');
    el.mirror = 'off';
    expect(getComputedStyle(video).transform).toBe('none');
  });

  it('superpone los hijos al vídeo (composición mediante slot)', () => {
    const el = mount();
    el.innerHTML = '<div class="layer"></div>';
    expect(getComputedStyle(/** @type {Element} */ (el.querySelector('.layer'))).position).toBe('absolute');
  });
});

describe('<gc-camera-preview> · encender y apagar', () => {
  it('start() pide la cámara y emite camera-ready', async () => {
    const el = mount();
    const ready = nextEvent(el, 'camera-ready');
    const ok = await el.start();
    const { detail } = await ready;
    expect(ok).toBe(true);
    expect(el.status).toBe('live');
    expect(detail.width).toBeGreaterThan(0);
    expect(el.videoSize.width).toBe(detail.width);
    el.stop();
  });

  it('stop() libera la cámara y emite camera-stopped', async () => {
    const el = mount();
    await el.start();
    const tracks = /** @type {MediaStream} */ (el.frameSource.srcObject).getTracks();
    const stopped = nextEvent(el, 'camera-stopped');
    el.stop();
    expect((await stopped).detail.reason).toBe('user');
    expect(el.status).toBe('stopped');
    expect(tracks.every((t) => t.readyState === 'ended')).toBe(true);
  });

  it('se apaga sola al quitarla del documento (privacidad)', async () => {
    const el = mount();
    await el.start();
    const tracks = /** @type {MediaStream} */ (el.frameSource.srcObject).getTracks();
    el.remove();
    expect(tracks.every((t) => t.readyState === 'ended')).toBe(true);
  });
});

describe('<gc-camera-preview> · errores', () => {
  it('permiso denegado → camera-error con motivo denied', async () => {
    const el = mount();
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(new DOMException('no', 'NotAllowedError'));
    const error = nextEvent(el, 'camera-error');
    expect(await el.start()).toBe(false);
    const { detail } = await error;
    expect(detail.reason).toBe('denied');
    expect(detail.message).toMatch(/permiso/i);
    expect(el.status).toBe('error');
    expect(el.lastError).toBe('denied');
  });

  it('clasifica los errores habituales de getUserMedia', () => {
    const classify = (/** @type {string} */ name) => GcVistaCamara.classifyError(new DOMException('', name));
    expect(classify('NotFoundError')).toBe('notfound');
    expect(classify('OverconstrainedError')).toBe('notfound');
    expect(classify('NotReadableError')).toBe('busy');
    expect(classify('SecurityError')).toBe('denied');
    expect(GcVistaCamara.classifyError(new Error('???'))).toBe('unknown');
  });

  it('listDevices() devuelve las cámaras', async () => {
    const devices = await GcVistaCamara.listDevices();
    expect(devices.length).toBeGreaterThan(0);
    expect(devices[0]).toHaveProperty('deviceId');
  });
});
