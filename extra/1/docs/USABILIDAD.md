# Tumbao · Usabilidad y accesibilidad

Cómo se han aplicado los estándares de usabilidad y accesibilidad al diseñar
la interfaz (RA4). Las comprobaciones automáticas están en
`servicios/accesibilidad.prueba.js`; las pruebas con usuarios, en el apartado 8.

## 1. Estándares aplicados

| Estándar | Qué es | Cómo se aplica en Tumbao |
|---|---|---|
| **WCAG 2.2 (nivel AA)** | Pautas de accesibilidad del contenido web del W3C | Contraste (1.4.3, 1.4.11), no solo color (1.4.1), teclado (2.1.1), foco visible (2.4.7), pausa (2.2.2), movimiento (2.3.3), tamaño de objetivos (2.5.8), nombres y etiquetas (4.1.2, 3.3.2) |
| **WAI-ARIA 1.2** | Roles y estados para tecnologías de apoyo | `role="dialog"` + `aria-modal` en la capa de partida, `role="status"` / `aria-live` en avisos, `aria-label` en el botón de pausa, `aria-hidden` en adornos |
| **ISO 9241-11** | Usabilidad = eficacia, eficiencia y satisfacción | Las tres se miden en la prueba con usuarios (apartado 8) |
| **ISO 9241-110** | Principios de diálogo | Tabla del apartado 2 |
| **Heurísticas de Nielsen** | 10 reglas de diseño de interfaces | Tabla del apartado 3 |
| **HTML semántico** | `header`, `nav`, `main`, `section`, `fieldset`… | Estructura de todas las pantallas |

**Por qué importan los estándares:** son acuerdos comprobables. En vez de
discutir si algo "se lee bien", se mide (contraste ≥ 4,5:1), se prueba
automáticamente en cada cambio y se garantiza que funciona con tecnologías de
apoyo (lectores de pantalla, teclado). Además, un usuario que ya conoce las
convenciones (Esc pausa, el título arriba, el botón principal destacado) no
tiene que aprender nada nuevo. En un juego que se controla con el cuerpo esto
es aún más importante: siempre debe existir una alternativa (teclado) para
quien no pueda o no quiera usar la cámara.

## 2. Principios de diálogo (ISO 9241-110)

| Principio | En Tumbao |
|---|---|
| Adecuación a la tarea | Una pantalla por tarea: elegir canción, jugar, ver resultados, calibrar, ajustar, crear partitura |
| Autodescripción | Cada pantalla dice qué hacer: "Para empezar, pulsa Espacio, levanta las dos manos o di «empezar»" |
| Conformidad con las expectativas | Esc pausa, ← Menú arriba a la izquierda, botón principal con degradado, los carriles se leen de izquierda a derecha como el teclado (A S D F / J K L Ñ) |
| Facilidad de aprendizaje | Ayuda "Cómo se juega", dificultad Fácil, calibración guiada paso a paso |
| Controlabilidad | Pausa en cualquier momento (teclado, botón, voz, gesto, al perder el foco); reiniciar y salir desde la pausa |
| Tolerancia a errores | Partituras validadas antes de jugar; confirmación al borrar récords; pausa automática si la cámara pierde las manos |
| Adaptabilidad | Velocidad de las notas, volumen, reducir movimiento, zona de juego, retraso de la cámara, cámara / teclado / voz |

## 3. Heurísticas de Nielsen

| Heurística | Ejemplo |
|---|---|
| 1. Visibilidad del estado | Marcador en directo; punto que muestra dónde ve la cámara tu mano; "Escuchando" en el indicador de voz |
| 2. Relación con el mundo real | Las notas tienen forma de mano izquierda/derecha; el vídeo en espejo |
| 3. Control y libertad | Pausa, reiniciar, salir; ← Menú en todas las pantallas |
| 4. Consistencia | Mismos botones, colores y posiciones en todas las pantallas; azul = izquierda siempre |
| 5. Prevención de errores | Validación de partituras; histéresis para que la mano no "parpadee" entre carriles |
| 6. Reconocer antes que recordar | Las teclas de cada mano siempre visibles al pie de la partida |
| 7. Flexibilidad y eficiencia | Atajos (Espacio, Esc), voz y gestos para usuarios avanzados |
| 8. Diseño minimalista | La partida solo muestra pista, marcador y cámara |
| 9. Ayudar a reconocer y corregir errores | Mensajes con causa y solución (apartado 6) |
| 10. Ayuda y documentación | "Cómo se juega", notas en Ajustes y Calibración, README |

