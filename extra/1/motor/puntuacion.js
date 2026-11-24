// @ts-check
/**
 * Puntos, combo, precisión y nota final.
 * Lógica pura.
 */

/** @typedef {import('./juez.js').Calificacion} Calificacion */

/** Puntos base de cada calificación. */
export const PUNTOS = Object.freeze({ perfecto: 300, bien: 200, justo: 100, fallo: 0 });

/**
 * El combo multiplica los puntos: ×2 a partir de 10 aciertos seguidos,
 * ×3 a partir de 25 y ×4 a partir de 50.
 * @param {number} combo
 */
export function multiplicador(combo) {
  if (combo >= 50) return 4;
  if (combo >= 25) return 3;
  if (combo >= 10) return 2;
  return 1;
}

/**
 * Nota final según la precisión (0 a 1).
 * @param {number} precision
 * @returns {'S' | 'A' | 'B' | 'C' | 'D'}
 */
export function notaFinal(precision) {
  if (precision >= 0.95) return 'S';
  if (precision >= 0.9) return 'A';
  if (precision >= 0.8) return 'B';
  if (precision >= 0.7) return 'C';
  return 'D';
}

/**
 * @typedef {object} Resumen
 * @property {number} puntos
 * @property {number} combo
 * @property {number} comboMaximo
 * @property {number} multiplicador
 * @property {number} precision 0 a 1 sobre las notas juzgadas.
 * @property {'S' | 'A' | 'B' | 'C' | 'D'} nota
 * @property {Record<Calificacion, number>} cuenta
 * @property {number} juzgadas
 */

export class Puntuacion {
  #puntos = 0;
  #combo = 0;
  #comboMaximo = 0;
  #base = 0; // puntos sin multiplicador, para la precisión
  #cuenta = { perfecto: 0, bien: 0, justo: 0, fallo: 0 };

  /**
   * Suma una nota juzgada.
   * @param {Calificacion} calificacion
   * @returns {number} Puntos ganados con esta nota.
   */
  registrar(calificacion) {
    if (!(calificacion in PUNTOS)) throw new RangeError(`Calificación desconocida: ${calificacion}`);
    this.#cuenta[calificacion]++;
    if (calificacion === 'fallo') {
      this.#combo = 0;
      return 0;
    }
    this.#combo++;
    this.#comboMaximo = Math.max(this.#comboMaximo, this.#combo);
    this.#base += PUNTOS[calificacion];
    const ganados = PUNTOS[calificacion] * multiplicador(this.#combo);
    this.#puntos += ganados;
    return ganados;
  }

  /** @returns {Resumen} */
  get resumen() {
    const juzgadas = Object.values(this.#cuenta).reduce((a, b) => a + b, 0);
    const precision = juzgadas ? this.#base / (juzgadas * PUNTOS.perfecto) : 1;
    return {
      puntos: this.#puntos,
      combo: this.#combo,
      comboMaximo: this.#comboMaximo,
      multiplicador: multiplicador(this.#combo),
      precision,
      nota: notaFinal(precision),
      cuenta: { ...this.#cuenta },
      juzgadas,
    };
  }
}
