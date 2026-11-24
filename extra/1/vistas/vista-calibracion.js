// @ts-check
/**
 * Calibración de la cámara (docs/DISEÑO.md §3):
 * 1. Activar la cámara (botón explícito: el jugador decide cuándo se enciende).
 * 2. Ajustar la zona de juego con cuatro deslizadores, viendo en directo en
 *    qué carril está cada mano.
 * 3. Comprobar izquierda/derecha: levantar solo la izquierda y luego solo la
 *    derecha. Si la cámara las da al revés, se intercambian (también hay un
 *    botón para hacerlo a mano).
 * 4. Guardar: a partir de ahí se juega con la cámara.
 */
import { Vista } from './vista.js';
import { decidirEspejo, estimarLatencia } from '../entrada/calibracion.js';
import { ZONA_POR_DEFECTO } from '../entrada/zona-juego.js';
import '../componentes/tb-camara.js';

/** Segundos que dura cada paso de la comprobación de manos. */
const DURACION_PASO = 2.5;
/** Metrónomo de la medición del retraso: 4 clics de cuenta + 12 medidos. */
const METRONOMO = { bpm: 80, cuenta: 4, medidos: 12 };

const DESLIZADORES = /** @type {const} */ ([
  ['izquierda', 'Borde izquierdo', 0, 45],
  ['derecha', 'Borde derecho', 55, 100],
  ['arriba', 'Borde superior', 0, 45],
  ['abajo', 'Borde inferior', 50, 100],
]);

class VistaCalibracion extends Vista {
  /** @type {import('../entrada/zona-juego.js').Rectangulo} */
  #zona = { ...ZONA_POR_DEFECTO };
  #intercambiarManos = false;
  /** Retraso de la cámara en segundos. */
  #latencia = 0.08;
  #midiendo = false;
  /** Comprobación en curso: qué mano se pide y cuántas etiquetas se han visto. */
  #comprobacion = /** @type {null | { paso: 'i' | 'd', inicio: number, conteo: { i: { i: number, d: number }, d: { i: number, d: number } } }} */ (null);

