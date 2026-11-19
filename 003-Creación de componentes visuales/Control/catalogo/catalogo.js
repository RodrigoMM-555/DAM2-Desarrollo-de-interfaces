/**
 * Catálogo interactivo de componentes de glyphcraft-kit.
 *
 * Todo se genera a partir de `custom-elements.json` (que sale del JSDoc):
 * para cada componente se muestra una demostración en vivo, controles para
 * sus atributos, botones para sus métodos sin parámetros obligatorios, un
 * registro de los eventos que emite y sus tablas de API.
 */
import 'glyphcraft-kit';
import { glyphLibrary } from 'glyphcraft-kit/nucleo';
import { STARTER_GLYPHS } from 'glyphcraft-kit/glifos';
import { createSyntheticHand, createSyntheticFrame } from 'glyphcraft-kit/sinteticos';

glyphLibrary.add(...STARTER_GLYPHS);

// El manifiesto de componentes se descarga con fetch: los módulos JS del
// navegador no pueden importar JSON sin compilación en todos los navegadores.
const manifest = await (await fetch('./glyphcraft-kit/custom-elements.json')).json();

/** @type {any[]} */
const elements = manifest.modules
  .flatMap((/** @type {any} */ m) => m.declarations ?? [])
  .filter((/** @type {any} */ d) => d.customElement && d.tagName)
  .sort((/** @type {any} */ a, /** @type {any} */ b) => a.tagName.localeCompare(b.tagName));

/**
 * Marcado de demostración de cada componente y preparación opcional.
 * @type {Record<string, { html: string, setup?: (el: any, demo: HTMLElement) => void }>}
 */
const DEMOS = {
  'gc-rune-button': { html: '<gc-rune-button rune="spark">Lanzar<span slot="hint">Texto secundario</span></gc-rune-button>' },
  'gc-arcane-backdrop': { html: '<gc-arcane-backdrop style="height:220px" density="0.7"></gc-arcane-backdrop>' },
  'gc-whisper': {
    html: '<gc-whisper position="bottom-end"></gc-whisper><button class="pg-button" data-demo="whisper">Mostrar un aviso</button>',
    setup: (el, demo) =>
      demo.querySelector('[data-demo]')?.addEventListener('click', () =>
        el.show({ title: 'Aviso de prueba', message: 'Generado desde el catálogo.', type: 'arcane' }),
      ),
  },
  'gc-camera-preview': {
    html: '<gc-camera-preview style="width:320px;aspect-ratio:4/3"><gc-hand-overlay></gc-hand-overlay></gc-camera-preview>',
  },
  'gc-hand-overlay': {
    html: '<gc-hand-overlay style="width:320px;height:240px;background:#0e0c1f" variant="constellation"></gc-hand-overlay>',
    setup: (el) => {
      const poses = ['open', 'point', 'fist', 'relaxed'];
      let t = 0;
      setInterval(() => {
        t += 1;
        const pose = /** @type {any} */ (poses[Math.floor(t / 40) % poses.length]);
        const x = 0.5 + Math.sin(t / 15) * 0.15;
        el.frame = createSyntheticFrame([createSyntheticHand({ pose, x, y: 0.35 })], t * 33);
      }, 33);
    },
  },
  'gc-gesture-indicator': {
    html: '<gc-gesture-indicator></gc-gesture-indicator>',
    setup: (el) => {
      const states = ['none', 'idle', 'drawing', 'erasing', 'sealing'];
      let i = 0;
      setInterval(() => {
        el.state = states[i++ % states.length];
        el.progress = 0.6;
      }, 1200);
    },
  },
  'gc-glyph-canvas': {
    html: '<gc-glyph-canvas pointer-input guide-next style="width:300px;height:300px;background:#0e0c1f"></gc-glyph-canvas><p class="pg-hint">Dibuja con el ratón sobre la guía.</p>',
    setup: (el) => {
      const glyph = glyphLibrary.get('ignis');
      el.guide = glyph ? glyph.sampled.map((s) => s.map((p) => ({ x: 0.5 + p.x * 0.42, y: 0.5 + p.y * 0.42 }))) : null;
    },
  },
  'gc-glyph': { html: '<gc-glyph glyph-id="lux" size="200" ornate numbered></gc-glyph>' },
  'gc-arcane-meter': { html: '<gc-arcane-meter value="72" threshold="60" label="Precisión"></gc-arcane-meter>' },
  'gc-glyph-card': { html: '<gc-glyph-card glyph-id="aqua" progress="2" style="width:340px;background:#efe4cc"></gc-glyph-card>' },
  'gc-rune-toggle': { html: '<form><gc-rune-toggle name="sonido" checked>Sonido</gc-rune-toggle></form>' },
  'gc-rune-slider': { html: '<form><gc-rune-slider name="volumen" label="Volumen" value="60"></gc-rune-slider></form>' },
  'gc-spell-stage': {
    html: '<div class="pg-stage"><gc-spell-stage></gc-spell-stage></div><div class="pg-spells"></div>',
    setup: async (el, demo) => {
      const { GcEscenarioHechizo } = await import('glyphcraft-kit/efectos');
      const buttons = /** @type {HTMLElement} */ (demo.querySelector('.pg-spells'));
      for (const spell of GcEscenarioHechizo.spells) {
        const b = Object.assign(document.createElement('button'), { className: 'pg-button', textContent: `cast('${spell}')` });
        b.addEventListener('click', () => el.cast(spell, { radius: 0.35 }));
        buttons.append(b);
      }
    },
  },
};

