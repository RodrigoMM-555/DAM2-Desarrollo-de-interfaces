import { afterEach, describe, expect, it, vi } from '../../../pruebas/ejecutor.js';
import { userEvent } from '../../../pruebas/ejecutor.js';
import { GcBotonRuna } from './boton-runa.js';

GcBotonRuna.define();

/**
 * Crea un botón, lo añade al documento y lo devuelve.
 * @param {string} [html]
 * @returns {GcBotonRuna}
 */
function mount(html = '<gc-rune-button>Lanzar</gc-rune-button>') {
  document.body.insertAdjacentHTML('beforeend', html);
  return /** @type {GcBotonRuna} */ (document.body.lastElementChild);
}

/** @param {GcBotonRuna} el */
const inner = (el) => /** @type {HTMLButtonElement} */ (el.shadowRoot?.querySelector('button'));

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('<gc-rune-button> · registro y estado inicial', () => {
  it('registra la etiqueta y define() es idempotente', () => {
    expect(customElements.get('gc-rune-button')).toBe(GcBotonRuna);
    expect(() => GcBotonRuna.define()).not.toThrow();
  });

  it('tiene valores predeterminados documentados', () => {
    const el = mount();
    expect(el.variant).toBe('primary');
    expect(el.size).toBe('md');
    expect(el.rune).toBe('');
    expect(el.disabled).toBe(false);
    expect(el.holdMs).toBe(0);
    expect(el.state).toBe('idle');
    expect(el.charge).toBe(0);
  });

  it('proyecta el texto mediante el slot y oculta el hint vacío', () => {
    const el = mount();
    expect(el.textContent).toBe('Lanzar');
    expect(el.shadowRoot?.querySelector('.hint')?.hasAttribute('hidden')).toBe(true);
  });

  it('muestra el hint cuando se asigna contenido al slot', async () => {
    const el = mount('<gc-rune-button>Grimorio<span slot="hint">Estudia glifos</span></gc-rune-button>');
    await vi.waitFor(() => expect(el.shadowRoot?.querySelector('.hint')?.hasAttribute('hidden')).toBe(false));
  });
});

describe('<gc-rune-button> · propiedades y atributos', () => {
  it('refleja las propiedades como atributos', () => {
    const el = mount();
    el.variant = 'ghost';
    el.size = 'lg';
    el.rune = 'spark';
    el.holdMs = 500;
    el.disabled = true;
    expect(el.getAttribute('variant')).toBe('ghost');
    expect(el.getAttribute('size')).toBe('lg');
    expect(el.getAttribute('rune')).toBe('spark');
    expect(el.getAttribute('hold-ms')).toBe('500');
    expect(el.hasAttribute('disabled')).toBe(true);
  });

  it('dibuja el icono rúnico indicado', () => {
    const el = mount('<gc-rune-button rune="grimoire">Grimorio</gc-rune-button>');
    expect(el.shadowRoot?.querySelector('[part="icon"] svg')).not.toBeNull();
    el.rune = '';
    expect(el.shadowRoot?.querySelector('[part="icon"] svg')).toBeNull();
  });

  it('valida valores incorrectos: usa el predeterminado y avisa', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = mount('<gc-rune-button variant="neon" size="xxl" hold-ms="abc">X</gc-rune-button>');
    expect(el.variant).toBe('primary');
    expect(el.size).toBe('md');
    expect(el.holdMs).toBe(0);
    expect(warn).toHaveBeenCalled();
  });

  it('limita hold-ms al rango permitido', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = mount('<gc-rune-button hold-ms="999999">X</gc-rune-button>');
    expect(el.holdMs).toBe(10000);
  });

  it('avisa si el icono no existe', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mount('<gc-rune-button rune="dragon">X</gc-rune-button>');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('dragon'));
  });

  it('pressed convierte el botón en interruptor accesible', () => {
    const el = mount();
    expect(el.pressed).toBeNull();
    expect(inner(el).hasAttribute('aria-pressed')).toBe(false);
    el.pressed = true;
    expect(el.getAttribute('pressed')).toBe('true');
    expect(inner(el).getAttribute('aria-pressed')).toBe('true');
    el.pressed = false;
    expect(inner(el).getAttribute('aria-pressed')).toBe('false');
    el.pressed = null;
    expect(inner(el).hasAttribute('aria-pressed')).toBe(false);
  });

  it('disabled desactiva el botón interno y cambia el estado', () => {
    const el = mount();
    el.disabled = true;
    expect(inner(el).disabled).toBe(true);
    expect(el.state).toBe('disabled');
  });
});

