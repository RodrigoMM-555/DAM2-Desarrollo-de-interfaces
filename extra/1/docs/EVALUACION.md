# Tumbao · Resultados de aprendizaje y criterios de evaluación

**Proyecto:** Tumbao, juego de ritmo con interfaces naturales (proyecto extra)
**Módulo:** 0488 Desarrollo de interfaces (2.º DAM) · Unidades 1, 2, 3 y 4
**Autor:** Rodrigo Menéndez Molina

Texto de los resultados de aprendizaje (RA) y criterios tomado del
Real Decreto 405/2023 (BOE n.º 132, 3 de junio de 2023), que actualiza el
módulo 0488. Para cada criterio explico dónde y cómo se cumple en el proyecto.

Documentos relacionados: [DISEÑO.md](DISEÑO.md) (diseño y tecnologías),
[USABILIDAD.md](USABILIDAD.md) (estándares, menús, controles, mensajes),
[PLAN-PRUEBAS.md](PLAN-PRUEBAS.md) (pruebas) y
[../componentes/README.md](../componentes/README.md) (componentes).

---

## RA1 · Genera interfaces gráficos de usuario mediante editores visuales utilizando las funcionalidades del editor y adaptando el código generado

### a) Se han analizado las herramientas y librerías disponibles para la generación de interfaces gráficos.

En mi proyecto he analizado varias opciones antes de elegir (justificación completa en `DISEÑO.md` §6): HTML/CSS nativo frente a frameworks (React, Vue), **Canvas 2D** frente a DOM y a **Three.js/WebGL** para la pista (Canvas dibuja cientos de notas a 60 fps sin quitar CPU a MediaPipe), Web Components nativos frente a librerías de componentes, y **Web Audio** frente a `<audio>` para tener un reloj preciso. Elegí la plataforma web porque funciona igual en Windows, macOS y Linux sin instalar nada.

### b) Se ha creado un interfaz gráfico utilizando las herramientas de un editor visual.

En mi proyecto he creado la interfaz con VS Code y la vista previa de Live Server, ajustando la composición con el inspector del navegador (rejillas de CSS Grid y Flexbox, colores y espaciados en directo). Antes de programar hice los esquemas de las pantallas (`USABILIDAD.md` §7). Además, el propio juego incluye un **editor visual de partituras** (`vistas/vista-editor.js`): se crea una partitura colocando las manos sobre la pista mientras suena la música, sin escribir código.

### c) Se han utilizado las funciones del editor para ubicar los componentes del interfaz.

En mi proyecto he ubicado los componentes con etiquetas semánticas (`header`, `nav`, `main`, `section`, `aside`, `footer`, `fieldset`, `dialog`) y los he distribuido con CSS Grid (partida en tres filas: marcador, área de juego y teclas; calibración y editor en dos columnas) y Flexbox (barras de botones). La interfaz se adapta: a menos de 900 px la cámara se reduce a una esquina y a menos de 800 px las columnas pasan a una. En el modo de realidad aumentada calculo por código la posición exacta de la imagen de la cámara y alineo los carriles con la zona de juego.

### d) Se han modificado las propiedades de los componentes para adecuarlas a las necesidades de la aplicación.

En mi proyecto he definido la estética en variables CSS en `:root` (colores, radios, sombras) y he ajustado propiedades de los controles: `min`, `max`, `step` y `value` de los deslizadores, `accent-color`, `disabled` (la voz se desactiva si el navegador no la admite), `hidden`, `inert` (fondo bloqueado tras un diálogo) y atributos propios de mis componentes (`antelacion`, `transparente`, `esqueleto`, `sin-rejilla`, `duracion`). Corregí el borde de los botones porque no llegaba al contraste mínimo.

### e) Se ha analizado el código generado por el editor visual.

En mi proyecto el editor de partituras genera **código JSON** (las notas de una canción). Ese código se analiza con el validador (`motor/partitura.js`): comprueba que cada nota esté bien escrita y que la partitura sea jugable (una mano no puede estar en dos carriles a la vez ni cambiar de carril en menos de 0,25 s), y el editor muestra los problemas. También analicé el código que reutilicé de GlyphCraft (carga de MediaPipe, filtro One Euro, ejecutor de pruebas) para ver qué servía y qué sobraba.

### f) Se ha modificado el código generado por el editor visual.

En mi proyecto el grabador (`motor/grabador.js`) modifica lo generado al grabar: ajusta cada nota al pulso más cercano, convierte en notas de mantener las que duran 2 pulsos o más y elimina los roces y las notas imposibles. El JSON descargado se puede editar a mano y añadir a `canciones/`. El código de GlyphCraft lo adapté: traduje la carga de MediaPipe a `entrada/camara.js` (con seguidor de manos, zona de juego y esqueletos), simplifiqué el enrutador y pasé todos los nombres al español.

