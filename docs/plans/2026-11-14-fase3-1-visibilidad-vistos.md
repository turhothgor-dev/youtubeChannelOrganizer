# Plan: Fase 3 (1/4) · Modos de visibilidad y ocultar vídeos vistos

**Estado:** aprobado (2026-11-14)

Issue: `ROADMAP.md`, Fase 3: "Modos de visibilidad" y "Ocultar videos vistos".

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

La Fase 3 se divide en cuatro planes, que se implementan en este orden (cada uno depende del anterior salvo el 4,
que solo necesita el 1):

1. **Este plan**: correcciones pendientes del botón de visto, ajustes guardados y modos de visibilidad (incluye
   "Ocultar videos vistos").
2. `2026-11-14-fase3-2-marcado-automatico.md`: "Marcar videos vistos" (automático al reproducir en `/watch`).
3. `2026-11-14-fase3-3-filtros-avanzados.md`: "Filtros avanzados (duración, fecha, popularidad)".
4. `2026-11-14-fase3-4-listas.md`: "Gestor de playlists" (listas locales, sin API).

### Situación actual (código en 0abace4)

- El filtro de grupo oculta las tarjetas con la clase `youtube-groups--filtered-out` **y** `style.display = "none"`
  (`setCardVisibility` en `content.js`); los vistos se atenúan con la clase `youtube-groups--watched` (CSS, opacidad
  0.55). Son dos mecanismos independientes y no hay forma de elegir otro comportamiento.
- Revisión anterior de `content.js`, tres sugerencias pendientes: si falla la lectura inicial de vistos
  (`watchedVideos` queda `null`), los botones parecen activos pero no hacen nada; el botón no se deshabilita
  mientras guarda (doble clic = doble cambio); tras alternar, la tarjeta pulsada solo se actualiza si ya tenía
  `data-youtube-groups-video-id` igual al ID (puede no tenerlo si YouTube la reutilizó y aún no se reprocesó).

### Decisiones (delegadas por la persona)

- **"Modos de visibilidad"** = dos ajustes guardados que deciden cómo se ve una tarjeta:
  - **Vídeos vistos** (`watchedMode`): Mostrar, Atenuar (por defecto, como ahora) u Ocultar. "Ocultar videos
    vistos" del roadmap es el valor Ocultar.
  - **Vídeos fuera del filtro** (`outsideMode`): Ocultar (por defecto, como ahora) o Atenuar. Se aplica a las
    tarjetas que no pasan el filtro activo (grupo; en el plan 3, también filtros avanzados).
- **Almacenamiento:** ADR 0003 (`docs/adr/0003-formato-almacenamiento-ajustes.md`), clave `youtubeSettings`
  `{ version: 1, settings: { watchedMode, outsideMode } }`. En `modules/storage.js`: `getSettings()` devuelve el
  objeto `settings` guardado tal cual si es un objeto plano y `{}` en otro caso, sin escribir;
  `saveSettings(settings)` lanza `TypeError` si no es un objeto plano y guarda `{ version: 1, settings }`.
- **Módulo nuevo `modules/settings.js`** (`YouTubeGroupsSettings`, sin DOM):
  - `DEFAULT_SETTINGS` congelado: `{ watchedMode: "dim", outsideMode: "hide" }`.
  - `WATCHED_MODES = ["show", "dim", "hide"]`, `OUTSIDE_MODES = ["hide", "dim"]`.
  - `normalizeSettings(raw)`: objeto nuevo con solo los campos conocidos; cada uno vale lo guardado si es válido o
    el valor por defecto si falta o no lo es; `raw` no objeto (`null`, array, número) = valores por defecto.
  - `getSettings()`: lee de `YouTubeGroupsStorage.getSettings()` y normaliza.
  - `updateSettings(patch)`: si `patch` tiene una clave desconocida o un valor no válido lanza
    `Error("Ajuste inválido: <clave>.")` sin leer ni escribir; si no, lee, normaliza, aplica `patch` y escribe una
    vez solo si algo cambia. Devuelve `{ settings, changed }`.
- **Módulo nuevo `modules/visibility.js`** (`YouTubeGroupsVisibility`, sin DOM), con una función pura
  `getCardVisibility({ matchesFilter, isWatched }, settings)` que devuelve `"visible"`, `"dimmed"` o `"hidden"`.
  Reglas, en este orden: fuera del filtro y `outsideMode: "hide"` → `hidden`; visto y `watchedMode: "hide"` →
  `hidden`; fuera del filtro (`outsideMode: "dim"`) → `dimmed`; visto y `watchedMode: "dim"` → `dimmed`; si no,
  `visible`. Ocultar gana a atenuar.
