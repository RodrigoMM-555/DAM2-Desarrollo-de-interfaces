/**
 * Configuración del analizador de Custom Elements Manifest.
 * Lee el JSDoc de los componentes (@attr, @prop, @fires, @slot, @csspart,
 * @cssprop…) y genera `custom-elements.json`, el formato estándar que usan
 * los IDE y las herramientas de documentación de Web Components.
 *
 * Uso (desde esta carpeta; npx descarga el analizador la primera vez):
 *   npx @custom-elements-manifest/analyzer analyze
 *   node herramientas/generar-documentacion.mjs
 */
export default {
  globs: ['componentes/**/*.js'],
  exclude: ['**/*.prueba.js'],
  outdir: '.',
  dev: false,
};
