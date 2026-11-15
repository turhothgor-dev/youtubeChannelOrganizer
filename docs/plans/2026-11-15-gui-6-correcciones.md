# Plan: GUI 6 · Correcciones de la revisión (guía fija, observer, /live, hermanos)

**Estado:** aprobado (2026-11-15)

Issue: revisión del diff `5f9b30c..HEAD` (planes `2026-11-15-gui-6-1-guia-fija`, `-2-seleccion-hermanos`,
`-3-boton-crear`; ADR 0010 y 0011).

## Contexto y decisión

La revisión encuentra un bloqueante y cuatro importantes en la guía fija del ADR 0010, y tres sugerencias que se
aceptan. Se corrige todo dentro de la técnica del ADR 0010 (solo CSS bajo `html.youtube-groups--guide-pinned` y
`syncGuidePin`); no se cambia de técnica ni se tocan atributos internos de YouTube.

- **Bloqueante**: `tp-yt-app-drawer#guide` es `position: fixed` con `left: 0; right: 0` cuando no es `[persistent]`.
  Entre 792 y ~1312 px, al forzar `visibility: visible`, el cajón (transparente fuera de `#contentContainer`) cubre
  todo el ancho y se come los clics. Decisión: el host del cajón toma el ancho de la guía (`right: auto; width:
  var(--app-drawer-width, 240px)`) **y además** `pointer-events: none` en el host con `pointer-events: auto` en
  `#contentContainer`. Las dos cosas: lo primero quita la causa, lo segundo protege si YouTube cambia el ancho.
- **Un solo desplazamiento vertical**: hoy se suman el `top` del host, el `top` de `#contentContainer` y
  `#guide-spacer` (~168 px). Decisión: el desplazamiento lo da **solo el host** (`top:
  var(--ytd-masthead-height, 56px)`, `bottom: 0`); `#contentContainer` con `top: 0` y sin `padding` vertical, y
  `#guide-spacer` oculto. Se descarta "host en `top: 0` y que `#guide-spacer` lo haga": fuera del modo persistente el
  cajón tiene un `z-index` por encima del masthead y taparía el logo y la búsqueda de la izquierda; con el host bajo el
  masthead eso no puede pasar, y el resultado no depende de cómo YouTube dimensione `#guide-spacer` en cada modo.
- **`position: sticky`**: `overflow-x: hidden` en `ytd-app` crea contenedor de scroll y rompe los `sticky` de la
  página. Decisión: `overflow-x: clip` (Firefox ≥ 81; la extensión ya exige un Firefox moderno por MV3), que recorta
  sin crear contenedor de scroll.
- **Elementos fijos alineados a la mini-guía** (barra de chips, `#frosted-glass`, Shorts) entre 792 y 1312 px.
  Decisión: bajo la clase, redefinir en `ytd-app` la variable de YouTube `--ytd-mini-guide-width:
  var(--app-drawer-width, 240px)`, de modo que todo lo que YouTube alinea con la mini-guía se alinea con la guía, y
  además reglas explícitas `left: var(--app-drawer-width, 240px) !important` para los que usan valor fijo:
  `#frosted-glass`, `ytd-rich-grid-renderer #header ytd-feed-filter-chip-bar-renderer` y su `#chips-wrapper`, y
  `ytd-shorts` (contenedor de Shorts). `left` no afecta a elementos sin posicionar, así que estas reglas son inocuas
  donde el elemento no es fijo.
- **Observer caro**: `isGuideSectionInPlace` llama a `findGuideAnchor`, que recorre todos los `a[href]` de la guía y
  hace `new URL` en cada lote de mutaciones. Decisión: caché del ancla en `content.js`. La comprobación barata
  (sección conectada, padre `#sections`, hermano anterior igual al ancla en caché, o primer hijo si el ancla es
  `null`) va primero; el ancla solo se recalcula si la caché está invalidada. El observer la invalida cuando alguna
  mutación tiene como objetivo `#sections` o un nodo dentro de él **que no sea** nuestra sección (cubre secciones
  nuevas y secciones que reciben sus enlaces después), o si el ancla en caché ya no es hija de `#sections`.
- **Sugerencias aceptadas**: `/live/<id>` es página de vídeo y se clasifica como `watch` (no se fija la guía; efecto
  aceptado: allí se comporta como `/watch` también para los botones de las tarjetas relacionadas); en
  `yt-navigate-start` se calcula el pin con la ruta de destino (`event.detail.url`) para que la guía no se quede fija
  durante la transición a `/watch`; `areSiblings` compara rutas elemento a elemento (con `join("/")`, ids con `/`
  podían colisionar); se corrige el mensaje de T1 en el **Registro** de `gui-6-2`.

