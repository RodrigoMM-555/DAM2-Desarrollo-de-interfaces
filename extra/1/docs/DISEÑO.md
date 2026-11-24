# Tumbao — juego de ritmo con las manos e interfaces naturales

> Documento de diseño · versión 3 (decisiones de la fase 1 cerradas)
> Proyecto extra · Desarrollo de Interfaces, 2.º DAM
> Autor: Rodrigo Menéndez Molina
> Nombre provisional: **Tumbao** (el patrón rítmico básico de la percusión cubana).

---

## 1. Idea en un párrafo

Por cuatro carriles bajan **manos**: la **izquierda** de un color y la **derecha** de otro. El
jugador, delante de la cámara, tiene que **colocar esa mano en ese carril**
antes de que la nota llegue al final. Cuando llega y la mano está en su sitio,
suena una nota musical y se suman puntos. No hay mando, ni teclas, ni hay que golpear
nada: el cuerpo es el mando. El juego reconoce con la cámara **dónde está cada
mano** y **cuál es cuál**.

### Cambio respecto a la versión 1

La primera idea era golpear bongos y medir el golpe con micrófono y cámara a la
vez. Esta versión es mejor por cuatro motivos:

| | v1 · Golpear | v2 · Colocar la mano |
|---|---|---|
| Precisión de tiempo necesaria | ±45 ms (la cámara no llega) | Basta con estar en el carril a tiempo: 30 fps sobran |
| Sensores | Cámara + micrófono + fusión | Solo cámara |
| Material | Bongos o superficies que suenen distinto | Nada: basta un portátil |
| Ruido y música por altavoces | Gran riesgo de golpes falsos | No afecta |
| Interfaz natural | Detectar un impacto | Posición del cuerpo **y** distinguir mano izquierda/derecha |

Se elimina todo lo del micrófono (AudioWorklet, huella sonora, k-vecinos,
fusión). La complejidad se va ahora a algo más interesante: **saber qué mano es
cuál y dónde está, de forma estable**.

## 2. ¿Es viable? Sí

Es la misma tecnología de GlyphCraft (MediaPipe HandLandmarker), pero con una
tarea más sencilla: no hace falta reconocer trazos, solo decidir en qué zona
está cada mano. La latencia de la cámara (60–100 ms) ya no es un problema
porque no se mide el instante de un golpe, sino si la mano **está** en el
carril cuando llega la nota; además se compensa con la calibración (§5.6).

Lo delicado es **diferenciar izquierda y derecha** (§5.3): MediaPipe lo da,
pero a veces se equivoca o intercambia las manos durante un fotograma. Se
resuelve con seguimiento y memoria, no fiándose de un solo fotograma.

## 3. Cómo se juega

1. **Menú** → elegir canción y dificultad.
2. **Calibración** (la primera vez o desde Ajustes):
   - El jugador se coloca y el juego dibuja los cuatro carriles sobre su
     imagen. Puede ajustar el ancho y la altura de la zona de juego.
   - "Levanta la mano izquierda" / "la derecha": comprueba que las reconoce y
     que no están cambiadas (cámara en espejo o no).
3. **Partida**: por los carriles bajan notas con forma de mano:
   - **Mano izquierda** (color A, icono de mano izquierda, letra **I**).
   - **Mano derecha** (color B, icono de mano derecha, letra **D**).
   - Al llegar a la línea, si la mano correcta está en ese carril → suena
     una nota musical y se cuenta el acierto.
4. **Resultados**: puntuación, precisión, combo máximo, recuento de
   calificaciones, nota final (S–D) y récord.

### Tipos de nota

| Tipo | Qué hay que hacer | Dificultad |
|---|---|---|
| **Simple** | Una mano en un carril | Desde fácil |
| **Doble** | Las dos manos a la vez, cada una en su carril | Normal |
| **Mantener** | Nota larga: dejar la mano en el carril mientras pasa | Normal |
| **Cruce** | La izquierda en un carril a la derecha de la derecha (brazos cruzados) | Difícil |
| **Gesto** (extra) | Además de la posición, la mano abierta o en puño | Difícil |

### Controles alternativos (accesibilidad y pruebas)