## 4. Menús y distribución de acciones

Tipos de menú usados, cada uno con la estructura habitual para su función:

| Tipo | Dónde | Estructura |
|---|---|---|
| **Menú principal** (botonera) | Inicio | `<nav aria-label="Menú principal">`; la acción principal (Jugar) primero y destacada; luego configuración (Cámara, Ajustes), creación (Crear partitura) y ayuda (Cómo se juega) |
| **Menú de selección** (lista de tarjetas) | Canciones | Una tarjeta por canción; dentro, una opción por dificultad con su información (notas, récord) |
| **Menú contextual modal** | Pausa / inicio / error de la partida | Diálogo con la acción por defecto primero (Continuar / Empezar) y la destructiva al final (Salir); el fondo queda inerte |
| **Menú de opciones** (formulario por grupos) | Ajustes | `fieldset` + `legend` por tema: Sonido, Juego, Accesibilidad, Cámara, Voz, Datos |
| **Asistente por pasos** | Calibración | Pasos numerados 1 → 4 en el orden en que hay que hacerlos |
| **Barra de acciones** | Resultados, Editor | Acción principal (Repetir / Grabar) destacada a la izquierda; secundarias después |
| **Menú por voz y por gesto** | Partida y resultados | Las mismas acciones de los menús visibles, con las mismas palabras |

Criterios de distribución:
- **Navegar** (cambiar de pantalla) = enlace `<a href>`; **actuar** (hacer algo en la pantalla) = `<button>`.
- La vuelta atrás (← Menú) siempre arriba a la izquierda; el título junto a ella.
- En la partida, la pausa arriba a la derecha (lejos de la zona de juego) y las teclas al pie.
- Botones de al menos 40 px de alto y separados 0,75 rem (WCAG 2.5.8).

## 5. Elección de controles

| Dato | Control | Por qué |
|---|---|---|
| Valor continuo con rango (volumen, velocidad, zona, retraso) | `<input type="range">` con `<output>` | Se ajusta arrastrando y se ve el valor exacto al lado |
| Sí / no (cámara, voz, reducir movimiento) | `<input type="checkbox">` dentro de su `<label>` | Un clic, estado visible, toda la etiqueta es pulsable |
| Elegir uno entre varios conocidos (música del editor, cuantización) | `<select>` | Ocupa poco y las opciones están claras |
| Elegir canción y dificultad | Tarjetas con enlaces | Hay información que comparar (BPM, notas, récord) antes de elegir |
| Confirmación de una acción irreversible | `confirm()` | Diálogo nativo, accesible y conocido |
| Avisos breves ("Guardado") | Texto con `role="status"` | No interrumpe y lo anuncian los lectores de pantalla |
| Ayuda larga | `<dialog>` nativo | Modal accesible: foco atrapado y Esc para cerrar |

## 6. Mensajes

Revisión de los mensajes de la aplicación (extensión y claridad): cada uno
dice **qué pasa** y, si hace falta, **qué hacer**, en una o dos frases, sin
jerga técnica. Los detalles técnicos van a la consola.

| Situación | Mensaje |
|---|---|
| Canciones abiertas con doble clic | "No se pueden cargar las canciones abriendo el archivo con doble clic. Ábrelo con Live Server o con un servidor local." |
| Canción inexistente | "No se ha encontrado esta canción. Si la grabaste en el editor, recuerda que solo dura hasta recargar la página: descárgala y añádela a «canciones»." |
| Cámara sin permiso / ocupada / inexistente | "No se ha dado permiso para usar la cámara." · "La cámara está ocupada por otra aplicación." · "No se ha encontrado ninguna cámara." |
| La cámara falla en la partida | "No se pudo usar la cámara (…); puedes jugar con el teclado." |
| Pausa automática | "No veo tus manos. Vuelve a ponerte delante de la cámara." |
| Comprobación de manos dudosa | "No he podido distinguirlas bien. Prueba con más luz y con la mano bien abierta, y repite." |
| Medición del retraso fallida | "No he registrado suficientes cambios a ritmo. Repite moviendo la mano con cada clic." |
| Voz no disponible | "Tu navegador no tiene reconocimiento de voz (Firefox no lo incluye). Prueba con Chrome o Edge." |
| Borrar récords | "¿Borrar todos los récords? No se puede deshacer." |
| Editor sin notas | "No se ha grabado ninguna nota. Prueba otra vez colocando las manos en los carriles." |

Calificaciones en la partida: una palabra (¡Perfecto!, Bien, Justo, Fallo),
grande y con color, porque se leen en una fracción de segundo.

