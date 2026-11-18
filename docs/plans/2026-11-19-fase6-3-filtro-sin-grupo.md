# Plan: Fase 6-3 · Filtro "Sin grupo"

**Estado:** borrador

Issue: ROADMAP 6-3 ("ver solo los vídeos de canales que aún no están en ningún grupo"). Hoja de ruta:
[2026-11-17-fase6-hoja-de-ruta](2026-11-17-fase6-hoja-de-ruta.md). ADR:
[0020](../adr/0020-filtro-sin-grupo-excluyente.md) (propuesta; modifica el 0011).

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

Hoy la selección de la guía (ADR 0007 y 0011) solo puede **incluir** canales: grupos, subgrupos o canales sueltos,
cuyo filtro es la unión de sus URL. Para clasificar lo que falta, la persona quiere ver solo los vídeos de canales que
no están en ningún grupo ni subgrupo. Se añade a la selección una clave especial, excluyente, cuyo filtro funciona
por **exclusión**. Detalle y alternativas en el ADR 0020.

Decisiones:

1. **Clave y modelo** (`modules/filter.js`): clave `ungrouped`, filtro `{ type: "ungrouped" }` y constante nueva
   `UNGROUPED_FILTER` (congelada, exportada). `normalizeFilter` acepta `{ type: "ungrouped" }`; `getFilterKey` da
   `"ungrouped"`; `parseFilterKey("ungrouped")` da el filtro; `normalizeSelection` la conserva. El traspaso por
   `sessionStorage` no cambia (`version: 3`).
2. **Excluyente**: `areSiblings` devuelve `true` si las dos claves son `ungrouped` y `false` si solo una lo es (hoy,
   con el mismo tipo, iría a la rama de grupos y daría `false` incluso consigo misma: hay que tratarlo antes).
   Con eso, `toggleSelection` sin más cambios: seleccionar "Sin grupo" deja `["ungrouped"]`; seleccionar un grupo o
   canal con "Sin grupo" activo la quita; volver a pulsarla la quita (`[]`, sin navegar).
3. **Resolver** (`resolveFilterUrls` y `resolveSelection`): para `ungrouped`, `resolveFilterUrls` devuelve
   `{ status: "ok", urls: <claves de canal agrupadas>, exclude: true }` con
   `YouTubeGroupsAvatars.getGroupedChannelKeys(groups)` (ya existe; `filter.js` se carga después de `avatars.js`).
   `resolveSelection` devuelve `{ selection, urls, exclude }`; `exclude` es `true` solo si lo que queda es
   `["ungrouped"]` y `false` en el resto (también sin selección). Las demás claves no cambian de comportamiento.
4. **Visibilidad** (`modules/visibility.js`): `matchesGroupFilter({ hasFilter, channelUrls, channelUrl, hasVideoId,
   exclude = false })`. Sin filtro o `channelUrls === null`: pasa (como hoy). Con canal: si `exclude`, pasa si
   `!channelUrls.has(YouTubeGroups.getChannelKey(channelUrl))`; si no, como hoy (`channelUrls.has(channelUrl)`). Sin
   canal: `!hasVideoId` en los dos modos. `visibility.js` se carga tras `groups.js`. El JSDoc dice que con `exclude`
   el conjunto son claves de canal.
5. **Estado compartido** (`content.js`, `ui/cards.js`): campo nuevo `ctx.state.activeSelectionExclude` (por defecto
   `false`). `refreshActiveSelection` asigna `activeSelectionUrls` y `activeSelectionExclude` juntos, en el mismo
   punto, con el resultado de `resolveSelection`; con selección vacía (en `setActiveSelection` y en
   `refreshActiveSelection`) se pone a `false`. `cardMatchesFilter` pasa `exclude: ctx.state.activeSelectionExclude
   === true` (el `=== true` deja funcionar los contextos de test que no tienen el campo).
