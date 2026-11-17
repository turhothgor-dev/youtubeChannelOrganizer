# 0014 · Editor de grupos en la página de opciones, abierta con un script de fondo mínimo

- Estado: aceptada (punto 3 modificado por el [ADR 0015](0015-componentes-de-interfaz-en-ui.md))
- Modificado por: [0017](0017-menu-de-opciones-en-la-guia.md) (punto 2: solo la guía envía el mensaje)
- Fecha: 2026-11-17

## Contexto

Falta una pantalla para editar el árbol de grupos (renombrar, borrar, icono y color, mover y reordenar, gestionar
canales; `ROADMAP.md`). Hoy toda la interfaz vive dentro de YouTube (`content.js`, más de 4000 líneas): la sección de
la guía es una columna estrecha pensada para filtrar y crear, y el panel flotante no tiene nada de grupos. Arrastrar y
soltar, listas largas de canales y campos de texto dentro de YouTube chocan con sus estilos, su navegación SPA y sus
atajos de teclado.

Restricciones: Firefox MV3, scripts clásicos sin compilar y sin dependencias, sin red, sin permisos nuevos, sin
cambiar el formato de los grupos (ADR 0001). Los content scripts **no** pueden llamar a
`browser.runtime.openOptionsPage()`. `YouTubeGroups.normalizeChannelUrl` usa `window.location.origin`, que en una
página de la extensión es `moz-extension://…`.

## Decisión

1. **Página de opciones** (`options_ui` con `open_in_tab: true`, `options/options.html`): el editor de grupos vive en
   una pestaña propia de la extensión. Carga con `<script src>` los mismos scripts clásicos de `modules/` que necesita
   (en el mismo orden relativo que `manifest.json`), más `ui/icons-dom.js`, `ui/icon-picker.js` y `options/options.js`. También se abre desde
   `about:addons` → Preferencias.
2. **Script de fondo mínimo** (`background.js`, `"background": { "scripts": [...] }`, página de eventos no persistente):
   solo escucha `runtime.onMessage` con `{ type: "youtube-groups:open-editor" }` y llama a
   `browser.runtime.openOptionsPage()`. El panel flotante y la sección de la guía envían ese mensaje. No guarda estado
   ni escribe en el almacenamiento.
3. **Código de interfaz compartido** en `ui/icons-dom.js` (`YouTubeGroupsIconsDom`) y `ui/icon-picker.js`
   (`YouTubeGroupsIconPicker`), con DOM: SVG de iconos, banda de color, tamaños de icono y selector de icono y color,
   que estaban dentro de `content.js`. Los cargan los content scripts (antes de `content.js`) y la página de opciones.
   La página enlaza `ui/buttons.css`, `ui/icons.css` y `ui/icon-picker.css` para reutilizar los estilos del selector y
   pone o quita el atributo `dark` en `<html>` según `prefers-color-scheme`, para que valgan las reglas
   `html[dark]`. (Modificado por el [ADR 0015](0015-componentes-de-interfaz-en-ui.md): antes `ui/group-ui.js` y
   `content.css`.)
4. **Lógica pura del editor** en `modules/group-editor.js` (`YouTubeGroupsEditor`, sin DOM, con tests `node --test`):
   mover, destinos válidos, posición al soltar, borrar con instantánea y restaurar, operaciones de canales en bloque y
   búsqueda. Las operaciones que escriben usan `withLock` de la clave de grupos (ADR 0005).
5. `normalizeChannelUrl` usa el origen fijo `https://www.youtube.com` en lugar de `window.location.origin`, para dar el
   mismo resultado en YouTube y en la página de opciones.
6. **Sincronización**: la página escucha `storage.onChanged` (ADR 0006) y repinta conservando su estado de interfaz;
   las pestañas de YouTube ya repintan con los cambios que hace el editor.

## Alternativas descartadas

- **Modal dentro de YouTube**: más código en `content.js`, conflictos de estilos y de atajos con YouTube y se rompe al
  navegar (SPA). Es lo que ya limita la guía.
- **Popup (`action`)**: se cierra al perder el foco (al abrir el selector de ficheros o cambiar de ventana), es
  estrecho y el arrastrar y soltar es incómodo; además exigiría un botón en la barra.
- **`sidebar_action`**: estrecho, solo una a la vez y menos descubrible.
- **Abrir `options.html` con un enlace desde YouTube** (`web_accessible_resources` + `runtime.getURL`): expone un
  recurso de la extensión a la página (YouTube podría detectarla) y no necesita menos código que el script de fondo.
- **Copiar el selector de iconos en la página de opciones**: duplicaría ~250 líneas que ya han cambiado varias veces
  (ADR 0013, banda de color).

## Consecuencias

- Se gana: una pantalla amplia y estable para editar, independiente del DOM de YouTube y testeable; base para mover
  después Ajustes y copias de seguridad.
- Se pierde: aparece un tercer contexto (contenido, opciones, fondo) y un fichero compartido con DOM (`ui/`).
- A vigilar: `withLock` serializa solo dentro de un contexto; entre la página de opciones y una pestaña de YouTube
  sigue ganando la última escritura (como entre pestañas, ADR 0006). `watched.js` sigue usando
  `window.location.origin`: si la página de opciones necesita vistos (copias de seguridad), corregirlo igual que el
  punto 5. Si Firefox deja de admitir `background.scripts` en MV3, pasar a `service_worker` sin más cambios.
