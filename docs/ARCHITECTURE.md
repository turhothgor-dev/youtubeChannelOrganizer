# Arquitectura de youtubeChannelOrganizer

Vista general del sistema. La mantiene el rol arquitecto: actualízala cuando un plan cambie la estructura.

## Contexto

Extensión de Firefox (Manifest V3, JavaScript sin compilar) que permite organizar canales de YouTube en grupos y
subgrupos y filtrar los vídeos por grupo. Solo toca `www.youtube.com` (content scripts), su página de opciones
(editor de grupos, ADR 0014), un script de fondo mínimo y `browser.storage.local`; no hace peticiones de red. Roadmap en `ROADMAP.md` y `PROJECT.md`.

## Componentes

Los scripts de contenido son scripts clásicos (sin módulos ES) que se cargan en este orden, según
`manifest.json` (`modules/`, después `ui/`, al final `content.js`), y comparten el ámbito global. Los componentes de
`ui/` solo declaran al cargar; `content.js` los crea con `create(ctx)` y los arranca con `start()` (ADR 0015):

| Componente | Tecnología | Responsabilidad |
| --- | --- | --- |
| `manifest.json` | WebExtensions MV3 | Permiso `storage`, content scripts en `*://www.youtube.com/*`, `options_ui` (página de opciones en pestaña) y `background` (`background.js`) |
| `background.js` | JS clásico, script de fondo mínimo | Escucha `youtube-groups:open-editor` y abre la página de opciones con `runtime.openOptionsPage()` (ADR 0014) |
| `options/` | HTML + JS clásico + CSS | Editor de grupos (`options.html`, `options.js`, `options.css`): árbol con renombrar, icono y color, crear, mover, arrastrar y eliminar con "Deshacer", con acciones de fila solo icono; reutiliza `modules/` y `ui/icons-dom.js`, `ui/icon-picker.js` (ADR 0014). `options/unclassified.js` (`YouTubeGroupsUnclassified.create(container)`) pinta la bandeja "Suscripciones sin grupo" con selección y "Añadir a…" (ADR 0018) |
| `modules/group-editor.js` | JS clásico (`YouTubeGroupsEditor`), sin DOM | Lógica pura del editor: `findGroupLocation`, `moveGroup`, `getSiblingMove`, `getMoveTargets`, `getDropPosition`, `summarizeSubtree`, `removeGroupWithSnapshot`, `restoreGroup`, `removeChannels`, `restoreChannels`, `transferChannels` (copiar o mover canales), `addChannels` (añadir canales nuevos a un grupo, sin duplicar por `getChannelKey`), `normalizeSearchText`, `searchGroups` y sus versiones con escritura (`moveGroupAndSave`, `deleteGroupAndSnapshot`, `restoreGroupAndSave`, `removeChannelsAndSave`, `restoreChannelsAndSave`, `transferChannelsAndSave`, `addChannelsAndSave`, en `withLock`). Se carga tras `groups.js`; no entra en los content scripts |
| `modules/storage.js` | JS clásico (`YouTubeGroupsStorage`) | Leer y escribir el árbol de grupos (ADR 0001) los vídeos vistos (ADR 0002), los ajustes (ADR 0003) y las listas de vídeos (ADR 0004). Expone `KEYS` (claves de almacenamiento) y `withLock(key, fn)`, una cola FIFO por clave que serializa las operaciones de leer-aplicar-escribir dentro de la pestaña (ADR 0005), los lectores puros `readGroupsValue`, `readWatchedValue`, `readSettingsValue` y `readPlaylistsValue`, y `getChangedKeys(changes, areaName)` para `storage.onChanged` (ADR 0006). `KEYS.avatars` (`youtubeAvatars`, ADR 0016) con `readAvatarsValue`, `getAvatars` y `saveAvatars`; `KEYS.subscriptions` (`youtubeSubscriptions`, ADR 0018) con `readSubscriptionsValue`, `getSubscriptions` y `saveSubscriptions`; `KEYS.newVideos` (`youtubeNewVideos`, ADR 0019) con `readNewVideosValue`, `getNewVideos` y `saveNewVideos` |
| `modules/fxemoji-data.js` | JS clásico (`YouTubeGroupsFxemoji`), sin DOM | Datos de los 12 iconos de grupo de Mozilla fxemoji (CC BY 4.0, ADR 0013): `ICONS` congelado e indexado por id, con `{ codepoint, file, viewBox, shapes }`. Transcritos de `third_party/fxemoji/*.svg` (fuera del paquete); `tests/fxemoji.test.js` comprueba que coinciden. Se carga antes de `icons.js`; la atribución está en `THIRD_PARTY_NOTICES.md`, incluido en el paquete |
| `modules/icons.js` | JS clásico (`YouTubeGroupsIcons`) | Iconos y colores disponibles para los grupos (`ICON_SET` con `{ id, label, codepoint }`), `getIconGraphic(id)` (`{ viewBox, shapes }` de fxemoji o `null`) y `getUiIconPath(id)` con los iconos de interfaz de los botones de tarjeta (`eye`, `check`, `playlist-add`) y de la guía (`settings`, `recycle`, `add`, `edit`, `arrow-up`, `arrow-down`, `palette`, `delete`, `swap`), separados de `ICON_SET`, y `getContrastTextColor(hex)` (blanco u oscuro, el de mayor contraste WCAG, para el número del bullet) |
| `modules/groups.js` | JS clásico (`YouTubeGroups`), sin DOM | Lógica de grupos y subgrupos, apariencia heredada, normalizar URL de canal, pertenencia de un canal a grupos, URL de un grupo para el filtro y `flattenGroups` (árbol aplanado en preorden con nivel), `validateGroupName(name, kind)` (mensaje de error o `null`), `getChannelKey`, `analyzeGroups` y `applyCleanup` (limpieza, puras), `cleanupGroups`, `buildChannelColorIndex` (colores de los grupos de cada canal, heredados, sin repetir y como mucho 4) y `getStripeBackground` (degradado de la línea de color) |
| `modules/avatars.js` | JS clásico (`YouTubeGroupsAvatars`), sin DOM | Avatares de canal (ADR 0016): `normalizeAvatarUrl` (solo `yt3.ggpht.com` y `yt3.googleusercontent.com`, https, tamaño fijo), `isValidAvatarKey`, `getAvatarFor`, `getGroupedChannelKeys`, `getKeptChannelKeys` (agrupados o suscritos conocidos, ADR 0018), `mergeAvatars` (poda los que no están en grupos ni en suscripciones), `getInitial`, `getFallbackColor` y `saveObservedAvatars` (en `withLock`, escribe solo si cambia algo). Se carga tras `groups.js` |
| `modules/subscriptions.js` | JS clásico (`YouTubeGroupsSubscriptions`), sin DOM | Suscripciones conocidas (ADR 0018): `normalizeSubscriptions`, `mergeSubscriptions` (altas, cambios de nombre y bajas con `reconcileKeys`), `getUnclassifiedSubscriptions` (las que no están en ningún grupo ni subgrupo), `findSubscriptionSectionIndex`, `isChannelListComplete` y `saveObservedSubscriptions` (en `withLock`, escribe solo si cambia algo). Se carga tras `avatars.js` |
| `modules/new-videos.js` | JS clásico (`YouTubeGroupsNewVideos`), sin DOM | Vídeos nuevos por grupo, aproximados (ADR 0019): `normalizeNewVideos`, `applyFeedBatch` (altas, edad de publicación, visitas y poda por 30 días, canal sin grupo y tope de 1000), `acknowledgeGroups`, `countNewVideos` (vídeos nuevos distintos por grupo y subárbol, sin los vistos) y `saveFeedBatch` (en `withLock`, escribe solo si cambia algo). Se carga tras `subscriptions.js`; no entra en `options.html` |
| `modules/watched.js` | JS clásico (`YouTubeGroupsWatched`), sin DOM | ID de vídeo desde una URL, marcar y desmarcar vídeos como vistos, `shouldAutoMark` (umbral del marcado automático) y `getWatchedButtonState` (etiqueta, glifo, pulsado y deshabilitado del botón de visto) |
| `modules/playlists.js` | JS clásico (`YouTubeGroupsPlaylists`), sin DOM | Listas de vídeos propias: crear, renombrar y borrar listas, guardar y quitar vídeos, ids de listas de un vídeo y URLs de reproducción (`buildPlayAllUrl`, `buildVideoUrl`, `buildWatchVideosUrl`) y `selectQueueIds` (IDs de la cola de lo visible) |
| `modules/backup.js` | JS clásico (`YouTubeGroupsBackup`), sin DOM | Copia de seguridad (ADR 0006): `buildBackup`, `parseBackup` (valida y descarta entradas no válidas contando `dropped`), `exportBackup` e `importBackup` (escribe ajustes, grupos, listas, vistos y, si la copia los trae, `avatars`, con `withLock`). Se carga tras `playlists.js` |
| `modules/settings.js` | JS clásico (`YouTubeGroupsSettings`), sin DOM | Ajustes por defecto (`watchedMode`, `outsideMode`, `autoMarkPercent`; `sidebarCollapsed` y `panelCollapsed` se retiraron y se ignoran si vienen guardados), normalizarlos, leerlos y actualizarlos con validación |
| `modules/visibility.js` | JS clásico (`YouTubeGroupsVisibility`), sin DOM | `getCardVisibility`: decide si una tarjeta es `visible`, `dimmed` o `hidden` según filtro, visto y ajustes |
| `modules/metadata.js` | JS clásico (`YouTubeGroupsMetadata`), sin DOM | Interpretar duración, visualizaciones y antigüedad desde el texto de una tarjeta (español e inglés), `FILTER_OPTIONS`, `matchesAdvancedFilters` y `hasActiveFilters` |
| `modules/pages.js` | JS clásico (`YouTubeGroupsPages`), sin DOM | `getPageType(pathname)` clasifica la página (`home`, `subscriptions`, `channels` —`/feed/channels`, ADR 0018—, `search`, `watch` —también `/live/<id>`—, `shorts`, `channel`, `other`), `getNavigationPathname(url, origin)` (ruta de destino de una navegación, o `null`), `shouldShowCardControls(pageType)` indica dónde se ponen botones en las tarjetas y `shouldPinGuide(pageType, width, isFullscreen)` si la guía de YouTube se fuerza abierta y fija (solo en `subscriptions`, con `PINNED_GUIDE_MIN_WIDTH` = 792 px o más y sin pantalla completa; ADR 0010 y 0012) y `shouldShowPlayerControls({ pageType, paused, fullscreen, adShowing })` si se muestran los botones sobre el reproductor (solo en `watch`, con el vídeo pausado o terminado, sin pantalla completa ni anuncio). Se carga tras `metadata.js` |
| `modules/filter.js` | JS clásico (`YouTubeGroupsFilter`), sin DOM | Filtro activo como selección múltiple (ADR 0007 y 0011): `ALL_FILTER`, `normalizeFilter`, `getFilterKey`, `resolveFilterUrls`, `parseFilterKey`, `normalizeSelection`, `toggleSelection` (añade o quita una clave, conservando solo hermanos), `clearSelection`, `resolveSelection` (descarta claves inexistentes y da la unión de URL), `shouldNavigateOnSelect` (solo navega al añadir fuera de suscripciones) y el traspaso por `sessionStorage` (`serializePendingSelection`, `parsePendingSelection`, `version: 3`). Se carga tras `pages.js` |
| `modules/guide.js` | JS clásico (`YouTubeGroupsGuide`), sin DOM | Columnas de la sección de la guía lateral: `findGuideInsertionIndex` (dónde insertarla en `ytd-guide-renderer`, sin depender del idioma), `normalizeGuidePath`, `getGuideColumn`, `enterGuideGroup`, `leaveGuideGroup`, `getCreateTarget`, `findGuidePath`, `isChannelListOpen` y `getMenuPosition` (posición del menú de opciones junto al engranaje). Se carga tras `filter.js` |
| `ui/icons-dom.js` | JS clásico (`YouTubeGroupsIconsDom`), con DOM, sin `ctx` | SVG de iconos (`createIconSvg`, `createUiIconSvg`), contenido de los botones de tarjeta (`setCardButtonContent`), marca, banda y bullet de color de un grupo (`createGroupMark`, `setGroupBand`, `setGroupBullet(el, color, count)`, que con `count` > 0 muestra el número de vídeos nuevos, gris sin color y `99+`, `GROUP_ICON_SIZES`), avatar de canal con inicial de reserva (`createChannelAvatar`, `AVATAR_SIZES`) y `shieldControlEvents`. Se carga tras `modules/` (ADR 0015) |
| `ui/icon-picker.js` | JS clásico (`YouTubeGroupsIconPicker`), con DOM, sin `ctx` | Selector de icono y color (`openIconPicker(initial, anchorButton, onSave)`, `hideIconPicker`) |
| `ui/avatars.js` | JS clásico (`YouTubeGroupsAvatarsUi.create(ctx)`) | Recolector de avatares de canal del DOM de YouTube (`noteCard`, `noteAvatar`, `scanPage`, `scheduleScan`, `setGroupedChannels`, `flushPending`); `ctx.avatars` se crea antes que `ctx.cards` |
| `ui/subscriptions.js` | JS clásico (`YouTubeGroupsSubscriptionsUi.create(ctx)`) | Recolector de suscripciones (ADR 0018): lee la sección de suscripciones de la guía (`readGuide`, `scheduleGuideRead`, `noteMutations`) y los `ytd-channel-renderer` de `/feed/channels` (`noteChannelCard`, `startVisit`, `checkChannelsList`, con reconciliación a los 3 s con la lista completa); `flushPending`; `ctx.subscriptions` se crea tras `ctx.avatars` y antes de `ctx.cards` |
| `ui/new-videos.js` | JS clásico (`YouTubeGroupsNewVideosUi.create(ctx)`) | Recolector de vídeos nuevos (ADR 0019): `noteVideo` (desde `ui/cards.js`, solo en `/feed/subscriptions`), `flushPending` (como mucho cada 2 s), `acknowledgeSelection` (al seleccionar un grupo), `setGroups`, `applyStoredValue`, `recount` y `start`; guarda el recuento en `ctx.state.newVideoCounts` y llama a `ctx.guide.updateNewVideoBullets()`; `ctx.newVideos` se crea tras `ctx.subscriptions` y antes de `ctx.cards` |
| `ui/dropdowns.js` | JS clásico (`YouTubeGroupsDropdowns.create(ctx)`) | Casillas de grupos (`renderChannelGroupChoices`) y los desplegables flotantes de suscripción y de listas |
| `ui/player.js` | JS clásico (`YouTubeGroupsPlayer.create(ctx)`) | Botones sobre el reproductor de `/watch` con el vídeo en pausa; `start()`, `noteMutations()` |
| `ui/watched.js` | JS clásico (`YouTubeGroupsWatchedUi.create(ctx)`) | Marcar como visto (manual y automático), botones y clases de visto; `start()` |
| `ui/cards.js` | JS clásico (`YouTubeGroupsCards.create(ctx)`) | Detectar tarjetas y su canal, botones por vídeo (grupo y visto), filtrado y visibilidad, programación de tarjetas, línea de color del grupo (`applyGroupStripe`, `refreshChannelColorIndex`); `resetDetectedCards()`; anota cada vídeo en `ctx.newVideos.noteVideo` |
| `ui/guide-section.js` | JS clásico (`YouTubeGroupsGuideSection.create(ctx)`) | Sección "YouTube Groups" en la guía de YouTube y guía fija (ADR 0010); `start()`, `noteMutations()`, `checkPlacement()`; pinta el número de vídeos nuevos en el bullet de cada grupo y `updateNewVideoBullets()` lo actualiza sin rehacer la columna |
| `ui/panel.js` | JS clásico (`YouTubeGroupsPanel.create(ctx)`) | Menú de opciones (ADR 0017): `#youtube-groups-menu`, creado al abrirlo desde el engranaje de la guía, con Listas, Filtros, Limpieza y Ajustes (con la copia de seguridad); `toggleMenu`, `openMenu`, `closeMenu`, `isMenuOpen` |
| `content.js` | JS clásico (IIFE), orquestador | Crea `ctx` (con `ctx.state`, el estado compartido, y un espacio por componente `ctx.cards`, `ctx.panel`…) y los componentes de `ui/`; selección activa y filtro pendiente, `renderGroupsPanel`, `MutationObserver`, eventos de navegación, arranque y `storage.onChanged` (ADR 0015) |
| `ui/*.css` | CSS | Estilos de lo que añade la extensión (claro y `html[dark]`), uno por componente: `panel.css`, `cards.css`, `dropdowns.css`, `buttons.css`, `icons.css`, `icon-picker.css`, `guide-section.css` y `fullscreen.css`; el orden en `manifest.json` es parte de la cascada. El menú de opciones y los desplegables flotantes se ocultan en pantalla completa con `:fullscreen` y `:has(:fullscreen)` (`fullscreen.css`) |
| `tests/` | `node:test` + `node:vm` + `jsdom` | Tests de `modules/` con un `browser.storage.local` simulado (`helpers/load-modules.js`) y tests de DOM de `ui/` (`ui-*.test.js`) y del editor (`ui-options.test.js`, con `loadOptionsDom` de `helpers/load-dom.js`) con `helpers/load-dom.js`, que carga los scripts de `manifest.json` en un documento de `jsdom` (`devDependency`, solo tests); excluidos del paquete por `web-ext-config.mjs` |

