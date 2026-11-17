# Plan: Fase 6-15 · Avatares de canal en la guía y en el editor

**Estado:** aprobado (2026-11-17)

Issue: `ROADMAP.md`, Fase 6: "Avatares de canal (alta, 6-15)". Petición de la persona (2026-11-17): "si es posible, los
canales en grupos y subgrupos que muestren el icono del canal". Hoja de ruta: `docs/plans/2026-11-17-fase6-hoja-de-ruta.md`.
ADR: [0016](../adr/0016-avatares-de-canal-en-clave-aparte.md) (nuevo; amplía el 0006 con un campo opcional de la copia).

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

Los canales guardados son `{ name, url }` (ADR 0001) y se pintan solo con su nombre en la guía (`ui/guide-section.js`,
lista desplegable de cada grupo) y en el panel "Canales" del editor (`options/options.js`). Sin red propia, la imagen
del canal solo puede salir del DOM que YouTube ya ha cargado.

Decisión (ADR 0016):

- **Dónde se guarda**: clave nueva `youtubeAvatars` = `{ version: 1, avatars: { <getChannelKey(url)>: <url de imagen> } }`,
  solo con canales agrupados. **No** se añade `avatar` a cada canal de `youtubeGroups`: duplicaría la URL por grupo,
  obligaría a tocar quitar/restaurar/copiar/mover/limpiar y cada captura reescribiría el árbol y repintaría guía,
  filtro y editor en todas las pestañas.
- **De dónde sale**: un recolector en el content script (`ui/avatars.js`) mira, con una lista de selectores de avatar,
  las tarjetas de vídeo ya procesadas, los `ytd-channel-renderer` (búsqueda y `/feed/channels`), el propietario del
  vídeo en `/watch`, la cabecera de la página de canal y las suscripciones de la guía. Anota en memoria cualquier
  canal visto; si el canal está agrupado y su avatar falta o es distinto, lo escribe junto con los demás pendientes,
  como mucho una escritura cada 2 s. Así, al añadir un canal desde una tarjeta, el avatar ya visto se guarda en cuanto
  el canal pasa a estar agrupado, sin tocar `dropdowns.js` ni `panel.js`.
- **Cómo se muestra**: círculo con la inicial y un color derivado del nombre; encima, si hay avatar, un `<img>` lazy
  sin `Referer`; si la imagen falla, se quita y queda la inicial.

### Decisiones de detalle

**Lógica pura** en `modules/avatars.js` (`YouTubeGroupsAvatars`, sin DOM; se carga tras `groups.js` y antes de
`backup.js`, también en `options/options.html`):

- `AVATAR_HOSTS = ["yt3.ggpht.com", "yt3.googleusercontent.com"]`, `AVATAR_SIZE_SUFFIX = "=s88-c-k-c0x00ffffff-no-rj"`.
- `normalizeAvatarUrl(src)` → cadena o `null`. `null` si no es cadena, mide más de 2048, no se puede analizar, no es
  `https:` (un `//host/…` se resuelve como `https:`; `http:` y `data:` dan `null`), el host no está en `AVATAR_HOSTS`,
  lleva usuario, contraseña o puerto, o la ruta es `/`. Quita query y fragmento. Si la ruta termina en `=s<dígitos>…`
  (sin `/` después), sustituye ese final por `AVATAR_SIZE_SUFFIX`; si no tiene `=`, la deja igual. Idempotente.
- `isValidAvatarKey(key)` → `true` si es cadena, `YouTubeGroups.normalizeChannelUrl(key)` no es `null` (sin lanzar) y
  `YouTubeGroups.getChannelKey(key) === key`.
- `getAvatarFor(avatars, url)` → la URL guardada para `getChannelKey(url)` si pasa `normalizeAvatarUrl(v) === v`; si no,
  `null`.
- `getGroupedChannelKeys(groups)` → `Set` con `getChannelKey` de todos los canales del árbol (todos los niveles).
- `mergeAvatars(stored, observed, groups)` → `{ avatars, changed }` sin mutar la entrada: parte de las entradas de
  `stored` válidas (clave válida y valor ya normalizado) cuya clave está en los canales agrupados, aplica `observed`
  (objeto o `Map` clave → URL) solo para claves agrupadas y con URL válida, y `changed` indica si el resultado difiere
  de `stored` (claves o valores).
