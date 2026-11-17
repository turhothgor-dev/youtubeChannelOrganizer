# Plan: Refactor de `content.js` en componentes de `ui/`

**Estado:** aprobado (2026-11-17)

Issue: petición de la persona (2026-11-17): refactor completo de `content.js` antes de la Fase 6. ADR:
[0015](../adr/0015-componentes-de-interfaz-en-ui.md) (modifica el punto 3 del
[0014](../adr/0014-pagina-de-opciones-editor-de-grupos.md)).

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

Requisito de: `2026-11-17-fase6-1-editor-de-grupos.md` (su T6 desaparece; ver T14).

## Contexto y decisión

`content.js` tiene 4163 líneas en un IIFE con unas 40 variables de estado compartido. Decidido con la persona
(2026-11-17), con el detalle en el ADR 0015:

- Refactor **completo** antes de la Fase 6, **solo moviendo código**: ningún cambio de comportamiento visible ni de
  almacenamiento. Un commit por fichero extraído.
- Componentes en `ui/` como scripts clásicos (IIFE) con un global `YouTubeGroups<Componente>`, cargados en
  `manifest.json` tras `modules/` y antes de `content.js`. Estado compartido en un objeto de contexto explícito `ctx`.
- `content.js` queda como orquestador (~500 líneas).
- CSS partido por componente en una tarea propia, al final.
- Tests de DOM con `linkedom` (`devDependency`, solo tests) y tests de humo por componente.

Se descarta: módulos ES o empaquetador, globales `var` sin `ctx`, reescribir con clases o un bus de eventos y el
refactor parcial (ver ADR 0015). Se descarta también, en este plan, **unificar el patrón singleton** de los dos
desplegables y el selector de iconos: no es idéntico (el selector oculta también el contenedor; cada uno registra sus
escuchadores la primera vez que se abre) y unificarlo ya no es mover código. Queda como posible mejora.

### Por qué `linkedom` (y cuándo `jsdom`)

`linkedom` (pocas dependencias, arranque rápido) crea elementos y SVG, ejecuta selectores (incluidos `:has()` y
`:not()` complejos de `VIDEO_CARD_SELECTOR`), despacha eventos y tiene `MutationObserver`. No maqueta: no hay
posiciones ni `checkVisibility`. **Criterio para pasar a `jsdom`** (aprobado de antemano; se anota en **Registro** y
en el ADR 0015): si en T1 o T2 los tests de humo necesitan sustituir comportamiento del DOM (no solo APIs de
maquetación o del navegador: `getBoundingClientRect`, `requestAnimationFrame`, `matchMedia`, `focus`,
`checkVisibility`), por ejemplo `form.reset()`, `hidden`, `style.setProperty`, `CustomEvent` o el
`MutationObserver`, o si algún selector de `content.js` no funciona.

La dependencia **no va en el paquete**: `web-ext` ignora `node_modules` por defecto y `tests` está en `ignoreFiles` de
`web-ext-config.mjs`; Prettier ignora `node_modules` por defecto. T1 lo comprueba en el `.zip` de `make build`.

**Instalación**: no hay objetivo de `make` para añadir una dependencia (`make setup` solo instala lo que ya está en
`package.json`). **Antes de T1, la persona ejecuta `npm install --save-dev linkedom`** (actualiza `package.json` y
`package-lock.json`), o, si cambia a `jsdom`, `npm install --save-dev jsdom`. El programador no ejecuta `npm`.

### Reglas del refactor (todas las tareas de extracción)

1. **Solo se mueve código.** Las líneas movidas (con sus comentarios y JSDoc) no cambian salvo estas sustituciones
   mecánicas:
   - una variable de estado compartido `x` pasa a `ctx.state.x` (lista abajo);
   - una llamada a una función que ya está en otro fichero pasa a `ctx.<espacio>.<función>(…)` o, para los
     componentes sin estado, a la función desestructurada de su global al principio del fichero;
   - un bloque que se mueve entero a un método nuevo (solo los indicados en el mapa, como `start()`) conserva sus
     líneas y su orden.
   No se renombra, no se borra código muerto, no se corrigen erratas ni se cambia el formato más allá de lo que haga
   Prettier por la sangría.
2. **Sin efectos al cargar.** Un fichero de `ui/` solo declara. Al principio de su IIFE puede desestructurar globales
   cargados **antes** (los de `modules/`, `YouTubeGroupsIconsDom`, `YouTubeGroupsIconPicker`); el resto de
   componentes solo se usan a través de `ctx`, en el momento de la llamada (nunca `const { x } = ctx.cards` al crear).
3. **API**: `YouTubeGroupsIconsDom` y `YouTubeGroupsIconPicker` exponen sus funciones con el nombre actual
   (congeladas con `Object.freeze`). El resto expone `create(ctx)`, que devuelve un objeto congelado con las funciones
   de su API (nombre actual) y no toca el DOM; si el componente registra escuchadores globales o hace una llamada
   inicial, lo hace en `start()`, que `content.js` llama **en el punto exacto** donde hoy están esas líneas, para no
   cambiar el orden de registro de escuchadores del mismo evento ni el de las llamadas iniciales.
4. **Puente durante la transición**: T4 crea `ctx` con un espacio de nombres por componente que apunta a las
   funciones que aún están en `content.js`. Cada extracción sustituye el puente por `YouTubeGroups<X>.create(ctx)` y
   cambia a `ctx.<espacio>.f(…)` las llamadas que quedan en `content.js` y en otros ficheros aún no extraídos; los
   ficheros ya extraídos no se tocan.
