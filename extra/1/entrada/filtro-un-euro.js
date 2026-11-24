// @ts-check
/**
 * Filtro "One Euro" (Casiez, Roussel y Vogel, CHI 2012). Reutilizado de
 * GlyphCraft.
 *
 * Problema: la posición detectada de la mano tiembla un poco en cada
 * fotograma. Un suavizado fijo quita el temblor pero añade retraso.
 *
 * Solución: un filtro paso bajo cuya frecuencia de corte sube con la
 * velocidad:
 * - mano quieta → corte bajo → suaviza mucho (adiós temblor);
 * - mano rápida → corte alto → casi no suaviza (sin retraso).
 *
 * Parámetros: `minimo` (Hz, suavizado en reposo), `beta` (cuánto sube el
 * corte con la velocidad) y `corteDerivada` (Hz, suavizado de la velocidad).
 */

/** @param {number} corte Hz @param {number} dt s */
function factor(corte, dt) {
  const tau = 1 / (2 * Math.PI * corte);
  return 1 / (1 + tau / dt);
}

export class FiltroUnEuro {
  #minimo;
  #beta;
  #corteDerivada;
  /** @type {number | null} */ #valor = null;
  #derivada = 0;
  /** @type {number | null} */ #tiempo = null;

  /** @param {{ minimo?: number, beta?: number, corteDerivada?: number }} [opciones] */
  constructor({ minimo = 1.5, beta = 8, corteDerivada = 1 } = {}) {
    if (!(minimo > 0) || !(corteDerivada > 0) || !(beta >= 0)) throw new RangeError('FiltroUnEuro: parámetros no válidos.');
    this.#minimo = minimo;
    this.#beta = beta;
    this.#corteDerivada = corteDerivada;
  }

  /** @param {number} valor @param {number} t Segundos (deben crecer). */
  filtrar(valor, t) {
    if (this.#valor === null || this.#tiempo === null) {
      this.#valor = valor;
      this.#tiempo = t;
      return valor;
    }
    if (t <= this.#tiempo) return this.#valor;
    const dt = t - this.#tiempo;
    const derivada = (valor - this.#valor) / dt;
    const aD = factor(this.#corteDerivada, dt);
    this.#derivada = aD * derivada + (1 - aD) * this.#derivada;
    const a = factor(this.#minimo + this.#beta * Math.abs(this.#derivada), dt);
    this.#valor = a * valor + (1 - a) * this.#valor;
    this.#tiempo = t;
    return this.#valor;
  }

  reiniciar() {
    this.#valor = null;
    this.#derivada = 0;
    this.#tiempo = null;
  }
}

/** Dos filtros, para un punto (x, y). */
export class FiltroPunto {
  #x;
  #y;

  /** @param {ConstructorParameters<typeof FiltroUnEuro>[0]} [opciones] */
  constructor(opciones) {
    this.#x = new FiltroUnEuro(opciones);
    this.#y = new FiltroUnEuro(opciones);
  }

  /** @param {{ x: number, y: number }} p @param {number} t */
  filtrar(p, t) {
    return { x: this.#x.filtrar(p.x, t), y: this.#y.filtrar(p.y, t) };
  }

  reiniciar() {
    this.#x.reiniciar();
    this.#y.reiniciar();
  }
}
