import { afterEach, beforeEach, describe, expect, it, vi } from '../pruebas/ejecutor.js';
import { EnrutadorHash } from './enrutador.js';

/** @type {import('./enrutador.js').RouteDefinition[]} */
const ROUTES = [
  { path: '/', view: 'gc-view-menu', title: 'Menú' },
  { path: '/grimoire/:glyphId?', view: 'gc-view-grimoire', title: 'Grimorio' },
  { path: '/lab', view: 'gc-view-lab', title: 'Laboratorio' },
];

/** @type {EnrutadorHash} */
let router;

beforeEach(() => {
  history.replaceState(null, '', '#/');
  router = new EnrutadorHash(ROUTES);
});

afterEach(() => {
  router.stop();
  history.replaceState(null, '', '#/');
});

/**
 * @param {EventTarget} target
 * @param {string} type
 * @returns {Promise<CustomEvent>}
 */
const nextEvent = (target, type) =>
  new Promise((resolve) => target.addEventListener(type, (e) => resolve(/** @type {CustomEvent} */ (e)), { once: true }));

describe('EnrutadorHash · utilidades estáticas', () => {
  it('normaliza rutas', () => {
    expect(EnrutadorHash.normalize('')).toBe('/');
    expect(EnrutadorHash.normalize('#')).toBe('/');
    expect(EnrutadorHash.normalize('#/lab/')).toBe('/lab');
    expect(EnrutadorHash.normalize('grimoire//ignis')).toBe('/grimoire/ignis');
    expect(EnrutadorHash.normalize('/lab?x=1')).toBe('/lab');
  });

  it('rechaza una lista de rutas vacía', () => {
    expect(() => new EnrutadorHash([])).toThrow(TypeError);
  });
});

describe('EnrutadorHash · match()', () => {
  it('encuentra rutas fijas y la raíz', () => {
    expect(router.match('/')?.route.view).toBe('gc-view-menu');
    expect(router.match('/lab')?.route.view).toBe('gc-view-lab');
  });

  it('extrae parámetros y admite parámetros opcionales', () => {
    expect(router.match('/grimoire')?.params).toEqual({});
    expect(router.match('/grimoire/ignis')?.params).toEqual({ glyphId: 'ignis' });
    expect(router.match('/grimoire/agua%20viva')?.params.glyphId).toBe('agua viva');
  });

  it('devuelve null si nada coincide', () => {
    expect(router.match('/dragones')).toBeNull();
    expect(router.match('/lab/extra')).toBeNull();
  });
});

describe('EnrutadorHash · navegación', () => {
  it('start() resuelve la ruta actual y emite route-change', () => {
    const handler = vi.fn();
    router.addEventListener('route-change', handler);
    router.start();
    expect(router.current?.path).toBe('/');
    expect(handler.mock.calls[0][0].detail.previous).toBeNull();
  });

  it('navigate() cambia el hash y emite route-change con la ruta anterior', async () => {
    router.start();
    const change = nextEvent(router, 'route-change');
    router.navigate('/grimoire/aqua');
    const { detail } = await change;
    expect(location.hash).toBe('#/grimoire/aqua');
    expect(detail.params).toEqual({ glyphId: 'aqua' });
    expect(detail.previous.path).toBe('/');
  });

  it('no emite nada si ya estamos en esa ruta', async () => {
    router.start();
    const handler = vi.fn();
    router.addEventListener('route-change', handler);
    router.navigate('/');
    await new Promise((r) => setTimeout(r, 30));
    expect(handler).not.toHaveBeenCalled();
  });

  it('una ruta desconocida avisa y redirige a la de reserva', async () => {
    router.start();
    router.navigate('/lab', { replace: true });
    const notFound = vi.fn();
    router.addEventListener('route-not-found', notFound);
    history.replaceState(null, '', '#/no-existe');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(notFound.mock.calls[0][0].detail.path).toBe('/no-existe');
    expect(router.current?.path).toBe('/');
    expect(location.hash).toBe('#/');
  });

  it('stop() deja de reaccionar a cambios de URL', async () => {
    router.start();
    router.stop();
    const handler = vi.fn();
    router.addEventListener('route-change', handler);
    location.hash = '#/lab';
    await new Promise((r) => setTimeout(r, 30));
    expect(handler).not.toHaveBeenCalled();
  });
});
