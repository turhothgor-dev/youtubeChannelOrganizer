# Plan: gui-8-1 · Guía con iconos y menú de opciones en lugar del panel flotante

**Estado:** aprobado (2026-11-17)

Issue: correcciones 1, 2 y 3 de la persona tras probar en Firefox (2026-11-17). Índice:
[gui-8](2026-11-17-gui-8-guia-y-editor.md). ADR: [0017](../adr/0017-menu-de-opciones-en-la-guia.md) (propuesta;
modifica 0003, 0010 y 0014).

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

Hoy la sección "YouTube Groups" de la guía (`ui/guide-section.js`) tiene, bajo el título, un botón de texto
"+ Grupo"/"+ Subgrupo" (`.youtube-groups__guide-create`), el formulario de crear y "Limpiar selección (N)"
(`.youtube-groups__guide-clear`, oculto sin selección); el lápiz "✎" (`.youtube-groups__guide-edit`) está en la
cabecera. La banda de color (`setGroupBand`, `box-shadow: inset -4px 0 0` en `ui/icons.css`) se pone en la fila entera
(`.youtube-groups__guide-row`) y queda como una banda recta al extremo. Aparte, el panel flotante (`ui/panel.js`,
`#youtube-groups-panel`, minimizado por defecto con el ajuste `panelCollapsed`) contiene "Canal actual", "Vídeo
actual", Listas, Limpieza, Filtros y Ajustes (con la copia de seguridad).

Decisión (ADR 0017):

- **Cabecera de la guía**: `‹` (volver) · título (flexible, con elipsis) · **(+)** crear · **lápiz** editar, los dos
  a la derecha, solo icono. El (+) conserva la clase `.youtube-groups__guide-create` y el comportamiento actual
  (`getCreateTarget`): abre o cierra el mismo formulario (que sigue entre la cabecera y la columna), con `title` y
  `aria-label` = `guideCreateTarget.title` (destino completo, p. ej. "Crear subgrupo de A"). El lápiz conserva
  `.youtube-groups__guide-edit`, `title` y `aria-label` "Editar grupos" y el mensaje `youtube-groups:open-editor`.
  `guideCreateTarget.label` deja de pintarse (`modules/guide.js` no cambia).
- **Pie de la guía** (`.youtube-groups__guide-footer`, último hijo de la sección, tras el `viewport`): fila horizontal
  con **limpiar selección** (`.youtube-groups__guide-clear`, icono de reciclaje) y **engranaje**
  (`.youtube-groups__guide-menu-button`). Limpiar está siempre visible: deshabilitado sin selección, con `aria-label` y
  `title` "Limpiar selección" o "Limpiar selección (N)" y una insignia (`.youtube-groups__guide-badge`, oculta con 0)
  con N. El engranaje tiene `aria-label` "Opciones", `title` "Opciones: listas, filtros, limpieza y ajustes",
  `aria-haspopup="dialog"`, `aria-controls="youtube-groups-menu"` y `aria-expanded` según el menú.
- **Banda de color**: `setGroupBand` se aplica al botón principal del grupo (`.youtube-groups__guide-item` de la fila),
  no a la fila. Como el botón tiene `border-radius: 10px`, el `box-shadow` inset sigue su curva. Con la banda, el botón
  conserva su `padding` de 12 px a la derecha (regla `.youtube-groups__guide-item.youtube-groups__group-band` en
  `ui/guide-section.css`; la regla general de `ui/icons.css` no cambia, la usan el editor y el formulario).
