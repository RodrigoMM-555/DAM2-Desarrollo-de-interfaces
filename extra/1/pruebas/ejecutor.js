/**
 * Ejecutor de pruebas mínimo para el navegador.
 *
 * Imita la parte de la API de Vitest que usan las pruebas del proyecto
 * (`describe`, `it`, `expect`, `vi`, `userEvent`…), así las pruebas se
 * escriben igual que con Vitest pero se ejecutan abriendo `pruebas.html`
 * con Live Server, sin instalar nada.
 *
 * Cada archivo de pruebas se ejecuta en su propio <iframe> (como hace Vitest),
 * para que el estado global de uno (componentes registrados, catálogo de
 * glifos, DOM…) no afecte a los demás. Ver `pruebas/pagina.js`.
 */

const TIEMPO_MAXIMO_MS = 5000;

// ── Registro de pruebas ──────────────────────────────────────

/**
 * @typedef {object} Grupo
 * @property {string} nombre
 * @property {Grupo | null} padre
 * @property {Array<{tipo: 'prueba', nombre: string, fn: Function} | {tipo: 'grupo', grupo: Grupo}>} hijos
 * @property {Function[]} antesDeCada
 * @property {Function[]} despuesDeCada
 * @property {Function[]} antesDeTodo
 * @property {Function[]} despuesDeTodo
 */

/** @returns {Grupo} */
const nuevoGrupo = (nombre, padre) => ({
  nombre, padre, hijos: [], antesDeCada: [], despuesDeCada: [], antesDeTodo: [], despuesDeTodo: [],
});

const raiz = nuevoGrupo('', null);
let grupoActual = raiz;

/**
 * Agrupa pruebas relacionadas.
 * @param {string} nombre
 * @param {() => void} fn
 */
export function describe(nombre, fn) {
  const grupo = nuevoGrupo(nombre, grupoActual);
  grupoActual.hijos.push({ tipo: 'grupo', grupo });
  const anterior = grupoActual;
  grupoActual = grupo;
  try {
    fn();
  } finally {
    grupoActual = anterior;
  }
}

/**
 * Declara una prueba.
 * @param {string} nombre
 * @param {Function} fn
 */
export function it(nombre, fn) {
  grupoActual.hijos.push({ tipo: 'prueba', nombre, fn });
}

/**
 * `it.each(casos)('nombre %s', fn)`: una prueba por cada caso.
 * @param {unknown[][]} casos
 */
it.each = (casos) => (/** @type {string} */ nombre, /** @type {Function} */ fn) => {
  for (const caso of casos) {
    const args = Array.isArray(caso) ? caso : [caso];
    let i = 0;
    const titulo = nombre.replace(/%[sdio]/g, () => String(args[i++]));
    it(titulo, () => fn(...args));
  }
};
export const test = it;

export const beforeEach = (/** @type {Function} */ fn) => void grupoActual.antesDeCada.push(fn);
export const afterEach = (/** @type {Function} */ fn) => void grupoActual.despuesDeCada.push(fn);
export const beforeAll = (/** @type {Function} */ fn) => void grupoActual.antesDeTodo.push(fn);
export const afterAll = (/** @type {Function} */ fn) => void grupoActual.despuesDeTodo.push(fn);

// ── Comparaciones ────────────────────────────────────────────

/** Marca de los comparadores asimétricos (`expect.arrayContaining`…). */
const ASIMETRICO = Symbol('asimetrico');

/**
 * @param {string} descripcion
 * @param {(valor: unknown) => boolean} comprobar
 */
const asimetrico = (descripcion, comprobar) => ({ [ASIMETRICO]: true, comprobar, toString: () => descripcion });

/**
 * Igualdad profunda al estilo de `toEqual`: ignora las propiedades con valor
 * `undefined` y no compara el prototipo.
 * @param {unknown} a
 * @param {unknown} b
 * @param {boolean} [subconjunto] Si es true, `b` solo tiene que estar contenido en `a` (toMatchObject).
 * @returns {boolean}
 */
