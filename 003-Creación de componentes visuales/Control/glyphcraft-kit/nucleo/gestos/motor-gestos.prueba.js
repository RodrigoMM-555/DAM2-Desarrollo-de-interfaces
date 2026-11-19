import { beforeEach, describe, expect, it } from '../../../pruebas/ejecutor.js';
import { MotorGestos, DEFAULT_GESTURE_CONFIG } from './motor-gestos.js';
import { createSyntheticHand, createSyntheticFrame } from '../../sinteticos/mano-sintetica.js';

/** @typedef {import('../../sinteticos/mano-sintetica.js').HandPose} HandPose */

const FRAME_MS = 33;

/**
 * Banco de pruebas: alimenta el motor con fotogramas sintéticos y registra
 * todos los eventos que emite.
 */
class Banco {
  time = 0;
  /** @type {{ type: string, detail: any }[]} */
  events = [];

  /** @param {Partial<import('./motor-gestos.js').GestureConfig>} [config] */
  constructor(config) {
    this.engine = new MotorGestos(config);
    const types = ['gesture-changed', 'draw-start', 'draw-move', 'draw-end', 'erase-progress', 'erase',
      'seal-progress', 'seal', 'pointer-move', 'hands-changed'];
    for (const type of types) {
      this.engine.addEventListener(type, (e) => this.events.push({ type, detail: /** @type {CustomEvent} */ (e).detail }));
    }
  }

  /**
   * Envía `frames` fotogramas con una mano (o ninguna si pose es null).
   * @param {HandPose | null} pose
   * @param {number} frames
   * @param {Parameters<typeof createSyntheticHand>[0]} [options]
   */
  feed(pose, frames = 1, options = {}) {
    for (let i = 0; i < frames; i++) {
      const hands = pose ? [createSyntheticHand({ pose, ...options })] : [];
      this.engine.update(createSyntheticFrame(hands, this.time));
      this.time += FRAME_MS;
    }
    return this;
  }

  /** @param {import('../../sinteticos/mano-sintetica.js').TrackedHand[]} hands */
  feedHands(hands, frames = 1) {
    for (let i = 0; i < frames; i++) {
      this.engine.update(createSyntheticFrame(hands, this.time));
      this.time += FRAME_MS;
    }
    return this;
  }

  /** @param {string} type */
  count(type) {
    return this.events.filter((e) => e.type === type).length;
  }

  /** @param {string} type */
  last(type) {
    return this.events.filter((e) => e.type === type).at(-1)?.detail;
  }

  clear() {
    this.events = [];
    return this;
  }
}

/** @type {Banco} */
let bench;
beforeEach(() => {
  bench = new Banco();
});

describe('MotorGestos · configuración', () => {
  it('usa la configuración predeterminada documentada (dibujar con el índice)', () => {
    expect(bench.engine.config).toEqual(DEFAULT_GESTURE_CONFIG);
    expect(bench.engine.config.drawGesture).toBe('point');
    expect(bench.engine.state).toBe('none');
  });

  it('rechaza configuraciones no válidas', () => {
    expect(() => new MotorGestos({ pinchStart: 0.5, pinchEnd: 0.4 })).toThrow(RangeError);
    expect(() => new MotorGestos({ eraseHoldMs: -1 })).toThrow(RangeError);
    // @ts-expect-error
    expect(() => new MotorGestos({ writingHand: 'both' })).toThrow(RangeError);
    // @ts-expect-error
    expect(() => new MotorGestos({ drawGesture: 'wave' })).toThrow(RangeError);
  });

  it('configure() cambia solo lo indicado', () => {
    bench.engine.configure({ eraseHoldMs: 300 });
    expect(bench.engine.config.eraseHoldMs).toBe(300);
    expect(bench.engine.config.framesToStart).toBe(DEFAULT_GESTURE_CONFIG.framesToStart);
  });

  it('rechaza fotogramas mal formados', () => {
    // @ts-expect-error
    expect(() => bench.engine.update({})).toThrow(TypeError);
    // @ts-expect-error
    expect(() => bench.engine.update(null)).toThrow(TypeError);
  });
});