- **Un único punto que pinta la visibilidad** en `content.js`: `applyCardVisibility(card)` calcula
  `matchesFilter` (la lógica actual de `applyFilterToCard`: sin grupo activo, sin canal o sin URLs del grupo
  todavía → pasa) e `isWatched` (la tarjeta tiene `youtube-groups--watched`), llama a `getCardVisibility` con la
  caché `settings` y alterna dos clases: `youtube-groups--hidden` (`display: none !important`) y
  `youtube-groups--dimmed` (opacidad 0.55, 1 al pasar el ratón). Sustituye a `setCardVisibility`; la clase
  `youtube-groups--filtered-out` y el `style.display` en línea desaparecen (la clase con `!important` ya bastaba).
  `youtube-groups--watched` queda como marca semántica sin estilo propio. `applyWatchedToCard` y el filtro llaman
  a `applyCardVisibility`; como `applyWatchedToCard` se ejecuta en cada procesado de la tarjeta, la visibilidad se
  reevalúa siempre que YouTube la cambia.
- **Caché `settings`** en `content.js`: empieza en `YouTubeGroupsSettings.DEFAULT_SETTINGS` (mismo comportamiento
  que hoy mientras carga), se sustituye al leer al arrancar y tras cada `updateSettings`; después se reaplica la
  visibilidad a todas las tarjetas de `VIDEO_CARD_SELECTOR`. Si falla la lectura, se queda con los valores por
  defecto y se registra con `console.error`.
- **Interfaz:** sección plegable estática `<details class="youtube-groups__settings">` con `<summary>Ajustes</summary>`
  en la plantilla del panel (sin interpolaciones), con dos `<select>`: "Vídeos vistos" (Mostrar / Atenuar /
  Ocultar) y "Vídeos fuera del filtro" (Ocultar / Atenuar), y un `<p aria-live="polite">` de error. Los `<select>`
  están deshabilitados hasta cargar los ajustes. Al cambiar uno: se deshabilita, llama a `updateSettings`, y si
  falla vuelve al valor anterior y muestra el mensaje. El panel pasa a tener `max-height: calc(100vh - 32px)` y
  `overflow-y: auto`, porque esta y las secciones de los planes 3 y 4 lo alargan.
- **Correcciones de la revisión** (T1):
  1. `let watchedLoadError = null;` Si falla `getWatchedVideos()` al arrancar, guarda el mensaje y reaplica
     `applyWatchedToCard` a todas las tarjetas y `renderCurrentVideoSection()`. `updateWatchedButton` deshabilita
     el botón si no hay ID, si `watchedVideos === null` (cargando o error) o si ese ID se está guardando, y con
     `watchedLoadError` pone `title = "No se pudieron leer los vistos: <mensaje>"`.
  2. `const savingWatchedIds = new Set();` `toggleVideoWatched` sale si el ID ya se está guardando; si no, lo
     añade, actualiza los botones de ese ID (deshabilitados) y en `finally` lo quita y vuelve a actualizarlos.
  3. `toggleVideoWatched(videoId, button, card = null)`: el botón de la tarjeta pasa su tarjeta. Tras guardar (y
     en el `finally`), una función `refreshWatchedUi(videoId, card)` aplica `applyWatchedToCard` a la tarjeta
     pulsada, si la hay, y a las demás con ese ID (sin repetir la pulsada), y llama a
     `renderCurrentVideoSection()`. El plan 2 reutiliza `refreshWatchedUi` y `savingWatchedIds`.

Alternativas descartadas:

- Un único ajuste "ocultar vistos sí/no": no cubre atenuar el filtro ni mostrar los vistos sin marca, y el
  roadmap pide "modos".
- Modo por página (inicio, suscripciones, `/watch`) o por grupo: más interfaz y formato sin un caso que lo pida.
- Mantener `style.display` en línea junto a la clase: dos fuentes de verdad; al atenuar habría que limpiarlo.
- Contador de "N vídeos ocultos" con botón para mostrarlos: útil pero no necesario para cerrar el punto; se puede
  añadir después.
- Popup u opciones de la extensión para los ajustes: el panel ya existe y está donde se usa.
- `jsdom` para probar `content.js`: dependencia nueva. Sin dependencias nuevas; la parte de DOM se verifica a mano.