## Tareas

Reglas comunes: sin dependencias nuevas; JSDoc; `make lint` (0 avisos) y `make test` en verde; todo el CSS nuevo bajo
`html.youtube-groups--guide-pinned`. Sin tests de DOM de `content.js` (fuera de alcance, como en `gui-6-1`).

- [x] T1 · Cajón de la guía con su ancho, sin capturar clics fuera de la guía, un solo desplazamiento vertical y
  `overflow-x: clip` · Ficheros: `content.css` · Reglas: host `tp-yt-app-drawer#guide` con `top:
  var(--ytd-masthead-height, 56px)`, `bottom: 0`, `right: auto`, `width: var(--app-drawer-width, 240px)`,
  `pointer-events: none` (todas `!important`); `#contentContainer` con `top: 0`, `padding-top: 0`, `padding-bottom:
  0`, `pointer-events: auto` (`!important`), sin el `top` actual; `tp-yt-app-drawer#guide #guide-spacer` con
  `display: none !important`; `ytd-app` con `overflow-x: clip` en lugar de `hidden` · Test: `make lint`, `make test`
  y a mano V1, V2, V5.
- [x] T2 · Elementos fijos alineados con la guía entre 792 y 1312 px · Ficheros: `content.css` · Reglas:
  `html.youtube-groups--guide-pinned ytd-app { --ytd-mini-guide-width: var(--app-drawer-width, 240px) }` y `left:
  var(--app-drawer-width, 240px) !important` en `#frosted-glass`, `ytd-rich-grid-renderer #header
  ytd-feed-filter-chip-bar-renderer`, `ytd-rich-grid-renderer #header #chips-wrapper` y `ytd-shorts` · Test: `make
  lint` y a mano V3. Si en V3 alguno queda desplazado 240 px de más (doble desplazamiento por la variable y la regla),
  se quita su regla explícita y se anota en **Cambios aprobados**.
- [ ] T3 · Caché del ancla de la sección en la guía · Ficheros: `content.js` · Cambios: estado `guideAnchorCache`
  (`{ container, anchor }` o `null`) y `invalidateGuideAnchor()`; `getGuideAnchor(container)` devuelve la caché si es
  del mismo `container`, el ancla (si no es `null`) sigue siendo hija suya y no está invalidada; si no, llama a
  `findGuideAnchor` y guarda. `isGuideSectionInPlace` y `renderGuideSection` usan `getGuideAnchor`. En el
  `MutationObserver`, antes de `isGuideSectionInPlace()`, se invalida si alguna mutación cumple
  `sections.contains(target) && !ourSection?.contains(target)` (con `sections` resuelto una vez por lote) · Test:
  `make lint`, `make test` y a mano V4.
- [ ] T4 · `/live/<id>` como `watch` y pin con la ruta de destino en `yt-navigate-start` · Ficheros:
  `modules/pages.js`, `tests/pages.test.js`, `content.js` · Cambios: `getPageType` devuelve `"watch"` para
  `/^\/live\/[^/]+/`; nueva pura `getNavigationPathname(url, origin)` en `pages.js` (ruta de `url` resuelta contra
  `origin`; `null` si `url` no es `string` o no es válida). `syncGuidePin(pathname = location.pathname)` usa ese
  `pathname` para `getPageType`, pero `guidePinPath` sigue guardando `location.pathname` (si guardase el destino, el
  observer vería un cambio de ruta y desharía el pin antes de que cambie la URL). En `yt-navigate-start`:
  `syncGuidePin(getNavigationPathname(event.detail?.url, location.origin) ?? location.pathname)`, leyendo `detail`
  dentro de `try` (puede ser inaccesible desde el content script) · Test: `getPageType("/live/abc")` y
  `"/live/abc/"` dan `"watch"`, `"/live"` da `"other"` y `"/@canal/live"` sigue dando `"channel"`;
  `shouldPinGuide(getPageType("/live/abc"), 1400, false)` es `false`; `getNavigationPathname` con
  `"/watch?v=x"`, `"https://www.youtube.com/feed/subscriptions"`, `undefined`, `123` y `"http://["`.
- [ ] T5 · `areSiblings` compara rutas elemento a elemento · Ficheros: `modules/filter.js`, `tests/filter.test.js` ·
  Test: con grupos `"a" > "b/c" > "x"` y `"a/b" > "c" > "y"` (rutas de padre `["a","b/c"]` y `["a/b","c"]`, que con
  `join("/")` coincidían), `toggleSelection` con `x` seleccionado y pulsando `y` deja solo `y`; los hermanos reales se
  siguen conservando como antes.