describe('<gc-rune-button> · eventos y métodos', () => {
  it('emite rune-activate al hacer clic, con origen pointer', async () => {
    const el = mount();
    const handler = vi.fn();
    el.addEventListener('rune-activate', handler);
    await userEvent.click(el);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({ source: 'pointer' });
  });

  it('el evento burbujea y atraviesa el Shadow DOM', async () => {
    const el = mount();
    const handler = vi.fn();
    document.body.addEventListener('rune-activate', handler);
    await userEvent.click(el);
    document.body.removeEventListener('rune-activate', handler);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].target).toBe(el);
  });

  it('se activa con teclado (Enter) con origen keyboard', async () => {
    const el = mount();
    const handler = vi.fn();
    el.addEventListener('rune-activate', handler);
    el.focus();
    await userEvent.keyboard('{Enter}');
    expect(handler.mock.calls[0][0].detail.source).toBe('keyboard');
  });

  it('no emite nada si está desactivado', async () => {
    const el = mount('<gc-rune-button disabled>X</gc-rune-button>');
    const handler = vi.fn();
    el.addEventListener('rune-activate', handler);
    await userEvent.click(el, { force: true });
    expect(el.activate()).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('activate() emite el evento con origen program', () => {
    const el = mount();
    const handler = vi.fn();
    el.addEventListener('rune-activate', handler);
    expect(el.activate()).toBe(true);
    expect(handler.mock.calls[0][0].detail.source).toBe('program');
    expect(el.state).toBe('active');
  });

  it('pulse() muestra el estado active y no emite eventos', async () => {
    const el = mount();
    const handler = vi.fn();
    el.addEventListener('rune-activate', handler);
    el.pulse();
    expect(el.state).toBe('active');
    expect(handler).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(el.state).not.toBe('active'), { timeout: 1000 });
  });
});

describe('<gc-rune-button> · modo mantener pulsado (hold-ms)', () => {
  it('un clic corto NO lo activa', async () => {
    const el = mount('<gc-rune-button hold-ms="300">Borrar</gc-rune-button>');
    const handler = vi.fn();
    el.addEventListener('rune-activate', handler);
    await userEvent.click(el);
    expect(handler).not.toHaveBeenCalled();
    expect(el.charge).toBe(0);
  });

  it('mantener pulsado carga el botón y lo activa al completarse', async () => {
    const el = mount('<gc-rune-button hold-ms="150">Borrar</gc-rune-button>');
    const activate = vi.fn();
    const charges = /** @type {number[]} */ ([]);
    el.addEventListener('rune-activate', activate);
    el.addEventListener('charge-change', (e) => charges.push(/** @type {CustomEvent} */ (e).detail.charge));

    el.focus();
    await userEvent.keyboard('{Enter>}'); // mantiene Enter pulsado
    expect(el.state).toBe('charging');
    await vi.waitFor(() => expect(activate).toHaveBeenCalledTimes(1), { timeout: 1000 });
    await userEvent.keyboard('{/Enter}');

    expect(activate.mock.calls[0][0].detail.source).toBe('keyboard');
    expect(charges.some((c) => c > 0 && c < 1)).toBe(true);
    expect(charges.at(-1)).toBe(0); // se reinicia tras activarse
  });

  it('soltar antes de tiempo cancela la carga', async () => {
    const el = mount('<gc-rune-button hold-ms="2000">Borrar</gc-rune-button>');
    const activate = vi.fn();
    el.addEventListener('rune-activate', activate);
    el.focus();
    await userEvent.keyboard('{Enter>}');
    await vi.waitFor(() => expect(el.charge).toBeGreaterThan(0));
    await userEvent.keyboard('{/Enter}');
    expect(el.charge).toBe(0);
    expect(el.state).not.toBe('charging');
    expect(activate).not.toHaveBeenCalled();
  });
});
