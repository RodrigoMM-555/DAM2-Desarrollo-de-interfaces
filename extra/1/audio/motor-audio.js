// @ts-check
/**
 * Motor de audio: reproduce la canción y es el **reloj maestro** del juego.
 *
 * ¿Por qué el reloj del audio y no `performance.now()`? Porque la música la
 * reproduce la tarjeta de sonido a su ritmo. `AudioContext.currentTime` es
 * ese ritmo: si las notas se colocan con él, nunca se desfasan de la música,
 * aunque un fotograma llegue tarde.
 *
 * Pausar = `suspend()` del contexto: se para el sonido **y** el reloj a la vez.
 */
import { renderizarMusica } from './secuenciador.js';
import { sonidoAcierto, INSTRUMENTOS } from './instrumentos.js';

/** @typedef {import('../motor/partitura.js').Cancion} Cancion */

export class MotorAudio {
  /** @type {AudioContext | null} */
  #ctx = null;
  /** @type {GainNode | null} */ #musica = null;
  /** @type {GainNode | null} */ #efectos = null;
  /** @type {AudioBufferSourceNode | null} */
  #fuente = null;
  /** Instante del contexto en el que suena el segundo 0 de la canción. */
  #inicio = 0;
  /** @type {Map<string, Promise<AudioBuffer>>} */
  #cache = new Map();
  /** Volúmenes pedidos (se aplican también si el contexto aún no existe). */
  #volumenes = { musica: 0.8, efectos: 0.8 };

  /** El contexto se crea al primer uso (los navegadores exigen un gesto del usuario para que suene). */
  get contexto() {
    if (!this.#ctx) {
      this.#ctx = new AudioContext({ latencyHint: 'interactive' });
      this.#musica = this.#ctx.createGain();
      this.#efectos = this.#ctx.createGain();
      this.#musica.connect(this.#ctx.destination);
      this.#efectos.connect(this.#ctx.destination);
      this.#musica.gain.value = this.#volumenes.musica;
      this.#efectos.gain.value = this.#volumenes.efectos;
    }
    return this.#ctx;
  }

  /** ¿Está el audio bloqueado a la espera de un clic o una tecla? */
  get bloqueado() {
    return this.contexto.state !== 'running';
  }

  /** Llamar desde un clic o una tecla. */
  async desbloquear() {
    if (this.contexto.state !== 'running') await this.contexto.resume();
  }

  /**
   * Prepara el audio de una canción: lo descarga (pistas CC0) o lo genera
   * con el secuenciador. Se guarda en caché para repetir sin esperar.
   *
   * @param {Cancion} cancion
   * @param {string} carpeta URL de la carpeta de la canción (para `audio`).
   * @returns {Promise<AudioBuffer>}
   */
  prepararCancion(cancion, carpeta) {
    let promesa = this.#cache.get(cancion.id);
    if (!promesa) {
      promesa = cancion.audio
        ? fetch(new URL(cancion.audio, carpeta))
            .then((r) => {
              if (!r.ok) throw new Error(`No se pudo descargar ${cancion.audio} (${r.status}).`);
              return r.arrayBuffer();
            })
            .then((datos) => this.contexto.decodeAudioData(datos))
        : renderizarMusica(/** @type {any} */ (cancion.musica), cancion.bpm, this.contexto.sampleRate);
      promesa.catch(() => this.#cache.delete(cancion.id));
      this.#cache.set(cancion.id, promesa);
    }
    return promesa;
  }

  /**
   * Empieza la canción dentro de `retardo` segundos (para que las primeras
   * notas tengan tiempo de bajar por la pista).
   * @param {AudioBuffer} buffer
   * @param {number} [retardo]
   */
  reproducir(buffer, retardo = 2) {
    this.detener();
    const ctx = this.contexto;
    const fuente = ctx.createBufferSource();
    fuente.buffer = buffer;
    fuente.connect(/** @type {GainNode} */ (this.#musica));
    this.#inicio = ctx.currentTime + retardo;
    fuente.start(this.#inicio);
    this.#fuente = fuente;
  }

  /**
   * Segundo de la canción que **se está oyendo** ahora (negativo durante la
   * cuenta atrás). Se resta la latencia de salida: lo que el contexto
   * procesa tarda unos milisegundos en llegar a los altavoces.
   */
  tiempo() {
    const ctx = this.contexto;
    return ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0) - this.#inicio;
  }

  pausar() {
    return this.#ctx?.suspend();
  }

  reanudar() {
    return this.#ctx?.resume();
  }

  detener() {
    try {
      this.#fuente?.stop();
    } catch {
      /* ya estaba parada */
    }
    this.#fuente?.disconnect();
    this.#fuente = null;
  }

  /**
   * Suena el acierto de un carril **en el pulso de la nota**, aunque se haya
   * juzgado un poco antes: así el sonido siempre cae a ritmo.
   * @param {number} carril
   * @param {number} tiempoCancion Segundo de la canción en el que debe sonar.
   */
  tocarAcierto(carril, tiempoCancion) {
    const ctx = this.contexto;
    const cuando = Math.max(ctx.currentTime, this.#inicio + tiempoCancion);
    sonidoAcierto(ctx, /** @type {GainNode} */ (this.#efectos), cuando, carril);
  }

  /** Reloj del contexto de audio (s), para comparar con los clics del metrónomo. */
  ahora() {
    return this.contexto.currentTime;
  }

  /**
   * Programa un metrónomo (clave; el primero de cada 4, campana).
   * @param {number} bpm
   * @param {number} golpes
   * @param {number} [retardo] Segundos hasta el primer clic.
   * @returns {number[]} Instante en que **se oye** cada clic (reloj de `ahora()`).
   */
  metronomo(bpm, golpes, retardo = 0.5) {
    const ctx = this.contexto;
    const latencia = ctx.outputLatency || ctx.baseLatency || 0;
    const inicio = ctx.currentTime + retardo;
    const oidos = [];
    for (let k = 0; k < golpes; k++) {
      const t = inicio + (k * 60) / bpm;
      INSTRUMENTOS[k % 4 === 0 ? 'campana' : 'clave'](ctx, /** @type {GainNode} */ (this.#efectos), t, { acento: true });
      oidos.push(t + latencia);
    }
    return oidos;
  }

  /** @param {number} musica 0–1 @param {number} efectos 0–1 */
  volumen(musica, efectos) {
    this.#volumenes = { musica, efectos };
    if (this.#musica) this.#musica.gain.value = musica;
    if (this.#efectos) this.#efectos.gain.value = efectos;
  }
}
