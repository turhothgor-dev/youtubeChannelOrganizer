# Plan: Fase 5 (2/5) · Tipos de página y resultados de búsqueda

**Estado:** aprobado (2026-11-14)

Issue: `ROADMAP.md`, Fase 5: "Soporte para resultados de búsqueda".

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

En `/results` las tarjetas `ytd-video-renderer` ya se detectan y filtran, pero no tienen botones (solo se ponen en
inicio y suscripciones, `shouldShowChannelControls`), y los resultados de canal (`ytd-channel-renderer`) no permiten
añadir el canal a un grupo. Decisión: un módulo puro que clasifica la página, usado por todas las superficies de la
Fase 5 (este plan y los 5-3 y 5-4), y botones en la búsqueda. Sin permisos ni cambios de formato.

Decisiones (delegadas por la persona):

- **Módulo nuevo `modules/pages.js`** (`YouTubeGroupsPages`, sin DOM), cargado tras `metadata.js`:
  - `getPageType(pathname)`: `"/"` → `"home"`, `"/feed/subscriptions"` → `"subscriptions"`, `"/results"` →
    `"search"`, `"/watch"` → `"watch"`, `/shorts/<id>` → `"shorts"`, `/@x`, `/channel/x`, `/c/x`, `/user/x` (con o sin
    subruta) → `"channel"`; el resto → `"other"`.
  - `shouldShowCardControls(pageType)`: `true` para `home`, `subscriptions` y `search`.
  - `content.js` sustituye `shouldShowChannelControls` por `shouldShowCardControls(getPageType(location.pathname))`
    (inicio y suscripciones no cambian).
- **Tarjetas de vídeo en búsqueda**: el mismo control de tres botones. Ancla en `search`: el `ytd-channel-name` que
  contiene el enlace de canal (`channelLink.closest("ytd-channel-name")`) y, si no hay, el enlace (como hoy). Estilo:
  el control pasa a línea propia (`display: flex; flex-wrap: wrap; margin-top: 4px`) para no romper la fila del canal.
- **Resultados de canal**: `CHANNEL_RESULT_SELECTOR = "ytd-channel-renderer"`, programados en el mismo recorrido que
  las tarjetas (`scheduleCardsIn`) y tratados en `processPendingCards` por `ensureChannelResultControl(card)`, solo en
  `search`. Canal: URL del primer enlace con `normalizeChannelUrl` no nulo; nombre: texto de
  `ytd-channel-name #text` (o de `#channel-title`), recortado. Sin nombre o URL, no se añade control.
  `createSubscriptionChannelControl(card, { videoButtons: false, channel })` crea solo "Añadir a grupo" con ese canal.
  Se inserta al final de `#info` (o de la tarjeta si no existe). No se filtran ni se marcan como vistos.

## Tareas

Reglas comunes: sin `innerHTML` con datos; JSDoc; `make test` y `make lint` (0 avisos) en verde.

- [x] T1 · `modules/pages.js`; añadirlo a `manifest.json` y a `tests/helpers/load-modules.js` (devuelve
  `YouTubeGroupsPages`) · Ficheros: `modules/pages.js` (nuevo), `manifest.json`, `tests/helpers/load-modules.js`,
  `tests/pages.test.js` (nuevo) · Test: cada ruta de **Decisiones** da su tipo; `/shorts/` sin id, `/feed/history` y
  `/playlist` dan `other`; `/@x/videos` da `channel`; `shouldShowCardControls` es `true` solo en los tres tipos.
- [ ] T2 · Usar `YouTubeGroupsPages` en `content.js` y botones en tarjetas de búsqueda con su ancla y estilo ·
  Ficheros: `content.js`, `content.css` · Test: `make lint`, `make test` y a mano V1, V2 y V4.
- [ ] T3 · "Añadir a grupo" en resultados de canal · Ficheros: `content.js`, `content.css` · Test: `make lint`,
  `make test` y a mano V3.
- [ ] T4 · Cerrar el plan: `ROADMAP.md` marca ✅ "Soporte para resultados de búsqueda"; `docs/ARCHITECTURE.md` (fila
  de `pages.js`, orden de carga y superficies con botones en el flujo "Detección"). Estado a `hecho` · Ficheros:
  `ROADMAP.md`, `docs/ARCHITECTURE.md`, este plan · Test: `make lint` y `make test`.

### Verificación manual (con `make up`)

- V1 · Buscar algo: cada vídeo tiene "Añadir a grupo", "Marcar visto" y "Lista" bajo el canal, sin romper la fila;
  funcionan como en inicio y no navegan.
- V2 · Con un grupo activo, en búsqueda solo se ven (o se atenúan) los vídeos de sus canales; los filtros avanzados
  también se aplican.
- V3 · Buscar un canal: su resultado tiene "Añadir a grupo"; añadirlo a un grupo y comprobarlo en "Ver canales".
- V4 · Inicio y suscripciones se ven igual que antes; en `/watch` no aparecen botones en las tarjetas.

## Criterios de aceptación

- En los resultados de búsqueda se puede añadir el canal de un vídeo o un canal a grupos, marcar vistos y guardar en
  listas, y el filtro se aplica.
- Inicio y suscripciones no cambian. `ROADMAP.md` marca "Soporte para resultados de búsqueda" con ✅; `make lint` y
  `make test` pasan.

## Fuera de alcance

- Botones en páginas de canal, listas (`/playlist`) o historial.
- Filtrar resultados de canal, listas o mixes de la búsqueda.
- Shorts y recomendaciones (planes 5-3 y 5-4).

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-14 | T1 | `feat: módulo pages para clasificar el tipo de página` | `modules/pages.js` con `getPageType` y `shouldShowCardControls`; en manifest y helper de tests. |