- **Menú de opciones** (sustituye al panel): `ui/panel.js` pasa a construir, al abrirlo por primera vez,
  `<div id="youtube-groups-menu" class="youtube-groups__menu" role="dialog" aria-label="Opciones de YouTube Groups"
  tabindex="-1">` en `document.body` con los `<details>` actuales en este orden: Listas, Filtros, Limpieza, Ajustes
  (con la copia de seguridad). Misma plantilla estática y misma lógica; sin cabecera, sin botón de minimizar ni de
  editar, sin "Canal actual" ni "Vídeo actual". API nueva: `toggleMenu(anchor)`, `openMenu(anchor)`, `closeMenu()` e
  `isMenuOpen()`; siguen `syncSettingsControls`, `renderPlaylistsSection`, `openPlaylistVideosModal` y
  `closePlaylistModal` (sin menú creado no hacen nada, como hoy sin panel). Desaparecen `createGroupsPanel`,
  `renderCurrentChannelSection`, `renderCurrentVideoSection`, `scheduleCurrentChannelPanelUpdate` y
  `getAllChannelsFromGroup` (sin uso).
  - Posición: `position: fixed`, `width: 360px; max-width: calc(100vw - 16px); max-height: calc(100vh - 16px);
    overflow-y: auto`, `z-index: 2147483646` (por debajo de desplegables, selector de iconos y modal de listas, que
    usan el máximo). Al abrir se muestra, se mide y se coloca con `getMenuPosition` (abajo) a partir del
    `getBoundingClientRect()` del engranaje; recibe el foco (el propio contenedor).
  - Cierre: Escape (en `document`, captura, solo con el menú abierto; devuelve el foco al engranaje), `pointerdown` en
    `document` (captura) fuera del menú, del engranaje y de `.youtube-groups__channel-list-modal`, el propio
    engranaje, `yt-navigate-start`, `resize` y abrir con un engranaje que ya no está conectado. Cerrar oculta (`hidden`)
    y conserva el estado de cada sección (filtros elegidos, análisis de limpieza).
  - Pantalla completa: `ui/fullscreen.css` cambia `#youtube-groups-panel` por `#youtube-groups-menu`.
- **`content.js`**: `renderGroupsPanel` (mantiene el nombre, lo usan varios componentes) deja de crear el panel y de
  pintar "Canal actual"/"Vídeo actual"; pinta la guía como hoy. En el `MutationObserver`, donde se llamaba a
  `ctx.panel.scheduleCurrentChannelPanelUpdate()`, se llama a `ctx.player.schedulePlayerControlSync()` (conserva el
  recálculo del control del reproductor cuando llega tarde el canal) y a lo que ya se llamase del recolector de
  avatares. En `handleStorageChange` (vistos) desaparece `renderCurrentVideoSection`.
- **`ui/watched.js`**: sin llamadas a `ctx.panel.renderCurrentVideoSection()`; `markVideoWatched` ya no busca
  `.youtube-groups__current-video-button` (el error del marcado automático queda en la consola).
- **Ajuste `panelCollapsed`** retirado (ADR 0003 y 0017): fuera de `DEFAULT_SETTINGS`, `ALLOWED_VALUES` y de la API
  (`PANEL_COLLAPSED_VALUES`); un valor guardado o en una copia se ignora sin error. No sube `version`.
- **Iconos** (`modules/icons.js`, `UI_ICON_PATHS`, rutas de Material Icons Apache 2.0, `viewBox 0 0 24 24`, una sola
  ruta cada uno, transcritas de los SVG oficiales): `settings` (settings), `recycle` (recycling), `add`
  (add_circle_outline), `edit` (edit), `arrow-up` (arrow_upward), `arrow-down` (arrow_downward), `palette` (palette),
  `delete` (delete_outline o delete), `swap` (swap_vert). Los cuatro primeros los usa este plan; el resto, gui-8-2.
  Se pintan con `createUiIconSvg` (sin `innerHTML`); los botones de icono llevan el SVG con `aria-hidden`.
- **Posición pura** (`modules/guide.js`): `getMenuPosition(anchor, size, viewport, gap = 8)` con `anchor`
  `{ left, top, right, bottom }`, `size` `{ width, height }` y `viewport` `{ width, height }` → `{ left, top }`
  enteros: `left = anchor.right + gap`; si `left + width > viewport.width - gap`, `left = max(gap, viewport.width -
  gap - width)`; `top = anchor.top`, limitado a `[gap, viewport.height - gap - height]` y, si el menú es más alto que
  `viewport.height - 2·gap`, `top = gap`.

Alternativas descartadas: ver ADR 0017 (menú dentro de la guía, `popover` de HTML, mover todo a opciones).

## Tareas

- [x] T1 · Iconos de interfaz nuevos · Ficheros: `modules/icons.js`, `tests/icons.test.js` · Test: el test de
  `getUiIconPath` recorre también `settings`, `recycle`, `add`, `edit`, `arrow-up`, `arrow-down`, `palette`,
  `delete` y `swap` (cadena no vacía, solo comandos de ruta SVG `/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/`, fuera de
  `ICON_SET`) y `ICON_SET` sigue con 12.
