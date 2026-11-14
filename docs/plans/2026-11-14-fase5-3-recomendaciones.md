# Plan: Fase 5 (3/5) · Recomendaciones de `/watch`

**Estado:** aprobado (2026-11-14)

Issue: `ROADMAP.md`, Fase 5: "Soporte para recomendaciones".

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

Requisitos previos: planes `2026-11-14-fase4-1-sincronizacion-pestanas.md` y `2026-11-14-fase5-2-busqueda.md` en
`hecho`. Las recomendaciones de inicio ya funcionan (`ytd-rich-item-renderer`); falta la columna de `/watch`, que
YouTube pinta con `yt-lockup-view-model` (antes `ytd-compact-video-renderer`). En esas tarjetas el canal suele ser
texto sin enlace, así que hoy no se identifica y, por la regla "sin canal, pasa", el filtro de grupo no oculta nada.

Decisiones (delegadas por la persona):

- **Detección**: `VIDEO_CARD_SELECTOR` añade `yt-lockup-view-model:not(ytd-rich-item-renderer yt-lockup-view-model)`
  (en inicio la tarjeta sigue siendo el `ytd-rich-item-renderer`; no hay tarjetas anidadas).
- **Canal por nombre** cuando no hay enlace, solo contra canales ya guardados (los únicos que importan al filtro), en
  `modules/groups.js`:
  - `buildChannelNameIndex(groups)`: `Map` nombre recortado → URL de todo el árbol; un nombre con dos URL distintas
    se excluye.
  - `matchChannelByTexts(index, texts)`: `{ name, url }` si los textos coinciden exactamente con nombres de una sola
    URL; si no, `null`.
  - `content.js` guarda `channelNameIndex`, recalculado en `renderGroupsPanel` (corre al arrancar, al navegar y, con
    el plan 4-1, al cambiar los grupos en cualquier pestaña); si cambia, reprograma las tarjetas sin enlace de canal.
    `detectCard` usa el enlace y, si no hay, `matchChannelByTexts(channelNameIndex, getCardTexts(card))`.
- **Regla del filtro (cambio global)**: `YouTubeGroupsVisibility.matchesGroupFilter({ activeGroupId, channelUrls,
  channelUrl, hasVideoId })`: sin grupo activo o con `channelUrls === null` (cargando) → `true`; con `channelUrl` →
  `channelUrls.has(channelUrl)`; sin canal y con ID de vídeo → `false`; sin canal ni ID → `true`. Con un grupo activo,
  los vídeos cuyo canal no se identifica (mixes, colaboraciones, tarjetas de otros canales) dejan de colarse en todas
  las superficies; las tarjetas aún sin enlaces pasan hasta que se pintan. `cardMatchesFilter` la usa.
- **Botones** en `/watch`: `shouldShowCardControls("watch")` pasa a `true` y `content.js` solo los pone en tarjetas
  dentro de `#related` o `ytd-watch-next-secondary-results-renderer`, con la clase
  `youtube-groups__subscription-control--compact` (botones pequeños, en línea propia). Ancla: tras el enlace de canal
  si existe; si no, al final de `yt-lockup-metadata-view-model` (o de la tarjeta). "Añadir a grupo" usa el canal
  detectado (`data-youtube-groups-channel-*`); sin canal queda deshabilitado con `title` "No se pudo identificar el
  canal". En `/watch` las tarjetas de otras zonas (pantalla final, listas) no llevan botones.

Alternativa descartada: buscar el nombre del canal con selectores internos del lockup; los textos de la tarjeta
(`getCardTexts`) ya se leen para los filtros avanzados y resisten mejor los cambios de DOM.

## Tareas

Reglas comunes: sin `innerHTML` con datos; JSDoc; tests con `loadModules` y `plain`; `make test` y `make lint`
(0 avisos) en verde.

- [x] T1 · `buildChannelNameIndex` y `matchChannelByTexts` · Ficheros: `modules/groups.js`, `tests/groups.test.js` ·
  Test: índice con canales de subgrupos; nombre repetido con la misma URL se queda, con dos URL se excluye; textos con
  un nombre conocido dan su canal; con dos nombres de URL distintas, `null`; sin coincidencias, `null`; espacios
  alrededor se ignoran.
- [x] T2 · `matchesGroupFilter` y su uso en `cardMatchesFilter` · Ficheros: `modules/visibility.js`,
  `tests/visibility.test.js`, `content.js` · Test: los cuatro casos de **Decisiones** y `channelUrls === null`;
  `make lint` y a mano V3.
- [x] T3 · Detección de `yt-lockup-view-model` y canal por nombre en `detectCard` con `channelNameIndex` · Ficheros:
  `content.js` · Test: `make lint`, `make test` y a mano V1, V2 y V5.
- [ ] T4 · Botones compactos en la columna de `/watch` (`modules/pages.js` y `content.js`) y estilos (claro y
  `html[dark]`) · Ficheros: `modules/pages.js`, `tests/pages.test.js`, `content.js`, `content.css` · Test:
  `shouldShowCardControls("watch") === true`; `make lint` y a mano V4.
- [ ] T5 · Cerrar el plan: `ROADMAP.md` marca ✅ "Soporte para recomendaciones"; `docs/ARCHITECTURE.md` (regla del
  filtro sin canal, canal por nombre, superficies). Estado a `hecho` · Ficheros: `ROADMAP.md`, `docs/ARCHITECTURE.md`,
  este plan · Test: `make lint` y `make test`.

### Verificación manual (con `make up`)

- V1 · En `/watch`, las recomendaciones de la derecha se marcan como vistas y siguen el ajuste "Vídeos vistos".
- V2 · Con un grupo activo, en la columna solo quedan (o se atenúan) vídeos de sus canales, incluidos los que no
  enlazan al canal; los filtros avanzados también se aplican.
- V3 · En inicio, con un grupo activo, los mixes y vídeos sin canal identificable se ocultan; sin grupo activo se ven.
- V4 · Cada recomendación tiene los botones compactos; "Marcar visto" y "Lista" funcionan; "Añadir a grupo" funciona si
  el canal se identifica y, si no, está deshabilitado con su explicación.
- V5 · Añadir un canal a un grupo desde otra pestaña: sus recomendaciones sin enlace pasan a reconocerse sin recargar.

## Criterios de aceptación

- En la columna de recomendaciones de `/watch` funcionan visto, listas, filtro de grupo y filtros avanzados.
- Con un grupo activo, los vídeos de canal no identificado no aparecen como del grupo en ninguna superficie.
- `ROADMAP.md` marca "Soporte para recomendaciones" con ✅; `make lint` y `make test` pasan.

## Fuera de alcance

- Pantalla final del vídeo, tarjetas del reproductor y la reproducción automática de YouTube.
- Añadir a grupos canales sin enlace que aún no están en ningún grupo.
- Shorts (plan 5-4).

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-14 | T1 | feat: índice de canales por nombre y coincidencia por textos | `buildChannelNameIndex` y `matchChannelByTexts` en `modules/groups.js` con tests. |
| 2026-11-14 | T2 | feat: regla de filtro de grupo para tarjetas sin canal | `matchesGroupFilter` en `modules/visibility.js` con tests; `cardMatchesFilter` la usa. V3 pendiente a mano. |
| 2026-11-14 | T3 | feat: detectar recomendaciones de /watch y canal por nombre | Selector `yt-lockup-view-model`, `channelNameIndex` y `detectCard` con `matchChannelByTexts`. V1, V2 y V5 pendientes a mano. |
