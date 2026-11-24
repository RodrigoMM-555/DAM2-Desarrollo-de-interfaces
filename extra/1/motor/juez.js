// @ts-check
/**
 * El juez decide, nota a nota, si la mano correcta estaba en el carril
 * correcto a tiempo, y con qué calificación.
 *
 * Regla (docs/DISEÑO.md §5.4):
 * - Cada nota llega a la línea en el instante T. Se comprueba durante la
 *   ventana [T − antes, T + despues].
 * - Si en algún momento de la ventana la mano está en el carril → acierto.
 *   La calificación depende de **cuándo entró** la mano en ese carril:
 *     · entró dentro de la ventana (último momento) ........ justo
 *     · entró durante el último pulso antes de la nota ...... perfecto
 *     · ya estaba antes ...................................... bien
 * - Si termina la ventana y no estaba → fallo.
 *
 * Así se premia moverse al compás y no compensa dejar las manos quietas.
 *
 * Excepción: si la mano ya acertó una nota en ese mismo carril y no se ha
 * movido, quedarse es lo correcto → perfecto.
 *
 * **Notas de mantener** (`duracion` > 0): la cabeza se juzga como una nota
 * normal. Si se acierta, el juez mide qué parte de la duración se queda la
 * mano en el carril y, al terminar, emite un segundo juicio (`tipo: 'cola'`):
 *     ≥ 85 % perfecto · ≥ 60 % bien · ≥ 30 % justo · menos, fallo.
 * Si la cabeza se falla, la cola no se juzga (no se castiga dos veces).
 *
 * Lógica pura: recibe el tiempo y el estado de las manos; no sabe si vienen
 * de la cámara o del teclado.
 */

/** @typedef {import('./partitura.js').Nota} Nota */
/** @typedef {import('./partitura.js').Mano} Mano */
/** @typedef {'perfecto' | 'bien' | 'justo' | 'fallo'} Calificacion */

/**
 * Dónde está cada mano: número de carril o `null` si no está en ninguno.
 * @typedef {{ i: number | null, d: number | null }} EstadoManos
 */

/**
 * @typedef {object} Juicio
 * @property {Nota} nota
 * @property {'cabeza' | 'cola'} tipo `cola` = final de una nota de mantener.
 * @property {Calificacion} calificacion
 * @property {number} tiempo Momento en el que se ha juzgado.
 * @property {number | null} entrada Cuándo entró la mano en el carril (null si falló).
 * @property {number} [fraccion] Solo en la cola: parte del tiempo (0–1) que la mano se mantuvo.
 */

export const VENTANA_ANTES = 0.12;
export const VENTANA_DESPUES = 0.08;

/**
 * Calificación de una nota de mantener según la parte del tiempo mantenida.
 * @param {number} fraccion 0–1
 * @returns {Calificacion}
 */
export function calificarMantener(fraccion) {
  if (fraccion >= 0.85) return 'perfecto';
  if (fraccion >= 0.6) return 'bien';
  if (fraccion >= 0.3) return 'justo';
  return 'fallo';
}

