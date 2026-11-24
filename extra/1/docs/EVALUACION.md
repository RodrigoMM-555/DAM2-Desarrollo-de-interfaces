# Tumbao · Relación con la asignatura

**Proyecto extra · Desarrollo de Interfaces (2.º DAM)**
**Autor:** Rodrigo Menéndez Molina

Juego de ritmo en el que se juega con el cuerpo: por cuatro carriles bajan
manos (izquierda azul, derecha naranja) y el jugador coloca **esa** mano en
**ese** carril, a tiempo con la música. La cámara detecta dónde está cada mano
y cuál es cuál. Diseño completo y justificación de tecnologías en
[DISEÑO.md](DISEÑO.md); pruebas en [PLAN-PRUEBAS.md](PLAN-PRUEBAS.md).

## Qué se aplica de cada unidad

### UD01 · Generación de interfaces de usuario
- **Arquitectura:** separación lógica / vista. `motor/` y `entrada/*.js` (lógica pura) no tocan el DOM; `vistas/` y `componentes/` sí. La aplicación (`nucleo/aplicacion.js`) es el **mediador**.
- **Eventos:** teclado (`keydown`/`keyup` con `event.code`), puntero, `visibilitychange`, `hashchange`, eventos propios (`cambiomanos`, `juzgada`, `fin`, `fotograma`).
- **Clases** con campos privados (`#`), getters y métodos, en español.

### UD02 · Generación de interfaces naturales de usuario
- **Partes y movimientos del cuerpo:** MediaPipe HandLandmarker (21 puntos por mano) → centro de la palma → carril (`entrada/camara.js`).
- **Lateralidad:** distinguir mano izquierda y derecha de forma estable con seguimiento por posición, voto acumulado y desempate (`entrada/seguidor-manos.js`), y calibración que corrige cámaras que las dan al revés.
- **Aprendizaje automático:** modelo de MediaPipe ejecutado en el navegador (WebAssembly); la imagen no sale del ordenador.
- **Interacción sin contacto:** pulsar botones dejando la mano quieta (*permanencia*, `entrada/permanencia.js`, `<tb-cursor-mano>`).
- **Problemas reales resueltos:** temblor (filtro One Euro), parpadeo entre carriles (histéresis), retraso de la cámara (medición con metrónomo y compensación en el juez).

### UD03 · Creación de componentes visuales
- Web Components nativos con prefijo `tb-`: `<tb-pista>` (Canvas), `<tb-camara>`, `<tb-cursor-mano>` y las vistas (`tb-vista-*`).
- Shadow DOM, atributos observados (`antelacion`), propiedades, métodos públicos (`dibujar`, `marcar`, `mover`) y eventos (`pulsado`).
- Personalización por variables CSS (`--color-izquierda`, `--color-derecha`).

### UD04 · Diseño de interfaces gráficas
- **Usabilidad:** retroalimentación inmediata (calificación, sonido, punto de posición real), calibración guiada en pasos, prevención de errores (validación de partituras, confirmación al borrar récords), ajustes que se guardan al momento.
- **Accesibilidad (WCAG 2.2 AA):** contraste calculado (tabla abajo), no solo color, teclado completo, foco visible, diálogo modal con fondo `inert`, reducir movimiento, pausa.
- **Estética propia** coherente: variables CSS en `:root`, tipografía del sistema (sin dependencias externas).

| Par de colores | Contraste | Mínimo | |
|---|---|---|---|
| Texto / fondo | 16,32:1 | 4,5 | ✅ |
| Texto suave / superficie | 9,17:1 | 4,5 | ✅ |
| Azul (izquierda) / fondo | 7,09:1 | 4,5 | ✅ |
| Naranja (derecha) / fondo | 8,48:1 | 4,5 | ✅ |
| Texto oscuro / botón principal (azul–naranja) | 7,09–8,48:1 | 4,5 | ✅ |
| Error / superficie | 6,49:1 | 4,5 | ✅ |
| Borde de control / superficie (1.4.11) | 4,13:1 | 3 | ✅ (antes 1,71:1, corregido) |
| Foco / fondo (1.4.11) | 12,91:1 | 3 | ✅ |

Azul y naranja tienen entre sí poco contraste de luminosidad (1,2:1) pero
mucho de tono, y se distinguen también con daltonismo; además las manos
llevan forma distinta (pulgar) y letra (I/D), así que el color nunca es la
única pista (1.4.1).

### UD05 · Creación de informes
- Pantalla de **resultados**: puntuación, precisión, combo máximo, recuento por calificación y nota final; récords por canción y dificultad.

### UD06 · Documentación de aplicaciones
- `README.md` (puesta en marcha, cómo se juega, cómo añadir canciones), `docs/DISEÑO.md` (diseño y justificación), este documento, ayuda dentro del juego ("Cómo se juega") y JSDoc en todo el código.

### UD07 · Distribución de aplicaciones
- Archivos estáticos sin compilación: se publica tal cual en cualquier servidor o en GitHub Pages. Librerías incluidas en `lib/` (no depende de CDN). Partituras exportables en JSON desde el editor.

### UD08 · Realización de pruebas
- 121 pruebas automáticas con un ejecutor propio, datos sintéticos para la cámara, pruebas en navegador con un bot y plan de pruebas manuales ([PLAN-PRUEBAS.md](PLAN-PRUEBAS.md)).

## Tecnologías

HTML5, CSS3, JavaScript (módulos ES + JSDoc), Web Components, Canvas 2D,
Web Audio API (reloj maestro, música generada, metrónomo), `getUserMedia`,
MediaPipe Tasks Vision (HandLandmarker), `localStorage`. Sin frameworks, sin
npm y sin paso de compilación.
