// @ts-check
/**
 * Contraste de color según WCAG 2.2 (como en el auditor de la UD04).
 *
 *   luminancia relativa L = 0,2126 R + 0,7152 G + 0,0722 B   (canales linealizados)
 *   contraste = (L1 + 0,05) / (L2 + 0,05)                    (L1 la más clara)
 *
 * Mínimos AA: texto normal 4,5:1 · texto grande 3:1 · componentes y foco 3:1 (1.4.11).
 * Lógica pura.
 */

export const MINIMO_TEXTO = 4.5;
export const MINIMO_COMPONENTE = 3;

/** @param {string} hex "#rrggbb" */
export function luminancia(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) throw new Error(`Color no válido: ${hex}`);
  const [r, g, b] = m.slice(1).map((c) => {
    const v = parseInt(c, 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste entre dos colores (1 a 21). @param {string} a @param {string} b */
export function contraste(a, b) {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/**
 * Lee las variables de color `--nombre: #rrggbb` de un CSS.
 * @param {string} css
 * @returns {Record<string, string>}
 */
export function variablesDeColor(css) {
  /** @type {Record<string, string>} */
  const variables = {};
  for (const [, nombre, valor] of css.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g)) variables[nombre] = valor;
  return variables;
}
