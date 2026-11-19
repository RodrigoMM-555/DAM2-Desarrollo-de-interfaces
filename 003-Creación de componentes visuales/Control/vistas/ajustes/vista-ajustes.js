import { GcVistaCamara } from 'glyphcraft-kit';
import { viewHeader } from '../marco-vista.js';
import { settings, progressStore } from '../../servicios/servicios-app.js';
import { exportData, importData } from '../../servicios/copia-seguridad.js';

/** @typedef {import('glyphcraft-kit').GcInterruptorRuna} GcInterruptorRuna */
/** @typedef {import('glyphcraft-kit').GcDeslizadorRuna} GcDeslizadorRuna */
/** @typedef {import('glyphcraft-kit').GcSusurro} GcSusurro */

const pct = (/** @type {number} */ v) => `${Math.round(v * 100)} %`;
const seconds = (/** @type {number} */ v) => `${(v / 1000).toFixed(1).replace('.', ',')} s`;

/**
 * Formato del valor mostrado en cada deslizador.
 * @type {Record<string, (v: number) => string>}
 */
const FORMATTERS = {
  'hands.detection': (v) => (v < 0.45 ? `Sensible · ${pct(v)}` : v > 0.65 ? `Estricta · ${pct(v)}` : `Normal · ${pct(v)}`),
  'hands.smoothing': (v) => (v < 0.3 ? 'Rápido' : v > 0.7 ? 'Muy suave' : 'Equilibrado'),
  'hands.eraseHoldMs': seconds,
  'hands.sealHoldMs': seconds,
  'recognition.tolerance': (v) => (v < 0.3 ? 'Exigente' : v > 0.7 ? 'Permisiva' : 'Normal'),
  'sound.volume': pct,
};

/**
 * Ajustes: un formulario de verdad (con `<gc-rune-toggle>` y
 * `<gc-rune-slider>`, controles asociados a formularios). Cada control lleva
 * `data-setting` con la clave del ajuste: se rellena desde el almacén y cada
 * cambio se guarda al momento.
 */
export class VistaAjustes extends HTMLElement {
  /** @type {AbortController | null} */ #listeners = null;

