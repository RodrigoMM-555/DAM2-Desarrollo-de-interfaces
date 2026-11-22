/* =========================================================
   rocodrigo | Creador de plantillas · mis plantillas
   Guardar, cargar y borrar plantillas en el navegador
   (localStorage) y exportar el CSS (copiar o descargar).
   ========================================================= */
"use strict";

/* =========================================================
   1. Datos y elementos de la página
   ========================================================= */
const CLAVE_ALMACEN = "rocodrigo-plantillas";

// La plantilla rocodrigo son los valores del HTML (se recupera con reset).
// La neutra se define aquí.
const PLANTILLA_NEUTRA = {
  "color-fondo": "#FFFFFF",
  "color-superficie": "#F3F4F6",
  "color-texto": "#1F2328",
  "color-secundario": "#57606A",
  "color-enlace": "#0B57D0",
  "boton-fondo": "#0B57D0",
  "boton-texto": "#FFFFFF",
  "boton-hover": "#0842A0",
  "boton-active": "#062E6F",
  "boton-deshabilitado-fondo": "#E5E7EB",
  "boton-deshabilitado-texto": "#57606A",
  "campo-fondo": "#FFFFFF",
  "campo-borde": "#6E7781",
  "campo-borde-hover": "#1F2328",
  "color-error": "#B3261E",
  "color-exito": "#1A7F37",
  "foco-color": "#0B57D0",
  "foco-grosor": 2,
  "foco-separacion": 2,
  "fuente": "system-ui, sans-serif",
  "tamano-base": 16,
  "tamano-pequeno": 14,
  "tamano-h1": 32,
  "tamano-h2": 24,
  "interlineado": 1.5,
  "peso-titulos": "700",
  "radio": 4,
  "borde-grosor": 1,
  "boton-relleno-v": 8,
  "boton-relleno-h": 16,
  "enlace-subrayado": true
};

const formularioGuardar = document.getElementById("formulario-guardar");
const campoNombre = document.getElementById("nombre-plantilla");
const listaPlantillas = document.getElementById("lista-plantillas");
const grupoGuardadas = document.getElementById("grupo-guardadas");
const botonBorrar = document.getElementById("borrar-plantilla");

/* =========================================================
   2. localStorage: { "nombre": plantilla, ... } en formato JSON
   ========================================================= */

/** Lee las plantillas guardadas. Si no hay o están dañadas, devuelve {}. */
function leerGuardadas() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_ALMACEN)) || {};
  } catch {
    return {};
  }
}

/** Guarda todas las plantillas. Devuelve false si el navegador no lo permite. */
function escribirGuardadas(guardadas) {
  try {
    localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(guardadas));
    return true;
  } catch {
    return false;
  }
}

/* =========================================================
   3. Lista de plantillas
   Valores de las opciones: "partida:rocodrigo", "partida:neutra"
   o "guardada:<nombre>".
   ========================================================= */

/** Mensaje de confirmación visible y anunciado (role="status"). */
function anunciar(mensaje) {
  document.getElementById("estado-plantillas").textContent = mensaje;
}

/** Nombre de una plantilla guardada a partir del valor de su opción. */
function nombreGuardada(valor) {
  return valor.replace("guardada:", "");
}

/** "Borrar" solo se puede usar con plantillas guardadas, no con las de partida. */
function actualizarBotonBorrar() {
  botonBorrar.disabled = !listaPlantillas.value.startsWith("guardada:");
}

/** Vuelve a pintar el grupo "Mis plantillas" del desplegable. */
function pintarLista(valorSeleccionado) {
  const nombres = Object.keys(leerGuardadas());
  if (nombres.length === 0) {
    // Estado vacío dentro del propio desplegable
    const vacia = new Option("(todavía no has guardado ninguna)", "");
    vacia.disabled = true;
    grupoGuardadas.replaceChildren(vacia);
  } else {
    grupoGuardadas.replaceChildren(...nombres.map((nombre) => new Option(nombre, "guardada:" + nombre)));
  }
  if (valorSeleccionado !== undefined) {
    listaPlantillas.value = valorSeleccionado;
  }
  actualizarBotonBorrar();
}

