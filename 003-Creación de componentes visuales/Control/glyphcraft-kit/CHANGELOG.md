# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y
[versionado semántico](https://semver.org/lang/es/): un cambio en el nombre o
el significado de un atributo, propiedad, método o evento es un cambio
**mayor**; añadir uno nuevo es **menor**; corregir un fallo es un **parche**.

## [2.0.0]

### Cambiado (incompatible)
- Sin compilación: la biblioteca se distribuye como módulos ES nativos y se
  usa directamente desde el navegador con un *import map*. Desaparecen `dist/`,
  el bundle de un solo archivo y los tipos `.d.ts` generados (los tipos siguen
  documentados con JSDoc).
- Archivos, carpetas y clases en español: `GcRuneButton` → `GcBotonRuna`,
  `GestureEngine` → `MotorGestos`, `GlyphRecognizer` → `ReconocedorGlifos`…
  Las etiquetas (`<gc-rune-button>`), atributos, propiedades, métodos y
  eventos no cambian.
- Puntos de entrada en español: `/core` → `/nucleo`, `/tracking` →
  `/seguimiento`, `/effects` → `/efectos`, `/glyphs` → `/glifos`,
  `/testing` → `/sinteticos`.
- Pruebas: `*.test.js` → `*.prueba.js`, ejecutadas con `pruebas.html` en lugar
  de Vitest.

## [1.0.0]

### Componentes
- `<gc-rune-button>`: botón rúnico con variantes, modo mantener pulsado e interruptor (`pressed`).
- `<gc-arcane-backdrop>`: fondo de partículas con ráfagas.
- `<gc-whisper>`: avisos temporales accesibles.
- `<gc-camera-preview>`: cámara con gestión de permisos y errores.
- `<gc-hand-overlay>`: visualización de manos (esqueleto, constelación, mínimo).
- `<gc-gesture-indicator>`: gesto reconocido con progreso.
- `<gc-glyph-canvas>`: lienzo de trazos con guía y corrección por trazo.
- `<gc-glyph>`: glifo SVG con animación de trazado y activación.
- `<gc-arcane-meter>`: indicador con rol ARIA `meter`.
- `<gc-glyph-card>`: tarjeta de grimorio (compone `<gc-glyph>` y `<gc-arcane-meter>`).
- `<gc-rune-toggle>` y `<gc-rune-slider>`: controles asociados a formularios.
- `<gc-spell-stage>` (`/effects`): hechizos 3D con partículas en GPU.

### Lógica
- `MotorGestos`: dibujar con el índice (o la pinza), borrar con la mano abierta, sellar con el puño.
- `ReconocedorGlifos` con niveles Aprendiz, Artesano y Maestro; `detectElements` para combinaciones.
- Fuentes de manos: `FuenteManoMediaPipe`, `FuenteManoGrabada`, `GrabadorSesion`.
- Utilidades de prueba sin cámara: manos y dibujos sintéticos.