5. **Revisión**: el revisor comprueba el diff con `git show --color-moved=dimmed-zebra --color-moved-ws=allow-indentation-change`;
   todo lo que no sea movido debe ser una de las sustituciones del punto 1, una línea de `manifest.json`, la
   cabecera o el cierre del IIFE nuevo, o tests.

### `ctx`

Se crea al principio del IIFE de `content.js` (antes de cualquier uso). Las funciones declaradas en `content.js` se
pueden referenciar en él porque se elevan (hoisting).

- `ctx.state` (estado que leen o escriben dos o más ficheros): `settings`, `settingsLoaded`, `settingsLoadError`,
  `settingsWriteSeq`, `settingsAppliedSeq`, `watchedVideos`, `watchedLoadError`, `watchedWriteSeq`,
  `watchedAppliedSeq`, `activeSelection`, `activeSelectionUrls`, `advancedFilters`.
- Funciones del orquestador: `ctx.setActiveSelection`, `ctx.refreshActiveSelection`, `ctx.handleGroupsRemoved`,
  `ctx.renderGroupsPanel`, `ctx.navigateToSubscriptions`.
- Espacios de nombres: `ctx.watched`, `ctx.cards`, `ctx.dropdowns`, `ctx.panel`, `ctx.guide`, `ctx.player` (API en el
  mapa).
- Privado de su fichero (sigue como `let`/`const` local): `filterUpdateVersion` (`content.js`); `savingWatchedIds`,
  `autoMarkHandledIds`, `autoMarkArmedId` (`watched`); `channelNameIndex`, `detectedCards`, `pendingCards`,
  `processingScheduled`, `cardMetadataCache` (`cards`); `guideCheckScheduled`, `guidePath`, `guideChannelOverrides`,
  `guideGroups`, `guideRenderedTargetKey`, `guideCreateTarget`, `guideAnchorCache`, `guidePinPath`,
  `guidePinScheduled` (`guide`); `renderedCurrentChannelUrl`, `currentChannelUpdateScheduled` (`panel`); los
  singletons de los desplegables y del selector; `playerControlScheduled`, `playerNavigating`, `playerControl`
  (`player`).

### Mapa de funciones

Cada fila indica qué se mueve (nombres de `content.js` hoy) y la API pública. Lo no listado como API es privado.

