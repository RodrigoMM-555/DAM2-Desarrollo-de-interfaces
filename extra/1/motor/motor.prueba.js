// @ts-check
import { describe, expect, it } from '../pruebas/ejecutor.js';
import { prepararNotas, pulsoASegundos, validarCancion } from './partitura.js';
import { Juez } from './juez.js';
import { Puntuacion, multiplicador, notaFinal } from './puntuacion.js';
import { Partida } from './partida.js';

/** Canción mínima a 60 BPM: 1 pulso = 1 segundo, cuentas fáciles. */
const cancion = (/** @type {any[]} */ notas, extra = {}) => ({
  id: 'prueba',
  titulo: 'Prueba',
  bpm: 60,
  musica: { secciones: [] },
  dificultades: { facil: notas },
  ...extra,
});

describe('partitura', () => {
  it('convierte pulsos a segundos con el tempo y el desfase', () => {
    expect(pulsoASegundos(4, 60)).toBe(4);
    expect(pulsoASegundos(4, 120)).toBe(2);
    expect(pulsoASegundos(2, 120, 0.5)).toBe(1.5);
  });

  it('ordena las notas por tiempo y les da un id', () => {
    const notas = prepararNotas(
      cancion([
        { pulso: 3, mano: 'd', carril: 3 },
        { pulso: 1, mano: 'i', carril: 0 },
      ]),
      'facil',
    );
    expect(notas.map((n) => [n.id, n.tiempo, n.mano])).toEqual([
      [0, 1, 'i'],
      [1, 3, 'd'],
    ]);
  });

  it('la duración se pasa de pulsos a segundos', () => {
    const [nota] = prepararNotas(cancion([{ pulso: 0, mano: 'i', carril: 0, duracion: 2 }], { bpm: 120 }), 'facil');
    expect(nota.duracion).toBe(1);
  });

  it('acepta una nota doble (cada mano en su carril)', () => {
    const c = cancion([
      { pulso: 1, mano: 'i', carril: 0 },
      { pulso: 1, mano: 'd', carril: 3 },
    ]);
    expect(validarCancion(c)).toEqual([]);
  });

  it.each([
    ['sin título', { titulo: '' }, 'título'],
    ['BPM cero', { bpm: 0 }, 'BPM'],
    ['sin audio ni música', { musica: undefined }, 'audio'],
  ])('detecta errores de la canción: %s', (_nombre, cambio, texto) => {
    const errores = validarCancion(cancion([{ pulso: 0, mano: 'i', carril: 0 }], cambio));
    expect(errores.join(' ')).toContain(texto);
  });

  it.each([
    ['mano inventada', { pulso: 0, mano: 'x', carril: 0 }, 'mano'],
    ['carril 4', { pulso: 0, mano: 'i', carril: 4 }, 'carril'],
    ['pulso negativo', { pulso: -1, mano: 'i', carril: 0 }, 'pulso'],
  ])('detecta notas mal escritas: %s', (_nombre, nota, texto) => {
    expect(validarCancion(cancion([nota])).join(' ')).toContain(texto);
  });

  it('una mano no puede estar en dos carriles a la vez', () => {
    const c = cancion([
      { pulso: 1, mano: 'i', carril: 0 },
      { pulso: 1, mano: 'i', carril: 2 },
    ]);
    expect(validarCancion(c).join(' ')).toContain('dos notas a la vez');
  });

  it('detecta cambios de carril imposibles por tiempo', () => {
    const c = cancion(
      [
        { pulso: 1, mano: 'd', carril: 0 },
        { pulso: 1.25, mano: 'd', carril: 3 },
      ],
      { bpm: 120 }, // 0,125 s entre las dos
    );
    expect(validarCancion(c).join(' ')).toContain('no da tiempo');
  });

  it('prepararNotas lanza un error si la partitura no es válida o falta la dificultad', () => {
    expect(() => prepararNotas(cancion([{ pulso: 0, mano: 'x', carril: 0 }]), 'facil')).toThrow('no válida');
    expect(() => prepararNotas(cancion([{ pulso: 0, mano: 'i', carril: 0 }]), 'dificil')).toThrow('dificultad');
  });
});

