import { describe, expect, it, vi } from '../pruebas/ejecutor.js';
import { memoryStorage, readJSON, writeJSON } from './almacenamiento.js';
import { AlmacenAjustes, SETTINGS_SCHEMA, defaultSettings, migrate } from './ajustes.js';
import { AlmacenProgreso, CASTS_TO_LEARN, CASTS_TO_MASTER } from './progreso.js';
import { checkAchievements, rankIndex, combinationId, ACHIEVEMENTS } from './logros.js';
import { exportData, importData } from './copia-seguridad.js';
import { sigmaFromTolerance, oneEuroFromSmoothing } from './servicios-app.js';

describe('storage', () => {
  it('lee y escribe JSON y tolera almacenamiento roto', () => {
    const storage = memoryStorage();
    expect(writeJSON('a', { x: 1 }, storage)).toBe(true);
    expect(readJSON('a', storage)).toEqual({ x: 1 });
    storage.setItem('b', '{roto');
    expect(readJSON('b', storage)).toBeNull();
    const broken = /** @type {Storage} */ (/** @type {unknown} */ ({
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('lleno');
      },
    }));
    expect(readJSON('a', broken)).toBeNull();
    expect(writeJSON('a', 1, broken)).toBe(false);
  });
});

describe('AlmacenAjustes', () => {
  it('valores predeterminados del esquema', () => {
    const store = new AlmacenAjustes(memoryStorage());
    for (const [key, descriptor] of Object.entries(SETTINGS_SCHEMA)) {
      expect(store.get(/** @type {any} */ (key))).toEqual(descriptor.default);
    }
  });

  it('guarda, recupera y avisa de los cambios', () => {
    const storage = memoryStorage();
    const a = new AlmacenAjustes(storage);
    const onChange = vi.fn();
    a.addEventListener('change', onChange);
    a.set('effects.quality', 'high');
    a.set('sound.volume', 0.2);
    expect(onChange.mock.calls[0][0].detail).toEqual({ key: 'effects.quality', value: 'high' });
    const b = new AlmacenAjustes(storage);
    expect(b.get('effects.quality')).toBe('high');
    expect(b.get('sound.volume')).toBe(0.2);
  });

  it('valida: limita números y rechaza tipos incorrectos', () => {
    const store = new AlmacenAjustes(memoryStorage());
    expect(store.set('sound.volume', 5)).toBe(1);
    expect(() => store.set('effects.quality', 'ultra')).toThrow(TypeError);
    expect(() => store.set('sound.enabled', 'sí')).toThrow(TypeError);
    // @ts-expect-error
    expect(() => store.get('no.existe')).toThrow(RangeError);
  });

  it('migra las preferencias de la versión anterior y borra la clave antigua', () => {
    const storage = memoryStorage();
    storage.setItem(
      'glyphcraft:practice-prefs',
      JSON.stringify({ showCamera: false, showHands: true, calibration: { cx: 0.4, cy: 0.5, size: 0.6 }, level: 'master' }),
    );
    const store = new AlmacenAjustes(storage);
    expect(store.get('camera.showVideo')).toBe(false);
    expect(store.get('camera.calibration')).toEqual({ cx: 0.4, cy: 0.5, size: 0.6 });
    expect(store.get('recognition.level')).toBe('master');
    expect(storage.getItem('glyphcraft:practice-prefs')).toBeNull();
  });

  it('datos corruptos vuelven a los valores por defecto', () => {
    expect(migrate({ values: { 'sound.volume': 'alto', 'effects.quality': 3 } }, null)).toEqual(defaultSettings());
  });

  it('reset conserva la calibración; import valida', () => {
    const store = new AlmacenAjustes(memoryStorage());
    store.set('camera.calibration', { cx: 0.5, cy: 0.5, size: 0.7 });
    store.set('effects.enabled', false);
    store.reset();
    expect(store.get('effects.enabled')).toBe(true);
    expect(store.get('camera.calibration')).toEqual({ cx: 0.5, cy: 0.5, size: 0.7 });
    store.import({ values: { 'effects.quality': 'low' } });
    expect(store.get('effects.quality')).toBe('low');
    expect(() => store.import(null)).toThrow(TypeError);
  });
});

