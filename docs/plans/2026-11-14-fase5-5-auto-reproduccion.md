# Plan: Fase 5 (5/5) · Reproducir en cadena lo visible

**Estado:** aprobado (2026-11-14)

Issue: `ROADMAP.md`, Fase 5: "Auto-reproducción".

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

Las listas ya se reproducen en cadena con "Reproducir" (`watch_videos`, ADR 0004). Falta reproducir los vídeos de un
grupo: sin API no hay catálogo de vídeos por canal, pero el feed filtrado ya los muestra. Decisión: un botón
"Reproducir lo visible" en el panel que reúne, en orden de página, los vídeos visibles, sin ver y que pasan el filtro
(grupo y filtros avanzados), y abre `watch_videos` con los 50 primeros; YouTube los reproduce uno tras otro. Va
después del resto de la Fase 5 para cubrir búsqueda, recomendaciones y Shorts, pero no depende de ellos.

Alternativa descartada: una cola propia que avanza en el evento `ended` y se guarda en `sessionStorage`. Quita el
límite de 50, pero choca con la reproducción automática de YouTube y añade estado entre navegaciones; se reconsidera
solo si `watch_videos` deja de funcionar.

Decisiones (delegadas por la persona):

- En `modules/playlists.js`:
  - `buildWatchVideosUrl(videoIds)`: IDs válidos, sin repetir, en orden, los 50 primeros; `null` si no queda
    ninguno. `buildPlayAllUrl(playlist)` pasa a usarla (mismo resultado que hoy).
  - `selectQueueIds(entries)`: `entries = [{ id, visible, hidden, dimmed, watched }]`; devuelve los `id` con
    `visible && !hidden && !dimmed && !watched`, en orden y sin repetir.
- En `content.js`: botón `youtube-groups__play-visible` "Reproducir lo visible" bajo la lista de grupos del panel
  (plantilla estática) y `<p aria-live>`. Al pulsar: recorre `document.querySelectorAll(VIDEO_CARD_SELECTOR)`, construye
  las entradas con el atributo de ID de vídeo, `card.checkVisibility()` (descarta tarjetas de páginas SPA anteriores
  que YouTube deja ocultas) y las clases `youtube-groups--hidden`, `youtube-groups--dimmed` y
  `youtube-groups--watched`; si hay URL, `window.location.assign(url)`; si no, "No hay vídeos visibles sin ver.".

## Tareas

Reglas comunes: sin `innerHTML` con datos; JSDoc; tests con `loadModules` y `plain`; `make test` y `make lint`
(0 avisos) en verde.

- [ ] T1 · `buildWatchVideosUrl`, `selectQueueIds` y `buildPlayAllUrl` sobre la primera · Ficheros:
  `modules/playlists.js`, `tests/playlists.test.js` · Test: IDs repetidos e inválidos se quitan conservando el orden;
  60 IDs dan 50; `[]` da `null`; los tests de `buildPlayAllUrl` siguen pasando; `selectQueueIds` excluye ocultas,
  atenuadas, vistas y no visibles y quita repetidos.
- [ ] T2 · Botón "Reproducir lo visible" y estilos (claro y `html[dark]`) · Ficheros: `content.js`, `content.css` ·
  Test: `make lint`, `make test` y a mano V1–V3.
- [ ] T3 · Cerrar el plan: `ROADMAP.md` marca ✅ "Auto-reproducción"; `docs/ARCHITECTURE.md` (flujo "Reproducir lo
  visible", funciones nuevas en la fila de `playlists.js`). Estado a `hecho` · Ficheros: `ROADMAP.md`,
  `docs/ARCHITECTURE.md`, este plan · Test: `make lint` y `make test`.

### Verificación manual (con `make up`)

- V1 · En suscripciones, con un grupo activo, "Reproducir lo visible" abre una lista de reproducción con los vídeos
  del grupo no vistos, en el orden del feed, y al terminar uno empieza el siguiente.
- V2 · Navegar de inicio a suscripciones por la SPA y pulsar: no entran vídeos de inicio.
- V3 · Con todo visto o filtrado, aparece "No hay vídeos visibles sin ver." y no navega.

## Criterios de aceptación

- Desde el panel se reproducen en cadena los vídeos visibles y sin ver de la página (hasta 50), respetando grupo y
  filtros.
- "Reproducir" de las listas sigue igual. `ROADMAP.md` marca "Auto-reproducción" con ✅ (Fase 5 completa); `make
  lint` y `make test` pasan.

## Fuera de alcance

- Cola propia sin límite de 50, cargar más vídeos haciendo scroll automático, reproducir grupos sin abrir el feed.
- Cambiar la reproducción automática de YouTube.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
