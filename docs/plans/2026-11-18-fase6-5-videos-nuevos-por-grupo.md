# Plan: Fase 6-5 · Vídeos nuevos por grupo en el bullet de la guía

**Estado:** aprobado (2026-11-18)

Issue: punto 2 de la persona tras probar gui-8 (2026-11-18), el número dentro del bullet, y ROADMAP 6-5. Índice:
[2026-11-18-gui-9-y-fase6-4-6-5](2026-11-18-gui-9-y-fase6-4-6-5.md). ADR:
[0019](../adr/0019-videos-nuevos-por-grupo-aproximados.md) (propuesta). Depende de gui-9 T3 (`setGroupBullet` y
`data-group-id` en el botón del grupo).

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

Tras gui-9, el botón de cada grupo de la guía tiene un bullet de su color sin número. Este plan pone dentro el número
de vídeos nuevos del grupo (con sus subgrupos), aproximado y sin red, según el modelo del ADR 0019:

- **Datos**: clave `youtubeNewVideos` = `{ version: 1, since, videos: { <id>: { channel, seenAt, publishedBefore } },
  visits: { <groupId>: ms } }`, fuera de la copia de seguridad.
- **Nuevo**: no visto (`youtubeWatched`), `seenAt > ack` y (`publishedBefore` nulo o `> ack`), con `ack` = visita más
  reciente de los grupos cuyo subárbol contiene el canal (o `since`). Contador de un grupo = vídeos nuevos distintos de
  los canales de su subárbol.
- **Poner a 0**: seleccionar un grupo en la guía; mientras está seleccionado en `/feed/subscriptions`, cada volcado
  renueva su visita. Seleccionar canales o ver suscripciones sin filtro no reconoce nada.

Piezas:

- **Lógica pura** (`modules/new-videos.js`, `YouTubeGroupsNewVideos`, sin DOM; tras `subscriptions.js` en el
  manifiesto y en `tests/helpers/load-modules.js`; no entra en `options.html`):
  - `normalizeNewVideos(value)` → `{ since: number|null, videos, visits }` sin entradas no válidas (id de vídeo que no
    casa con `/^[\w-]{11}$/`, `channel` que no es una clave de canal, números no finitos).
  - `applyFeedBatch(stored, batch, { now, ackGroupIds, groups })` → `{ state, changed }`: `batch` es un `Map` id →
    `{ channelUrl, seenAt, ageSeconds|null }`. Si falta `since`, `since = now`. Añade los vídeos que no están y cuyo
    canal está en algún grupo (`publishedBefore = seenAt − ageSeconds·1000`, o `null`); en uno ya guardado con
    `publishedBefore` nulo, lo completa si el lote trae edad; nunca cambia `seenAt`. Pone `visits[id] = now` para los
    `ackGroupIds` que existen. Poda: `seenAt < now − 30 días`, canales que ya no están en ningún grupo, más de 1000
    vídeos (se quedan los de `seenAt` más reciente) y visitas de grupos inexistentes. No muta la entrada.
  - `acknowledgeGroups(state, groupIds, now)` → estado nuevo con esas visitas a `now` (para aplicarlo en memoria al
    momento).
  - `countNewVideos(state, groups, watched)` → `Map` id de grupo → número (solo los > 0), con el subárbol de cada grupo
    y subgrupo.
  - `saveFeedBatch(batch, { ackGroupIds })`: en `withLock(KEYS.newVideos)` lee la clave y los grupos, aplica
    `applyFeedBatch` con `Date.now()` y escribe solo si `changed`; devuelve `{ state, changed }`.