| Fichero (global) | Se mueve | API |
| --- | --- | --- |
| `ui/icons-dom.js` (`YouTubeGroupsIconsDom`, sin `ctx`, ~160) | `createIconSvg`, `createUiIconSvg`, `setCardButtonContent`, `GROUP_ICON_SIZES`, `createGroupMark`, `setGroupBand`, `shieldControlEvents` | todo lo movido |
| `ui/icon-picker.js` (`YouTubeGroupsIconPicker`, sin `ctx`, ~255) | `iconPicker`, `iconPickerListenersAdded`, `getOrCreateIconPicker`, `hideIconPicker`, `createIconPicker`, `openIconPicker` | `openIconPicker`, `hideIconPicker` |
| `ui/player.js` (`YouTubeGroupsPlayer`, ~190) | `PLAYER_SELECTOR`, `PLAYER_CONTROL_CLASS`, sus variables, `createPlayerControl`, `syncPlayerControl`, `schedulePlayerControlSync`; a `start()`: los escuchadores `play`/`pause`/`ended`, `yt-navigate-start`, `yt-navigate-finish`, `fullscreenchange` y el `syncPlayerControl()` inicial; a `noteMutations()`: el bloque `if (… === "watch") { … }` del observer | `syncPlayerControl`, `schedulePlayerControlSync`, `noteMutations`, `start` |
| `ui/dropdowns.js` (`YouTubeGroupsDropdowns`, ~550) | `renderChannelGroupChoices`, desplegable de suscripción (`subscriptionDropdown*`, `getOrCreateSubscriptionDropdown`, `hideSubscriptionDropdown`, `positionSubscriptionDropdown`, `openSubscriptionGroupsForm`, `createSubscriptionDropdown`) y de listas (`playlistDropdown*`, `hidePlaylistDropdown`, `getOrCreatePlaylistDropdown`, `renderPlaylistChoices`, `openPlaylistForm`, `createPlaylistDropdown`) | `renderChannelGroupChoices`, `openSubscriptionGroupsForm`, `hideSubscriptionDropdown`, `openPlaylistForm`, `hidePlaylistDropdown` |
| `ui/watched.js` (`YouTubeGroupsWatchedUi`, ~300) | `savingWatchedIds`, `autoMarkHandledIds`, `autoMarkArmedId`, `applyWatchedToCard`, `updateWatchedButton`, `toggleVideoWatched`, `refreshWatchedUi`, `getCurrentVideoId`, `isWatchPageInSync`, `getCurrentWatchVideoData`, `markVideoWatched`, `handleVideoProgress`, `toggleCurrentVideoWatched`; a `start()`: el escuchador `timeupdate` y la lectura inicial `getWatchedVideos()` (en ese orden, en el punto donde hoy está el escuchador) | `applyWatchedToCard`, `updateWatchedButton`, `toggleVideoWatched`, `getCurrentVideoId`, `isWatchPageInSync`, `getCurrentWatchVideoData`, `toggleCurrentVideoWatched`, `start` |
| `ui/cards.js` (`YouTubeGroupsCards`, ~700) | `VIDEO_CARD_SELECTOR`, `WATCHED_CLASS`, `VIDEO_ID_ATTRIBUTE`, `applyVisibilityToAllCards`, `findVideoId`, detección (`getChannelName`, `findChannelLink`, `getChannelFromCard`, `getDetectedChannel`, `updateAddButtonAvailability`, `detectCard`, `refreshChannelNameIndex`, `getCurrentVideoChannel` y sus selectores), controles (`createSubscriptionChannelControl`, `getVideoDataFromCard`, `ensureChannelControl`, `placeControlOnThumbnail`, `ensureChannelResultControl`), filtrado y visibilidad (`cardMatchesFilter`, `cardMetadataCache`, `getCardTexts`, `getChannelTexts`, `getCardMetadata`, `cardMatchesAdvancedFilters`, `applyCardVisibility`, `showAllVideoCards`, `filterAllDetectedCards`), programación (`scheduleCard`, `processPendingCards`, `scheduleCardsIn`, `scheduleContainingCard`, `scanDocument`, `nodeBelongsToCurrentVideoOwner`); nueva `resetDetectedCards()` con la única línea `detectedCards = new WeakMap();` | las tres constantes, `applyVisibilityToAllCards`, `findVideoId`, `getChannelFromCard`, `getCurrentVideoChannel`, `refreshChannelNameIndex`, `applyCardVisibility`, `showAllVideoCards`, `filterAllDetectedCards`, `scheduleCardsIn`, `scheduleContainingCard`, `scanDocument`, `nodeBelongsToCurrentVideoOwner`, `resetDetectedCards` |
| `ui/guide-section.js` (`YouTubeGroupsGuideSection`, ~650) | `GUIDE_SECTIONS_SELECTOR`, `GUIDE_SECTION_ID`, estado de la guía, `toggleSelectionItem`, `createGuideButton`, `createGuideRow`, `showParentColumn`, `resetGuideCreateForm`, `createGuideCreateForm`, ancla (`findGuideAnchor`, `invalidateGuideAnchor`, `getGuideAnchor`, `isGuideSectionInPlace`), `renderGuideSection`, `paintGuideSection`, `scheduleGuideCheck`; guía fija (`GUIDE_PINNED_CLASS`, `GUIDE_BUTTON_SELECTOR`, `syncGuidePin`, `scheduleGuidePinSync`); a `start()`: el `click` en captura de ☰, `yt-navigate-start`, `yt-navigate-finish`, `popstate`, `fullscreenchange`, `resize` y el `syncGuidePin()` inicial; a `noteMutations(mutations)`: el `if (location.pathname !== guidePinPath)` y el bloque de invalidar el ancla del observer; a `checkPlacement()`: el `if (!isGuideSectionInPlace()) scheduleGuideCheck();` del final del observer | `renderGuideSection`, `noteMutations`, `checkPlacement`, `start` |
| `ui/panel.js` (`YouTubeGroupsPanel`, ~1000) | `GROUPS_PANEL_ID`, `syncSettingsControls`, `syncFiltersControls`, `changeSetting`, `setupCleanupSection`, `createGroupsPanel`, `showPlaylistError`, `closePlaylistModal`, `openPlaylistVideosModal`, `renderPlaylistsSection`, `promptRenameGroup`, `confirmDeleteGroup`, `renderCurrentChannelSection`, `getAllChannelsFromGroup`, `renderCurrentVideoSection`, `scheduleCurrentChannelPanelUpdate` y sus variables | `createGroupsPanel`, `syncSettingsControls`, `renderPlaylistsSection`, `openPlaylistVideosModal`, `closePlaylistModal`, `renderCurrentChannelSection`, `renderCurrentVideoSection`, `scheduleCurrentChannelPanelUpdate` |
| `content.js` (orquestador, ~500) | se queda: desestructuración de globales, `ctx` y `ctx.state`, `getGroups().catch(…)` inicial, lectura de ajustes, `setActiveSelection`, `handleGroupsRemoved`, `refreshActiveSelection`, `renderGroupsPanel`, `navigateToSubscriptions`, `consumePendingFilter`, `clearPendingFilter`, el `MutationObserver` (llamando en el mismo orden a `ctx.guide.noteMutations`, `ctx.player.noteMutations`, el bucle de tarjetas y `ctx.guide.checkPlacement`), `yt-navigate-finish` (`ctx.cards.resetDetectedCards()` en lugar de la asignación), arranque y `handleStorageChange` | — |

Orden de carga en `manifest.json` (tras `modules/backup.js`): `ui/icons-dom.js`, `ui/icon-picker.js`,
`ui/dropdowns.js`, `ui/player.js`, `ui/watched.js`, `ui/cards.js`, `ui/guide-section.js`, `ui/panel.js`,
`content.js`. Cada tarea añade su línea en esa posición relativa.

### Ayudante de tests `tests/helpers/load-dom.js`

`loadDom({ url, html, store, scripts, confirm, prompt })` (todo opcional) devuelve
`{ window, document, browser, store, calls, sessionStorage, location, flush, global }`:

- Crea un documento de linkedom (`parseHTML`) con `html` dentro de `<body>` (por defecto vacío) y ejecuta con
  `node:vm` los scripts de `manifest.json` (`content_scripts[0].js`, en su orden; con `scripts` se puede pasar una
  lista, p. ej. sin `content.js`). Así los tests siguen solos el manifiesto.
