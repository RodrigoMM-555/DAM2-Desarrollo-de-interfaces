import { readJSON, writeJSON, removeKey } from './almacenamiento.js';
import { isCalibration } from './calibracion.js';

/**
 * Ajustes de la aplicación.
 *
 * Cada ajuste se declara en `SETTINGS_SCHEMA` con su tipo, sus límites y su
 * valor por defecto. El esquema sirve a la vez para:
 * - validar lo que se guarda y lo que se lee (datos corruptos → por defecto),
 * - restablecer los valores,
 * - documentar qué se puede configurar.
 *
 * Los datos se guardan con un número de versión. Si en el futuro cambia el
 * formato, `migrate()` convierte los datos antiguos.
 */

const KEY = 'glyphcraft:settings';
/** Clave de la versión anterior (Fases 3-5), que se migra automáticamente. */
const LEGACY_KEY = 'glyphcraft:practice-prefs';
export const SETTINGS_VERSION = 1;

/**
 * @typedef {(
 *   { type: 'boolean', default: boolean } |
 *   { type: 'number', default: number, min: number, max: number } |
 *   { type: 'enum', default: string, values: readonly string[] } |
 *   { type: 'string', default: string } |
 *   { type: 'calibration', default: null }
 * )} SettingDescriptor
 */

/** @type {Readonly<Record<string, SettingDescriptor>>} */
export const SETTINGS_SCHEMA = Object.freeze({
  'camera.deviceId': { type: 'string', default: '' },
  'camera.showVideo': { type: 'boolean', default: true },
  'camera.calibration': { type: 'calibration', default: null },
  'hands.showOnCanvas': { type: 'boolean', default: true },
  'hands.style': { type: 'enum', default: 'constellation', values: ['constellation', 'skeleton', 'minimal'] },
  'hands.writingHand': { type: 'enum', default: 'any', values: ['any', 'Right', 'Left'] },
  'hands.detection': { type: 'number', default: 0.5, min: 0.3, max: 0.85 },
  'hands.smoothing': { type: 'number', default: 0.5, min: 0, max: 1 },
  'hands.eraseHoldMs': { type: 'number', default: 800, min: 300, max: 2000 },
  'hands.sealHoldMs': { type: 'number', default: 600, min: 300, max: 2000 },
  'recognition.level': { type: 'enum', default: 'apprentice', values: ['apprentice', 'artisan', 'master'] },
  'recognition.tolerance': { type: 'number', default: 0.5, min: 0, max: 1 },
  'effects.enabled': { type: 'boolean', default: true },
  'effects.quality': { type: 'enum', default: 'medium', values: ['low', 'medium', 'high'] },
  'sound.enabled': { type: 'boolean', default: true },
  'sound.volume': { type: 'number', default: 0.6, min: 0, max: 1 },
});

/** @typedef {keyof typeof SETTINGS_SCHEMA} SettingKey */

/**
 * Valida un valor según su descriptor. Devuelve el valor (corregido) o el
 * valor por defecto si no es válido.
 * @param {SettingDescriptor} descriptor
 * @param {unknown} value
 */
export function sanitizeSetting(descriptor, value) {
  switch (descriptor.type) {
    case 'boolean':
      return typeof value === 'boolean' ? value : descriptor.default;
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(descriptor.max, Math.max(descriptor.min, value))
        : descriptor.default;
    case 'enum':
      return typeof value === 'string' && descriptor.values.includes(value) ? value : descriptor.default;
    case 'string':
      return typeof value === 'string' ? value : descriptor.default;
    case 'calibration':
      return isCalibration(value) ? value : null;
  }
}

/** @returns {Record<string, unknown>} */
export function defaultSettings() {
  return Object.fromEntries(Object.entries(SETTINGS_SCHEMA).map(([k, d]) => [k, d.default]));
}

/**
 * Convierte datos guardados de cualquier versión al formato actual.
 * @param {any} stored
 * @param {any} legacy Preferencias de la versión anterior (o `null`).
 * @returns {Record<string, unknown>}
 */
export function migrate(stored, legacy) {
  /** @type {Record<string, unknown>} */
  let values = stored?.values && typeof stored.values === 'object' ? { ...stored.values } : {};
  if (!stored && legacy && typeof legacy === 'object') {
    // v0 → v1: preferencias sueltas de la práctica
    values = {
      'camera.showVideo': legacy.showCamera,
      'hands.showOnCanvas': legacy.showHands,
      'camera.calibration': legacy.calibration,
      'recognition.level': legacy.level,
    };
  }
  /** @type {Record<string, unknown>} */
  const clean = {};
  for (const [key, descriptor] of Object.entries(SETTINGS_SCHEMA)) clean[key] = sanitizeSetting(descriptor, values[key]);
  return clean;
}

/**
 * Almacén de ajustes. Emite `change` con `{ key, value }` (o `{ key: '*' }`
 * si cambian muchos a la vez).
 */
export class AlmacenAjustes extends EventTarget {
  /** @type {Storage | undefined} */
  #storage;
  /** @type {Record<string, unknown>} */
  #values;

  /** @param {Storage} [storage] */
  constructor(storage = globalThis.localStorage) {
    super();
    this.#storage = storage;
    const stored = readJSON(KEY, storage);
    this.#values = migrate(stored, stored ? null : readJSON(LEGACY_KEY, storage));
    if (!stored) {
      this.#save('*');
      removeKey(LEGACY_KEY, storage);
    }
  }

  /**
   * @param {SettingKey} key
   * @returns {any}
   */
  get(key) {
    if (!(key in SETTINGS_SCHEMA)) throw new RangeError(`Ajuste desconocido: ${key}`);
    const value = this.#values[key];
    return value && typeof value === 'object' ? { ...value } : value;
  }

  /**
   * Cambia un ajuste. Los valores no válidos se corrigen (límites) o se rechazan.
   * @param {SettingKey} key
   * @param {unknown} value
   * @returns {unknown} El valor guardado.
   */
  set(key, value) {
    const descriptor = SETTINGS_SCHEMA[key];
    if (!descriptor) throw new RangeError(`Ajuste desconocido: ${key}`);
    const clean = sanitizeSetting(descriptor, value);
    if (clean !== value && !(descriptor.type === 'number' && typeof value === 'number')) {
      throw new TypeError(`Valor no válido para ${key}: ${JSON.stringify(value)}`);
    }
    this.#values[key] = clean;
    this.#save(key);
    return clean;
  }

  /** Vuelve a los valores por defecto (conserva la calibración salvo que se pida). */
  reset({ keepCalibration = true } = {}) {
    const calibration = this.#values['camera.calibration'];
    this.#values = defaultSettings();
    if (keepCalibration) this.#values['camera.calibration'] = calibration;
    this.#save('*');
  }

  /** Copia serializable. */
  toJSON() {
    return { version: SETTINGS_VERSION, values: structuredClone(this.#values) };
  }

  /**
   * Sustituye los ajustes por unos importados (se validan uno a uno).
   * @param {unknown} data
   */
  import(data) {
    if (!data || typeof data !== 'object') throw new TypeError('Ajustes importados no válidos.');
    this.#values = migrate(data, null);
    this.#save('*');
  }

  /** @param {string} key */
  #save(key) {
    writeJSON(KEY, this.toJSON(), this.#storage);
    this.dispatchEvent(new CustomEvent('change', { detail: { key, value: key === '*' ? undefined : this.#values[key] } }));
  }
}

/** Ajustes compartidos por toda la aplicación. */
export const settings = new AlmacenAjustes();