- **Almacenamiento**: `KEYS.newVideos = "youtubeNewVideos"`, `readNewVideosValue`, `getNewVideos`, `saveNewVideos`.
- **Bullet con número**: `YouTubeGroupsIcons.getContrastTextColor(hex)` → `"#ffffff"` o `"#0f0f0f"`, el de mayor
  contraste WCAG con `hex`. `setGroupBullet(element, color, count = 0)` (de gui-9) pasa a: se muestra si hay color o
  `count > 0`; sin color, fondo gris neutro `#909090` (CSS `var(--yg-group-color, #909090)`); con `count > 0`, clase
  `youtube-groups__group-bullet--count`, texto `count` (o `"99+"` por encima de 99), `--yg-bullet-text` =
  `getContrastTextColor(color || "#909090")` y en el elemento `aria-description` = "1 vídeo nuevo" / "N vídeos nuevos"
  (se quita con 0). CSS del bullet con número: `min-width: 18px; height: 18px; padding: 0 5px; box-sizing:
  border-box; border-radius: 9px; font-size: 11px; font-weight: 700; line-height: 18px; text-align: center; color:
  var(--yg-bullet-text)`. Sigue escribiendo en el DOM solo lo que cambia.
- **Recolector** (`ui/new-videos.js`, `YouTubeGroupsNewVideosUi.create(ctx)`, `ctx.newVideos`, creado tras
  `ctx.subscriptions` y antes de `ctx.cards`; estado `ctx.state.newVideoCounts`, `Map` vacío al inicio):
  - `noteVideo(videoId, channelUrl, getAgeSeconds)`: solo en `/feed/subscriptions`, con id y canal agrupado; un vídeo
    se anota una vez por pestaña (si se anotó sin edad y aún no se ha volcado, se reintenta la edad). Pendientes y un
    volcado como mucho cada 2 s (`flushPending`).
  - `ui/cards.js`: en `processPendingCards`, tras `detectCard`, llama (con `try/catch`, como `noteCardAvatar`) a
    `ctx.newVideos?.noteVideo(card.getAttribute(VIDEO_ID_ATTRIBUTE), card.dataset.youtubeGroupsChannelUrl, () =>
    getCardMetadata(card).age)`. La edad solo se lee si el recolector la necesita.
  - `acknowledgeSelection(selection)`: `content.js` lo llama en `setActiveSelection` con la selección nueva; toma los
    ids de las claves `group:` (`parseFilterKey`), aplica `acknowledgeGroups` en memoria, recuenta al momento y los
    deja pendientes para el siguiente volcado.
  - `flushPending`: `ackGroupIds` = pendientes de reconocer ∪ (en `/feed/subscriptions`, los grupos de la selección
    activa); si no hay vídeos ni reconocimientos, no escribe.
  - `setGroups(groups)` (desde `renderGroupsPanel`), `applyStoredValue(newValue)` (desde `handleStorageChange` con
    `"newVideos"`; vuelve a aplicar en memoria los reconocimientos aún no volcados) y `recount()` (también con
    `"watched"`): recalcula `countNewVideos` y, solo si el `Map` cambia, lo guarda en `ctx.state.newVideoCounts` y
    llama a `ctx.guide.updateNewVideoBullets()`. `start()` lee la clave y recuenta.
- **Guía** (`ui/guide-section.js`): `createGuideRow` pasa `ctx.state.newVideoCounts.get(item.id) ?? 0` a
  `setGroupBullet`; `updateNewVideoBullets()` recorre los botones `[data-group-id]` de `#youtube-groups-guide` y
  llama a `setGroupBullet` con su color heredado y su número, sin rehacer la columna.
- **Sin bucles**: la anotación sale del procesado de tarjetas; actualizar bullets solo toca nuestra sección, que no es
  tarjeta, y los recolectores de suscripciones (6-4) y avatares no escriben si no cambia nada.

Alternativas descartadas: ver ADR 0019 (RSS, campo en grupos, ids por grupo, solo `seenAt`, reconocer sin filtro).

## Tareas

- [x] T1 · Clave `youtubeNewVideos` · Ficheros: `modules/storage.js`, `tests/storage.test.js` · Test:
  `KEYS.newVideos === "youtubeNewVideos"`; `readNewVideosValue` con valores no válidos da `{ since: null, videos: {},
  visits: {} }`; `getNewVideos` sin datos no escribe; `saveNewVideos` guarda `version: 1`; `getChangedKeys` incluye
  `"newVideos"`.
