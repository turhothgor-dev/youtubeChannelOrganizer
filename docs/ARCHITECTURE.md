# Arquitectura de youtubeChannelOrganizer

Vista general del sistema. La mantiene el rol arquitecto: actualízala cuando un plan cambie la estructura.

## Contexto

Extensión de Firefox (Manifest V3, JavaScript sin compilar) que permite organizar canales de YouTube en grupos
y filtrar los vídeos por grupo. Solo toca `www.youtube.com` (content script) y `browser.storage.local`; no hace
peticiones de red. Roadmap en `PROJECT.md`.

## Componentes

| Componente | Tecnología | Responsabilidad |
| --- | --- | --- |
| `manifest.json` | WebExtensions MV3 | Permiso `storage` y content scripts en `*://www.youtube.com/*` |
| `groups-model.js` (previsto, plan `2026-11-14-boton-canal-video`) | JS clásico, sin DOM | Lógica pura: normalizar URL de canal y calcular la pertenencia a grupos; probada con `node --test` |
| `content.js` | JS clásico (IIFE) | Detectar tarjetas de vídeo y su canal, panel de grupos, botón por vídeo, filtro y almacenamiento |
| `content.css` | CSS | Estilos de lo que añade la extensión (claro y `html[dark]`) |
| `tests/` | `node:test` + `node:vm` | Tests del modelo; excluidos del paquete por `web-ext-config.mjs` |

## Flujos principales

- **Detección**: un `MutationObserver` sobre el documento programa las tarjetas (`VIDEO_CARD_SELECTOR`) y las
  procesa en un `requestAnimationFrame`; cada tarjeta guarda nombre y URL de su canal en `data-*`. En
  `yt-navigate-finish` (navegación SPA) se reinicia y se vuelve a recorrer el documento.
- **Añadir un canal a grupos**: desde el botón de una tarjeta o la sección "Canal actual" del panel; se lee el
  almacenamiento, se calcula la nueva pertenencia y se escribe una vez (formato en el ADR 0001).
- **Filtro**: al elegir un grupo en el panel, se ocultan las tarjetas cuyo canal no pertenece al grupo.

## Decisiones

Las decisiones relevantes están en `docs/adr/`.
