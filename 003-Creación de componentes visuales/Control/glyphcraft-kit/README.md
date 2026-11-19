# glyphcraft-kit

Web Components y lógica de reconocimiento gestual para dibujar glifos mágicos
con las manos: lienzo de trazos, visualización de manos, reconocedor de glifos,
motor de gestos y hechizos en 3D.

- 13 componentes nativos (Custom Elements + Shadow DOM), sin framework.
- Módulos ES nativos: se usa tal cual, sin compilar ni instalar nada.
- Lógica pura reutilizable (`/nucleo`), probada sin cámara.
- Tipos documentados con JSDoc, manifiesto de Custom Elements y autocompletado en VS Code.

📖 **Referencia completa**: [`docs/API.md`](docs/API.md) (generada del JSDoc) ·
🧪 **Catálogo interactivo**: `catalogo.html` de la app.

## Instalación

**Sin herramientas** (lo que usa GlyphCraft): copia la carpeta `glyphcraft-kit/`
en tu proyecto y declara un *import map* para poder importarla por su nombre.
Solo hace falta `three` si usas `/efectos` y MediaPipe si usas `/seguimiento`.

```html
<link rel="stylesheet" href="glyphcraft-kit/tokens.css" /> <!-- paleta y tipografía (opcional) -->
<script type="importmap">
  {
    "imports": {
      "glyphcraft-kit": "./glyphcraft-kit/glyphcraft-kit.js",
      "glyphcraft-kit/nucleo": "./glyphcraft-kit/nucleo.js",
      "glyphcraft-kit/glifos": "./glyphcraft-kit/glifos.js",
      "three": "./lib/three/three.module.js"
    }
  }
</script>
<gc-glyph glyph-id="ignis" ornate numbered></gc-glyph>
<script type="module">
  import 'glyphcraft-kit'; // registra los componentes
  import { glyphLibrary } from 'glyphcraft-kit/nucleo';
  import { STARTER_GLYPHS } from 'glyphcraft-kit/glifos';
  glyphLibrary.add(...STARTER_GLYPHS);
</script>
```

La página debe abrirse desde un servidor (Live Server, `localhost`…), no con
`file://`: los navegadores no cargan módulos ES desde archivos locales.

**Con npm** (desde el `.tgz` generado con `npm pack` en esta carpeta):

```bash
npm install glyphcraft-kit-2.0.0.tgz
npm install three @mediapipe/tasks-vision   # solo si usas /efectos o /seguimiento
```

## Puntos de entrada

| Importación | Archivo | Contenido |
|---|---|---|
| `glyphcraft-kit` | `glyphcraft-kit.js` | Componentes (se registran al importar), controladores, iconos |
| `glyphcraft-kit/nucleo` | `nucleo.js` | Gestos, filtros, geometría, modelo de glifos, reconocedor, combinaciones |
| `glyphcraft-kit/seguimiento` | `seguimiento.js` | `FuenteManoMediaPipe`, `FuenteManoGrabada`, `GrabadorSesion` |
| `glyphcraft-kit/efectos` | `efectos.js` | `<gc-spell-stage>` y hechizos (requiere `three`) |
| `glyphcraft-kit/glifos` | `glifos.js` | Grimorio inicial de seis glifos |
| `glyphcraft-kit/sinteticos` | `sinteticos.js` | Manos y dibujos sintéticos para pruebas |
| `glyphcraft-kit/tokens.css` | `tokens.css` | Design tokens |

## Herramientas de desarrollo (opcionales)

Ninguna hace falta para usar la biblioteca; solo para regenerar su documentación:

```bash
npx @custom-elements-manifest/analyzer analyze   # custom-elements.json a partir del JSDoc
node herramientas/generar-documentacion.mjs     # docs/API.md y html-custom-data.json
npm pack                                        # empaqueta la biblioteca en un .tgz
```

Todo lo que no aparece aquí es interno y puede cambiar sin aviso (si se instala
con npm, el campo `exports` del `package.json` impide importarlo).

## Convenciones de los componentes

- **Atributos** = configuración de diseño (declarativa, en el HTML); las
  propiedades que los reflejan tienen el mismo nombre en camelCase.
