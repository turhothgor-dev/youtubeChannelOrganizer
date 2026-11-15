# Plan: GUI (2/4) · Botones de las tarjetas sobre la miniatura, colapsados

**Estado:** hecho

Issue: revisión de usabilidad de la GUI pedida por la persona (2026-11-15), punto 2.

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

Orden de la serie GUI 2026-11-15: `gui-1-selector-iconos` → **este plan** → `gui-3-guia-lateral` → `gui-4-panel`.
No depende de los otros ni los otros de él; va segundo porque depende del DOM real de YouTube y la persona debe
probarlo pronto. Los botones de las tarjetas (y "+G" en concreto) no cambian en los planes 3 y 4: tras `gui-4-panel`
siguen siendo la forma de añadir o quitar un canal de grupos.

## Contexto y decisión

Hoy `createSubscriptionChannelControl` (`content.js`) pone "Añadir a grupo", "Marcar visto" y "Lista" con texto
completo tras el nombre del canal (`ensureChannelControl`); en tarjetas normales no caben. Decisión: en las
**tarjetas de vídeo** (las que llevan los tres botones), el control pasa a ser una columna superpuesta a la miniatura,
arriba a la izquierda, con los botones colapsados (solo un glifo); cada botón muestra su texto solo cuando tiene el
cursor encima o el foco de teclado.

Decisiones:

- **Estructura del botón**: `<button>` con `<span class="youtube-groups__card-glyph">` y
  `<span class="youtube-groups__card-label">`; `aria-label` siempre con el texto completo (el `title` se sigue usando
  solo para errores, como hoy). Se conservan las clases actuales (`youtube-groups__subscription-control`,
  `youtube-groups__subscription-add-button`, `youtube-groups__watched-button`, `youtube-groups__playlist-button`), así
  que `applyWatchedToCard`, `ensureChannelControl` y `getCardTexts` siguen encontrándolos.
  - Añadir a grupo: glifo texto `+G`; texto "Añadir a grupo".
  - Marcar visto: no visto → icono de ojo, texto "Marcar visto"; visto → icono de check, texto "Visto",
    `aria-pressed="true"` y fondo resaltado.
  - Lista: icono `playlist-add`, texto "Lista".
- **Iconos de interfaz** en `modules/icons.js`: mapa nuevo `UI_ICON_PATHS` y `getUiIconPath(id)` (`null` si no
  existe), **separado de `ICON_SET`** para que no aparezcan en el selector de iconos de grupos ni cambien la validación
  de copias (`isValidIconId`). Rutas (Material Icons, Apache 2.0, viewBox 24):
  - `eye`: `M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z`
  - `check`: `M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z`
  - `playlist-add`: `M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z`
  En `content.js`, `createIconSvg` recibe la ruta por un parámetro o se añade `createUiIconSvg(id, size)`; sin
  `innerHTML`.
- **Estado del botón de visto, puro**: `YouTubeGroupsWatched.getWatchedButtonState({ videoId, isWatched, loaded,
  saving })` → `{ label, glyph, pressed, disabled }` (`label` "Marcar visto"/"Visto", `glyph` `"eye"`/`"check"`,
  `disabled` si no hay `videoId`, no está cargado o se está guardando). `updateWatchedButton` la usa: si el botón
  tiene `.youtube-groups__card-label` pinta glifo y texto; si no (botón "Marcar visto" de "Vídeo actual" del panel,
  que comparte clase), pone `textContent` como hoy ("✓ Visto"/"Marcar visto").
- **Dónde va la columna** (`ensureChannelControl`): anfitrión = primer `ytd-thumbnail` o `yt-thumbnail-view-model`
  de la tarjeta. Se le añade la clase `youtube-groups__thumb-host` (`position: relative`) y el control, con la clase
  `youtube-groups__card-actions--overlay`, como último hijo. Si la tarjeta aún no tiene miniatura, el control va donde
  va hoy (tras el enlace del canal, o en los metadatos en `/watch`) con los textos visibles; en un procesado posterior,
  si ya hay anfitrión y el control no es superpuesto, se **mueve** al anfitrión (sigue habiendo uno por tarjeta). Se
  mantienen las condiciones actuales: páginas de `shouldShowCardControls`, en `/watch` solo en `#related`, fuera de
  `/watch` solo si hay enlace de canal.
