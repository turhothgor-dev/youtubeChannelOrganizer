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
| `modules/storage.js` | JS clásico (`YouTubeGroupsStorage`) | Leer y escribir el árbol de grupos (ADR 0001) los vídeos vistos (ADR 0002) y los ajustes (ADR 0003) |
| `modules/icons.js` | JS clásico (`YouTubeGroupsIcons`) | Iconos y colores disponibles para los grupos |
| `modules/groups.js` | JS clásico (`YouTubeGroups`), sin DOM | Lógica de grupos y subgrupos, apariencia heredada, normalizar URL de canal, pertenencia de un canal a grupos y URL de un grupo para el filtro |
| `modules/watched.js` | JS clásico (`YouTubeGroupsWatched`), sin DOM | ID de vídeo desde una URL, marcar y desmarcar vídeos como vistos, `shouldAutoMark` (umbral del marcado automático) |
| `modules/settings.js` | JS clásico (`YouTubeGroupsSettings`), sin DOM | Ajustes por defecto (`watchedMode`, `outsideMode`, `autoMarkPercent`), normalizarlos, leerlos y actualizarlos con validación |
| `modules/visibility.js` | JS clásico (`YouTubeGroupsVisibility`), sin DOM | `getCardVisibility`: decide si una tarjeta es `visible`, `dimmed` o `hidden` según filtro, visto y ajustes |
| `content.js` | JS clásico (IIFE) | Detectar tarjetas y su canal, panel de grupos, botones por vídeo (grupo y visto), filtro, sección de ajustes y selector de iconos |
| `content.css` | CSS | Estilos de lo que añade la extensión (claro y `html[dark]`) |
| `tests/` | `node:test` + `node:vm` | Tests de `modules/` con un `browser.storage.local` simulado; excluidos del paquete por `web-ext-config.mjs` |

## Flujos principales

- **Detección**: un `MutationObserver` sobre el documento programa las tarjetas (`VIDEO_CARD_SELECTOR`) y las
  procesa en un `requestAnimationFrame` (`processPendingCards`); cada tarjeta guarda nombre y URL de su canal en
  `data-*`. En `yt-navigate-finish` (navegación SPA) se reinicia y se vuelve a recorrer el documento.
- **Añadir un canal a grupos**: desde el botón de una tarjeta (insertado en el mismo recorrido de tarjetas, uno
  por tarjeta) o desde la sección "Canal actual" del panel en `/watch`. Ambos usan el mismo selector de casillas
  y `YouTubeGroups.setChannelGroups`, que lee el árbol, calcula la nueva pertenencia y lo escribe una vez.
- **Filtro**: al elegir un grupo o subgrupo en el panel, las tarjetas cuyo canal no pertenece a él ni
  a sus descendientes se ocultan o se atenúan, según el ajuste "Vídeos fuera del filtro".
- **Visibilidad**: un único `applyCardVisibility` en `content.js` combina el filtro, el estado de visto y los
  ajustes (caché `settings`) mediante `YouTubeGroupsVisibility.getCardVisibility`, y alterna las clases
  `youtube-groups--hidden` y `youtube-groups--dimmed`. Ocultar gana a atenuar. Se reevalúa al procesar cada
  tarjeta, al cambiar el filtro, al marcar un vídeo y al cambiar un ajuste.
- **Marcar como visto**: `content.js` lee los vistos al arrancar (`watchedVideos`). El botón "Marcar visto" de la
  tarjeta o el de "Vídeo actual" del panel (en `/watch`) llama a `YouTubeGroupsWatched.setVideoWatched`, que lee,
  aplica el cambio y escribe una vez solo si cambia algo. Después `content.js` actualiza la caché, la clase
  `youtube-groups--watched` de todas las tarjetas con ese ID de vídeo y los botones.
- **Marcado automático**: un escuchador de `timeupdate` en `document` (fase de captura) llama a
  `handleVideoProgress`. Solo actúa si `autoMarkPercent` no es 0, el `<video>` está en `#movie_player` sin
  `ad-showing`, el ID de `/watch` coincide con `ytd-watch-flexy[video-id]` (si existe), el vídeo no está visto ni
  guardándose ni ya tratado en la pestaña (`autoMarkHandledIds`) y `YouTubeGroupsWatched.shouldAutoMark` da `true`.
  Entonces `markVideoWatched` guarda igual que el marcado manual. El porcentaje (0, 50, 80 o 95) se elige en
  "Ajustes".

## Decisiones

Las decisiones relevantes están en `docs/adr/`.