- [ ] T6 · Cerrar: ADR 0010 con los selectores definitivos (punto 2 y **A vigilar**: `#guide-spacer`,
  `--ytd-mini-guide-width`, `#frosted-glass`, chips, `ytd-shorts`, `overflow-x: clip`, `pointer-events`, y el porqué
  del desplazamiento único en el host) y `/live/<id>` como `watch`; `docs/ARCHITECTURE.md` (fila de `pages.js` con
  `/live` y `getNavigationPathname`; flujo **Guía lateral** con la caché del ancla y el destino de
  `yt-navigate-start`); en `docs/plans/2026-11-15-gui-6-2-seleccion-hermanos.md`, mensaje de T1 del **Registro** a
  `feat: clave de canal con contenedor en la selección`; estado de este plan a `hecho` · Ficheros:
  `docs/adr/0010-seccion-en-la-guia-de-youtube-fija.md`, `docs/ARCHITECTURE.md`,
  `docs/plans/2026-11-15-gui-6-2-seleccion-hermanos.md`, este plan · Test: `make lint` y `make test`.

### Verificación manual (tu Firefox con sesión; recarga la extensión en `about:debugging`)

- V1 · Ventana de ~1000 px en `/feed/subscriptions` y en `/`: la guía completa ocupa solo su columna de 240 px; se
  puede pulsar cualquier vídeo, la barra de chips y los menús de la derecha (antes los clics no llegaban). El logo y la
  búsqueda del masthead se ven y funcionan.
- V2 · A ~1000 px y a ~1400 px: el primer elemento de la guía ("Inicio") queda justo bajo el masthead, sin hueco
  grande; el contenido empieza a la misma altura que sin la extensión. Sin barra de scroll horizontal.
- V3 · A ~1000 px: en `/` la barra de chips y su fondo (`#frosted-glass`) empiezan justo a la derecha de la guía y se
  quedan fijos al hacer scroll; en un `/shorts/…` el vídeo y sus botones no quedan debajo de la guía y se usan con
  normalidad; en una página de canal, la cabecera y las pestañas bien alineadas y las pestañas fijas al hacer scroll
  si YouTube las fija. Repetir a ~1400 px: igual que en YouTube con su guía abierta.
- V4 · Con la guía abierta, navegar varias veces entre `/`, suscripciones y un canal: una sola sección "YouTube
  Groups", siempre encima de "Más de YouTube"; el desplazamiento de la página es fluido.
- V5 · Ir a un vídeo desde `/`: en `/watch` la guía es el cajón de siempre desde el primer momento (sin un parpadeo
  fijo); ☰, modo cine y pantalla completa como siempre. Abrir un directo (`/live/…`): igual que `/watch`. Volver
  atrás: guía fija otra vez.
- V6 · Selección: dos grupos hermanos se seleccionan juntos; uno de otro nivel sustituye la selección, como antes.

## Criterios de aceptación

- Entre 792 y 1312 px la guía fija no impide pulsar nada fuera de su columna.
- La guía empieza justo bajo el masthead y el contenido no queda desplazado hacia abajo, a ~1000 y a ~1400 px.
- Los elementos fijos o `sticky` de inicio, suscripciones, Shorts y canal siguen fijos y alineados a la derecha de la
  guía; sin scroll horizontal.
- `/watch` y `/live/<id>` se comportan como en YouTube, también al llegar navegando sin recargar.
- Con la guía estable, el observer no recorre los enlaces de la guía en cada lote de mutaciones; la sección sigue en su
  sitio cuando YouTube añade o rellena secciones.
- La selección de hermanos no confunde grupos cuyos ids contienen `/`.

## Fuera de alcance

- Cambiar la técnica del ADR 0010 (atributos `persistent`/`opened`, `wrappedJSObject`) o el umbral de 792 px.
- Extraer el id de vídeo de `/live/<id>` (`extractVideoId`) y el panel "Vídeo actual" en directos.
- Tests de DOM de `content.js`; botones de miniatura, panel flotante, YouTube móvil y `/embed`.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-15 | T1 | `fix: cajón de la guía fija con su ancho y sin capturar clics` | Host con ancho de guía, `pointer-events`, desplazamiento único y `overflow-x: clip`. Pendiente V1, V2, V5 a mano. |
| 2026-11-15 | T2 | `fix: elementos fijos alineados con la guía fija` | Variable `--ytd-mini-guide-width` y `left` explícito en `#frosted-glass`, chips y `ytd-shorts`. Pendiente V3 a mano. |
