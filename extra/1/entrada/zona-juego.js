// @ts-check
/**
 * Zona de juego: traduce la posición de una mano a un carril (0–3) o a
 * `null` si está fuera.
 *
 * Coordenadas normalizadas (0–1) **desde el punto de vista del jugador**:
 * x = 0 es su izquierda, y = 0 es arriba. La zona es un rectángulo de la
 * imagen dividido en 4 columnas iguales.
 *
 *    izquierda              derecha
 *   arriba ┌─────┬─────┬─────┬─────┐
 *          │  0  │  1  │  2  │  3  │
 *    abajo └─────┴─────┴─────┴─────┘
 *            (por debajo: manos en reposo, no cuentan)
 *
 * **Histéresis:** para cambiar de carril hay que entrar un poco (`histeresis`,
 * en fracción de carril) en el nuevo. Así la mano no "parpadea" entre dos
 * carriles cuando está justo en la frontera.
 *
 * Lógica pura.
 */

/** @typedef {{ x: number, y: number }} Punto */
/** @typedef {{ izquierda: number, derecha: number, arriba: number, abajo: number }} Rectangulo */

export const CARRILES = 4;

/** Zona por defecto para jugar sentado delante del portátil. */
export const ZONA_POR_DEFECTO = Object.freeze({ izquierda: 0.08, derecha: 0.92, arriba: 0.12, abajo: 0.78 });

/**
 * Margen (fracción de la anchura de la zona) por fuera de los lados en el
 * que la mano todavía cuenta en el carril del borde: estirar el brazo de más
 * no debe sacarte del carril 0 o 3.
 */
const MARGEN_LATERAL = 0.12;

export class ZonaJuego {
  /** @type {Rectangulo} */
  #zona;
  #histeresis;
  /** Último carril de cada mano (para la histéresis). */
  #anterior = { i: /** @type {number | null} */ (null), d: /** @type {number | null} */ (null) };

  /** @param {Rectangulo} [zona] @param {number} [histeresis] */
  constructor(zona = ZONA_POR_DEFECTO, histeresis = 0.15) {
    this.#zona = { ...ZONA_POR_DEFECTO };
    this.zona = zona;
    this.#histeresis = histeresis;
  }

  get zona() {
    return { ...this.#zona };
  }

  /** @param {Rectangulo} zona */
  set zona(zona) {
    const { izquierda, derecha, arriba, abajo } = zona;
    if (!(izquierda >= 0 && derecha <= 1 && derecha - izquierda >= 0.2 && arriba >= 0 && abajo <= 1 && abajo - arriba >= 0.1)) {
      throw new RangeError('ZonaJuego: la zona debe estar dentro de la imagen y tener un tamaño mínimo.');
    }
    this.#zona = { izquierda, derecha, arriba, abajo };
  }

  /**
   * @param {'i' | 'd'} mano
   * @param {Punto | null} punto
   * @returns {number | null}
   */
  carril(mano, punto) {
    const resultado = this.#calcular(punto, this.#anterior[mano]);
    this.#anterior[mano] = resultado;
    return resultado;
  }

  /**
   * Posición de un punto relativa a la zona, para dibujarla en la pista:
   * `u` = 0 en el borde izquierdo y 1 en el derecho (puede salirse un poco);
   * `dentro` = cuenta para algún carril (altura correcta y no muy fuera de los lados).
   * @param {Punto | null} punto
   * @returns {{ u: number, dentro: boolean } | null}
   */
  posicionRelativa(punto) {
    if (!punto) return null;
    const { izquierda, derecha } = this.#zona;
    return { u: (punto.x - izquierda) / (derecha - izquierda), dentro: this.#calcular(punto, null) !== null };
  }

  /** Olvida la histéresis (al empezar una partida). */
  reiniciar() {
    this.#anterior = { i: null, d: null };
  }

  /**
   * @param {Punto | null} punto
   * @param {number | null} anterior
   */
  #calcular(punto, anterior) {
    if (!punto) return null;
    const { izquierda, derecha, arriba, abajo } = this.#zona;
    if (punto.y < arriba || punto.y > abajo) return null;
    const ancho = derecha - izquierda;
    if (punto.x < izquierda - ancho * MARGEN_LATERAL || punto.x > derecha + ancho * MARGEN_LATERAL) return null;

    // Posición en "unidades de carril": 0 en el borde izquierdo, 4 en el derecho.
    const u = Math.min(CARRILES - 1e-9, Math.max(0, ((punto.x - izquierda) / ancho) * CARRILES));
    const nuevo = Math.floor(u);
    if (anterior === null || nuevo === anterior) return nuevo;
    // Cambia solo si ha entrado lo suficiente en el carril nuevo.
    if (nuevo > anterior && u >= anterior + 1 + this.#histeresis) return nuevo;
    if (nuevo < anterior && u <= anterior - this.#histeresis) return nuevo;
    return anterior;
  }
}
