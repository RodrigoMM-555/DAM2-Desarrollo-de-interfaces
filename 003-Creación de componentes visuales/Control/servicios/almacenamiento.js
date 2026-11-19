/**
 * Acceso seguro al almacenamiento del navegador.
 *
 * localStorage puede no estar disponible (modo privado estricto, cuotas
 * llenas, navegador que lo bloquea). Estas funciones nunca lanzan errores:
 * si no se puede leer devuelven `null` y si no se puede escribir devuelven
 * `false`, y la aplicación sigue funcionando (sin guardar).
 */

/**
 * @param {string} key
 * @param {Storage | undefined} [storage]
 * @returns {any} El JSON leído, o `null`.
 */
export function readJSON(key, storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(key);
    return raw == null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @param {string} key
 * @param {unknown} value
 * @param {Storage | undefined} [storage]
 * @returns {boolean} `true` si se ha guardado.
 */
export function writeJSON(key, value, storage = globalThis.localStorage) {
  try {
    storage?.setItem(key, JSON.stringify(value));
    return Boolean(storage);
  } catch {
    return false;
  }
}

/**
 * @param {string} key
 * @param {Storage | undefined} [storage]
 */
export function removeKey(key, storage = globalThis.localStorage) {
  try {
    storage?.removeItem(key);
  } catch {
    /* sin almacenamiento */
  }
}

/**
 * Almacenamiento en memoria con la interfaz de `Storage` (para pruebas).
 * @returns {Storage}
 */
export function memoryStorage() {
  const data = new Map();
  return /** @type {Storage} */ (/** @type {unknown} */ ({
    getItem: (/** @type {string} */ k) => (data.has(k) ? data.get(k) : null),
    setItem: (/** @type {string} */ k, /** @type {string} */ v) => data.set(k, String(v)),
    removeItem: (/** @type {string} */ k) => data.delete(k),
    clear: () => data.clear(),
    get length() {
      return data.size;
    },
    key: (/** @type {number} */ i) => [...data.keys()][i] ?? null,
  }));
}
