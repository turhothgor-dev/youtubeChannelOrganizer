# Plan: Fase 6-4 · Suscripciones sin grupo en el editor (bandeja "Sin clasificar")

**Estado:** aprobado (2026-11-18)

Issue: punto 7 de la persona tras probar gui-8 (2026-11-18) y ROADMAP 6-4. Índice:
[2026-11-18-gui-9-y-fase6-4-6-5](2026-11-18-gui-9-y-fase6-4-6-5.md). ADR:
[0018](../adr/0018-suscripciones-conocidas-en-clave-aparte.md) (propuesta; modifica el 0016).

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

El editor (`options/`) solo conoce los canales que ya están en grupos; una suscripción nueva nunca entra en ninguno si
la persona no se acuerda. Se añade al editor una sección con las suscripciones que no están en ningún grupo y una
acción para añadirlas en bloque a un grupo, reutilizando el patrón de "Copiar a…/Mover a…" del panel "Canales".

Decisión (detalle en el ADR 0018):

- **Datos**: clave nueva `youtubeSubscriptions` = `{ version: 1, channels: { <getChannelKey>: { name, url, firstSeen }
  } }`, fuera de la copia de seguridad.
- **Lectura** (content script, sin red), en un componente nuevo `ui/subscriptions.js`
  (`YouTubeGroupsSubscriptionsUi.create(ctx)`, `ctx.subscriptions`, creado tras `ctx.avatars` y antes de `ctx.cards`):
  - **Guía**: la sección de `ytd-guide-renderer #sections > ytd-guide-section-renderer` que contiene un enlace con
    ruta exactamente `/feed/channels` (función pura `findSubscriptionSectionIndex(hrefsPorSección)`, como
    `findGuideInsertionIndex`). De sus `ytd-guide-entry-renderer` con enlace de canal (`ctx.cards.getChannelResultUrl`)
    se toma URL y nombre (atributo `title` del enlace o, si falta, texto de `.title`). Solo altas. Se lee al arrancar,
    en `yt-navigate-finish` y, como mucho una vez por frame, con mutaciones dentro de `ytd-guide-renderer` **que no
    sean de `#youtube-groups-guide`** (nuestra sección se repinta a menudo).
  - **`/feed/channels`**: `getPageType` devuelve el tipo nuevo `"channels"`. En `ui/cards.js`, la rama de
    `ytd-channel-renderer` de `processPendingCards` llama a `ctx.subscriptions?.noteChannelCard(card, url)` (con
    `try/catch` como `noteCardAvatar`); el nombre sale de `ytd-channel-name #text` o `#channel-title`. Cada visita (se
    reinicia en `yt-navigate-finish`) guarda en memoria las claves vistas.
  - **Reconciliación**: con la página `"channels"`, en la página activa (constante `CHANNELS_PAGE_ROOT_SELECTOR =
    "ytd-browse:not([hidden])"`) se comprueba, como mucho una vez por frame, `isChannelListComplete({ channelCount,
    notedCount, hasContinuation })` = hay al menos un `ytd-channel-renderer`, ninguno sin anotar
    (`notedCount >= channelCount`) y ningún `ytd-continuation-item-renderer`. Si lo está, a los 3 s sin canales nuevos
    (y todavía en la misma visita y completa) se vuelca con `reconcileKeys` = claves vistas en la visita. Una vez por
    visita. Las constantes de selectores van juntas al principio de `ui/subscriptions.js`.
  - **Escritura**: pendientes en memoria y un volcado como mucho cada 2 s (`flushPending`, patrón de `ui/avatars.js`);
    `saveObservedSubscriptions(observed, { reconcileKeys })` en `withLock(KEYS.subscriptions)` lee, fusiona
    (`mergeSubscriptions`) y escribe solo si algo cambia. En memoria se recuerda lo ya anotado para no volver a
    encolar lo mismo.
