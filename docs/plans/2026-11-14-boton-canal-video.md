# Plan: cerrar el botón "Añadir a grupo" del canal de cada vídeo

**Estado:** hecho

Issue: commit d6b6a8d `feat(videos): added button to add video's channel to groups. WIP`, revisado tras el merge
de `origin/master` (d3ef534), que reescribió `content.js` y añadió `modules/`, subgrupos y multi-asignación.

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

**Qué hay hoy** (código en d3ef534):

- `modules/storage.js` (`YouTubeGroupsStorage`: `getGroups`, `saveGroups`), `modules/groups.js` (`YouTubeGroups`:
  CRUD de grupos y subgrupos, `addChannelToGroup`, `removeChannelFromGroup`, búsqueda recursiva
  `findGroupById` y su propio `normalizeChannelUrl`, no exportado) y `modules/icons.js`. Se cargan como scripts
  clásicos antes de `content.js` (`manifest.json`). Formato de datos: ADR 0001 (actualizado con subgrupos).
- Panel `#youtube-groups-panel`: árbol de grupos y subgrupos, filtro activo y, en `/watch`, la sección "Canal
  actual" con casillas de todos los grupos y subgrupos.
- En `/feed/subscriptions`: `scanSubscriptionsPage` recorre la página en cada lote de mutaciones e inserta un
  control "Añadir a grupo" junto al enlace del canal; el control abre un desplegable único anclado a `body`
  (se cierra al hacer clic fuera o con scroll) con casillas de grupos y subgrupos.

**Ya resuelto respecto al plan anterior**: el selector ya no se recorta (desplegable fijo en `body`), los clics
del control no navegan, se cierra al hacer clic fuera y con scroll, y los subgrupos aparecen en ambos selectores.

**Qué falla todavía** para que el botón sea completo y fiable:

1. **Un solo botón por canal, no por vídeo**: `addSubscriptionChannelControl` deduplica por URL de canal en toda
   la página (`subscriptionChannelControls`): el segundo vídeo del mismo canal no tiene botón.
2. **Canal fijado al crear el control** (closure de `createSubscriptionChannelControl(channel)`): si YouTube
   reutiliza la tarjeta para otro vídeo, el botón abre el canal antiguo, y puede acabar con dos controles.
3. **Recorrido duplicado y caro**: `scanSubscriptionsPage` hace `querySelectorAll` y `getChannelFromCard` de todas
   las tarjetas en cada lote de mutaciones, en paralelo al recorrido de `processPendingCards`, con muchos
   `console.log` de diagnóstico.
4. **Guardado no atómico y duplicado**: los dos formularios repiten el cálculo de altas y bajas y hacen una
   lectura y una escritura de `storage` por cada grupo cambiado; un error a mitad deja la pertenencia a medias.
   En el formulario del panel, `originalText` se declara dentro del `try` y se usa en el `catch`: ante un error
   lanza `ReferenceError` y el botón se queda en "Guardando..." deshabilitado. Guardar desde una tarjeta no
   refresca el panel (contadores de canales desactualizados).
