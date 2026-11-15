# Plan: correcciones de la revisión de los planes gui-*

**Estado:** aprobado (2026-11-15)

Issue: revisión del diff `5e1206a..HEAD` (planes `2026-11-15-gui-*`)

## Contexto y decisión

La revisión encontró un bloqueante y tres sugerencias. La persona delegó las decisiones: se aplica la opción
recomendada en cada caso.

- **Bloqueante (filtro de Duración roto)**: `placeControlOnThumbnail` (`content.js` ~2918) añade la clase
  `youtube-groups__thumb-host` a la miniatura y `getCardTexts` (~3118) excluye todo lo que esté dentro de
  `[class*="youtube-groups__"]`, así que descarta la duración (que YouTube pinta dentro de la miniatura). Decisión:
  marcar el anfitrión con el atributo `data-youtube-groups-thumb-host` (como `data-youtube-groups-video-id`) y
  seleccionarlo en CSS por atributo. Se descarta cambiar el selector de exclusión de `getCardTexts` (más frágil: cualquier
  otra clase con el prefijo en un nodo de YouTube volvería a romperlo). No hay lógica pura que extraer (es un cambio de
  marca en el DOM): verificación manual.
- **Desplegables**: el control de la tarjeta para `mousedown` (para que no llegue al enlace de la miniatura), así que
  el cierre "al hacer clic fuera" de los demás desplegables no se dispara. Decisión: al abrir el desplegable de grupos se
  cierran el de listas y el selector de iconos, y al abrir el de listas, el de grupos y el selector de iconos. Se descarta
  dejar pasar el `mousedown` (YouTube lo usa para navegar).
- **Filtro de canal huérfano**: si el canal del filtro ya no está en ningún grupo, no queda botón en la guía para
  deseleccionarlo. Decisión: `resolveFilterUrls` devuelve `missing` también para un canal que no está en ningún grupo
  (comparando URL normalizadas), y `refreshActiveFilter` ya vuelve a "Todos" con `missing`. Además, la guía normaliza la
  URL de cada canal al construir sus elementos y omite los que no normalizan, para que el estado activo y la
  deselección funcionen y no se ofrezca un canal que el filtro descartaría.
- **Registro de T7** en `2026-11-15-gui-3-guia-lateral.md`: el mensaje anotado no coincide con el commit real.

## Tareas

- [x] T1 · Marcar el anfitrión de la miniatura con `data-youtube-groups-thumb-host` en lugar de la clase
  `youtube-groups__thumb-host`; el CSS pasa a `[data-youtube-groups-thumb-host]`; actualizar la mención en
  `docs/ARCHITECTURE.md` · Ficheros: `content.js`, `content.css`, `docs/ARCHITECTURE.md` · Test: `make test` sin
  regresiones + verificación manual V1
- [x] T2 · Al abrir un desplegable de la extensión cerrar los demás: `openSubscriptionGroupsForm` oculta el de listas
  (`hidePlaylistDropdown`) y el selector de iconos (`hideIconPicker`); `openPlaylistForm` oculta el formulario de grupos
  (extraer un `hideSubscriptionDropdown()` con lo que ya hace el escuchador de `mousedown` ~2346) y el selector de
  iconos · Ficheros: `content.js` · Test: verificación manual V2
- [ ] T3 · Canal de filtro huérfano o no normalizable: (a) en `modules/filter.js`, `resolveFilterUrls` devuelve
  `{status: "missing"}` para un filtro de canal cuya URL normalizada no está en ningún grupo ni subgrupo (recorrido
  local, normalizando cada URL con `try/catch`); ajustar el texto del `console.warn` de `refreshActiveFilter` a "Filtro
  activo no encontrado"; (b) en `modules/guide.js`, `toGuideItem` normaliza `channel.url` con
  `YouTubeGroups.normalizeChannelUrl` y omite los canales cuya URL no normaliza; (c) corregir en
  `docs/plans/2026-11-15-gui-3-guia-lateral.md` el mensaje del Registro de T7 a
  `feat: llevar a suscripciones al seleccionar en la guía` · Ficheros: `modules/filter.js`, `modules/guide.js`,
  `content.js`, `tests/filter.test.js`, `tests/guide.test.js`, `docs/plans/2026-11-15-gui-3-guia-lateral.md` · Test:
  en `tests/filter.test.js`, canal en un subgrupo → `ok`; canal en ningún grupo → `missing`; canal guardado con
  parámetros (`?a=1`) en el grupo → `ok`. En `tests/guide.test.js`, un canal con URL no normalizable no aparece y uno con
  parámetros sale normalizado

## Criterios de aceptación

- V1: con el filtro de Duración activo en `/feed/subscriptions`, las tarjetas fuera del rango se ocultan; los botones
  siguen sobre la miniatura y colapsados como antes.
- V2: con el desplegable de grupos abierto, pulsar el botón de lista de otra tarjeta deja abierto solo el de listas (y al
  revés).
- Con un canal seleccionado en la guía, quitar ese canal de todos sus grupos vuelve el filtro a "Todos".
- La guía no muestra canales con URL no normalizable, y un canal seleccionado aparece marcado y se deselecciona
  pulsándolo otra vez.
- `make lint` y `make test` en verde.

## Fuera de alcance

- Cambiar el selector de exclusión de `getCardTexts` o el resto de marcas de la extensión.
- Unificar los desplegables en un gestor común.
- Limpiar en almacenamiento los canales con URL no normalizable (lo hace la limpieza existente).

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-15 | T1 | `fix: marcar la miniatura anfitriona con atributo para no romper el filtro de duración` | Atributo `data-youtube-groups-thumb-host` en lugar de clase; pendiente V1 manual |
| 2026-11-15 | T2 | `fix: cerrar los demás desplegables al abrir uno de grupos o de listas` | `hideSubscriptionDropdown()` extraído; pendiente V2 manual |