## Flujos principales

- **Detección** (`ui/cards.js`): el `MutationObserver` de `content.js` programa las tarjetas (`VIDEO_CARD_SELECTOR`) y las
  procesa en un `requestAnimationFrame` (`processPendingCards`); cada tarjeta guarda nombre y URL de su canal en
  `data-*`. Procesar una tarjeta ya al día no escribe en el DOM (`setCardButtonContent` y los atributos solo se
  escriben si cambian); si no, la mutación la vuelve a programar y se reprocesa en cada frame. Los botones de las
  tarjetas se ponen en inicio, suscripciones, búsqueda y la columna de recomendaciones
  de `/watch` (`shouldShowCardControls`; allí, en versión compacta y solo en `#related`). En las tarjetas de vídeo el
  control es una columna superpuesta arriba a la izquierda de la miniatura (`ytd-thumbnail` o
  `yt-thumbnail-view-model`, atributo `data-youtube-groups-thumb-host`, no una clase para no excluir la duración en `getCardTexts`), con los botones colapsados (glifo) que muestran su
  texto con el cursor o el foco, y con un escudo de eventos para que pulsarlos no abra el vídeo; si aún no hay
  miniatura, va tras el canal con los textos visibles y se mueve a la miniatura en un procesado posterior;
  en búsqueda, los resultados de canal (`ytd-channel-renderer`) reciben solo "Añadir a grupo". Las recomendaciones de
  `/watch` son `yt-lockup-view-model` (los de listas y mixes quedan excluidos de `VIDEO_CARD_SELECTOR`); si la
  tarjeta no enlaza al canal, en páginas de canal `detectCard` usa el canal de la propia página
  (`getChannelUrlFromPath`) y en el resto lo busca por nombre, solo con los textos de la zona de metadatos
  (`getChannelTexts`), entre los canales guardados (`buildChannelNameIndex` y `matchChannelByTexts` de `YouTubeGroups`, índice `channelNameIndex`
  recalculado en `renderGroupsPanel`; un nombre con dos URL distintas no se usa). En `yt-navigate-finish` (navegación SPA) se reinicia y se vuelve a recorrer el documento.