- `getInitial(name)` → primer carácter (punto de código, `Array.from`) del nombre recortado y sin `@` inicial, en
  mayúsculas con `toLocaleUpperCase`; `"?"` si queda vacío.
- `getFallbackColor(name)` → `hsl(H 45% 40%)` con `H` de un hash determinista del nombre recortado (mod 360).
- `saveObservedAvatars(observed)` → en `withLock(KEYS.avatars)`: lee avatares y grupos (`getGroups`), aplica
  `mergeAvatars` y escribe con `saveAvatars` solo si `changed`; devuelve `{ changed }`.

**Almacenamiento** (`modules/storage.js`): `KEYS.avatars = "youtubeAvatars"`, `readAvatarsValue(data)` (objeto plano
`data.avatars` o `{}`), `getAvatars()` (sin datos devuelve `{}` y no escribe) y `saveAvatars(avatars)` (lanza
`TypeError` si no es objeto plano; guarda `{ version: 1, avatars }`). `getChangedKeys` pasa a devolver también
`"avatars"`, en el orden de `KEYS` (al final).

**Copia de seguridad** (`modules/backup.js`): `buildBackup` añade `avatars` (`exportBackup` lo lee con `getAvatars`).
`parseBackup`: si `raw.avatars` es `undefined`, `data.avatars = null`; si no es objeto plano, error "La copia está
dañada: avatares no válidos."; si lo es, conserva las entradas con `isValidAvatarKey(clave)` y
`normalizeAvatarUrl(valor) === valor` y cuenta el resto en `dropped`. `importBackup` escribe `avatars` en su
`withLock` solo si `data.avatars !== null`. La `version` del fichero sigue en 1.

**Pintado** (`ui/icons-dom.js`, compartido con la página de opciones):

- `AVATAR_SIZES = { guide: 20, editor: 24 }`.
- `createChannelAvatar(name, src, size)` → `<span class="youtube-groups__avatar" aria-hidden="true">` con ancho y alto
  `size` px, fondo `getFallbackColor(name)` (propiedad `--yg-avatar-bg`) y un `<span
  class="youtube-groups__avatar-initial">` con `getInitial(name)`. Si `src` no es `null` y `normalizeAvatarUrl(src) ===
  src`, añade `<img class="youtube-groups__avatar-img">` con `alt=""`, `loading="lazy"`, `decoding="async"`,
  `referrerPolicy="no-referrer"`, `width` y `height` = `size` y `src`; en su evento `error` el `<img>` se quita. Todo con
  `textContent` y atributos, sin `innerHTML`.
- CSS en `ui/icons.css` (lo cargan YouTube y el editor): círculo (`border-radius: 50%`, `overflow: hidden`,
  `flex: none`), inicial centrada en blanco con tamaño proporcional y el `<img>` encima ocupando todo con
  `object-fit: cover`.

**Guía**: cada botón de canal (`createGuideButton(…, mark, …)`, clase `youtube-groups__guide-channel`) recibe como
`mark` `createChannelAvatar(channel.name, getAvatarFor(ctx.state.avatars, channel.url), AVATAR_SIZES.guide)`.
`content.js`: `ctx.state.avatars` (inicial `{}`); `renderGroupsPanel` lee grupos y avatares a la vez
(`Promise.all([getGroups(), getAvatars()])`), guarda los avatares en `ctx.state.avatars` y llama a
`ctx.avatars.setGroupedChannels(groups)` y `ctx.avatars.scheduleScan()` antes de pintar; `handleStorageChange` trata
`"avatars"` llamando a `renderGroupsPanel`.

**Editor**: `options/options.js` lee `getAvatars()` en `render()` junto con los grupos (caché `currentAvatars`) y, en
`storage.onChanged`, si cambia `"avatars"`, actualiza la caché y llama solo a `renderChannels()` (que ya conserva el
foco). Cada `li.options__channel` lleva el avatar (`AVATAR_SIZES.editor`) entre la casilla y el texto.

**Recolector** (`ui/avatars.js`, `YouTubeGroupsAvatarsUi.create(ctx)`, se carga tras `ui/icon-picker.js` y antes de
`ui/dropdowns.js`; `content.js` crea `ctx.avatars` antes que `ctx.cards`):