- [x] T2 · Banda de color en el botón del grupo · Ficheros: `ui/guide-section.js`, `ui/guide-section.css`,
  `tests/ui-guide-section.test.js` · Test (jsdom): con A de color `#2196F3` y A1 sin color, en la columna raíz el
  botón `.youtube-groups__guide-item` de A tiene la clase `youtube-groups__group-band` y `--yg-group-color`, y
  `.youtube-groups__guide-row` no; dentro de A, A1 hereda el color en su botón; B sin color no tiene la clase.
- [x] T3 · Crear y editar como iconos a la derecha del título · Ficheros: `ui/guide-section.js`,
  `ui/guide-section.css`, `tests/ui-guide-section.test.js` · Test (jsdom): `.youtube-groups__guide-create` y
  `.youtube-groups__guide-edit` están dentro de `.youtube-groups__guide-header`, en ese orden y tras el título;
  ninguno tiene texto (solo un `svg`); el de crear tiene `aria-label` y `title` "Crear grupo" en la raíz y "Crear
  subgrupo de A" con A seleccionado; los tests existentes de crear grupo y de nombre corto siguen pasando sin cambiar
  lo que comprueban.
- [x] T4 · `getMenuPosition` · Ficheros: `modules/guide.js`, `tests/guide.test.js` · Test: hueco a la derecha →
  `left = right + 8` y `top = anchor.top`; sin hueco a la derecha → pegado al borde derecho menos 8; ancla cerca del
  borde inferior → sube hasta caber; menú más alto que la ventana → `top = 8`; ventana más estrecha que el menú →
  `left = 8`; devuelve enteros.
- [x] T5 · Pie de la guía con "Limpiar selección" de icono · Ficheros: `ui/guide-section.js`, `ui/guide-section.css`,
  `tests/ui-guide-section.test.js` · Test (jsdom): `.youtube-groups__guide-footer` es el último hijo de
  `#youtube-groups-guide` (tras el `viewport`) y contiene `.youtube-groups__guide-clear`; sin selección está
  visible, deshabilitado, con `aria-label` "Limpiar selección" y la insignia oculta; al pulsar un grupo se habilita,
  `aria-label` "Limpiar selección (1)" e insignia "1"; pulsarlo vacía la selección. (El engranaje llega en T6.)
- [x] T6 · Menú de opciones con el engranaje (el panel deja de existir) · Ficheros: `ui/panel.js`, `ui/panel.css`,
  `ui/fullscreen.css`, `ui/guide-section.js`, `ui/guide-section.css`, `content.js`, `tests/ui-panel.test.js`,
  `tests/ui-guide-section.test.js` · Alcance: menú perezoso en `body` con Listas, Filtros, Limpieza y Ajustes (orden
  nuevo), apertura, posición y cierre según "Contexto y decisión"; engranaje en el pie que llama a
  `ctx.panel.toggleMenu(boton)`; `renderGroupsPanel` ya no crea el panel; reglas de `ui/panel.css` solo del panel
  (contenedor fijo, cabecera, minimizado, `.youtube-groups__edit-button`) sustituidas por las del menú, sin tocar las
  clases que comparten otros componentes (comprobar con búsqueda antes de borrar). "Canal actual" y "Vídeo actual"
  siguen en el menú hasta T7. · Test (jsdom, `tests/ui-panel.test.js` reescrito, sin cambiar lo que comprueban los
  tests de Limpieza y Filtros salvo abrir antes el menú): `create` no toca el DOM y expone la API nueva; tras cargar no
  hay `#youtube-groups-panel` ni `#youtube-groups-menu`; pulsar el engranaje crea un único `#youtube-groups-menu` hijo
  de `body`, visible, con `aria-expanded="true"` en el engranaje y los `summary` en orden Listas, Filtros, Limpieza,
  Ajustes; tiene `style.left`/`style.top` en px; Escape lo oculta y el foco vuelve al engranaje; `pointerdown` en
  `body` lo oculta y dentro del menú no; el engranaje otra vez lo cierra; reabrir reutiliza el mismo elemento y
  conserva "Filtros (1)"; `yt-navigate-start` lo cierra; "Analizar" de Limpieza lista un canal repetido; cambiar
  "Vídeos vistos" a "Ocultar" guarda `watchedMode: "hide"`.
