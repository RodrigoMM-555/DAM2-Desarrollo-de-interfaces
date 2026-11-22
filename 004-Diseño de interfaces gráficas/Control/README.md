# rocodrigo | Creador de plantillas CSS accesibles (WCAG 2.2)

Proyecto de la **UD04 · Diseño de interfaces gráficas**. Aplicación web para diseñar una plantilla CSS y comprobar al momento si es accesible:

1. **Editor**: colores (fondo, superficie, texto, enlaces, botón con sus estados hover, active y deshabilitado, campos, error, éxito, foco), tipografía (fuente, tamaños, interlineado, peso), forma (radios, bordes, rellenos) y subrayado de enlaces. Cada color se puede escribir en hex o elegir con el selector.
2. **Vista previa en vivo** con componentes reales: se puede pasar el ratón, pulsar y tabular para ver los estados.
3. **Accesibilidad**: barra `<meter>` con «X de N comprobaciones WCAG 2.2 AA cumplen» y la lista de comprobaciones, primero las que fallan.
4. **Mis plantillas**: guardar con nombre en el navegador, cargar, borrar, y dos plantillas de partida (rocodrigo y Neutra).
5. **Exportar**: copiar o descargar el `.css` con las variables y los estilos de los componentes.
6. La propia aplicación cumple lo que comprueba.

Hecha solo con HTML5, CSS3 y JavaScript, sin librerías ni dependencias externas (tampoco fuentes de internet).

## Ejecutar

- Abre `index.html` con doble clic, o
- copia la carpeta en `htdocs` de Apache y entra en `http://localhost/<carpeta>/`.

Las pruebas automáticas están en `tests.html` (se abren igual).

## Estructura

```
Control/
├── index.html            el creador: mis plantillas, editor, accesibilidad, vista previa, exportar
├── tests.html            pruebas automáticas de las funciones sin DOM
├── README.md             este documento
├── css/
│   └── estilo.css        estilos de la app (paleta rocodrigo, estados, foco de dos tonos, media query)
└── js/
    ├── contraste.js      sin DOM · fórmulas WCAG: luminancia, ratio, texto grande, contraste exigido
    ├── comprobaciones.js sin DOM · recibe una plantilla y devuelve sus comprobaciones y avisos
    ├── generador.js      sin DOM · convierte una plantilla en CSS (vista previa y exportación)
    ├── comun.js          ayudas de interfaz: validación, CUMPLE/NO CUMPLE, selector de color ↔ hex
    ├── editor.js         edición en vivo: lee el editor y pinta vista previa, barra y CSS
    └── almacen.js        mis plantillas (localStorage) y exportar (copiar y descargar)
```

## Cómo funciona

- **Una plantilla es un objeto** cuyas claves son los nombres de las variables CSS: `{ "color-fondo": "#EDF4F2", "tamano-base": 16, ... }`.
- **Cada control del editor tiene `name` igual a su variable.** `editor.js` recorre el formulario y monta el objeto sin una lista aparte.
- **El mismo CSS para todo:** `generarCss(plantilla, "#vista")` da estilo a la vista previa (dentro de un `<style>` que se reescribe con cada cambio) y `generarCss(plantilla, "")` es el archivo exportado. Lo que ves es exactamente lo que descargas.
- **Px en el editor, rem en el CSS** (16 px = 1 rem), para que la plantilla exportada crezca con el zoom del navegador.
- **En vivo:** el evento `input` actualiza todo con cada tecla. Los errores se muestran en `change` (al pulsar Intro o salir del campo) para no interrumpir mientras se escribe. Si un campo tiene error, la vista previa sigue usando su último valor válido.
- La plantilla **rocodrigo** son los valores escritos en el HTML (se recupera con `form.reset()`). La **Neutra** está en `almacen.js`.

## Qué se comprueba

Cuentan en la barra (WCAG 2.2, nivel AA):