- **Propiedades de solo lectura** = estado de ejecución (`state`, `isDrawing`…).
- **Eventos** = `CustomEvent` con `bubbles` y `composed`; `glyph-clearing` es cancelable.
- **Estado interno** en campos privados `#`; estilo desde fuera solo con
  custom properties `--gc-*` y `::part()`; estados CSS con `:state()`.
- Valores no válidos → valor por defecto + aviso en consola.
- `<gc-rune-toggle>` y `<gc-rune-slider>` son **controles de formulario**
  (`formAssociated` + `ElementInternals`).
- Los componentes que pueden definirse en diferido aplican el patrón
  *upgrade property* (recogen propiedades asignadas antes de definirse).

## Componentes

### `<gc-rune-button>`

Botón con estética de runa. Se activa con un clic o, si `hold-ms` > 0,
manteniéndolo pulsado.

| Atributo | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `variant` | `primary` \| `ghost` \| `danger` \| `inscription` | `primary` | Estilo visual |
| `size` | `sm` \| `md` \| `lg` | `md` | Tamaño |
| `rune` | string | — | Icono rúnico (`RUNE_NAMES`) |
| `disabled` | boolean | `false` | Desactiva el botón |
| `hold-ms` | number (0–10000) | `0` | Tiempo de pulsación mantenida |

| Propiedad (solo lectura) | Descripción |
|---|---|
| `state` | `idle` · `hover` · `charging` · `active` · `disabled` |
| `charge` | Carga del modo mantener (0–1) |

| Método | Descripción |
|---|---|
| `activate(source?)` | Lo activa desde código. Devuelve `false` si está desactivado |
| `pulse()` | Destello visual sin emitir eventos |

| Evento | `detail` |
|---|---|
| `rune-activate` | `{ source: 'pointer' \| 'keyboard' \| 'program' }` |
| `charge-change` | `{ charge: number }` |

Slots: *(por defecto)* texto, `hint` texto secundario.
Partes CSS: `button`, `icon`, `label`, `hint`, `charge`.
Custom property: `--gc-rune-button-accent`.
Estados CSS: `:state(charging)`, `:state(active)`.

### `<gc-arcane-backdrop>`

Fondo de motas mágicas flotantes (Canvas 2D) con ráfagas de chispas.

| Atributo | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `density` | number (0–1) | `0.5` | Densidad de motas |
| `palette` | `arcane` \| `ember` \| `frost` | `arcane` | Paleta de color |

| Propiedad (solo lectura) | Descripción |
|---|---|
| `moteCount` | Motas activas |
| `running` | Si la animación está en marcha |

| Método | Descripción |
|---|---|
| `pause()` / `resume()` | Congela o reanuda la animación |
| `burst(clientX, clientY, { count?, spread? })` | Ráfaga de chispas. Devuelve cuántas se crearon |

Respeta `prefers-reduced-motion` (fotograma estático, sin ráfagas).

### `<gc-whisper>`

Avisos temporales. Se coloca una vez en la página y se usa con `show()`.

| Atributo | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `position` | `top-end` \| `top-center` \| `bottom-end` \| `bottom-center` | `top-end` | Posición |
| `max-visible` | number (1–10) | `3` | Avisos simultáneos |

| Método | Descripción |
|---|---|
| `show({ message, title?, type?, duration? })` | Muestra un aviso y devuelve su `id`. `type`: `info` · `success` · `warning` · `error` · `arcane`. `duration` en ms (`0` = permanente, por defecto 4000). Lanza `TypeError` sin `message` |
| `dismiss(id)` | Lo retira. Devuelve `false` si no existía |
| `dismissAll()` | Retira todos y devuelve cuántos |

| Evento | `detail` |
|---|---|
| `whisper-shown` | `{ id, type, title, message }` |
| `whisper-dismissed` | `{ id, reason: 'timeout' \| 'user' \| 'program' \| 'overflow' }` |

El contenido se inserta siempre como texto, nunca como HTML.

### `<gc-camera-preview>`

Acceso a la cámara con gestión de permisos. Los hijos se superponen al vídeo.

