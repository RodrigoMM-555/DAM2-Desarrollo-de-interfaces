# jocarsa · subunidad 007 integrada v3

Proyecto integrado de componentes, plantillas, orígenes de datos y eventos.

## Demostraciones

- `index.html`: aplicación integrada con menús, fichas, tabla, formulario dinámico, drag & drop, columnas minimizables y separadores redimensionables.
- `login.html`: pantalla de login jocarsa-iu. Busca `jocarsa.png` en la raíz del proyecto y la usa como fondo a pantalla completa.
- `formularios.html`: catálogo demostrativo de formularios y controles.
- `toasts.html`: demostración independiente de mensajes toast success/info/warning/danger.

## Fondo del login

Coloca la imagen con este nombre exacto:

`jocarsa.png`

en la raíz del proyecto, junto a `index.html` y `login.html`.

## Ejecución

Como el proyecto usa `fetch()` para los orígenes JSON, servir por HTTP:

`python3 -m http.server 8000`

Abrir `http://localhost:8000/`.


## Refactorización de código

Esta versión mantiene la estructura visual y funcional de la versión 5, pero presenta HTML, templates, CSS, JSON y JavaScript en formato legible y no minificado.

El JavaScript de control se ha reorganizado con programación orientada a objetos. El namespace conceptual solicitado es `jocarsa | iu`; como el carácter `|` es un operador de JavaScript y no puede formar parte de un identificador, el namespace técnico utilizado es:

