# Plan: Fase 6 (1/2 del editor) · Editor de grupos en la página de opciones: árbol

**Estado:** aprobado (2026-11-17)

Issue: `ROADMAP.md`, Fase 6: "Editor de grupos en una página propia" (antes "Pendiente": pantalla para editar grupos
y subgrupos). Hoja de ruta: `docs/plans/2026-11-17-fase6-hoja-de-ruta.md`. ADR:
[0014](../adr/0014-pagina-de-opciones-editor-de-grupos.md).

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

Serie: **este plan** (árbol de grupos) → `2026-11-17-fase6-2-editor-de-canales.md` (canales del grupo y búsqueda).
Requisito: ninguno; conviene haber hecho antes la T1 de la hoja de ruta (sección Fase 6 en `ROADMAP.md`).

## Contexto y decisión

Hoy no se puede renombrar, borrar, cambiar el icono o el color, ni mover un grupo o subgrupo después de crearlo: la
sección de la guía solo filtra y crea, y `promptRenameGroup`/`confirmDeleteGroup` (`ui/panel.js`) y `renameGroup`,
`deleteGroup`, `deleteSubGroup`, `setGroupAppearance` (`modules/groups.js`) están sin enlazar. Decidido con la persona
("usa lo recomendado", 2026-11-17), con el detalle en el ADR 0014:

- El editor es la **página de opciones** de la extensión, en una pestaña propia. Se abre con un botón "Editar grupos"
  en la cabecera del panel flotante y en la cabecera de la sección de la guía (mensaje a un `background.js` mínimo que
  llama a `runtime.openOptionsPage()`), y desde `about:addons`.
- Muestra el **árbol de grupos** con: renombrar en línea, icono y color con el selector existente (`ui/icon-picker.js`), crear grupo y subgrupo, **mover y reordenar** (arrastrar y soltar, con alternativa de botones
  "Subir", "Bajar", "Mover a…" y teclado) y **borrar** con aviso del número de subgrupos y canales y "Deshacer"
  durante 10 s, sin `confirm`.
- Borrar un grupo con subgrupos borra todo su subárbol (como hoy `removeGroupById`).
- La lógica nueva es pura y va en `modules/group-editor.js`, con tests `node --test`. Las escrituras, en
  `withLock` (ADR 0005). La página escucha `storage.onChanged` (ADR 0006); las pestañas de YouTube ya repintan.

Se descarta: modal dentro de YouTube, popup y barra lateral (ADR 0014). Se descarta también pedir confirmación al
borrar: "Deshacer" protege igual y no interrumpe. Trasladar Ajustes y copias de seguridad a la página no es barato
(cachés y secuencias de `content.js`, `watched.js` depende del origen): queda para el plan 6-11.

### Decisiones

**Lógica pura** en `modules/group-editor.js` (`YouTubeGroupsEditor`, script clásico sin DOM, se carga tras
`groups.js`; no entra en los content scripts). Ninguna función muta la entrada; "lugar" = `{ parentId, index }`, con
`parentId` `null` para el primer nivel e `index` relativo a la lista de destino **sin** el grupo movido.

- `findGroupLocation(groups, id)` → `{ parentId, index, siblingCount }` o `null`.
- `moveGroup(groups, groupId, parentId, index)` → `{ groups, changed }`. `index` se acota a `[0, longitud]`. Lanza
  `Error` si el grupo o el padre no existen o si el padre es el propio grupo o un descendiente. El grupo movido queda
  con `type: "group"` y sin `parentId` en el primer nivel, o `type: "subgroup"` y `parentId` del nuevo padre; sus
  descendientes no cambian. `changed` es `false` si queda en el mismo lugar.
- `getSiblingMove(groups, groupId, delta)` → lugar para subir (`-1`) o bajar (`+1`) entre hermanos, o `null` en los
  extremos.
