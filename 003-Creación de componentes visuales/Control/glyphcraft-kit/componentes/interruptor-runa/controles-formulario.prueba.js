import { afterEach, describe, expect, it, vi } from '../../../pruebas/ejecutor.js';
import { userEvent } from '../../../pruebas/ejecutor.js';
import { GcInterruptorRuna } from './interruptor-runa.js';
import { GcDeslizadorRuna } from '../deslizador-runa/deslizador-runa.js';

GcInterruptorRuna.define();
GcDeslizadorRuna.define();

afterEach(() => {
  document.body.innerHTML = '';
});

/**
 * @param {string} html
 * @returns {HTMLFormElement}
 */
function form(html) {
  document.body.insertAdjacentHTML('beforeend', `<form>${html}</form>`);
  return /** @type {HTMLFormElement} */ (document.body.lastElementChild);
}

describe('<gc-rune-toggle>', () => {
  it('estado inicial a partir del atributo checked', () => {
    const f = form('<gc-rune-toggle name="sonido" checked>Sonido</gc-rune-toggle><gc-rune-toggle name="otro">Otro</gc-rune-toggle>');
    const [on, off] = /** @type {GcInterruptorRuna[]} */ ([...f.querySelectorAll('gc-rune-toggle')]);
    expect(on.checked).toBe(true);
    expect(off.checked).toBe(false);
    expect(on.matches(':state(checked)')).toBe(true);
    expect(on.form).toBe(f);
  });

  it('participa en el formulario como un control nativo', () => {
    const f = form('<gc-rune-toggle name="sonido" value="si" checked></gc-rune-toggle><gc-rune-toggle name="musica"></gc-rune-toggle>');
    const data = new FormData(f);
    expect(data.get('sonido')).toBe('si');
    expect(data.has('musica')).toBe(false);
  });

  it('se cambia con clic y teclado y emite change', async () => {
    const f = form('<gc-rune-toggle name="t">Etiqueta</gc-rune-toggle>');
    const toggle = /** @type {GcInterruptorRuna} */ (f.querySelector('gc-rune-toggle'));
    const change = vi.fn();
    toggle.addEventListener('change', change);
    await userEvent.click(toggle);
    expect(toggle.checked).toBe(true);
    toggle.focus();
    await userEvent.keyboard(' ');
    expect(toggle.checked).toBe(false);
    expect(change.mock.calls.map((c) => c[0].detail.checked)).toEqual([true, false]);
  });

  it('form.reset() vuelve al estado del atributo', () => {
    const f = form('<gc-rune-toggle name="t" checked></gc-rune-toggle>');
    const toggle = /** @type {GcInterruptorRuna} */ (f.querySelector('gc-rune-toggle'));
    toggle.checked = false;
    f.reset();
    expect(toggle.checked).toBe(true);
  });

  it('su etiqueta es el nombre accesible del interruptor', async () => {
    const f = form('<gc-rune-toggle>Sonido</gc-rune-toggle>');
    const toggle = /** @type {GcInterruptorRuna} */ (f.querySelector('gc-rune-toggle'));
    await vi.waitFor(() => expect(toggle.matches(':state(checked)')).toBe(false));
    // El rol switch va en el elemento interno enfocable y su nombre accesible
    // sale del contenido de ese elemento: el texto proyectado en el <slot>.
    const control = toggle.shadowRoot?.querySelector('[role="switch"]');
    const slot = /** @type {HTMLSlotElement | null | undefined} */ (control?.querySelector('slot'));
    expect(control).not.toBeNull();
    expect(slot?.assignedNodes().map((n) => n.textContent).join('').trim()).toBe('Sonido');
  });

  it('desactivado no cambia', async () => {
    const f = form('<gc-rune-toggle disabled>X</gc-rune-toggle>');
    const toggle = /** @type {GcInterruptorRuna} */ (f.querySelector('gc-rune-toggle'));
    toggle.toggle();
    expect(toggle.checked).toBe(false);
  });
});

describe('<gc-rune-slider>', () => {
  it('valores predeterminados y del atributo', () => {
    const f = form('<gc-rune-slider label="Volumen" name="vol" min="0" max="10" value="7"></gc-rune-slider><gc-rune-slider></gc-rune-slider>');
    const [vol, plain] = /** @type {GcDeslizadorRuna[]} */ ([...f.querySelectorAll('gc-rune-slider')]);
    expect(vol.value).toBe(7);
    expect(plain.value).toBe(50);
    expect(new FormData(f).get('vol')).toBe('7');
  });

  it('formatter cambia el texto mostrado y el aria-valuetext', () => {
    const f = form('<gc-rune-slider value="40"></gc-rune-slider>');
    const slider = /** @type {GcDeslizadorRuna} */ (f.querySelector('gc-rune-slider'));
    slider.formatter = (v) => `${v} %`;
    expect(slider.shadowRoot?.querySelector('.value')?.textContent).toBe('40 %');
    expect(slider.shadowRoot?.querySelector('input')?.getAttribute('aria-valuetext')).toBe('40 %');
    // @ts-expect-error
    expect(() => (slider.formatter = 'x')).toThrow(TypeError);
  });

  it('con el teclado cambia el valor y emite input (nativo) y change', async () => {
    const f = form('<gc-rune-slider name="s" value="5" max="10"></gc-rune-slider>');
    const slider = /** @type {GcDeslizadorRuna} */ (f.querySelector('gc-rune-slider'));
    const input = vi.fn();
    const change = vi.fn();
    slider.addEventListener('input', input);
    slider.addEventListener('change', change);
    slider.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(slider.value).toBe(6);
    expect(input).toHaveBeenCalled();
    expect(change.mock.calls[0][0].detail).toEqual({ value: 6 });
    expect(new FormData(f).get('s')).toBe('6');
  });

  it('valida el valor y se restablece con el formulario', () => {
    const f = form('<gc-rune-slider value="3" max="10"></gc-rune-slider>');
    const slider = /** @type {GcDeslizadorRuna} */ (f.querySelector('gc-rune-slider'));
    slider.value = 9;
    // @ts-expect-error
    expect(() => (slider.value = 'mucho')).toThrow(TypeError);
    f.reset();
    expect(slider.value).toBe(3);
  });
});