- Globales del contexto: `window`, `document` y los constructores del DOM de linkedom que usa el código (`Element`,
  `HTMLElement`, `HTMLVideoElement`, `HTMLFormElement`, `MutationObserver`, `Event`, `CustomEvent`…); `location`
  (desde `url`, por defecto `https://www.youtube.com/feed/subscriptions`, con `assign` que registra la URL),
  `sessionStorage` en memoria, `requestAnimationFrame` en cola, `matchMedia` (`matches: false`), `innerWidth` 1280 e
  `innerHeight` 800, `confirm`/`prompt`/`alert` configurables, `URL`, `Blob`, `crypto`, `structuredClone`, `console`.
- Sustitutos mínimos solo si linkedom no los tiene, cada uno con un comentario: `getBoundingClientRect` (ceros),
  `focus`, `checkVisibility` (`true`).
- `browser.storage.local` como en `load-modules.js` (copias, contador de llamadas) más `browser.storage.onChanged`
  (`addListener`; cada `set` avisa a los escuchadores de forma asíncrona con `{ [clave]: { oldValue, newValue } }` y
  `"local"`).
- `flush()`: espera microtareas y ejecuta los `requestAnimationFrame` pendientes, en bucle hasta que no quede nada
  (con un límite de vueltas que lanza si se supera).
- `global(name)`: devuelve un global del contexto (p. ej. `YouTubeGroupsPlayer`).

Fragmentos de HTML de YouTube para los tests en `tests/helpers/youtube-fixtures.js` (guía con `#sections` y una
sección "Más de YouTube" según `findGuideInsertionIndex`, tarjeta de suscripciones con miniatura, enlace de vídeo y de
canal, resultado de canal de búsqueda, página `/watch` con `#movie_player`, `<video>`, `ytd-watch-flexy[video-id]` y
propietario). Las propiedades que linkedom no tiene (`video.paused`, `currentTime`, `duration`) se fijan con
`Object.defineProperty` en el test.

## Tareas

Reglas comunes: las **Reglas del refactor**; JSDoc en lo nuevo (ayudantes, `create`, `start`, `noteMutations`,
`checkPlacement`, `resetDetectedCards`); `make lint` y `make test` en verde; verificación manual indicada (lista al
final) con la extensión recargada y **sin errores nuevos en la consola**.

- [x] T1 · `linkedom` y ayudante de DOM, con un test de humo del panel actual. (Antes, la persona ha ejecutado
  `npm install --save-dev linkedom`.) · Ficheros: `package.json`, `package-lock.json` (de la persona, se commitean
  aquí), `tests/helpers/load-dom.js`, `tests/helpers/youtube-fixtures.js`, `tests/dom-helper.test.js`,
  `tests/ui-panel.test.js`, `tests/manifest.test.js` · Test: `dom-helper`: cargar solo `modules/` (sin `content.js`)
  no cambia el `<body>` ni llama a `storage.local.get`/`set`; un `set` avisa a `onChanged`; `flush` ejecuta un
  `requestAnimationFrame` encadenado. `ui-panel` (contra el `content.js` actual): tras cargar y `flush`, hay un solo
  `#youtube-groups-panel`, minimizado (`youtube-groups--collapsed`); un `yt-navigate-finish` y otro `flush` no lo
  duplican; pulsar el botón de minimizar guarda `panelCollapsed: false` y quita la clase. `manifest`: todos los
  ficheros de `content_scripts` existen, `modules/*` van antes que `ui/*` y `content.js` es el último. Además, a
  mano: `make build` y `unzip -l web-ext-artifacts/*.zip` no listan `node_modules/`, `tests/` ni `linkedom`. Si se
  cumple el criterio de `jsdom`, se cambia aquí (la persona instala `jsdom` y desinstala `linkedom`).
- [x] T2 · Tests de humo, contra el `content.js` actual, de tarjetas, desplegables, vistos y reproductor ·
  Ficheros: `tests/ui-cards.test.js`, `tests/ui-dropdowns.test.js`, `tests/ui-watched.test.js`,
  `tests/ui-player.test.js`, `tests/helpers/youtube-fixtures.js` · Test: **cards**: en suscripciones, una tarjeta
  recibe un único `.youtube-groups__subscription-control` dentro de la miniatura (`data-youtube-groups-thumb-host`),
  también tras una mutación en la tarjeta y `flush`; con el canal guardado en el grupo A y otro grupo B, seleccionar B
  (botón de la guía) da `youtube-groups--hidden` a la tarjeta y "Limpiar selección" se la quita; un resultado de canal
  en `/results` recibe solo "Añadir a grupo". **dropdowns**: "+G" abre un único
  `.youtube-groups__subscription-dropdown` con una casilla por grupo; marcar B y "Guardar" añade el canal a B en el
  almacenamiento; abrirlo dos veces no crea otro; "Lista" abre el de listas, "Crear" con un nombre crea la lista y la
  deja marcada; abrir uno oculta el otro. **watched**: "Marcar visto" guarda el ID y pone `youtube-groups--watched` en
  la tarjeta; con `autoMarkPercent: 50`, un `timeupdate` en `/watch` con `currentTime` 60 y `duration` 100 lo marca;
  un cambio de `watched` desde `onChanged` actualiza la tarjeta. **player**: en `/watch` con el vídeo pausado hay un
  único `.youtube-groups__player-actions` visible dentro de `#movie_player`; un `play` (sin pausa) y `flush` lo ocultan;
  `yt-navigate-start` lo oculta.
