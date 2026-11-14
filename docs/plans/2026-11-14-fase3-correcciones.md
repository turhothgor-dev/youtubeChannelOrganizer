# Plan: Fase 3 · Correcciones de la revisión (marcado automático, escrituras perdidas y DOM)

**Estado:** aprobado (2026-11-14)

Issue: revisión de la Fase 3 (planes `docs/plans/2026-11-14-fase3-*.md`, ADR 0002, 0003 y 0004).

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

La revisión de la Fase 3 encontró dos problemas importantes y varias mejoras menores. La persona ha delegado todas
las decisiones; aquí van las elegidas.

### Importante 1 · Marcado automático con ajustes sin cargar

`handleVideoProgress` (`content.js`, ~424) usa `settings`, que vale `DEFAULT_SETTINGS` (`autoMarkPercent: 80`)
hasta que termina `YouTubeGroupsSettings.getSettings()`. Si la persona tiene el marcado desactivado (0) y el vídeo
pasa del 80 % antes de leer los ajustes (o si la lectura falla), se marca igualmente.

Decisión: `handleVideoProgress` sale sin hacer nada mientras `settingsLoaded` sea `false`, antes de cualquier otra
comprobación y sin añadir el ID a `autoMarkHandledIds` (así, al cargar los ajustes, el siguiente `timeupdate` puede
marcar). Si la lectura de ajustes falla, `settingsLoaded` sigue en `false` y no se marca nada automáticamente
(conservador: el marcado manual sigue funcionando). Descartado: esperar a los ajustes con una promesa dentro del
manejador (más estado para el mismo resultado, porque `timeupdate` se repite varias veces por segundo).

### Importante 2 · Escrituras perdidas dentro de la misma pestaña

Todas las operaciones de `modules/` que cambian datos hacen leer-aplicar-escribir con `await` en medio y sin
serializar: `YouTubeGroupsWatched.setVideoWatched`, `update` de `modules/playlists.js` (y con él `createPlaylist`,
`renamePlaylist`, `deletePlaylist`, `setVideoPlaylists`, `removeVideoFromPlaylist`),
`YouTubeGroupsSettings.updateSettings` y, en `modules/groups.js`, `createGroup`, `deleteGroup`, `renameGroup`,
`addChannelToGroup`, `removeChannelFromGroup`, `setChannelGroups`, `createSubGroup`, `deleteSubGroup` y
`setGroupAppearance`. Dos operaciones solapadas sobre la misma clave leen el mismo estado y la segunda escritura
pisa la primera.

Decisión (ADR 0005, `docs/adr/0005-serializar-escrituras-por-clave.md`): cola de promesas FIFO por clave en
`YouTubeGroupsStorage`:

- `YouTubeGroupsStorage.KEYS`: objeto congelado
  `{ groups: "youtubeGroups", watched: "youtubeWatched", settings: "youtubeSettings", playlists: "youtubePlaylists" }`
  (las constantes internas actuales pasan a leerse de aquí).
- `YouTubeGroupsStorage.withLock(key, fn)`: devuelve una promesa con el resultado de `fn()` (síncrona o
  asíncrona). `fn` no empieza hasta que han terminado todas las llamadas anteriores con la misma `key`, en orden de
  llamada. Si `fn` lanza (también de forma síncrona) o rechaza, la promesa devuelta rechaza con ese mismo error y la
  cola sigue con la siguiente. Claves distintas no se esperan entre sí. Cuando la cola de una clave queda vacía se
  borra del `Map` interno. Sin reentrada: una función encolada no llama a otra encolada con la misma clave.
- Uso: en cada operación de la lista anterior, todo lo que va desde la lectura de la clave hasta su escritura se
  envuelve en `withLock(KEYS.<clave>, async () => { ... })`. Las validaciones que no leen el almacenamiento pueden
  quedarse fuera (fallan antes de encolarse). Las firmas y valores de retorno públicos no cambian. Las lecturas
  puras (`getGroups`, `getSettings`, `getPlaylists`, `getWatchedVideos`, `getSubGroups`,
  `getAllGroupsAndSubGroups`, `getGroupsForChannel`) no se encolan. La inicialización a `[]` dentro de `getGroups`
  se queda como está (ver ADR 0005, Consecuencias).
- En `content.js`, el estado en memoria (`watchedVideos`, `settings`) solo se sustituye por el resultado de una
  operación si es más reciente que el último aplicado: un contador por estado (`watchedWriteSeq` y
  `settingsWriteSeq`) que cada operación incrementa al empezar y guarda en una constante; al terminar se aplica el
  resultado solo si su número es mayor que el último aplicado (`watchedAppliedSeq`, `settingsAppliedSeq`), y
  entonces se actualiza ese último. Con la cola FIFO los resultados ya llegan en orden; el contador es una defensa
  explícita barata que no depende de ese detalle.

