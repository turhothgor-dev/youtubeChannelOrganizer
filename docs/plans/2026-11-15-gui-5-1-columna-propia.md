# Plan: GUI 5 (1/3) · Columna propia "YouTube Groups" que desplaza el contenido

**Estado:** aprobado (2026-11-15)

Issue: feedback de la persona tras probar la serie `2026-11-15-gui-*` en Firefox (2026-11-15), punto 1.

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

Orden de la serie GUI 5: **este plan** → `2026-11-15-gui-5-2-seleccion-multiple` →
`2026-11-15-gui-5-3-crear-subgrupos`. ADR asociado: `docs/adr/0008-columna-propia-que-desplaza-el-contenido.md`
(propuesta; se acepta al cerrar este plan). Actualiza ADR 0003 (ajuste nuevo).

## Contexto y decisión

La sección "YouTube Groups" está dentro de la guía de YouTube: bajo ~1300 px pasa a la mini-guía y solo se ve abriendo
el cajón de ☰, que se superpone y bloquea los clics en los vídeos (en `/watch`, siempre). Decidido por la persona
(2026-11-15): la sección sale de la guía de YouTube a una **columna propia**, fija a la izquierda, **abierta por
defecto**, que **desplaza** el contenido de YouTube, en todas las páginas (incluidos `/watch`, modo cine y `/shorts`),
oculta en pantalla completa y plegable a una tira estrecha que se recuerda.

Técnica (ADR 0008): `<aside id="youtube-groups-sidebar">` hijo de `<body>` tras `ytd-app`, `position: fixed` bajo el
masthead; se coloca a la derecha de la guía o mini-guía de YouTube con `ytd-app[guide-persistent-and-visible] ~ …` y
`ytd-app[mini-guide-visible] ~ …`; el contenido se desplaza con `padding-left` en `ytd-page-manager#page-manager`
(se suma al `margin-left` que YouTube ya pone). Se descartan mover la guía de YouTube, replicar sus márgenes con
`!important`, `:has()` y medir con JavaScript (ver ADR 0008).

La mecánica de la sección no cambia: columna deslizable con "›"/"‹", canales plegados en la raíz y desplegados en
subcolumnas, crear con icono y color, sin editar ni eliminar. Los botones sobre la miniatura **no se tocan**.

### Decisiones

- **Ajuste** `sidebarCollapsed` (`false`/`true`, por defecto `false`) en `youtubeSettings`. Campo opcional nuevo: no
  sube `version` (ADR 0003). `parseBackup` ya lo acepta vía `normalizeSettings`.
- **Columna** (`content.js`): se crea una vez, cuando se han leído los ajustes (o ha fallado la lectura, con los
  valores por defecto) y existe `ytd-app`; así el contenido se desplaza una sola vez al cargar. Estructura:
  1. Botón de plegar arriba a la derecha de la columna (`youtube-groups__sidebar-toggle`): "«" con `aria-label`
     "Plegar YouTube Groups" y `aria-expanded="true"`; plegada, es lo único visible: "»", "Mostrar YouTube Groups",
     `aria-expanded="false"`. Pulsarlo guarda `sidebarCollapsed` con `updateSettings` (mismo patrón de
     `settingsWriteSeq`/`settingsAppliedSeq` que `panelCollapsed`); si falla, `console.error` y se repinta el estado
     guardado.
  2. La sección `#youtube-groups-guide` actual (cabecera, crear, formulario, columna deslizable), igual que hoy.
- **Clases en `<html>`**: `youtube-groups--sidebar` (columna creada), `youtube-groups--sidebar-collapsed` (plegada) y
  `youtube-groups--fullscreen` (`fullscreenchange` con `document.fullscreenElement !== null`). Una función
  `applySidebarState()` las sincroniza con `settings` y el botón; se llama al crear la columna, al leer los ajustes y
  en `handleStorageChange` (`settings`), así otra pestaña se sincroniza.