- [x] T3 · Tests de humo, contra el `content.js` actual, de la guía, el selector de iconos y los iconos · Ficheros:
  `tests/ui-guide-section.test.js`, `tests/ui-icon-picker.test.js`, `tests/ui-icons-dom.test.js` · Test:
  **guide**: un único `#youtube-groups-guide` justo antes de la sección "Más de YouTube"; añadir un nodo a
  `#sections` y `flush` no lo duplica ni lo mueve; con A (subgrupo A1) la fila muestra "A (n)"; "›" entra en A y "‹"
  vuelve; "+ Grupo" con "Nuevo" crea el grupo en el almacenamiento y la fila aparece; con un nombre de un carácter
  muestra el error de `validateGroupName` y no escribe; en `/feed/subscriptions` la clase
  `youtube-groups--guide-pinned` está en `<html>` y en `/` no. **icon-picker**: el botón "Icono" del formulario abre
  un único `.youtube-groups__icon-picker` visible; elegir un icono y "Guardar" pone su SVG en la vista previa del
  formulario y oculta el selector; "Cancelar" lo oculta; abrirlo dos veces no crea otro. **icons-dom**: por ahora, a
  través de la guía: la marca de un grupo con icono es un `.youtube-groups__icon` con un `<svg>` de 27 px y la fila
  con color tiene `youtube-groups__group-band` y `--yg-group-color`.
- [x] T4 · `ctx` y `ctx.state` en `content.js`, sin mover nada a otros ficheros: las variables compartidas de la lista
  pasan a `ctx.state.*` y se crean los espacios de nombres puente (Regla 4) · Ficheros: `content.js` · Test: `make
  test` (todos los de T1 a T3 sin cambios) y a mano V1–V6.
- [x] T5 · Extraer `ui/icons-dom.js` · Ficheros: `ui/icons-dom.js`, `content.js`, `manifest.json`,
  `tests/ui-icons-dom.test.js` · Test: se añade una prueba directa (cargando sin `content.js`): `createIconSvg` de un
  id válido da un `<svg>` con `viewBox` y el tamaño pedido, y `null` con un id desconocido; `setGroupBand` pone y
  quita la clase y la variable; `setCardButtonContent` dos veces no duplica glifo ni etiqueta; `shieldControlEvents`
  impide que un `click` llegue al padre. Los de T1–T3 siguen en verde. A mano V1, V3, V6.
- [x] T6 · Extraer `ui/icon-picker.js` · Ficheros: `ui/icon-picker.js`, `content.js`, `manifest.json`,
  `tests/ui-icon-picker.test.js` · Test: prueba directa sin `content.js`: `openIconPicker` con un botón ancla abre el
  selector; "Guardar" llama a `onSave` con `{ iconId, colorHex }`; si `onSave` lanza, el error se muestra y sigue
  abierto; `hideIconPicker` lo oculta. A mano V6.
- [x] T7 · Extraer `ui/player.js` · Ficheros: `ui/player.js`, `content.js`, `manifest.json`,
  `tests/ui-player.test.js` · Test: `YouTubeGroupsPlayer.create` es una función y crearlo no toca el DOM; los de T2
  siguen en verde. A mano V4.
- [x] T8 · Extraer `ui/dropdowns.js` · Ficheros: `ui/dropdowns.js`, `content.js`, `manifest.json`,
  `tests/ui-dropdowns.test.js` · Test: `create` no toca el DOM; los de T2 siguen en verde. A mano V3, V4.
- [x] T9 · Extraer `ui/watched.js` · Ficheros: `ui/watched.js`, `content.js`, `manifest.json`,
  `tests/ui-watched.test.js` · Test: `create` no toca el DOM ni registra `timeupdate` hasta `start()`; los de T2
  siguen en verde. A mano V2, V3, V4.
- [x] T10 · Extraer `ui/cards.js` · Ficheros: `ui/cards.js`, `content.js`, `manifest.json`, `tests/ui-cards.test.js` ·
  Test: `create` no toca el DOM; `resetDetectedCards` y `scanDocument` vuelven a procesar una tarjeta cuyo enlace de
  canal ha cambiado; los de T2 siguen en verde. A mano V2, V3.
- [x] T11 · Extraer `ui/guide-section.js` · Ficheros: `ui/guide-section.js`, `content.js`, `manifest.json`,
  `tests/ui-guide-section.test.js` · Test: `create` no toca el DOM ni pone la clase de guía fija hasta `start()`; los
  de T3 siguen en verde. A mano V1, V6.
- [ ] T12 · Extraer `ui/panel.js`; `content.js` queda como orquestador (~500 líneas) · Ficheros: `ui/panel.js`,
  `content.js`, `manifest.json`, `tests/ui-panel.test.js` · Test: `create` no toca el DOM; añadir al test del panel:
  "Analizar" en "Limpieza" con un canal repetido lo lista; cambiar "Duración" en "Filtros" pone "Filtros (1)". Los de
  T1–T3 siguen en verde. A mano V1–V6.