- **Lógica pura** (`modules/subscriptions.js`, `YouTubeGroupsSubscriptions`, sin DOM, tras `avatars.js` en el
  manifiesto, en `options.html` y en `tests/helpers/load-modules.js`): `normalizeSubscriptions(value)` (descarta
  entradas no válidas: clave que no es `getChannelKey` de su `url`, `url` sin `normalizeChannelUrl`, nombre vacío o
  `firstSeen` no numérico), `mergeSubscriptions(stored, observed, { now, reconcileKeys })` → `{ channels, changed }`
  (altas con `firstSeen = now`, cambio de nombre, bajas de lo no visto si hay `reconcileKeys`; no muta la entrada),
  `getUnclassifiedSubscriptions(channels, groups)` → array `{ key, name, url, firstSeen }` de las que no están en
  ningún grupo ni subgrupo, ordenado por `firstSeen` descendente y, a igualdad, por nombre (`localeCompare`),
  `findSubscriptionSectionIndex`, `isChannelListComplete` y `saveObservedSubscriptions`.
- **Avatares** (modifica el ADR 0016): `mergeAvatars(stored, observed, groups, subscriptions = {})` y
  `saveObservedAvatars` conservan los avatares de canales agrupados **o** suscritos conocidos (función nueva
  `getKeptChannelKeys(groups, subscriptions)`); `ctx.avatars.setGroupedChannels(groups, subscriptions = {})` igual.
  `renderGroupsPanel` lee también `getSubscriptions()`; `handleStorageChange` con `"subscriptions"` llama a
  `renderGroupsPanel` (cambios raros).