6. **Entrada en la guía** (`ui/guide-section.js`, `ui/guide-section.css`):
   - Solo en la **columna raíz** (`column.parent === null`), al final de la lista de la columna, después de los grupos
     (y después de "Aún no hay grupos" si no hay ninguno), separada de ellos por una línea fina. Va dentro de la
     columna para animarse con ella. En las subcolumnas no aparece (el número de "Limpiar selección" sigue indicando
     que hay selección).
   - Es un `<button type="button">` creado con `createGuideButton` (misma clase `youtube-groups__guide-item` más
     `youtube-groups__guide-item--ungrouped`), dentro de un contenedor `youtube-groups__guide-ungrouped` con la
     misma estructura de fila (`youtube-groups__guide-row`) y un hueco del ancho del botón de desplegar para que el
     icono y el texto queden alineados con los de los grupos. Sin botón de desplegar, sin "›" y sin bullet.
   - Icono: icono de interfaz nuevo `ungrouped` en `UI_ICON_PATHS` (`modules/icons.js`), el "inbox" de Material
     Icons (Apache 2.0, viewBox 24, como los demás; comprobar que el path coincide con el original):
     `M19 3H4.99c-1.11 0-1.98.89-1.98 2L3 19c0 1.1.88 2 1.99 2H19c1.1 0 2-.9 2-2V5c0-1.11-.9-2-2-2zm0 12h-4c0
     1.66-1.35 3-3 3s-3-1.34-3-3H4.99V5H19v10z`. Se pinta con `createUiIconSvg("ungrouped", <tamaño de la marca de
     grupo en la guía>)`, que ya pone `aria-hidden="true"`.
   - Texto: "Sin grupo (N)", con N = `YouTubeGroupsSubscriptions.getUnclassifiedSubscriptions(subscriptions,
     groups).length` (suscripciones conocidas que no están en ningún grupo). Si no hay ninguna suscripción conocida
     (mapa vacío), solo "Sin grupo". `title`: "Ver solo vídeos de canales que no están en ningún grupo" y, si hay
     suscripciones conocidas, "· N suscripciones conocidas sin grupo" (singular "1 suscripción conocida sin grupo").
     El número no condiciona el filtro (ver 7).
   - `aria-pressed` = `ctx.state.activeSelection.includes("ungrouped")`; clic →
     `toggleSelectionItem(YouTubeGroupsFilter.UNGROUPED_FILTER)` (misma navegación a suscripciones que el resto).
   - No lleva `data-group-id` (así `updateNewVideoBullets` no la toca).
   - Suscripciones para el número: `renderGroupsPanel` (`content.js`) guarda las que ya lee en
     `ctx.state.subscriptions` (campo nuevo, `{}` por defecto) antes de `renderGuideSection`; `paintGuideSection`
     (`ui/guide-section.js`) también lee `getSubscriptions()` y lo guarda igual. `storage.onChanged` con
     `"subscriptions"` ya llama a `renderGroupsPanel`, así que el número se actualiza solo.
   - Estilos claro y `html[dark]` reutilizando los de `youtube-groups__guide-item` (pulsado incluido); solo se
     añaden el separador y el hueco de alineación.
7. **Qué cuenta como sin grupo**: todo canal identificado en la tarjeta que no esté en ningún grupo ni subgrupo, esté
   o no entre las suscripciones conocidas (sin depender de que `youtubeSubscriptions` esté completa). Tarjetas con ID
   de vídeo y sin canal identificado (mixes, colaboraciones, recomendaciones sin enlace a un canal no agrupado) no
   pasan, igual que con un grupo.
8. **Páginas**: las mismas que la selección actual: el filtro se aplica en todas las tarjetas que procesa
   `ui/cards.js` (inicio, suscripciones, búsqueda, recomendaciones de `/watch`, Shorts de estanterías, canal) y al
   seleccionarlo fuera de `/feed/subscriptions` se navega allí (`shouldNavigateOnSelect`). "Vídeos fuera del filtro"
   decide si los agrupados se ocultan o se atenúan.
9. **Persistencia**: igual que la selección: memoria de la pestaña, traspaso por `sessionStorage` en la navegación con
   carga completa; no se guarda en `browser.storage.local`.
10. **Otros componentes**: `getCreateTarget` ignora `ungrouped` (solo mira `group:`), así que con "Sin grupo" el (+)
    crea un grupo en la raíz o un subgrupo del padre de la columna; `ui/new-videos.js` (`groupIdsOf`) la ignora, así
    que no reconoce nada; "Limpiar selección" la cuenta como 1.

Alternativas descartadas (más en el ADR 0020): filtrar por `getUnclassifiedSubscriptions` (depende de una lista
parcial); combinar "Sin grupo" con grupos; casilla o ajuste aparte de la selección; poner la entrada en el pie junto a
"Limpiar selección" (es un filtro, no una acción, y debe verse pulsado como los grupos) o en todas las columnas
(repetida en cada nivel sin aportar).

## Tareas