- [ ] T13 · Partir `content.css` en `ui/*.css` y borrarlo · Ficheros: `ui/panel.css`, `ui/cards.css`,
  `ui/dropdowns.css`, `ui/buttons.css`, `ui/icons.css`, `ui/icon-picker.css`, `ui/guide-section.css`,
  `ui/fullscreen.css`, `content.css` (se borra), `manifest.json`, `tests/manifest.test.js` · Reparto y orden
  (manifiesto, `"css"`), cada bloque con sus reglas `html[dark]` y comentarios, sin cambiar ninguna regla:
  1. `panel.css`: líneas 1–311 sin 255–265, 565–647 (sin las dos reglas oscuras de los desplegables), 660–731 (modal y
     `tooltip`);
  2. `cards.css`: 255–265 (`--hidden`, `--dimmed`) y 313–470;
  3. `dropdowns.css`: 472–560 y las reglas oscuras de los desplegables (649–658);
  4. `buttons.css`: 733–790;
  5. `icons.css`: 793–812;
  6. `icon-picker.css`: 813–975 y `.youtube-groups__icon-picker-error` (1322–1327);
  7. `guide-section.css`: 976–1320 y la guía fija (1329–1392);
  8. `fullscreen.css`: 1394–final (las dos reglas juntas, con su comentario).
  Los números son de `content.css` en el commit de partida; antes de mover, compruébalos. El orden solo invierte
  bloques que antes iban detrás de las tarjetas o los desplegables (panel 565–731) o de la guía (error del selector):
  antes de commitear, comprueba que ninguna regla invertida comparte elemento y especificidad con otra que fije la
  misma propiedad (las clases de esas reglas no aparecen en los mismos elementos que las de `cards.css` y
  `dropdowns.css`; búscalas en `ui/*.js`); si alguna lo hace, deja su bloque en la posición que conserve el orden y
  anótalo en **Cambios aprobados**. `buttons.css` va detrás de panel, tarjetas y desplegables y delante de iconos,
  selector y guía, como hoy. · Test: `manifest`: `"css"` lista exactamente esos ocho ficheros en ese orden y existen;
  no hay `content.css`; el número total de reglas (`{`) de los ocho es el de `content.css` en el commit anterior (el
  número se fija en el test con un comentario). A mano V1–V6 en tema claro y oscuro, comparando con capturas tomadas
  antes de esta tarea.
- [ ] T14 · Documentación y cierre · Ficheros: `docs/ARCHITECTURE.md` (tabla de componentes con `ui/*.js`, `ui/*.css`
  y `content.js` como orquestador; flujos con los nombres de fichero; `tests/` con los tests de DOM y linkedom; ADR
  0015 en Decisiones), `docs/adr/0015-…` (`aceptada`; si se usó `jsdom`, decirlo), `docs/adr/0014-…` (punto 3: carga
  `ui/icons-dom.js` y `ui/icon-picker.js` y enlaza `ui/buttons.css`, `ui/icons.css` y `ui/icon-picker.css` en lugar de
  `ui/group-ui.js` y `content.css`; nota "Modificado por 0015"),
  `docs/plans/2026-11-17-fase6-1-editor-de-grupos.md` (está en borrador: T6 se quita porque ya está hecho; T4 y
  **Infraestructura** con los ficheros anteriores; T5 toca `ui/panel.js`, `ui/guide-section.js` y sus CSS; T12 quita
  `promptRenameGroup` y `confirmDeleteGroup` de `ui/panel.js`; su `tests/manifest.test.js` ya existe y se amplía; su
  "Fuera de alcance" ya no excluye tests de DOM de `content.js`), este plan a `hecho` · Test: `make lint` y `make
  format-md` sin cambios pendientes.

### Verificación manual (Firefox, `make up`, grupos A con A1 y B, con canales e iconos y colores)

- V1 · **Guía y sección**: en suscripciones la guía está fija y la sección "YouTube Groups" está antes de "Más de
  YouTube"; entrar en A y volver anima; seleccionar A filtra y "Limpiar selección (1)" lo quita; seleccionar desde
  inicio lleva a suscripciones con la selección; "+ Grupo" y "+ Subgrupo" crean; ☰ no hace nada en suscripciones y
  funciona en inicio.
- V2 · **Filtros de suscripciones**: "Duración" corta oculta los largos; vídeos vistos en "Atenuar" y "Ocultar"; "Vídeos
  fuera del filtro" en "Atenuar" atenúa en lugar de ocultar; "Reproducir lo visible".
- V3 · **Botones en miniaturas**: columna sobre la miniatura en inicio, suscripciones, búsqueda y recomendaciones de
  `/watch` (compacta); +G guarda, "Visto" marca todas las tarjetas del vídeo, "Lista" guarda; pulsar no abre el vídeo;
  los desplegables se cierran al pulsar fuera y al desplazar.
- V4 · **Reproductor**: en `/watch`, al pausar aparecen +G, visto y lista; al reproducir, en pantalla completa y con
  anuncio se ocultan; navegar a otro vídeo no enseña los del anterior; Espacio sobre un botón no pausa.
- V5 · **Panel**: minimizado por defecto, se despliega y lo recuerda al recargar; "Canal actual" y "Vídeo actual" en
  `/watch` y `/shorts`; Listas (crear, ver, quitar, renombrar, borrar), Limpieza, Ajustes y copia (exportar e
  importar); en pantalla completa no se ve; un cambio en otra pestaña (vistos, grupo, ajuste) se refleja.
- V6 · **Selector de iconos**: desde el formulario de la guía abre junto al botón, elige icono y color, "Guardar"
  y "Cancelar"; se cierra al pulsar fuera; el grupo creado muestra icono y banda en la guía y en las casillas de +G.

## Criterios de aceptación

- Con la extensión recargada, todo lo de V1–V6 se comporta y se ve igual que antes del refactor, en tema claro y
  oscuro, sin errores nuevos en la consola.
