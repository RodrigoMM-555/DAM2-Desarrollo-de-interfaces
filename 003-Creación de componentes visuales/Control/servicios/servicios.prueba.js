import { describe, expect, it } from '../pruebas/ejecutor.js';
import {
  calibrationToZone,
  calibrationFromPath,
  mapToCanvas,
  isCalibration,
  DEFAULT_CALIBRATION,
} from './calibracion.js';

describe('calibración', () => {
  it('la zona predeterminada es un cuadrado real en una imagen 4:3', () => {
    const zone = calibrationToZone(DEFAULT_CALIBRATION, { imageWidth: 640, imageHeight: 480 });
    expect(zone.height).toBeCloseTo(0.85);
    expect(zone.width * 640).toBeCloseTo(zone.height * 480); // mismo lado en píxeles
    expect(zone.x + zone.width / 2).toBeCloseTo(0.5);
  });

  it('desplaza la zona para que no se salga de la imagen', () => {
    const zone = calibrationToZone({ cx: 0.05, cy: 0.95, size: 0.6 });
    expect(zone.x).toBe(0);
    expect(zone.y + zone.height).toBeCloseTo(1);
  });

  it('mapToCanvas lleva la zona al lienzo completo, en espejo', () => {
    const zone = { x: 0.25, y: 0.2, width: 0.5, height: 0.6 };
    expect(mapToCanvas({ x: 0.25, y: 0.2 }, zone)).toEqual({ x: 1, y: 0 });
    const corner = mapToCanvas({ x: 0.75, y: 0.8 }, zone, { mirror: false });
    expect(corner.x).toBeCloseTo(1);
    expect(corner.y).toBeCloseTo(1);
    expect(mapToCanvas({ x: 0.5, y: 0.5 }, zone).x).toBeCloseTo(0.5);
  });

  it('calibrationFromPath centra la zona en el círculo trazado y añade margen', () => {
    const circle = Array.from({ length: 40 }, (_, i) => {
      const a = (i / 40) * Math.PI * 2;
      return { x: 0.6 + Math.cos(a) * 0.15, y: 0.45 + Math.sin(a) * 0.2 }; // círculo en píxeles 4:3
    });
    const calibration = calibrationFromPath(circle);
    expect(calibration.cx).toBeCloseTo(0.6, 2);
    expect(calibration.cy).toBeCloseTo(0.45, 2);
    expect(calibration.size).toBeCloseTo(0.4 * 1.5, 2);
  });

  it('rechaza recorridos cortos o diminutos', () => {
    expect(() => calibrationFromPath([{ x: 0.5, y: 0.5 }])).toThrow(RangeError);
    const tiny = Array.from({ length: 20 }, (_, i) => ({ x: 0.5 + i * 0.001, y: 0.5 }));
    expect(() => calibrationFromPath(tiny)).toThrow(RangeError);
  });

  it('isCalibration valida el formato guardado', () => {
    expect(isCalibration(DEFAULT_CALIBRATION)).toBe(true);
    expect(isCalibration({ cx: 0.5, cy: 0.5 })).toBe(false);
    expect(isCalibration(null)).toBe(false);
  });
});