- [ ] T1 · Clave `ungrouped` en el modelo del filtro · Ficheros: `modules/filter.js`, `tests/filter.test.js` · Test:
  `normalizeFilter({ type: "ungrouped" })` da `{ type: "ungrouped" }` y `getFilterKey` `"ungrouped"`;
  `parseFilterKey("ungrouped")` da el filtro y `parseFilterKey("ungrouped:x")` `null`; `normalizeSelection` conserva
  `"ungrouped"` sin duplicarla; `toggleSelection(groups, ["group:A","group:B"], UNGROUPED_FILTER)` da `["ungrouped"]`;
  `toggleSelection(groups, ["ungrouped"], { type: "group", id: "A" })` da `["group:A"]` (igual con un canal);
  `toggleSelection(groups, ["ungrouped"], UNGROUPED_FILTER)` da `[]`; `resolveSelection` con `["ungrouped"]` da
  `selection: ["ungrouped"]`, `exclude: true` y `urls` con las claves de canal de grupos y subgrupos (un `/@Foo`
  guardado aparece como `…/@foo`), con `[]` grupos da un conjunto vacío (no `null`); con `["group:A", "ungrouped"]`
  (de `sessionStorage`) queda `["ungrouped"]` y con `["ungrouped", "group:A"]` queda `["group:A"]` y `exclude: false`;
  `resolveSelection` con grupos o canales sigue dando `exclude: false` y las mismas `urls` que antes;
  `serializePendingSelection(["ungrouped"])` + `parsePendingSelection` devuelve `["ungrouped"]`;
  `shouldNavigateOnSelect("home", [], ["ungrouped"])` es `true`.
- [ ] T2 · Visibilidad por exclusión · Ficheros: `modules/visibility.js`, `tests/visibility.test.js` · Test: con
  `exclude: true` y `channelUrls` = claves `{ …/@uno }`: canal `…/@Uno` no pasa, `…/@dos` pasa; sin canal y con ID de
  vídeo no pasa; sin canal ni ID pasa; `channelUrls: null` pasa; `hasFilter: false` pasa. Los casos actuales (sin
  `exclude`) pasan sin cambiar lo que comprueban.
- [ ] T3 · Estado `activeSelectionExclude` y tarjetas · Ficheros: `content.js`, `ui/cards.js`,
  `tests/ui-cards.test.js` · Test (jsdom, `createCards` con `activeSelection: ["ungrouped"]`, `activeSelectionUrls` =
  claves del canal de la tarjeta de `SUBSCRIPTION_CARD_HTML`, `activeSelectionExclude: true`): la tarjeta de ese canal
  queda atenuada (`youtube-groups--dimmed`, ajuste por defecto) y otra tarjeta de un canal distinto queda visible;
  con `outsideMode: "hide"` la agrupada queda oculta; sin el campo `activeSelectionExclude` el comportamiento de los
  tests actuales no cambia.
- [ ] T4 · Icono de interfaz `ungrouped` · Ficheros: `modules/icons.js`, `tests/icons.test.js` (y
  `tests/ui-icons-dom.test.js` si lista los iconos de interfaz) · Test: `getUiIconPath("ungrouped")` devuelve un path
  no vacío; no aparece en `ICON_SET` (no sale en el selector de iconos de grupos).
- [ ] T5 · Entrada "Sin grupo" en la guía · Ficheros: `ui/guide-section.js`, `ui/guide-section.css`, `content.js`,
  `tests/ui-guide-section.test.js`, `tests/ui-cards.test.js` (y `tests/helpers/youtube-fixtures.js` si hace falta una
  tarjeta de un segundo canal) · Test (jsdom, `loadDom` completo con `GUIDE_HTML` y los grupos de `guideStore`):
  - en la raíz hay un botón `.youtube-groups__guide-item--ungrouped` después de las filas de grupo, con
    `aria-pressed="false"`, un SVG `aria-hidden`, sin `data-group-id` y sin botones de desplegar ni "›";
  - con `youtubeSubscriptions` con tres canales, uno de ellos en el subgrupo A1, el texto es "Sin grupo (2)" y el
    `title` dice "2 suscripciones conocidas sin grupo"; sin suscripciones, "Sin grupo" sin número; un
    `storage.onChanged` de `youtubeSubscriptions` con una más actualiza el número sin recargar;
  - al entrar en el subgrupo A ("›") la entrada no está en la columna; al volver, sí;
  - sin grupos, aparece tras "Aún no hay grupos";
  - pulsarla en `/feed/subscriptions` marca `aria-pressed="true"`, "Limpiar selección (1)" y deja la selección en
    `["ungrouped"]`; pulsar después el grupo A la desmarca y marca A; pulsarla otra vez la desmarca sin navegar;
  - pulsarla en `/` (inicio) navega a suscripciones (pulsa el enlace de la guía o guarda `youtubeGroupsPendingFilter`
    con `["ungrouped"]`, como los tests actuales de navegación);
  - integración (`tests/ui-cards.test.js`, con `clickGuideItem(document, "Sin grupo")` y dos tarjetas en
    `/feed/subscriptions`, una de `CHANNEL_URL` —en el grupo A— y otra de un canal sin grupo): tras pulsar y
    `flush()`, la de A está atenuada y la otra visible; tras "Limpiar selección", las dos visibles.
