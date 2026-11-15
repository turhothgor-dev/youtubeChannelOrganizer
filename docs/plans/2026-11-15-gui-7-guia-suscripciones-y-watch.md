# Plan: guía fija solo en suscripciones, ☰ del cajón y botones sobre el reproductor (gui-7)

**Estado:** aprobado (2026-11-15)

Issue: tres peticiones de la persona tras probar en Firefox (2026-11-15), sobre el ADR 0010 y los planes `gui-2` y
`gui-6-*`.

## Contexto y decisión

### 1. Guía fija solo en `/feed/subscriptions`

Hoy `YouTubeGroupsPages.shouldPinGuide(pageType, width, isFullscreen)` (`modules/pages.js`) fija la guía en toda página
que no sea `watch`, con ancho ≥ 792 px y sin pantalla completa. Pasa a ser cierto **solo** con `pageType ===
"subscriptions"` (mismas condiciones de ancho y pantalla completa). No cambian la firma, la clase
`youtube-groups--guide-pinned`, el CSS, el bloqueo de ☰ ni `syncGuidePin`. La sección "YouTube Groups" se sigue
insertando en la guía en todas las páginas. Se recoge en el ADR **0012** (`docs/adr/0012-guia-fija-solo-en-suscripciones.md`,
estado `propuesta`), que modifica el 0010; se descarta reescribir el 0010 porque la decisión aprobada cambia, no solo un
selector. Descartado: un ajuste para elegir en qué páginas fijar (nadie lo pide).

### 2. Hallazgo: "no puedo colapsar la guía en overlay; solo colapsa si clico en el velo"

Revisado `content.js` (3444-3516: `syncGuidePin`, `scheduleGuidePinSync`, escuchador de `click` en captura,
`yt-navigate-start/finish`, `popstate`, `fullscreenchange`, `resize` y el `MutationObserver`) y `content.css`
(1323-1386). **No se encuentra causa en nuestro código**:

- Si se ve el velo (`#scrim`), la clase **no** está puesta: con la clase, `#scrim` lleva `display: none !important`. Y
  sin la clase no aplica ninguna regla del bloque de la guía fija (todas cuelgan de `html.youtube-groups--guide-pinned`).
- El escuchador de captura solo actúa con la clase puesta y solo sobre `ytd-masthead #guide-button`; el ☰ de la
  cabecera propia del cajón (`tp-yt-app-drawer#guide #guide-content > #header #guide-button`) no está dentro de
  `ytd-masthead`, así que nunca se bloquea.
- Ningún otro escuchador nuestro de `document`/`window` detiene eventos (los `mousedown` de los desplegables solo los
  cierran; el escudo de eventos está en cada control, no en la guía). El panel flotante está abajo a la derecha.
- `syncGuidePin` es idempotente y se recalcula al terminar cada navegación; aunque `event.detail` no fuera accesible en
  `yt-navigate-start`, `yt-navigate-finish` corrige la clase.

Hipótesis a verificar (no se arregla en este plan): **H1**, es comportamiento de YouTube (con la extensión desactivada
pasa lo mismo). **H2**, estado interno de YouTube heredado de la guía fija: si el cajón estaba abierto (`opened`) cuando
se puso la clase (por ejemplo, al elegir un grupo desde el cajón y pasar a suscripciones), YouTube lo sigue creyendo
abierto mientras lo forzamos y, al quitar la clase, reaparece como overlay en un estado que ☰ no cierra bien. Con el
cambio 1 casi todas las páginas dejan de tener la clase, así que H2 solo podría darse al salir de suscripciones. Si V5
confirma H2, el arreglo se propone aparte (con una línea en **Cambios aprobados** o un plan nuevo); no se inventa ahora.

### 3. Botones sobre el reproductor en `/watch`

Se muestra sobre `#movie_player` la misma columna que en las miniaturas (+G "Añadir a grupo", "Marcar visto", "Lista"),
con el mismo aspecto (arriba a la izquierda, colapsados, solo el botón con el cursor o el foco muestra su texto), solo
cuando el vídeo **no** se reproduce (pausado o terminado) y nunca en pantalla completa.

