# Tecnologías usadas en los ejercicios

Esta carpeta reúne demostraciones independientes de interfaces naturales:

- detección de cara y manos;
- seguimiento de la cabeza y gestos;
- avatares 2D;
- reconocimiento y síntesis de voz;
- realidad aumentada con escenas 3D.

Los ejercicios se ejecutan en el navegador y necesitan servirse mediante HTTP
para poder solicitar acceso a la cámara y cargar los módulos externos.

```bash
php -S localhost:8000
```

Después se puede abrir <http://localhost:8000/ejercicios/>.

## 1. HTML, CSS y JavaScript

Todos los ejercicios son páginas HTML independientes. La estructura contiene:

- un `<video>` para recibir la cámara;
- uno o varios `<canvas>` para dibujar la imagen y las detecciones;
- elementos de interfaz para mostrar estados, controles y navegación;
- un `<script type="module">` para cargar las bibliotecas y ejecutar la lógica.

El CSS común está en [css/ejercicios.css](./css/ejercicios.css). Este archivo
reutiliza la paleta, tipografía, botones, tarjetas, sombras y proporciones
visuales de la aplicación principal `v2`.

El índice general está en [index.html](./index.html), que enlaza cada ejercicio
de [cuerpo/](./cuerpo/) y [realidad-aumentada/](./realidad-aumentada/).

## 2. Arquitectura común y conexión entre tecnologías

Aunque cada ejercicio es un HTML independiente, la mayoría sigue la misma
cadena de procesamiento:

```text
webcam
  ↓
<video>
  ↓
MediaPipe detecta cara/manos
  ↓
coordenadas y confianza
  ↓
transformación a coordenadas de pantalla
  ↓
Canvas 2D, Three.js o A-Frame
  ↓
imagen final e interacción
```

El navegador es el punto de unión de todas las tecnologías. JavaScript coordina
la captura, los modelos de inteligencia artificial, el cálculo de gestos y la
representación visual. No se envían las imágenes de la cámara a un servidor:
los modelos de MediaPipe se ejecutan localmente en el navegador.

El ciclo de una aplicación suele ser:

1. Se carga el HTML y el CSS.
2. JavaScript solicita permiso para la cámara.
3. Se inicializa `FilesetResolver`, que carga los archivos WASM.
4. Se crea uno o varios detectores con `createFromOptions()`.
5. Se espera a que el vídeo tenga imágenes disponibles.
6. `requestAnimationFrame()` inicia el bucle.
7. Cada iteración copia el vídeo, ejecuta la detección y dibuja el resultado.

Por eso las tecnologías tienen responsabilidades diferentes:

| Tecnología | Responsabilidad |
|---|---|
| HTML | Estructura de la página, vídeo, canvas y controles |
| CSS | Presentación común y adaptación responsive |
| JavaScript | Orquestación, cálculos, eventos y bucle de animación |
| `getUserMedia()` | Entrada de vídeo y permisos |
| MediaPipe | Interpretación de la imagen |
| Canvas 2D | Dibujos directos sobre la imagen |
| Three.js | Objetos 3D transparentes sobre la imagen |
| A-Frame | Escenas 3D completas con cámara, luces y entidades |
| Web Speech API | Entrada y salida mediante voz |
| Ollama/PHP | Generación de respuestas de lenguaje natural |

## 3. Cámara del navegador

La cámara se obtiene con la API `MediaDevices` del navegador:

```js
const stream = await navigator.mediaDevices.getUserMedia({
  video: { width: 640, height: 480 }
});

video.srcObject = stream;
await video.play();
```

El navegador solicita permiso al usuario. Por seguridad, la cámara funciona en
`localhost` o mediante HTTPS.

Esta técnica aparece en todos los ejercicios que usan webcam, por ejemplo:

- [001-reconocimiento de cara.html](./cuerpo/001-reconocimiento%20de%20cara.html);
- [002-manos.html](./cuerpo/002-manos.html);
- [006-integrafo.html](./cuerpo/006-integrafo.html);
- [011-sombrero-de-copa.html](./cuerpo/011-sombrero-de-copa.html).

## 4. Canvas 2D

`CanvasRenderingContext2D` permite dibujar sobre cada fotograma:

```js
ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
ctx.beginPath();
ctx.arc(x, y, radio, 0, Math.PI * 2);
ctx.fill();
```

Se utiliza para:

- pintar la imagen de la cámara;
- dibujar rectángulos alrededor de caras;
- dibujar puntos y conexiones de las manos;
- dibujar avatares y overlays;
- mostrar texto, estados y coordenadas;
- mostrar la imagen de fondo y las detecciones que sirven como depuración.

Los ejercicios de cara, manos y avatares utilizan Canvas. En los ejercicios de
realidad aumentada se usa además un canvas pequeño como vista de depuración de
la cámara.

### Capas visuales

En un ejercicio de cámara se pueden apilar varias capas con CSS:

```text
<video>       imagen original de la cámara
<canvas>      cajas, puntos, manos y texto
<canvas>      opcionalmente, renderizado 3D de Three.js
```

El vídeo suele tener `opacity: 0` porque la imagen se copia al primer canvas.
Así se puede controlar exactamente el orden de dibujo. En el sombrero de copa,
el segundo canvas tiene fondo transparente y solo contiene el objeto 3D.

## 5. MediaPipe Tasks Vision

Los modelos de MediaPipe se cargan desde `@mediapipe/tasks-vision` y ejecutan
la inferencia en el navegador usando los archivos WASM:

```js
import {
  FaceDetector,
  FilesetResolver,
  HandLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
);
```

MediaPipe devuelve coordenadas normalizadas entre `0` y `1`. Para dibujarlas en
el canvas se multiplican por su anchura y altura:

```js
const x = punto.x * canvas.width;
const y = punto.y * canvas.height;
```

### Inicialización del modelo

Cada modelo se crea una sola vez, antes del bucle. Por ejemplo:

```js
const detector = await FaceDetector.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: "URL_DEL_MODELO"
  },
  runningMode: "VIDEO",
  minDetectionConfidence: 0.5
});
```

`runningMode: "VIDEO"` indica que se procesarán fotogramas sucesivos. Los
umbrales de confianza evitan reaccionar ante detecciones demasiado dudosas:
un valor mayor reduce falsos positivos, pero puede hacer que se pierdan
detecciones cuando la iluminación o la posición son malas.

### Coordenadas y sincronización

Los modelos trabajan con la imagen del elemento `<video>`, mientras que el
resultado se dibuja en el canvas. Por eso ambos deben conservar la misma
proporción. Si el vídeo y el canvas tienen tamaños distintos, hay que aplicar
factores de escala:

```js
const escalaX = canvas.width / video.videoWidth;
const escalaY = canvas.height / video.videoHeight;
const xCanvas = punto.x * video.videoWidth * escalaX;
const yCanvas = punto.y * video.videoHeight * escalaY;
```

En los ejemplos sencillos se fija la cámara a `640 × 480`, por lo que la
conversión puede hacerse multiplicando directamente por `canvas.width` y
`canvas.height`.

### 4.1 Face Detector

`FaceDetector` localiza caras y devuelve un `boundingBox` con:

- `originX` y `originY`: posición de la esquina superior izquierda;
- `width` y `height`: tamaño de la cara;
- `keypoints`: ojos, nariz, boca y otros puntos;
- `categories`: confianza de la detección.

`boundingBox` es una caja rectangular, no una malla. Es suficiente para saber
dónde está una cabeza y cuánto ocupa, pero no describe con precisión el
contorno de la cara. En los ejercicios se usa para:

```js
const caja = deteccion.boundingBox;
const centroX = caja.originX + caja.width / 2;
const centroY = caja.originY + caja.height / 2;
```

El centro permite colocar un objeto, y `width`/`height` permiten escalarlo
según la distancia de la persona a la cámara.

Se utiliza en:

- [001-reconocimiento de cara.html](./cuerpo/001-reconocimiento%20de%20cara.html):
  muestra la caja, el centro, diagonales y puntos clave;
- [004-spritesheet.html](./cuerpo/004-spritesheet.html): elige una imagen según
  la orientación de la cabeza;
- [005-con suavizado.html](./cuerpo/005-con%20suavizado.html): suaviza el
  movimiento del avatar;
