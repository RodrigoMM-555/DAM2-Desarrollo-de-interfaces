# tumbao-componentes

Web Components nativos de **Tumbao** (sin dependencias ni compilación):

| Etiqueta | Qué es |
|---|---|
| `<tb-pista>` | Pista de ritmo de 4 carriles en Canvas: notas con forma de mano, línea de juicio, manos del jugador, destellos |
| `<tb-camara>` | Imagen de la cámara en espejo con la zona de juego, las manos y su esqueleto virtual (realidad aumentada) |
| `<tb-cursor-mano>` | Cursor que sigue a la mano y pulsa el botón sobre el que se queda quieta (permanencia) |

Versión 1.0.0 · Licencia MIT · Rodrigo Menéndez Molina

## Instalación y uso

Copia la carpeta (o publícala como paquete) e impórtala como módulo:

```html
<script type="module">
  import 'tumbao-componentes';            // con import map, o:
  import './componentes/index.js';        // ruta directa
</script>

<tb-pista antelacion="2.5"></tb-pista>
<tb-camara esqueleto></tb-camara>
<tb-cursor-mano duracion="1.2"></tb-cursor-mano>
```

Demostración interactiva de los tres: [`demo.html`](demo.html).
Manifiesto estándar con la API: [`custom-elements.json`](custom-elements.json)
(lo leen los editores como VS Code para autocompletar).

## `<tb-pista>`

Componente "tonto": no lleva el tiempo ni juzga nada; quien lo usa le da las
notas y le pide que se dibuje en cada fotograma.

| Atributo / propiedad | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `antelacion` | número (s) | `2` | Segundos que tarda una nota en bajar hasta la línea |
| `transparente` | booleano | `false` | Carriles sin relleno, solo bordes (para ir sobre la cámara) |
| `notas` (propiedad) | `Nota[]` | `[]` | `{ id, tiempo, mano: 'i'\|'d', carril: 0–3, duracion }` |
| `pulso` (propiedad) | número (s) | `0` | Duración de un pulso; `0` = sin líneas de pulso |
| `geometria` (propiedad) | objeto o `null` | `null` | `{ x0, ancho, yLinea }` en px para alinear la pista con otra cosa; `null` = centrada |

| Método | Descripción |
|---|---|
| `dibujar(t, manos, puntos?)` | Pinta el instante `t`. `manos = { i, d }` (carril o `null`); `puntos` = posición real `{ u: 0–1, dentro }` de cada mano |
| `marcar(juicio)` | Muestra la calificación de una nota (destello, texto; las notas de mantener muestran su cola) |
| `reiniciar()` | Olvida notas acertadas y efectos |

| Evento | `detail` | Cuándo |
|---|---|---|
| `marcada` | `{ juicio }` | Al mostrar una calificación |

Variables CSS: `--color-izquierda`, `--color-derecha`, `--color-texto`, `--color-fondo`.
Respeta `prefers-reduced-motion` y la clase `reducir-movimiento` en `<html>`.

## `<tb-camara>`

| Atributo / propiedad | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `esqueleto` | booleano | `false` | Dibuja los 21 puntos de cada mano unidos (guante virtual del color de la mano) |
| `sin-rejilla` / `sinRejilla` | booleano | `false` | No dibuja la zona de juego ni los carriles |
| `video` (propiedad, lectura) | `HTMLVideoElement` | — | El `<video>` interno, para conectarle la cámara |

| Método | Descripción |
|---|---|
| `dibujar(detalle, zona)` | Pinta un fotograma: `detalle` = `{ posiciones, carriles, esqueletos }`, `zona` = `{ izquierda, derecha, arriba, abajo }` (0–1) |

| Evento | `detail` | Cuándo |
|---|---|---|
| `lista` | `{ ancho, alto }` | La cámara ya da imagen; la caja toma su proporción real |

Variables CSS: `--color-izquierda`, `--color-derecha`.

## `<tb-cursor-mano>`

| Atributo / propiedad | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `duracion` | número (s) | `1` | Tiempo que hay que dejar la mano quieta sobre un botón |
| `raiz` (propiedad) | `Element` o `null` | `null` | Solo se pulsan botones y enlaces dentro de este elemento |

| Método | Descripción |
|---|---|
| `mover(punto \| null)` | Posición de la mano en píxeles de la ventana; `null` oculta el cursor |

| Evento | `detail` | Cuándo |
|---|---|---|
| `pulsado` | `{ elemento }` | Justo antes de hacer clic en el botón |

El elemento apuntado recibe la clase `apuntado-mano`. No captura el ratón
(`pointer-events: none`). Variables CSS: `--color-derecha`, `--color-acento`.

## Lógica incluida: `permanencia.js`

- `new Permanencia(duracion)` · `actualizar(objetivo, t)` → `{ objetivo, progreso, activado }`.
- `aPantalla(punto, ancho, alto)`: posición de la mano (0–1) → píxeles, usando la parte central de la imagen.

## Pruebas

`tb-componentes.prueba.js` y `permanencia.prueba.js`, ejecutados por
`pruebas.html` del proyecto.
