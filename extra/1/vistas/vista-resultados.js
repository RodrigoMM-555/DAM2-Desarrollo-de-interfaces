// @ts-check
import { Vista, escapar, numero, porcentaje, NOMBRES_DIFICULTAD } from './vista.js';

/** Resumen de la última partida. */
class VistaResultados extends Vista {
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
      </section>`;
  }
}

customElements.define('tb-vista-resultados', VistaResultados);
