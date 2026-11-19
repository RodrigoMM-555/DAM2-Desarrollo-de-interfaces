import { afterEach, describe, expect, it, vi } from '../../pruebas/ejecutor.js';
import { FuenteManoGrabada } from './fuente-mano-grabada.js';
import { GrabadorSesion } from './grabador-sesion.js';
import { FuenteManoMediaPipe } from './fuente-mano-mediapipe.js';
import { synthesizeSession } from '../sinteticos/mano-sintetica.js';
import { MotorGestos } from '../nucleo/gestos/motor-gestos.js';

/**
 * @param {EventTarget} target
 * @param {string} type
 * @param {number} [timeout]
 * @returns {Promise<CustomEvent>}
 */
const nextEvent = (target, type, timeout = 5000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Sin evento "${type}" en ${timeout} ms`)), timeout);
    target.addEventListener(
      type,
      (e) => {
        clearTimeout(timer);
        resolve(/** @type {CustomEvent} */ (e));
      },
      { once: true },
    );
  });

const shortSession = () =>
  synthesizeSession([
    { pose: 'relaxed', durationMs: 100, at: { x: 0.4, y: 0.5 } },
    { pose: 'point', durationMs: 300, at: (t) => ({ x: 0.4 + t * 0.2, y: 0.5 }) },
    { pose: 'relaxed', durationMs: 250 },
  ]);

describe('FuenteManoGrabada', () => {
  it('valida la sesión y sus opciones', () => {
    // @ts-expect-error
    expect(() => new FuenteManoGrabada({})).toThrow(TypeError);
    // @ts-expect-error
    expect(() => new FuenteManoGrabada({ frames: [{ hands: [] }] })).toThrow(TypeError);
    expect(() => new FuenteManoGrabada(shortSession(), { speed: 0 })).toThrow(RangeError);
  });

  it('emite todos los fotogramas en orden y avisa al terminar', async () => {
    const session = shortSession();
    const source = new FuenteManoGrabada(session, { speed: 4 });
    const timestamps = /** @type {number[]} */ ([]);
    source.addEventListener('frame', (e) => timestamps.push(/** @type {CustomEvent} */ (e).detail.timestamp));
    const ended = nextEvent(source, 'ended');
    await source.start();
    expect(source.status).toBe('running');
    await ended;
    expect(timestamps).toHaveLength(session.frames.length);
    expect(timestamps.every((t, i) => i === 0 || t >= timestamps[i - 1])).toBe(true);
    expect(source.status).toBe('stopped');
    expect(source.stats.backend).toBe('replay');
  });

  it('alimenta al MotorGestos igual que la cámara (integración)', async () => {
    const source = new FuenteManoGrabada(shortSession(), { speed: 4 });
    const engine = new MotorGestos();
    const events = /** @type {string[]} */ ([]);
    for (const type of ['draw-start', 'draw-end']) engine.addEventListener(type, () => events.push(type));
    source.addEventListener('frame', (e) => engine.update(/** @type {CustomEvent} */ (e).detail));
    const ended = nextEvent(source, 'ended');
    await source.start();
    await ended;
    expect(events).toEqual(['draw-start', 'draw-end']);
  });

  it('stop() detiene la reproducción', async () => {
    const source = new FuenteManoGrabada(shortSession());
    const onFrame = vi.fn();
    source.addEventListener('frame', onFrame);
    await source.start();
    source.stop();
    const count = onFrame.mock.calls.length;
    await new Promise((r) => setTimeout(r, 120));
    expect(onFrame.mock.calls.length).toBe(count);
  });
});

describe('GrabadorSesion', () => {
  it('graba lo que emite una fuente y lo devuelve como sesión reproducible', async () => {
    const source = new FuenteManoGrabada(shortSession(), { speed: 4 });
    const recorder = new GrabadorSesion(source);
    recorder.start();
    expect(recorder.recording).toBe(true);
    const ended = nextEvent(source, 'ended');
    await source.start();
    await ended;
    const session = recorder.stop();

    expect(session.frames.length).toBe(shortSession().frames.length);
    expect(session.frames[0].timestamp).toBe(0);
    expect(session.imageWidth).toBe(640);
    expect(() => FuenteManoGrabada.validate(session)).not.toThrow();
  });

  it('redondea las coordenadas para reducir el tamaño', () => {
    const frame = shortSession().frames[5];
    const compact = GrabadorSesion.compact(frame);
    const x = compact.hands[0].landmarks[0].x;
    expect(Math.round(x * 1e4) / 1e4).toBe(x);
  });

  it('respeta el límite de fotogramas', async () => {
    const source = new FuenteManoGrabada(shortSession(), { speed: 4 });
    const recorder = new GrabadorSesion(source, { maxFrames: 3 });
    recorder.start();
    const ended = nextEvent(source, 'ended');
    await source.start();
    await ended;
    expect(recorder.frameCount).toBe(3);
    expect(recorder.recording).toBe(false);
  });
});

describe('FuenteManoMediaPipe (modelo real, cámara falsa de Chromium)', () => {
  /** @type {MediaStream | null} */
  let stream = null;
  afterEach(() => stream?.getTracks().forEach((t) => t.stop()));

  it('exige las rutas del modelo y un <video>', async () => {
    // @ts-expect-error
    expect(() => new FuenteManoMediaPipe({})).toThrow(TypeError);
    const source = new FuenteManoMediaPipe({ wasmPath: '/x', modelPath: '/y' });
    // @ts-expect-error
    await expect(source.start(null)).rejects.toThrow(TypeError);
  });

  it('carga el modelo, analiza el vídeo y emite fotogramas', async () => {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();

    const source = new FuenteManoMediaPipe({
      // Rutas relativas a pruebas.html (raíz del proyecto).
      wasmPath: new URL('lib/mediapipe/wasm', document.baseURI).href,
      modelPath: new URL('lib/mediapipe/hand_landmarker.task', document.baseURI).href,
      delegate: 'CPU',
    });
    const statuses = /** @type {string[]} */ ([]);
    source.addEventListener('status', (e) => statuses.push(/** @type {CustomEvent} */ (e).detail.status));

    const firstFrame = nextEvent(source, 'frame', 20000);
    await source.start(video);
    const { detail: frame } = await firstFrame;

    expect(statuses).toEqual(['loading', 'ready', 'running']);
    expect(frame.imageWidth).toBeGreaterThan(0);
    expect(Array.isArray(frame.hands)).toBe(true); // la cámara falsa no muestra manos
    expect(source.stats.backend).toBe('CPU');
    expect(source.stats.inferenceMs).toBeGreaterThan(0);

    source.dispose();
    expect(source.status).toBe('idle');
  }, 30000);
});