- `AVATAR_IMG_SELECTOR` (una sola constante): `yt-avatar-shape img, yt-decorated-avatar-view-model img, #avatar img,
  #channel-thumbnail img, #author-thumbnail img, yt-img-shadow img`.
- `findAvatarSrc(root)` → la URL normalizada si las `img` de `root` que casan con el selector y cuyo `src` da
  `normalizeAvatarUrl` no nulo tienen **una sola** URL distinta; si hay cero o varias (colaboraciones, pilas de
  avatares), `null`.
- `noteAvatar(url, src)`: con `getChannelKey(normalizeChannelUrl(url))` y `normalizeAvatarUrl(src)` válidos, guarda en
  `seen` (Map en memoria, como mucho 500 entradas; al pasar, sale la más antigua) y llama a `considerKey`.
  `considerKey(key)`: si la clave está en los canales agrupados, su URL vista difiere de `ctx.state.avatars` y no se
  ha actualizado ya en esta sesión una entrada que existía (`updatedThisSession`), la pasa a `pending` y programa el
  volcado (`setTimeout` de 2000 ms si no hay uno programado).
- `setGroupedChannels(groups)`: recalcula los canales agrupados (`getGroupedChannelKeys`) y pasa por `considerKey`
  todas las claves de `seen` (así se guarda el avatar de un canal recién añadido).
- `noteCard(card, url)`: `noteAvatar(url, findAvatarSrc(card))` si `url` y avatar existen.
- `scanPage()`: suscripciones de la guía (`ytd-guide-entry-renderer` con enlace de canal y `findAvatarSrc` de la
  entrada), propietario del vídeo en `/watch` (`ytd-video-owner-renderer`, canal con `ctx.cards.getChannelFromCard`) y,
  en páginas de canal, la cabecera (`yt-page-header-renderer, ytd-c4-tabbed-header-renderer`) con el canal de
  `YouTubeGroupsPages.getChannelUrlFromPath`; la cabecera usa solo `yt-avatar-shape img, #avatar img` para no tomar el
  banner. `scheduleScan()`: como mucho un `scanPage` por frame (`requestAnimationFrame`).
- `flushPending()` (devuelve una promesa; la usan el temporizador y los tests): vacía `pending`, llama a
  `YouTubeGroupsAvatars.saveObservedAvatars`, añade a `updatedThisSession` las claves que ya tenían avatar guardado y
  registra en consola los errores sin relanzarlos.
- Enganches: `ui/cards.js` `processPendingCards` llama a `ctx.avatars.noteCard(card,
  card.dataset.youtubeGroupsChannelUrl)` tras `detectCard`, y para `ytd-channel-renderer` (en cualquier página, antes
  de `ensureChannelResultControl`) con la URL del primer enlace de canal de la tarjeta (helper
  `getChannelResultUrl(card)` que también usa `ensureChannelResultControl`). `content.js`: donde el
  `MutationObserver` llama a `ctx.panel.scheduleCurrentChannelPanelUpdate()`, también `ctx.avatars.scheduleScan()`; y
  en `yt-navigate-finish`, vía `renderGroupsPanel`.

## Tareas

Reglas comunes: sin `innerHTML`; JSDoc; sin dependencias nuevas; sin permisos ni `fetch`; `make lint` (incluye
`web-ext lint`, 0 avisos) y `make test` en verde.

- [x] T1 · Clave `youtubeAvatars` en el almacenamiento · Ficheros: `modules/storage.js`, `tests/storage.test.js` ·
  Test: `KEYS` tiene cinco claves (el test "cuatro claves" se actualiza porque el requisito cambia, no para que pase),
  `avatars: "youtubeAvatars"` y sigue congelado; `readAvatarsValue` con `undefined`, array, `{ avatars: [] }` y uno
  válido; `getAvatars` sin datos → `{}` sin llamar a `set`; `saveAvatars` guarda `{ version: 1, avatars }` y lanza con
  un array; `getChangedKeys` con `youtubeAvatars` devuelve `["avatars"]` y el orden de `KEYS` se mantiene.