- `getMoveTargets(groups, groupId)` → `[{ id, name, level, current }]`: primero `{ id: null, name: "Primer nivel",
  level: 0 }` y después el árbol aplanado en preorden (`level` + 1) **sin** el grupo ni sus descendientes; `current`
  marca el padre actual.
- `getDropPosition(groups, draggedId, targetId, zone)` con `zone` `"before"`, `"after"` o `"inside"` → lugar o
  `null` si el destino es el propio grupo o un descendiente, o alguno no existe. `"inside"` = último hijo del destino.
- `summarizeSubtree(groups, id)` → `{ subgroups, channels }`: número de descendientes y de canales distintos
  (`YouTubeGroups.getChannelKey`) en todo el subárbol, incluido el propio grupo; `null` si no existe.
- `removeGroupWithSnapshot(groups, id)` → `{ groups, removedIds, snapshot }`, con `snapshot = { group, parentId,
  index }` (copia profunda del subárbol y su lugar). Lanza si no existe.
- `restoreGroup(groups, snapshot)` → `{ groups, restored, atRoot }`. Si algún id del subárbol ya existe en el árbol,
  no cambia nada (`restored: false`). Si el padre ya no existe, lo añade al final del primer nivel como grupo
  (`atRoot: true`); si existe, en `min(index, longitud)`.
- Con escritura (una lectura y como mucho una escritura, en `withLock` de `KEYS.groups`): `moveGroupAndSave(groupId,
  parentId, index)` (no escribe si `changed` es `false`), `deleteGroupAndSnapshot(id)` → `{ removedIds, snapshot,
  summary }` y `restoreGroupAndSave(snapshot)` → `{ restored, atRoot }`.

**Cambios en `modules/groups.js`**:

- `normalizeChannelUrl` usa la constante `YOUTUBE_ORIGIN = "https://www.youtube.com"` en lugar de
  `window.location.origin` (ADR 0014, punto 5). En YouTube el resultado no cambia.
- `renameGroup` valida con `validateGroupName(newName, group.type === "subgroup" ? "subgroup" : "group")` y lanza
  `Error` con ese mensaje; guarda el nombre recortado.

**Infraestructura** (ADR 0014):

- `manifest.json`: `"options_ui": { "page": "options/options.html", "open_in_tab": true }`,
  `"background": { "scripts": ["background.js"] }`. Sin permisos nuevos. (`ui/icons-dom.js` y `ui/icon-picker.js` ya
  están en `content_scripts.js` desde el plan `2026-11-17-refactor-content-js.md`.)
- `background.js`: solo `runtime.onMessage` → si `message?.type === "youtube-groups:open-editor"`, devuelve
  `browser.runtime.openOptionsPage()`.
- `options/options.html` (sin scripts en línea): enlaza `/ui/buttons.css`, `/ui/icons.css`, `/ui/icon-picker.css` y
  `options.css`; carga `storage.js`, `fxemoji-data.js`, `icons.js`, `groups.js`, `group-editor.js`,
  `/ui/icons-dom.js`, `/ui/icon-picker.js` y `options.js`, en ese orden.
- `ui/icons-dom.js` (`YouTubeGroupsIconsDom`) y `ui/icon-picker.js` (`YouTubeGroupsIconPicker`) ya existen (plan
  `2026-11-17-refactor-content-js.md`, ADR 0015): `createIconSvg`, `setGroupBand`, `GROUP_ICON_SIZES`,
  `openIconPicker` y `hideIconPicker`. La página los usa desde sus globales.

**Interfaz de `options/options.js`** (sin `innerHTML`; textos con `textContent`):

