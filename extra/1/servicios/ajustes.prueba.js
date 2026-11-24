// @ts-check
import { describe, expect, it } from '../pruebas/ejecutor.js';
import { Ajustes, CLAVE, POR_DEFECTO } from './ajustes.js';

const almacenFalso = (/** @type {Record<string, string>} */ datos = {}) => ({
  getItem: (/** @type {string} */ k) => datos[k] ?? null,
  setItem: (/** @type {string} */ k, /** @type {string} */ v) => void (datos[k] = v),
});

describe('ajustes', () => {
  it('sin datos guardados usa los valores por defecto', () => {
    expect(new Ajustes(almacenFalso()).datos).toEqual(POR_DEFECTO);
  });

  it('guarda y vuelve a leer los cambios', () => {
    const almacen = almacenFalso();
    new Ajustes(almacen).guardar({ usarCamara: true, intercambiarManos: true });
    const datos = new Ajustes(almacen).datos;
    expect(datos.usarCamara).toBe(true);
    expect(datos.intercambiarManos).toBe(true);
    expect(datos.zona).toEqual(POR_DEFECTO.zona);
  });

  it('descarta valores absurdos campo a campo', () => {
    const almacen = almacenFalso({
      [CLAVE]: JSON.stringify({ usarCamara: 'sí', latenciaCamara: 9, zona: { izquierda: 0.5, derecha: 0.55, arriba: 0, abajo: 1 } }),
    });
    const datos = new Ajustes(almacen).datos;
    expect(datos.usarCamara).toBe(POR_DEFECTO.usarCamara);
    expect(datos.latenciaCamara).toBe(POR_DEFECTO.latenciaCamara);
    expect(datos.zona).toEqual(POR_DEFECTO.zona);
  });

  it('volúmenes y velocidad fuera de rango → valor por defecto', () => {
    const almacen = almacenFalso({ [CLAVE]: JSON.stringify({ volumenMusica: 3, volumenEfectos: 0, antelacion: 10 }) });
    const datos = new Ajustes(almacen).datos;
    expect(datos.volumenMusica).toBe(POR_DEFECTO.volumenMusica);
    expect(datos.volumenEfectos).toBe(0); // 0 es válido: silencio
    expect(datos.antelacion).toBe(POR_DEFECTO.antelacion);
  });

  it('datos corruptos → valores por defecto', () => {
    expect(new Ajustes(almacenFalso({ [CLAVE]: '{roto' })).datos).toEqual(POR_DEFECTO);
  });

  it('los datos devueltos son una copia', () => {
    const ajustes = new Ajustes(almacenFalso());
    ajustes.datos.zona.izquierda = 0.5;
    expect(ajustes.datos.zona.izquierda).toBe(POR_DEFECTO.zona.izquierda);
  });
});