- [ ] T2 · Módulo puro `modules/avatars.js` · Ficheros: `modules/avatars.js`, `manifest.json` (tras
  `modules/groups.js`), `options/options.html` (tras `/modules/groups.js`), `tests/helpers/load-modules.js` (en
  `MODULES` tras `groups.js` y expuesto), `tests/avatars.test.js` · Test: `normalizeAvatarUrl` acepta
  `https://yt3.ggpht.com/ytc/AbC=s68-c-k-c0x00ffffff-no-rj?x=1#y` → `…/ytc/AbC=s88-c-k-c0x00ffffff-no-rj`, `//yt3.ggpht.com/a=s48`
  → `https://yt3.ggpht.com/a=s88-c-k-c0x00ffffff-no-rj` y `yt3.googleusercontent.com`; rechaza `http:`, `data:`,
  `i.ytimg.com`, `yt3.ggpht.com.evil.com`, `https://u:p@yt3.ggpht.com/a`, puerto, ruta `/`, no cadena y más de 2048;
  es idempotente; `isValidAvatarKey` acepta `getChannelKey` de `/@Foo` y rechaza `/@Foo` sin pasar por la clave y
  `https://evil.com/@a`; `getAvatarFor` encuentra `/@Foo` guardado como `/@foo` y descarta un valor no normalizado;
  `mergeAvatars` añade, cambia, poda canales no agrupados (también de subgrupos anidados: se conservan), ignora
  observados no agrupados o no válidos, `changed: false` sin diferencias y no muta la entrada; `getInitial` ("  @álvaro"
  → "Á", "😀x" → "😀", "" → "?"); `getFallbackColor` determinista y con formato `hsl(N 45% 40%)`;
  `saveObservedAvatars` escribe una vez con lo agrupado y, repetido con lo mismo, no llama a `set`.
- [ ] T3 · Avatares en la copia de seguridad · Ficheros: `modules/backup.js`, `tests/backup.test.js` · Test: exportar
  incluye `avatars`; importar una copia sin `avatars` no toca la clave guardada; con `avatars` válidos los reemplaza;
  entradas con host fuera de la lista, URL sin normalizar o clave no válida se descartan y suman a `dropped`;
  `avatars` como array → error "avatares no válidos" sin escribir nada; una copia antigua (sin el campo) sigue
  importándose igual.
- [ ] T4 · `createChannelAvatar` y estilos · Ficheros: `ui/icons-dom.js`, `ui/icons.css`, `tests/ui-icons-dom.test.js`
  · Test (jsdom): con URL válida hay un `img` con `alt=""`, `loading="lazy"`, `referrerpolicy="no-referrer"`, ancho y
  alto 20 y la inicial debajo; sin URL o con URL no permitida (`https://evil.com/a.png`) no hay `img` y sí la inicial y
  `--yg-avatar-bg`; disparar `error` en el `img` lo quita y deja la inicial; el contenedor tiene `aria-hidden="true"`
  y un nombre con `<b>` se pinta como texto.
- [ ] T5 · Avatares en la guía · Ficheros: `ui/guide-section.js`, `ui/guide-section.css`, `content.js`,
  `tests/ui-guide-section.test.js` · Test (jsdom): con un grupo desplegado de dos canales y `youtubeAvatars` con uno,
  la fila de ese canal tiene `img.youtube-groups__avatar-img` con su URL y la otra solo la inicial; el nombre y
  `title` del botón no cambian; escribir en `youtubeAvatars` (onChanged) repinta y la segunda fila gana su `img`.
- [ ] T6 · Avatares en el panel "Canales" del editor · Ficheros: `options/options.js`, `options/options.css` · Test:
  `make lint`, `make test` y a mano V3.
- [ ] T7 · Recolector `ui/avatars.js` y enganches · Ficheros: `ui/avatars.js`, `ui/cards.js`, `content.js`,
  `manifest.json` (tras `ui/icon-picker.js`), `tests/manifest.test.js` (orden de `ui/*.js` con `ui/avatars.js`, cambio
  de requisito), `tests/ui-avatars.test.js`, `tests/helpers/youtube-fixtures.js` si hace falta una tarjeta con avatar ·
  Test (jsdom, con `ctx.avatars.flushPending()` en lugar de esperar 2 s): una tarjeta de un canal agrupado con un
  avatar → una escritura con su URL normalizada; la misma tarjeta otra vez → ninguna escritura más; una tarjeta con
  dos avatares distintos → nada; un canal no agrupado → nada, y tras añadirlo a un grupo (`setChannelGroups` y
  repintado) se escribe sin volver a ver la tarjeta; varias tarjetas de canales agrupados → una sola escritura; un
  `ytd-channel-renderer` y una entrada de suscripción de la guía también se capturan; en una página de canal la
  cabecera con banner y avatar guarda el avatar, no el banner; un avatar ya guardado y visto distinto se actualiza
  una vez y no más en la misma sesión.