## 7. Aspecto: colores y fuentes

- **Fuentes del sistema** (`system-ui`): se leen bien en cada sistema operativo y no hay que descargar nada. Títulos en negrita gruesa; texto a 16 px con interlineado 1,5.
- **Paleta oscura** (noche): reduce el deslumbramiento durante la partida y hace resaltar las notas.
- **Azul (izquierda) y naranja (derecha)**: pareja que distinguen también las personas con daltonismo; además las manos llevan forma (pulgar) y letra (I/D).
- **Contraste medido** (se comprueba en cada ejecución de las pruebas leyendo `estilo.css`):

| Par | Contraste | Mínimo |
|---|---|---|
| Texto / fondo | 16,32:1 | 4,5 |
| Texto suave / superficie | 9,17:1 | 4,5 |
| Azul / fondo · Naranja / fondo | 7,09:1 · 8,48:1 | 4,5 |
| Texto oscuro sobre azul / naranja | 7,09:1 · 8,48:1 | 4,5 |
| Error / superficie | 6,49:1 | 4,5 |
| Borde de control / superficie | 4,13:1 | 3 (era 1,71:1: corregido) |
| Foco / fondo | 12,91:1 | 3 |

### Esquemas (wireframes)

```
Menú                         Canciones                        Partida
┌──────────────────────┐     ┌──────────────────────────┐     ┌────────────────────────────────────┐
│                      │     │ ← Menú   Elige canción    │     │ Título · dificultad   Pts Combo % ❚❚│
│       TUMBAO         │     │ [✓] Jugar con la cámara   │     ├──────────┬─────────┬───────────────┤
│  Pon cada mano...    │     │ ┌──────────────────────┐ │     │          │ │ │ │ │ │  ┌──────────┐ │
│  (I) izq  (D) der    │     │ │ Primer tumbao · 92BPM│ │     │          │ ✋│ │ │ │  │  cámara  │ │
│ [Jugar][Cámara]      │     │ │ [Fácil][Normal][Dif.]│ │     │          │ │ │✋│ │ │  │ (espejo) │ │
│ [Crear][Ajustes]     │     │ └──────────────────────┘ │     │          │─○─○─○─○─│  └──────────┘ │
│ [Cómo se juega]      │     │ ┌──────────────────────┐ │     │          │ I   D   │               │
└──────────────────────┘     │ │ Noche de clave ...   │ │     ├──────────┴─────────┴───────────────┤
                             └──────────────────────────┘     │ Izquierda A S D F · Derecha J K L Ñ │
                                                              └────────────────────────────────────┘
```

## 8. Pruebas de usabilidad y accesibilidad

### Automáticas (en cada ejecución de `pruebas.html`)
- Contraste de 13 pares de colores leídos del CSS real.
- En las 7 pantallas: un solo `h1`, títulos sin saltos de nivel, todos los botones y enlaces con nombre, todos los campos con etiqueta, ningún `tabindex` positivo.
- Componentes: atributos, valores por defecto, eventos.

### Con usuarios (protocolo)

**Participantes:** 5 personas (con 5 se detectan la mayoría de los problemas
según Nielsen), al menos una que no juegue a videojuegos.

**Tareas** (sin ayuda; se anota tiempo, errores y si la completa):

| # | Tarea | Éxito si… |
|---|---|---|
| T1 | Juega "Primer tumbao" en Fácil con el teclado | Termina la canción |
| T2 | Calibra la cámara | Llega a "Guardar y jugar" con las manos bien identificadas |
| T3 | Juega una canción con la cámara | Precisión ≥ 60 % |
| T4 | Pausa la partida sin usar las manos | Usa Esc, la voz o levanta las manos |
| T5 | Haz las notas más lentas | Lo encuentra en Ajustes |
| T6 | Crea una partitura y pruébala | Llega a jugar su partitura |

**Medidas (ISO 9241-11):** eficacia (% de tareas completadas), eficiencia
(tiempo por tarea, errores) y satisfacción (cuestionario **SUS**: 10 preguntas
de 1 a 5; puntuación = suma ajustada × 2,5; > 68 es aceptable).

**Accesibilidad manual:** recorrer todo con el teclado (Tab, Espacio, Esc);
NVDA u Orca en el menú y en Ajustes; zoom al 200 %; modo "reducir
movimiento"; Lighthouse y axe DevTools en Chrome.

**Resultados:** anotar en la tabla de `PLAN-PRUEBAS.md`, sección 3.