/* =========================================================
   4. Acciones
   ========================================================= */

/** Al pulsar "Guardar plantilla". */
function guardarPlantilla(evento) {
  evento.preventDefault();
  const nombre = campoNombre.value.trim();

  if (nombre === "") {
    mostrarError(campoNombre, "escribe un nombre para la plantilla, por ejemplo «Mi web».");
    campoNombre.focus();
    return;
  }
  limpiarError(campoNombre);

  if (!validarEditor()) {
    anunciar("No se ha guardado: corrige primero los errores del editor.");
    return;
  }

  const guardadas = leerGuardadas();
  if (Object.hasOwn(guardadas, nombre) && !confirm("Ya existe una plantilla llamada «" + nombre + "». ¿Quieres sustituirla?")) {
    return;
  }
  guardadas[nombre] = leerPlantilla();

  if (!escribirGuardadas(guardadas)) {
    anunciar("No se ha podido guardar: este navegador no permite guardar datos.");
    return;
  }
  pintarLista("guardada:" + nombre);
  anunciar("Plantilla «" + nombre + "» guardada.");
}

/** Al pulsar "Cargar". */
function cargarPlantilla() {
  const valor = listaPlantillas.value;
  if (valor === "partida:rocodrigo") {
    restablecerEditor();
    campoNombre.value = "";
  } else if (valor === "partida:neutra") {
    aplicarPlantilla(PLANTILLA_NEUTRA);
    campoNombre.value = "";
  } else {
    aplicarPlantilla(leerGuardadas()[nombreGuardada(valor)]);
    campoNombre.value = nombreGuardada(valor);   // para volver a guardarla con cambios
  }
  anunciar("Plantilla «" + listaPlantillas.selectedOptions[0].textContent + "» cargada.");
}

/** Al pulsar "Borrar": pide confirmación antes. */
function borrarPlantilla() {
  const nombre = nombreGuardada(listaPlantillas.value);
  if (!confirm("¿Seguro que quieres borrar la plantilla «" + nombre + "»? No se puede deshacer.")) {
    return;
  }
  const guardadas = leerGuardadas();
  delete guardadas[nombre];
  escribirGuardadas(guardadas);
  pintarLista("partida:rocodrigo");
  anunciar("Plantilla «" + nombre + "» borrada.");
  listaPlantillas.focus();   // el botón Borrar queda deshabilitado: el foco no se pierde
}

/* =========================================================
   5. Exportar CSS
   ========================================================= */

/** Nombre de archivo seguro: "Mi web 2" -> "mi-web-2". */
function nombreArchivo(nombre) {
  return nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plantilla";
}

/** Descarga el CSS como archivo .css (sin servidor: Blob + enlace con download). */
function descargarCss() {
  const archivo = new Blob([codigoCss.value], { type: "text/css" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = nombreArchivo(campoNombre.value.trim()) + ".css";
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);   // libera la memoria
  anunciar("Descargando " + enlace.download + ".");
}

/** Copia el CSS al portapapeles. Si no se puede, lo deja seleccionado para Ctrl+C. */
function copiarCss() {
  const seleccionarParaCopiar = () => {
    codigoCss.focus();
    codigoCss.select();
    anunciar("No se ha podido copiar automáticamente: el código está seleccionado, pulsa Ctrl+C.");
  };
  if (navigator.clipboard === undefined) {
    seleccionarParaCopiar();
    return;
  }
  navigator.clipboard.writeText(codigoCss.value)
    .then(() => anunciar("CSS copiado al portapapeles."))
    .catch(seleccionarParaCopiar);
}

/* =========================================================
   6. Arranque
   ========================================================= */
formularioGuardar.addEventListener("submit", guardarPlantilla);
document.getElementById("cargar-plantilla").addEventListener("click", cargarPlantilla);
botonBorrar.addEventListener("click", borrarPlantilla);
listaPlantillas.addEventListener("change", actualizarBotonBorrar);
document.getElementById("descargar-css").addEventListener("click", descargarCss);
document.getElementById("copiar-css").addEventListener("click", copiarCss);

pintarLista();