- El almacenamiento no cambia: mismas claves, mismo formato y mismas escrituras ante las mismas acciones.
- `content.js` tiene unas 500 líneas y solo orquesta; la interfaz está en `ui/`, un fichero por componente, y
  `content.css` ya no existe.
- `make test` incluye tests de DOM que crean cada componente, lo pulsan y comprueban que no se duplica.
- El paquete de `make build` no contiene `node_modules`, `tests` ni la dependencia de tests; no hay permisos ni
  dependencias de producción nuevas.

## Fuera de alcance

- Cualquier cambio de comportamiento, de texto, de estilos o de almacenamiento, aunque sea una corrección evidente
  (se anota para otro plan).
- Borrar código muerto (`promptRenameGroup`, `confirmDeleteGroup`, `getAllChannelsFromGroup`, nombres sin uso de la
  desestructuración, `showAllVideoCards`/`filterAllDetectedCards` duplicados, reglas `tooltip` y `mini-action-button`
  sin uso): lo quitará el plan 6-1 (T12) u otro.
- Unificar el patrón singleton de desplegables y selector, y sustituir `innerHTML` de plantillas fijas.
- Partir más `ui/panel.js` (p. ej. la sección "Listas"): se puede hacer en otro plan si crece.
- Tests de maquetación o de extremo a extremo en Firefox, y CI.
- La página de opciones y el editor (Fase 6).

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |
| 2026-11-17 | T1 | Se usa `jsdom` en lugar de `linkedom` como devDependency de los tests de DOM. | En `linkedom`, `HTMLSelectElement.value` solo tiene getter y `syncSettingsControls` falla al crear el panel; es el criterio de paso a `jsdom` previsto en el plan. | La persona ("ok a linkedom o jsdom") |
| 2026-11-17 | T1 y siguientes | El ayudante no expone `location.assigned`: cuenta las navegaciones en `navigations.count`. Los tests que necesiten la URL de destino comprueban el efecto observable (p. ej. la selección pendiente en `sessionStorage`) en lugar de la URL. | En jsdom `location.assign` no se puede sustituir. | Delegada por la persona ("usa lo recomendado… ejecútalo") |
| 2026-11-17 | T9 (hasta T10) | Puente provisional en `ctx.cards` con getters de `VIDEO_CARD_SELECTOR`, `WATCHED_CLASS` y `VIDEO_ID_ATTRIBUTE`; T10 lo sustituye por las constantes reales del componente. | Esas constantes se declaran después de `ctx` en `content.js` y `ui/watched.js` las necesita. | Delegada por la persona ("usa lo recomendado… ejecútalo") |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-17 | T1 | `test: jsdom y ayudante de DOM con tests de humo del panel` | Con `jsdom` (cambio aprobado arriba) `location` es el real y `location.assign` no se puede sustituir: el ayudante cuenta las navegaciones no implementadas en `navigations.count` en lugar de `location.assigned` (a confirmar por la persona; afecta a T2 si un test necesita la URL). Comprobado: `make test` (199 en verde), `make lint` y el `.zip` de `make build` (20 ficheros) sin `node_modules/`, `tests/` ni `jsdom`. |
| 2026-11-17 | T2 | `test: tests de humo de tarjetas, desplegables, vistos y reproductor` | 4 ficheros `ui-*.test.js` (13 tests) y ampliación de `youtube-fixtures.js` (ID de 11 caracteres, `ytd-guide-renderer`, host de YouTube Music en la guía, `makeGroup`, `groupsStore`, `flushLoose`). Hallazgo, sin corregir (fuera de alcance): con una tarjeta con botones, `setCardButtonContent` reescribe el texto de la etiqueta en cada procesado, eso muta la tarjeta y la reprograma en cada frame sin parar; por eso los tests usan `flushLoose` (tolera el límite de vueltas de `flush`). Comprobado: `make test` (213 en verde) y `make lint`. |
| 2026-11-17 | T3 | `test: tests de humo de la guía, el selector de iconos y los iconos` | 3 ficheros `ui-*.test.js` (11 tests). Notas para T10-T12: durante la animación de columna la saliente sigue en el DOM (el test mira la última del `viewport`); jsdom no tiene `document.fullscreenElement` (cuenta como pantalla completa), así que el test de guía fija lo define a `null` y despacha `fullscreenchange`. Comprobado: `make test` (224 en verde) y `make lint`. |
| 2026-11-17 | T4 | `refactor: ctx y ctx.state en content.js` | Los 12 estados compartidos pasan a `ctx.state.*` (con su JSDoc) y se crean los espacios puente `watched`, `cards`, `dropdowns`, `panel`, `guide` y `player` solo con las funciones que ya existen (`noteMutations`, `start`, `checkPlacement` y `resetDetectedCards` llegan con su extracción). Las llamadas siguen siendo directas. Comprobado: `make test-affected` (224 en verde) y `make lint`; falta la verificación manual V1-V6 por la persona. |
| 2026-11-17 | T5 | `refactor: extraer ui/icons-dom.js de content.js` | Las 7 funciones/constantes de iconos se mueven tal cual a `YouTubeGroupsIconsDom` (congelado, sin `ctx`); `content.js` las desestructura (sin `createUiIconSvg`, que solo usa `setCardButtonContent`). 4 pruebas directas nuevas en `tests/ui-icons-dom.test.js` (cargando sin `content.js`). Comprobado: `make test-affected` (228 en verde) y `make lint`; falta la verificación manual V1, V3 y V6 por la persona. |
| 2026-11-17 | T6 | `refactor: extraer ui/icon-picker.js de content.js` | El selector de iconos (singleton, escuchadores y `createIconPicker`) se mueve tal cual a `YouTubeGroupsIconPicker` (congelado, con `openIconPicker` y `hideIconPicker`; desestructura `createIconSvg`, `GROUP_ICON_SIZES` y `setGroupBand` de `YouTubeGroupsIconsDom`); `content.js` desestructura la API. 3 pruebas directas nuevas en `tests/ui-icon-picker.test.js` (sin `content.js`). Comprobado: `make test-affected` (231 en verde) y `make lint`; falta la verificación manual V6 por la persona. |
| 2026-11-17 | T7 | `refactor: extraer ui/player.js de content.js` | El control del reproductor se mueve tal cual a `YouTubeGroupsPlayer.create(ctx)` (API `syncPlayerControl`, `schedulePlayerControlSync`, `noteMutations`, `start`); `content.js` hace `ctx.player = YouTubeGroupsPlayer.create(ctx)`, llama a `ctx.player.start()` en el mismo punto y a `ctx.player.noteMutations()` en el observer. Las llamadas a otros componentes van por `ctx.watched/cards/dropdowns`. Prueba nueva: `create` no toca el DOM. Comprobado: `make test-affected` (232 en verde) y `make lint`; falta la verificación manual V4 por la persona. |
| 2026-11-17 | T8 | `refactor: extraer ui/dropdowns.js de content.js` | Las casillas de grupos y los dos desplegables flotantes se mueven tal cual a `YouTubeGroupsDropdowns.create(ctx)` (API `renderChannelGroupChoices`, `openSubscriptionGroupsForm`, `hideSubscriptionDropdown`, `openPlaylistForm`, `hidePlaylistDropdown`); `content.js` hace `ctx.dropdowns = YouTubeGroupsDropdowns.create(ctx)` y llama por `ctx.dropdowns.*`. Dentro se usan `ctx.renderGroupsPanel`, `ctx.refreshActiveSelection` y `ctx.panel.renderPlaylistsSection`; `hideIconPicker` ya no se desestructura en `content.js`. Prueba nueva: `create` no toca el DOM. Comprobado: `make test-affected` (233 en verde) y `make lint`; falta la verificación manual V3 y V4 por la persona. |
| 2026-11-17 | T9 | `refactor: extraer ui/watched.js de content.js` | Los vistos se mueven tal cual a `YouTubeGroupsWatchedUi.create(ctx)` (API del mapa); `start()` registra `timeupdate` y lee `getWatchedVideos()` en el punto donde estaban, y `content.js` hace `ctx.watched = YouTubeGroupsWatchedUi.create(ctx)` y llama por `ctx.watched.*`. Puente: el espacio `ctx.cards` expone con getters `VIDEO_CARD_SELECTOR`, `WATCHED_CLASS` y `VIDEO_ID_ATTRIBUTE` (las constantes se declaran después de `ctx`); T10 los sustituye por los reales. `renderCurrentVideoSection` sigue en `content.js` hasta T12 y se llama por `ctx.panel`. Prueba nueva: `create` no toca el DOM ni registra `timeupdate`. Comprobado: `make test-affected` (234 en verde) y `make lint`; falta la verificación manual V2, V3 y V4 por la persona. |
| 2026-11-17 | T10 | `refactor: extraer ui/cards.js de content.js` | Detección, controles, filtrado y programación de tarjetas se mueven tal cual a `YouTubeGroupsCards.create(ctx)` (API del mapa más `resetDetectedCards`, que sustituye a la asignación de `yt-navigate-finish`); `content.js` hace `ctx.cards = YouTubeGroupsCards.create(ctx)` antes de `ctx.watched` y llama por `ctx.cards.*`. Sustituido el puente provisional con getters por las constantes reales (`VIDEO_CARD_SELECTOR`, `WATCHED_CLASS`, `VIDEO_ID_ATTRIBUTE` en la API); `content.js` ya no desestructura `setCardButtonContent` ni `shieldControlEvents`. 2 pruebas nuevas en `tests/ui-cards.test.js` (`create` no toca el DOM; reset + scan reprocesan un cambio de enlace). Comprobado: `make test-affected` (236 en verde) y `make lint`; falta la verificación manual V2 y V3 por la persona. |
| 2026-11-17 | T11 | `refactor: extraer ui/guide-section.js de content.js` | La sección de la guía, su formulario de crear, el ancla y la guía fija se mueven tal cual a `YouTubeGroupsGuideSection.create(ctx)` (API `renderGuideSection`, `noteMutations`, `checkPlacement`, `start`); `content.js` hace `ctx.guide = YouTubeGroupsGuideSection.create(ctx)`, llama a `ctx.guide.start()` antes de `ctx.player.start()` y, en el observer, a `ctx.guide.noteMutations(mutations)`, `ctx.player.noteMutations()`, el bucle de tarjetas y `ctx.guide.checkPlacement()`. Dentro se usan `ctx.setActiveSelection`, `ctx.navigateToSubscriptions` y `ctx.renderGroupsPanel`. `content.js` ya no desestructura `YouTubeGroupsIconsDom` ni `openIconPicker` (solo los usaba la guía); `createGroup` y `createSubGroup` quedan sin uso allí (se dejan, fuera de alcance). Prueba nueva: `create` no toca el DOM ni pone la clase de guía fija hasta `start()`. Comprobado: `make test-affected` (237 en verde) y `make lint`; falta la verificación manual V1 y V6 por la persona. |