- Tema: atributo `dark` en `<html>` según `matchMedia("(prefers-color-scheme: dark)")`, también al cambiar.
- Cabecera "YouTube Groups · Editor de grupos" y botón "+ Grupo". Árbol como listas anidadas (`role="tree"`,
  filas `role="treeitem"` con `aria-level` y `aria-expanded`), todos los nodos desplegados al abrir; "▸/▾" pliega y
  despliega. Cada fila: asa de arrastre "⠿", icono y banda de color (`createIconSvg`, `setGroupBand`, apariencia de
  `YouTubeGroups.getGroupAppearance`), nombre, número de canales propios y acciones con `aria-label`: "Renombrar",
  "Icono y color", "+ Subgrupo", "Subir", "Bajar", "Mover a…" y "Eliminar". Sin grupos: "Aún no hay grupos".
- Renombrar en línea: "Renombrar", doble clic o F2 cambian el nombre por un campo; Intro o perder el foco guardan
  (`renameGroup`), Escape cancela; el error de `validateGroupName` se muestra junto al campo y el campo sigue abierto.
- "Icono y color": `openIconPicker` anclado al botón → `setGroupAppearance`.
- Crear: "+ Grupo" y "+ Subgrupo" abren un campo en línea (mismas reglas que renombrar) → `createGroup` o
  `createSubGroup`; el padre se despliega.
- Mover: "Subir"/"Bajar" (deshabilitados en los extremos) y Alt+↑/Alt+↓ con el foco en la fila usan
  `getSiblingMove`; "Mover a…" abre un `<select>` con `getMoveTargets` (sangrado por nivel, el padre actual marcado) y
  "Mover" lo pone como último hijo del destino. Tras mover, el foco sigue en la fila movida.
- Arrastrar y soltar (HTML5, solo dentro de la página): sobre otra fila, el cuarto superior es `"before"`, el inferior
  `"after"` y el centro `"inside"`, con un indicador visual; destinos inválidos (`getDropPosition` `null`) no aceptan
  la suelta.
- Eliminar (botón o Supr con el foco en la fila): borra sin preguntar (`deleteGroupAndSnapshot`) y muestra un aviso
  (`role="status"`) "Eliminado «X»" + ", con N subgrupos y M canales" si los hay, con botón "Deshacer" durante 10 s.
  "Deshacer" llama a `restoreGroupAndSave`; si `atRoot`, el aviso dice "Restaurado en el primer nivel (su grupo padre
  ya no existe)"; si `restored` es `false`, "Ya estaba restaurado". Un borrado nuevo sustituye al aviso anterior (solo
  se puede deshacer el último). Cerrar la página pierde el "Deshacer".
- Errores de lectura o escritura: `<p role="alert">` en la cabecera.
- Sincronización: `storage.onChanged` (`getChangedKeys` incluye `groups`) repinta con `readGroupsValue(newValue)`
  conservando nodos plegados, fila con el foco y un renombrado en curso (texto y foco); si el grupo que se renombra o
  se mueve con "Mover a…" desaparece, se cancela.

**`ui/panel.js` y `ui/guide-section.js`**: botón "Editar grupos" (glifo "✎", `title` y `aria-label` "Editar grupos") en la cabecera del panel
(junto al botón de minimizar, visible también minimizado) y en la cabecera de la sección de la guía (tras el título).
Envía `browser.runtime.sendMessage({ type: "youtube-groups:open-editor" })`; si falla, `console.error`.

## Tareas

Reglas comunes: sin `innerHTML` con datos (en `options.js`, ninguno); JSDoc; sin dependencias nuevas; `make lint`
(0 avisos) y `make test` en verde.

- [x] T1 · `normalizeChannelUrl` con origen fijo y `renameGroup` con `validateGroupName` (ver **Decisiones**). El
  ADR 0014 pasa a `aceptada` · Ficheros: `modules/groups.js`, `tests/helpers/load-modules.js` (opción `origin` para
  `window.location.origin`, por defecto el de YouTube), `tests/groups.test.js`, `docs/adr/0014-…` · Test: con origen
  `moz-extension://abc`, `normalizeChannelUrl("/@a?x=1")` → `https://www.youtube.com/@a` y
  `"https://www.youtube.com/channel/UC1/"` → sin barra final; `"https://evil.com/@a"` → `null`;
  `removeChannelFromGroup` funciona con ese origen; `renameGroup` con "a" o 81 caracteres rechaza sin escribir (mensaje
  "del subgrupo" para un subgrupo) y con " Nuevo " guarda "Nuevo". Los tests existentes siguen pasando.
