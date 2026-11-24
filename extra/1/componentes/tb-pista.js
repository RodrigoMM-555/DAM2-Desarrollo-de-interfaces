// @ts-check
/**
 * <tb-pista>: la pista de 4 carriles, dibujada en un <canvas>.
 *
 * Es un componente "tonto": no lleva el tiempo ni juzga nada. Quien lo usa
 * le pasa las notas (`notas`) y en cada fotograma llama a
 * `dibujar(t, manos, puntos)`. Para los destellos de acierto/fallo, `marcar(juicio)`.
 *
 * Posición de una nota (docs/DISEÑO.md §5.7):
 *     y = yLinea − (tNota − t) / antelacion × yLinea
 * Con `antelacion` = segundos que tarda una nota en bajar desde arriba.
 *
 * Accesibilidad: las manos se distinguen por color **y** por forma (la mano
 * izquierda tiene el pulgar a la derecha, como cuando miras el dorso de tu
 * mano izquierda) **y** por la letra I / D.
 *
 * Atributos: `antelacion` (s, por defecto 2).
 * Variables CSS: --color-izquierda, --color-derecha, --color-texto, --color-fondo.
 */

/** @typedef {import('../motor/partitura.js').Nota} Nota */
/** @typedef {import('../motor/juez.js').Juicio} Juicio */
/** @typedef {import('../motor/juez.js').EstadoManos} EstadoManos */
/**
 * Posición real de cada mano en la pista: `u` de 0 (borde izquierdo de la
 * zona de juego) a 1 (borde derecho); `dentro` = está a una altura que cuenta.
 * @typedef {{ i: { u: number, dentro: boolean } | null, d: { u: number, dentro: boolean } | null }} PuntosManos
 */

const CARRILES = 4;
/** Altura de la línea de juicio (proporción del alto). */
const LINEA = 0.84;
/** Duración de los destellos (ms). */
const DURACION_EFECTO = 650;
/**
 * Constante de tiempo (s) con la que la mano de la línea se desliza hasta su
 * carril nuevo. Pequeña: se ve fluido pero sin ir "por detrás" de la mano.
 */
const DESLIZAMIENTO = 0.07;
/** Constante de tiempo (s) del punto de posición real (solo suaviza los saltos de 30 fps). */
const SUAVIZADO_PUNTO = 0.03;

const TEXTOS = /** @type {const} */ ({ perfecto: '¡Perfecto!', bien: 'Bien', justo: 'Justo', fallo: 'Fallo' });
const COLORES_CALIFICACION = { perfecto: '#ffd166', bien: '#7fe0a8', justo: '#d9cfea', fallo: '#ff7a8a' };

export class TbPista extends HTMLElement {
  static get observedAttributes() {
    return ['antelacion'];
  }

