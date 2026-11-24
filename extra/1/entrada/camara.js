// @ts-check
/**
 * Entrada por cámara (docs/DISEÑO.md §5.2):
 *
 *   webcam → <video> → MediaPipe HandLandmarker (2 manos, ~30 fps)
 *          → centro de la palma + etiqueta izquierda/derecha
 *          → SeguidorManos (identidad estable)
 *          → FiltroPunto (suaviza sin retrasar)
 *          → ZonaJuego (posición → carril, con histéresis)
 *          → evento "cambiomanos" { i, d }   ← el mismo que el teclado
 *
 * Además emite `fotograma` con todo el detalle (para dibujar la imagen de la
 * cámara, la realidad aumentada y la calibración) y `gesto` cuando se
 * levantan las dos manos por encima de la zona de juego.
 *
 * MediaPipe se ejecuta en el navegador: la imagen no sale del ordenador.
 * Se carga bajo demanda (`import()` dinámico) y una sola vez para toda la
 * aplicación: quien no use la cámara no descarga sus 22 MB.
 */
import { SeguidorManos } from './seguidor-manos.js';
import { FiltroPunto } from './filtro-un-euro.js';
import { ZonaJuego } from './zona-juego.js';
import { DetectorManosArriba } from './gestos.js';

/** @typedef {import('./seguidor-manos.js').Deteccion} Deteccion */
/** @typedef {import('./seguidor-manos.js').PosicionesManos} PosicionesManos */
/** @typedef {import('../motor/juez.js').EstadoManos} EstadoManos */

/**
 * @typedef {object} DetalleFotograma
 * @property {Deteccion[]} detecciones Manos detectadas (coordenadas del jugador, etiqueta corregida).
 * @property {PosicionesManos} posiciones Posición filtrada de cada mano.
 * @property {EstadoManos} carriles
 * @property {{ i: { x: number, y: number }[] | null, d: { x: number, y: number }[] | null }} esqueletos
 *   Los 21 puntos de cada mano identificada (coordenadas del jugador), para la realidad aumentada.
 * @property {number} fps
 */

const RUTA_WASM = new URL('../lib/mediapipe/wasm', import.meta.url).href;
const RUTA_MODELO = new URL('../lib/mediapipe/hand_landmarker.task', import.meta.url).href;

/** @type {Promise<any> | null} */
let cargaModelo = null;