- [x] T2 · `modules/group-editor.js` con `findGroupLocation`, `moveGroup`, `getSiblingMove`, `getMoveTargets`,
  `getDropPosition` y `moveGroupAndSave` · Ficheros: `modules/group-editor.js`, `tests/helpers/load-modules.js`
  (añadir el módulo y exponer `YouTubeGroupsEditor`), `tests/group-editor.test.js` · Test: subir el primero → `null`;
  bajar A en `[A,B,C]` → `[B,A,C]`; mover un subgrupo al primer nivel → `type: "group"` sin `parentId`; mover un grupo
  dentro de otro → `type: "subgroup"` con `parentId` y sus hijos intactos; mover dentro de sí mismo o de un nieto
  lanza; índice fuera de rango se acota; mismo lugar → `changed: false`; la entrada no se muta; `getMoveTargets` no
  incluye el grupo ni sus descendientes y marca el padre actual; `getDropPosition` `"before"`/`"after"`/`"inside"` en
  el mismo nivel y en otro, con el arrastrado antes del destino en la misma lista (índice corregido) y `null` sobre un
  descendiente; `moveGroupAndSave` sin cambios no llama a `set` y dos movimientos solapados no se pisan.
- [x] T3 · `summarizeSubtree`, `removeGroupWithSnapshot`, `restoreGroup`, `deleteGroupAndSnapshot` y
  `restoreGroupAndSave` · Ficheros: `modules/group-editor.js`, `tests/group-editor.test.js` · Test: resumen de un grupo
  con dos subgrupos y un canal repetido (`/@Foo` y `/@foo`) cuenta 1 canal; borrar y restaurar deja el árbol igual
  (mismo orden e índices); restaurar dos veces → `restored: false` sin escribir; restaurar con el padre borrado → al
  final del primer nivel como `type: "group"` sin `parentId` y `atRoot: true`; restaurar tras añadir otro hermano
  respeta el índice acotado; un error de grupo inexistente no escribe.
- [x] T4 · Página de opciones y script de fondo: `manifest.json` (`options_ui`, `background`), `background.js` y
  esqueleto de `options/` (cabecera, tema, carga de módulos, mensaje de error y "N grupos" leídos con `getGroups`) ·
  Ficheros: `manifest.json`, `background.js`, `options/options.html`, `options/options.js`, `options/options.css`,
  `tests/manifest.test.js` (ya existe, se amplía) · Test: `tests/manifest.test.js` comprueba `options_ui.page` existente con `open_in_tab`,
  `background.scripts` = `["background.js"]` y el fichero existe, `permissions` sigue siendo `["storage"]`, y que
  `options.html` carga solo ficheros que existen, sin scripts en línea, con los módulos compartidos en el mismo orden
  relativo que en `content_scripts` y `options/options.js` el último. `make lint` sin avisos (web-ext lint incluido).
- [x] T5 · Botón "Editar grupos" en el panel y en la guía · Ficheros: `ui/panel.js`, `ui/guide-section.js`,
  `ui/panel.css`, `ui/guide-section.css` · Test: `make lint`, `make test` y a mano V1.
- [x] T7 · Árbol en la página: filas, plegar y desplegar, apariencia, número de canales, estado vacío y repintado por
  `storage.onChanged` conservando el estado · Ficheros: `options/options.js`, `options/options.css` · Test: `make
  lint`, `make test` y a mano V2.
- [x] T8 · Renombrar en línea, "Icono y color" y crear grupo y subgrupo · Ficheros: `options/options.js`,
  `options/options.css` · Test: `make lint`, `make test` y a mano V3.