5. **El filtro se pierde al guardar**: `refreshActiveGroupFilter` muestra todas las tarjetas y luego llama a
   `filterAllDetectedCards`, que invoca `applyFilterToCard(card)` sin canal, y esa rama siempre muestra la
   tarjeta. Resultado: con un grupo activo, guardar desde el botón deja visibles todos los vídeos. Además busca
   el grupo activo solo en el primer nivel, así que con un subgrupo activo no filtra ("Grupo activo no
   encontrado").
6. **Sin grupos**: el selector se abre vacío, sin explicar que hay que crear un grupo.
7. **Carrera al abrir**: abrir dos botones seguidos pinta las casillas de ambos en el mismo desplegable (las dos
   promesas de `getGroups` añaden a la misma lista). El desplegable no se ajusta al borde de la ventana.
8. **Panel "Canal actual" inestable**: cualquier mutación en el bloque del propietario (contador de
   suscriptores, botón "Suscribirse") repinta todo el panel y cierra el formulario con lo marcado.
9. **Nombres de canal sin escapar**: "Ver canales" monta la lista con `innerHTML` interpolando `channel.name`,
   `channel.url` y el nombre del grupo. El botón guarda nombres leídos de YouTube (de terceros), así que es una
   inyección de HTML en el contexto del content script. Es uno de los 4 avisos `UNSAFE_VAR_ASSIGNMENT`.
10. **Sin tests**: no hay ningún `*.test.js`.

**Decisión.**

- El botón se integra en el recorrido de tarjetas existente (`processPendingCards`): **un control por tarjeta**,
  que no guarda el canal; lo lee de su tarjeta al abrir el selector. Si YouTube borra el control, el observador
  vuelve a programar la tarjeta y se reinserta.
- La lógica sin DOM va a `modules/groups.js`, que ya es la capa de lógica: exportar `normalizeChannelUrl` y
  añadir funciones puras para calcular la pertenencia y las URL de un grupo, más `setChannelGroups` (una lectura
  y una escritura). No se crea `groups-model.js` (el plan anterior lo proponía antes de que existiera
  `modules/`) y `manifest.json` no cambia.
- Tests con `node --test` y `node:vm`, que cargan los scripts clásicos de `modules/` en un contexto con un
  `browser.storage.local` simulado. Sin dependencias nuevas. `tests/` se excluye del paquete en
  `web-ext-config.mjs`.
- El formato de almacenamiento no cambia: ADR 0001, actualizado con subgrupos y en estado `aceptada`.

**Decisiones sobre las preguntas del plan anterior** (delegadas por la persona):

- **P1 · Dónde aparece el botón**: en las tarjetas de `/feed/subscriptions` (T5) y de la página de inicio `/`
  (T6). No se ponen en búsqueda ni en la lista lateral de recomendaciones de `/watch`: `ROADMAP.md` los deja para
  la fase 5 ("Soporte para resultados de búsqueda", "Soporte para recomendaciones"). En `/watch` el canal del
  vídeo se añade desde la sección "Canal actual" del panel.
- **P2 · Formato**: se acepta el formato actual (versión 1 con subgrupos anidados); el ADR 0001 se reescribe con
  ese formato y queda `aceptada`. La identidad canónica del canal sigue siendo un tema pendiente del ADR.
- **P3 · Alcance**: el plan cierra el control de las tarjetas y la sección "Canal actual" del panel, porque
  comparten el guardado y el selector.

Alternativas descartadas:

- Arreglar `scanSubscriptionsPage` por separado: deja dos recorridos del DOM que hacen lo mismo.
- Añadir `jsdom` para probar el DOM: dependencia nueva, y unos fixtures que no reproducen el DOM real de YouTube,
  que es justo lo frágil. La parte de DOM se verifica a mano con `make up` (lista V1-V8).
- Leer de nuevo el canal de la tarjeta al pulsar "Guardar": la persona ha visto y marcado las casillas del canal
  que había al abrir; se guarda ese canal. El desplegable se cierra con scroll, así que no queda desfasado.

### Notas para implementar los tests

- Los ficheros de `modules/` declaran `const YouTubeGroups = (() => ...)()` en el nivel superior. En `node:vm`,
  esas declaraciones son visibles para los scripts siguientes del mismo contexto, pero no son propiedades del
  objeto global: se recuperan con `vm.runInContext("YouTubeGroups", context)`. No hace falta cambiar los módulos.
- Contexto mínimo: `window: { location: { origin: "https://www.youtube.com" } }`, `URL`, `crypto`
  (`globalThis.crypto`), `structuredClone` y `browser.storage.local` simulado. Orden de carga:
  `modules/storage.js`, `modules/icons.js` y `modules/groups.js`.
- El mock de `storage.local` guarda y devuelve copias (`structuredClone`), como el real, y cuenta las llamadas a
  `set` para comprobar que se escribe una sola vez.
- Los objetos creados dentro del contexto tienen otros prototipos (`Array`, `Object`): antes de
  `assert.deepStrictEqual`, pásalos por `JSON.parse(JSON.stringify(...))` (o compara campo a campo).
- El ayudante va en `tests/helpers/load-modules.js`, que no termina en `.test.js`, así que `node --test` no lo
  ejecuta como test.

## Tareas

Cada tarea es del tamaño de un commit, toca pocos ficheros y tiene un test que la valida. Al tocar `content.js`,
no introducir `innerHTML` con valores interpolados (las plantillas literales sin `${}` existentes pueden quedarse)
y quitar los `console.log` de diagnóstico de las funciones que se modifiquen.

- [x] T1 · Base de tests y `normalizeChannelUrl` único. Crear `tests/helpers/load-modules.js` (contexto `vm` y
  mock de storage descritos arriba). Exportar `normalizeChannelUrl` en el objeto que devuelve `YouTubeGroups` y
  borrar la copia de `content.js` (que pasa a usar la del módulo). Añadir `"tests"` a `ignoreFiles` de
  `web-ext-config.mjs`. Sin cambios de comportamiento · Ficheros: `tests/helpers/load-modules.js`,
  `tests/storage.test.js`, `tests/groups.test.js`, `modules/groups.js`, `content.js`, `web-ext-config.mjs` ·
  Test: `tests/storage.test.js` (sin datos, `getGroups` devuelve `[]` y escribe `{ version: 1, groups: [] }`;
  `saveGroups` con algo que no es un array lanza `TypeError`) y `tests/groups.test.js` (`normalizeChannelUrl`:
  `/@handle`, `/channel/UC...`, `/c/x`, `/user/x`, barra final, query y fragmento eliminados, `/watch?v=`,
  `/@handle/videos` y otro origen dan `null`; `createSubGroup` anida el subgrupo con `type: "subgroup"` y
  `parentId`; `addChannelToGroup` sobre un subgrupo guarda la URL normalizada y no duplica). `make test`,
  `make lint`, y `make build` genera un `.zip` sin `tests/` (comprobar con `unzip -l web-ext-artifacts/*.zip`).
- [x] T2 · Guardado único de la pertenencia. En `modules/groups.js`, añadir y exportar
  `applyChannelGroupSelection(groups, channel, selectedGroupIds)`, pura: recorre grupos y subgrupos a cualquier
  nivel; devuelve `{ groups, addedGroupIds, removedGroupIds }` sin mutar la entrada; valida nombre y URL (mensaje
  "El canal debe incluir nombre y URL.") y normaliza la URL ("URL de canal inválida." si no es un canal); no
  duplica el canal en un grupo e ignora los ids desconocidos. Añadir y exportar
  `setChannelGroups(channel, selectedGroupIds)`, que lee una vez, aplica y escribe una vez (no escribe si no hay
  cambios) y devuelve lo mismo. En `content.js`, los dos `submit` (panel y desplegable) usan `setChannelGroups`;
  el botón Guardar se deshabilita mientras guarda y se restaura en un `finally` (corrige el `ReferenceError` de
  `originalText`); tras guardar se llama a `renderGroupsPanel()` y `refreshActiveGroupFilter()` en los dos.
  `addChannelToGroup` y `removeChannelFromGroup` se mantienen en el módulo, pero dejan de usarse en el guardado ·
  Ficheros: `modules/groups.js`, `content.js`, `tests/groups.test.js` · Test: alta en un grupo y en un subgrupo
  anidado, baja, sin cambios, canal ya presente, id desconocido, canal sin nombre o URL (error), URL que no es de
  canal (error) y entrada no mutada; `setChannelGroups` hace una sola llamada a `set` con cambios, ninguna sin
  cambios, y ninguna si hay error; a mano, V3.
- [x] T3 · El filtro sobrevive al guardado. En `modules/groups.js`, añadir y exportar
  `getGroupChannelUrls(groups, groupId)`, pura: busca el grupo a cualquier nivel y devuelve un `Set` con las URL
  de sus canales y las de todos sus descendientes, o `null` si no existe. En `content.js`,
  `refreshActiveGroupFilter` la usa (así funciona también con un subgrupo activo) y `applyFilterToCard` usa
  `card.dataset.youtubeGroupsChannelUrl` cuando no recibe el canal, en lugar de mostrar siempre la tarjeta. Quitar
  los `console.log` de `applyFilterToCard`, `filterAllDetectedCards` y `refreshActiveGroupFilter` · Ficheros:
  `modules/groups.js`, `content.js`, `tests/groups.test.js` · Test: grupo con canales propios y de subgrupos,
  subgrupo (solo los suyos y los de sus descendientes), grupo sin canales (`Set` vacío) e id desconocido
  (`null`); a mano, V5.
- [x] T4 · Selector compartido y estado sin grupos. Extraer en `content.js` una función
  `renderChannelGroupChoices(container, groups, channelUrl, choiceClassName)` que pinta el árbol de casillas
  (sangría por nivel, marcadas las de los grupos que ya contienen el canal) y la usan el panel y el desplegable,
  en lugar de sus dos copias. Si no hay grupos, muestra "Crea un grupo en el panel para añadir canales." y
  deshabilita Guardar. En el desplegable: un contador de aperturas descarta la respuesta de `getGroups` de una
  apertura anterior (no se mezclan las casillas de dos canales), y su posición se ajusta para no salirse de la
  ventana (como hace `openIconPicker`). La plantilla del desplegable sigue sin interpolaciones · Ficheros:
  `content.js`, `content.css` (estilo del mensaje vacío) · Test: `make lint` (sin avisos nuevos), `make test` y
  a mano V4 y V7.
- [x] T5 · Un botón por tarjeta en suscripciones, dentro del recorrido de tarjetas. Eliminar
  `scanSubscriptionsPage`, `scheduleSubscriptionsScan`, `resetSubscriptionsDiagnostics`,
  `addSubscriptionChannelControl`, `getChannelLinkFromCard` y su estado (`subscriptionChannelControls`,
  `subscriptionChannelUrls`, contadores y `console.log`), y sus llamadas en el observador, en
  `yt-navigate-finish` y en el arranque. Añadir `findChannelLink(card)` (el enlace con nombre y URL de canal que
  ya usa `getChannelFromCard`, que pasa a apoyarse en ella) y `ensureChannelControl(card)`, llamada desde
  `processPendingCards` para cada tarjeta programada y conectada, aunque ya estuviera detectada, cuando
  `shouldShowChannelControls()` sea cierto (en esta tarea: `pathname === "/feed/subscriptions"`). Reglas: si la
  tarjeta ya contiene un `.youtube-groups__subscription-control`, no hace nada (idempotente: insertar el
  control provoca una mutación que vuelve a programar la tarjeta); si no, lo inserta justo después de
  `findChannelLink(card)`. El control no guarda el canal: al pulsarlo, llama a `getChannelFromCard(card)` y, si
  no hay canal, muestra en el desplegable "No se ha podido identificar el canal.". Se mantienen las clases CSS y
  el `stopPropagation` del control · Ficheros: `content.js` · Test: `make lint`, `make test` y a mano V1, V2 y
  V3.
- [x] T6 · Botón también en la página de inicio. `shouldShowChannelControls()` devuelve cierto en `/` y en
  `/feed/subscriptions`; ajustar `content.css` si el control rompe la rejilla de inicio (que no aumente la altura
  de la tarjeta más de una línea ni desborde el ancho) · Ficheros: `content.js`, `content.css` · Test: a mano V1
  y V2 en `/`, y V8.
- [x] T7 · Panel "Canal actual" estable. Separar de `renderGroupsPanel` una
  `renderCurrentChannelSection(groups)`. Las mutaciones del bloque del propietario
  (`scheduleCurrentChannelPanelUpdate`) solo repintan esa sección, y solo si la URL del canal actual cambia
  respecto a la última pintada; si es la misma, no se toca nada (el formulario sigue abierto con lo marcado).
  `renderGroupsPanel` (cambios de grupos, guardado, navegación) sigue repintándolo todo · Ficheros: `content.js`
  · Test: `make lint`, `make test` y a mano V6.
- [x] T8 · "Ver canales" sin `innerHTML` interpolado. Construir el modal de la lista de canales con
  `createElement` y `textContent` (título con el nombre del grupo y número de canales, un `li` por canal con
  nombre y URL), con las mismas clases y el mismo comportamiento de cierre · Ficheros: `content.js` · Test:
  `make lint` muestra un aviso `UNSAFE_VAR_ASSIGNMENT` menos que antes (3 en lugar de 4); a mano: un grupo con un
  canal cuyo nombre contiene `<b>x</b>` (editado a mano en el almacenamiento con `about:debugging`) muestra el
  texto literal.

### Verificación manual (con `make up`)

- V1 · En la página (`/feed/subscriptions`; en T6 también `/`), cada tarjeta de vídeo con enlace de canal tiene
  exactamente un botón "Añadir a grupo", también dos vídeos seguidos del mismo canal y las tarjetas que se cargan
  al hacer scroll.
- V2 · Ir a otra página y volver (navegación interna, sin recargar): sigue habiendo un botón por tarjeta, y cada
  uno abre el selector con las casillas del canal de esa tarjeta.
- V3 · Pulsar el botón, marcar un grupo y un subgrupo, desmarcar otro y guardar: no navega; el panel actualiza
  los contadores al momento; tras recargar (F5) la pertenencia se mantiene y el canal no aparece dos veces en un
  grupo ("Ver canales").
- V4 · Sin grupos creados, el selector (tarjeta y panel) muestra "Crea un grupo en el panel para añadir canales."
  y Guardar está deshabilitado.
- V5 · Con un grupo activo y luego con un subgrupo activo, solo se ven los vídeos de sus canales (los de un grupo
  incluyen los de sus subgrupos). Con el filtro activo, en una tarjeta visible, desmarcar ese grupo y guardar: los
  vídeos de ese canal se ocultan, los de los demás canales del grupo siguen visibles y el resto sigue oculto (no
  aparecen todas las tarjetas).
- V6 · En `/watch`, abrir "Añadir a un grupo" en el panel, marcar una casilla y esperar o pasar el ratón por
  "Suscribirse": el formulario sigue abierto con lo marcado. Al pasar a un vídeo de otro canal, el nombre cambia y
  el formulario se cierra.
- V7 · Pulsar dos botones de canales distintos seguidos: el desplegable muestra solo las casillas del segundo. Un
  botón en la parte baja de la ventana abre el desplegable entero dentro de la ventana.
- V8 · En `/` la rejilla no se descoloca con el botón (tarjetas alineadas, sin desbordar).

## Criterios de aceptación

- Cada vídeo de `/feed/subscriptions` y de la página de inicio muestra un botón "Añadir a grupo" del canal de ese
  vídeo, también en vídeos cargados al hacer scroll y tras navegar dentro de YouTube.
- El selector (botón de tarjeta y panel en `/watch`) muestra todos los grupos y subgrupos con marcados los que ya
  contienen el canal; al guardar, el canal queda exactamente en los marcados, en una sola escritura, y se mantiene
  tras recargar.
- Un error al guardar se muestra en el selector y el botón Guardar vuelve a estar disponible; la pertenencia no
  queda a medias.
- Guardar actualiza al momento el panel y el filtro activo; con un grupo o subgrupo activo, el filtro se mantiene.
- Sin grupos, el selector explica que hay que crear uno.
- El formulario "Canal actual" del panel no se cierra solo mientras se usa.
- Los nombres de canal y de grupo se muestran como texto en "Ver canales", nunca como HTML.
- Los grupos guardados antes del cambio siguen cargando (formato versión 1 sin cambios, ADR 0001).
- `make lint` y `make test` pasan, con 3 avisos `UNSAFE_VAR_ASSIGNMENT` como máximo; `make build` no incluye
  `tests/`.

## Fuera de alcance

- Cambiar el formato de almacenamiento, migraciones o la identidad canónica de canales (`/@handle` frente a
  `/channel/UC...`), que sigue como tema pendiente en el ADR 0001.
- Botón en resultados de búsqueda, recomendaciones de `/watch`, listas de reproducción, página de un canal y
  Shorts (`ROADMAP.md`, fase 5), y tarjetas cuyo nombre de canal no es un enlace (nuevos diseños de YouTube): no
  tendrán botón.
- Fallos detectados fuera del flujo del botón, para otro plan: "Eliminar" en un subgrupo llama a `deleteGroup`,
  que solo busca en el primer nivel ("No existe el grupo indicado."); código sin uso (`getAllChannelsFromGroup`
  en `content.js`, `isChannelInGroup` y `getGroupsForChannel` en `modules/groups.js`).
- Los otros 3 avisos `UNSAFE_VAR_ASSIGNMENT` (SVG de iconos en el panel y el selector de iconos), cuyas rutas son
  constantes de `modules/icons.js`.
- Sincronizar otras pestañas (`storage.onChanged`), escrituras concurrentes entre pestañas, `background.js`,
  popup u opciones.
- Rediseñar el panel, cerrar formularios con Escape, renombrar clases CSS (`subscription-*` se mantienen aunque
  el botón salga también en inicio), traducciones.
- Excluir `README.md` y `ROADMAP.md` del paquete.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-14 | T1 | `test: añadir base de tests y exportar normalizeChannelUrl del módulo` (propuesto) | Helper vm, tests de storage y groups, `tests` fuera del paquete; 6 tests en verde, lint sin avisos nuevos. |
| 2026-11-14 | T2 | `feat: guardar la pertenencia del canal en una sola escritura` (propuesto) | `applyChannelGroupSelection` y `setChannelGroups` en el módulo; los dos formularios los usan, con `finally` y refresco de panel y filtro; 12 tests en verde, lint sin avisos nuevos (4). Pendiente V3 a mano. |
| 2026-11-14 | T3 | `fix: mantener el filtro de grupo al guardar y con subgrupos activos` (propuesto) | `getGroupChannelUrls` en el módulo; `refreshActiveGroupFilter` la usa y `applyFilterToCard` usa el canal del dataset; `console.log` quitados; 14 tests en verde, lint sin avisos nuevos (4). Pendiente V5 a mano. |
| 2026-11-14 | T4 | `refactor: compartir el selector de grupos y avisar cuando no hay grupos` (propuesto) | `renderChannelGroupChoices` compartido por panel y desplegable, aviso y Guardar deshabilitado sin grupos, contador de aperturas y posición ajustada a la ventana; 14 tests en verde, lint sin avisos nuevos (4). Pendiente V4 y V7 a mano. |
| 2026-11-14 | T5 | `feat: un botón por tarjeta en suscripciones dentro del recorrido de tarjetas` (propuesto) | Eliminado `scanSubscriptionsPage` y su estado; `findChannelLink` y `ensureChannelControl` desde `processPendingCards`; el control lee el canal de la tarjeta al pulsar y avisa si no hay; 14 tests en verde, lint sin avisos nuevos (4). Pendiente V1, V2 y V3 a mano. |
| 2026-11-14 | T6 | `feat: mostrar el botón de canal también en la página de inicio` (propuesto) | `shouldShowChannelControls` cierto en `/` y en suscripciones; `max-width: 100%` en el control; 14 tests en verde, lint sin avisos nuevos (4). Pendiente V1, V2 y V8 a mano (el ajuste de CSS no está verificado en la rejilla real). |
| 2026-11-14 | T7 | `fix: no repintar el formulario del canal actual si el canal no cambia` (propuesto) | `renderCurrentChannelSection` separada; las mutaciones del propietario solo la repintan si cambia la URL del canal; 14 tests en verde, lint sin avisos nuevos (4). Pendiente V6 a mano. |
| 2026-11-14 | T8 | `fix: construir el modal de Ver canales sin innerHTML interpolado` (propuesto) | Modal con `createElement` y `textContent`; avisos `UNSAFE_VAR_ASSIGNMENT` de 4 a 3; 14 tests en verde. Pendiente a mano la comprobación con un nombre `<b>x</b>`. |
