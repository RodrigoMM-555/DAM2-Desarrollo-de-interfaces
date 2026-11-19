/**
 * Tabla de rutas de la aplicación.
 *
 * `mood` cambia la paleta del fondo animado al entrar en cada sección.
 *
 * @type {(import('./enrutador.js').RouteDefinition & { mood: 'arcane' | 'ember' | 'frost' })[]}
 */
export const ROUTES = [
  { path: '/', view: 'gc-view-menu', title: 'GlyphCraft', mood: 'arcane' },
  { path: '/practice', view: 'gc-view-practice', title: 'Practicar magia', mood: 'arcane' },
  { path: '/grimoire/:glyphId?', view: 'gc-view-grimoire', title: 'Grimorio', mood: 'arcane' },
  { path: '/grimoire/:glyphId/practice', view: 'gc-view-glyph-practice', title: 'Práctica guiada', mood: 'arcane' },
  { path: '/lab', view: 'gc-view-lab', title: 'Laboratorio', mood: 'ember' },
  { path: '/progress', view: 'gc-view-progress', title: 'Progreso', mood: 'arcane' },
  { path: '/settings', view: 'gc-view-settings', title: 'Ajustes', mood: 'frost' },
];
