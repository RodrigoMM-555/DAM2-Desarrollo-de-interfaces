// @ts-check
import { Vista, escapar, numero, porcentaje, NOMBRES_DIFICULTAD } from './vista.js';
import { EntradaVoz, hablar, vozDisponible } from '../entrada/voz.js';

/** Resumen de la última partida. */
class VistaResultados extends Vista {
  /** @type {EntradaVoz | null} */
  #voz = null;

  limpiar() {
    this.#voz?.detener();
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }

  pintar() {
    const resultado = this.app.ultimoResultado;
    if (!resultado) {
      queueMicrotask(() => this.app.ir('/canciones'));
      return;
    }
    const { cancion, dificultad, resumen: r, nuevoRecord } = resultado;
    const fila = (/** @type {string} */ clase, /** @type {string} */ nombre, /** @type {number} */ n) =>
      `<tr class="${clase}"><th scope="row">${nombre}</th><td>${n}</td></tr>`;
    this.innerHTML = `
      <section class="pantalla resultados">
        <h1>${escapar(cancion.titulo)} <span class="subtitulo">${escapar(NOMBRES_DIFICULTAD[dificultad] ?? dificultad)}</span></h1>
        <div class="nota-final nota-${r.nota}" aria-label="Nota final ${r.nota}">${r.nota}</div>
        ${nuevoRecord ? '<p class="nuevo-record" role="status">¡Nuevo récord!</p>' : ''}
        <dl class="datos-resultado">
          <div><dt>Puntos</dt><dd>${numero(r.puntos)}</dd></div>
          <div><dt>Precisión</dt><dd>${porcentaje(r.precision)}</dd></div>
          <div><dt>Combo máximo</dt><dd>${r.comboMaximo}</dd></div>
        </dl>
        <table class="tabla-calificaciones">
          <caption>Notas por calificación</caption>
          <tbody>
            ${fila('c-perfecto', '¡Perfecto!', r.cuenta.perfecto)}
            ${fila('c-bien', 'Bien', r.cuenta.bien)}
            ${fila('c-justo', 'Justo', r.cuenta.justo)}
            ${fila('c-fallo', 'Fallo', r.cuenta.fallo)}
          </tbody>
        </table>
        <nav class="acciones">
          <a class="boton boton-principal" href="#/partida/${encodeURIComponent(cancion.id)}/${encodeURIComponent(dificultad)}">Repetir</a>
          <a class="boton" href="#/canciones">Otra canción</a>
          <a class="boton" href="#/">Menú</a>
        </nav>
        <p class="nota indicador-voz-resultados" hidden>🎤 Puedes decir «repetir», «canciones» o «menú».</p>
      </section>`;

    const ajustes = this.app.ajustes.datos;
    // Habla: el resultado, en voz alta (síntesis local).
    if (ajustes.leerResultados) {
      hablar(`Nota ${r.nota}. ${numero(r.puntos)} puntos. Precisión del ${Math.round(r.precision * 100)} por ciento.${nuevoRecord ? ' ¡Nuevo récord!' : ''}`);
    }
    // Voz: elegir qué hacer sin tocar nada.
    if (ajustes.usarVoz && vozDisponible()) {
      const voz = new EntradaVoz();
      voz.permitidas = ['repetir', 'reiniciar', 'canciones', 'menu', 'salir'];
      voz.addEventListener('orden', (e) => {
        const { orden } = /** @type {CustomEvent} */ (e).detail;
        if (orden === 'repetir' || orden === 'reiniciar') this.app.ir(`/partida/${cancion.id}/${dificultad}`);
        else if (orden === 'canciones') this.app.ir('/canciones');
        else this.app.ir('/');
      });
      if (voz.iniciar()) {
        this.#voz = voz;
        /** @type {HTMLElement} */ (this.querySelector('.indicador-voz-resultados')).hidden = false;
      }
    }
  }
}

customElements.define('tb-vista-resultados', VistaResultados);