- **Línea de color en suscripciones** (`ui/cards.js`): `renderGroupsPanel` llama a `refreshChannelColorIndex(groups)`,
  que recalcula `buildChannelColorIndex` y, si cambia, reaplica `applyGroupStripe` a todas las tarjetas. En
  `/feed/subscriptions`, la tarjeta de un canal con colores recibe la clase `youtube-groups--group-stripe` y la propiedad
  `--yg-group-stripe` (`getStripeBackground`); `ui/cards.css` dibuja una línea de 3 px justo encima de la tarjeta. Solo
  se escribe si el valor cambia; fuera de suscripciones se quita en el reprocesado de `yt-navigate-finish`.
- **Botones del reproductor** (`ui/player.js`): en `/watch`, `syncPlayerControl` mantiene un único control
  (`youtube-groups__player-actions`, referencia `playerControl`) dentro de `#movie_player`, con +G, visto y lista del
  vídeo actual y el aspecto de las miniaturas. Se muestra según
  `shouldShowPlayerControls` con `video.paused` del `<video>` de `#movie_player`, `document.fullscreenElement` y
  `ad-showing`. Se recalcula, una vez por frame (`schedulePlayerControlSync`), al arrancar, con `play`, `pause` y `ended`
  (captura en `document`, solo vídeos de `#movie_player`), `yt-navigate-finish`, `fullscreenchange`, al refrescar los
  vistos y desde el `MutationObserver` (si falta el control o cambia el propietario del vídeo). Entre `yt-navigate-start` y
  `yt-navigate-finish` (`playerNavigating`) queda oculto para no mostrar el vídeo anterior. El control detiene los
  eventos de puntero y teclado para no pausar, reanudar ni abrir nada del reproductor.