- [ ] T6 · Cerrar · Ficheros: `docs/ARCHITECTURE.md` (fila de `modules/filter.js` con `UNGROUPED_FILTER` y
  `exclude`; `modules/visibility.js`; `modules/icons.js` con `ungrouped`; `ui/guide-section.js` con la entrada; flujo
  "Filtro" con la clave excluyente y el modo exclusión; flujo "Guía lateral" con la entrada en la raíz; `ctx.state`
  con `activeSelectionExclude` y `subscriptions`; ADR 0020 en "Decisiones"), `docs/adr/0020-…` (aceptada),
  `docs/adr/0011-…` (cabecera "Modificado por: [0020](0020-filtro-sin-grupo-excluyente.md) (clave `ungrouped`)"),
  `ROADMAP.md` (6-3 ✅), este plan a `hecho` · Test: `make lint`, `make test` y V1 a V7.

### Verificación manual (Firefox, extensión recargada, sesión iniciada, con algún grupo y suscripciones sin grupo)

- V1 · En la raíz de la sección "YouTube Groups" aparece "Sin grupo (N)" con su icono al final, separada de los
  grupos; N coincide con "Suscripciones sin grupo (N)" del editor.
- V2 · En `/feed/subscriptions`, pulsar "Sin grupo": los vídeos de canales agrupados se atenúan (u ocultan con
  "Vídeos fuera del filtro" en ocultar) y los de canales sin grupo se ven normal.
- V3 · Desde inicio o un vídeo, pulsar "Sin grupo" lleva a suscripciones con el filtro aplicado.
- V4 · Con "Sin grupo" activo, pulsar un grupo cambia a ese grupo; pulsar "Sin grupo" con un grupo activo deja solo
  "Sin grupo"; pulsarla otra vez o "Limpiar selección" muestra todo.
- V5 · Con "Sin grupo" activo, añadir un canal visible a un grupo con "+G": sus vídeos pasan a atenuarse u ocultarse
  y N baja en uno si era una suscripción conocida, sin recargar.
- V6 · Navegación por teclado: la entrada se alcanza con Tab, se activa con Enter y Espacio y el lector de pantalla
  anuncia "Sin grupo (N)" y su estado pulsado.
- V7 · Regresión: selección de grupos y canales, bullets de vídeos nuevos, botón de crear y editor sin errores en la
  consola.

## Criterios de aceptación

- La guía muestra en su columna principal una entrada "Sin grupo", con icono y el número de suscripciones conocidas
  sin grupo, que se activa y desactiva como un grupo y se anuncia como botón pulsado o no.
- Con "Sin grupo" activo, los vídeos de canales que están en algún grupo o subgrupo se ocultan o atenúan según
  "Vídeos fuera del filtro", y los del resto de canales se ven, sean o no suscripciones conocidas.
- "Sin grupo" nunca convive con grupos ni canales en la selección.
- Seleccionarla fuera de suscripciones lleva a suscripciones con el filtro aplicado; quitarla no navega.
- No hay peticiones de red, permisos nuevos, dependencias nuevas ni cambios de formato en `browser.storage.local` o
  la copia de seguridad.

## Fuera de alcance

- Combinar "Sin grupo" con grupos o canales.
- Mostrar la entrada en las subcolumnas o en el menú de opciones.
- Contador de vídeos nuevos para "Sin grupo" (ADR 0019 no anota vídeos de canales sin grupo).
- Listar en la guía los canales sin grupo o añadirlos a un grupo desde ella (eso está en el editor, 6-4).
- Resolver la equivalencia `/@handle` ↔ `/channel/UC…` de un mismo canal.
- Canales ocultos (6-7) y reglas de autoasignación (6-10).

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
