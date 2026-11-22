/* =========================================================
   rocodrigo | Creador de plantillas · editor en vivo
   Cada cambio en el editor actualiza al momento la vista
   previa, la barra de accesibilidad y el CSS exportable.

   Cada control del editor tiene name = nombre de la variable
   CSS (sin "--"). Los selectores de color no tienen name:
   solo ayudan a rellenar su campo hex.
   ========================================================= */
"use strict";

/* =========================================================
   1. Elementos de la página
   ========================================================= */
const formularioEditor = document.getElementById("formulario-editor");
const estiloVista = document.getElementById("estilo-vista");
const medidor = document.getElementById("medidor");
const codigoCss = document.getElementById("codigo-css");

// Último valor válido de cada control: si un campo tiene un error,
// la vista previa sigue usando su valor anterior
const plantillaActual = {};

/* =========================================================
   2. Leer y escribir la plantilla del editor
   ========================================================= */

/** Campos que se validan: hex y números. */
function camposEditor() {
  return [...formularioEditor.querySelectorAll('input[type="text"], input[type="number"]')];
}

/** Valor de un control tal y como se guarda en la plantilla. */
function leerValor(control) {
  if (control.type === "checkbox") {
    return control.checked;
  }
  if (control.type === "number") {
    return Number(control.value);
  }
  if (control.type === "text") {
    return control.value.trim().toUpperCase();
  }
  return control.value;   // select
}

/** Lee todos los controles con name. Los que tienen error conservan su último valor válido. */
function leerPlantilla() {
  for (const control of formularioEditor.elements) {
    if (control.name === "") {
      continue;
    }
    const conTexto = control.type === "text" || control.type === "number";
    if (!conTexto || esCampoValido(control)) {
      plantillaActual[control.name] = leerValor(control);
    }
  }
  return plantillaActual;
}

/** Escribe una plantilla en el editor (al cargar una guardada o de partida). */
function aplicarPlantilla(plantilla) {
  for (const nombre in plantilla) {
    const control = formularioEditor.elements[nombre];
    if (control === undefined) {
      continue;   // la plantilla trae algo que este editor no tiene
    }
    if (control.type === "checkbox") {
      control.checked = plantilla[nombre];
    } else {
      ponerValor(control, String(plantilla[nombre]));
    }
  }
  camposEditor().forEach(limpiarError);
  actualizar();
}

/** Vuelve a los valores escritos en el HTML (plantilla rocodrigo). */
function restablecerEditor() {
  formularioEditor.reset();
  camposEditor().forEach((campo) => ponerValor(campo, campo.value));   // sincroniza selectores
  camposEditor().forEach(limpiarError);
  actualizar();
}

/** Valida todo el editor (antes de guardar). */
function validarEditor() {
  return validarCampos(camposEditor());
}

/* =========================================================
   3. Pintar resultados
   ========================================================= */

/** "5,75:1" o "48 px". */
function formatearValor(valor, tipo) {
  if (tipo === "ratio") {
    return formatearRatio(valor);
  }
  return formatearNumero(Math.round(valor * 10) / 10) + " px";
}

/** Línea: "✖ NO CUMPLE 1.4.3 · Botón en hover: 2,10:1 (mínimo 4,5:1)". */
function crearLinea(resultado) {
  const minimo = resultado.tipo === "ratio"
    ? formatearMinimo(resultado.minimo)
    : resultado.minimo + " px";
  const linea = document.createElement("li");
  linea.append(
    crearEstado(resultado.cumple),
    " " + resultado.criterio + " · " + resultado.nombre + ": " +
    formatearValor(resultado.valor, resultado.tipo) + " (mínimo " + minimo + ")"
  );
  return linea;
}

/** Lista de comprobaciones: primero las que fallan. */
function pintarComprobaciones(resultados) {
  const ordenados = [...resultados].sort((a, b) => a.cumple - b.cumple);
  document.getElementById("lista-comprobaciones").replaceChildren(...ordenados.map(crearLinea));
}

/** Barra <meter> y su texto, para no depender solo de lo visual. */
function pintarMedidor(resultados) {
  const total = resultados.length;
  const cumplidas = resultados.filter((resultado) => resultado.cumple).length;

  // Rojo por debajo de la mitad, amarillo hasta el total, verde si cumple todo
  medidor.max = total;
  medidor.low = total / 2;
  medidor.high = total;
  medidor.optimum = total;
  medidor.value = cumplidas;

  document.getElementById("texto-medidor").textContent = cumplidas + " de " + total +
    " comprobaciones WCAG 2.2 AA cumplen (" + porcentajeCumplido(cumplidas, total) + " %).";
  return cumplidas + " de " + total;
}

/** Recomendaciones que no cuentan en la barra. */
function pintarAvisos(avisos) {
  const lista = document.getElementById("lista-avisos");
  lista.replaceChildren(...avisos.map((aviso) => {
    const elemento = document.createElement("li");
    elemento.textContent = aviso;
    return elemento;
  }));
  document.getElementById("bloque-avisos").hidden = avisos.length === 0;
}

/* =========================================================
   4. Actualizar todo
   ========================================================= */

/** Lee el editor y actualiza vista previa, accesibilidad y CSS exportable. */
function actualizar() {
  const plantilla = leerPlantilla();
  const resultados = comprobarPlantilla(plantilla);

  estiloVista.textContent = generarCss(plantilla, "#vista");
  pintarComprobaciones(resultados);
  const resumen = pintarMedidor(resultados);
  pintarAvisos(avisosPlantilla(plantilla));

  codigoCss.value = "/* Plantilla creada con el Creador de plantillas rocodrigo\n" +
    "   Accesibilidad: " + resumen + " comprobaciones WCAG 2.2 AA */\n\n" +
    generarCss(plantilla, "");
}

/** Al terminar de editar un campo (Intro o salir de él): muestra su error si lo tiene. */
function alCambiarCampo(evento) {
  const campo = evento.target;
  if (campo.name !== "" && (campo.type === "text" || campo.type === "number")) {
    validarCampo(campo);
  }
}

/* =========================================================
   5. Arranque
   ========================================================= */

// "input" salta con cada tecla o clic: la vista previa cambia al momento.
// Los errores se muestran en "change" para no interrumpir mientras se escribe.
formularioEditor.addEventListener("input", actualizar);
formularioEditor.addEventListener("change", alCambiarCampo);
formularioEditor.addEventListener("submit", (evento) => evento.preventDefault());

// Los enlaces de la vista previa son de ejemplo: no navegan
document.getElementById("vista").addEventListener("click", (evento) => {
  if (evento.target.closest("a") !== null) {
    evento.preventDefault();
  }
});

actualizar();
