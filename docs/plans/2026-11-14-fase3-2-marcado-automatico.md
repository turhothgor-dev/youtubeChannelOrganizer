# Plan: Fase 3 (2/4) · Marcar vídeos vistos automáticamente

**Estado:** aprobado (2026-11-14)

Issue: `ROADMAP.md`, Fase 3: "Marcar videos vistos".

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

Requisito previo: el plan `2026-11-14-fase3-1-visibilidad-vistos.md` en estado `hecho` (usa
`YouTubeGroupsSettings`, la caché `settings`, la sección "Ajustes" del panel, `savingWatchedIds` y
`refreshWatchedUi` de `content.js`).

El marcado manual ya existe (Fase 2). "Marcar videos vistos" de la Fase 3 es que la extensión marque sola el vídeo
que se está reproduciendo en `/watch` cuando se ha visto una parte suficiente, con el mismo almacenamiento
(ADR 0002) y la misma interfaz de visto.

### Decisiones (delegadas por la persona)

- **Cuándo se marca:** cuando la posición de reproducción del vídeo principal alcanza un porcentaje de su
  duración. El porcentaje es un ajuste nuevo, `autoMarkPercent`, ya previsto en el ADR 0003: `0` (desactivado),
  `50`, `80` (por defecto) o `95`. No hace falta cambiar `version`.
- **Cómo se detecta:** un único escuchador de `timeupdate` en `document` en fase de captura
  (`document.addEventListener("timeupdate", handleVideoProgress, true)`); `timeupdate` no burbujea pero sí se
  captura, así que no hay que buscar ni seguir el elemento `<video>`, que YouTube reemplaza. Se leen
  `currentTime` y `duration` del propio `<video>` (API estándar de HTML, no del DOM de YouTube).
- **Lógica pura en `modules/watched.js`:** `shouldAutoMark(currentTime, duration, percent)` devuelve `true` solo si
  `percent` es mayor que 0, `duration` es un número finito mayor que 0 (los directos tienen `Infinity`),
  `currentTime` es finito y `currentTime >= duration * percent / 100`.
- **Ajuste en `modules/settings.js`:** `DEFAULT_SETTINGS` gana `autoMarkPercent: 80`; nuevo
  `AUTO_MARK_PERCENTS = [0, 50, 80, 95]`; `normalizeSettings` y `updateSettings` lo validan como los otros (un
  número fuera de la lista, o una cadena `"80"`, no es válido).
- **Guardas en `handleVideoProgress(event)`**, en este orden, saliendo en cuanto una falla:
  1. `settings.autoMarkPercent !== 0`.
  2. `event.target` es un `HTMLVideoElement` dentro de `#movie_player` (descarta las vistas previas al pasar el
     ratón y el reproductor en miniatura fuera de `/watch`).
  3. `#movie_player` no tiene la clase `ad-showing` (durante un anuncio el `<video>` es el del anuncio).
  4. `videoId = getCurrentWatchVideoId()` no es `null`; si existe `ytd-watch-flexy[video-id]` y su valor es
     distinto de `videoId`, se sale (evita marcar el vídeo nuevo con la posición del anterior durante una
     navegación SPA). Si el atributo no existe, no se bloquea.
  5. `watchedVideos !== null`, el vídeo no está ya visto, no está en `savingWatchedIds` y no está en
     `autoMarkHandledIds`.
  6. `shouldAutoMark(video.currentTime, video.duration, settings.autoMarkPercent)`.
- **`autoMarkHandledIds`** (`Set` en memoria, por pestaña): se añade el ID al intentar el marcado automático y
  también cuando la persona pulsa el botón de visto del vídeo actual del panel. Así, si la persona desmarca el
  vídeo que está viendo, no se vuelve a marcar en esa pestaña. Un error al guardar no se reintenta (evita
  repetirlo cuatro veces por segundo).
- **Marcado:** función `markVideoWatched(videoId)` en `content.js` que, con `savingWatchedIds`, llama a
  `YouTubeGroupsWatched.setVideoWatched(videoId, true)`, actualiza `watchedVideos` y llama a
  `refreshWatchedUi(videoId, null)`. Error: `console.error` y `title` con el mensaje en el botón del panel. La
  entrada guardada es la misma que la del marcado manual (`{ watchedAt }`); no se añade `source` (el ADR 0002 lo
  permite más adelante, pero nada lo usaría ahora).
- **Interfaz:** tercer `<select>` en la sección "Ajustes" del panel, "Marcar visto al reproducir", con las opciones
  "Desactivado" (0), "Al 50 %", "Al 80 %" y "Al 95 %", con el mismo manejo de carga, guardado y error que los
  otros dos. Los valores de `<option>` son cadenas; el manejador las convierte con `Number(...)` antes de
  `updateSettings`.

Alternativas descartadas:

- Marcar al abrir `/watch`: marcaría vídeos que solo se abrieron un momento.
- Leer la barra de progreso de YouTube o su API interna del reproductor (`getVideoData`, `wrappedJSObject`):
  selectores y API no públicas, más frágiles que el `<video>` estándar.
- Acumular segundos reproducidos realmente (descontando saltos): más preciso, pero más estado y casos límite; saltar
  al final y marcar es aceptable para este uso.
