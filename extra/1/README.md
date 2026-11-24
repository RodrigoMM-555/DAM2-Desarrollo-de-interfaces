# Tumbao

Juego de ritmo con interfaces naturales: por cuatro carriles bajan manos
(azul = izquierda, naranja = derecha) y hay que **colocar esa mano en ese
carril** antes de que la nota llegue a la línea, a tiempo con la música.

Proyecto extra de *Desarrollo de Interfaces* (2.º DAM).

| Documento | Contenido |
|---|---|
| [docs/DISEÑO.md](docs/DISEÑO.md) | Diseño, funcionamiento y justificación de tecnologías |
| [docs/EVALUACION.md](docs/EVALUACION.md) | Qué se aplica de cada unidad de la asignatura, contraste WCAG |
| [docs/PLAN-PRUEBAS.md](docs/PLAN-PRUEBAS.md) | Pruebas automáticas, en navegador y manuales |

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Análisis y diseño | ✅ |
| 2 | Estructura, enrutador, menú, estilos, `pruebas.html` | ✅ |
| 3 | Motor (reloj, partitura, juez, puntuación), pista, música generada, **teclado** | ✅ |
| 4 | Cámara: seguidor de manos, zona de juego, calibración | ✅ |
| 5 | Notas de mantener y cruce (dificultad Difícil), medición del retraso, pausa automática, pulsar con la mano | ✅ |
| 6 | Tercera canción, pantalla de Ajustes | ✅ |
| 7 | Editor de partituras (las notas de gesto se quedan fuera) | ✅ |
| 8 | Accesibilidad, plan de pruebas, documentación final | ✅ |

## Puesta en marcha

Con **Live Server** de VS Code: clic derecho en `index.html` → *Open with Live Server*.
O cualquier servidor local:

```bash
python3 -m http.server 8000   # y abre http://localhost:8000
```

No funciona con doble clic (`file://`): el navegador no carga módulos ES ni
archivos JSON desde archivos locales. No hay que instalar nada.

## Cómo se juega

| | Carril 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Mano izquierda | <kbd>A</kbd> | <kbd>S</kbd> | <kbd>D</kbd> | <kbd>F</kbd> |
| Mano derecha | <kbd>J</kbd> | <kbd>K</kbd> | <kbd>L</kbd> | <kbd>Ñ</kbd> |

Mantener pulsada la tecla = tener la mano en ese carril. <kbd>Esc</kbd> pausa.

**Con la cámara:** Menú → *Cámara* → *Activar cámara*. Ajusta la zona de juego
con los deslizadores, pulsa *Comprobar manos* (levanta solo la izquierda y
luego solo la derecha) y *Guardar y jugar*. En la lista de canciones se puede
activar o desactivar *Jugar con la cámara*. Teclado y cámara funcionan a la
vez: si una mano tiene una tecla pulsada, manda la tecla.

En la partida, el **punto de color** sobre la línea marca dónde ve la cámara
cada mano en ese instante (hueco = demasiado alta o baja, no cuenta). La mano
dibujada en la línea es el carril registrado y se desliza al cambiar.

La cámara exige `localhost` o `https`. La imagen se analiza en el navegador
con MediaPipe (incluido en `lib/`, 22 MB) y no se envía a ningún sitio.

| Calificación | Cuándo | Puntos |
|---|---|---|
| ¡Perfecto! | La mano entra en el último pulso antes de la nota (o sigue en el carril desde su acierto anterior) | 300 |
| Bien | La mano ya estaba desde antes | 200 |
| Justo | Llega en el último instante (±0,1 s) | 100 |
| Fallo | No está, o está la otra mano | 0 y se rompe el combo |

El combo multiplica: ×2 desde 10 aciertos seguidos, ×3 desde 25, ×4 desde 50.

**Notas de mantener** (con cola): además del juicio al llegar, al terminar se
juzga qué parte del tiempo se ha mantenido la mano (≥ 85 % perfecto, ≥ 60 %
bien, ≥ 30 % justo). **Cruces** (en Difícil): la mano izquierda va a un carril
a la derecha de la mano derecha.

**Con la cámara**, en las pantallas de pausa y de inicio se puede pulsar un
botón dejando la mano quieta encima 1 segundo. Si se falla una nota y la
cámara lleva 3 s sin ver manos, la partida se pausa sola.

## Otras pantallas

- **Ajustes:** volumen de música y efectos, velocidad de las notas, reducir
  movimiento, cámara y borrar récords. Se guarda al momento.
- **Crear partitura:** elige la música, pulsa *Grabar* y coloca las manos al
  ritmo (teclado o cámara). Al parar se puede *Probarla* o *Descargar JSON*
  para añadirla a `canciones/`.

## Pruebas

Abre `pruebas.html` con Live Server (121 pruebas): ejecuta cada `*.prueba.js` en su propio
`<iframe>` con un ejecutor propio de API tipo Vitest (`pruebas/ejecutor.js`,
reutilizado de GlyphCraft). Al crear un archivo de pruebas nuevo, añádelo a
`pruebas/lista.js`.

## Añadir una canción

La forma más fácil: **Crear partitura** → *Descargar JSON*, y copiar el archivo
a `canciones/`. A mano:

1. Crea `canciones/<id>.json` (copia una existente). La música puede ser
   - **generada**: campo `musica` con secciones, patrones de percusión, bajo y acordes
     (formato explicado en `audio/secuenciador.js`), o
   - **un archivo** con licencia libre (CC0): campo `"audio": "<id>.ogg"` en la misma carpeta,
     con `bpm` y `desfase` (segundos hasta el primer pulso) ajustados al audio.
2. Escribe las notas en `dificultades`: `{ "pulso": 8, "mano": "i", "carril": 0 }`.
3. Añádela a `canciones/lista.json`.

Si la partitura tiene errores (una mano en dos carriles a la vez, cambios de
carril imposibles…), la partida lo dice al cargarla.

## Estructura

```
index.html · pruebas.html · codigo.js · estilo.css
nucleo/       Aplicación (mediador) y enrutador
motor/        Lógica pura: partitura, juez, puntuación, partida, grabador del editor
entrada/      Teclado, cámara (MediaPipe), seguidor de manos, zona de juego, filtro,
              calibración, permanencia (pulsar con la mano)
audio/        Reloj maestro, secuenciador e instrumentos sintetizados
componentes/  <tb-pista>, <tb-camara>, <tb-cursor-mano>
vistas/       Menú, canciones, partida, resultados, calibración, ajustes, editor
servicios/    Récords y ajustes (localStorage)
canciones/    3 canciones en JSON (fácil, normal, difícil)
pruebas/      Ejecutor de pruebas
docs/         Diseño, evaluación y plan de pruebas
lib/mediapipe MediaPipe Tasks Vision + modelo de manos (copiado de GlyphCraft)
```