describe('juez', () => {
  // Nota en t = 10 s, pulso de 0,5 s. Ventana [9,88 ; 10,08].
  const notas = prepararNotas(cancion([{ pulso: 10, mano: 'i', carril: 1 }]), 'facil');
  const nuevo = () => new Juez(notas, { pulso: 0.5 });
  const fuera = { i: null, d: null };

  it('no juzga nada antes de la ventana', () => {
    const juez = nuevo();
    expect(juez.actualizar(9, { i: 1, d: null })).toEqual([]);
    expect(juez.pendientes).toBe(1);
  });

  it('bien: la mano ya estaba en el carril desde antes del último pulso', () => {
    const juez = nuevo();
    juez.actualizar(9, { i: 1, d: null });
    const [juicio] = juez.actualizar(9.9, { i: 1, d: null });
    expect(juicio.calificacion).toBe('bien');
  });

  it('perfecto: la mano entró durante el último pulso', () => {
    const juez = nuevo();
    juez.actualizar(9, fuera);
    juez.actualizar(9.7, { i: 1, d: null });
    const [juicio] = juez.actualizar(9.9, { i: 1, d: null });
    expect(juicio.calificacion).toBe('perfecto');
    expect(juicio.entrada).toBe(9.7);
  });

  it('justo: la mano llegó dentro de la ventana, en el último momento', () => {
    const juez = nuevo();
    juez.actualizar(9.95, fuera);
    const [juicio] = juez.actualizar(10.05, { i: 1, d: null });
    expect(juicio.calificacion).toBe('justo');
  });

  it('fallo: termina la ventana y la mano no está', () => {
    const juez = nuevo();
    juez.actualizar(10, { i: 2, d: null }); // carril equivocado
    expect(juez.actualizar(10.05, { i: 2, d: null })).toEqual([]);
    const [juicio] = juez.actualizar(10.1, { i: 2, d: null });
    expect(juicio.calificacion).toBe('fallo');
    expect(juez.pendientes).toBe(0);
  });

  it('fallo: la otra mano en el carril correcto no cuenta', () => {
    const juez = nuevo();
    juez.actualizar(9.9, { i: null, d: 1 });
    const [juicio] = juez.actualizar(10.2, { i: null, d: 1 });
    expect(juicio.calificacion).toBe('fallo');
  });

  it('dos notas seguidas en el mismo carril: quedarse quieto no penaliza', () => {
    const seguidas = prepararNotas(
      cancion([
        { pulso: 1, mano: 'i', carril: 0 },
        { pulso: 5, mano: 'i', carril: 0 },
      ]),
      'facil',
    );
    const juez = new Juez(seguidas, { pulso: 1 });
    juez.actualizar(0.5, { i: 0, d: null });
    const a = juez.actualizar(1, { i: 0, d: null });
    const b = juez.actualizar(5, { i: 0, d: null }); // 4 pulsos quieta: sigue siendo perfecto
    expect([...a, ...b].map((j) => j.calificacion)).toEqual(['perfecto', 'perfecto']);
  });

  it('pero si la mano sale del carril, vuelve a contar desde que entra', () => {
    const seguidas = prepararNotas(
      cancion([
        { pulso: 1, mano: 'i', carril: 0 },
        { pulso: 4, mano: 'i', carril: 0 },
      ]),
      'facil',
    );
    const juez = new Juez(seguidas, { pulso: 1 });
    juez.actualizar(0.5, { i: 0, d: null });
    juez.actualizar(1, { i: 0, d: null });
    juez.actualizar(1.5, { i: null, d: null });
    juez.actualizar(2, { i: 0, d: null }); // vuelve demasiado pronto
    const [j] = juez.actualizar(4, { i: 0, d: null });
    expect(j.calificacion).toBe('bien');
  });

  it('cada nota se juzga una sola vez', () => {
    const juez = nuevo();
    expect(juez.actualizar(9.9, { i: 1, d: null })).toHaveLength(1);
    expect(juez.actualizar(10, { i: 1, d: null })).toEqual([]);
    expect(juez.actualizar(11, { i: 1, d: null })).toEqual([]);
  });

  it('si se salta un fotograma largo, juzga todas las notas que han pasado', () => {
    const varias = prepararNotas(
      cancion([
        { pulso: 1, mano: 'i', carril: 0 },
        { pulso: 2, mano: 'd', carril: 3 },
        { pulso: 3, mano: 'i', carril: 1 },
      ]),
      'facil',
    );
    const juez = new Juez(varias, { pulso: 1 });
    const juicios = juez.actualizar(5, fuera);
    expect(juicios.map((j) => j.calificacion)).toEqual(['fallo', 'fallo', 'fallo']);
  });

  it('nota doble: cada mano se juzga por separado', () => {
    const doble = prepararNotas(
      cancion([
        { pulso: 2, mano: 'i', carril: 0 },
        { pulso: 2, mano: 'd', carril: 3 },
      ]),
      'facil',
    );
    const juez = new Juez(doble, { pulso: 1 });
    juez.actualizar(1.5, fuera);
    juez.actualizar(1.7, { i: 0, d: null });
    const juicios = [...juez.actualizar(1.95, { i: 0, d: null }), ...juez.actualizar(2.2, { i: 0, d: null })];
    expect(juicios.map((j) => `${j.nota.mano}:${j.calificacion}`).sort()).toEqual(['d:fallo', 'i:perfecto']);
  });
});