- [x] T9 · Eliminar con aviso y "Deshacer" · Ficheros: `options/options.js`, `options/options.css` · Test: `make
  lint`, `make test` y a mano V4.
- [x] T10 · "Subir", "Bajar", "Mover a…" y Alt+↑/Alt+↓ · Ficheros: `options/options.js`, `options/options.css` ·
  Test: `make lint`, `make test` y a mano V5.
- [x] T11 · Arrastrar y soltar con indicador de posición · Ficheros: `options/options.js`, `options/options.css` ·
  Test: `make lint`, `make test` y a mano V6.
- [ ] T12 · Cerrar: quitar `promptRenameGroup`, `confirmDeleteGroup` y los nombres que queden sin uso en la
  desestructuración de `YouTubeGroups` en `ui/panel.js`; `docs/ARCHITECTURE.md` (contexto: página de opciones y script
  de fondo; filas de `manifest.json`, `background.js`, `options/` y `modules/group-editor.js`; flujo
  "Editor de grupos"; quitar "Quedan sin enlazar…"; ADR 0014 en Decisiones); en `ROADMAP.md`, "⬜" → "✅" en "Editor
  de grupos en una página propia"; este plan a `hecho` · Ficheros: `ui/panel.js`, `docs/ARCHITECTURE.md`,
  `ROADMAP.md`, este plan · Test: `make lint`, `make test` y V7.

### Verificación manual (Firefox con la extensión recargada; grupos A con A1 y A2, A1 con A1a, B y C, con canales)

- V1 · En YouTube, "✎" del panel (minimizado y desplegado) y de la cabecera de la guía abre el editor en una pestaña
  nueva. `about:addons` → Preferencias también.
- V2 · El árbol muestra los grupos con icono, banda y número de canales; plegar A oculta A1 y A2. Crear un grupo en la
  guía de YouTube lo hace aparecer en el editor sin recargar, sin perder lo plegado. Tema claro y oscuro del sistema.
- V3 · Renombrar A1 a "a" muestra el error y no cierra el campo; Escape restaura; "Nuevo" con Intro guarda y la guía de
  YouTube lo muestra sin recargar. `<b>x</b>` se ve como texto. Cambiar icono y color de B se ve en la guía. "+
  Subgrupo" en C crea C1 y despliega C.
- V4 · Eliminar A: aviso "Eliminado «A», con 3 subgrupos y N canales" y "Deshacer"; en YouTube, si A estaba
  seleccionado, sale de la selección. "Deshacer" lo devuelve en su sitio con todo su subárbol. Tras 10 s el aviso
  desaparece. Eliminar A1, borrar A desde otra pestaña del editor y "Deshacer" A1: aparece en el primer nivel.
- V5 · "Subir" en el primero y "Bajar" en el último están deshabilitados; Alt+↓ sobre B lo baja y el foco sigue en B.
  "Mover a…" de A1 no ofrece A1 ni A1a; moverlo a "Primer nivel" lo convierte en grupo y la guía lo muestra en la raíz.
- V6 · Arrastrar C sobre la mitad de A lo mete como último subgrupo de A; sobre el borde superior de B lo pone antes de
  B; soltar A sobre A1a no hace nada. El indicador se ve en claro y en oscuro.
- V7 · Regresión: en la guía de YouTube, crear grupo con icono y color (el selector se abre, guarda y cancela igual que
  antes), filtrar por selección, botones de tarjeta y reproductor. Sin errores nuevos en la consola.

## Criterios de aceptación

- Desde YouTube (panel y guía) y desde `about:addons` se abre una pestaña "Editor de grupos" con el árbol completo.
- Se puede renombrar, cambiar icono y color, crear subgrupos, subir, bajar, mover a otro padre (o al primer nivel) y
  borrar cualquier grupo o subgrupo, con ratón (incluido arrastrar y soltar) y con teclado.
