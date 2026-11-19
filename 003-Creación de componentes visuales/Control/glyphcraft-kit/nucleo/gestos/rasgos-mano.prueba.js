import { describe, expect, it } from '../../../pruebas/ejecutor.js';
import { computeHandFeatures } from './rasgos-mano.js';
import { createSyntheticHand } from '../../sinteticos/mano-sintetica.js';

/** @param {import('../../sinteticos/mano-sintetica.js').HandPose} pose */
const features = (pose, extra = {}) => computeHandFeatures(createSyntheticHand({ pose, ...extra }));

describe('computeHandFeatures · clasificación de poses', () => {
  it('palma abierta', () => {
    const f = features('open');
    expect(f.isOpenPalm).toBe(true);
    expect(f.isFist).toBe(false);
    expect(f.extendedCount).toBe(4);
    expect(f.extended.thumb).toBe(true);
  });

  it('pinza: pulgar e índice juntos', () => {
    const f = features('pinch', { anchor: 'pinch' });
    expect(f.pinchRatio).toBeLessThan(0.2);
    expect(f.isFist).toBe(false);
    expect(f.isOpenPalm).toBe(false);
  });

  it('puño', () => {
    const f = features('fist');
    expect(f.isFist).toBe(true);
    expect(f.isOpenPalm).toBe(false);
    expect(f.isPointing).toBe(false);
  });

  it('señalar con el índice', () => {
    const f = features('point');
    expect(f.isPointing).toBe(true);
    expect(f.extended.index).toBe(true);
    expect(f.extendedCount).toBe(1);
  });

  it('gestos a medias no cuentan: puño flojo, índice a medio estirar', () => {
    expect(features('loose-fist').isFist).toBe(false);
    expect(features('point-relaxed').isPointing).toBe(false);
    expect(features('point-relaxed').fingerRatios.index).toBeGreaterThan(1.02); // pero sirve para seguir dibujando
  });

  it('mano en reposo: no activa ningún gesto', () => {
    const f = features('relaxed');
    expect(f.isOpenPalm).toBe(false); // dedos juntos y pulgar recogido
    expect(f.isFist).toBe(false);
    expect(f.isPointing).toBe(false);
    expect(f.pinchRatio).toBeGreaterThan(0.6);
  });
});

describe('computeHandFeatures · invariancias', () => {
  it('no depende del tamaño aparente (distancia a la cámara)', () => {
    const near = features('pinch', { scale: 1.6 });
    const far = features('pinch', { scale: 0.5 });
    expect(near.pinchRatio).toBeCloseTo(far.pinchRatio, 5);
  });

  it('no depende de la rotación ni de qué mano sea', () => {
    expect(features('open', { rotation: 35 }).isOpenPalm).toBe(true);
    expect(features('fist', { rotation: -60 }).isFist).toBe(true);
    expect(features('point', { handedness: 'Left' }).isPointing).toBe(true);
  });

  it('funciona sin worldLandmarks usando la imagen', () => {
    const hand = createSyntheticHand({ pose: 'open' });
    delete hand.worldLandmarks;
    expect(computeHandFeatures(hand).isOpenPalm).toBe(true);
  });

  it('el punto de pinza está donde se colocó la mano', () => {
    const pinch = features('pinch', { x: 0.3, y: 0.7, anchor: 'pinch' });
    expect(pinch.pinchPoint.x).toBeCloseTo(0.3, 5);
    expect(pinch.pinchPoint.y).toBeCloseTo(0.7, 5);
    const point = features('point', { x: 0.6, y: 0.2 });
    expect(point.indexTip.x).toBeCloseTo(0.6, 5);
    expect(point.indexTip.y).toBeCloseTo(0.2, 5);
  });
});

describe('computeHandFeatures · validación', () => {
  it('rechaza manos sin 21 landmarks', () => {
    // @ts-expect-error
    expect(() => computeHandFeatures({ landmarks: [] })).toThrow(TypeError);
    // @ts-expect-error
    expect(() => computeHandFeatures(null)).toThrow(TypeError);
  });
});
