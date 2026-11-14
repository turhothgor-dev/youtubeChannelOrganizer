# Plan: Fase 5 · Correcciones de la revisión (filtro en páginas de canal, limpieza y detección)

**Estado:** aprobado (2026-11-14)

Issue: revisión de `f0d388f..HEAD` (fases 4 y 5).

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

La persona ha delegado todas las decisiones; aquí van las elegidas.

- **Importante · páginas de canal.** En `/@X/videos`, `/@X/shorts`, etc. (`getPageType` → `"channel"`) las tarjetas
  no enlazan al canal ni muestran su nombre, así que con un grupo activo `matchesGroupFilter` las oculta todas.
  Decisión: en páginas de canal, una tarjeta sin enlace de canal toma como canal el de la propia página.
  Función pura nueva `YouTubeGroupsPages.getChannelUrlFromPath(pathname, origin)`: devuelve
  `origin + "/@X"`, `"/channel/ID"`, `"/c/X"` o `"/user/X"` (el primer tramo, el mismo patrón que
  `normalizeChannelUrl`, sin barra final ni subrutas y sin decodificar: `location.pathname` ya viene codificado
  igual que los `href` guardados); `null` si la ruta no es de canal o no es cadena. El nombre que se guarda en
  `data-youtube-groups-channel-name` es el tramo tras `@`/`channel/`... decodificado con `decodeURIComponent`
  (si falla, sin decodificar). Si la tarjeta sí tiene enlace de canal, se usa el enlace, como hoy. Descartado:
  leer la cabecera del canal (`ytd-c4-tabbed-header-renderer`...): depende de selectores internos y llega tarde.
- **(a)** `cardMatchesFilter` usa `card.hasAttribute(VIDEO_ID_ATTRIBUTE)` en lugar de `findVideoId(card)`. Para que
  el atributo esté al día al detectar, `processPendingCards` llama a `applyWatchedToCard(card)` **antes** de
  `detectCard(card)` (las dos aplican visibilidad; la segunda ya tiene ID y canal actuales, en el mismo frame).
- **(b)** `detectedCards` guarda también las tarjetas sin enlace de canal (identificadas por nombre, por la página
  de canal o sin canal): `{ link: null, videoId, channel }` con el `VIDEO_ID_ATTRIBUTE` actual. `detectCard` las
  salta si siguen sin enlace (`findChannelLink` da `null`) y el ID no ha cambiado. `refreshChannelNameIndex`, cuando
  el índice cambia, borra de `detectedCards` las entradas con `link: null` de las tarjetas del documento y las
  programa de nuevo (hoy solo programa las que no están en el mapa).
- **(c)** `matchChannelByTexts` solo recibe textos de la zona de metadatos: `getChannelTexts(card)` busca el primer
  contenedor de `CHANNEL_TEXT_SCOPE_SELECTOR = "yt-content-metadata-view-model, #metadata, #byline-container"`
  dentro de la tarjeta y aplica la misma lectura que `getCardTexts` solo a ese contenedor (refactor:
  `getCardTexts(card, root = card)`). Sin contenedor, no se busca por nombre (la tarjeta queda sin canal, como antes
  de la Fase 5.3). Así no casan insignias ("Nuevo", "4K", "En directo") ni textos de la miniatura. Descartado:
  lista de textos genéricos prohibidos (incompleta y dependiente del idioma).
- **(d)** Limpieza: "URL no válidas" corrige las recuperables en vez de borrarlas. Recuperable = cadena con
  `normalizeChannelUrl(url)` no nulo (por ejemplo `https://www.youtube.com/@ñu` → `.../@%C3%B1u`, o
  `.../@x/videos` → `.../@x`); se sustituye la URL y se conservan los demás campos. Si la URL corregida ya existe
  en el mismo grupo (misma `getChannelKey`, entre las válidas o las ya corregidas), la entrada se quita. Las
  irrecuperables (no cadena, otro origen, ruta que no es de canal, o `normalizeChannelUrl` lanza) se quitan como
  hoy. `analyzeGroups` añade `fixedUrl` (cadena o `null`) a cada entrada de `invalid`; el panel muestra
  "→ <fixedUrl>" o "(se quitará)" y el botón pasa a "Corregir URL no válidas". Firma y retorno de `applyCleanup` y
  `cleanupGroups` sin cambios.
- **(e)** Las `yt-lockup-view-model` de listas y mixes no son tarjetas de vídeo: en `VIDEO_CARD_SELECTOR`, el
  selector pasa a
  `yt-lockup-view-model:not(ytd-rich-item-renderer yt-lockup-view-model):not(:has(a[href*="list="]))`. Al no
  casar, no reciben botones, ni ID, ni filtro, ni entran en "Reproducir lo visible". `:has` está en Firefox desde
  la 121. Descartado: función JS de exclusión en cada recorrido (más puntos que tocar para el mismo resultado).
- **(f)** El modal de lista no se reabre tras cerrarlo: `openPlaylistVideosModal(playlistId, { onlyIfOpen = false } = {})`;
  con `onlyIfOpen`, después del `await` sale sin hacer nada si ya no hay un modal
  `.youtube-groups__channel-list-modal--playlist` con ese `data-playlist-id`. `handleStorageChange` lo llama con
  `{ onlyIfOpen: true }`.

Sin dependencias nuevas ni ADR (no cambia formatos ni estructura).

## Tareas

Cada tarea termina con `make lint` (0 avisos) y `make test` en verde.