| Entrada | Carril 1 | Carril 2 | Carril 3 | Carril 4 |
|---|---|---|---|---|
| Teclado, mano izquierda | <kbd>A</kbd> | <kbd>S</kbd> | <kbd>D</kbd> | <kbd>F</kbd> |
| Teclado, mano derecha | <kbd>J</kbd> | <kbd>K</kbd> | <kbd>L</kbd> | <kbd>Ñ</kbd> |
| Ratón / táctil | Arrastrar las dos fichas de mano a un carril | | | |

Con el teclado, mantener pulsada la tecla equivale a "tener la mano en ese
carril". <kbd>Esc</kbd> pausa. La partida se pausa sola si la pestaña pierde
el foco o la cámara no ve ninguna mano durante más de 3 s.

## 4. Pantallas

| Vista | Contenido |
|---|---|
| **Menú** | Título animado al ritmo, Jugar, Calibrar, Ajustes, Récords. Se puede navegar con la mano (mantener la mano sobre un botón 1 s) |
| **Selección de canción** | Lista con BPM, duración, dificultad y récord; previsualización |
| **Calibración** | Imagen de la cámara con los carriles superpuestos, prueba de mano izquierda/derecha |
| **Partida** | Pista de 4 carriles con las notas y la línea de juicio; abajo, dónde están tus manos; al lado (o al lado) la imagen de la cámara en espejo con los carriles y las manos dibujadas; arriba marcador y combo |
| **Resultados** | Resumen, nota, botón Repetir / Menú |
| **Ajustes** | Cámara, espejo, tamaño de la zona de juego, colores de las manos, velocidad de las notas, desfase, volumen, movimiento reducido |
| **Editor de partituras** (extra) | Suena la canción y se graban las notas poniendo las manos; se exporta a JSON |

**Navegar el menú con la mano** encaja muy bien ahora: si el jugador ya está
delante de la cámara con las manos levantadas, no tiene que volver al ratón.
Era la idea que quedó pendiente en GlyphCraft.

## 5. Funcionamiento detallado

### 5.1 Reloj maestro

Todo se sincroniza con **`AudioContext.currentTime`**, el reloj del hardware de
audio, para que las notas no se desfasen respecto a la música.

```text
tiempoCancion = audioCtx.currentTime − inicioCancion − desfaseCalibrado
```

Cada fotograma (`requestAnimationFrame`) la pista calcula la posición de las
notas a partir de `tiempoCancion`, no del tiempo entre fotogramas: si uno llega
tarde, las notas no se desincronizan.

### 5.2 De la cámara a "qué mano hay en qué carril"

```text
webcam → <video> → HandLandmarker (2 manos, modo VIDEO, ~30 fps)
       → por cada mano: centro de la palma + etiqueta izquierda/derecha
       → seguidor de manos (identidad estable, §5.3)
       → filtro One Euro (suaviza sin retrasar)
       → zona de juego: x de la palma → carril 1–4 (con histéresis)
       → estado: { izquierda: carril | null, derecha: carril | null }
```

- **Centro de la palma:** media de la muñeca y las bases del índice y del
  meñique. Es más estable que la punta de un dedo.
- **Imagen en espejo:** se muestra al jugador como un espejo (si mueve la mano
  hacia su derecha, la ve ir a la derecha). La coordenada x se invierte para
  que el carril 1 esté a la izquierda del jugador.
- **Zona de juego:** un rectángulo de la imagen (por defecto el 80 % central
  del ancho, a la altura del pecho) dividido en 4 columnas iguales. Es
  configurable en la calibración: así funciona tanto de pie lejos como sentado
  delante del portátil.
- **Histéresis:** para cambiar de carril, la palma tiene que entrar un 10 %
  dentro del nuevo carril. Así la mano no "parpadea" entre dos carriles al
  estar justo en la frontera.
- **Altura:** si la mano está por debajo de la zona (bajada, en reposo), no
  cuenta en ningún carril. Esto permite "quitar" la mano.

### 5.3 Distinguir mano izquierda y derecha

MediaPipe devuelve para cada mano una etiqueta (`Left` / `Right`) con una
confianza. Problemas conocidos:

- La etiqueta supone que la imagen está en espejo; según cómo se pase el
  vídeo, sale al revés.