- **Añadir a un grupo** (`modules/group-editor.js`): `addChannels(groups, toId, channels)` → `{ groups, added, skipped
  }` (sin mutar; canales `{ name, url }` con `url` normalizada; `skipped` = ya estaban por `getChannelKey`; error "No
  existe el grupo indicado." si falta) y `addChannelsAndSave(toId, channels)` en `withLock(KEYS.groups)`, que solo
  escribe si `added > 0`.
- **Editor**: componente nuevo `options/unclassified.js` (`YouTubeGroupsUnclassified.create(container)` → `{ render({
  groups, subscriptions, avatars, query }) }`, sin `innerHTML` con datos), cargado en `options.html` justo antes de
  `options.js`, que pinta en una sección nueva `<section id="options-unclassified" class="options__unclassified"
  aria-labelledby="options-unclassified-title">` bajo `.options__layout`:
  - Título `<h2 id="options-unclassified-title">` "Suscripciones sin grupo (N)".
  - Sin suscripciones conocidas: "Aún no se conoce ninguna suscripción. Abre YouTube con la guía desplegada o visita
    «Todas las suscripciones» (youtube.com/feed/channels) y baja hasta el final para leerlas todas."; todas
    clasificadas: "Todas las suscripciones conocidas están en algún grupo."; búsqueda sin resultados: "Ninguna
    suscripción sin grupo coincide con la búsqueda.".
  - Barra: "Seleccionar todo" (casilla con estado indeterminado) y "Añadir a… (k)" (deshabilitado sin selección). Al
    pulsarlo aparece un selector (`aria-label` "Añadir a"; opción vacía "Elige un grupo"; `flattenGroups` con sangría
    por nivel), "Añadir" (deshabilitado sin destino) y "Cancelar"; Escape en el selector cancela.
  - Una fila por suscripción: casilla (`aria-label` "Seleccionar <nombre>", `data-url`), avatar
    (`createChannelAvatar`, `AVATAR_SIZES.editor`), enlace al canal (nueva pestaña, `noopener noreferrer`) y URL.
  - Tras añadir: aviso en la propia sección ("3 añadidos a «A»", "1 añadido a «A»", con "; 1 ya estaba" si procede) o
    error en un `<p role="alert">` propio; mientras escribe, las acciones se deshabilitan. La selección se conserva
    entre repintados (por URL) y pierde las que salen de la lista.
  - Búsqueda: `options.js` le pasa el texto del buscador; filtra por nombre o URL con
    `YouTubeGroupsEditor.normalizeSearchText` (contiene).
  - `options.js` lee `getSubscriptions()` en `render()` y repinta la sección al cambiar `groups`, `subscriptions`,
    `avatars` o la búsqueda (`storage.onChanged`).

Alternativas descartadas: ver ADR 0018 (guardar en `youtubeGroups`, red, botón "Suscrito", caducar por tiempo). Meter
la bandeja dentro de `options/options.js` (ya tiene unas 1460 líneas) en lugar de un componente aparte.

## Tareas

- [x] T1 · Clave `youtubeSubscriptions` en el almacenamiento · Ficheros: `modules/storage.js`,
  `tests/storage.test.js` · Test: `KEYS.subscriptions === "youtubeSubscriptions"`; `readSubscriptionsValue` devuelve
  `{}` con `undefined`, `null`, array o `channels` no objeto y el mapa si es válido; `getSubscriptions` sin datos
  devuelve `{}` y no escribe; `saveSubscriptions` guarda `{ version: 1, channels }` y rechaza lo que no es objeto;
  `getChangedKeys` incluye `"subscriptions"`.
- [x] T2 · Lógica pura de suscripciones · Ficheros: `modules/subscriptions.js` (nuevo), `manifest.json`,
  `options/options.html`, `tests/helpers/load-modules.js`, `tests/subscriptions.test.js` (nuevo),
  `tests/manifest.test.js` si hace falta · Test: `normalizeSubscriptions` descarta cada tipo de entrada no válida;
  `mergeSubscriptions` añade con `firstSeen = now`, actualiza el nombre sin tocar `firstSeen`, no cambia nada con lo
  mismo (`changed: false`), con `reconcileKeys` borra lo no visto y conserva lo visto, no muta la entrada;
  `getUnclassifiedSubscriptions` excluye canales de grupos y de subgrupos (también con `/@Foo` frente a `/@foo`) y
  ordena por `firstSeen` y nombre; `findSubscriptionSectionIndex` encuentra la sección con `/feed/channels` (también
  como URL absoluta) y da `-1` sin ella; `isChannelListComplete` según los tres datos; `saveObservedSubscriptions`
  escribe una vez y no escribe si no cambia nada (contador `calls.set`).
- [x] T3 · Tipo de página `"channels"` · Ficheros: `modules/pages.js`, `tests/pages.test.js` · Test:
  `getPageType("/feed/channels") === "channels"`; `/feed/subscriptions` sigue siendo `"subscriptions"` y
  `/feed/history` `"other"`; `shouldShowCardControls("channels")` y `shouldPinGuide("channels", 1200, false)` son
  `false`.
- [x] T4 · Recolector: suscripciones de la guía · Ficheros: `ui/subscriptions.js` (nuevo), `manifest.json` (tras
  `ui/avatars.js`), `content.js`, `tests/manifest.test.js`, `tests/ui-subscriptions.test.js` (nuevo) · Test (jsdom,
  guía con una sección "Tú" con un enlace a un canal propio y una sección con `/feed/channels` y dos entradas de canal):
  tras arrancar y `flushPending()`, `youtubeSubscriptions` tiene solo los dos canales de la sección de suscripciones,
  con nombre; sin sección con `/feed/channels` no se escribe; una mutación dentro de `#youtube-groups-guide` no
  programa lectura de la guía y una dentro de otra sección sí; volver a leer lo mismo no escribe.
- [x] T5 · Recolector: `/feed/channels` y reconciliación · Ficheros: `ui/subscriptions.js`, `ui/cards.js`,
  `content.js`, `tests/ui-subscriptions.test.js` · Test (jsdom en `https://www.youtube.com/feed/channels`; el test
  sustituye `window.setTimeout` y `window.clearTimeout` por un reloj falso antes de provocar la comprobación, porque
  `loadDom` usa los temporizadores reales de jsdom): con dos `ytd-channel-renderer` y un `ytd-continuation-item-renderer` se anotan y guardan
  los dos y no se borra nada; guardado previo con un tercer canal: al quitar la continuación, a los 3 s se borra el
  tercero; si antes de 3 s aparece otro canal, el plazo vuelve a empezar; con un renderer sin URL no se reconcilia; en
  otra página (`/feed/subscriptions`) no se reconcilia nunca; reconciliar dos veces en la misma visita no vuelve a
  escribir.
- [x] T6 · Avatares de suscripciones conocidas · Ficheros: `modules/avatars.js`, `ui/avatars.js`, `content.js`,
  `tests/avatars.test.js`, `tests/ui-avatars.test.js` · Test: `mergeAvatars` conserva y añade avatares de canales solo
  suscritos y sigue podando los que no están ni en grupos ni en suscripciones; sin cuarto argumento se comporta como
  antes (los tests actuales pasan sin cambiar lo que comprueban); `saveObservedAvatars` lee las suscripciones;
  `setGroupedChannels(groups, subscriptions)` encola el avatar visto de un canal solo suscrito.
- [ ] T7 · Añadir canales a un grupo · Ficheros: `modules/group-editor.js`, `tests/group-editor.test.js` · Test:
  `addChannels` añade al final, cuenta `added` y `skipped` (ya estaba con otra mayúscula), no muta la entrada, añade
  a un subgrupo y lanza con un id inexistente; `addChannelsAndSave` escribe una vez y no escribe si todos ya estaban.
- [ ] T8 · Bandeja en el editor: lista · Ficheros: `options/unclassified.js` (nuevo), `options/options.html`,
  `options/options.css`, `options/options.js`, `tests/ui-options.test.js` · Test (jsdom, `loadOptionsDom`): con tres
  suscripciones, una de ellas en un subgrupo, la sección `#options-unclassified` titula "Suscripciones sin grupo (2)"
  y lista las otras dos en orden de `firstSeen` descendente, con avatar (inicial) y enlace `target="_blank"`; sin
  suscripciones y con todas clasificadas muestra su texto; escribir en el buscador filtra la lista y sin coincidencias
  muestra su texto; un `storage.onChanged` de `youtubeSubscriptions` con una suscripción nueva la añade sin recargar.
- [ ] T9 · Bandeja en el editor: selección y "Añadir a…" · Ficheros: `options/unclassified.js`, `options/options.css`,
  `tests/ui-options.test.js` · Test (jsdom): "Añadir a… (0)" deshabilitado; marcar dos casillas → "Añadir a… (2)";
  "Seleccionar todo" marca todas y queda indeterminado con una desmarcada; elegir el subgrupo A1 y "Añadir" guarda
  los dos en A1 (una escritura de `youtubeGroups`), muestra "2 añadidos a «A1»" y la lista queda vacía con "Todas las
  suscripciones conocidas están en algún grupo."; Escape en el selector lo cierra sin escribir.
- [ ] T10 · Cerrar · Ficheros: `docs/ARCHITECTURE.md` (filas de `modules/subscriptions.js`, `ui/subscriptions.js` y
  `options/unclassified.js`; `modules/storage.js` con `KEYS.subscriptions`; `modules/pages.js` con `"channels"`;
  `modules/avatars.js` y `modules/group-editor.js` con lo nuevo; flujos "Avatares de canal" y "Editor de grupos" y
  flujo nuevo "Suscripciones conocidas"; ADR 0018 en "Decisiones"), `docs/adr/0018-…` (aceptada),
  `docs/adr/0016-…` (cabecera "Modificado por: 0018 (también se conservan los avatares de suscripciones)"),
  `ROADMAP.md` (6-4 ✅), este plan a `hecho` · Test: `make lint`, `make test` y V1 a V7.

### Verificación manual (Firefox, extensión recargada, sesión iniciada en YouTube con varias suscripciones)

- V1 · Con la guía desplegada en cualquier página, en `about:debugging` → Inspeccionar → Almacenamiento,
  `youtubeSubscriptions` tiene los canales de la sección "Suscripciones" y ninguno de "Tú" (ni el canal propio). Si
  la sección no se detecta por `/feed/channels`, anotarlo y parar (Cambios aprobados).
- V2 · En `/feed/channels`, al bajar hasta el final, aparecen todas las suscripciones; con una suscripción cancelada
  fuera de la extensión, a los pocos segundos de cargar la lista completa desaparece de la clave. Mientras queda lista
  por cargar no desaparece nada.
- V3 · En el editor, "Suscripciones sin grupo (N)" lista las suscripciones que no están en ningún grupo, las más
  recientes primero, con su imagen cuando YouTube la haya mostrado.
- V4 · Seleccionar varias y "Añadir a…" un subgrupo: salen de la bandeja, aparecen en el panel "Canales" del subgrupo y
  en la guía de YouTube sin recargar.
- V5 · El buscador del editor filtra también la bandeja.
- V6 · Exportar copia: el fichero no contiene `subscriptions`; importar una copia antigua funciona igual.
- V7 · Regresión: avatares, guía, filtro y editor sin errores en la consola; navegar por YouTube no hace escrituras
  continuas de `youtubeSubscriptions` (comprobar en el inspector de almacenamiento que solo cambia al haber altas,
  nombres o bajas).

## Criterios de aceptación

- El editor muestra las suscripciones conocidas que no están en ningún grupo y permite añadir varias a la vez a un
  grupo o subgrupo; tras añadirlas salen de la lista.
- Las suscripciones se leen sin red de la guía y de `/feed/channels`; solo `/feed/channels` con la lista completa da de
  baja las que ya no están.
- Sin suscripciones conocidas, el editor explica cómo leerlas.
- La copia de seguridad no cambia de formato.
- No hay escrituras de almacenamiento si no cambia nada.

## Fuera de alcance

- Marca de "nueva" en la bandeja, ignorar canales o reglas de autoasignación (6-10).
- Leer el botón "Suscrito" de la página de canal.
- Mostrar en la guía de YouTube las suscripciones sin grupo (filtro "Sin grupo", 6-3).
- Paginación o lista virtual de la bandeja.
- Incluir las suscripciones en la copia de seguridad.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-18 | T1 | feat: clave youtubeSubscriptions en el almacenamiento | `KEYS.subscriptions`, `readSubscriptionsValue`, `getSubscriptions`, `saveSubscriptions`; test de KEYS actualizado a seis claves. |
| 2026-11-18 | T2 | feat: lógica pura de suscripciones conocidas | `modules/subscriptions.js` (normalize, merge, getUnclassified, findSubscriptionSectionIndex, isChannelListComplete, saveObserved), registrado en manifiesto, `options.html` y `load-modules.js`; tests nuevos. |
| 2026-11-18 | T3 | feat: tipo de página "channels" para /feed/channels | `getPageType("/feed/channels")` devuelve `"channels"`; sin controles de tarjeta ni guía fija; tests actualizados. |
| 2026-11-18 | T4 | feat: recolector de suscripciones de la guía | `ui/subscriptions.js` (`readGuide`, `scheduleGuideRead`, `noteMutations`, `flushPending`), creado en `content.js` tras avatares, registrado en el manifiesto; lectura al arrancar, en `yt-navigate-finish` y con mutaciones de la guía ajenas a `#youtube-groups-guide`. |
| 2026-11-18 | T5 | feat: recolector de /feed/channels con reconciliación | `noteChannelCard` (solo en página `channels`), `startVisit`, `checkChannelsList` (espera 3 s sin canales nuevos, una vez por visita); enganchado en `ui/cards.js` y `content.js`; 6 tests con reloj falso. |
| 2026-11-18 | T6 | feat: avatares de suscripciones conocidas | `getKeptChannelKeys`; `mergeAvatars`/`saveObservedAvatars` y `setGroupedChannels` aceptan suscripciones; `renderGroupsPanel` las lee; tests nuevos. |
