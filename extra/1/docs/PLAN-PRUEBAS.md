# Plan de pruebas · Tumbao

Tres niveles: pruebas automáticas de la lógica, pruebas en navegador
(automatizadas con un "bot" que pulsa las teclas a tiempo) y pruebas manuales
con la cámara real.

## 1. Pruebas automáticas (`pruebas.html`)

Se abren con Live Server. Cada archivo se ejecuta aislado en su `<iframe>` con
el ejecutor propio (`pruebas/ejecutor.js`, API tipo Vitest).

| Archivo | Qué prueba | Pruebas |
|---|---|---|
| `motor/motor.prueba.js` | Partitura (validación, jugabilidad), juez (ventanas, calificaciones, quedarse en el carril, notas de mantener, cruces), puntuación (combo, precisión, nota final), partida (eventos, fin, latencia) | 40 |
| `motor/grabador.prueba.js` | Editor: cuantización, notas de mantener, roces, notas injugables, salida válida | 6 |
| `audio/secuenciador.prueba.js` | Patrones, bajo, acordes, frecuencias; las 3 canciones incluidas son válidas | 12 |
| `entrada/teclado.prueba.js` | Teclas por mano, varias teclas, repetición, pérdida de foco | 8 |
| `entrada/manos.prueba.js` | Zona de juego (carriles, reposo, bordes, histéresis), seguidor de manos (etiquetas erróneas, orden cambiado, brazos cruzados, manos perdidas), filtro One Euro | 21 |
| `entrada/camara.prueba.js` | Centro de la palma, etiqueta → mano, comprobación izquierda/derecha, medición del retraso | 12 |
| `entrada/permanencia.prueba.js` | Pulsar dejando la mano quieta, mano → pantalla | 6 |
| `servicios/records.prueba.js` | Récords: mejora, persistencia, borrado, datos corruptos | 6 |
| `servicios/ajustes.prueba.js` | Ajustes: valores por defecto, validación campo a campo | 6 |
| `nucleo/enrutador.prueba.js` | Rutas y parámetros | 4 |
| **Total** | | **121** |

Resultado (24/11/2026): **121/121 correctas**.

Las pruebas no necesitan cámara: la lógica de las manos recibe datos
inventados que reproducen los problemas reales de MediaPipe.

## 2. Pruebas en navegador (Firefox, automatizadas)

Firefox sin ventana (`--headless`) con su **cámara de prueba** (imagen
sintética, sin manos) y una página que juega sola pulsando las teclas en el
momento justo.

| Caso | Resultado esperado | Obtenido |
|---|---|---|
| Menú, canciones, ajustes, calibración, editor se pintan | Sin errores en consola | ✅ |
| Partida completa en Fácil con juego perfecto | S, 100 %, récord guardado | ✅ |
| Partida en Normal fallando 1 de cada 3 | Combo se rompe, precisión ≈ 69 % | ✅ |
| Partida completa en Difícil (mantener y cruces) | 108 notas + 6 colas, todas *Perfecto* | ✅ |
| Cámara activada: MediaPipe carga desde `lib/` | Análisis a ~30 fps | ✅ |
| Cámara sin manos y sin teclado | Pausa "No veo tus manos" tras el primer fallo, no antes | ✅ |
| Editor: grabar con teclas y parar | Partitura válida, "Probarla" y "Descargar JSON" disponibles | ✅ |

## 3. Pruebas manuales (cámara real)

Pendientes de hacer por el jugador; marcar al probar.

| # | Prueba | Cómo | Resultado |
|---|---|---|---|
| M1 | Izquierda/derecha correctas | Calibrar → la I azul sigue a la mano izquierda | ☐ |
| M2 | Comprobación automática | "Comprobar manos" dice ✓ (o corrige) | ☐ |
| M3 | Zona alcanzable sentado | Llegar a los carriles 1 y 4 sin estirarse | ☐ |
| M4 | Reposo | Manos bajadas → ningún carril | ☐ |
| M5 | Cambio de carril fluido | La mano de la línea se desliza; el punto sigue a la mano | ☐ |
| M6 | Retraso | "Medir con metrónomo" da entre 40 y 200 ms | ☐ |
| M7 | Cruces | En Difícil, al cruzar los brazos no se intercambian las manos | ☐ |
| M8 | Notas de mantener | La cola brilla mientras la mano sigue en el carril | ☐ |
| M9 | Pulsar con la mano | En pausa, dejar la mano 1 s sobre "Continuar" | ☐ |
| M10 | Pausa automática | Salir de la imagen durante la canción → pausa | ☐ |
| M11 | Luz | Repetir M1 y M3 con poca luz; anotar fps | ☐ |
| M12 | Otra persona | Repetir M1–M3 con otra persona (manga larga/corta) | ☐ |

## 4. Accesibilidad

| Comprobación | Resultado |
|---|---|
| Contraste de texto (WCAG 1.4.3) | Todos ≥ 6:1 (ver `docs/EVALUACION.md`) |
| Contraste de controles y foco (1.4.11) | Bordes de botón 3,5:1 o más tras corregir `--color-borde-control`; foco 12,9:1 |
| No solo color (1.4.1) | Manos: color + forma (pulgar) + letra I/D; calificaciones: texto |
| Teclado (2.1.1) | Todo el juego se juega y navega con teclado |
| Foco visible (2.4.7) y foco en diálogos | Contorno amarillo; capa de partida modal con el fondo `inert` |
| Movimiento (2.3.3) | `prefers-reduced-motion` y opción en Ajustes |
| Tamaño de objetivos (2.5.8) | Botones de 40–48 px de alto |
| Pausa (2.2.2) | <kbd>Esc</kbd>, botón y pausa automática al perder el foco |
| Lighthouse / axe | ☐ Pendiente de pasar en Chrome |