export class Juez {
  /** @type {Nota[]} */
  #notas;
  #pulso;
  #antes;
  #despues;
  /** Notas ya juzgadas (por id). */
  #juzgadas = new Set();
  /** Índice de la primera nota sin juzgar: no se recorre lo ya pasado. */
  #primera = 0;
  /** Dónde está cada mano y desde cuándo. */
  #manos = {
    i: { carril: /** @type {number | null} */ (null), desde: -Infinity },
    d: { carril: /** @type {number | null} */ (null), desde: -Infinity },
  };
  /** Tiempo de la última nota acertada de cada mano, mientras no se mueva de su carril. */
  #ultimoAcierto = { i: -Infinity, d: -Infinity };
  /**
   * Notas de mantener en curso: cuánto tiempo lleva la mano dentro y hasta
   * qué instante se ha contado.
   * @type {Map<number, { nota: Nota, dentro: number, contado: number }>}
   */
  #mantenidas = new Map();

  /**
   * @param {Nota[]} notas Ordenadas por tiempo (como las da `prepararNotas`).
   * @param {{ pulso: number, antes?: number, despues?: number }} opciones
   *   `pulso`: segundos de un pulso de la canción.
   */
  constructor(notas, { pulso, antes = VENTANA_ANTES, despues = VENTANA_DESPUES }) {
    if (!(pulso > 0)) throw new RangeError('Juez: el pulso debe ser mayor que 0.');
    this.#notas = notas;
    this.#pulso = pulso;
    this.#antes = antes;
    this.#despues = despues;
  }

  /** Juicios que quedan por emitir (incluye las colas de las notas que se están manteniendo). */
  get pendientes() {
    return this.#notas.length - this.#juzgadas.size + this.#mantenidas.size;
  }

  /** @param {Nota} nota */
  estaJuzgada(nota) {
    return this.#juzgadas.has(nota.id);
  }

  /**
   * Avanza el juez hasta el instante `t` con la posición actual de las manos.
   * Se llama en cada fotograma.
   *
   * @param {number} t Tiempo de la canción (s).
   * @param {EstadoManos} manos
   * @returns {Juicio[]} Notas juzgadas en esta llamada.
   */
  actualizar(t, manos) {
    /** @type {Juicio[]} */
    const juicios = [];

    // 1. Notas de mantener: se cuenta el tiempo transcurrido con la posición
    //    que tenían las manos hasta ahora (antes de aplicar la nueva).
    for (const [id, m] of this.#mantenidas) {
      const fin = m.nota.tiempo + m.nota.duracion;
      const hasta = Math.min(t, fin);
      if (hasta > m.contado) {
        if (this.#manos[m.nota.mano].carril === m.nota.carril) m.dentro += hasta - m.contado;
        m.contado = hasta;
      }
      if (t >= fin) {
        const fraccion = Math.min(1, m.dentro / m.nota.duracion);
        const calificacion = calificarMantener(fraccion);
        juicios.push({ nota: m.nota, tipo: 'cola', calificacion, tiempo: t, entrada: null, fraccion });
        this.#mantenidas.delete(id);
      }
    }

    // 2. Nueva posición de las manos.
    for (const mano of /** @type {Mano[]} */ (['i', 'd'])) {
      const estado = this.#manos[mano];
      const carril = manos[mano] ?? null;
      if (carril !== estado.carril) {
        estado.carril = carril;
        estado.desde = t;
        this.#ultimoAcierto[mano] = -Infinity; // se ha movido: la excepción ya no vale
      }
    }

    // 3. Notas que llegan a la línea.
    for (let k = this.#primera; k < this.#notas.length; k++) {
      const nota = this.#notas[k];
      if (nota.tiempo - this.#antes > t) break; // las siguientes aún no han llegado
      if (this.#juzgadas.has(nota.id)) continue;

      const mano = this.#manos[nota.mano];
      if (mano.carril === nota.carril) {
        const seQuedo = this.#ultimoAcierto[nota.mano] > -Infinity;
        const calificacion = seQuedo ? 'perfecto' : this.#calificar(nota, mano.desde);
        juicios.push({ nota, tipo: 'cabeza', calificacion, tiempo: t, entrada: mano.desde });
        this.#juzgadas.add(nota.id);
        this.#ultimoAcierto[nota.mano] = nota.tiempo + nota.duracion;
        if (nota.duracion > 0) {
          // Se cuenta desde el instante de la nota (aunque se juzgue un poco antes).
          this.#mantenidas.set(nota.id, { nota, dentro: 0, contado: Math.max(t, nota.tiempo) });
        }
      } else if (t > nota.tiempo + this.#despues) {
        juicios.push({ nota, tipo: 'cabeza', calificacion: 'fallo', tiempo: t, entrada: null });
        this.#juzgadas.add(nota.id);
      }
    }
    while (this.#primera < this.#notas.length && this.#juzgadas.has(this.#notas[this.#primera].id)) {
      this.#primera++;
    }
    return juicios;
  }

  /**
   * @param {Nota} nota
   * @param {number} entrada Cuándo entró la mano en el carril.
   * @returns {Calificacion}
   */
  #calificar(nota, entrada) {
    if (entrada >= nota.tiempo - this.#antes) return 'justo';
    if (entrada >= nota.tiempo - this.#pulso) return 'perfecto';
    return 'bien';
  }
}
