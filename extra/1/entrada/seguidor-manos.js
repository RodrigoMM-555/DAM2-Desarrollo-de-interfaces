// @ts-check
/**
 * Seguidor de manos: decide, de forma **estable**, cuál de las manos que ve
 * la cámara es la izquierda y cuál la derecha.
 *
 * MediaPipe da para cada mano una etiqueta (izquierda/derecha) y una
 * confianza, pero (docs/DISEÑO.md §5.3):
 * - a veces se equivoca durante algún fotograma,
 * - el orden de las manos en el resultado puede cambiar entre fotogramas,
 * - con desenfoque por movimiento una mano puede "desaparecer" un instante.
 *
 * Solución:
 * 1. **Pistas**: cada mano vista es una pista que se empareja con la
 *    detección más cercana del fotograma siguiente. La identidad no salta
 *    aunque cambie el orden.
 * 2. **Voto acumulado**: cada pista tiene un voto entre −1 (derecha) y +1
 *    (izquierda) que es una media móvil de las etiquetas de MediaPipe,
 *    ponderadas por su confianza. Un fotograma equivocado no lo cambia.
 * 3. **Desempate**: con dos manos, la de voto más alto es la izquierda. Si los
 *    votos casi empatan, manda la posición (la que está más a la izquierda).
 * 4. **Memoria**: si una mano desaparece menos de `memoria` segundos, se
 *    conserva en su última posición.
 *
 * Recibe detecciones ya en coordenadas del jugador (x = 0 su izquierda) y con
 * la etiqueta ya corregida según la calibración del espejo.
 *
 * Lógica pura.
 */

/** @typedef {{ x: number, y: number }} Punto */

/**
 * @typedef {object} Deteccion
 * @property {number} x
 * @property {number} y
 * @property {'i' | 'd'} etiqueta Lo que dice MediaPipe (ya corregido).
 * @property {number} confianza 0–1.
 */

/** @typedef {{ i: Punto | null, d: Punto | null }} PosicionesManos */

/**
 * @typedef {object} Pista
 * @property {number} x
 * @property {number} y
 * @property {number} voto −1 (derecha) … +1 (izquierda)
 * @property {number} visto Último instante en que se detectó.
 */

/** Distancia máxima (en fracción de imagen) para emparejar una detección con una pista. */
const DISTANCIA_MAXIMA = 0.3;
/** Peso de cada fotograma nuevo en el voto (≈ media de los últimos 10). */
const PESO_VOTO = 0.2;
/** Por debajo de esta diferencia de votos se desempata por posición. */
const EMPATE = 0.15;

export class SeguidorManos {
  /** @type {Pista[]} */
  #pistas = [];
  #memoria;

  /** @param {{ memoria?: number }} [opciones] `memoria` en segundos. */
  constructor({ memoria = 0.2 } = {}) {
    this.#memoria = memoria;
  }

  /** Cuántas manos se están siguiendo. */
  get cantidad() {
    return this.#pistas.length;
  }

  reiniciar() {
    this.#pistas = [];
  }

  /**
   * @param {number} t Segundos.
   * @param {Deteccion[]} detecciones Como mucho dos.
   * @returns {PosicionesManos}
   */
  actualizar(t, detecciones) {
    const libres = detecciones.slice(0, 2);
    const emparejadas = this.#emparejar(libres);

    for (const [pista, deteccion] of emparejadas) {
      pista.x = deteccion.x;
      pista.y = deteccion.y;
      pista.visto = t;
      pista.voto = pista.voto * (1 - PESO_VOTO) + PESO_VOTO * votoDe(deteccion);
    }
    // Detecciones sin pista → pista nueva. El voto inicial mezcla la etiqueta
    // y la posición (sentado, la mano izquierda suele estar a la izquierda).
    for (const d of libres) {
      if (emparejadas.some(([, e]) => e === d) || this.#pistas.length >= 2) continue;
      const porPosicion = d.x < 0.5 ? 0.3 : -0.3;
      this.#pistas.push({ x: d.x, y: d.y, visto: t, voto: 0.5 * votoDe(d) + porPosicion });
    }
    // Pistas que llevan demasiado sin verse → fuera.
    this.#pistas = this.#pistas.filter((p) => t - p.visto <= this.#memoria);

    return this.#identificar();
  }

  /**
   * Empareja detecciones con pistas minimizando la distancia total.
   * @param {Deteccion[]} detecciones
   * @returns {[Pista, Deteccion][]}
   */
  #emparejar(detecciones) {
    const pistas = this.#pistas;
    if (!pistas.length || !detecciones.length) return [];
    const dist = (/** @type {Pista} */ p, /** @type {Deteccion} */ d) => Math.hypot(p.x - d.x, p.y - d.y);

    /** @type {[Pista, Deteccion][][]} */
    let opciones;
    if (pistas.length === 2 && detecciones.length === 2) {
      opciones = [
        [[pistas[0], detecciones[0]], [pistas[1], detecciones[1]]],
        [[pistas[0], detecciones[1]], [pistas[1], detecciones[0]]],
      ];
    } else {
      // Una de las dos listas tiene un solo elemento: cada combinación posible.
      opciones = pistas.flatMap((p) => detecciones.map((d) => [/** @type {[Pista, Deteccion]} */ ([p, d])]));
    }
    const coste = (/** @type {[Pista, Deteccion][]} */ o) => o.reduce((s, [p, d]) => s + dist(p, d), 0);
    const mejor = opciones.reduce((a, b) => (coste(b) < coste(a) ? b : a));
    return mejor.filter(([p, d]) => dist(p, d) <= DISTANCIA_MAXIMA);
  }

  /** @returns {PosicionesManos} */
  #identificar() {
    const [a, b] = this.#pistas;
    const punto = (/** @type {Pista} */ p) => ({ x: p.x, y: p.y });
    if (!a) return { i: null, d: null };
    if (!b) return a.voto >= 0 ? { i: punto(a), d: null } : { i: null, d: punto(a) };

    let izquierda = a.voto >= b.voto ? a : b;
    if (Math.abs(a.voto - b.voto) < EMPATE) izquierda = a.x <= b.x ? a : b;
    const derecha = izquierda === a ? b : a;
    return { i: punto(izquierda), d: punto(derecha) };
  }
}

/** @param {Deteccion} d */
function votoDe(d) {
  return (d.etiqueta === 'i' ? 1 : -1) * Math.max(0, Math.min(1, d.confianza));
}
