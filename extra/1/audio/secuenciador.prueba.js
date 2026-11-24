// @ts-check
import { describe, expect, it } from '../pruebas/ejecutor.js';
import { duracionEnPulsos, expandir } from './secuenciador.js';
import { frecuencia, notasAcorde } from './instrumentos.js';
import { validarCancion } from '../motor/partitura.js';

describe('secuenciador', () => {
  it('cada x es un golpe en su semicorchea; X es un golpe fuerte', () => {
    const eventos = expandir({ secciones: [{ compases: 1, pistas: { clave: 'X...x...........' } }] });
    expect(eventos).toEqual([
      { instrumento: 'clave', pulso: 0, acento: true },
      { instrumento: 'clave', pulso: 1, acento: false },
    ]);
  });

  it('un patrón corto se repite hasta llenar la sección', () => {
    const eventos = expandir({ secciones: [{ compases: 2, pistas: { bombo: 'x...' } }] });
    expect(eventos.map((e) => e.pulso)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('las secciones van una detrás de otra', () => {
    const eventos = expandir({
      secciones: [
        { compases: 1, pistas: { clave: 'x' + '.'.repeat(15) } },
        { compases: 1, pistas: { bombo: 'x' + '.'.repeat(15) } },
      ],
    });
    expect(eventos.map((e) => `${e.instrumento}@${e.pulso}`)).toEqual(['clave@0', 'bombo@4']);
  });

  it('cada nota del bajo dura hasta la siguiente (máximo 4 pasos)', () => {
    const eventos = expandir({
      secciones: [{ compases: 1, bajo: 'A2 . E2 . . . . . . . . . . . . .' }],
    });
    expect(eventos.map((e) => [e.nota, e.pulso, e.duracion])).toEqual([
      ['A2', 0, 0.5],
      ['E2', 0.5, 1],
    ]);
  });

  it('un acorde por compás, en bucle', () => {
    const eventos = expandir({ secciones: [{ compases: 3, acordes: ['Am', 'E7'] }] });
    expect(eventos.map((e) => e.nota)).toEqual(['Am', 'E7', 'Am']);
  });

  it('rechaza instrumentos desconocidos', () => {
    expect(() => expandir({ secciones: [{ compases: 1, pistas: { guitarra: 'x' } }] })).toThrow('desconocido');
  });

  it('duración total en pulsos', () => {
    expect(duracionEnPulsos({ secciones: [{ compases: 2 }, { compases: 3 }] })).toBe(20);
  });
});

describe('notas musicales', () => {
  it('A4 = 440 Hz y una octava duplica la frecuencia', () => {
    expect(frecuencia('A4')).toBeCloseTo(440);
    expect(frecuencia('A3')).toBeCloseTo(220);
    expect(frecuencia('C4')).toBeCloseTo(261.63, 1);
    expect(frecuencia('Bb1')).toBeCloseTo(frecuencia('A#1'));
  });

  it('acordes: menor, mayor y con séptima', () => {
    expect(notasAcorde('Am')).toHaveLength(3);
    expect(notasAcorde('E7')).toHaveLength(4);
    const [raiz, tercera] = notasAcorde('C');
    expect(tercera / raiz).toBeCloseTo(2 ** (4 / 12));
  });
});

describe('canciones incluidas', () => {
  it.each([['primer-tumbao'], ['noche-de-clave'], ['brisa-de-malecon']])('%s es válida y su música dura más que sus notas', async (id) => {
    const cancion = await (await fetch(new URL(`../canciones/${id}.json`, import.meta.url))).json();
    expect(validarCancion(cancion)).toEqual([]);
    expect(() => expandir(cancion.musica)).not.toThrow();
    const ultimo = Math.max(...Object.values(cancion.dificultades).flat().map((/** @type {any} */ n) => n.pulso));
    expect(duracionEnPulsos(cancion.musica)).toBeGreaterThan(ultimo);
  });
});