function iguales(a, b, subconjunto = false) {
  if (b && typeof b === 'object' && ASIMETRICO in b) return /** @type {any} */ (b).comprobar(a);
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp) return String(a) === String(b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = /** @type {unknown[]} */ (b);
    if (a.length !== bb.length) return false;
    return a.every((x, i) => iguales(x, bb[i], subconjunto));
  }
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [k, v] of b) if (!a.has(k) || !iguales(a.get(k), v, subconjunto)) return false;
    return true;
  }
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const v of b) if (![...a].some((x) => iguales(x, v, subconjunto))) return false;
    return true;
  }
  if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
    return iguales(Array.from(/** @type {any} */ (a)), Array.from(/** @type {any} */ (b)));
  }
  const claves = (/** @type {object} */ o) => Object.keys(o).filter((k) => /** @type {any} */ (o)[k] !== undefined);
  const ka = claves(a);
  const kb = claves(b);
  if (!subconjunto && ka.length !== kb.length) return false;
  return kb.every((k) => k in a && iguales(/** @type {any} */ (a)[k], /** @type {any} */ (b)[k], subconjunto));
}

/** Representación corta de un valor para los mensajes de error. */
function mostrar(valor) {
  if (typeof valor === 'function') return valor.name ? `[función ${valor.name}]` : '[función]';
  if (valor instanceof Element) return `<${valor.localName}>`;
  if (valor && typeof valor === 'object' && ASIMETRICO in valor) return String(valor);
  try {
    const texto = JSON.stringify(valor, (_, v) => (typeof v === 'bigint' ? String(v) : v));
    if (texto === undefined) return String(valor);
    return texto.length > 200 ? `${texto.slice(0, 200)}…` : texto;
  } catch {
    return String(valor);
  }
}

class ErrorDeComprobacion extends Error {
  name = 'ErrorDeComprobacion';
}

// ── expect ───────────────────────────────────────────────────

/**
 * Comprueba si una función lanza el error esperado.
 * @param {unknown} error El error lanzado (o `SIN_ERROR`).
 * @param {unknown} esperado Clase, texto, expresión regular o nada.
 */
function coincideError(error, esperado) {
  if (esperado === undefined) return true;
  const mensaje = error instanceof Error ? error.message : String(error);
  if (typeof esperado === 'function') return error instanceof esperado;
  if (typeof esperado === 'string') return mensaje.includes(esperado);
  if (esperado instanceof RegExp) return esperado.test(mensaje);
  if (esperado instanceof Error) return mensaje === esperado.message;
  return false;
}

const SIN_ERROR = Symbol('sin-error');

/** @param {any} fnSimulada */
const llamadas = (fnSimulada) => {
  if (!fnSimulada?.mock) throw new ErrorDeComprobacion(`${mostrar(fnSimulada)} no es una función simulada (vi.fn)`);
  return /** @type {unknown[][]} */ (fnSimulada.mock.calls);
};

/**
 * Comparadores. Cada uno devuelve `[cumple, mensaje]`.
 * @type {Record<string, (real: any, ...esperado: any[]) => [boolean, string]>}
 */