- Borrar no pregunta: avisa de cuántos subgrupos y canales se van y permite "Deshacer" durante 10 s, devolviendo el
  subárbol a su sitio.
- Los cambios se ven sin recargar en las pestañas de YouTube abiertas y los de YouTube en el editor.
- No hay permisos, dependencias ni peticiones de red nuevos, y el formato guardado no cambia.

## Fuera de alcance

- Lista de canales de un grupo, quitar, copiar o mover canales y búsqueda: plan 6-2.
- Fusionar grupos y ordenar A-Z (6-6); "Sin clasificar" (6-4).
- Ajustes y copias de seguridad en la página de opciones (6-11).
- Deshacer después de cerrar la página o de más de un borrado.
- Abrir el editor en un grupo concreto desde YouTube.
- Tests de DOM de `options.js` (los de `ui/` ya existen desde el plan `2026-11-17-refactor-content-js.md`).

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |
| 2026-11-17 | T5 | Se quita de `tests/manifest.test.js` el test que fijaba en 216 las reglas de los `ui/*.css`. | Solo servía para comprobar que el refactor (T13) no perdía reglas; ya cumplió y bloquea cualquier estilo nuevo. | Delegada por la persona ("usa lo recomendado y ejecútalo") |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-17 | T1 | `fix: normalizeChannelUrl con origen fijo y renameGroup con validateGroupName` | ADR 0014 a `aceptada`; opción `origin` en `loadModules`; 249 tests y lint en verde. |
| 2026-11-17 | T2 | `feat: group-editor con moveGroup, getSiblingMove, getMoveTargets, getDropPosition y moveGroupAndSave` | Módulo puro `YouTubeGroupsEditor` y tests; `moveGroupAndSave` devuelve `{ changed }`. |
| 2026-11-17 | T3 | `feat: group-editor con summarizeSubtree, removeGroupWithSnapshot, restoreGroup y borrado con deshacer` | Añade `deleteGroupAndSnapshot` y `restoreGroupAndSave`; 265 tests y lint en verde. |
| 2026-11-17 | T4 | `feat: página de opciones y script de fondo del editor de grupos` | `options_ui`, `background.js` y esqueleto de `options/` con tema, error y recuento; 267 tests y lint en verde. |
| 2026-11-17 | T5 | `feat: botón Editar grupos en el panel y en la guía` | Botón "✎" en `ui/panel.js` y `ui/guide-section.js` que envía `youtube-groups:open-editor`; pendiente V1 a mano. |
| 2026-11-17 | T7 | `feat: árbol de grupos en la página de opciones` | Filas con plegado, icono, banda, nº de canales, estado vacío y repintado por `storage.onChanged`; pendiente V2 a mano. |
| 2026-11-17 | T8 | `feat: renombrar en línea, icono y color y crear grupos en el editor` | Campo en línea (Intro, blur, Escape, F2, doble clic), selector de icono, "+ Grupo" y "+ Subgrupo"; añade el botón en `options.html`; pendiente V3 a mano. |
| 2026-11-17 | T9 | `feat: eliminar grupos con aviso y deshacer en el editor` | Botón "Eliminar" y Supr, aviso `role="status"` de 10 s con "Deshacer" (`deleteGroupAndSnapshot`/`restoreGroupAndSave`); pendiente V4 a mano. |
| 2026-11-17 | T10 | `feat: subir, bajar y mover a otro grupo en el editor` | "Subir"/"Bajar" (deshabilitados en extremos), Alt+↑/↓ y "Mover a…" con `<select>` (`moveGroupAndSave`); foco en la fila movida; pendiente V5 a mano. |
| 2026-11-17 | T11 | `feat: arrastrar y soltar grupos con indicador de posición en el editor` | Asa "⠿" arrastrable, zonas before/after/inside con `getDropPosition` e indicador visual claro/oscuro; pendiente V6 a mano. |