| Criterio | Comprobaciones | Mínimo |
|---|---|---|
| **1.4.3** Contraste | Texto, texto secundario y enlaces sobre fondo y sobre superficie; texto escrito en los campos; mensajes de error y de éxito; texto del botón en normal, hover y active | 4,5:1, o 3:1 si el texto es grande (≥ 24 px, o ≥ 18,66 px en negrita) |
| **1.4.11** Contraste no textual | Borde de los campos (normal y hover); foco sobre fondo y sobre superficie | 3:1 |
| **1.4.1** Uso del color | Solo si los enlaces **no** van subrayados: enlace frente al texto | 3:1 |
| **2.5.8** Tamaño del objetivo | Altura de botones y campos = tamaño base × interlineado + 2 × relleno + 2 × borde | 24 px |

Recomendaciones que **no** cuentan en la barra (avisos):

- Texto base de menos de 16 px.
- Interlineado de menos de 1,5.
- Foco de menos de 2 px (2.4.13 es nivel AAA).
- Botón deshabilitado con poco contraste (WCAG no lo exige).

Los títulos usan el color del texto y son más grandes que el texto base, así que si el texto cumple, los títulos también.

## Fórmula

- Cada canal (0-255) se pasa a 0-1 y se linealiza: `c / 12,92` si `c ≤ 0,04045`; si no, `((c + 0,055) / 1,055) ^ 2,4`.
- Luminancia relativa: `L = 0,2126 R + 0,7152 G + 0,0722 B`.
- Ratio: `(L1 + 0,05) / (L2 + 0,05)`, con L1 la mayor.
- Se compara el ratio **sin redondear** (4,499 no cumple 4,5).

| Par | Ratio | Resultado |
|---|---|---|
| #FFFFFF sobre #1565C0 | 5,75:1 | Cumple |
| #5A5F66 sobre #E3E6EA | 5,14:1 | Cumple |
| #BDBDBD sobre #FFFFFF | 1,88:1 | No cumple |
| #FFB300 sobre #FFFFFF | 1,79:1 | No cumple (1.4.11 exige 3:1) |
| #000000 sobre #FFFFFF | 21:1 | Cumple |

## Colores de la app y ajustes de accesibilidad

| Color | Uso en la app | Contraste |
|---|---|---|
| Tinta #172033 | texto general sobre fondo #EDF4F2 | 14,58:1 |
| Secundario #5B6678 | ayudas y pie | 5,81:1 sobre blanco |
| Petróleo #31817B | botón principal (texto blanco) y borde de campos | 4,61:1 |
| Petróleo profundo #20544F | cabecera, hover, anillo exterior del foco | 8,60:1 con blanco |
| Vino #702B3D | botón de borrar | 9,99:1 sobre blanco |
| Amarillo #F8CF69 | línea de la cabecera, anillo interior del foco, avisos | decorativo |
| Error #B34B43 | mensajes y borde de error | 5,24:1 sobre blanco |

Ajustes respecto a la librería de componentes rocodrigo:

- **Foco:** el turquesa #79E5DC daba 1,49:1 sobre blanco. Se sustituye por un foco de dos tonos: anillo amarillo interior + anillo petróleo profundo exterior.
- **Borde de campos:** #D5E2E2 daba 1,33:1. Se usa petróleo #31817B; #D5E2E2 queda solo para el borde decorativo de los grupos.
- **Texto secundario:** #5B6678 (5,81:1) en lugar de #667085 (4,97:1).
- **Amarillo** nunca como texto sobre blanco (1,49:1).

## Criterios WCAG 2.2 aplicados en la app

