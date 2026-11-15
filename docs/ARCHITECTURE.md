# Arquitectura de youtubeChannelOrganizer

Vista general del sistema. La mantiene el rol arquitecto: actualízala cuando un plan cambie la estructura.

## Contexto

Extensión de Firefox (Manifest V3, JavaScript sin compilar) que permite organizar canales de YouTube en grupos y
subgrupos y filtrar los vídeos por grupo. Solo toca `www.youtube.com` (content scripts) y
`browser.storage.local`; no hace peticiones de red. Roadmap en `ROADMAP.md` y `PROJECT.md`.

## Componentes

Los scripts de contenido son scripts clásicos (sin módulos ES) que se cargan en este orden, según
`manifest.json`, y comparten el ámbito global:

| Componente | Tecnología | Responsabilidad |
| --- | --- | --- |
| `manifest.json` | WebExtensions MV3 | Permiso `storage` y content scripts en `*://www.youtube.com/*` |
| `modules/storage.js` | JS clásico (`YouTubeGroupsStorage`) | Leer y escribir el árbol de grupos (ADR 0001) los vídeos vistos (ADR 0002), los ajustes (ADR 0003) y las listas de vídeos (ADR 0004). Expone `KEYS` (claves de almacenamiento) y `withLock(key, fn)`, una cola FIFO por clave que serializa las operaciones de leer-aplicar-escribir dentro de la pestaña (ADR 0005), los lectores puros `readGroupsValue`, `readWatchedValue`, `readSettingsValue` y `readPlaylistsValue`, y `getChangedKeys(changes, areaName)` para `storage.onChanged` (ADR 0006) |
| `modules/icons.js` | JS clásico (`YouTubeGroupsIcons`) | Iconos y colores disponibles para los grupos, y `getUiIconPath(id)` con los iconos de interfaz de los botones de tarjeta (`eye`, `check`, `playlist-add`), separados de `ICON_SET` |
| `modules/groups.js` | JS clásico (`YouTubeGroups`), sin DOM | Lógica de grupos y subgrupos, apariencia heredada, normalizar URL de canal, pertenencia de un canal a grupos, URL de un grupo para el filtro y `flattenGroups` (árbol aplanado en preorden con nivel), `validateGroupName(name, kind)` (mensaje de error o `null`), `getChannelKey`, `analyzeGroups` y `applyCleanup` (limpieza, puras) y `cleanupGroups` |
| `modules/watched.js` | JS clásico (`YouTubeGroupsWatched`), sin DOM | ID de vídeo desde una URL, marcar y desmarcar vídeos como vistos, `shouldAutoMark` (umbral del marcado automático) y `getWatchedButtonState` (etiqueta, glifo, pulsado y deshabilitado del botón de visto) |
| `modules/playlists.js` | JS clásico (`YouTubeGroupsPlaylists`), sin DOM | Listas de vídeos propias: crear, renombrar y borrar listas, guardar y quitar vídeos, ids de listas de un vídeo y URLs de reproducción (`buildPlayAllUrl`, `buildVideoUrl`, `buildWatchVideosUrl`) y `selectQueueIds` (IDs de la cola de lo visible) |
| `modules/backup.js` | JS clásico (`YouTubeGroupsBackup`), sin DOM | Copia de seguridad (ADR 0006): `buildBackup`, `parseBackup` (valida y descarta entradas no válidas contando `dropped`), `exportBackup` e `importBackup` (escribe ajustes, grupos, listas y vistos con `withLock`). Se carga tras `playlists.js` |
| `modules/settings.js` | JS clásico (`YouTubeGroupsSettings`), sin DOM | Ajustes por defecto (`watchedMode`, `outsideMode`, `autoMarkPercent`, `panelCollapsed`, este último `true` por defecto; `sidebarCollapsed` se retiró y se ignora si viene guardado), normalizarlos, leerlos y actualizarlos con validación |
| `modules/visibility.js` | JS clásico (`YouTubeGroupsVisibility`), sin DOM | `getCardVisibility`: decide si una tarjeta es `visible`, `dimmed` o `hidden` según filtro, visto y ajustes |
| `modules/metadata.js` | JS clásico (`YouTubeGroupsMetadata`), sin DOM | Interpretar duración, visualizaciones y antigüedad desde el texto de una tarjeta (español e inglés), `FILTER_OPTIONS`, `matchesAdvancedFilters` y `hasActiveFilters` |
| `modules/pages.js` | JS clásico (`YouTubeGroupsPages`), sin DOM | `getPageType(pathname)` clasifica la página (`home`, `subscriptions`, `search`, `watch`, `shorts`, `channel`, `other`) `shouldShowCardControls(pageType)` indica dónde se ponen botones en las tarjetas y `shouldPinGuide(pageType, width, isFullscreen)` si la guía de YouTube se fuerza abierta y fija (no en `watch`, con `PINNED_GUIDE_MIN_WIDTH` = 792 px o más y sin pantalla completa; ADR 0010). Se carga tras `metadata.js` |
| `modules/filter.js` | JS clásico (`YouTubeGroupsFilter`), sin DOM | Filtro activo como selección múltiple (ADR 0007 y 0011): `ALL_FILTER`, `normalizeFilter`, `getFilterKey`, `resolveFilterUrls`, `parseFilterKey`, `normalizeSelection`, `toggleSelection` (añade o quita una clave, conservando solo hermanos), `clearSelection`, `resolveSelection` (descarta claves inexistentes y da la unión de URL), `shouldNavigateOnSelect` (solo navega al añadir fuera de suscripciones) y el traspaso por `sessionStorage` (`serializePendingSelection`, `parsePendingSelection`, `version: 3`). Se carga tras `pages.js` |
| `modules/guide.js` | JS clásico (`YouTubeGroupsGuide`), sin DOM | Columnas de la sección de la guía lateral: `findGuideInsertionIndex` (dónde insertarla en `ytd-guide-renderer`, sin depender del idioma), `normalizeGuidePath`, `getGuideColumn`, `enterGuideGroup`, `leaveGuideGroup`, `getCreateTarget`, `findGuidePath` e `isChannelListOpen`. Se carga tras `filter.js` |
| `content.js` | JS clásico (IIFE) | Detectar tarjetas y su canal, panel flotante (minimizado por defecto y sin grupos: Listas, Limpieza, Filtros y Ajustes), sección "YouTube Groups" en la guía de YouTube y guía fija (ADR 0010), botones por vídeo (grupo y visto), filtro, filtros avanzados, sección de ajustes y selector de iconos (`openIconPicker(initial, anchorButton, onSave)`) |
| `content.css` | CSS | Estilos de lo que añade la extensión (claro y `html[dark]`) |
| `tests/` | `node:test` + `node:vm` | Tests de `modules/` con un `browser.storage.local` simulado; excluidos del paquete por `web-ext-config.mjs` |