  /** @type {Nota[]} */
  notas = [];
  /** Segundos de un pulso (para las líneas de compás). 0 = sin líneas. */
  pulso = 0;
  /** Ids de notas acertadas (dejan de dibujarse). @type {Set<number>} */
  #acertadas = new Set();
  /** Notas de mantener cuya cabeza se acertó y que aún no han terminado. @type {Set<number>} */
  #manteniendo = new Set();
  /** @type {{ carril: number, calificacion: keyof TEXTOS, mano: 'i' | 'd', inicio: number }[]} */
  #efectos = [];
  #lienzo = document.createElement('canvas');
  #ctx = /** @type {CanvasRenderingContext2D} */ (this.#lienzo.getContext('2d'));
  #ancho = 0;
  #alto = 0;
  #colores = { i: '#4da3ff', d: '#ff9442', texto: '#f7efe3', fondo: '#150f26' };
  #movimientoReducido = matchMedia('(prefers-reduced-motion: reduce)');
  /** Lo que se está mostrando de cada mano en la línea: posición en carriles (fraccionaria) y opacidad. */
  #mostradas = {
    i: { x: 0, desplazamiento: 0, alfa: 0 },
    d: { x: 0, desplazamiento: 0, alfa: 0 },
  };
  /** Punto de posición real mostrado (0–1 en la anchura de la pista). */
  #puntosMostrados = { i: /** @type {number | null} */ (null), d: /** @type {number | null} */ (null) };
  #ultimoInstante = 0;
  #observador = new ResizeObserver(() => this.#ajustarTamano());

  constructor() {
    super();
    const sombra = this.attachShadow({ mode: 'open' });
    const estilo = document.createElement('style');
    estilo.textContent = ':host{display:block;position:relative;min-height:240px}canvas{position:absolute;inset:0;width:100%;height:100%}';
    this.#lienzo.setAttribute('role', 'img');
    this.#lienzo.setAttribute('aria-label', 'Pista de notas');
    sombra.append(estilo, this.#lienzo);
  }

  get antelacion() {
    const valor = Number(this.getAttribute('antelacion'));
    return valor > 0 ? valor : 2;
  }

  connectedCallback() {
    const css = getComputedStyle(this);
    const leer = (/** @type {string} */ nombre, /** @type {string} */ porDefecto) =>
      css.getPropertyValue(nombre).trim() || porDefecto;
    this.#colores = {
      i: leer('--color-izquierda', this.#colores.i),
      d: leer('--color-derecha', this.#colores.d),
      texto: leer('--color-texto', this.#colores.texto),
      fondo: leer('--color-fondo', this.#colores.fondo),
    };
    this.#observador.observe(this);
    this.#ajustarTamano();
  }

  disconnectedCallback() {
    this.#observador.disconnect();
  }

  /** Vuelve a empezar (al repetir la canción). */
  reiniciar() {
    this.#acertadas.clear();
    this.#manteniendo.clear();
    this.#efectos = [];
  }

  /**
   * Muestra el resultado de una nota.
   * @param {Juicio} juicio
   */
  marcar(juicio) {
    const { nota } = juicio;
    if (juicio.tipo === 'cola') {
      this.#manteniendo.delete(nota.id);
      this.#acertadas.add(nota.id);
    } else if (juicio.calificacion !== 'fallo') {
      // Una nota de mantener acertada sigue en pantalla: se ve su cola consumiéndose.
      (nota.duracion > 0 ? this.#manteniendo : this.#acertadas).add(nota.id);
    }
    this.#efectos.push({
      carril: juicio.nota.carril,
      calificacion: juicio.calificacion,
      mano: juicio.nota.mano,
      inicio: performance.now(),
    });
  }

  /** Lienzo a la resolución real de la pantalla (nítido en pantallas HiDPI). */
  #ajustarTamano() {
    const escala = window.devicePixelRatio || 1;
    this.#ancho = this.clientWidth;
    this.#alto = this.clientHeight;
    this.#lienzo.width = Math.round(this.#ancho * escala);
    this.#lienzo.height = Math.round(this.#alto * escala);
    this.#ctx.setTransform(escala, 0, 0, escala, 0, 0);
  }

  /**
   * Dibuja la pista en el instante `t` de la canción.
   * @param {number} t
   * @param {EstadoManos} manos Carril registrado de cada mano.
   * @param {PuntosManos | null} [puntos] Posición real de cada mano (solo con cámara).
   */
  dibujar(t, manos, puntos = null) {
    const ctx = this.#ctx;
    const ancho = this.#ancho;
    const alto = this.#alto;
    if (!ancho || !alto) return;
    ctx.clearRect(0, 0, ancho, alto);

    // Tiempo real entre dibujos, para las transiciones (independiente de la canción).
    const ahora = performance.now();
    const dt = this.#ultimoInstante ? Math.min(0.1, (ahora - this.#ultimoInstante) / 1000) : 0;
    this.#ultimoInstante = ahora;
    const reducido =
      this.#movimientoReducido.matches || document.documentElement.classList.contains('reducir-movimiento');
    /** Fracción del camino que se recorre en este fotograma (suavizado exponencial). */
    const avanzar = (/** @type {number} */ tau) => (reducido ? 1 : 1 - Math.exp(-dt / tau));

    // Pista centrada, como mucho 0,8 veces el alto de ancho.
    const anchoPista = Math.min(ancho - 16, alto * 0.8);
    const x0 = (ancho - anchoPista) / 2;
    const anchoCarril = anchoPista / CARRILES;
    const yLinea = alto * LINEA;
    const velocidad = yLinea / this.antelacion; // píxeles por segundo
    const centro = (/** @type {number} */ c) => x0 + anchoCarril * (c + 0.5);
    const tam = Math.min(anchoCarril * 0.62, 64);

    // Carriles
    for (let c = 0; c < CARRILES; c++) {
      ctx.fillStyle = c % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(x0 + c * anchoCarril, 0, anchoCarril, alto);
    }

    // Líneas de pulso: ayudan a leer el ritmo. Cada 4 pulsos, más marcada.
    if (this.pulso > 0) {
      const primero = Math.ceil((t - 0.5) / this.pulso);
      for (let k = primero; k * this.pulso <= t + this.antelacion; k++) {
        const y = yLinea - (k * this.pulso - t) * velocidad;
        ctx.fillStyle = k % 4 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)';
        ctx.fillRect(x0, y - 1, anchoPista, k % 4 === 0 ? 2 : 1);
      }
    }

    // Línea de juicio y huecos
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(x0, yLinea - 1.5, anchoPista, 3);
    for (let c = 0; c < CARRILES; c++) {
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centro(c), yLinea, tam * 0.72, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Carril registrado de cada mano: la mano y su franja se **deslizan** hasta
    // el carril nuevo en vez de saltar, y aparecen/desaparecen con un fundido.
    for (const mano of /** @type {const} */ (['i', 'd'])) {
      const m = this.#mostradas[mano];
      const carril = manos[mano];
      const ambas = manos.i !== null && manos.i === manos.d;
      const desplazamiento = ambas ? (mano === 'i' ? -0.18 : 0.18) : 0;
      if (carril !== null) {
        if (m.alfa < 0.02) {
          // Estaba oculta: aparece directamente en su carril, sin cruzar la pista.
          m.x = carril;
          m.desplazamiento = desplazamiento;
        }
        m.x += (carril - m.x) * avanzar(DESLIZAMIENTO);
        m.desplazamiento += (desplazamiento - m.desplazamiento) * avanzar(DESLIZAMIENTO);
        m.alfa += (1 - m.alfa) * avanzar(0.06);
      } else {
        m.alfa -= m.alfa * avanzar(0.08);
      }
      if (m.alfa < 0.02) continue;
      ctx.globalAlpha = 0.28 * m.alfa;
      ctx.fillStyle = this.#colores[mano];
      ctx.fillRect(x0 + m.x * anchoCarril, yLinea, anchoCarril, alto - yLinea);
      ctx.globalAlpha = 0.9 * m.alfa;
      const x = x0 + anchoCarril * (m.x + 0.5 + m.desplazamiento);
      dibujarMano(ctx, x, yLinea, tam * 0.85, mano, this.#colores[mano], this.#colores.fondo);
      ctx.globalAlpha = 1;
    }

    // Notas: de la más lejana a la más cercana, para que la cercana quede encima.
    for (let k = this.notas.length - 1; k >= 0; k--) {
      const nota = this.notas[k];
      if (this.#acertadas.has(nota.id)) continue;
      const y = yLinea - (nota.tiempo - t) * velocidad;
      const yFinal = y - nota.duracion * velocidad;
      if (yFinal > alto + tam || y < -tam) continue;
      if (this.#manteniendo.has(nota.id)) {
        // Cola de una nota que se está manteniendo: de la línea hacia arriba,
        // brillante si la mano sigue en el carril y apagada si se ha ido.
        const sigue = manos[nota.mano] === nota.carril;
        ctx.globalAlpha = sigue ? 0.9 : 0.3;
        ctx.fillStyle = this.#colores[nota.mano];
        const arriba = Math.min(yFinal, yLinea);
        ctx.fillRect(centro(nota.carril) - tam * 0.22, arriba, tam * 0.44, Math.max(0, yLinea - arriba));
        ctx.globalAlpha = 1;
        continue;
      }
      const pasada = nota.tiempo < t - 0.1;
      ctx.globalAlpha = pasada ? Math.max(0, 0.45 - (t - nota.tiempo)) : 1;
      if (nota.duracion > 0) {
        ctx.fillStyle = this.#colores[nota.mano];
        ctx.globalAlpha *= 0.45;
        ctx.fillRect(centro(nota.carril) - tam * 0.18, yFinal, tam * 0.36, y - yFinal);
        ctx.globalAlpha = pasada ? Math.max(0, 0.45 - (t - nota.tiempo)) : 1;
      }
      dibujarMano(ctx, centro(nota.carril), y, tam, nota.mano, this.#colores[nota.mano], this.#colores.fondo);
      ctx.globalAlpha = 1;
    }

    // Punto en la línea: dónde ve la cámara la mano **ahora mismo**, aunque
    // todavía no haya cambiado de carril. Relleno = cuenta; hueco = fuera de la
    // zona (demasiado alta o baja).
    const radio = Math.max(6, tam * 0.13);
    for (const mano of /** @type {const} */ (['i', 'd'])) {
      const p = puntos?.[mano] ?? null;
      if (!p) {
        this.#puntosMostrados[mano] = null;
        continue;
      }
      const anterior = this.#puntosMostrados[mano];
      const u = anterior === null ? p.u : anterior + (p.u - anterior) * avanzar(SUAVIZADO_PUNTO);
      this.#puntosMostrados[mano] = u;
      const margen = anchoCarril * 0.35;
      const x = Math.min(x0 + anchoPista + margen, Math.max(x0 - margen, x0 + u * anchoPista));
      ctx.beginPath();
      ctx.arc(x, yLinea, radio, 0, Math.PI * 2);
      // Borde claro / fondo oscuro: se ve aunque esté encima de la mano del mismo color.
      ctx.fillStyle = p.dentro ? this.#colores[mano] : this.#colores.fondo;
      ctx.fill();
      ctx.lineWidth = p.dentro ? 2.5 : 3;
      ctx.strokeStyle = p.dentro ? this.#colores.texto : this.#colores[mano];
      ctx.stroke();
    }

    // Destellos de calificación
    this.#efectos = this.#efectos.filter((e) => ahora - e.inicio < DURACION_EFECTO);
    for (const efecto of this.#efectos) {
      const avance = (ahora - efecto.inicio) / DURACION_EFECTO;
      const x = centro(efecto.carril);
      if (efecto.calificacion !== 'fallo' && !reducido) {
        ctx.globalAlpha = 1 - avance;
        ctx.strokeStyle = this.#colores[efecto.mano];
        ctx.lineWidth = 4 * (1 - avance) + 1;
        ctx.beginPath();
        ctx.arc(x, yLinea, tam * (0.7 + avance * 0.9), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = Math.min(1, 2 * (1 - avance));
      ctx.fillStyle = COLORES_CALIFICACION[efecto.calificacion];
      ctx.font = `800 ${Math.round(Math.max(14, anchoCarril * 0.17))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(TEXTOS[efecto.calificacion], x, yLinea - tam * 1.25 - (reducido ? 0 : avance * 24));
      ctx.globalAlpha = 1;
    }
  }
}

/**
 * Dibuja una mano esquemática (dorso): palma, cuatro dedos y pulgar.
 * La izquierda lleva el pulgar a la derecha; la derecha, a la izquierda.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x Centro.
 * @param {number} y Centro.
 * @param {number} tam Alto aproximado.
 * @param {'i' | 'd'} mano
 * @param {string} color
 * @param {string} colorLetra
 */
export function dibujarMano(ctx, x, y, tam, mano, color, colorLetra) {
  const s = tam / 1.5;
  ctx.save();
  ctx.translate(x, y + s * 0.05);
  if (mano === 'd') ctx.scale(-1, 1);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-0.45 * s, -0.1 * s, 0.9 * s, 0.75 * s, 0.22 * s); // palma
  const alturas = [0.5, 0.62, 0.58, 0.46]; // meñique → índice
  for (let k = 0; k < 4; k++) {
    ctx.roundRect(-0.43 * s + k * 0.22 * s, -0.1 * s - alturas[k] * s, 0.19 * s, alturas[k] * s + 0.2 * s, 0.095 * s);
  }
  ctx.fill();
  // Pulgar, inclinado hacia fuera
  ctx.save();
  ctx.translate(0.36 * s, 0.32 * s);
  ctx.rotate(-0.75);
  ctx.beginPath();
  ctx.roundRect(-0.1 * s, -0.48 * s, 0.2 * s, 0.52 * s, 0.1 * s);
  ctx.fill();
  ctx.restore();
  // Letra (sin el espejo, para que se lea bien)
  if (mano === 'd') ctx.scale(-1, 1);
  ctx.fillStyle = colorLetra;
  ctx.font = `900 ${Math.round(s * 0.5)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(mano === 'i' ? 'I' : 'D', 0, 0.28 * s);
  ctx.restore();
}

customElements.define('tb-pista', TbPista);
