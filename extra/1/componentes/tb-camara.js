// @ts-check
/**
 * <tb-camara>: la imagen de la cámara **en espejo** (si mueves la mano a tu
 * derecha, la ves ir a la derecha) con la zona de juego, los cuatro carriles
 * y las manos detectadas dibujados encima.
 *
 * Atributos (y propiedades equivalentes), con su valor por defecto:
 * - `esqueleto` (booleano, `false`): dibuja el esqueleto virtual de cada mano
 *   sobre la imagen (realidad aumentada: los 21 puntos de MediaPipe unidos).
 * - `sin-rejilla` (booleano, `false`): no dibuja la zona de juego ni los carriles
 *   (en el modo RA ya los dibuja la pista encima).
 *
 * Propiedad `video` (solo lectura): el <video> interno, para EntradaCamara.
 * Método `dibujar(detalle, zona)`: pinta un fotograma.
 * Evento `lista` → { ancho, alto }: la cámara ya da imagen (tamaño real).
 *
 *
 * Las coordenadas que recibe ya son del punto de vista del jugador, igual
 * que la imagen en espejo: se dibujan tal cual, sin invertir.
 *
 * Variables CSS: --color-izquierda, --color-derecha.
 */

/** @typedef {import('../entrada/camara.js').DetalleFotograma} DetalleFotograma */
/** @typedef {import('../entrada/zona-juego.js').Rectangulo} Rectangulo */

/** Pares de puntos de MediaPipe que forman los huesos de la mano. */
const HUESOS = [
  [0, 1], [1, 2], [2, 3], [3, 4], // pulgar
  [0, 5], [5, 6], [6, 7], [7, 8], // índice
  [5, 9], [9, 10], [10, 11], [11, 12], // corazón
  [9, 13], [13, 14], [14, 15], [15, 16], // anular
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20], // meñique y palma
];

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
      const { videoWidth: ancho, videoHeight: alto } = this.#video;
      if (!ancho) return;
      this.style.aspectRatio = `${ancho} / ${alto}`;
      this.dispatchEvent(new CustomEvent('lista', { detail: { ancho, alto } }));
    });
    sombra.append(estilo, this.#video, this.#lienzo);
  }

  get video() {
    return this.#video;
  }

  get esqueleto() {
    return this.hasAttribute('esqueleto');
  }

  set esqueleto(valor) {
    this.toggleAttribute('esqueleto', Boolean(valor));
  }

  get sinRejilla() {
    return this.hasAttribute('sin-rejilla');
  }

  set sinRejilla(valor) {
    this.toggleAttribute('sin-rejilla', Boolean(valor));
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
    if (this.#lienzo.width !== Math.round(ancho * escala) || this.#lienzo.height !== Math.round(alto * escala)) {
      this.#lienzo.width = Math.round(ancho * escala);
      this.#lienzo.height = Math.round(alto * escala);
    }
    const ctx = this.#ctx;
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    ctx.clearRect(0, 0, ancho, alto);

    if (!this.sinRejilla) this.#dibujarRejilla(ctx, ancho, alto, detalle, zona);
    if (this.esqueleto) this.#dibujarEsqueletos(ctx, ancho, alto, detalle);
    this.#dibujarManos(ctx, ancho, alto, detalle);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx @param {number} ancho @param {number} alto
   * @param {DetalleFotograma | null} detalle @param {Rectangulo} zona
   */
  #dibujarRejilla(ctx, ancho, alto, detalle, zona) {
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

  }

  /**
   * Realidad aumentada: un "guante" virtual del color de cada mano, pegado a
   * la mano real de la imagen.
   * @param {CanvasRenderingContext2D} ctx @param {number} ancho @param {number} alto
   * @param {DetalleFotograma | null} detalle
   */
  #dibujarEsqueletos(ctx, ancho, alto, detalle) {
    for (const mano of /** @type {const} */ (['i', 'd'])) {
      const puntos = detalle?.esqueletos?.[mano];
      if (!puntos) continue;
      ctx.lineCap = 'round';
      for (const [grosor, color] of /** @type {const} */ ([[7, '#150f26'], [4, this.#colores[mano]]])) {
        ctx.lineWidth = grosor;
        ctx.strokeStyle = color;
        ctx.beginPath();
        for (const [a, b] of HUESOS) {
          ctx.moveTo(puntos[a].x * ancho, puntos[a].y * alto);
          ctx.lineTo(puntos[b].x * ancho, puntos[b].y * alto);
        }
        ctx.stroke();
      }
      ctx.fillStyle = '#f7efe3';
      for (const p of puntos) {
        ctx.beginPath();
        ctx.arc(p.x * ancho, p.y * alto, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx @param {number} ancho @param {number} alto
   * @param {DetalleFotograma | null} detalle
   */
  #dibujarManos(ctx, ancho, alto, detalle) {
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
