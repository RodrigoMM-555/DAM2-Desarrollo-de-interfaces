import { glyphLibrary } from 'glyphcraft-kit/nucleo';
import { EnrutadorHash } from './enrutador.js';
import { ROUTES } from './rutas.js';
import { progressStore, audio } from '../servicios/servicios-app.js';
import { checkAchievements } from '../servicios/logros.js';

/**
 * Contenedor de la aplicación (`<gc-app>`).
 *
 * Es el **mediador**: conoce el router, las vistas y los componentes del kit
 * y los conecta mediante eventos y API pública. Ningún componente conoce a
 * los demás:
 *
 * - Los botones con `data-nav` emiten `rune-activate` → el shell navega.
 * - Las vistas emiten `navigate` ({ path }) → el shell navega.
 * - El router emite `route-change` → el shell cambia de vista.
 * - El shell usa `burst()` del fondo y `show()` de los avisos.
 */
export class Aplicacion extends HTMLElement {
  #router = new EnrutadorHash(ROUTES, { fallback: '/' });
  /** @type {import('glyphcraft-kit').GcFondoArcano | null} */
  #backdrop = null;
  /** @type {import('glyphcraft-kit').GcSusurro | null} */
  #whisper = null;
  /** @type {HTMLElement | null} */
  #outlet = null;
  #firstRender = true;
  /** @type {ViewTransition | null} */
  #transition = null;

  connectedCallback() {
    this.innerHTML = `
      <gc-arcane-backdrop class="app__backdrop" density="0.55"></gc-arcane-backdrop>
      <main class="app__outlet" id="main"></main>
      <gc-whisper></gc-whisper>`;
    this.#backdrop = this.querySelector('gc-arcane-backdrop');
    this.#whisper = this.querySelector('gc-whisper');
    this.#outlet = this.querySelector('main');

    this.addEventListener('rune-activate', this.#onRuneActivate);
    this.addEventListener('navigate', this.#onNavigate);
    progressStore.addEventListener('change', this.#onProgress);
    // Al abrir la app se revisan los logros (p. ej. tras importar una copia), sin avisos.
    checkAchievements(progressStore, glyphLibrary.size);
    document.addEventListener('keydown', this.#onKeyDown);
    this.#router.addEventListener('route-change', this.#onRouteChange);
    this.#router.start();
    this.#welcome();
  }

  disconnectedCallback() {
    this.removeEventListener('rune-activate', this.#onRuneActivate);
    this.removeEventListener('navigate', this.#onNavigate);
    progressStore.removeEventListener('change', this.#onProgress);
    document.removeEventListener('keydown', this.#onKeyDown);
    this.#router.removeEventListener('route-change', this.#onRouteChange);
    this.#router.stop();
  }

  /** Cada cambio de progreso puede desbloquear logros: se anuncian aquí. */
  #onProgress = () => {
    for (const achievement of checkAchievements(progressStore, glyphLibrary.size)) {
      audio.play('learned');
      this.#whisper?.show({ type: 'arcane', title: `Logro: ${achievement.title}`, message: achievement.description, duration: 6000 });
    }
  };

  /** @param {Event} event */
  #onRuneActivate = (event) => {
    audio.play('click');
    const button = /** @type {HTMLElement} */ (event.target);
    const rect = button.getBoundingClientRect();
    this.#backdrop?.burst(rect.left + Math.min(rect.width / 2, 40), rect.top + rect.height / 2);

    const { nav, action } = button.dataset;
    if (nav) this.#router.navigate(nav);
    if (action === 'fullscreen') this.#toggleFullscreen();
  };

  /**
   * Las vistas piden navegar con un evento `navigate` ({ path }) en lugar de
   * conocer el router.
   * @param {Event} event
   */
  #onNavigate = (event) => {
    const path = /** @type {CustomEvent<{ path: string }>} */ (event).detail?.path;
    if (typeof path === 'string') this.#router.navigate(path);
  };

  /** @param {KeyboardEvent} event */
  #onKeyDown = (event) => {
    if (event.key === 'Escape' && this.#router.current?.path !== '/') {
      this.#router.navigate('/');
    }
  };

  /** @param {Event} event */
  #onRouteChange = (event) => {
    const { route, params } = /** @type {CustomEvent<import('./enrutador.js').RouteMatch>} */ (event).detail;
    const routeConfig = ROUTES.find((r) => r.path === route.path);
    if (this.#backdrop && routeConfig) this.#backdrop.palette = routeConfig.mood;
    document.title = route.path === '/' ? 'GlyphCraft' : `${route.title} · GlyphCraft`;

    // Si la ruta usa la misma vista y esta sabe actualizarse (updateRoute),
    // se actualiza en el sitio en lugar de recrearla. Así el grimorio puede
    // pasar la página en vez de cambiar de pantalla.
    const current = /** @type {(HTMLElement & { updateRoute?: (p: Record<string, string>) => boolean }) | null} */ (
      this.#outlet?.firstElementChild ?? null
    );
    if (current?.localName === route.view && typeof current.updateRoute === 'function' && current.updateRoute(params)) {
      return;
    }

    const view = /** @type {HTMLElement & { params?: Record<string, string> }} */ (document.createElement(route.view));
    view.params = params;

    const swap = () => {
      this.#outlet?.replaceChildren(view);
      if (!this.#firstRender) view.querySelector('h1')?.focus({ preventScroll: true });
      this.#firstRender = false;
      window.scrollTo(0, 0);
    };

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (document.startViewTransition && !reduced && !this.#firstRender) {
      // Si se navega muy rápido, la transición anterior se interrumpe y sus
      // promesas se rechazan: se termina de forma explícita y se ignora ese
      // rechazo, que es esperado.
      this.#transition?.skipTransition();
      const transition = document.startViewTransition(swap);
      // Mientras dura la transición el navegador no entrega eventos de puntero
      // a la página: se marca en <html> para que se sepa (pruebas, estilos).
      document.documentElement.toggleAttribute('data-view-transition', true);
      transition.ready.catch(() => {});
      transition.finished.finally(() => {
        if (this.#transition !== transition) return;
        this.#transition = null;
        document.documentElement.removeAttribute('data-view-transition');
      });
      this.#transition = transition;
    } else {
      swap();
    }
  };

  async #toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      this.#whisper?.show({ type: 'warning', message: 'Tu navegador no ha permitido la pantalla completa.' });
    }
  }

  /** Saludo una vez por sesión del navegador. */
  #welcome() {
    let seen = false;
    try {
      seen = sessionStorage.getItem('glyphcraft:welcomed') === '1';
      sessionStorage.setItem('glyphcraft:welcomed', '1');
    } catch {
      /* almacenamiento no disponible: se saluda igualmente */
    }
    if (seen) return;
    setTimeout(() => {
      this.#whisper?.show({
        type: 'arcane',
        title: 'El taller está abierto',
        message: 'Empieza por el Grimorio: aprende un glifo y después lánzalo con tus manos.',
        duration: 6000,
      });
    }, 900);
  }
}
