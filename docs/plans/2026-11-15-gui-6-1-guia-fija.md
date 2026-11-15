# Plan: GUI 6 (1/3) · Sección de vuelta en la guía de YouTube, forzada abierta y fija fuera de /watch

**Estado:** aprobado (2026-11-15)

Issue: feedback de la persona tras probar la serie `2026-11-15-gui-5-*` en Firefox (2026-11-15), punto 1.

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

Orden de la serie GUI 6: **este plan** → `2026-11-15-gui-6-2-seleccion-hermanos` → `2026-11-15-gui-6-3-boton-crear`.
ADR asociado: `docs/adr/0010-seccion-en-la-guia-de-youtube-fija.md` (propuesta; sustituye al 0008; se acepta al
cerrar). Actualiza ADR 0003 (se retira `sidebarCollapsed`).

## Contexto y decisión

La columna propia (`gui-5-1`, ADR 0008) no convence. Decidido por la persona (2026-11-15): la sección "YouTube Groups"
vuelve **dentro de la guía de YouTube**, encima de "Más de YouTube" (como `gui-3`), con toda su mecánica actual, y la
guía de YouTube se **fuerza abierta y fija** (desplaza el contenido, sin cajón, sin velo y sin mini-guía) en todas las
páginas **salvo `/watch`**, que queda como en YouTube. Técnica (ADR 0010): solo CSS bajo la clase
`youtube-groups--guide-pinned` en `<html>`; se descartan tocar atributos o propiedades internas de YouTube
(`wrappedJSObject`) y mantener la columna propia.

### Decisiones

- **Pura** en `modules/pages.js`: `PINNED_GUIDE_MIN_WIDTH = 792` y `shouldPinGuide(pageType, width, isFullscreen)` →
  `true` si `pageType !== "watch"`, `width >= 792` y `!isFullscreen`.
- **Pura** en `modules/guide.js`: vuelve `findGuideInsertionIndex(sections)` tal como la define `gui-3` (array de
  arrays de `href` por `ytd-guide-section-renderer`; índice de la primera con enlace a `studio.youtube.com`,
  `music.youtube.com`, `youtubekids.com`, `www.youtubekids.com` o `tv.youtube.com`; `-1` si no hay; relativos contra
  `https://www.youtube.com`; no válidos se ignoran).
- **Sección en la guía** (`content.js`): `renderGuideSection` pinta en `ytd-guide-renderer #sections`, antes de la
  sección que da `findGuideInsertionIndex` (con `-1`, tras la primera), y solo la mueve si no está en su sitio. Si no
  hay guía, no pinta. `scheduleSidebarCheck` pasa a `scheduleGuideCheck` (una comprobación por frame, desde el
  `MutationObserver` cuando la sección no está conectada o no está en su sitio). La mecánica de la sección no cambia.
- **Se elimina** la columna propia: `SIDEBAR_ID`, `applySidebarState`, `toggleSidebar`, `ensureSidebar`,
  `paintSidebarSection` (pasa a `paintGuideSection`), el escuchador de `fullscreenchange` de la columna, `settingsReady`
  si queda sin uso, y en `content.css` todo lo de `#youtube-groups-sidebar`, `.youtube-groups__sidebar-toggle` y
  `html.youtube-groups--sidebar*` / `--fullscreen`.
- **Guía fija** (`content.js` + `content.css`, ADR 0010 punto 2–4): `syncGuidePin()` pone o quita
  `youtube-groups--guide-pinned` según `shouldPinGuide(getPageType(location.pathname), innerWidth,
  document.fullscreenElement !== null)`; se llama al arrancar, en `yt-navigate-start`, `yt-navigate-finish`,
  `popstate`, `fullscreenchange`, `resize` (con `requestAnimationFrame`, una vez por frame) y desde el
  `MutationObserver` si `location.pathname` cambió. ☰ (`ytd-masthead #guide-button`) se neutraliza con un `click` en
  captura en `document` solo mientras la clase está puesta. Los selectores CSS exactos se ajustan inspeccionando el
  DOM (siempre bajo la clase) y se anotan en el ADR 0010 al cerrar.
- **Ajuste `sidebarCollapsed`**: se quita de `DEFAULT_SETTINGS`, `ALLOWED_VALUES`, `SIDEBAR_COLLAPSED_VALUES` y JSDoc.
  No sube `version`: `normalizeSettings` ignora el campo si viene guardado o en una copia.

## Tareas

Reglas comunes: sin `innerHTML` con datos; JSDoc; sin dependencias nuevas; `make lint` (0 avisos) y `make test` en
verde; tema claro y oscuro. Los botones sobre la miniatura y el panel flotante no se tocan.

- [ ] T1 · `shouldPinGuide` y `PINNED_GUIDE_MIN_WIDTH` en `pages.js`; `findGuideInsertionIndex` en `guide.js` ·
  Ficheros: `modules/pages.js`, `tests/pages.test.js`, `modules/guide.js`, `tests/guide.test.js` · Test:
  `shouldPinGuide` da `true` en `home`, `subscriptions`, `shorts`, `channel`, `search`, `other` con 792 y 1400; `false`
  en `watch`, con 791 y con pantalla completa; `findGuideInsertionIndex` encuentra la sección con
  `https://studio.youtube.com/` o `https://music.youtube.com/` aunque haya `/feed/history` y hrefs relativos o no
  válidos, da `-1` sin ellas y no muta la entrada.
