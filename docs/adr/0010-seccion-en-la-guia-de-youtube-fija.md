# 0010 · Sección en la guía de YouTube, con la guía forzada abierta y fija fuera de /watch

- Estado: aceptada
- Fecha: 2026-11-15
- Sustituye a: [0008](0008-columna-propia-que-desplaza-el-contenido.md)
- Modificado por: [0012](0012-guia-fija-solo-en-suscripciones.md), [0017](0017-menu-de-opciones-en-la-guia.md)

## Contexto

La columna propia del ADR 0008 resuelve que la sección se vea siempre, pero tras probarla (2026-11-15) a la persona no
le convence su usabilidad: dos columnas a la izquierda (la guía de YouTube y la nuestra) y 240 px menos de contenido.
Decide volver a meter "YouTube Groups" **dentro de la guía de YouTube** (encima de "Más de YouTube", como en el plan
`gui-3`) y, para que no vuelva el problema que motivó el 0008 (mini-guía y cajón superpuesto), **forzar** que la guía
de YouTube esté siempre abierta y fija, desplazando el contenido, en todas las páginas **salvo `/watch`**, donde YouTube
se comporta como siempre (cajón de ☰ superpuesto, modo cine y pantalla completa sin cambios). La persona ha visto otras
extensiones que lo hacen, también en `/shorts` y `/feed/subscriptions`, sin desbordamiento horizontal.

Estado de YouTube: `tp-yt-app-drawer#guide` contiene la guía (`ytd-guide-renderer`); es fija y desplaza el contenido
solo en modo persistente (`ytd-app[guide-persistent-and-visible]`, a partir de ~1313 px). Por debajo, YouTube muestra
`ytd-mini-guide-renderer` (72 px) y la guía pasa a ser un cajón con velo (`#scrim`). En `/watch` es siempre cajón. El
margen del contenido lo pone el CSS de YouTube en `ytd-page-manager#page-manager` según esos atributos de `ytd-app`.

## Decisión

1. **Sección**: vuelve a `ytd-guide-renderer #sections`, antes de la sección de "Más de YouTube"
   (`findGuideInsertionIndex`, sin depender del idioma), con toda la mecánica actual (columna deslizable, crear,
   selección, "Limpiar selección"). En `/watch` está en el cajón de ☰. Desaparece la columna propia.
2. **Guía fija solo con CSS bajo una clase**: el content script pone `youtube-groups--guide-pinned` en `<html>` cuando
   `shouldPinGuide(pageType, anchoVentana, pantallaCompleta)` es cierto: la página **no** es `watch`, el ancho es
   **≥ 792 px** (donde YouTube ya reserva el margen de la mini-guía) y no hay pantalla completa. Con la clase, reglas
   de `content.css` (todas con el prefijo `html.youtube-groups--guide-pinned`, con `!important` donde YouTube fija el
   valor):
   - `ytd-mini-guide-renderer` oculta.
   - `tp-yt-app-drawer#guide` y su `#contentContainer` visibles, sin `transform`, sin sombra y bajo el masthead
     (`top: var(--ytd-masthead-height, 56px)`); `#scrim` oculto; la cabecera propia del cajón (☰ y logo), si se pinta,
     oculta.
   - `ytd-page-manager#page-manager` con `margin-left: var(--app-drawer-width, 240px)`, y lo que haga falta para que no
     haya desbordamiento horizontal ni elementos fijos de la página (barra de chips, `#frosted-glass`, Shorts) mal
     alineados.

   Selectores finales (todos bajo `html.youtube-groups--guide-pinned`):
   - `ytd-mini-guide-renderer` (`display: none`).
   - `tp-yt-app-drawer#guide` (host): visible, sin `transform` ni sombra, con `top: var(--ytd-masthead-height, 56px)`,
     `bottom: 0`, `right: auto`, `width: var(--app-drawer-width, 240px)` y `pointer-events: none`. Fuera del modo
     persistente el host es `position: fixed` con `left: 0; right: 0`; sin ese ancho y sin `pointer-events: none`
     cubriría la página entre 792 y ~1312 px y se comería los clics. Las dos cosas a la vez: la primera quita la
     causa, la segunda protege si YouTube cambia el ancho.
   - `tp-yt-app-drawer#guide #contentContainer`: visible, sin `transform` ni sombra, `top: 0`, sin `padding` vertical
     y `pointer-events: auto` (la guía sí recibe clics).
   - `tp-yt-app-drawer#guide #guide-spacer` (`display: none`) y `#scrim` (oculto);
     la cabecera propia del cajón (☰ y logo), `tp-yt-app-drawer#guide #guide-content > #header` (y, por si cambia la estructura, `#guide-wrapper > #header`) (oculta; YouTube solo
     la oculta en modo persistente y se vería duplicada con la del masthead).
   - **Desplazamiento vertical único en el host**: antes se sumaban el `top` del host, el de `#contentContainer` y
     `#guide-spacer` (~168 px). Se descarta dejar el host en `top: 0` y que `#guide-spacer` desplace: fuera del modo
     persistente el cajón tiene un `z-index` por encima del masthead y taparía el logo y la búsqueda; con el host bajo
     el masthead no puede pasar y el resultado no depende de cómo YouTube dimensione `#guide-spacer`.
   - `ytd-page-manager#page-manager` (`margin-left: var(--app-drawer-width, 240px)`).
   - `ytd-app`: `overflow-x: clip` (no `hidden`: `hidden` crea un contenedor de scroll y rompe los `position: sticky`
     de la página; `clip` recorta sin crearlo, Firefox ≥ 81) y `--ytd-mini-guide-width: var(--app-drawer-width,
     240px)`, de modo que todo lo que YouTube alinea con la mini-guía se alinea con la guía.
   - Elementos fijos con valor fijo, `left: var(--app-drawer-width, 240px)`: `#frosted-glass`,
     `ytd-rich-grid-renderer #header ytd-feed-filter-chip-bar-renderer`, `ytd-rich-grid-renderer #header
     #chips-wrapper` y `ytd-shorts`. `left` no afecta a elementos sin posicionar.

   Se escribieron a partir del conocimiento del DOM de YouTube, sin inspección en vivo; los ajustes que salgan de la
   verificación manual (V1–V6 del plan `gui-6-correcciones`) se anotarán aquí. `/live/<id>` se clasifica como `watch`
   (página de vídeo): no se fija la guía y allí se comporta como `/watch`.