  connectedCallback() {
    if (!this.childElementCount) this.#render();
    this.#listeners = new AbortController();
    const { signal } = this.#listeners;
    this.addEventListener('change', this.#onChange, { signal });
    this.addEventListener('rune-activate', this.#onAction, { signal });
    settings.addEventListener('change', () => this.#fill(), { signal });
    this.#fill();
    this.#loadDevices();
  }

  disconnectedCallback() {
    this.#listeners?.abort();
  }

  #render() {
    this.className = 'view view--settings';
    const slider = (/** @type {string} */ key, /** @type {string} */ label, /** @type {string} */ range) =>
      `<gc-rune-slider data-setting="${key}" label="${label}" ${range}></gc-rune-slider>`;
    const toggle = (/** @type {string} */ key, /** @type {string} */ label) =>
      `<gc-rune-toggle data-setting="${key}">${label}</gc-rune-toggle>`;
    const select = (/** @type {string} */ key, /** @type {string} */ label, /** @type {[string, string][]} */ options) => `
      <label class="field">
        <span>${label}</span>
        <select data-setting="${key}">${options.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>
      </label>`;

    this.innerHTML = `
      ${viewHeader({
        kicker: 'Ajustes del taller',
        title: 'Ajustes',
        intro: 'Adapta la experiencia a tu cámara, tu iluminación y tu equipo. Los cambios se guardan al momento en este navegador.',
      })}
      <form class="settings" onsubmit="return false">
        <fieldset>
          <legend>Cámara</legend>
          ${select('camera.deviceId', 'Dispositivo', [['', 'Predeterminada']])}
          ${toggle('camera.showVideo', 'Mostrar la imagen de la cámara')}
          <gc-rune-button size="sm" variant="ghost" rune="target" data-action="reset-calibration">Restablecer la zona de trazado</gc-rune-button>
        </fieldset>
        <fieldset>
          <legend>Manos</legend>
          ${toggle('hands.showOnCanvas', 'Ver la mano sobre el lienzo')}
          ${select('hands.style', 'Estilo de la mano', [['constellation', 'Constelación'], ['skeleton', 'Esqueleto'], ['minimal', 'Solo las puntas']])}
          ${select('hands.writingHand', 'Mano que dibuja', [['any', 'Cualquiera'], ['Right', 'Derecha'], ['Left', 'Izquierda']])}
          ${slider('hands.detection', 'Detección de manos', 'min="0.3" max="0.85" step="0.05"')}
          ${slider('hands.smoothing', 'Suavizado del trazo', 'min="0" max="1" step="0.05"')}
          ${slider('hands.eraseHoldMs', 'Tiempo con la mano abierta para borrar', 'min="300" max="2000" step="100"')}
          ${slider('hands.sealHoldMs', 'Tiempo con el puño cerrado para sellar', 'min="300" max="2000" step="100"')}
        </fieldset>
        <fieldset>
          <legend>Reconocimiento</legend>
          ${select('recognition.level', 'Nivel de la práctica guiada', [['apprentice', 'Aprendiz'], ['artisan', 'Artesano'], ['master', 'Maestro']])}
          ${slider('recognition.tolerance', 'Tolerancia con el trazo', 'min="0" max="1" step="0.05"')}
        </fieldset>
        <fieldset>
          <legend>Efectos</legend>
          ${toggle('effects.enabled', 'Efectos mágicos en 3D')}
          ${select('effects.quality', 'Calidad gráfica', [['low', 'Baja (equipos modestos)'], ['medium', 'Media'], ['high', 'Alta']])}
        </fieldset>
        <fieldset>
          <legend>Sonido</legend>
          ${toggle('sound.enabled', 'Sonido')}
          ${slider('sound.volume', 'Volumen', 'min="0" max="1" step="0.05"')}
        </fieldset>
        <fieldset>
          <legend>Pantalla y datos</legend>
          <div class="settings__actions">
            <gc-rune-button size="sm" rune="fullscreen" data-action="fullscreen">Pantalla completa</gc-rune-button>
            <gc-rune-button size="sm" variant="ghost" rune="record" data-action="export">Exportar progreso y ajustes</gc-rune-button>
            <gc-rune-button size="sm" variant="ghost" rune="undo" data-action="import">Importar una copia</gc-rune-button>
            <gc-rune-button size="sm" variant="ghost" rune="settings" data-action="reset-settings">Restablecer ajustes</gc-rune-button>
            <gc-rune-button size="sm" variant="danger" rune="warning" data-action="reset-progress" hold-ms="1500">Borrar todo el progreso</gc-rune-button>
          </div>
          <input type="file" accept="application/json,.json" class="settings__file" hidden>
        </fieldset>
      </form>`;

    for (const s of /** @type {NodeListOf<GcDeslizadorRuna>} */ (this.querySelectorAll('gc-rune-slider[data-setting]'))) {
      const format = FORMATTERS[/** @type {string} */ (s.dataset.setting)];
      if (format) s.formatter = format;
    }
    /** @type {HTMLInputElement} */ (this.querySelector('.settings__file')).addEventListener('change', this.#onImportFile);
  }

  /** Rellena cada control con el valor guardado. */
  #fill() {
    for (const el of /** @type {NodeListOf<HTMLElement>} */ (this.querySelectorAll('[data-setting]'))) {
      const value = settings.get(/** @type {any} */ (el.dataset.setting));
      if (el.localName === 'gc-rune-toggle') /** @type {GcInterruptorRuna} */ (el).checked = Boolean(value);
      else if (el.localName === 'gc-rune-slider') /** @type {GcDeslizadorRuna} */ (el).value = value;
      else /** @type {HTMLSelectElement} */ (el).value = String(value);
    }
  }

  async #loadDevices() {
    const select = /** @type {HTMLSelectElement} */ (this.querySelector('[data-setting="camera.deviceId"]'));
    try {
      const devices = await GcVistaCamara.listDevices();
      for (const d of devices) select.append(new Option(d.label, d.deviceId));
      select.value = settings.get('camera.deviceId');
    } catch {
      /* sin acceso a la lista de cámaras */
    }
  }

  /** @param {Event} event */
  #onChange = (event) => {
    const el = /** @type {HTMLElement} */ (event.target);
    const key = el.dataset?.setting;
    if (!key) return;
    const value =
      el.localName === 'gc-rune-toggle'
        ? /** @type {GcInterruptorRuna} */ (el).checked
        : el.localName === 'gc-rune-slider'
          ? /** @type {GcDeslizadorRuna} */ (el).value
          : /** @type {HTMLSelectElement} */ (el).value;
    settings.set(/** @type {any} */ (key), value);
  };

  /** @param {Event} event */
  #onAction = (event) => {
    const action = /** @type {HTMLElement} */ (event.target).dataset.action;
    const whisper = /** @type {GcSusurro | null} */ (document.querySelector('gc-whisper'));
    switch (action) {
      case 'export': {
        const blob = new Blob([JSON.stringify(exportData(settings, progressStore), null, 2)], { type: 'application/json' });
        const link = Object.assign(document.createElement('a'), {
          href: URL.createObjectURL(blob),
          download: `glyphcraft-copia-${new Date().toISOString().slice(0, 10)}.json`,
        });
        link.click();
        URL.revokeObjectURL(link.href);
        whisper?.show({ type: 'success', message: 'Copia descargada.' });
        break;
      }
      case 'import':
        /** @type {HTMLInputElement} */ (this.querySelector('.settings__file')).click();
        break;
      case 'reset-settings':
        settings.reset();
        whisper?.show({ type: 'info', message: 'Ajustes restablecidos (se conserva tu zona de trazado).' });
        break;
      case 'reset-calibration':
        settings.set('camera.calibration', null);
        whisper?.show({ type: 'info', message: 'Zona de trazado restablecida al tamaño predeterminado.' });
        break;
      case 'reset-progress':
        progressStore.reset();
        whisper?.show({ type: 'warning', message: 'Se ha borrado todo el progreso.' });
        break;
    }
  };

  /** @param {Event} event */
  #onImportFile = async (event) => {
    const input = /** @type {HTMLInputElement} */ (event.target);
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const whisper = /** @type {GcSusurro | null} */ (document.querySelector('gc-whisper'));
    try {
      importData(JSON.parse(await file.text()), settings, progressStore);
      whisper?.show({ type: 'success', title: 'Copia importada', message: 'Se han recuperado tu progreso y tus ajustes.' });
    } catch (error) {
      whisper?.show({ type: 'error', title: 'No se pudo importar', message: /** @type {Error} */ (error).message });
    }
  };
}