- **Añadir un canal a grupos**: desde el botón de una tarjeta (insertado en el mismo recorrido de tarjetas, uno
  por tarjeta) o desde el "+G" del reproductor en `/watch`. Ambos usan el mismo selector de casillas
  y `YouTubeGroups.setChannelGroups`, que lee el árbol, calcula la nueva pertenencia y lo escribe una vez. La operación se encola por clave
  (`withLock`, ADR 0005), de modo que dos operaciones solapadas sobre los grupos no se pisan.
- **Filtro** (ADR 0007 y [0011](adr/0011-seleccion-de-hermanos.md)): `content.js` guarda una
  `activeSelection` en memoria (`ctx.state.activeSelection`; `toggleSelectionItem` está en `ui/guide-section.js`), un array de claves (`group:<id>`, `channel:<contenedor>:<url>`, con el contenedor
  codificado) en orden de adición; `[]` es "todos". Cada clic en la columna lateral sobre un grupo, subgrupo o canal
  lo añade o lo quita (`toggleSelectionItem`, con `toggleSelection(groups, selection, filter)`); al añadir solo se
  conservan los seleccionados **hermanos** (mismo tipo y mismo contenedor), así que nunca hay un padre con su hijo ni
  grupos con canales, y un canal se marca solo en la lista donde se pulsó; el filtro muestra la unión de sus canales (`resolveSelection`, `activeSelectionUrls`). El botón
  "Limpiar selección" (icono de reciclaje al pie de la guía, deshabilitado sin selección y con el número de seleccionados), la vacía sin navegar. Los elementos borrados salen de la
  selección (`refreshActiveSelection`). Si se añade un elemento y la página no es `/feed/subscriptions`
  (`shouldNavigateOnSelect`), se navega a suscripciones pulsando el enlace de suscripciones de la guía de YouTube (o
  `location.assign`), con la selección guardada en `sessionStorage` por si la carga es completa; quitar nunca navega.
  Las tarjetas cuyo canal no está en la unión se ocultan o se atenúan, según el ajuste "Vídeos fuera del filtro". La regla es
  `YouTubeGroupsVisibility.matchesGroupFilter(…, hasFilter)`: sin selección o con los canales aún cargando, pasa; con canal,
  según pertenezca; sin canal identificado pero con ID de vídeo, no pasa (mixes, colaboraciones); sin canal ni ID
  (tarjeta aún sin pintar), pasa.
