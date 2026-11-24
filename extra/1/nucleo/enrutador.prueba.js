// @ts-check
import { describe, expect, it } from '../pruebas/ejecutor.js';
import { Enrutador } from './enrutador.js';
import { RUTAS } from './aplicacion.js';

describe('enrutador', () => {
  const enrutador = new Enrutador(RUTAS);

  it('reconoce las rutas fijas', () => {
    expect(enrutador.buscar('/')?.ruta.vista).toBe('tb-vista-menu');
    expect(enrutador.buscar('/canciones')?.ruta.vista).toBe('tb-vista-canciones');
  });

  it('extrae los parámetros de la partida', () => {
    const r = enrutador.buscar('/partida/primer-tumbao/facil');
    expect(r?.ruta.vista).toBe('tb-vista-partida');
    expect(r?.parametros).toEqual({ cancion: 'primer-tumbao', dificultad: 'facil' });
  });

  it('decodifica parámetros con caracteres especiales', () => {
    expect(enrutador.buscar('/partida/canci%C3%B3n/f%C3%A1cil')?.parametros).toEqual({
      cancion: 'canción',
      dificultad: 'fácil',
    });
  });

  it('no acepta rutas desconocidas ni incompletas', () => {
    expect(enrutador.buscar('/nada')).toBe(null);
    expect(enrutador.buscar('/partida/solo-cancion')).toBe(null);
  });
});