const COMPARADORES = {
  toBe: (r, e) => [Object.is(r, e), `se esperaba ${mostrar(e)} y se obtuvo ${mostrar(r)}`],
  toEqual: (r, e) => [iguales(r, e), `se esperaba igual a ${mostrar(e)} y se obtuvo ${mostrar(r)}`],
  toStrictEqual: (r, e) => [iguales(r, e), `se esperaba igual a ${mostrar(e)} y se obtuvo ${mostrar(r)}`],
  toMatchObject: (r, e) => [iguales(r, e, true), `se esperaba que ${mostrar(r)} contuviera ${mostrar(e)}`],
  toBeNull: (r) => [r === null, `se esperaba null y se obtuvo ${mostrar(r)}`],
  toBeUndefined: (r) => [r === undefined, `se esperaba undefined y se obtuvo ${mostrar(r)}`],
  toBeDefined: (r) => [r !== undefined, 'se esperaba un valor definido'],
  toBeTruthy: (r) => [Boolean(r), `se esperaba un valor verdadero y se obtuvo ${mostrar(r)}`],
  toBeFalsy: (r) => [!r, `se esperaba un valor falso y se obtuvo ${mostrar(r)}`],
  toBeNaN: (r) => [Number.isNaN(r), `se esperaba NaN y se obtuvo ${mostrar(r)}`],
  toBeGreaterThan: (r, e) => [r > e, `se esperaba ${mostrar(r)} > ${mostrar(e)}`],
  toBeGreaterThanOrEqual: (r, e) => [r >= e, `se esperaba ${mostrar(r)} >= ${mostrar(e)}`],
  toBeLessThan: (r, e) => [r < e, `se esperaba ${mostrar(r)} < ${mostrar(e)}`],
  toBeLessThanOrEqual: (r, e) => [r <= e, `se esperaba ${mostrar(r)} <= ${mostrar(e)}`],
  toBeCloseTo: (r, e, digitos = 2) => [
    Math.abs(r - e) < 10 ** -digitos / 2,
    `se esperaba ${mostrar(r)} ≈ ${mostrar(e)} (${digitos} decimales)`,
  ],
  toBeInstanceOf: (r, e) => [r instanceof e, `se esperaba una instancia de ${e?.name}`],
  toContain: (r, e) => [
    r != null && typeof r.includes === 'function' && r.includes(e),
    `se esperaba que ${mostrar(r)} contuviera ${mostrar(e)}`,
  ],
  toHaveLength: (r, e) => [r?.length === e, `se esperaba longitud ${e} y se obtuvo ${r?.length}`],
  toHaveProperty: (r, ruta, ...valor) => {
    const partes = Array.isArray(ruta) ? ruta : String(ruta).split('.');
    let actual = r;
    for (const parte of partes) {
      if (actual == null || !(parte in Object(actual))) {
        return [false, `se esperaba la propiedad ${partes.join('.')}`];
      }
      actual = actual[parte];
    }
    if (valor.length === 0) return [true, `no se esperaba la propiedad ${partes.join('.')}`];
    return [iguales(actual, valor[0]), `se esperaba ${partes.join('.')} = ${mostrar(valor[0])} y es ${mostrar(actual)}`];
  },
  toMatch: (r, e) => [
    typeof r === 'string' && (e instanceof RegExp ? e.test(r) : r.includes(e)),
    `se esperaba que ${mostrar(r)} coincidiera con ${String(e)}`,
  ],
  toThrow: (r, e) => {
    let error = SIN_ERROR;
    if (r === SIN_ERROR || (r && typeof r === 'object' && 'rechazo' in r)) {
      error = r === SIN_ERROR ? SIN_ERROR : r.rechazo; // viene de .rejects
    } else {
      try {
        r();
      } catch (err) {
        error = err;
      }
    }
    if (error === SIN_ERROR) return [false, 'se esperaba que lanzara un error'];
    return [coincideError(error, e), `lanzó ${mostrar(error instanceof Error ? `${error.name}: ${error.message}` : error)}, que no coincide con ${mostrar(e?.name ?? e)}`];
  },
  toHaveBeenCalled: (r) => [llamadas(r).length > 0, `se esperaba alguna llamada y hubo ${llamadas(r).length}`],
  toHaveBeenCalledOnce: (r) => [llamadas(r).length === 1, `se esperaba 1 llamada y hubo ${llamadas(r).length}`],
  toHaveBeenCalledTimes: (r, n) => [llamadas(r).length === n, `se esperaban ${n} llamadas y hubo ${llamadas(r).length}`],
  toHaveBeenCalledWith: (r, ...args) => [
    llamadas(r).some((c) => iguales(c, args)),
    `se esperaba una llamada con ${mostrar(args)}; llamadas: ${mostrar(llamadas(r))}`,
  ],
};

/**
 * Crea el objeto con los comparadores para un valor.
 * @param {unknown} real
 * @param {boolean} negado
 */