ADR nuevo: 0003 (estado `propuesta`; pasa a `aceptada` en T2). `docs/ARCHITECTURE.md` se actualiza en T6.

## Tareas

Reglas comunes: en `content.js`, nada de `innerHTML` con valores interpolados (las plantillas estáticas se
mantienen); textos siempre con `textContent`; JSDoc en las funciones nuevas; los tests usan `loadModules` y `plain`
de `tests/helpers/load-modules.js`. Cada tarea termina con `make test` y `make lint` en verde y **sin avisos** de
lint.

- [x] T1 · Correcciones del botón de visto (las tres de **Decisiones**, "Correcciones de la revisión"):
  `watchedLoadError`, `savingWatchedIds`, parámetro `card` en `toggleVideoWatched` y `refreshWatchedUi` ·
  Ficheros: `content.js` · Test: `make lint`, `make test` y a mano V1, V2 y V3.
- [ ] T2 · Almacenamiento de ajustes. En `modules/storage.js`, `getSettings()` y `saveSettings(settings)` con la
  clave `youtubeSettings` (ver **Decisiones**). Estado del ADR 0003 a `aceptada` · Ficheros: `modules/storage.js`,
  `tests/storage.test.js`, `docs/adr/0003-formato-almacenamiento-ajustes.md` · Test (`tests/storage.test.js`):
  sin datos devuelve `{}` con `calls.set === 0`; con `settings: []`, `settings: null` y `settings: 3` devuelve `{}`;
  guardar y leer devuelve el mismo objeto y el almacenamiento queda con `version: 1`; `saveSettings([])` y
  `saveSettings(null)` lanzan `TypeError`; guardar ajustes no cambia `youtubeGroups` ni `youtubeWatched`.
- [ ] T3 · Lógica de ajustes y visibilidad. Nuevos `modules/settings.js` y `modules/visibility.js` (ver
  **Decisiones**). Añadirlos a `manifest.json` (después de `modules/watched.js`, antes de `content.js`, en ese
  orden) y a `MODULES` de `tests/helpers/load-modules.js`, que también devuelve `YouTubeGroupsSettings` y
  `YouTubeGroupsVisibility` · Ficheros: `modules/settings.js` (nuevo), `modules/visibility.js` (nuevo),
  `manifest.json`, `tests/helpers/load-modules.js`, `tests/settings.test.js` (nuevo),
  `tests/visibility.test.js` (nuevo) · Test: `normalizeSettings` con `undefined`, `null`, `[]` y `{}` devuelve los
  valores por defecto; conserva valores válidos; sustituye solo el campo inválido (`watchedMode: "x"`); descarta
  campos desconocidos; no muta la entrada. `getSettings` sin datos devuelve los valores por defecto sin escribir.
  `updateSettings({ watchedMode: "hide" })` escribe una vez y devuelve `changed: true`; repetirlo no escribe
  (`changed: false`); `{ watchedMode: "nope" }` y `{ foo: 1 }` lanzan "Ajuste inválido: ..." sin escribir;
  conserva el otro campo. `getCardVisibility`: tabla con las 2 × 2 combinaciones de `matchesFilter`/`isWatched`
  para cada combinación de `watchedMode` (3) y `outsideMode` (2), comparada con la tabla de reglas de **Decisiones**
  (incluye: visto y fuera del filtro con `watchedMode: "hide"` y `outsideMode: "dim"` → `hidden`).
- [ ] T4 · Visibilidad unificada en las tarjetas. En `content.js`: caché `settings` y su carga al arrancar;
  `applyCardVisibility(card)` sustituye a `setCardVisibility`; `applyFilterToCard`, `showAllVideoCards`,
  `filterAllDetectedCards` y `applyWatchedToCard` la usan; nada de `style.display`. En `content.css`: reglas
  `.youtube-groups--hidden` y `.youtube-groups--dimmed` (con `:hover`); quitar las de `youtube-groups--filtered-out`
  y la opacidad de `youtube-groups--watched` · Ficheros: `content.js`, `content.css` · Test: `make lint`,
  `make test` y a mano V4 (con los valores por defecto el comportamiento es el de antes).
- [ ] T5 · Sección "Ajustes" del panel. En `content.js`: el `<details>` estático con los dos `<select>` y el
  mensaje de error (ver **Decisiones**), su estado al cargar los ajustes y el manejador de cambio, que reaplica
  `applyCardVisibility` a todas las tarjetas. En `content.css`: estilos de la sección (claro y `html[dark]`) y
  `max-height`/`overflow-y` del panel · Ficheros: `content.js`, `content.css` · Test: `make lint`, `make test` y a
  mano V5, V6, V7 y V8.
