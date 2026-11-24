// @ts-check
import { describe, expect, it } from '../pruebas/ejecutor.js';
import { CLAVE, Records } from './records.js';

/** Almacén falso en memoria, con la misma interfaz que localStorage. */
const almacenFalso = (/** @type {Record<string, string>} */ datos = {}) => ({
  datos,
  getItem: (/** @type {string} */ k) => datos[k] ?? null,
  setItem: (/** @type {string} */ k, /** @type {string} */ v) => void (datos[k] = v),
});

const resumen = (/** @type {number} */ puntos) =>
  /** @type {any} */ ({ puntos, precision: 0.9, nota: 'A', comboMaximo: 12 });

describe('récords', () => {
  it('sin partidas no hay récord', () => {
    expect(new Records(almacenFalso()).obtener('x', 'facil')).toBe(null);
  });

  it('guarda solo si mejora la puntuación', () => {
    const records = new Records(almacenFalso());
    expect(records.guardar('x', 'facil', resumen(1000))).toBe(true);
    expect(records.guardar('x', 'facil', resumen(800))).toBe(false);
    expect(records.guardar('x', 'facil', resumen(1200))).toBe(true);
    expect(records.obtener('x', 'facil')?.puntos).toBe(1200);
  });

  it('cada dificultad tiene su récord', () => {
    const records = new Records(almacenFalso());
    records.guardar('x', 'facil', resumen(1000));
    expect(records.obtener('x', 'normal')).toBe(null);
  });

  it('persiste entre sesiones', () => {
    const almacen = almacenFalso();
    new Records(almacen).guardar('x', 'facil', resumen(500));
    expect(new Records(almacen).obtener('x', 'facil')?.puntos).toBe(500);
  });

  it('borrar quita todos los récords, también los guardados', () => {
    const almacen = almacenFalso();
    const records = new Records(almacen);
    records.guardar('x', 'facil', resumen(500));
    records.borrar();
    expect(records.obtener('x', 'facil')).toBe(null);
    expect(new Records(almacen).obtener('x', 'facil')).toBe(null);
  });

  it('si los datos guardados están corruptos, empieza de cero', () => {
    const records = new Records(almacenFalso({ [CLAVE]: '{esto no es json' }));
    expect(records.obtener('x', 'facil')).toBe(null);
  });
});
