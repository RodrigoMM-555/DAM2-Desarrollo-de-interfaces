// @ts-check
import { describe, expect, it } from '../pruebas/ejecutor.js';
import { GrabadorPartitura } from './grabador.js';
import { validarCancion } from './partitura.js';

// A 60 BPM, 1 pulso = 1 segundo: las cuentas se leen fácil.
const nuevo = (cuantizacion = 0.5) => new GrabadorPartitura({ bpm: 60, cuantizacion });
const sin = { i: null, d: null };

describe('grabador de partituras', () => {
  it('cada entrada en un carril es una nota, cuantizada al medio pulso', () => {
    const g = nuevo();
    g.registrar(1.93, { i: 0, d: null });
    g.registrar(2.5, sin);
    g.registrar(3.1, { i: null, d: 3 });
    expect(g.terminar(3.6)).toEqual([
      { pulso: 2, mano: 'i', carril: 0 },
      { pulso: 3, mano: 'd', carril: 3 },
    ]);
  });

  it('cuantizar a pulsos enteros', () => {
    const g = nuevo(1);
    g.registrar(2.4, { i: 1, d: null });
    expect(g.terminar(3)).toEqual([{ pulso: 2, mano: 'i', carril: 1 }]);
  });

  it('quedarse 2 pulsos o más crea una nota de mantener', () => {
    const g = nuevo();
    g.registrar(1, { i: 2, d: null });
    g.registrar(4.2, sin);
    expect(g.terminar(5)).toEqual([{ pulso: 1, mano: 'i', carril: 2, duracion: 3 }]);
  });

  it('un roce de menos de 0,1 s no cuenta', () => {
    const g = nuevo();
    g.registrar(1, { i: 0, d: null });
    g.registrar(1.05, { i: 1, d: null }); // pasa por el 0 de camino al 1
    expect(g.terminar(2).map((n) => n.carril)).toEqual([1]);
  });

  it('descarta notas injugables: cambio de carril demasiado rápido', () => {
    const g = nuevo(0.125);
    g.registrar(1, { i: 0, d: null });
    g.registrar(1.15, { i: 3, d: null }); // → pulso 1,125: 0,125 s después, imposible (mínimo 0,25 s)
    expect(g.terminar(2).length).toBe(1);
  });

  it('lo grabado pasa el validador de partituras', () => {
    const g = nuevo();
    let t = 1;
    for (let k = 0; k < 12; k++, t += 0.5) {
      g.registrar(t + (k % 3) * 0.04, { i: k % 2 ? null : k % 4, d: k % 2 ? (k % 4) : null });
    }
    const notas = g.terminar(t + 1);
    const cancion = { titulo: 'Prueba', bpm: 60, musica: { secciones: [] }, dificultades: { grabada: notas } };
    expect(notas.length).toBeGreaterThan(5);
    expect(validarCancion(cancion)).toEqual([]);
  });
});
