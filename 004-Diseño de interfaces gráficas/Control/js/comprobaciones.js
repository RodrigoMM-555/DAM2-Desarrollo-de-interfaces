/* =========================================================
   rocodrigo | Creador de plantillas · comprobaciones
   Recibe una plantilla (objeto con colores y tamaños) y
   devuelve qué criterios WCAG 2.2 AA cumple. No usa el DOM,
   así se puede probar aislado desde tests.html.

   Las claves de la plantilla son los nombres de las variables
   CSS (sin "--"), por eso se leen con corchetes:
   plantilla["color-fondo"].
   ========================================================= */
"use strict";

const MINIMO_OBJETIVO = 24;           // px · 2.5.8 Tamaño del objetivo (mínimo)
const INTERLINEADO_RECOMENDADO = 1.5; // recomendación, no obligatorio
const FOCO_RECOMENDADO = 2;           // px · recomendación (2.4.13 es nivel AAA)

/* =========================================================
   1. Un resultado por comprobación
   { criterio, nombre, valor, minimo, tipo: "ratio" | "px", cumple }
   ========================================================= */

/** 1.4.3: contraste de un texto, con el mínimo según su tamaño. */
function comprobarTexto(nombre, color, fondo, tamano, negrita) {
  const ratio = ratioContraste(color, fondo);
  const minimo = contrasteExigido(tamano, negrita);
  return { criterio: "1.4.3", nombre, valor: ratio, minimo, tipo: "ratio", cumple: ratio >= minimo };
}

/** 1.4.11: contraste de un borde, foco u otro elemento no textual. */
function comprobarNoTextual(nombre, color, fondo) {
  const ratio = ratioContraste(color, fondo);
  return { criterio: "1.4.11", nombre, valor: ratio, minimo: MINIMO_NO_TEXTUAL, tipo: "ratio", cumple: cumpleNoTextual(ratio) };
}

/** 1.4.1: un enlace sin subrayar debe distinguirse del texto con 3:1. */
function comprobarEnlaces(plantilla) {
  const ratio = ratioContraste(plantilla["color-enlace"], plantilla["color-texto"]);
  return { criterio: "1.4.1", nombre: "Enlaces sin subrayar frente al texto", valor: ratio, minimo: 3, tipo: "ratio", cumple: ratio >= 3 };
}

/** Altura de botones y campos: línea de texto + relleno arriba y abajo + borde arriba y abajo. */
function alturaObjetivo(plantilla) {
  return plantilla["tamano-base"] * plantilla["interlineado"] +
         2 * plantilla["boton-relleno-v"] +
         2 * plantilla["borde-grosor"];
}

/** 2.5.8: botones y campos de al menos 24 px de alto. */
function comprobarObjetivo(plantilla) {
  const altura = alturaObjetivo(plantilla);
  return { criterio: "2.5.8", nombre: "Altura de botones y campos", valor: altura, minimo: MINIMO_OBJETIVO, tipo: "px", cumple: altura >= MINIMO_OBJETIVO };
}

/* =========================================================
   2. Todas las comprobaciones de una plantilla
   ========================================================= */

/** Devuelve la lista de comprobaciones WCAG 2.2 AA de la plantilla. */
function comprobarPlantilla(p) {
  const base = p["tamano-base"];
  const pequeno = p["tamano-pequeno"];

  const resultados = [
    comprobarTexto("Texto sobre el fondo", p["color-texto"], p["color-fondo"], base, false),
    comprobarTexto("Texto sobre la superficie", p["color-texto"], p["color-superficie"], base, false),
    comprobarTexto("Texto secundario sobre el fondo", p["color-secundario"], p["color-fondo"], pequeno, false),
    comprobarTexto("Texto secundario sobre la superficie", p["color-secundario"], p["color-superficie"], pequeno, false),
    comprobarTexto("Enlaces sobre el fondo", p["color-enlace"], p["color-fondo"], base, false),
    comprobarTexto("Enlaces sobre la superficie", p["color-enlace"], p["color-superficie"], base, false),
    comprobarTexto("Texto escrito en los campos", p["color-texto"], p["campo-fondo"], base, false),
    comprobarTexto("Mensajes de error", p["color-error"], p["color-superficie"], pequeno, true),
    comprobarTexto("Mensajes de éxito", p["color-exito"], p["color-superficie"], pequeno, true),
    comprobarTexto("Botón", p["boton-texto"], p["boton-fondo"], base, true),
    comprobarTexto("Botón en hover", p["boton-texto"], p["boton-hover"], base, true),
    comprobarTexto("Botón en active (pulsado)", p["boton-texto"], p["boton-active"], base, true),
    comprobarNoTextual("Borde de los campos", p["campo-borde"], p["color-superficie"]),
    comprobarNoTextual("Borde de los campos en hover", p["campo-borde-hover"], p["color-superficie"]),
    comprobarNoTextual("Foco sobre el fondo", p["foco-color"], p["color-fondo"]),
    comprobarNoTextual("Foco sobre la superficie", p["foco-color"], p["color-superficie"])
  ];

  // Si los enlaces van subrayados, ya se distinguen sin depender del color
  if (!p["enlace-subrayado"]) {
    resultados.push(comprobarEnlaces(p));
  }
  resultados.push(comprobarObjetivo(p));
  return resultados;
}

/** Recomendaciones que NO son requisitos WCAG AA: no cuentan en la barra. */
function avisosPlantilla(p) {
  const avisos = [];
  if (!esTamanoRecomendado(p["tamano-base"])) {
    avisos.push("El texto base mide menos de 16 px: se recomiendan 16 px o más para leer con comodidad.");
  }
  if (p["interlineado"] < INTERLINEADO_RECOMENDADO) {
    avisos.push("El interlineado es menor de 1,5: se recomienda 1,5 para que el texto se lea mejor.");
  }
  if (p["foco-grosor"] < FOCO_RECOMENDADO) {
    avisos.push("El foco mide menos de 2 px: se recomiendan 2 px o más para que se vea bien (2.4.13, nivel AAA).");
  }
  if (!cumpleTextoNormal(ratioContraste(p["boton-deshabilitado-texto"], p["boton-deshabilitado-fondo"]))) {
    avisos.push("El botón deshabilitado tiene poco contraste. WCAG no lo exige, pero conviene que se pueda leer.");
  }
  return avisos;
}