- Con una sola mano visible o con los brazos cruzados, a veces se equivoca.
- Entre fotogramas, el orden de las manos en el resultado puede cambiar.

Solución, en el `SeguidorManos` (lógica pura, probada con datos sintéticos):

1. **Emparejar por posición:** cada mano detectada se asocia con la mano
   seguida más cercana del fotograma anterior (como hicimos en GlyphCraft para
   el pellizco). La identidad no salta aunque cambie el orden.
2. **Voto acumulado:** la identidad izquierda/derecha de cada mano seguida es
   un promedio de las etiquetas de MediaPipe en los últimos ~10 fotogramas,
   ponderado por su confianza. Un fotograma equivocado no la cambia.
3. **Corrección de espejo:** la calibración ("levanta la izquierda") detecta si
   las etiquetas vienen invertidas y lo guarda.
4. **Desempate:** si las dos manos acaban con la misma etiqueta, se corrige con
   la que tenga más votos; y si no se cruzaron, la que está a la izquierda del
   jugador es la izquierda.
5. **Mano perdida:** si una mano desaparece menos de 200 ms, se conserva su
   última posición (desenfoque por movimiento rápido).

### 5.4 Juez: ¿estaba la mano a tiempo?

Cada nota tiene un instante *t* en el que llega a la línea de juicio.

- **Ventana de comprobación:** [*t* − 120 ms, *t* + 80 ms]. Si en algún
  momento de la ventana la mano correcta está en el carril correcto durante al
  menos 2 fotogramas seguidos → **acierto**. Si no → **fallo**.
- **Calificación según cuándo llegó** (la mano tiene que llegar **antes** del
  final y se premia moverse al ritmo):

| Calificación | Condición | Puntos |
|---|---|---|
| **Perfecto** | La mano entró en el carril durante el último pulso antes de la nota | 300 |
| **Bien** | La mano ya estaba antes (llegó pronto) | 200 |
| **Justo** | Llegó dentro de la ventana, en el último momento | 100 |
| **Fallo** | No estaba, o estaba la otra mano | 0, rompe el combo |

  Así no compensa dejar las manos quietas en un carril: hay que moverse al
  compás de la música. **Excepción:** si la mano acertó la nota anterior en
  ese mismo carril y no se ha movido, es *Perfecto* (quedarse es lo correcto).
- **Mantener:** puntos proporcionales al tiempo que la mano estuvo dentro
  mientras pasaba la nota.
- **Doble:** cuenta como dos notas; cada mano se juzga por separado.
- **Combo:** multiplica la puntuación (×2 a 10 aciertos, ×3 a 25, ×4 a 50).
- **Precisión** = puntos obtenidos / puntos máximos. Nota: S ≥ 95 %,
  A ≥ 90 %, B ≥ 80 %, C ≥ 70 %, D el resto.
- **No hay penalización** por tener una mano en un carril sin nota: no
  castiga el movimiento natural entre notas.

### 5.5 Canciones y partituras

Cada canción es una carpeta con su audio y su partitura en JSON:

```json
{
  "titulo": "Primer tumbao",
  "autor": "Tumbao (generada)",
  "audio": "audio.ogg",
  "bpm": 96,
  "desfase": 0.12,
  "dificultades": {
    "facil": [
      { "pulso": 4,  "mano": "i", "carril": 0 },
      { "pulso": 6,  "mano": "d", "carril": 3 },
      { "pulso": 8,  "mano": "i", "carril": 1, "duracion": 2 },
      { "pulso": 12, "mano": "i", "carril": 0 },
      { "pulso": 12, "mano": "d", "carril": 2 }
    ]
  }
}
```

- Notas en **pulsos**, no en segundos: `segundos = desfase + pulso × 60 / bpm`.
  Es como se piensa la música y permite cambiar el tempo sin rehacer nada.
- `mano`: `"i"` izquierda, `"d"` derecha. Dos notas en el mismo pulso = doble.
  `duracion` = mantener. Si la izquierda va a la derecha de la derecha = cruce.
- **Validación:** el cargador comprueba que la partitura sea jugable (por
  ejemplo, que una mano no tenga que estar en dos carriles a la vez y que haya
  tiempo físico para moverla entre dos carriles lejanos).
