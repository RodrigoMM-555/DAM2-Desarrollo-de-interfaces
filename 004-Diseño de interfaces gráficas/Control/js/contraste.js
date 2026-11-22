/* =========================================================
   rocodrigo | Auditor de contraste · lógica
   Solo cálculos: no usa el DOM, así se puede probar aislado
   desde tests.html. Fórmulas de WCAG 2.2.
   ========================================================= */
"use strict";

/* Mínimos de WCAG 2.2 */
const MINIMO_TEXTO_NORMAL = 4.5;  // 1.4.3
const MINIMO_TEXTO_GRANDE = 3;    // 1.4.3: texto de 24px o más, o de 18,66px o más en negrita
const MINIMO_NO_TEXTUAL = 3;      // 1.4.11: bordes de controles, iconos y foco

/** Comprueba que el texto tenga el formato #RRGGBB. */
function esHexValido(texto) {
  return /^#[0-9A-Fa-f]{6}$/.test(texto);
}

/** Convierte "#1565C0" en { r: 21, g: 101, b: 192 }. */
function hexARgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };
}

/** Linealiza un canal de 0 a 255 (deshace la corrección gamma de sRGB). */
function linealizarCanal(valor) {
  const c = valor / 255;
  if (c <= 0.04045) {
    return c / 12.92;
  }
  return Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Luminancia relativa de un color: de 0 (negro) a 1 (blanco). */
function luminanciaRelativa(hex) {
  const { r, g, b } = hexARgb(hex);
  return 0.2126 * linealizarCanal(r) +
         0.7152 * linealizarCanal(g) +
         0.0722 * linealizarCanal(b);
}

/** Ratio de contraste entre dos colores: de 1 a 21. El orden no importa. */
function ratioContraste(hex1, hex2) {
  const l1 = luminanciaRelativa(hex1);
  const l2 = luminanciaRelativa(hex2);
  const mayor = Math.max(l1, l2);
  const menor = Math.min(l1, l2);
  return (mayor + 0.05) / (menor + 0.05);
}

/* Decisiones. Se compara el ratio SIN redondear:
   WCAG no permite redondear hacia arriba (4,499 no cumple 4,5). */

/** 1.4.3 para texto normal. */
function cumpleTextoNormal(ratio) {
  return ratio >= MINIMO_TEXTO_NORMAL;
}

/** 1.4.3 para texto grande. */
function cumpleTextoGrande(ratio) {
  return ratio >= MINIMO_TEXTO_GRANDE;
}

/** 1.4.11 para elementos no textuales y foco. */
function cumpleNoTextual(ratio) {
  return ratio >= MINIMO_NO_TEXTUAL;
}

/* =========================================================
   Tamaño de letra
   WCAG no fija un tamaño mínimo: el tamaño decide qué contraste se exige.
   ========================================================= */
const TAMANO_GRANDE = 24;           // px (18 pt)
const TAMANO_GRANDE_NEGRITA = 18.66; // px (14 pt) en negrita
const TAMANO_RECOMENDADO = 16;      // px: buena práctica para texto de lectura, no es WCAG

/** Indica si un texto cuenta como "grande" para WCAG. */
function esTextoGrande(tamano, negrita) {
  return tamano >= TAMANO_GRANDE || (negrita && tamano >= TAMANO_GRANDE_NEGRITA);
}

/** Contraste mínimo que necesita un texto según su tamaño: 4,5 o 3. */
function contrasteExigido(tamano, negrita) {
  return esTextoGrande(tamano, negrita) ? MINIMO_TEXTO_GRANDE : MINIMO_TEXTO_NORMAL;
}

/** 1.4.3 teniendo en cuenta el tamaño real del texto. */
function cumpleTexto(ratio, tamano, negrita) {
  return ratio >= contrasteExigido(tamano, negrita);
}

/** Recomendación (no WCAG): texto de lectura de 16 px o más. */
function esTamanoRecomendado(tamano) {
  return tamano >= TAMANO_RECOMENDADO;
}

/** Porcentaje redondeado de comprobaciones cumplidas: 7 de 8 -> 88. */
function porcentajeCumplido(cumplidas, total) {
  if (total === 0) {
    return 0;
  }
  return Math.round(cumplidas / total * 100);
}