- **Filtros avanzados**: la sección "Filtros" del menú de opciones filtra por duración, fecha y visualizaciones (opciones
  fijas, estado en memoria de la pestaña, `ctx.state.advancedFilters`; sección en `ui/panel.js`). `ui/cards.js` lee los textos visibles de la tarjeta (`getCardTexts`) y
  `YouTubeGroupsMetadata` los interpreta en español e inglés; si un dato no se reconoce, ese criterio deja pasar la
  tarjeta (desconocido = pasa). El resultado se combina con Y con el grupo activo y entra como `matchesFilter`.
- **Visibilidad**: un único `applyCardVisibility` en `ui/cards.js` combina el filtro, el estado de visto y los
  ajustes (caché `settings`) mediante `YouTubeGroupsVisibility.getCardVisibility`, y alterna las clases
  `youtube-groups--hidden` y `youtube-groups--dimmed`. Ocultar gana a atenuar. Se reevalúa al procesar cada
  tarjeta, al cambiar el filtro, al marcar un vídeo y al cambiar un ajuste.
- **Marcar como visto** (`ui/watched.js`): lee los vistos al arrancar (`start()`, `ctx.state.watchedVideos`). El botón "Marcar visto" de la
  tarjeta o el del reproductor (en `/watch`) llama a `YouTubeGroupsWatched.setVideoWatched`, que lee,
  aplica el cambio y escribe una vez solo si cambia algo, encolada por clave (`withLock`, ADR 0005). Después `ui/watched.js` actualiza la caché, la clase
  `youtube-groups--watched` de todas las tarjetas con ese ID de vídeo y los botones.
  Las tarjetas de Shorts de las estanterías (`ytd-reel-item-renderer`, `ytm-shorts-lockup-view-model*`) reciben marca
  de visto y filtro, sin botones. En `/shorts` el canal actual sale de `ytd-reel-video-renderer[is-active]`.
