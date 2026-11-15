# Plan: GUI 6 (2/3) · Selección limitada a hermanos

**Estado:** aprobado (2026-11-15)

Issue: feedback de la persona tras probar la serie `2026-11-15-gui-5-*` en Firefox (2026-11-15), punto 2.

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

Orden de la serie GUI 6: `2026-11-15-gui-6-1-guia-fija` → **este plan** → `2026-11-15-gui-6-3-boton-crear`.
Requisito: `gui-6-1` en `hecho`. ADR asociado: `docs/adr/0011-seleccion-de-hermanos.md` (propuesta; sustituye al 0009;
se acepta al cerrar).

## Contexto y decisión

Hoy la selección es libre (ADR 0009): cualquier mezcla de grupos, subgrupos y canales. Decidido por la persona
(2026-11-15), regla única: al **añadir** un elemento solo se conservan los seleccionados que sean **hermanos** suyos
(mismo tipo y mismo contenedor: raíz o grupo padre para grupos; el grupo o subgrupo de la lista para canales); clic
sobre uno seleccionado lo quita sin navegar. Como un canal puede estar en varios grupos, su clave incluye el contenedor.
Se descarta modelar la selección como objeto (ver ADR 0011).

### Decisiones (`modules/filter.js`, `modules/guide.js`, sin DOM)

- **Claves**: `group:<id>` y `channel:<encodeURIComponent(contenedor)>:<url normalizada>`.
  - `normalizeFilter` de canal exige `containerId` cadena no vacía (si no, `ALL_FILTER`) y devuelve
    `{ type: "channel", containerId, url, name }`.
  - `getFilterKey` y `parseFilterKey` usan el formato nuevo (`parseFilterKey` separa en el primer `:` tras
    `channel:` y decodifica; contenedor vacío o no decodificable, o URL que no empieza por `https://` o `http://` →
    `null`). Así una clave antigua `channel:https://…` da `null`.
  - `resolveFilterUrls` de canal: `ok` si el grupo contenedor existe en cualquier nivel y tiene esa URL en sus
    **propios** canales; si no, `missing`. `channelInGroups` desaparece.
- **Regla**: `toggleSelection(groups, selection, filter)` (nueva firma): si la clave está, la quita; si no, conserva
  solo las claves hermanas (`areSiblings(groups, a, b)`, interna) y añade la nueva al final. Clave no válida → selección
  normalizada sin cambios. No muta la entrada. El padre de un grupo se obtiene con `findGuidePath` (búsqueda local en
  `filter.js`, que se carga antes que `guide.js`); un grupo inexistente no es hermano de nadie.
- **`resolveSelection(groups, selection)`**: descarta las que no existen (como hoy, con la regla nueva de canal) y,
  si lo que queda no son todos hermanos del último, conserva solo los hermanos del último.
- **Traspaso**: `serializePendingSelection` escribe `version: 3`; `parsePendingSelection` rechaza 1 y 2.
- **Sin cambios**: `shouldNavigateOnSelect`, `clearSelection`, `normalizeSelection` (ya renormaliza con
  `parseFilterKey`), "Limpiar selección" (vacía y no navega).
- **`isChannelListOpen(overrides, item, depth, selection)`**: abierta si `selection` contiene la clave de algún canal
  de `item` **con `item.id` como contenedor** (usa `YouTubeGroupsFilter.getFilterKey`).
- **`getCreateTarget`**: sin cambio de lógica (ancla = última clave de grupo existente; con la regla nueva, las claves
  de grupo son siempre hermanas).
- **`content.js`**: `toggleSelectionItem` llama a `toggleSelection(guideGroups, activeSelection, filter)`; los botones
  de canal pasan `containerId: item.id` y su `aria-pressed` usa la clave con contenedor (un canal en dos listas solo se
  marca en la pulsada).

## Tareas

Reglas comunes: sin `innerHTML` con datos; JSDoc; sin dependencias nuevas; `make lint` (0 avisos) y `make test` en
verde. Cada commit deja la extensión funcionando.

- [x] T1 · Claves de canal con contenedor, `resolveFilterUrls`/`resolveSelection` con la regla de contenedor (sin el
  paso de hermanos aún), traspaso `version: 3`, `isChannelListOpen` con contenedor y `content.js` (botones de canal y
  `aria-pressed`) · Ficheros: `modules/filter.js`, `tests/filter.test.js`, `modules/guide.js`, `tests/guide.test.js`,
  `content.js` · Test: `getFilterKey({type:"channel", containerId:"a", url:"https://www.youtube.com/@x?a=1"})` →
  `channel:a:https://www.youtube.com/@x`; un contenedor con `:` se codifica y `parseFilterKey` lo recupera; canal sin
  contenedor y clave antigua `channel:https://…` → `null`; `resolveFilterUrls` de un canal en su grupo → `ok`, en un
  grupo que no lo tiene (aunque lo tenga un subgrupo suyo) → `missing`, contenedor inexistente → `missing`;
  `parsePendingSelection` acepta `version: 3` y rechaza 1 y 2; `isChannelListOpen` abierta con la clave de su
  contenedor y cerrada con la del mismo canal en otro contenedor. Tests existentes con claves `channel:<url>` se
  adaptan (cambio intencionado). A mano V3, V4.