Alternativas descartadas: cerrojo global, caché en memoria como fuente de verdad, comparar-y-escribir y Web Locks
(ver ADR 0005). No se añade ninguna dependencia.

### Sugerencias incluidas

- (a) `getCardTexts` (~2202) ignora los nodos de la extensión: se salta todo elemento con
  `element.closest('[class*="youtube-groups__"]')`, para que textos como "Marcar visto" o "Lista" no se interpreten
  como metadatos.
- (b) Los escuchadores de `document` (`mousedown`) y `window` (`scroll`) de los tres desplegables singleton
  (`getOrCreateSubscriptionDropdown` ~1612, `getOrCreatePlaylistDropdown` ~1848 y `getOrCreateIconPicker` ~2467) se
  registran una sola vez por desplegable aunque el elemento se recree (YouTube puede sacarlo del DOM). Un booleano
  por desplegable (`...ListenersAdded`); los manejadores ya leen la variable del singleton, así que sirven para el
  elemento recreado.
- (c) El modal de vídeos de una lista lleva además la clase modificadora
  `youtube-groups__channel-list-modal--playlist`, y `closePlaylistModal` (~918) solo busca y quita ese modal; así
  "Quitar" o "Ver" no cierran el modal de "Ver canales". Los estilos no cambian (la clase base se mantiene).
- (d) `getCurrentWatchVideoData` (~351) no lee datos del vídeo anterior durante una navegación SPA: un helper
  `isWatchPageInSync(videoId)` devuelve `false` si existe `ytd-watch-flexy` con `video-id` distinto de `videoId`
  (sin `ytd-watch-flexy` o sin el atributo, `true`, como hoy). `handleVideoProgress` pasa a usar ese helper en lugar
  de su comprobación en línea, y `getCurrentWatchVideoData` devuelve `{ id: null, title: "", channelName: "" }` si
  no está sincronizado; el desplegable ya muestra entonces "No se ha podido identificar el vídeo." y la persona
  puede reintentar un momento después. Descartado: guardar con título y canal vacíos (pierde datos para siempre).

### Sugerencia descartada

- (e) Caché de metadatos parciales: hoy solo se cachean metadatos completos, y una tarjeta incompleta se vuelve a
  recorrer en cada procesado. Cualquier clave barata para saber si la tarjeta "ha cambiado" exige recorrerla igual
  (por ejemplo, `textContent`), y solo ocurre con filtros avanzados activos. No compensa el riesgo de mostrar datos
  viejos; se reconsidera si una medición lo justifica.

ADR nuevo: 0005 (estado `propuesta`; pasa a `aceptada` en T2). `docs/ARCHITECTURE.md` se actualiza en T10.

## Tareas

Reglas comunes: las firmas y valores de retorno públicos de `modules/` no cambian; JSDoc en las funciones nuevas;
los tests usan `loadModules` y `plain`. En los tests de concurrencia, escribe primero el test y comprueba que falla
sin la cola (o anótalo en **Registro** si con el simulador no fallaba). Cada tarea termina con `make test` y
`make lint` en verde y sin avisos.

- [x] T1 · Marcado automático solo con ajustes leídos. En `handleVideoProgress`, salir al principio si
  `!settingsLoaded` (ver **Importante 1**) · Ficheros: `content.js` · Test: `make lint`, `make test` y a mano V1.
- [x] T2 · Cola por clave en el almacenamiento. En `modules/storage.js`, `KEYS` y `withLock(key, fn)` (ver
  **Importante 2**). En `tests/helpers/load-modules.js`, segundo parámetro opcional
  `loadModules(initialStore = {}, { latencyMs = 0 } = {})`: con `latencyMs > 0`, `get` y `set` del simulador esperan
  ese tiempo (`setTimeout`) antes de leer o escribir el `store`, para que las operaciones se solapen de verdad; sin
  él, el comportamiento actual no cambia. Estado del ADR 0005 a `aceptada` · Ficheros: `modules/storage.js`,
  `tests/helpers/load-modules.js`, `tests/storage.test.js`, `docs/adr/0005-serializar-escrituras-por-clave.md` ·
  Test (`tests/storage.test.js`): `KEYS` tiene las cuatro claves con sus nombres reales; dos `withLock` con la misma
  clave, la primera bloqueada en una promesa que el test resuelve a mano, ejecutan en orden (la segunda no empieza
  hasta que termina la primera); con claves distintas, la segunda termina aunque la primera siga bloqueada;
  devuelve el valor de `fn`; si `fn` rechaza o lanza de forma síncrona, `withLock` rechaza con ese error y la
  siguiente llamada con la misma clave se ejecuta y resuelve.