3. **Cuándo se recalcula** (`syncGuidePin`, idempotente): al arrancar, en `yt-navigate-start`, `yt-navigate-finish`,
   `popstate`, `fullscreenchange`, `resize` (como mucho una vez por frame) y desde el `MutationObserver` si
   `location.pathname` ha cambiado desde la última vez. En `yt-navigate-start` se usa la ruta de destino
   (`event.detail.url`) para clasificar la página, para que la guía no quede fija durante la transición a `/watch`;
   la ruta guardada para detectar cambios sigue siendo `location.pathname`. Así, al ir a `/watch` la clase se quita al vuelo y YouTube
   recupera su comportamiento normal sin recargar.
4. **Botón ☰ en páginas fijadas**: sin efecto. Un escuchador de `click` en `document`, en fase de captura, detiene el
   evento si la clase está puesta y el objetivo está dentro de `ytd-masthead #guide-button`. Así el estado interno de
   YouTube (cajón abierto, velo, bloqueo de scroll, preferencia guardada) no cambia mientras la forzamos. En `/watch` y
   por debajo de 792 px, ☰ funciona como siempre.
5. **Ajuste `sidebarCollapsed`**: se retira de `youtubeSettings` (ADR 0003). `normalizeSettings` ya conserva solo los
   campos conocidos, así que los valores guardados y las copias antiguas con ese campo se leen sin error y lo pierden
   en la siguiente escritura. No sube `version`.

## Alternativas descartadas

- Mantener la columna propia (ADR 0008): es lo que la persona rechaza.
- Cambiar el estado de YouTube con atributos (`persistent` y `opened` en `tp-yt-app-drawer#guide`,
  `guide-persistent-and-visible` en `ytd-app`): Polymer convierte esos atributos en propiedades y dispara su lógica
  (velo, bloqueo de scroll, foco, preferencia guardada) y YouTube los vuelve a escribir al redimensionar o navegar; hay
  que vigilarlos y deshacerlos bien al entrar en `/watch`. Queda como reserva solo si el CSS no basta (por ejemplo, si
  la guía no tiene contenido hasta abrirse una vez) y con un cambio aprobado en el plan.
- `wrappedJSObject` para tocar propiedades internas de `ytd-app`: depende de API interna no pública, falla en
  silencio y rompe el aislamiento del content script.
- Pulsar ☰ por programa para abrir la guía: alterna, depende del estado previo y deja el cajón con velo.
- Forzar también por debajo de 792 px: 240 px de guía dejan menos de 550 px de contenido.
- Que ☰ quite y ponga el forzado: la persona pide la guía siempre abierta y fija.

## Consecuencias

- Se gana: una sola columna a la izquierda (la de YouTube) con la sección dentro, siempre visible fuera de `/watch` y
  sin tapar el contenido. Quitar la clase devuelve exactamente el comportamiento de YouTube.
- Se pierde: en `/watch` la sección vuelve a estar solo en el cajón de ☰ (aceptado por la persona); ☰ no hace nada en
  las páginas fijadas; por debajo de 792 px la sección solo está en el cajón.
- A vigilar: dependemos de `tp-yt-app-drawer#guide`, `#contentContainer`, `#guide-spacer`, `#scrim`,
  `#guide-content > #header`, `#guide-wrapper > #header`, `ytd-mini-guide-renderer`, `ytd-page-manager#page-manager`, la variable `--ytd-mini-guide-width`, `#frosted-glass`,
  la barra de chips (`ytd-feed-filter-chip-bar-renderer`, `#chips-wrapper`), `ytd-shorts`, `#guide-button`, de
  `overflow-x: clip` y `pointer-events` (soportados por Firefox) y de que `ytd-guide-renderer` tenga contenido sin haberse abierto.
  Si YouTube los cambia, la guía deja de forzarse (vuelve su comportamiento normal) o queda mal colocada; la sección
  sigue funcionando en la guía o el cajón. Si cambia el DOM de la guía y la sección no aparece, no se puede filtrar
  hasta corregirlo (el riesgo del ADR 0007 vuelve).