- [ ] T2 · Regla de hermanos en `toggleSelection` (nueva firma) y en `resolveSelection`; `content.js` pasa los grupos
  · Ficheros: `modules/filter.js`, `tests/filter.test.js`, `content.js` · Test (árbol A{A1{A1a}, A2}, B{B1}; canal x en
  A y en B): dos grupos raíz → `[A, B]`; A1 + A2 → ambos; A1 + B1 → solo B1; con `[A1, A2]` pulsar A → `[A]`; con `[A]`
  pulsar A1 → `[A1]`; desde `[x@A]` pulsar A → `[A]`; desde `[x@A1a]` pulsar A → `[A]`; con `[A, B]` pulsar `x@A` → `[x@A]`; `x@A` + otro canal de A → ambos; `x@A` + `x@B` → `[x@B]`; pulsar una
  seleccionada la quita sin tocar las demás; nunca quedan padre e hijo; no muta la entrada; `resolveSelection([A,
  A1])` → `[A1]` (hermanos del último). A mano V1, V2, V5.
- [ ] T3 · Cerrar: `docs/ARCHITECTURE.md` (fila de `filter.js` y flujo **Filtro** con la regla de hermanos, claves con
  contenedor y `version: 3`; enlace al ADR 0011); ADR 0011 a `aceptada`; ADR 0009 a "sustituida por 0011"; ADR 0007:
  "puntos 1, 2, 4 y 5 sustituidos por 0009, a su vez sustituido por 0011". Estado de este plan a `hecho` · Ficheros:
  `docs/ARCHITECTURE.md`, `docs/adr/0011-seleccion-de-hermanos.md`, `docs/adr/0009-seleccion-multiple-como-filtro.md`,
  `docs/adr/0007-filtro-activo-y-paso-a-suscripciones.md`, este plan · Test: `make lint` y `make test`.

### Verificación manual (extensión recargada; grupos A con subgrupos A1 y A2, B con B1; canal x en A y en B)

- V1 · En `/feed/subscriptions`: A y luego B → los dos marcados, unión. Entrar en A: A1 y A2 → los dos (A ya no está
  marcado). Entrar en B: B1 → solo B1. Volver a la raíz y pulsar A → solo A.
- V2 · Desplegar canales de A: x y otro canal de A → los dos; pulsar B → solo B. Pulsar x en la lista de B → solo esa
  x; la x de la lista de A no se marca.
- V3 · Clic sobre un elemento marcado lo desmarca y no cambia de página (también en `/`). "Limpiar selección (N)"
  muestra el número correcto y vacía todo.
- V4 · Desde `/` pulsar x en la lista de A: pasa a suscripciones con solo x y la lista de A desplegada con x marcada.
- V5 · Regresión en suscripciones: Filtros (duración, fecha, visualizaciones), Vídeos vistos y Vídeos fuera del filtro
  como antes. Tema claro y oscuro.

## Criterios de aceptación

- Al seleccionar un elemento solo quedan seleccionados sus hermanos (mismo tipo y contenedor); nunca un padre con su
  hijo ni grupos con canales. Clic sobre uno seleccionado lo quita sin navegar.
- Un canal se marca solo en la lista donde se pulsó; el filtro muestra la unión de lo seleccionado.
- Elementos borrados, o canales quitados de su grupo, salen de la selección.
- El paso a suscripciones conserva la selección también tras carga completa. Filtros avanzados, vistos y modos de
  visibilidad igual; sin dependencias nuevas ni cambios en `browser.storage.local`.

## Fuera de alcance

- Texto del botón de crear (`gui-6-3`).
- Marcar en la raíz el grupo que contiene un subgrupo seleccionado.
- Conservar la selección tras recargar (ADR 0003 y 0007).
- Botones sobre la miniatura, panel flotante y tests de DOM de `content.js`.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-15 | T1 | feat: claves de canal con contenedor y traspaso version 3 | `filter.js`, `guide.js` y `content.js`; tests adaptados. `make lint` y `make test-affected` en verde; V3, V4 a mano pendientes. |