- **CSS** (`content.css`):
  - `html.youtube-groups--sidebar { --youtube-groups-sidebar-width: 240px }`, plegada `40px`, y
    `html.youtube-groups--fullscreen { --youtube-groups-sidebar-width: 0px }` con `#youtube-groups-sidebar { display:
    none }`.
  - `html.youtube-groups--sidebar ytd-page-manager#page-manager { padding-left: var(--youtube-groups-sidebar-width) }`.
  - Columna: `position: fixed; top: var(--ytd-masthead-height, 56px); bottom: 0; left: 0; width:
    var(--youtube-groups-sidebar-width); overflow-y: auto; overflow-x: hidden; box-sizing: border-box`, borde
    derecho y fondo con variables de YouTube (`--yt-spec-base-background`, `--yt-spec-10-percent-layer`) y respaldo
    claro y `html[dark]`. `ytd-app[mini-guide-visible] ~ #youtube-groups-sidebar { left: 72px }` y, después,
    `ytd-app[guide-persistent-and-visible] ~ #youtube-groups-sidebar { left: 240px }`. `z-index: 2000` (por debajo
    del masthead y del cajón de ☰; se comprueba en V2). Plegada, la sección se oculta (`hidden`) y solo queda el botón.
- **Fuera de la guía de YouTube**: `renderGuideSection` pinta en la columna; se quitan `GUIDE_SECTIONS_SELECTOR`,
  `findGuideAnchor` y `YouTubeGroupsGuide.findGuideInsertionIndex` (y su test: la función desaparece a propósito).
  `scheduleGuideCheck` pasa a `scheduleSidebarCheck`: si la columna no está conectada y existe `ytd-app` (y los
  ajustes están leídos), la recrea y repinta. El enlace de suscripciones que usa `navigateToSubscriptions`
  (`ytd-guide-renderer`/`ytd-mini-guide-renderer a[href="/feed/subscriptions"]`) no cambia.

## Tareas

Reglas comunes: sin `innerHTML` con datos; JSDoc; sin dependencias nuevas; `make lint` (0 avisos) y `make test` en
verde; tema claro y oscuro.