### g) Se han asociado a los eventos las acciones correspondientes.

En mi proyecto he asociado acciones a eventos con `addEventListener`:
- **Teclado:** `keydown`/`keyup` con `event.code` (A S D F / J K L Ñ), Espacio para empezar, Esc para pausar; `blur` suelta las teclas.
- **Ratón y formularios:** `click` con delegación de eventos en las barras de botones, `input` y `change` en Ajustes, Calibración y Editor.
- **Navegador:** `hashchange` (rutas), `visibilitychange` (pausa al cambiar de pestaña), `loadedmetadata` del vídeo.
- **Eventos propios:** `cambiomanos` (teclado y cámara), `juzgada` y `fin` (partida), `fotograma` y `gesto` (cámara), `orden` (voz), `marcada`, `lista` y `pulsado` (componentes).

### h) Se ha desarrollado una aplicación que incluye el interfaz gráfico obtenido.

En mi proyecto he desarrollado un juego completo: 7 pantallas (menú, canciones, partida, resultados, calibración, ajustes y editor), 3 canciones con 3 dificultades cada una, música generada por el propio juego, récords guardados y navegación por URL (atrás y adelante funcionan).

---

## RA2 · Genera interfaces naturales de usuario utilizando herramientas visuales

### a) Se han identificado las herramientas disponibles para el aprendizaje automático relacionadas con las interfaces de usuario.

En mi proyecto he comparado estas herramientas antes de elegir:

| Herramienta | Qué hace | Decisión |
|---|---|---|
| **MediaPipe Tasks Vision · HandLandmarker** | 21 puntos por mano + si es izquierda o derecha, en el navegador (WebAssembly) | **Elegida**: da posición y lateralidad en un solo modelo, sin servidor |
| MediaPipe PoseLandmarker | 33 puntos del cuerpo | Descartada: peor precisión en las manos, más pesada |
| TensorFlow.js (handpose, MoveNet) | Modelos de manos y cuerpo | Descartada: más lenta y sin lateralidad fiable |
| Teachable Machine | Entrenar clasificadores de imagen/sonido/postura | Descartada: clasifica posturas, no da coordenadas; el audio usa ventanas de 1 s |
| ml5.js | Capa sencilla sobre TensorFlow.js | Descartada: una dependencia más para lo mismo |
| **Web Speech API** | Reconocimiento y síntesis de voz | **Elegida** para órdenes de voz y para leer resultados |

### b) Se ha creado una interfaz natural de usuario utilizando las herramientas disponibles.

En mi proyecto el juego entero se puede jugar **sin tocar nada**: las manos se colocan en los carriles delante de la cámara (`entrada/camara.js`), los botones se pulsan dejando la mano quieta encima 1 s (`<tb-cursor-mano>`), la partida empieza o se pausa levantando las dos manos y se controla con la voz. La calibración guiada adapta la interfaz a cada persona y cámara.

### c) Se ha utilizado el reconocimiento de voz para implementar acciones en las interfaces naturales de usuario.

En mi proyecto he implementado **órdenes de voz** con `SpeechRecognition` (`entrada/voz.js`): en la partida «empezar», «pausa», «continuar», «reiniciar» y «salir»; en resultados «repetir», «canciones» y «menú». Como las manos están ocupadas en los carriles, la voz es la forma natural de pausar. La frase se interpreta sin tildes ni mayúsculas, con sinónimos («para», «sigue», «otra vez») y solo con las órdenes que tienen sentido en cada pantalla (17 pruebas en `entrada/voz-gestos.prueba.js`). También uso **síntesis de voz** para leer el resultado en voz alta. Se activa en Ajustes, que avisa de que en Chrome y Edge el audio se procesa en línea.

### d) Se ha incorporado la detección del movimiento del cuerpo para implementar acciones en las interfaces naturales de usuario.

En mi proyecto detecto movimientos de las manos para actuar:
- **Desplazamiento lateral:** al mover la mano de un carril a otro el juego registra el cambio (con histéresis para que no parpadee) y el juez lo califica según cuándo llegó.
- **Gesto de levantar las dos manos** por encima de la zona de juego (`entrada/gestos.js`): empieza la partida o la pausa. Hay que mantenerlo 0,6 s y bajar las manos antes de repetirlo, para que no salte sin querer.
- **Movimiento al ritmo:** la medición del retraso de la cámara compara los cambios de carril con los clics de un metrónomo.
- **Ausencia de movimiento:** si la cámara deja de ver manos y se falla una nota, la partida se pausa sola.

### e) Se han integrado elementos de detección de partes del cuerpo para implementar acciones en las interfaces naturales de usuario.