- **Lógica pura** en `modules/pages.js` (ya decide qué se muestra por página; no hace falta módulo nuevo ni tocar
  `manifest.json` ni `tests/helpers/load-modules.js`): `shouldShowPlayerControls({ pageType, paused, fullscreen,
  adShowing })` → `true` solo si `pageType === "watch"`, `paused === true`, `fullscreen !== true` y `adShowing !==
  true`. Durante un anuncio (`#movie_player.ad-showing`) se ocultan: los botones serían del vídeo principal, no del
  anuncio.
- **Mismas funciones que "Vídeo actual" del panel** (no las de la tarjeta, que leen de un `card`): canal con
  `getCurrentVideoChannel()`, ID con `getCurrentVideoId()` + `isWatchPageInSync()`, datos de lista con
  `getCurrentWatchVideoData()`, y `openSubscriptionGroupsForm`, `toggleVideoWatched` (con `autoMarkHandledIds.add`,
  como el botón del panel) y `openPlaylistForm`. Glifos y textos con `setCardButtonContent` y `updateWatchedButton`,
  igual que en las miniaturas. Se descarta reutilizar `createSubscriptionChannelControl(card, …)`: obligaría a fingir una
  tarjeta o a meter resolvedores en una función que usan todas las tarjetas.
- **Estado de reproducción**: `video.paused` del `<video>` dentro de `#movie_player` (cierto también al terminar),
  leído en cada sincronización, y eventos `play`, `pause` y `ended` escuchados en `document` en fase de captura (los
  eventos de medios no burbujean; es el mismo patrón que `timeupdate`), filtrados a vídeos dentro de `#movie_player`.
  Se descarta la clase `paused-mode` de `.html5-video-player`: `.html5-video-player` también es el reproductor de las
  vistas previas de inicio y exigiría observar atributos de clase.
- **Un solo control**: `#movie_player` se conserva entre navegaciones SPA; el control se crea una vez dentro de él
  (clase `youtube-groups__player-actions`) y en cada sincronización se reutiliza, se reubica si YouTube recrea el
  reproductor y se borra cualquier otro con esa clase. Los estados de los botones se recalculan del vídeo actual en cada
  sincronización, así que siguen al vídeo tras `yt-navigate-finish` sin duplicarse.

## Tareas

Reglas comunes: sin dependencias nuevas; sin tests de DOM (fuera de alcance, como en `gui-2` y `gui-6-*`); el DOM se
verifica a mano (V*). Una tarea por commit, con `make lint` y `make test` en verde.

- [x] T1 · Guía fija solo en suscripciones · Ficheros: `modules/pages.js` (`shouldPinGuide`: `pageType ===
  "subscriptions"` en lugar de `pageType !== "watch"`; JSDoc), `tests/pages.test.js` (el test "shouldPinGuide fija la
  guía fuera de watch…" pasa a: `subscriptions` → `true` a 792 y 1400 px; `false` a 791 px y con pantalla completa;
  `home`, `search`, `shorts`, `channel`, `other` y `watch` → `false` a 1400 px; se mantiene el caso de `/live/<id>`),
  comentarios que digan "fuera de /watch" en `content.js` (~3449-3451 y ~3479) y `content.css` (~1323) · Test:
  `make test` (`tests/pages.test.js`) y V1–V2.
