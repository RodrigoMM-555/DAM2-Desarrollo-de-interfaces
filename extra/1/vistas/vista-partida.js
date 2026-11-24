// @ts-check
/**
 * La partida. Une todo:
 *
 *   EntradaTeclado ─┐
 *                   ├─cambiomanos─► combinar ─► Partida ──juzgada──► marcador, tb-pista, sonido
 *   EntradaCamara ──┘                              ▲
 *   MotorAudio (reloj) ─────────── Partida.fotograma() en cada requestAnimationFrame
 *
 * Si una mano tiene una tecla pulsada, manda el teclado; si no, la cámara.
 *
 * Estados: cargando → esperando (pulsa para empezar) → jugando ⇄ pausa → fin.
 */
import { Vista, escapar, numero, porcentaje, NOMBRES_DIFICULTAD } from './vista.js';
import { Partida } from '../motor/partida.js';
import { segundosPorPulso } from '../motor/partitura.js';
import { EntradaTeclado, ETIQUETAS } from '../entrada/teclado.js';
import '../componentes/tb-pista.js';
import '../componentes/tb-camara.js';
import '../componentes/tb-cursor-mano.js';
import { aPantalla } from '../entrada/permanencia.js';

/** Segundos de cuenta atrás antes de que empiece la música. */
const RETARDO_INICIO = 2.5;
/**
 * Pausa automática: si se falla una nota y la cámara lleva este tiempo (ms)
 * sin ver ninguna mano, el jugador se ha ido o se ha salido de la imagen.
 */
const PAUSA_SIN_MANOS = 3000;

class VistaPartida extends Vista {
  /** @type {import('../motor/partitura.js').Cancion | null} */
  #cancion = null;
  /** @type {AudioBuffer | null} */
  #buffer = null;
  /** @type {Partida | null} */
  #partida = null;
  #teclado = new EntradaTeclado();
  #bucle = 0;
  /** @type {'cargando' | 'esperando' | 'jugando' | 'pausa' | 'fin'} */
  #estado = 'cargando';
  /** ¿Se juega con la cámara en esta partida? (según Ajustes y si arrancó bien) */
  #conCamara = false;
  /**
   * Posición real de las manos según la cámara (para el punto de la línea).
   * @type {import('../componentes/tb-pista.js').PuntosManos}
   */
  #puntos = { i: null, d: null };
  /** Última vez (performance.now) que la cámara vio alguna mano. */
  #ultimaManoVista = 0;