- [006-integrafo.html](./cuerpo/006-integrafo.html);
- [007-avatar-chatbot-lipsync.html](./cuerpo/007-avatar-chatbot-lipsync.html);
- [008-avatar-minimal-ollama.html](./cuerpo/008-avatar-minimal-ollama.html);
- [009-avatar-minimal-corregido.html](./cuerpo/009-avatar-minimal-corregido.html);
- [011-sombrero-de-copa.html](./cuerpo/011-sombrero-de-copa.html).

También se combina con A-Frame en varios ejercicios de realidad aumentada para
calcular el desplazamiento de la cámara virtual.

### 4.2 Hand Landmarker

`HandLandmarker` devuelve hasta 21 landmarks por mano:

| Índices | Parte |
|---|---|
| `0` | muñeca |
| `4` | punta del pulgar |
| `8` | punta del índice |
| `12` | punta del dedo corazón |
| `16` | punta del anular |
| `20` | punta del meñique |

Con esos puntos se dibuja el esqueleto de la mano o se reconocen gestos.

MediaPipe no devuelve directamente gestos como «quitar sombrero». Devuelve
geometría. La aplicación convierte esa geometría en una regla de interacción:

```text
distancia(pulgar, índice) < umbral
        y
índice cerca de la cabeza
        ↓
        pinza válida
```

Esta separación es importante: MediaPipe detecta puntos, mientras que el
programa decide qué significa el movimiento para la interfaz.

Se utiliza en:

- [002-manos.html](./cuerpo/002-manos.html): dibuja articulaciones, conexiones
  y tipo de mano;
- [011-sombrero-de-copa.html](./cuerpo/011-sombrero-de-copa.html): detecta una
  pinza entre pulgar e índice;
- [003-denso.html](./realidad-aumentada/003-denso.html);
- [004-indice.html](./realidad-aumentada/004-indice.html);
- [005-gradual.html](./realidad-aumentada/005-gradual.html);
- [006-gradual.html](./realidad-aumentada/006-gradual.html);
- [007-ciudad.html](./realidad-aumentada/007-ciudad.html);
- [008-ciudad.html](./realidad-aumentada/008-ciudad.html).

### 4.3 Face Landmarker

`FaceLandmarker` proporciona una malla facial más detallada que `FaceDetector`.
Permite seguir muchos puntos de la cara y analizar cambios de expresión.

Se utiliza principalmente en:

- [010-avatar-face-landmarker.html](./cuerpo/010-avatar-face-landmarker.html).

Es apropiado para avatares y expresiones porque ofrece mucha más información
geométrica que una simple caja de detección.

### Combinar varios modelos

Un mismo fotograma puede analizarse con varios modelos. En el ejercicio del
sombrero se llama a los dos detectores con la misma marca temporal:

```js
const tiempo = performance.now();
const caras = caraDetector.detectForVideo(video, tiempo);
const manos = manosDetector.detectForVideo(video, tiempo);
```

De esta manera, la cara y la mano pertenecen aproximadamente al mismo
fotograma. Después se combinan sus resultados: la cara define la zona de
interacción y la mano genera la acción.

## 6. El ejercicio del sombrero de copa

[011-sombrero-de-copa.html](./cuerpo/011-sombrero-de-copa.html) combina dos
modelos:

1. `FaceDetector` obtiene la posición y tamaño de la cara.
2. `HandLandmarker` obtiene las coordenadas del pulgar y del índice.
3. Se calcula la distancia entre ambos dedos.
4. Se comprueba que la pinza esté cerca de la parte superior de la cabeza.
5. Si la pinza acaba de empezar, se invierte el estado `sombreroPuesto`.
6. Three.js coloca, escala y muestra u oculta el sombrero 3D.

La distancia se calcula con la fórmula euclídea:

```js
Math.hypot(a.x - b.x, a.y - b.y)
```

El bloqueo temporal de 900 milisegundos evita que una misma pinza active el
sombrero muchas veces mientras los dedos permanecen juntos.

## 7. Three.js y el sombrero 3D

El ejercicio del sombrero importa Three.js como módulo ES desde un CDN. Three.js
crea una escena transparente sobre el canvas de la cámara, una cámara
ortográfica y tres mallas:

- un cilindro alto para la copa;
- un cilindro plano y ancho para el ala;
- otro cilindro para la cinta amarilla.

La cámara ortográfica permite usar coordenadas de pantalla directamente. En cada
fotograma, la caja de la cara determina la posición y la escala del grupo 3D:

```js
sombrero3d.position.set(centroX, alto - baseY, 0);
sombrero3d.scale.set(escala, escala, escala);
```

Así el sombrero crece y se desplaza junto con la cabeza. El renderizador usa
fondo transparente para que el vídeo y las detecciones sigan viéndose debajo.
La visibilidad del grupo se cambia al hacer la pinza, por lo que el sombrero se
puede quitar y volver a poner todas las veces que se quiera.

### De coordenadas 2D a una escena 3D

La detección de cara produce coordenadas de imagen, mientras que Three.js
trabaja con coordenadas de escena. En este ejercicio se utiliza una cámara
ortográfica:

- el eje horizontal de Three.js representa los píxeles de la imagen;
- el eje vertical se invierte porque WebGL considera el origen inferior;
- la escala se calcula a partir de la anchura de la caja facial;
- el eje `z` se mantiene delante de la imagen transparente.

No se está reconstruyendo una cabeza en tres dimensiones. Es un objeto 3D
renderizado sobre una superficie 2D. Esto da volumen, sombras y perspectiva
local al sombrero, pero la posición global la proporciona Face Detector.

## 8. Reconocimiento de gestos como máquina de estados

Un gesto no debe activar una acción en todos los fotogramas en los que siga
presente. Por eso el sombrero utiliza dos variables:

- `pinzaActiva`: indica si la pinza estaba activa en el fotograma anterior;
- `ultimoGesto`: guarda el momento de la última activación.

La acción solo ocurre cuando la pinza pasa de falsa a verdadera y ha pasado el
tiempo de bloqueo:

```js
if (gesto && !pinzaActiva && tiempo - ultimoGesto > 900) {
  sombreroPuesto = !sombreroPuesto;
  ultimoGesto = tiempo;
}
pinzaActiva = gesto;
```

Este patrón es una pequeña máquina de estados:

```text
sin pinza → pinza detectada → cambiar sombrero → esperar
     ↑                                         ↓
     └──────────── soltar dedos ──────────────┘
```

Sin este control, una pinza mantenida durante un segundo produciría muchos
cambios por segundo y el usuario no podría controlar el resultado.

## 9. Bucle de animación

Los ejercicios procesan la cámara continuamente mediante
`requestAnimationFrame()`:

```js
function detectar() {
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const resultado = detector.detectForVideo(video, performance.now());
  // Dibujar resultados
  requestAnimationFrame(detectar);
}
```

Este patrón sincroniza el procesamiento con el refresco del navegador. En cada
iteración se dibuja el vídeo, se ejecutan los modelos y se pintan las
interacciones encima.

## 10. Sprites y avatares 2D

Los ejercicios de avatar utilizan spritesheets: una imagen contiene varios
fotogramas del personaje. `drawImage()` selecciona una región de la imagen:

```js
ctx.drawImage(
  spritesheet,
  origenX, origenY, anchoFuente, altoFuente,
  destinoX, destinoY, anchoDestino, altoDestino
);
```

La orientación de la cabeza puede decidir qué fotograma mostrar. El suavizado
evita cambios bruscos cuando la detección oscila entre dos posiciones.

Archivos relacionados:

- [004-spritesheet.html](./cuerpo/004-spritesheet.html);
- [005-con suavizado.html](./cuerpo/005-con%20suavizado.html);
- [spritesheet.png](./cuerpo/spritesheet.png);
- [spritesheetA.png](./cuerpo/spritesheetA.png).

## 11. Reconocimiento y síntesis de voz

Los avatares conversacionales utilizan las APIs Web Speech del navegador:

- `SpeechRecognition` o `webkitSpeechRecognition` convierte voz en texto;
- `SpeechSynthesisUtterance` convierte texto en voz;
- `speechSynthesis.speak()` reproduce la respuesta;
- `speechSynthesis.cancel()` detiene la lectura.

Se utilizan en:

- [006-integrafo.html](./cuerpo/006-integrafo.html);
- [007-avatar-chatbot-lipsync.html](./cuerpo/007-avatar-chatbot-lipsync.html);
- [008-avatar-minimal-ollama.html](./cuerpo/008-avatar-minimal-ollama.html);
- [009-avatar-minimal-corregido.html](./cuerpo/009-avatar-minimal-corregido.html).

El reconocimiento suele configurarse con `es-ES`. Estas APIs dependen del
navegador y normalmente funcionan mejor en Chrome o Edge.

### Flujo completo de una conversación

En un avatar conversacional, las tecnologías se conectan así:

```text
micrófono
  ↓
SpeechRecognition
  ↓
texto reconocido
  ↓
fetch() con JSON
  ↓
ollama.php
  ↓
Ollama + phi3:mini
  ↓
respuesta de texto
  ├─→ bocadillo o conversación en Canvas/HTML
  └─→ SpeechSynthesisUtterance
          ↓
       altavoz
```

La cámara sigue funcionando en paralelo. Mientras el modelo de lenguaje
genera la respuesta, Face Detector mantiene la posición del avatar y la
interfaz puede animar la boca durante `SpeechSynthesis`.

## 12. Ollama y PHP

Los avatares con conversación envían el texto a `ollama.php`, que actúa como
puente entre el navegador y un modelo local de Ollama:

```js
const respuesta = await fetch("../../ollama.php", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ mensaje: texto })
});
```

El PHP envía el prompt al endpoint local de Ollama
`http://localhost:11434/api/generate` y devuelve la respuesta como JSON.

Estos ejercicios reutilizan el archivo [../ollama.php](../ollama.php):

- [006-integrafo.html](./cuerpo/006-integrafo.html);
- [007-avatar-chatbot-lipsync.html](./cuerpo/007-avatar-chatbot-lipsync.html);
- [008-avatar-minimal-ollama.html](./cuerpo/008-avatar-minimal-ollama.html);
- [009-avatar-minimal-corregido.html](./cuerpo/009-avatar-minimal-corregido.html).

Es necesario tener Ollama ejecutándose y disponer del modelo configurado por la
aplicación, actualmente `phi3:mini`.

El navegador no llama directamente a Ollama porque el PHP centraliza la
petición y evita depender de una conexión directa desde el documento. El
servidor recibe un JSON con `mensaje`, crea la petición al endpoint local y
devuelve otro JSON con `respuesta`. Por tanto, hay tres procesos cooperando:

1. el navegador captura voz, cámara y eventos;
2. PHP valida y transporta el prompt;
3. Ollama ejecuta el modelo local y genera texto.

## 13. A-Frame y realidad aumentada

A-Frame es una biblioteca para crear escenas 3D mediante elementos HTML como:

```html
<a-scene>
  <a-box position="-2 0.6 -4" color="#d66"></a-box>
  <a-camera></a-camera>
</a-scene>
```

La escena se carga desde el CDN de A-Frame y se combina con MediaPipe:

- Face Detector mueve o inclina la cámara virtual según la cabeza;
- Hand Landmarker permite avanzar, girar o señalar;
- la escena contiene planos, cajas, esferas, cilindros, toros y luces;
- la perspectiva produce el efecto de realidad aumentada o ventana 3D.

Ejercicios:

- [001-aframe.html](./realidad-aumentada/001-aframe.html): seguimiento de
  cabeza;
- [002-denso.html](./realidad-aumentada/002-denso.html): escena con objetos a
  distintas profundidades;
- [003-denso.html](./realidad-aumentada/003-denso.html): cabeza y manos;
- [004-indice.html](./realidad-aumentada/004-indice.html): movimiento con el
  índice;
- [005-gradual.html](./realidad-aumentada/005-gradual.html) y
  [006-gradual.html](./realidad-aumentada/006-gradual.html): velocidad gradual;
- [007-ciudad.html](./realidad-aumentada/007-ciudad.html) y
  [008-ciudad.html](./realidad-aumentada/008-ciudad.html): ciudad generada por
  código y control por gestos.

### Flujo de control de realidad aumentada

En estos ejercicios MediaPipe no dibuja directamente la escena. El flujo es:

```text
cara/mano detectada
  ↓
landmarks y bounding boxes
  ↓
cálculo de desplazamiento, giro o velocidad
  ↓
posición/rotación de <a-camera> o cameraRig
  ↓
A-Frame vuelve a renderizar la escena
```

Por ejemplo, una mano puede producir una velocidad de avance y un dedo índice
puede producir un giro. La variable calculada se aplica a una entidad A-Frame
en lugar de dibujarse como un punto del canvas. El canvas de depuración muestra
la cámara y los landmarks, pero la escena 3D es responsabilidad de A-Frame.

## 14. Rendimiento, permisos y errores

### Rendimiento

La detección de cara y manos es costosa. Para mantener una respuesta fluida:

- los modelos se cargan una sola vez;
- se reutiliza el mismo canvas en lugar de crear uno por fotograma;
- se usa `requestAnimationFrame()`;
- se limita el vídeo a `640 × 480` en los ejemplos;
- se evita dibujar texto o geometría innecesaria;
- se configura `numHands` según el ejercicio.

Si se necesita más rendimiento, se puede procesar un fotograma cada dos
iteraciones o reducir la resolución de la cámara. Si se necesita más precisión,
se puede aumentar el tamaño del vídeo o los umbrales, con un coste mayor de CPU
o GPU.

### Permisos y contexto seguro

`getUserMedia()` requiere permiso y un contexto seguro. `localhost` se considera
válido durante el desarrollo. Abrir el HTML con doble clic mediante `file://`
puede impedir la cámara, los módulos o las peticiones `fetch()`.

Además, los modelos y bibliotecas se cargan desde CDN. Sin conexión inicial no
se pueden descargar, aunque después el navegador pueda conservar algunos
recursos en caché.

### Separar detección, lógica y presentación

Los ejercicios son más fáciles de ampliar cuando se separan tres capas:

1. **Detección**: obtiene `detections` o `landmarks`.
2. **Lógica**: convierte las coordenadas en estados como `sombreroPuesto`,
   `velocidad` o `fotograma`.
3. **Presentación**: dibuja en Canvas, renderiza con Three.js o actualiza
   entidades A-Frame.

Por ejemplo, en el sombrero:

```text
Face Detector → caja facial → posición y escala del sombrero
Hand Landmarker → distancia pulgar/índice → gesto de alternancia
Three.js → renderizado del objeto 3D
```

Esta separación permite cambiar el sombrero por unas gafas sin modificar la
detección de manos, o cambiar la pinza por otro gesto sin rehacer el modelo 3D.

## 15. Resumen por archivo

| Archivo | Tecnologías principales |
|---|---|
| `001-reconocimiento de cara.html` | Cámara, Canvas, Face Detector |
| `002-manos.html` | Cámara, Canvas, Hand Landmarker |
| `003-malla de la cara.html` | Cámara, Canvas, malla facial |
| `004-spritesheet.html` | Face Detector, Canvas, spritesheet |
| `005-con suavizado.html` | Face Detector, Canvas, interpolación |
| `006-integrafo.html` | Face Detector, Canvas, voz, Ollama |
| `006-raton.html` | Eventos de ratón, coordenadas, Canvas/CSS |
| `007-avatar-chatbot-lipsync.html` | Face Detector, avatar, voz, Ollama |
| `008-avatar-minimal-ollama.html` | Face Detector, sprites, voz, Ollama |
| `009-avatar-minimal-corregido.html` | Face Detector, sprites, voz, Ollama |
| `010-avatar-face-landmarker.html` | Face Landmarker, avatar, Canvas |
| `011-sombrero-de-copa.html` | Face Detector, Hand Landmarker, Three.js, gesto de pinza |
| `001-aframe.html` | A-Frame, Face Detector, escena 3D |
| `002-denso.html` | A-Frame, Face Detector, profundidad |
| `003-denso.html` | A-Frame, Face Detector, Hand Landmarker |
| `004-indice.html` | A-Frame, Face Detector, Hand Landmarker |
| `005-gradual.html` | A-Frame, Face Detector, Hand Landmarker |
| `006-gradual.html` | A-Frame, Face Detector, Hand Landmarker |
| `007-ciudad.html` | A-Frame, Face Detector, Hand Landmarker |
| `008-ciudad.html` | A-Frame, Face Detector, Hand Landmarker |