- [x] T2 · Lote, reconocimiento y poda · Ficheros: `modules/new-videos.js` (nuevo), `manifest.json`,
  `tests/helpers/load-modules.js`, `tests/new-videos.test.js` (nuevo), `tests/manifest.test.js` si hace falta · Test:
  primer lote fija `since = now`; añade solo canales agrupados (también `/@Foo` frente a `/@foo`), con
  `publishedBefore` = `seenAt − edad` o `null`; un vídeo repetido no cambia `seenAt` y completa `publishedBefore` si
  faltaba; `ackGroupIds` pone visitas solo de grupos existentes; poda por 30 días, por canal no agrupado, por tope de
  1000 y visitas huérfanas; `changed: false` sin cambios; no muta; `acknowledgeGroups`; `saveFeedBatch` escribe una
  vez y nada si no cambia.
- [x] T3 · Recuento · Ficheros: `modules/new-videos.js`, `tests/new-videos.test.js` · Test (con A ⊃ A1, B y el canal X
  en A1 y en B): vídeo de X posterior a todo cuenta 1 en A1, A y B; tras visitar A1 cuenta 0 en los tres; visitar A lo
  pone a 0 en A1; un vídeo visto (`watched`) no cuenta; `publishedBefore` anterior a la visita no cuenta; sin visitas
  se usa `since`; dos canales del subárbol con el mismo vídeo cuentan 1; grupos sin nuevos no están en el `Map`.
- [x] T4 · Bullet con número · Ficheros: `modules/icons.js`, `ui/icons-dom.js`, `ui/icons.css`,
  `tests/icons.test.js`, `tests/ui-icons-dom.test.js` · Test: `getContrastTextColor` da blanco con `#9C27B0` y
  `#3F51B5` y oscuro con `#FF9800` y `#2196F3` (máximo contraste WCAG: el azul de la paleta queda mejor con texto
  oscuro); `setGroupBullet(el, "#2196F3", 3)` → texto "3", clase `--count`,
  `aria-description` "3 vídeos nuevos"; 1 → "1 vídeo nuevo"; 150 → "99+"; sin color y 2 → bullet sin
  `--yg-group-color`; sin color y 0 → sin bullet ni `aria-description`; repetir la misma llamada no muta el DOM.
- [x] T5 · Recolector y conexión · Ficheros: `ui/new-videos.js` (nuevo), `ui/cards.js`, `content.js`, `manifest.json`
  (tras `ui/subscriptions.js`), `tests/manifest.test.js`, `tests/ui-new-videos.test.js` (nuevo) · Test (jsdom en
  `/feed/subscriptions` con tarjetas "hace 2 horas" de un canal de A y de uno sin grupo): tras `flushPending()` se
  guarda solo el de A con `publishedBefore` ≈ `seenAt − 7 200 000`; reprocesar la tarjeta no vuelve a escribir;
  `ctx.state.newVideoCounts` tiene A → 1 tras un segundo lote posterior a la visita; seleccionar A lo pone a 0 al
  momento y el siguiente volcado guarda `visits` de A; con A seleccionado, un vídeo nuevo de A no cuenta; en
  `/feed/channels` no se anota nada; tras volcar, `dom.flush()` se estabiliza y `calls.set` no sigue creciendo (sin
  bucle).
- [ ] T6 · Número en la guía · Ficheros: `ui/guide-section.js`, `tests/ui-guide-section.test.js` · Test (jsdom): con
  `youtubeNewVideos` que da 2 vídeos nuevos en A (azul) y 1 en B (sin color), el bullet de A muestra "2" y el de B
  "1" gris; marcar uno de A como visto (cambio de `youtubeWatched`) lo baja a "1" sin sustituir la fila (el mismo
  nodo `.youtube-groups__guide-row` sigue conectado); seleccionar A lo vacía; dentro de A, A1 muestra su propio
  número.