| Criterio | Nivel | Dónde se cumple |
|---|---|---|
| **1.3.1** Información y relaciones | A | HTML semántico: `header`, `main`, `section` con `h2`, `footer`; cada campo con su `label for`; grupos del editor en `fieldset` + `legend`; plantillas en `optgroup`. |
| **1.4.1** Uso del color | A | CUMPLE / NO CUMPLE con texto, icono y color; errores con texto y borde; la barra lleva su texto al lado. |
| **1.4.3** Contraste (mínimo) | AA | Todos los textos de la app superan 4,5:1 (ver tabla de colores). |
| **1.4.4** Cambio de tamaño del texto | AA | Tamaños en `rem`; una sola columna en pantallas estrechas. El CSS exportado también usa `rem`. |
| **1.4.11** Contraste no textual | AA | Bordes de campos, selectores y botones (4,61:1), etiquetas CUMPLE/NO CUMPLE y anillo de foco (8,60:1) superan 3:1. |
| **2.1.1** Teclado | A | Solo controles nativos; orden de tabulación = orden del código, sin `tabindex` positivos; el foco no se pierde al borrar una plantilla. |
| **2.4.7** Foco visible | AA | `:focus-visible` con anillo de dos tonos en `css/estilo.css` (sección 3). |
| **2.5.8** Tamaño del objetivo (mínimo) | AA | Botones, campos y selectores miden más de 24 px de alto; la casilla mide 1,5 rem (24 px). |
| **3.3.1** Identificación de errores | A | Campo con `aria-invalid="true"`, borde y fondo de error, y mensaje que empieza por «Error:». |
| **3.3.3** Sugerencias ante errores | AA | El mensaje dice qué falla y cómo corregirlo: «… debe ser # seguido de 6 caracteres del 0 al 9 o de la A a la F, por ejemplo #1565C0» o «… debe ser un número entre 10 y 40». |
| **4.1.2** Nombre, función, valor | A | Controles nativos con nombre visible; cada selector de color con nombre propio («Elegir fondo del botón»); `<meter>` con su `<label>`; errores con `role="alert"`, confirmaciones con `role="status"` y resumen de la barra con `aria-live="polite"`. |

## Principios ISO 9241-110 aplicados

| Principio | Cómo se aplica |
|---|---|
| Adecuación a la tarea | Todo lo necesario para crear una plantilla en una sola pantalla: editar, ver, comprobar, guardar y exportar. |
| Autodescriptividad | Cada campo con etiqueta y unidad (px); la lista dice el criterio, el valor obtenido y el mínimo exigido. |
| Conformidad con las expectativas | Controles nativos, selector de color del sistema, colores habituales (verde correcto, rojo error), borrar en otro color. |
| Controlabilidad | El usuario elige cómo introducir cada color (hex o selector), carga, guarda y borra cuando quiere, y puede cancelar las acciones destructivas. |
| Tolerancia a errores | Validación con mensaje claro, el error no rompe la vista previa (usa el último valor válido), confirmación antes de borrar o sustituir una plantilla. |
| Facilidad de aprendizaje | Plantillas de partida para empezar, vista previa inmediata y las comprobaciones que fallan primero. |

## Cómo auditarla

**Lighthouse** (Chrome): F12 → pestaña *Lighthouse* → marcar solo *Accessibility* → *Analyze page load*. Objetivo: 100.

**axe DevTools** (extensión de Chrome/Firefox): F12 → pestaña *axe DevTools* → *Scan all of my page*. Objetivo: 0 problemas con la plantilla rocodrigo cargada. Ojo: si cargas una plantilla que falla, axe también marcará la **vista previa**, porque está mostrando esos colores a propósito.

**Solo teclado:**

1. Tab recorre: plantilla → Cargar → (Borrar) → nombre → Guardar → cada campo del editor seguido de su selector → casilla y desplegables → vista previa (enlaces, campos, botón) → código CSS → Copiar → Descargar.
2. En el editor, cambia «Fondo del botón en hover» a `#79E5DC`: la barra baja y aparece «✖ NO CUMPLE 1.4.3 · Botón en hover».
3. Escribe `#12` en un color y pulsa Intro: aparece el error y la vista previa no se rompe.
4. Llega con Tab al botón de la vista previa: se ve el foco de la plantilla.
5. Guarda una plantilla, cárgala y bórrala: la confirmación se cancela con Esc.
6. El foco de la app se ve siempre.

**Pruebas automáticas:** `tests.html` debe mostrar «✔ 56 de 56 pruebas superadas».
