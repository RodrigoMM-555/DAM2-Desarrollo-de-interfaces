// @ts-check
/**
 * Ajustes: sonido, velocidad de las notas, accesibilidad, cámara y datos.
 * Cada cambio se guarda y se aplica al momento (no hay botón "Guardar" que
 * olvidar); un aviso discreto confirma que se ha guardado.
 */
import { Vista } from './vista.js';
import { ANTELACION } from '../servicios/ajustes.js';
import { vozDisponible } from '../entrada/voz.js';

class VistaAjustes extends Vista {
  pintar() {
    const a = this.app.ajustes.datos;
    const pct = (/** @type {number} */ v) => Math.round(v * 100);
    this.innerHTML = `
      <section class="pantalla">
        <header class="cabecera-pantalla">
          <a class="boton boton-volver" href="#/">← Menú</a>
          <h1>Ajustes</h1>
        </header>
        <form class="ajustes" novalidate>
          <fieldset>
            <legend>Sonido</legend>
            <label class="campo-deslizador">
              <span>Música <output data-salida="volumenMusica">${pct(a.volumenMusica)} %</output></span>
              <input type="range" name="volumenMusica" min="0" max="100" step="5" value="${pct(a.volumenMusica)}" />
            </label>
            <label class="campo-deslizador">
              <span>Efectos (aciertos, metrónomo) <output data-salida="volumenEfectos">${pct(a.volumenEfectos)} %</output></span>
              <input type="range" name="volumenEfectos" min="0" max="100" step="5" value="${pct(a.volumenEfectos)}" />
            </label>
            <button class="boton boton-pequeno" type="button" data-accion="probar">Probar sonido</button>
          </fieldset>

          <fieldset>
            <legend>Juego</legend>
            <label class="campo-deslizador">
              <span>Tiempo que tarda una nota en bajar <output data-salida="antelacion">${formatoSegundos(a.antelacion)}</output></span>
              <input type="range" name="antelacion" min="${ANTELACION.minima}" max="${ANTELACION.maxima}" step="0.1" value="${a.antelacion}"
                aria-describedby="ayuda-antelacion" />
            </label>
            <p class="nota" id="ayuda-antelacion">Más tiempo = notas más lentas y fáciles de leer. No cambia el ritmo de la canción.</p>
          </fieldset>

          <fieldset>
            <legend>Accesibilidad</legend>
            <label class="interruptor">
              <input type="checkbox" name="reducirMovimiento" ${a.reducirMovimiento ? 'checked' : ''} />
              <span>Reducir movimiento (sin destellos ni deslizamientos)</span>
            </label>
            <p class="nota">Se activa solo si tu sistema ya lo pide. El juego se puede jugar entero con el teclado.</p>
          </fieldset>

          <fieldset>
            <legend>Cámara</legend>
            <label class="interruptor">
              <input type="checkbox" name="usarCamara" ${a.usarCamara ? 'checked' : ''} ${a.calibrado ? '' : 'disabled'} />
              <span>Jugar con la cámara</span>
            </label>
            <label class="interruptor">
              <input type="checkbox" name="vistaAR" ${a.vistaAR ? 'checked' : ''} />
              <span>Realidad aumentada: jugar sobre tu imagen</span>
            </label>
            <p class="nota">Las notas caen sobre la imagen de la cámara, justo donde tienes que poner las manos,
              y cada mano lleva un esqueleto virtual de su color.</p>
            <p class="nota">${a.calibrado ? `Retraso compensado: ${Math.round(a.latenciaCamara * 1000)} ms.` : 'Aún no está calibrada.'}
              <a href="#/calibracion">Calibrar la cámara</a></p>
          </fieldset>

          <fieldset>
            <legend>Voz</legend>
            <label class="interruptor">
              <input type="checkbox" name="usarVoz" ${a.usarVoz ? 'checked' : ''} ${vozDisponible() ? '' : 'disabled'} />
              <span>Órdenes de voz: «empezar», «pausa», «continuar», «reiniciar», «salir»</span>
            </label>
            <p class="nota">${vozDisponible()
              ? 'Tienes las manos ocupadas: pausa la partida diciéndolo. En Chrome y Edge el reconocimiento lo hace un servicio en línea, así que tu voz sale del ordenador mientras está activado.'
              : 'Tu navegador no tiene reconocimiento de voz (Firefox no lo incluye). Prueba con Chrome o Edge.'}</p>
            <label class="interruptor">
              <input type="checkbox" name="leerResultados" ${a.leerResultados ? 'checked' : ''} />
              <span>Leer el resultado en voz alta al terminar</span>
            </label>
          </fieldset>

          <fieldset>
            <legend>Datos</legend>
            <button class="boton boton-pequeno" type="button" data-accion="borrar">Borrar récords</button>
          </fieldset>
        </form>
        <p class="aviso-guardado" role="status" aria-live="polite"></p>
      </section>`;

    const opciones = { signal: this.senal.signal };
    this.addEventListener('input', (e) => this.#alCambiar(/** @type {HTMLInputElement} */ (e.target)), opciones);
    this.addEventListener('click', (e) => {
      const accion = /** @type {HTMLElement} */ (e.target).closest('button')?.dataset.accion;
      if (accion === 'probar') this.#probarSonido();
      else if (accion === 'borrar') this.#borrarRecords();
    }, opciones);
  }

  /** @param {HTMLInputElement} entrada */
  #alCambiar(entrada) {
    const { name } = entrada;
    if (!name) return;
    /** @type {any} */
    const cambio = {};
    if (entrada.type === 'checkbox') cambio[name] = entrada.checked;
    else if (name === 'antelacion') cambio[name] = Number(entrada.value);
    else cambio[name] = Number(entrada.value) / 100;
    this.app.ajustes.guardar(cambio);
    this.app.aplicarAjustes();

    const salida = this.querySelector(`[data-salida="${name}"]`);
    if (salida) salida.textContent = name === 'antelacion' ? formatoSegundos(cambio[name]) : `${entrada.value} %`;
    this.#avisar('Guardado');
  }

  async #probarSonido() {
    await this.app.audio.desbloquear();
    this.app.audio.metronomo(120, 4, 0.05);
  }

  #borrarRecords() {
    if (!confirm('¿Borrar todos los récords? No se puede deshacer.')) return;
    this.app.records.borrar();
    this.#avisar('Récords borrados');
  }

  /** @param {string} texto */
  #avisar(texto) {
    const aviso = /** @type {HTMLElement} */ (this.querySelector('.aviso-guardado'));
    aviso.textContent = `✓ ${texto}`;
  }
}

/** 2 → "2,0 s" @param {number} s */
const formatoSegundos = (s) => `${s.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;

customElements.define('tb-vista-ajustes', VistaAjustes);