  /** @param {string} s */
  #el(s) {
    return /** @type {HTMLElement} */ (this.querySelector(s));
  }

  pintar() {
    const datos = this.app.ajustes.datos;
    this.#zona = datos.zona;
    this.#intercambiarManos = datos.intercambiarManos;
    this.#latencia = datos.latenciaCamara;

    this.innerHTML = `
      <section class="pantalla pantalla-ancha calibracion">
        <header class="cabecera-pantalla">
          <a class="boton boton-volver" href="#/">← Menú</a>
          <h1>Calibrar la cámara</h1>
        </header>
        <div class="calibracion-rejilla">
          <div class="calibracion-imagen">
            <tb-camara esqueleto></tb-camara>
            <div class="camara-apagada">
              <p>Siéntate delante del ordenador, con las manos a la altura del pecho.</p>
              <button class="boton boton-principal" type="button" data-accion="activar">Activar cámara</button>
              <p class="nota">La imagen se analiza en tu ordenador con MediaPipe y no se envía a ningún sitio.</p>
            </div>
            <p class="lectura" aria-live="polite"></p>
          </div>
          <div class="calibracion-panel">
            <h2>1 · Zona de juego</h2>
            <p class="nota">Ajusta el rectángulo para llegar a los cuatro carriles sin estirarte. Fuera del rectángulo las manos no cuentan: bájalas por debajo para descansar.</p>
            <div class="deslizadores">
              ${DESLIZADORES.map(([clave, texto, min, max]) => `
                <label>
                  <span>${texto} <output data-salida="${clave}"></output></span>
                  <input type="range" min="${min}" max="${max}" step="1" data-zona="${clave}" value="${Math.round(this.#zona[clave] * 100)}" />
                </label>`).join('')}
            </div>
            <button class="boton boton-pequeno" type="button" data-accion="restablecer">Restablecer zona</button>

            <h2>2 · ¿Quién es quién?</h2>
            <p class="nota">Comprueba que el juego distingue tu mano izquierda de la derecha.</p>
            <div class="acciones acciones-izquierda">
              <button class="boton" type="button" data-accion="comprobar" disabled>Comprobar manos</button>
              <button class="boton" type="button" data-accion="intercambiar">Intercambiar izquierda y derecha</button>
            </div>
            <p class="instruccion" role="status"></p>

            <h2>3 · Retraso de la cámara</h2>
            <p class="nota">La cámara ve tus manos con un pequeño retraso; el juego lo compensa.
              Mídelo con el metrónomo o ajústalo a mano si notas que el juego va por detrás.</p>
            <div class="deslizadores">
              <label>
                <span>Retraso <output data-salida="latencia"></output></span>
                <input type="range" min="0" max="300" step="5" data-latencia value="${Math.round(this.#latencia * 1000)}" />
              </label>
            </div>
            <button class="boton" type="button" data-accion="medir" disabled>Medir con metrónomo</button>
            <p class="instruccion instruccion-latencia" role="status"></p>

            <h2>4 · Listo</h2>
            <div class="acciones acciones-izquierda">
              <button class="boton boton-principal" type="button" data-accion="guardar">Guardar y jugar</button>
            </div>
          </div>
        </div>
      </section>`;

    const opciones = { signal: this.senal.signal };
    this.addEventListener('click', (e) => this.#alClic(e), opciones);
    this.addEventListener('input', (e) => this.#alMoverDeslizador(e), opciones);
    this.app.camara.addEventListener('fotograma', (e) => this.#alFotograma(/** @type {CustomEvent} */ (e).detail), opciones);
    this.#actualizarSalidas();
    this.#aplicarALaCamara();
    if (this.app.ajustes.datos.usarCamara) this.#activar(); // ya dio permiso antes
  }

  limpiar() {
    this.app.camara.detener();
  }

  /** @param {Event} e */
  #alClic(e) {
    const accion = /** @type {HTMLElement} */ (e.target).closest('button')?.dataset.accion;
    if (accion === 'activar') this.#activar();
    else if (accion === 'restablecer') this.#restablecer();
    else if (accion === 'comprobar') this.#empezarComprobacion();
    else if (accion === 'intercambiar') this.#intercambiar();
    else if (accion === 'medir') this.#medirLatencia();
    else if (accion === 'guardar') this.#guardar();
  }

  async #activar() {
    const caja = this.#el('.camara-apagada');
    caja.innerHTML = '<p>Encendiendo la cámara y cargando el modelo de manos…</p>';
    const camara = /** @type {import('../componentes/tb-camara.js').TbCamara} */ (this.querySelector('tb-camara'));
    try {
      await this.app.camara.iniciar(camara.video);
      if (!this.isConnected) return this.app.camara.detener();
      caja.hidden = true;
      for (const accion of ['comprobar', 'medir']) {
        /** @type {HTMLButtonElement} */ (this.querySelector(`[data-accion="${accion}"]`)).disabled = false;
      }
    } catch {
      caja.innerHTML = `<p class="error">${this.app.camara.error}</p>
        <button class="boton" type="button" data-accion="activar">Reintentar</button>`;
    }
  }

  /** @param {Event} e */
  #alMoverDeslizador(e) {
    const entrada = /** @type {HTMLInputElement} */ (e.target);
    if (entrada.hasAttribute('data-latencia')) {
      this.#latencia = Number(entrada.value) / 1000;
      this.#actualizarSalidas();
      return;
    }
    const clave = /** @type {keyof typeof this.#zona} */ (entrada.dataset.zona);
    if (!clave) return;
    this.#zona = { ...this.#zona, [clave]: Number(entrada.value) / 100 };
    this.#actualizarSalidas();
    this.#aplicarALaCamara();
  }

  #restablecer() {
    this.#zona = { ...ZONA_POR_DEFECTO };
    for (const [clave] of DESLIZADORES) {
      /** @type {HTMLInputElement} */ (this.querySelector(`[data-zona="${clave}"]`)).value = String(Math.round(this.#zona[clave] * 100));
    }
    this.#actualizarSalidas();
    this.#aplicarALaCamara();
  }

  #actualizarSalidas() {
    this.#el('[data-salida="latencia"]').textContent = `${Math.round(this.#latencia * 1000)} ms`;
    for (const [clave] of DESLIZADORES) {
      this.#el(`[data-salida="${clave}"]`).textContent = `${Math.round(this.#zona[clave] * 100)} %`;
    }
  }

  #aplicarALaCamara() {
    this.app.camara.configurar({ intercambiarManos: this.#intercambiarManos, zona: this.#zona });
  }

  /** Arreglo manual: si la I azul sigue a tu mano derecha, se pulsa y listo. */
  #intercambiar() {
    this.#comprobacion = null;
    this.#intercambiarManos = !this.#intercambiarManos;
    this.#aplicarALaCamara();
    this.app.camara.seguidor.reiniciar();
    this.#el('.instruccion').textContent = 'Intercambiadas. Comprueba que ahora la I azul sigue a tu mano izquierda.';
  }

  /**
   * Medición del retraso: suena un metrónomo y, con cada clic, el jugador
   * cambia la mano izquierda de carril. Se compara cuándo sonó cada clic con
   * cuándo registró el juego el cambio (docs/DISEÑO.md §5.6).
   */
  async #medirLatencia() {
    if (this.#midiendo) return;
    this.#midiendo = true;
    const texto = this.#el('.instruccion-latencia');
    const audio = this.app.audio;
    await audio.desbloquear();
    texto.innerHTML = `Pon la mano <strong class="texto-i">IZQUIERDA</strong> en un carril. Tras ${METRONOMO.cuenta} clics de cuenta,
      muévela al carril de al lado <strong>con cada clic</strong> (ida y vuelta).`;

    /** @type {number[]} */
    const cambios = [];
    let anterior = this.app.camara.estado.i;
    const alCambiar = (/** @type {Event} */ e) => {
      const { i } = /** @type {CustomEvent} */ (e).detail;
      if (i !== null && i !== anterior) cambios.push(audio.ahora());
      anterior = i;
    };
    this.app.camara.addEventListener('cambiomanos', alCambiar);
    const clics = audio.metronomo(METRONOMO.bpm, METRONOMO.cuenta + METRONOMO.medidos, 1);
    const espera = (clics[clics.length - 1] - audio.ahora() + 0.6) * 1000;
    await new Promise((resolver) => setTimeout(resolver, espera));
    this.app.camara.removeEventListener('cambiomanos', alCambiar);
    this.#midiendo = false;
    if (!this.isConnected) return;

    const resultado = estimarLatencia(cambios, clics.slice(METRONOMO.cuenta));
    if (!resultado) {
      texto.innerHTML = '<span class="error">No he registrado suficientes cambios a ritmo.</span> Repite moviendo la mano con cada clic.';
      return;
    }
    this.#latencia = Math.round(resultado.latencia * 200) / 200; // de 5 en 5 ms, como el deslizador
    /** @type {HTMLInputElement} */ (this.querySelector('[data-latencia]')).value = String(Math.round(this.#latencia * 1000));
    this.#actualizarSalidas();
    texto.textContent = `✓ Retraso medido: ${Math.round(this.#latencia * 1000)} ms (${resultado.muestras} cambios).`;
  }

  #empezarComprobacion() {
    this.#comprobacion = { paso: 'i', inicio: performance.now(), conteo: { i: { i: 0, d: 0 }, d: { i: 0, d: 0 } } };
    this.#el('.instruccion').innerHTML = 'Levanta <strong class="texto-i">solo la mano IZQUIERDA</strong> y muévela un poco…';
  }

  /** @param {import('../entrada/camara.js').DetalleFotograma} detalle */
  #alFotograma(detalle) {
    /** @type {any} */ (this.querySelector('tb-camara'))?.dibujar(detalle, this.#zona);
    const texto = (/** @type {number | null} */ c) => (c === null ? 'fuera' : `carril ${c + 1}`);
    this.#el('.lectura').textContent =
      `Izquierda: ${texto(detalle.carriles.i)} · Derecha: ${texto(detalle.carriles.d)} · ${Math.round(detalle.fps)} fps`;

    const c = this.#comprobacion;
    if (!c) return;
    // Solo cuentan los fotogramas con una única mano a la vista.
    if (detalle.detecciones.length === 1) c.conteo[c.paso][detalle.detecciones[0].etiqueta]++;
    if (performance.now() - c.inicio < DURACION_PASO * 1000) return;
    if (c.paso === 'i') {
      c.paso = 'd';
      c.inicio = performance.now();
      this.#el('.instruccion').innerHTML = 'Ahora baja esa y levanta <strong class="texto-d">solo la mano DERECHA</strong>…';
      return;
    }
    this.#comprobacion = null;
    const { invertir, fiable } = decidirEspejo(c.conteo.i, c.conteo.d);
    if (!fiable) {
      this.#el('.instruccion').innerHTML =
        '<span class="error">No he podido distinguirlas bien.</span> Prueba con más luz y con la mano bien abierta, y repite.';
      return;
    }
    if (invertir) {
      this.#intercambiarManos = !this.#intercambiarManos;
      this.#aplicarALaCamara();
      this.app.camara.seguidor.reiniciar();
    }
    this.#el('.instruccion').innerHTML = invertir
      ? '✓ Estaban al revés: corregido. Comprueba que ahora la I azul sigue a tu mano izquierda.'
      : '✓ Correcto: el juego distingue tus manos.';
  }

  #guardar() {
    this.app.ajustes.guardar({
      zona: this.#zona,
      intercambiarManos: this.#intercambiarManos,
      latenciaCamara: this.#latencia,
      usarCamara: true,
      calibrado: true,
    });
    this.app.ir('/canciones');
  }
}

customElements.define('tb-vista-calibracion', VistaCalibracion);