## Flujos principales

- **Detección**: un `MutationObserver` sobre el documento programa las tarjetas (`VIDEO_CARD_SELECTOR`) y las
  procesa en un `requestAnimationFrame` (`processPendingCards`); cada tarjeta guarda nombre y URL de su canal en
  `data-*`. Los botones de las tarjetas se ponen en inicio, suscripciones, búsqueda y la columna de recomendaciones
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
- **Añadir un canal a grupos**: desde el botón de una tarjeta (insertado en el mismo recorrido de tarjetas, uno
  por tarjeta) o desde la sección "Canal actual" del panel en `/watch`. Ambos usan el mismo selector de casillas
  y `YouTubeGroups.setChannelGroups`, que lee el árbol, calcula la nueva pertenencia y lo escribe una vez. La operación se encola por clave
  (`withLock`, ADR 0005), de modo que dos operaciones solapadas sobre los grupos no se pisan.
- **Filtro** (ADR 0007 y [0011](adr/0011-seleccion-de-hermanos.md)): `content.js` guarda una
  `activeSelection` en memoria, un array de claves (`group:<id>`, `channel:<contenedor>:<url>`, con el contenedor
  codificado) en orden de adición; `[]` es "todos". Cada clic en la columna lateral sobre un grupo, subgrupo o canal
  lo añade o lo quita (`toggleSelectionItem`, con `toggleSelection(groups, selection, filter)`); al añadir solo se
  conservan los seleccionados **hermanos** (mismo tipo y mismo contenedor), así que nunca hay un padre con su hijo ni
  grupos con canales, y un canal se marca solo en la lista donde se pulsó; el filtro muestra la unión de sus canales (`resolveSelection`, `activeSelectionUrls`). El botón
  "Limpiar selección (N)", visible solo con selección, la vacía sin navegar. Los elementos borrados salen de la
  selección (`refreshActiveSelection`). Si se añade un elemento y la página no es `/feed/subscriptions`
  (`shouldNavigateOnSelect`), se navega a suscripciones pulsando el enlace de suscripciones de la guía de YouTube (o
  `location.assign`), con la selección guardada en `sessionStorage` por si la carga es completa; quitar nunca navega.
  Las tarjetas cuyo canal no está en la unión se ocultan o se atenúan, según el ajuste "Vídeos fuera del filtro". La regla es
  `YouTubeGroupsVisibility.matchesGroupFilter(…, hasFilter)`: sin selección o con los canales aún cargando, pasa; con canal,
  según pertenezca; sin canal identificado pero con ID de vídeo, no pasa (mixes, colaboraciones); sin canal ni ID
  (tarjeta aún sin pintar), pasa.