function comparadores(real, negado) {
  /** @type {Record<string, Function>} */
  const objeto = {};
  for (const [nombre, comparar] of Object.entries(COMPARADORES)) {
    objeto[nombre] = (/** @type {any[]} */ ...esperado) => {
      const [cumple, mensaje] = comparar(real, ...esperado);
      if (cumple === negado) {
        throw new ErrorDeComprobacion(`${negado ? 'NO ' : ''}${nombre}: ${negado ? `no ${mensaje}` : mensaje}`);
      }
    };
  }
  return objeto;
}

/**
 * Comparadores sobre una promesa (`.resolves` y `.rejects`).
 * @param {Promise<unknown>} promesa
 * @param {'resolves' | 'rejects'} modo
 * @param {boolean} negado
 */
function comparadoresAsincronos(promesa, modo, negado) {
  /** @type {Record<string, Function>} */
  const objeto = {};
  for (const nombre of Object.keys(COMPARADORES)) {
    objeto[nombre] = async (/** @type {any[]} */ ...esperado) => {
      let valor;
      try {
        valor = await promesa;
      } catch (error) {
        if (modo === 'resolves') throw new ErrorDeComprobacion(`se esperaba que se resolviera y se rechazó: ${error}`);
        return comparadores({ rechazo: error }, negado)[nombre](...esperado);
      }
      if (modo === 'rejects') {
        if (nombre === 'toThrow') return comparadores(SIN_ERROR, negado)[nombre](...esperado);
        throw new ErrorDeComprobacion('se esperaba que la promesa se rechazara');
      }
      return comparadores(valor, negado)[nombre](...esperado);
    };
  }
  return objeto;
}

/**
 * `expect(valor).toBe(...)`, `.not.toBe(...)`, `.rejects.toThrow(...)`…
 * @param {unknown} real
 */
export function expect(real) {
  return {
    ...comparadores(real, false),
    not: comparadores(real, true),
    resolves: comparadoresAsincronos(/** @type {Promise<unknown>} */ (real), 'resolves', false),
    rejects: comparadoresAsincronos(/** @type {Promise<unknown>} */ (real), 'rejects', false),
  };
}

/** @param {unknown[]} esperado */
expect.arrayContaining = (esperado) =>
  asimetrico(`arrayContaining(${mostrar(esperado)})`, (r) =>
    Array.isArray(r) && esperado.every((e) => r.some((x) => iguales(x, e))),
  );
/** @param {string} texto */
expect.stringContaining = (texto) =>
  asimetrico(`stringContaining(${mostrar(texto)})`, (r) => typeof r === 'string' && r.includes(texto));
/** @param {object} objeto */
expect.objectContaining = (objeto) =>
  asimetrico(`objectContaining(${mostrar(objeto)})`, (r) => iguales(r, objeto, true));
/** @param {Function} clase */
expect.any = (clase) =>
  asimetrico(`any(${clase.name})`, (r) =>
    r != null && (r instanceof clase || Object(r) instanceof clase || typeof r === clase.name.toLowerCase()),
  );

// ── vi: funciones simuladas y esperas ────────────────────────

/** @type {Array<() => void>} */
const restauradores = [];

/**
 * Crea una función simulada que recuerda sus llamadas.
 * @param {Function} [implementacion]
 */
function fn(implementacion) {
  let impl = implementacion;
  /** @type {any} */
  const simulada = function (/** @type {any[]} */ ...args) {
    simulada.mock.calls.push(args);
    simulada.mock.instances.push(this);
    try {
      const valor = impl ? impl.apply(this, args) : undefined;
      simulada.mock.results.push({ type: 'return', value: valor });
      return valor;
    } catch (error) {
      simulada.mock.results.push({ type: 'throw', value: error });
      throw error;
    }
  };
  simulada.mock = { calls: [], results: [], instances: [] };
  simulada.mockImplementation = (/** @type {Function} */ nueva) => ((impl = nueva), simulada);
  simulada.mockReturnValue = (/** @type {unknown} */ v) => ((impl = () => v), simulada);
  simulada.mockResolvedValue = (/** @type {unknown} */ v) => ((impl = () => Promise.resolve(v)), simulada);
  simulada.mockRejectedValue = (/** @type {unknown} */ v) => ((impl = () => Promise.reject(v)), simulada);
  simulada.mockClear = () => {
    simulada.mock.calls.length = 0;
    simulada.mock.results.length = 0;
    simulada.mock.instances.length = 0;
    return simulada;
  };
  simulada.mockRestore = () => simulada;
  return simulada;
}

