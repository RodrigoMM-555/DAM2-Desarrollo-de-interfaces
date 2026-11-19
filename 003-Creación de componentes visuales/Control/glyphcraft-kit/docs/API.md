# glyphcraft-kit · Referencia de componentes

> Documento generado automáticamente a partir del JSDoc (`node herramientas/generar-documentacion.mjs`).
> No lo edites a mano: cambia los comentarios del código y vuelve a generarlo.

**Convenciones**

- *Atributos* (diseño): configuración inicial, declarativa, en el HTML.
- *Propiedades*: interfaz en JavaScript; las de solo lectura reflejan el estado de ejecución.
- *Eventos*: `CustomEvent` que burbujean y atraviesan el Shadow DOM (`composed`).
- Los valores no válidos se corrigen al valor por defecto y se avisa por consola.

## Índice

- [`<gc-arcane-backdrop>`](#gc-arcane-backdrop) — Fondo de partículas flotantes con ráfagas de chispas.
- [`<gc-arcane-meter>`](#gc-arcane-meter) — Indicador de progreso o precisión.
- [`<gc-camera-preview>`](#gc-camera-preview) — Acceso a la cámara con gestión de permisos y errores.
- [`<gc-gesture-indicator>`](#gc-gesture-indicator) — Muestra qué gesto se está reconociendo.
- [`<gc-glyph>`](#gc-glyph) — Glifo en SVG con animación de trazado y activación.
- [`<gc-glyph-canvas>`](#gc-glyph-canvas) — Área de dibujo de glifos.
- [`<gc-glyph-card>`](#gc-glyph-card) — Tarjeta de un glifo del grimorio.
- [`<gc-hand-overlay>`](#gc-hand-overlay) — Visualización de manos y gestos.
- [`<gc-rune-button>`](#gc-rune-button) — Botón temático con estados, icono rúnico y activación por pulsación mantenida.
- [`<gc-rune-slider>`](#gc-rune-slider) — Deslizador para formularios.
- [`<gc-rune-toggle>`](#gc-rune-toggle) — Interruptor para formularios.
- [`<gc-spell-stage>`](#gc-spell-stage) — Efectos mágicos en 3D.
- [`<gc-whisper>`](#gc-whisper) — Pila de notificaciones temporales.

<a id="gc-arcane-backdrop"></a>

## `<gc-arcane-backdrop>`

**Fondo de partículas flotantes con ráfagas de chispas.**

Fondo animado de motas de polvo mágico con ráfagas de chispas.

Usa Canvas 2D (no WebGL) para ser ligero: se reserva el único contexto
WebGL de la página para los efectos de hechizos. Cada color se pre-dibuja
una vez como "sprite" con degradado radial y luego se estampa con
`drawImage`, que es mucho más rápido que crear degradados en cada mota.

Si la persona ha pedido reducir el movimiento, se dibuja un único
fotograma estático.

Clase: `GcFondoArcano` · Fuente: `componentes/fondo-arcano/fondo-arcano.js`

### Atributos (diseño)

| Atributo | Tipo | Descripción |
|---|---|---|
| `density` | `number` | Densidad de motas de 0 a 1. Por defecto `0.5`. |
| `palette` | `'arcane' \| 'ember' \| 'frost'` | Paleta de color. Por defecto `arcane`. |

### Propiedades

| Propiedad | Tipo | Descripción |
|---|---|---|
| `density` | `number` | Densidad de motas de 0 a 1. Por defecto `0.5`. Refleja el atributo `density`. |
| `palette` | `'arcane' \| 'ember' \| 'frost'` | Paleta de color. Por defecto `arcane`. Refleja el atributo `palette`. |
| `moteCount` | `number` | (Solo lectura) Motas activas según tamaño y densidad. |
| `running` | `boolean` | (Solo lectura) `true` si la animación está en marcha. |

### Métodos

| Método | Parámetros | Devuelve | Descripción |
|---|---|---|---|
| `pause()` |  |  | Congela la animación (por ejemplo, durante un hechizo exigente). |
| `resume()` |  |  | Reanuda la animación tras `pause()`. |
| `burst()` | clientX: number, clientY: number, { count = 28, spread = 1 }: , options?: { count?: number, spread?: number } | `number` | Lanza una ráfaga de chispas desde un punto de la ventana. Recibe coordenadas de ventana (`clientX`/`clientY`) para poder pasarle directamente las de un evento de ratón o el centro de un botón. |

### Partes CSS (`::part`)

| Parte | Descripción |
|---|---|
| `canvas` | Lienzo de las partículas. |

---

<a id="gc-arcane-meter"></a>

## `<gc-arcane-meter>`

**Indicador de progreso o precisión.**

Indicador de progreso con tres estilos: anillo con número (precisión),
sellos (aciertos para aprender un glifo) o barra.

Usa `ElementInternals` para exponer el rol ARIA `meter` y su valor: los
lectores de pantalla lo anuncian como un medidor real.

Clase: `GcMedidorArcano` · Fuente: `componentes/medidor-arcano/medidor-arcano.js`

### Atributos (diseño)

| Atributo | Tipo | Descripción |
|---|---|---|
| `value` | `number` | Valor actual (0-max). Por defecto `0`. |
| `max` | `number` | Valor máximo (> 0). Por defecto `100`. |
| `variant` | `'ring' \| 'seals' \| 'bar'` | Estilo. Por defecto `ring`. |
| `label` | `string` | Etiqueta visible y accesible. |
| `threshold` | `number` | Valor a superar: añade una marca y los estados `passed`/`failed`. |

### Propiedades

| Propiedad | Tipo | Descripción |
|---|---|---|
| `value` | `number` | Valor actual (0-max). Por defecto `0`. Refleja el atributo `value`. |
| `max` | `number` | Valor máximo (> 0). Por defecto `100`. Refleja el atributo `max`. |
| `variant` | `'ring' \| 'seals' \| 'bar'` | Estilo. Por defecto `ring`. Refleja el atributo `variant`. |
| `label` | `string` | Etiqueta visible y accesible. Refleja el atributo `label`. |
| `threshold` | `number` | Valor a superar: añade una marca y los estados `passed`/`failed`. Refleja el atributo `threshold`. |
| `role` | `string` |  |

### Métodos

| Método | Parámetros | Devuelve | Descripción |
|---|---|---|---|
| `setValue()` | value: number, { animate = true }: , options?: { animate?: boolean } |  | Cambia el valor, con o sin animación del número. |

### Eventos

| Evento | Tipo | Descripción |
|---|---|---|
| `meter-complete` | `CustomEvent<{value: number, max: number}>` | El valor alcanza el máximo. |

### Partes CSS (`::part`)

| Parte | Descripción |
|---|---|
| `label` |  |

### Propiedades CSS

| Propiedad | Descripción |
|---|---|
| `--gc-meter-color` | Color principal. |
| `--gc-meter-size` | Diámetro del anillo. |

---

<a id="gc-camera-preview"></a>

## `<gc-camera-preview>`

**Acceso a la cámara con gestión de permisos y errores.**

Previsualización de la cámara.

Gestiona el permiso, el flujo de vídeo y sus errores. Los elementos
hijos se superponen al vídeo, lo que permite componer:

```html
<gc-camera-preview>
  <gc-hand-overlay></gc-hand-overlay>
</gc-camera-preview>
```

El vídeo se **muestra** en espejo (como un espejo real) pero la imagen que
se entrega a `frameSource` no está invertida: así el reconocimiento de
manos distingue bien izquierda y derecha.

La cámara se apaga sola al quitar el componente del documento.

Clase: `GcVistaCamara` · Fuente: `componentes/vista-camara/vista-camara.js`

### Atributos (diseño)

| Atributo | Tipo | Descripción |
|---|---|---|
| `mirror` | `'on' \| 'off'` | Mostrar el vídeo en espejo. Por defecto `on`. |
| `fit` | `'cover' \| 'contain'` | Ajuste del vídeo a la caja. Por defecto `cover`. |
| `facing` | `'user' \| 'environment'` | Cámara frontal o trasera. Por defecto `user`. |
| `resolution` | `'low' \| 'medium' \| 'high'` | Resolución pedida. Por defecto `medium` (640×480). |
| `device-id` | `string` | Cámara concreta (ver `listDevices()`). |
| `video-hidden` | `boolean` | Oculta la imagen pero mantiene la cámara activa. |

### Propiedades

| Propiedad | Tipo | Descripción |
|---|---|---|
| `mirror` | `'on' \| 'off'` | Mostrar el vídeo en espejo. Por defecto `on`. Refleja el atributo `mirror`. |
| `fit` | `'cover' \| 'contain'` | Ajuste del vídeo a la caja. Por defecto `cover`. Refleja el atributo `fit`. |
| `facing` | `'user' \| 'environment'` | Cámara frontal o trasera. Por defecto `user`. Refleja el atributo `facing`. |
| `resolution` | `'low' \| 'medium' \| 'high'` | Resolución pedida. Por defecto `medium` (640×480). Refleja el atributo `resolution`. |
| `deviceId` | `string` | Cámara concreta (ver `listDevices()`). Refleja el atributo `device-id`. |
| `videoHidden` | `boolean` | Oculta la imagen pero mantiene la cámara activa. Refleja el atributo `video-hidden`. |
| `status` | `CameraStatus` | (Solo lectura) Estado de la cámara. |
| `frameSource` | `HTMLVideoElement` | (Solo lectura) Vídeo sin espejo para analizarlo. |
| `videoSize` | `{ width: number, height: number }` | (Solo lectura) Resolución real. |
| `lastError` | `CameraErrorReason \| null` | (Solo lectura) Último error. |

### Métodos

| Método | Parámetros | Devuelve | Descripción |
|---|---|---|---|
| `start()` |  | `Promise<boolean>` | Pide permiso y enciende la cámara. |
| `stop()` |  |  | Apaga la cámara (se apaga el piloto de la webcam). |

### Eventos

| Evento | Tipo | Descripción |
|---|---|---|
| `camera-ready` | `CustomEvent<{width: number, height: number, deviceId: string}>` | La cámara emite imagen. |
| `camera-error` | `CustomEvent<{reason: CameraErrorReason, message: string}>` | No se ha podido iniciar. |
| `camera-stopped` | `CustomEvent<{reason: 'user' \| 'ended'}>` | La cámara se ha apagado. |

### Slots

| Slot | Descripción |
|---|---|
| `(por defecto)` | Capas superpuestas al vídeo. |

### Partes CSS (`::part`)

| Parte | Descripción |
|---|---|
| `video` | El vídeo. |

### Propiedades CSS

| Propiedad | Descripción |
|---|---|
| `--gc-camera-opacity` | Opacidad del vídeo (por defecto 1). |
| `--gc-camera-filter` | Filtro CSS del vídeo. |

---

<a id="gc-gesture-indicator"></a>

## `<gc-gesture-indicator>`

**Muestra qué gesto se está reconociendo.**

Indicador del gesto reconocido: icono, texto y anillo de progreso.

Es un componente "tonto" (solo presentación): recibe el estado desde
fuera y no sabe nada de cámaras ni del motor de gestos.

Clase: `GcIndicadorGesto` · Fuente: `componentes/indicador-gesto/indicador-gesto.js`

### Atributos (diseño)

| Atributo | Tipo | Descripción |
|---|---|---|
| `compact` | `boolean` | Solo el icono, sin texto. |

### Propiedades

| Propiedad | Tipo | Descripción |
|---|---|---|
| `state` | `GestureState` | (Ejecución) Gesto actual. Por defecto `none`. |
| `progress` | `number` | (Ejecución) Progreso de borrar/sellar (0-1). Por defecto 0. |

### Partes CSS (`::part`)

| Parte | Descripción |
|---|---|
| `dial` | Icono con el anillo. |
| `label` | Texto del estado. |

---

<a id="gc-glyph"></a>

## `<gc-glyph>`

**Glifo en SVG con animación de trazado y activación.**

Representación visual de un glifo (SVG).

Además de dibujarlo, puede **enseñar a trazarlo** (`playTrace()` dibuja
los trazos en orden, con su número y su punto de inicio) y **activarlo**
(`ignite()`: el glifo se ilumina y se consume).

El glifo se indica con `glyph-id` (se busca en `glyphLibrary`) o
asignando directamente la propiedad `glyph`.

Clase: `GcGlifo` · Fuente: `componentes/glifo/glifo.js`

### Atributos (diseño)

| Atributo | Tipo | Descripción |
|---|---|---|
| `glyph-id` | `string` | Identificador en la biblioteca de glifos. |
| `size` | `number` | Lado en píxeles (16-1024). Por defecto `160`. |
| `glow` | `number` | Intensidad del halo (0-1). Por defecto `0.6`. |
| `ornate` | `boolean` | Añade anillos decorativos exteriores. |
| `numbered` | `boolean` | Muestra el número e inicio de cada trazo. |
| `mode` | `'static' \| 'ghost'` | `ghost` lo muestra tenue, como guía. Por defecto `static`. |

### Propiedades

| Propiedad | Tipo | Descripción |
|---|---|---|
| `glyphId` | `string` | Identificador en la biblioteca de glifos. Refleja el atributo `glyph-id`. |
| `size` | `number` | Lado en píxeles (16-1024). Por defecto `160`. Refleja el atributo `size`. |
| `mode` | `'static' \| 'ghost'` | `ghost` lo muestra tenue, como guía. Por defecto `static`. Refleja el atributo `mode`. |
| `glow` | `number` | Intensidad del halo (0-1). Por defecto `0.6`. Refleja el atributo `glow`. |
| `ornate` | `boolean` | Añade anillos decorativos exteriores. Refleja el atributo `ornate`. |
| `numbered` | `boolean` | Muestra el número e inicio de cada trazo. Refleja el atributo `numbered`. |
| `glyph` | `Glyph \| null` | Glifo mostrado. |
| `tracing` | `boolean` | (Solo lectura) Se está reproduciendo el trazado. |

### Métodos

| Método | Parámetros | Devuelve | Descripción |
|---|---|---|---|
| `playTrace()` | { speed = 1, loop = false }: , options?: { speed?: number, loop?: boolean } | `Promise<boolean>` | Dibuja los trazos uno a uno, en el orden correcto. |
| `stop()` |  |  | Detiene la animación y muestra el glifo completo. |
| `ignite()` | { duration = 1400 }: , options?: { duration?: number } | `Promise<void>` | Activa el glifo: se ilumina, crece y se consume hasta desaparecer. Tras la activación queda invisible hasta llamar a `reset()`. |
| `reset()` |  |  | Vuelve a mostrar el glifo tras `ignite()` o `playTrace()`. |
| `highlightStroke()` | index: number \| null |  | Resalta un trazo (o ninguno con `null`) atenuando los demás. |

### Eventos

| Evento | Tipo | Descripción |
|---|---|---|
| `trace-start` | `CustomEvent<{glyphId: string}>` |  |
| `trace-stroke` | `CustomEvent<{index: number}>` | Empieza a dibujarse el trazo `index`. |
| `trace-end` | `CustomEvent<{completed: boolean}>` | `completed` es false si se detuvo antes. |
| `glyph-ignited` | `CustomEvent<{glyphId: string}>` | Terminó la activación. |

### Partes CSS (`::part`)

| Parte | Descripción |
|---|---|
| `svg` | El SVG. |

### Propiedades CSS

| Propiedad | Descripción |
|---|---|
| `--gc-glyph-ink` | Color del glifo. |
| `--gc-glyph-stroke` | Grosor del trazo (por defecto 2.2px). |
| `--gc-glyph-blur` | Desenfoque del halo en unidades del glifo (radio = 1). Por defecto 0.035px. |

---

<a id="gc-glyph-canvas"></a>

## `<gc-glyph-canvas>`

**Área de dibujo de glifos.**

Lienzo donde se dibujan los trazos de un glifo con tinta luminosa.

No sabe de dónde vienen los puntos: los recibe por métodos
(`beginStroke` / `addPoint` / `endStroke`) desde los gestos de la mano, o
del ratón y la pantalla táctil si `pointer-input` está activo.

Las coordenadas son **normalizadas** (0-1 en cada eje), así los trazos no
dependen del tamaño en pantalla. Para glifos sin deformar, usa un
elemento cuadrado.

Clase: `GcLienzoGlifo` · Fuente: `componentes/lienzo-glifo/lienzo-glifo.js`

### Atributos (diseño)

| Atributo | Tipo | Descripción |
|---|---|---|
| `ink` | `string` | Color de la tinta (cualquier color CSS). Por defecto dorado `#e8c675`. |
| `line-width` | `number` | Grosor en píxeles (1-40). Por defecto `4`. |
| `guide-style` | `'ghost' \| 'faint' \| 'none'` | Visibilidad de la guía. Por defecto `ghost`. |
| `guide-next` | `boolean` | Resalta en la guía el siguiente trazo que toca dibujar. |
| `max-strokes` | `number` | Máximo de trazos (1-200). Por defecto `32`. |
| `pointer-input` | `boolean` | Permite dibujar con ratón o pantalla táctil. |
| `readonly` | `boolean` | Impide añadir trazos. |

### Propiedades

| Propiedad | Tipo | Descripción |
|---|---|---|
| `ink` | `string` | Color de la tinta (cualquier color CSS). Por defecto dorado `#e8c675`. Refleja el atributo `ink`. |
| `lineWidth` | `number` | Grosor en píxeles (1-40). Por defecto `4`. Refleja el atributo `line-width`. |
| `maxStrokes` | `number` | Máximo de trazos (1-200). Por defecto `32`. Refleja el atributo `max-strokes`. |
| `pointerInput` | `boolean` | Permite dibujar con ratón o pantalla táctil. Refleja el atributo `pointer-input`. |
| `readonly` | `boolean` | Impide añadir trazos. Refleja el atributo `readonly`. |
| `guideStyle` | `'ghost' \| 'faint' \| 'none'` | Visibilidad de la guía. Por defecto `ghost`. Refleja el atributo `guide-style`. |
| `guideNext` | `boolean` | Resalta en la guía el siguiente trazo que toca dibujar. Refleja el atributo `guide-next`. |
| `guide` | `{ x: number, y: number }[][] \| null` | (Diseño) Trazos modelo que se muestran como guía. |
| `feedback` | `StrokeGrade[]` | (Ejecución) Corrección por trazo: colorea cada trazo. Se borra al cambiar los trazos. |
| `strokes` | `Stroke[]` | (Solo lectura) Copia de los trazos terminados. |
| `strokeCount` | `number` | (Solo lectura) Número de trazos terminados. |
| `isDrawing` | `boolean` | (Solo lectura) Hay un trazo en curso. |

### Métodos

| Método | Parámetros | Devuelve | Descripción |
|---|---|---|---|
| `beginStroke()` | point: { x: number, y: number }, { source = 'program' }: , options?: { source?: StrokeSource } | `boolean` | Empieza un trazo. |
| `addPoint()` | point: { x: number, y: number } | `boolean` | Añade un punto al trazo en curso. Los puntos casi idénticos al anterior se ignoran. |
| `endStroke()` |  | `Stroke \| null` | Termina el trazo en curso. Si es demasiado corto, se descarta. |
| `cancelStroke()` |  |  | Descarta el trazo en curso sin guardarlo. |
| `undo()` |  | `boolean` | Elimina el último trazo. |
| `clear()` | { animated = true }: , options?: { animated?: boolean } | `Promise<boolean>` | Borra todos los trazos, con un desvanecimiento opcional. Emite `glyph-clearing` antes (cancelable) y `glyph-cleared` después. |
| `loadStrokes()` | strokes: Stroke[] |  | Sustituye los trazos (por ejemplo, para restaurar un dibujo guardado). |
| `toJSON()` |  |  | Datos serializables del dibujo. |

### Eventos

| Evento | Tipo | Descripción |
|---|---|---|
| `drawing-started` | `CustomEvent<{point: StrokePoint, source: StrokeSource}>` | Empieza un trazo. |
| `drawing-ended` | `CustomEvent<{stroke: Stroke \| null, accepted: boolean, index: number}>` | Termina un trazo (rechazado si es demasiado corto). |
| `strokes-changed` | `CustomEvent<{count: number}>` | Cambia el número de trazos. |
| `glyph-clearing` | `CustomEvent<{count: number}>` | Va a borrarse todo. **Cancelable** con `preventDefault()`. |
| `glyph-cleared` | `CustomEvent<{count: number}>` | Se ha borrado todo. |

### Partes CSS (`::part`)

| Parte | Descripción |
|---|---|
| `canvas` | El lienzo. |

---

<a id="gc-glyph-card"></a>

## `<gc-glyph-card>`

**Tarjeta de un glifo del grimorio.**

Entrada del grimorio: miniatura del glifo, nombre, tipo de magia,
dificultad y sellos de aprendizaje.

Es un ejemplo de **composición**: reutiliza `<gc-glyph>` y
`<gc-arcane-meter>` dentro de su Shadow DOM.

Clase: `GcTarjetaGlifo` · Fuente: `componentes/tarjeta-glifo/tarjeta-glifo.js`

### Atributos (diseño)

| Atributo | Tipo | Descripción |
|---|---|---|
| `glyph-id` | `string` | Glifo de la biblioteca. |
| `progress` | `number` | Aciertos conseguidos. Por defecto `0`. |
| `required` | `number` | Aciertos necesarios para aprenderlo. Por defecto `3`. |
| `learned` | `boolean` | El glifo está aprendido. |
| `mastered` | `boolean` | El glifo está dominado. |
| `selected` | `boolean` | Es la página abierta del grimorio. |

### Propiedades

| Propiedad | Tipo | Descripción |
|---|---|---|
| `glyphId` | `string` | Glifo de la biblioteca. Refleja el atributo `glyph-id`. |
| `progress` | `number` | Aciertos conseguidos. Por defecto `0`. Refleja el atributo `progress`. |
| `required` | `number` | Aciertos necesarios para aprenderlo. Por defecto `3`. Refleja el atributo `required`. |
| `learned` | `boolean` | El glifo está aprendido. Refleja el atributo `learned`. |
| `mastered` | `boolean` | El glifo está dominado. Refleja el atributo `mastered`. |
| `selected` | `boolean` | Es la página abierta del grimorio. Refleja el atributo `selected`. |

### Métodos

| Método | Parámetros | Devuelve | Descripción |
|---|---|---|---|
| `select()` |  |  | Selecciona la tarjeta (como si se pulsara). |

### Eventos

| Evento | Tipo | Descripción |
|---|---|---|
| `glyph-select` | `CustomEvent<{glyphId: string}>` | Se ha elegido la tarjeta. |

### Partes CSS (`::part`)

| Parte | Descripción |
|---|---|
| `card` | El botón de la tarjeta. |

### Propiedades CSS

| Propiedad | Descripción |
|---|---|
| `--gc-glyph-card-ink` | Color del texto y del glifo. |
| `--gc-glyph-card-accent` | Color de lo destacado. |

---

<a id="gc-hand-overlay"></a>

## `<gc-hand-overlay>`

**Visualización de manos y gestos.**

Dibuja las manos detectadas: puntos de referencia, articulaciones,
conexiones y el estado del gesto (color, anillo de progreso, cursor).

Sirve para que la persona entienda qué está viendo el programa y corrija
su postura. Puede colocarse:
- encima de `<gc-camera-preview>` (mismo `fit` y `mirror`);
- sobre el lienzo de dibujo, mostrando solo una `region` de la imagen
  (la zona calibrada) con `fit="fill"`.

Clase: `GcCapaMano` · Fuente: `componentes/capa-mano/capa-mano.js`

### Atributos (diseño)

| Atributo | Tipo | Descripción |
|---|---|---|
| `variant` | `'skeleton' \| 'constellation' \| 'minimal'` | Estilo: esqueleto, constelación o mínimo. Por defecto `skeleton`. |
| `mirror` | `'on' \| 'off'` | Dibujar en espejo. Por defecto `on`. |
| `fit` | `'cover' \| 'contain' \| 'fill'` | Ajuste de la imagen a la caja. Por defecto `cover`. |

### Propiedades

| Propiedad | Tipo | Descripción |
|---|---|---|
| `variant` | `'skeleton' \| 'constellation' \| 'minimal'` | Estilo: esqueleto, constelación o mínimo. Por defecto `skeleton`. Refleja el atributo `variant`. |
| `mirror` | `'on' \| 'off'` | Dibujar en espejo. Por defecto `on`. Refleja el atributo `mirror`. |
| `fit` | `'cover' \| 'contain' \| 'fill'` | Ajuste de la imagen a la caja. Por defecto `cover`. Refleja el atributo `fit`. |
| `region` | `Rect` | (Diseño) Parte de la imagen que se muestra, normalizada. Por defecto toda. |
| `guide` | `Rect \| null` | (Diseño) Rectángulo guía (p. ej. zona de trazado), normalizado a la imagen. |
| `frame` | `HandFrame \| null` | (Ejecución) Último fotograma de manos. |
| `gestures` | `HandGestureInfo[]` | (Ejecución) Estado de gesto de cada mano. |
| `handCount` | `number` | (Solo lectura) Manos en el último fotograma. |

### Métodos

| Método | Parámetros | Devuelve | Descripción |
|---|---|---|---|
| `projectPoint()` | point: { x: number, y: number } | `{ x: number, y: number }` | Convierte un punto normalizado de la imagen a píxeles de este elemento, aplicando `region`, `fit` y `mirror`. Útil para alinear otras capas. |
| `clear()` |  |  | Borra el dibujo y olvida el último fotograma. |

### Eventos

| Evento | Tipo | Descripción |
|---|---|---|
| `hand-detected` | `CustomEvent<{count: number, handedness: string[]}>` | Aparecen manos tras no haber ninguna. |
| `hand-lost` | `CustomEvent<{}>` | Dejan de verse manos durante 300 ms. |

### Partes CSS (`::part`)

| Parte | Descripción |
|---|---|
| `canvas` | Lienzo de dibujo. |

---

<a id="gc-rune-button"></a>

## `<gc-rune-button>`

**Botón temático con estados, icono rúnico y activación por pulsación mantenida.**

Botón con estética de runa tallada.

Puede activarse con un clic normal o, si `hold-ms` es mayor que 0, exigir
que se mantenga pulsado durante ese tiempo. El modo "mantener" sirve para
acciones delicadas (como borrar todo) y para pulsar botones sin clic,
por ejemplo con gestos.

Clase: `GcBotonRuna` · Fuente: `componentes/boton-runa/boton-runa.js`

### Atributos (diseño)

| Atributo | Tipo | Descripción |
|---|---|---|
| `variant` | `'primary' \| 'ghost' \| 'danger' \| 'inscription'` | Estilo visual. Por defecto `primary`. |
| `size` | `'sm' \| 'md' \| 'lg'` | Tamaño. Por defecto `md`. |
| `rune` | `string` | Nombre del icono rúnico (ver `RUNE_NAMES`). Por defecto, sin icono. |
| `disabled` | `boolean` | Desactiva el botón. Por defecto `false`. |
| `hold-ms` | `number` | Milisegundos que hay que mantenerlo pulsado (0-10000). `0` = clic normal. Por defecto `0`. |
| `pressed` | `'true' \| 'false'` | Convierte el botón en interruptor (aria-pressed). Sin atributo, es un botón normal. |

### Propiedades

| Propiedad | Tipo | Descripción |
|---|---|---|
| `variant` | `'primary' \| 'ghost' \| 'danger' \| 'inscription'` | Estilo visual. Por defecto `primary`. Refleja el atributo `variant`. |
| `size` | `'sm' \| 'md' \| 'lg'` | Tamaño. Por defecto `md`. Refleja el atributo `size`. |
| `rune` | `string` | Nombre del icono rúnico (ver `RUNE_NAMES`). Por defecto, sin icono. Refleja el atributo `rune`. |
| `disabled` | `boolean` | Desactiva el botón. Por defecto `false`. Refleja el atributo `disabled`. |
| `pressed` |  | Estado de interruptor: `true`/`false`, o `null` si no es un interruptor. |
| `holdMs` | `number` | Milisegundos que hay que mantenerlo pulsado (0-10000). `0` = clic normal. Por defecto `0`. Refleja el atributo `hold-ms`. |
| `state` | `RuneButtonState` | (Solo lectura) Estado de ejecución actual. |
| `charge` | `number` | (Solo lectura) Carga acumulada en modo mantener, de 0 a 1. |

### Métodos

| Método | Parámetros | Devuelve | Descripción |
|---|---|---|---|
| `activate()` | source?: ActivationSource | `boolean` | Activa el botón desde código (por ejemplo, desde el cursor de la mano). |
| `pulse()` |  |  | Reproduce el destello de activación sin emitir ningún evento. |

### Eventos

| Evento | Tipo | Descripción |
|---|---|---|
| `rune-activate` | `CustomEvent<{source: ActivationSource}>` | El botón se ha activado. |
| `charge-change` | `CustomEvent<{charge: number}>` | La carga cambia mientras se mantiene pulsado. |

### Slots

| Slot | Descripción |
|---|---|
| `(por defecto)` | Texto principal del botón. |
| `hint` | Texto secundario bajo el principal (útil en menús). |

### Partes CSS (`::part`)

| Parte | Descripción |
|---|---|
| `button` | El `<button>` interno. |
| `icon` | Contenedor del icono. |
| `label` | Texto principal. |
| `hint` | Texto secundario. |
| `charge` | Barra de carga del modo mantener. |

### Propiedades CSS

| Propiedad | Descripción |
|---|---|
| `--gc-rune-button-accent` | Color de acento (borde, icono, brillo). |

---

<a id="gc-rune-slider"></a>

## `<gc-rune-slider>`

**Deslizador para formularios.**

Deslizador rúnico **asociado a formularios**.

Por dentro usa un `<input type="range">` nativo (teclado y lectores de
pantalla funcionan sin trabajo extra) y por fuera se comporta como un
control de formulario gracias a `ElementInternals`.

Clase: `GcDeslizadorRuna` · Fuente: `componentes/deslizador-runa/deslizador-runa.js`

### Atributos (diseño)

| Atributo | Tipo | Descripción |
|---|---|---|
| `label` | `string` | Texto de la etiqueta. |
| `min` | `number` | Mínimo. Por defecto `0`. |
| `max` | `number` | Máximo. Por defecto `100`. |
| `step` | `number` | Paso. Por defecto `1`. |
| `value` | `number` | Valor inicial (y valor al restablecer el formulario). |
| `disabled` | `boolean` |  |
| `name` | `string` | Nombre del campo en el formulario. |

### Propiedades

| Propiedad | Tipo | Descripción |
|---|---|---|
| `min` | `number` | Mínimo. Por defecto `0`. Refleja el atributo `min`. *(solo lectura)* |
| `max` | `number` | Máximo. Por defecto `100`. Refleja el atributo `max`. *(solo lectura)* |
| `step` | `number` | Paso. Por defecto `1`. Refleja el atributo `step`. *(solo lectura)* |
| `value` | `number` | (Ejecución) Valor actual. |
| `formatter` | `(value: number) => string` | (Diseño) Cómo se muestra el valor. Por defecto, el número. |
| `name` | `string` | Nombre del campo en el formulario. Refleja el atributo `name`. *(solo lectura)* |
| `form` | `HTMLFormElement \| null` | (Solo lectura) |

### Métodos

| Método | Parámetros | Devuelve | Descripción |
|---|---|---|---|
| `formResetCallback()` |  |  |  |
| `formDisabledCallback()` | disabled: boolean |  |  |

### Eventos

| Evento | Tipo | Descripción |
|---|---|---|
| `input` | `InputEvent` | Mientras se arrastra (evento nativo del input interno). |
| `change` | `CustomEvent<{value: number}>` | Al soltar o con el teclado. |

### Partes CSS (`::part`)

| Parte | Descripción |
|---|---|
| `input` |  |
| `value` |  |

### Propiedades CSS

| Propiedad | Descripción |
|---|---|
| `--gc-rune-slider-accent` |  |

---

<a id="gc-rune-toggle"></a>

## `<gc-rune-toggle>`

**Interruptor para formularios.**

Interruptor rúnico de dos estados, **asociado a formularios**.

Con `static formAssociated = true` y `ElementInternals`, el navegador lo
trata como un control de formulario: participa en el envío (`name` /
`value`), se restablece con `form.reset()` y aparece en `form.elements`.
El elemento interno tiene el rol accesible `switch` y toma su nombre del
texto de la etiqueta.

Clase: `GcInterruptorRuna` · Fuente: `componentes/interruptor-runa/interruptor-runa.js`

### Atributos (diseño)

| Atributo | Tipo | Descripción |
|---|---|---|
| `checked` | `boolean` | Estado inicial (también es el valor al restablecer el formulario). |
| `disabled` | `boolean` | Desactivado. |
| `name` | `string` | Nombre del campo en el formulario. |
| `value` | `string` | Valor enviado cuando está activado. Por defecto `on`. |

### Propiedades

| Propiedad | Tipo | Descripción |
|---|---|---|
| `checked` | `boolean` | (Ejecución) Estado actual. |
| `disabled` | `boolean` | Desactivado. Refleja el atributo `disabled`. |
| `name` | `string` | Nombre del campo en el formulario. Refleja el atributo `name`. *(solo lectura)* |
| `value` | `string` | Valor enviado cuando está activado. Por defecto `on`. Refleja el atributo `value`. *(solo lectura)* |
| `form` | `HTMLFormElement \| null` | (Solo lectura) Formulario al que pertenece. |

### Métodos

| Método | Parámetros | Devuelve | Descripción |
|---|---|---|---|
| `toggle()` |  |  | Cambia de estado como si se pulsara (emite `change`). |
| `formResetCallback()` |  |  |  |
| `formStateRestoreCallback()` | state: string \| null |  |  |
| `formDisabledCallback()` | disabled: boolean |  |  |

### Eventos

| Evento | Tipo | Descripción |
|---|---|---|
| `change` | `CustomEvent<{checked: boolean}>` | Cambia por acción de la persona. |

### Slots

| Slot | Descripción |
|---|---|
| `(por defecto)` | Etiqueta. |

### Partes CSS (`::part`)

| Parte | Descripción |
|---|---|
| `track` |  |
| `thumb` |  |

### Propiedades CSS

| Propiedad | Descripción |
|---|---|
| `--gc-rune-toggle-accent` |  |

---

<a id="gc-spell-stage"></a>

## `<gc-spell-stage>`

**Efectos mágicos en 3D.**

Escenario 3D donde se manifiestan los hechizos (Three.js / WebGL).

Se coloca encima del lienzo de dibujo, con el mismo tamaño: las
coordenadas de `cast()` son las mismas (0-1), así el hechizo brota
exactamente del glifo dibujado. El lienzo WebGL es transparente y se
extiende más allá de la caja (`overflow`) para que las llamas o los rayos
puedan salir del círculo.

Cada lanzamiento combina la secuencia de activación común (el glifo se
enciende, se consume y estalla) con el efecto del elemento.

El bucle de animación solo funciona mientras hay efectos activos, y el
contexto WebGL se libera al quitar el componente.

Clase: `GcEscenarioHechizo` · Fuente: `componentes/escenario-hechizo/escenario-hechizo.js`

### Atributos (diseño)

| Atributo | Tipo | Descripción |
|---|---|---|
| `quality` | `'low' \| 'medium' \| 'high'` | Partículas y resolución. Por defecto `medium`. |
| `overflow` | `number` | Cuánto se extiende el lienzo fuera de la caja por cada lado (0-1). Por defecto `0.25`. |

### Propiedades

| Propiedad | Tipo | Descripción |
|---|---|---|
| `quality` | `'low' \| 'medium' \| 'high'` | Partículas y resolución. Por defecto `medium`. Refleja el atributo `quality`. |
| `overflow` | `number` | Cuánto se extiende el lienzo fuera de la caja por cada lado (0-1). Por defecto `0.25`. Refleja el atributo `overflow`. |
| `ready` | `boolean` | (Solo lectura) WebGL inicializado. |
| `isCasting` | `boolean` | (Solo lectura) Hay algún hechizo en curso. |
| `stats` | `{ effects: number, particles: number }` | (Solo lectura) Efectos y partículas activos. |

### Métodos

| Método | Parámetros | Devuelve | Descripción |
|---|---|---|---|
| `cast()` | spellId: string \| string[], { x = 0.5, y = 0.5, radius = 0.4, strokes = [], intensity = 1, stability = 1 }: , options?: CastOptions | `Promise<boolean>` | Lanza un hechizo (o varios combinados) sobre el glifo dibujado. Con varios hechizos la activación es única (con el color del primero) y todos los efectos estallan a la vez: así se combinan en el laboratorio. |
| `clear()` |  |  | Detiene y elimina todos los efectos en curso. |

### Eventos

| Evento | Tipo | Descripción |
|---|---|---|
| `stage-ready` | `CustomEvent<{}>` | WebGL está listo. |
| `stage-error` | `CustomEvent<{reason: string}>` | No hay WebGL disponible. |
| `spell-cast` | `CustomEvent<{spell: string}>` | Empieza un hechizo. |
| `spell-finished` | `CustomEvent<{spell: string}>` | Termina un hechizo. |

### Partes CSS (`::part`)

| Parte | Descripción |
|---|---|
| `canvas` |  |

---

<a id="gc-whisper"></a>

## `<gc-whisper>`

**Pila de notificaciones temporales.**

Avisos efímeros con estética de susurro arcano (notificaciones).

Se coloca una sola vez en la página y se usa mediante su método `show()`.
El contenido siempre se inserta como texto (nunca como HTML), así que es
seguro mostrar mensajes con datos externos.

Accesibilidad: la región es `role="status"` (lectores de pantalla la
anuncian sin interrumpir) y los avisos de error usan `role="alert"`.

Clase: `GcSusurro` · Fuente: `componentes/susurro/susurro.js`

### Atributos (diseño)

| Atributo | Tipo | Descripción |
|---|---|---|
| `position` | `'top-end' \| 'top-center' \| 'bottom-end' \| 'bottom-center'` | Esquina donde aparecen. Por defecto `top-end`. |
| `max-visible` | `number` | Máximo de avisos simultáneos (1-10). Por defecto `3`. |

### Propiedades

| Propiedad | Tipo | Descripción |
|---|---|---|
| `position` | `'top-end' \| 'top-center' \| 'bottom-end' \| 'bottom-center'` | Esquina donde aparecen. Por defecto `top-end`. Refleja el atributo `position`. |
| `maxVisible` | `number` | Máximo de avisos simultáneos (1-10). Por defecto `3`. Refleja el atributo `max-visible`. |
| `count` | `number` | (Solo lectura) Avisos visibles ahora mismo. |

### Métodos

| Método | Parámetros | Devuelve | Descripción |
|---|---|---|---|
| `show()` | options: WhisperOptions | `string` | Muestra un aviso. |
| `dismiss()` | id: string | `boolean` | Retira un aviso. |
| `dismissAll()` |  | `number` | Retira todos los avisos. |

### Eventos

| Evento | Tipo | Descripción |
|---|---|---|
| `whisper-shown` | `CustomEvent<{id: string, type: WhisperType, title: string, message: string}>` | Se ha mostrado un aviso. |
| `whisper-dismissed` | `CustomEvent<{id: string, reason: DismissReason}>` | Se ha retirado un aviso. |

### Partes CSS (`::part`)

| Parte | Descripción |
|---|---|
| `whisper` | Cada aviso. |
| `close` | Botón de cerrar. |
