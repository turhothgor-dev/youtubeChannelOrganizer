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
| `modules/icons.js` | JS clásico (`YouTubeGroupsIcons`) | Iconos y colores disponibles para los grupos |
| `modules/groups.js` | JS clásico (`YouTubeGroups`), sin DOM | Lógica de grupos y subgrupos, apariencia heredada, normalizar URL de canal, pertenencia de un canal a grupos, URL de un grupo para el filtro y `flattenGroups` (árbol aplanado en preorden con nivel), `getChannelKey`, `analyzeGroups` y `applyCleanup` (limpieza, puras) y `cleanupGroups` |
| `modules/watched.js` | JS clásico (`YouTubeGroupsWatched`), sin DOM | ID de vídeo desde una URL, marcar y desmarcar vídeos como vistos, `shouldAutoMark` (umbral del marcado automático) |
| `modules/playlists.js` | JS clásico (`YouTubeGroupsPlaylists`), sin DOM | Listas de vídeos propias: crear, renombrar y borrar listas, guardar y quitar vídeos, ids de listas de un vídeo y URLs de reproducción (`buildPlayAllUrl`, `buildVideoUrl`, `buildWatchVideosUrl`) y `selectQueueIds` (IDs de la cola de lo visible) |
| `modules/backup.js` | JS clásico (`YouTubeGroupsBackup`), sin DOM | Copia de seguridad (ADR 0006): `buildBackup`, `parseBackup` (valida y descarta entradas no válidas contando `dropped`), `exportBackup` e `importBackup` (escribe ajustes, grupos, listas y vistos con `withLock`). Se carga tras `playlists.js` |
| `modules/settings.js` | JS clásico (`YouTubeGroupsSettings`), sin DOM | Ajustes por defecto (`watchedMode`, `outsideMode`, `autoMarkPercent`, `panelCollapsed`), normalizarlos, leerlos y actualizarlos con validación |
| `modules/visibility.js` | JS clásico (`YouTubeGroupsVisibility`), sin DOM | `getCardVisibility`: decide si una tarjeta es `visible`, `dimmed` o `hidden` según filtro, visto y ajustes |
| `modules/metadata.js` | JS clásico (`YouTubeGroupsMetadata`), sin DOM | Interpretar duración, visualizaciones y antigüedad desde el texto de una tarjeta (español e inglés), `FILTER_OPTIONS`, `matchesAdvancedFilters` y `hasActiveFilters` |
| `modules/pages.js` | JS clásico (`YouTubeGroupsPages`), sin DOM | `getPageType(pathname)` clasifica la página (`home`, `subscriptions`, `search`, `watch`, `shorts`, `channel`, `other`) y `shouldShowCardControls(pageType)` indica dónde se ponen botones en las tarjetas. Se carga tras `metadata.js` |
| `content.js` | JS clásico (IIFE) | Detectar tarjetas y su canal, panel de grupos, botones por vídeo (grupo y visto), filtro, filtros avanzados, sección de ajustes y selector de iconos |
| `content.css` | CSS | Estilos de lo que añade la extensión (claro y `html[dark]`) |
| `tests/` | `node:test` + `node:vm` | Tests de `modules/` con un `browser.storage.local` simulado; excluidos del paquete por `web-ext-config.mjs` |

## Flujos principales

- **Detección**: un `MutationObserver` sobre el documento programa las tarjetas (`VIDEO_CARD_SELECTOR`) y las
  procesa en un `requestAnimationFrame` (`processPendingCards`); cada tarjeta guarda nombre y URL de su canal en
  `data-*`. Los botones de las tarjetas se ponen en inicio, suscripciones, búsqueda y la columna de recomendaciones
  de `/watch` (`shouldShowCardControls`; allí, en versión compacta y solo en `#related`);
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
- **Filtro**: al elegir un grupo o subgrupo en el panel, las tarjetas cuyo canal no pertenece a él ni
  a sus descendientes se ocultan o se atenúan, según el ajuste "Vídeos fuera del filtro". La regla es
  `YouTubeGroupsVisibility.matchesGroupFilter`: sin grupo activo o con los canales aún cargando, pasa; con canal,
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
- **Guía lateral**: `renderGuideSection` (al final de `renderGroupsPanel`) inserta una sección "Grupos" en
  `ytd-guide-renderer #sections`, tras la primera sección, con "Todos" y los grupos aplanados
  (`YouTubeGroups.flattenGroups`) sangrados por nivel; elegir uno llama a `setActiveGroup` y filtra la página
  actual sin navegar. Si la guía aparece tarde, el `MutationObserver` llama a `scheduleGuideCheck` (como mucho una
  comprobación por frame). Si el contenedor no existe, no se pinta nada y el panel sigue funcionando. El panel se
  puede minimizar con el botón de su cabecera; el estado se guarda en el ajuste `panelCollapsed` y se aplica al leer
  los ajustes y en `storage.onChanged`.
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

Las decisiones relevantes están en `docs/adr/`.
