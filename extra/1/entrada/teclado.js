// @ts-check
/**
 * Entrada por teclado: alternativa accesible a la cámara y herramienta para
 * probar el juego sin levantar las manos.
 *
 *   Mano izquierda: A S D F  → carriles 0 1 2 3
 *   Mano derecha:   J K L Ñ  → carriles 0 1 2 3
 *
 * Mantener pulsada una tecla = tener la mano en ese carril. Si se pulsan
 * varias de la misma mano, manda la última; al soltarla vuelve a la anterior
 * que siga pulsada.
 *
 * Se usa `event.code` (tecla física), no `event.key`: así funciona igual con
 * mayúsculas o con otra distribución de teclado. La Ñ española es `Semicolon`.
 *
 * Evento: `cambiomanos` → { i, d } (carril o null).
 */

/** @typedef {import('../motor/juez.js').EstadoManos} EstadoManos */

/** @type {Record<string, { mano: 'i' | 'd', carril: number }>} */
export const TECLAS = {
  KeyA: { mano: 'i', carril: 0 },
  KeyS: { mano: 'i', carril: 1 },
  KeyD: { mano: 'i', carril: 2 },
  KeyF: { mano: 'i', carril: 3 },
  KeyJ: { mano: 'd', carril: 0 },
  KeyK: { mano: 'd', carril: 1 },
  KeyL: { mano: 'd', carril: 2 },
  Semicolon: { mano: 'd', carril: 3 },
};

/** Etiquetas para mostrar en pantalla, por mano y carril. */
export const ETIQUETAS = { i: ['A', 'S', 'D', 'F'], d: ['J', 'K', 'L', 'Ñ'] };

export class EntradaTeclado extends EventTarget {
  /** Teclas pulsadas de cada mano, en orden de pulsación. */
  #pulsadas = { i: /** @type {number[]} */ ([]), d: /** @type {number[]} */ ([]) };
  /** @type {EventTarget | null} */
  #objetivo = null;

  /** @param {Event} evento */
  #alPulsar = (evento) => {
    const e = /** @type {KeyboardEvent} */ (evento);
    const tecla = TECLAS[e.code];
    if (!tecla || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    if (e.repeat) return;
    const lista = this.#pulsadas[tecla.mano];
    if (!lista.includes(tecla.carril)) lista.push(tecla.carril);
    this.#avisar();
  };

  /** @param {Event} evento */
  #alSoltar = (evento) => {
    const tecla = TECLAS[/** @type {KeyboardEvent} */ (evento).code];
    if (!tecla) return;
    const lista = this.#pulsadas[tecla.mano];
    const i = lista.indexOf(tecla.carril);
    if (i >= 0) lista.splice(i, 1);
    this.#avisar();
  };

  /** Si la ventana pierde el foco no llegan los `keyup`: se sueltan todas. */
  #alPerderFoco = () => {
    this.#pulsadas.i.length = 0;
    this.#pulsadas.d.length = 0;
    this.#avisar();
  };

  /** @returns {EstadoManos} */
  get estado() {
    return { i: this.#pulsadas.i.at(-1) ?? null, d: this.#pulsadas.d.at(-1) ?? null };
  }

  /** @param {EventTarget} [objetivo] Dónde escuchar (por defecto, `window`). */
  conectar(objetivo = window) {
    this.desconectar();
    this.#objetivo = objetivo;
    objetivo.addEventListener('keydown', this.#alPulsar);
    objetivo.addEventListener('keyup', this.#alSoltar);
    objetivo.addEventListener('blur', this.#alPerderFoco);
  }

  desconectar() {
    this.#objetivo?.removeEventListener('keydown', this.#alPulsar);
    this.#objetivo?.removeEventListener('keyup', this.#alSoltar);
    this.#objetivo?.removeEventListener('blur', this.#alPerderFoco);
    this.#objetivo = null;
    this.#alPerderFoco();
  }

  #avisar() {
    this.dispatchEvent(new CustomEvent('cambiomanos', { detail: this.estado }));
  }
}