- Campo `source: "auto"` en la entrada: sin un uso que lo necesite.
- Umbral libre (campo numérico): cuatro opciones cubren los casos sin validar texto libre.

Sin ADR nuevo: el campo ya está descrito en el ADR 0003. `docs/ARCHITECTURE.md` se actualiza en T3.

## Tareas

Reglas comunes: nada de `innerHTML` con valores interpolados; JSDoc en las funciones nuevas; los tests usan
`loadModules` y `plain`. Cada tarea termina con `make test` y `make lint` en verde y sin avisos.

- [x] T1 · Lógica del marcado automático. En `modules/watched.js`, añadir y exportar `shouldAutoMark`. En
  `modules/settings.js`, `autoMarkPercent` en `DEFAULT_SETTINGS`, `AUTO_MARK_PERCENTS`, normalización y validación ·
  Ficheros: `modules/watched.js`, `modules/settings.js`, `tests/watched.test.js`, `tests/settings.test.js` ·
  Test: `shouldAutoMark(80, 100, 80)` es `true`; `(79.9, 100, 80)` `false`; `(100, 100, 0)` `false`;
  `(10, Infinity, 50)` `false`; `(10, NaN, 50)` `false`; `(10, 0, 50)` `false`; `(NaN, 100, 50)` `false`;
  `(95, 100, 95)` `true`. `normalizeSettings({})` incluye `autoMarkPercent: 80`; `{ autoMarkPercent: 0 }` se
  conserva; `70` y `"80"` pasan a `80`; `updateSettings({ autoMarkPercent: 0 })` escribe y conserva los otros dos
  campos; `updateSettings({ autoMarkPercent: 70 })` lanza "Ajuste inválido: autoMarkPercent." sin escribir.
- [ ] T2 · Marcado automático en `/watch`. En `content.js`: `autoMarkHandledIds`, `markVideoWatched`,
  `handleVideoProgress` con sus guardas y el escuchador de captura; el botón del vídeo actual del panel añade el ID
  a `autoMarkHandledIds` al pulsar; el tercer `<select>` de "Ajustes" · Ficheros: `content.js` (y `content.css` solo
  si el `<select>` nuevo necesita estilo) · Test: `make lint`, `make test` y a mano V1 a V6.
- [ ] T3 · Cerrar el plan. En `ROADMAP.md`, marcar con ✅ "Marcar videos vistos". En `docs/ARCHITECTURE.md`: la fila
  de `modules/watched.js` menciona `shouldAutoMark`, y el flujo "Marcar como visto" describe el marcado automático
  (escuchador de `timeupdate`, guardas y ajuste). Estado de este plan a `hecho` · Ficheros: `ROADMAP.md`,
  `docs/ARCHITECTURE.md`, este plan · Test: `make lint` y `make test`.

### Verificación manual (con `make up`)

- V1 · Con el ajuste por defecto (80 %), abrir un vídeo corto no visto y dejarlo avanzar: al pasar el 80 % el botón
  del panel cambia a "✓ Visto"; volver a inicio: su tarjeta está atenuada (o oculta, según "Vídeos vistos").
- V2 · Con anuncios previos al vídeo: el vídeo no se marca durante el anuncio aunque este llegue al final.
- V3 · Desmarcar desde el panel el vídeo que se está viendo después de que se marque solo: no se vuelve a marcar al
  seguir reproduciendo ni al retroceder y volver a pasar el umbral.
- V4 · "Marcar visto al reproducir: Desactivado": ver un vídeo entero no lo marca. Recargar: el ajuste se conserva.
- V5 · Desde un vídeo pasado el umbral, pulsar un vídeo recomendado: el nuevo no se marca al cargar, solo al pasar
  su propio umbral.
- V6 · Un directo (duración infinita) no se marca; pasar el ratón por tarjetas de inicio (vista previa
  reproduciéndose) no marca nada.

## Criterios de aceptación

- En `/watch`, el vídeo principal se marca como visto solo cuando su reproducción alcanza el porcentaje elegido
  (por defecto 80 %); nunca durante anuncios, en directos, en vistas previas ni fuera de `/watch`.
- El marcado automático se ve al momento en el botón del panel y en las tarjetas de ese vídeo, como el manual.
- Si la persona desmarca el vídeo actual, no se vuelve a marcar solo en esa pestaña.
- La persona puede desactivarlo o cambiar el porcentaje en "Ajustes"; se conserva tras recargar.
- El formato de los vistos (ADR 0002) y de los ajustes (ADR 0003) no cambia.
- En `ROADMAP.md`, "Marcar videos vistos" aparece con ✅.
- `make lint` (0 avisos) y `make test` pasan.

## Fuera de alcance

- Marcar automáticamente Shorts (`/shorts/<id>`) o vídeos en el reproductor en miniatura (Fase 5).
- Contar el tiempo realmente reproducido o ignorar saltos.
- Recordar entre recargas que la persona desmarcó un vídeo.
- Campo `source` en los vistos; limpieza de vistos antiguos.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-14 | T1 | `feat: añadir la lógica del marcado automático (shouldAutoMark y autoMarkPercent)` | `shouldAutoMark` y ajuste `autoMarkPercent` con sus tests; los tests de ajustes existentes se actualizan al nuevo campo por defecto. |
