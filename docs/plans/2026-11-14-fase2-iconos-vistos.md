# Plan: cerrar la Fase 2 (iconos personalizados y marca como visto)

**Estado:** aprobado (2026-11-14)

Issue: `ROADMAP.md`, Fase 2: "Iconos personalizados (opcional)" y "Marca como visto".

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

### Iconos: qué hay y qué falta (código en 74b5152)

Los commits remotos de iconos ("feat(icons) adding icons WIP", "icon showed") entraron con el merge d3ef534.
Funciona: `modules/icons.js` (12 iconos SVG y 8 colores), `setGroupAppearance` en `modules/groups.js` (probado
en subgrupos anidados), el selector "Icono" del panel (`openIconPicker` en `content.js`) y el icono delante del
nombre en el panel. Falta para darlo por terminado:

1. **SVG con `innerHTML`.** Los tres avisos `UNSAFE_VAR_ASSIGNMENT` de `make lint` son el icono del panel
   (`renderGroupWithSubGroups`), la rejilla y la vista previa del selector (`createIconPicker`). Las rutas son
   constantes, pero el patrón concatena un dato en HTML.
2. **Icono "education" vacío.** Su ruta (`M5 12h14M5 12l7-7m0 0v14`) son solo líneas; con `fill` no pinta nada.
3. **"Heredar" no hereda.** El selector ofrece el color "Heredar" (`""`), pero un subgrupo sin color no toma el de
   su grupo padre; y un grupo con color y sin icono no muestra nada.
4. **Color fuera del formato.** `isValidColor` acepta `#rgb`, pero el ADR 0001 fija `#rrggbb`.
5. **Sin tests de `icons.js`**: `tests/helpers/load-modules.js` lo carga pero no lo expone.
6. **Iconos solo en el panel.** Los selectores de casillas (desplegable de tarjeta y "Canal actual") muestran solo
   el nombre del grupo.
7. **Selector ilegible en tema claro.** Los estilos del selector solo tienen colores oscuros por defecto, a
   diferencia del resto de `content.css` (claro y `html[dark]`).

### Decisiones (delegadas por la persona)

- **SVG con `createElementNS`.** Una función `createIconSvg(iconId, size)` en `content.js` crea `svg` y `path`
  con `document.createElementNS("http://www.w3.org/2000/svg", ...)` y `setAttribute`; devuelve `null` si el icono
  no existe. Sustituye los tres `innerHTML`; `make lint` queda sin avisos `UNSAFE_VAR_ASSIGNMENT`.
