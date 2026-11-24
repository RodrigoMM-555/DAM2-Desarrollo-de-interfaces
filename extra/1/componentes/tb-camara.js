// @ts-check
/**
 * <tb-camara>: la imagen de la cámara **en espejo** (si mueves la mano a tu
 * derecha, la ves ir a la derecha) con la zona de juego, los cuatro carriles
 * y las manos detectadas dibujados encima.
 *
 * - `video`: el <video> interno, para pasárselo a EntradaCamara.
 * - `dibujar(detalle, zona)`: pinta un fotograma (lo llama quien escucha a la cámara).
 *
 * Las coordenadas que recibe ya son del punto de vista del jugador, igual
 * que la imagen en espejo: se dibujan tal cual, sin invertir.
 *
 * Variables CSS: --color-izquierda, --color-derecha.
 */

/** @typedef {import('../entrada/camara.js').DetalleFotograma} DetalleFotograma */
/** @typedef {import('../entrada/zona-juego.js').Rectangulo} Rectangulo */

export class TbCamara extends HTMLElement {
  #video = document.createElement('video');
  #lienzo = document.createElement('canvas');
  #ctx = /** @type {CanvasRenderingContext2D} */ (this.#lienzo.getContext('2d'));
  #colores = { i: '#4da3ff', d: '#ff9442' };

  constructor() {
    super();
    const sombra = this.attachShadow({ mode: 'open' });
    const estilo = document.createElement('style');
    estilo.textContent = `
      :host { display: block; position: relative; aspect-ratio: 4 / 3; overflow: hidden;
              border-radius: 12px; background: #0b0816; }
      video, canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
      video { object-fit: fill; transform: scaleX(-1); opacity: 0.75; }
    `;
    this.#video.muted = true;
    this.#video.playsInline = true;
    this.#video.setAttribute('aria-hidden', 'true');
    this.#lienzo.setAttribute('role', 'img');
    this.#lienzo.setAttribute('aria-label', 'Imagen de la cámara con los carriles y tus manos');
    // La caja toma la proporción real de la cámara (4:3, 16:9…).
    this.#video.addEventListener('loadedmetadata', () => {
      if (this.#video.videoWidth) this.style.aspectRatio = `${this.#video.videoWidth} / ${this.#video.videoHeight}`;
    });
    sombra.append(estilo, this.#video, this.#lienzo);
  }

  get video() {
    return this.#video;
  }

  connectedCallback() {
    const css = getComputedStyle(this);
    this.#colores = {
      i: css.getPropertyValue('--color-izquierda').trim() || this.#colores.i,
      d: css.getPropertyValue('--color-derecha').trim() || this.#colores.d,
    };
  }

  /**
   * @param {DetalleFotograma | null} detalle
   * @param {Rectangulo} zona
   */
  dibujar(detalle, zona) {
    const escala = window.devicePixelRatio || 1;
    const ancho = this.clientWidth;
    const alto = this.clientHeight;
    if (!ancho || !alto) return;
    if (this.#lienzo.width !== Math.round(ancho * escala)) {
      this.#lienzo.width = Math.round(ancho * escala);
      this.#lienzo.height = Math.round(alto * escala);
    }
    const ctx = this.#ctx;
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    ctx.clearRect(0, 0, ancho, alto);

    // Fuera de la zona, oscurecido
    const x0 = zona.izquierda * ancho;
    const x1 = zona.derecha * ancho;
    const y0 = zona.arriba * alto;
    const y1 = zona.abajo * alto;
    ctx.fillStyle = 'rgba(11, 8, 22, 0.55)';
    ctx.fillRect(0, 0, ancho, y0);
    ctx.fillRect(0, y1, ancho, alto - y1);
    ctx.fillRect(0, y0, x0, y1 - y0);
    ctx.fillRect(x1, y0, ancho - x1, y1 - y0);

    // Carriles ocupados
    const anchoCarril = (x1 - x0) / 4;
    for (const mano of /** @type {const} */ (['i', 'd'])) {
      const carril = detalle?.carriles[mano];
      if (carril === null || carril === undefined) continue;
      ctx.fillStyle = this.#colores[mano];
      ctx.globalAlpha = 0.3;
      ctx.fillRect(x0 + carril * anchoCarril, y0, anchoCarril, y1 - y0);
      ctx.globalAlpha = 1;
    }

    // Rejilla de carriles
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    for (let c = 1; c < 4; c++) {
      ctx.beginPath();
      ctx.moveTo(x0 + c * anchoCarril, y0);
      ctx.lineTo(x0 + c * anchoCarril, y1);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = `700 ${Math.max(11, Math.round(alto * 0.05))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let c = 0; c < 4; c++) ctx.fillText(String(c + 1), x0 + (c + 0.5) * anchoCarril, y0 + 6);

    // Manos
    const radio = Math.max(12, alto * 0.055);
    for (const mano of /** @type {const} */ (['i', 'd'])) {
      const p = detalle?.posiciones[mano];
      if (!p) continue;
      const x = p.x * ancho;
      const y = p.y * alto;
      ctx.fillStyle = this.#colores[mano];
      ctx.strokeStyle = '#150f26';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, radio, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#150f26';
      ctx.font = `900 ${Math.round(radio * 1.1)}px system-ui, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.fillText(mano === 'i' ? 'I' : 'D', x, y + 1);
    }
  }
}

customElements.define('tb-camara', TbCamara);
