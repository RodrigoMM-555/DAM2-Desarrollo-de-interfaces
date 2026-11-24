// @ts-check
// Partes de la entrada por cámara que no necesitan cámara.
import { describe, expect, it } from '../pruebas/ejecutor.js';
import { centroPalma, manoDeEtiqueta } from './camara.js';
import { decidirEspejo, estimarLatencia } from './calibracion.js';

describe('cámara: conversión de MediaPipe', () => {
  it('el centro de la palma es la media de muñeca y bases de índice, corazón y meñique', () => {
    const puntos = Array.from({ length: 21 }, () => ({ x: 9, y: 9 }));
    puntos[0] = { x: 0.4, y: 0.8 };
    puntos[5] = { x: 0.5, y: 0.6 };
    puntos[9] = { x: 0.45, y: 0.6 };
    puntos[17] = { x: 0.35, y: 0.6 };
    const c = centroPalma(puntos);
    expect(c.x).toBeCloseTo(0.425);
    expect(c.y).toBeCloseTo(0.65);
  });

  it('la etiqueta de MediaPipe es la mano real del jugador ("Left" = izquierda)', () => {
    expect(manoDeEtiqueta('Left', false)).toBe('i');
    expect(manoDeEtiqueta('Right', false)).toBe('d');
  });

  it('con «intercambiar manos», al revés', () => {
    expect(manoDeEtiqueta('Left', true)).toBe('d');
    expect(manoDeEtiqueta('Right', true)).toBe('i');
  });
});

describe('calibración: ¿hay que invertir el espejo?', () => {
  it('etiquetas coherentes con el ajuste actual → no invertir', () => {
    expect(decidirEspejo({ i: 40, d: 2 }, { i: 3, d: 38 })).toEqual(
      expect.objectContaining({ invertir: false, fiable: true }),
    );
  });

  it('etiquetas al revés → invertir', () => {
    expect(decidirEspejo({ i: 1, d: 44 }, { i: 41, d: 0 })).toEqual(
      expect.objectContaining({ invertir: true, fiable: true }),
    );
  });

  it('etiquetas mezcladas → no es fiable', () => {
    expect(decidirEspejo({ i: 20, d: 18 }, { i: 15, d: 21 }).fiable).toBe(false);
  });

  it('pocos fotogramas o un paso sin manos → no es fiable', () => {
    expect(decidirEspejo({ i: 5, d: 0 }, { i: 0, d: 5 }).fiable).toBe(false);
    expect(decidirEspejo({ i: 40, d: 0 }, { i: 0, d: 0 }).fiable).toBe(false);
  });
});

describe('calibración: retraso de la cámara', () => {
  const clics = [1, 2, 3, 4, 5, 6, 7, 8];

  it('mide el retraso típico (mediana)', () => {
    const cambios = clics.map((c) => c + 0.09);
    expect(estimarLatencia(cambios, clics)?.latencia).toBeCloseTo(0.09);
  });

  it('un cambio despistado no mueve el resultado', () => {
    const cambios = clics.map((c, i) => c + (i === 3 ? 0.38 : 0.1));
    expect(estimarLatencia(cambios, clics)?.latencia).toBeCloseTo(0.1);
  });

  it('ignora movimientos lejos de cualquier clic', () => {
    const cambios = [...clics.map((c) => c + 0.1), 1.6, 4.55];
    expect(estimarLatencia(cambios, clics)?.muestras).toBe(8);
  });

  it('adelantarse al clic cuenta como retraso 0', () => {
    expect(estimarLatencia(clics.map((c) => c - 0.05), clics)?.latencia).toBe(0);
  });

  it('con pocas muestras no hay medición', () => {
    expect(estimarLatencia([1.1, 2.1], clics)).toBe(null);
  });
});