/** Carga MediaPipe una sola vez. Si la GPU falla (frecuente en Linux), usa la CPU. */
function cargarModelo() {
  cargaModelo ??= (async () => {
    const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
    const archivos = await FilesetResolver.forVisionTasks(RUTA_WASM);
    const crear = (/** @type {'GPU' | 'CPU'} */ delegado) =>
      HandLandmarker.createFromOptions(archivos, {
        baseOptions: { modelAssetPath: RUTA_MODELO, delegate: delegado },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    try {
      return await crear('GPU');
    } catch (error) {
      console.warn('[Tumbao] GPU no disponible para MediaPipe; se usa la CPU.', error);
      return crear('CPU');
    }
  })();
  cargaModelo.catch(() => (cargaModelo = null));
  return cargaModelo;
}

/**
 * Centro de la palma: media de la muñeca (0) y las bases del índice (5),
 * corazón (9) y meñique (17). Es más estable que la punta de un dedo.
 * @param {{ x: number, y: number }[]} puntos
 */
export function centroPalma(puntos) {
  const indices = [0, 5, 9, 17];
  return {
    x: indices.reduce((s, i) => s + puntos[i].x, 0) / indices.length,
    y: indices.reduce((s, i) => s + puntos[i].y, 0) / indices.length,
  };
}

/**
 * Pasa la etiqueta de MediaPipe a nuestra mano.
 *
 * Le pasamos a MediaPipe la imagen **sin** espejo y, así, su etiqueta coincide
 * con la mano real del jugador: "Left" es su mano izquierda (comprobado con
 * una cámara real el 24/11/2026; la documentación de MediaPipe sugiere lo
 * contrario). Como puede variar entre cámaras, la calibración lo comprueba y
 * se puede intercambiar (`intercambiarManos`).
 *
 * @param {string} categoria "Left" o "Right"
 * @param {boolean} intercambiarManos
 * @returns {'i' | 'd'}
 */
export function manoDeEtiqueta(categoria, intercambiarManos) {
  const izquierda = (categoria === 'Left') !== intercambiarManos;
  return izquierda ? 'i' : 'd';
}

export class EntradaCamara extends EventTarget {
  seguidor = new SeguidorManos();
  /** Detector del gesto «levantar las dos manos» (evento `gesto`). */
  manosArriba = new DetectorManosArriba();
  zona = new ZonaJuego();
  intercambiarManos = false;
  /** @type {EstadoManos} */
  estado = { i: null, d: null };
  /** @type {'apagada' | 'cargando' | 'activa' | 'error'} */
  situacion = 'apagada';
  /** @type {string} */
  error = '';
  #filtros = { i: new FiltroPunto(), d: new FiltroPunto() };
  /** @type {any} */
  #modelo = null;
  /** @type {HTMLVideoElement | null} */
  #video = null;
  /** @type {MediaStream | null} */
  #flujo = null;
  #llamada = 0;
  #ultimaMarca = 0;
  #fps = 0;
  #ultimoFotograma = 0;

  /**
   * Aplica los ajustes guardados.
   * @param {{ intercambiarManos: boolean, zona: import('./zona-juego.js').Rectangulo }} ajustes
   */
  configurar({ intercambiarManos, zona }) {
    this.intercambiarManos = intercambiarManos;
    this.zona.zona = zona;
  }

  /**
   * Pide la cámara, carga el modelo y empieza a analizar.
   * @param {HTMLVideoElement} video Donde se muestra la imagen.
   */
  async iniciar(video) {
    this.detener();
    this.#cambiarSituacion('cargando');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Este navegador no permite usar la cámara (hace falta localhost o https).');
      }
      const [flujo, modelo] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        }),
        cargarModelo(),
      ]);
      this.#flujo = flujo;
      this.#modelo = modelo;
      this.#video = video;
      video.srcObject = flujo;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      this.seguidor.reiniciar();
      this.zona.reiniciar();
      this.#cambiarSituacion('activa');
      this.#programar();
    } catch (error) {
      this.detener();
      this.error = describirError(error);
      this.#cambiarSituacion('error');
      throw error;
    }
  }

  /** Apaga la cámara (se apaga también su luz). */
  detener() {
    if (this.#video && this.#llamada) {
      if ('cancelVideoFrameCallback' in this.#video) this.#video.cancelVideoFrameCallback(this.#llamada);
      else cancelAnimationFrame(this.#llamada);
    }
    this.#llamada = 0;
    this.#flujo?.getTracks().forEach((pista) => pista.stop());
    this.#flujo = null;
    if (this.#video) this.#video.srcObject = null;
    this.#video = null;
    this.#ponerEstado({ i: null, d: null });
    if (this.situacion === 'activa' || this.situacion === 'cargando') this.#cambiarSituacion('apagada');
  }

  #programar() {
    const video = this.#video;
    if (!video) return;
    this.#llamada =
      'requestVideoFrameCallback' in video
        ? video.requestVideoFrameCallback(this.#alFotograma)
        : requestAnimationFrame(this.#alFotograma);
  }

  /** Se ejecuta con cada imagen nueva de la cámara. */
  #alFotograma = () => {
    const video = this.#video;
    if (!video || !this.#modelo) return;
    if (video.readyState >= 2 && video.videoWidth > 0) {
      const ahora = performance.now();
      // MediaPipe exige marcas de tiempo estrictamente crecientes.
      const marca = Math.max(ahora, this.#ultimaMarca + 1);
      this.#ultimaMarca = marca;
      const resultado = this.#modelo.detectForVideo(video, marca);
      if (this.#ultimoFotograma) this.#fps = this.#fps * 0.9 + (1000 / Math.max(1, ahora - this.#ultimoFotograma)) * 0.1;
      this.#ultimoFotograma = ahora;
      this.#procesar(resultado, ahora / 1000);
    }
    this.#programar();
  };

  /** @param {any} resultado @param {number} t */
  #procesar(resultado, t) {
    const etiquetas = resultado.handedness ?? resultado.handednesses ?? [];
    /** @type {Deteccion[]} */
    const todos = (resultado.landmarks ?? []).map((/** @type {any[]} */ puntos) =>
      puntos.map(({ x, y }) => ({ x: 1 - x, y })),
    );
    const detecciones = (resultado.landmarks ?? []).map((/** @type {any[]} */ puntos, /** @type {number} */ k) => {
      const palma = centroPalma(puntos);
      const categoria = etiquetas[k]?.[0];
      return {
        x: 1 - palma.x, // la imagen llega sin espejo: se pasa al punto de vista del jugador
        y: palma.y,
        etiqueta: manoDeEtiqueta(categoria?.categoryName ?? 'Right', this.intercambiarManos),
        confianza: categoria?.score ?? 0.5,
      };
    });

    const crudas = this.seguidor.actualizar(t, detecciones);
    /** @type {PosicionesManos} */
    const posiciones = { i: null, d: null };
    for (const mano of /** @type {const} */ (['i', 'd'])) {
      const punto = crudas[mano];
      if (punto) posiciones[mano] = this.#filtros[mano].filtrar(punto, t);
      else this.#filtros[mano].reiniciar();
    }
    this.#ponerEstado({ i: this.zona.carril('i', posiciones.i), d: this.zona.carril('d', posiciones.d) });

    // Esqueleto de cada mano identificada: el de la detección más cercana a su palma.
    const esqueleto = (/** @type {{ x: number, y: number } | null} */ p) => {
      if (!p || !detecciones.length) return null;
      let mejor = 0;
      detecciones.forEach((d, k) => {
        if (Math.hypot(d.x - p.x, d.y - p.y) < Math.hypot(detecciones[mejor].x - p.x, detecciones[mejor].y - p.y)) mejor = k;
      });
      return todos[mejor];
    };

    // Gesto de movimiento: las dos manos por encima de la zona de juego.
    const gesto = this.manosArriba.actualizar(t, posiciones, this.zona.zona.arriba);
    if (gesto.activado) this.dispatchEvent(new CustomEvent('gesto', { detail: { gesto: 'manos-arriba' } }));

    /** @type {DetalleFotograma} */
    const detalle = {
      detecciones,
      posiciones,
      carriles: this.estado,
      esqueletos: { i: esqueleto(crudas.i), d: esqueleto(crudas.d) },
      fps: this.#fps,
    };
    this.dispatchEvent(new CustomEvent('fotograma', { detail: detalle }));
  }

  /** @param {EstadoManos} estado */
  #ponerEstado(estado) {
    if (estado.i === this.estado.i && estado.d === this.estado.d) return;
    this.estado = estado;
    this.dispatchEvent(new CustomEvent('cambiomanos', { detail: estado }));
  }

  /** @param {EntradaCamara['situacion']} situacion */
  #cambiarSituacion(situacion) {
    this.situacion = situacion;
    this.dispatchEvent(new CustomEvent('situacion', { detail: situacion }));
  }
}

/** Mensaje comprensible para los errores típicos de la cámara. @param {unknown} error */
function describirError(error) {
  const nombre = error instanceof Error ? error.name : '';
  if (nombre === 'NotAllowedError') return 'No se ha dado permiso para usar la cámara.';
  if (nombre === 'NotFoundError') return 'No se ha encontrado ninguna cámara.';
  if (nombre === 'NotReadableError') return 'La cámara está ocupada por otra aplicación.';
  return error instanceof Error ? error.message : String(error);
}