- [ ] T7 · Quitar "Canal actual" y "Vídeo actual" · Ficheros: `ui/panel.js`, `ui/panel.css`, `ui/watched.js`,
  `content.js`, `tests/ui-panel.test.js`, `tests/ui-player.test.js` si hace falta · Test (jsdom): el menú no tiene
  `.youtube-groups__current-channel` ni `.youtube-groups__current-video`; en `/watch` con el fixture del reproductor,
  añadir el propietario del vídeo después de cargar (mutación) actualiza el control del reproductor ("+G" pasa a
  habilitado), como hacía `scheduleCurrentChannelPanelUpdate`; marcar visto desde el reproductor sigue funcionando
  (tests de `ui-player` y `ui-watched` en verde sin cambiar lo que comprueban).
- [ ] T8 · Retirar `panelCollapsed` · Ficheros: `modules/settings.js`, `tests/settings.test.js`,
  `tests/backup.test.js` · Test: `DEFAULT_SETTINGS` sin `panelCollapsed`; `normalizeSettings({ panelCollapsed:
  false })` no lo devuelve; `updateSettings({ panelCollapsed: true })` lanza "Ajuste inválido: panelCollapsed.";
  ajustes guardados con `panelCollapsed` se leen sin error y la siguiente escritura no lo guarda; importar una copia
  con `panelCollapsed` la acepta (`dropped` igual) y no lo guarda (como el test de `sidebarCollapsed`). Los tests que
  esperaban `panelCollapsed` se actualizan porque el requisito cambia, no para que pasen.
- [ ] T9 · Cerrar · Ficheros: `docs/ARCHITECTURE.md` (fila de `ui/panel.js` → menú de opciones; `modules/icons.js`
  con los iconos nuevos; `modules/guide.js` con `getMenuPosition`; `modules/settings.js` sin `panelCollapsed`;
  `ui/*.css` y `fullscreen.css`; flujos que citan el panel, "Canal actual" o "Vídeo actual": botones del reproductor,
  añadir un canal, filtros avanzados, marcar como visto, listas, reproducir lo visible, sincronización, guía lateral,
  editor de grupos, limpieza y copia; ADR 0017 en "Decisiones"), `docs/adr/0017-menu-de-opciones-en-la-guia.md`
  (aceptada), cabeceras "Modificado por: 0017" en `docs/adr/0003-…`, `0010-…` y `0014-…` y la línea de
  `panelCollapsed` del 0003 como retirado, este plan a `hecho` · Test: `make lint`, `make test` y V1 a V8.

### Verificación manual (Firefox, extensión recargada; A con color azul y un canal, subgrupo A1 sin color, B sin color)

- V1 · En suscripciones (guía fija): la cabecera muestra "YouTube Groups" y, a la derecha, (+) y lápiz; (+) abre el
  formulario y crea un grupo; con A seleccionado su `title` es "Crear subgrupo de A" y crea en A; el lápiz abre el
  editor en una pestaña.
- V2 · La banda azul de A (y la heredada de A1 dentro de A) es el borde derecho curvo de su botón, no una barra recta
  al final de la fila; con el cursor encima y seleccionado sigue viéndose bien, en tema claro y oscuro.
- V3 · Al pie, tras todos los grupos y canales desplegados: reciclaje (deshabilitado sin selección; con dos canales
  seleccionados muestra "2" y los deselecciona) y engranaje.
- V4 · El engranaje abre el menú a la derecha de la guía, sin taparla, con scroll interno si no cabe; Escape, clic
  fuera y el engranaje lo cierran; navegar lo cierra. Listas (crear, ver, reproducir, "Reproducir lo visible"),
  Filtros, Limpieza, Ajustes, Exportar e Importar copia funcionan como antes.
- V5 · En `/watch`, abriendo ☰: la sección y el menú funcionan; el menú no queda recortado ni se mueve con el cajón y
  pulsar dentro no cierra el cajón. Por debajo de 792 px igual.
- V6 · No aparece el panel flotante en ninguna página; en pantalla completa el menú abierto no se ve.
- V7 · En `/watch` con el vídeo en pausa, "+G" del reproductor se habilita cuando carga el canal (también tras navegar
  de un vídeo a otro); el marcado automático sigue marcando.
- V8 · Regresión: selección múltiple y filtro, crear subgrupo y pasar a su columna, avatares, desplegables de las
  tarjetas y selector de icono por encima del menú, sin errores en la consola.

## Criterios de aceptación

- No hay panel flotante: Listas, Filtros, Limpieza y Ajustes (con la copia) se abren desde el engranaje del pie de la
  sección "YouTube Groups", en un menú junto a la guía que se cierra con Escape, clic fuera o el engranaje.