const esc = (/** @type {unknown} */ s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

/** Tabla HTML simple. */
function table(/** @type {string[]} */ headers, /** @type {string[][]} */ rows) {
  if (!rows.length) return '';
  return `<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
}

/**
 * Control para editar un atributo según su tipo.
 * @param {any} attr
 */
function attributeControl(attr) {
  const type = String(attr.type?.text ?? 'string');
  const options = [...type.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const name = esc(attr.name);
  if (options.length) {
    return `<label>${name}<select data-attr="${name}"><option value="">(por defecto)</option>${options
      .map((o) => `<option>${esc(o)}</option>`)
      .join('')}</select></label>`;
  }
  if (type === 'boolean') return `<label class="pg-check"><input type="checkbox" data-attr="${name}" data-bool> ${name}</label>`;
  if (type === 'number') return `<label>${name}<input type="number" step="any" data-attr="${name}"></label>`;
  return `<label>${name}<input type="text" data-attr="${name}"></label>`;
}

const nav = /** @type {HTMLElement} */ (document.querySelector('.pg-nav'));
const main = /** @type {HTMLElement} */ (document.querySelector('.pg-main'));

for (const el of elements) {
  nav.insertAdjacentHTML('beforeend', `<a href="#${el.tagName}">&lt;${el.tagName}&gt;</a>`);
  const methods = (el.members ?? []).filter(
    (/** @type {any} */ m) =>
      m.kind === 'method' && m.privacy !== 'private' && !m.static && !m.name.startsWith('#') &&
      (m.parameters ?? []).every((/** @type {any} */ p) => p.optional),
  );
  const section = document.createElement('section');
  section.id = el.tagName;
  section.className = 'pg-component';
  section.innerHTML = `
    <h2><code>&lt;${el.tagName}&gt;</code></h2>
    <p class="pg-summary">${esc(el.summary)}</p>
    <div class="pg-grid">
      <div class="pg-demo">${DEMOS[el.tagName]?.html ?? `<${el.tagName}></${el.tagName}>`}</div>
      <div class="pg-controls">
        ${(el.attributes ?? []).length ? `<h3>Atributos</h3><div class="pg-attrs">${el.attributes.map(attributeControl).join('')}</div>` : ''}
        ${methods.length ? `<h3>Métodos</h3><div class="pg-methods">${methods.map((/** @type {any} */ m) => `<button class="pg-button" data-method="${esc(m.name)}">${esc(m.name)}()</button>`).join('')}</div>` : ''}
        ${(el.events ?? []).length ? `<h3>Eventos</h3><ol class="pg-log" aria-live="polite"><li class="pg-log__empty">Interactúa con el componente…</li></ol>` : ''}
      </div>
    </div>
    <details class="pg-api">
      <summary>API completa</summary>
      ${table(['Atributo', 'Tipo', 'Descripción'], (el.attributes ?? []).map((/** @type {any} */ a) => [`<code>${esc(a.name)}</code>`, `<code>${esc(a.type?.text)}</code>`, esc(a.description)]))}
      ${table(['Evento', 'Detalle', 'Descripción'], (el.events ?? []).map((/** @type {any} */ e) => [`<code>${esc(e.name)}</code>`, `<code>${esc(e.type?.text)}</code>`, esc(e.description)]))}
      ${table(['Parte CSS', 'Descripción'], (el.cssParts ?? []).map((/** @type {any} */ p) => [`<code>${esc(p.name)}</code>`, esc(p.description)]))}
      ${table(['Propiedad CSS', 'Descripción'], (el.cssProperties ?? []).map((/** @type {any} */ p) => [`<code>${esc(p.name)}</code>`, esc(p.description)]))}
    </details>`;
  main.append(section);

  const demo = /** @type {HTMLElement} */ (section.querySelector('.pg-demo'));
  const target = /** @type {any} */ (demo.querySelector(el.tagName));
  DEMOS[el.tagName]?.setup?.(target, demo);

  // Atributos → el componente (y el componente → controles)
  for (const control of /** @type {NodeListOf<HTMLInputElement>} */ (section.querySelectorAll('[data-attr]'))) {
    const name = /** @type {string} */ (control.dataset.attr);
    if (control.dataset.bool !== undefined) control.checked = target.hasAttribute(name);
    else control.value = target.getAttribute(name) ?? '';
    control.addEventListener('input', () => {
      if (control.dataset.bool !== undefined) target.toggleAttribute(name, control.checked);
      else if (control.value === '') target.removeAttribute(name);
      else target.setAttribute(name, control.value);
    });
  }

  // Métodos
  for (const button of /** @type {NodeListOf<HTMLElement>} */ (section.querySelectorAll('[data-method]'))) {
    button.addEventListener('click', async () => {
      const name = /** @type {string} */ (button.dataset.method);
      try {
        const result = await target[name]();
        log(section, `${name}() → ${JSON.stringify(result) ?? 'undefined'}`);
      } catch (error) {
        log(section, `${name}() ✗ ${/** @type {Error} */ (error).message}`);
      }
    });
  }

  // Eventos
  for (const event of el.events ?? []) {
    target.addEventListener(event.name, (/** @type {Event} */ e) => {
      const detail = /** @type {CustomEvent} */ (e).detail;
      log(section, `${event.name}${detail !== undefined ? ` ${JSON.stringify(detail)}` : ''}`);
    });
  }
}

/**
 * @param {HTMLElement} section
 * @param {string} text
 */
function log(section, text) {
  const list = section.querySelector('.pg-log');
  if (!list) return;
  list.querySelector('.pg-log__empty')?.remove();
  const li = document.createElement('li');
  li.textContent = text.length > 160 ? `${text.slice(0, 160)}…` : text;
  list.prepend(li);
  while (list.children.length > 6) list.lastElementChild?.remove();
}