En mi proyecto detecto **las manos** con MediaPipe (21 puntos cada una) y calculo el **centro de la palma** (muñeca y bases de los dedos) para saber en qué carril está cada una. Distingo **mano izquierda y derecha** de forma estable con un seguidor propio (`entrada/seguidor-manos.js`): empareja las manos por posición entre fotogramas, decide la lateralidad por votación de los últimos fotogramas y desempata por posición, así que aguanta errores de etiqueta y cruces de brazos. La calibración comprueba si la cámara da las manos al revés y lo corrige.

### f) Se ha integrado la realidad aumentada en los interfaces de usuario.

En mi proyecto hay un **modo de realidad aumentada** (Ajustes → Cámara): la imagen de la cámara ocupa el fondo de la partida y la pista se dibuja encima, con los cuatro carriles **registrados** sobre la zona de juego real, de modo que las notas caen exactamente donde el jugador debe poner las manos. Además, cada mano real lleva superpuesto un **esqueleto virtual** de su color (los 21 puntos unidos) que la sigue en tiempo real (`<tb-camara esqueleto>`), también en la calibración y en el panel de la cámara.

---

## RA3 · Crea componentes visuales valorando y empleando herramientas específicas

### a) Se han identificado las herramientas para diseño y prueba de componentes.

En mi proyecto he usado y valorado: la API de **Custom Elements** y **Shadow DOM** del navegador; las **DevTools** para inspeccionar el Shadow DOM y los eventos; un **ejecutor de pruebas** propio con la API de Vitest (`pruebas/ejecutor.js`) en lugar de Vitest/Playwright, para no instalar nada; una **página de demostración** (`componentes/demo.html`) donde se cambian los atributos y se ven los eventos de cada componente por separado, al estilo de Storybook; y el formato estándar **Custom Elements Manifest** (`custom-elements.json`), que leen los editores para autocompletar.

### b) Se han creado componentes visuales.

En mi proyecto he creado tres Web Components nativos con prefijo `tb-`: **`<tb-pista>`** (pista de ritmo en Canvas), **`<tb-camara>`** (vista de la cámara con realidad aumentada) y **`<tb-cursor-mano>`** (cursor que pulsa con la mano). Las siete pantallas también son elementos personalizados (`tb-vista-*`).

### c) Se han definido sus métodos y propiedades con asignación de valores por defecto.

En mi proyecto cada componente tiene propiedades con valor por defecto, y los atributos están reflejados como propiedades (getter/setter):
- `<tb-pista>`: `antelacion` = 2, `transparente` = false, `notas` = [], `pulso` = 0, `geometria` = null; métodos `dibujar()`, `marcar()` y `reiniciar()`.
- `<tb-camara>`: `esqueleto` = false, `sinRejilla` = false, `video` (solo lectura); método `dibujar()`.
- `<tb-cursor-mano>`: `duracion` = 1, `raiz` = null; método `mover()`; al cambiar `duracion` se reinicia el temporizador (`attributeChangedCallback`).

Un valor no válido (por ejemplo `antelacion="rápido"`) vuelve al valor por defecto.

### d) Se han determinado los eventos a los que debe responder el componente y se les han asociado las acciones correspondientes.

En mi proyecto los componentes **escuchan** `ResizeObserver` (`<tb-pista>` ajusta su lienzo), `loadedmetadata` del vídeo (`<tb-camara>` toma la proporción real de la cámara) y la posición de la mano (`<tb-cursor-mano>`). También **emiten** eventos propios para que la aplicación reaccione sin conocer su interior: `marcada`, `lista` y `pulsado` (el cursor, además, hace `click()` en el botón).

### e) Se han realizado pruebas unitarias sobre los componentes desarrollados.

En mi proyecto `componentes/tb-componentes.prueba.js` monta cada componente en el DOM y comprueba con 15 pruebas: que está registrado, sus valores por defecto, que atributos y propiedades van sincronizados, que dibuja donde debe (leyendo píxeles del canvas), que emite sus eventos y que el cursor pulsa solo los botones de su raíz. `componentes/permanencia.prueba.js` prueba su lógica (6 pruebas).

### f) Se han documentado los componentes creados.

En mi proyecto la documentación de los componentes está en `componentes/README.md`, con tablas de atributos, propiedades, métodos, eventos y variables CSS de cada uno, ejemplos de uso, el manifiesto `custom-elements.json` y comentarios JSDoc en todo el código.

### g) Se han empaquetado componentes.

En mi proyecto los componentes forman el paquete **`tumbao-componentes` 1.0.0** (`componentes/`): punto de entrada `index.js` que registra y exporta todo, `package.json` con `exports`, `files` (sin las pruebas), `customElements` y `sideEffects`, licencia MIT y manifiesto. Es autónomo (no depende del resto del juego) y se puede copiar a otro proyecto o publicar.