describe('juez: notas de mantener', () => {
  // Nota de mantener en t = 2 s que dura 2 s (pulsos a 60 BPM).
  const mantener = () =>
    new Juez(prepararNotas(cancion([{ pulso: 2, mano: 'i', carril: 1, duracion: 2 }]), 'facil'), { pulso: 1 });
  const dentro = { i: 1, d: null };
  const fuera = { i: null, d: null };
  /** Simula 30 fps desde `desde` hasta `hasta` con la mano según `estado(t)`. */
  const jugar = (/** @type {Juez} */ juez, /** @type {number} */ desde, /** @type {number} */ hasta, /** @type {(t: number) => any} */ estado) => {
    const juicios = [];
    for (let t = desde; t <= hasta + 1e-9; t += 1 / 30) juicios.push(...juez.actualizar(t, estado(t)));
    return juicios;
  };

  it('mantener toda la nota: cabeza y cola perfectas', () => {
    const juicios = jugar(mantener(), 1.5, 4.2, (t) => (t >= 1.5 ? dentro : fuera));
    expect(juicios.map((j) => `${j.tipo}:${j.calificacion}`)).toEqual(['cabeza:perfecto', 'cola:perfecto']);
    expect(juicios[1].fraccion).toBeGreaterThan(0.95);
  });

  it('soltar a mitad: la cola vale menos', () => {
    const juicios = jugar(mantener(), 1.5, 4.2, (t) => (t < 3.3 ? dentro : fuera)); // 65 % del tiempo
    expect(juicios[1].tipo).toBe('cola');
    expect(juicios[1].calificacion).toBe('bien');
  });

  it('soltar enseguida: la cola es un fallo', () => {
    const juicios = jugar(mantener(), 1.5, 4.2, (t) => (t < 2.2 ? dentro : fuera));
    expect(juicios[1].calificacion).toBe('fallo');
  });

  it('si se falla la cabeza, la cola no se juzga', () => {
    const juicios = jugar(mantener(), 1.5, 4.5, () => fuera);
    expect(juicios.map((j) => j.tipo)).toEqual(['cabeza']);
  });

  it('mientras se mantiene, la nota sigue pendiente', () => {
    const juez = mantener();
    jugar(juez, 1.5, 3, () => dentro);
    expect(juez.pendientes).toBe(1);
    jugar(juez, 3.03, 4.1, () => dentro);
    expect(juez.pendientes).toBe(0);
  });

  it('se puede quedar en el carril para la nota siguiente: sigue siendo perfecto', () => {
    const juez = new Juez(
      prepararNotas(cancion([{ pulso: 2, mano: 'i', carril: 1, duracion: 2 }, { pulso: 6, mano: 'i', carril: 1 }]), 'facil'),
      { pulso: 1 },
    );
    const juicios = jugar(juez, 1.5, 6.2, () => dentro);
    expect(juicios.map((j) => j.calificacion)).toEqual(['perfecto', 'perfecto', 'perfecto']);
  });

  it('cruce: la izquierda a la derecha de la derecha también cuenta', () => {
    const juez = new Juez(
      prepararNotas(cancion([{ pulso: 2, mano: 'i', carril: 3 }, { pulso: 2, mano: 'd', carril: 0 }]), 'facil'),
      { pulso: 1 },
    );
    const juicios = jugar(juez, 1.5, 2.2, (t) => (t > 1.6 ? { i: 3, d: 0 } : fuera));
    expect(juicios.map((j) => j.calificacion)).toEqual(['perfecto', 'perfecto']);
  });
});