- [x] T1 · Ajuste `sidebarCollapsed` (por defecto `false`) y ADR 0003 al día (campo nuevo, "lo introduce el plan
  `2026-11-15-gui-5-1-columna-propia`") · Ficheros: `modules/settings.js`, `tests/settings.test.js`,
  `docs/adr/0003-formato-almacenamiento-ajustes.md` (y `tests/backup.test.js` solo si compara el objeto de ajustes
  completo) · Test: `getSettings()` sin datos da `sidebarCollapsed: false`; `normalizeSettings({ sidebarCollapsed:
  "sí" })` da `false`; `true` se conserva; `updateSettings({ sidebarCollapsed: true })` escribe una vez y conserva los
  demás campos; `updateSettings({ sidebarCollapsed: 1 })` lanza. Los tests que comparan el objeto completo añaden el
  campo (cambio intencionado).
- [x] T2 · Columna vacía con su botón de plegar, clases de `<html>`, desplazamiento del contenido, posición junto a
  la guía o mini-guía de YouTube, pantalla completa y sincronización por `storage.onChanged` (ver **Decisiones**). La
  sección sigue aún en la guía de YouTube · Ficheros: `content.js`, `content.css` · Test: `make lint`, `make test` y
  a mano V1–V4.
- [ ] T3 · Pintar la sección "YouTube Groups" dentro de la columna y quitarla de la guía de YouTube;
  `scheduleSidebarCheck`; quitar `GUIDE_SECTIONS_SELECTOR`, `findGuideAnchor` y `findGuideInsertionIndex` (con su
  test); ajustar el CSS de la sección al ancho de la columna (nombres con elipsis) · Ficheros: `content.js`,
  `content.css`, `modules/guide.js`, `tests/guide.test.js` · Test: `make test` (los demás tests de `guide.test.js`
  sin cambios) y a mano V5, V6.
- [ ] T4 · Cerrar: `docs/ARCHITECTURE.md` (fila de `content.js`, `guide.js` sin `findGuideInsertionIndex`,
  `settings.js` con `sidebarCollapsed`; flujo **Guía lateral** pasa a **Columna lateral** con la técnica del ADR 0008 y
  sin el riesgo "sin guía no se puede filtrar"; enlace al ADR 0008). ADR 0008 a `aceptada`. Estado de este plan a
  `hecho` · Ficheros: `docs/ARCHITECTURE.md`, `docs/adr/0008-columna-propia-que-desplaza-el-contenido.md`, este plan
  · Test: `make lint` y `make test`.

### Verificación manual (tu Firefox con sesión, extensión recargada en `about:debugging`)

- V1 · Ventana ancha (> 1312 px) en `/`: guía de YouTube, columna a su derecha y vídeos a la derecha de la columna, sin
  solaparse. ☰ alterna guía completa y mini-guía: la columna se recoloca pegada a la que haya. Ventana de ~1100 px:
  mini-guía + columna + vídeos. Ventana de < 790 px: columna en el borde izquierdo. La barra de chips de inicio no
  tapa la columna ni queda debajo de ella.
- V2 · `/watch`: columna en el borde izquierdo, reproductor y recomendaciones a su derecha y todos se pueden pulsar.
  Modo cine (`t`): la columna sigue y el reproductor ocupa el resto. Pantalla completa (`f`): la columna desaparece y
  el vídeo ocupa toda la pantalla; al salir, vuelve. ☰ abre el cajón de YouTube **por encima** de la columna.
- V3 · `/shorts`: el Short y sus botones quedan en el espacio a la derecha de la columna y se pueden usar; la rueda
  y las flechas siguen pasando de Short.
- V4 · "«" pliega la columna a una tira con "»" y el contenido se ensancha; recargar: sigue plegada; "»" la abre. Con
  dos pestañas, plegar en una pliega la otra. En un perfil limpio (`make up`) aparece abierta.
- V5 · La sección "YouTube Groups" ya no está en la guía ni en el cajón de ☰ de YouTube; en la columna funciona como
  antes: crear grupo y subgrupo con icono, "›"/"‹" con animación, desplegar canales, filtrar por grupo y canal y pasar
  a suscripciones desde `/` y `/watch`. Tras navegar varias veces hay una sola columna.
- V6 · Regresión en `/feed/subscriptions` con un grupo elegido: Filtros (duración, fecha, visualizaciones), Vídeos
  vistos (mostrar, atenuar, ocultar) y Vídeos fuera del filtro (ocultar, atenuar) funcionan como antes. Los botones
  sobre la miniatura no cambian. Tema claro y oscuro: la columna se lee bien.

## Criterios de aceptación

- En todas las páginas de YouTube hay una columna "YouTube Groups" a la izquierda, abierta por defecto, que no tapa ni
  bloquea el contenido ni la guía o mini-guía de YouTube, también en `/watch` (y modo cine) y `/shorts`.
- En pantalla completa la columna no se ve.
- Se puede plegar a una tira estrecha y el estado se recuerda tras recargar y en las demás pestañas.
- La sección ya no aparece dentro de la guía de YouTube y conserva toda su mecánica.
- Los filtros de `/feed/subscriptions` y los botones de miniatura funcionan igual; formato de ajustes compatible
  (ADR 0003); sin dependencias nuevas.

## Fuera de alcance

- Cambiar el ancho de la columna por arrastre o plegarla sola según el ancho de la ventana.
- Mover o modificar la guía, la mini-guía o el masthead de YouTube.
- Selección múltiple y "Limpiar selección" (`gui-5-2`); crear subgrupos con ancla y "›" en todos los grupos
  (`gui-5-3`).
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
| 2026-11-15 | T1 | feat: ajuste sidebarCollapsed (por defecto false) y ADR 0003 al día | Tests de ajustes y de copia de seguridad actualizados con el campo nuevo. |
| 2026-11-15 | T2 | feat: columna propia YouTube Groups con botón de plegar que desplaza el contenido | Columna vacía, clases de `<html>`, CSS de posición y pantalla completa; V1–V4 pendientes a mano. |
