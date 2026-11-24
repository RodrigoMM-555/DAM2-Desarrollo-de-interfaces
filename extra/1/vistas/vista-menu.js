// @ts-check
import { Vista } from './vista.js';

/** Pantalla de inicio. */
class VistaMenu extends Vista {
  pintar() {
    this.innerHTML = `
      <section class="pantalla menu">
        <h1 class="titulo-juego" aria-label="Tumbao">
          <span>TUM</span><span>BAO</span>
        </h1>
        <p class="lema">Pon cada mano en su carril, a tiempo con la música.</p>
        <div class="leyenda-manos" aria-hidden="true">
          <span class="ficha ficha-i">I</span> mano izquierda
          <span class="ficha ficha-d">D</span> mano derecha
        </div>
        <nav class="acciones" aria-label="Menú principal">
          <a class="boton boton-principal" href="#/canciones">Jugar</a>
          <a class="boton" href="#/calibracion">Cámara</a>
          <a class="boton" href="#/editor">Crear partitura</a>
          <a class="boton" href="#/ajustes">Ajustes</a>
          <button class="boton" type="button" data-accion="ayuda">Cómo se juega</button>
        </nav>
        <dialog class="ayuda" aria-labelledby="titulo-ayuda">
          <h2 id="titulo-ayuda">Cómo se juega</h2>
          <ol>
            <li>Por los cuatro carriles bajan <strong>manos</strong>:
              <span class="texto-i">azules con una I</span> para la izquierda y
              <span class="texto-d">naranjas con una D</span> para la derecha.</li>
            <li>Coloca <strong>esa mano en ese carril</strong> antes de que la nota llegue a la línea.</li>
            <li>Llegar en el último pulso es <strong>¡Perfecto!</strong>; llegar mucho antes, <strong>Bien</strong>;
              en el último instante, <strong>Justo</strong>. Si no estás, es <strong>Fallo</strong> y pierdes el combo.</li>
            <li>Las notas con <strong>cola</strong> hay que mantenerlas: deja la mano en el carril hasta que termine.</li>
            <li>Encadena aciertos: el combo multiplica los puntos (×2, ×3, ×4).</li>
          </ol>
          <h3>Con la cámara</h3>
          <p>Siéntate delante del ordenador y pulsa <strong>Cámara</strong> para ajustar la zona de juego.
            Levanta las manos a la altura del pecho para entrar en los carriles; bájalas para descansar.
            El <strong>punto de color</strong> sobre la línea marca dónde ve la cámara cada mano en ese momento;
            si está hueco, la mano está demasiado alta o baja y no cuenta.
            La imagen se analiza en tu ordenador y no se envía a ningún sitio.</p>
          <h3>Con el teclado</h3>
          <p>Mantén pulsada la tecla del carril:</p>
          <table class="tabla-teclas">
            <thead><tr><th scope="col">Mano</th><th scope="col">Carril 1</th><th scope="col">2</th><th scope="col">3</th><th scope="col">4</th></tr></thead>
            <tbody>
              <tr><th scope="row" class="texto-i">Izquierda</th><td><kbd>A</kbd></td><td><kbd>S</kbd></td><td><kbd>D</kbd></td><td><kbd>F</kbd></td></tr>
              <tr><th scope="row" class="texto-d">Derecha</th><td><kbd>J</kbd></td><td><kbd>K</kbd></td><td><kbd>L</kbd></td><td><kbd>Ñ</kbd></td></tr>
            </tbody>
          </table>
          <p><kbd>Esc</kbd> pausa la partida.</p>
          <form method="dialog"><button class="boton boton-principal">Entendido</button></form>
        </dialog>
      </section>`;
    const dialogo = /** @type {HTMLDialogElement} */ (this.querySelector('dialog'));
    this.querySelector('[data-accion="ayuda"]')?.addEventListener('click', () => dialogo.showModal(), {
      signal: this.senal.signal,
    });
  }
}

customElements.define('tb-vista-menu', VistaMenu);
