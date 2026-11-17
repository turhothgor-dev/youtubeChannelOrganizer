# Plan: gui-8-2 · Editor de grupos con nombre legible y acciones de icono

**Estado:** aprobado (2026-11-17)

Issue: correcciones 4 y 5 de la persona tras probar en Firefox (2026-11-17). Índice:
[gui-8](2026-11-17-gui-8-guia-y-editor.md). Depende de T1 de
[gui-8-1](2026-11-17-gui-8-1-guia-y-menu.md) (iconos `arrow-up`, `arrow-down`, `edit`, `palette`, `delete`, `swap` y
`add` en `UI_ICON_PATHS`). Sin ADR: no cambia estructura ni decisiones (ADR 0014 sigue igual).

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

En el árbol del editor (`options/options.js`, `buildNode`) cada fila (`.options__row`, `display: flex`) lleva asa,
plegar, icono, nombre (`.options__name`, `flex: 1; overflow-wrap: anywhere`), contador y siete botones de texto
(`actionButton`: Renombrar, Icono y color, + Subgrupo, Subir, Bajar, Mover a…, Eliminar). Los botones ocupan casi todo
el ancho y el nombre se encoge hasta una letra por línea.

Decisión:

- **Nombre**: es el hueco flexible principal: `.options__name { flex: 1 1 12rem; min-width: 8rem; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; }` (sin `overflow-wrap: anywhere`), con `title` = nombre completo. El
  contador (`.options__count`) y las acciones (`.options__actions`) son `flex: none` y `white-space: nowrap`. La fila
  pasa a `flex-wrap: wrap` y el selector "Mover a…" (`.options__move`) ocupa una línea propia (`flex-basis: 100%`)
  bajo la fila; el campo de renombrar (`.options__editor`) es `flex: 1 1 12rem; min-width: 8rem`.