- El título de la guía tiene a la derecha (+) para crear en el destino de siempre y el lápiz para abrir el editor;
  "Limpiar selección" es un icono al pie, deshabilitado sin selección y con el número de seleccionados.
- La banda de color de un grupo sigue la curva del borde derecho de su botón.
- Todos los botones nuevos son solo icono, con nombre accesible y `title`.
- Ajustes guardados y copias antiguas con `panelCollapsed` se cargan sin error.

## Fuera de alcance

- Renombrar `ui/panel.js`, `ui/panel.css`, `YouTubeGroupsPanel`, `ctx.panel` o `renderGroupsPanel` (solo cambia lo
  que hacen; un renombrado sería otro plan de refactor).
- Mover Ajustes o la copia a la página de opciones (ROADMAP 6-11).
- Nuevos botones en `/shorts` para sustituir "Vídeo actual" y "Canal actual" (consecuencia aceptada en el ADR 0017; si
  la persona lo necesita, plan aparte).
- Reposicionar el menú al desplazar la guía (se queda donde se abrió; se cierra al redimensionar).
- Atajos de teclado para el menú (ROADMAP 6-12).
- Cambiar `getCreateTarget` o su `label`.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |
| 2026-11-17 | T1 | La ruta de `recycle` se sustituye por la oficial de Material Icons `recycling` (relleno), descargada de `@material-design-icons/svg@0.14.13`. | La ruta escrita de memoria no era el icono real. | Delegada por la persona ("usa lo recomendado") |
| 2026-11-17 | General | Consecuencias aceptadas: (1) sin "Canal actual" y "Vídeo actual", en `/shorts` no hay botones manuales de visto, lista y +G; se añade al ROADMAP un punto de botones en Shorts; (2) si la guía de YouTube cambia y la sección no aparece, también se pierde el menú (lo mitiga 6-11); (3) la línea de color de gui-8-3 se decide en su V1. | Puntos abiertos del plan. | Delegada por la persona ("usa lo recomendado") |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-17 | T1 | feat: iconos de interfaz nuevos (ajustes, reciclaje, añadir, editar, flechas, paleta, papelera, intercambio) | Añadidos 9 iconos a `UI_ICON_PATHS`. Rutas transcritas de memoria sin acceso a los SVG oficiales: revisar visualmente `recycle` (la menos fiable) en V3. |
| 2026-11-17 | T2 | feat: banda de color en el botón principal del grupo de la guía | `setGroupBand` pasa de la fila al botón; padding derecho de 12 px con banda. Se actualiza `tests/ui-icons-dom.test.js` (comprobaba la banda en la fila) porque el requisito cambia. |
| 2026-11-17 | T3 | feat: crear y editar como iconos a la derecha del título de la guía | (+) y lápiz son solo icono (`add`, `edit`) dentro de la cabecera, tras el título; `label` ya no se pinta. El formulario queda entre la cabecera y "Limpiar selección" hasta T5. |
| 2026-11-17 | T4 | feat: función pura getMenuPosition para colocar el menú de opciones | Añadida a `modules/guide.js` y expuesta; 6 tests en `tests/guide.test.js` (derecha, borde, abajo, más alto, más estrecho, enteros). |
| 2026-11-17 | T5 | feat: pie de la guía con Limpiar selección de icono | Pie `.youtube-groups__guide-footer` tras el viewport con reciclaje (deshabilitado sin selección, `aria-label`/`title` con N e insignia). El formulario sigue entre cabecera y columna. El engranaje llega en T6. |
| 2026-11-17 | T6 | feat: menú de opciones con el engranaje de la guía en lugar del panel flotante | `ui/panel.js` crea perezosamente `#youtube-groups-menu` (Listas, Filtros, Limpieza, Ajustes; "Canal actual"/"Vídeo actual" siguen hasta T7) con `toggleMenu`/`openMenu`/`closeMenu`/`isMenuOpen`, cierre por Escape, clic fuera, navegación y resize. Engranaje en el pie; `renderGroupsPanel` ya no crea el panel; CSS y pantalla completa actualizados; `getAllChannelsFromGroup` retirado. `renderPlaylistsSection` se llama ya tras añadir el menú a `body` (antes corría con el panel fuera del documento). Tests de `ui-panel` reescritos. |
