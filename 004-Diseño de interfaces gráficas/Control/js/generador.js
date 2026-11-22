/* =========================================================
   rocodrigo | Creador de plantillas · generador de CSS
   Convierte una plantilla en código CSS. No usa el DOM.
   El mismo código sirve para:
     - la vista previa: generarCss(plantilla, "#vista")
     - el archivo exportado: generarCss(plantilla, "")
   ========================================================= */
"use strict";

// Valores que se escriben en px en el editor y se exportan en rem (16 px = 1 rem),
// para que la plantilla crezca con el zoom del navegador (1.4.4)
const VARIABLES_EN_REM = [
  "tamano-base", "tamano-pequeno", "tamano-h1", "tamano-h2",
  "radio", "borde-grosor", "boton-relleno-v", "boton-relleno-h",
  "foco-grosor", "foco-separacion"
];

/** Valor CSS de una variable: 16 -> "1rem", true -> "underline", "#FFF" -> "#FFF". */
function valorCss(nombre, valor) {
  if (typeof valor === "boolean") {
    return valor ? "underline" : "none";   // solo enlace-subrayado es sí/no
  }
  if (VARIABLES_EN_REM.includes(nombre)) {
    return (valor / 16) + "rem";
  }
  return String(valor);
}

/** Líneas "  --nombre: valor;" de todas las variables de la plantilla. */
function variablesCss(plantilla) {
  return Object.keys(plantilla)
    .map((nombre) => "  --" + nombre + ": " + valorCss(nombre, plantilla[nombre]) + ";")
    .join("\n");
}

/**
 * CSS completo de la plantilla: variables + estilos de los componentes.
 * ambito = "" para exportar (variables en :root, estilos en body)
 * ambito = "#vista" para que solo afecte a la vista previa.
 */
function generarCss(plantilla, ambito) {
  const raiz = ambito || ":root";
  const contenedor = ambito || "body";
  const p = ambito ? ambito + " " : "";

  return `${raiz} {
${variablesCss(plantilla)}
}

${contenedor} {
  margin: 0;
  padding: 1.5rem;
  font-family: var(--fuente);
  font-size: var(--tamano-base);
  line-height: var(--interlineado);
  color: var(--color-texto);
  background: var(--color-fondo);
}

${p}h1,
${p}h2 {
  margin: 0 0 0.5em;
  line-height: 1.2;
  font-weight: var(--peso-titulos);
  color: var(--color-texto);
}

${p}h1 { font-size: var(--tamano-h1); }
${p}h2 { font-size: var(--tamano-h2); }

${p}.tarjeta {
  padding: 1.5rem;
  background: var(--color-superficie);
  border-radius: var(--radio);
}

${p}.secundario {
  font-size: var(--tamano-pequeno);
  color: var(--color-secundario);
}

${p}a {
  color: var(--color-enlace);
  text-decoration: var(--enlace-subrayado);
}

${p}a:hover {
  text-decoration: underline;
}

${p}label {
  display: block;
  margin: 1rem 0 0.25rem;
  font-weight: 700;
  color: var(--color-texto);
}

${p}input[type="text"] {
  padding: var(--boton-relleno-v) 0.75em;
  font: inherit;
  color: var(--color-texto);
  background: var(--campo-fondo);
  border: var(--borde-grosor) solid var(--campo-borde);
  border-radius: var(--radio);
}

${p}input[type="text"]:hover {
  border-color: var(--campo-borde-hover);
}

${p}input[type="text"][aria-invalid="true"] {
  border-color: var(--color-error);
}

${p}.mensaje-error,
${p}.mensaje-exito {
  margin: 0.25rem 0 0;
  font-size: var(--tamano-pequeno);
  font-weight: 700;
}

${p}.mensaje-error { color: var(--color-error); }
${p}.mensaje-exito { color: var(--color-exito); }

${p}button {
  padding: var(--boton-relleno-v) var(--boton-relleno-h);
  font: inherit;
  font-weight: 700;
  color: var(--boton-texto);
  background: var(--boton-fondo);
  border: var(--borde-grosor) solid var(--boton-fondo);
  border-radius: var(--radio);
  cursor: pointer;
}

${p}button:hover {
  background: var(--boton-hover);
  border-color: var(--boton-hover);
}

${p}button:active {
  background: var(--boton-active);
  border-color: var(--boton-active);
}

${p}button:disabled {
  color: var(--boton-deshabilitado-texto);
  background: var(--boton-deshabilitado-fondo);
  border-color: var(--boton-deshabilitado-fondo);
  cursor: not-allowed;
}

${p}:focus-visible {
  outline: var(--foco-grosor) solid var(--foco-color);
  outline-offset: var(--foco-separacion);
  box-shadow: none;
}
`;
}