- **Filtros avanzados**: la sección "Filtros" del panel filtra por duración, fecha y visualizaciones (opciones
  fijas, estado en memoria de la pestaña). `content.js` lee los textos visibles de la tarjeta (`getCardTexts`) y
  `YouTubeGroupsMetadata` los interpreta en español e inglés; si un dato no se reconoce, ese criterio deja pasar la
  tarjeta (desconocido = pasa). El resultado se combina con Y con el grupo activo y entra como `matchesFilter`.
- **Visibilidad**: un único `applyCardVisibility` en `content.js` combina el filtro, el estado de visto y los
  ajustes (caché `settings`) mediante `YouTubeGroupsVisibility.getCardVisibility`, y alterna las clases
  `youtube-groups--hidden` y `youtube-groups--dimmed`. Ocultar gana a atenuar. Se reevalúa al procesar cada
  tarjeta, al cambiar el filtro, al marcar un vídeo y al cambiar un ajuste.
- **Marcar como visto**: `content.js` lee los vistos al arrancar (`watchedVideos`). El botón "Marcar visto" de la
  tarjeta o el de "Vídeo actual" del panel (en `/watch` y `/shorts`) llama a `YouTubeGroupsWatched.setVideoWatched`, que lee,
  aplica el cambio y escribe una vez solo si cambia algo, encolada por clave (`withLock`, ADR 0005). Después `content.js` actualiza la caché, la clase
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
- **Listas**: listas de vídeos locales, sin API de YouTube (ADR 0004). El botón "Lista" de la tarjeta o "Guardar en
  lista" de "Vídeo actual" (en `/watch`) abre el mismo desplegable de casillas (`openPlaylistForm`), que llama a
  `YouTubeGroupsPlaylists.setVideoPlaylists` (una lectura y, solo si cambia algo, una escritura, encoladas por clave con `withLock`, ADR 0005). Las listas se
  gestionan en la sección "Listas" del panel: crear, renombrar, eliminar, ver (modal con "Quitar") y reproducir.
  "Reproducir" es un enlace a `https://www.youtube.com/watch_videos?video_ids=...` con los 50 primeros vídeos.
- **Reproducir lo visible**: el botón del panel recorre las tarjetas (`VIDEO_CARD_SELECTOR`), descarta las que no son
  visibles (`checkVisibility()`) o están ocultas, atenuadas o vistas (`selectQueueIds`) y navega a `watch_videos` con los
  50 primeros (`buildWatchVideosUrl`); si no queda ninguno, muestra un aviso sin navegar.
- **Sincronización entre pestañas**: `content.js` registra `handleStorageChange` en `browser.storage.onChanged`
  (ADR 0006). `getChangedKeys` indica qué claves lógicas (`groups`, `watched`, `settings`, `playlists`) han cambiado
  en el área `local` y los lectores puros (`read*Value`) interpretan el nuevo valor. Cada clave actualiza su caché y
  repinta su parte: vistos (tarjetas y "Vídeo actual"), ajustes (controles y visibilidad), grupos (filtro activo y
  panel) y listas (sección "Listas" y modal "Ver", que se cierra si la lista ya no existe). El evento llega también
  a la pestaña que escribe; repintar dos veces es inocuo.
