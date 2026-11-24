/**
 * Lógica de `pruebas.html`.
 *
 * - Sin parámetros: recorre la lista de archivos y ejecuta cada uno en un
 *   <iframe> propio (aislado), mostrando los resultados según llegan.
 * - Con `?archivo=ruta`: es el <iframe>. Ejecuta ese archivo y envía los
 *   resultados a la página principal con `postMessage`.
 *
 * Al terminar, el resumen queda también en `window.resultadosPruebas`
 * (útil para automatizar la ejecución desde fuera).
 */
import { ejecutarArchivo } from './ejecutor.js';
import { ARCHIVOS_DE_PRUEBAS } from './lista.js';

const parametros = new URLSearchParams(location.search);
const archivo = parametros.get('archivo');

if (archivo) {
  // ── Modo iframe: ejecuta un solo archivo ──
  // Las pruebas montan sus componentes en <body>: se empieza con él vacío.
  if (window.parent !== window) document.body.replaceChildren();
  const resultados = await ejecutarArchivo(new URL(archivo, document.baseURI).href);
  if (window.parent !== window) {
    window.parent.postMessage({ tipo: 'resultados', archivo, resultados }, location.origin);
  } else {
    pintarArchivo(archivo, resultados);
    pintarResumen([{ archivo, resultados }], 0);
  }
} else {
  await ejecutarTodo();
}

/** Ejecuta todos los archivos, uno detrás de otro. */
async function ejecutarTodo() {
  const marco = /** @type {HTMLElement} */ (document.querySelector('.marco'));
  const inicio = performance.now();
  /** @type {{archivo: string, resultados: import('./ejecutor.js').Resultado[]}[]} */
  const todos = [];
  for (const ruta of ARCHIVOS_DE_PRUEBAS) {
    estado(`Ejecutando ${ruta}…`);
    const resultados = await ejecutarEnIframe(ruta, marco);
    todos.push({ archivo: ruta, resultados });
    pintarArchivo(ruta, resultados);
  }
  marco.hidden = true;
  pintarResumen(todos, performance.now() - inicio);
}

/**
 * @param {string} ruta
 * @param {HTMLElement} marco
 * @returns {Promise<import('./ejecutor.js').Resultado[]>}
 */
function ejecutarEnIframe(ruta, marco) {
  return new Promise((resolver) => {
    const iframe = document.createElement('iframe');
    iframe.title = `Pruebas de ${ruta}`;
    iframe.allow = 'camera';
    iframe.src = `pruebas.html?archivo=${encodeURIComponent(ruta)}`;
    // Si un archivo se cuelga, no bloquea a los demás.
    const limite = setTimeout(() => terminar([{ nombre: '(sin respuesta en 60 s)', estado: 'fallo', ms: 60000 }]), 60000);
    const alMensaje = (/** @type {MessageEvent} */ evento) => {
      if (evento.source === iframe.contentWindow && evento.data?.tipo === 'resultados') terminar(evento.data.resultados);
    };
    const terminar = (/** @type {any[]} */ resultados) => {
      clearTimeout(limite);
      window.removeEventListener('message', alMensaje);
      iframe.remove();
      resolver(resultados);
    };
    window.addEventListener('message', alMensaje);
    marco.replaceChildren(iframe);
  });
}

/** @param {string} texto */
function estado(texto) {
  const p = document.querySelector('.estado');
  if (p) p.textContent = texto;
}

/**
 * @param {string} ruta
 * @param {import('./ejecutor.js').Resultado[]} resultados
 */
function pintarArchivo(ruta, resultados) {
  const fallos = resultados.filter((r) => r.estado === 'fallo');
  const detalles = document.createElement('details');
  detalles.className = fallos.length ? 'archivo fallo' : 'archivo ok';
  detalles.open = fallos.length > 0;
  const resumen = document.createElement('summary');
  resumen.innerHTML = `<span class="icono">${fallos.length ? '✗' : '✓'}</span> <code></code> <span class="cuenta"></span>`;
  /** @type {HTMLElement} */ (resumen.querySelector('code')).textContent = ruta;
  /** @type {HTMLElement} */ (resumen.querySelector('.cuenta')).textContent =
    `${resultados.length - fallos.length}/${resultados.length}`;
  const lista = document.createElement('ul');
  for (const r of resultados) {
    const li = document.createElement('li');
    li.className = r.estado;
    li.textContent = `${r.estado === 'ok' ? '✓' : '✗'} ${r.nombre}`;
    if (r.error) {
      const pre = document.createElement('pre');
      pre.textContent = r.error;
      li.append(pre);
    }
    lista.append(li);
  }
  detalles.append(resumen, lista);
  document.querySelector('.resultados')?.append(detalles);
}

/**
 * @param {{archivo: string, resultados: import('./ejecutor.js').Resultado[]}[]} todos
 * @param {number} ms
 */
function pintarResumen(todos, ms) {
  const pruebas = todos.flatMap((t) => t.resultados);
  const fallos = pruebas.filter((r) => r.estado === 'fallo');
  const resumen = {
    archivos: todos.length,
    pruebas: pruebas.length,
    correctas: pruebas.length - fallos.length,
    fallos: fallos.length,
    detalleFallos: todos.flatMap((t) =>
      t.resultados.filter((r) => r.estado === 'fallo').map((r) => ({ archivo: t.archivo, ...r })),
    ),
  };
  estado(
    fallos.length
      ? `${fallos.length} de ${pruebas.length} pruebas han fallado (${(ms / 1000).toFixed(1)} s).`
      : `Las ${pruebas.length} pruebas de ${todos.length} archivos son correctas (${(ms / 1000).toFixed(1)} s).`,
  );
  document.body.dataset.estado = fallos.length ? 'fallo' : 'ok';
  /** @type {any} */ (window).resultadosPruebas = resumen;
}
