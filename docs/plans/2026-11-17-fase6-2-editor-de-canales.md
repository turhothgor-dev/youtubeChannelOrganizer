# Plan: Fase 6 (2/2 del editor) · Editor de grupos: canales del grupo y búsqueda

**Estado:** aprobado (2026-11-17)

Issue: `ROADMAP.md`, Fase 6: "Editor de canales y búsqueda". Hoja de ruta:
`docs/plans/2026-11-17-fase6-hoja-de-ruta.md`. ADR: [0014](../adr/0014-pagina-de-opciones-editor-de-grupos.md) (sin
ADR nuevo).

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

Serie: `2026-11-17-fase6-1-editor-de-grupos.md` → **este plan**. Requisito: 6-1 en `hecho` (página de opciones,
`modules/group-editor.js`, árbol y aviso con "Deshacer" en `options/options.js`).

## Contexto y decisión

Con el árbol editable (6-1) falta gestionar los canales de cada grupo: hoy solo se quitan uno a uno desmarcando
casillas desde un vídeo del canal, y no hay forma de saber en qué grupos está un canal. Decisión ("usa lo
recomendado", 2026-11-17): en la página de opciones, al seleccionar un grupo se ve la **lista de sus canales** con
selección múltiple para **quitar** (con "Deshacer" de 10 s, como borrar grupos), **copiar a** y **mover a** otro grupo, y
un campo de **búsqueda** filtra árbol y canales por nombre. Lógica pura en `modules/group-editor.js` con tests.

Se descarta: editar el nombre guardado del canal (es informativo, ADR 0001) y añadir canales desde el editor sin
estar en YouTube (exigiría pegar URL y validar sin conocer el nombre; la bandeja 6-4 cubrirá las suscripciones).

### Decisiones

**Lógica pura** en `modules/group-editor.js` (sin mutar la entrada; las URL se comparan tal como están guardadas y los
repetidos en destino con `YouTubeGroups.getChannelKey`):

- `removeChannels(groups, groupId, urls)` → `{ groups, removed }`, `removed = [{ channel, index }]` con la copia del
  canal y su posición original. Lanza si el grupo no existe; URL que no están se ignoran.
- `restoreChannels(groups, groupId, removed)` → `{ groups, restored }`: reinserta en orden de `index` (acotado) los
  que no estén ya (por clave); si el grupo ya no existe, `restored: 0` y el árbol igual.
- `transferChannels(groups, fromId, urls, toId, mode)` con `mode` `"copy"` o `"move"` → `{ groups, added, skipped }`:
  añade al final de `toId` los que no estén (por clave), cuenta los que ya estaban en `skipped` y, con `"move"`, los
  quita de `fromId` en todo caso. Lanza si algún grupo no existe o `fromId === toId`.
- `normalizeSearchText(text)` → minúsculas, sin diacríticos (NFD sin marcas combinantes), espacios colapsados y
  recortado.
- `searchGroups(groups, query)` → `null` si la consulta normalizada está vacía; si no, `{ groupIds, channelMatches,
  visibleIds }` (arrays y objeto planos): `groupIds` = grupos cuyo nombre contiene la consulta; `channelMatches` =
  `{ [groupId]: [url, …] }` con los canales cuyo nombre o ruta de URL (`/@handle`, `/channel/…`) la contienen;
  `visibleIds` = esos grupos, los que tienen canales que coinciden y todos sus antecesores, en preorden.
- Con escritura (en `withLock` de `KEYS.groups`, una lectura y como mucho una escritura): `removeChannelsAndSave`,
  `restoreChannelsAndSave` y `transferChannelsAndSave`, con los mismos argumentos y resultados sin `groups`; no
  escriben si no cambia nada.

**Interfaz** (`options/options.js`, sin `innerHTML`):

- Diseño en dos columnas: árbol a la izquierda y panel "Canales" a la derecha (en pantallas estrechas, uno bajo otro).
  Pulsar el nombre de una fila la selecciona (`aria-selected`); sin selección, el panel dice "Elige un grupo".
- Panel: título "Canales de «X»", resumen "N canales" y, si hay, "M más en subgrupos" (de `summarizeSubtree`), y una
  fila por canal con casilla, nombre como enlace a su URL (`target="_blank"`, `rel="noopener noreferrer"`) y la URL
  en texto secundario. Sin canales: "Este grupo no tiene canales propios".
- Barra: casilla "Seleccionar todo" (con estado intermedio), "Quitar (N)", "Copiar a…" y "Mover a…", deshabilitados
  sin selección. "Copiar a…"/"Mover a…" abren un `<select>` con el árbol aplanado (`YouTubeGroups.flattenGroups`,
  sangrado por nivel) sin el grupo actual, y un botón "Copiar"/"Mover"; al terminar, mensaje "N copiados a «Y»" o "N
  movidos a «Y»" y, si `skipped`, "; 1 ya estaba" o "; M ya estaban".
- "Quitar": sin preguntar, `removeChannelsAndSave` y el aviso de 6-1 "Quitados N canales de «X»" con "Deshacer"
  (10 s, sustituye al aviso anterior) → `restoreChannelsAndSave`.
- Búsqueda: campo `type="search"` en la cabecera con etiqueta "Buscar grupos y canales"; filtra mientras se escribe.
  Con búsqueda activa el árbol muestra solo `visibleIds` desplegados, marca las filas que coinciden y, en las que
  tienen canales que coinciden, "· N canales"; el panel muestra solo los canales que coinciden ("N de M") si el grupo
  está en `channelMatches`, y todos si no. Sin resultados: "Sin resultados". Escape en el campo lo vacía. Mientras hay
  búsqueda se ocultan "Subir", "Bajar", "Mover a…" y el arrastre (el orden visible no es el real). Cambiar la
  búsqueda o el grupo seleccionado vacía la selección de canales.
- Sincronización (`storage.onChanged`): se conservan grupo seleccionado, casillas marcadas que sigan existiendo y la
  búsqueda; si el grupo seleccionado desaparece, el panel vuelve a "Elige un grupo".

## Tareas

Reglas comunes: sin `innerHTML`; JSDoc; sin dependencias nuevas; `make lint` (0 avisos) y `make test` en verde.

- [x] T1 · `removeChannels`, `restoreChannels`, `transferChannels` y sus versiones `…AndSave` · Ficheros:
  `modules/group-editor.js`, `tests/group-editor.test.js` · Test: quitar dos de cinco y restaurar deja el orden
  original; restaurar con uno ya vuelto a añadir (`/@Foo` frente a `/@foo`) no lo duplica; restaurar en un grupo
  borrado → 0 sin escribir; copiar a un grupo que ya tiene uno → `added` 1, `skipped` 1; mover quita del origen
  también los `skipped`; `fromId === toId` o grupo inexistente lanza sin escribir; la entrada no se muta; quitar URL
  inexistentes no llama a `set`.
- [x] T2 · `normalizeSearchText` y `searchGroups` · Ficheros: `modules/group-editor.js`, `tests/group-editor.test.js`
  · Test: "  Músíca " encuentra "musica" y "MÚSICA"; consulta vacía o solo espacios → `null`; un canal de A1a que
  coincide da `visibleIds` `[A, A1, A1a]` en preorden y `channelMatches` solo en A1a; coincidencia por handle
  (`/@lofigirl` con "lofi"); un nombre de grupo y un canal en el mismo grupo no duplican ids.
- [ ] T3 · Selección de grupo y panel de canales (dos columnas, resumen, enlaces, casillas, "Seleccionar todo",
  repintado por `storage.onChanged`) · Ficheros: `options/options.js`, `options/options.css`, `options/options.html` ·
  Test: `make lint`, `make test` y a mano V1.
- [ ] T4 · "Quitar (N)" con aviso y "Deshacer" · Ficheros: `options/options.js` · Test: `make lint`, `make test` y a
  mano V2.
- [ ] T5 · "Copiar a…" y "Mover a…" · Ficheros: `options/options.js`, `options/options.css` · Test: `make lint`, `make
  test` y a mano V3.
- [ ] T6 · Búsqueda en árbol y canales · Ficheros: `options/options.js`, `options/options.css`,
  `options/options.html` · Test: `make lint`, `make test` y a mano V4.
- [ ] T7 · Cerrar: `docs/ARCHITECTURE.md` (fila de `group-editor.js` con las funciones nuevas y flujo "Editor de
  grupos" con canales y búsqueda); en `ROADMAP.md`, "⬜" → "✅" en "Editor de canales y búsqueda"; este plan a
  `hecho` · Ficheros: `docs/ARCHITECTURE.md`, `ROADMAP.md`, este plan · Test: `make lint`, `make test` y V5.

### Verificación manual (Firefox, extensión recargada; A con 5 canales y subgrupo A1 con 2; B con 1 canal de A)

- V1 · Seleccionar A muestra "5 canales · 2 más en subgrupos"; el enlace de un canal abre YouTube en otra pestaña.
  "Seleccionar todo" marca los cinco; desmarcar uno lo deja intermedio. Añadir un canal a A desde YouTube lo hace
  aparecer sin perder lo marcado.
- V2 · Quitar dos canales de A: desaparecen y el aviso ofrece "Deshacer", que los devuelve en su posición. En
  YouTube, con A seleccionado en suscripciones, sus vídeos se ocultan o vuelven en consecuencia.
- V3 · Copiar a B tres canales de A, uno ya en B: "2 copiados a «B»; 1 ya estaba". Mover dos de A a A1: salen de
  A. El destino no ofrece el grupo actual.
- V4 · Buscar "musica" encuentra "Música" y los canales con ese texto, con sus grupos desplegados; Escape limpia. Con
  búsqueda no se ven "Subir", "Bajar", "Mover a…" ni el asa de arrastre. Una búsqueda sin coincidencias dice "Sin
  resultados".
- V5 · Regresión de V2 a V6 del plan 6-1 y del filtro en YouTube. Sin errores nuevos en la consola.

## Criterios de aceptación

- Al elegir un grupo se ven sus canales y se pueden quitar, copiar o mover varios a la vez a otro grupo o subgrupo,
  sin repetir canales en el destino.
- Quitar canales no pregunta y se puede deshacer durante 10 s, volviendo cada canal a su posición.
- La búsqueda encuentra grupos y canales sin distinguir mayúsculas ni acentos y muestra en qué grupos está cada canal.
- Los cambios se ven sin recargar en las pestañas de YouTube y al revés; sin permisos, dependencias, red ni cambios
  de formato.

## Fuera de alcance

- Añadir canales desde el editor, editar el nombre guardado de un canal y unir `/@handle` con `/channel/UC…`.
- Fusionar grupos y ordenar A-Z (6-6), bandeja "Sin clasificar" (6-4), canales ocultos (6-7).
- Reordenar canales dentro de un grupo.
- Búsqueda en la guía de YouTube.
- Tests de DOM de `options.js`.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-17 | T1 | `feat: quitar, restaurar y copiar o mover canales entre grupos en el editor` | Lógica pura y versiones `…AndSave` con tests; sin cambios sobre el plan. |
| 2026-11-17 | T2 | `feat: búsqueda de grupos y canales sin acentos ni mayúsculas en el editor` | `normalizeSearchText` y `searchGroups` con tests; sin cambios sobre el plan. |