- **Música sin problemas de derechos:** generada por el propio juego con un
  secuenciador de Web Audio (congas, bombo, clave, maracas, bajo y acordes sintetizados) o pistas CC0.

### 5.6 Calibración de latencia

La imagen de la cámara llega con ~60–100 ms de retraso. En la calibración, el
jugador mueve una mano de un carril a otro siguiendo un metrónomo; el juego
mide el retraso medio y lo usa para desplazar la ventana de comprobación. Se
puede ajustar a mano en Ajustes.

### 5.7 Pista visual y retroalimentación

- **Canvas 2D** a 60 fps, escalado con `devicePixelRatio`.
- Posición de una nota: `y = yLinea − (tNota − tCancion) × velocidad`.
- Las manos **no se distinguen solo por el color** (WCAG 1.4.1): cada nota
  lleva el icono de mano izquierda o derecha y la letra I/D. Colores elegidos
  para que se distingan también con daltonismo (por ejemplo, azul y naranja) y
  configurables.
- Al pie de cada carril se ve **dónde están ahora tus manos** (silueta del
  color de cada mano): el jugador sabe en todo momento en qué carril el juego
  cree que está.
- Al acertar: suena la nota del carril, un anillo se expande y aparece la calificación. Con
  `prefers-reduced-motion` se quitan sacudidas y partículas.

### 5.8 Persistencia

`localStorage` con un objeto versionado: récords por canción y dificultad,
calibración (zona de juego, espejo, latencia) y ajustes. Exportar e importar
copia en JSON, como en GlyphCraft.

## 6. Tecnologías y justificación

| Tecnología | Para qué | Por qué esta y no otra |
|---|---|---|
| **HTML5, CSS3, JavaScript (módulos ES)** | Toda la app | Lo que usa el curso y mis proyectos; sin compilación |
| **JSDoc + `// @ts-check`** | Tipos y documentación | Ayuda del editor sin TypeScript, como GlyphCraft |
| **Web Components** (prefijo `tb-`) | Pista, vista de cámara, botón de mano | Conecta con la UD03; cada pieza se prueba y reutiliza sola |
| **Import maps** | Importar `mediapipe` por nombre | Sin npm ni empaquetador |
| **MediaPipe Tasks Vision · HandLandmarker** | Posición de las manos y si son izquierda o derecha | Visto en clase (UD02) y en GlyphCraft; da las dos cosas en un solo modelo y funciona en local, sin enviar la imagen a ningún servidor. Se copia en `lib/` desde GlyphCraft |
| **`getUserMedia`** | Cámara | API estándar; exige `localhost` o `https` |
| **Web Audio API** | Reloj maestro, música, sonido de acierto | Único reloj preciso del navegador y permite programar sonidos al milisegundo; `<audio>` no da esa precisión |
| **Filtro One Euro** | Suavizar la posición | Suaviza cuando la mano está quieta y casi no retrasa cuando se mueve rápido |
| **Canvas 2D** | Pista de notas y superposición sobre la cámara | Suficiente para cientos de notas a 60 fps; Three.js sería excesivo y quitaría CPU/GPU a MediaPipe |
| **`localStorage`** | Récords, ajustes, calibración | Datos pequeños; sin servidor |
| **Ejecutor de pruebas propio** (`pruebas.html`) | Pruebas | El de GlyphCraft, API tipo Vitest, sin instalar nada |

**Descartado:** micrófono (ya no hace falta), PoseLandmarker de cuerpo entero
(más pesado y con peor precisión en las manos; solo aportaría si se jugara a
varios metros), frameworks, npm/Vite, TypeScript, Three.js, PHP y servicios en
la nube.

## 7. Estructura de carpetas

Como GlyphCraft: la aplicación por un lado y la lógica pura (sin DOM) por
otro, para probarla con datos simulados y sin cámara.