- [ ] T6 · Cerrar el plan. En `ROADMAP.md`, marcar con ✅ "Modos de visibilidad" y "Ocultar videos vistos". En
  `docs/ARCHITECTURE.md`: filas de `modules/settings.js` y `modules/visibility.js`, `modules/storage.js` menciona
  los ajustes (ADR 0003), flujo "Visibilidad" (un único `applyCardVisibility` combina filtro, vistos y ajustes) y
  el flujo "Filtro" dice que oculta o atenúa según el ajuste. Estado de este plan a `hecho` · Ficheros:
  `ROADMAP.md`, `docs/ARCHITECTURE.md`, este plan · Test: `make lint` y `make test`.

### Verificación manual (con `make up`)

- V1 · Con un `throw new Error("prueba")` temporal al principio del `.then` de la carga de vistos en
  `content.js` (cambio local, no se commitea), recargar la extensión: los botones "Marcar visto" aparecen
  deshabilitados con el `title` "No se pudieron leer los vistos: prueba". Deshacer el cambio y recargar: vuelven a
  funcionar.
- V2 · Pulsar "Marcar visto" dos veces muy rápido: el botón se deshabilita durante el guardado y el vídeo queda
  marcado (no se marca y desmarca). En `/watch`, lo mismo con el botón del panel.
- V3 · Marcar un vídeo desde su tarjeta justo después de hacer scroll (tarjetas reutilizadas): la tarjeta pulsada
  cambia a "✓ Visto" y se atenúa sin esperar a otro scroll.
- V4 · Sin tocar ajustes: el filtro de grupo oculta como antes, los vistos se atenúan como antes; en el inspector,
  las tarjetas ocultas tienen `youtube-groups--hidden` y ningún `style="display: none"` de la extensión.
- V5 · "Vídeos vistos: Ocultar": las tarjetas vistas desaparecen en inicio, suscripciones y recomendaciones de
  `/watch`; marcar otro vídeo lo oculta al momento. "Mostrar": se ven sin atenuar. "Atenuar": como en la Fase 2.
- V6 · Con un grupo activo, "Vídeos fuera del filtro: Atenuar": las tarjetas de otros canales se ven atenuadas en
  vez de ocultas; volver a "Ocultar" las oculta. Con "Vídeos vistos: Ocultar", un vídeo visto del grupo activo
  también se oculta.
- V7 · Recargar (F5) y navegar entre páginas: los ajustes se conservan; en la consola de la extensión,
  `browser.storage.local.get("youtubeSettings")` muestra el formato del ADR 0003.
- V8 · La sección "Ajustes" se pliega y despliega, se lee en tema claro y oscuro, y el panel no se sale de la
  ventana (hace scroll si es alto).

## Criterios de aceptación

- Mientras los vistos no han cargado, o si su lectura falla, los botones de visto están deshabilitados; con fallo
  muestran el error en su `title`.
- Un botón de visto no admite un segundo clic mientras guarda; la tarjeta pulsada refleja el nuevo estado al
  momento.
- La persona elige en el panel cómo se ven los vídeos vistos (mostrar, atenuar, ocultar) y los que no pasan el
  filtro (ocultar, atenuar); el cambio se aplica al momento a todas las tarjetas y se conserva tras recargar.
- Ocultar gana a atenuar cuando una tarjeta cumple ambas condiciones.
- Sin tocar los ajustes, el comportamiento es el de la Fase 2 (filtro oculta, vistos atenuados).
- Los ajustes se guardan con el formato del ADR 0003; grupos y vistos no cambian de formato.
- En `ROADMAP.md`, "Modos de visibilidad" y "Ocultar videos vistos" aparecen con ✅.
- `make lint` (0 avisos) y `make test` pasan.

## Fuera de alcance

- Marcado automático, filtros avanzados y listas (planes 2, 3 y 4).
- Modos por página o por grupo; contador o botón "mostrar ocultos".
- Persistir el grupo activo; sincronizar ajustes entre pestañas (`storage.onChanged`) o dispositivos (Fase 4).
- Popup u opciones de la extensión.
- Código sin uso y `console.log` existentes que no toca esta tarea.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-14 | T1 | `fix: corregir el estado y el doble clic del botón de visto` | `watchedLoadError`, `savingWatchedIds`, `refreshWatchedUi`; V1-V3 pendientes de comprobar a mano |