| Atributo | Por defecto | Descripción |
|---|---|---|
| `mirror` (`on`/`off`) | `on` | Muestra el vídeo en espejo (el análisis usa la imagen sin invertir) |
| `fit` (`cover`/`contain`) | `cover` | Ajuste del vídeo |
| `facing` (`user`/`environment`) | `user` | Cámara frontal o trasera |
| `resolution` (`low`/`medium`/`high`) | `medium` | 480×360 · 640×480 · 1280×720 |
| `device-id` | — | Cámara concreta |
| `video-hidden` | `false` | Oculta la imagen sin apagar la cámara |

Propiedades: `status`, `frameSource` (vídeo para analizar), `videoSize`, `lastError`.
Métodos: `start(): Promise<boolean>`, `stop()`, `GcVistaCamara.listDevices()`.
Eventos: `camera-ready`, `camera-error` (`reason`: `denied` · `notfound` · `busy` · `insecure` · `unknown`), `camera-stopped`.
Se apaga sola al salir del documento.

### `<gc-hand-overlay>`

Dibuja los landmarks, las conexiones y el estado del gesto.

| Atributo | Por defecto | Descripción |
|---|---|---|
| `variant` (`skeleton`/`constellation`/`minimal`) | `skeleton` | Estilo |
| `mirror` (`on`/`off`) | `on` | Espejo |
| `fit` (`cover`/`contain`/`fill`) | `cover` | Igual que el vídeo que acompaña |

Propiedades: `frame` (ejecución), `gestures` (ejecución), `region` (parte de la imagen mostrada), `guide` (rectángulo guía), `handCount`.
Métodos: `projectPoint(p)`, `clear()`.
Eventos: `hand-detected`, `hand-lost` (tras 300 ms sin manos).

### `<gc-gesture-indicator>`

Icono, texto y anillo de progreso del gesto actual. Propiedades `state`
(`none` · `idle` · `pointing` · `drawing` · `erasing` · `sealing`) y `progress` (0-1).
Atributo `compact`. Estados CSS `:state(<gesto>)`.

### `<gc-glyph-canvas>`

Lienzo de tinta luminosa con coordenadas normalizadas (0-1).

| Atributo | Por defecto | Descripción |
|---|---|---|
| `ink` | `#e8c675` | Color de la tinta |
| `line-width` (1-40) | `4` | Grosor |
| `max-strokes` (1-200) | `32` | Límite de trazos |
| `pointer-input` | `false` | Dibujar con ratón / táctil |
| `readonly` | `false` | Impide dibujar |

Propiedades: `strokes` (copia), `strokeCount`, `isDrawing`.
Métodos: `beginStroke(p, {source})`, `addPoint(p)`, `endStroke()`, `cancelStroke()`, `undo()`, `clear({animated}): Promise<boolean>`, `loadStrokes()`, `toJSON()`.
Eventos: `drawing-started`, `drawing-ended` (`accepted` false si es demasiado corto), `strokes-changed`, `glyph-clearing` (**cancelable**), `glyph-cleared`.

### `<gc-rune-toggle>` y `<gc-rune-slider>`

Controles asociados a formularios: participan en `FormData`, se restablecen
con `form.reset()`. Toggle: `checked`, `name`, `value`, evento `change`
(`{ checked }`). Slider: `label`, `min`, `max`, `step`, `value`, `name`,
propiedad `formatter`, eventos `input` (nativo) y `change` (`{ value }`).

### `<gc-glyph>`

Glifo en SVG. Atributos: `glyph-id`, `size` (160), `mode` (`static`/`ghost`), `glow` (0.6), `ornate`, `numbered`.
Propiedades: `glyph`, `tracing`. Métodos: `playTrace({speed, loop}): Promise<boolean>`, `stop()`, `ignite({duration}): Promise`, `reset()`, `highlightStroke(i | null)`.
Eventos: `trace-start`, `trace-stroke` `{index}`, `trace-end` `{completed}`, `glyph-ignited`.
Custom properties: `--gc-glyph-ink`, `--gc-glyph-stroke`, `--gc-glyph-blur`.

### `<gc-arcane-meter>`

Indicador con rol ARIA `meter` (vía `ElementInternals`). Atributos: `value` (0), `max` (100), `variant` (`ring`/`seals`/`bar`), `label`, `threshold`.
Método `setValue(v, {animate})`. Evento `meter-complete`. Estados CSS `:state(passed)` / `:state(failed)`.

### `<gc-glyph-card>`