- **Acciones solo icono**, en este orden: Subir (`arrow-up`), Bajar (`arrow-down`), Renombrar (`edit`), Icono y color
  (`palette`), Eliminar (`delete`), Mover a… (`swap`) y, al final, Añadir subgrupo (`add`). Con búsqueda activa siguen
  sin aparecer Subir, Bajar y Mover a… (como hoy). Nueva función `iconButton(iconId, label, onClick)` en
  `options.js`: `<button type="button" class="options__action options__action--icon">` con
  `YouTubeGroupsIconsDom.createUiIconSvg(iconId, 18)` (ya cargado por `options.html`), `aria-label` y `title` =
  `label` (los textos de siempre: "Subir", "Bajar", "Renombrar", "Icono y color", "Eliminar", "Mover a…" y "Añadir
  subgrupo", este último antes "+ Subgrupo"). Botón de 28 × 28 px, icono con `currentColor`, mismo aspecto
  deshabilitado. Mismo comportamiento y atajos de teclado (Alt+↑/↓, F2, Supr, Intro/Espacio, doble clic).
- `actionButton` sigue para los botones con texto ("Mover"/"Cancelar" del selector, "Deshacer", la barra del panel
  "Canales"), que no cambian.
- **Asa** `⠿`: igual.
- **Tests de DOM del editor**: hoy no hay (6-1, 6-2 y 6-15 los dejaron fuera). Se añade un ayudante que carga
  `options/options.html` en jsdom con sus scripts, para poder comprobar orden, nombres accesibles y comportamiento.

## Tareas

- [x] T1 · Ayudante de tests para la página de opciones · Ficheros: `tests/helpers/load-dom.js`,
  `tests/ui-options.test.js` · Alcance: `loadOptionsDom({ store })` (o `optionsPage()` que devuelva `{ html,
  scripts }` para `loadDom`) lee `options/options.html`, toma el contenido de `<body>` sin `<script>` y las rutas de
  sus `<script src>` (relativas a la raíz, como el test de `manifest.test.js`), y llama a `loadDom` con una URL
  `https:` (con un origen opaco como `moz-extension:` jsdom lanza al leer `sessionStorage`). · Test (jsdom): con A
  (subgrupo A1) y B, el árbol pinta tres filas `[role="treeitem"]` con los nombres A, A1, B y el resumen "3 grupos".
- [x] T2 · Acciones de fila solo icono y nuevo orden · Ficheros: `options/options.js`, `options/options.css`,
  `tests/ui-options.test.js` · Test (jsdom): en la fila de A, los `aria-label` de `.options__actions button` son, en
  orden, "Subir", "Bajar", "Renombrar", "Icono y color", "Eliminar", "Mover a…", "Añadir subgrupo"; cada botón tiene
  `title` igual, un `svg` y ningún texto; "Subir" de A está deshabilitado y "Bajar" de A mueve A tras B en el
  almacenamiento; "Renombrar" abre el campo con el nombre; "Añadir subgrupo" abre un campo de creación dentro de A;
  "Eliminar" quita A y muestra el aviso con "Deshacer"; con búsqueda "a1" la fila de A1 no tiene Subir, Bajar ni Mover
  a…; F2 sobre la fila sigue abriendo renombrar.
- [x] T3 · Nombre con espacio flexible y elipsis · Ficheros: `options/options.js`, `options/options.css`,
  `tests/ui-options.test.js` · Test (jsdom): `.options__name` de un grupo "Ciencia y tecnología divulgativa" tiene
  `title` igual a su nombre; el resto es CSS (V1 y V2).
- [ ] T4 · Cerrar · Ficheros: `docs/ARCHITECTURE.md` (fila de `options/` y flujo "Editor de grupos": acciones de icono;
  fila de `tests/` con `ui-options.test.js`), este plan a `hecho` · Test: `make lint`, `make test` y V1 a V4.

### Verificación manual (Firefox, editor abierto en una ventana de 1280 px y luego de 800 px)

- V1 · Un grupo "Ciencia y tecnología divulgativa" se lee en una línea (o con "…" y el nombre completo al pasar el
  cursor); las filas no son más altas que una línea de texto; las acciones quedan alineadas en columna entre filas.
- V2 · A 800 px (editor en una columna) el nombre sigue mostrando al menos 2-3 palabras.
- V3 · Cada icono muestra su nombre al pasar el cursor; con teclado (Tab) se recorren en el orden Subir, Bajar,
  Renombrar, Icono y color, Eliminar, Mover a…, Añadir subgrupo; el selector de icono se abre junto a su botón;
  "Mover a…" aparece debajo de la fila.
- V4 · Tema claro y oscuro: los iconos se ven con el color del texto; deshabilitados, atenuados.

## Criterios de aceptación

- El nombre de cada grupo tiene el espacio principal de la fila: se leen al menos 2-3 palabras en horizontal y, si no
  cabe, termina en "…" con el nombre completo en el `title`.
- Las acciones de cada fila son solo icono, con nombre accesible y `title`, en el orden subir, bajar, renombrar,
  icono y color, eliminar, mover a y añadir subgrupo, y hacen lo mismo que antes, también con teclado.

## Fuera de alcance

- Los botones de texto del selector "Mover a…", del aviso "Deshacer" y del panel "Canales" (Quitar, Copiar a…, Mover
  a…).
- La banda de color de la fila del editor (sigue en el borde derecho de la fila).
- Cambiar la lógica de `modules/group-editor.js`.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-17 | T1 | `test: ayudante loadOptionsDom y test del árbol del editor` | `optionsPage()` y `loadOptionsDom()` en `tests/helpers/load-dom.js`; test inicial en `tests/ui-options.test.js`. |
| 2026-11-17 | T2 | `feat: acciones de fila del editor solo con icono y nuevo orden` | `iconButton` en `options.js`, estilos `.options__action--icon` y 7 tests de DOM. |
| 2026-11-17 | T3 | `feat: nombre de grupo con espacio flexible y elipsis en el editor` | `title` en `.options__name`; CSS con fila `flex-wrap`, nombre con elipsis y "Mover a…" en línea propia; 1 test. |