- [x] T3 · Serializar vistos, ajustes y listas. `setVideoWatched` (`modules/watched.js`), `updateSettings`
  (`modules/settings.js`) y `update` (`modules/playlists.js`) hacen lectura, cálculo y escritura dentro de
  `withLock` de su clave · Ficheros: `modules/watched.js`, `modules/settings.js`, `modules/playlists.js`,
  `tests/watched.test.js`, `tests/settings.test.js`, `tests/playlists.test.js` · Test (con
  `loadModules({}, { latencyMs: 5 })` y `Promise.all`): marcar dos vídeos distintos a la vez deja los dos en
  `store.youtubeWatched.videos`; `updateSettings({ watchedMode: "hide" })` y `updateSettings({ outsideMode: "dim" })`
  a la vez dejan los dos valores guardados; dos `createPlaylist` a la vez dejan dos listas; `setVideoPlaylists` de
  dos vídeos distintos en la misma lista a la vez deja los dos vídeos; una operación que falla por validación
  (`renamePlaylist` de una lista inexistente) a la vez que un `createPlaylist` no impide que la lista se cree. Los
  tests existentes siguen pasando sin cambios.
- [x] T4 · Serializar los grupos. En `modules/groups.js`, `createGroup`, `deleteGroup`, `renameGroup`,
  `addChannelToGroup`, `removeChannelFromGroup`, `setChannelGroups`, `createSubGroup`, `deleteSubGroup` y
  `setGroupAppearance` hacen lectura, cálculo y escritura dentro de `withLock(KEYS.groups, ...)` · Ficheros:
  `modules/groups.js`, `tests/groups.test.js` · Test (con `latencyMs: 5` y `Promise.all`): dos `createGroup` a la
  vez dejan dos grupos; `setChannelGroups` de dos canales distintos al mismo grupo a la vez dejan los dos canales;
  `createSubGroup` y `setGroupAppearance` sobre el mismo grupo a la vez conservan el subgrupo y la apariencia;
  `renameGroup` de un id inexistente a la vez que `createGroup` rechaza y el grupo nuevo se guarda. Los tests
  existentes siguen pasando sin cambios.
- [ ] T5 · Estado en memoria sin resultados viejos. En `content.js`, contadores `watchedWriteSeq`/`watchedAppliedSeq`
  en `toggleVideoWatched` y `markVideoWatched`, y `settingsWriteSeq`/`settingsAppliedSeq` en `changeSetting` (ver
  **Importante 2**); en `changeSetting`, si el resultado no se aplica por viejo, tampoco se reaplica la visibilidad
  con él · Ficheros: `content.js` · Test: `make lint`, `make test` y a mano V2 y V3.
- [ ] T6 · Metadatos sin textos de la extensión. `getCardTexts` salta los elementos dentro de
  `[class*="youtube-groups__"]` (sugerencia a) · Ficheros: `content.js` · Test: `make lint`, `make test` y a mano V4.
- [ ] T7 · Escuchadores de los desplegables una sola vez. Un booleano por desplegable en
  `getOrCreateSubscriptionDropdown`, `getOrCreatePlaylistDropdown` y `getOrCreateIconPicker` (sugerencia b) ·
  Ficheros: `content.js` · Test: `make lint`, `make test` y a mano V5.
- [ ] T8 · Cerrar solo el modal de listas. Clase `youtube-groups__channel-list-modal--playlist` en el modal de
  `openPlaylistVideosModal` y `closePlaylistModal` busca solo esa clase (sugerencia c) · Ficheros: `content.js` ·
  Test: `make lint`, `make test` y a mano V6.
- [ ] T9 · Datos del vídeo actual sincronizados. Helper `isWatchPageInSync(videoId)`, usado por
  `handleVideoProgress` y `getCurrentWatchVideoData` (sugerencia d) · Ficheros: `content.js` · Test: `make lint`,
  `make test` y a mano V7 y repetir V1.
- [ ] T10 · Cerrar el plan. En `docs/ARCHITECTURE.md`: la fila de `modules/storage.js` menciona `withLock` y
  `KEYS` (ADR 0005); los flujos "Añadir un canal a grupos", "Marcar como visto" y "Listas" dicen que la operación
  se encola por clave; "Marcado automático" dice que solo actúa con los ajustes leídos. Estado de este plan a
  `hecho` · Ficheros: `docs/ARCHITECTURE.md`, este plan · Test: `make lint` y `make test`.

### Verificación manual (con `make up`)

- V1 · Con "Marcar automáticamente" en "Desactivado", recargar un `/watch` y saltar al 90 % del vídeo enseguida:
  no se marca. Con 80 %, al pasar del 80 % se marca una sola vez.
- V2 · En `/feed/subscriptions`, pulsar "Marcar visto" en dos tarjetas distintas muy seguido: tras recargar, las
  dos siguen vistas. En `/watch`, pulsar "Marcar visto" de otra tarjeta mientras el vídeo cruza el umbral: tras
  recargar, los dos están vistos.
- V3 · Cambiar seguido "Vídeos vistos" y "Vídeos fuera del filtro": tras recargar, se conservan los dos.
- V4 · Con el filtro "Duración" activo, una tarjeta sin duración pintada no se clasifica por textos de los botones
  de la extensión (en la consola, `getCardTexts` de una tarjeta no incluye "Marcar visto", "Lista" ni "Añadir a
  grupo").
- V5 · Abrir y cerrar varias veces los desplegables de grupos, listas e iconos tras navegar por la SPA: se cierran
  al hacer clic fuera y al hacer scroll como antes; en las herramientas de desarrollo, el número de escuchadores de
  `mousedown` en `document` no crece con cada recreación.
- V6 · Abrir "Ver canales" de un grupo y, sin cerrarlo, "Ver" de una lista y luego "Quitar" un vídeo: el modal de
  la lista se repinta y el de canales solo se cierra con su botón (o al abrir otro modal, como hoy).
- V7 · En `/watch`, pulsar un vídeo recomendado y, en cuanto cambia la URL, "Guardar en lista": se guarda con el
  título y canal del vídeo nuevo, o muestra "No se ha podido identificar el vídeo." y al reintentar se guarda bien.

## Criterios de aceptación

- Con el marcado automático desactivado, ningún vídeo se marca solo, tampoco justo después de cargar la página ni
  si fallan los ajustes.
- Dentro de una pestaña, operaciones solapadas sobre grupos, vistos, ajustes o listas conservan todos los cambios.
- La UI (botones de visto, selectores de ajustes) refleja siempre el resultado más reciente.
- Los filtros avanzados no leen textos añadidos por la extensión.
- Recrear un desplegable no añade escuchadores globales nuevos.
- Cerrar o repintar el modal de una lista no cierra el modal de canales.
- "Guardar en lista" en `/watch` nunca guarda título o canal de un vídeo anterior.
- Formatos guardados (ADR 0001 a 0004) y firmas públicas de `modules/` sin cambios; sin dependencias nuevas.
- `make lint` (0 avisos) y `make test` pasan.

## Fuera de alcance

- Escrituras simultáneas desde varias pestañas (sigue ganando la última; Fase 4).
- Caché de metadatos parciales (sugerencia e, ver **Sugerencia descartada**).
- Reescribir las operaciones de `modules/groups.js` en funciones puras `apply*` o eliminar las funciones sin uso
  (`addChannelToGroup`, `removeChannelFromGroup`, `getGroupsForChannel`...).
- Cambiar la inicialización de `getGroups` o el modal de "Ver canales" (salvo no ser cerrado por el de listas).
- Tests de DOM de `content.js` (no hay entorno DOM en `make test`).

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-14 | T1 | fix: no marcar automáticamente hasta leer los ajustes | `handleVideoProgress` sale si `!settingsLoaded`. Pendiente V1 a mano. |
| 2026-11-14 | T2 | feat: cola de escrituras por clave en el almacenamiento | `KEYS` y `withLock` en `modules/storage.js`, `latencyMs` en el simulador y ADR 0005 aceptada. |
| 2026-11-14 | T3 | fix: serializar las escrituras de vistos, ajustes y listas | `setVideoWatched`, `updateSettings` y `update` de listas dentro de `withLock`. Con `latencyMs: 5` los 3 tests de solapamiento fallaban sin la cola; el de validación + `createPlaylist` pasa también sin ella (operaciones independientes). |
| 2026-11-14 | T4 | fix: serializar las escrituras de grupos | Las 10 operaciones de `modules/groups.js` dentro de `withLock(KEYS.groups)` mediante el helper `withGroupsLock`. Con `latencyMs: 5` fallaban sin la cola los tests de `setChannelGroups` y de `createSubGroup` + `setGroupAppearance`; los de dos `createGroup` y `renameGroup` inexistente + `createGroup` pasan también sin ella (el simulador devuelve la misma referencia del array y las operaciones no compiten). |