describe('MotorGestos · seguimiento de manos', () => {
  it('avisa cuando aparece y desaparece una mano', () => {
    bench.feed('relaxed');
    expect(bench.last('hands-changed')).toEqual({ count: 1, hands: ['Right'] });
    expect(bench.engine.state).toBe('idle');
    bench.feed(null, 12); // 396 ms > lostGraceMs (350)
    expect(bench.last('hands-changed')).toEqual({ count: 0, hands: [] });
    expect(bench.engine.state).toBe('none');
  });

  it('minScore permite ignorar manos con poca confianza (desactivado por defecto)', () => {
    bench.feed('relaxed', 3, { score: 0.2 });
    expect(bench.engine.state).toBe('idle');
    const strict = new Banco({ minScore: 0.5 });
    strict.feed('relaxed', 3, { score: 0.2 });
    expect(strict.engine.state).toBe('none');
  });

  it('sigue la misma mano aunque MediaPipe cambie su etiqueta izquierda/derecha', () => {
    bench.feed('point', 3, { handedness: 'Right', x: 0.5 });
    bench.feed('point', 2, { handedness: 'Left', x: 0.51 }); // etiqueta errónea un instante
    bench.feed('point', 3, { handedness: 'Right', x: 0.52 });
    expect(bench.count('draw-start')).toBe(1);
    expect(bench.count('draw-end')).toBe(0);
    expect(bench.engine.getSnapshot().hands).toHaveLength(1);
  });

  it('dos manos separadas siguen siendo dos manos distintas', () => {
    const a = createSyntheticHand({ pose: 'relaxed', handedness: 'Right', x: 0.25 });
    const b = createSyntheticHand({ pose: 'relaxed', handedness: 'Right', x: 0.75 });
    bench.feedHands([a, b], 2);
    expect(bench.last('hands-changed').count).toBe(2);
  });
});

describe('MotorGestos · dibujar con el índice', () => {
  it('necesita varios fotogramas con el índice levantado para empezar', () => {
    bench.feed('relaxed').feed('point', 1);
    expect(bench.count('draw-start')).toBe(0);
    bench.feed('point', 1);
    expect(bench.count('draw-start')).toBe(1);
    expect(bench.engine.state).toBe('drawing');
  });

  it('dibuja desde la punta del índice: start → move… → end', () => {
    bench.feed('relaxed').feed('point', 2, { x: 0.4, y: 0.4 });
    for (let i = 1; i <= 10; i++) bench.feed('point', 1, { x: 0.4 + i * 0.02, y: 0.4 });
    bench.feed('relaxed', 5, { x: 0.6, y: 0.4 }); // la mano se relaja donde estaba

    expect(bench.count('draw-start')).toBe(1);
    expect(bench.count('draw-move')).toBeGreaterThanOrEqual(10);
    expect(bench.last('draw-end').reason).toBe('released');
    // El punto es la punta del índice (el ancla de la mano sintética)
    expect(bench.last('draw-move').point.x).toBeGreaterThan(0.5);
    expect(bench.last('draw-move').point.y).toBeCloseTo(0.4, 2);
    expect(bench.engine.state).toBe('idle');
  });

  it('ni la pinza, ni la mano relajada, ni un índice a medias empiezan a dibujar', () => {
    bench.feed('pinch', 6).feed('relaxed', 6).feed('point-relaxed', 6);
    expect(bench.count('draw-start')).toBe(0);
  });

  it('histéresis: un índice a medias basta para SEGUIR dibujando', () => {
    bench.feed('point', 3).feed('point-relaxed', 10).feed('point', 2);
    expect(bench.count('draw-end')).toBe(0);
    expect(bench.count('draw-start')).toBe(1);
  });

  it('unos pocos fotogramas con otra postura (ruido) no cortan el trazo', () => {
    bench.feed('point', 3).feed('relaxed', 2).feed('point', 3).feed('relaxed', 3).feed('point', 3);
    expect(bench.count('draw-end')).toBe(0);
  });

  it('tolera perder la mano un instante sin cortar el trazo', () => {
    bench.feed('point', 3).feed(null, 9).feed('point', 3); // 297 ms sin mano
    expect(bench.count('draw-end')).toBe(0);
  });

  it('si la mano se pierde demasiado tiempo, termina el trazo con motivo lost', () => {
    bench.feed('point', 3).feed(null, 12);
    expect(bench.last('draw-end').reason).toBe('lost');
  });

  it('suaviza el temblor del punto de dibujo', () => {
    bench.feed('point', 2, { x: 0.5, y: 0.5 });
    const jitter = [0.006, -0.006, 0.005, -0.005, 0.006, -0.006, 0.005, -0.005];
    const xs = jitter.map((dx) => {
      bench.feed('point', 1, { x: 0.5 + dx, y: 0.5 });
      return bench.last('draw-move').point.x;
    });
    expect(Math.max(...xs.map((x) => Math.abs(x - 0.5)))).toBeLessThan(0.004);
  });

  it('respeta writingHand: la otra mano no dibuja', () => {
    const b = new Banco({ writingHand: 'Right' });
    b.feed('point', 4, { handedness: 'Left' });
    expect(b.count('draw-start')).toBe(0);
    b.feed(null, 12).feed('point', 4, { handedness: 'Right' });
    expect(b.count('draw-start')).toBe(1);
  });

  it('reset() cierra el trazo en curso', () => {
    bench.feed('point', 3);
    bench.engine.reset();
    expect(bench.last('draw-end').reason).toBe('reset');
    expect(bench.engine.state).toBe('none');
  });
});

