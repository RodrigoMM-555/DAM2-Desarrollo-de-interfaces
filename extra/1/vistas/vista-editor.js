// @ts-check
/**
 * Editor de partituras: suena la música de una canción y el jugador coloca
 * las manos al ritmo (teclado o cámara). Cada entrada en un carril se graba
 * como una nota (GrabadorPartitura). Al terminar se puede probar la
 * partitura en una partida o descargarla en JSON para añadirla al juego.
 */
import { Vista, escapar } from './vista.js';
import { GrabadorPartitura } from '../motor/grabador.js';
import { segundosPorPulso, validarCancion } from '../motor/partitura.js';
import { EntradaTeclado, ETIQUETAS } from '../entrada/teclado.js';
import '../componentes/tb-pista.js';
import '../componentes/tb-camara.js';

/** @typedef {import('../motor/partitura.js').Cancion} Cancion */

const RETARDO_INICIO = 2;

class VistaEditor extends Vista {
  /** @type {Cancion[]} */
  #canciones = [];
  #teclado = new EntradaTeclado();
  /** @type {GrabadorPartitura | null} */
  #grabador = null;
  #bucle = 0;
  #conCamara = false;
  #fin = 0;
  /** @type {import('../motor/partitura.js').NotaPartitura[]} */
  #notas = [];
  /** @type {Cancion | null} */
  #base = null;

