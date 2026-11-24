// @ts-check
import { beforeEach, describe, expect, it } from '../pruebas/ejecutor.js';
import { EntradaTeclado } from './teclado.js';

/** @type {EventTarget} */
let objetivo;
/** @type {EntradaTeclado} */
let teclado;
/** @type {any[]} */
let avisos;

const pulsar = (/** @type {string} */ code, extra = {}) =>
  objetivo.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { code, repeat: false, ...extra }));
const soltar = (/** @type {string} */ code) => objetivo.dispatchEvent(Object.assign(new Event('keyup'), { code }));

beforeEach(() => {
  objetivo = new EventTarget();
  teclado = new EntradaTeclado();
  teclado.conectar(objetivo);
  avisos = [];
  teclado.addEventListener('cambiomanos', (e) => avisos.push(/** @type {CustomEvent} */ (e).detail));
});

describe('entrada por teclado', () => {
  it('sin teclas pulsadas, ninguna mano está en un carril', () => {
    expect(teclado.estado).toEqual({ i: null, d: null });
  });

  it('A S D F mueven la mano izquierda y J K L Ñ la derecha', () => {
    pulsar('KeyD');
    pulsar('Semicolon');
    expect(teclado.estado).toEqual({ i: 2, d: 3 });
  });

  it('mantener = estar; al soltar la mano sale del carril', () => {
    pulsar('KeyA');
    soltar('KeyA');
    expect(avisos).toEqual([
      { i: 0, d: null },
      { i: null, d: null },
    ]);
  });

  it('con dos teclas de la misma mano manda la última, y al soltarla vuelve a la anterior', () => {
    pulsar('KeyJ');
    pulsar('KeyL');
    expect(teclado.estado.d).toBe(2);
    soltar('KeyL');
    expect(teclado.estado.d).toBe(0);
  });

  it('ignora la repetición automática y las combinaciones con Ctrl', () => {
    pulsar('KeyA');
    pulsar('KeyA', { repeat: true });
    pulsar('KeyS', { ctrlKey: true });
    expect(avisos).toHaveLength(1);
    expect(teclado.estado.i).toBe(0);
  });

  it('ignora teclas que no son del juego', () => {
    pulsar('KeyQ');
    expect(avisos).toHaveLength(0);
  });

  it('al perder el foco suelta todas las teclas', () => {
    pulsar('KeyA');
    pulsar('KeyK');
    objetivo.dispatchEvent(new Event('blur'));
    expect(teclado.estado).toEqual({ i: null, d: null });
  });

  it('desconectado ya no escucha', () => {
    teclado.desconectar();
    pulsar('KeyA');
    expect(teclado.estado.i).toBe(null);
  });
});