- **Sin navegación** (el anfitrión puede estar dentro del `<a>` de la miniatura): el control escucha en fase de
  burbuja `click` y `auxclick` (`preventDefault()` + `stopPropagation()`) y `mousedown`, `mouseup`, `pointerdown`,
  `pointerup`, `touchstart`, `touchend` y `dblclick` (`stopPropagation()`). Los botones deshabilitados llevan
  `pointer-events: none`, para que el clic caiga en el contenedor (que lo anula) y no en el enlace. Un `<button>` es
  el destino de activación del clic, así que el `<a>` no navega.
- **Posición (decidido por la persona, 2026-11-15)**: arriba a la izquierda de la miniatura. Columna
  `position: absolute; top: 4px; left: 4px; display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  z-index: 2`: el primer botón queda en la esquina superior izquierda y los demás debajo, alineados a la izquierda.
  Así no coincide con los botones de YouTube al pasar el cursor (arriba a la derecha) ni con la duración (abajo a la
  derecha), y al desplegarse un botón crece hacia la derecha sin mover a los otros.
- **Qué se despliega (decidido por la persona, 2026-11-15)**: solo el botón que está bajo el cursor
  (`.youtube-groups__card-actions--overlay button:hover .youtube-groups__card-label`) y, con teclado, solo el
  enfocado (`button:focus-visible ...`). Se usa `:focus-visible` y no `:focus` para que, tras pulsar con el ratón, el
  botón no se quede desplegado. Los botones mantienen su alto al desplegarse, así que la columna no salta.
- **CSS**: botones de 28 px de alto (22 px en `--compact`), fondo semitransparente oscuro con texto blanco (sobre
  miniatura se lee en los dos temas), radio 14 px, `white-space: nowrap`. Las etiquetas ocultas por defecto
  (`display: none`). Deshabilitado: `opacity: 0.5`. Con el control no superpuesto (respaldo y resultados de canal)
  las etiquetas se ven siempre y el aspecto es el de hoy.
- **Resultados de canal** (`ytd-channel-renderer`, solo "Añadir a grupo"): sin cambios de posición ni de texto; no
  tienen miniatura de vídeo.

## Tareas

Reglas comunes: sin `innerHTML` con datos; JSDoc; `make lint` (0 avisos) y `make test` en verde.

- [x] T1 · `UI_ICON_PATHS`/`getUiIconPath` en `modules/icons.js` y `getWatchedButtonState` en `modules/watched.js` ·
  Ficheros: `modules/icons.js`, `modules/watched.js`, `tests/icons.test.js`, `tests/watched.test.js` · Test:
  `getUiIconPath("eye")`, `"check"` y `"playlist-add"` dan una cadena no vacía; `getUiIconPath("x")` da `null`;
  `isValidIconId("eye")` sigue siendo `false` y `ICON_SET` no cambia de tamaño; `getWatchedButtonState` da
  `{ label: "Marcar visto", glyph: "eye", pressed: false, disabled: false }` con vídeo cargado no visto, `"Visto"`/
  `"check"`/`pressed: true` si está visto, y `disabled: true` sin `videoId`, sin cargar o guardando.
- [x] T2 · Botones con glifo y etiqueta (ver **Decisiones**), aún en su posición actual con las etiquetas visibles:
  `createSubscriptionChannelControl` crea la estructura; `updateWatchedButton` usa `getWatchedButtonState` y respeta
  el botón del panel · Ficheros: `content.js`, `content.css` · Test: `make lint`, `make test` y a mano V1 (las
  tarjetas se ven y funcionan como hoy, con icono delante del texto).
- [x] T3 · Columna superpuesta arriba a la izquierda de la miniatura, colapsada, con despliegue solo del botón bajo el
  cursor o enfocado, escudo de eventos,
  respaldo y traslado al anfitrión; estilos claro/oscuro y `--compact` · Ficheros: `content.js`, `content.css` · Test:
  `make lint`, `make test` y a mano V1–V7.
- [x] T4 · Cerrar: `docs/ARCHITECTURE.md` (flujo **Detección**: dónde va el control; `icons.js` con `getUiIconPath`;
  `watched.js` con `getWatchedButtonState`). Estado de este plan a `hecho` · Ficheros: `docs/ARCHITECTURE.md`, este
  plan · Test: `make lint` y `make test`.