- **Marcado automático**: un escuchador de `timeupdate` en `document` (fase de captura) llama a
  `handleVideoProgress`. Solo actúa una vez leídos los ajustes (`settingsLoaded`), si `autoMarkPercent` no es 0, el `<video>` está en `#movie_player` o `#shorts-player` sin
  `ad-showing`, el ID de `/watch` coincide con `ytd-watch-flexy[video-id]` (si existe), en `/shorts` el ID actual está
  armado (`YouTubeGroupsWatched.updateAutoMarkArm`: se arma al ver `currentTime < 1`), el vídeo no está visto ni
  guardándose ni ya tratado en la pestaña (`autoMarkHandledIds`) y `YouTubeGroupsWatched.shouldAutoMark` da `true`.
  Entonces `markVideoWatched` guarda igual que el marcado manual. El porcentaje (0, 50, 80 o 95) se elige en
  "Ajustes".
- **Listas**: listas de vídeos locales, sin API de YouTube (ADR 0004). El botón "Lista" de la tarjeta o "Lista" del
  reproductor (en `/watch`) abre el mismo desplegable de casillas (`openPlaylistForm`), que llama a
  `YouTubeGroupsPlaylists.setVideoPlaylists` (una lectura y, solo si cambia algo, una escritura, encoladas por clave con `withLock`, ADR 0005). Las listas se
  gestionan en la sección "Listas" del menú de opciones: crear, renombrar, eliminar, ver (modal con "Quitar") y reproducir.
  "Reproducir" es un enlace a `https://www.youtube.com/watch_videos?video_ids=...` con los 50 primeros vídeos.
- **Reproducir lo visible**: el botón de la sección "Listas" del menú recorre las tarjetas (`VIDEO_CARD_SELECTOR`), descarta las que no son
  visibles (`checkVisibility()`) o están ocultas, atenuadas o vistas (`selectQueueIds`) y navega a `watch_videos` con los
  50 primeros (`buildWatchVideosUrl`); si no queda ninguno, muestra un aviso sin navegar.
- **Sincronización entre pestañas**: `content.js` (orquestador) registra `handleStorageChange` en `browser.storage.onChanged`
  (ADR 0006). `getChangedKeys` indica qué claves lógicas (`groups`, `watched`, `settings`, `playlists`) han cambiado
  en el área `local` y los lectores puros (`read*Value`) interpretan el nuevo valor. Cada clave actualiza su caché y
  repinta su parte: vistos (tarjetas y reproductor), ajustes (controles y visibilidad), grupos (filtro activo y
  guía) y listas (sección "Listas" y modal "Ver", que se cierra si la lista ya no existe). El evento llega también
  a la pestaña que escribe; repintar dos veces es inocuo.
