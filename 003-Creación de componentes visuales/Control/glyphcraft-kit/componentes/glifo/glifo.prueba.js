import { afterEach, beforeAll, describe, expect, it, vi } from '../../../pruebas/ejecutor.js';
import { userEvent } from '../../../pruebas/ejecutor.js';
import { GcGlifo } from './glifo.js';
import { GcMedidorArcano } from '../medidor-arcano/medidor-arcano.js';
import { GcTarjetaGlifo } from '../tarjeta-glifo/tarjeta-glifo.js';
import { glyphLibrary, createGlyph } from '../../nucleo/glifos/modelo-glifo.js';
import { STARTER_GLYPHS } from '../../glifos/glifos-iniciales.js';

GcGlifo.define();
GcMedidorArcano.define();
GcTarjetaGlifo.define();

beforeAll(() => {
  glyphLibrary.clear();
  glyphLibrary.add(...STARTER_GLYPHS);
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

/**
 * @template {HTMLElement} T
 * @param {string} html
 * @returns {T}
 */
function mount(html) {
  document.body.insertAdjacentHTML('beforeend', html);
  return /** @type {T} */ (document.body.lastElementChild);
}

describe('<gc-glyph>', () => {
  it('busca el glifo en la biblioteca y dibuja un path por trazo', () => {
    const el = /** @type {GcGlifo} */ (mount('<gc-glyph glyph-id="aqua"></gc-glyph>'));
    expect(el.glyph?.name).toBe('Aqua');
    expect(el.shadowRoot?.querySelectorAll('.strokes path')).toHaveLength(4);
    expect(el.getAttribute('aria-label')).toBe('Glifo Aqua');
  });

  it('valores predeterminados y tamaño', () => {
    const el = /** @type {GcGlifo} */ (mount('<gc-glyph glyph-id="ignis" size="80"></gc-glyph>'));
    expect(el.mode).toBe('static');
    expect(el.glow).toBe(0.6);
    expect(el.getBoundingClientRect().width).toBe(80);
  });

  it('un id desconocido no rompe nada y se resuelve si el glifo se añade después', () => {
    const el = /** @type {GcGlifo} */ (mount('<gc-glyph glyph-id="nuevo"></gc-glyph>'));
    expect(el.glyph).toBeNull();
    glyphLibrary.add({ ...STARTER_GLYPHS[0], id: 'nuevo', name: 'Nuevo' });
    expect(el.glyph?.name).toBe('Nuevo');
  });

  it('acepta un glifo por propiedad y valida el tipo', () => {
    const el = /** @type {GcGlifo} */ (mount('<gc-glyph></gc-glyph>'));
    el.glyph = createGlyph(STARTER_GLYPHS[2]);
    expect(el.shadowRoot?.querySelectorAll('.strokes path')).toHaveLength(2);
    // @ts-expect-error
    expect(() => (el.glyph = { id: 'x' })).toThrow(TypeError);
  });

  it('ornate y numbered añaden decoración y marcadores', () => {
    const el = /** @type {GcGlifo} */ (mount('<gc-glyph glyph-id="glacies" ornate numbered></gc-glyph>'));
    expect(el.shadowRoot?.querySelector('.ornament')).not.toBeNull();
    expect(el.shadowRoot?.querySelectorAll('.markers text')).toHaveLength(5);
  });

  it('playTrace() emite un evento por trazo y trace-end al terminar', async () => {
    const el = /** @type {GcGlifo} */ (mount('<gc-glyph glyph-id="ignis" numbered></gc-glyph>'));
    const strokes = /** @type {number[]} */ ([]);
    el.addEventListener('trace-stroke', (e) => strokes.push(/** @type {CustomEvent} */ (e).detail.index));
    const ended = vi.fn();
    el.addEventListener('trace-end', ended);
    const done = el.playTrace({ speed: 20 });
    expect(el.tracing).toBe(true);
    expect(await done).toBe(true);
    expect(strokes).toEqual([0, 1]);
    expect(ended.mock.calls[0][0].detail.completed).toBe(true);
    expect(el.tracing).toBe(false);
  });

  it('stop() interrumpe el trazado', async () => {
    const el = /** @type {GcGlifo} */ (mount('<gc-glyph glyph-id="aqua"></gc-glyph>'));
    const ended = vi.fn();
    el.addEventListener('trace-end', ended);
    const done = el.playTrace({ speed: 0.5 });
    el.stop();
    expect(await done).toBe(false);
    expect(ended.mock.calls[0][0].detail.completed).toBe(false);
    await expect(el.playTrace({ speed: 0 })).rejects.toThrow(RangeError);
  });

  it('ignite() consume el glifo y reset() lo restaura', async () => {
    const el = /** @type {GcGlifo} */ (mount('<gc-glyph glyph-id="lux"></gc-glyph>'));
    const ignited = vi.fn();
    el.addEventListener('glyph-ignited', ignited);
    await el.ignite({ duration: 50 });
    expect(ignited.mock.calls[0][0].detail.glyphId).toBe('lux');
    const svg = /** @type {SVGElement} */ (el.shadowRoot?.querySelector('svg'));
    expect(Number(getComputedStyle(svg).opacity)).toBe(0);
    el.reset();
    expect(Number(getComputedStyle(svg).opacity)).toBe(1);
  });

  it('highlightStroke() resalta un trazo y atenúa el resto', () => {
    const el = /** @type {GcGlifo} */ (mount('<gc-glyph glyph-id="aegis"></gc-glyph>'));
    el.highlightStroke(1);
    const paths = el.shadowRoot?.querySelectorAll('.strokes path') ?? [];
    expect(paths[1].classList.contains('is-highlight')).toBe(true);
    expect(paths[0].classList.contains('is-dim')).toBe(true);
    el.highlightStroke(null);
    expect(paths[0].classList.contains('is-dim')).toBe(false);
  });
});

describe('<gc-arcane-meter>', () => {
  it('expone el rol ARIA meter con su valor', () => {
    const el = /** @type {GcMedidorArcano} */ (mount('<gc-arcane-meter value="40" label="Precisión"></gc-arcane-meter>'));
    expect(el.value).toBe(40);
    expect(el.max).toBe(100);
    expect(el.variant).toBe('ring');
    expect(el.shadowRoot?.querySelector('.label')?.textContent).toBe('Precisión');
  });

  it('limita el valor al máximo y valida setValue', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = /** @type {GcMedidorArcano} */ (mount('<gc-arcane-meter max="3" value="9"></gc-arcane-meter>'));
    expect(el.value).toBe(3);
    expect(() => el.setValue(Number.NaN)).toThrow(TypeError);
  });

  it('threshold marca passed o failed', () => {
    const el = /** @type {GcMedidorArcano} */ (mount('<gc-arcane-meter threshold="75" value="60"></gc-arcane-meter>'));
    expect(el.matches(':state(failed)')).toBe(true);
    el.setValue(80, { animate: false });
    expect(el.matches(':state(passed)')).toBe(true);
  });

  it('el número del anillo llega al valor', async () => {
    const el = /** @type {GcMedidorArcano} */ (mount('<gc-arcane-meter></gc-arcane-meter>'));
    el.setValue(87);
    await vi.waitFor(() => expect(el.shadowRoot?.querySelector('.number')?.textContent).toBe('87'));
  });

  it('variant seals dibuja un sello por unidad y rellena los conseguidos', () => {
    const el = /** @type {GcMedidorArcano} */ (mount('<gc-arcane-meter variant="seals" max="3" value="2"></gc-arcane-meter>'));
    const seals = el.shadowRoot?.querySelectorAll('.seal') ?? [];
    expect(seals).toHaveLength(3);
    expect([...seals].map((s) => s.classList.contains('is-filled'))).toEqual([true, true, false]);
  });

  it('meter-complete solo al alcanzar el máximo', () => {
    const el = /** @type {GcMedidorArcano} */ (mount('<gc-arcane-meter variant="seals" max="3" value="1"></gc-arcane-meter>'));
    const complete = vi.fn();
    el.addEventListener('meter-complete', complete);
    el.value = 2;
    expect(complete).not.toHaveBeenCalled();
    el.value = 3;
    el.value = 3;
    expect(complete).toHaveBeenCalledOnce();
  });
});

describe('<gc-glyph-card>', () => {
  it('compone <gc-glyph> y <gc-arcane-meter> con los datos del glifo', () => {
    const el = /** @type {GcTarjetaGlifo} */ (mount('<gc-glyph-card glyph-id="ventus" progress="2"></gc-glyph-card>'));
    const root = /** @type {ShadowRoot} */ (el.shadowRoot);
    expect(root.querySelector('.name')?.textContent).toBe('Ventus');
    expect(root.querySelector('.element')?.textContent).toBe('Viento');
    expect(/** @type {GcGlifo} */ (root.querySelector('gc-glyph')).glyphId).toBe('ventus');
    expect(/** @type {GcMedidorArcano} */ (root.querySelector('gc-arcane-meter')).value).toBe(2);
  });

  it('muestra la insignia de aprendido / dominado', () => {
    const el = /** @type {GcTarjetaGlifo} */ (mount('<gc-glyph-card glyph-id="ignis" learned></gc-glyph-card>'));
    expect(el.shadowRoot?.querySelector('.badge')?.textContent).toBe('Aprendido');
    el.mastered = true;
    expect(el.shadowRoot?.querySelector('.badge')?.textContent).toBe('Dominado');
  });

  it('emite glyph-select al pulsarla (ratón y teclado)', async () => {
    const el = /** @type {GcTarjetaGlifo} */ (mount('<gc-glyph-card glyph-id="lux"></gc-glyph-card>'));
    const select = vi.fn();
    el.addEventListener('glyph-select', select);
    await userEvent.click(el);
    el.focus();
    await userEvent.keyboard('{Enter}');
    expect(select).toHaveBeenCalledTimes(2);
    expect(select.mock.calls[0][0].detail).toEqual({ glyphId: 'lux' });
  });
});