- [ ] T2 · Sección de vuelta en la guía de YouTube y eliminación de la columna propia (ver **Decisiones**) · Ficheros:
  `content.js`, `content.css` · Test: `make lint`, `make test` y a mano V1, V5.
- [ ] T3 · Guía forzada abierta y fija fuera de `/watch`: `syncGuidePin`, reglas CSS bajo
  `html.youtube-groups--guide-pinned` y ☰ neutralizado · Ficheros: `content.js`, `content.css` · Test: `make lint`,
  `make test` y a mano V2–V4, V6. Si la guía forzada aparece vacía (sin contenido hasta abrir ☰) o el CSS no basta,
  **parar** y proponer en **Cambios aprobados** la alternativa de reserva del ADR 0010.
- [ ] T4 · Retirar `sidebarCollapsed` y ADR 0003 al día (campo retirado por este plan, sin subir `version`) · Ficheros:
  `modules/settings.js`, `tests/settings.test.js`, `tests/backup.test.js`,
  `docs/adr/0003-formato-almacenamiento-ajustes.md` · Test: `getSettings()` sin datos no tiene `sidebarCollapsed`;
  `normalizeSettings({ sidebarCollapsed: true, watchedMode: "hide" })` da los valores por defecto sin ese campo y
  `watchedMode: "hide"`; `updateSettings({ sidebarCollapsed: true })` lanza; importar una copia con
  `sidebarCollapsed` funciona y los ajustes guardados no lo incluyen. Los tests que lo esperaban se cambian (cambio
  intencionado).
- [ ] T5 · Cerrar: `docs/ARCHITECTURE.md` (fila de `pages.js` con `shouldPinGuide`, `guide.js` con
  `findGuideInsertionIndex`, `settings.js` sin `sidebarCollapsed`, `content.js`; flujo **Columna lateral** pasa a
  **Guía lateral** con la sección en `ytd-guide-renderer` y la guía fija del ADR 0010; enlaces a ADR); ADR 0010 a
  `aceptada` con los selectores finales; ADR 0008 a "sustituida por 0010". Estado de este plan a `hecho` · Ficheros:
  `docs/ARCHITECTURE.md`, `docs/adr/0010-seccion-en-la-guia-de-youtube-fija.md`,
  `docs/adr/0008-columna-propia-que-desplaza-el-contenido.md`, este plan · Test: `make lint` y `make test`.

### Verificación manual (tu Firefox con sesión, extensión recargada en `about:debugging`)

- V1 · Ventana ancha en `/`: "YouTube Groups" dentro de la guía, justo encima de "Más de YouTube"; no hay columna
  propia. Tras navegar varias veces hay una sola sección.
- V2 · Ventana de ~1000 px en `/`, `/feed/subscriptions`, `/results?search_query=x`, una página de canal y un
  `/shorts/…`: guía completa abierta (no mini-guía), sin velo, contenido a su derecha, sin barra de scroll horizontal
  y la barra de chips de inicio bien alineada. ☰ no hace nada. El Short y sus botones se usan con normalidad.
- V3 · Desde `/` ir a un vídeo: en `/watch` guía como en YouTube (cajón con ☰, por encima del contenido); modo cine
  (`t`) y pantalla completa (`f`) como siempre. Volver atrás: la guía vuelve a estar fija sin recargar. Cargar
  directamente un `/watch` y después ir a `/` por un enlace: guía fija y con contenido.
- V4 · Estrechar la ventana por debajo de 792 px: comportamiento normal de YouTube (☰ abre el cajón con la sección).
  Ensancharla: guía fija otra vez.
- V5 · En la sección: crear grupo y subgrupo con icono, "›"/"‹" con animación, desplegar canales, seleccionar, "Limpiar
  selección" y pasar a suscripciones desde `/` y desde el cajón de `/watch`.
- V6 · Regresión en `/feed/subscriptions` con un grupo elegido: Filtros (duración, fecha, visualizaciones), Vídeos
  vistos (mostrar, atenuar, ocultar) y Vídeos fuera del filtro (ocultar, atenuar) como antes; botones de miniatura y
  panel flotante iguales. Tema claro y oscuro.

## Criterios de aceptación

- "YouTube Groups" está dentro de la guía de YouTube, encima de "Más de YouTube", con toda su mecánica; no existe la
  columna propia.
- Fuera de `/watch` y con la ventana de 792 px o más, la guía de YouTube está siempre abierta y fija, desplaza el
  contenido, sin mini-guía, sin velo y sin desbordamiento horizontal; ☰ no la cierra.
- En `/watch` (y por debajo de 792 px) YouTube se comporta como siempre, también al navegar entre páginas sin recargar.
- Ajustes compatibles: un `sidebarCollapsed` guardado o importado se ignora sin error. Filtros de suscripciones,
  botones de miniatura y panel flotante igual; sin dependencias nuevas.

## Fuera de alcance

- Reglas de selección (`gui-6-2`) y texto del botón de crear (`gui-6-3`).
- Cambiar el ancho de la guía o mover el masthead; guía fija en `/watch`.
- Botones sobre la miniatura, panel flotante, YouTube móvil y `/embed`.
- Tests de DOM de `content.js`.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