- **Guía lateral** (ADR 0010, `ui/guide-section.js`): `renderGuideSection` (en `renderGroupsPanel`) pinta la sección "YouTube
  Groups" en `ytd-guide-renderer #sections`, antes de la sección que da `findGuideInsertionIndex` ("Más de YouTube";
  con `-1`, tras la primera), y solo la mueve si no está en su sitio; si no hay guía, no pinta. El ancla se guarda en
  caché (`getGuideAnchor`, `guideAnchorCache`) para no recorrer los enlaces de la guía en cada lote de mutaciones; el
  `MutationObserver` la invalida si cambia algo en `#sections` ajeno a nuestra sección. `scheduleGuideCheck`
  (como mucho una comprobación por frame, desde el `MutationObserver`) la recrea o recoloca. **Guía fija**:
  `syncGuidePin` pone o quita la clase `youtube-groups--guide-pinned` en `<html>` según `shouldPinGuide`, al arrancar,
  en `yt-navigate-start` (con la ruta de destino, `getNavigationPathname`), `yt-navigate-finish`, `popstate`, `fullscreenchange`, `resize` (una vez por frame) y si
  cambia `location.pathname` en el `MutationObserver` (`noteMutations`). Con la clase, reglas de `ui/guide-section.css` (todas bajo ella) ocultan
  la mini-guía, el velo y la cabecera propia del cajón, dejan `tp-yt-app-drawer#guide` visible y fijo bajo el masthead y dan
  `margin-left` a `ytd-page-manager#page-manager`; un `click` en captura neutraliza ☰ (`#guide-button`) mientras la
  clase está puesta. Fuera de suscripciones y por debajo de 792 px YouTube se comporta como siempre. La sección muestra una sola columna (`getGuideColumn`) que se desplaza con animación al entrar en cualquier
  grupo o subgrupo ("›" en todos; una subcolumna vacía dice "Sin subgrupos") o volver ("‹"). La cabecera lleva, a la
  derecha del título, (+) para crear y el lápiz para editar, solo icono; el pie, alineado a la derecha, lleva "Limpiar selección" (reciclaje, deshabilitado sin
  selección y con insignia del número) y el engranaje que abre el menú de opciones (ADR 0017). El botón de crear
  depende de la selección (`getCreateTarget`; destino completo en `title` y `aria-label`:
  grupo en la raíz, subgrupo del grupo seleccionado o, con varios, del último pulsado; sin selección en una subcolumna, del padre de la columna; tras crear un subgrupo
  se pasa a la columna del padre con `findGuidePath`) (formulario con icono y color opcionales,
  `validateGroupName` y `setGroupAppearance`) y, por elemento, una lista de canales desplegable
  (`isChannelListOpen`, abierta si contiene un canal seleccionado). No hay elemento "Todos": grupos y canales alternan con `toggleSelectionItem`. No edita ni borra
  grupos: eso se hace en el editor (página de opciones), que se abre con el lápiz "Editar grupos". La columna es el único sitio para elegir el filtro y, junto con el editor, para crear grupos y subgrupos. Si YouTube cambia el DOM de la guía y la sección no aparece, no se puede
  filtrar ni abrir el menú de opciones hasta corregirlo. El engranaje abre `#youtube-groups-menu` (`ui/panel.js`) junto a
  la guía, colocado con `getMenuPosition`; se cierra con Escape, clic fuera, el engranaje, `yt-navigate-start` o `resize`, y
  conserva su estado al cerrarse. El color de un grupo es un bullet (`setGroupBullet`) a la derecha de su botón, sin banda; sin color, sin bullet. Editar,
  mover y borrar grupos se hace en la página de opciones (flujo "Editor de grupos"); `removeChannelFromGroup` en
  `modules/groups.js` sigue sin enlazar; quitar canales en bloque se hace desde el panel "Canales" del editor.
- **Editor de grupos** (ADR 0014, `options/`): el lápiz ("Editar grupos") de la cabecera de la guía
  envía `youtube-groups:open-editor` a `background.js`, que llama a `runtime.openOptionsPage()`; también se abre
  desde `about:addons`. `options/options.js` pinta el árbol (listas anidadas con `role="tree"`, sin `innerHTML`) y
  permite renombrar en línea, cambiar icono y color (`YouTubeGroupsIconPicker`), crear grupos y subgrupos, subir,
  bajar, "Mover a…", arrastrar y soltar y eliminar con aviso y "Deshacer" durante 10 s. Las acciones de cada fila son
  solo icono (`iconButton`, con `aria-label` y `title`) en el orden subir, bajar, renombrar, icono y color, eliminar,
  mover a y añadir subgrupo, y el nombre ocupa el espacio flexible de la fila con elipsis. La lógica pura está en
  `modules/group-editor.js` (`moveGroup`, `getDropPosition`, `summarizeSubtree`, `removeGroupWithSnapshot`,
  `restoreGroup`...) y las escrituras van en `withLock` (ADR 0005). Al seleccionar un grupo, el panel "Canales" lista
  los suyos con selección múltiple para quitar (con "Deshacer" 10 s), copiar o mover a otro grupo
  (`removeChannelsAndSave`, `restoreChannelsAndSave`, `transferChannelsAndSave`); el campo de búsqueda
  (`searchGroups`, sin mayúsculas ni acentos) filtra árbol y canales y oculta subir, bajar, mover y arrastre mientras
  está activo. Bajo el árbol, la sección "Suscripciones sin grupo" (`options/unclassified.js`) lista las suscripciones
  conocidas que no están en ningún grupo, con selección múltiple y "Añadir a…" un grupo o subgrupo
  (`addChannelsAndSave`); el buscador también la filtra. La página escucha `storage.onChanged` (ADR 0006) y las
  pestañas de YouTube repintan con el mismo evento.
- **Suscripciones conocidas** (ADR 0018): sin red propia, `ui/subscriptions.js` lee del DOM la sección de la guía con
  el enlace `/feed/channels` (parcial: solo altas) y los `ytd-channel-renderer` de `/feed/channels`. Los guarda en la
  clave aparte `youtubeSubscriptions` (`{ version: 1, channels: { <getChannelKey>: { name, url, firstSeen } } }`,
  fuera de la copia de seguridad) con como mucho una escritura cada 2 s (`flushPending` →
  `saveObservedSubscriptions`). Solo en `/feed/channels`, con la lista completa (sin continuación y todas anotadas) y
  3 s sin canales nuevos, se reconcilia una vez por visita y se dan de baja las que ya no aparecen. El editor las
  cruza con los grupos (`getUnclassifiedSubscriptions`) para la bandeja; los avatares de las suscripciones conocidas
  también se conservan.