- **Guía lateral** (ADR 0010): `renderGuideSection` (al final de `renderGroupsPanel`) pinta la sección "YouTube
  Groups" en `ytd-guide-renderer #sections`, antes de la sección que da `findGuideInsertionIndex` ("Más de YouTube";
  con `-1`, tras la primera), y solo la mueve si no está en su sitio; si no hay guía, no pinta. `scheduleGuideCheck`
  (como mucho una comprobación por frame, desde el `MutationObserver`) la recrea o recoloca. **Guía fija**:
  `syncGuidePin` pone o quita la clase `youtube-groups--guide-pinned` en `<html>` según `shouldPinGuide`, al arrancar,
  en `yt-navigate-start`, `yt-navigate-finish`, `popstate`, `fullscreenchange`, `resize` (una vez por frame) y si
  cambia `location.pathname` en el `MutationObserver`. Con la clase, reglas de `content.css` (todas bajo ella) ocultan
  la mini-guía y el velo, dejan `tp-yt-app-drawer#guide` visible y fijo bajo el masthead y dan
  `margin-left` a `ytd-page-manager#page-manager`; un `click` en captura neutraliza ☰ (`#guide-button`) mientras la
  clase está puesta. En `/watch` y por debajo de 792 px YouTube se comporta como siempre. La sección muestra una sola columna (`getGuideColumn`) que se desplaza con animación al entrar en cualquier
  grupo o subgrupo ("›" en todos; una subcolumna vacía dice "Sin subgrupos") o volver ("‹"), con un botón de crear
  que depende de la selección (`getCreateTarget`: "+ Crear grupo" en la raíz, subgrupo del grupo seleccionado o,
  con varios, del último pulsado; sin selección en una subcolumna, del padre de la columna; tras crear un subgrupo
  se pasa a la columna del padre con `findGuidePath`) (formulario con icono y color opcionales,
  `validateGroupName` y `setGroupAppearance`) y, por elemento, una lista de canales desplegable
  (`isChannelListOpen`, abierta si contiene un canal seleccionado). No hay elemento "Todos": grupos y canales alternan con `toggleSelectionItem`. No edita ni borra
  grupos. La columna es el único sitio para elegir filtro y crear grupos y subgrupos; el panel no tiene nada de grupos
  (solo "Canal actual" con sus casillas). Si YouTube cambia el DOM de la guía y la sección no aparece, no se puede
  filtrar hasta corregirlo. El panel aparece minimizado por defecto y se puede desplegar con el botón de su cabecera; el
  estado se guarda en el ajuste `panelCollapsed` y se aplica al leer los ajustes y en `storage.onChanged`. Quedan
  sin enlazar, para la futura pantalla de edición de grupos (`ROADMAP.md`), `promptRenameGroup` y
  `confirmDeleteGroup` en `content.js` y `renameGroup`, `deleteGroup`, `deleteSubGroup`, `setGroupAppearance` y
  `removeChannelFromGroup` en `modules/groups.js`.
- **Limpieza**: la sección "Limpieza" del panel (`<details>`) analiza el árbol con `YouTubeGroups.analyzeGroups`:
  canales repetidos en un mismo grupo (misma `getChannelKey`, se conserva el primero), URL no válidas (las
  recuperables, con `normalizeChannelUrl` no nulo, se corrigen y conservan sus campos; solo se quitan las
  irrecuperables o las que quedarían repetidas) y grupos sin canales en todo su subárbol. Tras elegir qué quitar y confirmar, `cleanupGroups` lee, aplica `applyCleanup` y
  escribe una sola vez bajo `withGroupsLock`, solo si algo cambia. Después se repinta el panel, se revisa el filtro
  activo (si su grupo se borró, vuelve a "Todos") y se vuelve a analizar.
- **Copia de seguridad**: la sección "Ajustes" tiene "Exportar copia" e "Importar copia". Exportar descarga
  `youtube-groups-AAAA-MM-DD.json` (`exportBackup`, formato del ADR 0006). Importar pide confirmación, lee el fichero
  y llama a `importBackup`: `parseBackup` valida todo antes de escribir (si falla, no cambia nada) y descarta las
  entradas sueltas no válidas, que se cuentan en el mensaje. Tras escribir, `storage.onChanged` repinta la interfaz.

## Decisiones

Las decisiones relevantes están en `docs/adr/`. El filtro activo y el paso a suscripciones:
[ADR 0007](adr/0007-filtro-activo-y-paso-a-suscripciones.md). La columna lateral propia (sustituida):
[ADR 0008](adr/0008-columna-propia-que-desplaza-el-contenido.md). La sección en la guía de YouTube, fija fuera de
`/watch`: [ADR 0010](adr/0010-seccion-en-la-guia-de-youtube-fija.md). La selección limitada a hermanos (sustituye al 0009,
que sustituía en parte al 0007): [ADR 0011](adr/0011-seleccion-de-hermanos.md).