- [ ] T7 · Cerrar · Ficheros: `docs/ARCHITECTURE.md` (filas de `modules/new-videos.js` y `ui/new-videos.js`;
  `modules/storage.js`, `modules/icons.js`, `ui/icons-dom.js`, `ui/cards.js` y `ui/guide-section.js` con lo nuevo;
  flujo nuevo "Vídeos nuevos por grupo"; ADR 0019 en "Decisiones"), `docs/adr/0019-…` (aceptada), `ROADMAP.md`
  (6-5 ✅), este plan a `hecho` · Test: `make lint`, `make test` y V1 a V6.

### Verificación manual (Firefox, extensión recargada; A azul con canales que publican a menudo, B sin color)

- V1 · Primera visita a suscripciones tras instalar: ningún bullet tiene número.
- V2 · Volver al día siguiente (o tras publicar un canal de A): el bullet de A muestra el número de vídeos nuevos de sus
  canales no vistos; el de B, si tiene, en gris; desplazarse hacia abajo por vídeos antiguos no sube los números.
- V3 · Seleccionar A: su número desaparece al momento y no vuelve mientras se mira A; volver a "todos" no lo hace
  reaparecer.
- V4 · Marcar como visto un vídeo nuevo de B: su número baja en todas las pestañas abiertas.
- V5 · Números de dos cifras y "99+" caben en el bullet; el texto se lee bien sobre cada color de la paleta, en tema
  claro y oscuro.
- V6 · Regresión y coste: con la página de suscripciones abierta y quieta, el inspector de almacenamiento no muestra
  escrituras continuas de `youtubeNewVideos`; guía, filtro y avatares sin errores en la consola.

## Criterios de aceptación

- El bullet del botón de cada grupo muestra los vídeos nuevos de sus canales (con subgrupos) observados en
  suscripciones desde la última vez que se seleccionó, sin contar los vistos; sin nuevos no hay número.
- Seleccionar un grupo pone su número a 0 al momento.
- Sin color de grupo y con número, el bullet es gris; sin color ni número, no hay bullet.
- No hay peticiones de red ni escrituras si no cambia nada; la copia de seguridad no cambia.

## Fuera de alcance

- Contador exacto (RSS, API o visitas a canales).
- Reconocer al seleccionar canales sueltos o al abrir un vídeo.
- Números en el editor o en las casillas de "+G".
- Incluir `youtubeNewVideos` en la copia de seguridad.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-18 | T1 | `feat: clave youtubeNewVideos en el almacenamiento` | `KEYS.newVideos`, `readNewVideosValue`, `getNewVideos`, `saveNewVideos` y tests. |
| 2026-11-18 | T2 | `feat: lote, reconocimiento y poda de vídeos nuevos` | `modules/new-videos.js` (`normalizeNewVideos`, `applyFeedBatch`, `acknowledgeGroups`, `saveFeedBatch`), manifiesto, loader de tests y `tests/new-videos.test.js`. |
| 2026-11-18 | T3 | `feat: recuento de vídeos nuevos por grupo` | `countNewVideos` (subárbol, ack por canal, vistos) y tests. |
| 2026-11-18 | T4 | `feat: bullet de grupo con número de vídeos nuevos` | `getContrastTextColor`, `setGroupBullet(el, color, count)` (gris sin color, `99+`, `aria-description`), CSS y tests. |
| 2026-11-18 | T5 | `feat: recolector de vídeos nuevos y conexión en content.js` | `ui/new-videos.js` (`noteVideo`, `acknowledgeSelection`, `flushPending`, `setGroups`, `applyStoredValue`, `recount`, `start`), anotación desde `ui/cards.js`, conexión en `content.js` y manifiesto; `ctx.guide.updateNewVideoBullets` se llama con `?.` hasta T6. |