Entrada del grimorio que compone `<gc-glyph>` y `<gc-arcane-meter>`. Atributos: `glyph-id`, `progress`, `required` (3), `learned`, `mastered`, `selected`.
Método `select()`. Evento `glyph-select` `{glyphId}`.

### Guía y corrección en `<gc-glyph-canvas>`

Propiedad `guide` (trazos modelo), atributos `guide-style` (`ghost`/`faint`/`none`) y `guide-next`, y propiedad `feedback` (`'good' | 'fair' | 'poor' | null` por trazo).

### `<gc-spell-stage>` (`glyphcraft-kit/efectos`, requiere `three`)

Escenario WebGL transparente para los hechizos. Se coloca sobre el lienzo de dibujo con su mismo tamaño.

| Atributo | Por defecto | Descripción |
|---|---|---|
| `quality` (`low`/`medium`/`high`) | `medium` | Partículas y resolución |
| `overflow` (0-1) | `0.25` | Cuánto se extiende el lienzo fuera de la caja |

Propiedades: `ready`, `isCasting`, `stats` (`{ effects, particles }`). Estáticas: `GcEscenarioHechizo.spells`, `GcEscenarioHechizo.registerSpell`.
Métodos: `cast(spellId, { x, y, radius, strokes, intensity, stability }): Promise<boolean>`, `clear()`.
Eventos: `stage-ready`, `stage-error`, `spell-cast`, `spell-finished`.

```js
import { registerSpell, Efecto, particles } from 'glyphcraft-kit/efectos';
registerSpell('chispa', { label: 'Chispa', color: [1, 1, 0.6], accent: [1, 1, 1], create: (ctx) => { /* … */ } });
```

## Glifos y reconocimiento

```js
import { glyphLibrary, ReconocedorGlifos, placeGlyph } from 'glyphcraft-kit/nucleo';
import { STARTER_GLYPHS } from 'glyphcraft-kit/glifos';

glyphLibrary.add(...STARTER_GLYPHS);
const recognizer = new ReconocedorGlifos();
const result = recognizer.evaluate(canvas.strokes, glyphLibrary.get('ignis'), { level: 'artisan' });
// → { score, passed, summary, issues[], strokes[] (nota por trazo), transform }
const [best] = recognizer.classify(canvas.strokes, glyphLibrary.list());
```

- `createGlyph(def)`: valida una definición (primitivas `circle`, `line`, `polyline`, `wave`, `spiral`).
- `BibliotecaGlifos` / `glyphLibrary`: catálogo; los componentes buscan ahí su `glyph-id`.
- `RECOGNITION_LEVELS`: `apprentice` (60), `artisan` (75), `master` (85).
- `glyphcraft-kit/sinteticos`: `drawGlyphLike()` simula dibujos imperfectos para pruebas.

## Lógica y seguimiento de manos

```js
import { MotorGestos } from 'glyphcraft-kit/nucleo';
import { FuenteManoMediaPipe, FuenteManoGrabada, GrabadorSesion } from 'glyphcraft-kit/seguimiento';
import { createSyntheticHand, synthesizeSession } from 'glyphcraft-kit/sinteticos';
```

- `MotorGestos`: convierte fotogramas de manos en gestos (`pinch-start/move/end`, `erase-progress`, `erase`, `seal-progress`, `seal`, `pointer-move`, `gesture-changed`, `hands-changed`). Configurable con `configure()` (umbrales, tiempos, mano que escribe, suavizado).
- `FiltroUnEuro` / `FiltroPunto`: suavizado adaptativo.
- `FuenteManoMediaPipe`: cámara → MediaPipe (GPU con respaldo en CPU). Requiere `@mediapipe/tasks-vision`.
- `FuenteManoGrabada` / `GrabadorSesion`: reproducir y grabar sesiones.
- `glyphcraft-kit/sinteticos`: manos sintéticas para probar sin cámara.

## Controladores

Piezas de comportamiento que un componente **compone** en lugar de heredar:

- `ControladorBucle(callback)`: bucle `requestAnimationFrame` que se pausa con la pestaña oculta.
- `ControladorTamano(element, callback, { maxPixelRatio })`: tamaño observado con densidad limitada.
- `ControladorMovimientoReducido(callback)`: preferencia de movimiento reducido.
