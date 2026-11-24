// @ts-check
import { Vista, escapar, numero, porcentaje, NOMBRES_DIFICULTAD } from './vista.js';
import { duracionEnPulsos } from '../audio/secuenciador.js';

/** Lista de canciones con sus dificultades y récords. */
class VistaCanciones extends Vista {
  pintar() {
    this.innerHTML = `
      <section class="pantalla">
        <header class="cabecera-pantalla">
          <a class="boton boton-volver" href="#/">← Menú</a>
          <h1>Elige canción</h1>
        </header>
        <div class="opcion-camara">
          <label class="interruptor">
            <input type="checkbox" data-opcion="camara" ${this.app.ajustes.datos.usarCamara ? 'checked' : ''} />
            <span>Jugar con la cámara</span>
          </label>
          <span class="nota">${this.app.ajustes.datos.calibrado
            ? 'Sin cámara se juega con el teclado. <a href="#/calibracion">Ajustar cámara</a>'
            : 'Antes de usarla, <a href="#/calibracion">calibra la cámara</a>.'}</span>
        </div>
        <p class="estado-carga" role="status">Cargando canciones…</p>
        <ul class="lista-canciones"></ul>
      </section>`;
    this.querySelector('[data-opcion="camara"]')?.addEventListener('change', (e) => {
      const activa = /** @type {HTMLInputElement} */ (e.target).checked;
      if (activa && !this.app.ajustes.datos.calibrado) {
        this.app.ir('/calibracion'); // la primera vez, a calibrar
        return;
      }
      this.app.ajustes.guardar({ usarCamara: activa });
    }, { signal: this.senal.signal });
    this.#cargar();
  }

  async #cargar() {
    const estado = /** @type {HTMLElement} */ (this.querySelector('.estado-carga'));
    try {
      const canciones = await this.app.canciones();
      const lista = /** @type {HTMLElement} */ (this.querySelector('.lista-canciones'));
      lista.innerHTML = canciones.map((c) => this.#tarjeta(c)).join('');
      estado.remove();
    } catch (error) {
      estado.textContent = `No se pudieron cargar las canciones: ${error instanceof Error ? error.message : error}`;
      estado.classList.add('error');
    }
    // Cualquier clic en una dificultad desbloquea el audio (es un gesto del usuario).
    this.addEventListener('click', (e) => {
      if (/** @type {Element} */ (e.target).closest('a[href^="#/partida"]')) this.app.audio.desbloquear();
    }, { signal: this.senal.signal });
  }

  /** @param {import('../motor/partitura.js').Cancion} c */
  #tarjeta(c) {
    const segundos = c.musica ? Math.round((duracionEnPulsos(/** @type {any} */ (c.musica)) * 60) / c.bpm) : null;
    const duracion = segundos ? `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}` : '';
    const dificultades = Object.entries(c.dificultades)
      .map(([dif, notas]) => {
        const record = this.app.records.obtener(c.id, dif);
        const textoRecord = record
          ? `<span class="record">Récord: <strong>${record.nota}</strong> · ${numero(record.puntos)} · ${porcentaje(record.precision)}</span>`
          : '<span class="record">Sin jugar</span>';
        return `
          <li>
            <a class="dificultad" href="#/partida/${encodeURIComponent(c.id)}/${encodeURIComponent(dif)}">
              <span class="nombre-dificultad">${escapar(NOMBRES_DIFICULTAD[dif] ?? dif)}</span>
              <span class="notas">${notas.length} notas</span>
              ${textoRecord}
            </a>
          </li>`;
      })
      .join('');
    return `
      <li class="tarjeta-cancion">
        <h2>${escapar(c.titulo)}</h2>
        <p class="datos-cancion">${escapar(c.autor ?? '')} · ${c.bpm} BPM${duracion ? ` · ${duracion}` : ''}</p>
        <ul class="dificultades" aria-label="Dificultades de ${escapar(c.titulo)}">${dificultades}</ul>
      </li>`;
  }
}

customElements.define('tb-vista-canciones', VistaCanciones);
