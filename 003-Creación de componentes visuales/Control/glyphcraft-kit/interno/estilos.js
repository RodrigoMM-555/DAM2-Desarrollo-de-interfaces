/**
 * Crea una hoja de estilos construible (Constructable Stylesheet).
 *
 * La hoja se crea una sola vez al importar el módulo y la comparten todas las
 * instancias del componente mediante `shadowRoot.adoptedStyleSheets`, en lugar
 * de duplicar un `<style>` dentro de cada instancia.
 *
 * Se usa como plantilla etiquetada para que VS Code pueda resaltar el CSS:
 *
 * ```js
 * const styles = css`:host { display: block; }`;
 * ```
 *
 * @param {TemplateStringsArray} strings
 * @param {...unknown} values
 * @returns {CSSStyleSheet}
 */
export function css(strings, ...values) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(String.raw({ raw: strings }, ...values));
  return sheet;
}

/** Reglas comunes a todos los componentes: respeto a `prefers-reduced-motion`. */
export const baseStyles = css`
  :host([hidden]) {
    display: none !important;
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 1ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 1ms !important;
    }
  }
`;
