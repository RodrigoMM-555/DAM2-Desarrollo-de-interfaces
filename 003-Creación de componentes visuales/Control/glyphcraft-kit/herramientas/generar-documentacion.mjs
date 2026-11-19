/**
 * Genera documentación a partir de `custom-elements.json` (que a su vez sale
 * del JSDoc de los componentes):
 *
 * - docs/API.md: referencia de cada componente en tablas.
 * - html-custom-data.json: datos para que VS Code autocomplete las
 *   etiquetas <gc-*> y sus atributos en cualquier HTML.
 *
 * Uso: node herramientas/generar-documentacion.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(join(root, 'custom-elements.json'), 'utf8'));

/** @type {any[]} */
const elements = manifest.modules
  .flatMap((/** @type {any} */ m) => (m.declarations ?? []).map((/** @type {any} */ d) => ({ ...d, path: m.path })))
  .filter((/** @type {any} */ d) => d.customElement && d.tagName)
  .sort((/** @type {any} */ a, /** @type {any} */ b) => a.tagName.localeCompare(b.tagName));

const esc = (/** @type {unknown} */ s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();
const code = (/** @type {unknown} */ s) => (s ? `\`${esc(s)}\`` : '');

/**
 * @param {string[]} headers
 * @param {string[][]} rows
 */
function table(headers, rows) {
  if (!rows.length) return '';
  return [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

/** Propiedades heredadas de HTMLElement/ShadowRoot que el analizador detecta por error. */
const INHERITED = new Set(['adoptedStyleSheets', 'innerHTML', 'textContent', 'className', 'hidden', 'style', 'tabIndex']);
const camel = (/** @type {string} */ s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

const sections = elements.map((el) => {
  const publicMembers = (el.members ?? []).filter(
    (/** @type {any} */ m) => m.privacy !== 'private' && !m.static && !m.name.startsWith('#') && !INHERITED.has(m.name),
  );
  // Las propiedades que reflejan un atributo heredan su tipo y su descripción.
  const byProperty = new Map((el.attributes ?? []).map((/** @type {any} */ a) => [camel(a.name), a]));
  const fields = publicMembers
    .filter((/** @type {any} */ m) => m.kind === 'field')
    .map((/** @type {any} */ f) => {
      const attr = byProperty.get(f.name);
      if (!attr || f.description) return f;
      return { ...f, type: f.type ?? attr.type, description: `${attr.description ?? ''} Refleja el atributo \`${attr.name}\`.` };
    });
  const methods = publicMembers.filter((/** @type {any} */ m) => m.kind === 'method');
  const parts = [
    `## \`<${el.tagName}>\``,
    el.summary ? `**${esc(el.summary)}**` : '',
    el.description ?? '',
    `Clase: \`${el.name}\` · Fuente: \`${el.path}\``,
    (el.attributes ?? []).length ? '### Atributos (diseño)' : '',
    table(
      ['Atributo', 'Tipo', 'Descripción'],
      (el.attributes ?? []).map((/** @type {any} */ a) => [code(a.name), code(a.type?.text), esc(a.description)]),
    ),
    fields.length ? '### Propiedades' : '',
    table(
      ['Propiedad', 'Tipo', 'Descripción'],
      fields.map((/** @type {any} */ f) => [
        code(f.name),
        code(f.type?.text),
        esc(f.description) + (f.readonly && !/solo lectura/i.test(f.description ?? '') ? ' *(solo lectura)*' : ''),
      ]),
    ),
    methods.length ? '### Métodos' : '',
    table(
      ['Método', 'Parámetros', 'Devuelve', 'Descripción'],
      methods.map((/** @type {any} */ m) => [
        code(`${m.name}()`),
        esc((m.parameters ?? []).map((/** @type {any} */ p) => `${p.name}${p.optional ? '?' : ''}: ${p.type?.text ?? ''}`).join(', ')),
        code(m.return?.type?.text),
        esc(m.description),
      ]),
    ),
    (el.events ?? []).length ? '### Eventos' : '',
    table(['Evento', 'Tipo', 'Descripción'], (el.events ?? []).map((/** @type {any} */ e) => [code(e.name), code(e.type?.text), esc(e.description)])),
    (el.slots ?? []).length ? '### Slots' : '',
    table(['Slot', 'Descripción'], (el.slots ?? []).map((/** @type {any} */ s) => [code(s.name || '(por defecto)'), esc(s.description)])),
    (el.cssParts ?? []).length ? '### Partes CSS (`::part`)' : '',
    table(['Parte', 'Descripción'], (el.cssParts ?? []).map((/** @type {any} */ p) => [code(p.name), esc(p.description)])),
    (el.cssProperties ?? []).length ? '### Propiedades CSS' : '',
    table(['Propiedad', 'Descripción'], (el.cssProperties ?? []).map((/** @type {any} */ p) => [code(p.name), esc(p.description)])),
  ];
  return parts.filter(Boolean).join('\n\n');
});

const api = `# glyphcraft-kit · Referencia de componentes

> Documento generado automáticamente a partir del JSDoc (\`node herramientas/generar-documentacion.mjs\`).
> No lo edites a mano: cambia los comentarios del código y vuelve a generarlo.

**Convenciones**

- *Atributos* (diseño): configuración inicial, declarativa, en el HTML.
- *Propiedades*: interfaz en JavaScript; las de solo lectura reflejan el estado de ejecución.
- *Eventos*: \`CustomEvent\` que burbujean y atraviesan el Shadow DOM (\`composed\`).
- Los valores no válidos se corrigen al valor por defecto y se avisa por consola.

## Índice

${elements.map((el) => `- [\`<${el.tagName}>\`](#${el.tagName}) — ${esc(el.summary)}`).join('\n')}

${sections.join('\n\n---\n\n')}
`.replace(/## `<([a-z-]+)>`/g, '<a id="$1"></a>\n\n## `<$1>`');

await mkdir(join(root, 'docs'), { recursive: true });
await writeFile(join(root, 'docs', 'API.md'), api);

// Datos personalizados de HTML para VS Code
const customData = {
  version: 1.1,
  tags: elements.map((el) => ({
    name: el.tagName,
    description: [el.summary, el.description].filter(Boolean).join('\n\n'),
    attributes: (el.attributes ?? []).map((/** @type {any} */ a) => {
      const values = /'([^']+)'/g;
      const options = [...String(a.type?.text ?? '').matchAll(values)].map((m) => ({ name: m[1] }));
      return { name: a.name, description: a.description ?? '', ...(options.length ? { values: options } : {}) };
    }),
  })),
};
await writeFile(join(root, 'html-custom-data.json'), `${JSON.stringify(customData, null, 2)}\n`);
console.log(`✓ Documentación generada: ${elements.length} componentes → docs/API.md y html-custom-data.json`);