describe('MotorGestos · modo pinza (opcional)', () => {
  it('con drawGesture "pinch" se dibuja con la pinza y señalar mueve el cursor', () => {
    const b = new Banco({ drawGesture: 'pinch' });
    b.feed('point', 3);
    expect(b.count('draw-start')).toBe(0);
    expect(b.count('pointer-move')).toBe(3);
    b.feed('pinch', 3, { anchor: 'pinch', x: 0.3 });
    expect(b.count('draw-start')).toBe(1);
    expect(b.last('draw-move').point.x).toBeCloseTo(0.3, 2);
    b.feed('relaxed', 8);
    expect(b.last('draw-end').reason).toBe('released');
  });
});

describe('MotorGestos · borrar con la mano bien abierta', () => {
  it('hay que mantener la mano abierta: progreso creciente y después erase', () => {
    bench.feed('relaxed').feed('open', 10); // 330 ms
    expect(bench.count('erase')).toBe(0);
    expect(bench.engine.state).toBe('erasing');
    const progress = bench.last('erase-progress').progress;
    expect(progress).toBeGreaterThan(0.3);
    expect(progress).toBeLessThan(1);
    bench.feed('open', 20); // > 800 ms en total
    expect(bench.count('erase')).toBe(1);
  });

  it('una mano relajada (dedos juntos, pulgar recogido) NO borra', () => {
    bench.feed('relaxed', 60);
    expect(bench.count('erase-progress')).toBe(0);
  });

  it('cerrar la mano antes de tiempo cancela el borrado (progreso 0)', () => {
    bench.feed('open', 8).feed('relaxed', 1);
    expect(bench.last('erase-progress').progress).toBe(0);
    expect(bench.count('erase')).toBe(0);
  });

  it('mantener la mano abierta no borra una y otra vez', () => {
    bench.feed('open', 80);
    expect(bench.count('erase')).toBe(1);
    bench.feed('relaxed', 2).feed('open', 30);
    expect(bench.count('erase')).toBe(2);
  });

  it('no se puede borrar mientras otra mano dibuja', () => {
    const drawing = createSyntheticHand({ pose: 'point', handedness: 'Right', x: 0.3 });
    const open = createSyntheticHand({ pose: 'open', handedness: 'Left', x: 0.7 });
    bench.feedHands([drawing], 3).feedHands([drawing, open], 40);
    expect(bench.count('erase')).toBe(0);
    expect(bench.engine.state).toBe('drawing');
  });

  it('con dos manos: una dibuja y, al terminar, la otra puede borrar', () => {
    const point = createSyntheticHand({ pose: 'point', handedness: 'Right', x: 0.3 });
    const relaxed = createSyntheticHand({ pose: 'relaxed', handedness: 'Right', x: 0.3 });
    const open = createSyntheticHand({ pose: 'open', handedness: 'Left', x: 0.7 });
    bench.feedHands([point], 3).feedHands([relaxed], 5).feedHands([relaxed, open], 30);
    expect(bench.count('draw-end')).toBe(1);
    expect(bench.count('erase')).toBe(1);
    expect(bench.last('erase').hand).toBe('Left');
  });
});

describe('MotorGestos · sellar con el puño bien cerrado', () => {
  it('mantener el puño cerrado sella el glifo', () => {
    bench.feed('relaxed').feed('fist', 22);
    expect(bench.count('seal')).toBe(1);
    expect(bench.count('draw-start')).toBe(0);
  });

  it('un puño flojo (dedos a medio cerrar) NO sella', () => {
    bench.feed('loose-fist', 60);
    expect(bench.count('seal-progress')).toBe(0);
  });

  it('tras sellar hay una pausa antes de aceptar otra orden', () => {
    bench.feed('fist', 20);
    expect(bench.count('seal')).toBe(1);
    bench.feed('open', 25); // durante la pausa (1 s) no empieza a cargar
    expect(bench.count('erase-progress')).toBe(0);
    bench.feed('open', 35);
    expect(bench.count('erase')).toBe(1);
  });

  it('de dibujar a sellar: al cerrar el índice termina el trazo y el puño sella', () => {
    bench.feed('point', 5).feed('fist', 30);
    expect(bench.count('draw-end')).toBe(1);
    expect(bench.count('seal')).toBe(1);
  });

  it('gesture-changed informa del estado anterior y del combinado', () => {
    bench.feed('relaxed').clear().feed('point', 2);
    expect(bench.last('gesture-changed')).toEqual({ hand: 'Right', state: 'drawing', previous: 'idle', overall: 'drawing' });
  });

  it('getSnapshot() devuelve una copia del estado de cada mano', () => {
    bench.feed('point', 3);
    const snapshot = bench.engine.getSnapshot();
    expect(snapshot.state).toBe('drawing');
    expect(snapshot.hands[0]).toMatchObject({ id: 'Right', state: 'drawing', frameIndex: 0 });
    snapshot.hands[0].point = null;
    expect(bench.engine.getSnapshot().hands[0].point).not.toBeNull();
  });
});
