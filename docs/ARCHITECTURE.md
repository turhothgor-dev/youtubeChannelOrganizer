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
| `modules/storage.js` | JS clásico (`YouTubeGroupsStorage`) | Leer y escribir el árbol de grupos (formato en el ADR 0001) |
| `modules/groups.js` | JS clásico (`YouTubeGroups`), sin DOM | Lógica de grupos y subgrupos, normalizar URL de canal, pertenencia de un canal a grupos y URL de un grupo para el filtro |
| `modules/icons.js` | JS clásico (`YouTubeGroupsIcons`) | Iconos y colores disponibles para los grupos |
| `content.js` | JS clásico (IIFE) | Detectar tarjetas y su canal, panel de grupos, botón por vídeo, filtro y selector de iconos |
| `content.css` | CSS | Estilos de lo que añade la extensión (claro y `html[dark]`) |
| `tests/` | `node:test` + `node:vm` | Tests de `modules/` con un `browser.storage.local` simulado; excluidos del paquete por `web-ext-config.mjs` |

## Flujos principales

- **Detección**: un `MutationObserver` sobre el documento programa las tarjetas (`VIDEO_CARD_SELECTOR`) y las
  procesa en un `requestAnimationFrame` (`processPendingCards`); cada tarjeta guarda nombre y URL de su canal en
  `data-*`. En `yt-navigate-finish` (navegación SPA) se reinicia y se vuelve a recorrer el documento.
- **Añadir un canal a grupos**: desde el botón de una tarjeta (insertado en el mismo recorrido de tarjetas, uno
  por tarjeta) o desde la sección "Canal actual" del panel en `/watch`. Ambos usan el mismo selector de casillas
  y `YouTubeGroups.setChannelGroups`, que lee el árbol, calcula la nueva pertenencia y lo escribe una vez.
- **Filtro**: al elegir un grupo o subgrupo en el panel, se ocultan las tarjetas cuyo canal no pertenece a él ni
  a sus descendientes.

El botón por tarjeta, `setChannelGroups` y los tests se introducen con el plan `2026-11-14-boton-canal-video`.

## Decisiones

Las decisiones relevantes están en `docs/adr/`.