/**
 * Sustituye un método de un objeto por una función simulada que, por
 * defecto, sigue llamando al original.
 * @param {any} objeto
 * @param {string} metodo
 */
function spyOn(objeto, metodo) {
  const original = objeto[metodo];
  const propia = Object.prototype.hasOwnProperty.call(objeto, metodo);
  const espia = fn(function (/** @type {any[]} */ ...args) {
    return original.apply(this, args);
  });
  const restaurar = () => {
    if (propia) objeto[metodo] = original;
    else delete objeto[metodo];
  };
  espia.mockRestore = () => (restaurar(), espia);
  restauradores.push(restaurar);
  objeto[metodo] = espia;
  return espia;
}

/**
 * Repite `comprobar` hasta que no lance error (o se agote el tiempo).
 * @param {() => unknown} comprobar
 * @param {{ timeout?: number, interval?: number } | number} [opciones]
 */
async function waitFor(comprobar, opciones = {}) {
  const { timeout = 1000, interval = 50 } = typeof opciones === 'number' ? { timeout: opciones } : opciones;
  const limite = performance.now() + timeout;
  for (;;) {
    try {
      return await comprobar();
    } catch (error) {
      if (performance.now() > limite) throw error;
      await new Promise((r) => setTimeout(r, interval));
    }
  }
}

export const vi = {
  fn,
  spyOn,
  waitFor,
  restoreAllMocks() {
    while (restauradores.length) restauradores.pop()?.();
  },
};

// ── userEvent: interacción simulada ──────────────────────────

/** Elemento con el foco, entrando en los Shadow DOM. */
function elementoActivo() {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return el ?? document.body;
}

/**
 * Elemento más profundo en un punto de la pantalla, entrando en los Shadow DOM.
 * Si en el punto hay contenido proyectado en un <slot> (p. ej. el texto de un
 * botón), devuelve el elemento interno que lo contiene: así el evento recorre
 * el mismo camino que un clic real.
 */
function elementoEnPunto(x, y) {
  let el = document.elementFromPoint(x, y);
  while (el?.shadowRoot) {
    const raizSombra = el.shadowRoot;
    const interior = raizSombra
      .elementsFromPoint(x, y)
      .find((e) => e !== el && e.getRootNode() === raizSombra);
    if (!interior) break;
    el = interior;
  }
  return el;
}

const espera = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));

// Los punteros simulados no son punteros reales del navegador, así que
// setPointerCapture() fallaría con NotFoundError. Se ignora ese caso: la
// captura se imita enviando los eventos siguientes al mismo elemento.
const capturaOriginal = Element.prototype.setPointerCapture;
Element.prototype.setPointerCapture = function (id) {
  try {
    capturaOriginal.call(this, id);
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error;
  }
};

/** @type {Set<string>} Teclas mantenidas con `{Tecla>}`. */
const teclasPulsadas = new Set();

/**
 * Acción por defecto de algunas teclas en un <input type="range">. Los eventos
 * simulados no la producen (el navegador solo la aplica a teclas reales).
 * @param {Element} destino
 * @param {string} tecla
 */