- **Herencia solo del color.** Nueva función pura `getGroupAppearance(groups, groupId)` en `modules/groups.js`:
  devuelve `{ icon, color }`, donde `icon` es el del propio grupo si existe en `ICON_SET` (si no, `""`; "Sin
  icono" no hereda, como dice su etiqueta) y `color` es el del propio grupo o, si está vacío, el del antecesor más
  cercano con color (si ninguno, `""`). Grupo inexistente: `null`. En el panel, con icono se pinta el icono del
  color resultante; sin icono y con color, un punto de ese color (`youtube-groups__color-dot`); sin ambos, nada.
  No cambia el formato guardado: `color: ""` ya significaba "sin color propio".
- **Color `#rrggbb` estricto** en `isValidColor`, como el ADR 0001. Todos los colores de `COLOR_SET` lo cumplen.
- **Icono "education"** pasa a una ruta rellena (birrete de Material Icons
  `M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z`). Un test exige que toda ruta de
  `ICON_SET` contenga solo caracteres de ruta SVG y al menos un cierre `z`/`Z`.
- **Iconos también en los selectores de casillas** (`renderChannelGroupChoices`), con la misma apariencia que el
  panel.
- `manifest.json` carga `modules/icons.js` antes de `modules/groups.js` (el orden de los tests), porque
  `groups.js` lo usa.

### Marca como visto

- **Modelo y almacenamiento:** ADR 0002 (`docs/adr/0002-formato-almacenamiento-vistos.md`). Clave propia
  `youtubeWatched` `{ version: 1, videos: { "<videoId>": { watchedAt } } }`; identidad por ID de vídeo de 11
  caracteres; desmarcar borra la clave; leer sin datos devuelve `{}` sin escribir. El formato de grupos (ADR 0001)
  no cambia.
- **Acceso al almacenamiento** en `modules/storage.js`, como los grupos: `getWatchedVideos()` y
  `saveWatchedVideos(videos)`.
- **Lógica en un módulo nuevo** `modules/watched.js` (`YouTubeGroupsWatched`), sin DOM:
  - `extractVideoId(href)`: ID de `/watch?v=<id>` o `/shorts/<id>` del mismo origen (`window.location.origin`,
    como `normalizeChannelUrl`), con el ID validado por `/^[A-Za-z0-9_-]{11}$/`; si no, `null`.
  - `isVideoWatched(videos, videoId)`: booleano.
  - `applyVideoWatched(videos, videoId, isWatched, now)`: pura, sin mutar la entrada; devuelve
    `{ videos, changed }`. Marcar uno ya visto no cambia `watchedAt` (`changed: false`); desmarcar uno no visto,
    tampoco. ID inválido: `Error("Vídeo inválido.")`.
  - `setVideoWatched(videoId, isWatched)`: una lectura y, solo si `changed`, una escritura; devuelve el resultado
    de `applyVideoWatched` (usa `Date.now()`).
  - La Fase 3 reutiliza `isVideoWatched` para ocultar, `setVideoWatched` para marcar automáticamente y la clase
    `youtube-groups--watched` de las tarjetas.
- **Interfaz:**
  - **Tarjetas** (todas las detectadas, en cualquier página): `content.js` guarda el ID en
    `data-youtube-groups-video-id` y aplica la clase `youtube-groups--watched` si el vídeo está visto (CSS: opacidad
    0.55, 1 al pasar el ratón). Se reevalúa en cada procesado de la tarjeta (no depende de la caché del canal de
    `detectCard`, porque YouTube puede reutilizar una tarjeta para otro vídeo del mismo canal).
  - **Botón por tarjeta** "Marcar visto" / "✓ Visto" (`aria-pressed`) dentro del mismo control que "Añadir a grupo"
    (inicio y `/feed/subscriptions`). Lee el ID de la tarjeta al pulsar y alterna el estado.
  - **Panel en `/watch`:** sección "Vídeo actual" con el mismo botón para el vídeo de `window.location.href`.
  - **Caché en memoria:** `content.js` lee los vistos una vez al arrancar (`watchedVideos`, `null` hasta cargar; sin
    datos no marca nada) y la sustituye por el resultado de cada `setVideoWatched`; tras cada cambio actualiza todas
    las tarjetas con ese ID, sus botones y el del panel.
  - **Error al guardar:** el estado no cambia, el botón recibe `title` con el mensaje y se registra con
    `console.error`.

Alternativas descartadas:

- Mantener `innerHTML` porque las rutas son constantes: deja tres avisos de lint permanentes y un patrón que se
  copia con datos que no lo son.
- Heredar también el icono: "Sin icono" dejaría de poder quitarlo en un subgrupo de un grupo con icono.
- Guardar los vistos en `youtubeGroups`, una clave por vídeo, un array o un booleano por vídeo: ver ADR 0002.
- Marcar como visto automáticamente al abrir `/watch` o leyendo la barra de progreso de YouTube: es "Marcar videos
  vistos" de la Fase 3 y depende de selectores frágiles.
- Ocultar los vistos: Fase 3.
- `jsdom` para probar `content.js`: dependencia nueva. Sin dependencias nuevas; la parte de DOM se verifica a mano.

Hay ADR nuevo (0002, estado `propuesta`; pasa a `aceptada` en T4). `docs/ARCHITECTURE.md` se actualiza en T9.

## Tareas

Cada tarea es del tamaño de un commit. Reglas comunes: en `content.js`, nada de `innerHTML` con valores
interpolados (las plantillas estáticas existentes se mantienen); nombres de grupo, canal y vídeo siempre con
`textContent`; JSDoc en las funciones nuevas; los tests usan `loadModules` y `plain` de
`tests/helpers/load-modules.js`, como los existentes. Cada tarea termina con `make test` y `make lint` en verde.

- [x] T1 · Datos y validación de iconos. En `modules/icons.js`: ruta rellena para `education` (ver
  **Decisiones**) e `isValidColor` solo acepta `""` o `#rrggbb`. En `tests/helpers/load-modules.js`, devolver
  también `YouTubeGroupsIcons`. En `manifest.json`, cargar `modules/icons.js` antes de `modules/groups.js` ·
  Ficheros: `modules/icons.js`, `tests/helpers/load-modules.js`, `manifest.json`, `tests/icons.test.js` (nuevo) ·
  Test (`tests/icons.test.js`): ids de `ICON_SET` y de `COLOR_SET` únicos y etiquetas no vacías; toda ruta cumple
  `/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/` y contiene `z` o `Z`; `isValidColor` acepta `""`, `#2196F3` y `#abcdef`,
  y rechaza `#abc`, `2196F3`, `#12345g` y `red`; todos los `hex` de `COLOR_SET` son válidos; `isValidIconId`
  acepta `""` y `tech` y rechaza `nope`; `getIconPath("nope")` es `null`.
- [x] T2 · Apariencia resultante de un grupo. En `modules/groups.js`, añadir y exportar
  `getGroupAppearance(groups, groupId)` (pura, descrita en **Decisiones**) · Ficheros: `modules/groups.js`,
  `tests/groups.test.js` · Test: grupo con icono y color devuelve los suyos; subgrupo de segundo nivel sin color
  toma el del abuelo si el padre tampoco tiene, y el del padre si lo tiene; subgrupo con color propio no hereda;
  subgrupo sin icono con padre con icono devuelve `icon: ""`; icono guardado que no existe en `ICON_SET` devuelve
  `""`; grupo sin campos `icon`/`color` (formato antiguo) devuelve `{ icon: "", color: "" }`; id desconocido
  devuelve `null`; no muta la entrada.
- [x] T3 · Pintar iconos sin `innerHTML` y en todos los selectores. En `content.js`: añadir
  `createIconSvg(iconId, size)` (ver **Decisiones**) y usarla en el panel (16 px), la rejilla del selector (20 px)
  y la vista previa (24 px); el panel usa `getGroupAppearance` (icono con el color resultante, o punto de color si
  solo hay color); `renderChannelGroupChoices` añade la misma marca delante del nombre de cada grupo, para lo que
  recibe el árbol completo (ya lo recibe: `groups`). En `content.css`: `.youtube-groups__color-dot` (círculo de
  10 px) y estilos del selector de iconos en claro por defecto con su variante `html[dark]` (fondo, borde, texto
  de las opciones y etiquetas) · Ficheros: `content.js`, `content.css` · Test: `make lint` sin ningún aviso
  `UNSAFE_VAR_ASSIGNMENT`, `make test`, y a mano V1, V2 y V3.
- [x] T4 · Almacenamiento de vistos. En `modules/storage.js`, añadir `getWatchedVideos()` y
  `saveWatchedVideos(videos)` con la clave `youtubeWatched` y el formato del ADR 0002: leer sin datos, sin
  `videos`, con `videos` `null` o array devuelve `{}` y no escribe; guardar algo que no sea un objeto plano (array,
  `null`, número) lanza `TypeError`; guarda `{ version: 1, videos }`. Cambiar el estado del ADR 0002 a `aceptada` ·
  Ficheros: `modules/storage.js`, `tests/storage.test.js`, `docs/adr/0002-formato-almacenamiento-vistos.md` ·
  Test (`tests/storage.test.js`): sin datos devuelve `{}` con `calls.set === 0`; con datos corruptos (`videos: []`
  y `videos: null`) devuelve `{}`; guardar y leer devuelve el mismo mapa y el almacenamiento queda con
  `version: 1`; `saveWatchedVideos([])` y `saveWatchedVideos(null)` lanzan `TypeError`; guardar vistos no cambia
  `youtubeGroups`.
- [ ] T5 · Lógica de vistos. Nuevo `modules/watched.js` con `YouTubeGroupsWatched` (`extractVideoId`,
  `isVideoWatched`, `applyVideoWatched`, `setVideoWatched`; ver **Decisiones**). Añadirlo a `manifest.json` antes
  de `content.js` y a `MODULES` de `tests/helpers/load-modules.js`, que también devuelve `YouTubeGroupsWatched` ·
  Ficheros: `modules/watched.js` (nuevo), `manifest.json`, `tests/helpers/load-modules.js`,
  `tests/watched.test.js` (nuevo) · Test (`tests/watched.test.js`): `extractVideoId` con `/watch?v=dQw4w9WgXcQ`,
  con `&t=10s&list=X`, con URL absoluta del mismo origen y con `/shorts/dQw4w9WgXcQ` devuelve el ID; devuelve
  `null` para `/watch` sin `v`, IDs de 10 o 12 caracteres o con caracteres no válidos, otro origen, `/@handle` y
  `/playlist?list=X`. `applyVideoWatched`: marcar añade `{ watchedAt: now }` con `changed: true`; marcar uno ya
  visto conserva el `watchedAt` original y los campos extra de la entrada, con `changed: false`; desmarcar borra la
  clave; desmarcar uno no visto da `changed: false`; ID inválido lanza "Vídeo inválido."; no muta la entrada.
  `isVideoWatched` verdadero y falso. `setVideoWatched`: escribe una vez al marcar, no escribe si no hay cambio, y
  con ID inválido rechaza sin escribir.
- [ ] T6 · Marca de visto en las tarjetas. En `content.js`: leer los vistos al arrancar en `watchedVideos`;
  `findVideoId(card)` (primer `a[href]` con `extractVideoId` no nulo); `applyWatchedToCard(card)` guarda o borra
  `data-youtube-groups-video-id` y alterna `youtube-groups--watched`, y llamarla en `processPendingCards` para cada
  tarjeta; al cargar los vistos, aplicarla a todas las tarjetas de `VIDEO_CARD_SELECTOR`. En `content.css`, la
  regla de `.youtube-groups--watched` (ver **Decisiones**) · Ficheros: `content.js`, `content.css` · Test:
  `make lint`, `make test` y a mano V4 (con vistos creados desde la consola de la extensión o tras T7).
- [ ] T7 · Botón "Marcar visto" por tarjeta. En `content.js`: el control de `createSubscriptionChannelControl`
  añade un segundo botón (`youtube-groups__watched-button action-button secondary-button`) que al pulsar lee el ID
  de la tarjeta, llama a `setVideoWatched(id, !isVideoWatched(watchedVideos, id))`, actualiza `watchedVideos` y
  reaplica `applyWatchedToCard` a todas las tarjetas con ese ID; `applyWatchedToCard` también pone el texto y
  `aria-pressed` del botón de la tarjeta. Sin ID, el botón queda deshabilitado. Error: ver **Decisiones**. El
  botón no navega ni abre menús de YouTube (el control ya detiene `click` y `mousedown`) · Ficheros:
  `content.js`, `content.css` (si hace falta separar los dos botones) · Test: `make lint`, `make test` y a mano V4,
  V5 y V6.
- [ ] T8 · Botón en el panel para el vídeo actual. En `content.js`: sección estática "Vídeo actual" en la plantilla
  del panel (sin interpolaciones) con el mismo botón; visible solo en `/watch` con ID válido en
  `window.location.href`; se actualiza en `renderGroupsPanel` (también tras `yt-navigate-finish`) y tras cada
  cambio de visto desde cualquier botón · Ficheros: `content.js` · Test: `make lint`, `make test` y a mano V7.
- [ ] T9 · Cerrar la Fase 2. En `ROADMAP.md`, marcar con ✅ "Iconos personalizados (opcional)" y "Marca como
  visto" (la Fase 3 no se toca). En `docs/ARCHITECTURE.md`: fila de `modules/watched.js`, `modules/storage.js`
  menciona los vistos (ADR 0002), orden de carga actualizado, y flujo "Marcar como visto"; quitar la frase "El
  botón por tarjeta, `setChannelGroups` y los tests se introducen con el plan..." si ya no aporta. Estado de este
  plan a `hecho` · Ficheros: `ROADMAP.md`, `docs/ARCHITECTURE.md`, este plan · Test: `make lint` y `make test`
  (sin cambios de código).

### Verificación manual (con `make up`)

- V1 · Crear un grupo con icono "Música" y color verde, un subgrupo "Sin icono"/"Heredar" y, dentro, otro con
  icono "Ciencia" y "Heredar": el grupo muestra la nota verde; el primer subgrupo, un punto verde; el segundo, el
  matraz verde. Cambiar el color del grupo a rojo: los dos subgrupos pasan a rojo. Recargar (F5): se mantiene.
- V2 · Abrir el selector "Icono": las 12 opciones se ven, también "Educación"; la vista previa cambia con icono y
  color. Probar en tema claro y oscuro de YouTube: el selector se lee en ambos.
- V3 · El desplegable "Añadir a grupo" de una tarjeta y "Canal actual" en `/watch` muestran el icono o el punto
  de color delante de cada grupo.
- V4 · En `/feed/subscriptions`, pulsar "Marcar visto" en una tarjeta: pasa a "✓ Visto", la tarjeta se atenúa y
  vuelve a opacidad completa al pasar el ratón; la página no navega. Pulsar otra vez: se desmarca. Recargar: el
  estado se conserva. En la consola de la extensión, `browser.storage.local.get("youtubeWatched")` muestra el
  formato del ADR 0002.
- V5 · Marcar un vídeo en inicio, navegar a suscripciones (y viceversa) y hacer scroll largo arriba y abajo: cada
  tarjeta atenuada es de un vídeo marcado (comparar `data-youtube-groups-video-id` con su enlace en el inspector).
- V6 · Con un grupo activo como filtro, marcar y desmarcar vídeos: el filtro no cambia y no aparecen todas las
  tarjetas.
- V7 · En `/watch`, el panel muestra "Vídeo actual" con el botón; marcarlo y volver a inicio: su tarjeta (si
  aparece) está atenuada. Pasar a otro vídeo: el botón refleja el estado del nuevo. Fuera de `/watch`, la sección
  no aparece.

## Criterios de aceptación

- Un grupo o subgrupo puede tener icono y color; un subgrupo sin color toma el del antecesor más cercano que lo
  tenga; "Sin icono" no muestra icono; un grupo con color y sin icono muestra un punto de ese color.
- Los 12 iconos se ven en el selector, en el panel y en los selectores de casillas, en tema claro y oscuro.
- `make lint` no da ningún aviso `UNSAFE_VAR_ASSIGNMENT`.
- La persona puede marcar y desmarcar como visto cualquier vídeo de inicio y suscripciones desde su tarjeta, y el
  vídeo abierto en `/watch` desde el panel; la marca se ve en todas las tarjetas de ese vídeo y se conserva tras
  recargar y navegar.
- Marcar como visto no modifica los grupos ni el filtro activo.
- Los vistos se guardan con el formato del ADR 0002; los grupos guardados antes siguen cargando (ADR 0001, sin
  cambios).
- En `ROADMAP.md`, los dos puntos de la Fase 2 aparecen con ✅ y la Fase 3 sigue igual.
- `make lint` y `make test` pasan.

## Fuera de alcance

- Ocultar vídeos vistos y marcarlos automáticamente (Fase 3); el modelo queda preparado (ADR 0002).
- Sincronizar vistos o grupos entre pestañas (`storage.onChanged`) y escrituras concurrentes.
- Limpieza de vistos antiguos y límite de tamaño.
- Botón de visto en búsqueda, recomendaciones de `/watch`, listas o Shorts como página propia (Fase 5); las
  tarjetas de esas páginas sí se atenúan si el vídeo está visto.
- Iconos o colores personalizados por la persona (subir SVG, selector de color libre) y cambiar `ICON_SET` más
  allá de "education".
- Código sin uso (`getColorHex`, `deleteSubGroup`, `getSubGroups`, `isChannelInGroup`, `getGroupsForChannel`,
  `getAllChannelsFromGroup`), botones anidados dentro del botón de grupo del panel, estilos en línea de
  subgrupos (`color: #666`) y el resto de `console.log`.
- Cambiar el formato de grupos o la identidad canónica de canales (ADR 0001).

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-14 | T1 | `feat: validar iconos y colores y rellenar el icono de educación` | Ruta rellena de `education`, `isValidColor` solo `#rrggbb`, `tests/icons.test.js`, orden de carga en el manifest. |
| 2026-11-14 | T2 | `feat: calcular la apariencia heredada de un grupo` | `getGroupAppearance` en `modules/groups.js` (color heredado, icono propio) y sus tests. |
| 2026-11-14 | T3 | `feat: pintar iconos sin innerHTML y en los selectores de casillas` | `createIconSvg` y `createGroupMark` en `content.js`, punto de color, selector de iconos con tema claro y oscuro. |
| 2026-11-14 | T4 | `feat: guardar los vídeos vistos en el almacenamiento` | `getWatchedVideos` y `saveWatchedVideos` en `modules/storage.js`, tests y ADR 0002 a `aceptada`. |