```
extra/1/
├── index.html                  La aplicación
├── pruebas.html                Ejecuta todas las pruebas en el navegador
├── codigo.js                   Punto de entrada: registra vistas y arranca
├── estilo.css                  Estilos y variables de la app
├── favicon.svg
├── README.md                   Puesta en marcha y cómo se juega
├── docs/DISEÑO.md              Este documento
├── nucleo/
│   ├── aplicacion.js           Mediador: servicios compartidos y cambio de vista
│   └── enrutador.js            Navegación por hash (#/partida/…)
├── motor/                      Lógica pura del juego (sin DOM)
│   ├── partitura.js            Valida, comprueba que sea jugable, pulsos → segundos
│   ├── juez.js                 ¿Estaba la mano correcta a tiempo? (y notas de mantener)
│   ├── grabador.js             Editor: movimientos → notas cuantizadas
│   ├── puntuacion.js           Puntos, combo, precisión, nota final
│   └── partida.js              Une partitura + juez + puntuación con un reloj
├── entrada/
│   ├── teclado.js              A S D F / J K L Ñ → estado de las manos
│   ├── camara.js               MediaPipe → seguidor → filtro → zona → cambiomanos
│   ├── seguidor-manos.js       Identidad estable izquierda/derecha
│   ├── zona-juego.js           Posición → carril, histéresis
│   ├── filtro-un-euro.js       Suavizado sin retraso (de GlyphCraft)
│   ├── calibracion.js          ¿Intercambiar manos? Retraso con metrónomo
│   └── permanencia.js          Pulsar dejando la mano quieta encima
├── audio/
│   ├── motor-audio.js          Reloj maestro, reproducción, sonido de acierto
│   ├── secuenciador.js         Partitura musical → eventos → AudioBuffer
│   └── instrumentos.js         Bombo, conga, clave, maracas, bajo… sintetizados
├── servicios/
│   ├── records.js              Récords en localStorage
│   └── ajustes.js              Cámara, espejo, zona, latencia
├── componentes/
│   ├── tb-pista.js             Canvas con carriles, notas y manos
│   ├── tb-camara.js            Imagen en espejo con carriles y manos
│   └── tb-cursor-mano.js       Cursor que sigue a la mano y pulsa por permanencia
├── vistas/
│   ├── vista.js                Clase base (montar / limpiar)
│   ├── vista-menu.js  vista-canciones.js  vista-partida.js  vista-resultados.js
│   ├── vista-ajustes.js        Sonido, velocidad, movimiento, cámara, récords
│   ├── vista-editor.js         Crear partituras grabándolas con las manos
│   └── vista-calibracion.js    Zona de juego + comprobación izquierda/derecha
├── canciones/
│   ├── lista.json
│   ├── primer-tumbao.json      Música generada + partituras fácil, normal y difícil
│   ├── noche-de-clave.json
│   └── brisa-de-malecon.json
├── pruebas/                    ejecutor.js y pagina.js (de GlyphCraft), lista.js
└── lib/mediapipe/              Copiado de GlyphCraft
```

Cada archivo de lógica tiene al lado su `*.prueba.js`.

Nombres: todo en español (archivos, clases, métodos, variables y eventos:
`Juez`, `actualizar()`, `cambiomanos`, `juzgada`). Las etiquetas de los
componentes llevan el prefijo `tb-` (`<tb-pista>`).

### Comunicación entre piezas

```text
EntradaCamara ─► SeguidorManos ─► ZonaJuego ─┐
EntradaTeclado ──────────────────────────────┼─► evento "cambiomanos" { i, d }
EntradaPuntero ──────────────────────────────┘                │
                                                              ▼
MotorAudio (reloj) ─► Partida.fotograma() ─► Juez ─► Puntuacion
                                               │
                         evento "juzgada" ─────┴─► marcador, tb-pista, sonido de acierto
```

Todas las entradas emiten el mismo evento `cambiomanos` con el estado de las
dos manos. El juez no sabe si viene de la cámara o del teclado: se puede jugar
con cualquiera y probar el juez con estados inventados.

## 8. Pruebas

| Qué | Cómo |
|---|---|
| Juez y puntuación | Partituras y secuencias de estados de manos inventadas con tiempos exactos |
| Partitura | JSON válidos, inválidos e injugables; conversión pulsos → segundos |
| Seguidor de manos | Manos sintéticas (como `mano-sintetica.js`) con etiquetas erróneas, intercambio de orden, pérdidas de fotogramas y brazos cruzados |
| Zona de juego | Posiciones en las fronteras, histéresis, mano por debajo de la zona |
| Componentes | Montaje, atributos y eventos (como en la UD03) |
| Sesiones grabadas | Grabar partidas reales (tecla R) y reproducirlas sin cámara |
| Manual | `docs/PLAN-PRUEBAS.md`: distintas personas, luz, ropa de manga larga/corta, sentado/de pie, fps y CPU en el portátil de clase |

## 9. Riesgos y cómo se mitigan

| Riesgo | Mitigación |
|---|---|
| MediaPipe confunde izquierda y derecha | Seguidor con emparejamiento por posición + voto acumulado + calibración de espejo (§5.3) |
| Con brazos cruzados se pierde una mano | Notas de cruce solo en dificultad difícil; conservar la última posición 200 ms |
| La mano parpadea entre dos carriles | Histéresis y suavizado |
| Se cansan los brazos | Canciones de 1–2 min; zona de juego a la altura del pecho, ajustable; se puede jugar sentado |
| Poca luz o fondo confuso | Aviso en la calibración si la confianza de detección es baja |
| MediaPipe consume mucha CPU | Canvas 2D ligero; cámara a 640×480 |
| Latencia distinta en cada ordenador | Calibración con metrónomo + desfase manual |

## 10. Plan por fases

| Fase | Contenido | Se puede probar con |
|---|---|---|
| 1 | Análisis y diseño (este documento) | — |
| 2 | Estructura, enrutador, menú, estilos, `pruebas.html` | Navegador |
| 3 | Motor: reloj, partitura, juez, puntuación, pista Canvas, **teclado** | Teclado: ya es un juego completo |
| 4 | **Cámara**: seguidor de manos, zona de juego, `tb-camara`, calibración | Manos reales y sesiones grabadas |
| 5 | Notas dobles, mantener y cruce; calibración de latencia; navegación del menú con la mano | Juego completo |
| 6 | Canciones (secuenciador), resultados, récords, ajustes | — |
| 7 | Extras: editor de partituras y notas de gesto (abierta/puño) | — |
| 8 | Accesibilidad, pruebas, README, plan de pruebas y relación con los criterios de evaluación | Lighthouse / axe |

La fase 3 deja un juego jugable con teclado antes de tocar la cámara: si algo
falla después, siempre hay algo que entregar.

## 11. Relación con la asignatura

| Unidad | Qué se aplica |
|---|---|
| UD01 Generación de interfaces | Eventos (teclado, puntero, eventos propios), clases, separación lógica/vista |
| UD02 Interfaces naturales | Partes y movimientos del cuerpo (posición y lateralidad de las manos), aprendizaje automático (MediaPipe), interfaz sin contacto para jugar y navegar |
| UD03 Componentes visuales | Web Components `tb-` con atributos, eventos y pruebas |
| UD04 Diseño de interfaces | Retroalimentación inmediata, calibración guiada, accesibilidad (teclado, icono + color, movimiento reducido, contraste AA) |
| UD06 Documentación | README, este documento, ayuda dentro del juego |
| UD08 Pruebas | Pruebas unitarias con datos sintéticos, sesiones grabadas, pruebas de rendimiento |

## 12. Decisiones tomadas (24/11/2026)

| Pregunta | Decisión |
|---|---|
| Postura | **Sentado** delante del portátil: zona de juego a la altura del pecho |
| Regla de calificación | La de §5.4 (con la excepción de quedarse en el mismo carril) |
| Plazo | Pocos días: se prioriza un juego completo con cámara; el editor y las notas de gesto son opcionales |
| Estética | **Propia del juego** (noche cálida, azul = izquierda, naranja = derecha) |
| Música | Las dos opciones: generada por el secuenciador y pistas CC0 (campo `audio`) |
| Bongos | **Fuera**: no hay bongos dibujados; al acertar suena una nota de marimba distinta por carril |
| Nombre | **Tumbao** |
| Notas de gesto (abierta/puño) | **Fuera** por plazo (fase 7 opcional); se hizo el editor de partituras |
| Pausa automática | Solo si se **falla una nota** y la cámara lleva 3 s sin ver manos (pausar antes molestaba a quien espera con las manos bajadas) |