function teclaEnDeslizador(destino, tecla) {
  if (!(destino instanceof HTMLInputElement) || destino.type !== 'range' || destino.disabled) return;
  const paso = Number(destino.step) || 1;
  const min = Number(destino.min || 0);
  const max = Number(destino.max || 100);
  const actual = Number(destino.value);
  const nuevo = {
    ArrowRight: actual + paso, ArrowUp: actual + paso,
    ArrowLeft: actual - paso, ArrowDown: actual - paso,
    PageUp: actual + paso * 10, PageDown: actual - paso * 10,
    Home: min, End: max,
  }[tecla];
  if (nuevo === undefined) return;
  const limitado = Math.min(max, Math.max(min, nuevo));
  if (limitado === actual) return;
  destino.value = String(limitado);
  destino.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  destino.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Divide el texto de `keyboard()` en teclas: `{Enter}`, `{Enter>}`, `{/Enter}`
 * o caracteres sueltos (`' '`, `'a'`…).
 * @param {string} texto
 */
function teclas(texto) {
  return [...texto.matchAll(/\{(\/?)([^}>]+)(>?)\}|(.)/gs)].map(([, cierre, nombre, mantener, caracter]) => ({
    cierre: Boolean(cierre),
    tecla: caracter ?? nombre,
    mantener: Boolean(mantener),
  }));
}

export const userEvent = {
  /**
   * Hace clic en el centro del elemento, con la misma secuencia de eventos
   * que un ratón real (pointerdown → mousedown → foco → pointerup → mouseup → click).
   * @param {Element} elemento
   */
  async click(elemento) {
    elemento.scrollIntoView({ block: 'center', inline: 'center' });
    const caja = elemento.getBoundingClientRect();
    const x = caja.left + caja.width / 2;
    const y = caja.top + caja.height / 2;
    const destino = elementoEnPunto(x, y) ?? elemento;
    const base = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, view: window };
    const puntero = { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    destino.dispatchEvent(new PointerEvent('pointerdown', { ...puntero, buttons: 1 }));
    destino.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1, detail: 1 }));
    /** @type {HTMLElement | null} */ (destino.closest('button, [tabindex], input, select, textarea, a[href]'))?.focus();
    destino.dispatchEvent(new PointerEvent('pointerup', puntero));
    destino.dispatchEvent(new MouseEvent('mouseup', { ...base, detail: 1 }));
    destino.dispatchEvent(new MouseEvent('click', { ...base, detail: 1 }));
    await espera();
  },

  /**
   * Pulsa teclas sobre el elemento con el foco. Sintaxis de Vitest:
   * `{Enter}` pulsa y suelta, `{Enter>}` mantiene pulsada, `{/Enter}` suelta,
   * y un carácter suelto (`' '`) pulsa esa tecla.
   * Enter o Espacio sobre un botón generan además su clic (con `detail` 0).
   * @param {string} texto
   */
  async keyboard(texto) {
    for (const { cierre, tecla, mantener } of teclas(texto)) {
      const destino = elementoActivo();
      const key = tecla === 'Space' ? ' ' : tecla;
      const opciones = { key, code: tecla, bubbles: true, cancelable: true, composed: true };
      const esBoton = destino instanceof HTMLButtonElement && !destino.disabled;
      const clicDeTeclado = () =>
        destino.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, detail: 0 }));
      if (!cierre) {
        const abajo = new KeyboardEvent('keydown', { ...opciones, repeat: teclasPulsadas.has(tecla) });
        destino.dispatchEvent(abajo);
        if (!abajo.defaultPrevented) {
          if (esBoton && key === 'Enter') clicDeTeclado();
          teclaEnDeslizador(destino, key);
        }
        if (mantener) {
          teclasPulsadas.add(tecla);
          continue;
        }
      }
      teclasPulsadas.delete(tecla);
      const arriba = new KeyboardEvent('keyup', opciones);
      destino.dispatchEvent(arriba);
      if (!arriba.defaultPrevented && esBoton && key === ' ') clicDeTeclado();
    }
    await espera();
  },

  /**
   * Secuencia de acciones de puntero (sintaxis de Vitest):
   * `{ target, keys: '[MouseLeft>]', coords: {x, y} }` pulsa,
   * `{ coords }` mueve y `{ keys: '[/MouseLeft]' }` suelta.
   * Las coordenadas son de la ventana (clientX / clientY).
   * @param {Array<{ target?: Element, keys?: string, coords?: {x: number, y: number} }>} acciones
   */
  async pointer(acciones) {
    let x = 0;
    let y = 0;
    /** @type {Element | null} */
    let objetivo = null;
    let pulsado = false;
    for (const accion of acciones) {
      if (accion.coords) ({ x, y } = accion.coords);
      if (accion.target) objetivo = accion.target;
      // Mientras el botón está pulsado los eventos van al mismo elemento (captura).
      const destino = pulsado && objetivo ? objetivo : (accion.target ?? elementoEnPunto(x, y) ?? objetivo);
      if (!destino) continue;
      const base = {
        bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, view: window,
        pointerId: 1, pointerType: 'mouse', isPrimary: true,
      };
      if (accion.keys === '[MouseLeft>]') {
        destino.dispatchEvent(new PointerEvent('pointerdown', { ...base, buttons: 1 }));
        objetivo = destino;
        pulsado = true;
      } else if (accion.keys === '[/MouseLeft]') {
        destino.dispatchEvent(new PointerEvent('pointerup', { ...base, buttons: 0 }));
        pulsado = false;
      } else {
        destino.dispatchEvent(new PointerEvent('pointermove', { ...base, button: -1, buttons: pulsado ? 1 : 0 }));
      }
      await espera();
    }
  },
};