  /** @param {string} selector */
  #el(selector) {
    return /** @type {HTMLElement} */ (this.querySelector(selector));
  }

  pintar() {
    const { cancion, dificultad } = this.parametros;
    this.innerHTML = `
      <section class="partida">
        <header class="marcador">
          <div class="marcador-cancion">
            <h1 class="titulo-partida">…</h1>
            <span class="marcador-dificultad">${escapar(NOMBRES_DIFICULTAD[dificultad] ?? dificultad)}</span>
          </div>
          <dl class="marcador-datos">
            <div><dt>Puntos</dt><dd class="dato-puntos">0</dd></div>
            <div><dt>Combo</dt><dd><span class="dato-combo">0</span> <span class="dato-multiplicador"></span></dd></div>
            <div><dt>Precisión</dt><dd class="dato-precision">100,0 %</dd></div>
          </dl>
          <button class="boton boton-pausa" type="button" aria-label="Pausa (Esc)">❚❚</button>
        </header>
        <div class="area-juego">
          <tb-pista class="pista"></tb-pista>
          <aside class="panel-camara" aria-label="Cámara" hidden>
            <tb-camara></tb-camara>
            <p class="estado-camara" role="status"></p>
          </aside>
        </div>
        <footer class="teclas-partida" aria-hidden="true">
          <span class="texto-i">Izquierda ${ETIQUETAS.i.map((t) => `<kbd>${t}</kbd>`).join('')}</span>
          <span class="texto-d">Derecha ${ETIQUETAS.d.map((t) => `<kbd>${t}</kbd>`).join('')}</span>
        </footer>
        <div class="capa" role="dialog" aria-modal="true" aria-labelledby="titulo-capa">
          <div class="capa-caja">
            <h2 id="titulo-capa">Preparando la música…</h2>
            <p class="capa-texto"></p>
            <div class="capa-botones"></div>
            <p class="capa-ayuda-mano" hidden>✋ También puedes pulsar dejando la mano quieta sobre un botón.</p>
          </div>
          <tb-cursor-mano></tb-cursor-mano>
        </div>
      </section>`;

    const opciones = { signal: this.senal.signal };
    this.#teclado.addEventListener('cambiomanos', () => this.#combinarManos(), opciones);
    this.app.camara.addEventListener('cambiomanos', () => this.#combinarManos(), opciones);
    this.app.camara.addEventListener('fotograma', (e) => {
      const detalle = /** @type {CustomEvent} */ (e).detail;
      const zona = this.app.camara.zona;
      /** @type {any} */ (this.querySelector('tb-camara')).dibujar(detalle, zona.zona);
      this.#puntos = { i: zona.posicionRelativa(detalle.posiciones.i), d: zona.posicionRelativa(detalle.posiciones.d) };
      if (detalle.detecciones.length) this.#ultimaManoVista = performance.now();
      // Con la capa a la vista (empezar, pausa…), la mano hace de cursor:
      // la derecha si se ve; si no, la izquierda.
      const cursor = /** @type {import('../componentes/tb-cursor-mano.js').TbCursorMano} */ (this.querySelector('tb-cursor-mano'));
      const mano = detalle.posiciones.d ?? detalle.posiciones.i;
      cursor.mover(!this.#el('.capa').hidden && mano ? aPantalla(mano, innerWidth, innerHeight) : null);
    }, opciones);
    /** @type {any} */ (this.querySelector('tb-cursor-mano')).raiz = this.#el('.capa-botones');
    window.addEventListener('keydown', (e) => this.#alPulsarTecla(e), opciones);
    document.addEventListener('visibilitychange', () => document.hidden && this.#pausar(), opciones);
    this.#el('.boton-pausa').addEventListener('click', () => this.#pausar(), opciones);
    this.#el('.capa-botones').addEventListener('click', (e) => {
      const accion = /** @type {HTMLElement} */ (e.target).closest('button')?.dataset.accion;
      if (accion === 'empezar' || accion === 'reiniciar') this.#empezar();
      else if (accion === 'continuar') this.#continuar();
      else if (accion === 'salir') this.app.ir('/canciones');
    }, opciones);

    this.#cargar(cancion, dificultad);
  }

  limpiar() {
    cancelAnimationFrame(this.#bucle);
    this.#teclado.desconectar();
    this.app.camara.detener();
    this.app.audio.detener();
    this.app.audio.reanudar(); // por si se sale estando en pausa
  }

  /** @param {string} id @param {string} dificultad */
  async #cargar(id, dificultad) {
    try {
      const cancion = await this.app.cancion(id);
      if (!cancion.dificultades[dificultad]) throw new Error(`La canción no tiene la dificultad "${dificultad}".`);
      this.#cancion = cancion;
      this.#el('.titulo-partida').textContent = cancion.titulo;
      // La música y la cámara se preparan a la vez.
      const [buffer, avisoCamara] = await Promise.all([
        this.app.audio.prepararCancion(cancion, this.app.carpetaCanciones),
        this.#encenderCamara(),
      ]);
      this.#buffer = buffer;
      if (!this.isConnected) return;
      const texto = this.#conCamara
        ? 'Levanta las manos a la altura del pecho: en la imagen de la cámara verás en qué carril estás. Pulsa Espacio o el botón para empezar.'
        : `${avisoCamara}Pulsa Espacio o el botón para empezar. Ten las manos preparadas.`;
      this.#mostrarCapa('Todo listo', texto, [
        ['empezar', 'Empezar'],
        ['salir', 'Elegir otra canción'],
      ]);
      this.#estado = 'esperando';
    } catch (error) {
      this.#mostrarCapa('No se pudo cargar la canción', error instanceof Error ? error.message : String(error), [
        ['salir', 'Volver a las canciones'],
      ]);
    }
  }

  /**
   * Enciende la cámara si está activada en Ajustes.
   * @returns {Promise<string>} Aviso para el jugador si no se ha podido (o '').
   */
  async #encenderCamara() {
    const ajustes = this.app.ajustes.datos;
    if (!ajustes.usarCamara) return '';
    const panel = this.#el('.panel-camara');
    panel.hidden = false;
    this.#el('.estado-camara').textContent = 'Encendiendo la cámara…';
    this.app.camara.configurar(ajustes);
    try {
      await this.app.camara.iniciar(/** @type {any} */ (this.querySelector('tb-camara')).video);
      if (!this.isConnected) {
        this.app.camara.detener();
        return '';
      }
      this.#conCamara = true;
      this.#el('.estado-camara').textContent = '';
      return '';
    } catch {
      panel.hidden = true;
      return `No se pudo usar la cámara (${this.app.camara.error}); puedes jugar con el teclado. `;
    }
  }

  /** Teclado y cámara a la vez: por cada mano, manda la tecla si hay una pulsada. */
  #combinarManos() {
    const teclas = this.#teclado.estado;
    const camara = this.#conCamara ? this.app.camara.estado : { i: null, d: null };
    this.#partida?.ponerManos({ i: teclas.i ?? camara.i, d: teclas.d ?? camara.d });
  }

  async #empezar() {
    // Solo desde "esperando" o "pausa" (Reiniciar). Evita arrancar dos veces si
    // Espacio dispara a la vez el atajo y el clic del botón con el foco.
    if (!this.#cancion || !this.#buffer || (this.#estado !== 'esperando' && this.#estado !== 'pausa')) return;
    this.#estado = 'cargando';
    const audio = this.app.audio;
    await audio.desbloquear();
    cancelAnimationFrame(this.#bucle);

    const partida = new Partida({
      cancion: this.#cancion,
      dificultad: this.parametros.dificultad,
      reloj: audio,
      // La cámara ve la mano con algo de retraso: el juez lo compensa.
      latenciaEntrada: this.#conCamara ? this.app.ajustes.datos.latenciaCamara : 0,
    });
    partida.addEventListener('juzgada', (e) => this.#alJuzgar(/** @type {CustomEvent} */ (e).detail));
    partida.addEventListener('fin', (e) => this.#alTerminar(/** @type {CustomEvent} */ (e).detail.resumen));
    this.#partida = partida;

    const pista = /** @type {import('../componentes/tb-pista.js').TbPista} */ (this.querySelector('tb-pista'));
    pista.notas = partida.notas;
    pista.pulso = segundosPorPulso(this.#cancion.bpm);
    pista.setAttribute('antelacion', String(this.app.ajustes.datos.antelacion));
    pista.reiniciar();
    this.#actualizarMarcador(partida.puntuacion.resumen);

    this.#teclado.conectar();
    this.#combinarManos();
    audio.reproducir(this.#buffer, RETARDO_INICIO);
    this.#ocultarCapa();
    this.#estado = 'jugando';
    if (audio.contexto.state === 'suspended') await audio.reanudar(); // si se reinicia desde la pausa

    this.#ultimaManoVista = performance.now();
    const fotograma = () => {
      const { t } = partida.fotograma();
      pista.dibujar(t, partida.manos, this.#conCamara ? this.#puntos : null);
      if (this.#estado === 'jugando' || this.#estado === 'pausa') this.#bucle = requestAnimationFrame(fotograma);
    };
    this.#bucle = requestAnimationFrame(fotograma);
  }

  /** @param {{ juicio: import('../motor/juez.js').Juicio, resumen: import('../motor/puntuacion.js').Resumen }} detalle */
  #alJuzgar({ juicio, resumen }) {
    // Suena al acertar la cabeza (en el pulso de la nota); al terminar de mantener, otra vez.
    if (juicio.calificacion !== 'fallo') {
      const cuando = juicio.tipo === 'cola' ? juicio.nota.tiempo + juicio.nota.duracion : juicio.nota.tiempo;
      this.app.audio.tocarAcierto(juicio.nota.carril, cuando);
    }
    /** @type {any} */ (this.querySelector('tb-pista')).marcar(juicio);
    this.#actualizarMarcador(resumen);
    // Pausa automática: se ha fallado una nota y hace rato que la cámara no ve manos.
    const teclas = this.#teclado.estado;
    if (
      juicio.calificacion === 'fallo' && this.#conCamara &&
      teclas.i === null && teclas.d === null &&
      performance.now() - this.#ultimaManoVista > PAUSA_SIN_MANOS
    ) {
      this.#pausar('No veo tus manos. Vuelve a ponerte delante de la cámara.');
    }
  }

  /** @param {import('../motor/puntuacion.js').Resumen} r */
  #actualizarMarcador(r) {
    this.#el('.dato-puntos').textContent = numero(r.puntos);
    this.#el('.dato-combo').textContent = String(r.combo);
    this.#el('.dato-multiplicador').textContent = r.multiplicador > 1 ? `×${r.multiplicador}` : '';
    this.#el('.dato-precision').textContent = porcentaje(r.precision);
  }

  /** @param {import('../motor/puntuacion.js').Resumen} resumen */
  #alTerminar(resumen) {
    this.#estado = 'fin';
    cancelAnimationFrame(this.#bucle);
    const cancion = /** @type {import('../motor/partitura.js').Cancion} */ (this.#cancion);
    const { dificultad } = this.parametros;
    const nuevoRecord = this.app.records.guardar(cancion.id, dificultad, resumen);
    this.app.ultimoResultado = { cancion, dificultad, resumen, nuevoRecord };
    this.app.ir('/resultados');
  }

  /** @param {string} [motivo] Texto que explica por qué se ha pausado. */
  async #pausar(motivo = '') {
    if (this.#estado !== 'jugando') return;
    this.#estado = 'pausa';
    await this.app.audio.pausar();
    this.#mostrarCapa('Pausa', motivo, [
      ['continuar', 'Continuar'],
      ['reiniciar', 'Reiniciar'],
      ['salir', 'Salir'],
    ]);
  }

  async #continuar() {
    if (this.#estado !== 'pausa') return;
    this.#ocultarCapa();
    this.#estado = 'jugando';
    this.#ultimaManoVista = performance.now();
    await this.app.audio.reanudar();
  }

  /** @param {KeyboardEvent} e */
  #alPulsarTecla(e) {
    if (e.code === 'Escape') {
      e.preventDefault();
      if (this.#estado === 'jugando') this.#pausar();
      else if (this.#estado === 'pausa') this.#continuar();
    } else if (e.code === 'Space' && this.#estado === 'esperando' && !e.repeat) {
      e.preventDefault();
      this.#empezar();
    }
  }

  /** @param {string} titulo @param {string} texto @param {[string, string][]} botones */
  #mostrarCapa(titulo, texto, botones) {
    const capa = this.#el('.capa');
    this.#el('#titulo-capa').textContent = titulo;
    this.#el('.capa-texto').textContent = texto;
    this.#el('.capa-botones').innerHTML = botones
      .map(([accion, etiqueta], i) => `<button class="boton${i === 0 ? ' boton-principal' : ''}" type="button" data-accion="${accion}">${etiqueta}</button>`)
      .join('');
    capa.hidden = false;
    this.#fondoInerte(true);
    this.#el('.capa-ayuda-mano').hidden = !this.#conCamara;
    /** @type {HTMLElement | null} */ (capa.querySelector('button'))?.focus();
  }

  /**
   * Con la capa abierta (diálogo modal), lo de detrás no se puede enfocar ni
   * pulsar: el foco del teclado no se escapa del diálogo.
   * @param {boolean} inerte
   */
  #fondoInerte(inerte) {
    for (const selector of ['.marcador', '.area-juego', '.teclas-partida']) this.#el(selector).inert = inerte;
  }

  #ocultarCapa() {
    this.#el('.capa').hidden = true;
    this.#fondoInerte(false);
    /** @type {any} */ (this.querySelector('tb-cursor-mano')).mover(null);
    // El foco sale de la capa para que las teclas no activen botones ocultos.
    /** @type {HTMLElement} */ (document.activeElement)?.blur?.();
  }
}

customElements.define('tb-vista-partida', VistaPartida);