- [ ] T8 · Cerrar: `docs/ARCHITECTURE.md` (filas de `modules/avatars.js` y `ui/avatars.js`, `storage.js` con
  `KEYS.avatars`, `backup.js` con `avatars`, `icons-dom.js` con `createChannelAvatar`, flujo nuevo "Avatares de canal"
  y ADR 0016 en "Decisiones"); ADR 0016 a "aceptada"; en `ROADMAP.md`, "⬜" → "✅" en "Avatares de canal"; este plan a
  `hecho` · Ficheros: `docs/ARCHITECTURE.md`, `docs/adr/0016-avatares-de-canal-en-clave-aparte.md`, `ROADMAP.md`, este
  plan · Test: `make lint`, `make test` y V1 a V6.

### Verificación manual (Firefox, extensión recargada; grupo A con 3 canales y subgrupo A1 con 1)

- V1 · Sin avatares guardados, la guía y el editor muestran círculos con la inicial y colores distintos; sin errores
  en la consola.
- V2 · Navegar por inicio o suscripciones con vídeos de canales de A: en unos segundos sus filas de la guía muestran la
  imagen del canal. La pestaña de red no muestra peticiones propias de la extensión (solo imágenes `yt3`).
- V3 · En el editor, el panel "Canales" de A muestra los avatares (24 px) y se actualiza si otra pestaña captura uno
  nuevo, sin perder casillas marcadas. La consola de la página de opciones no muestra errores de CSP.
- V4 · Añadir a A1 un canal desde una tarjeta de búsqueda: tras guardar, en unos segundos su fila tiene avatar. Igual
  desde "Canal actual" en `/watch` y desde un resultado de canal.
- V5 · Cambiar a mano en `about:debugging` (almacenamiento) un avatar por una URL rota de `yt3.ggpht.com`: se ve la
  inicial. Exportar e importar una copia conserva los avatares; importar una copia antigua sin `avatars` no los borra.
- V6 · Regresión: filtro por grupos y canales en la guía, editor (6-1, 6-2), limpieza y botones de las tarjetas sin
  cambios; desplazar el inicio no produce escrituras continuas (como mucho una cada 2 s mientras aparezcan avatares
  nuevos).

## Criterios de aceptación

- En la guía y en el panel "Canales" del editor, cada canal de un grupo o subgrupo muestra su imagen de canal en
  cuanto se ha visto en una página de YouTube, y un círculo con su inicial si no se ha visto o la imagen no carga.
- La extensión no hace peticiones de red propias ni pide permisos nuevos; las imágenes solo vienen de
  `yt3.ggpht.com` o `yt3.googleusercontent.com` y se cargan sin `Referer`.
- Ver muchas tarjetas no provoca una escritura por tarjeta: como mucho una cada 2 s, solo si cambia algo, y ninguna
  si los avatares ya están al día.
- Los grupos guardados, sus operaciones (crear, quitar, copiar, mover, limpiar) y su formato no cambian; las copias
  de seguridad antiguas se siguen importando y las nuevas llevan los avatares.

## Fuera de alcance

- Avatares en el desplegable de casillas de grupos, en "Canal actual" del panel, en las tarjetas o en el filtro.
- Pedir avatares por red, descargarlos o guardarlos como datos (data URL).
- Unir `/@handle` con `/channel/UC…` (ADR 0001): un canal guardado con las dos URL tiene dos entradas.
- Capturar desde Shorts y desde comentarios.
- Tests de DOM de `options/options.js` (como en 6-1 y 6-2; `createChannelAvatar` se prueba en T4).
- Limpieza manual de avatares desde "Limpieza" (la poda es automática al escribir).

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-17 | T1 | `feat: clave youtubeAvatars en el almacenamiento` | `KEYS.avatars`, `readAvatarsValue`, `getAvatars`, `saveAvatars` y tests. |