describe('puntuación', () => {
  it('multiplicador según el combo', () => {
    expect([0, 9, 10, 24, 25, 49, 50, 200].map(multiplicador)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('nota final según la precisión', () => {
    expect([1, 0.95, 0.9, 0.85, 0.75, 0.5].map(notaFinal)).toEqual(['S', 'S', 'A', 'B', 'C', 'D']);
  });

  it('suma puntos, cuenta calificaciones y rompe el combo al fallar', () => {
    const p = new Puntuacion();
    p.registrar('perfecto');
    p.registrar('bien');
    p.registrar('fallo');
    p.registrar('justo');
    const r = p.resumen;
    expect(r.puntos).toBe(600);
    expect(r.combo).toBe(1);
    expect(r.comboMaximo).toBe(2);
    expect(r.cuenta).toEqual({ perfecto: 1, bien: 1, justo: 1, fallo: 1 });
    expect(r.precision).toBeCloseTo(600 / 1200);
  });

  it('a partir de 10 aciertos seguidos los puntos se duplican', () => {
    const p = new Puntuacion();
    for (let k = 0; k < 9; k++) p.registrar('perfecto');
    expect(p.registrar('perfecto')).toBe(600);
  });

  it('la precisión no depende del multiplicador', () => {
    const p = new Puntuacion();
    for (let k = 0; k < 30; k++) p.registrar('perfecto');
    expect(p.resumen.precision).toBe(1);
    expect(p.resumen.nota).toBe('S');
  });

  it('rechaza calificaciones desconocidas', () => {
    expect(() => new Puntuacion().registrar(/** @type {any} */ ('genial'))).toThrow();
  });
});

describe('partida', () => {
  const crear = () => {
    let ahora = 0;
    const reloj = { tiempo: () => ahora };
    const partida = new Partida({
      cancion: cancion([
        { pulso: 2, mano: 'i', carril: 0 },
        { pulso: 4, mano: 'd', carril: 3 },
      ]),
      dificultad: 'facil',
      reloj,
    });
    return { partida, ir: (/** @type {number} */ t) => ((ahora = t), partida.fotograma()) };
  };

  it('emite «juzgada» con los puntos y «fin» al acabar', () => {
    const { partida, ir } = crear();
    /** @type {string[]} */
    const eventos = [];
    partida.addEventListener('juzgada', (e) => eventos.push(/** @type {CustomEvent} */ (e).detail.juicio.calificacion));
    partida.addEventListener('fin', () => eventos.push('fin'));

    ir(1.5);
    partida.ponerManos({ i: 0, d: null });
    ir(1.7); // la mano izquierda entra en el último pulso
    ir(1.95);
    partida.ponerManos({ i: 0, d: 3 });
    ir(3.7); // la derecha también
    ir(3.95);
    ir(partida.fin + 0.01);
    expect(eventos).toEqual(['perfecto', 'perfecto', 'fin']);
    expect(partida.terminada).toBe(true);
    expect(partida.puntuacion.resumen.puntos).toBe(600);
  });

  it('no termina mientras queden notas por juzgar', () => {
    const { partida, ir } = crear();
    ir(1);
    expect(partida.terminada).toBe(false);
  });

  it('la latencia de entrada retrasa el tiempo que ve el juez', () => {
    let ahora = 0;
    const partida = new Partida({
      cancion: cancion([{ pulso: 2, mano: 'i', carril: 0 }]),
      dificultad: 'facil',
      reloj: { tiempo: () => ahora },
      latenciaEntrada: 0.1,
    });
    partida.ponerManos({ i: 0, d: null });
    ahora = 1.95; // el juez ve 1,85: aún fuera de la ventana
    expect(partida.fotograma().juicios).toEqual([]);
    ahora = 2.0;
    expect(partida.fotograma().juicios).toHaveLength(1);
  });
});
