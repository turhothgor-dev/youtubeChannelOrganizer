# 0017 · Menú de opciones en la guía en lugar del panel flotante

- Estado: aceptada
- Fecha: 2026-11-17
- Modifica: [0014](0014-pagina-de-opciones-editor-de-grupos.md) (punto 2: el panel ya no envía
  `youtube-groups:open-editor`), [0003](0003-formato-almacenamiento-ajustes.md) (se retira `panelCollapsed`) y la
  sección de la guía del [0010](0010-seccion-en-la-guia-de-youtube-fija.md) (botones de crear, editar y limpiar)

## Contexto

Tras probar en Firefox (2026-11-17), a la persona le sobra el panel flotante "YouTube Groups" (`ui/panel.js`,
`<aside id="youtube-groups-panel">` fijo en la página, minimizado por defecto con el ajuste `panelCollapsed`): tapa
contenido y duplica la cabecera de la guía. Lo que solo vive en él es Listas (y "Reproducir lo visible"), Filtros
avanzados, Limpieza y Ajustes (modos de visibilidad, marcado automático y copia de seguridad). "Canal actual" y
"Vídeo actual" duplican los botones de las miniaturas y del reproductor.

Restricciones: la sección de la guía está dentro de `tp-yt-app-drawer#guide`, que fuera de suscripciones (y en
`/watch`) es un cajón con `transform` y `overflow` propios; un elemento `position: fixed` dentro de un antecesor con
`transform` se posiciona respecto a ese antecesor y queda recortado.

## Decisión

1. **El panel flotante desaparece.** Su contenido (Listas, Filtros, Limpieza y Ajustes, en ese orden, cada uno en su
   `<details>`) pasa a un **menú desplegable** (`<div id="youtube-groups-menu" role="dialog">`) que abre un botón de
   engranaje al pie de la sección de la guía. Se reutiliza `ui/panel.js` (`YouTubeGroupsPanel`, `ctx.panel`) y
   `ui/panel.css` con el mínimo de cambios: mismos nombres de componente, misma lógica de cada sección.
2. **El menú se crea al abrirlo por primera vez** y se cuelga de `document.body`, no de la guía, para no heredar el
   `transform` ni el recorte del cajón. Es `position: fixed`, ~360 px de ancho (como mucho `100vw - 16px`), alto máximo
   `100vh - 16px` con scroll interno, a la derecha del engranaje; la posición la calcula una función pura
   (`YouTubeGroupsGuide.getMenuPosition`). Se cierra con Escape (el foco vuelve al engranaje), con un `pointerdown`
   fuera del menú, del engranaje y del modal de "Ver" lista, con el propio engranaje, al navegar
   (`yt-navigate-start`) y al redimensionar. Se oculta en pantalla completa como el panel.
3. **"Canal actual" y "Vídeo actual" se eliminan** (y con ellas `renderCurrentChannelSection`,
   `renderCurrentVideoSection` y `scheduleCurrentChannelPanelUpdate`). La resincronización del control del reproductor
   que hacía `scheduleCurrentChannelPanelUpdate` pasa a `ctx.player.schedulePlayerControlSync()` desde el
   `MutationObserver`.
4. **Ajuste `panelCollapsed` retirado** de `youtubeSettings`, igual que `sidebarCollapsed` (ADR 0010, punto 5):
   `normalizeSettings` conserva solo los campos conocidos, así que un valor guardado o en una copia se lee sin error y
   se pierde en la siguiente escritura. No sube `version`.
5. **Guía**: crear (icono "+" en círculo) y editar (lápiz) pasan a la cabecera, a la derecha del título; "Limpiar
   selección" (icono de reciclaje, deshabilitado sin selección, con el número como insignia) y el engranaje van en una
   fila al pie, tras todos los grupos. Solo iconos, con `aria-label` y `title`. Los iconos son rutas SVG de Material
   Icons (Apache 2.0, como `eye`, `check` y `playlist-add`) en `UI_ICON_PATHS`.

## Alternativas descartadas

- **Mantener el panel y solo moverlo**: es lo que la persona rechaza.
- **Menú dentro de la sección de la guía** (desplegado en línea o `position: absolute`): en el cajón (`/watch`, ventanas
  estrechas) queda recortado o se desplaza con la guía, y 240 px no bastan para Limpieza y Listas.
- **Mover Listas, Filtros, Limpieza y Ajustes a la página de opciones** (6-11 del ROADMAP): Filtros y "Reproducir lo
  visible" actúan sobre la pestaña de YouTube, así que no pueden salir de ella; Ajustes y copia sí, pero es otro plan.
- **`popover` de HTML (`popover="auto"`)**: resolvería cerrar fuera y Escape, pero su capa superior y el
  posicionamiento junto al engranaje dependen de la versión de Firefox y su comportamiento en jsdom no está
  disponible para los tests; un `div` con escuchadores propios es poco código y se prueba.
- **Conservar "Canal actual" y "Vídeo actual" en el menú**: duplican los botones de miniatura y reproductor y alargan
  el menú.

## Consecuencias

- Se gana: nada flotante tapa YouTube; una sola entrada (la guía) para filtrar, crear, editar y configurar.
- Se pierde: en `/shorts` no queda forma de marcar como visto a mano, guardar en una lista ni añadir el canal a un
  grupo (antes, "Vídeo actual" y "Canal actual"); el marcado automático sigue. En `/watch` añadir el canal o guardar
  en lista solo se hace desde los botones del reproductor (con el vídeo en pausa). En `/watch` y por debajo de 792 px
  el menú solo está al alcance abriendo el cajón de ☰, como la propia sección.
- A vigilar: si YouTube cambia el DOM de la guía y la sección no aparece, tampoco hay acceso a Listas, Filtros,
  Limpieza ni Ajustes (antes el panel seguía); el riesgo del ADR 0007 crece. El `z-index` del menú debe quedar por
  encima del cajón y del masthead, y por debajo de los desplegables, el selector de iconos y el modal de listas (todos
  con el máximo; el menú se inserta antes en el DOM o usa un valor menor).
