// @ts-check
/**
 * Voz y habla (RA2 c):
 *
 * - **Órdenes de voz** con la Web Speech API (`SpeechRecognition`): el
 *   jugador dice «pausa», «continuar», «empezar», «reiniciar» o «salir».
 *   Muy útil en este juego: las manos están ocupadas en los carriles.
 * - **Habla** con `speechSynthesis`: el juego lee en voz alta el resultado.
 *
 * Privacidad: en Chrome y Edge el reconocimiento lo hace un servicio en línea
 * (el audio sale del ordenador); por eso está desactivado por defecto y se
 * activa en Ajustes. Firefox no lo admite: el juego lo detecta y lo dice.
 * La síntesis de voz es local.
 *
 * `interpretarOrden()` es lógica pura (se prueba sin micrófono).
 */

/** @typedef {'empezar' | 'pausa' | 'continuar' | 'reiniciar' | 'salir' | 'repetir' | 'canciones' | 'menu'} Orden */

/**
 * Palabras que activan cada orden (sin tildes, en minúsculas). Se aceptan
 * sinónimos porque la gente no dice siempre la misma palabra.
 * @type {[Orden, string[]][]}
 */
export const ORDENES = [
  ['pausa', ['pausa', 'pausar', 'para', 'parar', 'stop', 'espera']],
  ['continuar', ['continuar', 'continua', 'sigue', 'seguir', 'reanudar', 'vale']],
  ['empezar', ['empezar', 'empieza', 'comenzar', 'comienza', 'jugar', 'vamos', 'adelante']],
  ['reiniciar', ['reiniciar', 'reinicia', 'otra vez', 'desde el principio']],
  ['repetir', ['repetir', 'repite']],
  ['canciones', ['canciones', 'otra cancion', 'elegir cancion']],
  ['salir', ['salir', 'sal', 'terminar', 'abandonar']],
  ['menu', ['menu', 'inicio', 'volver']],
];

/** Minúsculas y sin tildes: «Menú» → «menu». @param {string} texto */
export function normalizar(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zñ0-9 ]/g, ' ');
}

/**
 * Busca una orden en una frase. Gana la que aparece **antes** en la frase
 * («para, no, continúa» → pausa); se comparan palabras enteras.
 *
 * @param {string} texto Lo reconocido.
 * @param {Orden[]} [permitidas] Solo estas (las que tienen sentido en la pantalla actual).
 * @returns {Orden | null}
 */
export function interpretarOrden(texto, permitidas) {
  const frase = ` ${normalizar(texto).replace(/\s+/g, ' ').trim()} `;
  let mejor = /** @type {Orden | null} */ (null);
  let posicion = Infinity;
  for (const [orden, palabras] of ORDENES) {
    if (permitidas && !permitidas.includes(orden)) continue;
    for (const palabra of palabras) {
      const i = frase.indexOf(` ${palabra} `);
      if (i >= 0 && i < posicion) {
        mejor = orden;
        posicion = i;
      }
    }
  }
  return mejor;
}

/** ¿Admite el navegador el reconocimiento de voz? */
export function vozDisponible() {
  return typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
}

/**
 * Escucha órdenes de voz de forma continua.
 * Eventos: `orden` → { orden, texto } · `estado` → 'escuchando' | 'parado' | 'error'.
 */
export class EntradaVoz extends EventTarget {
  /** @type {any} */
  #reconocedor = null;
  #activa = false;
  /** @type {Orden[] | undefined} */
  permitidas;
  /** Índice del último resultado que ya disparó una orden (no repetirla al confirmarse). */
  #ultimoUsado = -1;

  iniciar() {
    if (!vozDisponible() || this.#activa) return false;
    const Clase = /** @type {any} */ (window).SpeechRecognition ?? /** @type {any} */ (window).webkitSpeechRecognition;
    const r = new Clase();
    r.lang = 'es-ES';
    r.continuous = true;
    r.interimResults = true; // reacciona antes de que termine la frase
    r.onresult = (/** @type {any} */ evento) => {
      for (let k = evento.resultIndex; k < evento.results.length; k++) {
        if (k <= this.#ultimoUsado) continue;
        const texto = evento.results[k][0].transcript;
        const orden = interpretarOrden(texto, this.permitidas);
        if (orden) {
          this.#ultimoUsado = k;
          this.dispatchEvent(new CustomEvent('orden', { detail: { orden, texto } }));
        }
      }
    };
    // El navegador corta la escucha tras un silencio: se reanuda sola.
    r.onend = () => {
      if (this.#activa) {
        this.#ultimoUsado = -1;
        try { r.start(); } catch { /* ya estaba arrancando */ }
      } else this.#estado('parado');
    };
    r.onerror = (/** @type {any} */ e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.#activa = false;
        this.#estado('error');
      }
    };
    this.#reconocedor = r;
    this.#activa = true;
    this.#ultimoUsado = -1;
    r.start();
    this.#estado('escuchando');
    return true;
  }

  detener() {
    this.#activa = false;
    try { this.#reconocedor?.stop(); } catch { /* no estaba activo */ }
    this.#reconocedor = null;
  }

  /** @param {string} estado */
  #estado(estado) {
    this.dispatchEvent(new CustomEvent('estado', { detail: estado }));
  }
}

/**
 * Lee un texto en voz alta (síntesis local del navegador).
 * @param {string} texto
 */
export function hablar(texto) {
  if (typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
  const frase = new SpeechSynthesisUtterance(texto);
  frase.lang = 'es-ES';
  const voz = speechSynthesis.getVoices().find((v) => v.lang.startsWith('es'));
  if (voz) frase.voice = voz;
  speechSynthesis.speak(frase);
}