// ── Ejecución ────────────────────────────────────────────────

/**
 * @typedef {object} Resultado
 * @property {string} nombre Ruta completa: «grupo › subgrupo › prueba».
 * @property {'ok' | 'fallo'} estado
 * @property {number} ms
 * @property {string} [error]
 */

/**
 * Ejecuta una función con tiempo máximo.
 * @param {Function} funcion
 */
async function conTiempoMaximo(funcion) {
  let temporizador = 0;
  const limite = new Promise((_, rechazar) => {
    temporizador = window.setTimeout(
      () => rechazar(new Error(`Tiempo agotado (${TIEMPO_MAXIMO_MS} ms)`)),
      TIEMPO_MAXIMO_MS,
    );
  });
  try {
    await Promise.race([funcion(), limite]);
  } finally {
    clearTimeout(temporizador);
  }
}

/** Todos los ganchos de un tipo desde la raíz hasta `grupo`. */
function ganchos(grupo, tipo) {
  /** @type {Function[]} */
  const lista = [];
  for (let g = grupo; g; g = g.padre) lista.unshift(...g[tipo]);
  return lista;
}

/**
 * Ejecuta las pruebas de un grupo y sus subgrupos.
 * @param {Grupo} grupo
 * @param {string[]} ruta
 * @param {Resultado[]} resultados
 */
async function ejecutarGrupo(grupo, ruta, resultados) {
  for (const gancho of grupo.antesDeTodo) await gancho();
  for (const hijo of grupo.hijos) {
    if (hijo.tipo === 'grupo') {
      await ejecutarGrupo(hijo.grupo, [...ruta, hijo.grupo.nombre], resultados);
      continue;
    }
    const nombre = [...ruta, hijo.nombre].join(' › ');
    const inicio = performance.now();
    try {
      for (const gancho of ganchos(grupo, 'antesDeCada')) await gancho();
      try {
        await conTiempoMaximo(hijo.fn);
      } finally {
        // Los ganchos «después» se ejecutan del más interno al más externo.
        for (const gancho of ganchos(grupo, 'despuesDeCada').reverse()) await gancho();
      }
      resultados.push({ nombre, estado: 'ok', ms: performance.now() - inicio });
    } catch (error) {
      const texto = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      resultados.push({ nombre, estado: 'fallo', ms: performance.now() - inicio, error: texto });
      console.error(`✗ ${nombre}\n`, error);
    }
  }
  for (const gancho of grupo.despuesDeTodo) await gancho();
}

/**
 * Importa un archivo de pruebas y ejecuta todo lo que haya declarado.
 * @param {string} url
 * @returns {Promise<Resultado[]>}
 */
export async function ejecutarArchivo(url) {
  /** @type {Resultado[]} */
  const resultados = [];
  try {
    await import(url);
    await ejecutarGrupo(raiz, [], resultados);
  } catch (error) {
    const texto = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    resultados.push({ nombre: '(error al cargar el archivo)', estado: 'fallo', ms: 0, error: texto });
    console.error(error);
  }
  return resultados;
}
