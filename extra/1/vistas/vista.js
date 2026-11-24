// @ts-check
/**
 * Clase base de las vistas. La aplicación le pone `app` y `parametros`
 * antes de montarla; al montarse llama a `pintar()` y al desmontarse a
 * `limpiar()` (para parar bucles, sonidos y escuchadores).
 */
export class Vista extends HTMLElement {
  /** @type {import('../nucleo/aplicacion.js').Aplicacion} */
  app = /** @type {any} */ (null);
  /** @type {Record<string, string>} */
  parametros = {};
  /** Escuchadores que se quitan solos al salir de la vista. */
  senal = new AbortController();

  connectedCallback() {
    this.senal = new AbortController();
    this.pintar();
    // Accesibilidad: al cambiar de pantalla, el foco va al título.
    const titulo = /** @type {HTMLElement | null} */ (this.querySelector('h1, h2'));
    if (titulo) {
      titulo.tabIndex = -1;
      titulo.focus({ preventScroll: true });
    }
  }

  disconnectedCallback() {
    this.senal.abort();
    this.limpiar();
  }

  /** Crea el contenido. */
  pintar() {}

  /** Libera recursos. */
  limpiar() {}
}

/** Escapa texto para meterlo en plantillas HTML. @param {unknown} texto */
export function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** 0,934 → "93,4 %". @param {number} valor */
export const porcentaje = (valor) =>
  `${(valor * 100).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

/** 12345 → "12.345". @param {number} valor */
export const numero = (valor) => valor.toLocaleString('es-ES');

export const NOMBRES_DIFICULTAD = /** @type {Record<string, string>} */ ({
  facil: 'Fácil',
  normal: 'Normal',
  dificil: 'Difícil',
  grabada: 'Grabada',
});
