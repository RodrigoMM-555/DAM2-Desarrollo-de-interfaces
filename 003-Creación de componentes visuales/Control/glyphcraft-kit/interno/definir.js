/**
 * Registra un custom element sin fallar si ya estaba registrado.
 *
 * `customElements.define` lanza una excepción si el nombre ya existe, algo
 * habitual cuando la biblioteca se importa dos veces (por ejemplo, desde la
 * app y desde un plugin). Con esta función el registro es idempotente.
 *
 * @template {CustomElementConstructor} T
 * @param {string} tagName Nombre de la etiqueta (debe contener un guion).
 * @param {T} ctor Clase del componente.
 * @returns {T} La clase recibida, para poder encadenar.
 */
export function defineElement(tagName, ctor) {
  const existing = customElements.get(tagName);
  if (!existing) {
    customElements.define(tagName, ctor);
  } else if (existing !== ctor) {
    console.warn(`[glyphcraft-kit] <${tagName}> ya estaba registrado con otra clase; se mantiene la existente.`);
  }
  return ctor;
}

/**
 * Patrón "upgrade property".
 *
 * Si alguien asigna una propiedad (`el.quality = 'low'`) **antes** de que el
 * custom element esté definido (p. ej. porque su módulo se carga en
 * diferido), esa asignación crea una propiedad propia del objeto que tapa el
 * setter de la clase cuando el elemento se actualiza. Esta función recoge
 * esos valores, los borra y los vuelve a asignar pasando por el setter.
 *
 * Se llama en `connectedCallback`.
 *
 * @param {HTMLElement} element
 * @param {string[]} properties
 */
export function upgradeProperties(element, properties) {
  for (const property of properties) {
    if (Object.prototype.hasOwnProperty.call(element, property)) {
      const value = /** @type {any} */ (element)[property];
      delete (/** @type {any} */ (element))[property];
      /** @type {any} */ (element)[property] = value;
    }
  }
}
