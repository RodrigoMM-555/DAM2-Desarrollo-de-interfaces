// @ts-check
/**
 * Secuenciador: convierte la descripción de la música de una canción en
 * sonido. Así las canciones de ejemplo no dependen de pistas con derechos.
 *
 * Formato (en el JSON de la canción, campo `musica`):
 *
 *   "musica": {
 *     "secciones": [
 *       { "compases": 2, "pistas": { "clave": "x..x..x...x.x..." } },
 *       { "compases": 8,
 *         "pistas":  { "bombo": "x...x...x...x...", "maraca": "x.x.x.x.x.x.x.x." },
 *         "bajo":    "A2 . . A2 . . E2 . A2 . . A2 . . E2 .",
 *         "acordes": ["Am", "Dm", "E7", "Am"] }
 *     ]
 *   }
 *
 * - Cada compás tiene 4 pulsos y 16 pasos (semicorcheas).
 * - `pistas`: una cadena por instrumento. `x` = golpe, `X` = golpe fuerte,
 *   `.` = silencio. Si es más corta que la sección, se repite.
 * - `bajo`: notas separadas por espacios, una por paso; `.` = silencio.
 *   Cada nota suena hasta la siguiente (máximo 4 pasos).
 * - `acordes`: uno por compás, se repiten en bucle.
 *
 * `expandir()` es lógica pura (se prueba sin audio); `renderizarMusica()`
 * usa un OfflineAudioContext para generar la canción entera en un AudioBuffer.
 */
import { INSTRUMENTOS } from './instrumentos.js';

export const PASOS_POR_COMPAS = 16;
export const PULSOS_POR_COMPAS = 4;
const PULSOS_POR_PASO = PULSOS_POR_COMPAS / PASOS_POR_COMPAS;

/**
 * @typedef {object} Evento
 * @property {string} instrumento
 * @property {number} pulso
 * @property {boolean} [acento]
 * @property {string} [nota] Nota del bajo o nombre del acorde.
 * @property {number} [duracion] En pulsos.
 */

/**
 * @typedef {object} Seccion
 * @property {number} compases
 * @property {Record<string, string>} [pistas]
 * @property {string} [bajo]
 * @property {string[]} [acordes]
 */

/** Pulsos totales de la música. @param {{ secciones: Seccion[] }} musica */
export function duracionEnPulsos(musica) {
  return musica.secciones.reduce((total, s) => total + s.compases * PULSOS_POR_COMPAS, 0);
}

/**
 * Convierte la música en una lista de eventos ordenada por pulso.
 * @param {{ secciones: Seccion[] }} musica
 * @returns {Evento[]}
 */
export function expandir(musica) {
  if (!Array.isArray(musica?.secciones)) throw new Error('La música necesita una lista de secciones.');
  /** @type {Evento[]} */
  const eventos = [];
  let inicio = 0; // pulso donde empieza la sección
  for (const seccion of musica.secciones) {
    const pasos = seccion.compases * PASOS_POR_COMPAS;

    for (const [instrumento, patron] of Object.entries(seccion.pistas ?? {})) {
      if (!(instrumento in INSTRUMENTOS)) throw new Error(`Instrumento desconocido: ${instrumento}`);
      if (!patron.length) continue;
      for (let paso = 0; paso < pasos; paso++) {
        const c = patron[paso % patron.length];
        if (c === 'x' || c === 'X') {
          eventos.push({ instrumento, pulso: inicio + paso * PULSOS_POR_PASO, acento: c === 'X' });
        }
      }
    }

    if (seccion.bajo) {
      const notas = seccion.bajo.trim().split(/\s+/);
      for (let paso = 0; paso < pasos; paso++) {
        const nota = notas[paso % notas.length];
        if (nota === '.') continue;
        let largo = 1;
        while (largo < 4 && notas[(paso + largo) % notas.length] === '.') largo++;
        eventos.push({ instrumento: 'bajo', pulso: inicio + paso * PULSOS_POR_PASO, nota, duracion: largo * PULSOS_POR_PASO });
      }
    }

    if (seccion.acordes?.length) {
      for (let compas = 0; compas < seccion.compases; compas++) {
        eventos.push({
          instrumento: 'acorde',
          pulso: inicio + compas * PULSOS_POR_COMPAS,
          nota: seccion.acordes[compas % seccion.acordes.length],
          duracion: PULSOS_POR_COMPAS,
        });
      }
    }
    inicio += seccion.compases * PULSOS_POR_COMPAS;
  }
  return eventos.sort((a, b) => a.pulso - b.pulso);
}

/**
 * Programa todos los eventos en un contexto de audio.
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} destino
 * @param {Evento[]} eventos
 * @param {number} bpm
 * @param {number} [inicio] Segundos del contexto en los que cae el pulso 0.
 */
export function programar(ctx, destino, eventos, bpm, inicio = 0) {
  const spp = 60 / bpm;
  for (const e of eventos) {
    INSTRUMENTOS[e.instrumento](ctx, destino, inicio + e.pulso * spp, {
      acento: e.acento,
      nota: e.nota,
      duracion: (e.duracion ?? 0) * spp,
    });
  }
}

/**
 * Genera la música completa en un AudioBuffer, sin reproducirla.
 * Un OfflineAudioContext calcula el sonido tan rápido como puede (una
 * canción de 2 minutos tarda menos de un segundo).
 *
 * @param {{ secciones: Seccion[] }} musica
 * @param {number} bpm
 * @param {number} [frecuenciaMuestreo]
 * @returns {Promise<AudioBuffer>}
 */
export async function renderizarMusica(musica, bpm, frecuenciaMuestreo = 44100) {
  const segundos = (duracionEnPulsos(musica) * 60) / bpm + 1.5; // cola para que se apaguen los sonidos
  const ctx = new OfflineAudioContext(2, Math.ceil(segundos * frecuenciaMuestreo), frecuenciaMuestreo);
  // Un compresor suave evita que se sature al sumar instrumentos.
  const compresor = ctx.createDynamicsCompressor();
  compresor.threshold.value = -14;
  compresor.ratio.value = 3;
  compresor.connect(ctx.destination);
  programar(ctx, compresor, expandir(musica), bpm);
  return ctx.startRendering();
}
