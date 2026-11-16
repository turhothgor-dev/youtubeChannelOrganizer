# Plan: iconos de grupo con Mozilla fxemoji

**Estado:** borrador

Issue: feature menor pedida por la persona (2026-11-16): usar los iconos de Mozilla fxemoji
(<https://github.com/mozilla/fxemoji>) para los grupos en lugar de los actuales.

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

### Qué hay hoy

Los commits "feat(icons) adding icons WIP" (44e256d) e "icon showed" (7c20bf1) crearon `modules/icons.js` y el
selector de iconos; el plan `2026-11-14-fase2-iconos-vistos` los terminó. Hoy:

- `ICON_SET` (`modules/icons.js`) tiene 12 iconos `{ id, label, path }` de **una sola ruta** monocroma en un
  `viewBox` 24×24 (estilo Material). `getIconPath(id)` devuelve esa ruta.
- `createIconSvg(iconId, size)` (`content.js`) crea un `<svg>` con **un** `<path>` y `fill="currentColor"`; el
  color del grupo (o el heredado, `getGroupAppearance`) se aplica con `chip.style.color`. Lo usan la marca de grupo
  (`createGroupMark`, en guía, panel y selectores de casillas), la rejilla y la vista previa del selector
  (`createIconPicker`) y el formulario de crear grupo de la guía.
- El grupo guarda solo el **id** del icono (`icon: "tech"`, ADR 0001). `isValidIconId` descarta ids desconocidos
  al leer (`getGroupAppearance`) y al importar copias (`backup.js`).
- Los iconos de interfaz (`UI_ICON_PATHS`: `eye`, `check`, `playlist-add`) son aparte y no cambian.

### fxemoji: licencia y formato (consultado en el repo, rama `gh-pages`)

- **Licencia**: el dibujo es **CC BY 4.0**; el código del repo, Apache 2.0 (no lo usamos). CC BY 4.0 exige
  reconocer la autoría (Mozilla Foundation), enlazar la licencia e indicar si hubo cambios. Es compatible con
  distribuir la extensión en AMO.
- **Formato**: un SVG por emoji en `svgs/FirefoxEmoji/u<codepoint>-<nombre>.svg` (p. ej. `u1F3B5-musicalnote.svg`),
  `viewBox="0 0 512 512"`, exportado de Illustrator. **Multicolor**: varios `<path>`/`<circle>` (a veces dentro de
  `<g>`) con `fill="#rrggbb"` en línea, sin `<style>`, clases, degradados ni `transform` en los ejemplos vistos.
  Ocupan 1–4 KB.
- **Mantenimiento**: último commit en marzo de 2019; sin cambios previsibles, así que copiar los ficheros no tiene
  coste de seguimiento.

### Decisiones

1. **Empaquetados como datos JS, no como ficheros cargados en tiempo de ejecución.** Los SVG originales se copian
   sin modificar en `vendor/fxemoji/` (fuera del `.xpi`, como referencia y para el test). Lo que se empaqueta es un
   script clásico nuevo, `modules/fxemoji-data.js` (`YouTubeGroupsFxemoji`), con cada icono como
   `{ codepoint, file, viewBox, shapes: [{ tag, attrs }] }`. `createIconSvg` construye las formas con
   `createElementNS` y `setAttribute` (sin `innerHTML`, como hoy). La extensión sigue sin hacer peticiones de red.
   - Se descarta `<img src="moz-extension://…">`: exige `web_accessible_resources` para `youtube.com`, que expone
     los ficheros a la página.
   - Se descarta `fetch(runtime.getURL(...))` + `DOMParser`: asíncrono en código de pintado síncrono (guía, panel,
     casillas) y también necesita los recursos accesibles.
   - Se descarta un script generador que escriba `fxemoji-data.js`: las reglas del proyecto no permiten scripts que
     escriban ficheros. El módulo se escribe con la herramienta de edición y un **test** comprueba que coincide con
     los SVG de `vendor/` (ver T2).
2. **Mismos ids, sin migración de almacenamiento.** Los 12 ids actuales se conservan y cada uno pasa a pintarse con
   un emoji de fxemoji. Los grupos guardados, las copias de seguridad exportadas y el formato del ADR 0001 no cambian;
   no sube `version`. Los ids desconocidos ya se tratan como "sin icono". Correspondencia (el implementador confirma
   que el fichero existe en `svgs/FirefoxEmoji/`; si no, elige el más cercano y lo anota en **Cambios aprobados**):

   | id | Etiqueta | Emoji | Fichero (prefijo) |
   | --- | --- | --- | --- |
   | `tech` | Tecnología | 💻 | `u1F4BB` |
   | `music` | Música | 🎵 | `u1F3B5` |
   | `news` | Noticias | 📰 | `u1F4F0` |
   | `gaming` | Gaming | 🎮 | `u1F3AE` |
   | `sports` | Deportes | ⚽ | `u26BD` |
   | `education` | Educación | 🎓 | `u1F393` |
   | `food` | Comida | 🍴 | `u1F374` |
   | `travel` | Viajes | ✈️ | `u2708` |
   | `art` | Arte | 🎨 | `u1F3A8` |
   | `science` | Ciencia | 🔬 | `u1F52C` |
   | `movie` | Cine | 🎬 | `u1F3AC` |
   | `default` | Genérico | 🏷️ (o 📁 `u1F4C1` si no existe) | `u1F3F7` |

3. **El color ya no tiñe el icono.** Los emoji son multicolor; se pintan con sus colores. El campo `color` se
   mantiene (herencia incluida): sin icono, sigue siendo el punto de color; con icono, se muestra como un aro de 2 px
   alrededor del icono (`box-shadow` con el color resultante), en la guía, el panel, las casillas y la vista previa
   del selector. Se descarta quitar el color: cambiaría el formato y el selector sin necesidad.
4. **Formas admitidas** (lista blanca, la comprueba el test): etiquetas `path`, `circle`, `ellipse`, `rect`,
   `polygon`, `polyline`; atributos `d`, `cx`, `cy`, `r`, `rx`, `ry`, `x`, `y`, `width`, `height`, `points`,
   `fill`, `fill-rule`, `opacity`. Los `<g>` se aplanan (sin atributos que heredar). Si un SVG elegido trae
   degradados, `transform`, `<use>` o `<style>`, se elige otro emoji en lugar de ampliar la lista.
5. **Atribución**: fichero `THIRD_PARTY_NOTICES.md` en la raíz, **incluido en el paquete**, con autoría, enlace a
   CC BY 4.0, enlace al repo y la nota "convertidos de SVG a datos JavaScript sin cambiar el dibujo". La misma
   línea va en la cabecera de `modules/fxemoji-data.js` y en una sección "Créditos" del `README.md`.

Decisión de arquitectura (recurso de terceros empaquetado y patrón "datos copiados + test de coincidencia"): ADR
propuesto en `docs/adr/0013-iconos-fxemoji-empaquetados.md`.

## Tareas

Cada tarea es del tamaño de un commit, toca pocos ficheros y tiene un test que la valida.

- [ ] T1 · Copiar los 12 SVG de `svgs/FirefoxEmoji/` (rama `gh-pages`, sin modificarlos, con su nombre original)
  a `vendor/fxemoji/`; crear `THIRD_PARTY_NOTICES.md` (decisión 5) y la sección "Créditos" de `README.md`; añadir
  `vendor` a `ignoreFiles` de `web-ext-config.mjs` (`THIRD_PARTY_NOTICES.md` **no** se ignora) · Ficheros:
  `vendor/fxemoji/*.svg`, `THIRD_PARTY_NOTICES.md`, `README.md`, `web-ext-config.mjs` · Test: `make lint` y
  `make build`; la lista del `.xpi` contiene `THIRD_PARTY_NOTICES.md` y no contiene `vendor/`.
- [ ] T2 · Módulo de datos y test de coincidencia: `tests/helpers/svg-shapes.js` (función pura
  `parseSvgShapes(text)` → `{ viewBox, shapes }`, aplana `<g>`, ignora prólogo, DOCTYPE y comentarios, falla con
  etiquetas o atributos fuera de la lista blanca); `modules/fxemoji-data.js` con `YouTubeGroupsFxemoji.ICONS`
  (objeto congelado indexado por id de icono, decisión 2) y la cabecera de atribución; cargarlo **antes** de
  `modules/icons.js` en `manifest.json` y en `tests/helpers/load-modules.js` · Ficheros: los citados y
  `tests/fxemoji.test.js` · Test: `tests/fxemoji.test.js`: (a) cada entrada coincide en `viewBox` y `shapes` con
  `parseSvgShapes` de `vendor/fxemoji/<file>`; (b) solo etiquetas y atributos de la lista blanca, `fill` en
  `#rrggbb` o `none`; (c) hay una entrada por cada id de la tabla de la decisión 2.
- [ ] T3 · `icons.js` y `createIconSvg` con fxemoji: `ICON_SET` pasa a `{ id, label, codepoint }` (sin `path`);
  `getIconPath` se sustituye por `getIconGraphic(id)` → `{ viewBox, shapes }` o `null` (lee de
  `YouTubeGroupsFxemoji`); `createIconSvg` (`content.js`) crea una forma por entrada, con `aria-hidden="true"` y sin
  `fill="currentColor"`. `UI_ICON_PATHS` y `createUiIconSvg` no cambian. En `tests/icons.test.js` el test "toda
  ruta de ICON_SET es una ruta SVG con cierre" se **sustituye** (el contrato de `path` desaparece, no se relaja) por
  "todo id de ICON_SET tiene gráfico", y `getIconPath` por `getIconGraphic` en "isValidIconId…" y
  "getUiIconPath…" · Ficheros: `modules/icons.js`, `content.js`, `tests/icons.test.js` · Test:
  `tests/icons.test.js`, más uno nuevo: "los ids guardados por la versión anterior siguen siendo válidos" (los 12
  ids escritos a mano: `isValidIconId` verdadero y `getIconGraphic` no nulo), y en `tests/groups.test.js` que
  `getGroupAppearance` de un grupo guardado con `icon: "tech"` y color sigue devolviendo `{ icon: "tech", color }`.
- [ ] T4 · Color como aro con icono (decisión 3): `createGroupMark` y `updatePreview` del selector ponen el color
  resultante en una propiedad CSS (`--yg-group-color`) en lugar de `style.color`; `content.css` dibuja el aro
  (`.youtube-groups__icon--ringed`), redondea el chip y, en `html[dark]`, le da un fondo claro tenue para que los
  emoji con tonos oscuros (p. ej. el mando de `gaming`) se distingan. El botón "Heredar" del selector no cambia ·
  Ficheros: `content.js`, `content.css` · Test: `make lint`, `make test` y a mano V1–V4.
- [ ] T5 · Documentación: ADR 0013 a `aceptada`; `docs/ARCHITECTURE.md` (fila de `modules/fxemoji-data.js`, fila
  de `modules/icons.js` con `getIconGraphic`, orden de carga, `vendor/` y `THIRD_PARTY_NOTICES.md`); plan a
  `hecho` · Ficheros: `docs/adr/0013-iconos-fxemoji-empaquetados.md`, `docs/ARCHITECTURE.md`, este plan · Test:
  `make lint` (incluye formato Markdown).

### Verificación manual (Firefox con sesión iniciada, extensión cargada en `about:debugging`)

- V1 · Con grupos creados **antes** del cambio (con y sin icono, con y sin color, subgrupos que heredan color):
  tras recargar la extensión, cada grupo con icono muestra el emoji equivalente, sin tocar nada; los grupos sin icono
  y con color siguen mostrando el punto.
- V2 · Selector de iconos (crear grupo desde la guía): la rejilla muestra los 12 emoji en color; elegir uno y un
  color: la vista previa y, tras guardar, la guía muestran el emoji con el aro del color.
- V3 · Tema claro y oscuro: los 12 emoji se distinguen en la guía, el panel y los desplegables de casillas.
- V4 · Exportar una copia de seguridad hecha antes del cambio e importarla: los iconos se conservan.
- V5 · Herramientas de red del navegador al abrir la guía: ninguna petición por iconos.

## Criterios de aceptación

- Los grupos muestran iconos de fxemoji (multicolor) en la guía, el panel, los desplegables de casillas y el selector.
- Los grupos y copias de seguridad existentes conservan su icono sin ninguna acción de la persona ni migración de
  datos.
- El color elegido para un grupo sigue viéndose (aro con icono, punto sin icono) y se sigue heredando.
- La extensión no hace peticiones de red para pintar iconos ni expone recursos a la página.
- El paquete incluye el aviso de licencia CC BY 4.0 de fxemoji; `make lint` sin avisos nuevos.

## Fuera de alcance

- Ampliar el catálogo de iconos más allá de los 12 actuales o añadir búsqueda en el selector (se puede hacer después
  añadiendo ids; el formato lo admite).
- Cambiar los iconos de interfaz de los botones (`eye`, `check`, `playlist-add`).
- Cambiar el formato de almacenamiento (ADR 0001) o la lógica de herencia de `getGroupAppearance`.
- Rediseñar el selector de iconos o la pantalla de edición de grupos (`ROADMAP.md`).
- Textos de la ficha de AMO.

## Casos límite

- Grupo guardado con un id que no existe (datos corruptos o futuros): "sin icono", como hoy.
- SVG de fxemoji con elementos fuera de la lista blanca: se elige otro emoji (el test de T2 lo detecta).
- Emoji ausente en fxemoji (p. ej. `u1F3F7`): alternativa de la tabla, anotada en **Cambios aprobados**.
- Tamaños pequeños (16–20 px): los emoji de 512×512 se escalan con `viewBox`; revisar legibilidad en V3.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