### h) Se han programado aplicaciones cuyo interfaz gráfico utiliza los componentes creados.

En mi proyecto el juego usa los tres componentes: `<tb-pista>` en la partida y el editor; `<tb-camara>` en la partida (panel y modo RA), la calibración y el editor; y `<tb-cursor-mano>` en los diálogos de la partida.

---

## RA4 · Diseña interfaces gráficas identificando y aplicando criterios de usabilidad y accesibilidad

### a) Se han identificado los principales estándares de usabilidad y accesibilidad.

En mi proyecto he aplicado WCAG 2.2 AA, WAI-ARIA, ISO 9241-11 (eficacia, eficiencia, satisfacción), ISO 9241-110 (principios de diálogo) y las heurísticas de Nielsen. Tabla de qué aplico de cada uno en `USABILIDAD.md` §1–3.

### b) Se ha valorado la importancia del uso de estándares para la creación de interfaces.

En mi proyecto los estándares me han servido para decidir con datos (el borde de los botones no llegaba a 3:1 y lo cambié), para que las comprobaciones sean automáticas en cada cambio y para garantizar que el juego sea accesible: un juego que se controla con el cuerpo debe tener siempre alternativa por teclado. Lo explico en `USABILIDAD.md` §1.

### c) Se han creado diferentes tipos de menús cuya estructura y contenido siguen los estándares establecidos.

En mi proyecto hay menú principal (`nav` con la acción principal destacada), menú de selección (tarjetas de canciones y dificultades), menú contextual modal (pausa, con `role="dialog"`, `aria-modal`, foco en la acción por defecto y fondo inerte), menú de opciones agrupadas (`fieldset`/`legend` en Ajustes), asistente por pasos (Calibración) y menús por voz y gesto. Estructura de cada uno en `USABILIDAD.md` §4.

### d) Se han distribuido las acciones en menús, barras de herramientas, botones de comando, entre otros, siguiendo un criterio coherente.

En mi proyecto navegar es siempre un enlace y actuar es un botón; «← Menú» siempre arriba a la izquierda; la acción principal siempre la primera y destacada; la destructiva al final («Salir», «Borrar récords» con confirmación); la pausa lejos de la zona de juego. Ver `USABILIDAD.md` §4.

### e) Se han distribuido adecuadamente los controles en la interfaz de usuario.

En mi proyecto la partida deja el centro para la pista, el marcador arriba, la cámara a un lado y la ayuda de teclas abajo; Ajustes agrupa los controles por tema; Calibración y Editor separan la imagen (izquierda) de los controles (derecha). Todo se reordena en pantallas pequeñas.

### f) Se ha utilizado el tipo de control más apropiado en cada caso.

En mi proyecto uso deslizadores con `<output>` para valores continuos, casillas para opciones sí/no, `<select>` para elegir entre opciones conocidas, tarjetas para elegir canción comparando información, `<dialog>` para la ayuda y `confirm()` para lo irreversible. Justificación en `USABILIDAD.md` §5.

### g) Se ha diseñado el aspecto de la interfaz de usuario (colores y fuentes entre otros) atendiendo a su legibilidad.

En mi proyecto todos los textos superan 6:1 de contraste (mínimo 4,5:1) y los controles y el foco superan 3:1; uso fuentes del sistema a 16 px con interlineado 1,5; y azul y naranja, que distinguen las personas con daltonismo, más forma y letra para no depender del color. Tabla en `USABILIDAD.md` §7; se comprueba automáticamente leyendo `estilo.css`.

### h) Se ha verificado que los mensajes generados por la aplicación son adecuados en extensión y claridad.

En mi proyecto revisé todos los mensajes (`USABILIDAD.md` §6): una o dos frases que dicen qué pasa y qué hacer. Corregí los dos que mostraban errores técnicos del navegador («Failed to fetch», «404») y ahora explican la causa probable y la solución; el detalle técnico va a la consola.

### i) Se han realizado pruebas para evaluar la usabilidad y accesibilidad de la aplicación.

En mi proyecto `servicios/accesibilidad.prueba.js` (30 pruebas) comprueba el contraste de 13 pares de colores leídos del CSS real y, montando la aplicación real, que las 7 pantallas tienen un solo `h1`, títulos sin saltos de nivel, botones y enlaces con nombre, campos con etiqueta y ningún `tabindex` positivo. Además preparé un protocolo de prueba con usuarios (6 tareas, eficacia, eficiencia y satisfacción con el cuestionario SUS) y una lista de comprobaciones manuales (teclado, lector de pantalla, zoom, Lighthouse) en `USABILIDAD.md` §8 y `PLAN-PRUEBAS.md`.
