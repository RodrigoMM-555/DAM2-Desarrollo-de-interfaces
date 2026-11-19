# GlyphCraft

Experiencia interactiva de magia gestual: dibuja glifos mágicos con el dedo
índice frente a la cámara, apréndelos en el grimorio y lanza sus hechizos en 3D.

Proyecto de la UD03 *Creación de componentes visuales* (Desarrollo de
Interfaces, 2.º DAM). Además de la aplicación, el repositorio contiene
**glyphcraft-kit**, una biblioteca de 13 Web Components documentada,
probada y empaquetada para reutilizarla en otros proyectos.

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Análisis y planificación | ✅ |
| 2 | Estructura, sistema visual, menú y navegación | ✅ |
| 3 | Cámara y reconocimiento de gestos | ✅ |
| 4 | Glifos: dibujo, grimorio y validación | ✅ |
| 5 | Efectos mágicos 3D | ✅ |
| 6 | Calidad, documentación y empaquetado | ✅ |
| 7 | Progreso, ajustes, laboratorio, sonido y despliegue | ✅ |

## Requisitos

- Un navegador reciente: Chrome, Edge o Firefox (WebGL y cámara).
- Un servidor local cualquiera. No hace falta Node.js ni instalar dependencias.

## Puesta en marcha

Con la extensión **Live Server** de VS Code: clic derecho en `index.html` →
*Open with Live Server*.

También sirve cualquier servidor en `localhost`, por ejemplo:

```bash
python3 -m http.server 8000   # y abre http://localhost:8000
```

No funciona abriendo `index.html` con doble clic (`file://`): el navegador no
carga módulos ES desde archivos locales. La cámara exige `localhost` o `https://`.

## Cómo se juega

| Gesto (frente a la cámara) | Acción |
|---|---|
| Índice levantado, resto de dedos recogidos | Dibuja con la punta del índice |
| Mano **bien** abierta, un instante | Borra el glifo |
| Puño **bien** cerrado, un instante | Sella el glifo (lo evalúa) |

Sin cámara se puede dibujar con el ratón o el dedo y sellar con el botón.

- **Grimorio**: seis glifos con su animación de trazado. Cada uno se practica
  con guía y queda **aprendido tras 3 aciertos**; **dominado** tras 3 en nivel
  Maestro. Niveles: Aprendiz (orden libre, 60 puntos), Artesano (orden y número
  de trazos, 75) y Maestro (orden y sentido, 85).
- **Practicar magia**: se traza de memoria; el círculo reconoce el glifo y, si
  está aprendido, lanza su hechizo en 3D.
- **Laboratorio**: varios símbolos dentro del mismo círculo se combinan; hay
  diez combinaciones con nombre por descubrir.
- **Progreso**: rango, estadísticas, glifos y nueve logros.
- **Ajustes**: cámara, manos (estilo, mano que dibuja, sensibilidad, suavizado,
  tiempos), reconocimiento (nivel, tolerancia), efectos, sonido, pantalla
  completa, exportar/importar copia de seguridad.
- **Calibrar**: traza un círculo cómodo con el índice para fijar tu zona de trazado.
- Atajos en la práctica: <kbd>D</kbd> rendimiento · <kbd>R</kbd> grabar una sesión de manos (JSON).

## Páginas

| Página | Qué es |
|---|---|
| `index.html` | La aplicación |
| `catalogo.html` | Catálogo interactivo de los 13 componentes (generado de `custom-elements.json`) |
| `pruebas.html` | Ejecuta las 274 pruebas en el navegador y muestra el resultado |

## Pruebas

Abre `pruebas.html` con Live Server. Cada archivo `*.prueba.js` se ejecuta en
su propio `<iframe>` (aislado de los demás) y el resultado aparece en la
página. Las pruebas usan la misma API que Vitest (`describe`, `it`, `expect`,
`vi.fn`…), implementada en `pruebas/ejecutor.js`. Al crear un archivo de
pruebas nuevo, añádelo a `pruebas/lista.js`.

Las pruebas de cámara piden permiso para usarla; si se deniega, esas fallan.

## Estructura

```
index.html · catalogo.html · pruebas.html
codigo.js                  Punto de entrada: registra las vistas y arranca la app
estilo.css                 Estilos de la aplicación
nucleo/                    Aplicación (mediador), enrutador y rutas
servicios/                 Ajustes, progreso, logros, sonido, calibración, copia de seguridad
vistas/                    Menú, práctica, grimorio, laboratorio, progreso, ajustes
catalogo/                  Lógica y estilos de catalogo.html
glyphcraft-kit/            Biblioteca reutilizable (ver su README)
  componentes/             13 Web Components, cada uno con sus pruebas
  nucleo/                  Lógica pura: gestos, filtros, geometría, glifos, reconocimiento
  seguimiento/             Fuentes de manos (MediaPipe, reproducción, grabación)
  efectos/                 Hechizos 3D (Three.js, partículas en GPU)
  docs/API.md              Referencia generada del JSDoc
lib/                       Librerías de terceros copiadas en el proyecto
  three/                   Three.js 0.187
  mediapipe/               MediaPipe Tasks Vision 1.2.3 + modelo de manos
  fuentes/                 Cinzel y Cormorant Garamond (licencia OFL)
pruebas/                   Ejecutor de pruebas (ejecutor.js, pagina.js, lista.js)
sesiones/demo.json         Sesión de manos grabada para el modo demostración
```

## Arquitectura en una frase

Los componentes no se conocen entre sí: se comunican por **eventos** y los
coordinan **mediadores** de la aplicación (`nucleo/aplicacion.js` y el puesto
de práctica). La lógica (gestos, reconocimiento) no toca el DOM, así que se
prueba con datos simulados sin cámara. La app importa la biblioteca por su
nombre (`glyphcraft-kit`, `glyphcraft-kit/nucleo`…) gracias al *import map*
de cada HTML, que traduce esos nombres a archivos: no hay paso de compilación.

## Despliegue en GitHub Pages

1. Crea un repositorio y sube el contenido de esta carpeta a su raíz.
2. En **Settings → Pages → Source** elige **GitHub Actions**.
3. Haz push a `main`: `.github/workflows/deploy-pages.yml` publica la carpeta
   tal cual (no hay nada que compilar). Todas las rutas son relativas, así que
   funciona en `https://<usuario>.github.io/<repo>/` sin configurar nada.

La cámara exige un contexto seguro: funciona en `https://` (GitHub Pages) y en
`http://localhost`. El modelo de manos, los archivos WebAssembly y las
tipografías van incluidos: la app no depende de servicios externos.