  /** @param {string} s */
  #el(s) {
    return /** @type {HTMLElement} */ (this.querySelector(s));
  }

  pintar() {
    this.innerHTML = `
      <section class="pantalla pantalla-ancha editor">
        <header class="cabecera-pantalla">
          <a class="boton boton-volver" href="#/">← Menú</a>
          <h1>Crear partitura</h1>
        </header>
        <form class="editor-opciones">
          <label>Música
            <select name="cancion"><option>Cargando…</option></select>
          </label>
          <label>Ajustar notas a
            <select name="cuantizacion">
              <option value="1">pulsos (negras)</option>
              <option value="0.5" selected>medios pulsos (corcheas)</option>
            </select>
          </label>
          <button class="boton boton-principal" type="button" data-accion="grabar">Grabar</button>
          <button class="boton" type="button" data-accion="parar" hidden>Parar (Esc)</button>
        </form>
        <p class="nota">Suena la música: coloca cada mano en un carril al ritmo y se grabará una nota.
          Si la dejas 2 pulsos o más, será una nota de mantener.
          Teclado: <span class="texto-i">${ETIQUETAS.i.join(' ')}</span> · <span class="texto-d">${ETIQUETAS.d.join(' ')}</span>.</p>
        <div class="editor-escenario">
          <tb-pista class="pista-editor"></tb-pista>
          <aside class="editor-lateral">
            <tb-camara hidden></tb-camara>
            <p class="editor-contador" role="status">0 notas</p>
          </aside>
        </div>
        <div class="editor-resultado" hidden>
          <h2>Tu partitura</h2>
          <p class="editor-resumen"></p>
          <div class="acciones acciones-izquierda">
            <button class="boton boton-principal" type="button" data-accion="probar">Probarla</button>
            <a class="boton" data-accion="descargar" download>Descargar JSON</a>
          </div>
        </div>
      </section>`;

    const opciones = { signal: this.senal.signal };
    this.addEventListener('click', (e) => {
      const accion = /** @type {HTMLElement} */ (e.target).closest('[data-accion]')?.getAttribute('data-accion');
      if (accion === 'grabar') this.#grabar();
      else if (accion === 'parar') this.#parar();
      else if (accion === 'probar') this.#probar();
    }, opciones);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.#grabador) this.#parar();
    }, opciones);
    this.#teclado.addEventListener('cambiomanos', () => this.#alMoverManos(), opciones);
    this.app.camara.addEventListener('cambiomanos', () => this.#alMoverManos(), opciones);
    this.app.camara.addEventListener('fotograma', (e) => {
      /** @type {any} */ (this.querySelector('tb-camara')).dibujar(/** @type {CustomEvent} */ (e).detail, this.app.camara.zona.zona);
    }, opciones);
    this.#cargarCanciones();
  }

  limpiar() {
    cancelAnimationFrame(this.#bucle);
    this.#teclado.desconectar();
    this.app.camara.detener();
    this.app.audio.detener();
  }

  async #cargarCanciones() {
    this.#canciones = (await this.app.canciones()).filter((c) => c.musica || c.audio);
    const select = /** @type {HTMLSelectElement} */ (this.querySelector('select[name="cancion"]'));
    select.innerHTML = this.#canciones
      .map((c, i) => `<option value="${i}">${escapar(c.titulo)} · ${c.bpm} BPM</option>`)
      .join('');
  }

  /** Estado combinado de teclado y cámara (manda la tecla, como en la partida). */
  get #manos() {
    const teclas = this.#teclado.estado;
    const camara = this.#conCamara ? this.app.camara.estado : { i: null, d: null };
    return { i: teclas.i ?? camara.i, d: teclas.d ?? camara.d };
  }

  #alMoverManos() {
    if (!this.#grabador) return;
    const t = this.app.audio.tiempo() - (this.#conCamara ? this.app.ajustes.datos.latenciaCamara : 0);
    this.#grabador.registrar(t, this.#manos);
    this.#el('.editor-contador').textContent = `${this.#grabador.notas().length} notas`;
  }

  async #grabar() {
    const formulario = /** @type {HTMLFormElement} */ (this.querySelector('.editor-opciones'));
    const base = this.#canciones[Number(formulario.cancion.value)];
    if (!base) return;
    this.#base = base;
    const audio = this.app.audio;
    await audio.desbloquear();
    this.#el('[data-accion="grabar"]').hidden = true;
    this.#el('[data-accion="parar"]').hidden = false;
    this.#el('.editor-resultado').hidden = true;
    this.#el('.editor-contador').textContent = 'Preparando…';

    // Cámara, si está activada en Ajustes.
    this.#conCamara = false;
    if (this.app.ajustes.datos.usarCamara) {
      const camara = /** @type {any} */ (this.querySelector('tb-camara'));
      camara.hidden = false;
      try {
        this.app.camara.configurar(this.app.ajustes.datos);
        await this.app.camara.iniciar(camara.video);
        this.#conCamara = true;
      } catch {
        camara.hidden = true;
      }
    }

    const buffer = await audio.prepararCancion(base, this.app.carpetaCanciones);
    if (!this.isConnected) return;
    this.#grabador = new GrabadorPartitura({
      bpm: base.bpm,
      cuantizacion: Number(formulario.cuantizacion.value),
      desfase: base.desfase ?? 0,
    });
    this.#fin = buffer.duration;
    this.#teclado.conectar();
    audio.reproducir(buffer, RETARDO_INICIO);
    this.#el('.editor-contador').textContent = '0 notas';

    const pista = /** @type {import('../componentes/tb-pista.js').TbPista} */ (this.querySelector('tb-pista'));
    pista.notas = [];
    pista.pulso = segundosPorPulso(base.bpm);
    pista.reiniciar();
    const fotograma = () => {
      const t = audio.tiempo();
      pista.dibujar(t, this.#manos);
      if (t >= this.#fin) return this.#parar();
      this.#bucle = requestAnimationFrame(fotograma);
    };
    this.#bucle = requestAnimationFrame(fotograma);
  }

  #parar() {
    if (!this.#grabador || !this.#base) return;
    cancelAnimationFrame(this.#bucle);
    this.#notas = this.#grabador.terminar(this.app.audio.tiempo());
    this.#grabador = null;
    this.app.audio.detener();
    this.#teclado.desconectar();
    this.app.camara.detener();
    this.#el('[data-accion="grabar"]').hidden = false;
    this.#el('[data-accion="parar"]').hidden = true;
    /** @type {any} */ (this.querySelector('tb-camara')).hidden = true;
    this.#mostrarResultado();
  }

  /** La canción nueva: la música de la base con la partitura grabada. */
  #cancionNueva() {
    const base = /** @type {Cancion} */ (this.#base);
    return {
      ...base,
      id: `mi-partitura-${base.id}`,
      titulo: `${base.titulo} (mi partitura)`,
      autor: 'Grabada en el editor',
      dificultades: { grabada: this.#notas },
    };
  }

  #mostrarResultado() {
    const resultado = this.#el('.editor-resultado');
    resultado.hidden = false;
    const resumen = this.#el('.editor-resumen');
    const probar = /** @type {HTMLButtonElement} */ (this.querySelector('[data-accion="probar"]'));
    const descargar = /** @type {HTMLAnchorElement} */ (this.querySelector('[data-accion="descargar"]'));
    if (!this.#notas.length) {
      resumen.textContent = 'No se ha grabado ninguna nota. Prueba otra vez colocando las manos en los carriles.';
      probar.disabled = true;
      descargar.hidden = true;
      return;
    }
    const cancion = this.#cancionNueva();
    const errores = validarCancion(cancion);
    const mantener = this.#notas.filter((n) => n.duracion).length;
    resumen.textContent = errores.length
      ? `Hay problemas: ${errores.join(' ')}`
      : `${this.#notas.length} notas (${mantener} de mantener). Lista para jugar.`;
    probar.disabled = errores.length > 0;
    descargar.hidden = false;
    URL.revokeObjectURL(descargar.href);
    descargar.href = URL.createObjectURL(new Blob([JSON.stringify(cancion, null, 2)], { type: 'application/json' }));
    descargar.download = `${cancion.id}.json`;
  }

  #probar() {
    const cancion = this.#cancionNueva();
    this.app.registrarCancion(cancion);
    this.app.ir(`/partida/${cancion.id}/grabada`);
  }
}

customElements.define('tb-vista-editor', VistaEditor);