### Verificación manual (Firefox con sesión iniciada, extensión cargada en `about:debugging`; recargar la extensión tras cada tarea)

- V1 · `/feed/subscriptions` y `/` (inicio): cada vídeo tiene en la esquina superior izquierda de su miniatura una
  columna con `+G`, ojo y lista, uno debajo de otro y alineados a la izquierda. El título, el canal y los metadatos ya
  no tienen botones debajo. La duración y los botones de YouTube al pasar el cursor (arriba a la derecha) se ven.
- V2 · Pasar el cursor por `+G`: solo ese botón muestra "Añadir a grupo" (crece hacia la derecha; los otros dos no se
  mueven ni se despliegan); al bajar al ojo, se recoge `+G` y se despliega "Marcar visto"; al salir de la columna se
  recogen todos. Con Tab, solo el botón enfocado muestra su texto. Tras pulsar uno con el ratón y apartar el cursor,
  no se queda desplegado.
- V3 · Pulsar cada botón sobre la miniatura: **no** se abre el vídeo (ni con clic central). "+G" abre las casillas de
  grupos y guardar funciona; "Lista" abre el desplegable de listas; el ojo marca visto: pasa a check resaltado, la
  tarjeta se atenúa u oculta según "Vídeos vistos" y otra tarjeta del mismo vídeo cambia también. Pulsar de nuevo lo
  desmarca.
- V4 · Clic en la miniatura fuera de la columna: abre el vídeo como siempre.
- V5 · `/results?search_query=...`: los vídeos tienen la columna; los resultados de canal siguen con "Añadir a grupo"
  en línea y funciona.
- V6 · `/watch`: las recomendaciones tienen la columna compacta; en una cuyo canal no se identifica, "+G" se ve
  deshabilitado y al pulsarlo no se abre el vídeo. Mixes y listas siguen sin botones.
- V7 · Tema oscuro y claro (Ajustes de YouTube → Aspecto): la columna se lee en los dos. Con un grupo activo, las
  tarjetas ocultas o atenuadas se comportan como antes. Anotar en el **Registro** si la vista previa al pasar el cursor
  de YouTube tapa la columna (riesgo conocido; ver **Fuera de alcance**).

## Criterios de aceptación

- En inicio, suscripciones, búsqueda y recomendaciones de `/watch`, los botones de cada vídeo están sobre la
  miniatura, arriba a la izquierda y en columna, colapsados; cada botón muestra su texto solo cuando tiene el cursor
  encima o el foco de teclado.
- Pulsarlos no abre el vídeo; hacen lo mismo que antes (grupos, visto, listas), con los mismos estados de visto y
  deshabilitado.
- Los resultados de canal de la búsqueda funcionan como antes.
- Formatos guardados sin cambios; sin dependencias nuevas.

## Fuera de alcance

- Evitar la vista previa en línea de YouTube al pasar el cursor por la miniatura: si tapa la columna, se decidirá en
  otro plan (por ejemplo, otra posición).
- Botones en Shorts, páginas de canal o listas de reproducción (como hoy, no tienen).
- Tests de DOM de `content.js` (no hay entorno DOM en `make test`).

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-15 | T1 | feat: iconos de interfaz y estado del botón de visto | `getUiIconPath` en `icons.js` y `getWatchedButtonState` en `watched.js`, con tests. |
| 2026-11-15 | T2 | feat: botones de tarjeta con glifo y etiqueta | `setCardButtonContent` y `createUiIconSvg` en `content.js`; `updateWatchedButton` usa `getWatchedButtonState`; estilos de glifo/etiqueta. V1 pendiente a mano. |
| 2026-11-15 | T3 | feat: botones de tarjeta superpuestos a la miniatura | `placeControlOnThumbnail`, traslado al anfitrión y escudo de eventos en `content.js`; columna colapsada con despliegue por hover/focus-visible en `content.css`. V1–V7 pendientes a mano. |
| 2026-11-15 | T4 | docs: arquitectura de los botones sobre la miniatura | `ARCHITECTURE.md` (Detección, `icons.js`, `watched.js`); plan a hecho. |