- **Vídeos nuevos por grupo** (ADR 0019): sin red propia, `ui/cards.js` anota en `ui/new-videos.js` cada vídeo que
  procesa en `/feed/subscriptions` (id, canal agrupado y, si hace falta, la edad "hace N horas"). Como mucho cada 2 s,
  `flushPending` → `saveFeedBatch` guarda en la clave aparte `youtubeNewVideos` (`{ version: 1, since, videos: { <id>:
  { channel, seenAt, publishedBefore } }, visits: { <groupId>: ms } }`, fuera de la copia de seguridad) los vídeos nuevos
  y las visitas, y poda lo antiguo. Un vídeo es nuevo si no está visto y es posterior a la visita más reciente de los
  grupos que contienen su canal (o a `since`). Seleccionar un grupo lo reconoce (`acknowledgeSelection`) y, mientras
  sigue seleccionado en suscripciones, cada volcado renueva su visita. `countNewVideos` da el número por grupo (con
  subgrupos) y `ctx.guide.updateNewVideoBullets()` lo pinta en el bullet; `storage.onChanged` con `"newVideos"` o
  `"watched"` recalcula.
- **Avatares de canal** (ADR 0016): sin red propia, `ui/avatars.js` lee del DOM de YouTube (tarjetas, resultados de
  canal, propietario en `/watch`, cabecera de canal y suscripciones de la guía) la imagen de cada canal con
  `AVATAR_IMG_SELECTOR`, la anota en memoria y, si el canal está agrupado y el avatar falta o cambia, la guarda
  en la clave aparte `youtubeAvatars` (`{ version: 1, avatars: { <getChannelKey>: <url> } }`) con como mucho una
  escritura cada 2 s (`flushPending` → `saveObservedAvatars`, que poda los canales que no están en grupos ni en
  suscripciones conocidas, ADR 0018). La guía y el panel
  "Canales" del editor leen `getAvatars()` y pintan `createChannelAvatar` (círculo con la inicial y, encima, la
  imagen sin `Referer`; si falla, queda la inicial); `storage.onChanged` con `"avatars"` repinta. La copia de
  seguridad incluye `avatars` (opcional al importar).
- **Limpieza**: la sección "Limpieza" del menú de opciones (`<details>`) analiza el árbol con `YouTubeGroups.analyzeGroups`:
  canales repetidos en un mismo grupo (misma `getChannelKey`, se conserva el primero), URL no válidas (las
  recuperables, con `normalizeChannelUrl` no nulo, se corrigen y conservan sus campos; solo se quitan las
  irrecuperables o las que quedarían repetidas) y grupos sin canales en todo su subárbol. Tras elegir qué quitar y confirmar, `cleanupGroups` lee, aplica `applyCleanup` y
  escribe una sola vez bajo `withGroupsLock`, solo si algo cambia. Después se repinta la guía, se revisa el filtro
  activo (si su grupo se borró, vuelve a "Todos") y se vuelve a analizar.
- **Copia de seguridad**: la sección "Ajustes" tiene "Exportar copia" e "Importar copia". Exportar descarga
  `youtube-groups-AAAA-MM-DD.json` (`exportBackup`, formato del ADR 0006). Importar pide confirmación, lee el fichero
  y llama a `importBackup`: `parseBackup` valida todo antes de escribir (si falla, no cambia nada) y descarta las
  entradas sueltas no válidas, que se cuentan en el mensaje. Tras escribir, `storage.onChanged` repinta la interfaz.

## Decisiones

Las decisiones relevantes están en `docs/adr/`. El filtro activo y el paso a suscripciones:
[ADR 0007](adr/0007-filtro-activo-y-paso-a-suscripciones.md). La columna lateral propia (sustituida):
[ADR 0008](adr/0008-columna-propia-que-desplaza-el-contenido.md). La sección en la guía de YouTube, fija
(modificado por el 0012 para fijarla solo en suscripciones): [ADR 0010](adr/0010-seccion-en-la-guia-de-youtube-fija.md) y
[ADR 0012](adr/0012-guia-fija-solo-en-suscripciones.md). La selección limitada a hermanos (sustituye al 0009,
que sustituía en parte al 0007): [ADR 0011](adr/0011-seleccion-de-hermanos.md). La interfaz dividida en componentes
de `ui/` con `ctx` y tests de DOM: [ADR 0015](adr/0015-componentes-de-interfaz-en-ui.md). El editor de grupos en la
página de opciones: [ADR 0014](adr/0014-pagina-de-opciones-editor-de-grupos.md). Los avatares de canal en una clave aparte, capturados
del DOM: [ADR 0016](adr/0016-avatares-de-canal-en-clave-aparte.md). El menú de opciones en la guía en lugar del panel
flotante (modifica 0003, 0010 y 0014): [ADR 0017](adr/0017-menu-de-opciones-en-la-guia.md). Las suscripciones conocidas
en una clave aparte, leídas del DOM (modifica 0016): [ADR 0018](adr/0018-suscripciones-conocidas-en-clave-aparte.md). Los vídeos nuevos por grupo,
aproximados con lo observado en suscripciones: [ADR 0019](adr/0019-videos-nuevos-por-grupo-aproximados.md).