- [x] T1 · Canal de la página en páginas de canal. `getChannelUrlFromPath` en `modules/pages.js` (exportada) y, en
  `detectCard`, si no hay enlace y `getPageType(location.pathname) === "channel"`, canal = el de la página (antes de
  buscar por nombre) · Ficheros: `modules/pages.js`, `tests/pages.test.js`, `content.js` · Test
  (`tests/pages.test.js`): `"/@foo/videos"`, `"/@foo"` y `"/@foo/"` → `origin + "/@foo"`;
  `"/channel/UCabc/shorts"` → `origin + "/channel/UCabc"`; `"/@%C3%B1u/videos"` conserva la codificación;
  `"/watch"`, `"/"`, `"/shorts/abc"` y `undefined` → `null`. A mano V1.
- [x] T2 · Limpieza corrige URL recuperables (sugerencia d) · Ficheros: `modules/groups.js`, `tests/groups.test.js`,
  `content.js` (textos de la sección Limpieza) · Test (`tests/groups.test.js`): `applyCleanup(..., { invalid: true })`
  cambia `.../@ñu` por `.../@%C3%B1u` y `.../@x/videos` por `.../@x` conservando `name`; quita `42`, `"no-url"` y
  `https://example.com/@x`; quita la recuperable cuya URL corregida ya está en el grupo; `changed` es `true`;
  `analyzeGroups` da `fixedUrl` correcto o `null`. Los tests existentes siguen pasando. A mano V2.
- [ ] T3 · Detección de tarjetas más barata y precisa (sugerencias a, b, c, e) · Ficheros: `content.js` · Test:
  `make lint`, `make test` y a mano V3, V4 y V5.
- [ ] T4 · Modal de lista sin reaperturas (sugerencia f) y cierre. En `docs/ARCHITECTURE.md`: detección (canal de
  la página en páginas de canal, textos de metadatos para el nombre, lockups de listas excluidos) y Limpieza
  (corrige las recuperables). Estado de este plan a `hecho` · Ficheros: `content.js`, `docs/ARCHITECTURE.md`,
  este plan · Test: `make lint`, `make test` y a mano V6.

### Verificación manual (con `make up`)

- V1 · Con un grupo activo que contiene el canal X, en `/@X/videos` y `/@X/shorts` las tarjetas se ven; en el canal
  de otro canal fuera del grupo, se ocultan o atenúan según el ajuste. Sin grupo activo, todo se ve.
- V2 · Con un canal guardado como `https://www.youtube.com/@ñu` (por ejemplo, importando una copia), la Limpieza lo
  lista con "→ .../@%C3%B1u"; tras "Corregir URL no válidas" el canal sigue en el grupo con la URL corregida.
- V3 · En `/watch`, los mixes y listas de la columna de recomendaciones no tienen botones ni se ocultan por el
  filtro, y "Reproducir lo visible" no los incluye; los vídeos siguen con sus botones.
- V4 · En `/watch` con grupo activo, una recomendación de un canal guardado se identifica por nombre; una insignia
  "Nuevo" no la asigna a un canal llamado "Nuevo".
- V5 · Al hacer scroll en `/watch`, las tarjetas identificadas por nombre no se recalculan en cada mutación (punto
  de interrupción o `console.count` temporal en `getCardTexts`); al guardar un canal nuevo, sus tarjetas se
  identifican sin recargar.
- V6 · Abrir "Ver" de una lista, cerrarlo y, desde otra pestaña, añadir un vídeo a esa lista: el modal no se
  reabre. Con el modal abierto, el mismo cambio lo repinta.

## Criterios de aceptación

- Con un grupo activo, las páginas de canal muestran los vídeos de ese canal si pertenece al grupo.
- "Corregir URL no válidas" corrige las recuperables y solo quita las irrecuperables o las que quedarían repetidas.
- Los mixes y listas de las recomendaciones no se tratan como vídeos.
- Un canal no se asigna por textos fuera de la zona de metadatos de la tarjeta.
- Un modal de lista cerrado no se reabre por cambios de otra pestaña.
- Formatos guardados (ADR 0001 a 0006) sin cambios; sin dependencias nuevas.

## Fuera de alcance

- Comparar handles sin distinguir mayúsculas en el filtro (`/@Foo` frente a `/@foo`) o resolver `/c/` y `/user/` a
  su `/@handle`.
- Excluir mixes y listas de `ytd-rich-item-renderer` en inicio (solo se tratan los `yt-lockup-view-model`).
- Tests de DOM de `content.js` (no hay entorno DOM en `make test`).
- `ROADMAP.md`.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |
| 2026-11-14 | T2 | Las subrutas (`/@x/videos`) se consideran irrecuperables y se quitan; tests con `/@x?a=1` y `/@y#b` | `normalizeChannelUrl` devuelve `null` con subrutas y cambiarla afectaría al filtro en toda la extensión | Persona (delegó decisiones a la opción recomendada) |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-14 | T1 | fix: usar el canal de la página en páginas de canal | `getChannelUrlFromPath` y uso en `detectCard`; V1 pendiente a mano |
| 2026-11-14 | T2 | fix: corregir las URL recuperables en la limpieza | `applyCleanup`/`analyzeGroups` (`fixedUrl`) y textos del panel; `normalizeChannelUrl` devuelve null con subrutas (`/@x/videos`), así que esas son irrecuperables y los tests usan `?a=1`; V2 pendiente a mano |