describe('AlmacenProgreso', () => {
  it(`se aprende tras ${CASTS_TO_LEARN} aciertos (los fallos no cuentan)`, () => {
    const store = new AlmacenProgreso(memoryStorage());
    store.recordPractice('ignis', { score: 40, passed: false, level: 'apprentice' });
    for (let i = 1; i < CASTS_TO_LEARN; i++) {
      expect(store.recordPractice('ignis', { score: 80, passed: true, level: 'apprentice' }).learnedNow).toBe(false);
    }
    const last = store.recordPractice('ignis', { score: 92, passed: true, level: 'artisan' });
    expect(last.learnedNow).toBe(true);
    expect(store.isLearned('ignis')).toBe(true);
    expect(store.recordPractice('ignis', { score: 90, passed: true, level: 'apprentice' }).learnedNow).toBe(false);
  });

  it(`se domina tras ${CASTS_TO_MASTER} aciertos en nivel Maestro`, () => {
    const store = new AlmacenProgreso(memoryStorage());
    const mastered = Array.from({ length: CASTS_TO_MASTER }, () =>
      store.recordPractice('aqua', { score: 90, passed: true, level: 'master' }).masteredNow,
    );
    expect(mastered).toEqual([false, false, true]);
  });

  it('calcula estadísticas globales', () => {
    const store = new AlmacenProgreso(memoryStorage());
    store.recordPractice('ignis', { score: 80, passed: true, level: 'apprentice' });
    store.recordPractice('aqua', { score: 60, passed: false, level: 'apprentice' });
    store.recordCast('ignis');
    store.addPracticeTime(90_000);
    store.recordDiscovery('aqua+ignis');
    expect(store.totals()).toMatchObject({ attempts: 2, successes: 1, casts: 1, averageScore: 70, bestScore: 80, practiceMs: 90_000, discoveries: 1 });
  });

  it('descubrimientos y logros solo cuentan la primera vez', () => {
    const store = new AlmacenProgreso(memoryStorage());
    expect(store.recordDiscovery('aqua+ignis')).toBe(true);
    expect(store.recordDiscovery('aqua+ignis')).toBe(false);
    expect(() => store.recordDiscovery('<script>')).toThrow(TypeError);
    expect(store.unlockAchievement('x')).toBe(true);
    expect(store.unlockAchievement('x')).toBe(false);
  });

  it('migra el formato v1 y sanea datos imposibles', () => {
    const storage = memoryStorage();
    storage.setItem(
      'glyphcraft:progress',
      JSON.stringify({ version: 1, glyphs: { ignis: { attempts: 4, successes: 2, lastScore: 70, bestScore: 900 }, 'MAL ID': {} } }),
    );
    const store = new AlmacenProgreso(storage);
    expect(store.get('ignis')).toMatchObject({ attempts: 4, bestScore: 100, scoreSum: 280 });
    expect(store.totals().attempts).toBe(4);
  });

  it('persiste y avisa; reset lo borra todo', () => {
    const storage = memoryStorage();
    const a = new AlmacenProgreso(storage);
    const onChange = vi.fn();
    a.addEventListener('change', onChange);
    a.recordCast('lux');
    expect(onChange).toHaveBeenCalled();
    expect(new AlmacenProgreso(storage).get('lux').casts).toBe(1);
    a.reset();
    expect(a.totals().casts).toBe(0);
  });
});

describe('logros y rangos', () => {
  it('desbloquea logros según las estadísticas, una sola vez', () => {
    const store = new AlmacenProgreso(memoryStorage());
    expect(checkAchievements(store, 6)).toEqual([]);
    for (let i = 0; i < CASTS_TO_LEARN; i++) store.recordPractice('ignis', { score: 100, passed: true, level: 'apprentice' });
    const unlocked = checkAchievements(store, 6).map((a) => a.id);
    expect(unlocked).toEqual(expect.arrayContaining(['primera-chispa', 'aprendiz', 'trazo-impecable']));
    expect(checkAchievements(store, 6)).toEqual([]);
    expect(Object.keys(store.achievements())).toHaveLength(unlocked.length);
  });

  it('todos los logros tienen datos completos', () => {
    for (const a of ACHIEVEMENTS) expect(a.title && a.description && a.rune && typeof a.test === 'function').toBeTruthy();
  });

  it('rangos según lo aprendido', () => {
    expect(rankIndex({ learned: 0, mastered: 0 }, 6)).toBe(0);
    expect(rankIndex({ learned: 2, mastered: 0 }, 6)).toBe(1);
    expect(rankIndex({ learned: 5, mastered: 0 }, 6)).toBe(2);
    expect(rankIndex({ learned: 6, mastered: 0 }, 6)).toBe(2);
    expect(rankIndex({ learned: 6, mastered: 1 }, 6)).toBe(3);
  });

  it('identificador de combinación independiente del orden', () => {
    expect(combinationId(['ventus', 'ignis'])).toBe('ignis+ventus');
  });
});

describe('copia de seguridad', () => {
  it('exporta e importa ajustes y progreso', () => {
    const settings = new AlmacenAjustes(memoryStorage());
    const progress = new AlmacenProgreso(memoryStorage());
    settings.set('effects.quality', 'low');
    progress.recordCast('ignis');
    const data = JSON.parse(JSON.stringify(exportData(settings, progress)));

    const settings2 = new AlmacenAjustes(memoryStorage());
    const progress2 = new AlmacenProgreso(memoryStorage());
    importData(data, settings2, progress2);
    expect(settings2.get('effects.quality')).toBe('low');
    expect(progress2.get('ignis').casts).toBe(1);
  });

  it('rechaza archivos que no son de GlyphCraft sin tocar nada', () => {
    const settings = new AlmacenAjustes(memoryStorage());
    const progress = new AlmacenProgreso(memoryStorage());
    progress.recordCast('ignis');
    expect(() => importData({ app: 'otra' }, settings, progress)).toThrow(TypeError);
    expect(progress.get('ignis').casts).toBe(1);
  });
});

describe('conversión de ajustes', () => {
  it('tolerancia → sigma y suavizado → One Euro', () => {
    expect(sigmaFromTolerance(0.5)).toBeCloseTo(0.08);
    expect(sigmaFromTolerance(0)).toBeLessThan(sigmaFromTolerance(1));
    expect(oneEuroFromSmoothing(1).minCutoff).toBeLessThan(oneEuroFromSmoothing(0).minCutoff);
  });
});
