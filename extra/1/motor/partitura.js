// @ts-check
/**
 * Partituras: validación y conversión a notas con tiempo en segundos.
 *
 * En el JSON las notas se escriben en **pulsos** (tiempos de negra), que es
 * como se piensa la música. Aquí se pasan a segundos con el tempo (BPM):
 *
 *     segundos = desfase + pulso × 60 / bpm
 *
 * Lógica pura: no toca el DOM ni el audio, se prueba con objetos inventados.
 */

/** @typedef {'i' | 'd'} Mano  Izquierda o derecha. */

/**
 * @typedef {object} NotaPartitura  Nota tal y como se escribe en el JSON.
 * @property {number} pulso
 * @property {Mano} mano
 * @property {number} carril 0 a 3, de izquierda a derecha.
 * @property {number} [duracion] En pulsos. Mayor que 0 = nota de mantener.
 */

/**
 * @typedef {object} Nota  Nota preparada para jugar.
 * @property {number} id Posición en la lista ordenada.
 * @property {number} pulso
 * @property {number} tiempo Segundos desde el inicio de la canción.
 * @property {Mano} mano
 * @property {number} carril
 * @property {number} duracion En segundos (0 = nota simple).
 */

/**
 * @typedef {object} Cancion
 * @property {string} id
 * @property {string} titulo
 * @property {string} [autor]
 * @property {number} bpm
 * @property {number} [desfase] Segundos hasta el pulso 0 del audio.
 * @property {string} [audio] Archivo de audio (pistas CC0). Si falta, se usa `musica`.
 * @property {object} [musica] Música generada por el secuenciador.
 * @property {Record<string, NotaPartitura[]>} dificultades
 */

export const NUM_CARRILES = 4;
export const MANOS = /** @type {const} */ (['i', 'd']);

/** Tiempo mínimo (s) para que una mano cambie de carril entre dos notas. */
export const SEPARACION_MINIMA = 0.25;

/**
 * @param {number} pulso
 * @param {number} bpm
 * @param {number} [desfase]
 */
export function pulsoASegundos(pulso, bpm, desfase = 0) {
  return desfase + (pulso * 60) / bpm;
}

/**
 * Comprueba que una canción esté bien escrita y que sus partituras sean
 * jugables. Devuelve la lista de errores (vacía si todo está bien).
 *
 * @param {any} cancion
 * @returns {string[]}
 */
export function validarCancion(cancion) {
  const errores = [];
  if (!cancion || typeof cancion !== 'object') return ['La canción no es un objeto.'];
  if (typeof cancion.titulo !== 'string' || !cancion.titulo) errores.push('Falta el título.');
  if (!(cancion.bpm > 0)) errores.push('El BPM debe ser un número mayor que 0.');
  if (!cancion.audio && !cancion.musica) errores.push('Falta el audio o la música generada.');
  const dificultades = cancion.dificultades;
  if (!dificultades || typeof dificultades !== 'object' || !Object.keys(dificultades).length) {
    errores.push('No hay ninguna dificultad.');
    return errores;
  }
  for (const [nombre, notas] of Object.entries(dificultades)) {
    if (!Array.isArray(notas) || !notas.length) {
      errores.push(`[${nombre}] no tiene notas.`);
      continue;
    }
    notas.forEach((nota, i) => {
      const donde = `[${nombre}] nota ${i + 1}`;
      if (!(typeof nota?.pulso === 'number' && nota.pulso >= 0)) errores.push(`${donde}: pulso no válido.`);
      if (!MANOS.includes(nota?.mano)) errores.push(`${donde}: la mano debe ser "i" o "d".`);
      if (!(Number.isInteger(nota?.carril) && nota.carril >= 0 && nota.carril < NUM_CARRILES)) {
        errores.push(`${donde}: el carril debe ser 0, 1, 2 o 3.`);
      }
      if (nota?.duracion !== undefined && !(nota.duracion >= 0)) errores.push(`${donde}: duración no válida.`);
    });
    if (errores.length) continue;
    errores.push(...comprobarJugable(nombre, aNotas(notas, cancion.bpm, cancion.desfase ?? 0)));
  }
  return errores;
}

/**
 * Una mano no puede estar en dos sitios a la vez ni teletransportarse.
 * @param {string} nombre
 * @param {Nota[]} notas Ordenadas por tiempo.
 */
function comprobarJugable(nombre, notas) {
  const errores = [];
  for (const mano of MANOS) {
    const propias = notas.filter((n) => n.mano === mano);
    for (let i = 1; i < propias.length; i++) {
      const anterior = propias[i - 1];
      const nota = propias[i];
      const libre = anterior.tiempo + anterior.duracion; // cuándo queda libre la mano
      const hueco = nota.tiempo - libre;
      const texto = `[${nombre}] pulso ${nota.pulso}, mano ${mano === 'i' ? 'izquierda' : 'derecha'}`;
      if (nota.tiempo <= anterior.tiempo + 1e-9) {
        errores.push(`${texto}: está en dos notas a la vez.`);
      } else if (hueco < -1e-9) {
        errores.push(`${texto}: empieza antes de terminar la nota anterior.`);
      } else if (nota.carril !== anterior.carril && hueco < SEPARACION_MINIMA) {
        errores.push(`${texto}: no da tiempo a cambiar de carril.`);
      }
    }
  }
  return errores;
}

/**
 * @param {NotaPartitura[]} notas
 * @param {number} bpm
 * @param {number} desfase
 * @returns {Nota[]}
 */
function aNotas(notas, bpm, desfase) {
  return notas
    .map((n) => ({
      id: 0,
      pulso: n.pulso,
      tiempo: pulsoASegundos(n.pulso, bpm, desfase),
      mano: n.mano,
      carril: n.carril,
      duracion: ((n.duracion ?? 0) * 60) / bpm,
    }))
    .sort((a, b) => a.tiempo - b.tiempo || a.carril - b.carril)
    .map((n, id) => ({ ...n, id }));
}

/**
 * Prepara las notas de una dificultad para jugar.
 *
 * @param {Cancion} cancion
 * @param {string} dificultad
 * @returns {Nota[]}
 * @throws {Error} Si la canción no es válida o no tiene esa dificultad.
 */
export function prepararNotas(cancion, dificultad) {
  const errores = validarCancion(cancion);
  if (errores.length) throw new Error(`Partitura no válida:\n${errores.join('\n')}`);
  const notas = cancion.dificultades[dificultad];
  if (!notas) throw new Error(`La canción no tiene la dificultad "${dificultad}".`);
  return aNotas(notas, cancion.bpm, cancion.desfase ?? 0);
}

/** Duración en segundos de un pulso. @param {number} bpm */
export const segundosPorPulso = (bpm) => 60 / bpm;
