/* =========================================================
   rocodrigo | Creador de plantillas · ayudas comunes
   Formato de números, CUMPLE / NO CUMPLE, validación de campos
   y sincronización entre el campo hex y el selector de color.
   ========================================================= */
"use strict";

/* =========================================================
   1. Formato y etiquetas de estado
   ========================================================= */

/** Número con coma decimal: 18.66 -> "18,66". */
function formatearNumero(numero) {
  return String(numero).replace(".", ",");
}

/** Ratio con dos decimales: 5.746 -> "5,75:1". */
function formatearRatio(ratio) {
  return ratio.toFixed(2).replace(".", ",") + ":1";
}

/** Mínimo exigido: 4.5 -> "4,5:1". */
function formatearMinimo(minimo) {
  return formatearNumero(minimo) + ":1";
}

/** Crea la etiqueta "✔ CUMPLE" o "✖ NO CUMPLE" (texto + icono + color). */
function crearEstado(cumple) {
  const estado = document.createElement("span");
  estado.className = cumple ? "estado cumple" : "estado no-cumple";

  // El icono es decorativo: el lector de pantalla ya lee el texto
  const icono = document.createElement("span");
  icono.setAttribute("aria-hidden", "true");
  icono.textContent = cumple ? "✔ " : "✖ ";

  estado.append(icono, cumple ? "CUMPLE" : "NO CUMPLE");
  return estado;
}

/* =========================================================
   2. Validación de campos (3.3.1 y 3.3.3)
   Cada campo tiene su zona de error con id "error-" + id del campo.
   Los campos numéricos usan sus atributos min y max.
   ========================================================= */

/** Marca el campo como erróneo y escribe el mensaje en su zona de error. */
function mostrarError(campo, mensaje) {
  campo.setAttribute("aria-invalid", "true");
  document.getElementById("error-" + campo.id).textContent = "Error: " + mensaje;
}

/** Quita la marca de error y vacía su mensaje. */
function limpiarError(campo) {
  campo.removeAttribute("aria-invalid");
  document.getElementById("error-" + campo.id).textContent = "";
}

/** Comprueba un campo sin mostrar nada (para la edición en vivo). */
function esCampoValido(campo) {
  if (campo.type === "number") {
    const valor = Number(campo.value);
    return campo.value !== "" && valor >= Number(campo.min) && valor <= Number(campo.max);
  }
  return esHexValido(campo.value.trim());
}

/** Mensaje que dice qué falla y cómo corregirlo. */
function mensajeDeError(campo) {
  const nombre = "«" + campo.labels[0].textContent + "»";
  if (campo.type === "number") {
    return nombre + " debe ser un número entre " + formatearNumero(campo.min) +
      " y " + formatearNumero(campo.max) + ".";
  }
  return nombre + " debe ser # seguido de 6 caracteres del 0 al 9 o de la A a la F, por ejemplo #1565C0.";
}

/** Valida un campo y muestra u oculta su error. Normaliza los hex a mayúsculas. */
function validarCampo(campo) {
  if (!esCampoValido(campo)) {
    mostrarError(campo, mensajeDeError(campo));
    return false;
  }
  if (campo.type === "text") {
    campo.value = campo.value.trim().toUpperCase();
  }
  limpiarError(campo);
  return true;
}

/** Valida varios campos y lleva el foco al primero que tenga error. */
function validarCampos(campos) {
  let primeroConError = null;
  for (const campo of campos) {
    if (!validarCampo(campo) && primeroConError === null) {
      primeroConError = campo;
    }
  }
  if (primeroConError !== null) {
    primeroConError.focus();
    return false;
  }
  return true;
}

/* =========================================================
   3. Selector de color sincronizado con el campo hex
   Cada selector tiene id "selector-" + id de su campo hex.
   ========================================================= */

/** Escribe un valor en un campo y, si tiene selector de color, también en él. */
function ponerValor(campo, valor) {
  campo.value = valor;
  const selector = document.getElementById("selector-" + campo.id);
  if (selector !== null && esHexValido(valor)) {
    selector.value = valor.toLowerCase();   // type="color" usa minúsculas
  }
}

/** Conecta un selector de color con su campo hex en los dos sentidos. */
function conectarSelector(selector) {
  const campo = document.getElementById(selector.id.replace("selector-", ""));

  // Selector -> campo: al elegir un color se escribe su hex
  selector.addEventListener("input", () => {
    campo.value = selector.value.toUpperCase();
    limpiarError(campo);
  });

  // Campo -> selector: solo si lo escrito ya es un hex válido
  campo.addEventListener("input", () => {
    const valor = campo.value.trim();
    if (esHexValido(valor)) {
      selector.value = valor.toLowerCase();
    }
  });

  // Estado inicial: el selector muestra el color que trae el campo
  ponerValor(campo, campo.value);
}

/* =========================================================
   4. Arranque: conecta todos los selectores de la página
   ========================================================= */
document.querySelectorAll('input[type="color"]').forEach(conectarSelector);
