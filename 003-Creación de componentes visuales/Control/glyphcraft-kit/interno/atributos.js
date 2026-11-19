/**
 * Utilidades privadas para leer atributos con validación y emitir eventos.
 *
 * Los atributos HTML siempre son cadenas. Estas funciones las convierten al
 * tipo correcto y, si el valor no es válido, avisan por consola y devuelven
 * el valor predeterminado: un componente nunca debe romperse por un atributo
 * mal escrito.
 *
 * No se exportan desde el paquete: son detalle de implementación.
 */

/** Avisos ya mostrados, para no inundar la consola en cada fotograma. */
const warned = new Set();

/**
 * @param {Element} el
 * @param {string} message
 */
function warnOnce(el, message) {
  const key = `${el.localName}:${message}`;
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[glyphcraft-kit] <${el.localName}> ${message}`);
}

/**
 * Lee un atributo cuyo valor debe pertenecer a una lista cerrada.
 *
 * @template {string} T
 * @param {Element} el
 * @param {string} name
 * @param {readonly T[]} allowed
 * @param {T} fallback
 * @returns {T}
 */
export function readEnum(el, name, allowed, fallback) {
  const raw = el.getAttribute(name);
  if (raw === null || raw === '') return fallback;
  if (/** @type {readonly string[]} */ (allowed).includes(raw)) return /** @type {T} */ (raw);
  warnOnce(el, `${name}="${raw}" no es válido (${allowed.join(' | ')}); se usa "${fallback}".`);
  return fallback;
}

/**
 * Lee un atributo numérico y lo limita al rango indicado.
 *
 * @param {Element} el
 * @param {string} name
 * @param {{ fallback: number, min?: number, max?: number }} options
 * @returns {number}
 */
export function readNumber(el, name, { fallback, min = -Infinity, max = Infinity }) {
  const raw = el.getAttribute(name);
  if (raw === null || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    warnOnce(el, `${name}="${raw}" no es un número; se usa ${fallback}.`);
    return fallback;
  }
  if (value < min || value > max) {
    const clamped = Math.min(max, Math.max(min, value));
    warnOnce(el, `${name}=${value} está fuera de rango [${min}, ${max}]; se usa ${clamped}.`);
    return clamped;
  }
  return value;
}

/**
 * Refleja un booleano como atributo presente/ausente (convención HTML).
 *
 * @param {Element} el
 * @param {string} name
 * @param {boolean} value
 */
export function reflectBoolean(el, name, value) {
  el.toggleAttribute(name, Boolean(value));
}

/**
 * Emite un CustomEvent que atraviesa el Shadow DOM (`composed`) y burbujea.
 *
 * @template T
 * @param {EventTarget} target
 * @param {string} type
 * @param {T} detail
 * @param {{ cancelable?: boolean }} [options]
 * @returns {boolean} `false` si algún oyente llamó a `preventDefault()`.
 */
export function emit(target, type, detail, { cancelable = false } = {}) {
  return target.dispatchEvent(
    new CustomEvent(type, { detail, bubbles: true, composed: true, cancelable }),
  );
}