- [x] T2 · Documentar la guía fija en suscripciones · Ficheros: `docs/adr/0012-guia-fija-solo-en-suscripciones.md`
  (estado `aceptada`), `docs/adr/0010-seccion-en-la-guia-de-youtube-fija.md` (cabecera: "Modificado por: 0012"; no se
  reescribe el resto), `docs/ARCHITECTURE.md` (fila de `modules/pages.js`: `shouldPinGuide` solo en `subscriptions`;
  flujo **Guía lateral**: "En `/watch` y por debajo de 792 px…" pasa a "Fuera de suscripciones y por debajo de 792
  px…"; **Decisiones**: enlace al 0012) · Test: `make lint`.
- [x] T3 · Decisión pura de los botones del reproductor · Ficheros: `modules/pages.js` (`shouldShowPlayerControls({
  pageType, paused, fullscreen, adShowing })`, exportada), `tests/pages.test.js` · Test: nuevo test en
  `tests/pages.test.js`: `watch` + pausado → `true`; reproduciendo → `false`; pantalla completa → `false`; anuncio →
  `false`; `home`, `subscriptions`, `shorts`, `search`, `channel`, `other` pausados → `false`; `paused` no booleano
  (`undefined`) o argumento ausente/`null` → `false` sin lanzar.
- [x] T4 · Refactor sin cambio de comportamiento para reutilizar en el reproductor · Ficheros: `content.js`: extraer
  de `createSubscriptionChannelControl` (~2342-2363) el escudo de eventos a `shieldControlEvents(control)` (mismos
  tipos y mismas llamadas) y usarlo allí; extraer el manejador del botón "Marcar visto" del panel (~945-953) a
  `toggleCurrentVideoWatched(button)` (añade el ID a `autoMarkHandledIds` y llama a `toggleVideoWatched`) y usarlo allí
  · Test: `make test`; a mano, V6 (los botones de miniatura y "Vídeo actual" funcionan igual).
- [x] T5 · Botones sobre el reproductor en `/watch` · Ficheros: `content.js`, `content.css` · Test: `make lint`,
  `make test` y V6–V12. Contenido:
  - `createPlayerControl()`: `<span>` con clases `youtube-groups__subscription-control
    youtube-groups__card-actions--overlay youtube-groups__player-actions` (las dos primeras dan el estilo de las
    miniaturas, no compacto) y tres botones con las mismas clases y contenido que la miniatura: +G
    (`youtube-groups__subscription-add-button`, `setCardButtonContent(b, "+G", "Añadir a grupo", false)`), visto
    (`youtube-groups__watched-button`) y lista (`youtube-groups__playlist-button`, glifo `playlist-add`, "Lista").
    `shieldControlEvents(control)` más `keydown` con `stopPropagation` solo en este control (para que Espacio o Intro
    sobre un botón no lleguen a los atajos del reproductor; no se toca el escudo de las miniaturas). Clics: +G →
    `openSubscriptionGroupsForm(getCurrentVideoChannel(), button)`; visto → `toggleCurrentVideoWatched(button)`;
    lista → `openPlaylistForm(getCurrentWatchVideoData(), button)`; los tres con `preventDefault` y `stopPropagation`.
  - `syncPlayerControl()` (idempotente): si la página no es `watch`, oculta cualquier control existente y sale sin
    crear. Si lo es y existe `#movie_player`, asegura un único control dentro de él (crea, mueve si está fuera, borra
    duplicados). Calcula `shouldShowPlayerControls` con el `<video>` de `#movie_player` (sin vídeo, `paused: true`),
    `document.fullscreenElement !== null` y `ad-showing`, y pone `control.hidden`. Si es visible, refresca: +G
    deshabilitado sin canal (`getCurrentVideoChannel()`, con `title` "No se pudo identificar el canal" como
    `updateAddButtonAvailability`); visto con `updateWatchedButton(btn, id, isWatched)` usando `null` como id si
    `!isWatchPageInSync(id)`; lista deshabilitada sin id.
  - `schedulePlayerControlSync()`: como mucho una vez por frame (patrón de `scheduleGuidePinSync`).
  - Cuándo: al arrancar; `play`, `pause` y `ended` en captura sobre `document` (solo si `event.target` es un `<video>`
    dentro de `#movie_player`); `yt-navigate-start` (oculta el control, para no enseñar el vídeo anterior);
    `yt-navigate-finish`; `fullscreenchange`; al final de `refreshWatchedUi` (cambios de visto, manual, automático o de
    otra pestaña); en el `requestAnimationFrame` de `scheduleCurrentChannelPanelUpdate` **antes** de su salida temprana
    (el canal del vídeo llega tarde); y desde el `MutationObserver` solo si la página es `watch` y `#movie_player` existe
    sin nuestro control (llamada barata, no en cada mutación).
  - `content.css`: `.youtube-groups__player-actions[hidden] { display: none !important; }` (la regla de la columna pone
    `display: flex` y anularía `hidden`), y para `.youtube-groups__player-actions` un `top`/`left` de 12 px y un
    `z-index` por encima de los controles del reproductor (punto de partida 60; se ajusta en V7 con una línea en
    **Cambios aprobados** si hace falta). No se toca `position` de `#movie_player` (YouTube ya lo posiciona).
- [ ] T6 · Documentación y cierre · Ficheros: `docs/ARCHITECTURE.md` (fila de `modules/pages.js`:
  `shouldShowPlayerControls`; fila de `content.js`: botones sobre el reproductor; flujo **Detección** o uno nuevo
  **Botones del reproductor** con `#movie_player`, `video.paused`, eventos y `youtube-groups__player-actions`; flujo
  **Marcar como visto** y **Listas**: también desde el reproductor), este plan (resultado de V3–V5 y estado `hecho`) ·
  Test: `make lint`.

### Verificación manual (tu Firefox con sesión; recarga la extensión en `about:debugging`)

Guía (cambio 1):

- V1 · A ~1000 px y a ~1400 px en `/feed/subscriptions`: guía fija con la sección, una sola cabecera, ☰ del masthead sin
  efecto; filtros por grupo y filtros avanzados funcionan como antes.
- V2 · A ~1000 px en `/`, en una página de canal, en búsqueda y en `/watch`: mini-guía de YouTube, ☰ abre el cajón con
  velo y la sección "YouTube Groups" dentro; a ~1400 px en `/`, guía persistente de YouTube y ☰ la colapsa a mini-guía.
  Elegir un grupo desde el cajón en `/` lleva a suscripciones con la guía fija y el filtro aplicado.

Hallazgo ☰ (cambio 2; se anota el resultado en este plan en T6):

- V3 · **Extensión desactivada**, `/watch` (y `/` a ~1000 px): ☰ del masthead abre el cajón; ☰ de la cabecera del
  cajón, ¿lo cierra? Si no lo cierra, es H1 (YouTube) y no se hace nada.
- V4 · Extensión activada, mismas páginas y pasos que V3, recargando la página antes: ¿mismo resultado que V3?
- V5 · Extensión activada, a ~1000 px: en `/` abre el cajón, elige un grupo (navega a suscripciones con la guía fija) y
  vuelve a `/` con el enlace "Inicio" de la guía: ¿aparece el cajón abierto sin haberlo pedido, y su ☰ no lo cierra?
  Si V4 coincide con V3 pero V5 falla, es H2: se anota y se propone el arreglo aparte.

Reproductor (cambio 3):

- V6 · En `/feed/subscriptions`, `/` y las recomendaciones de `/watch`, los botones de miniatura siguen igual
  (colapsados, se expanden con el cursor, no abren el vídeo, +G, visto y lista funcionan); "Vídeo actual" del panel
  funciona igual.
- V7 · En `/watch`, con el vídeo reproduciéndose no hay botones; al pausar aparece la columna arriba a la izquierda del
  reproductor, con el mismo aspecto que en las miniaturas; solo el botón con el cursor muestra su texto; no tapa nada
  importante del reproductor y queda por encima de sus controles.
- V8 · Pulsar cada botón con el vídeo en pausa no reanuda la reproducción ni cambia a pantalla completa: +G abre el
  selector de grupos del canal del vídeo y guarda; visto alterna (y "Vídeo actual" del panel y las tarjetas con ese ID
  cambian a la vez); lista abre el selector de listas con título y canal correctos. Con el foco en un botón, Espacio lo
  pulsa sin reanudar el vídeo.
- V9 · Al terminar el vídeo (sin reproducción automática) aparecen los botones; al reanudar desaparecen.
- V10 · Pantalla completa (F o el botón del reproductor) con el vídeo en pausa: no hay botones; al salir vuelven.
- V11 · Navegación SPA: desde `/watch` pausado, pulsar una recomendación: los botones desaparecen durante la carga, el
  nuevo vídeo se reproduce sin botones y al pausarlo aparecen **una sola** columna con el estado del vídeo nuevo (visto,
  canal). Volver con "atrás" y repetir. Ir a `/` con el vídeo en el minirreproductor: no hay botones sobre él.
- V12 · Con un anuncio en curso pausado no hay botones; tras el anuncio, al pausar, sí.

## Criterios de aceptación

- La guía solo queda forzada abierta y fija en `/feed/subscriptions` (≥ 792 px, sin pantalla completa); en el resto
  de páginas YouTube se comporta como sin la extensión, y la sección "YouTube Groups" aparece en su guía o su cajón.
- Para el hallazgo de ☰, el plan recoge el resultado de V3–V5 y, si la causa es nuestra, una propuesta de arreglo
  pendiente de aprobar; no se cambia código por suposición.
- En `/watch`, con el vídeo en pausa o terminado y sin pantalla completa ni anuncio, se ve sobre el reproductor una
  única columna con +G, visto y lista, con el aspecto de las miniaturas; reproduciendo o a pantalla completa no se ve.
- Los botones del reproductor actúan sobre el vídeo y el canal actuales, también tras navegaciones SPA, y pulsarlos no
  cambia la reproducción.
- Los filtros de `/feed/subscriptions`, los botones de miniatura y "Vídeo actual" del panel funcionan como antes.
- `make lint` y `make test` en verde.

## Fuera de alcance

- Arreglar el hallazgo de ☰ si V3–V5 no señalan nuestro código (o arreglarlo en este plan sin una línea en **Cambios
  aprobados**).
- Botones sobre el reproductor de `/shorts`, del minirreproductor o de las vistas previas de inicio.
- Que visto y lista funcionen en `/live/<id>`: es `watch` y la columna se muestra, pero esos dos botones quedan
  deshabilitados porque `extractVideoId` no reconoce esa ruta (igual que hoy en "Vídeo actual"); no se cambia.
- Cambiar el CSS de la guía fija, el bloqueo de ☰ o `syncGuidePin` más allá de los comentarios.
- Un ajuste para activar o desactivar los botones del reproductor o elegir dónde se fija la guía.
- Tests automáticos de DOM o CSS.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |
| 2026-11-15 | T5 (corrección) | Marca de "navegando" entre `yt-navigate-start` y `yt-navigate-finish` que `syncPlayerControl` respeta (control oculto mientras dura); +G deshabilitado si hay `getCurrentVideoId()` y no pasa `isWatchPageInSync`; el observer comprueba una referencia guardada al control (`isConnected` y padre `#movie_player`) en lugar de `querySelector`; el escudo de teclado cubre también `keyup` | Revisión: durante la navegación SPA el control podía reaparecer con el canal del vídeo anterior (incumple V11); coste del observer; Espacio se activa en `keyup` en Firefox | Delegada por la persona (usar la opción recomendada) |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-15 | T1 | `feat: fijar la guía de YouTube solo en suscripciones` | `shouldPinGuide` exige `subscriptions`; test y comentarios actualizados. V1-V2 pendientes a mano. |
| 2026-11-15 | T2 | `docs: documentar la guía fija solo en suscripciones` | ADR 0012 aceptada, 0010 enlazado como modificado y ARCHITECTURE actualizada. |
| 2026-11-15 | T3 | `feat: decidir cuándo mostrar los botones del reproductor` | `shouldShowPlayerControls` en `modules/pages.js` con su test. |
| 2026-11-15 | T4 | `refactor: extraer el escudo de eventos y el marcado de visto actual` | `shieldControlEvents` y `toggleCurrentVideoWatched` en `content.js`, sin cambio de comportamiento. V6 pendiente a mano. |
| 2026-11-15 | T5 | `feat: mostrar los botones de grupo, visto y lista sobre el reproductor en pausa` | `createPlayerControl`, `syncPlayerControl` y programación en `content.js`, más CSS. V6-V12 pendientes a mano; el z-index 60 se ajusta en V7. |
| 2026-11-15 | T5 (corrección) | `fix: ocultar los botones del reproductor durante la navegación y endurecer su sincronización` | Marca `playerNavigating` entre `yt-navigate-start` y `yt-navigate-finish`; +G deshabilitado si la página no está sincronizada; el observer usa la referencia `playerControl`; escudo también en `keyup`. V11 pendiente a mano. |
